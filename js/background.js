const SCREENSHOT_WIDTH = 1280;
const SCREENSHOT_QUALITY = 0.82;
const CAPTURE_DELAY = 4000;
const SCROLLED_CAPTURE_RETRY_MS = 15000;
const SCROLLED_CAPTURE_RETRY_INTERVAL_MS = 500;
const BULK_REFRESH_CAPTURE_TIMEOUT = 14000;
const BULK_REFRESH_TAB_CLEANUP_DELAY = 300;
const DEFAULT_SCREENSHOT_REFRESH_MODE = 'visit-interval';
const DEFAULT_SCREENSHOT_REFRESH_VISITS = 1;

let screenshotSaveQueue = Promise.resolve();
let bulkRefreshRunning = false;
const managedRefreshTabIds = new Set();

function getDialParts(site) {
  return site && site.split && site.split.url ? [site, site.split] : [site];
}

function getAllDials(sites) {
  return (sites || []).flatMap(getDialParts);
}

function findDialById(sites, siteId) {
  const targetId = String(siteId);
  for (const site of sites || []) {
    if (site && String(site.id) === targetId) return site;
    if (site && site.split && String(site.split.id) === targetId) return site.split;
  }
  return null;
}

function currentDateStamp() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('-');
}

function isCaptureableUrl(url) {
  return (
    url &&
    !url.startsWith('about:') &&
    !url.startsWith('moz-extension:') &&
    !url.startsWith('chrome:')
  );
}

function getCaptureUrlParts(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return {
      protocol: parsed.protocol,
      host: parsed.hostname.replace(/^www\./, '').toLowerCase(),
      port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
      pathname,
      search: parsed.search || ''
    };
  } catch {
    return null;
  }
}

function sameCaptureUrl(a, b) {
  const first = getCaptureUrlParts(a);
  const second = getCaptureUrlParts(b);
  if (!first || !second) return false;
  return (
    first.protocol === second.protocol &&
    first.host === second.host &&
    first.port === second.port &&
    first.pathname === second.pathname &&
    first.search === second.search
  );
}

function isCaptureRedirectAllowed(originalUrl, currentUrl) {
  const original = getCaptureUrlParts(originalUrl);
  const current = getCaptureUrlParts(currentUrl);
  if (!original || !current) return false;
  if (original.host !== current.host) return false;
  const isAuthOrConsent = /login|signin|auth|consent|captcha/i;
  if (!isAuthOrConsent.test(original.pathname) && isAuthOrConsent.test(current.pathname)) {
    return false;
  }
  return true;
}

function normalizeScreenshotRefreshMode(mode) {
  return ['visit-interval', 'daily', 'disabled'].includes(mode)
    ? mode
    : DEFAULT_SCREENSHOT_REFRESH_MODE;
}

function getScreenshotRefreshVisits(settings) {
  const parsed = parseInt(settings && settings.screenshotRefreshVisits, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SCREENSHOT_REFRESH_VISITS;
  return Math.max(1, Math.min(parsed, 999));
}

function getSiteScreenshotRefreshVisits(site) {
  if (site && site.screenshotRefreshDisabled === true) return 0;
  const parsed = parseInt(site && site.screenshotRefreshVisits, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(parsed, 999));
}

async function normalizeScreenshot(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const srcW = bitmap.width;
  const srcH = bitmap.height;

  const outW = Math.min(SCREENSHOT_WIDTH, srcW);
  const outH = Math.round(outW * srcH / srcW);
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bitmap, 0, 0, srcW, srcH, 0, 0, outW, outH);

  const outputBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: SCREENSHOT_QUALITY
  });
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(outputBlob);
  });
}

async function runInTab(tabId, code) {
  try {
    const result = await browser.tabs.executeScript(tabId, { code });
    return result && result[0];
  } catch (e) {
    console.warn('[SpeedDial] Tab script failed:', e.message);
    return null;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isTabUnscrolled(tabId) {
  const scroll = await runInTab(tabId, `(() => ({
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0
  }))()`);
  return !!scroll && scroll.x <= 10 && scroll.y <= 10;
}

async function waitForDOMQuiet(tabId, quietMs = 400, maxWaitMs = 1500) {
  const result = await runInTab(tabId, `(() => new Promise(resolve => {
    let lastMutation = Date.now();
    let observer = null;
    try {
      observer = new MutationObserver(() => {
        lastMutation = Date.now();
      });
      observer.observe(document.documentElement || document.body, {
        subtree: true,
        childList: true,
        attributes: true
      });
    } catch {
      resolve(true);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastMutation >= ${quietMs} || now - start >= ${maxWaitMs}) {
        clearInterval(interval);
        if (observer) observer.disconnect();
        resolve(true);
      }
    }, 100);
  }))()`);
  return result !== false;
}

async function attemptCaptureForTab(tabId, siteId) {
  let currentTab;
  try {
    currentTab = await browser.tabs.get(tabId);
  } catch {
    return false;
  }
  if (!isCaptureableUrl(currentTab.url)) return false;

  const data = await browser.storage.local.get(['sites', 'settings']);
  const sites = data.sites || [];
  const site = findDialById(sites, siteId);
  if (!site || !sameCaptureUrl(currentTab.url, site.url)) return false;

  // 1. Cloudflare / Bot-Challenge ausschließen
  if (await isCloudflareChallenge(tabId)) {
    return false;
  }

  // 2. Render-Bereitschaft (Bilder/Text vorhanden)
  const rendered = await waitForPageRenderReady(tabId, 2500);
  if (!rendered) return false;

  // 3. Strikte Prüfung 1: Zwingend am Seitenanfang
  const unscrolled = await isTabUnscrolled(tabId);
  if (!unscrolled) {
    return false;
  }

  // 4. DOM-Ruhe abwarten
  await waitForDOMQuiet(tabId, 400, 1500);

  // 5. URL nochmals gegenprüfen
  try {
    const checkTab = await browser.tabs.get(tabId);
    if (!checkTab || !sameCaptureUrl(checkTab.url, site.url)) return false;
  } catch {
    return false;
  }

  // 6. Hover-Unterdrückung aktivieren
  const hoverOverlayToken = await suppressHoverForCapture(tabId);

  // 7. Strikte Prüfung 2: Unmittelbar vor dem Schuss – hat der Nutzer während des Hover-Overlays gescrollt?
  const stillUnscrolled = await isTabUnscrolled(tabId);
  if (!stillUnscrolled) {
    if (hoverOverlayToken) await restoreHoverAfterCapture(tabId, hoverOverlayToken);
    return false;
  }

  // 8. Screenshot aufnehmen
  let raw = null;
  try {
    raw = await browser.tabs.captureTab(tabId, { format: 'jpeg', quality: 90 });
  } catch (err) {
    console.warn('[SpeedDial] captureTab fehlgeschlagen:', err.message);
  } finally {
    if (hoverOverlayToken) {
      await restoreHoverAfterCapture(tabId, hoverOverlayToken);
    }
  }

  if (!raw) return false;

  // 9. Nach dem Schuss: Hat sich die URL verändert?
  try {
    const afterTab = await browser.tabs.get(tabId);
    if (!afterTab || !sameCaptureUrl(afterTab.url, site.url)) return false;
  } catch {
    return false;
  }

  // 10. Normalisieren & Speichern
  try {
    const screenshot = await normalizeScreenshot(raw);
    await saveScreenshotForSite(site.id, currentTab.url, screenshot);
    await runInTab(tabId, `window.__speedDialCaptured = true;`).catch(() => { });
    return true;
  } catch (err) {
    console.error('[SpeedDial] Screenshot speichern fehlgeschlagen:', err);
    return false;
  }
}

async function isCloudflareChallenge(tabId) {
  const isCf = await runInTab(tabId, `(() => {
    try {
      return !!(
        document.getElementById('challenge-running') ||
        document.getElementById('challenge-stage') ||
        document.querySelector('.cf-browser-verification') ||
        (document.title && document.title.includes('Just a moment...'))
      );
    } catch {
      return false;
    }
  })()`);
  return isCf === true;
}

async function waitForPageRenderReady(tabId, timeoutMs = 2500) {
  const result = await runInTab(tabId, `(() => new Promise(resolve => {
    const start = Date.now();
    const minTextChars = 25;

    const hasVisibleContent = () => {
      if (!document.body) return false;
      const text = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
      if (text.length >= minTextChars) return true;
      return !!document.querySelector('img, video, canvas, svg');
    };

    const check = () => {
      if (document.readyState === 'complete' && hasVisibleContent()) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= ${timeoutMs}) {
        resolve(document.readyState === 'complete');
        return;
      }
      setTimeout(check, 100);
    };

    check();
  }))()`);

  return result !== false;
}

async function suppressHoverForCapture(tabId) {
  const overlayToken = `speed-dial-${Date.now()}`;
  const result = await runInTab(tabId, `(() => {
    try {
      const overlay = document.createElement('div');
      overlay.setAttribute('data-speed-dial-capture-overlay', '${overlayToken}');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;background:transparent!important;pointer-events:auto!important;cursor:default!important;';
      (document.body || document.documentElement).appendChild(overlay);
      return '${overlayToken}';
    } catch {
      return null;
    }
  })()`);

  if (result) {
    await delay(120);
    return result;
  }
  return null;
}

async function restoreHoverAfterCapture(tabId, overlayToken) {
  if (!overlayToken) return;
  await runInTab(tabId, `document.querySelector('div[data-speed-dial-capture-overlay="${overlayToken}"]')?.remove();`);
}

function sendBulkRefreshStatus(status) {
  browser.runtime.sendMessage({
    type: 'bulk-refresh-status',
    ...status
  }).catch(() => { });
}

async function withLatestSite(siteId, url, extraKeys, callback) {
  const task = screenshotSaveQueue.then(async () => {
    const latestData = await browser.storage.local.get(['sites', ...extraKeys]);
    const latestSites = latestData.sites || [];
    const latestSite = findDialById(latestSites, siteId);
    if (!latestSite || (url && !sameCaptureUrl(latestSite.url, url))) return false;
    return await callback(latestSite, latestSites, latestData);
  });
  screenshotSaveQueue = task.catch(() => { });
  return task;
}

async function saveScreenshotForSite(siteId, url, screenshot) {
  return withLatestSite(siteId, url, [], async (latestSite, latestSites) => {
    latestSite.screenshotVisitCount = 0;
    latestSite.screenshotLastCapturedAt = currentDateStamp();
    await browser.storage.local.set({
      sites: latestSites,
      [`screenshot_${siteId}`]: screenshot
    });
    return true;
  });
}

async function shouldCaptureScreenshotForVisit(siteId, url, settings, force = false) {
  if (force) return true;

  const mode = normalizeScreenshotRefreshMode(settings && settings.screenshotRefreshMode);
  const today = currentDateStamp();

  return withLatestSite(siteId, url, [`screenshot_${siteId}`], async (latestSite, latestSites, latestData) => {
    const hasScreenshot = !!latestData[`screenshot_${siteId}`];
    if (!hasScreenshot) return true;

    const siteInterval = getSiteScreenshotRefreshVisits(latestSite);
    if (siteInterval === 0) return false;

    if (siteInterval === null && mode === 'disabled') {
      return false;
    }

    const interval = siteInterval !== null ? siteInterval : getScreenshotRefreshVisits(settings);
    if (siteInterval !== null || mode === 'visit-interval') {
      const nextVisitCount = (parseInt(latestSite.screenshotVisitCount, 10) || 0) + 1;
      latestSite.screenshotVisitCount = nextVisitCount;
      await browser.storage.local.set({ sites: latestSites });
      return nextVisitCount >= interval;
    }

    if (mode === 'daily') {
      if (latestSite.screenshotLastCapturedAt === today) {
        return false;
      }
      return true;
    }

    return false;
  });
}

function waitForTabComplete(tabId, timeoutMs = 12000) {
  return new Promise(resolve => {
    let timer = null;

    const onUpdatedListener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve(true);
      }
    };

    const onRemovedListener = removedTabId => {
      if (removedTabId === tabId) {
        cleanup();
        resolve(false);
      }
    };

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(onUpdatedListener);
      browser.tabs.onRemoved.removeListener(onRemovedListener);
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    browser.tabs.onUpdated.addListener(onUpdatedListener);
    browser.tabs.onRemoved.addListener(onRemovedListener);

    browser.tabs.get(tabId).then(currentTab => {
      if (currentTab && currentTab.status === 'complete') {
        cleanup();
        resolve(true);
      }
    }).catch(() => {
      cleanup();
      resolve(false);
    });
  });
}

async function openSiteAndWaitForAutomaticScreenshot(site, windowId) {
  if (!isCaptureableUrl(site.url)) {
    return false;
  }

  let tab = null;
  let originalActiveTabId = null;

  try {
    try {
      const activeTabs = Number.isInteger(windowId)
        ? await browser.tabs.query({ active: true, windowId })
        : await browser.tabs.query({ active: true, currentWindow: true });
      originalActiveTabId = activeTabs[0] ? activeTabs[0].id : null;
    } catch {
      originalActiveTabId = null;
    }

    const createProperties = { url: site.url, active: false };
    if (Number.isInteger(windowId)) {
      createProperties.windowId = windowId;
    }

    try {
      tab = await browser.tabs.create(createProperties);
    } catch (createErr) {
      if (createProperties.windowId !== undefined) {
        delete createProperties.windowId;
        tab = await browser.tabs.create(createProperties);
      } else {
        throw createErr;
      }
    }
    managedRefreshTabIds.add(tab.id);

    const loaded = await waitForTabComplete(tab.id, 12000);
    if (!loaded) return false;
    await delay(CAPTURE_DELAY);

    let currentTab;
    try {
      currentTab = await browser.tabs.get(tab.id);
    } catch {
      console.warn('[SpeedDial] Tab wurde vor Capture geschlossen:', site.url);
      return false;
    }

    if (!currentTab || !currentTab.url || !isCaptureRedirectAllowed(site.url, currentTab.url)) {
      return false;
    }

    if (await isCloudflareChallenge(tab.id)) return false;
    const rendered = await waitForPageRenderReady(tab.id, 2500);
    if (!rendered) return false;

    await runInTab(tab.id, `window.scrollTo(0, 0);`).catch(() => { });
    await delay(100);

    await waitForDOMQuiet(tab.id, 400, 1500);

    if (!(await isTabUnscrolled(tab.id))) return false;

    const hoverToken = await suppressHoverForCapture(tab.id).catch(() => null);

    if (!(await isTabUnscrolled(tab.id))) {
      if (hoverToken) await restoreHoverAfterCapture(tab.id, hoverToken).catch(() => { });
      return false;
    }

    let raw = null;
    try {
      raw = await browser.tabs.captureTab(tab.id, { format: 'jpeg', quality: 90 });
    } catch (err) {
      console.error('[SpeedDial] captureTab fehlgeschlagen:', err.message);
    } finally {
      if (hoverToken) {
        await restoreHoverAfterCapture(tab.id, hoverToken).catch(() => { });
      }
    }

    if (!raw) {
      return false;
    }

    try {
      const afterTab = await browser.tabs.get(tab.id);
      if (!afterTab || !afterTab.url || !isCaptureRedirectAllowed(site.url, afterTab.url)) {
        return false;
      }
      currentTab = afterTab;
    } catch {
      return false;
    }
    if (await isCloudflareChallenge(tab.id)) return false;

    const screenshot = await normalizeScreenshot(raw);
    const finalUrl = currentTab.url || site.url;
    await saveScreenshotForSite(site.id, finalUrl, screenshot);
    return true;
  } catch (error) {
    console.warn('[SpeedDial] Automatische Screenshot-Aktualisierung fehlgeschlagen:', site.url, error.message);
    return false;
  } finally {
    if (tab) {
      managedRefreshTabIds.delete(tab.id);
      await browser.tabs.remove(tab.id).catch(() => { });
      await delay(BULK_REFRESH_TAB_CLEANUP_DELAY);
    }
  }
}

async function refreshAllScreenshots(refreshWindowId) {
  if (bulkRefreshRunning) {
    sendBulkRefreshStatus({
      state: 'busy',
      message: 'Aktualisierung läuft bereits.'
    });
    return;
  }

  bulkRefreshRunning = true;
  let updated = 0;
  let current = 0;
  let total = 0;

  try {
    const activeTabs = Number.isInteger(refreshWindowId)
      ? await browser.tabs.query({ active: true, windowId: refreshWindowId })
      : await browser.tabs.query({ active: true, currentWindow: true });
    const originalActiveTabId = activeTabs[0] ? activeTabs[0].id : null;
    const targetWindowId = Number.isInteger(refreshWindowId)
      ? refreshWindowId
      : (activeTabs[0] ? activeTabs[0].windowId : undefined);
    const data = await browser.storage.local.get('sites');
    const refreshSites = getAllDials(data.sites).filter(site => (
      site &&
      site.url &&
      getSiteScreenshotRefreshVisits(site) !== 0
    ));
    total = refreshSites.length;

    if (!total) {
      sendBulkRefreshStatus({
        state: 'done',
        current: 0,
        total: 0,
        message: 'Keine aktualisierbaren Kacheln vorhanden.'
      });
      return;
    }

    sendBulkRefreshStatus({
      state: 'progress',
      current: 0,
      total,
      message: `0 / ${total} Vorschaubilder aktualisiert.`
    });

    for (let i = 0; i < refreshSites.length; i += 1) {
      const success = await openSiteAndWaitForAutomaticScreenshot(refreshSites[i], targetWindowId);
      if (success) updated += 1;
      current = i + 1;
      sendBulkRefreshStatus({
        state: 'progress',
        current,
        total,
        message: `${current} / ${total} geöffnet, ${updated} aktualisiert.`
      });
    }

    sendBulkRefreshStatus({
      state: 'done',
      current: total,
      total,
      message: `${updated} / ${total} Vorschaubilder aktualisiert.`
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    sendBulkRefreshStatus({
      state: 'done',
      current,
      total,
      message: `Aktualisierung fehlgeschlagen: ${message}`
    });
  } finally {
    bulkRefreshRunning = false;
  }
}

async function refreshSingleScreenshot(siteId, refreshWindowId, force = false) {
  if (bulkRefreshRunning) {
    return false;
  }

  bulkRefreshRunning = true;

  try {
    const data = await browser.storage.local.get('sites');
    const site = findDialById(data.sites, siteId);
    if (!site || !site.url) {
      return false;
    }
    if (!force && getSiteScreenshotRefreshVisits(site) === 0) {
      return false;
    }

    const targetWindowId = Number.isInteger(refreshWindowId) ? refreshWindowId : undefined;
    return await openSiteAndWaitForAutomaticScreenshot(site, targetWindowId);
  } catch (error) {
    console.warn('[SpeedDial] Single screenshot refresh failed:', error.message);
    return false;
  } finally {
    bulkRefreshRunning = false;
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message) return undefined;

  const messageWindowId = Number.isInteger(message.windowId) ? message.windowId : undefined;
  const senderWindowId = sender && sender.tab ? sender.tab.windowId : undefined;
  const targetWindowId = messageWindowId !== undefined ? messageWindowId : senderWindowId;

  if (message.type === 'bulk-refresh-screenshots') {
    refreshAllScreenshots(targetWindowId);
    return undefined;
  }

  if (message.type === 'refresh-screenshot') {
    return refreshSingleScreenshot(message.siteId, targetWindowId, Boolean(message.force));
  }

  return undefined;
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status !== 'complete' ||
    !isCaptureableUrl(tab.url) ||
    managedRefreshTabIds.has(tabId)
  ) return;

  const data = await browser.storage.local.get(['sites', 'settings']);
  const sites = data.sites || [];

  const matchingSite = getAllDials(sites).find(site => sameCaptureUrl(tab.url, site.url));
  if (!matchingSite || getSiteScreenshotRefreshVisits(matchingSite) === 0) return;

  const shouldCapture = await shouldCaptureScreenshotForVisit(
    matchingSite.id,
    tab.url,
    data.settings,
    false
  );
  if (!shouldCapture) return;

  // Ausreichend warten, damit Seiten/Cloudflare fertig geladen sind
  await delay(CAPTURE_DELAY);

  // Cloudflare sofort abfangen
  if (await isCloudflareChallenge(tabId)) return;

  // Render-Bereitschaft (Bilder/Text geladen)
  await waitForPageRenderReady(tabId, 2500);

  // Fall A: Nutzer ist direkt am Seitenanfang
  if (await isTabUnscrolled(tabId)) {
    const captured = await attemptCaptureForTab(tabId, matchingSite.id);
    if (captured) return;
  }

  // Fall B: Seite ist beim Laden gescrollt.
  // Genau bis zu 15 Sekunden alle 500ms prüfen, ob der Nutzer wieder nach oben scrollt.
  const deadline = Date.now() + SCROLLED_CAPTURE_RETRY_MS;
  while (Date.now() < deadline) {
    await delay(SCROLLED_CAPTURE_RETRY_INTERVAL_MS);
    try {
      const current = await browser.tabs.get(tabId);
      if (!current || !sameCaptureUrl(current.url, matchingSite.url)) break;
    } catch {
      break;
    }
    if (await isTabUnscrolled(tabId)) {
      const captured = await attemptCaptureForTab(tabId, matchingSite.id);
      if (captured) return;
    }
  }

  // Nach 15 Sekunden nicht wieder am Seitenanfang: STRIKT ABBRECHEN.
});

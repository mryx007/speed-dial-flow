function currentDateTimeStamp() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return [
    pad(now.getDate()),
    pad(now.getMonth() + 1),
    String(now.getFullYear()).slice(-2)
  ].join('.') + '_' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('-');
}

function numberOrDefault(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hexToRgba(hex, alpha = 1) {
  const value = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(255, 255, 255, ${alpha})`;
  const boundedAlpha = Math.max(0, Math.min(Number(alpha) || 0, 1));
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${boundedAlpha})`;
}

function normalizeSiteUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value) ? value : `https://${value}`;
}

function getDomain(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const parseUrl = normalizeSiteUrl(value);
  try {
    return new URL(parseUrl).hostname.replace(/^www\./, '') || value;
  } catch {
    return value;
  }
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function getCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

function concatBytes(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function getZipDateFields(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  const { time, date } = getZipDateFields();
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = textToBytes(entry.name);
    const dataBytes = entry.bytes;
    const crc = getCrc32(dataBytes);

    if (nameBytes.length > 0xffff || dataBytes.length > 0xffffffff) {
      throw new Error('Backup ist zu groß für dieses ZIP-Format.');
    }

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, dataBytes.length);
    writeUint32(localView, 22, dataBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, dataBytes.length);
    writeUint32(centralView, 24, dataBytes.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

function normalizeZipPath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function parseStoredZip(bytes) {
  const entries = new Map();
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const signature = readUint32(bytes, offset);
    if (signature !== 0x04034b50) break;
    if (offset + 30 > bytes.length) {
      throw new Error(t('err_zip_incomplete'));
    }

    const flags = readUint16(bytes, offset + 6);
    const method = readUint16(bytes, offset + 8);
    const compressedSize = readUint32(bytes, offset + 18);
    const fileNameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (flags & 0x08) {
      throw new Error(t('err_zip_unsupported_size'));
    }
    if (method !== 0) {
      throw new Error(t('err_zip_compressed'));
    }
    if (dataEnd > bytes.length) {
      throw new Error(t('err_zip_incomplete'));
    }

    const name = normalizeZipPath(bytesToText(bytes.slice(nameStart, nameStart + fileNameLength)));
    entries.set(name, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }

  return entries;
}

function isZipFile(bytes) {
  return bytes.length >= 4 && readUint32(bytes, 0) === 0x04034b50;
}

const DEFAULT_SETTINGS = {
  columns: 5,
  tileWidth: 230,
  tileHeight: 160,
  previewType: 'thumbs',
  previewFit: 'cover',
  previewFill: 0,
  showThumbBorder: true,
  thumbBorderWidth: 1,
  thumbBorderColor: '#5f6670',
  thumbBorderOpacity: 100,
  screenshotRefreshMode: 'visit-interval',
  screenshotRefreshVisits: 1,
  columnGap: 12,
  rowGap: 12,
  background: '#2b2b2b',
  backgroundImage: '',
  backgroundSize: 'auto',
  backgroundPosition: 'center center',
  titleSize: 12,
  titleWeight: 400,
  titleBarHeight: 28,
  tileTitleBackground: '#333333',
  tileTitleColor: '#dddddd',
  showTitleSeparator: true,
  titleSeparatorWidth: 1,
  titleSeparatorColor: '#3d3d3d',
  titleSeparatorOpacity: 100,
  tileRadius: 8,
  showTileShadow: false,
  tileShadowOpacity: 25,
  showAddTile: true,
  autoFit: true,
  tilesLocked: false,
  language: 'auto',
  menuTheme: 'dark'
};

let sites = [];
let settings = { ...DEFAULT_SETTINGS };
let editingId = null;
let contextSite = null;
let contextParentSite = null;
let pendingBackgroundImage = '';
let pendingBackgroundImageTask = null;
let settingsSaveTimer = null;
let ignoreNextSettingsOutsideClick = false;
let draggedSiteId = null;
let dragImageEl = null;
let dragDropped = false;
let suppressNextTileClick = false;
let siteNameTouched = false;
let editingNameWasAuto = false;
let editingOriginalUrl = '';
let thumbnailRefreshRunning = false;
let initialLoadComplete = false;
let storageChangedDuringInitialLoad = false;
let editingParentId = null;

function getDialParts(site) {
  return site && site.split && site.split.url ? [site, site.split] : [site];
}

function getAllDials() {
  return sites.flatMap(getDialParts);
}

function findDialById(id) {
  const targetId = String(id);
  for (const site of sites) {
    if (String(site.id) === targetId) return { dial: site, parent: site };
    if (site.split && String(site.split.id) === targetId) return { dial: site.split, parent: site };
  }
  return null;
}

function getSiteWithoutScreenshot(site) {
  const copy = { ...site };
  delete copy.screenshot;
  if (copy.split) copy.split = getSiteWithoutScreenshot(copy.split);
  return copy;
}

const FAST_CACHE_SETTINGS_KEY = 'speed_dial_cache_settings';
const FAST_CACHE_SITES_KEY = 'speed_dial_fast_sites_v2';
const FAST_CACHE_WIDTH_KEY = 'speed_dial_fast_cache_width';
const thumbnailShrinkCache = new Map();
let currentCachedTargetWidth = 0;

function getFastCacheTargetWidth(tileWidth = settings?.tileWidth) {
  const baseWidth = Math.max(50, Math.min(Number(tileWidth) || DEFAULT_SETTINGS.tileWidth, 1200));
  const factor = baseWidth <= 400 ? 2 : (baseWidth <= 600 ? 1.5 : 1);
  return Math.min(1280, Math.max(200, Math.round(baseWidth * factor)));
}

function shrinkImageForCache(dataUrl, targetWidth = getFastCacheTargetWidth()) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return Promise.resolve(dataUrl);
  }

  if (currentCachedTargetWidth !== targetWidth) {
    thumbnailShrinkCache.clear();
    currentCachedTargetWidth = targetWidth;
  }

  if (thumbnailShrinkCache.has(dataUrl)) {
    return Promise.resolve(thumbnailShrinkCache.get(dataUrl));
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          resolve(dataUrl);
          return;
        }

        if (srcW <= targetWidth) {
          thumbnailShrinkCache.set(dataUrl, dataUrl);
          resolve(dataUrl);
          return;
        }

        const scale = targetWidth / srcW;
        const w = targetWidth;
        const h = Math.round(srcH * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const thumbUrl = canvas.toDataURL('image/jpeg', 0.75);
        if (thumbnailShrinkCache.size >= 40) {
          const firstKey = thumbnailShrinkCache.keys().next().value;
          thumbnailShrinkCache.delete(firstKey);
        }
        thumbnailShrinkCache.set(dataUrl, thumbUrl);
        resolve(thumbUrl);
      } catch (err) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function getScreenshotSig(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const len = dataUrl.length;
  const mid = Math.floor(len / 2);
  return `${len}:${dataUrl.slice(mid, mid + 32)}:${dataUrl.slice(-32)}`;
}

async function generateFastSites(sitesToCache, targetWidth) {
  return Promise.all(sitesToCache.map(async site => {
    const copy = { ...site };
    if (copy.screenshot) {
      copy._origSig = getScreenshotSig(copy.screenshot);
      copy.screenshot = await shrinkImageForCache(copy.screenshot, targetWidth);
    }
    if (copy.split) {
      copy.split = { ...copy.split };
      if (copy.split.screenshot) {
        copy.split._origSig = getScreenshotSig(copy.split.screenshot);
        copy.split.screenshot = await shrinkImageForCache(copy.split.screenshot, targetWidth);
      }
    }
    return copy;
  }));
}

async function cacheFastSitesWithThumbnails(sitesToCache, force = true) {
  if (!sitesToCache || !sitesToCache.length) return;

  const targetWidth = getFastCacheTargetWidth();
  const cachedWidth = localStorage.getItem(FAST_CACHE_WIDTH_KEY);

  if (!force && cachedWidth === String(targetWidth) && localStorage.getItem(FAST_CACHE_SITES_KEY)) {
    return;
  }

  try {
    const fastSites = await generateFastSites(sitesToCache, targetWidth);
    localStorage.setItem(FAST_CACHE_SITES_KEY, JSON.stringify(fastSites));
    localStorage.setItem(FAST_CACHE_WIDTH_KEY, String(targetWidth));
  } catch (e) {
    console.warn('Could not save fast sites cache at targetWidth', targetWidth, e);
    try {
      const fallbackSites = await generateFastSites(sitesToCache, 320);
      localStorage.setItem(FAST_CACHE_SITES_KEY, JSON.stringify(fallbackSites));
      localStorage.setItem(FAST_CACHE_WIDTH_KEY, '320');
    } catch (errFallback) {
      console.warn('Fallback fast sites cache also failed:', errFallback);
      try {
        localStorage.removeItem(FAST_CACHE_SITES_KEY);
        localStorage.removeItem(FAST_CACHE_WIDTH_KEY);
      } catch (_) {}
    }
  }
}

function writeFastCacheSettings(settingsToCache) {
  if (!settingsToCache) return;
  try {
    const toSave = (settingsToCache.backgroundImage && settingsToCache.backgroundImage.length > 65536)
      ? { ...settingsToCache, backgroundImage: '' }
      : settingsToCache;
    localStorage.setItem(FAST_CACHE_SETTINGS_KEY, JSON.stringify(toSave));
  } catch (e) {
    try {
      const fallback = { ...settingsToCache, backgroundImage: '' };
      localStorage.setItem(FAST_CACHE_SETTINGS_KEY, JSON.stringify(fallback));
    } catch (_) {}
  }
}

function restoreFastCache() {
  try {
    localStorage.removeItem('speed_dial_cache_sites');
    const rawSettings = localStorage.getItem(FAST_CACHE_SETTINGS_KEY) || localStorage.getItem('speed-dial-startup-appearance-v1');
    const rawSites = localStorage.getItem(FAST_CACHE_SITES_KEY);

    if (rawSettings) {
      settings = normalizeSettings(JSON.parse(rawSettings));
      applySettings();
      updateLockButtonUI();
    }

    if (rawSites) {
      const parsedSites = JSON.parse(rawSites);
      if (Array.isArray(parsedSites) && parsedSites.length > 0) {
        sites = parsedSites;
        render();
      }
    }
  } catch (error) {
    console.warn('Fast cache restore failed:', error);
  }
}

function isSameScreenshot(cachedSite, newSite) {
  const cur = cachedSite?.screenshot || '';
  const next = newSite?.screenshot || '';
  if (!cur && !next) return true;
  if (!cur || !next) return false;
  if (cur === next) return true;
  if (cachedSite?._origSig && cachedSite._origSig === getScreenshotSig(next)) return true;
  return false;
}

function haveSitesChanged(currentSites, newSites) {
  if (currentSites.length !== newSites.length) return true;
  for (let i = 0; i < currentSites.length; i++) {
    const a = currentSites[i];
    const b = newSites[i];
    if (!a || !b) return true;
    if (a.id !== b.id || a.url !== b.url || a.title !== b.title) return true;
    if (!!a.split !== !!b.split) return true;
    if (a.split && b.split && (a.split.id !== b.split.id || a.split.url !== b.split.url || a.split.title !== b.split.title)) return true;
    if (!isSameScreenshot(a, b)) return true;
    if (a.split && b.split && !isSameScreenshot(a.split, b.split)) return true;
  }
  return false;
}

function getSitesWithoutScreenshots() {
  return sites.map(getSiteWithoutScreenshot);
}

async function load() {
  try {
    const data = await browser.storage.local.get(null);
    const loadedSites = Array.isArray(data.sites) ? data.sites : [];

    loadedSites.forEach(s => {
      getDialParts(s).forEach(dial => {
        const screenshot = data[`screenshot_${dial.id}`];
        delete dial.screenshot;
        if (screenshot) dial.screenshot = screenshot;
      });
    });

    const normalizedSettings = normalizeSettings(data.settings);
    const settingsChanged = JSON.stringify(settings) !== JSON.stringify(normalizedSettings);
    const hadRenderedSites = sites.length > 0;
    const sitesChanged = !hadRenderedSites || haveSitesChanged(sites, loadedSites);

    if (!sitesChanged && hadRenderedSites) {
      loadedSites.forEach((loadedSite, i) => {
        const currentSite = sites[i];
        if (currentSite) {
          if (currentSite._origSig) loadedSite._origSig = currentSite._origSig;
          if (currentSite.split && loadedSite.split && currentSite.split._origSig) {
            loadedSite.split._origSig = currentSite.split._origSig;
          }
        }
      });
    } else if (hadRenderedSites && sitesChanged && sites.length === loadedSites.length) {
      const onlyScreenshotsChanged = sites.every((s, i) => {
        const ls = loadedSites[i];
        return s && ls && s.id === ls.id && s.url === ls.url && s.title === ls.title &&
          (!!s.split === !!ls.split) &&
          (!s.split || (s.split.id === ls.split.id && s.split.url === ls.split.url));
      });
      if (onlyScreenshotsChanged) {
        loadedSites.forEach((ls, i) => {
          const cur = sites[i];
          if (!isSameScreenshot(cur, ls)) {
            const tile = document.querySelector(`.tile[data-id="${ls.id}"]`);
            if (tile) {
              const preview = tile.querySelector('.tile-preview');
              if (preview) updateTilePreviewSmooth(preview, ls, false);
            }
          }
          if (ls.split && cur && cur.split && !isSameScreenshot(cur.split, ls.split)) {
            const tile = document.querySelector(`.tile[data-id="${ls.id}"]`);
            if (tile) {
              const part = tile.querySelector(`.tile-part[data-id="${ls.split.id}"]`);
              if (part) {
                const preview = part.querySelector('.tile-preview');
                if (preview) updateTilePreviewSmooth(preview, ls.split, true);
              }
            }
          }
        });
        sites = loadedSites;
        settings = normalizedSettings;
        if (settingsChanged) applySettings();
        writeFastCacheSettings(settings);
        cacheFastSitesWithThumbnails(sites, true);
        return;
      }
    }

    sites = loadedSites;
    settings = normalizedSettings;

    if (settingsChanged) {
      applySettings();
    } else if (typeof applyTranslations === 'function') {
      applyTranslations();
    }
    updateLockButtonUI();

    if (sitesChanged) {
      render();
    }

    writeFastCacheSettings(settings);
    cacheFastSitesWithThumbnails(sites, sitesChanged);
  } catch (error) {
    console.warn('Speed Dial could not load stored data.', error);
    if (!sites.length) {
      sites = [];
      settings = normalizeSettings(settings);
      applySettings();
      render();
    }
  }

  setThumbnailRefreshStatus(0, getAllDials().length);

  if (!initialLoadComplete) {
    initialLoadComplete = true;
    if (storageChangedDuringInitialLoad) {
      storageChangedDuringInitialLoad = false;
      load().catch(error => console.warn('Speed Dial could not refresh after initial storage change.', error));
    }
  }
}

function normalizeSettings(rawSettings = {}) {
  const raw = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const normalized = { ...DEFAULT_SETTINGS, ...raw };
  if (raw.gap !== undefined) {
    if (raw.columnGap === undefined) normalized.columnGap = raw.gap;
    if (raw.rowGap === undefined) normalized.rowGap = raw.gap;
  }
  normalized.columns = Math.max(
    1,
    Math.min(numberOrDefault(normalized.columns, DEFAULT_SETTINGS.columns), 20)
  );
  normalized.tileWidth = Math.max(
    50,
    Math.min(numberOrDefault(normalized.tileWidth, DEFAULT_SETTINGS.tileWidth), 1200)
  );
  normalized.tileHeight = Math.max(
    30,
    Math.min(numberOrDefault(normalized.tileHeight, DEFAULT_SETTINGS.tileHeight), 1000)
  );
  normalized.columnGap = Math.max(
    0,
    Math.min(numberOrDefault(normalized.columnGap, DEFAULT_SETTINGS.columnGap), 100)
  );
  normalized.rowGap = Math.max(
    0,
    Math.min(numberOrDefault(normalized.rowGap, DEFAULT_SETTINGS.rowGap), 100)
  );
  if (!['thumbs', 'icons'].includes(normalized.previewType)) {
    normalized.previewType = DEFAULT_SETTINGS.previewType;
  }
  const fitVal = String(normalized.previewFit || '').toLowerCase();
  normalized.previewFit = ['cover', 'contain', 'stretch', 'fill'].includes(fitVal)
    ? (fitVal === 'fill' ? 'stretch' : fitVal)
    : DEFAULT_SETTINGS.previewFit;
  normalized.previewFill = Math.max(
    0,
    Math.min(numberOrDefault(normalized.previewFill, DEFAULT_SETTINGS.previewFill), 60)
  );
  normalized.showThumbBorder = normalized.showThumbBorder !== false;
  normalized.thumbBorderWidth = Math.max(
    0,
    Math.min(numberOrDefault(normalized.thumbBorderWidth, DEFAULT_SETTINGS.thumbBorderWidth), 12)
  );
  if (!/^#[0-9a-f]{6}$/i.test(normalized.thumbBorderColor)) {
    normalized.thumbBorderColor = DEFAULT_SETTINGS.thumbBorderColor;
  }
  normalized.thumbBorderOpacity = Math.max(
    0,
    Math.min(numberOrDefault(normalized.thumbBorderOpacity, DEFAULT_SETTINGS.thumbBorderOpacity), 100)
  );
  if (!['contain', 'auto', 'cover'].includes(normalized.backgroundSize)) {
    normalized.backgroundSize = DEFAULT_SETTINGS.backgroundSize;
  }
  if (![
    'top left',
    'top center',
    'top right',
    'center left',
    'center center',
    'center right',
    'bottom left',
    'bottom center',
    'bottom right'
  ].includes(normalized.backgroundPosition)) {
    normalized.backgroundPosition = DEFAULT_SETTINGS.backgroundPosition;
  }
  if (!['visit-interval', 'daily', 'disabled'].includes(normalized.screenshotRefreshMode)) {
    normalized.screenshotRefreshMode = DEFAULT_SETTINGS.screenshotRefreshMode;
  }
  normalized.screenshotRefreshVisits = Math.max(
    1,
    Math.min(numberOrDefault(normalized.screenshotRefreshVisits, DEFAULT_SETTINGS.screenshotRefreshVisits), 999)
  );
  normalized.titleSize = Math.max(
    8,
    Math.min(numberOrDefault(normalized.titleSize, DEFAULT_SETTINGS.titleSize), 32)
  );
  normalized.titleWeight = numberOrDefault(normalized.titleWeight, DEFAULT_SETTINGS.titleWeight);
  normalized.showTileShadow = normalized.showTileShadow === true;
  normalized.tileShadowOpacity = Math.max(
    0,
    Math.min(numberOrDefault(normalized.tileShadowOpacity, DEFAULT_SETTINGS.tileShadowOpacity), 100)
  );
  normalized.tileRadius = Math.max(
    0,
    Math.min(numberOrDefault(normalized.tileRadius, DEFAULT_SETTINGS.tileRadius), 32)
  );
  normalized.titleBarHeight = Math.max(
    16,
    Math.min(numberOrDefault(normalized.titleBarHeight, DEFAULT_SETTINGS.titleBarHeight), 80)
  );
  normalized.showTitleSeparator = normalized.showTitleSeparator !== false;
  normalized.titleSeparatorWidth = Math.max(
    1,
    Math.min(numberOrDefault(normalized.titleSeparatorWidth, DEFAULT_SETTINGS.titleSeparatorWidth), 12)
  );
  if (!/^#[0-9a-f]{6}$/i.test(normalized.titleSeparatorColor)) {
    normalized.titleSeparatorColor = DEFAULT_SETTINGS.titleSeparatorColor;
  }
  normalized.titleSeparatorOpacity = Math.max(
    1,
    Math.min(numberOrDefault(normalized.titleSeparatorOpacity, DEFAULT_SETTINGS.titleSeparatorOpacity), 100)
  );
  normalized.showAddTile = normalized.showAddTile !== false;
  normalized.autoFit = normalized.autoFit !== false;
  normalized.tilesLocked = normalized.tilesLocked === true;
  normalized.language = ['auto', 'de', 'en'].includes(normalized.language) ? normalized.language : 'auto';
  normalized.menuTheme = ['dark', 'light'].includes(normalized.menuTheme) ? normalized.menuTheme : 'dark';
  return normalized;
}



function applySettings() {
  const columns = Math.max(1, Math.min(settings.columns, 20));
  const columnGap = Math.max(0, settings.columnGap);
  const rowGap = Math.max(0, settings.rowGap);
  let tileWidth = Math.max(50, settings.tileWidth);
  let tileHeight = Math.max(30, settings.tileHeight);
  let titleBarHeight = settings.titleBarHeight;
  let titleSize = settings.titleSize;

  if (settings.autoFit) {
    const bodyPadding = 40;
    const availableWidth = Math.max(100, (document.documentElement.clientWidth || window.innerWidth) - bodyPadding);
    const totalGaps = (columns - 1) * columnGap;
    const maxPossibleTileWidth = Math.floor((availableWidth - totalGaps) / columns);

    if (maxPossibleTileWidth < tileWidth && maxPossibleTileWidth >= 40) {
      const scale = maxPossibleTileWidth / tileWidth;
      tileWidth = maxPossibleTileWidth;
      tileHeight = Math.max(25, Math.round(tileHeight * scale));
      titleBarHeight = Math.max(14, Math.round(titleBarHeight * Math.max(0.75, scale)));
      titleSize = Math.max(9, Math.round(titleSize * Math.max(0.75, scale)));
    }
  }

  const root = document.documentElement;
  root.style.setProperty('--columns', columns);
  root.style.setProperty('--tile-width', tileWidth + 'px');
  root.style.setProperty('--tile-height', tileHeight + 'px');
  root.style.setProperty('--preview-fit', settings.previewFit === 'stretch' ? '100% 100%' : settings.previewFit);
  root.style.setProperty('--preview-zoom', getPreviewFillScale(settings.previewFill));
  root.style.setProperty('--preview-bg', settings.previewFill > 0 ? '#fff' : '#3c3c3c');
  root.style.setProperty('--thumb-border-width', (settings.showThumbBorder ? settings.thumbBorderWidth : 0) + 'px');
  root.style.setProperty('--thumb-border-color', hexToRgba(settings.thumbBorderColor, settings.thumbBorderOpacity / 100));
  root.style.setProperty('--column-gap', columnGap + 'px');
  root.style.setProperty('--row-gap', rowGap + 'px');
  root.style.setProperty('--title-size', titleSize + 'px');
  root.style.setProperty('--title-weight', settings.titleWeight);
  root.style.setProperty('--title-bar-height', titleBarHeight + 'px');
  root.style.setProperty('--tile-title-bg', settings.tileTitleBackground);
  root.style.setProperty('--tile-title-color', settings.tileTitleColor);
  root.style.setProperty(
    '--title-separator-width',
    (settings.showTitleSeparator ? settings.titleSeparatorWidth : 0) + 'px'
  );
  root.style.setProperty(
    '--title-separator-color',
    hexToRgba(settings.titleSeparatorColor, settings.titleSeparatorOpacity / 100)
  );
  root.style.setProperty('--tile-radius', settings.tileRadius + 'px');
  root.style.setProperty(
    '--tile-shadow',
    settings.showTileShadow ? `0 10px 24px rgba(0, 0, 0, ${settings.tileShadowOpacity / 100})` : 'none'
  );
  root.style.backgroundColor = settings.background;
  root.style.backgroundImage = settings.backgroundImage ? `url(${settings.backgroundImage})` : '';
  root.style.backgroundPosition = settings.backgroundPosition;
  root.style.backgroundRepeat = 'no-repeat';
  root.style.backgroundSize = settings.backgroundSize;
  root.style.backgroundAttachment = 'fixed';
  document.body.style.backgroundColor = 'transparent';
  document.body.style.backgroundImage = '';
  document.documentElement.dataset.menuTheme = settings.menuTheme || 'dark';
  if (typeof applyTranslations === 'function') {
    applyTranslations();
  }
}

function getPreviewFillScale(fill) {
  return 1 - Math.max(0, Math.min(numberOrDefault(fill, 0), 30)) / 100;
}

function render() {
  closeSiteModal();
  const grid = document.getElementById('grid');
  const elements = sites.map(createTile);

  if (settings.showAddTile) {
    const addBtn = document.createElement('div');
    addBtn.className = 'tile add-tile';
    const addIcon = document.createElement('span');
    addIcon.className = 'add-icon';
    addIcon.textContent = '+';
    addBtn.appendChild(addIcon);
    elements.push(addBtn);
  }

  grid.replaceChildren(...elements);
}

function createDialContent(dial, isSplit = false) {
  const preview = document.createElement('div');
  renderTilePreview(preview, dial, isSplit);

  const title = document.createElement('div');
  title.className = 'tile-title';
  const label = dial.title || getDomain(dial.url);
  title.textContent = label;
  title.title = label;

  return [preview, title];
}

function createTile(site) {
  const isLocked = settings.tilesLocked === true;
  if (site.split && site.split.url) {
    const tile = document.createElement('div');
    tile.className = 'tile split-tile' + (isLocked ? ' locked' : '');
    tile.dataset.id = site.id;
    tile.draggable = !isLocked;

    const partTop = document.createElement('div');
    partTop.className = 'tile-part';
    partTop.dataset.id = site.id;
    partTop.append(...createDialContent(site, true));

    const partBottom = document.createElement('div');
    partBottom.className = 'tile-part';
    partBottom.dataset.id = site.split.id;
    partBottom.append(...createDialContent(site.split, true));

    tile.append(partTop, partBottom);
    if (!isLocked) {
      attachTileDragEvents(tile, site.id);
    }
    return tile;
  }

  const tile = document.createElement('div');
  tile.className = 'tile' + (isLocked ? ' locked' : '');
  tile.dataset.id = site.id;
  tile.draggable = !isLocked;
  tile.append(...createDialContent(site, false));
  if (!isLocked) {
    attachTileDragEvents(tile, site.id);
  }
  return tile;
}

function attachTileDragEvents(tile, siteId) {
  tile.addEventListener('dragstart', e => {
    if (settings.tilesLocked) {
      e.preventDefault();
      return;
    }
    draggedSiteId = siteId;
    dragDropped = false;
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', siteId);
    dragImageEl = createDragImage(tile);
    e.dataTransfer.setDragImage(dragImageEl, tile.offsetWidth / 2, tile.offsetHeight / 2);
  });

  tile.addEventListener('dragend', () => {
    finishTileDrag();
  });
}

const screenshotAspectCache = new Map();

function getScreenshotAspectSync(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const cached = screenshotAspectCache.get(dataUrl);
  if (cached) return cached;

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;

  try {
    const binary = atob(dataUrl.slice(commaIdx + 1, commaIdx + 1 + 2048));
    if (binary.charCodeAt(0) === 0xff && binary.charCodeAt(1) === 0xd8) {
      let i = 2;
      while (i < binary.length - 8) {
        if (binary.charCodeAt(i) !== 0xff) { i++; continue; }
        const marker = binary.charCodeAt(i + 1);
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const h = (binary.charCodeAt(i + 5) << 8) | binary.charCodeAt(i + 6);
          const w = (binary.charCodeAt(i + 7) << 8) | binary.charCodeAt(i + 8);
          if (w > 0 && h > 0) {
            const aspect = w / h;
            if (screenshotAspectCache.size >= 100) {
              screenshotAspectCache.delete(screenshotAspectCache.keys().next().value);
            }
            screenshotAspectCache.set(dataUrl, aspect);
            return aspect;
          }
        }
        const len = (binary.charCodeAt(i + 2) << 8) | binary.charCodeAt(i + 3);
        if (len < 2) break;
        i += 2 + len;
      }
    } else if (
      binary.charCodeAt(0) === 0x89 &&
      binary.charCodeAt(1) === 0x50 &&
      binary.charCodeAt(2) === 0x4e &&
      binary.charCodeAt(3) === 0x47 &&
      binary.length >= 24
    ) {
      const w = (binary.charCodeAt(16) << 24) | (binary.charCodeAt(17) << 16) | (binary.charCodeAt(18) << 8) | binary.charCodeAt(19);
      const h = (binary.charCodeAt(20) << 24) | (binary.charCodeAt(21) << 16) | (binary.charCodeAt(22) << 8) | binary.charCodeAt(23);
      if (w > 0 && h > 0) {
        const aspect = w / h;
        if (screenshotAspectCache.size >= 100) {
          screenshotAspectCache.delete(screenshotAspectCache.keys().next().value);
        }
        screenshotAspectCache.set(dataUrl, aspect);
        return aspect;
      }
    }
  } catch {}

  return null;
}

function fitTilePreviewImage(imageEl, previewEl, screenshotUrl, isSplit = false) {
  if (settings.previewFit !== 'cover') {
    imageEl.style.backgroundSize = '';
    return;
  }

  const applyFit = aspect => {
    const previewWidth = previewEl.offsetWidth || settings.tileWidth;
    let previewHeight = previewEl.offsetHeight;
    if (!previewHeight) {
      previewHeight = isSplit
        ? Math.max(20, (settings.tileHeight - settings.titleBarHeight) / 2)
        : settings.tileHeight;
    }
    const tileAspect = previewWidth / previewHeight;

    if (aspect > tileAspect + 0.02) {
      imageEl.style.backgroundSize = '100% 100%';
    } else {
      imageEl.style.backgroundSize = '';
    }
  };

  const syncAspect = getScreenshotAspectSync(screenshotUrl);
  if (syncAspect) {
    applyFit(syncAspect);
    return;
  }

  const img = new Image();
  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      const aspect = img.naturalWidth / img.naturalHeight;
      if (screenshotAspectCache.size >= 100) {
        screenshotAspectCache.delete(screenshotAspectCache.keys().next().value);
      }
      screenshotAspectCache.set(screenshotUrl, aspect);
      applyFit(aspect);
    }
  };
  img.src = screenshotUrl;
}

function renderTilePreview(preview, site, isSplit = false) {
  preview.replaceChildren();
  preview.className = 'tile-preview';
  preview.style.backgroundImage = '';

  if (settings.previewType !== 'icons' && site.screenshot) {
    const image = document.createElement('div');
    image.className = 'tile-preview-image';
    image.style.backgroundImage = `url(${site.screenshot})`;
    fitTilePreviewImage(image, preview, site.screenshot, isSplit);
    preview.appendChild(image);
    return;
  }

  if (site.favicon) {
    preview.classList.add('favicon-only');
    const img = document.createElement('img');
    img.src = site.favicon;
    img.alt = '';
    img.onerror = () => { img.style.display = 'none'; };
    const label = document.createElement('span');
    label.textContent = getDomain(site.url);
    preview.append(img, label);
    return;
  }

  preview.classList.add('no-preview');
  const span = document.createElement('span');
  span.textContent = getDomain(site.url);
  preview.appendChild(span);
}

async function updateTilePreviewSmooth(preview, site, isSplit = false) {
  if (settings.previewType === 'icons' || !site || !site.screenshot) {
    renderTilePreview(preview, site, isSplit);
    return;
  }

  const newScreenshotUrl = site.screenshot;

  // Neues Bild vorab im Hintergrund decodieren, damit der Browser kein leeres Frame anzeigt
  const img = new Image();
  img.src = newScreenshotUrl;
  try {
    if (typeof img.decode === 'function') {
      await img.decode();
    } else {
      await new Promise(resolve => {
        img.onload = img.onerror = resolve;
      });
    }
  } catch {}

  if (img.naturalWidth && img.naturalHeight) {
    screenshotAspectCache.set(newScreenshotUrl, img.naturalWidth / img.naturalHeight);
  }

  const existingImage = preview.querySelector('.tile-preview-image');

  const newImage = document.createElement('div');
  newImage.className = 'tile-preview-image';
  newImage.style.backgroundImage = `url(${newScreenshotUrl})`;
  fitTilePreviewImage(newImage, preview, newScreenshotUrl, isSplit);

  // Wenn bereits ein Bild sichtbar ist: Sanfter Crossfade ohne weiße/leere Zwischenbilder
  if (existingImage) {
    newImage.style.opacity = '0';
    newImage.style.transition = 'opacity 0.22s ease-in-out';
    preview.appendChild(newImage);

    requestAnimationFrame(() => {
      newImage.style.opacity = '1';
    });

    setTimeout(() => {
      const oldChildren = Array.from(preview.children).filter(el => el !== newImage);
      oldChildren.forEach(el => el.remove());
      newImage.style.transition = '';
      preview.className = 'tile-preview';
    }, 240);
  } else {
    preview.replaceChildren(newImage);
    preview.className = 'tile-preview';
  }
}

function createDragImage(tile) {
  removeDragImage();
  const clone = tile.cloneNode(true);
  clone.classList.add('drag-image');
  clone.style.width = tile.offsetWidth + 'px';
  clone.style.position = 'fixed';
  clone.style.left = '-10000px';
  clone.style.top = '-10000px';
  clone.style.pointerEvents = 'none';
  document.body.appendChild(clone);
  return clone;
}

function removeDragImage() {
  if (dragImageEl) {
    dragImageEl.remove();
    dragImageEl = null;
  }
  document.querySelectorAll('.drag-image').forEach(el => el.remove());
}

function getInsertionReference(grid, x, y) {
  const tiles = [...grid.querySelectorAll('.tile:not(.add-tile):not(.dragging)')];
  if (!tiles.length) return grid.querySelector('.add-tile');

  const rows = [];
  tiles.forEach(tile => {
    const bounds = tile.getBoundingClientRect();
    let row = rows.find(item => Math.abs(item.top - bounds.top) < 5);
    if (!row) {
      row = { top: bounds.top, bottom: bounds.bottom, tiles: [] };
      rows.push(row);
    }
    row.bottom = Math.max(row.bottom, bounds.bottom);
    row.tiles.push({ tile, bounds });
  });
  rows.sort((a, b) => a.top - b.top);
  rows.forEach(row => row.tiles.sort((a, b) => a.bounds.left - b.bounds.left));

  const row = rows.find((item, index) => {
    const next = rows[index + 1];
    const boundary = next ? item.bottom + (next.top - item.bottom) / 2 : Infinity;
    return y < boundary;
  }) || rows.at(-1);

  const nextTile = row.tiles.find(item => x < item.bounds.left + item.bounds.width / 2);
  if (nextTile) return nextTile.tile;

  const lastTile = row.tiles.at(-1).tile;
  const lastIndex = tiles.indexOf(lastTile);
  return tiles[lastIndex + 1] || grid.querySelector('.add-tile');
}

function previewTileInsertion(event) {
  const grid = document.getElementById('grid');
  const draggedTile = grid.querySelector('.tile.dragging');
  if (!draggedTile) return;

  const reference = getInsertionReference(grid, event.clientX, event.clientY);
  if (reference === draggedTile || reference === draggedTile.nextElementSibling) return;

  const movingTiles = [...grid.querySelectorAll('.tile:not(.dragging)')];
  movingTiles.forEach(tile => {
    tile.classList.remove('reordering');
    tile.style.transform = '';
  });
  const previousPositions = new Map(
    movingTiles.map(tile => [tile, tile.getBoundingClientRect()])
  );

  grid.insertBefore(draggedTile, reference);

  movingTiles.forEach(tile => {
    const previous = previousPositions.get(tile);
    const current = tile.getBoundingClientRect();
    const deltaX = previous.left - current.left;
    const deltaY = previous.top - current.top;
    if (!deltaX && !deltaY) return;

    tile.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    requestAnimationFrame(() => {
      tile.classList.add('reordering');
      tile.style.transform = '';
    });
  });
}

function persistPreviewOrder() {
  const grid = document.getElementById('grid');
  const order = [...grid.querySelectorAll('.tile:not(.add-tile)')].map(tile => tile.dataset.id);
  const sitesById = new Map(sites.map(site => [site.id, site]));
  if (order.length !== sites.length || order.some(id => !sitesById.has(id))) return;

  dragDropped = true;
  sites = order.map(id => sitesById.get(id));
  suppressNextTileClick = true;
  setTimeout(() => { suppressNextTileClick = false; }, 0);
  browser.storage.local.set({ sites: getSitesWithoutScreenshots() })
    .catch(error => console.warn('Kachelreihenfolge konnte nicht gespeichert werden.', error));
  render();
  cacheFastSitesWithThumbnails(sites);
}

function finishTileDrag() {
  const wasDropped = dragDropped;
  draggedSiteId = null;
  dragDropped = false;
  removeDragImage();
  if (!wasDropped) render();
}

const gridEl = document.getElementById('grid');

gridEl.addEventListener('dragover', event => {
  if (settings.tilesLocked || !draggedSiteId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  previewTileInsertion(event);
});

gridEl.addEventListener('drop', event => {
  if (settings.tilesLocked || !draggedSiteId) return;
  event.preventDefault();
  persistPreviewOrder();
});

gridEl.addEventListener('click', event => {
  if (event.target.closest('#site-modal')) {
    return;
  }
  if (event.target.closest('.add-tile')) {
    openSiteModal();
    return;
  }
  if (suppressNextTileClick) {
    suppressNextTileClick = false;
    return;
  }
  const part = event.target.closest('.tile-part');
  const tile = event.target.closest('.tile:not(.add-tile)');
  const targetEl = part || tile;
  if (!targetEl) return;

  const found = findDialById(targetEl.dataset.id);
  if (found && found.dial.url) {
    window.location.href = found.dial.url;
  }
});

gridEl.addEventListener('auxclick', event => {
  if (event.target.closest('#site-modal')) return;
  if (event.button !== 1) return;
  const part = event.target.closest('.tile-part');
  const tile = event.target.closest('.tile:not(.add-tile)');
  const targetEl = part || tile;
  if (!targetEl) return;

  const found = findDialById(targetEl.dataset.id);
  if (found && found.dial.url) {
    event.preventDefault();
    browser.tabs.create({ url: found.dial.url, active: false });
  }
});

gridEl.addEventListener('contextmenu', event => {
  if (event.target.closest('#site-modal')) return;
  if (event.target.closest('.add-tile')) return;
  const part = event.target.closest('.tile-part');
  const tile = event.target.closest('.tile');
  const targetEl = part || tile;
  if (!targetEl) return;

  const found = findDialById(targetEl.dataset.id);
  if (found) {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, found.dial, found.parent);
  }
});



function canUseAutomaticSiteName() {
  return !siteNameTouched;
}

function updateSiteNameFromUrlInput(rawUrl) {
  if (!canUseAutomaticSiteName()) return;

  const nameInput = document.getElementById('site-name');
  const url = String(rawUrl || '').trim();
  nameInput.value = url ? getDomain(url) : '';
}

function isAutomaticSiteTitle(site) {
  if (!site) return false;
  if (site.titleSource === 'auto') return true;
  if (site.titleSource === 'manual') return false;
  return (site.title || '') === getDomain(site.url);
}

function getSiteScreenshotRefreshVisits(site) {
  if (site && site.screenshotRefreshDisabled === true) return 0;
  const parsed = parseInt(site && site.screenshotRefreshVisits, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(parsed, 999));
}

// --- Context menu ---

function showContextMenu(x, y, site, parentSite = site) {
  contextSite = site;
  contextParentSite = parentSite;
  const menu = document.getElementById('context-menu');
  const splitItem = document.getElementById('ctx-toggle-split');
  const refreshItem = document.getElementById('ctx-refresh');
  const refreshVisitsInput = document.getElementById('ctx-refresh-visits');
  const refreshVisits = getSiteScreenshotRefreshVisits(site);
  const refreshDisabled = refreshVisits === 0;
  const globalRefreshVisits = Math.max(1, Math.min(numberOrDefault(settings.screenshotRefreshVisits, 1), 999));

  refreshItem.classList.toggle('disabled', refreshDisabled);
  refreshItem.setAttribute('aria-disabled', refreshDisabled ? 'true' : 'false');
  refreshVisitsInput.value = String(refreshVisits !== null ? refreshVisits : globalRefreshVisits);

  const isSplit = Boolean(parentSite && parentSite.split && parentSite.split.url);
  const isTopPart = isSplit && (site.id === parentSite.id);

  const deletePartItem = document.getElementById('ctx-delete-part');
  const deletePartLabel = document.getElementById('ctx-delete-part-label');
  const deleteItem = document.getElementById('ctx-delete');
  const deleteLabel = document.getElementById('ctx-delete-label');

  if (isSplit) {
    splitItem.hidden = true;

    if (deletePartItem && deletePartLabel) {
      deletePartItem.hidden = false;
      deletePartLabel.textContent = isTopPart ? t('ctx_delete_top') : t('ctx_delete_bottom');
    }
    if (deleteItem && deleteLabel) {
      deleteItem.hidden = false;
      deleteLabel.textContent = t('ctx_delete_all');
    }
  } else {
    splitItem.hidden = false;
    const splitLabel = splitItem.querySelector('.item-label') || splitItem;
    splitLabel.textContent = t('ctx_add_split');

    if (deletePartItem) {
      deletePartItem.hidden = true;
    }
    if (deleteItem && deleteLabel) {
      deleteItem.hidden = false;
      deleteLabel.textContent = t('ctx_delete');
    }
  }

  // Reposition so it doesn't overflow viewport
  menu.style.left = '0px';
  menu.style.top = '0px';
  menu.classList.add('visible');

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const left = Math.min(x, window.innerWidth - mw - 4);
  const top = Math.min(y, window.innerHeight - mh - 4);
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  lastContextCoords = { x: left, y: top };
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.remove('visible');
  contextSite = null;
  contextParentSite = null;
}

document.getElementById('ctx-edit').addEventListener('click', () => {
  if (contextSite) {
    const site = contextSite;
    const coords = lastContextCoords;
    hideContextMenu();
    openSiteModal(site, null, coords);
  } else {
    hideContextMenu();
  }
});

document.getElementById('ctx-toggle-split').addEventListener('click', () => {
  if (!contextSite || !contextParentSite) return;
  if (contextParentSite.split) {
    removeSplitSite(contextParentSite.id);
  } else if (!contextParentSite.split) {
    openSiteModal(null, contextParentSite.id);
  }
  hideContextMenu();
});

function setDialRefreshing(dialId, isRefreshing) {
  const found = findDialById(dialId);
  if (!found) return;

  const tile = document.querySelector(`.tile[data-id="${found.parent.id}"]`);
  if (!tile) return;

  const targetEl = found.parent.split
    ? tile.querySelector(`.tile-part[data-id="${dialId}"]`)
    : tile;

  if (targetEl) {
    targetEl.classList.toggle('is-refreshing', !!isRefreshing);
  }
}

document.getElementById('ctx-refresh').addEventListener('click', async () => {
  if (contextSite) {
    const site = findDialById(contextSite.id)?.dial;
    if (site && getSiteScreenshotRefreshVisits(site) !== 0) {
      setDialRefreshing(site.id, true);

      let windowId;
      try {
        const currentTab = await browser.tabs.getCurrent();
        windowId = currentTab ? currentTab.windowId : undefined;
      } catch (error) {
        windowId = undefined;
      }

      try {
        await browser.runtime.sendMessage({
          type: 'refresh-screenshot',
          siteId: site.id,
          windowId
        });
      } catch (error) {
        console.warn('[SpeedDial] Screenshot-Aktualisierung fehlgeschlagen:', error);
      } finally {
        setDialRefreshing(site.id, false);
      }
    }
  }
  hideContextMenu();
});

async function saveContextRefreshInterval(value) {
  const site = contextSite ? findDialById(contextSite.id)?.dial : null;
  if (!site) return;

  const trimmed = String(value || '').trim();
  if (!trimmed) {
    site.screenshotRefreshVisits = null;
    site.screenshotVisitCount = 0;
    await browser.storage.local.set({ sites: getSitesWithoutScreenshots() });
    render();
    return;
  }

  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999) {
    document.getElementById('ctx-refresh-visits').value = getSiteScreenshotRefreshVisits(site) ?? '';
    return;
  }

  site.screenshotRefreshVisits = parsed;
  site.screenshotRefreshDisabled = false;
  site.screenshotVisitCount = 0;
  await browser.storage.local.set({ sites: getSitesWithoutScreenshots() });
  render();
}

document.getElementById('ctx-refresh-interval').addEventListener('click', e => {
  e.stopPropagation();
});

document.getElementById('ctx-refresh-visits').addEventListener('change', e => {
  saveContextRefreshInterval(e.target.value);
});

document.getElementById('ctx-refresh-visits').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveContextRefreshInterval(e.target.value);
  }
});

document.getElementById('ctx-refresh-default').addEventListener('click', () => {
  const input = document.getElementById('ctx-refresh-visits');
  const globalValue = Math.max(1, Math.min(numberOrDefault(settings.screenshotRefreshVisits, 1), 999));
  input.value = String(globalValue);
  saveContextRefreshInterval('');
});

document.getElementById('ctx-delete-part')?.addEventListener('click', async () => {
  if (contextSite && contextParentSite) {
    await deleteDialPart(contextParentSite.id, contextSite.id);
  }
  hideContextMenu();
});

document.getElementById('ctx-delete')?.addEventListener('click', async () => {
  if (contextParentSite) {
    await deleteSite(contextParentSite.id);
  }
  hideContextMenu();
});

document.addEventListener('click', e => {
  const menu = document.getElementById('context-menu');
  if (menu && !(e.target instanceof Node && menu.contains(e.target))) {
    hideContextMenu();
  }
});

// --- Site popup (genau wie Kontextmenü) ---

let lastContextCoords = null;

function openSiteModal(site = null, parentId = null, coords = null) {
  editingId = site ? site.id : null;
  editingParentId = parentId;
  editingOriginalUrl = site ? site.url : '';
  siteNameTouched = false;
  editingNameWasAuto = isAutomaticSiteTitle(site);

  const modal = document.getElementById('site-modal');
  if (!modal) return;

  const titleEl = document.getElementById('modal-title');
  if (titleEl) {
    titleEl.textContent = site ? t('modal_title_edit') : t('modal_title_add');
  }
  const urlInput = document.getElementById('site-url');
  const nameInput = document.getElementById('site-name');
  if (urlInput) urlInput.value = site ? site.url : '';
  if (nameInput) nameInput.value = site ? (site.title || '') : '';

  let left = coords ? coords.x : (lastContextCoords ? lastContextCoords.x : null);
  let top = coords ? coords.y : (lastContextCoords ? lastContextCoords.y : null);

  if (left === null || top === null) {
    let targetTile = null;
    if (site) {
      const found = findDialById(site.id);
      if (found) {
        targetTile = document.querySelector(`.tile[data-id="${found.parent.id}"]`);
      }
    } else if (parentId) {
      targetTile = document.querySelector(`.tile[data-id="${parentId}"]`);
    } else {
      targetTile = document.querySelector('.add-tile');
    }

    if (targetTile) {
      const rect = targetTile.getBoundingClientRect();
      left = Math.round(rect.left + (rect.width - 280) / 2);
      top = Math.round(rect.top + 8);
    } else {
      left = Math.round((window.innerWidth - 280) / 2);
      top = Math.round(window.innerHeight * 0.25);
    }
  }

  modal.style.left = '0px';
  modal.style.top = '0px';
  modal.classList.add('visible');

  const mw = modal.offsetWidth || 280;
  const mh = modal.offsetHeight || 215;
  left = Math.max(8, Math.min(window.innerWidth - mw - 8, left));
  top = Math.max(8, Math.min(window.innerHeight - mh - 8, top));
  modal.style.left = left + 'px';
  modal.style.top = top + 'px';

  lastContextCoords = null;
  setTimeout(() => {
    if (urlInput) urlInput.focus();
  }, 30);
}

function closeSiteModal() {
  const modal = document.getElementById('site-modal');
  if (modal) {
    modal.classList.remove('visible');
  }
  editingId = null;
  editingParentId = null;
  editingOriginalUrl = '';
  siteNameTouched = false;
  editingNameWasAuto = false;
}

async function saveSite() {
  let url = document.getElementById('site-url').value.trim();
  const title = document.getElementById('site-name').value.trim();
  let newSiteId = null;
  if (!url) return;
  url = normalizeSiteUrl(url);

  const targetEditingId = editingId;
  const targetHadScreenshot = Boolean(editingId && findDialById(editingId)?.dial?.screenshot);
  const normOld = normalizeSiteUrl(editingOriginalUrl).replace(/\/+$/, '');
  const normNew = url.replace(/\/+$/, '');
  const urlChanged = Boolean(editingId && normOld !== normNew);
  const useAutomaticTitle = siteNameTouched
    ? false
    : (editingId ? urlChanged : true);

  const savedTitle = useAutomaticTitle ? getDomain(url) : (title || getDomain(url));
  const titleSource = (useAutomaticTitle || (!title && !siteNameTouched)) ? 'auto' : 'manual';

  if (editingId) {
    const found = findDialById(editingId);
    if (found) {
      found.dial.url = url;
      found.dial.title = savedTitle;
      found.dial.titleSource = titleSource;

      if (urlChanged) {
        found.dial.favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
        delete found.dial.screenshot;
        if (typeof browser !== 'undefined' && browser.storage?.local) {
          await browser.storage.local.remove(`screenshot_${found.dial.id}`);
        }
      }
    }
  } else if (editingParentId) {
    const parent = sites.find(site => site.id === editingParentId);
    if (parent) {
      parent.split = createNewSite(url, savedTitle, useAutomaticTitle);
      newSiteId = parent.split.id;
    }
  } else {
    const newSite = createNewSite(url, savedTitle, useAutomaticTitle);
    sites.push(newSite);
    newSiteId = newSite.id;
  }

  const shouldRefresh = settings.previewType !== 'icons' && (
    Boolean(newSiteId) ||
    urlChanged ||
    !targetHadScreenshot
  );
  const refreshSiteId = shouldRefresh ? (newSiteId ?? targetEditingId) : null;

  if (typeof browser !== 'undefined' && browser.storage?.local) {
    await browser.storage.local.set({ sites: getSitesWithoutScreenshots() });
  }
  closeSiteModal();
  render();
  cacheFastSitesWithThumbnails(sites);

  if (refreshSiteId !== null && refreshSiteId !== undefined && typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
    setDialRefreshing(refreshSiteId, true);
    let windowId;
    try {
      const currentTab = browser.tabs ? await browser.tabs.getCurrent() : null;
      windowId = currentTab ? currentTab.windowId : undefined;
    } catch {
      windowId = undefined;
    }
    browser.runtime.sendMessage({
      type: 'refresh-screenshot',
      siteId: refreshSiteId,
      windowId,
      force: true
    }).catch(error => {
      console.warn('Vorschaubild konnte nicht gestartet werden.', error);
    }).finally(() => {
      setDialRefreshing(refreshSiteId, false);
    });
  }
}

function createNewSite(url, title, useAutomaticTitle) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    title: title || getDomain(url),
    titleSource: useAutomaticTitle ? 'auto' : 'manual',
    screenshot: null,
    screenshotVisitCount: 0,
    screenshotLastCapturedAt: '',
    screenshotRefreshDisabled: false,
    screenshotRefreshVisits: null,
    favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`
  };
}

async function deleteSite(id) {
  const site = sites.find(item => item.id === id);
  const screenshotIds = getDialParts(site).map(dial => dial.id);
  sites = sites.filter(s => s.id !== id);
  if (typeof browser !== 'undefined' && browser.storage?.local) {
    await browser.storage.local.set({ sites: getSitesWithoutScreenshots() });
    await browser.storage.local.remove(screenshotIds.map(screenshotId => `screenshot_${screenshotId}`));
  }
  render();
  cacheFastSitesWithThumbnails(sites);
}

async function removeSplitSite(parentId) {
  const parent = sites.find(site => site.id === parentId);
  if (!parent || !parent.split) return;
  const splitId = parent.split.id;
  delete parent.split;
  if (typeof browser !== 'undefined' && browser.storage?.local) {
    await browser.storage.local.set({ sites: getSitesWithoutScreenshots() });
    await browser.storage.local.remove(`screenshot_${splitId}`);
  }
  render();
  cacheFastSitesWithThumbnails(sites);
}

async function deleteDialPart(parentId, dialId) {
  const parent = sites.find(site => site.id === parentId);
  if (!parent) return;

  if (!parent.split) {
    await deleteSite(parentId);
    return;
  }

  if (parent.split.id === dialId) {
    await removeSplitSite(parentId);
  } else if (parent.id === dialId) {
    const oldTopId = parent.id;
    const bottom = parent.split;

    parent.id = bottom.id;
    parent.url = bottom.url;
    parent.title = bottom.title;
    parent.titleSource = bottom.titleSource;
    parent.screenshot = bottom.screenshot;
    parent.screenshotRefreshVisits = bottom.screenshotRefreshVisits;
    parent.screenshotRefreshDisabled = bottom.screenshotRefreshDisabled;
    parent.screenshotVisitCount = bottom.screenshotVisitCount;
    parent.favicon = bottom.favicon;
    delete parent.split;

    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.set({ sites: getSitesWithoutScreenshots() });
      await browser.storage.local.remove(`screenshot_${oldTopId}`);
    }
    render();
    cacheFastSitesWithThumbnails(sites);
  }
}

document.getElementById('close-site-modal').addEventListener('click', closeSiteModal);
document.getElementById('save-site').addEventListener('click', saveSite);
document.getElementById('site-url').addEventListener('keydown', e => { if (e.key === 'Enter') saveSite(); });
document.getElementById('site-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveSite(); });
document.getElementById('site-url').addEventListener('input', e => {
  updateSiteNameFromUrlInput(e.target.value);
});
document.getElementById('site-name').addEventListener('input', e => {
  siteNameTouched = e.target.value.trim().length > 0;
});

// --- Settings modal ---

function populateSettingsForm() {
  pendingBackgroundImage = settings.backgroundImage || '';
  pendingBackgroundImageTask = null;
  const langSelect = document.getElementById('set-language');
  if (langSelect) langSelect.value = settings.language || 'auto';
  const menuThemeSelect = document.getElementById('set-menu-theme');
  if (menuThemeSelect) menuThemeSelect.value = settings.menuTheme || 'dark';
  document.getElementById('set-columns').value = settings.columns;
  document.getElementById('set-tile-width').value = settings.tileWidth;
  document.getElementById('set-tile-height').value = settings.tileHeight;
  const previewTypeSelect = document.getElementById('set-preview-type');
  if (previewTypeSelect) previewTypeSelect.value = settings.previewType || 'thumbs';
  document.getElementById('set-preview-fit').value = settings.previewFit;
  document.getElementById('set-preview-fill').value = settings.previewFill;
  updatePreviewTypeFieldsState();
  document.getElementById('set-show-thumb-border').checked = settings.showThumbBorder;
  document.getElementById('set-thumb-border-width').value = settings.thumbBorderWidth;
  document.getElementById('set-thumb-border-color').value = settings.thumbBorderColor;
  document.getElementById('set-thumb-border-opacity').value = settings.thumbBorderOpacity;
  updateThumbBorderFieldsState();
  document.getElementById('set-screenshot-refresh-mode').value = settings.screenshotRefreshMode;
  document.getElementById('set-screenshot-refresh-visits').value = settings.screenshotRefreshVisits;
  updateScreenshotRefreshVisitsState();
  document.getElementById('set-column-gap').value = settings.columnGap;
  document.getElementById('set-row-gap').value = settings.rowGap;
  document.getElementById('set-bg').value = settings.background;
  document.getElementById('set-bg-size').value = settings.backgroundSize;
  document.getElementById('set-bg-position').value = settings.backgroundPosition;
  document.getElementById('set-bg-image').value = '';
  updateBackgroundImageStatus();
  document.getElementById('set-title-size').value = settings.titleSize;
  document.getElementById('set-title-weight').value = settings.titleWeight;
  document.getElementById('set-title-bar-height').value = settings.titleBarHeight;
  document.getElementById('set-title-bg').value = settings.tileTitleBackground;
  document.getElementById('set-title-color').value = settings.tileTitleColor;
  document.getElementById('set-show-title-separator').checked = settings.showTitleSeparator;
  document.getElementById('set-title-separator-width').value = settings.titleSeparatorWidth;
  document.getElementById('set-title-separator-color').value = settings.titleSeparatorColor;
  document.getElementById('set-title-separator-opacity').value = settings.titleSeparatorOpacity;
  updateTitleSeparatorFieldsState();
  document.getElementById('set-tile-radius').value = settings.tileRadius;
  document.getElementById('set-show-add-tile').checked = settings.showAddTile;
  document.getElementById('set-auto-fit').checked = settings.autoFit !== false;
  document.getElementById('set-show-tile-shadow').checked = settings.showTileShadow;
  document.getElementById('set-tile-shadow-opacity').value = settings.tileShadowOpacity;
  updateTileShadowFieldsState();
  updateLivePreviewTile();
  updateAllColorSwatches();
}

function updateLivePreviewTile() {}


function isSettingsOpen() {
  return document.getElementById('settings-modal').classList.contains('visible');
}

function openSettings() {
  populateSettingsForm();
  const modal = document.getElementById('settings-modal');
  const panel = modal?.querySelector('.settings-popover');
  if (panel) panel.scrollTop = 0;
  modal.classList.add('visible');
  document.getElementById('settings-btn').classList.add('active');
  positionSettingsPopover();
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('visible');
  document.getElementById('settings-btn').classList.remove('active');
  dismissFloatingPopups();
}

function positionSettingsPopover() {
  const modal = document.getElementById('settings-modal');
  const panel = modal?.querySelector('.settings-popover') || modal?.querySelector('.modal');
  const button = document.getElementById('settings-btn');
  if (!modal || !panel || !button) return;

  const buttonRect = button.getBoundingClientRect();
  const viewportMargin = 14;
  const top = buttonRect.bottom + 8;
  const right = Math.max(viewportMargin, window.innerWidth - buttonRect.right);

  modal.style.setProperty('--settings-top', Math.round(top) + 'px');
  modal.style.setProperty('--settings-right', Math.round(right) + 'px');

  const panelRight = window.innerWidth - right;
  const buttonCenter = buttonRect.left + buttonRect.width / 2;
  const arrowRight = Math.max(12, Math.min(panel.offsetWidth - 24, panelRight - buttonCenter - 6));
  modal.style.setProperty('--settings-arrow-right', Math.round(arrowRight) + 'px');
}


function collectSettingsFromForm() {
  return normalizeSettings({
    ...settings,
    language: document.getElementById('set-language')?.value || settings.language || 'auto',
    menuTheme: document.getElementById('set-menu-theme')?.value || settings.menuTheme || 'dark',
    columns: numberOrDefault(document.getElementById('set-columns').value, DEFAULT_SETTINGS.columns),
    tileWidth: numberOrDefault(document.getElementById('set-tile-width').value, DEFAULT_SETTINGS.tileWidth),
    tileHeight: numberOrDefault(document.getElementById('set-tile-height').value, DEFAULT_SETTINGS.tileHeight),
    previewType: document.getElementById('set-preview-type')?.value || settings.previewType || 'thumbs',
    previewFit: document.getElementById('set-preview-fit').value,
    previewFill: document.getElementById('set-preview-fill').value,
    showThumbBorder: document.getElementById('set-show-thumb-border').checked,
    thumbBorderWidth: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-thumb-border-width').value, DEFAULT_SETTINGS.thumbBorderWidth), 12)
    ),
    thumbBorderColor: document.getElementById('set-thumb-border-color').value,
    thumbBorderOpacity: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-thumb-border-opacity').value, DEFAULT_SETTINGS.thumbBorderOpacity), 100)
    ),
    screenshotRefreshMode: document.getElementById('set-screenshot-refresh-mode').value,
    screenshotRefreshVisits: Math.max(
      1,
      Math.min(numberOrDefault(document.getElementById('set-screenshot-refresh-visits').value, DEFAULT_SETTINGS.screenshotRefreshVisits), 999)
    ),
    columnGap: numberOrDefault(document.getElementById('set-column-gap').value, DEFAULT_SETTINGS.columnGap),
    rowGap: numberOrDefault(document.getElementById('set-row-gap').value, DEFAULT_SETTINGS.rowGap),
    background: document.getElementById('set-bg').value,
    backgroundImage: pendingBackgroundImage,
    backgroundSize: document.getElementById('set-bg-size').value,
    backgroundPosition: document.getElementById('set-bg-position').value,
    titleSize: numberOrDefault(document.getElementById('set-title-size').value, DEFAULT_SETTINGS.titleSize),
    titleWeight: numberOrDefault(document.getElementById('set-title-weight').value, DEFAULT_SETTINGS.titleWeight),
    titleBarHeight: numberOrDefault(document.getElementById('set-title-bar-height').value, DEFAULT_SETTINGS.titleBarHeight),
    tileTitleBackground: document.getElementById('set-title-bg').value,
    tileTitleColor: document.getElementById('set-title-color').value,
    showTitleSeparator: document.getElementById('set-show-title-separator').checked,
    titleSeparatorWidth: numberOrDefault(
      document.getElementById('set-title-separator-width').value,
      DEFAULT_SETTINGS.titleSeparatorWidth
    ),
    titleSeparatorColor: document.getElementById('set-title-separator-color').value,
    titleSeparatorOpacity: numberOrDefault(
      document.getElementById('set-title-separator-opacity').value,
      DEFAULT_SETTINGS.titleSeparatorOpacity
    ),
    tileRadius: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-tile-radius').value, DEFAULT_SETTINGS.tileRadius), 32)
    ),
    showTileShadow: document.getElementById('set-show-tile-shadow').checked,
    tileShadowOpacity: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-tile-shadow-opacity').value, DEFAULT_SETTINGS.tileShadowOpacity), 100)
    ),
    showAddTile: document.getElementById('set-show-add-tile').checked,
    autoFit: document.getElementById('set-auto-fit').checked
  });
}

async function saveSettings() {
  if (pendingBackgroundImageTask) {
    await pendingBackgroundImageTask;
  }

  const previousTileWidth = settings.tileWidth;
  const previousPreviewType = settings.previewType;
  settings = collectSettingsFromForm();
  updateThumbBorderFieldsState();
  updateTileShadowFieldsState();
  updateTitleSeparatorFieldsState();
  updateScreenshotRefreshVisitsState();
  updatePreviewTypeFieldsState();
  applySettings();
  if (previousPreviewType !== settings.previewType) {
    render();
  }
  writeFastCacheSettings(settings);

  await browser.storage.local.set({ settings });

  if (previousTileWidth !== settings.tileWidth) {
    thumbnailShrinkCache.clear();
    cacheFastSitesWithThumbnails(sites, true);
  }
}

function queueSettingsSave() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    saveSettings().catch(error => console.warn('Settings could not be saved.', error));
  }, 180);
}

function handleSettingsInput(event) {
  if (event.target.id === 'set-preview-type') {
    updatePreviewTypeFieldsState();
  }
  if (event.target.id === 'set-screenshot-refresh-mode') {
    updateScreenshotRefreshVisitsState();
  }
  if (event.target.id === 'set-show-thumb-border') {
    updateThumbBorderFieldsState();
  }
  if (event.target.id === 'set-show-tile-shadow') {
    updateTileShadowFieldsState();
  }
  if (event.target.id === 'set-show-title-separator') {
    updateTitleSeparatorFieldsState();
  }
  if (event.target.id === 'set-bg-size' || event.target.id === 'set-bg-position') {
    updateBackgroundImageStatus();
  }
  if (event.target.id === 'set-language') {
    updateLockButtonUI();
  }

  updateLivePreviewTile();

  const previousShowAddTile = settings.showAddTile;
  const previousPreviewFit = settings.previewFit;
  const previousPreviewType = settings.previewType;
  settings = collectSettingsFromForm();
  applySettings();
  if (
    previousShowAddTile !== settings.showAddTile ||
    previousPreviewFit !== settings.previewFit ||
    previousPreviewType !== settings.previewType
  ) {
    render();
  }
  queueSettingsSave();
}

document.getElementById('settings-btn').addEventListener('click', () => {
  if (isSettingsOpen()) {
    closeSettings();
  } else {
    openSettings();
  }
});


document.querySelectorAll('.stepper-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const action = btn.dataset.action;
    const step = Number(btn.dataset.step) || 1;
    const target = document.getElementById(targetId);
    if (!target) return;

    const min = target.hasAttribute('min') ? Number(target.min) : -Infinity;
    const max = target.hasAttribute('max') ? Number(target.max) : Infinity;
    let current = Number(target.value) || 0;

    if (action === 'inc') {
      current = Math.min(max, current + step);
    } else if (action === 'dec') {
      current = Math.max(min, current - step);
    }

    target.value = current;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
});

document.getElementById('set-bg-image').addEventListener('change', handleBackgroundImageSelect);
document.querySelectorAll('#settings-modal input, #settings-modal select').forEach(control => {
  if (['set-bg-image', 'import-backup'].includes(control.id)) return;
  control.addEventListener('input', handleSettingsInput);
  control.addEventListener('change', handleSettingsInput);
});
function updateLockButtonUI() {
  const btn = document.getElementById('lock-btn');
  if (!btn) return;
  const locked = settings.tilesLocked === true;
  btn.classList.toggle('locked', locked);
  btn.title = locked ? t('toolbar_lock_locked') : t('toolbar_lock_allow');
  btn.setAttribute('aria-label', btn.title);
  const path = btn.querySelector('path');
  if (path) {
    path.setAttribute('d', locked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9-1');
  }
}

function toggleTilesLocked() {
  settings.tilesLocked = !settings.tilesLocked;
  updateLockButtonUI();
  render();
  writeFastCacheSettings(settings);
  browser.storage.local.set({ settings }).catch(error => {
    console.warn('Kachel-Sperrzustand konnte nicht gespeichert werden.', error);
  });
}

document.getElementById('lock-btn')?.addEventListener('click', toggleTilesLocked);
document.getElementById('refresh-thumbnails').addEventListener('click', refreshAllThumbnails);
document.getElementById('export-backup').addEventListener('click', exportBackup);
document.getElementById('import-backup-btn').addEventListener('click', () => {
  document.getElementById('import-backup').click();
});
document.getElementById('import-backup').addEventListener('change', importBackup);
document.getElementById('remove-bg-image').addEventListener('click', () => {
  pendingBackgroundImage = '';
  document.getElementById('set-bg-image').value = '';
  updateBackgroundImageStatus();
  saveSettings().catch(error => console.warn('Settings could not be saved.', error));
});
function isNodeInside(parent, target) {
  return Boolean(parent && target instanceof Node && parent.contains(target));
}

function isClosestElement(target, selector) {
  return Boolean(target instanceof Element && target.closest(selector));
}

function dismissFloatingPopups(target = null) {
  if (isSelectPopoverOpen()) {
    const pop = document.getElementById('custom-select-popover');
    if (!target || (!isNodeInside(pop, target) && !isClosestElement(target, '.select-pill'))) {
      closeCustomSelectPopover();
    }
  }
  if (isColorPickerOpen()) {
    const picker = document.getElementById('custom-color-picker');
    if (!target || (!isNodeInside(picker, target) && !isClosestElement(target, '.color-swatch-btn'))) {
      closeCustomColorPicker();
    }
  }
}

document.addEventListener('pointerdown', e => dismissFloatingPopups(e.target));
window.addEventListener('wheel', e => dismissFloatingPopups(e.target), { passive: true });

document.addEventListener('click', e => {
  dismissFloatingPopups(e.target);

  const modal = document.getElementById('site-modal');
  if (modal && modal.classList.contains('visible')) {
    if (!modal.contains(e.target) && !e.target.closest('#context-menu') && !e.target.closest('#ctx-edit') && !e.target.closest('.add-tile')) {
      closeSiteModal();
    }
  }

  if (!isSettingsOpen()) return;
  if (ignoreNextSettingsOutsideClick) {
    ignoreNextSettingsOutsideClick = false;
    return;
  }
  const settingsPopover = document.querySelector('.settings-popover');
  const settingsButton = document.getElementById('settings-btn');
  const colorPicker = document.getElementById('custom-color-picker');
  const selectPopover = document.getElementById('custom-select-popover');
  if (
    isNodeInside(settingsPopover, e.target) ||
    isNodeInside(settingsButton, e.target) ||
    isNodeInside(colorPicker, e.target) ||
    isNodeInside(selectPopover, e.target)
  ) {
    return;
  }
  closeSettings();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('site-modal')?.classList.contains('visible')) {
      closeSiteModal();
      return;
    }
    if (isSelectPopoverOpen() || isColorPickerOpen()) {
      dismissFloatingPopups();
      return;
    }
    if (isSettingsOpen()) {
      closeSettings();
    }
  }
});

function updateBackgroundImageStatus() {
  const status = document.getElementById('bg-image-status');
  const preview = document.getElementById('bg-image-preview');
  const sizeSelect = document.getElementById('set-bg-size');
  const positionSelect = document.getElementById('set-bg-position');
  status.textContent = pendingBackgroundImage ? t('status_bg_image_set') : t('status_no_bg_image');
  preview.hidden = !pendingBackgroundImage;
  preview.style.backgroundImage = pendingBackgroundImage ? `url(${pendingBackgroundImage})` : '';
  preview.style.backgroundSize = sizeSelect ? sizeSelect.value : settings.backgroundSize;
  preview.style.backgroundPosition = positionSelect ? positionSelect.value : settings.backgroundPosition;
}

function updateScreenshotRefreshVisitsState() {
  const mode = document.getElementById('set-screenshot-refresh-mode').value;
  document.getElementById('set-screenshot-refresh-visits').disabled = mode !== 'visit-interval';
}

function updatePreviewTypeFieldsState() {
  const isIcons = (document.getElementById('set-preview-type')?.value || settings.previewType) === 'icons';
  const rows = [
    document.getElementById('set-preview-fit')?.closest('.setting-row'),
    document.getElementById('set-preview-fill')?.closest('.setting-row'),
    document.getElementById('set-screenshot-refresh-mode')?.closest('.setting-row')
  ];
  rows.forEach(r => r?.classList.toggle('is-disabled', isIcons));
}

function updateThumbBorderFieldsState() {
  const showBorder = document.getElementById('set-show-thumb-border').checked;
  document.getElementById('set-thumb-border-width').disabled = !showBorder;
  document.getElementById('set-thumb-border-color').disabled = !showBorder;
  document.getElementById('set-thumb-border-opacity').disabled = !showBorder;

  const rows = [
    document.getElementById('set-thumb-border-width')?.closest('.setting-row'),
    document.getElementById('set-thumb-border-color')?.closest('.setting-row'),
    document.getElementById('set-thumb-border-opacity')?.closest('.setting-row')
  ];
  rows.forEach(r => r?.classList.toggle('is-disabled', !showBorder));
}

function updateTileShadowFieldsState() {
  document.getElementById('set-tile-shadow-opacity').disabled = !document.getElementById('set-show-tile-shadow').checked;
}

function updateTitleSeparatorFieldsState() {
  const visible = document.getElementById('set-show-title-separator').checked;
  document.getElementById('set-title-separator-width').disabled = !visible;
  document.getElementById('set-title-separator-color').disabled = !visible;
  document.getElementById('set-title-separator-opacity').disabled = !visible;

  const rows = [
    document.getElementById('set-title-separator-width')?.closest('.setting-row'),
    document.getElementById('set-title-separator-color')?.closest('.setting-row'),
    document.getElementById('set-title-separator-opacity')?.closest('.setting-row')
  ];
  rows.forEach(r => r?.classList.toggle('is-disabled', !visible));
}

function setThumbnailRefreshStatus(current = 0, total = getAllDials().length, message = '') {
  const status = document.getElementById('thumbnail-refresh-status');
  status.textContent = `${current} / ${total}`;
  status.title = message || `${current} von ${total} Vorschaubildern aktualisiert`;
}

function setThumbnailRefreshActive(active) {
  thumbnailRefreshRunning = active;
  document.getElementById('refresh-thumbnails').disabled = active;
  const status = document.getElementById('thumbnail-refresh-status');
  status.hidden = !active;
  status.classList.toggle('active', active);
}

async function refreshAllThumbnails() {
  setThumbnailRefreshActive(true);
  setThumbnailRefreshStatus(0, getAllDials().length, 'Aktualisierung wird gestartet...');

  try {
    let windowId;
    try {
      const currentTab = await browser.tabs.getCurrent();
      windowId = currentTab ? currentTab.windowId : undefined;
    } catch (error) {
      windowId = undefined;
    }

    await browser.runtime.sendMessage({ type: 'bulk-refresh-screenshots', windowId });
  } catch (error) {
    setThumbnailRefreshActive(false);
    setThumbnailRefreshStatus(0, getAllDials().length, 'Aktualisierung konnte nicht gestartet werden.');
  }
}

async function handleBackgroundImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return;

  const status = document.getElementById('bg-image-status');
  status.textContent = 'Bild wird vorbereitet...';
  pendingBackgroundImageTask = resizeBackgroundImage(file)
    .then(dataUrl => {
      pendingBackgroundImage = dataUrl;
      updateBackgroundImageStatus();
    })
    .finally(() => {
      pendingBackgroundImageTask = null;
    });

  await pendingBackgroundImageTask;
  document.getElementById('set-bg-size').value = DEFAULT_SETTINGS.backgroundSize;
  updateBackgroundImageStatus();
  await saveSettings();
}

async function resizeBackgroundImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });

    const maxSize = 2560;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function setBackupStatus(message) {
  document.getElementById('backup-status').textContent = message;
}



function parseDataUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || commaIndex < 0) {
    throw new Error('Hintergrundbild konnte nicht für das Backup vorbereitet werden.');
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const parts = metadata.split(';').filter(Boolean);
  const mimeType = parts[0] || 'application/octet-stream';
  const payload = dataUrl.slice(commaIndex + 1);
  const binary = parts.includes('base64') ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, mimeType };
}

function bytesToDataUrl(bytes, mimeType) {
  const chunks = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.slice(offset, offset + chunkSize)));
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}

function getImageExtension(mimeType) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg'
  };
  return extensions[mimeType] || 'img';
}

function getMimeTypeFromFilename(filename) {
  const extension = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

async function getSettingsForBackup(storedSettings) {
  const normalizedStoredSettings = normalizeSettings(storedSettings);
  if (!isSettingsOpen()) {
    return normalizedStoredSettings;
  }

  if (pendingBackgroundImageTask) {
    await pendingBackgroundImageTask;
  }

  return normalizeSettings({
    ...normalizedStoredSettings,
    language: document.getElementById('set-language')?.value || normalizedStoredSettings.language || 'auto',
    menuTheme: document.getElementById('set-menu-theme')?.value || normalizedStoredSettings.menuTheme || 'dark',
    columns: numberOrDefault(document.getElementById('set-columns').value, normalizedStoredSettings.columns),
    tileWidth: numberOrDefault(document.getElementById('set-tile-width').value, normalizedStoredSettings.tileWidth),
    tileHeight: numberOrDefault(document.getElementById('set-tile-height').value, normalizedStoredSettings.tileHeight),
    previewType: document.getElementById('set-preview-type')?.value || normalizedStoredSettings.previewType || 'thumbs',
    previewFit: document.getElementById('set-preview-fit').value,
    previewFill: document.getElementById('set-preview-fill').value,
    showThumbBorder: document.getElementById('set-show-thumb-border').checked,
    thumbBorderWidth: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-thumb-border-width').value, normalizedStoredSettings.thumbBorderWidth), 12)
    ),
    thumbBorderColor: document.getElementById('set-thumb-border-color').value,
    thumbBorderOpacity: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-thumb-border-opacity').value, normalizedStoredSettings.thumbBorderOpacity), 100)
    ),
    screenshotRefreshMode: document.getElementById('set-screenshot-refresh-mode').value,
    screenshotRefreshVisits: Math.max(
      1,
      Math.min(numberOrDefault(document.getElementById('set-screenshot-refresh-visits').value, normalizedStoredSettings.screenshotRefreshVisits), 999)
    ),
    columnGap: numberOrDefault(document.getElementById('set-column-gap').value, normalizedStoredSettings.columnGap),
    rowGap: numberOrDefault(document.getElementById('set-row-gap').value, normalizedStoredSettings.rowGap),
    background: document.getElementById('set-bg').value,
    backgroundImage: pendingBackgroundImage,
    backgroundSize: document.getElementById('set-bg-size').value,
    backgroundPosition: document.getElementById('set-bg-position').value,
    titleSize: numberOrDefault(document.getElementById('set-title-size').value, normalizedStoredSettings.titleSize),
    titleWeight: numberOrDefault(document.getElementById('set-title-weight').value, normalizedStoredSettings.titleWeight),
    titleBarHeight: numberOrDefault(document.getElementById('set-title-bar-height').value, normalizedStoredSettings.titleBarHeight),
    tileTitleBackground: document.getElementById('set-title-bg').value,
    tileTitleColor: document.getElementById('set-title-color').value,
    showTitleSeparator: document.getElementById('set-show-title-separator').checked,
    titleSeparatorWidth: numberOrDefault(
      document.getElementById('set-title-separator-width').value,
      normalizedStoredSettings.titleSeparatorWidth
    ),
    titleSeparatorColor: document.getElementById('set-title-separator-color').value,
    titleSeparatorOpacity: numberOrDefault(
      document.getElementById('set-title-separator-opacity').value,
      normalizedStoredSettings.titleSeparatorOpacity
    ),
    tileRadius: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-tile-radius').value, normalizedStoredSettings.tileRadius), 32)
    ),
    showTileShadow: document.getElementById('set-show-tile-shadow').checked,
    tileShadowOpacity: Math.max(
      0,
      Math.min(numberOrDefault(document.getElementById('set-tile-shadow-opacity').value, normalizedStoredSettings.tileShadowOpacity), 100)
    ),
    showAddTile: document.getElementById('set-show-add-tile').checked,
    autoFit: document.getElementById('set-auto-fit').checked
  });
}

async function getSitesForBackup(storedSites) {
  const backupSites = (storedSites || []).map(site => ({ ...site }));
  const screenshotKeys = backupSites.flatMap(getDialParts).map(site => `screenshot_${site.id}`);
  const storedScreenshots = screenshotKeys.length
    ? await browser.storage.local.get(screenshotKeys)
    : {};

  backupSites.forEach(site => {
    getDialParts(site).forEach(dial => {
      const screenshot = storedScreenshots[`screenshot_${dial.id}`];
      if (screenshot) dial.screenshot = screenshot;
    });
  });

  return backupSites;
}

async function exportBackup() {
  try {
    const data = await browser.storage.local.get(['sites', 'settings']);
    const backupSettings = await getSettingsForBackup(data.settings);
    const backupSites = await getSitesForBackup(data.sites);
    const manifestSettings = { ...backupSettings };
    const assets = {};
    const entries = [];

    if (backupSettings.backgroundImage) {
      const backgroundImage = parseDataUrl(backupSettings.backgroundImage);
      const fileName = `background-image.${getImageExtension(backgroundImage.mimeType)}`;
      manifestSettings.backgroundImage = '';
      assets.backgroundImage = {
        path: fileName,
        mimeType: backgroundImage.mimeType
      };
      entries.push({
        name: fileName,
        bytes: backgroundImage.bytes
      });
    }

    const backup = {
      type: 'speed-dial-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      sites: backupSites,
      settings: manifestSettings,
      assets
    };

    entries.unshift({
      name: 'backup.json',
      bytes: textToBytes(JSON.stringify(backup, null, 2))
    });

    const blob = new Blob([createStoredZip(entries)], {
      type: 'application/zip'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `speed-dial-backup-${currentDateTimeStamp()}.zip`;
    document.body.appendChild(link);
    ignoreNextSettingsOutsideClick = true;
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupStatus('ZIP-Backup exportiert.');
  } catch (error) {
    setBackupStatus('Export fehlgeschlagen: ' + error.message);
  }
}

function normalizeImportedSites(importedSites) {
  if (!Array.isArray(importedSites)) {
    throw new Error(t('err_backup_no_valid_tiles'));
  }

  return importedSites.map(normalizeImportedSite);
}

function normalizeImportedSite(site) {
    if (!site || typeof site !== 'object') {
      throw new Error(t('err_backup_invalid_tile'));
    }

    const url = String(site.url || '').trim();
    if (!url) {
      throw new Error(t('err_backup_no_url'));
    }

    const normalizedSite = {
      id: String(site.id || Date.now() + Math.random()),
      url,
      title: String(site.title || getDomain(url)),
      titleSource: site.titleSource === 'manual' ? 'manual' : 'auto',
      screenshot: typeof site.screenshot === 'string' ? site.screenshot : null,
      screenshotVisitCount: numberOrDefault(site.screenshotVisitCount, 0),
      screenshotLastCapturedAt: typeof site.screenshotLastCapturedAt === 'string' ? site.screenshotLastCapturedAt : '',
      screenshotRefreshDisabled: site.screenshotRefreshDisabled === true,
      screenshotRefreshVisits: getSiteScreenshotRefreshVisits(site),
      favicon: typeof site.favicon === 'string'
        ? site.favicon
        : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`
    };

    if (site.split && typeof site.split === 'object' && String(site.split.url || '').trim()) {
      normalizedSite.split = normalizeImportedSite(site.split);
    }
    return normalizedSite;
}

function normalizeImportedSettings(importedSettings) {
  const backup = importedSettings && typeof importedSettings === 'object' ? importedSettings : {};
  return normalizeSettings(backup.settings);
}

function getZipEntry(entries, path) {
  const normalizedPath = normalizeZipPath(path);
  if (entries.has(normalizedPath)) {
    return entries.get(normalizedPath);
  }

  const lowerPath = normalizedPath.toLowerCase();
  for (const [entryPath, bytes] of entries) {
    if (entryPath.toLowerCase() === lowerPath) {
      return bytes;
    }
  }
  return null;
}

function readBackupFromZip(bytes) {
  const entries = parseStoredZip(bytes);
  const manifestBytes = getZipEntry(entries, 'backup.json');
  if (!manifestBytes) {
    throw new Error(t('err_zip_no_manifest'));
  }

  const backup = JSON.parse(bytesToText(manifestBytes));
  const backgroundAsset = backup.assets && backup.assets.backgroundImage;
  if (backgroundAsset && backgroundAsset.path && backup.settings && typeof backup.settings === 'object') {
    const backgroundBytes = getZipEntry(entries, backgroundAsset.path);
    if (backgroundBytes) {
      const mimeType = backgroundAsset.mimeType || getMimeTypeFromFilename(backgroundAsset.path);
      backup.settings.backgroundImage = bytesToDataUrl(backgroundBytes, mimeType);
    }
  }

  return backup;
}

async function readBackupFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!isZipFile(bytes)) {
    throw new Error('Bitte ein ZIP-Backup auswählen.');
  }
  return readBackupFromZip(bytes);
}

async function getStoredScreenshotKeys() {
  const storedData = await browser.storage.local.get(null);
  return Object.keys(storedData).filter(key => key.startsWith('screenshot_'));
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const backup = await readBackupFile(file);
    const importedSites = normalizeImportedSites(backup.sites);
    const importedSettings = normalizeImportedSettings(backup);

    sites = importedSites;
    settings = importedSettings;
    const screenshotData = {};
    getAllDials().forEach(s => {
      if (s.screenshot) screenshotData[`screenshot_${s.id}`] = s.screenshot;
    });

    const oldScreenshotKeys = await getStoredScreenshotKeys();
    if (oldScreenshotKeys.length) {
      await browser.storage.local.remove(oldScreenshotKeys);
    }

    await browser.storage.local.set({ 
      sites: getSitesWithoutScreenshots(), 
      settings,
      ...screenshotData 
    });
    thumbnailShrinkCache.clear();
    writeFastCacheSettings(settings);
    cacheFastSitesWithThumbnails(sites, true);
    applySettings();
    render();
    populateSettingsForm();
    setBackupStatus('Backup importiert.');
  } catch (error) {
    setBackupStatus('Import fehlgeschlagen: ' + error.message);
  } finally {
    event.target.value = '';
  }
}

// Live-update screenshots when background script captures them
if (typeof browser !== 'undefined' && browser?.storage?.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (!initialLoadComplete) {
    storageChangedDuringInitialLoad = true;
    return;
  }

  if (changes.settings) {
    const oldTileWidth = settings.tileWidth;
    settings = normalizeSettings(changes.settings.newValue);
    updateLockButtonUI();
    applySettings();
    render();
    writeFastCacheSettings(settings);
    if (oldTileWidth !== settings.tileWidth) {
      thumbnailShrinkCache.clear();
      cacheFastSitesWithThumbnails(sites, true);
    }
  }

  if (changes.sites && Array.isArray(changes.sites.newValue)) {
    changes.sites.newValue.forEach(ns => {
      getDialParts(ns).forEach(nd => {
        const found = findDialById(nd.id);
        if (found) {
          if (nd.screenshotVisitCount !== undefined) found.dial.screenshotVisitCount = nd.screenshotVisitCount;
          if (nd.screenshotLastCapturedAt !== undefined) found.dial.screenshotLastCapturedAt = nd.screenshotLastCapturedAt;
        }
      });
    });
  }

  const screenshotKeys = Object.keys(changes).filter(k => k.startsWith('screenshot_'));
  if (screenshotKeys.length > 0) {
    screenshotKeys.forEach(key => {
      const siteId = key.replace('screenshot_', '');
      const newScreenshot = changes[key].newValue;
      const found = findDialById(siteId);
      if (found) {
        found.dial.screenshot = newScreenshot;
        const tile = document.querySelector(`.tile[data-id="${found.parent.id}"]`);
        if (tile) {
          const part = tile.querySelector(`.tile-part[data-id="${siteId}"]`);
          const preview = part ? part.querySelector('.tile-preview') : tile.querySelector('.tile-preview');
          if (!preview) return;
          updateTilePreviewSmooth(preview, found.dial, !!part);
        }
      }
    });
    cacheFastSitesWithThumbnails(sites);
    if (!thumbnailRefreshRunning) {
      setThumbnailRefreshStatus(0, getAllDials().length);
    }
  } else if (changes.sites) {
    load().catch(error => console.warn('Speed Dial could not refresh sites after storage change.', error));
  }
});
}

if (typeof browser !== 'undefined' && browser?.runtime?.onMessage) {
  browser.runtime.onMessage.addListener(message => {
  if (!message || message.type !== 'bulk-refresh-status') return;

  const current = Number.isFinite(message.current) ? message.current : 0;
  const total = Number.isFinite(message.total) ? message.total : getAllDials().length;

  if (message.state === 'done' || message.state === 'busy') {
    setThumbnailRefreshStatus(current, total, message.message || '');
    setThumbnailRefreshActive(false);
  } else if (message.state === 'progress') {
    setThumbnailRefreshActive(true);
    setThumbnailRefreshStatus(current, total, message.message || '');
  }
});
}

window.addEventListener('resize', () => {
  applySettings();
  if (isSettingsOpen()) {
    positionSettingsPopover();
  }
});

// ==========================================================================
// Moderner Studio Farbwähler Popover & Swatch-Verwaltung
// ==========================================================================

const PRESET_COLORS = [
  '#0F172A', '#1E293B', '#334155', '#64748B', '#94A3B8', '#CBD5E1', '#F1F5F9', '#FFFFFF',
  '#000000', '#2563EB', '#0284C7', '#0D9488', '#16A34A', '#D97706', '#EA580C', '#DC2626'
];

let activeColorInput = null;
let activeColorButton = null;
let currentColorH = 0;
let currentColorS = 1;
let currentColorV = 1;
let isDraggingSpectrum = false;

function hexToRgbObj(hex) {
  let val = String(hex || '').trim().replace('#', '');
  if (val.length === 3) {
    val = val.split('').map(c => c + c).join('');
  }
  if (val.length !== 6) {
    return { r: 95, g: 102, b: 112 };
  }
  const r = parseInt(val.slice(0, 2), 16);
  const g = parseInt(val.slice(2, 4), 16);
  const b = parseInt(val.slice(4, 6), 16);
  return {
    r: isNaN(r) ? 0 : r,
    g: isNaN(g) ? 0 : g,
    b: isNaN(b) ? 0 : b
  };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, v };
}

function hsvToRgb(h, s, v) {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function rgbToHex(r, g, b) {
  const pad = c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
  return `#${pad(r)}${pad(g)}${pad(b)}`.toUpperCase();
}

function updateAllColorSwatches() {
  document.querySelectorAll('.color-swatch-btn').forEach(btn => {
    const inputId = btn.dataset.target;
    const input = document.getElementById(inputId);
    if (!input) return;
    const val = (input.value || '#000000').toUpperCase();
    const preview = btn.querySelector('.color-swatch-preview');
    const label = btn.querySelector('.color-swatch-code');
    if (preview) preview.style.backgroundColor = val;
    if (label) label.textContent = val;
  });
}

function drawColorSpectrum(canvas, hue) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  ctx.fillRect(0, 0, width, height);

  const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
  whiteGrad.addColorStop(0, '#ffffff');
  whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = whiteGrad;
  ctx.fillRect(0, 0, width, height);

  const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
  blackGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  blackGrad.addColorStop(1, '#000000');
  ctx.fillStyle = blackGrad;
  ctx.fillRect(0, 0, width, height);
}

function updateSpectrumCursor(s, v) {
  const cursor = document.querySelector('.color-spectrum-cursor');
  const wrap = document.querySelector('.color-spectrum-wrap');
  if (!cursor || !wrap) return;
  const w = wrap.clientWidth || 224;
  const h = wrap.clientHeight || 120;
  cursor.style.left = `${Math.round(s * w)}px`;
  cursor.style.top = `${Math.round((1 - v) * h)}px`;
}

function applyColorFromHsv(triggerEvents = true) {
  const rgb = hsvToRgb(currentColorH, currentColorS, currentColorV);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  const preview = document.querySelector('.color-preview-circle');
  if (preview) preview.style.backgroundColor = hex;

  const hexInput = document.getElementById('color-picker-hex');
  if (hexInput && document.activeElement !== hexInput) {
    hexInput.value = hex;
  }

  if (activeColorInput) {
    activeColorInput.value = hex;
    updateAllColorSwatches();
    if (triggerEvents) {
      activeColorInput.dispatchEvent(new Event('input', { bubbles: true }));
      activeColorInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

function positionFloatingMenu(el, anchor, { minWidth = 0, gap = 6, margin = 8 } = {}) {
  if (!el || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  if (minWidth) {
    el.style.minWidth = Math.max(rect.width, minWidth) + 'px';
  }
  const elRect = el.getBoundingClientRect();
  const w = elRect.width || Math.max(rect.width, minWidth);
  const h = elRect.height || 120;

  let left = rect.right - w;
  if (left < margin) left = rect.left;
  if (left + w > window.innerWidth - margin) {
    left = window.innerWidth - margin - w;
  }

  let top = rect.bottom + gap;
  if (top + h > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - h - gap);
  }

  el.style.top = Math.round(top) + 'px';
  el.style.left = Math.round(left) + 'px';
}

function positionColorPicker(btn) {
  positionFloatingMenu(document.getElementById('custom-color-picker'), btn, { minWidth: 248, gap: 6, margin: 12 });
}

function isColorPickerOpen() {
  const picker = document.getElementById('custom-color-picker');
  return picker && !picker.hidden;
}

function closeCustomColorPicker() {
  const picker = document.getElementById('custom-color-picker');
  if (!picker || picker.hidden) return;
  picker.hidden = true;
  document.querySelectorAll('.color-swatch-btn.is-active').forEach(b => b.classList.remove('is-active'));
  activeColorInput = null;
  activeColorButton = null;
}

function openCustomColorPicker(btn) {
  const picker = document.getElementById('custom-color-picker');
  if (!picker) return;

  const targetId = btn.dataset.target;
  const input = document.getElementById(targetId);
  if (!input) return;

  // Auto-enable parent feature if disabled
  if (targetId === 'set-thumb-border-color') {
    const cb = document.getElementById('set-show-thumb-border');
    if (cb && !cb.checked) {
      cb.checked = true;
      updateThumbBorderFieldsState();
      handleSettingsInput();
    }
  } else if (targetId === 'set-title-separator-color') {
    const cb = document.getElementById('set-show-title-separator');
    if (cb && !cb.checked) {
      cb.checked = true;
      updateTitleSeparatorFieldsState();
      handleSettingsInput();
    }
  }

  activeColorInput = input;
  activeColorButton = btn;

  document.querySelectorAll('.color-swatch-btn.is-active').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');

  const rgb = hexToRgbObj(input.value || '#000000');
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  currentColorH = hsv.h;
  currentColorS = hsv.s;
  currentColorV = hsv.v;

  const hueSlider = picker.querySelector('.color-hue-slider');
  if (hueSlider) hueSlider.value = Math.round(currentColorH);

  const canvas = picker.querySelector('.color-spectrum-canvas');
  drawColorSpectrum(canvas, currentColorH);
  updateSpectrumCursor(currentColorS, currentColorV);

  const hex = (input.value || '#000000').toUpperCase();
  const preview = picker.querySelector('.color-preview-circle');
  if (preview) preview.style.backgroundColor = hex;
  const hexInput = document.getElementById('color-picker-hex');
  if (hexInput) hexInput.value = hex;

  positionColorPicker(btn);
  picker.hidden = false;
}

function initCustomColorPicker() {
  const picker = document.getElementById('custom-color-picker');
  if (!picker) return;

  const presetsGrid = document.getElementById('color-picker-presets');
  if (presetsGrid) {
    presetsGrid.replaceChildren();
    PRESET_COLORS.forEach(hex => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-preset-swatch';
      swatch.style.backgroundColor = hex;
      swatch.title = hex;
      swatch.setAttribute('aria-label', hex);
      swatch.addEventListener('click', () => {
        const rgb = hexToRgbObj(hex);
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        currentColorH = hsv.h;
        currentColorS = hsv.s;
        currentColorV = hsv.v;
        const hueSlider = picker.querySelector('.color-hue-slider');
        if (hueSlider) hueSlider.value = Math.round(currentColorH);
        const canvas = picker.querySelector('.color-spectrum-canvas');
        drawColorSpectrum(canvas, currentColorH);
        updateSpectrumCursor(currentColorS, currentColorV);
        applyColorFromHsv(true);
      });
      presetsGrid.appendChild(swatch);
    });
  }

  const canvas = picker.querySelector('.color-spectrum-canvas');
  const wrap = picker.querySelector('.color-spectrum-wrap');

  function handleSpectrumPointer(e) {
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    currentColorS = x / rect.width;
    currentColorV = 1 - (y / rect.height);
    updateSpectrumCursor(currentColorS, currentColorV);
    applyColorFromHsv(true);
  }

  if (wrap) {
    wrap.addEventListener('mousedown', e => {
      isDraggingSpectrum = true;
      handleSpectrumPointer(e);
    });
    wrap.addEventListener('touchstart', e => {
      isDraggingSpectrum = true;
      handleSpectrumPointer(e);
    }, { passive: true });
  }

  window.addEventListener('mousemove', e => {
    if (isDraggingSpectrum) {
      handleSpectrumPointer(e);
    }
  });
  window.addEventListener('touchmove', e => {
    if (isDraggingSpectrum) {
      handleSpectrumPointer(e);
    }
  }, { passive: true });

  window.addEventListener('mouseup', () => {
    isDraggingSpectrum = false;
  });
  window.addEventListener('touchend', () => {
    isDraggingSpectrum = false;
  });

  const hueSlider = picker.querySelector('.color-hue-slider');
  if (hueSlider) {
    hueSlider.addEventListener('input', () => {
      currentColorH = Number(hueSlider.value);
      drawColorSpectrum(canvas, currentColorH);
      applyColorFromHsv(true);
    });
  }

  const hexInput = document.getElementById('color-picker-hex');
  if (hexInput) {
    hexInput.addEventListener('input', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-f]{6}$/i.test(val)) {
        const rgb = hexToRgbObj(val);
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        currentColorH = hsv.h;
        currentColorS = hsv.s;
        currentColorV = hsv.v;
        if (hueSlider) hueSlider.value = Math.round(currentColorH);
        drawColorSpectrum(canvas, currentColorH);
        updateSpectrumCursor(currentColorS, currentColorV);
        applyColorFromHsv(true);
      }
    });
  }

  const eyedropper = document.getElementById('color-picker-eyedropper');
  if (eyedropper) {
    if ('EyeDropper' in window) {
      eyedropper.addEventListener('click', async () => {
        try {
          const eye = new window.EyeDropper();
          const result = await eye.open();
          if (result && result.sRGBHex) {
            const rgb = hexToRgbObj(result.sRGBHex);
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            currentColorH = hsv.h;
            currentColorS = hsv.s;
            currentColorV = hsv.v;
            if (hueSlider) hueSlider.value = Math.round(currentColorH);
            drawColorSpectrum(canvas, currentColorH);
            updateSpectrumCursor(currentColorS, currentColorV);
            applyColorFromHsv(true);
          }
        } catch {
          // Aborted by user
        }
      });
    } else {
      eyedropper.style.display = 'none';
    }
  }

  document.querySelectorAll('.color-swatch-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (isColorPickerOpen() && activeColorButton === btn) {
        closeCustomColorPicker();
      } else {
        openCustomColorPicker(btn);
      }
    });
  });

  const scrollBody = document.querySelector('.settings-body');
  if (scrollBody) {
    scrollBody.addEventListener('scroll', () => {
      if (isColorPickerOpen() && activeColorButton) {
        positionColorPicker(activeColorButton);
      }
      if (isSelectPopoverOpen() && activeCustomSelect) {
        positionSelectPopover(activeCustomSelect);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Modernes Studio Custom Select Popover (kein hässliches graues OS-Menü mehr)
// ---------------------------------------------------------------------------
let activeCustomSelect = null;

function isSelectPopoverOpen() {
  const popover = document.getElementById('custom-select-popover');
  return popover && !popover.hidden && popover.style.display !== 'none';
}

function closeCustomSelectPopover() {
  const popover = document.getElementById('custom-select-popover');
  if (!popover) return;
  popover.hidden = true;
  popover.style.display = 'none';
  if (activeCustomSelect) {
    activeCustomSelect.classList.remove('is-open');
    activeCustomSelect = null;
  }
}

function positionSelectPopover(select) {
  positionFloatingMenu(document.getElementById('custom-select-popover'), select, { minWidth: 160, gap: 4, margin: 8 });
}

function openCustomSelectPopover(select) {
  const popover = document.getElementById('custom-select-popover');
  if (!popover || !select) return;

  if (activeCustomSelect === select && isSelectPopoverOpen()) {
    closeCustomSelectPopover();
    return;
  }

  dismissFloatingPopups();

  activeCustomSelect = select;
  select.classList.add('is-open');

  popover.replaceChildren();
  const items = [];

  function setActiveItem(target) {
    items.forEach(it => it.classList.remove('is-active'));
    if (target) target.classList.add('is-active');
  }

  Array.from(select.options).forEach(opt => {
    const isSelected = opt.value === select.value;
    const item = document.createElement('div');
    item.className = 'custom-select-item' + (isSelected ? ' is-active' : '');
    item.dataset.value = opt.value;

    const text = document.createElement('span');
    text.className = 'custom-select-item-text';
    text.textContent = opt.textContent;
    item.appendChild(text);

    item.addEventListener('mouseenter', () => setActiveItem(item));

    let chosen = false;
    const choose = (e) => {
      if (chosen) return;
      chosen = true;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      select.value = opt.value;
      closeCustomSelectPopover();
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    item.addEventListener('pointerdown', e => e.stopPropagation());
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
    });
    item.addEventListener('click', choose);

    items.push(item);
    popover.appendChild(item);
  });

  popover.onmouseleave = () => {
    const cur = items.find(it => it.dataset.value === select.value);
    if (cur) setActiveItem(cur);
  };

  popover.hidden = false;
  popover.style.display = 'flex';
  positionSelectPopover(select);
}

function initCustomSelects() {
  document.querySelectorAll('select.select-pill').forEach(select => {
    if (select.dataset.customSelectInit) return;
    select.dataset.customSelectInit = 'true';

    select.addEventListener('pointerdown', e => e.stopPropagation());

    select.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeCustomSelect === select && isSelectPopoverOpen()) {
        closeCustomSelectPopover();
      } else {
        openCustomSelectPopover(select);
      }
    });

    select.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    select.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isSelectPopoverOpen() && activeCustomSelect === select) {
          const activeItem = document.querySelector('#custom-select-popover .custom-select-item.is-active');
          if (activeItem) activeItem.dispatchEvent(new Event('click'));
          else closeCustomSelectPopover();
        } else {
          openCustomSelectPopover(select);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isSelectPopoverOpen() || activeCustomSelect !== select) {
          openCustomSelectPopover(select);
          return;
        }
        const items = Array.from(document.querySelectorAll('#custom-select-popover .custom-select-item'));
        if (!items.length) return;
        const currentIdx = items.findIndex(it => it.classList.contains('is-active'));
        const nextIdx = e.key === 'ArrowDown'
          ? (currentIdx + 1) % items.length
          : (currentIdx - 1 + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('is-active', i === nextIdx));
        items[nextIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Escape') {
        closeCustomSelectPopover();
      }
    });
  });
}

initCustomColorPicker();
initCustomSelects();

if (typeof applyTranslations === 'function') {
  applyTranslations();
}

restoreFastCache();
load();

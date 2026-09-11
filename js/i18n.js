// Internationalization (i18n) Module for Speed Dial (DE / EN)

const I18N_TRANSLATIONS = {
  de: {
    // Toolbar
    toolbar_refresh: "Alle Thumbnails aktualisieren",
    toolbar_lock_allow: "Kacheln sperren (Verschieben erlauben)",
    toolbar_lock_locked: "Kacheln entsperren (Verschieben ist gesperrt)",
    toolbar_settings: "Einstellungen",

    // Settings Header & Footer
    settings_title: "Einstellungen",

    // General & Language Section
    sec_general: "Allgemein & Sprache",
    label_language: "Sprache",
    desc_language: "Sprache der Benutzeroberfläche",
    opt_lang_auto: "Automatisch (System)",
    opt_lang_de: "Deutsch",
    opt_lang_en: "English",
    label_menu_theme: "Menü-Design",
    desc_menu_theme: "Erscheinungsbild des Einstellungsmenüs",
    opt_theme_dark: "Dunkel (Standard)",
    opt_theme_light: "Hell",

    // Layout & Grid Section
    sec_layout: "Layout & Raster",
    group_grid: "Raster-Aufbau",
    label_columns: "Spalten pro Zeile",
    desc_columns: "Wie viele Favoriten nebeneinander Platz finden",
    label_auto_fit: "Automatische Skalierung",
    desc_auto_fit: "Kacheln füllen den Bildschirm gleichmäßig und flexibel aus",
    group_tile_dimensions: "Kachel-Dimensionen",
    label_tile_width: "Standardbreite",
    desc_tile_width: "Basisbreite jeder Kachel in Pixel",
    label_tile_height: "Vorschauhöhe",
    desc_tile_height: "Höhe des Screenshot-Ausschnitts",
    group_gaps: "Freiräume",
    label_column_gap: "Horizontaler Kachelabstand",
    desc_column_gap: "Abstand zwischen den Spalten",
    label_row_gap: "Vertikaler Kachelabstand",
    desc_row_gap: "Abstand zwischen den Zeilen",

    // Preview & Image Section
    sec_preview: "Vorschau & Bild",
    group_image_fit: "Bildanpassung",
    label_preview_type: "Kachel-Inhalt",
    desc_preview_type: "Wähle zwischen Thumbnails (Screenshots) oder Website-Icons",
    opt_preview_type_thumbs: "Vorschaubilder (Thumbnails)",
    opt_preview_type_icons: "Nur Icons (Favicons)",
    label_preview_fit: "Darstellungsmodus",
    desc_preview_fit: "Wie Screenshots im Kachelrahmen eingepasst werden",
    opt_fit_cover: "Vollbild (Cover)",
    opt_fit_contain: "Einpassen (Contain)",
    opt_fit_stretch: "Strecken (Stretch)",
    label_preview_fill: "Innenabstand / Rand",
    desc_preview_fill: "Zusätzlicher weißer oder transparenter Rand um den Screenshot",
    group_border: "Kontur & Kanten",
    label_thumb_border: "Kantenkontur hervorheben",
    desc_thumb_border: "Sichtbare Kontur um den Screenshot-Bereich",
    label_border_width: "Konturstärke",
    label_border_color: "Konturfarbe",
    label_border_opacity: "Deckkraft der Kontur",
    group_refresh: "Screenshot-Aktualisierung",
    label_refresh_mode: "Hintergrund-Aktualisierung",
    desc_refresh_mode: "Erneuert Screenshots automatisch bei wiederholtem Besuch",
    opt_mode_interval: "Nach Besuchen",
    opt_mode_daily: "Täglich",
    opt_mode_disabled: "Nie (Deaktiviert)",
    label_refresh_visits: "Intervall (Aufrufe)",
    desc_refresh_visits: "Anzahl der Aufrufe, nach denen ein neuer Screenshot erstellt wird",

    // Tile Design Section
    sec_tile_design: "Kachel-Design",
    group_typography: "Kachel-Header & Typografie",
    label_title_size: "Schriftgröße",
    label_title_weight: "Schriftstärke",
    label_header_height: "Header-Leistenhöhe",
    label_header_bg: "Header-Hintergrundfarbe",
    label_header_color: "Header-Textfarbe",
    group_separator: "Trennlinie",
    label_show_separator: "Trennlinie einblenden",
    desc_show_separator: "Feine Linie zwischen Titel und Vorschaubild",
    label_separator_width: "Linienstärke",
    label_separator_color: "Linienfarbe",
    label_separator_opacity: "Deckkraft der Trennlinie",
    group_shape_depth: "Form & Tiefe",
    label_tile_radius: "Eckenabrundung",
    desc_tile_radius: "Sanfter Kurvenradius der Kacheln",
    label_tile_shadow: "Kachel-Schatten",
    desc_tile_shadow: "Erhöht die räumliche Tiefe auf dem Hintergrund",
    label_shadow_opacity: "Schattenstärke",
    label_show_add_tile: "„Plus“-Kachel anzeigen",
    desc_show_add_tile: "Schnellkachel zum Hinzufügen neuer Seiten am Rasterende",

    // Background Section
    sec_background: "Hintergrund",
    group_bg_design: "Hintergrund-Design",
    label_bg_color: "Hintergrundfarbe",
    desc_bg_color: "Flächige Grundfarbe des Dashboards",
    label_custom_wallpaper: "Eigenes Wallpaper",
    desc_custom_wallpaper: "Eigenes Bild als Seitenhintergrund verwenden",
    status_bg_image_set: "Bild gesetzt",
    status_no_bg_image: "Kein Bild gesetzt",
    btn_choose_image: "Bild wählen",
    btn_remove_image: "Entfernen",
    label_bg_size: "Bildskalierung",
    desc_bg_size: "Wie das Hintergrundbild dargestellt wird",
    opt_bg_size_auto: "Originalgröße (Auto)",
    opt_bg_size_cover: "Vollbild (Cover)",
    opt_bg_size_contain: "Einpassen (Contain)",
    opt_bg_size_stretch: "Gestreckt",
    label_bg_position: "Bildposition",
    opt_bg_pos_center: "Zentriert",
    opt_bg_pos_top_left: "Oben links",
    opt_bg_pos_top_center: "Oben zentriert",
    opt_bg_pos_top_right: "Oben rechts",
    opt_bg_pos_center_left: "Mitte links",
    opt_bg_pos_center_right: "Mitte rechts",
    opt_bg_pos_bottom_left: "Unten links",
    opt_bg_pos_bottom_center: "Unten zentriert",
    opt_bg_pos_bottom_right: "Unten rechts",

    // Backup Section
    sec_backup: "Datensicherung",
    group_backup: "Sicherung & Wiederherstellung",
    backup_hero_title: "Backup & Wiederherstellung",
    backup_hero_desc: "Exportiert alle Kacheln, Screenshots, Ordner und Einstellungen sicher als portable ZIP-Datei.",
    btn_export_backup: "Backup exportieren",
    btn_import_backup: "Backup importieren",

    // Color Picker
    picker_presets: "Vorschläge",
    picker_eyedropper_title: "Farbe vom Bildschirm aufnehmen",
    picker_eyedropper_aria: "Farbpipette",
    picker_hue_aria: "Farbton",

    // Site Modal
    modal_title_add: "Seite hinzufügen",
    modal_title_edit: "Seite bearbeiten",
    label_site_url: "URL",
    label_site_name: "Name (optional)",
    btn_cancel: "Abbrechen",
    btn_save: "Speichern",

    // Context Menu
    ctx_edit: "Bearbeiten",
    ctx_add_split: "Untere Hälfte hinzufügen",
    ctx_remove_split: "Teilung aufheben",
    ctx_refresh: "Screenshot aktualisieren",
    ctx_interval: "Intervall",
    ctx_reset_title: "Zurücksetzen",
    ctx_reset_aria: "Intervall zurücksetzen",
    ctx_delete: "Löschen",
    ctx_delete_top: "Obere Hälfte löschen",
    ctx_delete_bottom: "Untere Hälfte löschen",
    ctx_delete_part: "Hälfte löschen",
    ctx_delete_all: "Ganze Kachel löschen",

    // Dynamic Messages & Errors
    alert_invalid_url: "Bitte eine gültige Web-Adresse eingeben.",
    alert_backup_create_error: "Backup konnte nicht erstellt werden.",
    alert_invalid_zip: "Ungültiges Dateiformat. Bitte eine .zip Datei wählen.",
    alert_backup_restore_error: "Backup konnte nicht geladen werden.",
    warn_screenshot_start_error: "Vorschaubild konnte nicht gestartet werden.",
    err_backup_no_url: "Backup enthält eine Kachel ohne URL.",
    err_backup_invalid_tile: "Backup enthält eine ungültige Kachel.",
    err_backup_no_valid_tiles: "Backup enthält keine gültigen Kacheln.",
    err_backup_too_large: "Backup ist zu groß für dieses ZIP-Format.",
    err_backup_bg_prep: "Hintergrundbild konnte nicht für das Backup vorbereitet werden.",
    err_zip_no_manifest: "ZIP-Backup enthält keine backup.json.",
    err_zip_compressed: "ZIP-Backup enthält komprimierte Dateien. Bitte mit dieser Erweiterung exportierte ZIP-Backups verwenden.",
    err_zip_incomplete: "ZIP-Backup ist unvollständig.",
    err_zip_unsupported_size: "ZIP-Backup nutzt ein nicht unterstütztes Größenformat.",
    warn_lock_state_save: "Kachel-Sperrzustand konnte nicht gespeichert werden.",
    warn_tile_order_save: "Kachelreihenfolge konnte nicht gespeichert werden."
  },

  en: {
    // Toolbar
    toolbar_refresh: "Refresh all thumbnails",
    toolbar_lock_allow: "Lock tiles (allow dragging)",
    toolbar_lock_locked: "Unlock tiles (dragging is locked)",
    toolbar_settings: "Settings",

    // Settings Header & Footer
    settings_title: "Settings",

    // General & Language Section
    sec_general: "General & Language",
    label_language: "Language",
    desc_language: "User interface language",
    opt_lang_auto: "Automatic (System)",
    opt_lang_de: "Deutsch",
    opt_lang_en: "English",
    label_menu_theme: "Menu Appearance",
    desc_menu_theme: "Color theme of the settings menu",
    opt_theme_dark: "Dark (Default)",
    opt_theme_light: "Light",

    // Layout & Grid Section
    sec_layout: "Layout & Grid",
    group_grid: "Grid Structure",
    label_columns: "Columns per row",
    desc_columns: "How many dials fit next to each other",
    label_auto_fit: "Auto-Fit Scaling",
    desc_auto_fit: "Tiles fill the screen evenly and flexibly",
    group_tile_dimensions: "Tile Dimensions",
    label_tile_width: "Base Width",
    desc_tile_width: "Base width of each tile in pixels",
    label_tile_height: "Preview Height",
    desc_tile_height: "Height of the screenshot area",
    group_gaps: "Spacing & Gaps",
    label_column_gap: "Horizontal Gap",
    desc_column_gap: "Gap between columns",
    label_row_gap: "Vertical Gap",
    desc_row_gap: "Gap between rows",

    // Preview & Image Section
    sec_preview: "Preview & Image",
    group_image_fit: "Image Fit",
    label_preview_type: "Tile Content",
    desc_preview_type: "Choose between thumbnails (screenshots) or website icons",
    opt_preview_type_thumbs: "Thumbnails (Screenshots)",
    opt_preview_type_icons: "Icons only (Favicons)",
    label_preview_fit: "Display Mode",
    desc_preview_fit: "How screenshots fit within the tile frame",
    opt_fit_cover: "Full (Cover)",
    opt_fit_contain: "Fit (Contain)",
    opt_fit_stretch: "Stretch",
    label_preview_fill: "Padding / Margin",
    desc_preview_fill: "Additional padding around the screenshot",
    group_border: "Border & Edges",
    label_thumb_border: "Highlight Border",
    desc_thumb_border: "Visible border around the screenshot area",
    label_border_width: "Border Width",
    label_border_color: "Border Color",
    label_border_opacity: "Border Opacity",
    group_refresh: "Screenshot Refresh",
    label_refresh_mode: "Background Refresh",
    desc_refresh_mode: "Automatically renew screenshots upon repeated visits",
    opt_mode_interval: "By visits",
    opt_mode_daily: "Daily",
    opt_mode_disabled: "Never (Disabled)",
    label_refresh_visits: "Interval (Visits)",
    desc_refresh_visits: "Number of visits before a new screenshot is captured",

    // Tile Design Section
    sec_tile_design: "Tile Design",
    group_typography: "Tile Header & Typography",
    label_title_size: "Font Size",
    label_title_weight: "Font Weight",
    label_header_height: "Header Bar Height",
    label_header_bg: "Header Background Color",
    label_header_color: "Header Text Color",
    group_separator: "Separator Line",
    label_show_separator: "Show Separator",
    desc_show_separator: "Subtle line between title and preview thumbnail",
    label_separator_width: "Line Width",
    label_separator_color: "Line Color",
    label_separator_opacity: "Separator Opacity",
    group_shape_depth: "Shape & Depth",
    label_tile_radius: "Corner Radius",
    desc_tile_radius: "Soft corner radius for tiles",
    label_tile_shadow: "Tile Shadow",
    desc_tile_shadow: "Adds depth against the background",
    label_shadow_opacity: "Shadow Intensity",
    label_show_add_tile: "Show 'Plus' Tile",
    desc_show_add_tile: "Quick tile to add new sites at the end of the grid",

    // Background Section
    sec_background: "Background",
    group_bg_design: "Background Design",
    label_bg_color: "Background Color",
    desc_bg_color: "Solid base color of the dashboard",
    label_custom_wallpaper: "Custom Wallpaper",
    desc_custom_wallpaper: "Use a custom image as page background",
    status_bg_image_set: "Image set",
    status_no_bg_image: "No image set",
    btn_choose_image: "Choose Image",
    btn_remove_image: "Remove",
    label_bg_size: "Image Scaling",
    desc_bg_size: "How the background image is displayed",
    opt_bg_size_auto: "Original Size (Auto)",
    opt_bg_size_cover: "Full (Cover)",
    opt_bg_size_contain: "Fit (Contain)",
    opt_bg_size_stretch: "Stretched",
    label_bg_position: "Image Position",
    opt_bg_pos_center: "Centered",
    opt_bg_pos_top_left: "Top Left",
    opt_bg_pos_top_center: "Top Center",
    opt_bg_pos_top_right: "Top Right",
    opt_bg_pos_center_left: "Center Left",
    opt_bg_pos_center_right: "Center Right",
    opt_bg_pos_bottom_left: "Bottom Left",
    opt_bg_pos_bottom_center: "Bottom Center",
    opt_bg_pos_bottom_right: "Bottom Right",

    // Backup Section
    sec_backup: "Data Backup",
    group_backup: "Backup & Restore",
    backup_hero_title: "Backup & Restore",
    backup_hero_desc: "Securely export all tiles, screenshots, and settings as a portable ZIP file.",
    btn_export_backup: "Export Backup",
    btn_import_backup: "Import Backup",

    // Color Picker
    picker_presets: "Presets",
    picker_eyedropper_title: "Pick color from screen",
    picker_eyedropper_aria: "Color eyedropper",
    picker_hue_aria: "Hue",

    // Site Modal
    modal_title_add: "Add Site",
    modal_title_edit: "Edit Site",
    label_site_url: "URL",
    label_site_name: "Name (optional)",
    btn_cancel: "Cancel",
    btn_save: "Save",

    // Context Menu
    ctx_edit: "Edit",
    ctx_add_split: "Add lower half",
    ctx_remove_split: "Remove split",
    ctx_refresh: "Refresh screenshot",
    ctx_interval: "Interval",
    ctx_reset_title: "Reset",
    ctx_reset_aria: "Reset interval",
    ctx_delete: "Delete",
    ctx_delete_top: "Delete upper half",
    ctx_delete_bottom: "Delete lower half",
    ctx_delete_part: "Delete half",
    ctx_delete_all: "Delete entire tile",

    // Dynamic Messages & Errors
    alert_invalid_url: "Please enter a valid web address.",
    alert_backup_create_error: "Backup could not be created.",
    alert_invalid_zip: "Invalid file format. Please select a .zip file.",
    alert_backup_restore_error: "Backup could not be restored.",
    warn_screenshot_start_error: "Screenshot capture could not be started.",
    err_backup_no_url: "Backup contains a tile without URL.",
    err_backup_invalid_tile: "Backup contains an invalid tile.",
    err_backup_no_valid_tiles: "Backup contains no valid tiles.",
    err_backup_too_large: "Backup is too large for this ZIP format.",
    err_backup_bg_prep: "Background image could not be prepared for backup.",
    err_zip_no_manifest: "ZIP backup contains no backup.json.",
    err_zip_compressed: "ZIP backup contains compressed files. Please use ZIP backups exported with this extension.",
    err_zip_incomplete: "ZIP backup is incomplete.",
    err_zip_unsupported_size: "ZIP backup uses an unsupported size format.",
    warn_lock_state_save: "Tile lock state could not be saved.",
    warn_tile_order_save: "Tile order could not be saved."
  }
};

function getCurrentLanguage() {
  const pref = (typeof settings !== 'undefined' && settings?.language) ? settings.language : 'auto';
  if (pref === 'de' || pref === 'en') {
    return pref;
  }
  const browserLang = (typeof navigator !== 'undefined' && navigator.language)
    ? navigator.language.toLowerCase()
    : 'en';
  return browserLang.startsWith('de') ? 'de' : 'en';
}

function t(key, fallback = '') {
  const lang = getCurrentLanguage();
  return I18N_TRANSLATIONS[lang]?.[key]
    ?? I18N_TRANSLATIONS['en']?.[key]
    ?? fallback
    ?? key;
}

function applyTranslations(root = document) {
  const lang = getCurrentLanguage();
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }

  // Text content
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (text) el.textContent = text;
  });

  // Title attributes
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    const text = t(key);
    if (text) el.title = text;
  });

  // Placeholder attributes
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const text = t(key);
    if (text) el.placeholder = text;
  });

  // Aria-label attributes
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.dataset.i18nAriaLabel;
    const text = t(key);
    if (text) el.setAttribute('aria-label', text);
  });
}

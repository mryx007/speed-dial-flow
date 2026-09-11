# Speed Dial for Firefox

A modern, lightning-fast, and deeply customizable Speed Dial new tab page for Mozilla Firefox. Built with pure Vanilla JavaScript and WebExtensions API (Manifest V2) for maximum responsiveness, privacy, and zero bloat.

---

## ✨ Features

- **Automated Webpage Screenshots:** Renders high-resolution thumbnails locally in background tabs without interrupting your workflow.
- **Split Dial Support:** Split any tile horizontally into two separate, independent bookmarks inside a single grid slot.
- **Drag & Drop Reordering:** Freely rearrange your dials with smooth animations, complete with a lock toggle in the toolbar to prevent accidental movement.
- **Privacy-First & Local:** Zero telemetry, no remote analytics, no third-party CDN scripts. All bookmarks, screenshots, and preferences are stored strictly on your machine (`browser.storage.local`).
- **Complete ZIP Backup & Restore:** Export and import your entire configuration—including dials, split links, thumbnails, wallpaper, and styling—in a single portable `.zip` archive.
- **Integrated Studio Color Picker:** Advanced palette picker featuring an interactive color spectrum, hue slider, system eyedropper tool, HEX input, and curated presets.
- **Custom Wallpapers:** Upload your own background images with full control over scaling modes and positional alignment.
- **Bilingual Interface:** Full localization support for English and German with automatic system language detection.
- **Dark & Light Mode:** Seamless theme integration for menus and dashboard elements.

---

## ⚙️ Configuration & Settings

Speed Dial offers extensive customization to match your personal aesthetic and display resolution. Access the settings panel anytime via the menu button in the top toolbar:

### 1. General & Language (`Allgemein & Sprache`)
- **Language:** Choose between `Automatic (System)`, `German (Deutsch)`, or `English`.
- **Menu Theme:** Toggle between `Dark (Default)` and `Light` styles for the popover menus and dialogs.

### 2. Layout & Grid (`Layout & Raster`)
- **Columns per Row:** Define how many dials appear horizontally across each row (from 1 up to 20 columns).
- **Auto-Fit Scaling:** Fluidly scales tiles to distribute them evenly across the viewport, ideal for widescreen and ultrawide monitors.
- **Tile Dimensions:**
  - **Tile Width:** Set the base width for each dial in pixels (80px – 800px).
  - **Preview Height:** Adjust the height of the thumbnail capture area (50px – 600px).
- **Gaps & Spacing:**
  - **Horizontal Gap:** Fine-tune the pixel distance between columns (0px – 80px).
  - **Vertical Gap:** Fine-tune the pixel distance between rows (0px – 80px).

### 3. Preview & Image (`Vorschau & Bild`)
- **Tile Content Type:**
  - `Thumbnails (Screenshots)`: Full webpage snapshot previews.
  - `Icons (Favicons)`: Minimalist favicon-only display.
- **Display Mode (Fit):**
  - `Cover`: Fills the entire preview container (cropped to preserve aspect ratio).
  - `Contain`: Scales the screenshot to fit entirely inside the container.
  - `Stretch`: Stretches the image to fill the exact container boundaries.
- **Inner Padding / Border Margin:** Adds an inner padding around the screenshot (0px – 60px).
- **Background Screenshot Refresh Mode:**
  - `By Visits`: Automatically refreshes a tile's screenshot after a configurable number of visits (default: every visit).
  - `Daily`: Updates the thumbnail once every 24 hours upon visiting.
  - `Disabled`: Keeps screenshots static until manually refreshed.
- **Thumbnail Contour / Border:**
  - Enable or disable a highlighted border around the screenshot box.
  - Customize border thickness (1px – 12px), border color, and opacity (0% – 100%).

### 4. Tile Design (`Kachel-Design`)
- **Typography & Header:**
  - **Font Size:** Header title text size (9px – 32px).
  - **Font Weight:** Title text boldness (100 to 900).
  - **Header Height:** Height of the top title bar (16px – 64px).
  - **Header Background & Text Color:** Pick custom hex colors for title bar background and font.
- **Separator Line:**
  - Toggle a fine separator line between the title bar and the preview image.
  - Configure line width (1px – 12px), line color, and line opacity (0% – 100%).
- **Shape & Depth:**
  - **Corner Radius:** Adjust the rounded corner radius of dials (0px – 40px).
  - **Drop Shadow:** Enable smooth depth shadows behind tiles with adjustable opacity (0% – 100%).
  - **Show Add Tile ("+"):** Toggle the quick-add "+" card displayed at the end of the grid.

### 5. Background (`Hintergrund`)
- **Solid Background Color:** Set any color for the dashboard canvas.
- **Custom Wallpaper:** Upload custom background images (`.png`, `.jpg`, `.webp`, `.svg`).
- **Image Scaling:** Select how wallpapers scale (`Auto`, `Cover`, `Contain`, or `Stretch 100% 100%`).
- **Image Position:** 9-point alignment grid (Center, Top-Left, Top-Center, Top-Right, Center-Left, Center-Right, Bottom-Left, Bottom-Center, Bottom-Right).

### 6. Data Backup & Migration (`Datensicherung`)
- **Export Backup:** Downloads a complete `.zip` archive holding all site entries, split configurations, screenshot images, custom wallpaper, and user preferences.
- **Import Backup:** Restore from any existing Speed Dial `.zip` archive.

---

## 🖱️ Context Menu & Tile Actions

Right-click on any dial to open the interactive context menu:
- **Edit (`Bearbeiten`):** Change the site URL and display title.
- **Add / Remove Split Tile (`Untere Hälfte hinzufügen` / `Hälfte löschen`):** Turn a single dial into two stacked half-dials, or delete either half individually.
- **Refresh Screenshot (`Screenshot aktualisieren`):** Force an instant background tab screenshot capture of the webpage.
- **Visit Interval (`Intervall`):** Override the global screenshot refresh interval for this specific website (e.g., set to `0` to keep the thumbnail permanent).
- **Delete (`Löschen`):** Remove the tile completely.

---

## 🔒 Permissions Explained

| Permission | Purpose |
| :--- | :--- |
| `tabs` | Required to create off-screen background tabs to load pages and capture fresh thumbnails. |
| `storage` | Stores bookmark lists, configuration values, and cached image data locally in Firefox. |
| `<all_urls>` | Enables thumbnail generation across all web addresses added to your speed dial. |

*Note: In accordance with Firefox privacy guidelines, this extension does not collect, transmit, or monetize any user browsing data.*

---

## 🚀 Installation & Development

### Load Temporarily in Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** (`Vorübergehendes Add-on laden...`).
3. Select the `manifest.json` file inside this repository directory.
4. Open a new tab (`Ctrl + T`) to launch Speed Dial.

### Build / Package Extension
To package the extension into an installable `.zip` / `.xpi`:
```bash
# Zip the essential extension files
zip -r speed-dial-firefox.zip manifest.json _locales/ css/ icons/ js/ pages/
```

---

## 🛠️ Tech Stack

- **Platform:** Mozilla Firefox (WebExtensions API, Manifest V2)
- **Frontend:** Semantic HTML5, Vanilla CSS3 (Custom Properties & Flexbox/Grid)
- **Logic:** Native JavaScript (ES6+, Promises, Canvas API)
- **Storage:** `browser.storage.local`

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

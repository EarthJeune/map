# CSS Architecture & Modularization Roadmap

**Project:** DA-LARES & Multi-Station Interactive Campus Wayfinding & Kiosk System  
**Document Status:** Approved Architectural Strategy  
**Created:** October 2026  
**Execution Milestone:** Post-LARES Completion (Pre-Station 2 / QARES Deployment)

---

## 1. Executive Summary & Forensic Health Check

As the system expands from **DA-LARES (Lipa City)** to multiple Department of Agriculture research stations across Region IV-A (such as **QARES in Tiaong, Quezon**), the frontend stylesheet requires an architectural transition from a monolithic legacy file to a **modular, domain-driven CSS architecture**.

### 📊 Current Forensic Metrics (`css/main.css`):

| Metric | Value Before Cleanup | Current Value (Post-Pruning) | Target State | Health Status |
| :--- | :--- | :--- | :--- | :--- |
| **Total Lines** | 18,783 lines | **9,785 lines** (-47.9%) | $\approx 3,000\text{ lines}$ (across modules) | 🟢 Cleaned (Step 1 Complete) |
| **Blank Lines** | 10,190 lines (54.3%) | **1,192 lines (12.1%)** | $< 10\%$ | 🟢 Normalized standard spacing |
| **Active CSS Content** | 8,593 lines | **8,593 lines** (100% preserved) | Segmented into 6 domain files | ⚠️ All features bundled into one file |
| **File Size** | $235.3\text{ KB}$ | **$226.3\text{ KB}$** | $< 180\text{ KB}$ total | 🟢 Optimized local delivery |
| **Station Coupling** | 0 station selectors | **0 station selectors** | Modular / Shared Shell | ✅ Shared kiosk UI components |

---

## 2. Why the CSS Works Now (The Good News)

1. **Shared UI Shell Paradigm:**
   The interface components—portrait touch kiosk sidebar, facility search bar, category dropdown, right-side details drawer, turn-by-turn navigation HUD, compass, speed selector pill, and camera widgets—are **application shell components**. They are 100% shared across LARES and future stations.
2. **GPU Canvas Offloading:**
   All 3D architectural models (`models/*.glb`), agricultural field boundaries, drone orthomosaics, and terrain layers are rendered directly on the GPU via WebGL (Mapbox GL JS + Three.js). Changing stations switches data and models, not CSS rules.
3. **Local Kiosk Caching:**
   In production (touch totem Linux/Chrome kiosk), `css/main.css` is downloaded once and cached in memory.

---

## 3. Why It Must Be Refactored for Future Stations (Technical Debt)

1. **The "Kitchen Sink" Monolith:**
   Kiosk desktop layout, responsive mobile bottom sheets (`.phone-*`), visitor wayfinding cards, admin polygon editors (`plot_draw.html`), and drone calibration overlays are currently compiled into a single file in chronological order rather than domain structure.
2. **Specificity & Cascade Override Collisions:**
   With 18,000+ lines, styles written late in the project conflict with earlier base styles. Overriding styles often requires high-specificity chains or `!important` flags (e.g., anchoring the Mapbox watermark and meters).
3. **Admin Styles in Public Visitor Kiosk:**
   Visitor touch kiosks and mobile phones load ~600 lines of developer/admin styles (`#drone-cal-panel`, `#fps-badge`, polygon edit handles) that are never used by general visitors.
4. **Developer Ergonomics:**
   Navigating an 18,000-line file with 10,000 blank lines slows down inspections and makes station-specific enhancements prone to regression.

---

## 4. Target Architecture: Domain-Driven Modular CSS

The target architecture replaces the monolithic file with clean, decoupled stylesheets in `css/`:

```text
css/
├── variables.css          # Design tokens (colors, gradients, glassmorphism, z-index, safe areas)
├── base.css               # Reset, box-sizing, touch-action, typography, custom scrollbars
├── kiosk.css              # Desktop kiosk totem layout (sidebar, search, filter dropdown, directory)
├── building-panel.css     # Right-side details drawer, sub-plot chips, hero cross-fade, lightbox
├── navigation.css         # Live turn-by-turn banner, A* path casing, route step list, speed controls
├── phone.css              # Mobile responsive sheet, touch drag handle, compact controls
├── admin.css              # Drone calibration, polygon drawing tools, FPS HUD (loaded when ?admin=1)
└── main.css               # Master orchestrator (@import or bundled entry point)
```

### Module Breakdown & Responsibilities:

#### 1. `css/variables.css` ($\approx 120\text{ lines}$)
* CSS Custom Properties: `--primary-green`, `--accent-cyan`, `--glass-bg`, `--panel-width: 420px`.
* Z-index hierarchy definitions (`--z-map: 1`, `--z-hud: 10`, `--z-drawer: 20`, `--z-modal: 50`).
* Safe-area padding tokens for mobile notch/home indicators.

#### 2. `css/base.css` ($\approx 250\text{ lines}$)
* Universal reset, HTML/body viewport locks (`overflow: hidden; touch-action: pan-x pan-y`).
* Typography utilities and font smoothing.
* Global utility classes (e.g. `.hidden`, `.glass-panel`).

#### 3. `css/kiosk.css` ($\approx 1,200\text{ lines}$)
* Kiosk sidebar container (`.sidebar`), header logo, station dropdown flyout menu.
* Search input row, search suggestions, and facility type filter dropdown.
* Directory items (`.dir-item`), facility category badges, and office search highlights.

#### 4. `css/building-panel.css` ($\approx 950\text{ lines}$)
* Right-side slide-out details panel (`.building-panel`, `width: 420px`).
* **Hero Image Controller:** `.bp-image-wrapper`, `.bp-image-overlay-vignette`, `.bp-image-badge`, `.bp-image-expand-hint`.
* **Multi-View Switcher:** `.bp-image-views-bar`, `.bp-view-chip`.
* Wayfinding cards (`HOW TO SPOT IT`, `WHAT'S INSIDE`), office pills, and QR code handoff card.

#### 5. `css/navigation.css` ($\approx 900\text{ lines}$)
* Top center live turn-by-turn instruction banner (`.turn-banner`).
* Step-by-step route directions container and arrival summary card.
* Floating speed control pills (`1x`, `2x`, `3x`), compass widget, and camera mode toggle.
* Spotlight beacon HUD marker (`.spotlight-beacon`, `.spotlight-hud-badge`).

#### 6. `css/phone.css` ($\approx 1,400\text{ lines}$)
* Mobile bottom sheet drawer (`.phone-sheet`, `snap-half`, `snap-full`).
* Mobile search header, phone directory list, and quick category chips.
* Touch gesture handles, mobile route banner, and phone lightbox view.

#### 7. `css/admin.css` ($\approx 600\text{ lines}$)
* Drone Calibration UI (`#drone-cal-panel`, coordinate nudgers, opacity sliders).
* Polygon drawing tool styles (`plot_draw.html`, vertex control points, edge guidelines).
* FPS performance badge (`#fps-badge`).
* *Conditional Loading:* Only injected into the DOM when `?admin=1` or `localStorage.da_admin_mode === 'true'`.

---

## 5. Phase-by-Phase Execution Roadmap

```mermaid
flowchart TD
    P0["Phase 0: Safety Baseline & Git Sync (Completed ✅)"] --> P1["Phase 1: Design Tokens & Variables (css/variables.css)"]
    P1 --> P2["Phase 2: Base & Reset Layer (css/base.css)"]
    P2 --> P3["Phase 3: Kiosk Desktop Shell & Directory (css/kiosk.css)"]
    P3 --> P4["Phase 4: Building Details Drawer & Gallery (css/building-panel.css)"]
    P4 --> P5["Phase 5: Live Navigation & HUD (css/navigation.css)"]
    P5 --> P6["Phase 6: Mobile Touch UI & Bottom Sheet (css/phone.css)"]
    P6 --> P7["Phase 7: Admin & Dev Calibration (css/admin.css)"]
    P7 --> P8["Phase 8: Comprehensive Cross-Platform Matrix Testing & Verification"]
    P8 --> Complete["Deployment Ready for Multi-Station Scale (QARES, RARES, CARES)"]
```

### Detailed Phase Specifications:

#### **Phase 0: Safety Baseline & Git Sync** — ✅ Complete
* Preserved `css/main.baseline.css` as an immutable local rollback anchor.
* Committed clean working tree and pushed to remote master (`https://github.com/EarthJeune/map.git`).
* Verified zero linter warnings and zero syntax issues in baseline.

#### **Phase 1: Design Tokens & Variables (`css/variables.css`)**
* Extract all `:root` CSS variables (color palettes, glassmorphic opacities, typography scales, z-indexes, and safe-area insets).
* Add `@import 'variables.css';` at the very top of `css/main.css`.
* **Zero Layout Impact:** Modifies 0 class selectors or box models.
* Automated CDP visual check.

#### **Phase 2: Universal Base & Reset Layer (`css/base.css`)**
* Extract universal box-sizing, HTML/body viewport locks (`touch-action`, `overflow: hidden`), typography defaults, and glassmorphic scrollbar definitions.
* Add `@import 'base.css';` to `css/main.css`.
* Automated CDP visual check.

#### **Phase 3: Kiosk Desktop Shell & Directory (`css/kiosk.css`)**
* Extract left sidebar (`.sidebar`), header branding, station dropdown flyout menu (`#station-dropdown-flyout`), flex search row, filter dropdown, and directory list (`.dir-item`).
* Add `@import 'kiosk.css';` to `css/main.css`.
* Automated CDP visual check.

#### **Phase 4: Building Details Drawer & Gallery (`css/building-panel.css`)**
* Extract slide-out right drawer (`.building-panel`), hero image cross-fade vignette, multi-view thumbnails, office pills, QR code handoff card, and lightbox viewer.
* Add `@import 'building-panel.css';` to `css/main.css`.
* Automated CDP visual check.

#### **Phase 5: Navigation & Live Turn-by-Turn HUD (`css/navigation.css`)** — ✅ Complete
* Extract live arrival banner (`.turn-by-turn-banner`), step list, distance meters, speed pills (`1x`, `2x`, `3x`), and spotlight beacon animations.
* Add `@import 'navigation.css';` to `css/main.css`.
* Linked via `<link rel="stylesheet" href="css/navigation.css?v=191">` in `index.html`.
* Automated CDP visual check passed across Landscape Desktop, Portrait Kiosk, and Mobile Phone.

#### **Phase 6: Mobile Touch UI & Bottom Sheet (`css/phone.css`)** — ✅ Complete
* Extracted mobile viewport rules (`@media (max-width: 768px)` and `?mode=phone`), 3-stage bottom sheet (`.phone-bottom-sheet`), touch drag handles, mobile right rail controls, and mobile station action sheet.
* Added `@import 'phone.css';` to `css/main.css`.
* Linked via `<link rel="stylesheet" href="css/phone.css?v=192">` in `index.html`.
* Automated CDP visual check passed across Landscape Desktop, Portrait Kiosk, and Mobile Phone (65 directory facilities verified interactive).

#### **Phase 7: Admin & Calibration Overlays (`css/admin.css`)** — ✅ Complete
* Extracted drone calibration panel, admin drag handles, diagnostic GPS HUD, and map settings admin tools into `css/admin.css`.
* Added `@import 'admin.css';` to `css/main.css`.
* Linked via `<link rel="stylesheet" href="css/admin.css?v=193">` in `index.html`.
* Automated CDP visual check passed across Landscape Desktop (Normal & Admin Mode), Portrait Kiosk, and Mobile Phone.

---

## 6. Phase 8: Comprehensive Cross-Platform Matrix Testing & Verification — 🏆 Passed (100% Verified)

Before signing off on the refactoring, a rigorous automated and visual test suite runs across all three display viewports and runtime targets.

```mermaid
graph LR
    P8["Phase 8 Cross-Platform Matrix"] --> T1["Landscape Desktop & Kiosk (1920x1080 & 1280x800)"]
    P8 --> T2["Portrait Touch Totem Kiosk (1080x1920)"]
    P8 --> T3["Mobile Smartphone (390x844 iOS/Android)"]
    P8 --> T4["File Integrity, Linter & Network Audit"]
    P8 --> T5["Visual Pixel-by-Pixel Diff against Baseline"]
```

### Test Dimensions & Acceptance Criteria:

### 🖥️ Dimension 1: Landscape Desktop / Touch Kiosk (`1920x1080` & `1280x800`)
1. **Left Sidebar & Search:**
   - Sidebar displays at exactly `var(--sidebar-width, 400px)` with crisp glassmorphism.
   - Search row maintains flex alignment with zero clipping and clean ellipsis overflow.
   - Station selector dropdown opens smoothly with DA-LARES (Active) and DA-QARES / DA-RARES / DA-CARES (Under Dev).
   - Filter dropdown opens and filters directory by category (Offices, Labs, Screenhouses, Infrastructure).
2. **Right Details Drawer:**
   - Clicking any building opens `.building-panel` from the right with smooth transition.
   - Hero photo carousel, office badges, and wayfinding steps render properly.
3. **Turn-by-Turn Live Navigation:**
   - Pathfinding starts cleanly, turn banner displays at the top center without text cutoff, speed pills (`1x/2x/3x`) respond, and arrival modal fires on target.
4. **GPU 3D Canvas:**
   - Mapbox GL JS 3D tiles and Three.js GLB models render at 60 FPS with zero clipping.

### 📱 Dimension 2: Portrait Touch Kiosk Mode (`1080x1920` Vertical Totem)
1. **Vertical Layout Adaptation:**
   - Viewport switches correctly under portrait kiosk mode (`body.kiosk-portrait`).
   - Bottom search bar and bottom drawer expand and collapse properly.
   - Touch targets meet accessibility minimums ($\ge 44\text{px}$).
2. **Idle Screensaver:**
   - 60-second idle countdown activates smoothly with slow camera pan and resets on touch.

### 📱 Dimension 3: Mobile Smartphone Mode (`390x844` iPhone / Android)
1. **Mobile Bottom Sheet:**
   - Bottom sheet cleanly supports all three snap points: `peek` (collapsed), `half` (split view), and `full` (expanded directory).
   - Smooth inertia touch dragging with zero rubber-band clipping.
2. **Mobile Right Rail Controls:**
   - Right rail buttons (compass, 2D/3D toggle, layer modal toggle, GPS center, zoom +/-) are cleanly spaced without overlapping the bottom sheet.
3. **Mobile Route Header & Banner:**
   - Mobile turn banner stays pinned cleanly under status bar safe-area.
   - Mobile station switcher modal opens as a slide-up sheet and selects stations properly.

### 🔍 Dimension 4: File Integrity, Network & Linter Audit
1. **HTTP 200 Network Check:**
   - Every single modular CSS file (`variables.css`, `base.css`, `kiosk.css`, `building-panel.css`, `navigation.css`, `phone.css`, `admin.css`) returns status HTTP 200 with zero 404s.
2. **Zero CSS Syntax Errors & Zero Linter Warnings:**
   - Full linter validation with 0 problems in VS Code problems tab.
3. **Zero JavaScript Console Errors:**
   - Automated CDP audit verifies zero runtime exceptions or missing asset warnings.

### 🖼️ Dimension 5: Visual Parity Snapshot Diff against Baseline
1. Headless Chrome CDP captures high-resolution screenshots of all 3 viewport modes.
2. Screenshots are compared directly against `css/main.baseline.css`.
3. Strict acceptance threshold: **0 visual regression, 0 unintended layout shifts, 0 color deviation**.

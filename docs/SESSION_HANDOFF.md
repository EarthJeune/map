# Session Handoff — DA-LARES / DA-QARES Interactive Map

> **Read this first in a new chat**, together with [AGENTS.md](../AGENTS.md) (master project rules + 3D building status matrix).
> Last updated: **2026-10-24**

---

## 1. How to resume in a new conversation

Paste this into the new chat:

```
Read AGENTS.md and docs/SESSION_HANDOFF.md in c:\Users\LGU-SanPedro\Downloads\map
before doing anything. Continue from "Open items" in SESSION_HANDOFF.md.
```

Runtime:
- Start the local server: `node server.js` → `http://localhost:8080/`
- Kiosk: `start_kiosk.bat` / `start_kiosk_silent.vbs`; admin: `start_admin.bat`
- Blender MCP (3D modeling) listens on TCP `127.0.0.1:9876`

---

## 2. Project rules that apply to this work (summary — AGENTS.md is the source of truth)

| # | Rule |
|---|------|
| 1 | Model / register / verify **one building at a time** |
| 2 | Every `models/*.glb` must be **< 300 KB** |
| 3 | **No autonomous browser subagent** unless the user explicitly asks (headless Edge CDP scripts in `scratch/` are used for verification instead) |
| 4 | No outdoor props (lawns, roads, trees, vehicles, lamps) in building models |
| 5 | Main entrance faces the `roads.json` entrance node for that `buildingId` |
| 6 | Never invent offices; only the 7 listed buildings have entries in `js/data/offices.js` |
| 7 | **Category filter chips are QARES-only.** Never show them in the LARES directory |

---

## 3. Multi-station architecture (LARES + QARES)

| Station | Data files | Drawing tools |
|---|---|---|
| **DA-LARES** (Lipa) | `buildings.json`, `roads.json`, `trees.json`, `js/data/buildings.js` | `draw.html`, `road_draw.html`, `plot_draw.html` |
| **DA-QARES** (Tiaong, Quezon) | `qares_buildings.json`, `qares_roads.json`, `qares_boundary.json`, `qares_pin.json`, `qares_ortho.png`, `QARES v1.mbtiles` | `qares_draw.html`, `qares_road_draw.html` (also QARES mode inside `draw.html`) |

- Station registry: [js/data/stations.js](../js/data/stations.js)
- Switching / QARES layers / directory / category filter: [js/stations.js](../js/stations.js)
- Save endpoints with timestamped backups (`archive/backups/`): `/api/qares/buildings`, `/api/qares/roads` in [server.js](../server.js)
- QARES center: `[121.37178, 13.94658]`

### QARES data snapshot (2026-10-24)
`qares_buildings.json` = **63 features**

| Category | Count | Colors in use |
|---|---|---|
| Buildings | 48 | red 22, blue 13, yellow 7, light_grey 4, green 1, pink 1 |
| Misc Buildings | 15 | red 10, yellow 3, brown 2 |
| Utilities | 0 | — |

---

## 4. Work completed in this session

### 4.1 QARES buildings invisible in Mapbox Standard mode — FIXED
**Symptom:** In QARES with `mapbox://styles/mapbox/standard`, sidebar listed 48 buildings but no extrusions were drawn.

**Root causes**
1. Custom layers had no `slot`. Mapbox Standard needs `slot: 'middle'` for extrusions/vectors and `slot: 'bottom'` for ground rasters, plus `fill-extrusion-emissive-strength` or extrusions render black/omitted.
2. In `loadQARESData()`, `addLayer` was inside the `else` of `if (!map.getSource(...))`. After `setStyle()` wiped layers while a source existed (or was being re-added), the layers were never recreated.
3. Every style switch re-fetched `qares_buildings.json` → blank lag.
4. `toggleBuildings()` ignored QARES layers.
5. `#phone-arrived-modal` and `#phone-top-nav-hud` could leak onto desktop/kiosk.

**Fixes**
- [js/stations.js](../js/stations.js)
  - `qares-footprints-3d` / `qares-footprints-roofs`: `slot: 'middle'`, `fill-extrusion-emissive-strength: 0.35`, `fill-extrusion-cast-shadows: false`
  - `qares-boundary-fill` / `qares-boundary-line`: `slot: 'middle'`; `qares-ortho-layer`: `slot: 'bottom'`
  - Source creation and layer creation decoupled (`applyQARESFootprints`) — layers are always re-added if missing
  - In-memory cache `qaresBuildingsBaseline` → instant rebuild on style switch
  - Click/hover handlers consolidated in `bindQARESBuildingEvents()` (no duplicate listeners)
- [js/map-setup.js](../js/map-setup.js): `toggleBuildings()` includes QARES layers; `window.revealMap = revealMap`
- [index.html](../index.html): `style="display:none"` on `#phone-arrived-modal`, `#phone-top-nav-hud`
- [js/phone-nav.js](../js/phone-nav.js): sets `display:flex` on show / `none` on close

**Verified** (headless Edge CDP, `scratch/inspect_mapbox_qares.py`): `hasSource/has3d/hasRoofs = true`, both slots `middle`, **54 rendered features**, 0 console errors. Screenshot: `scratch/edge_mapbox_qares.png`.

### 4.2 Blue added to “Misc Buildings” color options — DONE
Files: [qares_draw.html](../qares_draw.html) and [draw.html](../draw.html)

```js
const FILTER_COLOR_SETS = {
    'Buildings':      ['red', 'blue', 'green', 'yellow', 'light_grey', 'pink'],
    'Misc Buildings': ['red', 'blue', 'yellow', 'brown'],   // blue added
    'Utilities':      ['yellow', 'brown']
};
```
- Swatch grid and modal palette now use a **2×2 layout** when a category has 4 colors (`length === 2 || length === 4` → `repeat(2, 1fr)`).
- `onCategoryChanged` (qares_draw.html) / `onQaresCategoryChanged` (draw.html) now **re-render the modal palette** for the chosen category, so the options match the category.
- Blue = wall `#3b82f6`, roof `#2563eb`, icon 🔵 (already in `QARES_COLORS`; `js/stations.js` `QARES_COLORS_DEF` already had blue, so the kiosk directory shows it correctly).
- Verified with `scratch/verify_misc_buildings_blue.py` → swatches `Red 10 / Blue 0 / Yellow 3 / Brown 2`. Screenshot: `scratch/qares_draw_misc_blue.png`.

---

## 5. Key technical notes / gotchas

- **Mapbox Standard style:** any custom layer needs `slot` (`bottom` / `middle` / `top`). 3D extrusions also need `fill-extrusion-emissive-strength` (~0.35).
- **`window.map` is shadowed** by the `<div id="map">` element. Use `state.map` from [js/data/state.js](../js/data/state.js) (or `window.state.map`).
- **Style switches remove all custom layers.** Always make layer creation idempotent and separate from source creation.
- **CDP via Python:** use `websockets` (not `websocket-client`, which isn't installed), pass `max_size=10*1024*1024` for screenshots, launch Edge with `--no-first-run --no-default-browser-check`, and choose the tab by URL (Edge may open a sync dialog tab first).
- Color definitions live in **three places** — keep them in sync when adding colors/categories:
  1. `QARES_COLORS` + `FILTER_COLOR_SETS` in `qares_draw.html`
  2. `QARES_COLORS` + `FILTER_COLOR_SETS` in `draw.html`
  3. `QARES_COLORS_DEF` in `js/stations.js` (kiosk directory)
  - The MapboxDraw style expressions in both drawer files also map `user_color_code` → hex (e.g. `brown` → `#451a03`), so check these when adding a new color.

---

## 6. Verification scripts (in `scratch/`)

| Script | Purpose |
|---|---|
| `inspect_mapbox_qares.py` | Headless Edge (port 9223): switch to QARES + Mapbox, report QARES layer slots and rendered count, screenshot |
| `debug_console.py` | Catch runtime console errors |
| `verify_misc_buildings_blue.py` | Headless Edge (port 9225): open `qares_draw.html`, select Misc Buildings, list swatches, screenshot |

---

## 7. Open items / next steps

- [ ] User to test **Mapbox mode in QARES** on the actual kiosk/phone and confirm the buildings appear.
- [ ] User to assign blue to any Misc Buildings in `qares_draw.html`, then **Save Directly to Map** (writes `qares_buildings.json` with a backup).
- [ ] Utilities category has 0 features — waiting for the user to draw them.
- [ ] **MIS-RAFIS Building** is still marked 🔄 *Existing* in the AGENTS.md matrix (it wasn't re-modeled from photos yet). The next 3D modeling target is whatever the user names, **one building at a time**.
- [ ] Nothing has been committed to git — many files show as modified/untracked (`git status`). Commit or back up when the user asks.

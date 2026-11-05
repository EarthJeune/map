import json

squares = json.load(open('scratch/calibrated_21_squares.json'))

squares_json_str = json.dumps(squares, indent=2)

html_template = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>DA-LARES Agricultural Field Plot Calibration — Drone Orthomosaic</title>
<meta name="viewport" content="initial-scale=1,maximum-scale=1">
<link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
<script src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js"></script>
<link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css" type="text/css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #0b1120; color: #f8fafc; font-family: 'Inter', -apple-system, sans-serif; overflow: hidden; }
  #map { position: absolute; top: 0; bottom: 0; width: 100%; }

  .panel { 
      position: absolute; top: 16px; left: 16px; z-index: 10; 
      background: rgba(15, 23, 42, 0.94); 
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 18px; border-radius: 14px; 
      box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 20px rgba(16, 185, 129, 0.2); 
      border: 1px solid rgba(255, 255, 255, 0.12);
      width: 380px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
  }

  .panel-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .panel-icon { font-size: 24px; }
  .panel-title { margin: 0; font-size: 15px; font-weight: 800; color: #10b981; letter-spacing: 0.3px; }
  .panel-sub { font-size: 11px; color: #94a3b8; margin: 2px 0 0 0; }

  .section-label {
      font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #38bdf8; margin: 14px 0 6px 0;
  }

  /* Segmented Layer Switcher */
  .layer-switcher {
      display: flex;
      background: rgba(30, 41, 59, 0.7);
      padding: 3px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      gap: 3px;
      margin-bottom: 10px;
  }
  .layer-btn {
      flex: 1;
      padding: 6px 8px;
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s ease;
  }
  .layer-btn:hover { color: #f8fafc; background: rgba(255,255,255,0.06); }
  .layer-btn.active {
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
  }

  .slider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #cbd5e1;
      margin-bottom: 4px;
  }
  .slider-num { font-family: monospace; color: #38bdf8; font-weight: 700; }
  .range-input {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.12);
      outline: none;
      cursor: pointer;
      accent-color: #10b981;
      margin-bottom: 10px;
  }

  .action-btn {
      width: 100%;
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 6px;
      transition: all 0.2s ease;
  }
  .btn-save {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      font-size: 13px;
      font-weight: 800;
      padding: 11px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
      margin-top: 8px;
  }
  .btn-save:hover { background: #059669; transform: translateY(-1px); }
  .btn-drop { background: linear-gradient(135deg, #38bdf8, #0284c7); color: white; }
  .btn-drop:hover { background: #0284c7; }
  .btn-draw { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
  .btn-draw:hover { background: rgba(56, 189, 248, 0.25); }
  .btn-copy-all { background: linear-gradient(135deg, #0284c7, #0369a1); color: white; font-size: 13px; padding: 11px; }
  .btn-copy-all:hover { background: #0369a1; }
  .btn-copy-sel { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .btn-copy-sel:hover { background: rgba(16, 185, 129, 0.25); }
  .btn-trash { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
  .btn-trash:hover { background: rgba(239, 68, 68, 0.25); }
  .btn-reset { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3); font-size: 11px; padding: 7px; }
  .btn-reset:hover { background: rgba(148, 163, 184, 0.25); color: #f8fafc; }

  .save-status-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #94a3b8;
      margin-top: 4px;
      padding: 0 4px;
  }
  .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
  }

  .coord-box {
      background: #020617;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px;
      font-family: monospace;
      font-size: 10px;
      color: #94a3b8;
      max-height: 120px;
      overflow-y: auto;
      margin-top: 8px;
      white-space: pre-wrap;
      word-break: break-all;
  }

  /* List of placed squares */
  .squares-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 6px;
      max-height: 180px;
      overflow-y: auto;
      padding-right: 4px;
  }
  .square-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 10px;
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 7px;
      font-size: 11px;
      transition: all 0.15s ease;
  }
  .square-item.active {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.14);
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
  }
  .square-name {
      font-weight: 700;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 175px;
  }
  .square-actions {
      display: flex;
      align-items: center;
      gap: 5px;
  }
  .btn-mini {
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 700;
      border-radius: 5px;
      border: none;
      cursor: pointer;
  }
  .btn-mini-select { background: #0284c7; color: white; }
  .btn-mini-select:hover { background: #0369a1; }
  .btn-mini-delete { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .btn-mini-delete:hover { background: #ef4444; color: white; }

  /* Map Floating Label Marker */
  .map-plot-label {
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(8px);
      border: 1.5px solid #10b981;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 10px rgba(16, 185, 129, 0.3);
      cursor: pointer;
      user-select: none;
      transition: all 0.18s ease;
      white-space: nowrap;
      pointer-events: auto;
  }
  .map-plot-label:hover {
      transform: scale(1.08);
      border-color: #38bdf8;
      box-shadow: 0 6px 16px rgba(0,0,0,0.8), 0 0 15px rgba(56, 189, 248, 0.5);
  }

  /* Floating Toast Alert */
  #toast-alert {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-60px);
      background: #059669;
      color: white;
      padding: 10px 22px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(16, 185, 129, 0.5);
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  #toast-alert.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
  }
</style>
</head>
<body>

<div id="map"></div>

<div id="toast-alert">Notification</div>

<div class="panel">
  <div class="panel-header">
    <span class="panel-icon">🌿</span>
    <div>
      <h3 class="panel-title">Field Plot Calibration</h3>
      <p class="panel-sub">21 Calibrated Squares • Auto-Persists on Refresh</p>
    </div>
  </div>

  <div class="section-label">Imagery Base Layer</div>
  <div class="layer-switcher">
    <button class="layer-btn active" id="btn-layer-drone" onclick="setBaseLayer('drone')">
      <span>🚁 10GB Drone Shot</span>
    </button>
    <button class="layer-btn" id="btn-layer-google" onclick="setBaseLayer('google')">
      <span>🛰️ Google Satellite</span>
    </button>
  </div>

  <div class="slider-row">
    <span>Drone Imagery Opacity</span>
    <span id="drone-opacity-val" class="slider-num">100%</span>
  </div>
  <input type="range" id="drone-opacity-slider" class="range-input" min="0" max="1" step="0.05" value="1.0" oninput="setDroneOpacity(this.value)">

  <div class="slider-row" style="margin-top: 6px;">
    <span>Road Lines Guide</span>
    <input type="checkbox" id="toggle-roads-cb" checked onchange="toggleRoadLines(this.checked)" style="cursor:pointer;">
  </div>

  <div class="section-label">1. Choose Commodity / Facility</div>
  <select id="box-zone-select" onchange="onPresetSelectChange(this)" style="width: 100%; padding: 9px; border-radius: 8px; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.3); color: #f8fafc; font-size: 12px; font-weight: 700; margin-bottom: 6px; outline: none;">
    <option value="Citrus Orchard">🍊 Citrus Orchard</option>
    <option value="Corn Research">🌽 Corn Research</option>
    <option value="Mango Orchard">🥭 Mango Orchard</option>
    <option value="Cassava Production">🌿 Cassava Production</option>
    <option value="ATI Corn Trial">🌽 ATI Corn Trial</option>
    <option value="Cassava Germplasm">🌱 Cassava Germplasm</option>
    <option value="Tall Makapuno & Cacao">☕ Tall Makapuno & Cacao</option>
    <option value="Glutinous Flint Corn">🌽 Glutinous Flint Corn</option>
    <option value="Pomelo Orchard">🍈 Pomelo Orchard</option>
    <option value="Vegetable Derby Citrus">🥬 Vegetable Derby Citrus</option>
    <option value="Vegetable Garden">🥬 Vegetable Garden</option>
    <option value="Coffee & Makapuno">☕ Coffee & Makapuno</option>
    <option value="Jackfruit & Fruit Trees">🌳 Jackfruit & Fruit Trees</option>
    <option value="Rice-Soybean Trial">🌾 Rice-Soybean Trial</option>
    <option value="Calamansi Clonal Block">🌱 Calamansi Clonal Block</option>
    <option value="Sprinkler Irrigation">💧 Sprinkler Irrigation</option>
    <option value="Automatic Weather Station (AWS)">📡 Automatic Weather Station (AWS)</option>
    <option value="Water Tower & CR">🗼 Water Tower & CR</option>
    <option value="Field Rest Hut">🛖 Field Rest Hut</option>
    <option value="Greenhouse & Screenhouse">🏡 Greenhouse & Screenhouse</option>
    <option value="Banana & Fruit Nursery">🪴 Banana & Fruit Nursery</option>
    <option value="Organic Agriculture / Vermicompost">🪱 Organic Agriculture / Vermicompost</option>
    <option value="Custom">✏️ Custom Name...</option>
  </select>

  <input type="text" id="box-name-input" value="Citrus Orchard" placeholder="Enter custom name or block..." style="width: 100%; padding: 8px 10px; border-radius: 7px; background: #1e293b; border: 1px solid rgba(255,255,255,0.15); color: #38bdf8; font-size: 12px; font-weight: 700; margin-bottom: 8px; outline: none;">

  <button class="action-btn btn-drop" onclick="dropSquareBox()">
    <span>➕</span> Drop 4-Corner Square on View
  </button>
  <button class="action-btn btn-draw" onclick="startDrawPolygon()">
    <span>✏️</span> Click 4 Points to Draw Manually
  </button>

  <button class="action-btn btn-save" id="btn-manual-save" onclick="manualSaveLayout()">
    <span>💾</span> Save Plotted Layout
  </button>
  <div class="save-status-bar">
    <div class="status-dot"></div>
    <span id="save-status-text">All 21 squares saved • Persists on refresh</span>
  </div>

  <div class="section-label">Plotted Squares (<span id="squares-count">21</span>)</div>
  <div class="squares-list" id="squares-list">
    <div style="font-size: 11px; color: #64748b; padding: 6px 0; text-align: center;">Loading calibrated squares...</div>
  </div>

  <div class="section-label">2. Copy Coordinates to Chat</div>
  <div style="font-size: 11px; color: #94a3b8; line-height: 1.4; margin-bottom: 6px;">
    Click Save anytime or Copy to chat. Drag any corner handle to calibrate directly against drone furrows.
  </div>

  <button class="action-btn btn-copy-all" onclick="copyAllSquaresGeoJSON()">
    <span>📋</span> Copy ALL Plotted Squares
  </button>

  <div style="display: flex; gap: 6px; margin-top: 6px;">
    <button class="action-btn btn-copy-sel" style="margin-top:0;" onclick="copySelectedSquare()">
      <span>📋</span> Copy Selected
    </button>
    <button class="action-btn btn-trash" style="margin-top:0;" onclick="deleteSelectedSquare()">
      <span>🗑️</span> Delete Selected
    </button>
  </div>

  <div style="display: flex; gap: 6px; margin-top: 6px;">
    <button class="action-btn btn-reset" style="margin-top:0;" onclick="resetToBaseline21Squares()">
      <span>🔄 Reset to 21 Calibrated</span>
    </button>
    <button class="action-btn btn-trash" style="margin-top:0; font-size:11px; padding:7px;" onclick="clearAllSquares()">
      <span>⚠️ Clear All</span>
    </button>
  </div>

  <div class="section-label">Raw Export Textarea (Instant Copy)</div>
  <textarea id="raw-export-area" readonly style="width: 100%; height: 110px; background: #020617; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 8px; font-family: monospace; font-size: 10px; color: #38bdf8; resize: vertical; outline: none;" onclick="this.select()"></textarea>

  <div class="section-label">Active Coordinates Preview</div>
  <div class="coord-box" id="coord-display">Select any square to inspect coordinates...</div>
</div>

<script>
mapboxgl.accessToken = 'pk.eyJ1IjoiZWFydGgwMzA3IiwiYSI6ImNtdWFqNTR5czAxNmEyd29lMm42YjZlMDkifQ.xdPOP5RVPdn6YNka-ZdwoQ';

// Storage Key for persistent localStorage calibration (bumped to v6 for 21 squares)
const STORAGE_KEY = 'lares_calibrated_plots_v6';
['lares_calibrated_plots', 'lares_calibrated_plots_v1', 'lares_calibrated_plots_v2', 'lares_calibrated_plots_v3', 'lares_calibrated_plots_v4', 'lares_calibrated_plots_v5'].forEach(k => {
    try { localStorage.removeItem(k); } catch(e){}
});

// 21 Baseline Ground-Truth Calibrated Squares Provided by User
const DEFAULT_CALIBRATED_SQUARES = ''' + squares_json_str + ''';

const map = new mapboxgl.Map({
    container: 'map',
    style: {
        'version': 8,
        'glyphs': 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        'sources': {
            'google-satellite': {
                'type': 'raster',
                'tiles': ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                'tileSize': 256,
                'maxzoom': 22
            },
            'lares-drone-source': {
                'type': 'raster',
                'tiles': ['/api/tiles/{z}/{x}/{y}.png'],
                'tileSize': 256,
                'minzoom': 14,
                'maxzoom': 24,
                'bounds': [121.165052, 13.956537, 121.173221, 13.963068]
            }
        },
        'layers': [
            {
                'id': 'google-satellite-layer',
                'type': 'raster',
                'source': 'google-satellite'
            },
            {
                'id': 'lares-drone-layer',
                'type': 'raster',
                'source': 'lares-drone-source',
                'paint': {
                    'raster-opacity': 1.0,
                    'raster-fade-duration': 0
                }
            }
        ]
    },
    // Center dynamically on the 21 calibrated fields
    center: [121.1698, 13.9599],
    zoom: 17.2,
    pitch: 0,
    bearing: 0
});

window.map = map;

// Initialize Mapbox Draw
const draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
        polygon: true,
        trash: true
    },
    defaultMode: 'simple_select'
});
map.addControl(draw, 'top-right');
window.draw = draw;

// Metadata map: featureId -> { name }
const featureMeta = {};
// HTML Markers for on-map labels: featureId -> mapboxgl.Marker
const mapMarkers = {};

function showToast(msg, bg) {
    const toast = document.getElementById('toast-alert');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = bg || '#059669';
    toast.classList.add('show');
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// Centroid calculator (robust against 2D rings or nested arrays)
function getCentroid(ring) {
    if (!ring) return [121.1702, 13.9610];
    if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
        ring = ring[0];
    }
    if (typeof ring[0] === 'number') {
        return [ring[0], ring[1]];
    }
    let sumLng = 0, sumLat = 0, count = 0;
    const pts = (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
        ? ring.slice(0, -1)
        : ring;
    for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])) {
            sumLng += pt[0];
            sumLat += pt[1];
            count++;
        }
    }
    return count > 0 ? [sumLng / count, sumLat / count] : [121.1702, 13.9610];
}

// Helper to extract a 2D linear ring from a feature
function getFeatureRing(feat) {
    if (!feat || !feat.geometry || !feat.geometry.coordinates) return [];
    const c = feat.geometry.coordinates;
    if (Array.isArray(c[0]) && Array.isArray(c[0][0])) {
        return c[0];
    }
    return c;
}

// Save state to browser localStorage
function saveSquaresToStorage() {
    const all = draw.getAll();
    if (!all.features) return;
    const squares = all.features.map(feat => {
        const meta = featureMeta[feat.id] || { name: 'Square' };
        const ring = getFeatureRing(feat);
        return {
            id: feat.id,
            name: meta.name,
            corners: {
                topLeft: ring[0] || [0,0],
                topRight: ring[1] || [0,0],
                bottomRight: ring[2] || [0,0],
                bottomLeft: ring[3] || [0,0]
            },
            polygon: ring
        };
    });
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(squares));
        const statusText = document.getElementById('save-status-text');
        if (statusText) statusText.textContent = `All ${squares.length} squares saved • Persists on refresh`;
    } catch(e) {
        console.warn('LocalStorage save error:', e);
    }
}

// Manual Save Button Handler
window.manualSaveLayout = function() {
    saveSquaresToStorage();
    const btn = document.getElementById('btn-manual-save');
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> Saved Successfully!';
        btn.style.background = '#059669';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.background = '';
        }, 2000);
    }
    const all = draw.getAll();
    const count = (all && all.features) ? all.features.length : 0;
    showToast(`💾 Saved ${count} squares to browser storage!`, '#059669');
};

// Refresh UI, list, markers, and export textarea
function syncPlottedSquares() {
    try {
        const all = draw.getAll();
        const countEl = document.getElementById('squares-count');
        const listEl = document.getElementById('squares-list');
        const selectedIds = draw.getSelectedIds();
        const activeSelectedId = selectedIds.length > 0 ? selectedIds[0] : null;

        if (!all.features || all.features.length === 0) {
            countEl.textContent = '0';
            listEl.innerHTML = '<div style="font-size: 11px; color: #64748b; padding: 6px 0; text-align: center;">No squares placed yet. Drop one above!</div>';
            document.getElementById('coord-display').textContent = 'Drop or select a square to see coordinates...';
            document.getElementById('raw-export-area').value = '';
            Object.keys(mapMarkers).forEach(id => {
                mapMarkers[id].remove();
                delete mapMarkers[id];
            });
            saveSquaresToStorage();
            return;
        }

        countEl.textContent = all.features.length;

        const presentIds = new Set();
        let listHtml = '';
        const exportedBlocks = [];

        all.features.forEach((feat, idx) => {
            const id = feat.id;
            presentIds.add(id);

            const meta = featureMeta[id] || { name: `Square #${idx + 1}` };
            const ring = getFeatureRing(feat);
            const isSel = (id === activeSelectedId);

            listHtml += `
                <div class="square-item ${isSel ? 'active' : ''}">
                    <div class="square-name" title="${meta.name}">
                        ${isSel ? '👉 ' : ''}${meta.name}
                    </div>
                    <div class="square-actions">
                        <button class="btn-mini btn-mini-select" onclick="selectSquare('${id}')">Edit</button>
                        <button class="btn-mini btn-mini-delete" onclick="deleteSpecificSquare('${id}')">✕</button>
                    </div>
                </div>
            `;

            // Update on-map label marker
            const centroid = getCentroid(ring);
            if (!isNaN(centroid[0]) && !isNaN(centroid[1])) {
                if (mapMarkers[id]) {
                    mapMarkers[id].setLngLat(centroid);
                    const el = mapMarkers[id].getElement();
                    if (el) el.textContent = meta.name;
                } else {
                    const el = document.createElement('div');
                    el.className = 'map-plot-label';
                    el.textContent = meta.name;
                    el.onclick = () => selectSquare(id);

                    const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
                        .setLngLat(centroid)
                        .addTo(map);
                    mapMarkers[id] = marker;
                }
            }

            exportedBlocks.push({
                name: meta.name,
                corners: {
                    topLeft: ring[0] || [0,0],
                    topRight: ring[1] || [0,0],
                    bottomRight: ring[2] || [0,0],
                    bottomLeft: ring[3] || [0,0]
                },
                polygon: ring
            });
        });

        listEl.innerHTML = listHtml;

        // Remove deleted markers
        Object.keys(mapMarkers).forEach(id => {
            if (!presentIds.has(id)) {
                mapMarkers[id].remove();
                delete mapMarkers[id];
            }
        });

        // Update active coordinates display
        const coordBox = document.getElementById('coord-display');
        if (activeSelectedId) {
            const selFeat = all.features.find(f => f.id === activeSelectedId);
            if (selFeat) {
                const meta = featureMeta[activeSelectedId] || { name: 'Selected Square' };
                const ring = getFeatureRing(selFeat);
                coordBox.textContent = '[Selected: ' + meta.name + ']\\n' + JSON.stringify(ring, null, 2);
            }
        } else {
            const summary = all.features.map(f => {
                const meta = featureMeta[f.id] || { name: 'Square' };
                const ring = getFeatureRing(f);
                return `${meta.name}: ${ring.length - 1} vertices`;
            }).join('\\n');
            coordBox.textContent = 'Total ' + all.features.length + ' Squares:\\n' + summary;
        }

        // Update Raw Export Area
        const formattedBlocks = exportedBlocks.map(b => JSON.stringify(b, null, 2)).join('\\n\\n');
        const rawArea = document.getElementById('raw-export-area');
        if (rawArea) {
            rawArea.value = formattedBlocks;
        }

        // Persist automatically to localStorage
        saveSquaresToStorage();
    } catch (err) {
        console.error('syncPlottedSquares error:', err);
    }
}

// Load squares on page load (from localStorage or baseline)
function loadSquaresState(forceBaseline = false) {
    let squaresToLoad = null;
    if (!forceBaseline) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    squaresToLoad = parsed;
                }
            }
        } catch (e) {
            console.warn('Storage read error:', e);
        }
    }

    if (!squaresToLoad || squaresToLoad.length === 0) {
        squaresToLoad = DEFAULT_CALIBRATED_SQUARES;
    }

    draw.deleteAll();
    Object.keys(featureMeta).forEach(k => delete featureMeta[k]);

    squaresToLoad.forEach((sq, idx) => {
        const fid = 'field_' + (sq.id || (Date.now() + '_' + idx));
        featureMeta[fid] = { name: sq.name };

        // Normalize ring to a clean array of points
        let ring = sq.polygon;
        if (!ring && sq.corners) {
            ring = [
                sq.corners.topLeft,
                sq.corners.topRight,
                sq.corners.bottomRight,
                sq.corners.bottomLeft,
                sq.corners.topLeft
            ];
        }
        if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
            ring = ring[0];
        }
        // Ensure closed ring
        if (ring.length >= 4) {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                ring.push([first[0], first[1]]);
            }
        }

        draw.add({
            type: 'Feature',
            id: fid,
            properties: { name: sq.name },
            geometry: {
                type: 'Polygon',
                coordinates: [ring]
            }
        });
    });

    syncPlottedSquares();
    console.log(`[PlotDrawer] Successfully loaded ${squaresToLoad.length} squares.`);
}

map.on('load', async () => {
    // Road Network Lines
    try {
        const roadsRes = await fetch('./roads.json');
        const roadsData = await roadsRes.json();
        map.addSource('roads-source', { type: 'geojson', data: roadsData });
        map.addLayer({
            id: 'roads-casing',
            type: 'line',
            source: 'roads-source',
            paint: { 'line-color': '#020617', 'line-width': 4.0, 'line-opacity': 0.7 }
        });
        map.addLayer({
            id: 'roads-line',
            type: 'line',
            source: 'roads-source',
            paint: { 'line-color': '#38bdf8', 'line-width': 2.0, 'line-opacity': 0.85 }
        });
    } catch(e) { console.warn('Roads load error:', e); }

    // Load saved or baseline squares
    loadSquaresState();
});

// Update name input when preset dropdown changes
window.onPresetSelectChange = function(sel) {
    const input = document.getElementById('box-name-input');
    if (sel.value === 'Custom') {
        input.value = '';
        input.focus();
    } else {
        input.value = sel.value;
    }
};

map.on('draw.create', (e) => {
    if (e.features && e.features.length > 0) {
        const feat = e.features[0];
        if (!featureMeta[feat.id]) {
            const nameInput = document.getElementById('box-name-input');
            const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Plotted Field';
            featureMeta[feat.id] = { name: name };
        }
    }
    syncPlottedSquares();
});
map.on('draw.update', syncPlottedSquares);
map.on('draw.delete', syncPlottedSquares);
map.on('draw.selectionchange', syncPlottedSquares);

// Drop a new 4-corner square onto the screen
window.dropSquareBox = function() {
    const nameInput = document.getElementById('box-name-input');
    const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Plotted Square';
    
    const center = map.getCenter();
    const dLng = 0.00035;
    const dLat = 0.00020;

    const all = draw.getAll();
    const offsetCount = (all.features ? all.features.length : 0);
    const offsetX = (offsetCount % 3 - 1) * 0.0001;
    const offsetY = (Math.floor(offsetCount / 3) % 3 - 1) * 0.0001;

    const featureId = 'field_' + Date.now();
    featureMeta[featureId] = { name: name };

    const ids = draw.add({
        type: 'Feature',
        id: featureId,
        properties: { name: name },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [center.lng - dLng + offsetX, center.lat + dLat + offsetY],
                [center.lng + dLng + offsetX, center.lat + dLat + offsetY],
                [center.lng + dLng + offsetX, center.lat - dLat + offsetY],
                [center.lng - dLng + offsetX, center.lat - dLat + offsetY],
                [center.lng - dLng + offsetX, center.lat + dLat + offsetY]
            ]]
        }
    });

    if (ids && ids.length > 0) {
        draw.changeMode('direct_select', { featureId: ids[0] });
    }
    syncPlottedSquares();
    showToast(`➕ Placed new square: ${name}`, '#0284c7');
};

window.startDrawPolygon = function() {
    draw.changeMode('draw_polygon');
    showToast('✏️ Click 4 points on the map to draw polygon', '#0284c7');
};

window.selectSquare = function(id) {
    draw.changeMode('direct_select', { featureId: id });
    const all = draw.getAll();
    const feat = all.features.find(f => f.id === id);
    if (feat) {
        const ring = getFeatureRing(feat);
        const centroid = getCentroid(ring);
        map.panTo(centroid, { duration: 400 });
    }
    syncPlottedSquares();
};

window.deleteSpecificSquare = function(id) {
    draw.delete(id);
    delete featureMeta[id];
    if (mapMarkers[id]) {
        mapMarkers[id].remove();
        delete mapMarkers[id];
    }
    syncPlottedSquares();
    showToast('🗑️ Square deleted', '#ef4444');
};

window.deleteSelectedSquare = function() {
    draw.trash();
    syncPlottedSquares();
    showToast('🗑️ Selected square removed', '#ef4444');
};

window.clearAllSquares = function() {
    if (confirm('Clear all plotted squares from canvas?')) {
        draw.deleteAll();
        Object.keys(featureMeta).forEach(k => delete featureMeta[k]);
        Object.keys(mapMarkers).forEach(k => {
            mapMarkers[k].remove();
            delete mapMarkers[k];
        });
        syncPlottedSquares();
        showToast('⚠️ All squares cleared', '#ef4444');
    }
};

window.resetToBaseline21Squares = function() {
    if (confirm('Reset canvas back to the 21 calibrated ground-truth squares?')) {
        localStorage.removeItem(STORAGE_KEY);
        loadSquaresState(true);
        showToast('🔄 Restored 21 calibrated baseline squares', '#10b981');
    }
};

// Bulletproof Copy to Clipboard
function copyTextSafely(text) {
    let success = false;
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
    } catch (e) {
        console.warn('execCommand copy failed:', e);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
    }
    return success;
}

// Copy ALL Plotted Squares
window.copyAllSquaresGeoJSON = function() {
    const data = draw.getAll();
    if (!data.features || data.features.length === 0) {
        showToast('⚠️ No squares to copy', '#ef4444');
        return;
    }

    const exportedBlocks = data.features.map(feat => {
        const meta = featureMeta[feat.id] || { name: 'Field' };
        const ring = getFeatureRing(feat);
        return {
            name: meta.name,
            corners: {
                topLeft: ring[0] || [0,0],
                topRight: ring[1] || [0,0],
                bottomRight: ring[2] || [0,0],
                bottomLeft: ring[3] || [0,0]
            },
            polygon: ring
        };
    });

    const formattedBlocks = exportedBlocks.map(b => JSON.stringify(b, null, 2)).join('\\\\n\\\\n');
    
    // Update raw textarea
    const rawArea = document.getElementById('raw-export-area');
    if (rawArea) {
        rawArea.value = formattedBlocks;
        rawArea.select();
    }

    copyTextSafely(formattedBlocks);
    showToast(`✅ Copied ALL ${exportedBlocks.length} Plotted Squares to Clipboard!`, '#059669');
};

// Copy Selected Square
window.copySelectedSquare = function() {
    const selectedIds = draw.getSelectedIds();
    if (selectedIds.length === 0) {
        showToast('⚠️ Click on a square first to select it', '#f59e0b');
        return;
    }
    const id = selectedIds[0];
    const all = draw.getAll();
    const feat = all.features.find(f => f.id === id);
    if (!feat) return;

    const meta = featureMeta[id] || { name: 'Plotted Square' };
    const ring = getFeatureRing(feat);
    const block = {
        name: meta.name,
        corners: {
            topLeft: ring[0] || [0,0],
            topRight: ring[1] || [0,0],
            bottomRight: ring[2] || [0,0],
            bottomLeft: ring[3] || [0,0]
        },
        polygon: ring
    };

    const formatted = JSON.stringify(block, null, 2);
    const rawArea = document.getElementById('raw-export-area');
    if (rawArea) {
        rawArea.value = formatted;
        rawArea.select();
    }

    copyTextSafely(formatted);
    showToast(`✅ Copied "${meta.name}" to Clipboard!`, '#059669');
};

// Base Layer Controls
window.setBaseLayer = function(mode) {
    const isDrone = (mode === 'drone');
    document.getElementById('btn-layer-drone').classList.toggle('active', isDrone);
    document.getElementById('btn-layer-google').classList.toggle('active', !isDrone);
    if (map.getLayer('lares-drone-layer')) {
        map.setLayoutProperty('lares-drone-layer', 'visibility', isDrone ? 'visible' : 'none');
    }
};

window.setDroneOpacity = function(val) {
    const opacity = parseFloat(val);
    document.getElementById('drone-opacity-val').textContent = `${Math.round(opacity * 100)}%`;
    if (map.getLayer('lares-drone-layer')) {
        map.setPaintProperty('lares-drone-layer', 'raster-opacity', opacity);
    }
};

window.toggleRoadLines = function(show) {
    const vis = show ? 'visible' : 'none';
    if (map.getLayer('roads-casing')) map.setLayoutProperty('roads-casing', 'visibility', vis);
    if (map.getLayer('roads-line')) map.setLayoutProperty('roads-line', 'visibility', vis);
};
</script>

</body>
</html>
'''

with open('plot_draw.html', 'w', encoding='utf-8') as f:
    f.write(html_template)

print("Successfully written plot_draw.html with 21 squares and Save Button!")

# Campus 3D Building Modeling Pipeline

- [x] Phase 1: Interactive Kiosk & Map Foundation
- [x] Phase 2: Occlusion Filter Fix (`BASE_NO_3D_MODEL_FILTER` in `js/occlusion.js`)
- [x] Phase 3: "You Are Here" Kiosk Pin Alignment (`[121.16656995, 13.95810799]` inside Argosino Hall)
- [x] Tanco Hall Building (3D Model, $208\text{ KB}$, `models/tanco_hall_building.glb`, Integrated)
- [x] Argosino Hall (3D Model, $190\text{ KB}$, `models/argosino_hall.glb`, Far-Right Canopy, Veranda Kiosk Lounge, Integrated)
- [x] D.A. Canteen (3D Model, $101.3\text{ KB}$, `models/canteen.glb`, Hipped Roof, Signboard, Integrated)
- [x] RAED Building (3D Model, $141.1\text{ KB}$, `models/raed_building.glb`, Porte-Cochere Canopy, Signboard, Integrated)
- [x] Guard House (3D Model, $170.0\text{ KB}$, `models/guard_house.glb`, Porch & Desk, Shading Tree, Gate, Integrated)
- [x] AMAD Building (3D Model, $205.1\text{ KB}$, `models/amad_building.glb`, Mirrored Glass Curtain Walls, Stone Piers, 3D Text Sign, Integrated)
- [x] PGRC Building (3D Model, $269.4\text{ KB}$, `models/pgrc_building.glb`, Cantilevered Canopy, 3D Typography, Louvered Clerestory, Integrated)
- [ ] PDRP Building (`prdp_building` - Queued Next)
- [ ] LARES Building (`lares_building` - Queued)
- [ ] Admin Building (`admin_building` - Queued)
- [ ] ORED Building (`ored_building` - Queued)
- [ ] Post Harvest Laboratory Building (`laboratory_building` - Queued)

---

# Agricultural Research Plots Master Plan (45 Calibrated Plots) — [ON HOLD]
*Status: Kept on hold and fully documented in markdown. All 45 calibrated plots, coordinates, master zones, and phase specs are preserved in [agricultural_plots_master_plan.md](docs/agricultural_plots_master_plan.md) and [plot_draw.html](plot_draw.html).*

- [x] **Phase 1: Master Delineation & Dynamic Sub-Plot Cuts**
  - [x] True merged outer rectangles (zero middle lines in overview)
  - [x] Dynamic internal cuts layer (`opacity: 0.0` idle, `0.90` on click/selection)
  - [x] Clean pin LOD strategy (zero sky clutter at overview; labels appear on hover/tap/zoom)
  - [x] Updated Plot 1 (Cassava Production) & Plot 44 (Pomelo Orchard) integrated across all datasets
- [ ] **Phase 2: Agricultural Utilities & Infrastructure POIs**
  - [ ] Agro-Meteorological Station (AWS) mast on Plot 8
  - [ ] Elevated Concrete Water Tower & Field Restroom on Plot 22
  - [ ] Bahay Kubo field shelters on Plots 25 and 37
  - [ ] Irrigation manifolds & field taps along Pili & Eucalyptus Drives
- [ ] **Phase 3: Authentic 3D Field Models (Low-Poly GLB < 300 KB)**
  - [ ] `aws_weather_station.glb` (~95 KB)
  - [ ] `water_tower_facility.glb` (~130 KB)
  - [ ] `screenhouse_tunnel.glb` (~120 KB)
  - [ ] Bahay Kubo huts (reusing `exit_guard_house_1.glb`)
- [ ] **Phase 4: Farm Road Network Routing**
  - [ ] Incorporate Pili Drive, Eucalyptus Drive, and Cacao Road into `roads.json`
  - [ ] Turn-by-turn walking route generation from Argosino kiosk to any field plot
- [ ] **Phase 5: Search Directory & Category Filter**
  - [ ] Category toggle: `[ 🏛️ Campus Buildings ]` vs. `[ 🌾 Agricultural Plots ]`
  - [ ] Crop name fuzzy search (Calamansi, Trinitario Cacao, Makapuno, Sweet Sorghum)
- [ ] **Phase 6: Full-Stack Kiosk Performance & Hardware Optimization**
  - [ ] Unified GeoJSON buffers & zero-allocation feature-state updates
  - [ ] DOM marker viewport & frustum virtualization (`display: none` off-screen)
  - [ ] Adaptive MBTiles tile cache throttling (40 tiles on low-end kiosks/mobile)
  - [ ] 60 FPS lock with passive touch handlers and throttled orbit calculations
  - [ ] Three.js memory leak protection & 90s attractor idle reset


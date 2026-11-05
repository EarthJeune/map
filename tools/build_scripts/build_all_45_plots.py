import json

blocks = json.load(open('scratch/parsed_user_blocks.json'))

# Mapping of Plot Number (1..45) to:
# (plot_num, original_block_idx, commodity_name, icon, color, category, description)
# Note: orig_idx is 1-based index from parsed_user_blocks.json

plot_defs = [
    # Plots 1-2: Cassava Production (Northern compound highway frontage)
    (1, 4, "Cassava Production", "🌿", "#f59e0b", "crop",
     "Northern compound cassava field production and varietal maintenance trial along the compound perimeter."),
    (2, 3, "Cassava Production", "🌿", "#f59e0b", "crop",
     "Northern compound cassava field production and root crop evaluation research block."),

    # Plots 3-5: Vegetable Derby Citrus (West to East along NW boundary)
    (3, 21, "Vegetable Derby Citrus", "🥬", "#10b981", "crop",
     "Vegetable crop evaluation and companion citrus field trials along the northwestern compound road."),
    (4, 20, "Vegetable Derby Citrus", "🥬", "#10b981", "crop",
     "High-value vegetable derby varietal test beds with citrus companion intercropping."),
    (5, 19, "Vegetable Derby Citrus", "🥬", "#10b981", "crop",
     "Vegetable competition and citrus scion field research block."),

    # Plots 6-12: Citrus Orchard (West to East along Pili Drive)
    (6, 14, "Citrus Orchard", "🍊", "#f97316", "orchard",
     "Citrus germplasm collection equipped with automated micro-sprinkler irrigation systems."),
    (7, 13, "Citrus Orchard", "🍊", "#f97316", "orchard",
     "Calamansi clonal evaluation and high-density citrus orchard trial."),
    (8, 12, "Citrus Orchard", "🍊", "#f97316", "orchard",
     "Citrus research plot hosting the DA-LARES Agro-Meteorological Station (AWS)."),
    (9, 11, "Citrus Orchard", "🍊", "#f97316", "orchard",
     "Long-term citrus rootstock and scion evaluation block featuring Mandarin and Sweet Orange varieties."),
    (10, 10, "Citrus Orchard", "🍊", "#f97316", "orchard",
     "Citrus fruit fly management and integrated pest management (IPM) evaluation orchard."),
    (11, 9, "Citrus Orchard", "🍊", "#f97316", "orchard",
     "Varietal citrus germplasm collection and horticultural training plot along Pili Drive."),
    (12, 8, "Citrus Orchard", "🍊", "#f97316", "orchard",
     "Citrus orchard research plot with dedicated field irrigation line connection along Pili Drive."),

    # Plots 13-14: Cassava Germplasm (West to East)
    (13, 7, "Cassava Germplasm", "🌱", "#06b6d4", "crop",
     "CALABARZON cassava germplasm conservation bank and accessions collection under CGUARD."),
    (14, 6, "Cassava Germplasm", "🌱", "#06b6d4", "crop",
     "Cassava breeding nursery and rootstock accession evaluation block."),

    # Plot 15: ATI Corn Trial
    (15, 5, "ATI Corn Trial", "🌽", "#eab308", "crop",
     "Agricultural Training Institute (ATI) collaborative corn evaluation and farmer training trial plot."),

    # Plot 16: Mango Orchard (Lower Mango block)
    (16, 2, "Mango Orchard", "🥭", "#10b981", "orchard",
     "Carabao mango germplasm collection and canopy training grove."),

    # Plots 17-19: Screenhouses & Pummelo (West to East)
    (17, 31, "TC Makapuno & Banana Screenhouse", "🏡", "#8b5cf6", "orchard",
     "Climate-controlled screenhouse facility for tissue-culture Makapuno coconut and certified banana plantlet hardening."),
    (18, 32, "Coffee & Citrus Screenhouse", "☕", "#a855f7", "orchard",
     "Protected screenhouse nursery for high-value coffee seedlings and disease-free citrus budwood scions."),
    (19, 33, "Pummelo Orchard", "🍈", "#84cc16", "orchard",
     "Pummelo (Pomelo) varietal research orchard and fruit production block."),

    # Plots 20-22: Coffee Orchard & TC Banana (West to East)
    (20, 30, "Coffee Orchard & TC Banana", "☕", "#a855f7", "orchard",
     "Robusta and Liberica coffee agroforestry orchard intercropped with tissue-culture banana selections."),
    (21, 29, "Coffee Orchard & TC Banana", "☕", "#a855f7", "orchard",
     "Multi-tier coffee agronomic trial and banana clonal evaluation block."),
    (22, 28, "Coffee Orchard & TC Banana", "☕", "#a855f7", "orchard",
     "Coffee production and shade-tolerant root trial block along Eucalyptus Drive."),

    # Plots 23-25: Vegetable Garden (West to East)
    (23, 27, "Vegetable Garden", "🥬", "#22c55e", "crop",
     "Indigenous and organic vegetable trials featuring solanaceous and cucurbit crops."),
    (24, 26, "Vegetable Garden", "🥬", "#22c55e", "crop",
     "Year-round vegetable production beds and IPM technology demonstration plot."),
    (25, 25, "Vegetable Garden", "🥬", "#22c55e", "crop",
     "Certified Good Agricultural Practices (GAP) vegetable garden and field shelter hub."),

    # Plots 26-28: Fruit Trees, Surghum & Citrus (West to East, renamed per user request)
    (26, 24, "Fruit Trees, Surghum & Citrus", "🌳", "#059669", "orchard",
     "Diverse tropical fruit tree collection intercropped with sweet sorghum grain trials and citrus accessions."),
    (27, 23, "Fruit Trees, Surghum & Citrus", "🌳", "#059669", "orchard",
     "Agroforestry demonstration plot featuring sorghum trials and mixed citrus varieties."),
    (28, 22, "Fruit Trees, Surghum & Citrus", "🌳", "#059669", "orchard",
     "Fruit crop germplasm evaluation block combining indigenous fruit trees, sorghum, and citrus."),

    # Plot 29: Tall Makapuno & Cacao
    (29, 15, "Tall Makapuno & Cacao", "🥥", "#6366f1", "orchard",
     "Tall Makapuno coconut palms intercropped with shade-grown Criollo and Trinitario cacao trees."),

    # Plots 30-32: Mango, Banana & Jackfruit (West to East)
    (30, 43, "Mango, Banana & Jackfruit", "🥭", "#10b981", "orchard",
     "Mixed tropical fruit orchard featuring Philippine jackfruit, banana cultivars, and graft mango trees."),
    (31, 44, "Mango, Banana & Jackfruit", "🥭", "#10b981", "orchard",
     "Multi-storey fruit farming demonstration with jackfruit canopy and banana understory."),
    (32, 45, "Mango, Banana & Jackfruit", "🥭", "#10b981", "orchard",
     "Sustainable tropical fruit grove combining jackfruit, mango accessions, and banana clones."),

    # Plots 33-35: Dwarf Makapuno (West to East)
    (33, 42, "Dwarf Makapuno", "🥥", "#6366f1", "orchard",
     "Early-bearing dwarf Makapuno coconut hybrid research and seed production grove."),
    (34, 41, "Dwarf Makapuno", "🥥", "#6366f1", "orchard",
     "Dwarf Makapuno agronomic performance trial and embryo culture propagation block."),
    (35, 40, "Dwarf Makapuno", "🥥", "#6366f1", "orchard",
     "Clonal dwarf Makapuno mother palm evaluation plot with field water tap."),

    # Plot 36: Rice & Soybean
    (36, 37, "Rice & Soybean", "🌾", "#38bdf8", "crop",
     "Grain legume and upland rice rotation trial for sustainable soil fertility management."),

    # Plots 37-38: Bio Prime & Enviro Corn Trial (West to East)
    (37, 39, "Bio Prime & Enviro Corn Trial", "🌽", "#eab308", "crop",
     "Environmental bio-fertilizer compatibility trial and field rest shelter hub along Eucalyptus Drive."),
    (38, 38, "Bio Prime & Enviro Corn Trial", "🌽", "#eab308", "crop",
     "Bio Prime bio-stimulant performance trial on modern hybrid corn varieties."),

    # Plots 39-41: Corn Research (West to East)
    (39, 36, "Corn Research", "🌽", "#eab308", "crop",
     "National Corn Program hybrid yellow corn performance evaluation and regional yield trial block."),
    (40, 35, "Corn Research", "🌽", "#eab308", "crop",
     "Corn nutrient management, fall armyworm resilience, and planting density trial plot."),
    (41, 34, "Corn Research", "🌽", "#eab308", "crop",
     "Open-pollinated variety (OPV) seed increase and grain quality evaluation block."),

    # Plot 42: Tall Makapuno & Cacao
    (42, 16, "Tall Makapuno & Cacao", "🥥", "#6366f1", "orchard",
     "Tall Makapuno coconut germplasm block with intercropped commercial cacao selections."),

    # Plot 43: Glutinous Flint Corn
    (43, 17, "Glutinous Flint Corn", "🌽", "#eab308", "crop",
     "Traditional glutinous white flint corn variety preservation and certified seed multiplication field."),

    # Plot 44: Pomelo Orchard
    (44, 18, "Pomelo Orchard", "🍈", "#84cc16", "orchard",
     "Mature Magallanes and Siamese sweet pomelo orchard and pruning management research block."),

    # Plot 45: Mango Orchard (Mature Upper Orchard)
    (45, 1, "Mango Orchard", "🥭", "#10b981", "orchard",
     "Expansive mature mango orchard canopy in the northeast compound for postharvest and floral induction research.")
]

# Build the 45 zones and calibrated squares
zones = []
calibrated_squares = []

for plot_num, orig_idx, comm_name, icon, color, cat, desc in plot_defs:
    b = blocks[orig_idx - 1]
    poly = b['polygon']
    corners = b['corners']
    
    # Calculate centroid
    pts = poly[:-1] if poly[0] == poly[-1] else poly
    c_lng = sum(p[0] for p in pts) / len(pts)
    c_lat = sum(p[1] for p in pts) / len(pts)
    center = [round(c_lng, 8), round(c_lat, 8)]
    
    full_name = f"Plot {plot_num} - {comm_name}"
    zid = f"plot_{plot_num}"
    
    zone_obj = {
        "id": zid,
        "plotNum": plot_num,
        "name": full_name,
        "commodity": comm_name,
        "plotRange": f"Plot {plot_num}",
        "category": cat,
        "icon": icon,
        "color": color,
        "centerCoords": center,
        "corners": corners,
        "groupPolygon": poly,
        "description": desc,
        "subPlots": []
    }
    zones.append(zone_obj)
    
    square_obj = {
        "name": full_name,
        "corners": corners,
        "polygon": poly
    }
    calibrated_squares.append(square_obj)

print(f"Built {len(zones)} zones and {len(calibrated_squares)} calibrated squares.")

# Save calibrated_45_plots.json
with open('scratch/calibrated_45_plots.json', 'w', encoding='utf-8') as f:
    json.dump(calibrated_squares, f, indent=2)
print("Saved scratch/calibrated_45_plots.json")

# Generate js/data/plots.js
plots_js = '''// DA-LARES Agricultural Field Plot & Commodity Zones Dataset
// Calibrated from ground-truth drone orthomosaic by user (45 Numbered Agricultural Plots)
// Conforming to official DA-LARES Experimental Field Plot Plan (Plots 1 to 45)

export const FIELD_COMMODITY_ZONES = ''' + json.dumps(zones, indent=4) + ''';

// Helper to convert zones into standard GeoJSON FeatureCollection
export function getPlotsGeoJSON() {
    return {
        type: 'FeatureCollection',
        features: FIELD_COMMODITY_ZONES.map(zone => ({
            type: 'Feature',
            id: zone.id,
            properties: {
                id: zone.id,
                plotNum: zone.plotNum,
                name: zone.name,
                commodity: zone.commodity,
                plotRange: zone.plotRange,
                category: zone.category,
                icon: zone.icon,
                color: zone.color,
                description: zone.description
            },
            geometry: {
                type: 'Polygon',
                coordinates: [zone.groupPolygon]
            }
        }))
    };
}

// Helper to convert sub-plot cuts into GeoJSON FeatureCollection (Clean empty for now)
export function getSubPlotsGeoJSON() {
    return {
        type: 'FeatureCollection',
        features: []
    };
}
'''

with open('js/data/plots.js', 'w', encoding='utf-8') as f:
    f.write(plots_js)
print("Updated js/data/plots.js with 45 numbered plots!")

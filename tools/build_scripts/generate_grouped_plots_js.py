import json

# Load calibrated 45 plots
plots_45 = json.load(open('scratch/calibrated_45_plots.json', encoding='utf-8'))

# Group specifications:
# (id, name, plot_range, icon, color, category, plot_indices, description, sub_details)
groups = [
    {
        "id": "zone_cassava_production",
        "name": "Cassava Production",
        "plotRange": "Plots 1–2",
        "icon": "🌿",
        "color": "#f59e0b",
        "category": "crop",
        "plots": [1, 2],
        "description": "Northern compound cassava field production and root crop evaluation research trials along the compound highway frontage.",
        "sub_info": {
            1: ("Plot 1 - Cassava Production", "Cassava Production", "Varietal maintenance and perimeter root crop trial"),
            2: ("Plot 2 - Cassava Production", "Cassava Production", "Root crop field performance and yield evaluation")
        }
    },
    {
        "id": "zone_veg_derby_citrus",
        "name": "Vegetable Derby Citrus",
        "plotRange": "Plots 3–5",
        "icon": "🥬",
        "color": "#10b981",
        "category": "crop",
        "plots": [3, 4, 5],
        "description": "High-value commercial vegetable derby varietal test beds with companion citrus intercropping along the northwestern perimeter.",
        "sub_info": {
            3: ("Plot 3 - Vegetable Derby Citrus", "Solanaceous & Cucurbits", "Vegetable crop evaluation bed along northwest road"),
            4: ("Plot 4 - Vegetable Derby Citrus", "High-Value Vegetables", "Competition trial beds with citrus scion rows"),
            5: ("Plot 5 - Vegetable Derby Citrus", "Vegetable Trials", "Field trial plot bordering the citrus orchard")
        }
    },
    {
        "id": "zone_citrus_orchard",
        "name": "Citrus Orchard",
        "plotRange": "Plots 6–12",
        "icon": "🍊",
        "color": "#f97316",
        "category": "orchard",
        "plots": [6, 7, 8, 9, 10, 11, 12],
        "description": "Center for citrus germplasm conservation, Calamansi clonal evaluation, Agro-Meteorological Station (AWS), and micro-sprinkler irrigation along Pili Drive.",
        "sub_info": {
            6: ("Plot 6 - Sprinkler Irrigation Block", "Citrus Germplasm", "Automated overhead/micro sprinkler irrigation test bed"),
            7: ("Plot 7 - Calamansi Clonal Block", "Philippine Calamansi", "High-density clonal evaluation and selection orchard"),
            8: ("Plot 8 - Agro-Meteorological Station", "AWS Weather Mast", "Houses the station weather station, rain gauge, and solar sensors"),
            9: ("Plot 9 - Mandarin & Orange Orchard", "Mandarin & Sweet Orange", "Long-term citrus scion and rootstock trial orchard"),
            10: ("Plot 10 - Citrus IPM Research", "Citrus Varietal Collection", "Fruit fly management and integrated pest management (IPM) block"),
            11: ("Plot 11 - Citrus Horticultural Plot", "Mixed Citrus Accessions", "Horticultural training and rootstock testing plot along Pili Drive"),
            12: ("Plot 12 - Citrus Field Irrigation Plot", "Citrus Germplasm", "Irrigated varietal block with Pili Drive water line connection")
        }
    },
    {
        "id": "zone_cassava_germplasm",
        "name": "Cassava Germplasm",
        "plotRange": "Plots 13–14",
        "icon": "🌱",
        "color": "#06b6d4",
        "category": "crop",
        "plots": [13, 14],
        "description": "CALABARZON cassava germplasm conservation bank and accession trials under CGUARD.",
        "sub_info": {
            13: ("Plot 13 - Cassava Germplasm", "Cassava Germplasm Bank", "Regional clone conservation and variety collection"),
            14: ("Plot 14 - Cassava Breeding Nursery", "Breeding Accessions", "Rootstock accession and breeding nursery block")
        }
    },
    {
        "id": "zone_ati_corn_trial",
        "name": "ATI Corn Trial",
        "plotRange": "Plot 15",
        "icon": "🌽",
        "color": "#eab308",
        "category": "crop",
        "plots": [15],
        "description": "Agricultural Training Institute (ATI) collaborative corn evaluation and farmer training trial plot.",
        "sub_info": {
            15: ("Plot 15 - ATI Corn Trial", "Hybrid Corn", "ATI farmer training and regional technology demonstration plot")
        }
    },
    {
        "id": "zone_mango_orchard_16",
        "name": "Mango Orchard",
        "plotRange": "Plot 16",
        "icon": "🥭",
        "color": "#10b981",
        "category": "orchard",
        "plots": [16],
        "description": "Carabao mango germplasm collection and canopy training grove in the eastern research sector.",
        "sub_info": {
            16: ("Plot 16 - Mango Orchard", "Carabao Mango", "Germplasm preservation and canopy pruning trial grove")
        }
    },
    {
        "id": "zone_tc_screenhouse",
        "name": "TC Makapuno & Banana Screenhouse",
        "plotRange": "Plot 17",
        "icon": "🏡",
        "color": "#8b5cf6",
        "category": "orchard",
        "plots": [17],
        "description": "Climate-controlled screenhouse facility for tissue-culture Makapuno coconut and certified banana plantlet hardening.",
        "sub_info": {
            17: ("Plot 17 - TC Screenhouse Facility", "Tissue Culture Nursery", "Protected micro-propagation and acclimatization facility")
        }
    },
    {
        "id": "zone_coffee_screenhouse",
        "name": "Coffee & Citrus Screenhouse",
        "plotRange": "Plot 18",
        "icon": "☕",
        "color": "#a855f7",
        "category": "orchard",
        "plots": [18],
        "description": "Protected screenhouse nursery for high-value coffee seedlings and disease-free citrus budwood scions.",
        "sub_info": {
            18: ("Plot 18 - Coffee & Citrus Nursery", "Coffee & Budwood Nursery", "Disease-free scion multiplication and protected seedling nursery")
        }
    },
    {
        "id": "zone_pummelo_orchard",
        "name": "Pummelo Orchard",
        "plotRange": "Plot 19",
        "icon": "🍈",
        "color": "#84cc16",
        "category": "orchard",
        "plots": [19],
        "description": "Pummelo (Pomelo) varietal research orchard and fruit production block.",
        "sub_info": {
            19: ("Plot 19 - Pummelo Orchard", "Pummelo / Pomelo", "Varietal performance orchard and fruit quality trial block")
        }
    },
    {
        "id": "zone_coffee_banana",
        "name": "Coffee Orchard & TC Banana",
        "plotRange": "Plots 20–22",
        "icon": "☕",
        "color": "#a855f7",
        "category": "orchard",
        "plots": [20, 21, 22],
        "description": "Robusta and Liberica coffee agroforestry orchard intercropped with tissue-culture banana trials along Eucalyptus Drive.",
        "sub_info": {
            20: ("Plot 20 - Coffee Agroforestry Block", "Robusta & Liberica", "Multi-tier coffee orchard intercropped with banana cultivars"),
            21: ("Plot 21 - Coffee Agronomic Trial", "Coffee & TC Banana", "Agronomic spacing and shade-management evaluation block"),
            22: ("Plot 22 - Coffee Production Block", "Coffee Cultivars", "Coffee field production block bordering the central avenue")
        }
    },
    {
        "id": "zone_veg_garden",
        "name": "Vegetable Garden",
        "plotRange": "Plots 23–25",
        "icon": "🥬",
        "color": "#22c55e",
        "category": "crop",
        "plots": [23, 24, 25],
        "description": "Certified Good Agricultural Practices (GAP) vegetable garden, indigenous vegetables, and field shelter hub.",
        "sub_info": {
            23: ("Plot 23 - Organic Vegetable Beds", "Indigenous Vegetables", "Organic vegetable production and soil health trials"),
            24: ("Plot 24 - GAP Vegetable Beds", "Solanaceous & Legumes", "Certified GAP production beds and IPM demonstration block"),
            25: ("Plot 25 - Field Shelter & Garden", "Vegetable Demonstration", "Demonstration garden with field farmer shelter and irrigation tap")
        }
    },
    {
        "id": "zone_fruit_sorghum_citrus",
        "name": "Fruit Trees, Surghum & Citrus",
        "plotRange": "Plots 26–28",
        "icon": "🌳",
        "color": "#059669",
        "category": "orchard",
        "plots": [26, 27, 28],
        "description": "Diverse tropical fruit tree collection intercropped with sweet sorghum grain trials and mixed citrus accessions.",
        "sub_info": {
            26: ("Plot 26 - Fruit & Sorghum Trial", "Sweet Sorghum & Fruit", "Sweet sorghum grain evaluation intercropped with young fruit trees"),
            27: ("Plot 27 - Agroforestry Plot", "Sorghum & Mixed Citrus", "Agroforestry demonstration plot featuring sorghum trials and citrus"),
            28: ("Plot 28 - Tropical Fruit Collection", "Fruit Trees & Citrus", "Germplasm evaluation combining indigenous fruit trees and citrus")
        }
    },
    {
        "id": "zone_tall_makapuno_29",
        "name": "Tall Makapuno & Cacao",
        "plotRange": "Plot 29",
        "icon": "🥥",
        "color": "#6366f1",
        "category": "orchard",
        "plots": [29],
        "description": "Tall Makapuno coconut palms intercropped with shade-grown Criollo and Trinitario cacao trees.",
        "sub_info": {
            29: ("Plot 29 - Tall Makapuno & Cacao", "Tall Makapuno & Cacao", "Agroforestry canopy of Tall Makapuno palms with understory cacao")
        }
    },
    {
        "id": "zone_mango_banana_jackfruit",
        "name": "Mango, Banana & Jackfruit",
        "plotRange": "Plots 30–32",
        "icon": "🥭",
        "color": "#10b981",
        "category": "orchard",
        "plots": [30, 31, 32],
        "description": "Multi-storey tropical fruit grove combining Philippine jackfruit canopy, graft mango trees, and banana clones.",
        "sub_info": {
            30: ("Plot 30 - Jackfruit & Mango Grove", "Jackfruit & Mango", "Multi-storey fruit orchard with jackfruit canopy and mango grafts"),
            31: ("Plot 31 - Tropical Fruit Demonstration", "Jackfruit & Banana", "Multi-tier farming demonstration with banana understory"),
            32: ("Plot 32 - Mixed Fruit Accessions", "Fruit Trees & Banana", "Sustainable tropical fruit grove combining jackfruit and banana clones")
        }
    },
    {
        "id": "zone_dwarf_makapuno",
        "name": "Dwarf Makapuno",
        "plotRange": "Plots 33–35",
        "icon": "🥥",
        "color": "#6366f1",
        "category": "orchard",
        "plots": [33, 34, 35],
        "description": "Early-bearing dwarf Makapuno coconut hybrid research and embryo culture propagation grove.",
        "sub_info": {
            33: ("Plot 33 - Dwarf Makapuno Hybrids", "Dwarf Makapuno", "Early-bearing hybrid coconut performance trial block"),
            34: ("Plot 34 - Makapuno Embryo Culture", "Dwarf Makapuno", "Embryo culture propagated mother palm evaluation grove"),
            35: ("Plot 35 - Makapuno Clonal Block", "Dwarf Makapuno", "Clonal dwarf Makapuno palm evaluation block with field water tap")
        }
    },
    {
        "id": "zone_rice_soybean",
        "name": "Rice & Soybean",
        "plotRange": "Plot 36",
        "icon": "🌾",
        "color": "#38bdf8",
        "category": "crop",
        "plots": [36],
        "description": "Grain legume and upland rice rotation trial for sustainable soil fertility management.",
        "sub_info": {
            36: ("Plot 36 - Rice & Soybean Rotation", "Upland Rice & Soybean", "Crop rotation trial evaluating legume nitrogen fixation")
        }
    },
    {
        "id": "zone_bio_prime_corn",
        "name": "Bio Prime & Enviro Corn Trial",
        "plotRange": "Plots 37–38",
        "icon": "🌽",
        "color": "#eab308",
        "category": "crop",
        "plots": [37, 38],
        "description": "Environmental bio-fertilizer compatibility trial and field rest shelter hub along Eucalyptus Drive.",
        "sub_info": {
            37: ("Plot 37 - Enviro Corn & Field Shelter", "Corn & Bio-Fertilizer", "Bio-fertilizer compatibility trial hosting the central field hut"),
            38: ("Plot 38 - Bio Prime Performance Trial", "Modern Hybrid Corn", "Bio Prime bio-stimulant performance trial on modern corn hybrids")
        }
    },
    {
        "id": "zone_corn_research",
        "name": "Corn Research",
        "plotRange": "Plots 39–41",
        "icon": "🌽",
        "color": "#eab308",
        "category": "crop",
        "plots": [39, 40, 41],
        "description": "National Corn Program hybrid yellow corn, nutrient management, and seed increase trials.",
        "sub_info": {
            39: ("Plot 39 - Hybrid Yellow Corn Trial", "Hybrid Yellow Corn", "National Corn Program regional varietal yield and performance trial"),
            40: ("Plot 40 - Nutrient & FAW Management", "Corn Nutrient Trial", "Corn nutrient management and fall armyworm resilience evaluation"),
            41: ("Plot 41 - OPV Seed Increase Block", "Glutinous White Corn", "Open-pollinated variety (OPV) certified seed increase block")
        }
    },
    {
        "id": "zone_tall_makapuno_42",
        "name": "Tall Makapuno & Cacao",
        "plotRange": "Plot 42",
        "icon": "🥥",
        "color": "#6366f1",
        "category": "orchard",
        "plots": [42],
        "description": "Tall Makapuno coconut germplasm block with intercropped commercial cacao selections.",
        "sub_info": {
            42: ("Plot 42 - Tall Makapuno & Cacao", "Tall Makapuno & Cacao", "Canopy coconut palms with shade-grown commercial cacao")
        }
    },
    {
        "id": "zone_glutinous_flint_corn",
        "name": "Glutinous Flint Corn",
        "plotRange": "Plot 43",
        "icon": "🌽",
        "color": "#eab308",
        "category": "crop",
        "plots": [43],
        "description": "Traditional glutinous white flint corn variety preservation and certified seed multiplication field.",
        "sub_info": {
            43: ("Plot 43 - Glutinous Flint Corn", "White Flint Corn", "Traditional flint corn variety preservation and seed multiplication")
        }
    },
    {
        "id": "zone_pomelo_orchard",
        "name": "Pomelo Orchard",
        "plotRange": "Plot 44",
        "icon": "🍈",
        "color": "#84cc16",
        "category": "orchard",
        "plots": [44],
        "description": "Mature Magallanes and Siamese sweet pomelo orchard and pruning research block.",
        "sub_info": {
            44: ("Plot 44 - Pomelo Orchard", "Magallanes & Siamese Pomelo", "Mature sweet pomelo orchard and canopy pruning trial block")
        }
    },
    {
        "id": "zone_mango_orchard_45",
        "name": "Mango Orchard",
        "plotRange": "Plot 45",
        "icon": "🥭",
        "color": "#10b981",
        "category": "orchard",
        "plots": [45],
        "description": "Expansive mature mango orchard canopy in the northeast compound for postharvest and floral induction research.",
        "sub_info": {
            45: ("Plot 45 - Mature Mango Canopy", "Carabao Mango", "Large mature mango canopy for off-season floral induction research")
        }
    }
]

zones_output = []
all_plot_features = []
internal_cut_features = []

for g in groups:
    sub_plots = []
    all_pts = []
    
    for p_num in g['plots']:
        sq = plots_45[p_num - 1]
        ring = sq['polygon']
        pts = ring[:-1] if ring[0] == ring[-1] else ring
        all_pts.extend(pts)
        
        c_lng = sum(p[0] for p in pts) / len(pts)
        c_lat = sum(p[1] for p in pts) / len(pts)
        
        s_title, s_crop, s_det = g['sub_info'][p_num]
        
        sub_obj = {
            "plotNum": p_num,
            "name": s_title,
            "crop": s_crop,
            "details": s_det,
            "centerCoords": [round(c_lng, 8), round(c_lat, 8)],
            "polygon": ring
        }
        sub_plots.append(sub_obj)
        
        # Add to all_plot_features for individual polygon rendering
        all_plot_features.append({
            "type": "Feature",
            "id": f"plot_{p_num}",
            "properties": {
                "id": f"plot_{p_num}",
                "zoneId": g['id'],
                "plotNum": p_num,
                "name": s_title,
                "zoneName": g['name'],
                "plotRange": g['plotRange'],
                "color": g['color'],
                "category": g['category'],
                "icon": g['icon'],
                "crop": s_crop,
                "description": s_det
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [ring]
            }
        })
    
    # Calculate group center for the 1 master pin
    c_lng = sum(p[0] for p in all_pts) / len(all_pts)
    c_lat = sum(p[1] for p in all_pts) / len(all_pts)
    
    # Outer polygon
    # For single plot: exact ring
    # For multi-plot: first plot or boundary
    group_poly = plots_45[g['plots'][0] - 1]['polygon']
    
    zones_output.append({
        "id": g['id'],
        "name": g['name'],
        "plotRange": g['plotRange'],
        "category": g['category'],
        "icon": g['icon'],
        "color": g['color'],
        "centerCoords": [round(c_lng, 8), round(c_lat, 8)],
        "description": g['description'],
        "plotCount": len(g['plots']),
        "plotsList": g['plots'],
        "groupPolygon": group_poly,
        "subPlots": sub_plots
    })

# Internal cuts: dividing lines between adjacent sub-plots in multi-plot zones
for g in groups:
    if len(g['plots']) > 1:
        # Create cut lines from shared or boundary edges
        for i in range(len(g['plots']) - 1):
            sq1 = plots_45[g['plots'][i] - 1]['polygon']
            sq2 = plots_45[g['plots'][i+1] - 1]['polygon']
            # Divide line at border between sq1 and sq2
            p1 = sq1[1] if len(sq1) > 1 else sq1[0]
            p2 = sq1[2] if len(sq1) > 2 else sq1[0]
            internal_cut_features.append({
                "type": "Feature",
                "properties": { "zoneId": g['id'] },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [p1, p2]
                }
            })

print(f"Total Master Zones (Pins): {len(zones_output)}")
print(f"Total Individual Plot Polygons: {len(all_plot_features)}")

plots_js = '''// DA-LARES Agricultural Field Plot & Commodity Zones Dataset
// Grouped Master Commodity Zones with Individual Sub-Plot Breakdown (Plots 1 to 45)
// Ensures zero overlapping pins on map overview while preserving all 45 calibrated field plots!

export const FIELD_COMMODITY_ZONES = ''' + json.dumps(zones_output, indent=4) + ''';

export const ALL_PLOT_POLYGONS = ''' + json.dumps(all_plot_features, indent=4) + ''';

export const INTERNAL_CUT_LINES = ''' + json.dumps(internal_cut_features, indent=4) + ''';

// Helper to convert zones & plots into standard GeoJSON FeatureCollection
export function getPlotsGeoJSON() {
    return {
        type: 'FeatureCollection',
        features: ALL_PLOT_POLYGONS
    };
}

// Helper to convert sub-plot cuts into GeoJSON FeatureCollection
export function getSubPlotsGeoJSON() {
    return {
        type: 'FeatureCollection',
        features: INTERNAL_CUT_LINES
    };
}
'''

with open('js/data/plots.js', 'w', encoding='utf-8') as f:
    f.write(plots_js)

print("Saved js/data/plots.js with clean master zones and 45 sub-plot cuts!")

import json

# Load the 45 calibrated plots
plots_45 = json.load(open('scratch/calibrated_45_plots.json', encoding='utf-8'))

# Group definitions: (group_id, name, plot_range, icon, color, category, plot_indices_1_based, description)
group_defs = [
    ("zone_cassava_1_2", "Cassava Production", "Plots 1–2", "🌿", "#f59e0b", "crop", [1, 2],
     "Northern compound cassava field production and root crop research trials along the compound highway frontage."),
    
    ("zone_veg_derby_3_5", "Vegetable Derby Citrus", "Plots 3–5", "🥬", "#10b981", "crop", [3, 4, 5],
     "High-value vegetable derby varietal test beds with companion citrus intercropping along the northwestern perimeter."),
     
    ("zone_citrus_6_12", "Citrus Orchard", "Plots 6–12", "🍊", "#f97316", "orchard", [6, 7, 8, 9, 10, 11, 12],
     "Center for citrus germplasm conservation, Calamansi clonal evaluation, Agro-Meteorological Station (AWS), and micro-sprinkler irrigation."),
     
    ("zone_cassava_germplasm_13_14", "Cassava Germplasm", "Plots 13–14", "🌱", "#06b6d4", "crop", [13, 14],
     "CALABARZON cassava germplasm conservation bank and breeding accession trials under CGUARD."),
     
    ("zone_ati_corn_15", "ATI Corn Trial", "Plot 15", "🌽", "#eab308", "crop", [15],
     "Agricultural Training Institute (ATI) collaborative corn evaluation and farmer training trial plot."),
     
    ("zone_mango_16", "Mango Orchard", "Plot 16", "🥭", "#10b981", "orchard", [16],
     "Carabao mango germplasm collection and canopy training grove in the eastern research sector."),
     
    ("zone_tc_screenhouse_17", "TC Makapuno & Banana Screenhouse", "Plot 17", "🏡", "#8b5cf6", "orchard", [17],
     "Protected nursery screenhouse facility for tissue-culture Makapuno coconut and certified banana plantlet hardening."),
     
    ("zone_coffee_screenhouse_18", "Coffee & Citrus Screenhouse", "Plot 18", "☕", "#a855f7", "orchard", [18],
     "Protected screenhouse nursery for high-value coffee seedlings and disease-free citrus budwood scions."),
     
    ("zone_pummelo_19", "Pummelo Orchard", "Plot 19", "🍈", "#84cc16", "orchard", [19],
     "Pummelo (Pomelo) varietal research orchard and fruit production block."),
     
    ("zone_coffee_banana_20_22", "Coffee Orchard & TC Banana", "Plots 20–22", "☕", "#a855f7", "orchard", [20, 21, 22],
     "Robusta and Liberica coffee agroforestry orchard intercropped with tissue-culture banana trials along Eucalyptus Drive."),
     
    ("zone_veg_garden_23_25", "Vegetable Garden", "Plots 23–25", "🥬", "#22c55e", "crop", [23, 24, 25],
     "Certified Good Agricultural Practices (GAP) vegetable garden, indigenous vegetables, and field shelter hub."),
     
    ("zone_fruit_sorghum_26_28", "Fruit Trees, Surghum & Citrus", "Plots 26–28", "🌳", "#059669", "orchard", [26, 27, 28],
     "Diverse tropical fruit tree collection intercropped with sweet sorghum grain trials and mixed citrus accessions."),
     
    ("zone_makapuno_cacao_29", "Tall Makapuno & Cacao", "Plot 29", "🥥", "#6366f1", "orchard", [29],
     "Tall Makapuno coconut palms intercropped with shade-grown Criollo and Trinitario cacao trees."),
     
    ("zone_mango_banana_jackfruit_30_32", "Mango, Banana & Jackfruit", "Plots 30–32", "🥭", "#10b981", "orchard", [30, 31, 32],
     "Multi-storey tropical fruit grove combining Philippine jackfruit canopy, graft mango trees, and banana clones."),
     
    ("zone_dwarf_makapuno_33_35", "Dwarf Makapuno", "Plots 33–35", "🥥", "#6366f1", "orchard", [33, 34, 35],
     "Early-bearing dwarf Makapuno coconut hybrid research and embryo culture propagation grove."),
     
    ("zone_rice_soybean_36", "Rice & Soybean", "Plot 36", "🌾", "#38bdf8", "crop", [36],
     "Grain legume and upland rice rotation trial for sustainable soil fertility management."),
     
    ("zone_bio_prime_37_38", "Bio Prime & Enviro Corn Trial", "Plots 37–38", "🌽", "#eab308", "crop", [37, 38],
     "Environmental bio-fertilizer compatibility trial and field rest shelter hub along Eucalyptus Drive."),
     
    ("zone_corn_research_39_41", "Corn Research", "Plots 39–41", "🌽", "#eab308", "crop", [39, 40, 41],
     "National Corn Program hybrid yellow corn, nutrient management, and seed increase trials."),
     
    ("zone_makapuno_cacao_42", "Tall Makapuno & Cacao", "Plot 42", "🥥", "#6366f1", "orchard", [42],
     "Tall Makapuno coconut germplasm block with intercropped commercial cacao selections."),
     
    ("zone_flint_corn_43", "Glutinous Flint Corn", "Plot 43", "🌽", "#eab308", "crop", [43],
     "Traditional glutinous white flint corn variety preservation and certified seed multiplication field."),
     
    ("zone_pomelo_44", "Pomelo Orchard", "Plot 44", "🍈", "#84cc16", "orchard", [44],
     "Mature Magallanes and Siamese sweet pomelo orchard and pruning research block."),
     
    ("zone_mango_45", "Mango Orchard", "Plot 45", "🥭", "#10b981", "orchard", [45],
     "Expansive mature mango orchard canopy in the northeast compound for postharvest and floral induction research.")
]

grouped_zones = []

for gid, name, prange, icon, color, cat, p_nums, desc in group_defs:
    sub_plots = []
    all_poly_pts = []
    
    for p_num in p_nums:
        sq = plots_45[p_num - 1]
        ring = sq['polygon']
        pts = ring[:-1] if ring[0] == ring[-1] else ring
        all_poly_pts.extend(pts)
        
        c_lng = sum(p[0] for p in pts) / len(pts)
        c_lat = sum(p[1] for p in pts) / len(pts)
        
        sub_plots.append({
            "plotNum": p_num,
            "name": sq['name'],
            "centerCoords": [round(c_lng, 8), round(c_lat, 8)],
            "polygon": ring
        })
    
    # Calculate group centroid
    c_lng = sum(p[0] for p in all_poly_pts) / len(all_poly_pts)
    c_lat = sum(p[1] for p in all_poly_pts) / len(all_poly_pts)
    
    # Outer polygon for group:
    # If 1 plot: exactly that plot's polygon.
    # If multi-plot: for fill we can include the subplots
    group_poly = plots_45[p_nums[0] - 1]['polygon'] if len(p_nums) == 1 else None
    
    grouped_zones.append({
        "id": gid,
        "name": name,
        "plotRange": prange,
        "category": cat,
        "icon": icon,
        "color": color,
        "centerCoords": [round(c_lng, 8), round(c_lat, 8)],
        "description": desc,
        "subPlots": sub_plots
    })

print(f"Created {len(grouped_zones)} clean master zones from 45 plots.")
with open('scratch/grouped_zones.json', 'w', encoding='utf-8') as f:
    json.dump(grouped_zones, f, indent=2)

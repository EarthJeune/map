import bpy
import bmesh
import math

def build_t_shaped_roof_test():
    # Clear previous
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Test_"):
            bpy.data.objects.remove(obj, do_unlink=True)

    # Dimensions based directly on the polygon projected vertices:
    # Main wing: X in [-13.1, +13.1] (width 26.2m), Y in [0, -11.8] (depth 11.8m)
    # Protruding wing: X in [-5.3, +6.3] (width 11.6m), Y in [-11.8, -16.5] (protrusion depth 4.7m)
    # Centered origin: let center of main wing be X=0, Y=0 (shift Y so back is at +5.9, front of main is at -5.9)
    # In this centered system:
    # Main wing: X in [-13.1, 13.1], Y in [-5.9, +5.9]
    # Protruding wing: X in [-5.3, 6.3] (mid = +0.5), Y extends from -5.9 down to -10.6!
    
    OVERHANG = 0.85
    EAVE_Z = 3.5
    RIDGE_Z = 5.8
    SLOPE = (RIDGE_Z - EAVE_Z) / (5.9 + OVERHANG) # ~ 0.34
    
    print(f"Eave Z: {EAVE_Z}, Ridge Z: {RIDGE_Z}, Slope: {SLOPE:.3f}")

build_t_shaped_roof_test()

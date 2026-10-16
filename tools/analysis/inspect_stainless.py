import bpy
import bmesh
from mathutils import Vector

# Let's inspect what happens in build_rcpc_building.py around lines 440-555
# Specifically the stainless objects and stair objects!
import sys
sys.path.append(r'c:\Users\LGU-SanPedro\Downloads\map')

# We can import or inspect objects created before join:
with open(r'c:\Users\LGU-SanPedro\Downloads\map\build_rcpc_building.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's run the script without join and list all stainless objects and their bounding boxes
code_lines = code.splitlines()
# find where join starts
join_idx = [i for i, line in enumerate(code_lines) if "Mesh Optimization" in line][0]
code_truncated = "\n".join(code_lines[:join_idx]) + "\nbuild_rcpc_building()\n"
exec(code_truncated)

bpy.context.view_layer.update()
print("\n--- ALL STAINLESS OBJECTS IN SCENE ---")
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data.materials and obj.data.materials[0].name == 'RCPC_Stainless':
        mw = obj.matrix_world
        verts = [mw @ v.co for v in obj.data.vertices]
        min_z = min(v.z for v in verts)
        max_z = max(v.z for v in verts)
        min_y = min(v.y for v in verts)
        max_y = max(v.y for v in verts)
        min_x = min(v.x for v in verts)
        max_x = max(v.x for v in verts)
        print(f"Object: {obj.name:30s} | X:[{min_x:6.2f}, {max_x:6.2f}] | Y:[{min_y:6.2f}, {max_y:6.2f}] | Z:[{min_z:6.2f}, {max_z:6.2f}] | rot={tuple(round(r, 2) for r in obj.rotation_euler)}")

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='c:/Users/LGU-SanPedro/Downloads/map/models/admin_building.glb')

print("\n--- OBJECT BOUNDING BOXES NEAR SOUTH FACADE (Y < -9.0) ---")
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        pts = [obj.matrix_world @ Vector(b) for b in obj.bound_box]
        min_x = min(p.x for p in pts)
        max_x = max(p.x for p in pts)
        min_y = min(p.y for p in pts)
        max_y = max(p.y for p in pts)
        min_z = min(p.z for p in pts)
        max_z = max(p.z for p in pts)
        if min_y < -9.5 and min_z < 4.0:
            print(f"{obj.name}: X=[{min_x:.2f}, {max_x:.2f}], Y=[{min_y:.2f}, {max_y:.2f}], Z=[{min_z:.2f}, {max_z:.2f}]")

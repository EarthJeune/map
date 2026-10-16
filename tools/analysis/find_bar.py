import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='c:/Users/LGU-SanPedro/Downloads/map/models/admin_building.glb')

# Find all objects with vertices around x in [-5.5, -1.9], y in [-11.0, -9.0], z in [3.0, 3.8]
print("\n--- FINDING OBJECTS IN REGION [-5.5 < x < -1.9, -11 < y < -9, 3.0 < z < 3.8] ---")
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        in_region = False
        for v in obj.data.vertices:
            world_v = obj.matrix_world @ v.co
            if -5.5 <= world_v.x <= -1.9 and -11.0 <= world_v.y <= -9.0 and 3.0 <= world_v.z <= 3.8:
                in_region = True
                break
        if in_region:
            print(f"MATCH: {obj.name}, mat={[m.name for m in obj.data.materials] if obj.data.materials else 'None'}")

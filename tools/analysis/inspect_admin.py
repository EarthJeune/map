import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='c:/Users/LGU-SanPedro/Downloads/map/models/admin_building.glb')
print('=== OBJECTS IN GLB ===')
for obj in bpy.data.objects:
    name_l = obj.name.lower()
    if any(k in name_l for k in ['portico', 'fascia', 'belt', 'south']):
        loc = tuple(round(v, 3) for v in obj.matrix_world.translation)
        dim = tuple(round(v, 3) for v in obj.dimensions)
        rot = tuple(round(v, 3) for v in obj.rotation_euler)
        print(f'{obj.name}: loc={loc}, dim={dim}, rot={rot}')

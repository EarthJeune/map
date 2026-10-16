import bpy

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

glb_path = r'c:\Users\LGU-SanPedro\Downloads\map\models\rcpc_building.glb'
bpy.ops.import_scene.gltf(filepath=glb_path)

print("Imported objects in rcpc_building.glb:")
for obj in bpy.data.objects:
    print(f"- {obj.name}: type={obj.type}, loc={obj.location}, dims={obj.dimensions}")
    if obj.type == 'MESH':
        print(f"  verts={len(obj.data.vertices)}, faces={len(obj.data.polygons)}, mats={[m.name for m in obj.data.materials]}")

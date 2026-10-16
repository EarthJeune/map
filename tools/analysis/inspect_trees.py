import bpy

for name in ['tree_mango', 'tree_palm', 'tree_pine', 'tree_bush']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f'models/{name}.glb')
    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
    print(f'=== {name} ===')
    print(f'Total objects: {len(mesh_objs)}')
    for o in mesh_objs:
        print(f'  {o.name}: {len(o.data.vertices)} verts, materials: {[m.name for m in o.data.materials]}')

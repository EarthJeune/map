import bpy
import os
import sys
import glob

MODELS_DIR = os.path.abspath("models")
BACKUP_DIR = os.path.abspath("archive/glb_backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

def get_stats(glb_path):
    with open(glb_path, 'rb') as f:
        buf = f.read()
    import struct, json
    if len(buf) < 20:
        return 0, 0, len(buf)
    json_len = struct.unpack('<I', buf[12:16])[0]
    gltf = json.loads(buf[20:20+json_len].decode('utf-8'))
    prims = sum(len(m.get('primitives', [])) for m in gltf.get('meshes', []))
    nodes = len(gltf.get('nodes', []))
    return prims, nodes, len(buf)

def optimize_glb(glb_path):
    base_name = os.path.basename(glb_path)
    if base_name.startswith("tree_"):
        return None  # Skip tree assets
    
    orig_prims, orig_nodes, orig_size = get_stats(glb_path)
    if orig_prims <= 15:
        print(f"Skipping {base_name}: already optimized ({orig_prims} prims)")
        return None

    # Backup original
    backup_path = os.path.join(BACKUP_DIR, base_name)
    with open(glb_path, 'rb') as f_in, open(backup_path, 'wb') as f_out:
        f_out.write(f_in.read())

    # Import into clean Blender scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)

    # 1. Unparent and apply transforms
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            obj.select_set(False)

    # 2. Group by material
    mat_groups = {}
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            mat_key = obj.data.materials[0].name if (obj.data.materials and obj.data.materials[0]) else '__NO_MAT__'
            mat_groups.setdefault(mat_key, []).append(obj)

    # 3. Join meshes per material group
    for mat_key, objs in mat_groups.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
            objs[0].name = f"Mesh_{mat_key}"

    # 4. Remove any remaining non-mesh objects
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)

    # 5. Export back
    temp_out = os.path.join(BACKUP_DIR, f"opt_{base_name}")
    bpy.ops.export_scene.gltf(
        filepath=temp_out,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )

    new_prims, new_nodes, new_size = get_stats(temp_out)
    new_size_kb = new_size / 1024.0

    if new_size_kb > 300.0:
        print(f"ERROR: {base_name} exceeded 300 KB budget ({new_size_kb:.1f} KB)! Rolling back.")
        os.remove(temp_out)
        return False

    # Overwrite original
    os.replace(temp_out, glb_path)
    reduction = (1 - (new_prims / orig_prims)) * 100
    print(f"OPTIMIZED {base_name}: Prims {orig_prims} -> {new_prims} (-{reduction:.1f}%), Size {orig_size/1024:.1f}KB -> {new_size_kb:.1f}KB")
    return {
        'file': base_name,
        'orig_prims': orig_prims,
        'new_prims': new_prims,
        'orig_size_kb': orig_size / 1024.0,
        'new_size_kb': new_size_kb
    }

def main():
    glbs = sorted(glob.glob(os.path.join(MODELS_DIR, "*.glb")))
    results = []
    for glb in glbs:
        res = optimize_glb(glb)
        if res:
            results.append(res)
    
    print("\n" + "="*60)
    print("GLB BATCH OPTIMIZATION COMPLETE")
    print("="*60)
    total_orig_prims = sum(r['orig_prims'] for r in results)
    total_new_prims = sum(r['new_prims'] for r in results)
    if total_orig_prims > 0:
        overall_reduction = (1 - (total_new_prims / total_orig_prims)) * 100
        print(f"Total Models Optimized: {len(results)}")
        print(f"Primitives: {total_orig_prims} -> {total_new_prims} (-{overall_reduction:.1f}% reduction in draw calls!)")

if __name__ == '__main__':
    main()

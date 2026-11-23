import bpy
import os
import sys
import json
import struct
from mathutils import Vector

MODELS_DIR = os.path.abspath("models")

def inspect_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    json_len = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + json_len].decode("utf-8"))
    prims = sum(len(m.get("primitives", [])) for m in gltf.get("meshes", []))
    mats = len(gltf.get("materials", []))
    nodes = len(gltf.get("nodes", []))
    return len(data), nodes, prims, mats

def scene_bbox(mesh_objs):
    xs, ys, zs = [], [], []
    for obj in mesh_objs:
        for corner in obj.bound_box:
            w = obj.matrix_world @ Vector(corner)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    if not xs:
        return None
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))

def bbox_close(b1, b2, tol=0.01):
    if not b1 or not b2:
        return False
    return all(abs(a - b) <= tol for a, b in zip(b1, b2))

def optimize_one(path):
    orig_bytes = open(path, "rb").read()
    orig_size, orig_nodes, orig_prims, orig_mats = inspect_glb(path)

    # Skip already-optimized models
    if orig_prims <= max(orig_mats + 3, 16):
        return None

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)

    mesh_objs = [o for o in bpy.data.objects if o.type == "MESH" and o.data and len(o.data.vertices) > 0]
    if len(mesh_objs) <= 1:
        return None

    before_bb = scene_bbox(mesh_objs)

    # Clear parent while keeping world transform, then bake transform into mesh data
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objs:
        mw = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = mw
        obj.select_set(True)

    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()

    joined = bpy.context.active_object
    joined.name = os.path.splitext(os.path.basename(path))[0]
    # Remove any non-mesh empties/cameras/lights
    for o in list(bpy.data.objects):
        if o != joined:
            bpy.data.objects.remove(o, do_unlink=True)

    after_bb = scene_bbox([joined])
    if not bbox_close(before_bb, after_bb, tol=0.02):
        print(f"[SKIP bbox mismatch] {os.path.basename(path)}: {before_bb} vs {after_bb}")
        return None

    tmp_path = path + ".opt.tmp.glb"
    bpy.ops.export_scene.gltf(
        filepath=tmp_path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="EXPORT"
    )

    new_size, new_nodes, new_prims, new_mats = inspect_glb(tmp_path)
    if new_prims < orig_prims and new_size < 300 * 1024:
        os.replace(tmp_path, path)
        return (os.path.basename(path), orig_prims, new_prims, orig_size, new_size)
    else:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return None

def main():
    files = sorted(f for f in os.listdir(MODELS_DIR) if f.endswith(".glb"))
    total_before_prims = 0
    total_after_prims = 0
    total_before_bytes = 0
    total_after_bytes = 0
    optimized = []

    for fname in files:
        p = os.path.join(MODELS_DIR, fname)
        sz, _, pr, _ = inspect_glb(p)
        total_before_prims += pr
        total_before_bytes += sz
        res = optimize_one(p)
        if res:
            optimized.append(res)
            _, _, npr, _, nsz = res
            total_after_prims += npr
            total_after_bytes += nsz
            print(f"[OPT] {fname}: prims {pr} -> {npr}, size {sz/1024:.1f}KB -> {nsz/1024:.1f}KB")
        else:
            total_after_prims += pr
            total_after_bytes += sz

    print("\n=== SUMMARY ===")
    print(f"Optimized models: {len(optimized)} / {len(files)}")
    print(f"Total primitives (draw calls): {total_before_prims} -> {total_after_prims} (-{100*(total_before_prims-total_after_prims)/max(1,total_before_prims):.1f}%)")
    print(f"Total GLB size: {total_before_bytes/1024/1024:.2f} MB -> {total_after_bytes/1024/1024:.2f} MB")

if __name__ == "__main__":
    main()

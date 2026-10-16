"""
render_cguard_f2c2_joint.py — Joint verification renderer for CGuard and F2C2 Buildings side-by-side.
"""

import bpy
import math
import os

def render_joint():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.film_transparent = True
    
    if not scene.world:
        scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.94, 0.95, 0.98, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
            
    # 1. Import CGuard Building (placed at origin)
    cg_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\seaguard_building.glb"
    bpy.ops.import_scene.gltf(filepath=cg_path)
    cg_root = bpy.context.active_object
    
    # 2. Import F2C2 Building (placed to the South: +X in Blender coordinates)
    # Distance between centroids in real world is about 12.5m along North-South
    f2_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\f2c2_building.glb"
    bpy.ops.import_scene.gltf(filepath=f2_path)
    f2_imported = [o for o in bpy.context.selected_objects if o.parent is None]
    if f2_imported:
        f2_root = f2_imported[0]
        # In real world, F2C2 is South of CGuard (+X in our local orientation)
        # Shift F2C2 along +X by ~12.2m and align Y
        f2_root.location = (12.2, 0.0, 0.0)
            
    # Lighting
    sun_data = bpy.data.lights.new(name="Sun_Data", type='SUN')
    sun_data.energy = 2.7
    sun_data.color = (1.0, 0.98, 0.94)
    sun_obj = bpy.data.objects.new("Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(52), math.radians(22), math.radians(-38))
    
    fill_data = bpy.data.lights.new(name="Fill_Data", type='SUN')
    fill_data.energy = 1.2
    fill_data.color = (0.88, 0.92, 0.98)
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(65), math.radians(-25), math.radians(145))

    # Camera
    cam_data = bpy.data.cameras.new(name="Cam_Data")
    cam_obj = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    out_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"
    
    # West Elevation view of both buildings together (showing roof height contrast!)
    cam_data.lens = 28.0
    cam_obj.location = (5.5, -24.0, 5.0)
    cam_obj.rotation_euler = (math.radians(78), 0, math.radians(-8))
    p = os.path.join(out_dir, "cguard_f2c2_joint_comparison.png")
    scene.render.filepath = p
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Joint Comparison to: {p}")

render_joint()

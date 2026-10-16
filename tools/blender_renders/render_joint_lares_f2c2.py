"""
render_joint_lares_f2c2.py — Verifies spatial clearance and alleyway alignment
between LARES Building and F2C2 Building with the retained past size model.
"""

import bpy
import math
import os

def render_joint(shift_w=3.6, shift_n=0.6):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.film_transparent = False
    
    # World background
    if not scene.world:
        scene.world = bpy.data.worlds.new("JointWorld")
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.85, 0.88, 0.94, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0

    # Clean old objects
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    # 1. Import LARES Building
    lares_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\lares_building.glb"
    bpy.ops.import_scene.gltf(filepath=lares_glb)
    lares_objs = [o for o in bpy.context.selected_objects]
    lares_parent = bpy.data.objects.new("LARES_Scene_Root", None)
    bpy.context.scene.collection.objects.link(lares_parent)
    for o in lares_objs:
        if o.parent is None:
            o.parent = lares_parent
    lares_parent.location = (0.0, 0.0, 0.0)
    lares_parent.rotation_euler = (0.0, 0.0, -math.radians(342.8))

    # 2. Import F2C2 Building (retained past size)
    f2c2_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\f2c2_building.glb"
    bpy.ops.import_scene.gltf(filepath=f2c2_glb)
    f2c2_objs = [o for o in bpy.context.selected_objects if o not in lares_objs and o != lares_parent]
    f2c2_parent = bpy.data.objects.new("F2C2_Scene_Root", None)
    bpy.context.scene.collection.objects.link(f2c2_parent)
    for o in f2c2_objs:
        if o.parent is None:
            o.parent = f2c2_parent
    
    # Shift West and slightly North to open the authentic alleyway
    f2c2_x = -8.60 - shift_w
    f2c2_y = 1.43 + shift_n
    f2c2_parent.location = (f2c2_x, f2c2_y, 0.0)
    f2c2_parent.rotation_euler = (0.0, 0.0, -math.radians(72.2))

    # Ground Plane
    bpy.ops.mesh.primitive_plane_add(size=80.0, location=(-12.0, 0.0, -0.01))
    ground = bpy.context.active_object
    ground.name = "Alley_Ground"
    mat_g = bpy.data.materials.new("Ground_Mat")
    mat_g.use_nodes = True
    mat_g.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.55, 0.56, 0.58, 1.0)
    mat_g.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.85
    ground.data.materials.append(mat_g)

    # Lighting
    sun_data = bpy.data.lights.new(name="Sun_Key", type='SUN')
    sun_data.energy = 2.8
    sun_data.color = (1.0, 0.98, 0.92)
    sun_obj = bpy.data.objects.new("Sun_Key", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(55), math.radians(15), math.radians(-40))

    fill_data = bpy.data.lights.new(name="Sun_Fill", type='SUN')
    fill_data.energy = 1.3
    fill_data.color = (0.85, 0.90, 0.98)
    fill_obj = bpy.data.objects.new("Sun_Fill", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(60), math.radians(-20), math.radians(140))

    # Camera
    cam_data = bpy.data.cameras.new(name="Joint_Cam")
    cam_obj = bpy.data.objects.new("Joint_Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    out_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"

    # Shot 1: Ground perspective matching user's first screenshot
    cam_data.lens = 20.0
    cam_obj.location = (-19.5, -2.5, 1.8)
    cam_obj.rotation_euler = (math.radians(84), math.radians(0), math.radians(-58))
    s1 = os.path.join(out_dir, "joint_retained_ground_view.png")
    scene.render.filepath = s1
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 1 to: {s1}")

    # Shot 2: Top-down aerial view showing both roofs and open alley gap (matching user screenshot 2)
    cam_data.lens = 32.0
    cam_obj.location = (-12.5, -0.5, 26.0)
    cam_obj.rotation_euler = (math.radians(0), math.radians(0), math.radians(-90))
    s2 = os.path.join(out_dir, "joint_retained_topdown_clearance.png")
    scene.render.filepath = s2
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2 to: {s2}")

    # Shot 3: Standing right on LARES back porch looking down the alleyway (matching IMG_3870.jpg)
    cam_data.lens = 18.0
    cam_obj.location = (-14.8, -4.8, 1.6)
    cam_obj.rotation_euler = (math.radians(84), math.radians(0), math.radians(-15))
    s3 = os.path.join(out_dir, "joint_retained_alley_3870.png")
    scene.render.filepath = s3
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 3 to: {s3}")

render_joint(shift_w=3.6, shift_n=0.6)

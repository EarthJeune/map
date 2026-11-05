"""
render_plot18_screenhouse_9.py — Render beauty verification shots of Screenhouse 9 Complex
"""

import bpy
import math
import os

GLB_PATH = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot18_screenhouse_9.glb"
OUTPUT_DIR = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def setup_and_render():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in bpy.data.meshes: bpy.data.meshes.remove(m)
    for m in bpy.data.materials: bpy.data.materials.remove(m)
    for l in bpy.data.lights: bpy.data.lights.remove(l)
    for c in bpy.data.cameras: bpy.data.cameras.remove(c)

    # Import generated GLB
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    # Lighting setup
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 4.5
    sun_data.color = (1.0, 0.98, 0.93)
    sun_obj = bpy.data.objects.new("SunLight", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(52), math.radians(22), math.radians(-38))

    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 2.5
    fill_data.color = (0.75, 0.85, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(-35), math.radians(40), math.radians(145))

    # Point light inside shed to highlight concrete room & wash sink
    in_data = bpy.data.lights.new(name="ShedInteriorLight", type='POINT')
    in_data.energy = 450.0
    in_data.color = (1.0, 0.96, 0.90)
    in_obj = bpy.data.objects.new("ShedInteriorLight", in_data)
    bpy.context.collection.objects.link(in_obj)
    in_obj.location = (0.0, 5.0, 2.8)

    # Environment
    bpy.context.scene.world.use_nodes = True
    bg = bpy.context.scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.08, 0.12, 0.18, 1.0)
        bg.inputs['Strength'].default_value = 0.9

    bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.film_transparent = False

    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 35.0
    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    # 1. Front Gate Approach (matching user Screenshot 2 & IMG_4185)
    cam_data.type = 'PERSP'
    cam_data.lens = 30.0
    cam_obj.location = (0.0, 14.5, 2.2)
    cam_obj.rotation_euler = (math.radians(85), 0, math.radians(180))
    p1 = os.path.join(OUTPUT_DIR, "sh9_fixed_front_shed.png")
    bpy.context.scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    print("Rendered:", p1)

    # 2. Isometric Rear/Side Axonometric (matching user Screenshot 1)
    cam_data.lens = 38.0
    cam_obj.location = (11.0, -20.0, 9.5)
    cam_obj.rotation_euler = (math.radians(68), 0, math.radians(35))
    p2 = os.path.join(OUTPUT_DIR, "sh9_fixed_rear_trellis.png")
    bpy.context.scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    print("Rendered:", p2)

    # 3. Inside Shed Looking at Room & Sink (IMG_4186 perspective)
    cam_data.lens = 24.0
    cam_obj.location = (1.5, 7.2, 1.6)
    cam_obj.rotation_euler = (math.radians(85), 0, math.radians(205))
    p3 = os.path.join(OUTPUT_DIR, "sh9_fixed_interior_shed.png")
    bpy.context.scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    print("Rendered:", p3)

    # 4. Top-Down Orthographic
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 25.0
    cam_obj.location = (0.0, -3.0, 30.0)
    cam_obj.rotation_euler = (0, 0, 0)
    p4 = os.path.join(OUTPUT_DIR, "sh9_fixed_topdown.png")
    bpy.context.scene.render.filepath = p4
    bpy.ops.render.render(write_still=True)
    print("Rendered:", p4)

setup_and_render()


"""
render_plot18_greenhouse_complex.py — High-fidelity verification beauty shots of DA-LARES Plot 18 Research Greenhouse Complex
"""

import bpy
import math
import os

GLB_PATH = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot18_greenhouse_complex.glb"
OUTPUT_DIR = r"c:\Users\LGU-SanPedro\Downloads\map\scratch"

def setup_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    # Lighting: Sun + warm ambient fill + interior lights for bays
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 4.5
    sun_data.color = (1.0, 0.98, 0.92)
    sun_obj = bpy.data.objects.new("SunLight", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(52), math.radians(18), math.radians(-32))

    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 2.0
    fill_data.color = (0.75, 0.85, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(-35), math.radians(40), math.radians(145))

    # Soft interior lights to illuminate nursery beds under shade cloth and inside curved bays
    in_data6 = bpy.data.lights.new(name="InteriorLight6", type='POINT')
    in_data6.energy = 650.0
    in_data6.color = (1.0, 0.96, 0.88)
    in_obj6 = bpy.data.objects.new("InteriorLight6", in_data6)
    bpy.context.collection.objects.link(in_obj6)
    in_obj6.location = (-8.28, 5.0, 2.5)

    in_data7 = bpy.data.lights.new(name="InteriorLight7", type='POINT')
    in_data7.energy = 500.0
    in_data7.color = (1.0, 0.96, 0.90)
    in_obj7 = bpy.data.objects.new("InteriorLight7", in_data7)
    bpy.context.collection.objects.link(in_obj7)
    in_obj7.location = (0.0, 8.0, 2.5)

    in_data8 = bpy.data.lights.new(name="InteriorLight8", type='POINT')
    in_data8.energy = 500.0
    in_data8.color = (1.0, 0.96, 0.90)
    in_obj8 = bpy.data.objects.new("InteriorLight8", in_data8)
    bpy.context.collection.objects.link(in_obj8)
    in_obj8.location = (8.28, 8.0, 2.5)

    # Environment
    bpy.context.scene.world.use_nodes = True
    bg_node = bpy.context.scene.world.node_tree.nodes.get('Background')
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.05, 0.08, 0.12, 1.0)
        bg_node.inputs['Strength'].default_value = 0.6

    # Render settings
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 800
    bpy.context.scene.render.film_transparent = False

def render_shot(cam_name, loc, rot, out_filename):
    cam_data = bpy.data.cameras.new(name=cam_name)
    cam_data.lens = 28
    cam_obj = bpy.data.objects.new(cam_name, cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = loc
    cam_obj.rotation_euler = rot
    bpy.context.scene.camera = cam_obj

    filepath = os.path.join(OUTPUT_DIR, out_filename)
    bpy.context.scene.render.filepath = filepath
    print(f"Rendering {out_filename}...")
    bpy.ops.render.render(write_still=True)
    print(f"Saved: {filepath}")
    
    bpy.data.objects.remove(cam_obj)
    bpy.data.cameras.remove(cam_data)

def run():
    setup_scene()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Front View matching 6 7 8 Front View.jpg:
    # Standing at the front (Y = +28m) looking South at the complex
    # Bay 8 on left (+X), Bay 7 in middle (X=0), Bay 6 on right (-X)
    render_shot(
        "Cam_Front_Elevation",
        loc=(0.0, 31.0, 5.2),
        rot=(math.radians(82), 0, math.radians(180)),
        out_filename="gh_front_elevation.png"
    )

    # 2. Aerial 3/4 Overview:
    # Showing all 3 contiguous bays, gothic vs curved arch profiles, valley gutters, and full 32.8m length
    render_shot(
        "Cam_Aerial_Overview",
        loc=(-24.0, 26.0, 16.5),
        rot=(math.radians(65), 0, math.radians(-135)),
        out_filename="gh_aerial_overview.png"
    )

    # 3. Bay 6 Gothic Tunnel & Louver Close-up:
    render_shot(
        "Cam_Bay6_Closeup",
        loc=(-8.28, 23.5, 3.8),
        rot=(math.radians(85), 0, math.radians(180)),
        out_filename="gh_bay6_closeup.png"
    )

    # 4. Bays 7 & 8 Interior & Props (Citrus nursery rows, propagation beds, water drums, white chair):
    render_shot(
        "Cam_Bays78_Interior",
        loc=(6.0, 19.5, 2.2),
        rot=(math.radians(85), 0, math.radians(195)),
        out_filename="gh_bays78_interior.png"
    )

if __name__ == "__main__":
    run()

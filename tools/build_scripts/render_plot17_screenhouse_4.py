"""
render_plot17_screenhouse_4.py — High-fidelity verification beauty shots of DA-LARES Screenhouse 4
"""

import bpy
import math
import os

GLB_PATH = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot17_screenhouse_4.glb"
OUTPUT_DIR = r"c:\Users\LGU-SanPedro\Downloads\map\scratch"

def setup_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    # Lighting: Sun + warm ambient fill + interior bounce light
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 4.0
    sun_data.color = (1.0, 0.98, 0.92)
    sun_obj = bpy.data.objects.new("SunLight", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(48), math.radians(18), math.radians(-42))

    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 1.8
    fill_data.color = (0.75, 0.85, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(-35), math.radians(40), math.radians(135))

    # Soft interior point light to illuminate the nursery beds & blue water drum inside shade net
    in_data = bpy.data.lights.new(name="InteriorLight", type='POINT')
    in_data.energy = 350.0
    in_data.color = (1.0, 0.95, 0.88)
    in_obj = bpy.data.objects.new("InteriorLight", in_data)
    bpy.context.collection.objects.link(in_obj)
    in_obj.location = (0.0, -3.0, 2.5)

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
    cam_data.lens = 32
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

    # 1. Front Perspective: 3/4 angle showing red sunburst arch, foundation red stripe, right entrance door, steps
    render_shot(
        "Cam_Front_Persp",
        loc=(-6.8, -16.8, 4.5),
        rot=(math.radians(75), 0, math.radians(-24)),
        out_filename="sh4_front_perspective.png"
    )

    # 2. Doorway Close-up: Right front entrance door, concrete steps, canopy hood, and lower foundation red stripe
    render_shot(
        "Cam_Doorway",
        loc=(3.15, -12.8, 1.75),
        rot=(math.radians(85), 0, math.radians(4)),
        out_filename="sh4_door_closeup.png"
    )

    # 3. Interior Nursery View: Inside aisle looking forward at the blue 55-gallon water drum, nursery tables, polybag seedling fronds
    render_shot(
        "Cam_Interior_Nursery",
        loc=(0.0, -8.2, 1.8),
        rot=(math.radians(82), 0, 0),
        out_filename="sh4_interior_nursery.png"
    )

    # 4. Aerial Overview: Elevated overview showing full 18.72m curved arch profile, black shade net cladding, and red plinth stripe
    render_shot(
        "Cam_Aerial",
        loc=(-14.0, -8.5, 14.0),
        rot=(math.radians(52), 0, math.radians(-62)),
        out_filename="sh4_aerial_overview.png"
    )

    print("All verification shots rendered successfully!")

run()

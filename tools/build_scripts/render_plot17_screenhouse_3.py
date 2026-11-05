"""
render_plot17_screenhouse_3.py — High-fidelity verification beauty shots of DA-LARES Screenhouse 3
"""

import bpy
import math
import os

GLB_PATH = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot17_screenhouse_3.glb"
OUTPUT_DIR = r"c:\Users\LGU-SanPedro\Downloads\map\scratch"

def setup_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

    bpy.ops.import_scene.gltf(filepath=GLB_PATH)

    # Lighting: Sun + warm ambient fill
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 3.8
    sun_data.color = (1.0, 0.98, 0.92)
    sun_obj = bpy.data.objects.new("SunLight", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(48), math.radians(18), math.radians(-42))

    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 1.4
    fill_data.color = (0.75, 0.85, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(-35), math.radians(40), math.radians(135))

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

    # 1. Front Perspective: 3/4 view showing red hoop arches, radial sunburst spokes, concrete vestibule, steps
    render_shot(
        "Cam_Front_Persp",
        loc=(-5.2, -15.5, 4.2),
        rot=(math.radians(74), 0, math.radians(-22)),
        out_filename="sh3_front_perspective.png"
    )

    # 2. Vestibule Close-up: Right front corner showing concrete vestibule, doors, purple jerrycan, roof chair
    render_shot(
        "Cam_Vestibule",
        loc=(1.2, -12.8, 2.6),
        rot=(math.radians(80), 0, math.radians(-6)),
        out_filename="sh3_vestibule_closeup.png"
    )

    # 3. Sunburst Gable Elevation: Front eye-level view highlighting concentric arch & radial sunburst spokes
    render_shot(
        "Cam_Sunburst_Gable",
        loc=(0.0, -14.2, 3.2),
        rot=(math.radians(82), 0, 0),
        out_filename="sh3_sunburst_gable.png"
    )

    # 4. Aerial Overview: Elevated overview showing full length, black shade net flank, rear bench, structure
    render_shot(
        "Cam_Aerial",
        loc=(-11.5, -8.0, 12.0),
        rot=(math.radians(52), 0, math.radians(-62)),
        out_filename="sh3_aerial_overview.png"
    )

    print("All verification shots rendered successfully!")

run()

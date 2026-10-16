import bpy
import math
import os
from mathutils import Vector

def render_verification_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100

    cam = bpy.data.objects.get("Verification_Cam")
    if not cam:
        cam_data = bpy.data.cameras.new("Verification_Cam")
        cam = bpy.data.objects.new("Verification_Cam", cam_data)
        bpy.context.collection.objects.link(cam)
    scene.camera = cam

    # Main Sun light (South-West)
    sun = bpy.data.objects.get("Verification_Sun")
    if not sun:
        sun_data = bpy.data.lights.new("Verification_Sun", type='SUN')
        sun = bpy.data.objects.new("Verification_Sun", sun_data)
        bpy.context.collection.objects.link(sun)
    sun.data.energy = 4.0
    sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))

    # Fill Sun light (North-East)
    fill = bpy.data.objects.get("Verification_Fill")
    if not fill:
        fill_data = bpy.data.lights.new("Verification_Fill", type='SUN')
        fill = bpy.data.objects.new("Verification_Fill", fill_data)
        bpy.context.collection.objects.link(fill)
    fill.data.energy = 3.0
    fill.rotation_euler = (math.radians(45), math.radians(-20), math.radians(145))

    # Ambient environment lighting
    if scene.world:
        scene.world.use_nodes = True
        bg = scene.world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs['Color'].default_value = (0.85, 0.90, 0.95, 1.0)
            bg.inputs['Strength'].default_value = 1.0

    def look_at(cam_obj, target_vec):
        direction = target_vec - cam_obj.location
        rot_quat = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot_quat.to_euler()

    views = [
        {
            "name": "rsbsa_topdown_roof.png",
            "loc": Vector((-0.5, -3.5, 38.0)),
            "rot": (0, 0, 0),
            "lens": 42
        },
        {
            "name": "rsbsa_front_IMG_3833.png",
            "loc": Vector((-4.5, -24.0, 3.8)),
            "target": Vector((-4.5, -13.0, 1.8)),
            "lens": 36
        },
        {
            "name": "rsbsa_perspective_IMG_3834.png",
            "loc": Vector((+7.5, -22.5, 5.0)),
            "target": Vector((-1.0, -11.0, 1.8)),
            "lens": 35
        },
        {
            "name": "rsbsa_recess_east_IMG_3835.png",
            "loc": Vector((+15.5, -8.0, 4.0)),
            "target": Vector((+6.0, -2.5, 1.8)),
            "lens": 34
        },
        {
            "name": "rsbsa_rear_IMG_3836.png",
            "loc": Vector((-2.5, +17.0, 5.0)),
            "target": Vector((-2.5, +4.5, 1.8)),
            "lens": 35
        }
    ]

    out_dir = r"c:\Users\LGU-SanPedro\Downloads\map"
    for v in views:
        cam.location = v["loc"]
        if "rot" in v:
            cam.rotation_euler = v["rot"]
        else:
            look_at(cam, v["target"])
        cam.data.lens = v["lens"]
        out_path = os.path.join(out_dir, v["name"])
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        print(f"Rendered: {out_path}")

render_verification_views()

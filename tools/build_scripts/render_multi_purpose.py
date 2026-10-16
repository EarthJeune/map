import bpy
import math
import mathutils
import os

def look_at(cam, target):
    loc = cam.location
    direction = target - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()

def render_preview(filepath, cam_loc, target_loc=None, rot_euler=None, fov=45.0, is_ortho=False, ortho_scale=26.0):
    scene = bpy.context.scene
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = filepath
    
    cam = bpy.data.objects.get("RenderCamera")
    if not cam:
        cam_data = bpy.data.cameras.new("RenderCamera")
        cam = bpy.data.objects.new("RenderCamera", cam_data)
        scene.collection.objects.link(cam)
        
    cam.location = cam_loc
    cam.data.lens = fov
    if is_ortho:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho_scale
    else:
        cam.data.type = 'PERSP'
        
    if rot_euler is not None:
        cam.rotation_euler = rot_euler
    elif target_loc is not None:
        look_at(cam, target_loc)
        
    scene.camera = cam
    
    # Lighting
    for light_name in ["SunLight", "FillLight"]:
        old_l = bpy.data.objects.get(light_name)
        if old_l:
            bpy.data.objects.remove(old_l, do_unlink=True)
            
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 3.8
    sun_data.color = (1.0, 0.98, 0.93)
    sun = bpy.data.objects.new(name="SunLight", object_data=sun_data)
    sun.rotation_euler = (math.radians(45), math.radians(25), math.radians(-40))
    scene.collection.objects.link(sun)
    
    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 2.0
    fill_data.color = (0.75, 0.85, 1.0)
    fill = bpy.data.objects.new(name="FillLight", object_data=fill_data)
    fill.rotation_euler = (math.radians(35), math.radians(-30), math.radians(140))
    scene.collection.objects.link(fill)
    
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.10, 0.12, 0.15, 1.0)
        bg.inputs['Strength'].default_value = 1.0
        
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {filepath}")

out_dir = r"c:\Users\LGU-SanPedro\Downloads\map\renders"

# 1. Top-Down Orthographic View (matching Top View.jpg)
render_preview(
    os.path.join(out_dir, "multi_purpose_top_down.png"),
    cam_loc=mathutils.Vector((0.0, 0.0, 35.0)),
    rot_euler=(0.0, 0.0, 0.0),
    is_ortho=True,
    ortho_scale=25.0
)

# 2. Front Perspective Eye Level (matching IMG_3844)
render_preview(
    os.path.join(out_dir, "multi_purpose_front_eye_level.png"),
    cam_loc=mathutils.Vector((0.0, -20.0, 3.2)),
    target_loc=mathutils.Vector((0.0, -3.0, 1.8)),
    fov=42.0
)

# 3. 3/4 Perspective View
render_preview(
    os.path.join(out_dir, "multi_purpose_perspective.png"),
    cam_loc=mathutils.Vector((-16.0, -18.0, 10.0)),
    target_loc=mathutils.Vector((0.0, 0.0, 2.0)),
    fov=40.0
)

# 4. Courtyard Covered Walkway (matching IMG_3896, IMG_3897)
render_preview(
    os.path.join(out_dir, "multi_purpose_courtyard_walkway.png"),
    cam_loc=mathutils.Vector((2.9, -7.0, 1.6)),
    target_loc=mathutils.Vector((0.5, -4.0, 1.6)),
    fov=38.0
)

# 5. Right Flank (facing Dormitory breezeway, matching IMG_3846, IMG_3847)
render_preview(
    os.path.join(out_dir, "multi_purpose_right_flank.png"),
    cam_loc=mathutils.Vector((18.0, 0.0, 3.5)),
    target_loc=mathutils.Vector((7.0, 0.0, 2.0)),
    fov=40.0
)

# 6. Left Flank (matching IMG_3855, IMG_3889)
render_preview(
    os.path.join(out_dir, "multi_purpose_left_flank.png"),
    cam_loc=mathutils.Vector((-18.0, 0.0, 3.5)),
    target_loc=mathutils.Vector((-7.0, 0.0, 2.0)),
    fov=40.0
)

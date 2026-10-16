"""
render_tc_verification.py - Render exact verification views for Tissue Culture Laboratory
"""
import bpy
import math

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 800

# Camera
cam = bpy.data.objects.get('Camera')
if not cam:
    cd = bpy.data.cameras.new('Camera')
    cam = bpy.data.objects.new('Camera', cd)
    bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

# Lighting
sun = bpy.data.objects.get("Sun_Light")
if not sun:
    s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
    sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
    bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 4.2
sun.location = (15.0, -18.0, 22.0)
sun.rotation_euler = (math.radians(50), math.radians(15), math.radians(-35))

fill = bpy.data.objects.get("Fill_Light")
if not fill:
    f_data = bpy.data.lights.new(name="Fill_Light", type='SUN')
    fill = bpy.data.objects.new("Fill_Light", object_data=f_data)
    bpy.context.scene.collection.objects.link(fill)
fill.data.energy = 2.0
fill.rotation_euler = (math.radians(65), math.radians(-20), math.radians(45))

# View 1: Matching User Screenshot 1 (Front-right elevated 3/4 perspective)
cam.location = (12.5, -24.0, 11.0)
cam.rotation_euler = (math.radians(72), 0, math.radians(30))
cam.data.lens = 32
bpy.context.scene.render.filepath = r'c:\Users\LGU-SanPedro\Downloads\map\scratch\tc_user_view_match.png'
bpy.ops.render.render(write_still=True)
print("Rendered tc_user_view_match.png")

# View 2: Matching User Screenshot 2 (Entrance canopy close-up)
cam.location = (-0.5, -16.5, 3.8)
cam.rotation_euler = (math.radians(84), 0, math.radians(-5))
cam.data.lens = 42
bpy.context.scene.render.filepath = r'c:\Users\LGU-SanPedro\Downloads\map\scratch\tc_canopy_close.png'
bpy.ops.render.render(write_still=True)
print("Rendered tc_canopy_close.png")

# View 3: Right flank side view (matching IMG_3839 angle)
cam.location = (16.0, -14.0, 6.0)
cam.rotation_euler = (math.radians(76), 0, math.radians(52))
cam.data.lens = 30
bpy.context.scene.render.filepath = r'c:\Users\LGU-SanPedro\Downloads\map\scratch\tc_right_flank_side.png'
bpy.ops.render.render(write_still=True)
print("Rendered tc_right_flank_side.png")

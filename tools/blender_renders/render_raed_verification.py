"""
render_raed_verification.py - Render exact verification views for RAED building
"""
import bpy
import math

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 800

# Camera setup
cam = bpy.data.objects.get('Camera')
if not cam:
    cd = bpy.data.cameras.new('Camera')
    cam = bpy.data.objects.new('Camera', cd)
    bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

# Sunlight & ambient lighting
sun = bpy.data.objects.get("Sun_Light")
if not sun:
    s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
    sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
    bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 4.5
sun.location = (10.0, -15.0, 20.0)
sun.rotation_euler = (math.radians(52), math.radians(15), math.radians(-30))

# Fill light
fill = bpy.data.objects.get("Fill_Light")
if not fill:
    f_data = bpy.data.lights.new(name="Fill_Light", type='SUN')
    fill = bpy.data.objects.new("Fill_Light", object_data=f_data)
    bpy.context.scene.collection.objects.link(fill)
fill.data.energy = 2.0
fill.rotation_euler = (math.radians(65), math.radians(-20), math.radians(45))

# View 1: Overview matching user screenshot 1
cam.location = (0.0, -20.0, 10.5)
cam.rotation_euler = (math.radians(63), 0, 0)
cam.data.lens = 32
bpy.context.scene.render.filepath = r'c:\Users\LGU-SanPedro\Downloads\map\scratch\raed_clean_overview.png'
bpy.ops.render.render(write_still=True)
print("Rendered raed_clean_overview.png")

# View 2: Close-up angled view of the canopy & sign matching user screenshot 2
# Corner of canopy is at (-2.4, -8.92, 3.24)
cam.location = (-4.8, -12.5, 4.2)
cam.rotation_euler = (math.radians(76), 0, math.radians(-34))
cam.data.lens = 35
bpy.context.scene.render.filepath = r'c:\Users\LGU-SanPedro\Downloads\map\scratch\raed_sign_close_angle.png'
bpy.ops.render.render(write_still=True)
print("Rendered raed_sign_close_angle.png")

# View 3: Full front elevation of the canopy & sign
cam.location = (0.0, -15.5, 3.24)
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.lens = 45
bpy.context.scene.render.filepath = r'c:\Users\LGU-SanPedro\Downloads\map\scratch\raed_sign_front.png'
bpy.ops.render.render(write_still=True)
print("Rendered raed_sign_front.png")

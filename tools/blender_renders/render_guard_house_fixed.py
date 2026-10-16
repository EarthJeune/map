import bpy
import math
import os

# Ensure Guard House objects are visible, hide others
for obj in bpy.data.objects:
    if obj.type in ['CAMERA', 'LIGHT']:
        continue
    if obj.name.startswith("GH_"):
        obj.hide_viewport = False
        obj.hide_render = False
    else:
        obj.hide_viewport = True
        obj.hide_render = True

# Camera setup
cam = bpy.data.objects.get('Camera')
if not cam:
    cd = bpy.data.cameras.new('Camera')
    cam = bpy.data.objects.new('Camera', cd)
    bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

# Sun lighting
sun = bpy.data.objects.get("Sun_Light")
if not sun:
    s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
    sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
    bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 4.0
sun.location = (5.0, -12.0, 15.0)
sun.rotation_euler = (math.radians(52), math.radians(10), math.radians(-20))

bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 720

# 1. Matching user screenshot elevated front view
# Front is -Y, elevated looking down
cam.location = (0.55, -8.2, 5.2)
cam.rotation_euler = (math.radians(60), 0, 0)
cam.data.lens = 35
out1 = r"c:\Users\LGU-SanPedro\Downloads\map\guard_house_user_view.png"
bpy.context.scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print("Rendered:", out1)

# 2. 3/4 perspective elevated view
cam.location = (-6.0, -7.5, 4.5)
cam.rotation_euler = (math.radians(64), 0, math.radians(-38))
cam.data.lens = 32
out2 = r"c:\Users\LGU-SanPedro\Downloads\map\guard_house_clean_perspective.png"
bpy.context.scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print("Rendered:", out2)

# 3. Right flank view (where the wall and tall sign were previously located)
cam.location = (6.5, -4.0, 3.2)
cam.rotation_euler = (math.radians(70), 0, math.radians(56))
cam.data.lens = 35
out3 = r"c:\Users\LGU-SanPedro\Downloads\map\guard_house_right_flank.png"
bpy.context.scene.render.filepath = out3
bpy.ops.render.render(write_still=True)
print("Rendered:", out3)

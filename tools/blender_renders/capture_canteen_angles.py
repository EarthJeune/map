import bpy
import math

def capture_canteen_angles():
    # Isolate Canteen objects
    for obj in bpy.data.objects:
        if obj.type in ['CAMERA', 'LIGHT']:
            continue
        if obj.name.startswith("Canteen_"):
            obj.hide_render = False
            obj.hide_viewport = False
        else:
            obj.hide_render = True
            obj.hide_viewport = True

    cam = bpy.data.objects.get("Camera")
    if not cam:
        cam_data = bpy.data.cameras.new("Camera")
        cam = bpy.data.objects.new("Camera", cam_data)
        bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 800

    # Ensure strong daylight
    sun = bpy.data.objects.get("Sun_Light")
    if not sun:
        s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
        s_data.energy = 4.0
        sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 4.2
    sun.location = (5.0, -15.0, 15.0)
    sun.rotation_euler = (math.radians(48), math.radians(10), math.radians(-25))

    # Helper function to point camera at target
    def look_at(cam, loc, target):
        cam.location = loc
        dx = target[0] - loc[0]
        dy = target[1] - loc[1]
        dz = target[2] - loc[2]
        dist_xy = math.hypot(dx, dy)
        rot_z = math.atan2(dx, -dy)
        rot_x = math.atan2(dz, dist_xy) + math.radians(90)
        cam.rotation_euler = (rot_x, 0, rot_z)

    # 1. Front Facade View (Matching IMG_3793)
    cam.data.lens = 32
    look_at(cam, (1.2, -16.5, 2.3), (1.2, -4.0, 2.4))
    bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\canteen_front_facade.png"
    bpy.ops.render.opengl(write_still=True)
    print("Rendered canteen_front_facade.png")

    # 2. South-West Corner View (Matching IMG_3794)
    cam.data.lens = 30
    look_at(cam, (-14.0, -14.5, 3.2), (-1.5, -2.0, 2.2))
    bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\canteen_perspective.png"
    bpy.ops.render.opengl(write_still=True)
    print("Rendered canteen_perspective.png")

    # 3. Elevated Overview (Aerial Roof & Campus Context)
    cam.data.lens = 35
    look_at(cam, (-12.0, -18.0, 11.0), (0.0, 0.0, 2.5))
    bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\canteen_aerial.png"
    bpy.ops.render.opengl(write_still=True)
    print("Rendered canteen_aerial.png")

capture_canteen_angles()

import bpy
import math

def take_argosino_detailed_shots():
    # Isolate Argosino objects
    for obj in bpy.data.objects:
        if obj.type in ['CAMERA', 'LIGHT']:
            continue
        if obj.name.startswith("Argosino_"):
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

    # Set wide-angle lens (28mm) for immersive eye-level shots
    cam.data.lens = 28
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 960

    # Ensure lighting
    sun = bpy.data.objects.get("Sun_Light")
    if sun:
        sun.data.energy = 3.5
        sun.location = (10, 15, 20)
        sun.rotation_euler = (math.radians(50), math.radians(15), math.radians(45))

    # Point light inside veranda ceiling to illuminate the interior features
    v_light = bpy.data.objects.get("Veranda_Light")
    if not v_light:
        l_data = bpy.data.lights.new(name="Veranda_Light", type='POINT')
        l_data.energy = 80.0
        l_data.shadow_soft_size = 0.5
        v_light = bpy.data.objects.new(name="Veranda_Light", object_data=l_data)
        bpy.context.scene.collection.objects.link(v_light)
    v_light.location = (7.4, 4.8, 3.2)

    # 1. Direct shot looking into the veranda: Kiosk, Plaque, Glass doors, Floor tiles, Whiteboard
    cam.location = (8.2, 10.5, 1.55)
    target = (6.8, 3.8, 1.25)
    dx = target[0] - cam.location.x
    dy = target[1] - cam.location.y
    dz = target[2] - cam.location.z
    dist_xy = math.hypot(dx, dy)
    rot_z = math.atan2(dx, -dy)
    rot_x = math.atan2(dz, dist_xy) + math.radians(90)
    cam.rotation_euler = (rot_x, 0, rot_z)

    bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\argosino_veranda_kiosk.png"
    bpy.ops.render.opengl(write_still=True)
    print("Rendered close-up argosino_veranda_kiosk.png")

    # 2. Medium elevated view showing the courtyard corner, connector canopy, and hipped roof
    cam.data.lens = 35
    cam.location = (17.0, 16.0, 8.5)
    target = (4.0, 2.0, 2.0)
    dx = target[0] - cam.location.x
    dy = target[1] - cam.location.y
    dz = target[2] - cam.location.z
    dist_xy = math.hypot(dx, dy)
    rot_z = math.atan2(dx, -dy)
    rot_x = math.atan2(dz, dist_xy) + math.radians(90)
    cam.rotation_euler = (rot_x, 0, rot_z)

    bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\argosino_roof_overview.png"
    bpy.ops.render.opengl(write_still=True)
    print("Rendered medium elevated argosino_roof_overview.png")

take_argosino_detailed_shots()

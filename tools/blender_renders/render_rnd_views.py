import bpy
import math
import os

def render_views():
    # Clear any leftover cameras and lights
    for obj in list(bpy.data.objects):
        if obj.type in ('CAMERA', 'LIGHT'):
            bpy.data.objects.remove(obj)

    # Sunlight
    light_data = bpy.data.lights.new("Sun", type='SUN')
    light_data.energy = 3.5
    light_obj = bpy.data.objects.new("Sun", light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.rotation_euler = (math.radians(48), math.radians(22), math.radians(-35))

    # Fill light
    fill_data = bpy.data.lights.new("Fill", type='SUN')
    fill_data.energy = 1.2
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(30), math.radians(-20), math.radians(130))

    # World background
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.75, 0.82, 0.92, 1.0)
        bg.inputs['Strength'].default_value = 1.0

    # Ground plane for soft contact shadow
    bpy.ops.mesh.primitive_plane_add(size=80.0, location=(0, 0, 0))
    plane = bpy.context.active_object
    mat_ground = bpy.data.materials.new("GroundPlane")
    mat_ground.use_nodes = True
    bsdf = mat_ground.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.55, 0.60, 0.52, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.9
    plane.data.materials.append(mat_ground)

    # Render settings
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720

    # Camera 1: Front Elevation Beauty Shot
    cam_data1 = bpy.data.cameras.new("FrontCam")
    cam_data1.lens = 38 # calibrated framing to capture full facade
    cam1 = bpy.data.objects.new("FrontCam", cam_data1)
    bpy.context.collection.objects.link(cam1)
    cam1.location = (0.0, -32.0, 5.0)
    cam1.rotation_euler = (math.radians(84), 0, 0)

    bpy.context.scene.camera = cam1
    out_front = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\rnd_front_elevation.png"
    bpy.context.scene.render.filepath = out_front
    bpy.ops.render.render(write_still=True)
    print(f"Front render saved: {out_front}")

    # Camera 2: 3/4 Perspective View showing Front, Left Fire Escape, Rooftop Balcony
    cam_data2 = bpy.data.cameras.new("PerspCam")
    cam_data2.lens = 32
    cam2 = bpy.data.objects.new("PerspCam", cam_data2)
    bpy.context.collection.objects.link(cam2)
    cam2.location = (-24.0, -22.0, 11.0)
    cam2.rotation_euler = (math.radians(68), 0, math.radians(-48))

    bpy.context.scene.camera = cam2
    out_persp = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\rnd_persp_beauty.png"
    bpy.context.scene.render.filepath = out_persp
    bpy.ops.render.render(write_still=True)
    print(f"Perspective render saved: {out_persp}")

    # Camera 3: Aerial Rooftop View matching user screenshot angle
    cam_data3 = bpy.data.cameras.new("AerialCam")
    cam_data3.lens = 35
    cam3 = bpy.data.objects.new("AerialCam", cam_data3)
    bpy.context.collection.objects.link(cam3)
    cam3.location = (20.0, -22.0, 18.0)
    cam3.rotation_euler = (math.radians(52), 0, math.radians(45))

    bpy.context.scene.camera = cam3
    out_aerial = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\rnd_roof_aerial.png"
    bpy.context.scene.render.filepath = out_aerial
    bpy.ops.render.render(write_still=True)
    print(f"Aerial roof render saved: {out_aerial}")

    # Clean up ground plane
    bpy.data.objects.remove(plane)

render_views()

import bpy
import math
import os

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import GLB
glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_chemical_storage.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

# Set world lighting
world = bpy.data.worlds.new("OutdoorWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs['Color'].default_value = (0.85, 0.90, 0.96, 1.0)
    bg_node.inputs['Strength'].default_value = 1.2

# Sun light (natural sunlight from SE)
sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
sun_data.energy = 4.0
sun_data.angle = math.radians(10.0)
sun_obj = bpy.data.objects.new(name="SunLight", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(-40))

# Fill light from opposite side
fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_data.energy = 1.5
fill_obj = bpy.data.objects.new(name="FillLight", object_data=fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(45), math.radians(-25), math.radians(140))

# Ground plane for shadows
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, -0.01))
ground = bpy.context.active_object
ground_mat = bpy.data.materials.new(name="GroundMat")
ground_mat.use_nodes = True
g_bsdf = ground_mat.node_tree.nodes.get("Principled BSDF")
if g_bsdf:
    g_bsdf.inputs['Base Color'].default_value = (0.35, 0.45, 0.30, 1.0)
    g_bsdf.inputs['Roughness'].default_value = 0.95
ground.data.materials.append(ground_mat)

# Camera setup
cam_data = bpy.data.cameras.new("RenderCam")
cam_data.lens = 35
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Render settings
scene = bpy.context.scene
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 90

out_dir = r"c:\Users\LGU-SanPedro\Downloads\map\scratch"
os.makedirs(out_dir, exist_ok=True)

views = [
    {
        "name": "rares_chem_front_perspective.jpg",
        "loc": (0.0, -16.0, 3.8),
        "rot": (math.radians(82), 0, 0),
        "ortho": False
    },
    {
        "name": "rares_chem_left_angle.jpg",
        "loc": (-14.0, -12.0, 4.2),
        "rot": (math.radians(78), 0, math.radians(-50)),
        "ortho": False
    },
    {
        "name": "rares_chem_right_angle.jpg",
        "loc": (14.0, -12.0, 4.2),
        "rot": (math.radians(78), 0, math.radians(50)),
        "ortho": False
    },
    {
        "name": "rares_chem_rear_view.jpg",
        "loc": (0.0, 16.0, 4.0),
        "rot": (math.radians(82), 0, math.radians(180)),
        "ortho": False
    },
    {
        "name": "rares_chem_topdown.jpg",
        "loc": (0.0, 0.0, 24.0),
        "rot": (0, 0, 0),
        "ortho": True,
        "ortho_scale": 16.0
    }
]

for v in views:
    cam_obj.location = v["loc"]
    cam_obj.rotation_euler = v["rot"]
    if v.get("ortho"):
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = v.get("ortho_scale", 16.0)
    else:
        cam_data.type = 'PERSP'
        cam_data.lens = 35

    out_file = os.path.join(out_dir, v["name"])
    scene.render.filepath = out_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {out_file}")

print("All Chemical Storage Blender renders complete!")


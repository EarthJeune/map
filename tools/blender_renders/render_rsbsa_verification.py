
import bpy
import math
import os

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

glb_path = r'c:\Users\LGU-SanPedro\Downloads\map\models\rsbsa_building.glb'
bpy.ops.import_scene.gltf(filepath=glb_path)

world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new('World')
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
if bg:
    bg.inputs['Color'].default_value = (0.80, 0.85, 0.92, 1.0)
    bg.inputs['Strength'].default_value = 1.3

sun_data = bpy.data.lights.new(name='Sun', type='SUN')
sun_data.energy = 4.0
sun_data.color = (1.0, 0.98, 0.94)
sun_obj = bpy.data.objects.new(name='Sun', object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(45))

fill_data = bpy.data.lights.new(name='Fill', type='SUN')
fill_data.energy = 1.5
fill_data.color = (0.82, 0.88, 1.0)
fill_obj = bpy.data.objects.new(name='Fill', object_data=fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-135))

cam_data = bpy.data.cameras.new(name='Cam')
cam_obj = bpy.data.objects.new(name='Cam', object_data=cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.lens = 35
cam_data.clip_start = 0.1
cam_data.clip_end = 200

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 800
bpy.context.scene.render.film_transparent = False

views = [
    # 1. Front 3/4 perspective (stair, stone veneer, commercial doors, cantilever beam, zero rebar)
    ('scratch/rsbsa_preview_front.png', (1.0, -26.0, 7.5), (math.radians(76), 0, math.radians(5))),
    # 2. Front-Right angle (IMG_3834 view: porch veranda, tree angle, DRRMIS banner, nook)
    ('scratch/rsbsa_preview_img3834_angle.png', (15.0, -21.0, 6.0), (math.radians(75), 0, math.radians(35))),
    # 3. Recessed East nook behind tree (IMG_3835 view: 3 tall windows, AC units, overhang)
    ('scratch/rsbsa_preview_img3835_nook.png', (14.0, -9.0, 2.8), (math.radians(82), 0, math.radians(65))),
    # 4. Rear view (watertight roof, zero gaps, stepped rear walls)
    ('scratch/rsbsa_preview_rear.png', (1.0, 19.0, 11.0), (math.radians(62), 0, math.radians(180))),
    # 5. Top-down view (Image 5 comparison)
    ('scratch/rsbsa_preview_topdown.png', (1.2, -4.0, 36.0), (0, 0, 0))
]

for out_path, pos, rot in views:
    cam_obj.location = pos
    cam_obj.rotation_euler = rot
    bpy.context.scene.render.filepath = os.path.abspath(out_path)
    bpy.ops.render.render(write_still=True)
    print(f'Rendered {out_path}')

print('All renders complete!')

import bpy
import math
import os

# Clear scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

glb_path = r'c:\Users\LGU-SanPedro\Downloads\map\models\rcpc_building.glb'
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
sun_data.energy = 4.2
sun_data.color = (1.0, 0.98, 0.94)
sun_obj = bpy.data.objects.new(name='Sun', object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(-20), math.radians(-45))

fill_data = bpy.data.lights.new(name='Fill', type='SUN')
fill_data.energy = 1.8
fill_data.color = (0.82, 0.88, 1.0)
fill_obj = bpy.data.objects.new(name='Fill', object_data=fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(50), math.radians(25), math.radians(135))

cam_data = bpy.data.cameras.new(name='Cam')
cam_obj = bpy.data.objects.new(name='Cam', object_data=cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.lens = 32
cam_data.clip_start = 0.1
cam_data.clip_end = 200

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 800
bpy.context.scene.render.film_transparent = False

views = [
    # 1. Front Facade (IMG_3841 perspective: width 14.0m, window on left, 6-step stair, green door, cheek wall & handrail on right)
    ('scratch/rcpc_preview_front.png', (0.0, -32.0, 4.5), (math.radians(82), 0, math.radians(0))),
    # 2. Right Facade (IMG_3840 perspective: length 27.1m, portico with "RCPC CALABARZON", double doors, ADA ramp, stacked ACs)
    ('scratch/rcpc_preview_right.png', (-42.0, 0.0, 5.5), (math.radians(83), 0, math.radians(-90))),
    # 3. Front-Right 3/4 Perspective (showing both front IMG_3841 and right IMG_3840 facades)
    ('scratch/rcpc_preview_iso.png', (-26.0, -30.0, 14.0), (math.radians(65), 0, math.radians(-40))),
    # 4. Close-up of Right Entrance Portico, Sign & ADA Ramp
    ('scratch/rcpc_preview_portico_close.png', (-19.0, 0.0, 3.2), (math.radians(85), 0, math.radians(-90))),
]

for out_path, pos, rot in views:
    cam_obj.location = pos
    cam_obj.rotation_euler = rot
    bpy.context.scene.render.filepath = os.path.abspath(out_path)
    bpy.ops.render.render(write_still=True)
    print(f'Rendered {out_path}')

print('All renders complete!')

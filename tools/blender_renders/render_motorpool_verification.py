import bpy
import math
import os

# Clear scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

glb_path = r'c:\Users\LGU-SanPedro\Downloads\map\models\motorpool_barracks.glb'
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
    # 1. Front Facade (matching IMG_3842 perspective: looking at -Y facade from front-left)
    ('scratch/mb_preview_front.png', (-10.0, -22.0, 3.8), (math.radians(82), 0, math.radians(-20))),
    # 2. Front Straight-on View
    ('scratch/mb_preview_straight.png', (1.5, -24.0, 4.0), (math.radians(83), 0, math.radians(0))),
    # 3. South-West 3/4 Perspective (showing open workshop porch, bench, bike, lower roof)
    ('scratch/mb_preview_porch.png', (16.0, -18.0, 5.0), (math.radians(78), 0, math.radians(35))),
    # 4. High Roof Angle (showing the stepped roof layout)
    ('scratch/mb_preview_roof.png', (1.0, -16.0, 16.0), (math.radians(52), 0, math.radians(0))),
]

for out_path, pos, rot in views:
    cam_obj.location = pos
    cam_obj.rotation_euler = rot
    bpy.context.scene.render.filepath = os.path.abspath(out_path)
    bpy.ops.render.render(write_still=True)
    print(f'Rendered {out_path}')

# Now let's also render BOTH RCPC and Motorpool Barracks together in the scene!
# RCPC centroid in MB coordinates: X = -15.51 m, Y = +5.06 m, Z = 0
rcpc_glb = r'c:\Users\LGU-SanPedro\Downloads\map\models\rcpc_building.glb'
bpy.ops.import_scene.gltf(filepath=rcpc_glb)

# The imported RCPC objects are currently selected
for obj in bpy.context.selected_objects:
    if obj.parent is None:
        obj.location = (-15.51, 5.06, 0.0)

# Render together from Front-West view (showing how they sit side by side without overlapping)
cam_obj.location = (-14.0, -32.0, 14.0)
cam_obj.rotation_euler = (math.radians(68), 0, math.radians(-15))
bpy.context.scene.render.filepath = os.path.abspath('scratch/mb_rcpc_together.png')
bpy.ops.render.render(write_still=True)
print('Rendered scratch/mb_rcpc_together.png')

# Close-up of the seam / gap between RCPC and Motorpool
cam_obj.location = (-11.0, -16.0, 4.5)
cam_obj.rotation_euler = (math.radians(80), 0, math.radians(-15))
bpy.context.scene.render.filepath = os.path.abspath('scratch/mb_rcpc_gap_close.png')
bpy.ops.render.render(write_still=True)
print('Rendered scratch/mb_rcpc_gap_close.png')

print('All renders complete!')

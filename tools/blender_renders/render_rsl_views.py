import bpy
import math
import os

OUT_DIR = r"c:\Users\LGU-SanPedro\Downloads\map\scratch"
os.makedirs(OUT_DIR, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100

world = scene.world
if not world:
    world = bpy.data.worlds.new("World")
    scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs['Color'].default_value = (0.75, 0.85, 0.95, 1.0)
    bg_node.inputs['Strength'].default_value = 1.0

# Target focus empty
target = bpy.data.objects.get("CamTarget")
if not target:
    target = bpy.data.objects.new("CamTarget", None)
    bpy.context.collection.objects.link(target)
target.location = (0.0, -5.0, 2.5)

# Camera setup
cam = bpy.data.objects.get("RenderCam")
if not cam:
    cam_data = bpy.data.cameras.new("RenderCam")
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.collection.objects.link(cam)
scene.camera = cam

# Clear existing camera constraints
cam.constraints.clear()
track = cam.constraints.new(type='TRACK_TO')
track.target = target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'
cam.data.lens = 35
cam.data.clip_end = 200.0

# Add or reposition Sun light
sun = bpy.data.objects.get("RenderSun")
if not sun:
    sun_data = bpy.data.lights.new(name="RenderSun", type='SUN')
    sun = bpy.data.objects.new("RenderSun", sun_data)
    bpy.context.collection.objects.link(sun)
sun.data.energy = 2.8
sun.data.color = (1.0, 0.96, 0.88)
sun.rotation_euler = (math.radians(48), math.radians(16), math.radians(-38))

# Add Fill light
fill = bpy.data.objects.get("RenderFill")
if not fill:
    fill_data = bpy.data.lights.new(name="RenderFill", type='SUN')
    fill = bpy.data.objects.new("RenderFill", fill_data)
    bpy.context.collection.objects.link(fill)
fill.data.energy = 1.2
fill.data.color = (0.80, 0.88, 0.98)
fill.rotation_euler = (math.radians(65), math.radians(-25), math.radians(130))

# View 1: Front Elevation (focus on front facade at Y = -13.8)
target.location = (0.0, -13.8, 2.5)
cam.location = (0.0, -32.0, 4.0)
bpy.context.view_layer.update()
scene.render.filepath = os.path.join(OUT_DIR, "rsl_view_front.png")
bpy.ops.render.render(write_still=True)
print("Rendered rsl_view_front.png")

# View 2: 3/4 Perspective View (Front + Right Flank)
target.location = (3.0, -6.0, 2.5)
cam.location = (26.0, -28.0, 9.0)
bpy.context.view_layer.update()
scene.render.filepath = os.path.join(OUT_DIR, "rsl_view_perspective.png")
bpy.ops.render.render(write_still=True)
print("Rendered rsl_view_perspective.png")

# View 3: Left Perspective (Entrance Porch & Left Flank)
target.location = (-4.0, -10.0, 2.5)
cam.location = (-22.0, -26.0, 7.5)
bpy.context.view_layer.update()
scene.render.filepath = os.path.join(OUT_DIR, "rsl_view_entrance_left.png")
bpy.ops.render.render(write_still=True)
print("Rendered rsl_view_entrance_left.png")

# View 4: Close-up Entrance & Canopy (matching user's angle)
target.location = (-4.0, -13.8, 2.0)
cam.location = (-7.2, -18.2, 2.2)
bpy.context.view_layer.update()
scene.render.filepath = os.path.join(OUT_DIR, "rsl_view_entrance_closeup.png")
bpy.ops.render.render(write_still=True)
print("Rendered rsl_view_entrance_closeup.png")


import bpy
import math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_2.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("RenderWorld")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs['Color'].default_value = (0.90, 0.93, 0.96, 1.0)
    bg.inputs['Strength'].default_value = 1.1

bpy.ops.object.light_add(type='SUN', location=(10, -15, 20))
sun = bpy.context.active_object
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(52), math.radians(15), math.radians(-30))

bpy.ops.object.light_add(type='SUN', location=(-12, -10, 12))
fill = bpy.context.active_object
fill.data.energy = 1.4
fill.rotation_euler = (math.radians(60), math.radians(-20), math.radians(35))

bpy.ops.object.camera_add()
cam = bpy.context.active_object
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.resolution_x = 1200
scene.render.resolution_y = 750
scene.render.image_settings.file_format = 'PNG'

# 1. Left Part Front View (Open Machinery Shed: Harvester & Blue Tractor)
cam.location = (-6.5, -11.5, 2.2)
cam.rotation_euler = (math.radians(84), 0, 0)
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_2_left.png"
bpy.ops.render.render(write_still=True)

# 2. Right Part Front View (Organic Fertilizer Screened Room & Open Doorway)
cam.location = (5.0, -12.0, 2.0)
cam.rotation_euler = (math.radians(85), 0, 0)
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_2_right.png"
bpy.ops.render.render(write_still=True)

# 3. Full Isometric 3/4 View (showing 50/50 Silver & Rust roof + full 22.44m facade)
cam.location = (0.0, -22.5, 11.5)
cam.rotation_euler = (math.radians(64), 0, 0)
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_2_iso.png"
bpy.ops.render.render(write_still=True)
print("Rendered all 3 Warehouse 2 preview views!")


import bpy
import math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import Warehouse 4 at origin (0, 0, 0)
bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_4.glb")

# Also import Warehouse 3 at its exact relative offset (-14.51m, -5.29m, 0) and relative rotation (+3.05 deg around Z)!
bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_3.glb")
for obj in bpy.context.selected_objects:
    if obj.parent is None:
        obj.location = (-14.51, -5.29, 0.0)
        obj.rotation_euler = (0.0, 0.0, math.radians(3.05))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 800

world = bpy.data.worlds.new("PreviewWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.78, 0.84, 0.90, 1.0)
    bg.inputs[1].default_value = 1.25

bpy.ops.object.light_add(type='SUN', location=(10, -18, 18))
sun = bpy.context.active_object
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(48), math.radians(15), math.radians(22))

bpy.ops.object.light_add(type='SUN', location=(-12, -12, 12))
fill = bpy.context.active_object
fill.data.energy = 1.6
fill.rotation_euler = (math.radians(55), 0, math.radians(-30))

bpy.ops.mesh.primitive_plane_add(size=90.0, location=(0, 0, 0))
ground = bpy.context.active_object
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.56, 0.54, 1.0)
ground.data.materials.append(gmat)

# 1. Junction View showing Warehouse 3 + Warehouse 4 Bays 1 & 2 (matching '3 Left Part 4 Right Part.jpg' & '4 Full VIew.jpg')
bpy.ops.object.camera_add(location=(-2.5, -18.5, 2.3), rotation=(math.radians(85), 0, math.radians(-8)))
cam1 = bpy.context.active_object
scene.camera = cam1
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_4_left.png"
bpy.ops.render.render(write_still=True)

# 2. Front Elevation View of Bays 2, 3 & 4 (matching '4 Front View Middle Part.jpg' & '4 Left Part 5 Right Part.jpg')
bpy.ops.object.camera_add(location=(9.5, -17.5, 2.3), rotation=(math.radians(85), 0, math.radians(6)))
cam2 = bpy.context.active_object
scene.camera = cam2
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_4_right.png"
bpy.ops.render.render(write_still=True)

# 3. Elevated Bird's-Eye View showing the interlocking L-roof of Warehouse 4 wrapping around Warehouse 3 (matching '5c9b9b80.png')
bpy.ops.object.camera_add(location=(-1.0, -28.0, 22.0), rotation=(math.radians(46), 0, 0))
cam3 = bpy.context.active_object
scene.camera = cam3
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_4_iso.png"
bpy.ops.render.render(write_still=True)

print("Rendered all 3 Warehouse 4 preview views!")


import bpy
import math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_5.glb")

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

bpy.ops.object.light_add(type='SUN', location=(12, -20, 22))
sun = bpy.context.active_object
sun.data.energy = 3.6
sun.rotation_euler = (math.radians(48), math.radians(15), math.radians(22))

bpy.ops.object.light_add(type='SUN', location=(-18, -14, 15))
fill = bpy.context.active_object
fill.data.energy = 1.8
fill.rotation_euler = (math.radians(55), 0, math.radians(-35))

bpy.ops.mesh.primitive_plane_add(size=100.0, location=(0, 0, 0))
ground = bpy.context.active_object
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.56, 0.54, 1.0)
ground.data.materials.append(gmat)

# 1. Front Elevation View (matching '5 Front View.jpg' & '5 Front Vieww.jpg')
bpy.ops.object.camera_add(location=(-1.0, -29.0, 2.8), rotation=(math.radians(85), 0, math.radians(-3)))
cam1 = bpy.context.active_object
scene.camera = cam1
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_5_front.png"
bpy.ops.render.render(write_still=True)

# 2. West Gable & Side Loading Canopy View (matching '5 Left part of the building Vieww.jpg' & '5 Side View.jpg')
bpy.ops.object.camera_add(location=(-28.5, -16.5, 3.8), rotation=(math.radians(82), 0, math.radians(-52)))
cam2 = bpy.context.active_object
scene.camera = cam2
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_5_west.png"
bpy.ops.render.render(write_still=True)

# 3. Top-Down / Bird's-Eye View (matching drone orthophoto '768a0d78.jpg')
bpy.ops.object.camera_add(location=(0.5, -24.0, 28.0), rotation=(math.radians(42), 0, 0))
cam3 = bpy.context.active_object
scene.camera = cam3
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_5_iso.png"
bpy.ops.render.render(write_still=True)

print("Rendered all 3 Warehouse 5 preview views!")


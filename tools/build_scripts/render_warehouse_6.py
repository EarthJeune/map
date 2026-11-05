import bpy
import math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_6.glb")

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 850

world = bpy.data.worlds.new("PreviewWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.76, 0.83, 0.91, 1.0)
    bg.inputs[1].default_value = 1.30

bpy.ops.object.light_add(type='SUN', location=(10, -14, 18))
sun = bpy.context.active_object
sun.data.energy = 3.6
sun.rotation_euler = (math.radians(48), math.radians(15), math.radians(24))

bpy.ops.object.light_add(type='SUN', location=(-12, -10, 12))
fill = bpy.context.active_object
fill.data.energy = 1.8
fill.rotation_euler = (math.radians(58), 0, math.radians(-38))

bpy.ops.mesh.primitive_plane_add(size=80.0, location=(0, 0, 0))
ground = bpy.context.active_object
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.52, 0.54, 0.50, 1.0)
ground.data.materials.append(gmat)

# 1. Front Elevation View (matching '6 Front View.jpg', framing full chimney stack)
bpy.ops.object.camera_add(location=(0.0, -14.2, 2.15), rotation=(math.radians(91), 0, 0))
cam1 = bpy.context.active_object
scene.camera = cam1
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_6_front.png"
bpy.ops.render.render(write_still=True)

# 2. South-East Oblique Side View (matching '6 Side View.jpg')
bpy.ops.object.camera_add(location=(7.2, -9.8, 1.80), rotation=(math.radians(87), 0, math.radians(36)))
cam2 = bpy.context.active_object
scene.camera = cam2
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_6_side.png"
bpy.ops.render.render(write_still=True)

# 3. Bird's-Eye / Aerial Roof View (matching drone orthophoto '768a0d78.jpg')
bpy.ops.object.camera_add(location=(0.0, -7.5, 13.5), rotation=(math.radians(30), 0, 0))
cam3 = bpy.context.active_object
scene.camera = cam3
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_6_iso.png"
bpy.ops.render.render(write_still=True)

print("Rendered all 3 Warehouse 6 preview views!")

import bpy
import math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_3.glb")

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
    bg.inputs[1].default_value = 1.2

bpy.ops.object.light_add(type='SUN', location=(8, -14, 15))
sun = bpy.context.active_object
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(48), math.radians(15), math.radians(22))

bpy.ops.object.light_add(type='SUN', location=(-10, -10, 10))
fill = bpy.context.active_object
fill.data.energy = 1.6
fill.rotation_euler = (math.radians(55), 0, math.radians(-30))

bpy.ops.mesh.primitive_plane_add(size=60.0, location=(0, 0, 0))
ground = bpy.context.active_object
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.56, 0.54, 1.0)
ground.data.materials.append(gmat)

# 1. Front Elevation View (matching '3 Front View Full.jpg' & '3 Front Perimeter Fence.jpg')
bpy.ops.object.camera_add(location=(0.5, -19.5, 2.4), rotation=(math.radians(85), 0, 0))
cam1 = bpy.context.active_object
scene.camera = cam1
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_3_front.png"
bpy.ops.render.render(write_still=True)

# 2. Right Side / Isometric View (matching '3 Right Side of the building connecting to 4.jpg')
bpy.ops.object.camera_add(location=(16.5, -16.5, 4.5), rotation=(math.radians(76), 0, math.radians(44)))
cam2 = bpy.context.active_object
scene.camera = cam2
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_3_right.png"
bpy.ops.render.render(write_still=True)

# 3. Elevated Bird's-Eye View showing two-tone roof (green South slope + rust North slope) & perimeter fence
bpy.ops.object.camera_add(location=(12.5, -18.5, 13.5), rotation=(math.radians(52), 0, math.radians(34)))
cam3 = bpy.context.active_object
scene.camera = cam3
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_3_iso.png"
bpy.ops.render.render(write_still=True)

print("Rendered all 3 Warehouse 3 preview views!")

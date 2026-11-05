import bpy
import math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_7.glb")

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 850

world = bpy.data.worlds.new("PreviewWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.74, 0.82, 0.91, 1.0)
    bg.inputs[1].default_value = 1.30

bpy.ops.object.light_add(type='SUN', location=(14, -22, 24))
sun = bpy.context.active_object
sun.data.energy = 3.6
sun.rotation_euler = (math.radians(48), math.radians(15), math.radians(24))

bpy.ops.object.light_add(type='SUN', location=(-20, -16, 16))
fill = bpy.context.active_object
fill.data.energy = 1.8
fill.rotation_euler = (math.radians(56), 0, math.radians(-38))

bpy.ops.mesh.primitive_plane_add(size=120.0, location=(0, 0, 0))
ground = bpy.context.active_object
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
gmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.50, 0.52, 0.48, 1.0)
ground.data.materials.append(gmat)

# 1. Main Front Elevation View (matching '7 Front View.jpg' & '7 View from the right.jpg')
bpy.ops.object.camera_add(location=(2.0, -28.5, 2.8), rotation=(math.radians(86), 0, math.radians(2)))
cam1 = bpy.context.active_object
scene.camera = cam1
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_7_front.png"
bpy.ops.render.render(write_still=True)

# 2. South-West Junction & Lime-Green Annex View (matching '7 small building in left...jpg' & '7 Small building.jpg')
bpy.ops.object.camera_add(location=(-17.5, -18.5, 2.7), rotation=(math.radians(85), 0, math.radians(-32)))
cam2 = bpy.context.active_object
scene.camera = cam2
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_7_annex.png"
bpy.ops.render.render(write_still=True)

# 3. Full Bird's-Eye / Drone Roof View (framing entire Annex + 8 Skylights + SE Sage Patch)
bpy.ops.object.camera_add(location=(-0.9, -19.5, 39.5), rotation=(math.radians(26), 0, 0))
cam3 = bpy.context.active_object
scene.camera = cam3
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_7_iso.png"
bpy.ops.render.render(write_still=True)

print("Rendered all 3 Warehouse 7 preview views!")

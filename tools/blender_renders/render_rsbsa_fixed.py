import bpy
import math
import os

# Clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Import RSBSA GLB
rsbsa_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\rsbsa_building.glb"
bpy.ops.import_scene.gltf(filepath=rsbsa_glb)
rsbsa_root = bpy.context.active_object
print("Imported RSBSA GLB")

# 2. Import Corn & Cassava GLB and place it at its exact relative offset
# GPS offset between centroids:
# RSBSA: [121.16715667, 13.95857693]
# CC:    [121.16703106, 13.95849137]
# In RSBSA local frame (rotation 3.6 deg CW):
# dx = -13.57 m, dy = -9.52 m
# bx = cos(3.6)*dx - sin(3.6)*dy = -12.95 m
# by = sin(3.6)*dx + cos(3.6)*dy = -10.36 m
cc_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\corn_casava_building.glb"
if os.path.exists(cc_glb):
    bpy.ops.import_scene.gltf(filepath=cc_glb)
    cc_root = bpy.context.active_object
    # Offset CC to its relative local position:
    cc_root.location = (-13.0, -10.4, 0.0)
    # Relative rotation is 3.8 - 3.6 = 0.2 deg
    cc_root.rotation_euler = (0, 0, math.radians(-0.2))
    print("Imported Corn & Cassava GLB at relative offset")

# World Environment
world = bpy.data.worlds.new("OutdoorWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs['Color'].default_value = (0.75, 0.80, 0.85, 1.0)
    bg_node.inputs['Strength'].default_value = 1.0

# Lighting
s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 3.8
sun.location = (8.0, -20.0, 18.0)
sun.rotation_euler = (math.radians(52), math.radians(12), math.radians(-25))

# Fill light
f_data = bpy.data.lights.new(name="Fill_Light", type='SUN')
fill = bpy.data.objects.new("Fill_Light", object_data=f_data)
bpy.context.scene.collection.objects.link(fill)
fill.data.energy = 1.5
fill.rotation_euler = (math.radians(35), math.radians(-15), math.radians(130))

# Ground plane for shadows
bpy.ops.mesh.primitive_plane_add(size=80.0, location=(0, 0, -0.01))
ground = bpy.context.active_object
g_mat = bpy.data.materials.new("Ground_Mat")
g_mat.use_nodes = True
g_bsdf = g_mat.node_tree.nodes.get("Principled BSDF")
if g_bsdf:
    g_bsdf.inputs['Base Color'].default_value = (0.45, 0.48, 0.42, 1.0)
    g_bsdf.inputs['Roughness'].default_value = 0.95
ground.data.materials.append(g_mat)

# Camera setup
cam_data = bpy.data.cameras.new('Camera')
cam = bpy.data.objects.new('Camera', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 675

# 1. Front View matching user screenshot 1 (Looking slightly elevated from South-West)
# In local coords, front facade is at Y = -13.74, entrance is at X = -3.30
cam.location = (-1.0, -25.5, 5.8)
cam.rotation_euler = (math.radians(78), 0, math.radians(-4))
cam.data.lens = 38
out1 = r"c:\Users\LGU-SanPedro\Downloads\map\rsbsa_front_verification.png"
bpy.context.scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print("Rendered:", out1)

# 2. Rear View matching user screenshot 2 (Elevated looking at the stepped rear from North-West)
cam.location = (-13.0, 14.5, 8.5)
cam.rotation_euler = (math.radians(65), 0, math.radians(-145))
cam.data.lens = 32
out2 = r"c:\Users\LGU-SanPedro\Downloads\map\rsbsa_rear_verification.png"
bpy.context.scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print("Rendered:", out2)

# 3. Alley Clearance View showing RSBSA and Corn & Cassava side by side with clear gap
cam.location = (-7.5, -23.0, 7.5)
cam.rotation_euler = (math.radians(72), 0, math.radians(6))
cam.data.lens = 35
out3 = r"c:\Users\LGU-SanPedro\Downloads\map\rsbsa_alley_clearance.png"
bpy.context.scene.render.filepath = out3
bpy.ops.render.render(write_still=True)
print("Rendered:", out3)

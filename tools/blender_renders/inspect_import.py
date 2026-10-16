import bpy

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\ored_building.glb")
print("Imported ORED objects:", len(bpy.data.objects))
root_ored = bpy.data.objects.get("ORED_Root")
print("root_ored:", root_ored, "loc:", root_ored.location, "rot:", root_ored.rotation_euler)
canopy_roof = bpy.data.objects.get("ORED_Link_Awning_Roof")
print("canopy_roof:", canopy_roof, "world loc:", canopy_roof.matrix_world.translation if canopy_roof else None)

bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\admin_building.glb")
root_admin = bpy.data.objects.get("Admin_Root")
print("root_admin:", root_admin, "loc:", root_admin.location, "rot:", root_admin.rotation_euler)
admin_canopy = bpy.data.objects.get("Admin_North_Canopy_Roof")
print("admin_canopy:", admin_canopy, "world loc:", admin_canopy.matrix_world.translation if admin_canopy else None)

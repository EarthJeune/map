import bpy
import math
import mathutils
from mathutils import Vector

# Deselect all
bpy.ops.object.select_all(action='DESELECT')

# Hide all non-canteen objects
for obj in bpy.data.objects:
    if obj.type in ['CAMERA', 'LIGHT']:
        continue
    if obj.name.startswith("Canteen_"):
        obj.hide_set(False)
    else:
        obj.hide_set(True)

for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    space.shading.use_scene_lights = True
                    space.shading.use_scene_world = True
                    space.overlay.show_overlays = False
                    
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    r3d.view_distance = 19.0
                    r3d.view_location = Vector((-0.5, -3.5, 2.6))
                    # View from South-West: pitch down ~20 deg, yaw ~30 deg from south
                    r3d.view_rotation = mathutils.Euler((math.radians(72), 0, math.radians(-32))).to_quaternion()

print("Viewport set to Canteen Material Preview!")

"""
Render the exact perspective matching the user's ground-level screenshot.
"""

import bpy
import math
import os

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.film_transparent = False

# Camera
cam = bpy.data.objects.get("Joint_Cam")
if cam:
    f2c2_parent = bpy.data.objects.get("F2C2_Scene_Root")
    # Position camera in front of F2C2 looking at front facade and LARES landing
    cam.data.lens = 24.0
    cam.location = (-21.5, -1.8, 2.2)
    # Looking towards F2C2 and LARES:
    dx = -12.20 - (-21.5) # 9.3
    dy = 2.03 - (-1.8)    # 3.83
    rot_z = math.atan2(dy, dx) - math.pi / 2.0 # standard blender camera points -Z
    # For a camera pointing forward: rot_z = atan2(dy, dx) - 90 deg = -67.6 deg
    cam.rotation_euler = (math.radians(82), math.radians(0), math.atan2(dx, -dy))
    
    out_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"
    p = os.path.join(out_dir, "joint_retained_user_screenshot_match.png")
    scene.render.filepath = p
    bpy.ops.render.render(write_still=True)
    print(f"Rendered to: {p}")

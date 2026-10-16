"""
inspect_scene.py
"""
import bpy

for obj in bpy.data.objects:
    print(f"{obj.name}: type={obj.type}, loc={obj.location}, parent={obj.parent.name if obj.parent else None}")

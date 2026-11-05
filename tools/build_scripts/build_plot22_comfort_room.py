import socket
import json
import os
import sys

blender_code = r'''
import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

# 1. Clear existing scene meshes
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.meshes:
    bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    bpy.data.materials.remove(block)

# 2. Material Helper
def create_mat(name, hex_color, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        h = hex_color.lstrip('#')
        rgb = tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))
        rgb_lin = [c ** 2.2 for c in rgb] + [1.0]
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = rgb_lin
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
    return mat

# Materials calibrated to ground-truth field photos IMG_4189 & IMG_4190
mat_wall_white     = create_mat("CR_WallWhite",     "#EEF1F3", roughness=0.82) # White stucco walls
mat_plinth_grey    = create_mat("CR_PlinthGrey",    "#6B7075", roughness=0.88) # Concrete plinth base & step
mat_fascia_green   = create_mat("CR_FasciaGreen",   "#1B4332", roughness=0.45) # Deep forest green roof fascia
mat_roof_metal     = create_mat("CR_RoofMetal",     "#2D3E35", roughness=0.55, metallic=0.3) # Corrugated green/metal roof
mat_soffit_white   = create_mat("CR_SoffitWhite",   "#DFE4E8", roughness=0.70) # Eave soffit spandrels
mat_door_grey      = create_mat("CR_DoorGrey",      "#889096", roughness=0.40, metallic=0.6) # Aluminum vent door
mat_door_frame     = create_mat("CR_DoorFrame",     "#484E52", roughness=0.35, metallic=0.7) # Dark door frame
mat_door_handle    = create_mat("CR_DoorHandle",    "#CFD4D8", roughness=0.20, metallic=0.9) # Silver handle
mat_plaque_brass   = create_mat("CR_PlaqueBrass",   "#C8A251", roughness=0.30, metallic=0.7) # Brass wall plaque
mat_pipe_blue      = create_mat("CR_PipeBlue",      "#1E88E5", roughness=0.40, metallic=0.1) # Blue PVC pipe
mat_pipe_galv      = create_mat("CR_PipeGalv",      "#757D84", roughness=0.35, metallic=0.7) # Galvanized iron pipe
mat_pedestal_conc  = create_mat("CR_PedestalConc",  "#7A8086", roughness=0.90) # Project marker pedestal
mat_marker_sign    = create_mat("CR_MarkerSign",    "#F4F6F7", roughness=0.30) # Marker plaque face
mat_marker_border  = create_mat("CR_MarkerBorder",  "#0D47A1", roughness=0.35) # Blue border
mat_marker_text    = create_mat("CR_MarkerText",    "#1A1D20", roughness=0.25) # Plaque text

# Geometry Helpers
def create_box(name, loc, size, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, vertices=16, rot=(0,0,0), mat=None, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_prism_x(name, v1, v2, v3, thickness_x, x_center, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    x_half = thickness_x / 2.0
    x_min = x_center - x_half
    x_max = x_center + x_half
    
    # Vertices (Y, Z)
    verts = [
        (x_min, v1[0], v1[1]),
        (x_min, v2[0], v2[1]),
        (x_min, v3[0], v3[1]),
        (x_max, v1[0], v1[1]),
        (x_max, v2[0], v2[1]),
        (x_max, v3[0], v3[1]),
    ]
    faces = [
        (0, 2, 1),
        (3, 4, 5),
        (0, 1, 4, 3),
        (1, 2, 5, 4),
        (2, 0, 3, 5),
    ]
    mesh.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

root = bpy.data.objects.new("plot22_comfort_room", None)
bpy.context.collection.objects.link(root)

# -------------------------------------------------------------
# 3. MAIN COMFORT ROOM BUILDING STRUCTURE
# Building footprint: 2.80m (W, along X) x 2.80m (D, along Y)
# Front is facing -Y (facing road / water tank)
# Shed roof: Front eave height Z=2.85m, Rear eave height Z=2.50m
# -------------------------------------------------------------
w_bldg = 2.80
d_bldg = 2.80
h_front = 2.80
h_rear = 2.50
h_avg = (h_front + h_rear) / 2.0

# Concrete foundation plinth at grade
create_box("CR_Plinth", (0, 0, 0.10), (w_bldg + 0.16, d_bldg + 0.16, 0.20), mat=mat_plinth_grey, parent=root)

# Concrete entrance stoop / step in front of door (-Y)
create_box("CR_EntranceStep", (0.50, -d_bldg/2.0 - 0.40, 0.08), (1.10, 0.80, 0.16), mat=mat_plinth_grey, parent=root)

# Main rectangular walls block (up to h_rear)
create_box("CR_WallsMain", (0, 0, 0.20 + h_rear/2.0), (w_bldg, d_bldg, h_rear), mat=mat_wall_white, parent=root)

# Sloping wedge top wall (from Z=h_rear to Z=h_front)
create_prism_x(
    "CR_WallsSlopeWedge",
    (-d_bldg/2.0, h_rear + 0.20),      # Front top
    ( d_bldg/2.0, h_rear + 0.20),      # Rear top
    (-d_bldg/2.0, h_front + 0.20),     # Front apex
    w_bldg, 0.0,
    mat=mat_wall_white, parent=root
)

# -------------------------------------------------------------
# 4. SHED ROOF WITH GREEN FASCIA & WHITE SOFFITS
# Eave overhangs: 0.35m on all 4 sides
# Front (-Y) is higher, Rear (+Y) is lower -> negative rotation around X
# -------------------------------------------------------------
roof_w = w_bldg + 0.70 # 3.50m
roof_d = d_bldg + 0.70 # 3.50m
slope_angle = -math.atan2(h_front - h_rear, d_bldg) # Negative angle: front high, rear low

# Slanted roof plate
roof_z_center = 0.20 + h_avg + 0.12
roof_obj = create_box("CR_RoofPlate", (0, 0, 0), (roof_w, roof_d, 0.10), mat=mat_fascia_green, parent=root)
roof_obj.rotation_euler = (slope_angle, 0, 0)
roof_obj.location = (0, 0, roof_z_center)

# Under-eave white soffit spandrels
soffit_obj = create_box("CR_Soffit", (0, 0, 0), (roof_w - 0.06, roof_d - 0.06, 0.04), mat=mat_soffit_white, parent=root)
soffit_obj.rotation_euler = (slope_angle, 0, 0)
soffit_obj.location = (0, 0, roof_z_center - 0.05)

# Standing seams / corrugation ribs along top roof surface
for rib_x in [-1.50, -1.00, -0.50, 0.00, 0.50, 1.00, 1.50]:
    rib = create_box(f"RoofRib_{rib_x}", (0, 0, 0), (0.04, roof_d - 0.04, 0.03), mat=mat_roof_metal, parent=root)
    rib.rotation_euler = (slope_angle, 0, 0)
    local_pos = Vector((rib_x, 0, 0.065))
    local_pos.rotate(Matrix.Rotation(slope_angle, 4, 'X'))
    rib.location = Vector((0, 0, roof_z_center)) + local_pos

# -------------------------------------------------------------
# 5. FRONT ENTRANCE DOOR & DEDICATION PLAQUE (IMG_4190)
# Door located on front face (-Y) at x = +0.50m
# -------------------------------------------------------------
door_w = 0.90
door_h = 2.10
door_x = 0.50
door_y = -d_bldg/2.0 - 0.02
door_z = 0.20 + door_h/2.0

# Door frame
create_box("DoorFrameTop",   (door_x, door_y, 0.20 + door_h), (door_w + 0.10, 0.06, 0.08), mat=mat_door_frame, parent=root)
create_box("DoorFrameLeft",  (door_x - door_w/2.0, door_y, door_z), (0.06, 0.06, door_h), mat=mat_door_frame, parent=root)
create_box("DoorFrameRight", (door_x + door_w/2.0, door_y, door_z), (0.06, 0.06, door_h), mat=mat_door_frame, parent=root)

# Door leaf with grey metal finish
create_box("DoorLeaf", (door_x, door_y + 0.015, door_z), (door_w - 0.02, 0.03, door_h - 0.02), mat=mat_door_grey, parent=root)

# Upper ventilation pattern box (micro-perforations area)
create_box("DoorVentPattern", (door_x, door_y - 0.005, door_z + 0.50), (door_w * 0.65, 0.015, 0.60), mat=mat_door_frame, parent=root)

# Silver vertical push handle
create_box("DoorHandle", (door_x - door_w * 0.35, door_y - 0.02, door_z - 0.05), (0.04, 0.06, 0.24), mat=mat_door_handle, parent=root)

# Brass dedication plaque mounted on front wall to left of door (x = -0.45m, Z = 1.70m)
create_box("WallPlaqueBrass", (-0.45, door_y + 0.01, 1.70), (0.42, 0.02, 0.52), mat=mat_plaque_brass, parent=root)

# -------------------------------------------------------------
# 6. EXTERIOR WATER PIPES & FIXTURES (IMG_4189, IMG_4190)
# Blue vertical PVC pipe on front-right corner (+X, -Y)
# -------------------------------------------------------------
pipe_blue_x = w_bldg/2.0 - 0.10
pipe_blue_y = -d_bldg/2.0 - 0.04
create_cylinder("PipeBlueVertical", (pipe_blue_x, pipe_blue_y, 0.80), radius=0.03, depth=1.60, vertices=12, mat=mat_pipe_blue, parent=root)
create_box("PipeBlueElbow", (pipe_blue_x, pipe_blue_y, 1.60), (0.08, 0.08, 0.08), mat=mat_pipe_blue, parent=root)

# Galvanized horizontal pipe on left flank (-X) with valve and red hose
pipe_galv_y = -0.20
pipe_galv_x = -w_bldg/2.0 - 0.15
create_cylinder("PipeGalvHoriz", (pipe_galv_x, pipe_galv_y, 0.85), radius=0.035, depth=0.90, vertices=12, rot=(0, math.radians(90), 0), mat=mat_pipe_galv, parent=root)
create_box("PipeValve", (pipe_galv_x - 0.20, pipe_galv_y, 0.85), (0.10, 0.10, 0.12), mat=mat_door_frame, parent=root)
create_cylinder("HoseCoil", (pipe_galv_x - 0.20, pipe_galv_y, 0.70), radius=0.10, depth=0.18, vertices=12, rot=(math.radians(90), 0, 0), mat=mat_door_frame, parent=root)

# -------------------------------------------------------------
# 7. COMMEMORATIVE PROJECT MARKER PEDESTAL (IMG_4189)
# Solid concrete monument in front of CR:
# "CONSTRUCTION AND INSTALLATION OF LARES SPRINKLER IRRIGATION SYSTEM"
# Positioned at x = -0.90m, y = -2.40m in front of left flank
# -------------------------------------------------------------
ped_w = 0.85
ped_d = 0.75
ped_h_back = 1.15
ped_h_front = 0.75
ped_x = -0.85
ped_y = -d_bldg/2.0 - 1.05

# Concrete footing pad
create_box("MarkerFooting", (ped_x, ped_y, 0.06), (ped_w + 0.16, ped_d + 0.16, 0.12), mat=mat_pedestal_conc, parent=root)

# Main lower pedestal body
create_box("MarkerBodyLower", (ped_x, ped_y, 0.12 + ped_h_front/2.0), (ped_w, ped_d, ped_h_front), mat=mat_pedestal_conc, parent=root)

# Sloped concrete wedge top
create_prism_x(
    "MarkerSlopeTop",
    (-ped_d/2.0, ped_h_front + 0.12),  # Front
    ( ped_d/2.0, ped_h_front + 0.12),  # Bottom back
    ( ped_d/2.0, ped_h_back + 0.12),   # Top back
    ped_w, ped_x,
    mat=mat_pedestal_conc, parent=root
)

# Slanted white official project plaque on the 45-deg angled face
marker_slope_angle = math.atan2(ped_h_back - ped_h_front, ped_d)
plaque_z = 0.12 + (ped_h_front + ped_h_back) / 2.0 + 0.02
plaque_obj = create_box("MarkerPlaqueFace", (0, 0, 0), (ped_w * 0.78, ped_d * 0.85, 0.02), mat=mat_marker_sign, parent=root)
plaque_obj.rotation_euler = (marker_slope_angle, 0, 0)
plaque_obj.location = (ped_x, ped_y, plaque_z)

# Blue border frame on plaque
border_obj = create_box("MarkerPlaqueBorder", (0, 0, 0), (ped_w * 0.82, ped_d * 0.89, 0.015), mat=mat_marker_border, parent=root)
border_obj.rotation_euler = (marker_slope_angle, 0, 0)
border_obj.location = (ped_x, ped_y, plaque_z - 0.005)

# Text lines simulated on marker face
t1 = create_box("MarkerText1", (0, 0, 0), (ped_w * 0.55, 0.05, 0.008), mat=mat_marker_text, parent=root)
t1.rotation_euler = (marker_slope_angle, 0, 0)
p1_offset = Vector((0, ped_d * 0.22, 0.012))
p1_offset.rotate(Matrix.Rotation(marker_slope_angle, 4, 'X'))
t1.location = Vector((ped_x, ped_y, plaque_z)) + p1_offset

t2 = create_box("MarkerText2", (0, 0, 0), (ped_w * 0.65, 0.06, 0.008), mat=mat_marker_text, parent=root)
t2.rotation_euler = (marker_slope_angle, 0, 0)
p2_offset = Vector((0, ped_d * 0.05, 0.012))
p2_offset.rotate(Matrix.Rotation(marker_slope_angle, 4, 'X'))
t2.location = Vector((ped_x, ped_y, plaque_z)) + p2_offset

t3 = create_box("MarkerText3", (0, 0, 0), (ped_w * 0.50, 0.04, 0.008), mat=mat_marker_text, parent=root)
t3.rotation_euler = (marker_slope_angle, 0, 0)
p3_offset = Vector((0, -ped_d * 0.15, 0.012))
p3_offset.rotate(Matrix.Rotation(marker_slope_angle, 4, 'X'))
t3.location = Vector((ped_x, ped_y, plaque_z)) + p3_offset

# -------------------------------------------------------------
# 8. CLEAN HIERARCHY, JOIN BY MATERIAL & EXPORT
# -------------------------------------------------------------
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active = [o for o in bpy.data.objects if o.type == 'MESH'][0]

materials = list(bpy.data.materials)
for mat in materials:
    mat_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and mat.name in [m.name for m in o.data.materials]]
    if len(mat_objs) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in mat_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = mat_objs[0]
        bpy.ops.object.join()
        bpy.context.active_object.name = f"CR_Combined_{mat.name}"

bpy.ops.object.select_all(action='SELECT')

out_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot22_comfort_room.glb"
os.makedirs(os.path.dirname(out_glb), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_glb,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False
)
file_size = os.path.getsize(out_glb)
print(f"EXPORT_SUCCESS: {out_glb} (Size: {file_size / 1024:.2f} KB)")
'''

def run_script():
    s = socket.socket()
    s.settimeout(60.0)
    s.connect(('127.0.0.1', 9876))
    s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': blender_code}}).encode('utf-8') + b'\n')
    
    data = b""
    while True:
        try:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
            try:
                res = json.loads(data.decode('utf-8'))
                break
            except ValueError:
                pass
        except Exception as e:
            break
    s.close()
    if 'res' not in locals():
        res = json.loads(data.decode('utf-8'))
    print("Blender response:", res)

if __name__ == '__main__':
    run_script()

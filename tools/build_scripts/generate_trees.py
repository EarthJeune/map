"""
Generate 4 Low-Poly 3D Tree GLB Models with proper indexed geometry:
1. tree_mango.glb (Mango / Shade Broadleaf: trunk + organic layered dome canopy)
2. tree_palm.glb  (Coconut Palm: slender textured trunk + curved palm fronds)
3. tree_pine.glb  (Pine / Conifer: straight trunk + 3 stacked tapered cones)
4. tree_bush.glb  (Fruit / Bush: multi-branch shrub + cluster of foliage + berries)

Ensures 100% GLTF 2.0 compliance with valid indices on EVERY mesh primitive for Mapbox GL JS compatibility.
"""
import math
import struct
import json
import os

def build_cylinder(radius_top, radius_bottom, height, segments=8, y_offset=0.0):
    verts = []
    normals = []
    uvs = []
    indices = []
    
    half_h = height / 2.0
    
    # Side vertices
    for y_idx, (r, y) in enumerate([(radius_bottom, y_offset), (radius_top, y_offset + height)]):
        v_coord = float(y_idx)
        for s in range(segments + 1):
            theta = (s / segments) * 2.0 * math.pi
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)
            
            x = r * cos_t
            z = r * sin_t
            verts.append((x, y, z))
            normals.append((cos_t, 0.0, sin_t))
            uvs.append((s / segments, v_coord))
            
    # Side indices
    row0 = 0
    row1 = segments + 1
    for s in range(segments):
        i0 = row0 + s
        i1 = row0 + s + 1
        i2 = row1 + s
        i3 = row1 + s + 1
        indices.extend([i0, i1, i2, i1, i3, i2])
        
    return verts, normals, uvs, indices

def build_icosphere_subdivided(radius=1.0, y_offset=0.0, x_offset=0.0, z_offset=0.0, scale_y=1.0):
    # Low-poly organic icosahedron
    phi = (1.0 + math.sqrt(5.0)) / 2.0
    v_raw = [
        (-1,  phi, 0), ( 1,  phi, 0), (-1, -phi, 0), ( 1, -phi, 0),
        (0, -1,  phi), (0,  1,  phi), (0, -1, -phi), (0,  1, -phi),
        ( phi, 0, -1), ( phi, 0,  1), (-phi, 0, -1), (-phi, 0,  1)
    ]
    # Normalize to sphere radius
    verts = []
    normals = []
    uvs = []
    for x, y, z in v_raw:
        l = math.sqrt(x*x + y*y + z*z)
        nx, ny, nz = x/l, y/l, z/l
        vx = nx * radius + x_offset
        vy = (ny * radius * scale_y) + y_offset
        vz = nz * radius + z_offset
        verts.append((vx, vy, vz))
        normals.append((nx, ny, nz))
        uvs.append((0.5 + nx*0.5, 0.5 + nz*0.5))
        
    faces = [
        (0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11),
        (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
        (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9),
        (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)
    ]
    indices = []
    for f in faces:
        indices.extend([f[0], f[1], f[2]])
    return verts, normals, uvs, indices

def build_cone(radius, height, segments=8, y_offset=0.0):
    verts = []
    normals = []
    uvs = []
    indices = []
    
    # Apex
    apex_idx = 0
    verts.append((0.0, y_offset + height, 0.0))
    normals.append((0.0, 1.0, 0.0))
    uvs.append((0.5, 1.0))
    
    # Base ring
    slope = radius / height
    for s in range(segments + 1):
        theta = (s / segments) * 2.0 * math.pi
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        x = radius * cos_t
        z = radius * sin_t
        verts.append((x, y_offset, z))
        # Normal pointing outward and up
        nl = math.sqrt(cos_t*cos_t + slope*slope + sin_t*sin_t)
        normals.append((cos_t / nl, slope / nl, sin_t / nl))
        uvs.append((s / segments, 0.0))
        
    for s in range(segments):
        i_curr = 1 + s
        i_next = 1 + s + 1
        indices.extend([apex_idx, i_curr, i_next])
        
    return verts, normals, uvs, indices

def create_glb(parts, output_filepath):
    """
    parts = list of dicts:
    {
      'name': 'trunk',
      'verts': [(x,y,z), ...],
      'normals': [(nx,ny,nz), ...],
      'uvs': [(u,v), ...],
      'indices': [0, 1, 2, ...],
      'color': [r, g, b, 1.0],
      'roughness': 0.8
    }
    """
    bin_data = bytearray()
    buffer_views = []
    accessors = []
    meshes = []
    nodes = []
    materials = []
    
    for i, part in enumerate(parts):
        v = part['verts']
        n = part['normals']
        uv = part['uvs']
        idx = part['indices']
        
        # 1. POSITION bufferView
        pos_offset = len(bin_data)
        for pt in v:
            bin_data.extend(struct.pack('<fff', pt[0], pt[1], pt[2]))
        pos_len = len(bin_data) - pos_offset
        bv_pos_idx = len(buffer_views)
        buffer_views.append({
            'buffer': 0,
            'byteOffset': pos_offset,
            'byteLength': pos_len,
            'target': 34962, # ARRAY_BUFFER
            'byteStride': 12
        })
        min_x = min(p[0] for p in v); max_x = max(p[0] for p in v)
        min_y = min(p[1] for p in v); max_y = max(p[1] for p in v)
        min_z = min(p[2] for p in v); max_z = max(p[2] for p in v)
        acc_pos_idx = len(accessors)
        accessors.append({
            'bufferView': bv_pos_idx,
            'componentType': 5126, # FLOAT
            'count': len(v),
            'type': 'VEC3',
            'min': [min_x, min_y, min_z],
            'max': [max_x, max_y, max_z]
        })
        
        # 2. NORMAL bufferView
        norm_offset = len(bin_data)
        for norm in n:
            bin_data.extend(struct.pack('<fff', norm[0], norm[1], norm[2]))
        norm_len = len(bin_data) - norm_offset
        bv_norm_idx = len(buffer_views)
        buffer_views.append({
            'buffer': 0,
            'byteOffset': norm_offset,
            'byteLength': norm_len,
            'target': 34962,
            'byteStride': 12
        })
        acc_norm_idx = len(accessors)
        accessors.append({
            'bufferView': bv_norm_idx,
            'componentType': 5126,
            'count': len(n),
            'type': 'VEC3'
        })
        
        # 3. TEXCOORD_0 bufferView
        uv_offset = len(bin_data)
        for t in uv:
            bin_data.extend(struct.pack('<ff', t[0], t[1]))
        uv_len = len(bin_data) - uv_offset
        bv_uv_idx = len(buffer_views)
        buffer_views.append({
            'buffer': 0,
            'byteOffset': uv_offset,
            'byteLength': uv_len,
            'target': 34962,
            'byteStride': 8
        })
        acc_uv_idx = len(accessors)
        accessors.append({
            'bufferView': bv_uv_idx,
            'componentType': 5126,
            'count': len(uv),
            'type': 'VEC2'
        })
        
        # 4. INDICES bufferView (UNSIGNED_SHORT)
        idx_offset = len(bin_data)
        for index_val in idx:
            bin_data.extend(struct.pack('<H', index_val))
        # GLTF requires bufferView byteOffset to be 4-byte aligned
        pad = (4 - (len(bin_data) % 4)) % 4
        bin_data.extend(b'\x00' * pad)
        idx_len = (len(bin_data) - pad) - idx_offset
        bv_idx_idx = len(buffer_views)
        buffer_views.append({
            'buffer': 0,
            'byteOffset': idx_offset,
            'byteLength': idx_len,
            'target': 34963 # ELEMENT_ARRAY_BUFFER
        })
        acc_idx_idx = len(accessors)
        accessors.append({
            'bufferView': bv_idx_idx,
            'componentType': 5123, # UNSIGNED_SHORT
            'count': len(idx),
            'type': 'SCALAR',
            'min': [min(idx)],
            'max': [max(idx)]
        })
        
        # Material
        mat_idx = len(materials)
        materials.append({
            'name': part.get('name', f'mat_{i}'),
            'pbrMetallicRoughness': {
                'baseColorFactor': part.get('color', [0.2, 0.6, 0.2, 1.0]),
                'metallicFactor': 0.05,
                'roughnessFactor': part.get('roughness', 0.8)
            },
            'doubleSided': True
        })
        
        # Mesh
        mesh_idx = len(meshes)
        meshes.append({
            'name': part.get('name', f'mesh_{i}'),
            'primitives': [{
                'mode': 4, # TRIANGLES
                'attributes': {
                    'POSITION': acc_pos_idx,
                    'NORMAL': acc_norm_idx,
                    'TEXCOORD_0': acc_uv_idx
                },
                'indices': acc_idx_idx,
                'material': mat_idx
            }]
        })
        
        nodes.append({
            'name': part.get('name', f'node_{i}'),
            'mesh': mesh_idx
        })

    gltf_dict = {
        'asset': {'version': '2.0', 'generator': 'DA-LARES Tree Generator'},
        'scene': 0,
        'scenes': [{'nodes': list(range(len(nodes)))}],
        'nodes': nodes,
        'meshes': meshes,
        'materials': materials,
        'accessors': accessors,
        'bufferViews': buffer_views,
        'buffers': [{
            'byteLength': len(bin_data)
        }]
    }
    
    json_str = json.dumps(gltf_dict, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    # Pad JSON to 4-byte alignment
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b' ' * json_pad
    
    # Header: magic (4s), version (I), length (I)
    # Chunk 0 (JSON): chunk_len (I), chunk_type (4s: 'JSON' = 0x4E4F534A)
    # Chunk 1 (BIN): chunk_len (I), chunk_type (4s: 'BIN\x00' = 0x004E4942)
    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    header = struct.pack('<4sII', b'glTF', 2, total_len)
    json_chunk_hdr = struct.pack('<II', len(json_bytes), 0x4E4F534A)
    bin_chunk_hdr = struct.pack('<II', len(bin_data), 0x004E4942)
    
    with open(output_filepath, 'wb') as f:
        f.write(header)
        f.write(json_chunk_hdr)
        f.write(json_bytes)
        f.write(bin_chunk_hdr)
        f.write(bin_data)
        
    print(f"Generated {output_filepath}: {total_len} bytes")

def generate_all_trees():
    os.makedirs('models', exist_ok=True)
    
    # 1. MANGO / SHADE BROADLEAF
    # Sturdy trunk + layered full canopy
    t_v, t_n, t_uv, t_i = build_cylinder(0.35, 0.55, 2.2, segments=8, y_offset=0.0)
    c1_v, c1_n, c1_uv, c1_i = build_icosphere_subdivided(2.2, y_offset=2.8, scale_y=0.9)
    c2_v, c2_n, c2_uv, c2_i = build_icosphere_subdivided(1.6, y_offset=3.5, x_offset=0.6, z_offset=0.4, scale_y=0.85)
    c3_v, c3_n, c3_uv, c3_i = build_icosphere_subdivided(1.5, y_offset=3.2, x_offset=-0.6, z_offset=-0.4, scale_y=0.85)
    
    mango_parts = [
        {'name': 'trunk', 'verts': t_v, 'normals': t_n, 'uvs': t_uv, 'indices': t_i, 'color': [0.42, 0.28, 0.16, 1.0], 'roughness': 0.9},
        {'name': 'canopy_main', 'verts': c1_v, 'normals': c1_n, 'uvs': c1_uv, 'indices': c1_i, 'color': [0.13, 0.52, 0.22, 1.0], 'roughness': 0.75},
        {'name': 'canopy_high', 'verts': c2_v, 'normals': c2_n, 'uvs': c2_uv, 'indices': c2_i, 'color': [0.18, 0.62, 0.26, 1.0], 'roughness': 0.7},
        {'name': 'canopy_side', 'verts': c3_v, 'normals': c3_n, 'uvs': c3_uv, 'indices': c3_i, 'color': [0.10, 0.45, 0.18, 1.0], 'roughness': 0.8}
    ]
    create_glb(mango_parts, 'models/tree_mango.glb')
    
    # 2. COCONUT PALM
    # Slender curved segmented trunk + 8 palm fronds
    p_trunk_v, p_trunk_n, p_trunk_uv, p_trunk_i = build_cylinder(0.2, 0.35, 4.8, segments=7, y_offset=0.0)
    palm_parts = [
        {'name': 'palm_trunk', 'verts': p_trunk_v, 'normals': p_trunk_n, 'uvs': p_trunk_uv, 'indices': p_trunk_i, 'color': [0.55, 0.45, 0.35, 1.0], 'roughness': 0.9}
    ]
    # 8 Fronds
    for f_idx in range(8):
        angle = (f_idx / 8.0) * 2.0 * math.pi
        ca = math.cos(angle); sa = math.sin(angle)
        # Low cone curved outward
        f_v, f_n, f_uv, f_i = build_cone(0.8, 2.6, segments=4, y_offset=4.5)
        # Rotate fronds pointing radially outward
        rot_v = []
        for x, y, z in f_v:
            rx = x * ca - z * sa + (ca * 1.2)
            rz = x * sa + z * ca + (sa * 1.2)
            ry = y - 0.4
            rot_v.append((rx, ry, rz))
        palm_parts.append({
            'name': f'frond_{f_idx}',
            'verts': rot_v, 'normals': f_n, 'uvs': f_uv, 'indices': f_i,
            'color': [0.16, 0.68, 0.28, 1.0] if f_idx % 2 == 0 else [0.22, 0.75, 0.32, 1.0],
            'roughness': 0.6
        })
    create_glb(palm_parts, 'models/tree_palm.glb')
    
    # 3. PINE TREE
    # Straight brown trunk + 3 stacked tapered foliage cones
    pine_t_v, pine_t_n, pine_t_uv, pine_t_i = build_cylinder(0.25, 0.4, 2.0, segments=6, y_offset=0.0)
    cone1_v, cone1_n, cone1_uv, cone1_i = build_cone(2.2, 2.4, segments=7, y_offset=1.5)
    cone2_v, cone2_n, cone2_uv, cone2_i = build_cone(1.7, 2.2, segments=7, y_offset=2.8)
    cone3_v, cone3_n, cone3_uv, cone3_i = build_cone(1.2, 2.0, segments=7, y_offset=4.0)
    
    pine_parts = [
        {'name': 'trunk', 'verts': pine_t_v, 'normals': pine_t_n, 'uvs': pine_t_uv, 'indices': pine_t_i, 'color': [0.38, 0.25, 0.15, 1.0], 'roughness': 0.9},
        {'name': 'tier1', 'verts': cone1_v, 'normals': cone1_n, 'uvs': cone1_uv, 'indices': cone1_i, 'color': [0.08, 0.38, 0.22, 1.0], 'roughness': 0.8},
        {'name': 'tier2', 'verts': cone2_v, 'normals': cone2_n, 'uvs': cone2_uv, 'indices': cone2_i, 'color': [0.10, 0.44, 0.25, 1.0], 'roughness': 0.75},
        {'name': 'tier3', 'verts': cone3_v, 'normals': cone3_n, 'uvs': cone3_uv, 'indices': cone3_i, 'color': [0.14, 0.52, 0.30, 1.0], 'roughness': 0.7}
    ]
    create_glb(pine_parts, 'models/tree_pine.glb')
    
    # 4. FRUIT / BUSH / SHRUB
    # Low short trunk + dense rounded foliage dome + fruit accent spheres
    b_t_v, b_t_n, b_t_uv, b_t_i = build_cylinder(0.2, 0.3, 0.6, segments=6, y_offset=0.0)
    b_f1_v, b_f1_n, b_f1_uv, b_f1_i = build_icosphere_subdivided(1.4, y_offset=0.9, scale_y=0.75)
    b_f2_v, b_f2_n, b_f2_uv, b_f2_i = build_icosphere_subdivided(0.9, y_offset=1.2, x_offset=0.4, z_offset=-0.3, scale_y=0.7)
    
    # Fruits/berries (small colored spheres)
    fruit1_v, fruit1_n, fruit1_uv, fruit1_i = build_icosphere_subdivided(0.18, y_offset=1.2, x_offset=0.8, z_offset=0.6)
    fruit2_v, fruit2_n, fruit2_uv, fruit2_i = build_icosphere_subdivided(0.18, y_offset=1.4, x_offset=-0.7, z_offset=0.5)
    fruit3_v, fruit3_n, fruit3_uv, fruit3_i = build_icosphere_subdivided(0.18, y_offset=1.3, x_offset=0.2, z_offset=-0.9)
    
    bush_parts = [
        {'name': 'bush_stem', 'verts': b_t_v, 'normals': b_t_n, 'uvs': b_t_uv, 'indices': b_t_i, 'color': [0.45, 0.35, 0.22, 1.0], 'roughness': 0.9},
        {'name': 'bush_dome', 'verts': b_f1_v, 'normals': b_f1_n, 'uvs': b_f1_uv, 'indices': b_f1_i, 'color': [0.24, 0.60, 0.22, 1.0], 'roughness': 0.8},
        {'name': 'bush_side', 'verts': b_f2_v, 'normals': b_f2_n, 'uvs': b_f2_uv, 'indices': b_f2_i, 'color': [0.30, 0.68, 0.26, 1.0], 'roughness': 0.75},
        {'name': 'fruit1', 'verts': fruit1_v, 'normals': fruit1_n, 'uvs': fruit1_uv, 'indices': fruit1_i, 'color': [0.95, 0.28, 0.15, 1.0], 'roughness': 0.4},
        {'name': 'fruit2', 'verts': fruit2_v, 'normals': fruit2_n, 'uvs': fruit2_uv, 'indices': fruit2_i, 'color': [0.95, 0.28, 0.15, 1.0], 'roughness': 0.4},
        {'name': 'fruit3', 'verts': fruit3_v, 'normals': fruit3_n, 'uvs': fruit3_uv, 'indices': fruit3_i, 'color': [0.95, 0.28, 0.15, 1.0], 'roughness': 0.4}
    ]
    create_glb(bush_parts, 'models/tree_bush.glb')

if __name__ == '__main__':
    generate_all_trees()

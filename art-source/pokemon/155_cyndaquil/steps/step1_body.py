# Cyndaquil (155) step 1: clean scene, palette + flame material, body and head
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions): 
    for x in list(coll): coll.remove(x)
COLORS = [
    ('teal', '#2e5566'), ('teal_dk', '#1f3d4b'), ('cream', '#f2dfa0'), ('cream_dk', '#d9c07c'),
    ('spot', '#c0392b'), ('nose', '#8a3b3b'), ('eye', '#1a1418'), ('claw', '#fff6e0'),
    ('flame_out', '#ff7a1a'), ('flame_mid', '#ffb02e'), ('flame_in', '#ffe36b'), ('mouth', '#b8483f'),
]
mat = build_palette('155_cyndaquil', COLORS)
fmat = bpy.data.materials.get('M_155_cyndaquil_flame') or mat.copy(); fmat.name = 'M_155_cyndaquil_flame'
bs = next(n for n in fmat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bs.inputs['Alpha'].default_value = 0.88
try: fmat.surface_render_method = 'BLENDED'
except Exception: pass

# body: long bean, low to the ground, slightly arched back, rump fuller than chest
body = sphere('cyn_body', radius=1, seg=48, rings=32)
def fb(v):
    x, y, z = v.x, v.y, v.z
    t = (y + 1) / 2                                  # 0 chest .. 1 rump
    sx = 0.09 + 0.02 * t; sz = 0.085 + 0.012 * t
    nz = z * sz + 0.02 * math.cos(y * 1.4)           # arched back
    if z < 0: nz = z * sz * 0.85                     # flatter belly
    return Vector((x * sx, y * 0.165 + 0.04, nz + 0.125))
deform(body, fb)
def body_col(c, n, p):
    if c.z > 0.132 and n.z > -0.2: return 'teal'
    if c.y < -0.08 and c.z > 0.16: return 'teal'
    return 'cream'
paint(body, mat, body_col)

# head: sphere with a long tapered snout pointing forward (-Y)
head = sphere('cyn_head', radius=1, seg=40, rings=26)
HC = Vector((0, -0.14, 0.2))
def fh(v):
    x, y, z = v.x, v.y, v.z
    f = max(0.0, -y)                                 # 0 back .. 1 front
    ny = y * 0.085 * (1 + 0.5 * f ** 1.8)            # snout stretch
    taper = 1 - 0.38 * f ** 2.2
    nx = x * 0.086 * taper; nz = z * 0.08 * taper - 0.01 * f ** 2 + 0.006 * max(0.0, z) * (1 - f)
    return Vector((nx, ny, nz)) + HC
deform(head, fh)
def head_col(c, n, p):
    rel = c - HC
    if rel.z > -0.014 + 0.014 * min(1, max(0, -(rel.y + 0.03) / 0.08)) and not (n.z < -0.3): return 'teal'
    return 'cream'
paint(head, mat, head_col)
print('tris', tri_count())

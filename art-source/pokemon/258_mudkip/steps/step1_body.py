# Mudkip (258) step 1: clean scene, palette, body and head
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.curves):
    for x in list(coll): coll.remove(x)
COLORS = [
    ('blue', '#5aa8e8'), ('blue_dk', '#3a7fc2'), ('belly', '#dcf0fb'), ('gill', '#f28a36'),
    ('gill_dk', '#d8661d'), ('eye', '#16161c'), ('eye_hl', '#ffffff'), ('tail', '#23384f'),
    ('mouth', '#2a3444'), ('claw', '#f4fbff'), ('tail_edge', '#3a6a9a'), ('blue_lt', '#86c3f0'),
]
mat = build_palette('258_mudkip', COLORS)

body = sphere('mud_body', radius=1, seg=48, rings=32)
def fb(v):
    x, y, z = v.x, v.y, v.z
    t = (y + 1) / 2
    sx = 0.082 + 0.012 * t; sz = 0.078 + 0.006 * t
    nz = z * sz * (0.85 if z < 0 else 1.0) + 0.012 * math.cos(y * 1.3)
    return Vector((x * sx, y * 0.135 + 0.05, nz + 0.115))
deform(body, fb)
paint(body, mat, lambda c, n, p: 'belly' if (c.z < 0.1 and n.z < 0.1) else 'blue')

head = sphere('mud_head', radius=1, seg=44, rings=30)
HC = Vector((0, -0.11, 0.185))
def fh(v):
    x, y, z = v.x, v.y, v.z
    f = max(0.0, -y)
    ny = y * 0.085 * (1 - 0.18 * f ** 2)          # slightly flattened face
    nx = x * 0.098 * (1 + 0.06 * max(0, -z))      # full cheeks
    nz = z * 0.082 - 0.008 * f * max(0, -z)
    return Vector((nx, ny, nz)) + HC
deform(head, fh)
def head_col(c, n, p):
    rel = c - HC
    if rel.z < -0.02 + 0.01 * max(0, rel.y) * 20 and n.y < 0.2: return 'belly'   # light jaw / lower face
    return 'blue'
paint(head, mat, head_col)
print('tris', tri_count())

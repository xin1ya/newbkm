# Rowlet (722) step 1: clean scene, palette material, body
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
bpy.context.scene.unit_settings.system = 'METRIC'

COLORS = [
    ('brown', '#9a6a43'), ('brown_dk', '#6b4830'), ('cream', '#f3ead6'), ('tan', '#d8b88c'),
    ('leaf', '#63b04b'), ('leaf_dk', '#3e7d36'), ('beak', '#efb070'), ('foot', '#f09a46'),
    ('eye', '#1d1a1e'), ('eye_hl', '#ffffff'), ('wing_tip', '#efe4cf'), ('brown_lt', '#b58558'),
]
mat = build_palette('722_rowlet', COLORS)

# body: an egg, slightly wider low, flattened facial plane at the front
body = sphere('rowlet_body', radius=1.0, seg=64, rings=40)
def shape(v):
    x, y, z = v.x, v.y, v.z
    sx = 0.145 * (1.0 + 0.06 * (-z))          # a bit wider towards the bottom
    sy = 0.125
    sz = 0.135
    nx, ny, nz = x * sx, y * sy, z * sz
    if ny < 0:                                   # gently flatten the facial disc
        ny *= 0.88 + 0.12 * (x * x + z * z)
    if nz < -0.09:                               # flat sitting bottom
        nz = -0.09 + (nz + 0.09) * 0.45
    return Vector((nx, ny, nz + 0.165))
deform(body, shape)

def heart(x, z):
    # facial disc: heart with cleft at the top (forehead V), point at the bottom
    u = x / 0.092; w = (z - 0.178) / 0.078 + 0.15
    return (u * u + w * w - 1) ** 3 - u * u * w ** 3 < 0

def body_color(c, n, p):
    if n.y < -0.18 and heart(c.x, c.z): return 'cream'
    if c.z < 0.075 and n.y < 0.2 and abs(c.x) < 0.10: return 'brown_lt'
    return 'brown'
paint(body, mat, body_color)
print('tris', tri_count())

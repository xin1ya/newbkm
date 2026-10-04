# Mudkip step 2: eyes, mouth, cheek gills, head fin, tail fin, legs
from mathutils import Quaternion
mat = bpy.data.materials['M_258_mudkip']
head = bpy.data.objects['mud_head']; body = bpy.data.objects['mud_body']
HC = Vector((0, -0.11, 0.185))
def shoot(o, center, direction):
    d = Vector(direction).normalized(); c = Vector(center)
    ok, loc, n, _ = o.ray_cast(c + d, -d); assert ok, (o.name, center, direction); return loc, n
def align(o, axis, n):
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector(axis).rotation_difference(n)

# eyes: big glossy black ovals, set into the head, white highlight
for s, nm in ((1, 'l'), (-1, 'r')):
    loc, n = shoot(head, HC + Vector((0, 0, 0.018)), (s * 0.62, -0.75, 0.2))
    e = sphere(f'mud_eye_{nm}', radius=1, seg=20, rings=12, scale=(0.017, 0.0065, 0.021))
    align(e, (0, -1, 0), n); e.location = loc - n * 0.002; paint_all(e, mat, 'eye')
    h = sphere(f'mud_eyehl_{nm}', radius=1, seg=10, rings=6, scale=(0.005, 0.003, 0.006))
    align(h, (0, -1, 0), n); h.location = loc + n * 0.0035 + Vector((0.004 * s, 0, 0.007)); paint_all(h, mat, 'eye_hl')

# mouth: wide happy smile across the lower face
pts = []
for k in range(-8, 9):
    t = k / 8.0 * 0.8; a_ = abs(t)
    d = Vector((math.sin(t * 1.3), -math.cos(t * 1.3), -0.35 + 0.25 * a_ ** 2))
    loc, n = shoot(head, HC + Vector((0, -0.02, -0.03 + 0.012 * a_ ** 2)), d)
    pts.append(loc + n * 0.0012)
cu = bpy.data.curves.new('mud_mouth', 'CURVE'); cu.dimensions = '3D'
sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
for p_, v in zip(sp.points, pts): p_.co = (v.x, v.y, v.z, 1)
cu.bevel_depth = 0.0022; cu.bevel_resolution = 1; cu.use_fill_caps = True
co = new_obj('mud_mouth_c', cu)
bpy.ops.object.select_all(action='DESELECT'); co.select_set(True); bpy.context.view_layer.objects.active = co
bpy.ops.object.convert(target='MESH'); mo = bpy.context.active_object; mo.name = 'mud_mouth'; paint_all(mo, mat, 'mouth')

# cheek gills: 3 orange spikes fanned outward on each cheek
for s, nm in ((1, 'l'), (-1, 'r')):
    loc, n = shoot(head, HC + Vector((0, -0.01, -0.018)), (s, -0.3, -0.18))
    for i, (up, back, ln) in enumerate(((0.6, 0.75, 0.05), (0.0, 0.85, 0.062), (-0.5, 0.75, 0.048))):
        g = cone(f'mud_gill_{nm}{i}', 0.014, 0.0015, ln, verts=10)
        smooth(g)
        for v in g.data.vertices: v.co.z += ln / 2          # base at origin
        dvec = (n + Vector((0, back, up))).normalized()
        align(g, (0, 0, 1), dvec); g.location = loc - n * 0.006
        paint(g, mat, lambda c, n_, p, L=loc: 'gill_dk' if (c - L).length < 0.012 else 'gill')

# head fin: thin curved blade on top of the head
loc, n = shoot(head, HC + Vector((0, 0.0, 0)), (0, 0.1, 1))
fin = sphere('mud_fin_head', radius=1, seg=20, rings=14)
def ffin(v):
    t = (v.z + 1) / 2                                 # 0 base .. 1 tip
    length = 0.045 * math.sin(math.pi * min(1, 0.15 + t * 0.85)) + 0.004
    return Vector((v.x * 0.006 * (1 - 0.7 * t), v.y * length + 0.035 * t * t, t * 0.085))
deform(fin, ffin)
fin.location = loc - Vector((0, 0, 0.012)); fin.rotation_euler = (math.radians(-12), 0, 0)
paint(fin, mat, lambda c, n_, p: 'blue_dk' if c.z > loc.z + 0.055 else 'blue')

# tail fin: big dark fan at the rump, vertical blade
loc, n = shoot(body, (0, 0.1, 0.13), (0, 1, 0.45))
tf = sphere('mud_tail', radius=1, seg=24, rings=16)
def ftail(v):
    t = (v.y + 1) / 2                                 # 0 base .. 1 far edge
    h = 0.014 + 0.066 * math.sin(math.pi / 2 * min(1, t * 1.15)) ** 0.9   # widens into a fan
    reach = 0.115 * (1 - 0.35 * v.z * v.z)                                 # rounded far edge
    return Vector((v.x * 0.009 * (1 - 0.4 * t), t * reach, v.z * h + 0.018 * t))
deform(tf, ftail)
tf.location = loc - n * 0.012; tf.rotation_euler = (math.radians(30), 0, 0)
paint(tf, mat, lambda c, n_, p: 'tail_edge' if (c - loc).length > 0.098 else 'tail')

# legs: stubby blue legs with shoulders/thighs, round paws, 3 toe bumps
LEGS = {'hand_l': (0.058, -0.075), 'hand_r': (-0.058, -0.075), 'foot_l': (0.066, 0.12), 'foot_r': (-0.066, 0.12)}
for nm, (x, y) in LEGS.items():
    back = nm.startswith('foot')
    lg = cone(f'mud_leg_{nm}', 0.024, 0.029, 0.07, verts=14, loc=(x, y, 0.045)); smooth(lg); paint_all(lg, mat, 'blue')
    th = sphere(f'mud_thigh_{nm}', loc=(x * 0.93, y + 0.004, 0.08), radius=1, seg=18, rings=10,
                scale=(0.034, 0.05 if back else 0.042, 0.045)); paint_all(th, mat, 'blue')
    pw = sphere(f'mud_paw_{nm}', loc=(x, y - 0.008, 0.013), radius=1, seg=18, rings=10, scale=(0.026, 0.032, 0.014)); paint_all(pw, mat, 'blue')
    for i, a in enumerate((-28, 0, 28)):
        ar = math.radians(a)
        cl = sphere(f'mud_claw_{nm}{i}', radius=1, seg=8, rings=6, scale=(0.006, 0.008, 0.005))
        cl.location = (x + math.sin(ar) * 0.022, y - 0.008 - math.cos(ar) * 0.03, 0.009); cl.rotation_euler = (0, 0, ar)
        paint_all(cl, mat, 'blue_lt')
print('tris', tri_count())

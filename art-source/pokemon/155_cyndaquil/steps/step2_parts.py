# Cyndaquil step 2: eyes, nose, mouth, legs & paws, back spots, flames
mat = bpy.data.materials['M_155_cyndaquil']; fmat = bpy.data.materials['M_155_cyndaquil_flame']
head = bpy.data.objects['cyn_head']; body = bpy.data.objects['cyn_body']
HC = Vector((0, -0.14, 0.2))
def shoot(o, center, direction):
    """surface point of o hit by a ray aimed from outside at `center` along -direction (always inside -> always hits)"""
    d = Vector(direction).normalized(); c = Vector(center)
    ok, loc, n, _ = o.ray_cast(c + d, -d)
    assert ok, (o.name, center, direction)
    return loc, n

# closed, content eyes: thin arcs SET INTO the head (flat axis aligned with the surface normal)
for s, nm in ((1, 'l'), (-1, 'r')):
    loc, n = shoot(head, HC + Vector((0, -0.035, 0.015)), (s, -0.7, 0.45))
    e = sphere(f'cyn_eye_{nm}', radius=1, seg=16, rings=8)
    deform(e, lambda v: Vector((v.x * 0.018, v.y * 0.004, v.z * 0.0042 + 0.004 * (1 - v.x * v.x))))  # gentle upward arc
    # local Y (thin) -> surface normal, local X (long) -> roughly along the head, tilted
    q = Vector((0, 1, 0)).rotation_difference(-n)
    e.rotation_mode = 'QUATERNION'
    tang = (q @ Vector((1, 0, 0)))
    want = Vector((0, -1, 0.35)).normalized(); want = (want - n * want.dot(n)).normalized()
    ang = tang.angle(want) * (1 if tang.cross(want).dot(-n) > 0 else -1)
    from mathutils import Quaternion
    e.rotation_quaternion = Quaternion(-n, ang) @ q
    e.location = loc - n * 0.0022          # sunk in: only a thin line shows
    paint_all(e, mat, 'eye')

# nose tip
loc, n = shoot(head, HC + Vector((0, -0.08, -0.008)), (0, -1, 0.1))
ns = sphere('cyn_nose', loc=loc - n * 0.003, radius=1, seg=12, rings=8, scale=(0.009, 0.008, 0.007)); paint_all(ns, mat, 'nose')

# mouth: a thin dark smile following the snout surface (curve with bevel -> closed mesh)
pts = []
for k in range(-8, 9):
    t = k / 8.0 * 0.72
    a_ = abs(t)   # t=0 under the nose, |t|=1 at the cheek below the eye; curls up at the ends (smile)
    d = Vector((math.sin(t * 1.45), -math.cos(t * 1.45) * 0.7, -0.12 + 0.12 * a_ ** 3))
    loc, n = shoot(head, HC + Vector((0, -0.088 + 0.058 * a_, -0.02 + 0.008 * a_ ** 2)), d)
    pts.append(loc + n * 0.0012)
cu = bpy.data.curves.new('cyn_mouth', 'CURVE'); cu.dimensions = '3D'
sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
for p_, v in zip(sp.points, pts): p_.co = (v.x, v.y, v.z, 1)
cu.bevel_depth = 0.0021; cu.bevel_resolution = 1; cu.use_fill_caps = True
co = new_obj('cyn_mouth_c', cu)
bpy.ops.object.select_all(action='DESELECT'); co.select_set(True); bpy.context.view_layer.objects.active = co
bpy.ops.object.convert(target='MESH'); mo = bpy.context.active_object; mo.name = 'cyn_mouth'
paint_all(mo, mat, 'eye')

# legs: stubby cream legs with round paws and 3 claws
LEGS = {'hand_l': (0.062, -0.085), 'hand_r': (-0.062, -0.085), 'foot_l': (0.07, 0.13), 'foot_r': (-0.07, 0.13)}
for nm, (x, y) in LEGS.items():
    back = nm.startswith('foot')
    lg = cone(f'cyn_leg_{nm}', 0.027, 0.033 if back else 0.031, 0.08, verts=14, loc=(x, y, 0.05)); smooth(lg)
    paint_all(lg, mat, 'cream')
    if not back:   # upper foreleg / shoulder joins the leg to the body
        sh = sphere(f'cyn_thigh_{nm}', loc=(x * 0.93, y + 0.005, 0.088), radius=1, seg=18, rings=10, scale=(0.034, 0.044, 0.048)); paint_all(sh, mat, 'cream')
    if back:
        th = sphere(f'cyn_thigh_{nm}', loc=(x * 0.95, y, 0.085), radius=1, seg=18, rings=10, scale=(0.038, 0.055, 0.05)); paint_all(th, mat, 'cream')
    pw = sphere(f'cyn_paw_{nm}', loc=(x, y - 0.01, 0.014), radius=1, seg=18, rings=10, scale=(0.028, 0.036, 0.015)); paint_all(pw, mat, 'cream')
    for i, a in enumerate((-25, 0, 25)):
        ar = math.radians(a)
        cl = sphere(f'cyn_claw_{nm}{i}', radius=1, seg=8, rings=6, scale=(0.005, 0.008, 0.005))
        cl.location = (x + math.sin(ar) * 0.024, y - 0.01 - math.cos(ar) * 0.034, 0.01); cl.rotation_euler = (0, 0, ar)
        paint_all(cl, mat, 'claw')

# back spots (flame vents) + flames: 4 vents in a fan on the rump/lower back
VENTS = [(-0.05, 0.1, 30), (-0.017, 0.07, 10), (0.017, 0.07, -10), (0.05, 0.1, -30)]
for i, (x, y, fan) in enumerate(VENTS):
    loc, n = shoot(body, (x, y, 0.12), (0, 0, 1))
    sp = sphere(f'cyn_spot_{i}', radius=1, seg=14, rings=8, scale=(0.016, 0.016, 0.004))
    sp.location = loc; sp.rotation_euler = Vector((0, 0, 1)).rotation_difference(n).to_euler(); paint_all(sp, mat, 'spot')
    for layer, (r, h, col) in enumerate(((0.026, 0.15, 'flame_out'), (0.017, 0.11, 'flame_mid'), (0.009, 0.07, 'flame_in'))):
        fl = sphere(f'cyn_flame_{i}_{layer}', radius=1, seg=12, rings=10)
        def ff(v, r=r, h=h, ph=i * 1.3):
            t = (v.z + 1) / 2
            rad = r * math.sin(math.pi * min(1, t ** 0.55)) * (1 - 0.15 * math.sin(v.x * 3 + ph))
            return Vector((v.x * rad, v.y * rad + 0.05 * h * t * t * 6, t * h + 0.03 * math.sin(t * 5 + ph) * t * h))
        deform(fl, ff)
        fl.location = loc - n * 0.004 + Vector((0, 0, -0.004 * layer))
        fl.rotation_euler = (math.radians(-38), math.radians(fan), 0)
        paint_all(fl, fmat, col)
print('tris', tri_count())

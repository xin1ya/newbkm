# Volcarona (637) · bug/fire · 1.6 m. Sun moth: black body with a white fluffy ruff, blue compound eyes, red horns, six huge orange-red wings (scalloped, each with black-edged markings), fuzzy white thorax.
reset('637_volcarona')
M = pal([('black', '#2a2628'), ('fluff', '#f4f0e8'), ('wing', '#f07a2a'), ('wing_dk', '#c8462a'), ('wing_edge', '#2a2020'), ('horn', '#e04a2a'), ('eye', '#5ab0e8'), ('white', '#ffffff')])
VW = [0.435, 44.655, 0.666, 0.400, 3.244, 0.728, 0.306, -47.605, 0.470, 0.420, 1.899]
WY = VW[0]
Z = 0.9; BC = Vector((0, 0, Z))
blob('vc_abdomen', BC + Vector((0, -0.03, -0.24)), (0.055, 0.055, 0.13), 'black', 'hips', seg=16, rings=10, rot=(-25, 0, 0))
CS = min(VW[10], 1.3)
blob('vc_chest', BC + Vector((0, -0.04, -0.08)), (0.15 * CS, 0.12 * CS, 0.17 * CS), 'fluff', 'spine', seg=20, rings=12)
blob('vc_thorax', BC, (0.12, 0.1, 0.1), 'black', 'spine', seg=20, rings=12)
for k in range(12):
    a = 2 * math.pi * k / 12
    blob(f'vc_ruff{k}', BC + Vector((math.cos(a) * 0.12, math.sin(a) * 0.1 - 0.02, 0.06)), (0.07, 0.07, 0.06), 'fluff', 'spine', seg=8, rings=5)
HC = BC + Vector((0, -0.13, 0.15))
head = blob('vc_head', HC, (0.085, 0.08, 0.075), 'black', 'head', seg=16, rings=10)
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'vc_eye_{nm}', head, HC, (s * 0.6, -1, 0.1), (0.035, 0.01, 0.03), 'eye', 'head', sink=0.2, seg=10, rings=6)
    for k in range(3):
        o = cone(f'vc_horn{k}_{nm}', 0.015, 0.002, 0.12, verts=6, loc=HC + Vector((s * (0.03 + 0.02 * k), 0, 0.09))); o.rotation_euler = (math.radians(-10), math.radians(s * (15 + 15 * k)), 0); colorize(o, 'horn'); reg(o, 'head')
    for w, (a, L, W) in enumerate(((VW[1], VW[2], VW[3]), (VW[4], VW[5], VW[6]), (VW[7], VW[8], VW[9]))):
        d = Vector((s * math.cos(math.radians(a)), WY, math.sin(math.radians(a)))).normalized()
        c = BC + d * L * 0.5 + Vector((0, 0.05, 0))
        def wc(cc, n, p, c=c, d=d, L=L, W=W):
            t = (cc - c).dot(d) / (L * 0.5); u = ((cc - c) - d * (cc - c).dot(d)).length / (W * 0.5)
            if t * t + u * u > 0.8: return 'wing_edge'
            return 'wing_dk' if abs(t - 0.3) < 0.15 else 'wing'
        o = blob(f'vc_wing{w}_{nm}', c, (L * 0.5, 0.012, W * 0.5), wc, f'wing{w}_{nm}', seg=24, rings=10, fn=lambda v: Vector((v.x, v.y, v.z * (1 - 0.75 * max(0.0, v.x) ** 1.5))))
        yv = Vector((0, 1, 0)); yv = (yv - d * yv.dot(d)).normalized(); zv = d.cross(yv)
        o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Matrix((d, yv, zv)).transposed().to_quaternion()
bones = [('root', (0, 0, 0), None), ('hips', tuple(BC + Vector((0, 0.05, -0.15))), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(HC), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'wing{w}_{nm}', tuple(BC + Vector((s * 0.08, 0.05, 0.03 - 0.03 * w))), 'spine') for w in range(3)]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.08, 0))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.2, 0))), 'head')])
def flap(L, a, n=8):
    return {f'wing{w}_{nm}': loop([(round(L * i / n), {'r': (0, sg * a * math.sin(2 * math.pi * (i / n - 0.05 * w)), 0)}) for i in range(n)], L) for w in range(3) for nm, sg in (('l', -1), ('r', 1))}
hv = lambda L, a: merge({'root': bob(0.05, L, 0.25, 4)}, flap(L, a))
plan_clips(rig, 'rigid', size=1.6, over={'idle': (30, hv(30, 18), True, None), 'idle_alt': (60, hv(60, 12), True, None), 'walk': (24, hv(24, 25), True, None), 'run': (16, hv(16, 30), True, None), 'fly': (20, hv(20, 28), True, None)})
sheet('check', 1.6, poses=[('idle', 6, 'front'), ('attack_special', 12, 'q34')])
export(637, 'volcarona', 1.6, 'rigid', rig, mesh, shiny={'wing': '#f0c84a', 'wing_dk': '#c8a02a'})

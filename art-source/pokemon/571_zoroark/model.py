# Zoroark (571) · dark · 1.6 m. Lean dark-gray fox biped: huge flowing red-tipped black mane down the back, red eye shadow and teal eyes, tall pointed ears, long red claws, black ruff, slim digitigrade legs.
reset('571_zoroark')
M = pal([('navy', '#4a4f5c'), ('navy_dk', '#2a2d36'), ('cream', '#5c6170'), ('cream_dk', '#3a3e48'), ('eye', '#1a1418'), ('iris', '#3fb8b0'), ('nose', '#1a1418'),
         ('flame', '#1b1d23'), ('flame_y', '#2a2d36'), ('flame_r', '#c8323c'), ('claw', '#c8323c'), ('mouth', '#6a2020')])
BC = Vector((0, 0.03, 0.74)); HC = Vector((0, -0.1, 1.24))
body = blob('ty_body', BC, (0.17, 0.15, 0.36), lambda c, n, p: 'cream' if n.y < -0.25 else 'navy', lambda c: lerp_w('spine', 'chest', (c.z - 0.6) / 0.35) if c.z > 0.5 else lerp_w('hips', 'spine', (c.z - 0.35) / 0.15), seg=40, rings=24,
            fn=lambda v: Vector((v.x * (1 - 0.18 * v.z), v.y * (1 - 0.1 * v.z), v.z)))
neck = blob('ty_neck', (0, -0.04, 1.08), (0.15, 0.14, 0.13), 'flame', 'neck', seg=28, rings=14)
head = blob('ty_head', HC, (0.11, 0.14, 0.1), 'navy', 'head', seg=36, rings=20,
            fn=lambda v: Vector((v.x * (1 - 0.35 * max(0, -v.y)), v.y * (1 + 0.35 * max(0, -v.y)), v.z * (1 - 0.3 * max(0, -v.y)))))
blob('ty_nose', HC + Vector((0, -0.21, 0.0)), (0.02, 0.015, 0.014), 'nose', 'head', seg=12, rings=8)
decal('ty_mouth', head, HC + Vector((0, -0.05, -0.04)), (0, -1, -0.35), (0.06, 0.008, 0.008), 'mouth', 'head', sink=0.3)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'ty_eye_{nm}', head, HC + Vector((0, -0.03, 0.03)), (s * 0.7, -0.6, 0.3), (0.04, 0.012, 0.022), 'flame_r', 'head', sink=0.2, up=(s * -0.3, 0, 1))
    decal(f'ty_iris_{nm}', e, loc, n, (0.018, 0.006, 0.014), 'iris', 'head', sink=0.05, seg=10, rings=6)
    ear = cone(f'ty_ear_{nm}', 0.06, 0.004, 0.2, verts=14, loc=HC + Vector((s * 0.07, 0.04, 0.17))); ear.rotation_euler = (math.radians(-15), math.radians(s * 18), 0); deform(ear, lambda v: Vector((v.x, v.y * 0.5, v.z))); smooth(ear); colorize(ear, lambda c, n_, p: 'flame_r' if n_.y < -0.5 else 'navy'); reg(ear, 'head')
    # arms: short, cream hands with claws
    sh = Vector((s * 0.17, -0.04, 0.96)); el = sh + Vector((s * 0.08, -0.1, -0.14)); hd = el + Vector((s * 0.02, -0.1, -0.04))
    tube(f'ty_arm_{nm}', [sh, el, hd], [0.05, 0.045, 0.04], lambda c, n_, p: 'cream' if n_.y < -0.3 else 'navy', lambda c, nm=nm, sh=sh: lerp_w(f'arm_{nm}', f'hand_{nm}', (sh - c).length / 0.2), seg=14)
    blob(f'ty_hand_{nm}', hd, (0.045, 0.04, 0.04), 'flame', f'hand_{nm}', seg=16, rings=10)
    for k in range(3):
        cl = cone(f'ty_claw_{nm}{k}', 0.012, 0.002, 0.09, verts=6, loc=hd + Vector((s * 0.02 * (k - 1) + s * 0.01, -0.05, -0.01))); cl.rotation_euler = (math.radians(-80), 0, 0); colorize(cl, 'claw'); reg(cl, f'hand_{nm}')
    # legs: thick thighs, cream feet
    hp = Vector((s * 0.15, 0.04, 0.42)); kn = Vector((s * 0.17, -0.02, 0.22)); an = Vector((s * 0.17, 0.02, 0.06))
    tube(f'ty_leg_{nm}', [hp, kn, an], [0.09, 0.06, 0.045], lambda c, n_, p: 'flame' if c.z < 0.3 else 'navy', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.42 - c.z) / 0.36), seg=16)
    blob(f'ty_foot_{nm}', (s * 0.17, -0.06, 0.04), (0.05, 0.11, 0.035), 'flame_r', f'foot_{nm}', seg=18, rings=10)
def flame(name, base, d, L, r, bone, n=6):
    d = Vector(d).normalized(); pts = [Vector(base) + d * L * t + Vector((0, 0.06 * t * t, 0)) for t in [j / (n - 1) for j in range(n)]]
    tube(name, pts, [r * (1 - 0.9 * j / (n - 1)) + 0.003 for j in range(n)], lambda c, n_, p, b=Vector(base): 'flame_y' if (c - b).length < L * 0.3 else ('flame' if (c - b).length < L * 0.7 else 'flame_r'), bone, seg=8)
for k in range(9):   # mane: big black locks sweeping back and down, red tips
    a = math.radians(-60 + 120 * k / 8); b = Vector((math.sin(a) * 0.08, 0.05, 1.32 + 0.03 * math.cos(a)))
    flame(f'zk_mane{k}', b, (math.sin(a) * 0.5, 0.75, -0.9 - 0.3 * abs(math.sin(a))), 0.6 + 0.15 * math.cos(a), 0.075, 'extra_collar', n=8)
for k in range(3):   # forehead tuft
    flame(f'zk_tuft{k}', HC + Vector((0.035 * (k - 1), -0.04, 0.07)), (0.4 * (k - 1), -0.3, 1), 0.16 - 0.03 * abs(k - 1), 0.03, 'head')
tube('ty_tail', [(0, 0.1, 0.48), (0, 0.24, 0.4), (0, 0.36, 0.36)], [0.06, 0.07, 0.015], 'navy', lambda c: lerp_w('hips', 'tail1', (c.y - 0.12) / 0.12), seg=12)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.03, 0.45), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.92), 'spine'), ('neck', (0, -0.04, 1.08), 'chest'), ('head', tuple(HC), 'neck'),
         ('extra_collar', (0, 0.05, 1.32), 'neck'), ('tail1', (0, 0.32, 0.4), 'hips')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.17, -0.04, 0.96), 'chest'), (f'hand_{nm}', (s * 0.34, -0.26, 0.74), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.15, 0.04, 0.42), 'hips'), (f'foot_{nm}', (s * 0.17, 0.02, 0.06), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.23, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.26, 0))), 'head'), ('socket_back', (0, 0.25, 1.1), 'chest')])
FL = lambda L: {'extra_collar': swing(5, L, 0.2, 4, 2)}
plan_clips(rig, 'biped', size=1.6, over={'idle': FL(20), 'walk': FL(16), 'run': FL(8),
    'attack_special': merge(FL(10), {'extra_collar': [(0, {}), (12, {'r': (-25, 0, 0)}), (28, {'r': (10, 0, 0)}), (40, {})]}),   # Eruption flare
    'sleep': {}})
sheet('check', 1.0, poses=[('walk', 7, 'side'), ('run', 4, 'q34'), ('attack_special', 14, 'q34'), ('attack_physical', 15, 'front')])
export(571, 'zoroark', 1.6, 'biped', rig, mesh, shiny={'flame_r': '#8a4cc8', 'claw': '#8a4cc8', 'iris': '#e0b82a'})

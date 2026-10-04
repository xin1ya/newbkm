# Typhlosion (157) · fire · 1.7 m. Upright stocky volcano beast: navy back/head, cream belly and muzzle, narrow red-lidded eyes, a huge ring of flames bursting from its neck collar, short arms with claws, thick legs, short tail.
reset('157_typhlosion')
M = pal([('navy', '#2e4a6b'), ('navy_dk', '#1f3350'), ('cream', '#f3e2a8'), ('cream_dk', '#d9c482'), ('eye', '#1a1418'), ('iris', '#c8323c'), ('nose', '#1a1418'),
         ('flame', '#ff7a1f'), ('flame_y', '#ffd23a'), ('flame_r', '#e0401f'), ('claw', '#f6f0e0'), ('mouth', '#6a2020')])
BC = Vector((0, 0.03, 0.7)); HC = Vector((0, -0.12, 1.28))
body = blob('ty_body', BC, (0.27, 0.24, 0.42), lambda c, n, p: 'cream' if n.y < -0.25 else 'navy', lambda c: lerp_w('spine', 'chest', (c.z - 0.6) / 0.35) if c.z > 0.5 else lerp_w('hips', 'spine', (c.z - 0.35) / 0.15), seg=40, rings=24,
            fn=lambda v: Vector((v.x * (1 - 0.18 * v.z), v.y * (1 - 0.1 * v.z), v.z)))
neck = blob('ty_neck', (0, -0.04, 1.08), (0.16, 0.15, 0.14), lambda c, n, p: 'cream' if n.y < -0.35 else 'navy', 'neck', seg=28, rings=14)
head = blob('ty_head', HC, (0.15, 0.16, 0.13), lambda c, n, p: 'cream' if (n.z < -0.2 and n.y < 0.2) or (n.y < -0.8) else 'navy', 'head', seg=36, rings=20,
            fn=lambda v: Vector((v.x * (1 - 0.35 * max(0, -v.y)), v.y * (1 + 0.35 * max(0, -v.y)), v.z * (1 - 0.3 * max(0, -v.y)))))
blob('ty_nose', HC + Vector((0, -0.21, 0.0)), (0.02, 0.015, 0.014), 'nose', 'head', seg=12, rings=8)
decal('ty_mouth', head, HC + Vector((0, -0.05, -0.04)), (0, -1, -0.35), (0.06, 0.008, 0.008), 'mouth', 'head', sink=0.3)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'ty_eye_{nm}', head, HC + Vector((0, -0.03, 0.03)), (s * 0.7, -0.6, 0.3), (0.04, 0.012, 0.016), 'eye', 'head', sink=0.2, up=(s * -0.3, 0, 1))
    decal(f'ty_iris_{nm}', e, loc, n, (0.02, 0.006, 0.012), 'iris', 'head', sink=0.05, seg=10, rings=6)
    blob(f'ty_ear_{nm}', HC + Vector((s * 0.09, 0.08, 0.1)), (0.035, 0.02, 0.03), 'navy_dk', 'head', seg=10, rings=6)
    # arms: short, cream hands with claws
    sh = Vector((s * 0.24, -0.06, 0.92)); el = sh + Vector((s * 0.08, -0.1, -0.14)); hd = el + Vector((s * 0.02, -0.1, -0.04))
    tube(f'ty_arm_{nm}', [sh, el, hd], [0.07, 0.06, 0.05], lambda c, n_, p: 'cream' if n_.y < -0.3 else 'navy', lambda c, nm=nm, sh=sh: lerp_w(f'arm_{nm}', f'hand_{nm}', (sh - c).length / 0.2), seg=14)
    blob(f'ty_hand_{nm}', hd, (0.055, 0.05, 0.045), 'cream', f'hand_{nm}', seg=16, rings=10)
    for k in range(3):
        cl = cone(f'ty_claw_{nm}{k}', 0.012, 0.002, 0.04, verts=6, loc=hd + Vector((s * 0.02 * (k - 1) + s * 0.01, -0.05, -0.01))); cl.rotation_euler = (math.radians(-80), 0, 0); colorize(cl, 'claw'); reg(cl, f'hand_{nm}')
    # legs: thick thighs, cream feet
    hp = Vector((s * 0.15, 0.04, 0.42)); kn = Vector((s * 0.17, -0.02, 0.22)); an = Vector((s * 0.17, 0.02, 0.06))
    tube(f'ty_leg_{nm}', [hp, kn, an], [0.13, 0.1, 0.07], lambda c, n_, p: 'cream' if c.z < 0.15 else 'navy', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.42 - c.z) / 0.36), seg=16)
    blob(f'ty_foot_{nm}', (s * 0.17, -0.06, 0.04), (0.08, 0.13, 0.045), 'cream', f'foot_{nm}', seg=18, rings=10)
def flame(name, base, d, L, r, bone, n=6):
    d = Vector(d).normalized(); pts = [Vector(base) + d * L * t + Vector((0, 0.06 * t * t, 0)) for t in [j / (n - 1) for j in range(n)]]
    tube(name, pts, [r * (1 - 0.9 * j / (n - 1)) + 0.003 for j in range(n)], lambda c, n_, p, b=Vector(base): 'flame_y' if (c - b).length < L * 0.3 else ('flame' if (c - b).length < L * 0.7 else 'flame_r'), bone, seg=8)
for k in range(13):   # neck flame collar: wide ring bursting out and back
    a = math.radians(-120 + 240 * k / 12); b = Vector((math.sin(a) * 0.17, 0.02 + math.cos(a) * -0.05 + 0.1, 1.12))
    flame(f'ty_cf{k}', b, (math.sin(a) * 1.0, 0.7, 0.8), 0.3 + 0.1 * math.cos(a), 0.05, 'extra_collar')
tube('ty_tail', [(0, 0.24, 0.45), (0, 0.36, 0.36), (0, 0.44, 0.3)], [0.07, 0.05, 0.012], 'navy', lambda c: lerp_w('hips', 'tail1', (c.y - 0.24) / 0.12), seg=12)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.03, 0.45), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.92), 'spine'), ('neck', (0, -0.04, 1.08), 'chest'), ('head', tuple(HC), 'neck'),
         ('extra_collar', (0, 0.1, 1.12), 'chest'), ('tail1', (0, 0.32, 0.4), 'hips')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.24, -0.06, 0.92), 'chest'), (f'hand_{nm}', (s * 0.34, -0.26, 0.74), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.15, 0.04, 0.42), 'hips'), (f'foot_{nm}', (s * 0.17, 0.02, 0.06), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.23, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.26, 0))), 'head'), ('socket_back', (0, 0.25, 1.1), 'chest')])
FL = lambda L: {'extra_collar': loop([(0, {'s': (1, 1, 1)}), (L // 4, {'s': (1.06, 1.08, 1.12)}), (L // 2, {'s': (0.96, 0.95, 0.92)}), (3 * L // 4, {'s': (1.04, 1.05, 1.08)})], L)}
plan_clips(rig, 'biped', size=1.7, over={'idle': FL(20), 'walk': FL(16), 'run': FL(8),
    'attack_special': merge(FL(10), {'extra_collar': [(0, {}), (12, {'s': (1.4, 1.5, 1.6)}), (28, {'s': (1.3, 1.3, 1.4)}), (40, {})]}),   # Eruption flare
    'sleep': {'extra_collar': hold({'s': (0.15, 0.15, 0.15)}, 90)}})
sheet('check', 1.0, poses=[('walk', 7, 'side'), ('run', 4, 'q34'), ('attack_special', 14, 'q34'), ('attack_physical', 15, 'front')])
export(157, 'typhlosion', 1.7, 'biped', rig, mesh, shiny={'navy': '#6b5a3a', 'navy_dk': '#4a3e28', 'flame': '#ff5a3a', 'flame_r': '#c8201f'})

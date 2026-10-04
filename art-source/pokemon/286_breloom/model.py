# Breloom (286) · grass/fighting · 1.2 m. Kangaroo-like: green mushroom-cap head with red seed bumps on the rim, cream face/body, red eyes, long thin green arms with 3 claws, strong cream legs with green feet, green tail ending in a seed ball.
reset('286_breloom')
M = pal([('green', '#4f9a48'), ('green_dk', '#336a30'), ('cream', '#ece0b4'), ('cream_dk', '#c8b888'), ('seed', '#d04a3a'), ('eye', '#d02a2a'), ('pupil', '#1a1418'), ('claw', '#f4f0e0'), ('mouth', '#4a2a1a'), ('white', '#ffffff')])
BP = [0.559, 0.582, 0.556, 1.099, 1.116, 0.190, 18.088]
HC = Vector((0, -0.03, 0.95))
head = blob('br_face', HC, (0.14, 0.13, 0.12), 'cream', 'head', seg=28, rings=16)
CC = HC + Vector((0, -0.03, 0.1))
blob('br_cap', CC, (BP[5], BP[5], BP[5] * 0.5), lambda c, n, p: 'green_dk' if n.z < -0.3 else 'green', 'head', seg=32, rings=16, rot=(BP[6], 0, 0), fn=lambda v: Vector((v.x, v.y, v.z * (0.5 if v.z < 0 else 1.0))))
for k in range(8):
    a = 2 * math.pi * k / 8 + 0.4
    blob(f'br_seed{k}', CC + Matrix.Rotation(math.radians(BP[6]), 3, 'X') @ Vector((math.cos(a) * (BP[5] - 0.01), math.sin(a) * (BP[5] - 0.01), -0.03)), (0.03, 0.03, 0.03), 'seed', 'head', seg=10, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'br_eye_{nm}', head, HC + Vector((0, 0, 0.0)), (s * 0.45, -1, -0.45), (0.026, 0.008, 0.018), 'eye', 'head', sink=0.2)
    decal(f'br_pupil_{nm}', e, loc + Vector((s * -0.004, 0, 0)), n, (0.008, 0.004, 0.012), 'pupil', 'head', sink=0.05, seg=8, rings=6)
blob('br_snout', HC + Vector((0, -0.13, -0.1)), (0.065, 0.06, 0.045), 'cream', 'head', seg=16, rings=10)
decal('br_mouth', head, HC + Vector((0, -0.03, -0.1)), (0, -1, -0.7), (0.025, 0.004, 0.005), 'mouth', 'head', sink=0.3)
BC = Vector((0, 0.02, 0.53))
blob('br_body', BC, (0.16 * BP[3], 0.15 * BP[3], 0.21 * BP[3]), lambda c, n, p: 'cream' if n.y < -0.4 and c.z > 0.62 else 'green', lambda c: lerp_w('spine', 'chest', (c.z - 0.45) / 0.25), seg=28, rings=16,
     fn=lambda v: Vector((v.x * (1 + 0.15 * -v.z), v.y * (1 + 0.15 * -v.z), v.z)))
tube('br_neck', [BC + Vector((0, 0, 0.18)), HC + Vector((0, 0.02, -0.08))], [0.06, 0.05], 'cream', lambda c: lerp_w('chest', 'head', (c.z - 0.73) / 0.15), seg=12)
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = Vector((s * 0.1, 0.0, 0.72)); el = Vector((s * 0.22, -0.04, 0.55)); wr = Vector((s * 0.26, -0.12, 0.4))
    tube(f'br_arm_{nm}', [sh, el, wr], [0.03, 0.022, 0.02], 'green', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (0.7 - c.z) / 0.3), seg=10)
    for k in (-1, 0, 1):
        tube(f'br_claw{k}_{nm}', [wr, wr + Vector((s * 0.01 + k * 0.025, -0.04, -0.06))], [0.012, 0.002], 'claw', f'hand_{nm}', seg=6)
    hip = Vector((s * 0.08, 0.05, 0.42)); kn = Vector((s * 0.11, -0.04, 0.22)); an = Vector((s * 0.1, 0.06, 0.07))
    tube(f'br_leg_{nm}', [hip, kn, an], [0.055 * BP[4], 0.04 * BP[4], 0.03 * BP[4]], 'green', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.42 - c.z) / 0.38), seg=12)
    blob(f'br_foot_{nm}', an + Vector((0, -0.07, -0.04)), (0.05, 0.1, 0.035), 'green', f'foot_{nm}', seg=14, rings=8)
TP = [Vector((0, 0.12, 0.42)), Vector((0, 0.3, 0.44)), Vector((0, 0.45 * BP[0] / 0.55, BP[2])), Vector((0, BP[0], BP[1]))]
tube('br_tail', TP, [0.055, 0.045, 0.038, 0.032], 'cream', lambda c: lerp_w('tail1', 'tail2', (c.y - 0.12) / 0.43), seg=10)
for k, o_ in enumerate(((0, 0.03, 0.06), (0.05, 0.04, 0.0), (-0.05, 0.04, 0.0))):
    blob(f'br_tailball{k}', TP[-1] + Vector(o_), (0.075, 0.075, 0.075), 'green', 'tail2', seg=16, rings=10)
for k in range(5):
    a = 2 * math.pi * k / 5
    blob(f'br_tseed{k}', TP[-1] + Vector((math.cos(a) * 0.075, 0.09, 0.03 + math.sin(a) * 0.075)), (0.018, 0.018, 0.018), 'seed', 'tail2', seg=8, rings=6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.03, 0.42), 'root'), ('spine', (0, 0.02, 0.55), 'hips'), ('chest', (0, 0.01, 0.7), 'spine'), ('head', tuple(HC + Vector((0, 0, -0.08))), 'chest'),
         ('tail1', tuple(TP[0]), 'hips'), ('tail2', tuple(TP[2]), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.1, 0, 0.72), 'chest'), (f'hand_{nm}', (s * 0.24, -0.08, 0.47), f'arm_{nm}'), (f'thigh_{nm}', (s * 0.08, 0.05, 0.42), 'hips'), (f'foot_{nm}', (s * 0.1, 0.06, 0.08), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.15, -0.04))), 'head'), ('socket_fx', tuple(CC + Vector((0, 0, 0.15))), 'head')])
plan_clips(rig, 'biped', size=1.2, over={'attack_physical': {'arm_r': [(0, {}), (9, {'r': (40, 0, -30)}), (15, {'r': (-95, 0, 0)}), (28, {})]}})   # Mach Punch: stretching arm jab
sheet('check', 1.2, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(286, 'breloom', 1.2, 'biped', rig, mesh, shiny={'green': '#a8b84a', 'green_dk': '#788a2a'})

# Psyduck (54) · water · 0.8 m. Yellow duck standing upright: big round head with three black hair strands, blank wide eyes,
# flat cream bill, pear-shaped body, short arms raised to hold its head, cream webbed feet, a little tail tuft.
reset('054_psyduck')
M = pal([('yellow', '#f2cc52'), ('yellow_lt', '#f8dc7a'), ('yellow_dk', '#d8ae38'), ('bill', '#f4e6c4'), ('bill_dk', '#d8c49a'), ('eyew', '#ffffff'),
         ('pupil', '#1a1418'), ('hair', '#2a2622'), ('claw', '#f4e6c4')])
HC = Vector((0, -0.03, 0.58)); BC = Vector((0, 0.01, 0.27))
body = blob('psy_body', BC, (0.22, 0.2, 0.21), lambda c, n, p: 'yellow_lt' if n.y < -0.5 else 'yellow', lambda c: lerp_w('spine', 'chest', (c.z - 0.22) / 0.15), seg=40, rings=22,
            fn=lambda v: Vector((v.x * (1 - 0.18 * max(0, v.z)), v.y * (1 - 0.12 * max(0, v.z)), v.z)))
head = blob('psy_head', HC, (0.2, 0.18, 0.165), 'yellow', 'head', seg=40, rings=22)
tube('psy_neck', [BC + Vector((0, 0, 0.14)), HC + Vector((0, 0.01, -0.12))], [0.16, 0.14], 'yellow', 'chest', seg=16)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'psy_eye_{nm}', head, HC + Vector((0, 0, 0.03)), (s * 0.42, -1, 0.25), (0.045, 0.012, 0.05), 'eyew', 'head', sink=0.3)
    decal(f'psy_pupil_{nm}', e, l, n, (0.007, 0.004, 0.007), 'pupil', 'head', sink=-0.1, seg=10, rings=6)
# flat broad bill
bill = blob('psy_bill', HC + Vector((0, -0.21, -0.05)), (0.1, 0.11, 0.035), lambda c, n, p: 'bill' if n.z > -0.3 else 'bill_dk', 'head', seg=28, rings=12,
            fn=lambda v: Vector((v.x * (1 + 0.2 * max(0, -v.y)), v.y, v.z * (1 - 0.3 * max(0, -v.y)))))
for s in (1, -1):
    decal(f'psy_nostril{s + 1}', bill, HC + Vector((s * 0.025, -0.24, -0.02)), (s * 0.2, -0.3, 1), (0.006, 0.003, 0.004), 'bill_dk', 'head', sink=0.3, seg=8, rings=5)
# three hair strands
for k, (x, lean) in enumerate(((0, 0), (0.025, 0.4), (-0.025, -0.4))):
    b0 = HC + Vector((x, 0.0, 0.15))
    tube(f'psy_hair{k}', [b0, b0 + Vector((lean * 0.02, -0.005, 0.04)), b0 + Vector((lean * 0.045, 0.01, 0.07))], [0.006, 0.005, 0.002], 'hair', 'head', seg=6)
# arms raised to the sides of the head
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = BC + Vector((s * 0.18, -0.02, 0.12)); el = sh + Vector((s * 0.1, -0.04, 0.06)); hd = HC + Vector((s * 0.2, -0.04, -0.03))
    tube(f'psy_arm_{nm}', [sh, el, hd], [0.035, 0.03, 0.028], 'yellow', lambda c, nm=nm, sh=sh: lerp_w(f'arm_{nm}', f'hand_{nm}', ((c - sh).length - 0.06) / 0.08), seg=12)
    blob(f'psy_hand_{nm}', hd, (0.03, 0.035, 0.04), 'yellow', f'hand_{nm}', seg=14, rings=8)
    for k in range(3):
        cone_ = cone(f'psy_claw{k}_{nm}', 0.006, 0.0, 0.018, verts=6, loc=hd + Vector((-s * 0.02, -0.025 + 0.02 * k, 0.03)))
        cone_.rotation_euler = (0, math.radians(-s * 40), 0); colorize(cone_, 'claw'); reg(cone_, f'hand_{nm}')
# legs and webbed feet
for s, nm in ((1, 'l'), (-1, 'r')):
    hp = Vector((s * 0.1, 0.0, 0.12)); ft = Vector((s * 0.1, -0.01, 0.03))
    tube(f'psy_leg_{nm}', [hp, ft], [0.045, 0.035], 'yellow', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.11 - c.z) / 0.07), seg=12)
    blob(f'psy_foot_{nm}', Vector((s * 0.1, -0.05, 0.016)), (0.06, 0.08, 0.016), 'bill', f'foot_{nm}', seg=18, rings=8,
         fn=lambda v: Vector((v.x * (1 + 0.4 * max(0, -v.y)), v.y, v.z)))
tube('psy_tail', [BC + Vector((0, 0.16, -0.1)), BC + Vector((0, 0.25, -0.11)), BC + Vector((0, 0.32, -0.08))], [0.06, 0.035, 0.004], 'yellow', 'hips', seg=12, flat=0.6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.01, 0.12), 'root'), ('spine', tuple(BC), 'hips'), ('chest', tuple(BC + Vector((0, 0, 0.14))), 'spine'),
         ('head', tuple(HC - Vector((0, 0, 0.12))), 'chest')]
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = BC + Vector((s * 0.18, -0.02, 0.12))
    bones += [(f'arm_{nm}', tuple(sh), 'chest'), (f'hand_{nm}', tuple(sh + Vector((s * 0.1, -0.04, 0.06))), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.08, 0, 0.12), 'hips'), (f'foot_{nm}', (s * 0.09, -0.01, 0.03), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.3, -0.05))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.05, 0.12))), 'head')])
plan_clips(rig, 'biped', size=0.8, over={'idle_alt': (90, {'head': [(0, {}), (20, {'r': (0, 0, 12)}), (45, {'r': (0, 0, -12)}), (70, {'r': (0, 0, 8)}), (90, {})]}, True, None),   # headache sway
                                        'attack_special': {'head': [(0, {}), (10, {'r': (-12, 0, 0)}), (22, {'r': (6, 0, 0)}), (40, {})],
                                                           'arm_l': [(0, {}), (10, {'r': (0, 0, 15)}), (40, {})], 'arm_r': [(0, {}), (10, {'r': (0, 0, -15)}), (40, {})]}})   # Confusion
sheet('check', 0.8, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 10, 'q34'), ('idle', 20, 'front')])
export(54, 'psyduck', 0.8, 'biped', rig, mesh, shiny={'yellow': '#8ac8e8', 'yellow_lt': '#a8d8f0', 'yellow_dk': '#6aa8c8'})

# Golduck (55) · water · 1.7 m. Evolution of Psyduck — geometry matched to the reference (art-source/reference, comparison only):
# lean blue duck-humanoid: slim torso with a narrow waist, long cream bill, red jewel on the forehead, fierce red eyes, a crown of
# back-swept head spikes, long arms ending in webbed 3-claw hands with fin spurs on the forearms, long digitigrade legs with webbed feet,
# and a long tapering tail held out behind.
reset('055_golduck')
M = pal([('blue', '#5a86b0'), ('blue_lt', '#7aa2c8'), ('blue_dk', '#3e6890'), ('bill', '#e8dcb4'), ('bill_dk', '#c4b48a'), ('eye', '#c8303a'),
         ('pupil', '#1a1418'), ('gem', '#e03040'), ('white', '#ffffff'), ('claw', '#e8dcb4')])
BC = Vector((0, 0.02, 0.98)); CH = Vector((0, 0.0, 1.18)); HC = Vector((0, -0.02, 1.45)); HP = Vector((0, 0.03, 0.8))
blob('gd_chest', CH, (0.25, 0.18, 0.22), lambda c, n, p: 'blue_lt' if n.y < -0.6 else 'blue', 'chest', seg=32, rings=18)
tube('gd_torso', [HP, BC, CH], [0.2, 0.15, 0.2], 'blue', lambda c: lerp_w('hips', 'chest', (c.z - 0.8) / 0.38), seg=24)
blob('gd_hips', HP, (0.22, 0.16, 0.13), 'blue', 'hips', seg=28, rings=14)
tube('gd_neck', [CH + Vector((0, 0, 0.1)), HC + Vector((0, 0.02, -0.08))], [0.1, 0.1], 'blue', 'head', seg=16)
head = blob('gd_head', HC, (0.17, 0.18, 0.16), 'blue', 'head', seg=32, rings=18)
bill = blob('gd_bill', HC + Vector((0, -0.3, -0.05)), (0.095, 0.21, 0.05), lambda c, n, p: 'bill' if n.z > -0.3 else 'bill_dk', 'head', seg=24, rings=12,
            fn=lambda v: Vector((v.x * (1 + 0.15 * max(0, -v.y)), v.y, v.z * (1 - 0.25 * max(0, -v.y)))))
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'gd_eye_{nm}', head, HC + Vector((0, 0, 0.02)), (s * 0.6, -0.75, 0.15), (0.04, 0.012, 0.024), 'eye', 'head', sink=0.3, up=(-s * 0.4, 0, 1))
    decal(f'gd_pupil_{nm}', e, l, n, (0.008, 0.004, 0.008), 'pupil', 'head', sink=-0.1, seg=10, rings=6)
g, gl, gn = decal('gd_gem', head, HC + Vector((0, 0, 0.05)), (0, -1, 0.6), (0.03, 0.014, 0.03), 'gem', 'head', sink=0.2)
decal('gd_gemshine', g, gl + Vector((0.005, -0.004, 0.006)), gn, (0.006, 0.003, 0.006), 'white', 'head', sink=0.05, seg=8, rings=5)
# crown of back-swept spikes
for k, (ax, az, ln) in enumerate(((0, 70, 0.28), (25, 55, 0.22), (-25, 55, 0.22), (45, 30, 0.16), (-45, 30, 0.16))):
    d = Vector((math.sin(math.radians(ax)) * 0.6, math.cos(math.radians(az)) * 0.6 + 0.4, math.sin(math.radians(az)))).normalized()
    b0 = HC + d * 0.1
    tube(f'gd_spike{k}', [b0, b0 + d * ln * 0.75 + Vector((0, 0.03, 0)), b0 + d * ln * 1.5 + Vector((0, 0.07, 0))], [0.055, 0.03, 0.003], 'blue', 'head', seg=8)
# long arms held out, webbed claws, forearm fin spurs
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = CH + Vector((s * 0.22, 0.01, 0.08)); a = math.radians(50); d = Vector((s * math.cos(a), 0.0, -math.sin(a)))
    el = sh + d * 0.3; wr = el + d * 0.28
    tube(f'gd_upper_{nm}', [sh - d * 0.05, sh + d * 0.1, el], [0.085, 0.07, 0.058], 'blue', f'arm_{nm}', seg=14)
    tube(f'gd_fore_{nm}', [el - d * 0.02, wr], [0.058, 0.05], 'blue', f'fore_{nm}', seg=14)
    for j in range(2):
        b0 = el + d * (0.08 + 0.1 * j)
        tube(f'gd_fin{j}_{nm}', [b0, b0 + Vector((0, 0.05, -0.03)), b0 + Vector((s * 0.03, 0.09, -0.04))], [0.03, 0.018, 0.003], 'blue_dk', f'fore_{nm}', seg=8)
    blob(f'gd_hand_{nm}', wr + d * 0.04, (0.05, 0.045, 0.02), 'blue', f'hand_{nm}', seg=16, rings=8)
    for k in range(3):
        fd = (d + Vector((0, (k - 1) * 0.6, 0))).normalized(); f0 = wr + d * 0.06
        tube(f'gd_finger{k}_{nm}', [f0, f0 + fd * 0.06], [0.014, 0.01], 'blue', f'hand_{nm}', seg=8)
        c = cone(f'gd_claw{k}_{nm}', 0.009, 0.0, 0.025, verts=6, loc=f0 + fd * 0.075); c.rotation_mode = 'QUATERNION'
        c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(fd); colorize(c, 'claw'); reg(c, f'hand_{nm}')
# long legs with a bent knee, webbed feet
for s, nm in ((1, 'l'), (-1, 'r')):
    hp = Vector((s * 0.13, 0.03, 0.78)); kn = Vector((s * 0.22, -0.06, 0.45)); an = Vector((s * 0.22, 0.05, 0.1))
    tube(f'gd_thigh_{nm}', [hp, kn], [0.15, 0.09], 'blue', f'thigh_{nm}', seg=16)
    tube(f'gd_shin_{nm}', [kn, an], [0.08, 0.055], 'blue', f'shin_{nm}', seg=14)
    blob(f'gd_heel_{nm}', an + Vector((0, 0, -0.04)), (0.045, 0.06, 0.04), 'blue', f'foot_{nm}', seg=14, rings=8)
    for k in range(3):
        fd = Vector(((k - 1) * 0.5 * s + s * 0.1, -1, 0)).normalized(); f0 = an + Vector((0, -0.03, -0.07))
        tube(f'gd_toe{k}_{nm}', [f0, f0 + fd * 0.13], [0.022, 0.014], 'blue', f'foot_{nm}', seg=8, flat=0.5)
        c = cone(f'gd_tclaw{k}_{nm}', 0.01, 0.0, 0.025, verts=6, loc=f0 + fd * 0.15); c.rotation_mode = 'QUATERNION'
        c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(fd); colorize(c, 'claw'); reg(c, f'foot_{nm}')
    blob(f'gd_web_{nm}', an + Vector((0, -0.09, -0.085)), (0.07, 0.07, 0.008), 'blue_dk', f'foot_{nm}', seg=14, rings=6)
tube('gd_tail', [HP + Vector((0, 0.08, -0.02)), HP + Vector((0, 0.35, -0.14)), HP + Vector((0, 0.7, -0.24)), HP + Vector((0, 1.0, -0.28))], [0.13, 0.09, 0.05, 0.005],
     'blue', lambda c: lerp_w('tail1', 'tail2', (c.y - 0.2) / 0.35), seg=14, flat=0.7)
bones = [('root', (0, 0, 0), None), ('hips', tuple(HP), 'root'), ('spine', tuple(BC), 'hips'), ('chest', tuple(CH), 'spine'), ('head', tuple(HC - Vector((0, 0, 0.1))), 'chest'),
         ('tail1', tuple(HP + Vector((0, 0.1, -0.03))), 'hips'), ('tail2', tuple(HP + Vector((0, 0.45, -0.17))), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = CH + Vector((s * 0.22, 0.01, 0.08)); a = math.radians(50); d = Vector((s * math.cos(a), 0.0, -math.sin(a)))
    bones += [(f'arm_{nm}', tuple(sh), 'chest'), (f'fore_{nm}', tuple(sh + d * 0.3), f'arm_{nm}'), (f'hand_{nm}', tuple(sh + d * 0.58), f'fore_{nm}'),
              (f'thigh_{nm}', (s * 0.13, 0.03, 0.78), 'hips'), (f'shin_{nm}', (s * 0.22, -0.06, 0.45), f'thigh_{nm}'), (f'foot_{nm}', (s * 0.22, 0.05, 0.1), f'shin_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.3, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.08, 0.06))), 'head')])
plan_clips(rig, 'biped', size=1.7, over={'attack_special': {'head': [(0, {}), (10, {'r': (-10, 0, 0)}), (22, {'r': (5, 0, 0)}), (40, {})]}})   # gem glow / Confusion
sheet('check', 1.75, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 10, 'q34'), ('idle', 20, 'front')])
export(55, 'golduck', 1.7, 'biped', rig, mesh, shiny={'blue': '#6aa0d0', 'blue_lt': '#8ab8e0', 'blue_dk': '#4a80b0'})

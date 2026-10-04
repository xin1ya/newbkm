# Sandshrew (27) · ground · 0.6 m. Round yellow armadillo-shrew: brick-patterned yellow back shell, cream belly, pointy snout, small ears, short arms with white claws, short tail.
reset('027_sandshrew')
M = pal([('yellow', '#e0c45a'), ('yellow_dk', '#a88a30'), ('cream', '#f4ecd0'), ('claw', '#ffffff'), ('eye', '#1a1418'), ('nose', '#3a2a1a'), ('white', '#ffffff')])
BC = Vector((0, 0.02, 0.24)); HC = Vector((0, -0.06, 0.45))
def shell(c, n, p):
    if n.y < -0.35 and n.z < 0.5: return 'cream'
    return 'yellow_dk' if (abs(math.sin(c.z * 48)) < 0.18 or abs(math.sin(c.x * 40 + (math.floor(c.z * 15.3) % 2) * 1.57)) < 0.12) and n.y > -0.2 else 'yellow'
body = blob('ss_body', BC, (0.15, 0.14, 0.2), shell, lambda c: lerp_w('spine', 'chest', (c.z - 0.15) / 0.2), seg=36, rings=24)
head = blob('ss_head', HC, (0.11, 0.1, 0.09), lambda c, n, p: 'cream' if n.y < -0.3 and n.z < 0.2 else 'yellow', 'head', seg=30, rings=16)
blob('ss_snout', HC + Vector((0, -0.1, -0.03)), (0.04, 0.06, 0.035), 'yellow', 'head', seg=16, rings=10, fn=lambda v: Vector((v.x * (1 - 0.4 * max(0, -v.y)), v.y, v.z * (1 - 0.3 * max(0, -v.y)))))
blob('ss_nose', HC + Vector((0, -0.16, -0.02)), (0.012, 0.01, 0.01), 'nose', 'head', seg=8, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'ss_eye_{nm}', head, HC + Vector((0, 0, 0.02)), (s * 0.5, -1, 0.15), (0.016, 0.006, 0.022), 'eye', 'head', sink=0.2)
    decal(f'ss_shine_{nm}', e, loc + Vector((0, 0, 0.006)), n, (0.005, 0.002, 0.005), 'white', 'head', sink=0.05, seg=8, rings=6)
    tube(f'ss_ear_{nm}', [HC + Vector((s * 0.07, 0.02, 0.06)), HC + Vector((s * 0.1, 0.03, 0.1))], [0.03, 0.005], 'yellow', f'ear_{nm}', seg=8, flat=0.5)
    sh = Vector((s * 0.12, -0.06, 0.3)); hd = Vector((s * 0.17, -0.1, 0.22))
    tube(f'ss_arm_{nm}', [sh, hd], [0.035, 0.03], 'yellow', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (0.3 - c.z) / 0.08), seg=10)
    for k in range(3):
        tube(f'ss_claw{k}_{nm}', [hd, hd + Vector((s * 0.01 + (k - 1) * 0.015, -0.03, -0.04))], [0.01, 0.002], 'claw', f'hand_{nm}', seg=6)
    hip = Vector((s * 0.08, 0.0, 0.1)); ft = Vector((s * 0.09, -0.03, 0.02))
    tube(f'ss_leg_{nm}', [hip, ft], [0.045, 0.035], 'yellow', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.1 - c.z) / 0.08), seg=10)
    blob(f'ss_foot_{nm}', ft + Vector((0, -0.02, 0)), (0.04, 0.055, 0.025), 'yellow', f'foot_{nm}', seg=12, rings=8)
    for k in range(3):
        tube(f'ss_toe{k}_{nm}', [ft + Vector(((k - 1) * 0.015, -0.06, 0.005)), ft + Vector(((k - 1) * 0.017, -0.08, 0.0))], [0.007, 0.002], 'claw', f'foot_{nm}', seg=6)
tube('ss_tail', [BC + Vector((0, 0.12, -0.12)), BC + Vector((0, 0.2, -0.17)), BC + Vector((0, 0.24, -0.21))], [0.035, 0.025, 0.005], 'yellow_dk', 'tail1', seg=8)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.02, 0.12), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.33), 'spine'), ('head', tuple(HC + Vector((0, 0, -0.04))), 'chest'), ('tail1', tuple(BC + Vector((0, 0.12, -0.12))), 'hips')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.12, -0.06, 0.3), 'chest'), (f'hand_{nm}', (s * 0.17, -0.1, 0.22), f'arm_{nm}'), (f'thigh_{nm}', (s * 0.08, 0, 0.1), 'hips'), (f'foot_{nm}', (s * 0.09, -0.03, 0.03), f'thigh_{nm}'),
              (f'ear_{nm}', tuple(HC + Vector((s * 0.07, 0.02, 0.06))), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.16, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.2, 0))), 'head')])
plan_clips(rig, 'biped', size=0.6)
sheet('check', 0.6, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(27, 'sandshrew', 0.6, 'biped', rig, mesh, shiny={'yellow': '#7aa850', 'yellow_dk': '#4a7830'})

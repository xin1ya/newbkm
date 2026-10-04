# Zubat (41) · poison/flying · 0.8 m. Round blue body, no eyes, big pointed ears, wide open mouth with 4 fangs, large blue wings with purple inner membrane, two long thin legs trailing.
reset('041_zubat')
WT = [0.159, 0.173, 0.400, 0.320, 0.290, 0.305, 0.319, 0.285, 0.188, 0.279, 0.167, -0.018, 0.329, -0.066, -0.071, 0.190, -0.223, 0.054]
M = pal([('blue', '#4a86c8'), ('blue_dk', '#2f5f9a'), ('purple', '#9a5ab0'), ('mouth', '#3a1a2a'), ('tongue', '#d0607a'), ('fang', '#ffffff'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'batwing.py'), encoding='utf-8').read())
Z = 0.42; BC = Vector((0, 0, Z))
body = blob('zb_body', BC, (0.12, 0.11, 0.13), lambda c, n, p: 'blue_dk' if n.z < -0.75 else 'blue', lambda c: lerp_w('spine', 'head', (c.z - Z + 0.05) / 0.1), seg=32, rings=18)
blob('zb_mouth', BC + Vector((0, -0.095, -0.03)), (0.075, 0.04, 0.055), 'mouth', 'head', seg=20, rings=10)
blob('zb_tongue', BC + Vector((0, -0.11, -0.06)), (0.04, 0.02, 0.015), 'tongue', 'head', seg=12, rings=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    for dz, x in ((0.02, 0.035), (-0.075, 0.03)):
        tube(f'zb_fang{dz}_{nm}', [BC + Vector((s * x, -0.13, -0.03 + dz * 0.4 + 0.012 * (1 if dz > 0 else -1))), BC + Vector((s * x, -0.135, -0.03 + dz * 0.4 - 0.018 * (1 if dz > 0 else -1)))], [0.009, 0.001], 'fang', 'head', seg=6)
    # ears
    e0 = BC + Vector((s * 0.06, 0.0, 0.1))
    tube(f'zb_ear_{nm}', [e0, e0 + Vector((s * 0.04, 0.0, 0.08)), e0 + Vector((s * 0.06, 0.005, 0.15))], [0.04, 0.03, 0.002], lambda c, n_, p_: 'purple' if n_.y < -0.4 else 'blue', f'ear_{nm}', seg=10, flat=0.45)
    bat_wing('zb', s, nm, BC + Vector((s * 0.1, 0.02, 0.02)), 0.36, 0.5, 'blue', 'purple', fingers=5, TIPS=[(WT[i], WT[i + 1], WT[i + 2]) for i in range(0, 18, 3)], EL=(0.04, 0, 0.06), HANG=True)
    # trailing thin legs
    h = BC + Vector((s * 0.035, 0.05, -0.1))
    tube(f'zb_leg_{nm}', [h, h + Vector((s * 0.03, -0.05, -0.12)), h + Vector((s * 0.08, -0.12, -0.3))], [0.016, 0.012, 0.009], 'blue', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (h.z - c.z) / 0.3), seg=8)
    tube(f'zb_foot_{nm}', [h + Vector((s * 0.08, -0.12, -0.3)), h + Vector((s * 0.09, -0.16, -0.32))], [0.01, 0.006], 'blue', f'foot_{nm}', seg=6, flat=0.5)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, Z - 0.06), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, 0, 0.06))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.1, 0.02, Z + 0.02), 'spine'), (f'ear_{nm}', tuple(BC + Vector((s * 0.06, 0, 0.1))), 'head'),
              (f'thigh_{nm}', tuple(BC + Vector((s * 0.035, 0.05, -0.1))), 'hips'), (f'foot_{nm}', tuple(BC + Vector((s * 0.11, -0.07, -0.38))), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.13, -0.03))), 'head'), ('socket_fx', tuple(BC + Vector((0, -0.15, 0))), 'head')])
bat_clips(rig, 0.8, 35, {'thigh_l': swing(10, 24, 0, 4, 0), 'thigh_r': swing(10, 24, 0.5, 4, 0)})
sheet('check', 0.8, poses=[('idle', 5, 'front'), ('attack_physical', 15, 'side'), ('sleep', 0, 'q34')])
export(41, 'zubat', 0.8, 'rigid', rig, mesh, shiny={'blue': '#5ab85a', 'blue_dk': '#3a8a3a', 'purple': '#d070a0'})

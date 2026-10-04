# Golbat (42) · poison/flying · 1.6 m. Big blue egg body almost all mouth (red inside, 4 fangs, tongue), small squinting eyes and pointed ears on top, huge wings with purple inner, stubby legs.
reset('042_golbat')
M = pal([('blue', '#4a86c8'), ('blue_dk', '#2f5f9a'), ('purple', '#9a5ab0'), ('mouth', '#5a1a28'), ('mouth_dk', '#2a0a14'), ('tongue', '#d0607a'), ('fang', '#ffffff'), ('eye', '#1a1418'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'batwing.py'), encoding='utf-8').read())
WT = [0.735, 0.054, 0.381, 1.041, 0.130, 0.324, 0.769, 0.117, 0.230, 0.678, 0.046, -0.100, 0.324]
Z = 0.95; BC = Vector((0, 0, Z))
body = blob('gb_body', BC, (0.3, 0.27, 0.38), lambda c, n, p: 'blue_dk' if n.z < -0.75 else 'blue', 'head', seg=36, rings=22)
MC = BC + Vector((0, -0.2, -0.06))
blob('gb_mouth', MC, (0.22, 0.1, 0.24), lambda c, n, p: 'mouth_dk' if (c - MC).length < 0.12 else 'mouth', 'head', seg=28, rings=14)
tube('gb_lip', [MC + Vector((math.cos(a) * 0.22, -0.02 - 0.03 * abs(math.sin(a)), math.sin(a) * 0.24)) for a in [2 * math.pi * k / 30 for k in range(31)]], 0.02, 'blue', 'head', seg=8)
blob('gb_tongue', MC + Vector((0, -0.04, -0.17)), (0.11, 0.05, 0.035), 'tongue', 'head', seg=14, rings=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    for up in (1, -1):
        t0 = MC + Vector((s * 0.1, -0.06, up * 0.22))
        tube(f'gb_fang{up}_{nm}', [t0, t0 + Vector((0, -0.005, -up * 0.07))], [0.025, 0.002], 'fang', 'head', seg=8)
    e, loc, n = decal(f'gb_eye_{nm}', body, BC + Vector((0, 0, 0.28)), (s * 0.35, -0.6, 0.5), (0.05, 0.01, 0.012), 'eye', 'head', sink=0.2)
    e0 = BC + Vector((s * 0.12, 0.02, 0.32))
    tube(f'gb_ear_{nm}', [e0, e0 + Vector((s * 0.05, 0.0, 0.1)), e0 + Vector((s * 0.08, 0.01, 0.2))], [0.06, 0.04, 0.003], lambda c, n_, p_: 'purple' if n_.y < -0.4 else 'blue', f'ear_{nm}', seg=10, flat=0.45)
    bat_wing('gb', s, nm, BC + Vector((s * 0.26, 0.04, 0.1)), 0.75, 1.0, 'blue', 'purple', fingers=3, TIPS=[(WT[i], WT[i + 1], Z + WT[i + 2]) for i in (0, 3, 6, 9)], EL=(0, 0, WT[12]))
    h = BC + Vector((s * 0.12, 0.08, -0.33))
    tube(f'gb_leg_{nm}', [h, h + Vector((s * 0.04, -0.03, -0.12)), h + Vector((s * 0.08, -0.06, -0.22))], [0.04, 0.03, 0.025], 'blue', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (h.z - c.z) / 0.22), seg=8)
    for k in (-1, 0, 1):
        tube(f'gb_toe{k}_{nm}', [h + Vector((s * 0.08, -0.06, -0.22)), h + Vector((s * 0.08 + k * 0.03, -0.11, -0.26))], [0.018, 0.006], 'blue', f'foot_{nm}', seg=6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, Z - 0.2), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, 0, 0.15))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.26, 0.04, Z + 0.1), 'spine'), (f'ear_{nm}', tuple(BC + Vector((s * 0.12, 0.02, 0.32))), 'head'),
              (f'thigh_{nm}', tuple(BC + Vector((s * 0.12, 0.08, -0.33))), 'hips'), (f'foot_{nm}', tuple(BC + Vector((s * 0.2, 0.02, -0.55))), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(MC + Vector((0, -0.12, 0))), 'head'), ('socket_fx', tuple(MC + Vector((0, -0.2, 0))), 'head')])
bat_clips(rig, 1.6, 30)
sheet('check', 1.6, poses=[('idle', 5, 'front'), ('attack_physical', 15, 'side')])
export(42, 'golbat', 1.6, 'rigid', rig, mesh, shiny={'blue': '#5ab85a', 'blue_dk': '#3a8a3a', 'purple': '#d070a0'})

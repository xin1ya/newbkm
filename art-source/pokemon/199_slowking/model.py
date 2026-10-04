# Slowking (199) · water/psychic · 2.0 m. Upright pink Slowpoke with a grey spiky Shellder crown on its head (red jewel eyes), white frilled ruff collar, cream belly, long tail.
reset('199_slowking')
M = pal([('pink', '#e8949e'), ('pink_dk', '#c0707c'), ('cream', '#f4e6c8'), ('shell', '#a8a8b8'), ('shell_dk', '#78788a'), ('jewel', '#d83a5a'), ('ruff', '#f8f8f4'), ('eye', '#1a1418'), ('nose', '#c06a7a'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('sk', {'BZ': 0.72, 'body': (0.3, 0.26, 0.42), 'bodyc': lambda c, n, p: 'cream' if n.y < -0.5 and c.z < 0.9 else 'pink', 'HZ2': 1.42, 'hy': -0.02, 'head': (0.23, 0.21, 0.2), 'headc': 'pink',
    'snout': (0.16, 0.1, 0.1), 'snoutc': 'cream', 'nose': 'nose', 'eye': (0.04, 0.035), 'eyec': 'white', 'iris': 'eye', 'eyex': 0.55, 'eyez': 0.3, 'shine': False,
    'arm': ((0.27, -0.02, 1.0), (0.38, -0.08, 0.82), (0.4, -0.14, 0.68), 0.08, 0.06, 'pink'), 'hand': 0.07, 'fingers': 3, 'fingl': 0.5, 'clawc': 'cream',
    'leg': ((0.14, 0.0, 0.34), (0.16, -0.03, 0.2), (0.16, 0.0, 0.08), 0.12, 0.1, 'pink'), 'foot': (0.1, 0.14, 0.06), 'toes': 3, 'toec': 'cream',
    'tail': [(0, 0.22, 0.45), (0, 0.45, 0.25), (0, 0.65, 0.12), (0, 0.85, 0.1)], 'tailr': [0.1, 0.09, 0.08, 0.04], 'tailc': 'pink'})
HC = Q['HC']; cc = HC + Vector((0, 0.02, 0.2))
blob('sk_crown', cc, (0.17, 0.16, 0.12), lambda c, n, p: 'shell_dk' if n.z < -0.3 else 'shell', 'head', seg=24, rings=12)
for k in range(6):
    a = 2 * math.pi * k / 6
    o = cone(f'sk_cspike{k}', 0.035, 0.003, 0.12, verts=6, loc=cc + Vector((math.cos(a) * 0.15, math.sin(a) * 0.14, 0.04))); o.rotation_euler = (-math.sin(a) * 0.6, math.cos(a) * 0.6, 0); colorize(o, 'shell_dk'); reg(o, 'head')
blob('sk_jewel', cc + Vector((0, -0.15, 0.02)), (0.035, 0.02, 0.035), 'jewel', 'head', seg=12, rings=8)
for k in range(12):
    a = math.radians(-120 + 240 * k / 11)
    blob(f'sk_ruff{k}', Vector((math.sin(a) * 0.2, -math.cos(a) * 0.18 + 0.02, 1.15)), (0.07, 0.07, 0.05), 'ruff', 'chest', seg=10, rings=6)
rig, mesh = biped_rig(Q, 2.0)
plan_clips(rig, 'biped', size=2.0)
sheet('check', 2.0, poses=[('walk', 6, 'side'), ('attack_special', 12, 'q34')])
export(199, 'slowking', 2.0, 'biped', rig, mesh, shiny={'pink': '#e8b0d8', 'pink_dk': '#c090b8'})

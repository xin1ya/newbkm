# Rhyperior (464) · ground/rock · 2.4 m. Massive grey armored kaiju: orange rock plates on shoulders/back/tail, a huge drill horn plus a second horn, hole-cannon palms on bulky arms (orange rims), heavy tail club, red eyes.
reset('464_rhyperior')
M = pal([('grey', '#8a8c94'), ('grey_dk', '#5a5c64'), ('plate', '#d8783a'), ('plate_dk', '#a8552a'), ('belly', '#c8c4bc'), ('horn', '#f0ece0'), ('horn_dk', '#c0b8a8'), ('eye', '#d83a3a'), ('hole', '#2a2020'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('rp', {'BZ': 1.0, 'body': (0.48, 0.42, 0.58), 'bodyc': lambda c, n, p: 'belly' if n.y < -0.55 else ('grey_dk' if n.z < -0.6 else 'grey'), 'HZ2': 1.78, 'hy': -0.14,
    'head': (0.24, 0.3, 0.2), 'headc': 'grey', 'snout': (0.17, 0.16, 0.12), 'snoutc': 'grey', 'snz': 0.2, 'eye': (0.035, 0.015), 'eyec': 'eye', 'eyex': 0.6, 'eyez': 0.4, 'shine': False,
    'arm': ((0.45, -0.05, 1.35), (0.62, -0.15, 1.12), (0.64, -0.25, 0.95), 0.17, 0.15, 'grey'), 'hand': 0.16, 'fingers': 3, 'fingl': 0.5, 'clawc': 'horn',
    'leg': ((0.28, 0.02, 0.6), (0.33, -0.05, 0.35), (0.32, 0.0, 0.12), 0.26, 0.2, 'grey'), 'foot': (0.2, 0.26, 0.1), 'toes': 3, 'toec': 'horn',
    'tail': [(0, 0.35, 0.7), (0, 0.65, 0.45), (0, 0.95, 0.3), (0, 1.15, 0.28)], 'tailr': [0.22, 0.16, 0.12, 0.08], 'tailc': 'grey'})
HC = Q['HC']; SN = Q['SN']; BC = Q['BC']
o = cone('rp_horn', 0.11, 0.004, 0.38, verts=14, loc=SN + Vector((0, -0.08, 0.25))); o.rotation_euler = (math.radians(-25), 0, 0); colorize(o, lambda c, n, p: 'horn_dk' if abs(math.sin(c.z * 60)) < 0.25 else 'horn'); reg(o, 'head')
o = cone('rp_horn2', 0.06, 0.004, 0.14, verts=8, loc=HC + Vector((0, -0.08, 0.22))); colorize(o, 'horn'); reg(o, 'head')
for s, nm in ((1, 'l'), (-1, 'r')):
    blob(f'rp_shoulder_{nm}', Vector((s * 0.48, 0.0, 1.42)), (0.22, 0.24, 0.16), lambda c, n, p: 'plate_dk' if n.z < -0.2 else 'plate', f'arm_{nm}', seg=12, rings=8)
    wr = Vector((s * 0.64, -0.25, 0.95)); hc = wr + (wr - Vector((s * 0.62, -0.15, 1.12))).normalized() * 0.1
    tube(f'rp_rim_{nm}', [hc + Vector((math.cos(a) * 0.1 * s, -0.12, math.sin(a) * 0.1)) for a in [2 * math.pi * i / 12 for i in range(13)]], 0.035, 'plate', f'hand_{nm}', seg=6)
    blob(f'rp_hole_{nm}', hc + Vector((0, -0.13, 0)), (0.08, 0.02, 0.08), 'hole', f'hand_{nm}', seg=12, rings=6)
for k in range(4):
    blob(f'rp_back{k}', BC + Vector(((k % 2 - 0.5) * 0.3, 0.38, 0.35 - 0.25 * (k // 2))), (0.2, 0.1, 0.15), lambda c, n, p: 'plate_dk' if n.z < -0.2 else 'plate', 'chest' if k < 2 else 'spine', seg=10, rings=6)
blob('rp_club', Q['TP'][-1] + Vector((0, 0.12, 0.02)), (0.18, 0.2, 0.16), lambda c, n, p: 'plate_dk' if n.z < -0.2 else 'plate', 'tail2', seg=12, rings=8)
rig, mesh = biped_rig(Q, 2.4)
plan_clips(rig, 'biped', size=2.4)
sheet('check', 2.4, poses=[('walk', 6, 'side'), ('attack_special', 15, 'q34')])
export(464, 'rhyperior', 2.4, 'biped', rig, mesh, shiny={'grey': '#7a9a78', 'plate': '#c8b040', 'plate_dk': '#988a30'})

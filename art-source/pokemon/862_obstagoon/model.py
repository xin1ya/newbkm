# Obstagoon (862) · dark/normal · 1.6 m. Punk raccoon biped: black body with white-and-black striped long mane hair flowing back, black mask, long black tongue out, red eyes, big crossed arms with white fur cuffs and claws, black legs, white-black zigzag tail.
reset('862_obstagoon')
M = pal([('black', '#2a2a30'), ('grey', '#4a4a52'), ('white', '#f2f2f2'), ('tongue', '#1a1418'), ('eye', '#d83a3a'), ('claw', '#e8e4d8'), ('nose', '#1a1418')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('ob', {'BZ': 0.85, 'body': (0.26, 0.2, 0.36), 'bodyc': lambda c, n, p: 'grey' if n.y < -0.6 else 'black', 'HZ2': 1.38, 'hy': -0.03, 'head': (0.15, 0.15, 0.14), 'headc': 'black',
    'snout': (0.07, 0.09, 0.05), 'snoutc': 'black', 'nose': 'nose', 'eye': (0.03, 0.018), 'eyec': 'eye', 'eyex': 0.5, 'eyez': 0.2, 'shine': False,
    'arm': ((0.26, -0.02, 1.1), (0.42, -0.08, 0.92), (0.4, -0.18, 0.78), 0.1, 0.09, 'black'), 'hand': 0.08, 'fingers': 3, 'fingl': 0.9, 'clawc': 'claw',
    'leg': ((0.13, 0.0, 0.52), (0.16, -0.06, 0.3), (0.14, 0.02, 0.08), 0.1, 0.06, 'black'), 'foot': (0.07, 0.13, 0.05), 'toes': 3, 'toec': 'claw',
    'tail': [(0, 0.18, 0.6), (0, 0.35, 0.55), (0, 0.5, 0.6), (0, 0.62, 0.7)], 'tailr': [0.06, 0.08, 0.07, 0.02], 'tailc': lambda c, n, p: 'white' if (c.y * 18) % 2 < 1 else 'black'})
HC = Q['HC']; SN = Q['SN']
tube('ob_tongue', [SN + Vector((0, -0.07, -0.04)), SN + Vector((0, -0.1, -0.12)), SN + Vector((0, -0.09, -0.22))], [0.03, 0.028, 0.012], 'tongue', 'head', seg=8, flat=0.4)
for k in range(9):
    t = k / 8; a = math.radians(-60 + 120 * t)
    p0 = HC + Vector((math.sin(a) * 0.1, 0.05, 0.12 - 0.05 * abs(math.sin(a))))
    tube(f'ob_hair{k}', [p0, p0 + Vector((math.sin(a) * 0.08, 0.2, 0.05)), p0 + Vector((math.sin(a) * 0.16, 0.45, -0.25))], [0.05, 0.045, 0.005], 'white' if k % 2 else 'black', 'head', seg=8, flat=0.6)
for s, nm in ((1, 'l'), (-1, 'r')):
    tube(f'ob_cuff_{nm}', [Vector((s * (0.41 + 0.09 * math.cos(a)), -0.12 + 0.09 * math.sin(a), 0.86)) for a in [2 * math.pi * i / 12 for i in range(13)]], 0.04, 'white', f'hand_{nm}', seg=6)
    for k in range(3):
        blob(f'ob_chest{k}_{nm}', Vector((s * (0.08 + 0.04 * k), -0.18, 1.05 - 0.1 * k)), (0.06, 0.03, 0.04), 'white', 'chest', seg=8, rings=5)
rig, mesh = biped_rig(Q, 1.6)
plan_clips(rig, 'biped', size=1.6)
sheet('check', 1.6, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(862, 'obstagoon', 1.6, 'biped', rig, mesh, shiny={'black': '#3a3a5a', 'white': '#f0e0c0'})

# Roselia (315) · grass/poison · 0.3 m. Small green biped with a red rose in the right hand and a blue rose in the left, three thorn spikes on its head, white-green leaf collar, slim legs, cheerful eyes.
reset('315_roselia')
M = pal([('green', '#5aa848'), ('green_dk', '#3a7a30'), ('lime', '#c8e890'), ('red', '#d83a4a'), ('red_dk', '#a82a3a'), ('blue', '#4a6ad8'), ('blue_dk', '#2a4aa8'), ('thorn', '#2a5a28'), ('eye', '#1a1418'), ('iris', '#d83a4a'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('rl', {'BZ': 0.13, 'body': (0.06, 0.055, 0.08), 'bodyc': 'green', 'HZ2': 0.26, 'head': (0.07, 0.065, 0.06), 'headc': 'green', 'eye': (0.014, 0.018), 'eyec': 'white', 'iris': 'iris', 'eyex': 0.45, 'eyez': 0.05,
    'arm': ((0.05, -0.005, 0.18), (0.08, -0.02, 0.15), (0.1, -0.03, 0.13), 0.012, 0.01, 'green'), 'hand': 0, 
    'leg': ((0.03, 0.0, 0.07), (0.035, -0.005, 0.04), (0.035, 0.0, 0.015), 0.018, 0.012, 'green'), 'foot': (0.02, 0.03, 0.012), 'footc': 'green_dk'})
HC = Q['HC']
for k in range(10):
    a = 2 * math.pi * k / 10
    blob(f'rl_collar{k}', Vector((math.cos(a) * 0.055, math.sin(a) * 0.05, 0.2)), (0.03, 0.03, 0.01), 'lime', 'chest', seg=8, rings=5, rot=(math.sin(a) * 30, -math.cos(a) * 30, 0))
for k, a in enumerate((0, 35, -35)):
    o = cone(f'rl_thorn{k}', 0.012, 0.002, 0.06, verts=6, loc=HC + Vector((math.sin(math.radians(a)) * 0.04, 0.0, 0.08))); o.rotation_euler = (0, math.radians(a), 0); colorize(o, 'thorn'); reg(o, 'head')
for s, nm, c0, c1 in ((1, 'l', 'blue', 'blue_dk'), (-1, 'r', 'red', 'red_dk')):
    rc = Vector((s * 0.115, -0.04, 0.12))
    for k in range(6):
        a = 2 * math.pi * k / 6
        blob(f'rl_petal{k}_{nm}', rc + Vector((math.cos(a) * 0.018, -0.005, math.sin(a) * 0.018)), (0.022, 0.012, 0.022), c1 if k % 2 else c0, f'hand_{nm}', seg=8, rings=6)
    blob(f'rl_rosec_{nm}', rc + Vector((0, -0.012, 0)), (0.02, 0.015, 0.02), c0, f'hand_{nm}', seg=10, rings=6)
rig, mesh = biped_rig(Q, 0.3)
plan_clips(rig, 'biped', size=0.3)
sheet('check', 0.35, poses=[('walk', 6, 'side'), ('attack_special', 12, 'q34')])
export(315, 'roselia', 0.3, 'biped', rig, mesh, shiny={'green': '#8ac848', 'red': '#e8c84a', 'blue': '#e870a0'})

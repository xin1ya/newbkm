# Roserade (407) · grass/poison · 0.9 m. Elegant: white petal 'hair' crown with a green leaf cape flowing down its back, green mask band across red eyes, bouquets of red (right) and blue (left) roses, slender body, yellow-green collar.
reset('407_roserade')
M = pal([('green', '#5aa848'), ('green_dk', '#3a7a30'), ('lime', '#c8e890'), ('red', '#d83a4a'), ('red_dk', '#a82a3a'), ('blue', '#4a6ad8'), ('blue_dk', '#2a4aa8'), ('thorn', '#2a5a28'), ('eye', '#1a1418'), ('iris', '#d83a4a'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('rr', {'BZ': 0.17, 'body': (0.038, 0.034, 0.08), 'bodyc': 'green', 'HZ2': 0.3, 'head': (0.062, 0.058, 0.052), 'headc': 'green', 'eye': (0.014, 0.018), 'eyec': 'white', 'iris': 'iris', 'eyex': 0.45, 'eyez': 0.05,
    'arm': ((0.035, 0, 0.235), (0.1, -0.005, 0.24), (0.155, -0.01, 0.24), 0.01, 0.008, 'green'), 'hand': 0, 
    'leg': ((0.02, 0.0, 0.09), (0.022, -0.005, 0.05), (0.02, 0.0, 0.015), 0.013, 0.007, 'green'), 'foot': (0.02, 0.03, 0.012), 'footc': 'green_dk'})
HC = Q['HC']
for k in range(10):
    a = 2 * math.pi * k / 10
    blob(f'rr_collar{k}', Vector((math.cos(a) * 0.04, math.sin(a) * 0.036, 0.255)), (0.022, 0.022, 0.008), 'lime', 'chest', seg=8, rings=5, rot=(math.sin(a) * 30, -math.cos(a) * 30, 0))
blob('rr_crownb', HC + Vector((0, 0.012, 0.045)), (0.088, 0.082, 0.065), 'white', 'head', seg=20, rings=12)
for k in range(8):
    a = 2 * math.pi * k / 8
    blob(f'rr_crown{k}', HC + Vector((math.cos(a) * 0.07, 0.012 + math.sin(a) * 0.065, 0.06)), (0.035, 0.035, 0.04), 'white', 'head', seg=10, rings=6, rot=(math.sin(a) * 25, -math.cos(a) * 25, 0))
for k, (sx, sy) in enumerate(((1, -1), (-1, -1), (1, 1), (-1, 1))):
    blob(f'rr_skirt{k}', Vector((sx * 0.055, sy * 0.02, 0.095)), (0.06, 0.014, 0.035), 'green_dk', 'hips', seg=10, rings=6, rot=(0, sx * 50, sy * sx * -25))
    blob(f'rr_shl{k}', Vector((sx * 0.065, 0.02 + 0.01 * (sy + 1), 0.25)), (0.06, 0.012, 0.03), 'green_dk', 'chest', seg=10, rings=6, rot=(0, sx * -30, sx * (20 + 15 * sy)))
tube('rr_cape', [HC + Vector((0, 0.04, 0.0)), Vector((0, 0.045, 0.22)), Vector((0, 0.05, 0.15))], [0.025, 0.03, 0.008], 'green_dk', 'chest', seg=10, flat=0.3)
for s_ in (1, -1):
    decal(f'rr_mask{s_ + 1}', Q['head'], HC, (s_ * 0.6, -1, 0.1), (0.03, 0.006, 0.02), 'thorn', 'head', sink=0.5)
for k, a in []:
    o = cone(f'rr_thorn{k}', 0.012, 0.002, 0.06, verts=6, loc=HC + Vector((math.sin(math.radians(a)) * 0.04, 0.0, 0.08))); o.rotation_euler = (0, math.radians(a), 0); colorize(o, 'thorn'); reg(o, 'head')
for s, nm, c0, c1 in ((1, 'l', 'blue', 'blue_dk'), (-1, 'r', 'red', 'red_dk')):
    rc = Vector((s * 0.185, -0.01, 0.24))
    for k in range(6):
        a = 2 * math.pi * k / 6
        blob(f'rr_petal{k}_{nm}', rc + Vector((math.cos(a) * 0.026, -0.005, math.sin(a) * 0.026)), (0.03, 0.02, 0.03), c1 if k % 2 else c0, f'hand_{nm}', seg=8, rings=6)
    blob(f'rr_rosec_{nm}', rc + Vector((0, -0.012, 0)), (0.02, 0.015, 0.02), c0, f'hand_{nm}', seg=10, rings=6)
rig, mesh = biped_rig(Q, 0.3)
plan_clips(rig, 'biped', size=0.3)
sheet('check', 0.42, poses=[('walk', 6, 'side'), ('attack_special', 12, 'q34')])
export(407, 'roserade', 0.9, 'biped', rig, mesh, shiny={'green': '#8ac848', 'red': '#e8c84a', 'blue': '#e870a0'})

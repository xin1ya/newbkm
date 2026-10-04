# Slowbro (80) · water/psychic · 1.6 m. Upright pink Slowpoke: dopey face with cream muzzle, plump body with cream belly, a grey spiral Shellder clamped on its tail (with Shellder eyes), short arms/legs.
reset('080_slowbro')
M = pal([('pink', '#e8949e'), ('pink_dk', '#c0707c'), ('cream', '#f4e6c8'), ('shell', '#a8a8b8'), ('shell_dk', '#78788a'), ('eye', '#1a1418'), ('nose', '#c06a7a'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('sb', {'BZ': 0.62, 'body': (0.3, 0.26, 0.38), 'bodyc': lambda c, n, p: 'cream' if n.y < -0.5 and c.z < 0.75 else 'pink', 'HZ2': 1.2, 'hy': -0.02, 'head': (0.24, 0.22, 0.2), 'headc': 'pink',
    'snout': (0.17, 0.11, 0.1), 'snoutc': 'cream', 'nose': 'nose', 'eye': (0.045, 0.012), 'eyex': 0.55, 'eyez': 0.35, 'shine': False,
    'arm': ((0.26, -0.02, 0.85), (0.36, -0.06, 0.7), (0.38, -0.1, 0.58), 0.08, 0.06, 'pink'), 'hand': 0.07, 'fingers': 3, 'fingl': 0.5, 'clawc': 'cream',
    'leg': ((0.14, 0.0, 0.3), (0.16, -0.03, 0.18), (0.16, 0.0, 0.08), 0.12, 0.1, 'pink'), 'foot': (0.1, 0.14, 0.06), 'toes': 3, 'toec': 'cream',
    'tail': [(0, 0.22, 0.4), (0, 0.42, 0.25), (0, 0.6, 0.15), (0, 0.72, 0.12)], 'tailr': [0.1, 0.09, 0.09, 0.08], 'tailc': 'pink'})
TP = Q['TP']; sc = TP[-1] + Vector((0, 0.08, 0.05))
blob('sb_shell', sc, (0.17, 0.2, 0.17), lambda c, n, p: 'shell_dk' if abs(math.sin(math.atan2(c.z - sc.z, c.y - sc.y) * 3 + (c - sc).length * 25)) < 0.25 else 'shell', 'tail2', seg=24, rings=14)
for k in range(5):
    a = math.radians(-60 + 30 * k)
    o = cone(f'sb_spike{k}', 0.04, 0.003, 0.12, verts=6, loc=sc + Vector((math.sin(a) * 0.16, 0.05, 0.12 + math.cos(a) * 0.05))); o.rotation_euler = (math.radians(-30), math.radians(math.degrees(a) * 0.6), 0); colorize(o, 'shell_dk'); reg(o, 'tail2')
for s in (1, -1):
    decal(f'sb_seye{s + 1}', bpy.data.objects['sb_shell'], sc, (s * 0.4, -0.6, 0.6), (0.025, 0.006, 0.03), 'eye', 'tail2', sink=0.2, seg=10, rings=6)
rig, mesh = biped_rig(Q, 1.6)
plan_clips(rig, 'biped', size=1.6)
sheet('check', 1.6, poses=[('walk', 6, 'side'), ('attack_special', 12, 'q34')])
export(80, 'slowbro', 1.6, 'biped', rig, mesh, shiny={'pink': '#e8b0d8', 'pink_dk': '#c090b8'})

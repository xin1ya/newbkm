# Rhydon (112) · ground/rock · 1.9 m. Upright grey rhino-kaiju: drill horn on snout with a small second horn, plated hide with ridges, cream belly plates, thick legs and tail, short arms with 3 claws, red eyes.
reset('112_rhydon')
M = pal([('grey', '#9aa0a8'), ('grey_dk', '#6a7078'), ('belly', '#e8e0d0'), ('horn', '#f0ece0'), ('horn_dk', '#c0b8a8'), ('eye', '#d83a3a'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('rd', {'BZ': 0.85, 'body': (0.36, 0.32, 0.48), 'bodyc': lambda c, n, p: ('belly' if abs(math.sin(c.z * 22)) > 0.25 else 'grey_dk') if n.y < -0.55 else ('grey_dk' if n.z < -0.6 else 'grey'), 'HZ2': 1.5, 'hy': -0.1,
    'head': (0.2, 0.26, 0.18), 'headc': 'grey', 'snout': (0.14, 0.14, 0.1), 'snoutc': 'grey', 'snz': 0.2, 'eye': (0.03, 0.015), 'eyec': 'eye', 'eyex': 0.6, 'eyez': 0.4, 'shine': False,
    'arm': ((0.33, -0.05, 1.12), (0.45, -0.12, 0.95), (0.47, -0.2, 0.82), 0.11, 0.08, 'grey'), 'hand': 0.09, 'fingers': 3, 'fingl': 0.8, 'clawc': 'horn',
    'leg': ((0.2, 0.02, 0.5), (0.25, -0.05, 0.3), (0.24, 0.0, 0.1), 0.2, 0.15, 'grey'), 'foot': (0.15, 0.2, 0.08), 'toes': 3, 'toec': 'horn',
    'tail': [(0, 0.25, 0.6), (0, 0.5, 0.4), (0, 0.75, 0.25), (0, 0.95, 0.18)], 'tailr': [0.17, 0.13, 0.09, 0.02], 'tailc': lambda c, n, p: 'grey_dk' if abs(math.sin(c.y * 25)) < 0.2 else 'grey'})
HC = Q['HC']; SN = Q['SN']
o = cone('rd_horn', 0.08, 0.004, 0.3, verts=14, loc=SN + Vector((0, -0.06, 0.2))); o.rotation_euler = (math.radians(-25), 0, 0); colorize(o, lambda c, n, p: 'horn_dk' if abs(math.sin(c.z * 70)) < 0.25 else 'horn'); reg(o, 'head')
o = cone('rd_horn2', 0.04, 0.003, 0.1, verts=8, loc=HC + Vector((0, -0.05, 0.2))); colorize(o, 'horn'); reg(o, 'head')
for s in (1, -1):
    o = cone(f'rd_ear{s + 1}', 0.05, 0.004, 0.14, verts=8, loc=HC + Vector((s * 0.15, 0.1, 0.14))); o.rotation_euler = (math.radians(-35), math.radians(s * 30), 0); colorize(o, 'grey'); reg(o, 'head')
    for k in range(3):
        decal(f'rd_plate{k}_{s + 1}', Q['body'], Q['BC'] + Vector((0, 0.1, -0.2 + 0.25 * k)), (s, 0.5, 0.2), (0.18, 0.015, 0.12), 'grey_dk', ['spine', 'spine', 'chest'][k], sink=0.5, seg=8, rings=6)
rig, mesh = biped_rig(Q, 1.9)
plan_clips(rig, 'biped', size=1.9)
sheet('check', 1.9, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(112, 'rhydon', 1.9, 'biped', rig, mesh, shiny={'grey': '#c8b080', 'grey_dk': '#987a50'})

# Rhyhorn (111) · ground/rock · 1.0 m. Bulky grey rock-plated rhino: segmented ridged armor on back, small eyes, a horn on the snout, spiky ridge plates along the spine, stubby legs with 3 nails, short tail.
reset('111_rhyhorn')
M = pal([('grey', '#9aa0a8'), ('grey_dk', '#6a7078'), ('horn', '#f0ece0'), ('eye', '#d83a3a'), ('nose', '#4a4a50'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
ridge = lambda c, n, p: 'grey_dk' if (n.z < -0.5 or (n.z > 0.3 and abs(math.sin(c.y * 30)) < 0.2)) else 'grey'
Q = quad('rh', {'H': 0.42, 'body': (0.3, 0.45, 0.28), 'bodyc': ridge, 'head': (0.17, 0.22, 0.15), 'hc': (0.0, 0.0), 'headc': 'grey', 'snout': (0.12, 0.12, 0.1), 'snoutc': 'grey', 'nose': 'nose',
    'eye': (0.025, 0.012), 'eyec': 'eye', 'eyex': 0.8, 'eyez': 0.2, 'ears': [((0.13, 0.08, 0.1), 0.05, 0.08, 40, 'grey')],
    'leg': (0.11, 0.09), 'legc': 'grey', 'toes': 3, 'toec': 'horn', 'legx': 0.18, 'tail': [(0, 0.42, 0.45), (0, 0.55, 0.4), (0, 0.62, 0.35)], 'tailr': [0.05, 0.04, 0.01], 'tailc': 'grey'})
HC = Q['HC']; BC = Q['BC']; SN = Q['SN']
o = cone('rh_horn', 0.06, 0.004, 0.18, verts=12, loc=SN + Vector((0, -0.04, 0.14))); o.rotation_euler = (math.radians(-20), 0, 0); colorize(o, 'horn'); reg(o, 'head')
for k in range(7):
    t = k / 6; p = Vector((0, -0.4 + 0.8 * t, 0.42 + 0.27 * math.sin(math.pi * (0.15 + 0.7 * t))))
    o = cone(f'rh_spike{k}', 0.07, 0.01, 0.12, verts=4, loc=p); o.rotation_euler = (math.radians(30), 0, 0); colorize(o, 'grey_dk'); reg(o, 'chest' if t < 0.4 else ('spine' if t < 0.7 else 'hips'))
for s in (1, -1):
    for k in range(3):
        decal(f'rh_plate{k}_{s + 1}', Q['body'], BC + Vector((0, -0.25 + 0.25 * k, 0.05)), (s, 0, 0.3), (0.16, 0.012, 0.13), 'grey_dk', ['chest', 'spine', 'hips'][k], sink=0.5, seg=8, rings=6)
rig, mesh = quad_rig('rh', Q, 1.0)
plan_clips(rig, 'quadruped', size=1.0)
sheet('check', 1.0, poses=[('walk', 7, 'side'), ('attack_physical', 15, 'q34')])
export(111, 'rhyhorn', 1.0, 'quadruped', rig, mesh, shiny={'grey': '#c8b080', 'grey_dk': '#987a50'})

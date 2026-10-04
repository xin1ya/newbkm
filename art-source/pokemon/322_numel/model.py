# Numel (322) · fire/ground · 0.7 m. Stubby yellow camel with a green triangle-patterned saddle hump on its back, big round sleepy eyes, round snout, short legs with cream feet.
reset('322_numel')
M = pal([('yellow', '#e8c858'), ('yellow_dk', '#b8983a'), ('green', '#5aa880'), ('green_dk', '#3a7a5a'), ('cream', '#f2e6c4'), ('eye', '#1a1418'), ('nose', '#8a6a3a'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('nm', {'H': 0.3, 'body': (0.16, 0.24, 0.16), 'bodyc': lambda c, n, p: 'yellow_dk' if n.z < -0.6 else 'yellow', 'head': (0.11, 0.12, 0.11), 'hc': (-0.03, 0.2), 'headc': 'yellow',
    'snout': (0.07, 0.07, 0.06), 'eye': (0.032, 0.03), 'eyec': 'eye', 'eyex': 0.55, 'eyez': 0.15, 'ears': [((0.08, 0.04, 0.07), 0.03, 0.04, 40, 'yellow')], 'neck': 0.07,
    'leg': (0.06, 0.05), 'legc': 'yellow', 'pawc': 'cream', 'legx': 0.09, 'tail': [(0, 0.22, 0.32), (0, 0.27, 0.3), (0, 0.29, 0.28)], 'tailr': [0.03, 0.02, 0.005], 'tailc': 'yellow'})
BC = Q['BC']
hump = blob('nm_hump', BC + Vector((0, 0.02, 0.13)), (0.13, 0.15, 0.08), lambda c, n, p: 'green_dk' if (math.floor(math.atan2(n.y, n.x) / 0.52) % 2 and n.z < 0.8) else 'green', 'spine', seg=24, rings=12)
blob('nm_humptop', BC + Vector((0, 0.02, 0.2)), (0.04, 0.05, 0.025), 'green_dk', 'spine', seg=12, rings=8)
rig, mesh = quad_rig('nm', Q, 0.7)
plan_clips(rig, 'quadruped', size=0.7)
sheet('check', 0.7, poses=[('walk', 7, 'side'), ('attack_physical', 15, 'q34')])
export(322, 'numel', 0.7, 'quadruped', rig, mesh, shiny={'yellow': '#a8c860', 'green': '#5a7aa8', 'green_dk': '#3a5a8a'})

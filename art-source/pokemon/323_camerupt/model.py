# Camerupt (323) · fire/ground · 1.9 m. Massive dark-red camel with two grey volcanic humps (craters with lava-orange rims) on its back, blue-grey ring markings on the humps, cream face and legs tip, stubby legs.
reset('323_camerupt')
M = pal([('red', '#b0503a'), ('red_dk', '#803828'), ('rock', '#6a6a70'), ('rock_dk', '#4a4a50'), ('lava', '#ff8a2a'), ('ring', '#5a7aa8'), ('cream', '#e8d8b0'), ('eye', '#1a1418'), ('nose', '#4a2a1a'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('cm', {'H': 0.7, 'body': (0.42, 0.62, 0.38), 'bodyc': lambda c, n, p: 'red_dk' if n.z < -0.6 else 'red', 'head': (0.22, 0.24, 0.22), 'hc': (-0.12, 0.12), 'headc': 'red',
    'snout': (0.15, 0.12, 0.12), 'snoutc': 'cream', 'eye': (0.04, 0.012), 'eyex': 0.6, 'eyez': 0.3, 'ears': [((0.16, 0.06, 0.15), 0.06, 0.08, 40, 'red')],
    'leg': (0.15, 0.13), 'legc': 'red', 'pawc': 'cream', 'legx': 0.25, 'tail': [(0, 0.6, 0.8), (0, 0.7, 0.75), (0, 0.74, 0.7)], 'tailr': [0.06, 0.04, 0.01], 'tailc': 'red'})
BC = Q['BC']
for k, y in enumerate((-0.25, 0.25)):
    c0 = BC + Vector((0, y, 0.32))
    tube(f'cm_hump{k}', [c0, c0 + Vector((0, 0, 0.18)), c0 + Vector((0, 0, 0.34))], [0.26, 0.2, 0.13], lambda c, n, p: 'ring' if 0.42 < (c.z - BC.z - 0.32) / 0.34 < 0.52 else 'rock', 'chest' if k == 0 else 'hips', seg=16)
    blob(f'cm_crater{k}', c0 + Vector((0, 0, 0.34)), (0.12, 0.12, 0.03), 'lava', 'chest' if k == 0 else 'hips', seg=16, rings=6)
    tube(f'cm_rim{k}', [c0 + Vector((math.cos(a) * 0.13, math.sin(a) * 0.13, 0.35)) for a in [2 * math.pi * i / 16 for i in range(17)]], 0.025, 'rock_dk', 'chest' if k == 0 else 'hips', seg=6)
rig, mesh = quad_rig('cm', Q, 1.9)
plan_clips(rig, 'quadruped', size=1.9)
sheet('check', 1.9, poses=[('walk', 7, 'side'), ('attack_physical', 15, 'q34')])
export(323, 'camerupt', 1.9, 'quadruped', rig, mesh, shiny={'red': '#7a8aa8', 'red_dk': '#5a6a88', 'ring': '#e8c040'})

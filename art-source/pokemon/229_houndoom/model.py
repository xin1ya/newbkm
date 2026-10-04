# Houndoom (229) · dark/fire · 1.4 m. Black hellhound: two curved grey ram horns, skull-shaped forehead plate, orange snout/belly, white rib bones on back, bone collar, bone ankle bands, long tail with arrow-spade tip, fangs.
reset('229_houndoom')
M = pal([('black', '#2e2c34'), ('black_dk', '#1c1a20'), ('tan', '#d88a4a'), ('bone', '#f0ece0'), ('horn', '#a8a4a0'), ('eye', '#1a1418'), ('iris', '#d83a3a'), ('nose', '#1a1418'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('hm', {'H': 0.62, 'body': (0.18, 0.42, 0.19), 'bodyc': lambda c, n, p: 'tan' if n.z < -0.5 else 'black', 'head': (0.15, 0.17, 0.14), 'hc': (-0.04, 0.33), 'headc': 'black',
    'snout': (0.09, 0.14, 0.07), 'snoutc': 'tan', 'eye': (0.03, 0.02), 'eyec': 'white', 'iris': 'iris', 'eyex': 0.55, 'eyez': 0.25, 'ears': [((0.1, 0.06, 0.1), 0.05, 0.13, 20, 'black')],
    'leg': (0.07, 0.045), 'legc': 'black', 'pawc': 'tan', 'neck': 0.1,
    'tail': [(0, 0.4, 0.7), (0, 0.6, 0.78), (0, 0.78, 0.92), (0, 0.85, 1.05)], 'tailr': [0.035, 0.028, 0.024, 0.02], 'tailc': 'black'})
HC = Q['HC']; BC = Q['BC']; TP = Q['TP']
o = cone('hm_spade', 0.08, 0.003, 0.14, verts=4, loc=TP[-1] + Vector((0, 0.02, 0.07))); o.scale = (1, 0.3, 1); colorize(o, 'black'); reg(o, 'tail2')
for s, nm in ((1, 'l'), (-1, 'r')):
    h0 = HC + Vector((s * 0.08, 0.06, 0.1))
    tube(f'hm_horn_{nm}', [h0, h0 + Vector((s * 0.06, 0.1, 0.1)), h0 + Vector((s * 0.1, 0.22, 0.08)), h0 + Vector((s * 0.1, 0.3, -0.02))], [0.04, 0.032, 0.022, 0.003], 'horn', 'head', seg=10)
    tube(f'hm_fang_{nm}', [Q['SN'] + Vector((s * 0.04, -0.1, -0.05)), Q['SN'] + Vector((s * 0.04, -0.1, -0.1))], [0.012, 0.002], 'bone', 'head', seg=6)
blob('hm_skull', HC + Vector((0, -0.07, 0.1)), (0.07, 0.05, 0.035), 'bone', 'head', seg=12, rings=8)
for k, y in enumerate((-0.12, 0.0, 0.12)):
    tube(f'hm_rib{k}', [BC + Vector((math.cos(a) * 0.19, y, math.sin(a) * 0.2)) for a in [math.radians(25 + 130 * i / 10) for i in range(11)]], 0.018, 'bone', ['chest', 'spine', 'hips'][k], seg=6)
tube('hm_collar', [BC + Vector((math.cos(a) * 0.13, -0.38, 0.13 + math.sin(a) * 0.13)) for a in [2 * math.pi * i / 14 for i in range(15)]], 0.025, 'bone', 'neck', seg=6)
for nm, (sh, pw) in Q['LEGS'].items():
    tube(f'hm_band_{nm}', [Vector(pw) + Vector((math.cos(a) * 0.055, math.sin(a) * 0.055, 0.15)) for a in [2 * math.pi * i / 10 for i in range(11)]], 0.016, 'bone', nm.replace('arm', 'hand').replace('thigh', 'foot'), seg=6)
rig, mesh = quad_rig('hm', Q, 1.4)
plan_clips(rig, 'quadruped', size=1.4)
sheet('check', 1.4, poses=[('walk', 7, 'side'), ('attack_physical', 15, 'q34')])
export(229, 'houndoom', 1.4, 'quadruped', rig, mesh, shiny={'black': '#3a4a6a', 'tan': '#a8c8e8'})

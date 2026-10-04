# Houndour (228) · dark/fire · 0.6 m. Lean black dog, orange-tan snout/belly/paws, white bone bands around ankles and back ("ribs"), skull-like head marking, pointed ears, thin tail with spade tip.
reset('228_houndour')
M = pal([('black', '#2e2c34'), ('black_dk', '#1c1a20'), ('tan', '#d88a4a'), ('bone', '#f0ece0'), ('eye', '#1a1418'), ('iris', '#d83a3a'), ('nose', '#1a1418'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('hd', {'H': 0.3, 'body': (0.1, 0.22, 0.1), 'bodyc': lambda c, n, p: 'tan' if n.z < -0.5 else 'black', 'head': (0.09, 0.1, 0.085), 'hc': (-0.02, 0.15), 'headc': 'black',
    'snout': (0.05, 0.08, 0.04), 'snoutc': 'tan', 'eye': (0.02, 0.016), 'eyec': 'white', 'iris': 'iris', 'eyex': 0.5, 'eyez': 0.2, 'ears': [((0.06, 0.03, 0.06), 0.035, 0.1, 15, 'black')],
    'leg': (0.035, 0.025), 'legc': 'black', 'pawc': 'tan', 'neck': 0.05, 'tail': [(0, 0.2, 0.32), (0, 0.3, 0.35), (0, 0.38, 0.4), (0, 0.42, 0.45)], 'tailr': [0.02, 0.015, 0.013, 0.012], 'tailc': 'black'})
HC = Q['HC']; BC = Q['BC']; TP = Q['TP']
o = cone('hd_spade', 0.04, 0.002, 0.07, verts=4, loc=TP[-1] + Vector((0, 0.01, 0.04))); o.scale = (1, 0.3, 1); colorize(o, 'black'); reg(o, 'tail2')
for k, y in enumerate((-0.06, 0.02, 0.1)):
    tube(f'hd_rib{k}', [BC + Vector((math.cos(a) * 0.105, y, math.sin(a) * 0.105)) for a in [math.radians(20 + 140 * i / 10) for i in range(11)]], 0.012, 'bone', ['chest', 'spine', 'hips'][k], seg=6)
for nm, (sh, pw) in Q['LEGS'].items():
    tube(f'hd_band_{nm}', [Vector(pw) + Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.08)) for a in [2 * math.pi * i / 10 for i in range(11)]], 0.01, 'bone', nm.replace('arm', 'hand').replace('thigh', 'foot'), seg=6)
blob('hd_skull', HC + Vector((0, -0.04, 0.07)), (0.04, 0.03, 0.02), 'bone', 'head', seg=12, rings=8)
rig, mesh = quad_rig('hd', Q, 0.6)
plan_clips(rig, 'quadruped', size=0.6)
sheet('check', 0.6, poses=[('walk', 7, 'side'), ('attack_physical', 15, 'q34')])
export(228, 'houndour', 0.6, 'quadruped', rig, mesh, shiny={'black': '#3a4a6a', 'tan': '#a8c8e8'})

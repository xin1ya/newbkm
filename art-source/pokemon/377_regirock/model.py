# Regirock (377) · rock · 1.7 m. Golem of stacked orange-brown boulders: rounded torso and head-dome with a 7-dot Braille eye pattern (dots in an H shape), thick boulder arms with 3 stubby rock fingers, short boulder legs; craggy surfaces.
reset('377_regirock')
M = pal([('rock', '#c8784a'), ('rock_dk', '#8a4e2e'), ('rock_lt', '#e09a68'), ('dot', '#2a1e1a'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
craggy = lambda v: Vector((v.x * (1 + 0.08 * math.sin(v.y * 8 + v.z * 5)), v.y * (1 + 0.08 * math.cos(v.x * 7)), v.z * (1 + 0.06 * math.sin(v.x * 9))))
Q = biped('rr', {'BZ': 0.9, 'body': (0.42, 0.32, 0.4), 'bodyc': lambda c, n, p: 'rock_dk' if n.z < -0.5 else ('rock_lt' if n.z > 0.7 else 'rock'), 'bodyfn': craggy, 'HZ2': 1.38, 'hy': -0.04,
    'head': (0.2, 0.2, 0.18), 'headc': 'rock', 'headfn': craggy, 'eye': (0.025, 0.025), 'eyec': 'dot', 'eyex': 0.0, 'eyez': -0.2, 'shine': False,
    'arm': ((0.42, -0.02, 1.1), (0.62, -0.06, 0.88), (0.66, -0.1, 0.62), 0.16, 0.14, 'rock'), 'hand': 0.15, 'fingers': 3, 'fingl': 0.6, 'clawc': 'rock_dk',
    'leg': ((0.2, 0.0, 0.5), (0.24, -0.02, 0.3), (0.24, 0.0, 0.12), 0.18, 0.15, 'rock'), 'foot': (0.16, 0.2, 0.1), 'footc': 'rock_dk'})
HC = Q['HC']
for k, (x, z) in enumerate(((-0.08, 0.06), (-0.08, 0.0), (-0.08, -0.06), (0, 0), (0.08, 0.06), (0.08, 0.0), (0.08, -0.06))):
    decal(f'rr_bdot{k}', Q['head'], HC + Vector((x, 0, z)), (0, -1, 0), (0.025, 0.008, 0.025), 'dot', 'head', sink=0.2, seg=10, rings=6)
for k in range(10):
    a = 2 * math.pi * k / 10
    blob(f'rr_rock{k}', Q['BC'] + Vector((math.cos(a) * 0.38, math.sin(a) * 0.29, 0.2 * math.sin(a * 3))), (0.12, 0.1, 0.1), 'rock_dk' if k % 2 else 'rock_lt', 'spine', seg=6, rings=4)
rig, mesh = biped_rig(Q, 1.7)
plan_clips(rig, 'biped', size=1.7)
sheet('check', 1.7, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(377, 'regirock', 1.7, 'biped', rig, mesh, shiny={'rock': '#c8a060', 'rock_dk': '#8a6a3a', 'rock_lt': '#e0c088'})

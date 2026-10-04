# Slowpoke (79) · water/psychic · 1.2 m. Pink sleepy quadruped, big round head with cream muzzle, blank half-lidded eyes, small round ears, plump body, long thick pink tail with a cream tip, short legs with cream claws.
reset('079_slowpoke')
M = pal([('pink', '#e8949e'), ('pink_dk', '#c0707c'), ('cream', '#f4e6c8'), ('eye', '#1a1418'), ('nose', '#c06a7a'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('sp', {'H': 0.3, 'body': (0.22, 0.32, 0.2), 'bodyc': lambda c, n, p: 'pink_dk' if n.z < -0.6 else 'pink', 'head': (0.22, 0.2, 0.19), 'hc': (-0.06, 0.24), 'headc': 'pink',
    'snout': (0.15, 0.1, 0.09), 'snoutc': 'cream', 'nose': 'nose', 'eye': (0.04, 0.012), 'eyex': 0.55, 'eyez': 0.3, 'ears': [((0.14, 0.04, 0.14), 0.04, 0.05, 30, 'pink')], 'earflat': 0.9,
    'leg': (0.09, 0.075), 'legc': 'pink', 'toes': 3, 'toec': 'cream', 'legx': 0.14,
    'tail': [(0, 0.3, 0.3), (0, 0.55, 0.25), (0, 0.8, 0.2), (0, 0.98, 0.18), (0, 1.05, 0.18)], 'tailr': [0.08, 0.08, 0.075, 0.07, 0.04], 'tailc': lambda c, n, p: 'cream' if c.y > 0.96 else 'pink'})
rig, mesh = quad_rig('sp', Q, 1.2)
plan_clips(rig, 'quadruped', size=0.9, over={'idle': {'head': swing(2, 60, 0, 2, 2)}})
sheet('check', 1.2, poses=[('walk', 7, 'side'), ('sleep', 0, 'q34')])
export(79, 'slowpoke', 1.2, 'quadruped', rig, mesh, shiny={'pink': '#e8b0d8', 'pink_dk': '#c090b8'})

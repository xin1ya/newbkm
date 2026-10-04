# Torkoal (324) · fire · 0.5 m. Tortoise: dark charcoal shell with glowing orange-red holes/cracks and a chimney-like opening at the back, orange-red body and head, long neck, droopy eyes, stubby legs.
reset('324_torkoal')
M = pal([('orange', '#d8603a'), ('orange_dk', '#a84228'), ('shell', '#3a3634'), ('shell_dk', '#262322'), ('glow', '#ff9a3a'), ('cream', '#f0d8a8'), ('eye', '#1a1418'), ('nose', '#4a2a1a'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('tk', {'H': 0.16, 'body': (0.16, 0.2, 0.1), 'bodyc': 'orange_dk', 'head': (0.07, 0.08, 0.065), 'hc': (-0.06, 0.08), 'headc': 'orange', 'snout': (0.045, 0.04, 0.035),
    'eye': (0.022, 0.008), 'eyex': 0.55, 'eyez': 0.25, 'neck': 0.045, 'neckc': 'orange', 'leg': (0.05, 0.045), 'legc': 'orange', 'pawc': 'orange', 'toes': 3, 'toec': 'cream', 'legx': 0.13,
    'tail': [(0, 0.19, 0.12), (0, 0.24, 0.1), (0, 0.27, 0.08)], 'tailr': [0.025, 0.02, 0.005], 'tailc': 'orange'})
BC = Q['BC']
holes = [Vector((math.cos(a) * 0.7, math.sin(a) * 0.7, 0.7)).normalized() for a in [k * 2 * math.pi / 7 for k in range(7)]]
sh = blob('tk_shell', BC + Vector((0, 0.01, 0.06)), (0.24, 0.27, 0.16), lambda c, n, p: 'glow' if any(n.dot(d) > 0.975 for d in holes) else ('shell_dk' if n.z < 0.1 else 'shell'), 'spine', seg=32, rings=16,
          fn=lambda v: Vector((v.x, v.y, v.z * (0.4 if v.z < 0 else 1.0))))
tube('tk_chimney', [BC + Vector((0, 0.15, 0.17)), BC + Vector((0, 0.2, 0.24))], [0.07, 0.06], 'shell_dk', 'spine', seg=14)
blob('tk_vent', BC + Vector((0, 0.205, 0.245)), (0.045, 0.045, 0.012), 'glow', 'spine', seg=12, rings=6)
rig, mesh = quad_rig('tk', Q, 0.5)
plan_clips(rig, 'quadruped', size=0.5)
sheet('check', 0.5, poses=[('walk', 7, 'side'), ('attack_special', 15, 'q34')])
export(324, 'torkoal', 0.5, 'quadruped', rig, mesh, shiny={'orange': '#e8a040', 'shell': '#5a4a3a'})

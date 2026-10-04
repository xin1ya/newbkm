# Rapidash (78) · fire · 1.7 m. Elegant cream horse, long neck, single grey horn on forehead, flowing flame mane and long flame tail, flames at the fetlocks, grey hooves.
reset('078_rapidash')
M = pal([('cream', '#f4ead0'), ('cream_dk', '#d8c8a4'), ('hoof', '#6a6460'), ('horn', '#8a8480'), ('flame', '#ff8a2a'), ('flame_lt', '#ffd84a'), ('eye', '#1a1418'), ('iris', '#a8402a'), ('nose', '#c8a088'), ('white', '#ffffff')],
        extra_mats=[('flame', {'alpha': 0.9})])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('rd', {'H': 0.95, 'body': (0.18, 0.45, 0.2), 'bodyc': lambda c, n, p: 'cream_dk' if n.z < -0.6 else 'cream', 'head': (0.12, 0.16, 0.12), 'hc': (-0.05, 0.62), 'headc': 'cream',
    'snout': (0.075, 0.13, 0.07), 'eye': (0.035, 0.03), 'iris': 'iris', 'eyec': 'white', 'eyex': 0.6, 'eyez': 0.25, 'ears': [((0.07, 0.05, 0.1), 0.03, 0.1, 15, 'cream')],
    'leg': (0.06, 0.032), 'legc': 'cream', 'pawc': 'hoof', 'paw': (0.038, 0.045, 0.035), 'neck': 0.08, 'tail': [], 'tailr': [], 'tailc': 'flame'})
HC = Q['HC']; BC = Q['BC']
tube('rd_horn', [HC + Vector((0, -0.08, 0.1)), HC + Vector((0, -0.14, 0.2)), HC + Vector((0, -0.18, 0.3))], [0.03, 0.018, 0.002], 'horn', 'head', seg=8)
def flame(name, base, d, r, L, bone):
    o = cone(name, r, 0.002, L, verts=8, loc=base + d * L * 0.45)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, lambda c, n, p: 'flame_lt' if (c - base).length < L * 0.35 else 'flame', M['flame']); reg(o, bone)
for k in range(9):
    t = k / 8; base = HC.lerp(BC + Vector((0, -0.35, 0.15)), t) + Vector((0, 0.07, 0.1 - 0.03 * t))
    flame(f'rd_mane{k}', base, Vector((0, 1, 0.5)).normalized(), 0.08, 0.36 - 0.08 * t, 'head' if t < 0.3 else 'neck')
for k in range(5):
    a = math.radians(-24 + 12 * k)
    flame(f'rd_tail{k}', BC + Vector((0, 0.42, 0.12)), Vector((math.sin(a) * 0.4, 1, 0.25)).normalized(), 0.1, 0.6, 'hips')
for nm, (sh, pw) in Q['LEGS'].items():
    for k in range(3):
        a = math.radians(-35 + 35 * k)
        flame(f'rd_fet{k}_{nm}', Vector(pw) + Vector((0, 0.03, 0.1)), Vector((math.sin(a) * 0.5, 0.8, 0.5)).normalized(), 0.04, 0.14, nm.replace('arm', 'hand').replace('thigh', 'foot'))
rig, mesh = quad_rig('rd', Q, 1.7)
plan_clips(rig, 'quadruped', size=1.7)
sheet('check', 1.7, poses=[('run', 4, 'side'), ('attack_physical', 15, 'q34')])
export(78, 'rapidash', 1.7, 'quadruped', rig, mesh, shiny={'flame': '#4a6aff', 'flame_lt': '#a8c8ff'})

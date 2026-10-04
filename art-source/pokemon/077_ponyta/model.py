# Ponyta (77) · fire · 1.0 m. Slender cream pony with long thin legs, grey hooves, big friendly eyes, flaming orange-yellow mane on head/neck and flame tail.
reset('077_ponyta')
M = pal([('cream', '#f4ead0'), ('cream_dk', '#d8c8a4'), ('hoof', '#6a6460'), ('flame', '#ff8a2a'), ('flame_lt', '#ffd84a'), ('eye', '#1a1418'), ('iris', '#a8402a'), ('nose', '#c8a088'), ('white', '#ffffff')],
        extra_mats=[('flame', {'alpha': 0.9})])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('po', {'H': 0.55, 'body': (0.12, 0.27, 0.13), 'bodyc': lambda c, n, p: 'cream_dk' if n.z < -0.6 else 'cream', 'head': (0.09, 0.11, 0.09), 'hc': (0.02, 0.3), 'headc': 'cream',
    'snout': (0.055, 0.08, 0.05), 'eye': (0.03, 0.036), 'iris': 'iris', 'eyec': 'white', 'eyex': 0.55, 'eyez': 0.2, 'ears': [((0.05, 0.03, 0.07), 0.025, 0.07, 15, 'cream')],
    'leg': (0.04, 0.022), 'legc': 'cream', 'pawc': 'hoof', 'paw': (0.026, 0.03, 0.025), 'neck': 0.055, 'tail': [], 'tailr': [], 'tailc': 'flame'})
HC = Q['HC']; BC = Q['BC']
def flame(name, base, d, r, L, bone):
    o = cone(name, r, 0.002, L, verts=8, loc=base + d * L * 0.45)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, lambda c, n, p: 'flame_lt' if (c - base).length < L * 0.35 else 'flame', M['flame']); reg(o, bone)
for k in range(7):
    t = k / 6; base = HC.lerp(BC + Vector((0, -0.22, 0.1)), t) + Vector((0, 0.05, 0.08 - 0.02 * t))
    flame(f'po_mane{k}', base, Vector((0, 0.6, 1)).normalized(), 0.06, 0.2 - 0.04 * t, 'head' if t < 0.4 else 'neck')
for k in range(5):
    a = math.radians(-30 + 15 * k)
    flame(f'po_tail{k}', BC + Vector((0, 0.25, 0.08)), Vector((math.sin(a) * 0.5, 1, 0.7)).normalized(), 0.07, 0.3, 'hips')
rig, mesh = quad_rig('po', Q, 1.0)
plan_clips(rig, 'quadruped', size=1.0)
sheet('check', 1.0, poses=[('run', 4, 'side'), ('attack_physical', 15, 'q34')])
export(77, 'ponyta', 1.0, 'quadruped', rig, mesh, shiny={'flame': '#4a6aff', 'flame_lt': '#a8c8ff'})

# Clodsire (980) · poison/ground · 1.8 m. Big low brown blob on four stubby legs: wide flat head merging into a round body, tiny eyes far apart, wide closed smile, rows of pale lines on its back and big poison spines (cream with purple tips) along its back, short thick tail.
reset('980_clodsire')
M = pal([('brown', '#7a5a4a'), ('brown_dk', '#5a3e32'), ('belly', '#b8a090'), ('spine', '#e8dcc8'), ('tip', '#8a4aa8'), ('eye', '#1a1418'), ('mouth', '#3a2420'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('cl', {'H': 0.48, 'body': (0.48, 0.6, 0.42), 'bodyc': lambda c, n, p: 'belly' if n.z < -0.5 else 'brown', 'head': (0.42, 0.3, 0.25), 'hc': (-0.15, 0.08), 'headc': 'brown',
    'eye': (0.03, 0.03), 'eyex': 0.75, 'eyez': 0.4, 'leg': (0.13, 0.11), 'legc': 'brown_dk', 'legx': 0.3, 'tail': [(0, 0.55, 0.4), (0, 0.75, 0.3), (0, 0.88, 0.22)], 'tailr': [0.15, 0.1, 0.03], 'tailc': 'brown'})
HC = Q['HC']; BC = Q['BC']
tube('cl_mouth', [HC + Vector((math.sin(math.radians(a)) * 0.3, -0.3 + 0.1 * (1 - math.cos(math.radians(a))), -0.05 + 0.05 * (1 - math.cos(math.radians(a))))) for a in range(-60, 61, 15)], 0.012, 'mouth', 'head', seg=6)
for k in range(6):
    t = k / 5; c = BC + Vector(((k % 2 - 0.5) * 0.25, -0.3 + 0.6 * t, 0.35 + 0.05 * math.sin(math.pi * t)))
    o = cone(f'cl_spine{k}', 0.07, 0.006, 0.3, verts=8, loc=c + Vector((0, 0.05, 0.12))); o.rotation_euler = (math.radians(25), math.radians((k % 2 - 0.5) * 30), 0)
    colorize(o, lambda cc, n, p, c=c: 'tip' if cc.z > c.z + 0.2 else 'spine'); reg(o, 'chest' if t < 0.5 else 'hips')
rig, mesh = quad_rig('cl', Q, 1.8)
plan_clips(rig, 'quadruped', size=1.8)
sheet('check', 1.8, poses=[('walk', 7, 'side'), ('attack_physical', 15, 'q34')])
export(980, 'clodsire', 1.8, 'quadruped', rig, mesh, shiny={'brown': '#6a7a8a', 'brown_dk': '#4a5a6a'})

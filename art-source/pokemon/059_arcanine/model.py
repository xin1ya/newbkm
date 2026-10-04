# Arcanine (59) · fire · 1.9 m. Large regal orange dog with black stripes, thick cream mane around neck/chest and on head, cream leg tufts, cream bushy tail, cream muzzle, fierce eyes.
reset('059_arcanine')
M = pal([('orange', '#e8823a'), ('orange_dk', '#b85e24'), ('stripe', '#2a1e1a'), ('cream', '#f2e2b0'), ('cream_dk', '#d4c08a'), ('eye', '#1a1418'), ('iris', '#5a3a22'), ('nose', '#1b1716'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
Q = quad('ar', {'H': 0.95, 'body': (0.3, 0.6, 0.3), 'bodyc': lambda c, n, p: 'orange_dk' if n.z < -0.6 else 'orange', 'head': (0.2, 0.22, 0.19), 'hc': (0.02, 0.5), 'headc': 'orange',
    'snout': (0.11, 0.14, 0.09), 'snoutc': 'cream', 'eye': (0.035, 0.03), 'iris': 'iris', 'eyex': 0.5, 'eyez': 0.2, 'eyec': 'white', 'ears': [((0.13, 0.04, 0.12), 0.06, 0.13, 30, 'orange')],
    'leg': (0.11, 0.075), 'legc': 'orange', 'pawc': 'orange', 'toes': 3, 'toec': 'cream', 'neck': 0.17,
    'tail': [(0, 0.55, 1.05), (0, 0.75, 1.15), (0, 0.9, 1.25), (0, 0.98, 1.32)], 'tailr': [0.08, 0.16, 0.13, 0.02], 'tailc': 'cream'})
HC = Q['HC']; BC = Q['BC']
for k in range(14):
    a = math.radians(-100 + 200 * k / 13)
    blob(f'ar_mane{k}', BC + Vector((math.sin(a) * 0.24, -0.52 + 0.05 * abs(math.sin(a)), 0.2 + math.cos(a) * 0.18)), (0.12, 0.13, 0.14), lambda c, n, p: 'cream_dk' if n.z < -0.5 else 'cream', 'chest', seg=10, rings=6)
for k in range(6):
    blob(f'ar_chest{k}', BC + Vector(((k % 3 - 1) * 0.1, -0.58, 0.05 - 0.1 * (k // 3))), (0.1, 0.08, 0.1), 'cream', 'chest', seg=10, rings=6)
for k in range(5):
    blob(f'ar_tuft{k}', HC + Vector(((k - 2) * 0.05, 0.04 - 0.02 * (2 - abs(k - 2)), 0.17 + 0.03 * (2 - abs(k - 2)))), (0.05, 0.08, 0.06), 'cream', 'head', seg=12, rings=8)
for nm, (sh, pw) in Q['LEGS'].items():
    for k in range(3):
        blob(f'ar_legtuft{k}_{nm}', Vector(pw) + Vector((((k - 1) * 0.05), 0.04, 0.3)), (0.06, 0.06, 0.08), 'cream', nm, seg=8, rings=5)
for s_ in (1, -1):
    for k, y in enumerate((-0.25, -0.05, 0.15, 0.35)):
        decal(f'ar_stripe{k}_{s_ + 1}', Q['body'], BC + Vector((0, y, 0.08)), (s_, 0, 0.4), (0.03, 0.01, 0.15), 'stripe', ['chest', 'spine', 'spine', 'hips'][k], sink=0.3)
    decal(f'ar_hstripe_{s_ + 1}', Q['head'], HC, (s_ * 0.9, 0.2, 0.3), (0.02, 0.008, 0.07), 'stripe', 'head', sink=0.3)
rig, mesh = quad_rig('ar', Q, 1.9)
plan_clips(rig, 'quadruped', size=1.9)
sheet('check', 1.9, poses=[('run', 4, 'side'), ('attack_physical', 15, 'q34')])
export(59, 'arcanine', 1.9, 'quadruped', rig, mesh, shiny={'orange': '#f0c040', 'orange_dk': '#c09020', 'cream': '#f0e8d0'})

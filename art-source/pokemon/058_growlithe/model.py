# Growlithe (58) · fire · 0.7 m. Orange puppy with black tiger stripes, cream fluffy mane on chest/head-top, cream bushy tail, cream muzzle, floppy-pointed ears, dark eyes.
reset('058_growlithe')
M = pal([('orange', '#e8823a'), ('orange_dk', '#b85e24'), ('stripe', '#2a1e1a'), ('cream', '#f2e2b0'), ('eye', '#1a1418'), ('nose', '#1b1716'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'qkit.py'), encoding='utf-8').read())
stripes = lambda c, n, p: 'orange_dk' if n.z < -0.6 else 'orange'
Q = quad('gr', {'H': 0.27, 'body': (0.13, 0.22, 0.12), 'bodyc': stripes, 'head': (0.12, 0.11, 0.11), 'hc': (-0.01, 0.15), 'headc': 'orange', 'snout': (0.06, 0.07, 0.05), 'snoutc': 'cream',
    'eye': (0.022, 0.026), 'eyex': 0.45, 'eyez': 0.15, 'ears': [((0.08, 0.02, 0.07), 0.04, 0.08, 40, 'orange')], 'leg': (0.055, 0.042), 'legc': stripes, 'pawc': 'orange', 'toes': 3, 'toec': 'cream', 'neck': 0.08,
    'tail': [(0, 0.2, 0.3), (0, 0.28, 0.36), (0, 0.34, 0.44), (0, 0.36, 0.5)], 'tailr': [0.04, 0.07, 0.06, 0.01], 'tailc': 'cream'})
HC = Q['HC']; BC = Q['BC']
# fluffy cream mane: chest ruff and head tuft
for k in range(9):
    a = math.radians(-80 + 160 * k / 8)
    blob(f'gr_ruff{k}', BC + Vector((math.sin(a) * 0.09, -0.2, 0.03 + math.cos(a) * 0.04 - 0.06)), (0.05, 0.04, 0.06), 'cream', 'chest', seg=12, rings=8)
for k in range(5):
    blob(f'gr_tuft{k}', HC + Vector(((k - 2) * 0.025, 0.02, 0.1 + 0.015 * (2 - abs(k - 2)))), (0.03, 0.04, 0.035), 'cream', 'head', seg=12, rings=8)
for s_ in (1, -1):
    for k, y in enumerate((-0.1, -0.02, 0.06, 0.14)):
        decal(f'gr_stripe{k}_{s_ + 1}', Q['body'], BC + Vector((0, y, 0.03)), (s_, 0, 0.35), (0.012, 0.004, 0.06), 'stripe', ['chest', 'spine', 'spine', 'hips'][k], sink=0.3)
rig, mesh = quad_rig('gr', Q, 0.7)
plan_clips(rig, 'quadruped', size=0.7)
sheet('check', 0.7, poses=[('walk', 7, 'side'), ('attack_physical', 15, 'q34')])
export(58, 'growlithe', 0.7, 'quadruped', rig, mesh, shiny={'orange': '#f0c040', 'orange_dk': '#c09020'})

# Heracross (214) · bug/fighting · 1.5 m. Upright blue beetle: long horn with a two-pronged tip on its head, round yellow eyes, segmented blue body with dark lines, wing cases (elytra) on back, two-fingered hands, sturdy legs.
reset('214_heracross')
M = pal([('blue', '#3a6ab0'), ('blue_dk', '#264a80'), ('eye', '#f2d23a'), ('pupil', '#1a1418'), ('white', '#ffffff'), ('wing', '#c8d0d8')], extra_mats=[('wing', {'alpha': 0.55})])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('hx', {'BZ': 0.78, 'body': (0.24, 0.2, 0.32), 'bodyc': lambda c, n, p: 'blue_dk' if abs(math.sin(c.z * 24)) < 0.18 and n.y < -0.3 else 'blue', 'HZ2': 1.18, 'hy': -0.03, 'head': (0.14, 0.14, 0.12), 'headc': 'blue',
    'eye': (0.04, 0.04), 'eyec': 'eye', 'iris': 'pupil', 'eyex': 0.6, 'eyez': 0.0,
    'arm': ((0.22, -0.02, 0.98), (0.55, -0.03, 0.99), (0.88, -0.04, 0.98), 0.065, 0.055, 'blue'), 'hand': 0.06, 'fingers': 2, 'fingl': 1.0, 'clawc': 'blue_dk',
    'leg': ((0.12, 0.0, 0.48), (0.14, -0.05, 0.28), (0.13, 0.0, 0.08), 0.09, 0.06, 'blue'), 'foot': (0.07, 0.11, 0.05), 'toes': 2, 'toec': 'blue_dk'})
HC = Q['HC']; BC = Q['BC']
HP = [HC + Vector((0, -0.08, 0.06)), HC + Vector((0, -0.1, 0.16)), HC + Vector((0, -0.07, 0.26)), HC + Vector((0, -0.03, 0.33))]
tube('hx_horn', HP, [0.05, 0.04, 0.035, 0.03], 'blue', 'horn', seg=10)
tube('hx_prong', [HP[-1] + Vector((-0.1, 0.02, 0.02)), HP[-1], HP[-1] + Vector((0.1, 0.02, 0.02))], [0.02, 0.035, 0.02], 'blue', 'horn', seg=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    blob(f'hx_elytra_{nm}', BC + Vector((s * 0.12, 0.17, 0.08)), (0.13, 0.06, 0.3), lambda c, n, p: 'blue_dk' if n.y < 0 else 'blue', 'chest', seg=16, rings=10, rot=(10, 0, s * -8))
for s, nm in ((1, 'l'), (-1, 'r')):
    blob(f'hx_wing_{nm}', BC + Vector((s * 0.62, 0.14, 0.22)), (0.55, 0.015, 0.14), 'wing', 'chest', seg=20, rings=8, rot=(0, s * -6, 0), mat=M['wing'])
Q['bones'].append(('horn', tuple(HC + Vector((0, -0.08, 0.1))), 'head'))
rig, mesh = biped_rig(Q, 1.5)
plan_clips(rig, 'biped', size=1.5, over={'attack_physical': {'horn': [(0, {}), (9, {'r': (-25, 0, 0)}), (15, {'r': (35, 0, 0)}), (28, {})], 'head': [(0, {}), (9, {'r': (-15, 0, 0)}), (15, {'r': (25, 0, 0)}), (28, {})]}})   # Megahorn
sheet('check', 1.5, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(214, 'heracross', 1.5, 'biped', rig, mesh, shiny={'blue': '#c84a8a', 'blue_dk': '#983060'})

# Vileplume (45) · grass/poison · 1.2 m. Squat dark-blue body, red eyes, huge red five-petal flower cap with white spots and a dark center, stubby arms and feet.
reset('045_vileplume')
M = pal([('blue', '#33508f'), ('blue_dk', '#243a6c'), ('petal', '#d83a3a'), ('petal_dk', '#a82424'), ('spot', '#f4e8e8'), ('center', '#4a1a2a'), ('eye', '#1a1418'),
         ('iris', '#d33a3a'), ('white', '#ffffff'), ('mouth', '#4a1a22')])
BC = Vector((0, 0, 0.3))
body = blob('vp_body', BC, (0.2, 0.18, 0.24), lambda c, n, p: 'blue_dk' if n.z < -0.6 else 'blue', lambda c: lerp_w('spine', 'head', (c.z - 0.22) / 0.2), seg=36, rings=20)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'vp_eye_{nm}', body, BC + Vector((0, 0, 0.06)), (s * 0.35, -1, 0.1), (0.032, 0.012, 0.03), 'eye', 'head', sink=0.2)
    ir, l2, n2 = decal(f'vp_iris_{nm}', e, loc, n, (0.02, 0.006, 0.02), 'iris', 'head', sink=0.05, seg=12, rings=8)
    decal(f'vp_shine_{nm}', ir, l2 + Vector((0, 0, 0.008)), n2, (0.007, 0.003, 0.007), 'white', 'head', sink=0.05, seg=10, rings=6)
    tube(f'vp_arm_{nm}', [BC + Vector((s * 0.17, -0.03, 0.02)), BC + Vector((s * 0.25, -0.06, -0.06))], [0.045, 0.04], 'blue', f'arm_{nm}', seg=12)
    blob(f'vp_hand_{nm}', BC + Vector((s * 0.26, -0.07, -0.08)), (0.045, 0.045, 0.04), 'blue', f'arm_{nm}', seg=12, rings=8)
    blob(f'vp_foot_{nm}', (s * 0.1, -0.05, 0.04), (0.065, 0.08, 0.04), 'blue_dk', f'foot_{nm}', seg=16, rings=10)
decal('vp_mouth', body, BC + Vector((0, 0, -0.01)), (0, -1, -0.05), (0.03, 0.008, 0.01), 'mouth', 'head', sink=0.3)
top = BC + Vector((0, 0, 0.26))
for k in range(5):   # five huge petals, slightly drooping, white spots
    a = math.radians(90 + 72 * k); d = Vector((math.cos(a), math.sin(a), 0)); c0 = top + d * 0.27 + Vector((0, 0, -0.03))
    pet = blob(f'vp_petal{k}', c0, (0.24, 0.2, 0.035), lambda c, n_, p, c0=c0: 'petal_dk' if n_.z < -0.3 else 'petal', 'extra_flower', seg=24, rings=12, rot=(0, -8, math.degrees(a)))
    for j, (r, off) in enumerate(((0.035, 0.0), (0.028, 0.09), (0.025, -0.08))):
        sp = top + d * (0.25 + 0.06 * (j % 2)) + Vector((-d.y, d.x, 0)) * off
        decal(f'vp_spot{k}_{j}', pet, sp + Vector((0, 0, 0.1)), (0, 0, 1), (r, r, 0.006), 'spot', 'extra_flower', sink=0.3, up=(1, 0, 0))
blob('vp_center', top + Vector((0, 0, 0.02)), (0.12, 0.12, 0.05), 'center', 'extra_flower', seg=20, rings=10)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.12), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, 0, 0.12))), 'spine'), ('extra_flower', tuple(top), 'head')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.17, -0.03, 0.02))), 'spine'), (f'thigh_{nm}', (s * 0.1, -0.03, 0.1), 'hips'), (f'foot_{nm}', (s * 0.1, -0.05, 0.04), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.22, 0))), 'head'), ('socket_fx', tuple(top + Vector((0, 0, 0.12))), 'head')])
plan_clips(rig, 'biped', size=1.0, over={'idle': {'extra_flower': swing(3, 60, 0, 4)}, 'walk': {'extra_flower': swing(5, 26, 0.2, 4)},
    'attack_special': {'extra_flower': [(0, {}), (12, {'s': (1.12, 1.12, 0.9), 'r': (-8, 0, 0)}), (24, {'s': (0.96, 0.96, 1.05)}), (40, {})]}})   # pollen burst
sheet('check', 1.0, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('sleep', 0, 'q34')])
export(45, 'vileplume', 1.2, 'biped', rig, mesh, shiny={'petal': '#e888b8', 'petal_dk': '#c06090', 'blue': '#4a6aa8'})

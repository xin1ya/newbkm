# Cursola (864) · ghost · 1.0 m. Galarian ghost coral: a bleached white coral skeleton base with branching stalks, topped by a large purple-pink soul orb with a long white mane-like veil of coral hair, single eye peeking from inside the orb; translucent glow.
reset('864_cursola')
M = pal([('coral', '#f2ece4'), ('coral_dk', '#c8beb4'), ('soul', '#b07ac8'), ('soul_lt', '#e0b0f0'), ('eye', '#1a1418'), ('white', '#ffffff')], extra_mats=[('soul', {'alpha': 0.75})])
BC = Vector((0, 0, 0.35))
blob('cs_base', BC, (0.22, 0.2, 0.18), lambda c, n, p: 'coral_dk' if n.z < -0.4 else 'coral', 'spine', seg=24, rings=12,
     fn=lambda v: Vector((v.x * (1 + 0.1 * math.sin(v.z * 12 + v.y * 9)), v.y * (1 + 0.1 * math.cos(v.x * 11)), v.z)))
for k in range(6):
    a = 2 * math.pi * k / 6
    p0 = BC + Vector((math.cos(a) * 0.15, math.sin(a) * 0.15, -0.1))
    tube(f'cs_root{k}', [p0, p0 + Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, -0.15)), p0 + Vector((math.cos(a) * 0.14, math.sin(a) * 0.14, -0.24))], [0.04, 0.03, 0.01], 'coral', 'hips', seg=8)
SC = BC + Vector((0, 0, 0.4))
for k in range(8):
    a = 2 * math.pi * k / 8
    p0 = BC + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.12))
    tube(f'cs_stalk{k}', [p0, p0 + Vector((math.cos(a) * 0.06, math.sin(a) * 0.06, 0.15)), SC + Vector((math.cos(a) * 0.15, math.sin(a) * 0.15, -0.05))], [0.03, 0.025, 0.02], 'coral', 'spine', seg=8)
orb = blob('cs_orb', SC, (0.2, 0.2, 0.2), lambda c, n, p: 'soul_lt' if n.z > 0.6 else 'soul', 'head', seg=24, rings=14, mat=M['soul'])
blob('cs_core', SC + Vector((0, -0.05, 0)), (0.07, 0.04, 0.07), 'white', 'head', seg=12, rings=8)
blob('cs_eye', SC + Vector((0, -0.09, 0)), (0.03, 0.01, 0.035), 'eye', 'head', seg=10, rings=6)
for k in range(9):
    a = math.radians(-100 + 200 * k / 8)
    p0 = SC + Vector((math.sin(a) * 0.15, 0.05 + 0.1 * math.cos(a), 0.12))
    tube(f'cs_hair{k}', [p0, p0 + Vector((math.sin(a) * 0.1, 0.15, 0.08)), p0 + Vector((math.sin(a) * 0.2, 0.3, -0.3)), p0 + Vector((math.sin(a) * 0.22, 0.35, -0.55))], [0.04, 0.04, 0.03, 0.005], 'coral', 'hair', seg=8, flat=0.6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.2), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(SC), 'spine'), ('hair', tuple(SC + Vector((0, 0.1, 0.1))), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(SC + Vector((0, -0.2, 0))), 'head'), ('socket_fx', tuple(SC + Vector((0, -0.25, 0))), 'head')])
plan_clips(rig, 'rigid', size=1.0, over={'idle': {'head': swing(4, 60, 0, 4, 2), 'hair': swing(8, 60, 0.3, 4, 0)}})
sheet('check', 1.0, poses=[('idle', 6, 'side'), ('attack_special', 12, 'q34')])
export(864, 'cursola', 1.0, 'rigid', rig, mesh, shiny={'soul': '#7ac8c8', 'soul_lt': '#b0f0f0'})

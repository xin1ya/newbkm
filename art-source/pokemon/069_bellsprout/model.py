# Bellsprout (69) · grass/poison · 0.7 m. Yellow bell head tipped forward with pink lips, thin brown stem body, two leaf arms, root feet.
reset('069_bellsprout')
M = pal([('yellow', '#d9d95a'), ('yellow_dk', '#a8a83a'), ('lip', '#e59aa0'), ('mouth', '#5a2a30'), ('stem', '#8a6a3c'), ('leaf', '#5aa548'), ('leaf_dk', '#3a7a30'),
         ('vein', '#8fd27a'), ('eye', '#1a1418'), ('white', '#ffffff')])
HC = Vector((0, -0.04, 0.6))
head = blob('bs_head', HC, (0.07, 0.11, 0.075), lambda c, n, p: 'yellow_dk' if n.z < -0.7 else 'yellow', 'head', seg=28, rings=16, rot=(-30, 0, 0),
            fn=lambda v: Vector((v.x * (1 - 0.25 * max(0, v.y)), v.y, v.z * (1 - 0.25 * max(0, v.y)))))
# bell mouth at the front tip
tube('bs_lip', [HC + Vector((0, -0.085, -0.04)), HC + Vector((0, -0.11, -0.06))], [0.042, 0.048], 'lip', 'head', seg=20)
blob('bs_mouth', HC + Vector((0, -0.113, -0.063)), (0.032, 0.006, 0.032), 'mouth', 'head', seg=16, rings=8, rot=(-30, 0, 0))
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'bs_eye_{nm}', head, HC + Vector((0, -0.02, 0.01)), (s * 0.8, -0.6, 0.15), (0.011, 0.006, 0.014), 'eye', 'head', sink=0.2)
    decal(f'bs_shine_{nm}', e, loc + Vector((0, 0, 0.004)), n, (0.004, 0.002, 0.004), 'white', 'head', sink=0.05, seg=8, rings=6)
# stem: from head bottom-back curving down to hips
tube('bs_neck', [HC + Vector((0, 0.06, 0.0)), Vector((0, 0.03, 0.5)), Vector((0, 0.0, 0.4)), Vector((0, 0.0, 0.3)), Vector((0, 0, 0.17))], [0.016, 0.014, 0.013, 0.013, 0.012], 'stem',
     lambda c: lerp_w('hips', 'spine', (c.z - 0.17) / 0.13) if c.z < 0.3 else lerp_w('spine', 'head', (c.z - 0.3) / 0.25), seg=10)
blob('bs_knot', (0, 0, 0.17), (0.02, 0.02, 0.02), 'stem', 'hips', seg=12, rings=8)
# leaf arms
for s, nm in ((1, 'l'), (-1, 'r')):
    a = Vector((s * 0.012, 0, 0.36))
    pts = [a, a + Vector((s * 0.05, -0.01, 0.0)), a + Vector((s * 0.1, -0.015, -0.01)), a + Vector((s * 0.15, -0.01, -0.025)), a + Vector((s * 0.18, 0, -0.04))]
    blob(f'bs_leaf_{nm}', a + Vector((s * 0.105, -0.01, -0.015)), (0.1, 0.055, 0.008), lambda c, n_, p: 'leaf' if n_.z > -0.2 else 'leaf_dk', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', abs(c.x) / 0.2), seg=20, rings=10, fn=lambda v: Vector((v.x, v.y * (1 - 0.85 * abs(v.x) ** 1.5), v.z - 0.15 * v.x * v.x)))
    # root legs: thin, splayed, with 3 root toes
    hip = Vector((0, 0, 0.17)); knee = Vector((s * 0.05, 0, 0.09)); ft = Vector((s * 0.08, -0.01, 0.01))
    tube(f'bs_leg_{nm}', [hip, knee, ft], [0.009, 0.008, 0.007], 'stem', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.17 - c.z) / 0.16), seg=8)
    for k, d in enumerate(((0, -0.05), (s * 0.04, -0.03), (s * 0.03, 0.03))):
        tube(f'bs_toe{k}_{nm}', [ft, ft + Vector((d[0], d[1], -0.005))], [0.006, 0.003], 'stem', f'foot_{nm}', seg=6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.17), 'root'), ('spine', (0, 0, 0.3), 'hips'), ('chest', (0, 0, 0.42), 'spine'), ('head', (0, 0.02, 0.53), 'chest')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.015, 0, 0.36), 'chest'), (f'hand_{nm}', (s * 0.1, -0.015, 0.35), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.01, 0, 0.16), 'hips'), (f'foot_{nm}', (s * 0.07, -0.01, 0.03), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.13, -0.07))), 'head'), ('socket_fx', (0, 0, 0.75), 'head')])
plan_clips(rig, 'biped', size=0.7, over={'idle': {'chest': swing(5, 60, 0.3, 4, 1)}, 'attack_physical': {'head': [(0, {}), (9, {'r': (-30, 0, 0)}), (15, {'r': (40, 0, 0)}), (28, {})]}})  # Vine Whip / Wrap: lunging bell
sheet('check', 0.7, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(69, 'bellsprout', 0.7, 'biped', rig, mesh, shiny={'yellow': '#e8c84a', 'yellow_dk': '#b8962a', 'leaf': '#9ad04a'})

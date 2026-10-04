# Gloom (44) · grass/poison · 0.8 m. Dark-blue round body with droopy half-closed eyes and drool, stubby arms/legs, five drooping leaves around a big maroon flower bud with orange-spotted petals.
reset('044_gloom')
M = pal([('blue', '#33508f'), ('blue_dk', '#243a6c'), ('leaf', '#3f9a4a'), ('leaf_dk', '#2a6e33'), ('petal', '#a8303a'), ('petal_dk', '#7a1f28'), ('spot', '#f08a3a'),
         ('eye', '#1a1418'), ('lid', '#243a6c'), ('white', '#ffffff'), ('drool', '#cfe6f0'), ('mouth', '#4a1a22')])
BC = Vector((0, 0, 0.24))
body = blob('glm_body', BC, (0.19, 0.17, 0.19), lambda c, n, p: 'blue_dk' if n.z < -0.6 else 'blue', lambda c: lerp_w('spine', 'head', (c.z - 0.18) / 0.15), seg=36, rings=20)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'glm_eye_{nm}', body, BC + Vector((0, 0, 0.04)), (s * 0.38, -1, 0.1), (0.03, 0.012, 0.02), 'eye', 'head', sink=0.2)
    decal(f'glm_lid_{nm}', body, BC + Vector((0, 0, 0.065)), (s * 0.38, -1, 0.25), (0.036, 0.012, 0.014), 'lid', 'head', sink=0.15)
    blob(f'glm_arm_{nm}', BC + Vector((s * 0.18, -0.03, -0.03)), (0.05, 0.04, 0.035), 'blue', f'arm_{nm}', seg=14, rings=8, rot=(0, s * 30, 0))
    blob(f'glm_foot_{nm}', (s * 0.09, -0.04, 0.035), (0.055, 0.07, 0.035), 'blue_dk', f'foot_{nm}', seg=16, rings=10)
decal('glm_mouth', body, BC + Vector((0, 0, -0.03)), (0, -1, -0.1), (0.035, 0.01, 0.018), 'mouth', 'head', sink=0.3)
tube('glm_drool', [BC + Vector((0.015, -0.17, -0.05)), BC + Vector((0.017, -0.175, -0.09)), BC + Vector((0.018, -0.17, -0.11))], [0.006, 0.008, 0.01], 'drool', 'head', seg=6)
top = BC + Vector((0, 0, 0.17)); LEAF = []
for k in range(5):
    a = math.radians(90 + 72 * k); d = Vector((math.cos(a) * 0.85, math.sin(a) * 0.85, 0.5)).normalized()
    pts = [top + d * 0.26 * t + Vector((0, 0, -0.16 * t * t)) for t in (0, 0.2, 0.45, 0.7, 0.9, 1.0)]
    bn = f'extra_leaf{k}'; LEAF.append((bn, top + d * 0.04))
    tube(f'glm_leaf{k}', pts, [0.015, 0.05, 0.065, 0.055, 0.03, 0.004], lambda c, n_, p: 'leaf' if n_.z > -0.2 else 'leaf_dk', lambda c, bn=bn: lerp_w('head', bn, 0.9), seg=12, flat=0.18)
for k in range(4):   # bud petals curled up around a dark center
    a = math.radians(45 + 90 * k); d = Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 1)).normalized()
    blob(f'glm_petal{k}', top + d * 0.08 + Vector((0, 0, 0.02)), (0.07, 0.03, 0.09), lambda c, n_, p: 'spot' if n_.dot(d) > 0.85 else 'petal', 'extra_bud', seg=16, rings=10, rot=(math.degrees(-math.atan2(d.y, d.z)) * 0.6, math.degrees(math.atan2(d.x, d.z)) * 0.6, 0))
blob('glm_core', top + Vector((0, 0, 0.06)), (0.05, 0.05, 0.04), 'petal_dk', 'extra_bud', seg=14, rings=8)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.1), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, 0, 0.1))), 'spine'), ('extra_bud', tuple(top + Vector((0, 0, 0.03))), 'head')]
bones += [(bn, tuple(p), 'head') for bn, p in LEAF]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.16, -0.02, -0.02))), 'spine'), (f'thigh_{nm}', (s * 0.09, -0.02, 0.09), 'hips'), (f'foot_{nm}', (s * 0.09, -0.04, 0.035), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.2, -0.03))), 'head'), ('socket_fx', tuple(top + Vector((0, 0, 0.12))), 'head')])
def leaves(L, a, ph=0.0): return {bn: swing(a, L, ph + 0.13 * i, 4, 1 + (i % 2)) for i, (bn, _) in enumerate(LEAF)}
plan_clips(rig, 'biped', size=0.8, over={'idle': merge(leaves(60, 5), {'extra_bud': swing(4, 60, 0, 4)}), 'walk': leaves(26, 9), 'run': leaves(16, 14),
    'attack_special': merge(leaves(40, 16), {'extra_bud': [(0, {}), (12, {'s': (1.25, 1.25, 0.85)}), (22, {'s': (0.9, 0.9, 1.1)}), (40, {})]})})
sheet('check', 0.8, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('sleep', 0, 'q34')])
export(44, 'gloom', 0.8, 'biped', rig, mesh, shiny={'petal': '#e0802a', 'petal_dk': '#b05a18', 'spot': '#f6d84a'})

# Weepinbell (70) · grass/poison · 1.0 m. Yellow bell/pitcher body with brown spots, wide pink-lipped mouth, two broad leaves at sides, stalk with hook on top. No legs (hops).
reset('070_weepinbell')
M = pal([('yellow', '#d6d454'), ('yellow_dk', '#a3a336'), ('spot', '#8a8a2a'), ('lip', '#e6a0a6'), ('mouth', '#4a2228'), ('teeth', '#f4f0e0'), ('leaf', '#5aa548'),
         ('leaf_dk', '#3a7a30'), ('stem', '#8a6a3c'), ('eye', '#1a1418'), ('white', '#ffffff')])
BC = Vector((0, 0, 0.45))
spots = [Vector(v).normalized() for v in ((0.6, 0.3, 0.4), (-0.6, 0.3, 0.4), (0.3, 0.8, 0.1), (-0.4, 0.8, -0.2), (0.8, 0.1, -0.3), (-0.8, 0.2, -0.3), (0.1, 0.9, 0.5))]
def col(c, n, p):
    if any(n.dot(d) > 0.96 for d in spots): return 'spot'
    return 'yellow_dk' if n.z < -0.6 else 'yellow'
body = blob('wb_body', BC, (0.2, 0.19, 0.3), col, lambda c: lerp_w('spine', 'head', (c.z - 0.3) / 0.3), seg=36, rings=22,
            fn=lambda v: Vector((v.x * (1 + 0.25 * min(0, v.z) * -1 - 0.35 * max(0, v.z)), v.y * (1 + 0.2 * -min(0, v.z) - 0.35 * max(0, v.z)), v.z)))
# mouth: big lipped opening on front-lower
MC = BC + Vector((0, -0.17, -0.12))
tube('wb_lip', [MC + Vector((math.cos(a) * 0.12, -0.02 * math.sin(a) ** 2, math.sin(a) * 0.06)) for a in [2 * math.pi * k / 28 for k in range(29)]], 0.022, 'lip', 'head', seg=8)
blob('wb_mouth', MC + Vector((0, 0.01, 0)), (0.115, 0.03, 0.055), 'mouth', 'head', seg=20, rings=10)
for s in (1, -1):
    blob(f'wb_tooth{s}', MC + Vector((s * 0.05, -0.012, 0.045)), (0.012, 0.008, 0.016), 'teeth', 'head', seg=8, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'wb_eye_{nm}', body, BC + Vector((0, 0, 0.04)), (s * 0.45, -1, 0.15), (0.03, 0.012, 0.034), 'white', 'head', sink=0.2)
    p, l2, n2 = decal(f'wb_pupil_{nm}', e, loc + Vector((s * -0.008, 0, -0.004)), n, (0.012, 0.005, 0.014), 'eye', 'head', sink=0.05, seg=10, rings=6)
    # broad leaves from upper sides
    a = BC + Vector((s * 0.17, 0, 0.02))
    pts = [a, a + Vector((s * 0.08, -0.01, 0.0)), a + Vector((s * 0.17, -0.02, -0.03)), a + Vector((s * 0.25, -0.01, -0.08)), a + Vector((s * 0.3, 0.0, -0.12))]
    tube(f'wb_leaf_{nm}', pts, [0.01, 0.07, 0.085, 0.055, 0.005], lambda c, n_, p_: 'leaf' if n_.z > -0.2 else 'leaf_dk', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (abs(c.x) - 0.17) / 0.3), seg=12, flat=0.14)
# stalk + hook on top
top = BC + Vector((0, 0.03, 0.29))
tube('wb_stalk', [top, top + Vector((0, 0.02, 0.1)), top + Vector((0, 0.06, 0.16)), top + Vector((0, 0.11, 0.14)), top + Vector((0, 0.12, 0.09))], [0.022, 0.016, 0.014, 0.012, 0.008], 'stem',
     lambda c: lerp_w('head', 'stalk', (c.z - top.z) / 0.12), seg=10)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.2), 'root'), ('spine', (0, 0, 0.4), 'hips'), ('head', (0, 0, 0.6), 'spine'), ('stalk', tuple(top + Vector((0, 0, 0.05))), 'head')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'arm_{nm}', (s * 0.17, 0, 0.47), 'spine'), (f'hand_{nm}', (s * 0.32, -0.02, 0.44), f'arm_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(MC + Vector((0, -0.04, 0))), 'head'), ('socket_fx', (0, 0, 1.05), 'head')])
plan_clips(rig, 'rigid', size=1.0, over={'idle': {'arm_l': swing(8, 60, 0, 4, 1), 'arm_r': swing(-8, 60, 0, 4, 1), 'stalk': swing(8, 60, 0.3, 4, 0)},
    'walk': {'arm_l': swing(20, 24, 0, 4, 1), 'arm_r': swing(-20, 24, 0, 4, 1)}, 'attack_physical': {'arm_l': [(0, {}), (9, {'r': (0, -40, 0)}), (15, {'r': (0, 50, 0)}), (28, {})]}})
sheet('check', 1.0, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(70, 'weepinbell', 1.0, 'rigid', rig, mesh, shiny={'yellow': '#e8c84a', 'yellow_dk': '#b8962a', 'spot': '#a07a20', 'leaf': '#9ad04a'})

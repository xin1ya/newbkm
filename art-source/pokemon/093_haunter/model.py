# Haunter (93) · ghost/poison · 1.6 m. Evolution of Gastly — geometry matched to the reference silhouette (art-source/reference, comparison only):
# a floating purple head-body: wide top with two big pointed ear-horns, jagged spikes along the sides, tapering underneath into a pointed
# tail that sweeps back; slanted pale eyes with small pupils, huge grin with a pink tongue and teeth; two disembodied three-clawed hands
# hovering low in front. Slight translucency at the tail tip to keep the gas-ghost feel.
reset('093_haunter')
M = pal([('body', '#6a3aa8'), ('body_dk', '#4e2a82'), ('body_lt', '#8a5ac8'), ('eyew', '#e8e4f4'), ('pupil', '#151018'), ('mouth', '#3a1430'), ('tongue', '#d0609a'),
         ('teeth', '#f6f2ff')], extra_mats=[('body', {'alpha': 0.75})])
HC = Vector((0, 0.08, 1.08))
def hfn(v):
    k = 1 - 0.35 * max(0, -v.z)   # narrower toward the bottom
    return Vector((v.x * k, v.y * (1 - 0.15 * max(0, -v.z)) + 0.12 * max(0, v.z), v.z))
head = blob('hau_head', HC, (0.52, 0.4, 0.34), lambda c, n, p: 'body_lt' if n.z > 0.6 else 'body', 'head', seg=44, rings=26, fn=hfn)
# rear cowl: the head mass sweeps backward into a wedge behind the face
blob('hau_cowl', HC + Vector((0, 0.32, -0.05)), (0.36, 0.32, 0.28), 'body', 'head', seg=32, rings=18,
     fn=lambda v: Vector((v.x * (1 - 0.4 * max(0, v.y)), v.y, v.z * (1 - 0.3 * max(0, v.y)) + 0.1 * max(0, v.y))))
# lower body tapering into a pointed tail swept back
TP = [HC + Vector((0, 0.02, -0.12)), HC + Vector((0, 0.06, -0.35)), HC + Vector((0, 0.16, -0.55)), HC + Vector((0, 0.36, -0.74)), HC + Vector((0, 0.6, -0.86))]
tube('hau_tail', TP, [0.3, 0.22, 0.13, 0.06, 0.005], 'body', lambda c: seg_w(c, ['head', 'tail1', 'tail2']), seg=24, flat=1.25)
def spike(name, base, d, r, length, bone, col='body'):
    o = cone(name, r, 0.003, length, verts=10, loc=base + d * length * 0.45)
    o.scale = (1, 0.55, 1); o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, col); reg(o, bone); return o
for s, nm in ((1, 'l'), (-1, 'r')):
    # big ear horns: up and out
    spike(f'hau_ear_{nm}', HC + Vector((s * 0.36, 0.04, 0.16)), Vector((s * 0.6, 0.55, 1)).normalized(), 0.2, 0.6, f'ear_{nm}')
    # side spikes, swept back and slightly down
    for j, (dz, L) in enumerate(((0.04, 0.34), (-0.1, 0.3), (-0.24, 0.24), (-0.38, 0.18))):
        spike(f'hau_side{j}_{nm}', HC + Vector((s * (0.42 - 0.08 * j), 0.08, dz)), Vector((s * 1, 0.45, -0.05 - 0.15 * j)).normalized(), 0.09, L, 'head')
    for j, dz in enumerate((0.15, -0.05, -0.25, -0.45)):   # back spikes, swept far back
        spike(f'hau_back{j}_{nm}', HC + Vector((s * 0.16, 0.45 + 0.03 * j, dz)), Vector((s * 0.3, 1, 0.25 - 0.15 * j)).normalized(), 0.1, 0.38, 'head')
    # eyes: slanted almond, pupils
    e, l, n = decal(f'hau_eye_{nm}', head, HC + Vector((0, 0, 0.05)), (s * 0.38, -1, 0.15), (0.085, 0.014, 0.04), 'eyew', 'head', sink=0.25, up=(s * -0.35, 0, 1))
    decal(f'hau_pupil_{nm}', e, l + Vector((-s * 0.02, 0, 0)), n, (0.015, 0.004, 0.015), 'pupil', 'head', sink=0.0, seg=10, rings=6)
    decal(f'hau_brow_{nm}', head, HC + Vector((0, 0, 0.12)), (s * 0.36, -1, 0.42), (0.1, 0.02, 0.02), 'body_dk', 'head', sink=0.2, up=(s * -0.4, 0, 1))
    # floating hands: palm + three claws pointing down
    hc = Vector((s * 0.46, -0.32, 0.22))
    blob(f'hau_palm_{nm}', hc, (0.16, 0.1, 0.1), 'body', f'hand_{nm}', seg=18, rings=10)
    for k in range(3):
        x = (k - 1) * 0.09
        f0 = hc + Vector((x, -0.02, -0.03))
        tube(f'hau_claw{k}_{nm}', [f0, f0 + Vector((x * 0.2, -0.05, -0.1)), f0 + Vector((x * 0.3, -0.03, -0.2)), f0 + Vector((x * 0.3, 0.02, -0.24))], [0.05, 0.042, 0.03, 0.006], 'body', f'hand_{nm}', seg=10)
    th = hc + Vector((-s * 0.13, -0.02, 0.02))
    tube(f'hau_thumb_{nm}', [th, th + Vector((-s * 0.05, -0.04, -0.06)), th + Vector((-s * 0.06, -0.02, -0.11))], [0.026, 0.018, 0.004], 'body', f'hand_{nm}', seg=10)
m, ml, mn = decal('hau_mouth', head, HC + Vector((0, 0, -0.1)), (0, -1, -0.15), (0.32, 0.015, 0.11), 'mouth', 'head', sink=0.25)
decal('hau_tongue', m, ml + Vector((0, 0, -0.03)), mn, (0.13, 0.01, 0.045), 'tongue', 'head', sink=0.0)
for k in range(7):   # upper teeth row
    x = (k - 3) * 0.065; t = cone(f'hau_tooth{k}', 0.024, 0.0, 0.05, verts=6, loc=ml + Vector((x, 0.0, 0.07 - abs(x) * 0.2)) + mn * 0.01)
    t.rotation_euler = (math.radians(180 - 15), 0, 0); colorize(t, 'teeth'); reg(t, 'head')
bones = [('root', (0, 0, 0), None), ('spine', (0, 0.05, 0.8), 'root'), ('head', tuple(HC), 'spine'), ('tail1', tuple(TP[2]), 'spine'), ('tail2', tuple(TP[3]), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'ear_{nm}', tuple(HC + Vector((s * 0.3, 0.02, 0.2))), 'head'), (f'hand_{nm}', (s * 0.46, -0.32, 0.24), 'root')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.33, -0.1))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.38, 0))), 'head')])
hov = lambda L: {'hand_l': loop([(0, {}), (L // 2, {'t': (0, 0, 0.04), 'r': (8, 0, 0)})], L), 'hand_r': loop([(0, {'t': (0, 0, 0.04)}), (L // 2, {'r': (8, 0, 0)})], L), 'tail1': swing(10, L, 0.0, 4, 2), 'tail2': swing(14, L, 0.2, 4, 2)}
plan_clips(rig, 'rigid', size=1.3, over={'idle': hov(60), 'walk': hov(28), 'run': hov(18), 'sleep': hov(90),
                                        'attack_physical': {'hand_l': [(0, {}), (8, {'t': (0, 0.1, 0.1)}), (14, {'t': (0, -0.35, 0.05)}), (28, {})], 'hand_r': [(0, {}), (10, {'t': (0, 0.1, 0.1)}), (16, {'t': (0, -0.35, 0.05)}), (30, {})]},   # Shadow Punch
                                        'attack_special': {'head': [(0, {}), (12, {'s': (1.12, 1.12, 1.12)}), (22, {'s': (0.95, 0.95, 0.95)}), (40, {})]}})   # Shadow Ball / Hypnosis
sheet('check', 1.7, poses=[('idle', 15, 'front'), ('walk', 6, 'side'), ('attack_physical', 14, 'q34'), ('attack_special', 12, 'q34')])
export(93, 'haunter', 1.6, 'rigid', rig, mesh, shiny={'body': '#4a6ac8', 'body_dk': '#2e4a9a', 'body_lt': '#6a8ae0'})

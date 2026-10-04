# Zigzagoon (263) · normal · 0.4 m. v2 — geometry matched to the reference silhouette (art-source/reference, comparison only):
# long low raccoon whose fur sticks out in jagged rings (alternating grey-brown / cream bands of spikes) all along the body,
# pointed snout with a black mask band across the eyes, small pointed ears, short cream legs with claws, big spiky tail swept up and back.
reset('263_zigzagoon')
M = pal([('brown', '#7c6a5a'), ('brown_dk', '#5a4a3e'), ('cream', '#ece2d0'), ('mask', '#22201e'), ('eye', '#1a1418'), ('iris', '#5a3a22'), ('white', '#ffffff'),
         ('nose', '#1b1716'), ('leg', '#e8dcc8'), ('claw', '#9a9088')])
BC = Vector((0, 0.0, 0.19)); HC = Vector((0, -0.2, 0.18))
W = lambda c: seg_w(c, ['chest', 'spine', 'hips'])
body = blob('zig_body', BC, (0.115, 0.2, 0.095), 'brown', W, seg=36, rings=18, fn=lambda v: Vector((v.x * (1 + 0.08 * v.y), v.y, v.z)))
head = blob('zig_head', HC, (0.085, 0.09, 0.075), lambda c, n, p: 'cream' if n.z < -0.4 else 'brown', 'head', seg=32, rings=18)
snout = blob('zig_snout', HC + Vector((0, -0.09, -0.02)), (0.042, 0.075, 0.038), lambda c, n, p: 'cream' if n.z < 0.2 else 'brown', 'head', seg=24, rings=12,
             fn=lambda v: Vector((v.x * (1 - 0.45 * max(0, -v.y)), v.y, v.z * (1 - 0.35 * max(0, -v.y)))))
blob('zig_nose', HC + Vector((0, -0.163, -0.012)), (0.016, 0.012, 0.012), 'nose', 'head', seg=12, rings=8)
decal('zig_mouth', snout, HC + Vector((0, -0.11, -0.04)), (0, -0.6, -0.8), (0.016, 0.004, 0.004), 'nose', 'head', sink=0.3)
# mask band across both eyes
pts = []
for i in range(11):
    a = math.radians(-75 + 150 * i / 10); d = Vector((math.sin(a), -math.cos(a), 0.25)).normalized()
    l, nn = shoot(head, HC, d); pts.append(l + nn * 0.003)
mask = tube('zig_mask', pts, 0.024, 'mask', 'head', seg=8, flat=0.35)
for s, nm in ((1, 'l'), (-1, 'r')):
    l, nn = shoot(head, HC, Vector((s * 0.45, -0.85, 0.25)).normalized())
    ee, el, en = decal(f'zig_eye_{nm}', mask, HC, (s * 0.45, -0.85, 0.25), (0.019, 0.008, 0.021), 'eye', 'head', sink=0.2)
    decal(f'zig_shine_{nm}', ee, el + Vector((0, 0, 0.008)), en, (0.006, 0.003, 0.006), 'white', 'head', sink=0.0, seg=8, rings=5)
    e = cone(f'zig_ear_{nm}', 0.03, 0.002, 0.05, verts=10, loc=HC + Vector((s * 0.06, 0.03, 0.08)))
    e.rotation_euler = (math.radians(-15), math.radians(s * 35), 0); colorize(e, lambda c, n_, p: 'mask' if c.z > HC.z + 0.1 else 'brown'); reg(e, f'ear_{nm}')
def spike(name, base, d, r, length, col, bone):
    o = cone(name, r, 0.0015, length, verts=4, loc=base + d * length * 0.45)
    o.scale = (1.0, 0.45, 1.0)   # flat jagged blade, like the reference's zigzag fur
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, col); reg(o, bone); return o
# fur rings: jagged collars of spikes around the body, alternating colours, swept backward
for k, y in enumerate((-0.16, -0.1, -0.03, 0.04, 0.11, 0.17)):
    col = 'cream' if k % 2 else 'brown'
    n = 11
    for i in range(n):
        a = math.radians(-100 + 200 * i / (n - 1))   # skip the belly
        out = Vector((math.sin(a), 0, math.cos(a)))
        l, nn = shoot(body, Vector((0, y, BC.z)), out, fallback=True)
        d = (nn + Vector((0, 0.9, 0))).normalized()
        ln = 0.07 + 0.025 * math.cos(a) + 0.012 * ((i + k) % 2)
        spike(f'zig_fur{k}_{i}', l - nn * 0.01, d, 0.03, ln, col, W)
# cheek ruffs
for s in (1, -1):
    for j in range(3):
        b0 = HC + Vector((s * 0.07, 0.02 + 0.02 * j, -0.02 + 0.025 * j)); spike(f'zig_ruff{j}_{s + 1}', b0, Vector((s * 1, 0.6, 0.1 * j)).normalized(), 0.022, 0.05, 'cream', 'head')
# head crest
for j, (x, a) in enumerate(((0, 0), (0.025, 25), (-0.025, -25))):
    spike(f'zig_crest{j}', HC + Vector((x, 0.02, 0.06)), Vector((math.sin(math.radians(a)) * 0.6, 0.6, 1)).normalized(), 0.022, 0.06, 'cream' if j == 0 else 'brown', 'head')
# legs: short cream, small claws
LEGS = {'arm_l': ((0.055, -0.1, 0.12), (0.06, -0.1, 0.0)), 'arm_r': ((-0.055, -0.1, 0.12), (-0.06, -0.1, 0.0)),
        'thigh_l': ((0.06, 0.08, 0.12), (0.065, 0.08, 0.0)), 'thigh_r': ((-0.06, 0.08, 0.12), (-0.065, 0.08, 0.0))}
for nm, (sh, pw) in LEGS.items():
    leg4(nm[-1], nm.startswith('arm'), sh, pw, 0.03, 0.022, 'leg', paw_col='leg', toes=3, toe_col='claw')
# tail: thick, swept up and back, layered spike crowns
TP = [Vector(p) for p in ((0, 0.17, 0.2), (0, 0.22, 0.24), (0, 0.27, 0.29), (0, 0.3, 0.34), (0, 0.31, 0.37))]
tail = tube('zig_tail', TP, [0.05, 0.065, 0.06, 0.04, 0.01], 'brown', lambda c: seg_w(c, ['hips', 'tail1', 'tail2', 'tail3']), seg=12)
for k, t in enumerate((0, 1, 2, 3)):
    p0 = TP[t]; ax = (TP[t + 1] - TP[t]).normalized(); col = 'cream' if k % 2 else 'brown'
    side = ax.cross(Vector((1, 0, 0))).normalized()
    for i in range(8):
        a = 2 * math.pi * i / 8; out = (Vector((1, 0, 0)) * math.cos(a) + side * math.sin(a)).normalized()
        d = (out * 0.8 + ax).normalized()
        spike(f'zig_tsp{k}_{i}', p0 + out * 0.03, d, 0.028, 0.08 - 0.012 * k, col, ['tail1', 'tail1', 'tail2', 'tail3'][k])
bones = quad_bones((0, 0.1, 0.2), (0, -0.09, 0.2), (0, -0.14, 0.2), HC, LEGS, tail=[TP[1], TP[2], TP[3]],
                   ears=[('ear_l', HC + Vector((0.055, 0.03, 0.07))), ('ear_r', HC + Vector((-0.055, 0.03, 0.07)))])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.17, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.18, 0))), 'head')])
plan_clips(rig, 'quadruped', size=0.4, over={'idle_alt': (110, {'neck': [(0, {}), (15, {'r': (22, 0, 0)}), (35, {'r': (22, 12, 0)}), (55, {'r': (22, -12, 0)}), (75, {'r': (22, 0, 0)}), (95, {}), (110, {})],
                                                              'head': [(0, {}), (20, {'r': (8, 0, 0)}), (90, {'r': (8, 0, 0)}), (110, {})]}, True, None)})   # sniffing the ground for items
sheet('check', 0.42, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('idle_alt', 35, 'q34')])
export(263, 'zigzagoon', 0.4, 'quadruped', rig, mesh, shiny={'brown': '#c9b38a', 'brown_dk': '#a8946a', 'cream': '#f6efdc'})

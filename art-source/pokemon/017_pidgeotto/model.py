# Pidgeotto (17) · normal/flying · 1.1 m. Upright proud bird: brown body, cream breast, black eye stripes, long red+yellow crest plume, long red/cream tail, strong talons.
reset('017_pidgeotto')
M = pal([('brown', '#a4703c'), ('brown_dk', '#77502a'), ('cream', '#f2e0b0'), ('eye', '#1a1418'), ('white', '#ffffff'), ('beak', '#c79a8e'), ('beak_dk', '#946b60'),
         ('feet', '#e2a497'), ('red', '#d8453a'), ('yellow', '#f4c542'), ('claw', '#3a2a22')])
K = 1.0
BC = Vector((0, 0.03, 0.55)); HC = Vector((0, -0.1, 0.88))
body = blob('pgt_body', BC, (0.2, 0.24, 0.3), lambda c, n, p: 'cream' if (n.y < -0.35 and c.z < 0.75) else 'brown', lambda c: lerp_w('spine', 'chest', (c.z - 0.45) / 0.3), seg=36, rings=20,
            fn=lambda v: Vector((v.x * (1 - 0.15 * v.z), v.y - 0.12 * v.z, v.z)))
neck = blob('pgt_neck', (0, -0.06, 0.78), (0.13, 0.14, 0.14), lambda c, n, p: 'cream' if n.y < -0.4 else 'brown', lambda c: lerp_w('chest', 'neck', (c.z - 0.7) / 0.12), seg=24, rings=12)
head = blob('pgt_head', HC, (0.14, 0.15, 0.13), lambda c, n, p: 'cream' if (n.y < -0.35 and n.z < 0.2) else 'brown', 'head', seg=32, rings=18)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'pgt_eye_{nm}', head, HC + Vector((0, -0.03, 0.02)), (s * 0.7, -0.6, 0.18), (0.034, 0.016, 0.028), 'eye', 'head', sink=0.2, up=(s * -0.25, 0, 1))
    decal(f'pgt_shine_{nm}', e, loc + Vector((0, -0.004, 0.009)), n, (0.009, 0.004, 0.009), 'white', 'head', sink=0.05, seg=10, rings=6)
    pts = []
    for k in range(8):
        t = k / 7; d = Vector((s * 0.85, -0.25 + 1.0 * t, 0.12 - 0.05 * t)).normalized(); l, nn = shoot(head, HC, d); pts.append(l + nn * 0.002)
    tube(f'pgt_mark_{nm}', pts, [0.01 + 0.008 * math.sin(math.pi * k / 7) for k in range(8)], 'eye', 'head', seg=6)
beak = cone('pgt_beak', 0.035, 0.003, 0.09, verts=12, loc=HC + Vector((0, -0.17, -0.02))); beak.rotation_euler = (math.radians(100), 0, 0)
colorize(beak, lambda c, n, p: 'beak' if n.z > -0.2 else 'beak_dk'); reg(beak, 'head')
# crest plume: long feathers from the forehead sweeping back — red front strands, yellow behind
for k, (x, col, L, lift) in enumerate(((0.0, 'red', 0.42, 0.14), (0.03, 'red', 0.36, 0.1), (-0.03, 'red', 0.36, 0.1), (0.015, 'yellow', 0.3, 0.06), (-0.015, 'yellow', 0.3, 0.06))):
    b0 = HC + Vector((x, -0.08, 0.1)); pts = [b0 + Vector((x * 0.6 * t, L * t, lift * math.sin(math.pi * t * 0.8) + 0.05 * t)) for t in [j / 7 for j in range(8)]]
    tube(f'pgt_crest{k}', pts, [0.028 * (1 - 0.85 * j / 7) for j in range(8)], col, lambda c: lerp_w('head', 'extra_crest', (c.y - HC.y) / 0.25), seg=8, flat=0.5)
for side in 'lr':
    sg = 1 if side == 'l' else -1
    wing(side, (sg * 0.19, -0.06, 0.72), 0.5, 0.26, 'brown', n=6, tip_col='brown_dk', thick=0.03)
    bird_leg(side, (sg * 0.08, 0.05, 0.3), (sg * 0.09, 0.0, 0.03), 'feet', r=0.022, toe_len=0.07)
    for k in range(3):   # dark talons
        a = math.radians((k - 1) * 32); tip = Vector((sg * 0.09 + math.sin(a) * 0.08, -math.cos(a) * 0.08, 0.012))
        blob(f'pgt_talon{k}_{side}', tip, (0.012, 0.02, 0.01), 'claw', f'foot_{side}', seg=8, rings=6)
# long tail: alternating red and cream feathers
for k, a in enumerate((-24, -12, 0, 12, 24)):
    d = Vector((math.sin(math.radians(a)) * 0.45, 1, -0.4)).normalized(); c = Vector((0, 0.24, 0.36)) + d * 0.2
    o = blob(f'pgt_tail{k}', c, (0.075, 0.26, 0.016), 'red' if k % 2 == 0 else 'cream', lambda c_: lerp_w('tail1', 'tail2', (c_.y - 0.24) / 0.25), seg=14, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.05, 0.4), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, -0.02, 0.72), 'spine'), ('neck', (0, -0.06, 0.8), 'chest'), ('head', tuple(HC), 'neck'),
         ('extra_crest', tuple(HC + Vector((0, 0.05, 0.12))), 'head'), ('tail1', (0, 0.22, 0.38), 'hips'), ('tail2', (0, 0.42, 0.26), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.19, -0.05, 0.72), 'chest'), (f'wing2_{nm}', (s * 0.2, 0.18, 0.55), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.08, 0.05, 0.3), 'hips'), (f'foot_{nm}', (s * 0.09, 0.0, 0.03), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.24, 0))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.26, 0))), 'head')])
plan_clips(rig, 'bird', size=1.1, over={'idle': {'extra_crest': swing(6, 60, 0.2, 4)}, 'fly': {'extra_crest': swing(10, 20, 0.3, 4)}})
sheet('check', 1.15, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('attack_special', 8, 'q34'), ('attack_physical', 15, 'side')])
export(17, 'pidgeotto', 1.1, 'bird', rig, mesh, shiny={'brown': '#c6a04c', 'brown_dk': '#9b7a30', 'red': '#e6863a', 'yellow': '#f7de6a'})

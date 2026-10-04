# Hoothoot (163) · normal/flying · 0.7 m. Round brown owl: cream facial disk, huge red eyes ringed like a clock face, black horn-like ear tufts, small beak, stubby wings, orange legs.
reset('163_hoothoot')
M = pal([('brown', '#9a6a3c'), ('brown_dk', '#6e4a28'), ('cream', '#f1ddb0'), ('ring', '#1e1814'), ('iris', '#d03038'), ('pupil', '#1a1418'), ('white', '#ffffff'), ('beak', '#e89aa0'), ('feet', '#e89aa0'), ('tuft', '#24201c')])
BC = Vector((0, 0.0, 0.3)); HC = Vector((0, -0.01, 0.36))
body = blob('hoo_body', BC, (0.205, 0.205, 0.21), lambda c, n, p: 'cream' if (n.y < -0.3 and c.z < 0.27) else 'brown', lambda c: lerp_w('chest', 'head', (c.z - 0.3) / 0.1), seg=40, rings=22,
            fn=lambda v: Vector((v.x * (1 + 0.06 * -v.z), v.y, v.z)))
disk = decal('hoo_disk', body, HC, (0, -1, 0.15), (0.17, 0.03, 0.12), 'brown', 'head', sink=0.6)[0]
for s, nm in ((1, 'l'), (-1, 'r')):
    r, l, n = decal(f'hoo_ring_{nm}', disk, HC + Vector((0, 0, 0.01)), (s * 0.4, -1, 0.12), (0.085, 0.014, 0.085), 'ring', 'head', sink=0.2, seg=24)
    ir, l2, n2 = decal(f'hoo_iris_{nm}', r, l, n, (0.068, 0.008, 0.068), 'iris', 'head', sink=0.05, seg=24)
    pu, l3, n3 = decal(f'hoo_pupil_{nm}', ir, l2, n2, (0.026, 0.006, 0.026), 'pupil', 'head', sink=0.05, seg=16)
    decal(f'hoo_shine_{nm}', pu, l3 + Vector((s * 0.006, 0, 0.012)), n3, (0.009, 0.004, 0.009), 'white', 'head', sink=0.0, seg=10, rings=6)
    # ear tufts: black curved horns
    b0 = Vector((s * 0.09, -0.02, 0.47))
    tube(f'hoo_tuft_{nm}', [b0, b0 + Vector((s * 0.04, -0.005, 0.035)), b0 + Vector((s * 0.09, 0.0, 0.07)), b0 + Vector((s * 0.15, 0.01, 0.09))], [0.03, 0.04, 0.03, 0.003], 'tuft', 'head', seg=10)
    tip = b0 + Vector((s * 0.15, 0.01, 0.09)); dd = Vector((s * 0.8, 0, 0.6)).normalized()
    ah = cone(f'hoo_arrow_{nm}', 0.045, 0.002, 0.07, verts=4, loc=tip + dd * 0.02)
    ah.scale = (1, 0.3, 1); ah.rotation_mode = 'QUATERNION'; ah.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(dd)
    colorize(ah, 'tuft'); reg(ah, 'head')
    wing(nm, (s * 0.19, -0.02, 0.32), 0.21, 0.1, 'brown', n=5, tip_col='brown_dk')
    bird_leg(nm, (s * 0.09, 0.0, 0.11), (s * 0.12, -0.01, 0.02), 'feet', r=0.016, toe_len=0.055)
beak = cone('hoo_beak', 0.02, 0.002, 0.04, verts=12, loc=HC + Vector((0, -0.17, -0.035))); beak.rotation_euler = (math.radians(150), 0, 0)
colorize(beak, 'beak'); reg(beak, 'head')
for k, a in enumerate((-25, 0, 25)):   # short tail fan
    d = Vector((math.sin(math.radians(a)) * 0.5, 1, -0.4)).normalized(); c = Vector((0, 0.15, 0.14)) + d * 0.04
    o = blob(f'hoo_tail{k}', c, (0.025, 0.05, 0.008), 'brown_dk', 'tail1', seg=12, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.0, 0.14), 'root'), ('spine', (0, 0, 0.24), 'hips'), ('chest', (0, 0, 0.3), 'spine'), ('neck', (0, 0, 0.36), 'chest'), ('head', (0, -0.01, 0.4), 'neck'),
         ('tail1', (0, 0.15, 0.14), 'hips'), ('tail2', (0, 0.2, 0.12), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.17, -0.02, 0.32), 'chest'), (f'wing2_{nm}', (s * 0.18, 0.06, 0.26), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.09, 0.0, 0.11), 'hips'), (f'foot_{nm}', (s * 0.12, -0.01, 0.02), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.2, -0.04))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.21, 0.02))), 'head')])
plan_clips(rig, 'bird', size=0.7, over={'idle_alt': (90, {'head': [(0, {}), (15, {'r': (0, 0, 25)}), (30, {'r': (0, 0, 25)}), (45, {'r': (0, 0, -25)}), (60, {'r': (0, 0, -25)}), (75, {}), (90, {})]}, True, None)})   # head tilt
sheet('check', 0.75, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('idle_alt', 20, 'front'), ('attack_special', 8, 'q34')])
export(163, 'hoothoot', 0.7, 'bird', rig, mesh, shiny={'brown': '#c99a5c', 'brown_dk': '#9a7238'})

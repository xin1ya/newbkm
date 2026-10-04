# Pidgey (16) · normal/flying · 0.3 m. Plump brown bird, cream face & belly, black eye stripes, small crest tuft, pink beak & feet, fanned tail.
reset('016_pidgey')
M = pal([('brown', '#a8753f'), ('brown_dk', '#7c5429'), ('cream', '#f3e2b5'), ('eye', '#1a1418'), ('white', '#ffffff'), ('beak', '#cf9b8a'), ('beak_dk', '#9c6c5e'),
         ('feet', '#e5a39a'), ('tip', '#4a3222')])
BC = Vector((0, 0.01, 0.15)); HC = Vector((0, -0.045, 0.235))
body = blob('pid_body', BC, (0.1, 0.115, 0.105), lambda c, n, p: 'cream' if (n.y < -0.4 and c.z < 0.2) else 'brown', lambda c: lerp_w('spine', 'chest', (c.z - 0.12) / 0.08), seg=32, rings=18,
            fn=lambda v: Vector((v.x, v.y + 0.12 * max(0, v.z) * 0, v.z * (1 + 0.1 * v.y))))
head = blob('pid_head', HC, (0.078, 0.075, 0.072), lambda c, n, p: 'cream' if (n.y < -0.35 and n.z < 0.35) else 'brown', 'head', seg=32, rings=18)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'pid_eye_{nm}', head, HC + Vector((0, -0.01, 0.01)), (s * 0.75, -0.55, 0.2), (0.019, 0.01, 0.022), 'eye', 'head', sink=0.2)
    decal(f'pid_shine_{nm}', e, loc + Vector((0, -0.003, 0.007)), n, (0.006, 0.003, 0.006), 'white', 'head', sink=0.05, seg=10, rings=6)
    # black marking sweeping back from the eye
    pts = []
    for k in range(7):
        t = k / 6; d = Vector((s * 0.85, -0.2 + 0.9 * t, 0.18 - 0.1 * t)).normalized(); l, nn = shoot(head, HC, d); pts.append(l + nn * 0.001)
    tube(f'pid_mark_{nm}', pts, [0.006 + 0.004 * math.sin(math.pi * k / 6) for k in range(7)], 'eye', 'head', seg=6)
beak = cone('pid_beak', 0.018, 0.002, 0.04, verts=12, loc=HC + Vector((0, -0.085, -0.005))); beak.rotation_euler = (math.radians(95), 0, 0)
colorize(beak, lambda c, n, p: 'beak' if n.z > -0.2 else 'beak_dk'); reg(beak, 'head')
# crest: two short tufts curling back
for k, (x, h) in enumerate(((0.012, 0.05), (-0.012, 0.04))):
    b0 = HC + Vector((x, -0.04, 0.06))
    tube(f'pid_crest{k}', [b0, b0 + Vector((0, 0.01, h * 0.6)), b0 + Vector((0, 0.035, h))], [0.012, 0.008, 0.002], 'brown', 'head', seg=8)
for side in 'lr':
    sg = 1 if side == 'l' else -1
    wing(side, (sg * 0.088, -0.035, 0.205), 0.14, 0.085, 'brown', n=5, tip_col='brown_dk')
    bird_leg(side, (sg * 0.04, 0.02, 0.07), (sg * 0.045, 0.0, 0.018), 'feet', r=0.009, toe_len=0.025)
# tail fan
for k, a in enumerate((-22, 0, 22)):
    d = Vector((math.sin(math.radians(a)) * 0.5, 1, -0.25)).normalized(); c = Vector((0, 0.12, 0.12)) + d * 0.055
    o = blob(f'pid_tail{k}', c, (0.022, 0.06, 0.006), lambda c_, n, p: 'tip' if c_.y > 0.18 else 'brown', lambda c_: lerp_w('tail1', 'tail2', (c_.y - 0.12) / 0.07), seg=14, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.02, 0.1), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, -0.02, 0.2), 'spine'), ('neck', (0, -0.035, 0.215), 'chest'), ('head', tuple(HC), 'neck'),
         ('tail1', (0, 0.1, 0.13), 'hips'), ('tail2', (0, 0.16, 0.115), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.088, -0.03, 0.205), 'chest'), (f'wing2_{nm}', (s * 0.09, 0.05, 0.16), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.04, 0.02, 0.07), 'hips'), (f'foot_{nm}', (s * 0.045, 0.0, 0.018), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.11, 0))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.12, 0))), 'head')])
plan_clips(rig, 'bird', size=0.3)
sheet('check', 0.32, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('attack_special', 8, 'q34'), ('fly', 13, 'q34')])
export(16, 'pidgey', 0.3, 'bird', rig, mesh, shiny={'brown': '#c9a24a', 'brown_dk': '#9c7b2f', 'tip': '#6b5020'})

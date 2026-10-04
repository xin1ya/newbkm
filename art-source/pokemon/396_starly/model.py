# Starly (396) · normal/flying · 0.3 m. Plump grey-black starling: white face mask ringing the eyes, speckled pale belly, short orange beak and feet,
# a forward-curling crest tuft, long dark wings, white-tipped tail.
reset('396_starly')
M = pal([('brown', '#5a5a60'), ('brown_dk', '#36363c'), ('cream', '#d8d8dc'), ('eye', '#1a1418'), ('white', '#ffffff'), ('beak', '#f08a2a'), ('beak_dk', '#c86818'),
         ('feet', '#f0902a'), ('tip', '#e8e8ec'), ('mask', '#f4f4f6')])
BC = Vector((0, 0.01, 0.15)); HC = Vector((0, -0.045, 0.235))
body = blob('sta_body', BC, (0.1, 0.115, 0.105), lambda c, n, p: ('white' if math.sin(c.x * 140) * math.sin(c.z * 160) > 0.55 else 'cream') if (n.y < -0.4 and c.z < 0.2) else 'brown', lambda c: lerp_w('spine', 'chest', (c.z - 0.12) / 0.08), seg=32, rings=18,
            fn=lambda v: Vector((v.x, v.y + 0.12 * max(0, v.z) * 0, v.z * (1 + 0.1 * v.y))))
head = blob('sta_head', HC, (0.078, 0.075, 0.072), 'brown', 'head', seg=32, rings=18)
for s, nm in ((1, 'l'), (-1, 'r')):
    mk, ml, mn = decal(f'sta_mask_{nm}', head, HC + Vector((0, -0.01, 0.01)), (s * 0.7, -0.6, 0.15), (0.032, 0.012, 0.034), 'mask', 'head', sink=0.4)
    e, loc, n = decal(f'sta_eye_{nm}', mk, HC + Vector((0, -0.01, 0.01)), (s * 0.7, -0.6, 0.15), (0.016, 0.008, 0.019), 'eye', 'head', sink=0.2)
    decal(f'sta_shine_{nm}', e, loc + Vector((0, -0.003, 0.007)), n, (0.006, 0.003, 0.006), 'white', 'head', sink=0.05, seg=10, rings=6)
beak = cone('sta_beak', 0.016, 0.002, 0.034, verts=12, loc=HC + Vector((0, -0.085, -0.005))); beak.rotation_euler = (math.radians(95), 0, 0)
colorize(beak, lambda c, n, p: 'beak' if n.z > -0.2 else 'beak_dk'); reg(beak, 'head')
# crest: one tuft rising and curling forward
b0 = HC + Vector((0, -0.01, 0.065))
tube('sta_crest', [b0, b0 + Vector((0, 0.005, 0.035)), b0 + Vector((0, -0.015, 0.055)), b0 + Vector((0, -0.03, 0.05))], [0.012, 0.009, 0.006, 0.002], 'brown_dk', 'head', seg=8)
for side in 'lr':
    sg = 1 if side == 'l' else -1
    wing(side, (sg * 0.09, -0.035, 0.205), 0.19, 0.09, 'brown', n=6, tip_col='brown_dk')
    bird_leg(side, (sg * 0.04, 0.02, 0.07), (sg * 0.045, 0.0, 0.018), 'feet', r=0.009, toe_len=0.025)
# tail fan
for k, a in enumerate((-22, 0, 22)):
    d = Vector((math.sin(math.radians(a)) * 0.5, 1, -0.25)).normalized(); c = Vector((0, 0.12, 0.12)) + d * 0.055
    o = blob(f'sta_tail{k}', c, (0.024, 0.08, 0.006), lambda c_, n, p: 'tip' if c_.y > 0.2 else 'brown_dk', lambda c_: lerp_w('tail1', 'tail2', (c_.y - 0.12) / 0.07), seg=14, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.02, 0.1), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, -0.02, 0.2), 'spine'), ('neck', (0, -0.035, 0.215), 'chest'), ('head', tuple(HC), 'neck'),
         ('tail1', (0, 0.1, 0.13), 'hips'), ('tail2', (0, 0.16, 0.115), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.088, -0.03, 0.205), 'chest'), (f'wing2_{nm}', (s * 0.09, 0.05, 0.16), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.04, 0.02, 0.07), 'hips'), (f'foot_{nm}', (s * 0.045, 0.0, 0.018), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.11, 0))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.12, 0))), 'head')])
plan_clips(rig, 'bird', size=0.3)
sheet('check', 0.32, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('attack_special', 8, 'q34'), ('fly', 13, 'q34')])
export(396, 'starly', 0.3, 'bird', rig, mesh, shiny={'brown': '#6a5a48', 'brown_dk': '#463a2c'})

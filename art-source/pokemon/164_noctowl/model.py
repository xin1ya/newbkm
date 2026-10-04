# Noctowl (164) · normal/flying · 1.6 m. Evolution of Hoothoot — geometry matched to the reference (art-source/reference, comparison only):
# tall upright owl: brown egg body with a lighter chest panel patterned with dark triangles, round head with a pale-cream crest that rises
# from the brow into three upward horn-like plumes (the "eyebrows"), red eyes in cream rings, small hooked beak, long folded wings with
# dark flight feathers, long pointed tail feathers, pale yellow feet. (Reference is in a wings-spread bind pose; ours rests folded.)
reset('164_noctowl')
M = pal([('brown', '#6e4a30'), ('brown_dk', '#46301e'), ('chest', '#b08458'), ('tri', '#2e2018'), ('crest', '#d8cc98'), ('ring', '#e8dcb0'), ('iris', '#c8303a'),
         ('pupil', '#1a1418'), ('white', '#ffffff'), ('beak', '#c8b890'), ('feet', '#d8c890'), ('talon', '#3a3028')])
BC = Vector((0, 0.0, 0.62)); HC = Vector((0, -0.02, 1.18))
body = blob('noc_body', BC, (0.33, 0.3, 0.46), lambda c, n, p: 'chest' if (n.y < -0.55 and c.z < 0.95 and c.z > 0.3) else 'brown',
            lambda c: lerp_w('spine', 'chest', (c.z - 0.5) / 0.4), seg=40, rings=26, fn=lambda v: Vector((v.x * (1 - 0.18 * max(0, v.z)), v.y * (1 - 0.1 * max(0, v.z)), v.z)))
# triangle pattern on the chest panel (3 rows)
for r, (z, xs) in enumerate(((0.82, (-0.08, 0.0, 0.08)), (0.66, (-0.12, -0.04, 0.04, 0.12)), (0.5, (-0.08, 0.0, 0.08)))):
    for k, x in enumerate(xs):
        o = cone(f'noc_tri{r}_{k}', 0.07, 0.0, 0.012, verts=3, loc=Vector((0, 0, 0)))
        l, nn = shoot(body, Vector((x, 0, z)), Vector((0, -1, 0)), fallback=True)
        o.rotation_mode = 'QUATERNION'
        q1 = Vector((0, 0, 1)).rotation_difference(nn)          # face outward
        o.rotation_quaternion = q1 @ __import__('mathutils').Quaternion((0, 0, 1), math.radians(180))
        o.location = l + nn * 0.004
        colorize(o, 'tri'); reg(o, 'chest')
head = blob('noc_head', HC, (0.25, 0.23, 0.21), lambda c, n, p: 'brown', 'head', seg=36, rings=22)
# facial disk + eyes
for s, nm in ((1, 'l'), (-1, 'r')):
    rg, l, n = decal(f'noc_ring_{nm}', head, HC + Vector((0, 0, 0.0)), (s * 0.4, -1, 0.05), (0.07, 0.012, 0.06), 'ring', 'head', sink=0.25, seg=20)
    ir, l2, n2 = decal(f'noc_iris_{nm}', rg, l, n, (0.045, 0.008, 0.04), 'iris', 'head', sink=0.05, seg=18)
    pu, l3, n3 = decal(f'noc_pupil_{nm}', ir, l2, n2, (0.018, 0.005, 0.02), 'pupil', 'head', sink=0.05, seg=12)
    decal(f'noc_shine_{nm}', pu, l3 + Vector((s * 0.005, 0, 0.01)), n3, (0.007, 0.003, 0.007), 'white', 'head', sink=0.0, seg=8, rings=5)
    # crest brow: a cream band over each eye sweeping up into plumes
    b0 = HC + Vector((s * 0.03, -0.2, 0.07))
    tube(f'noc_brow_{nm}', [b0, b0 + Vector((s * 0.08, 0.02, 0.03)), b0 + Vector((s * 0.15, 0.06, 0.08)), b0 + Vector((s * 0.2, 0.1, 0.3))],
         [0.03, 0.04, 0.05, 0.006], 'crest', 'head', seg=10, flat=0.5)
    pl = HC + Vector((s * 0.15, -0.02, 0.12))
    tube(f'noc_plume_{nm}', [pl, pl + Vector((s * 0.04, 0.0, 0.14)), pl + Vector((s * 0.06, 0.02, 0.3))], [0.06, 0.05, 0.005], 'crest', 'head', seg=8, flat=0.45)
    wing(nm, (s * 0.3, -0.02, 0.92), 0.62, 0.28, 'brown', n=6, back_dir=(0, 0.45, -1), tip_col='brown_dk')
    bird_leg(nm, (s * 0.1, 0.0, 0.2), (s * 0.12, -0.02, 0.04), 'feet', r=0.03, toe_len=0.1)
tube('noc_plume_c', [HC + Vector((0, -0.12, 0.13)), HC + Vector((0, -0.1, 0.26)), HC + Vector((0, -0.08, 0.38))], [0.03, 0.024, 0.003], 'crest', 'head', seg=8, flat=0.45)
beak = cone('noc_beak', 0.03, 0.003, 0.07, verts=12, loc=HC + Vector((0, -0.23, -0.04))); beak.rotation_euler = (math.radians(150), 0, 0)
colorize(beak, 'beak'); reg(beak, 'head')
for k, a in enumerate((-20, -7, 7, 20)):   # long tail feathers
    d = Vector((math.sin(math.radians(a)) * 0.35, 0.75, -0.65)).normalized(); c = Vector((0, 0.22, 0.32)) + d * 0.12
    o = blob(f'noc_tail{k}', c, (0.06, 0.15, 0.014), 'brown_dk', 'tail1', seg=12, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.0, 0.3), 'root'), ('spine', (0, 0, 0.55), 'hips'), ('chest', (0, 0, 0.85), 'spine'), ('neck', (0, 0, 1.02), 'chest'), ('head', tuple(HC), 'neck'),
         ('tail1', (0, 0.2, 0.3), 'hips'), ('tail2', (0, 0.4, 0.1), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.22, -0.02, 0.92), 'chest'), (f'wing2_{nm}', (s * 0.25, 0.25, 0.6), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.1, 0.0, 0.2), 'hips'), (f'foot_{nm}', (s * 0.12, -0.02, 0.04), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.24, -0.05))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.25, 0.02))), 'head')])
plan_clips(rig, 'bird', size=1.6, over={'idle_alt': (90, {'head': [(0, {}), (20, {'r': (0, 0, 90)}), (40, {'r': (0, 0, 90)}), (60, {'r': (0, 0, -60)}), (75, {}), (90, {})]}, True, None)})   # owl head swivel
sheet('check', 1.7, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('idle_alt', 30, 'q34'), ('attack_special', 8, 'q34')])
export(164, 'noctowl', 1.6, 'bird', rig, mesh, shiny={'brown': '#9a7a4a', 'brown_dk': '#6e5430', 'chest': '#c8a070'})

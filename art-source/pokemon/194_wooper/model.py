# Wooper (194) · water/ground · 0.4 m. Big round blue head fused to a small body, wide blank smile, tiny eyes,
# three-pronged purple gills on each side of the head, dark-blue belly stripes, stubby legs, thick paddle tail.
reset('194_wooper')
M = pal([('blue', '#5aa8d8'), ('blue_lt', '#7cc0e8'), ('blue_dk', '#3a7ab0'), ('stripe', '#2c5a8c'), ('gill', '#a87ac8'), ('gill_dk', '#7c58a0'),
         ('eye', '#1a1418'), ('white', '#ffffff'), ('mouth', '#1e3c5c')])
HC = Vector((0, -0.01, 0.27)); BC = Vector((0, 0.01, 0.11))
head = blob('woo_head', HC, (0.15, 0.13, 0.12), lambda c, n, p: 'blue_lt' if n.z > 0.7 else 'blue', 'head', seg=40, rings=22)
body = blob('woo_body', BC, (0.085, 0.08, 0.09), 'blue', lambda c: lerp_w('hips', 'spine', (c.z - 0.06) / 0.08), seg=32, rings=16)
for k, z in enumerate((0.07, 0.1, 0.13)):
    pts = []
    for i in range(7):
        a = math.radians(-60 + 120 * i / 6)
        l, nn = shoot(body, Vector((0, BC.y, z)), Vector((math.sin(a), -math.cos(a), 0)), fallback=True); pts.append(l + nn * 0.001)
    tube(f'woo_stripe{k}', pts, 0.006, 'stripe', 'spine', seg=6, flat=0.4)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'woo_eye_{nm}', head, HC + Vector((0, 0, 0.03)), (s * 0.4, -1, 0.25), (0.012, 0.006, 0.014), 'eye', 'head', sink=0.2, seg=12, rings=6)
# wide smile curving across the lower face
pts = []
for i in range(11):
    a = math.radians(-55 + 110 * i / 10)
    d = Vector((math.sin(a), -math.cos(a), -0.15 + 0.12 * (a / math.radians(55)) ** 2)).normalized()
    l, nn = shoot(head, HC, d); pts.append(l + nn * 0.001)
tube('woo_mouth', pts, 0.004, 'mouth', 'head', seg=6)
# gills: a stalk with three prongs fanning outward on each side
GILL = []
for s, nm in ((1, 'l'), (-1, 'r')):
    b0 = HC + Vector((s * 0.14, 0.0, 0.02)); bn = f'extra_gill_{nm}'; GILL.append((bn, b0))
    tip = b0 + Vector((s * 0.07, 0, 0))
    tube(f'woo_gstalk_{nm}', [b0, tip], [0.012, 0.01], 'gill', bn, seg=8)
    for k, a in enumerate((-40, 0, 40)):
        d = Vector((s * math.cos(math.radians(a)), 0, math.sin(math.radians(a))))
        tube(f'woo_gill{k}_{nm}', [tip - Vector((s * 0.03, 0, 0)) + d * 0.01, tip + d * 0.045], [0.009, 0.003], 'gill_dk' if k == 1 else 'gill', bn, seg=8)
# stubby legs and feet
for s, nm in ((1, 'l'), (-1, 'r')):
    hp = Vector((s * 0.045, 0.0, 0.06)); ft = Vector((s * 0.05, -0.01, 0.015))
    tube(f'woo_leg_{nm}', [hp, ft], [0.03, 0.026], 'blue', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.06 - c.z) / 0.04), seg=10)
    blob(f'woo_foot_{nm}', ft + Vector((0, -0.015, -0.002)), (0.03, 0.04, 0.016), 'blue_dk', f'foot_{nm}', seg=14, rings=8)
# thick paddle tail
TP = [BC + Vector((0, 0.07, -0.04)), BC + Vector((0, 0.14, -0.06)), BC + Vector((0, 0.2, -0.04)), BC + Vector((0, 0.23, 0.0))]
tube('woo_tail', TP, [0.04, 0.045, 0.04, 0.02], lambda c, n, p: 'blue_lt' if n.z > 0.5 else 'blue', lambda c: seg_w(c, ['hips', 'tail1', 'tail2']), seg=12, flat=0.6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.01, 0.07), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(HC - Vector((0, 0, 0.08))), 'spine'),
         ('tail1', tuple(TP[0]), 'hips'), ('tail2', tuple(TP[2]), 'tail1')]
bones += [(bn, tuple(p), 'head') for bn, p in GILL]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'thigh_{nm}', (s * 0.045, 0, 0.06), 'hips'), (f'foot_{nm}', (s * 0.05, -0.01, 0.02), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.14, -0.02))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.16, 0))), 'head')])
gills = lambda L, a: {bn: swing(a, L, 0.1 * i, 4, 1) for i, (bn, _) in enumerate(GILL)}
plan_clips(rig, 'biped', size=0.4, over={'idle': gills(60, 8), 'walk': gills(26, 12), 'run': gills(16, 16)})
sheet('check', 0.42, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_physical', 14, 'q34'), ('idle', 20, 'front')])
export(194, 'wooper', 0.4, 'biped', rig, mesh, shiny={'blue': '#e89ac0', 'blue_lt': '#f4b8d4', 'blue_dk': '#c87aa0', 'gill': '#6a9ad8'})

# Surskit (283) · bug/water · 0.5 m. Pond skater: round pale-blue body, a yellow cap with a long knobbed antenna-spike on top,
# small black eyes, pink cheek dots, four long thin legs arching out and down to yellow pads that rest on the water surface.
reset('283_surskit')
M = pal([('blue', '#7ab8e8'), ('blue_lt', '#a4d2f4'), ('blue_dk', '#4a88c0'), ('yellow', '#f4d84a'), ('yellow_dk', '#d8b42a'), ('eye', '#1a1418'),
         ('pink', '#f4a0b4'), ('leg', '#3a3a48'), ('white', '#ffffff')])
BC = Vector((0, 0, 0.24))
body = blob('sur_body', BC, (0.1, 0.095, 0.09), lambda c, n, p: 'blue_lt' if n.z < -0.4 else 'blue', lambda c: lerp_w('spine', 'head', (c.y * -1 + 0.02) / 0.08), seg=36, rings=20)
cap = blob('sur_cap', BC + Vector((0, 0.005, 0.055)), (0.085, 0.085, 0.045), 'yellow', 'head', seg=32, rings=14,
           fn=lambda v: Vector((v.x, v.y, max(v.z, -0.2))))
# antenna spike with a round knob
b0 = BC + Vector((0, 0.0, 0.09))
tube('sur_spike', [b0, b0 + Vector((0, -0.01, 0.06)), b0 + Vector((0, -0.03, 0.12))], [0.012, 0.007, 0.004], 'yellow_dk', 'extra_spike', seg=8)
blob('sur_knob', b0 + Vector((0, -0.033, 0.13)), (0.018, 0.018, 0.018), 'yellow', 'extra_spike', seg=12, rings=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'sur_eye_{nm}', body, BC + Vector((0, 0, 0.0)), (s * 0.35, -1, 0.05), (0.013, 0.006, 0.017), 'eye', 'head', sink=0.2, seg=12, rings=6)
    decal(f'sur_shine_{nm}', e, l + Vector((0, 0, 0.006)), n, (0.004, 0.002, 0.004), 'white', 'head', sink=-0.4, seg=8, rings=4)
    decal(f'sur_cheek_{nm}', body, BC, (s * 0.7, -0.7, -0.15), (0.014, 0.004, 0.01), 'pink', 'head', sink=0.3, seg=10, rings=6)
blob('sur_mouth', BC + Vector((0, -0.094, -0.03)), (0.006, 0.004, 0.003), 'blue_dk', 'head', seg=8, rings=5)
# four thin arched legs: front pair forward/out, rear pair back/out
LEGS = []
for s, sd in ((1, 'l'), (-1, 'r')):
    for fb, ang in (('f', -40), ('b', 40)):
        a = math.radians(ang); d = Vector((s * math.cos(a), math.sin(a), 0))
        p0 = BC + d * 0.07 + Vector((0, 0, -0.02)); knee = BC + d * 0.17 + Vector((0, 0, 0.06)); ft = Vector((0, 0, 0.012)) + d * 0.3
        mid = (knee + ft) / 2 + Vector((0, 0, 0.03))
        nm = f'{fb}{sd}'; LEGS.append((nm, p0, knee))
        tube(f'sur_leg_{nm}', [p0, knee, mid, ft], [0.009, 0.007, 0.005, 0.004], 'leg',
             lambda c, nm=nm, p0=p0: lerp_w(f'leg_{nm}', f'shin_{nm}', ((c - p0).length - 0.08) / 0.06), seg=8)
        blob(f'sur_pad_{nm}', ft, (0.022, 0.022, 0.006), 'yellow', f'shin_{nm}', seg=12, rings=6)
bones = [('root', (0, 0, 0), None), ('hips', tuple(BC - Vector((0, 0, 0.04))), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, -0.02, 0.02))), 'spine'),
         ('extra_spike', tuple(b0), 'head')]
for nm, p0, knee in LEGS: bones += [(f'leg_{nm}', tuple(p0), 'hips'), (f'shin_{nm}', tuple(knee), f'leg_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.1, -0.03))), 'head'), ('socket_fx', tuple(b0 + Vector((0, -0.033, 0.13))), 'extra_spike')])
glide = lambda L, a: {'root': [(0, {}), (L // 2, {'l': (0, -0.04, 0)}), (L, {})], 'extra_spike': swing(a, L, 0.2, 4),
                      **{f'leg_{nm}': swing(a * 0.6, L, 0.25 * i, 4, 2) for i, (nm, _, _) in enumerate(LEGS)}}
plan_clips(rig, 'quadruped', size=0.3, over={'idle': (60, {'spine': loop([(0, {}), (30, {'l': (0, 0, -0.006)})], 60), 'extra_spike': swing(6, 60, 0.2, 4)}, True, None),
                                              'walk': (24, glide(24, 10), True, None), 'run': (14, glide(14, 16), True, None)})
sheet('check', 0.4, poses=[('walk', 6, 'side'), ('run', 4, 'q34'), ('attack_physical', 14, 'q34'), ('idle', 20, 'front')])
export(283, 'surskit', 0.5, 'quadruped', rig, mesh, shiny={'blue': '#f4b8d0', 'blue_lt': '#f8d0e0', 'yellow': '#a8e070'})

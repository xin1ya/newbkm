# Oddish (43) · grass/poison · 0.5 m. Round blue bulb body, five long green leaves sprouting from the top, red eyes, two stubby feet.
reset('043_oddish')
M = pal([('blue', '#3f5ea8'), ('blue_dk', '#2c4380'), ('leaf', '#4caf50'), ('leaf_dk', '#2f7d34'), ('vein', '#86d17a'), ('eye', '#1a1418'), ('iris', '#d33a3a'), ('white', '#ffffff'),
         ('foot', '#3a5496'), ('mouth', '#2a2230')])
BC = Vector((0, 0, 0.14))
body = blob('odd_body', BC, (0.12, 0.11, 0.11), lambda c, n, p: 'blue_dk' if n.z < -0.6 else 'blue', lambda c: lerp_w('spine', 'head', (c.z - 0.1) / 0.1), seg=36, rings=20,
            fn=lambda v: Vector((v.x, v.y, v.z * (1 - 0.1 * max(0, v.z)))))
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'odd_eye_{nm}', body, BC + Vector((0, 0, 0.02)), (s * 0.4, -1, 0.15), (0.022, 0.01, 0.02), 'eye', 'head', sink=0.2)
    ir, l2, n2 = decal(f'odd_iris_{nm}', e, loc, n, (0.015, 0.006, 0.014), 'iris', 'head', sink=0.05, seg=12, rings=8)
    decal(f'odd_shine_{nm}', ir, l2 + Vector((0, 0, 0.006)), n2, (0.006, 0.003, 0.006), 'white', 'head', sink=0.05, seg=10, rings=6)
    blob(f'odd_foot_{nm}', (s * 0.055, -0.03, 0.02), (0.035, 0.045, 0.022), 'foot', f'foot_{nm}', seg=16, rings=10)
decal('odd_mouth', body, BC + Vector((0, 0, -0.03)), (0, -1, -0.05), (0.018, 0.006, 0.006), 'mouth', 'head', sink=0.3)
LEAF = []
for k in range(5):
    a = math.radians(90 + 72 * k); tilt = 40 if k else 20
    d = Vector((math.cos(a) * math.sin(math.radians(tilt)), -math.sin(a) * math.sin(math.radians(tilt)) * -1, math.cos(math.radians(tilt)))).normalized()
    b0 = BC + Vector((0, 0, 0.095)); L = 0.26
    pts = [b0 + d * L * t + Vector((0, 0, -0.06 * t * t)) * (1 if k else 0.3) for t in (0, 0.2, 0.45, 0.7, 0.9, 1.0)]
    bn = f'extra_leaf{k}'; LEAF.append((bn, b0 + d * 0.04))
    def lc(c, n_, p, b0=b0, d=d): return 'vein' if abs((c - b0).cross(d).length) < 0.006 else ('leaf' if n_.z > -0.2 else 'leaf_dk')
    tube(f'odd_leaf{k}', pts, [0.012, 0.04, 0.055, 0.05, 0.03, 0.004], lc, lambda c, bn=bn: lerp_w('head', bn, 0.9), seg=12, flat=0.18)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.06), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, 0, 0.05))), 'spine')]
bones += [(bn, tuple(p), 'head') for bn, p in LEAF]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'thigh_{nm}', (s * 0.055, -0.01, 0.06), 'hips'), (f'foot_{nm}', (s * 0.055, -0.03, 0.02), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.13, 0.11), 'head'), ('socket_fx', (0, -0.02, 0.4), 'head')])
def leaves(L, a, ph=0.0): return {bn: swing(a, L, ph + 0.13 * i, 4, 1 + (i % 2)) for i, (bn, _) in enumerate(LEAF)}
plan_clips(rig, 'biped', size=0.5, over={'idle': leaves(60, 6), 'walk': leaves(26, 10), 'run': leaves(16, 16), 'sleep': leaves(90, 3),
    'attack_special': merge(leaves(40, 18), {'spine': [(0, {}), (12, {'r': (0, 0, 0), 's': (1.08, 1.08, 0.9)}), (22, {'s': (0.95, 0.95, 1.08)}), (40, {})]})})   # Absorb/Poison Powder: leaves shake powder
sheet('check', 0.5, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('sleep', 0, 'q34')])
export(43, 'oddish', 0.5, 'biped', rig, mesh, shiny={'blue': '#5a7fc8', 'leaf': '#e8c24a', 'leaf_dk': '#b8922a', 'vein': '#f5dd7a'})

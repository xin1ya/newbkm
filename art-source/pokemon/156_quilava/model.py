# Quilava (156) · fire · 0.9 m. Long slim weasel: navy-blue back, cream underside, narrow red-lidded eyes, flame crest on the forehead and a flame collar at the rump.
reset('156_quilava')
M = pal([('navy', '#2e4a6b'), ('navy_dk', '#1f3350'), ('cream', '#f3e2a8'), ('eye', '#1a1418'), ('iris', '#c8323c'), ('white', '#ffffff'), ('nose', '#1a1418'),
         ('flame', '#ff7a1f'), ('flame_y', '#ffd23a'), ('flame_r', '#e0401f'), ('claw', '#f6f0e0')])
BC = Vector((0, 0.05, 0.3)); HC = Vector((0, -0.28, 0.42))
body = blob('qv_body', BC, (0.1, 0.3, 0.1), lambda c, n, p: 'cream' if n.z < -0.05 else 'navy', lambda c: seg_w(c, ['chest', 'spine', 'hips']), seg=36, rings=20,
            fn=lambda v: Vector((v.x * (1 - 0.15 * v.y), v.y, v.z * (1 - 0.1 * v.y))))
neck = blob('qv_neck', (0, -0.2, 0.37), (0.08, 0.09, 0.09), lambda c, n, p: 'cream' if n.z < -0.05 or n.y < -0.6 else 'navy', lambda c: lerp_w('chest', 'neck', 0.5), seg=24, rings=12)
head = blob('qv_head', HC, (0.085, 0.11, 0.075), lambda c, n, p: 'cream' if (n.z < -0.15 or (n.y < -0.75)) else 'navy', 'head', seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.35 * max(0, -v.y)), v.y * (1 + 0.3 * max(0, -v.y)), v.z * (1 - 0.3 * max(0, -v.y)))))
blob('qv_nose', HC + Vector((0, -0.14, 0.0)), (0.012, 0.01, 0.009), 'nose', 'head', seg=12, rings=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'qv_eye_{nm}', head, HC + Vector((0, -0.02, 0.015)), (s * 0.75, -0.6, 0.25), (0.024, 0.01, 0.012), 'eye', 'head', sink=0.2, up=(s * -0.3, 0, 1))
    decal(f'qv_iris_{nm}', e, loc, n, (0.012, 0.005, 0.009), 'iris', 'head', sink=0.05, seg=10, rings=6)
    blob(f'qv_ear_{nm}', HC + Vector((s * 0.05, 0.05, 0.06)), (0.022, 0.012, 0.018), 'navy_dk', 'head', seg=10, rings=6)
def flame(name, base, d, L, r, bone, n=6):
    d = Vector(d).normalized(); pts = [Vector(base) + d * L * t + Vector((0, 0.03 * t * t, 0)) for t in [j / (n - 1) for j in range(n)]]
    tube(name, pts, [r * (1 - 0.9 * j / (n - 1)) + 0.002 for j in range(n)], lambda c, n_, p, b=Vector(base): 'flame_y' if (c - b).length < L * 0.3 else ('flame' if (c - b).length < L * 0.7 else 'flame_r'), bone, seg=8)
for k, (x, ang, L) in enumerate(((0, 0, 0.14), (0.03, 25, 0.11), (-0.03, -25, 0.11), (0.05, 45, 0.08), (-0.05, -45, 0.08))):   # forehead crest
    flame(f'qv_fh{k}', HC + Vector((x, -0.03, 0.06)), (math.sin(math.radians(ang)) * 0.6, 0.35, 1), L, 0.022, 'extra_fh')
for k in range(7):   # rump flame collar
    a = math.radians(-90 + 180 * k / 6); b = Vector((math.sin(a) * 0.08, 0.26, 0.33 + math.cos(a) * 0.03 + 0.05))
    flame(f'qv_rf{k}', b, (math.sin(a) * 0.7, 0.4, 1 - 0.3 * abs(math.sin(a))), 0.12 + 0.04 * math.cos(a), 0.026, 'extra_rf')
tube('qv_tail', [(0, 0.33, 0.3), (0, 0.4, 0.26), (0, 0.46, 0.24)], [0.035, 0.025, 0.006], 'navy', lambda c: seg_w(c, ['hips', 'tail1', 'tail2']), seg=10)
LEGS = {'arm_l': ((0.06, -0.15, 0.27), (0.06, -0.17, 0.0)), 'arm_r': ((-0.06, -0.15, 0.27), (-0.06, -0.17, 0.0)),
        'thigh_l': ((0.07, 0.22, 0.26), (0.07, 0.22, 0.0)), 'thigh_r': ((-0.07, 0.22, 0.26), (-0.07, 0.22, 0.0))}
for nm, (sh, pw) in LEGS.items():
    leg4(nm[-1], nm.startswith('arm'), sh, pw, 0.05 if nm.startswith('thigh') else 0.04, 0.028, lambda c, n, p: 'cream', paw_col='cream', toes=3, toe_col='claw')
bones = quad_bones((0, 0.22, 0.3), (0, -0.12, 0.32), (0, -0.2, 0.37), HC, LEGS, tail=[(0, 0.37, 0.28), (0, 0.43, 0.25)],
                   extra=[('extra_fh', HC + Vector((0, -0.02, 0.1)), 'head'), ('extra_rf', (0, 0.26, 0.42), 'hips')])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.16, -0.02))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.18, 0.02))), 'head'), ('socket_back', (0, 0.26, 0.48), 'hips')])
FL = lambda L, a: {'extra_fh': loop([(0, {'s': (1, 1, 1)}), (L // 4, {'s': (1.08, 1.08, 1.15)}), (L // 2, {'s': (0.95, 0.95, 0.92)}), (3 * L // 4, {'s': (1.05, 1.05, 1.1)})], L),
                   'extra_rf': loop([(0, {'s': (1.05, 1.05, 1.1)}), (L // 4, {'s': (0.95, 0.95, 0.9)}), (L // 2, {'s': (1.1, 1.1, 1.18)}), (3 * L // 4, {'s': (1, 1, 1)})], L)}
plan_clips(rig, 'quadruped', size=0.9, over={'idle': FL(20, 1), 'walk': FL(16, 1), 'run': FL(8, 1),
    'attack_special': merge(FL(10, 1), {'extra_rf': [(0, {}), (12, {'s': (1.5, 1.5, 1.8)}), (26, {'s': (1.3, 1.3, 1.5)}), (40, {})]}),   # Ember: flames flare up
    'sleep': {'extra_fh': hold({'s': (0.2, 0.2, 0.2)}, 90), 'extra_rf': hold({'s': (0.2, 0.2, 0.2)}, 90)}})   # flames die down while asleep
sheet('check', 0.9, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_special', 14, 'q34'), ('sleep', 0, 'q34')])
export(156, 'quilava', 0.9, 'quadruped', rig, mesh, shiny={'navy': '#6b5a3a', 'navy_dk': '#4a3e28', 'flame': '#ff5a3a', 'flame_r': '#c8201f'}, fit='length')

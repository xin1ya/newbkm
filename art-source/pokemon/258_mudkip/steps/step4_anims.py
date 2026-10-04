# Mudkip step 4: clips (uniform bone axes: r=(pitch,yaw,roll) deg, l=(x,up,forward))
sc = bpy.context.scene; sc.render.fps = 30
rig = bpy.data.objects['mud_rig']
for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'
ad = rig.animation_data_create()
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
R = math.radians; HIT = {}
def clip(name, length, keys, cyclic=True, hit=None):
    a = bpy.data.actions.get(name)
    if a: bpy.data.actions.remove(a)
    act = bpy.data.actions.new(name); ad.action = act
    for pb in rig.pose.bones: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    for pb in rig.pose.bones:
        if pb.name in keys: continue
        for f in (0, length):
            for path in ('rotation_euler', 'location', 'scale'): pb.keyframe_insert(path, frame=f)
    for bn, ks in keys.items():
        pb = rig.pose.bones[bn]
        for f, v in ks:
            pb.rotation_euler = [R(x) for x in v.get('r', (0, 0, 0))]
            pb.location = v.get('l', (0, 0, 0)); pb.scale = v.get('s', (1, 1, 1))
            for path in ('rotation_euler', 'location', 'scale'): pb.keyframe_insert(path, frame=f)
    act.use_frame_range = True; act.frame_start = 0; act.frame_end = length; act.use_cyclic = cyclic
    if hit is not None: act['hitTime'] = hit / 30.0; HIT[name] = hit / 30.0
    tr = ad.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 0, act); st.name = name
    ad.action = None
def loop(kv, length): return kv + [(length, kv[0][1])]
def swing(amp, length, phase=0.0, n=8, axis=0, bias=0.0):
    out = []
    for i in range(n):
        f = round(length * i / n); a = bias + amp * math.sin(2 * math.pi * (i / n + phase))
        r = [0, 0, 0]; r[axis] = a; out.append((f, {'r': tuple(r)}))
    return loop(out, length)
FL = lambda s: {'s': (s, s, s)}
flick = lambda length, base=1.0: loop([(0, {'s': (base, base, base)}), (length // 4, {'s': (base * 0.92, base * 1.15, base * 0.92)}),
                                       (length // 2, {'s': (base * 1.05, base * 0.95, base * 1.05)}), (3 * length // 4, {'s': (base * 0.95, base * 1.12, base * 0.95)})], length)

BL = lambda f0: [(f0, {}), (f0 + 3, {'s': (1, 0.1, 1)}), (f0 + 6, {})]   # blink (eye bones point up: local Y = up)
def eyes(fr, length): k = [(0, {})] + sum([BL(f) for f in fr], []) + [(length, {})]; return {'eye_l': k, 'eye_r': k}
clip('idle', 72, dict({
    'spine': loop([(0, {}), (36, {'s': (1.03, 1.0, 1.03)})], 72),
    'head': loop([(0, {'r': (0, 0, 2)}), (36, {'r': (-3, 0, -2)})], 72),
    'fin_head': swing(5, 72, 0.2, n=4, axis=0),
    'tail_01': swing(10, 72, 0.0, n=6, axis=1), 'tail_02': swing(12, 72, 0.15, n=6, axis=1),
}, **eyes([40], 72)))
clip('idle_alt', 120, dict({   # shake off water like a dog, then happy tail wag
    'head': [(0, {})] + [(10 + i * 3, {'r': (0, 0, 22 if i % 2 else -22)}) for i in range(10)] + [(42, {}), (120, {})],
    'spine': [(0, {})] + [(10 + i * 3, {'r': (0, 0, -12 if i % 2 else 12)}) for i in range(10)] + [(42, {}), (120, {})],
    'fin_head': [(0, {})] + [(11 + i * 3, {'r': (0, 0, -20 if i % 2 else 20)}) for i in range(10)] + [(44, {}), (120, {})],
    'tail_01': [(0, {}), (50, {})] + [(54 + i * 5, {'r': (0, 25 if i % 2 else -25, 0)}) for i in range(10)] + [(110, {}), (120, {})],
    'tail_02': [(0, {}), (50, {})] + [(56 + i * 5, {'r': (0, 25 if i % 2 else -25, 0)}) for i in range(10)] + [(112, {}), (120, {})],
}, **eyes([80], 120)), cyclic=False)
L = 30
clip('walk', L, {
    'arm_l': swing(24, L, 0.0), 'thigh_r': swing(24, L, 0.0), 'arm_r': swing(24, L, 0.5), 'thigh_l': swing(24, L, 0.5),
    'hand_l': swing(-14, L, 0.12), 'foot_r': swing(-14, L, 0.12), 'hand_r': swing(-14, L, 0.62), 'foot_l': swing(-14, L, 0.62),
    'root': loop([(0, {}), (7, {'l': (0, 0.006, 0)}), (15, {}), (22, {'l': (0, 0.006, 0)})], L),
    'head': swing(3, L, 0.25, n=4, axis=1), 'tail_01': swing(12, L, 0.1, n=6, axis=1), 'tail_02': swing(14, L, 0.25, n=6, axis=1),
})
L = 18
clip('run', L, {
    'arm_l': swing(40, L, 0.0), 'arm_r': swing(40, L, 0.05), 'thigh_l': swing(40, L, 0.5), 'thigh_r': swing(40, L, 0.55),
    'hand_l': swing(-25, L, 0.15), 'hand_r': swing(-25, L, 0.2),
    'root': swing(7, L, 0.25), 'spine': swing(6, L, 0.75), 'fin_head': swing(-10, L, 0.3),
    'tail_01': swing(-12, L, 0.4), 'tail_02': swing(-15, L, 0.55),
})
clip('attack_physical', 30, {  # tackle
    'root': [(0, {}), (10, {'r': (6, 0, 0), 'l': (0, -0.02, -0.04)}), (16, {'r': (8, 0, 0), 'l': (0, 0.01, 0.13)}), (22, {'l': (0, 0, 0.05)}), (30, {})],
    'neck': [(0, {}), (10, {'r': (15, 0, 0)}), (16, {'r': (20, 0, 0)}), (30, {})],
    'arm_l': [(0, {}), (10, {'r': (20, 0, 0)}), (16, {'r': (-45, 0, 0)}), (30, {})], 'arm_r': [(0, {}), (10, {'r': (20, 0, 0)}), (16, {'r': (-45, 0, 0)}), (30, {})],
    'thigh_l': [(0, {}), (10, {'r': (-15, 0, 0)}), (16, {'r': (40, 0, 0)}), (30, {})], 'thigh_r': [(0, {}), (10, {'r': (-15, 0, 0)}), (16, {'r': (40, 0, 0)}), (30, {})],
    'fin_head': [(0, {}), (16, {'r': (25, 0, 0)}), (30, {})], 'tail_01': [(0, {}), (10, {'r': (-25, 0, 0)}), (16, {'r': (15, 0, 0)}), (30, {})],
}, cyclic=False, hit=16)
clip('attack_special', 40, {   # Water Gun: inhale (puff up), lean forward, blast from socket_mouth
    'root': [(0, {}), (12, {'r': (-12, 0, 0), 'l': (0, 0.01, -0.02)}), (22, {'r': (6, 0, 0), 'l': (0, 0, 0.02)}), (32, {'r': (4, 0, 0)}), (40, {})],
    'head': [(0, {}), (12, {'r': (-18, 0, 0), 's': (1.08, 1.08, 1.08)}), (22, {'r': (8, 0, 0)}), (30, {'r': (6, 0, 0)}), (40, {})],
    'spine': [(0, {}), (12, {'s': (1.08, 1.02, 1.08)}), (22, {}), (40, {})],
    'fin_head': [(0, {}), (12, {'r': (-15, 0, 0)}), (22, {'r': (20, 0, 0)}), (40, {})],
    'tail_01': [(0, {}), (12, {'r': (-30, 0, 0)}), (22, {'r': (10, 0, 0)}), (40, {})],
    'eye_l': [(0, {}), (20, {}), (22, {'s': (1, 0.4, 1)}), (30, {'s': (1, 0.4, 1)}), (34, {}), (40, {})],
    'eye_r': [(0, {}), (20, {}), (22, {'s': (1, 0.4, 1)}), (30, {'s': (1, 0.4, 1)}), (34, {}), (40, {})],
}, cyclic=False, hit=22)
clip('hit', 12, {
    'root': [(0, {}), (3, {'r': (-12, 0, 6), 'l': (0, 0.01, -0.05)}), (12, {})],
    'head': [(0, {}), (3, {'r': (-15, 0, 0)}), (12, {})],
    'eye_l': [(0, {}), (2, {'s': (1, 0.15, 1)}), (9, {'s': (1, 0.15, 1)}), (12, {})], 'eye_r': [(0, {}), (2, {'s': (1, 0.15, 1)}), (9, {'s': (1, 0.15, 1)}), (12, {})],
}, cyclic=False)
shut = {'s': (1, 0.1, 1)}
clip('faint', 36, {
    'root': [(0, {}), (8, {'r': (0, 0, -8)}), (22, {'r': (0, 0, 75), 'l': (0.04, -0.03, 0)}), (28, {'r': (0, 0, 88), 'l': (0.05, -0.05, 0)}), (36, {'r': (0, 0, 86), 'l': (0.05, -0.05, 0)})],
    'neck': [(0, {}), (22, {'r': (25, 0, 0)}), (36, {'r': (30, 0, 0)})],
    'arm_l': [(0, {}), (28, {'r': (-25, 0, 0)}), (36, {'r': (-25, 0, 0)})], 'thigh_l': [(0, {}), (28, {'r': (25, 0, 0)}), (36, {'r': (25, 0, 0)})],
    'tail_01': [(0, {}), (28, {'r': (30, 0, 0)}), (36, {'r': (30, 0, 0)})],
    'eye_l': [(0, {}), (10, shut), (36, shut)], 'eye_r': [(0, {}), (10, shut), (36, shut)],
}, cyclic=False)
clip('sleep', 90, {
    'root': loop([(0, {'l': (0, -0.033, 0)}), (45, {'l': (0, -0.031, 0)})], 90),
    'neck': loop([(0, {'r': (25, 0, 0)}), (45, {'r': (22, 0, 0)})], 90), 'head': loop([(0, {'r': (8, -20, 0)})], 90),
    'spine': loop([(0, {}), (45, {'s': (1.04, 1, 1.04)})], 90),
    'arm_l': loop([(0, {'r': (-50, 0, 0)})], 90), 'arm_r': loop([(0, {'r': (-50, 0, 0)})], 90),
    'thigh_l': loop([(0, {'r': (50, 0, 0)})], 90), 'thigh_r': loop([(0, {'r': (50, 0, 0)})], 90),
    'tail_01': loop([(0, {'r': (20, 40, 0)})], 90), 'fin_head': loop([(0, {'r': (15, 0, 0)})], 90),
    'eye_l': [(0, shut), (90, shut)], 'eye_r': [(0, shut), (90, shut)],
})
L = 36
clip('swim', L, {   # paddle all four legs, body undulates, tail sculls (root keeps height; water level by code)
    'arm_l': swing(35, L, 0.0), 'arm_r': swing(35, L, 0.5), 'thigh_l': swing(35, L, 0.5), 'thigh_r': swing(35, L, 0.0),
    'root': swing(4, L, 0.0, n=6), 'spine': swing(5, L, 0.25, n=6, axis=1),
    'tail_01': swing(22, L, 0.3, n=6, axis=1), 'tail_02': swing(26, L, 0.45, n=6, axis=1), 'head': swing(-4, L, 0.25, n=6, axis=1),
})
for pb in rig.pose.bones: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
print('clips', [t.name for t in ad.nla_tracks], 'hit', json.dumps(HIT))

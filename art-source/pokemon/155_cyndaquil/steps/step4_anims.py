# Cyndaquil step 4: clips (uniform bone axes: r=(pitch,yaw,roll) deg, l=(x,up,forward))
sc = bpy.context.scene; sc.render.fps = 30
rig = bpy.data.objects['cyn_rig']
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

clip('idle', 60, {
    'spine': loop([(0, {}), (30, {'s': (1.03, 1.0, 1.03)})], 60),
    'head': loop([(0, {'r': (0, 0, 0)}), (30, {'r': (-3, 0, 0)})], 60),
    'extra_flame': flick(60, 1.0),
})
clip('idle_alt', 120, {   # sniff the ground, look around, little flame puff
    'neck': [(0, {}), (15, {'r': (18, 0, 0)}), (25, {'r': (22, 0, 0)}), (32, {'r': (18, 0, 0)}), (40, {'r': (22, 0, 0)}),
             (55, {'r': (-8, 0, 0)}), (120, {})],
    'head': [(0, {}), (55, {'r': (-6, 0, 0)}), (70, {'r': (-6, 30, 0)}), (85, {'r': (-6, -30, 0)}), (100, {'r': (0, 0, 0)}), (120, {})],
    'extra_flame': [(0, FL(1)), (60, FL(1)), (68, FL(1.6)), (80, FL(1)), (120, FL(1))],
})
L = 30
clip('walk', L, {  # diagonal gait
    'arm_l': swing(24, L, 0.0), 'thigh_r': swing(24, L, 0.0), 'arm_r': swing(24, L, 0.5), 'thigh_l': swing(24, L, 0.5),
    'hand_l': swing(-14, L, 0.12), 'foot_r': swing(-14, L, 0.12), 'hand_r': swing(-14, L, 0.62), 'foot_l': swing(-14, L, 0.62),
    'root': loop([(0, {}), (7, {'l': (0, 0.006, 0)}), (15, {}), (22, {'l': (0, 0.006, 0)})], L),
    'head': swing(3, L, 0.25, n=4, axis=1),
    'extra_flame': flick(L, 1.0),
})
L = 18
clip('run', L, {   # bound: front pair together, back pair together
    'arm_l': swing(40, L, 0.0), 'arm_r': swing(40, L, 0.05), 'thigh_l': swing(40, L, 0.5), 'thigh_r': swing(40, L, 0.55),
    'hand_l': swing(-25, L, 0.15), 'hand_r': swing(-25, L, 0.2),
    'root': swing(7, L, 0.25), 'spine': swing(6, L, 0.75),
    'extra_flame': flick(L, 1.35),
})
clip('attack_physical', 30, {  # crouch, lunge tackle
    'root': [(0, {}), (10, {'r': (6, 0, 0), 'l': (0, -0.02, -0.04)}), (16, {'r': (8, 0, 0), 'l': (0, 0.01, 0.14)}),
             (22, {'l': (0, 0, 0.06)}), (30, {})],
    'neck': [(0, {}), (10, {'r': (15, 0, 0)}), (16, {'r': (20, 0, 0)}), (30, {})],
    'arm_l': [(0, {}), (10, {'r': (20, 0, 0)}), (16, {'r': (-45, 0, 0)}), (30, {})],
    'arm_r': [(0, {}), (10, {'r': (20, 0, 0)}), (16, {'r': (-45, 0, 0)}), (30, {})],
    'thigh_l': [(0, {}), (10, {'r': (-15, 0, 0)}), (16, {'r': (40, 0, 0)}), (30, {})],
    'thigh_r': [(0, {}), (10, {'r': (-15, 0, 0)}), (16, {'r': (40, 0, 0)}), (30, {})],
    'extra_flame': [(0, FL(1)), (16, FL(1.4)), (30, FL(1))],
}, cyclic=False, hit=16)
clip('attack_special', 42, {   # rear up, flames erupt, breathe fire from socket_mouth
    'root': [(0, {}), (12, {'r': (-20, 0, 0), 'l': (0, 0.02, 0)}), (24, {'r': (6, 0, 0), 'l': (0, 0, 0.02)}), (34, {'r': (4, 0, 0)}), (42, {})],
    'neck': [(0, {}), (12, {'r': (-15, 0, 0)}), (24, {'r': (10, 0, 0)}), (42, {})],
    'arm_l': [(0, {}), (12, {'r': (-30, 0, 0)}), (24, {}), (42, {})], 'arm_r': [(0, {}), (12, {'r': (-30, 0, 0)}), (24, {}), (42, {})],
    'extra_flame': [(0, FL(1)), (12, FL(1.5)), (18, {'s': (1.8, 2.1, 1.8)}), (24, {'s': (1.9, 2.3, 1.9)}), (34, FL(1.6)), (42, FL(1))],
}, cyclic=False, hit=24)
clip('hit', 12, {
    'root': [(0, {}), (3, {'r': (-12, 0, 6), 'l': (0, 0.01, -0.05)}), (12, {})],
    'head': [(0, {}), (3, {'r': (-15, 0, 0)}), (12, {})],
    'extra_flame': [(0, FL(1)), (3, FL(0.6)), (12, FL(1))],
}, cyclic=False)
clip('faint', 36, {   # sway, roll onto the side, flames die out; last frame held
    'root': [(0, {}), (8, {'r': (0, 0, -8)}), (22, {'r': (0, 0, 75), 'l': (0.04, -0.03, 0)}), (28, {'r': (0, 0, 88), 'l': (0.05, -0.05, 0)}),
             (36, {'r': (0, 0, 86), 'l': (0.05, -0.05, 0)})],
    'neck': [(0, {}), (22, {'r': (25, 0, 0)}), (36, {'r': (30, 0, 0)})],
    'arm_l': [(0, {}), (28, {'r': (-25, 0, 0)}), (36, {'r': (-25, 0, 0)})], 'thigh_l': [(0, {}), (28, {'r': (25, 0, 0)}), (36, {'r': (25, 0, 0)})],
    'extra_flame': [(0, FL(1)), (12, FL(0.6)), (30, FL(0.01)), (36, FL(0.01))],
}, cyclic=False)
clip('sleep', 90, {   # curled, head tucked, flames banked to embers
    'root': loop([(0, {'l': (0, -0.035, 0)}), (45, {'l': (0, -0.033, 0)})], 90),
    'neck': loop([(0, {'r': (30, 0, 0)}), (45, {'r': (27, 0, 0)})], 90),
    'head': loop([(0, {'r': (10, -20, 0)})], 90),
    'spine': loop([(0, {'s': (1, 1, 1)}), (45, {'s': (1.04, 1, 1.04)})], 90),
    'arm_l': loop([(0, {'r': (-50, 0, 0)})], 90), 'arm_r': loop([(0, {'r': (-50, 0, 0)})], 90),
    'thigh_l': loop([(0, {'r': (50, 0, 0)})], 90), 'thigh_r': loop([(0, {'r': (50, 0, 0)})], 90),
    'extra_flame': loop([(0, FL(0.08))], 90),
})
for pb in rig.pose.bones: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
print('clips', [t.name for t in ad.nla_tracks], 'hit', json.dumps(HIT))

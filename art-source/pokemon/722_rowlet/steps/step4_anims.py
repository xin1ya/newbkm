# Rowlet step 4: animation clips as NLA tracks (30 fps, in-place)
sc = bpy.context.scene; sc.render.fps = 30
rig = bpy.data.objects['rowlet_rig']
for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'
ad = rig.animation_data_create()
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
R = math.radians
HIT = {}

def clip(name, length, keys, cyclic=True, hit=None):
    """keys: {bone: [(frame, {'r':(x,y,z) deg, 'l':(x,y,z), 's':(x,y,z)}), ...]}"""
    act = bpy.data.actions.get(name)
    if act: bpy.data.actions.remove(act)
    act = bpy.data.actions.new(name); ad.action = act
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    for pb in rig.pose.bones:                 # rest keys on every bone so clips never inherit poses
        if pb.name in keys: continue
        for f in (0, length):
            for path in ('rotation_euler', 'location', 'scale'): pb.keyframe_insert(path, frame=f)
    for bn, ks in keys.items():
        pb = rig.pose.bones[bn]
        for f, v in ks:
            r = v.get('r', (0, 0, 0))
            if bn.startswith('wing_') and 'tip' not in bn: r = (r[0], r[1] + 0.9 * abs(r[2]) * (1 if bn.endswith('_l') else -1), -r[2])
            elif bn.startswith('wing'): r = (r[0], r[1], -r[2])   # wing local Z = world +Y: flip so + spreads outward
            pb.rotation_euler = [R(a) for a in r]
            pb.location = v.get('l', (0, 0, 0)); pb.scale = v.get('s', (1, 1, 1))
            for path in ('rotation_euler', 'location', 'scale'):
                pb.keyframe_insert(path, frame=f)
    act.use_frame_range = True; act.frame_start = 0; act.frame_end = length; act.use_cyclic = cyclic
    if hit is not None: act['hitTime'] = hit / 30.0; HIT[name] = hit / 30.0
    tr = ad.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 0, act); st.name = name
    ad.action = None

def loop(frames_vals, length):
    """ensure last key equals first for loops"""
    return frames_vals + [(length, frames_vals[0][1])]

# bone local axes: head/hips/root point +Z world -> local Y = up; local X = world X; local Z = world -Y (forward)
blink = [(0, {}), (50, {}), (53, {'s': (1, 1, 0.1)}), (56, {})]
blink_eye = [(f, {'s': (1, 1, 0.1)} if v else {}) for f, v in ((0, 0), (50, 0), (53, 1), (56, 0))]
clip('idle', 72, {
    'hips': loop([(0, {}), (36, {'l': (0, 0.004, 0), 's': (1.02, 0.97, 1.02)})], 72),
    'head': loop([(0, {'r': (0, 0, 3)}), (36, {'r': (0, 0, -3)})], 72),
    'wing_l': loop([(0, {}), (36, {'r': (0, 0, 6)})], 72),
    'wing_r': loop([(0, {}), (36, {'r': (0, 0, -6)})], 72),
    'eye_l': blink_eye + [(72, {})], 'eye_r': blink_eye + [(72, {})],
})
clip('idle_alt', 120, {   # owl head turn: look over the shoulder and back
    'head': [(0, {}), (20, {'r': (0, 30, 0)}), (45, {'r': (0, 55, 0)}), (70, {'r': (0, 55, 14)}),
             (95, {'r': (0, -25, 0)}), (120, {})],
    'eye_l': [(0, {}), (80, {}), (83, {'s': (1, 1, 0.1)}), (86, {}), (120, {})],
    'eye_r': [(0, {}), (80, {}), (83, {'s': (1, 1, 0.1)}), (86, {}), (120, {})],
}, cyclic=False)
clip('walk', 30, {   # waddle
    'root': loop([(0, {'r': (0, 8, 0)}), (8, {'l': (0, 0.012, 0)}), (15, {'r': (0, -8, 0)}), (23, {'l': (0, 0.012, 0)})], 30),
    'foot_l': loop([(0, {}), (8, {'l': (0, -0.012, 0), 'r': (20, 0, 0)}), (15, {})], 30),
    'foot_r': loop([(0, {}), (15, {}), (23, {'l': (0, -0.012, 0), 'r': (20, 0, 0)})], 30),
    'wing_l': loop([(0, {'r': (0, 0, 10)}), (15, {'r': (0, 0, 2)})], 30),
    'wing_r': loop([(0, {'r': (0, 0, -2)}), (15, {'r': (0, 0, -10)})], 30),
})
clip('run', 18, {    # quick hops with wing flaps
    'root': loop([(0, {}), (4, {'l': (0, 0, 0), 's': (1.08, 0.9, 1.08)}), (9, {'l': (0, 0.05, 0), 'r': (-10, 0, 0)}), (14, {'l': (0, 0.02, 0)})], 18),
    'wing_l': loop([(0, {'r': (0, 0, 10)}), (9, {'r': (0, 0, 60)})], 18),
    'wing_r': loop([(0, {'r': (0, 0, -10)}), (9, {'r': (0, 0, -60)})], 18),
    'foot_l': loop([(0, {}), (9, {'r': (35, 0, 0)})], 18), 'foot_r': loop([(0, {}), (9, {'r': (35, 0, 0)})], 18),
})
clip('attack_physical', 30, {  # wind up, tackle lunge
    'root': [(0, {}), (10, {'r': (20, 0, 0), 'l': (0, 0, -0.03)}), (16, {'r': (-25, 0, 0), 'l': (0, 0.02, 0.09)}),
             (22, {'r': (-10, 0, 0), 'l': (0, 0, 0.04)}), (30, {})],
    'wing_l': [(0, {}), (10, {'r': (0, 0, 40)}), (16, {'r': (0, 0, -5)}), (30, {})],
    'wing_r': [(0, {}), (10, {'r': (0, 0, -40)}), (16, {'r': (0, 0, 5)}), (30, {})],
}, cyclic=False, hit=16)
clip('attack_special', 36, {   # spread wings, throw leaves from socket_fx
    'root': [(0, {}), (12, {'l': (0, 0.04, 0)}), (20, {'l': (0, 0.05, 0), 'r': (-12, 0, 0)}), (36, {})],
    'head': [(0, {}), (12, {'r': (-12, 0, 0)}), (20, {'r': (12, 0, 0)}), (36, {})],
    'wing_l': [(0, {}), (8, {'r': (0, 0, 80)}), (14, {'r': (0, 0, 30)}), (20, {'r': (0, 0, 95)}), (28, {'r': (0, 0, 20)}), (36, {})],
    'wing_r': [(0, {}), (8, {'r': (0, 0, -80)}), (14, {'r': (0, 0, -30)}), (20, {'r': (0, 0, -95)}), (28, {'r': (0, 0, -20)}), (36, {})],
    'wing_tip_l': [(0, {}), (20, {'r': (0, 0, 30)}), (36, {})], 'wing_tip_r': [(0, {}), (20, {'r': (0, 0, -30)}), (36, {})],
}, cyclic=False, hit=20)
clip('hit', 12, {
    'root': [(0, {}), (3, {'r': (18, 0, 0), 'l': (0, 0, -0.04), 's': (1.08, 0.9, 1.08)}), (12, {})],
    'eye_l': [(0, {}), (2, {'s': (1, 1, 0.2)}), (9, {'s': (1, 1, 0.2)}), (12, {})],
    'eye_r': [(0, {}), (2, {'s': (1, 1, 0.2)}), (9, {'s': (1, 1, 0.2)}), (12, {})],
}, cyclic=False)
clip('faint', 36, {  # topple onto the back, eyes shut; last frame held
    'root': [(0, {}), (8, {'r': (-10, 0, 0), 'l': (0, 0.03, 0)}), (24, {'r': (70, 0, 10), 'l': (0, 0.02, -0.02)}),
             (30, {'r': (80, 0, 12), 'l': (0, 0.035, -0.02)}), (36, {'r': (78, 0, 12), 'l': (0, 0.03, -0.02)})],
    'wing_l': [(0, {}), (24, {'r': (0, 0, 50)}), (36, {'r': (0, 0, 40)})],
    'wing_r': [(0, {}), (24, {'r': (0, 0, -50)}), (36, {'r': (0, 0, -40)})],
    'eye_l': [(0, {}), (10, {'s': (1, 1, 0.1)}), (36, {'s': (1, 1, 0.1)})],
    'eye_r': [(0, {}), (10, {'s': (1, 1, 0.1)}), (36, {'s': (1, 1, 0.1)})],
}, cyclic=False)
shut = {'s': (1, 1, 0.1)}
clip('sleep', 90, {
    'head': loop([(0, {'r': (14, 0, 0)}), (45, {'r': (18, 0, 0), 's': (1.02, 0.98, 1.02)})], 90),
    'hips': loop([(0, {}), (45, {'s': (1.03, 0.97, 1.03)})], 90),
    'eye_l': [(0, shut), (90, shut)], 'eye_r': [(0, shut), (90, shut)],
})
clip('fly', 24, {
    'root': loop([(0, {'l': (0, 0.30, 0)}), (12, {'l': (0, 0.33, 0)})], 24),
    'wing_l': loop([(0, {'r': (0, 0, 100)}), (12, {'r': (0, 0, 10)})], 24),
    'wing_r': loop([(0, {'r': (0, 0, -100)}), (12, {'r': (0, 0, -10)})], 24),
    'wing_tip_l': loop([(0, {'r': (0, 0, -20)}), (12, {'r': (0, 0, 25)})], 24),
    'wing_tip_r': loop([(0, {'r': (0, 0, 20)}), (12, {'r': (0, 0, -25)})], 24),
    'foot_l': loop([(0, {'r': (-40, 0, 0)})], 24), 'foot_r': loop([(0, {'r': (-40, 0, 0)})], 24),
})
for pb in rig.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
print('clips', [t.name for t in ad.nla_tracks], 'hit', json.dumps(HIT))

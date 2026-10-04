# Gyarados (130) · water/flying · rears up ~3.5 m (runtime clamps display height). Serpent S-curve: coil on the ground, body rising, head thrust forward, jaws open.
reset('130_gyarados')
M = pal([('body', '#3a78d0'), ('body_dk', '#2a5aa6'), ('belly', '#f0dfa2'), ('belly_dk', '#d6c07c'), ('fin', '#eef2fa'), ('fin_dk', '#b9c6de'),
         ('mouth', '#8e2a2e'), ('tongue', '#c9474a'), ('fang', '#ffffff'), ('eye', '#1a1418'), ('sclera', '#fff4d0'), ('brow', '#1f447e'), ('whisker', '#f3e7c0')])
CTRL = [(0.95, 1.55, 0.14), (1.0, 1.0, 0.24), (0.65, 0.5, 0.32), (0.12, 0.32, 0.4), (-0.18, 0.3, 0.95), (-0.06, 0.36, 1.65), (0.0, 0.25, 2.3), (0.0, -0.02, 2.82), (0.0, -0.38, 3.08)]
def catmull(P, n_per=6):
    P = [Vector(p) for p in P]; P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n_per):
            t = k / n_per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out
PTS = catmull(CTRL, 7); N = len(PTS)
def rad(i):
    t = i / (N - 1)                                   # 0 tail tip .. 1 head base
    return 0.07 + 0.3 * math.sin(math.pi * min(1, t * 1.25)) ** 0.8 if t < 0.8 else 0.3 - 0.05 * (t - 0.8) / 0.2
RADS = [rad(i) * 1.4 for i in range(N)]
D_BELLY = Vector((0, -0.6, -1))
def tangent(i): return (PTS[min(i + 1, N - 1)] - PTS[max(i - 1, 0)]).normalized()
def nearest(c):
    return min(range(N), key=lambda i: (PTS[i] - c).length)
def body_col(c, n, p):
    i = nearest(c); t = tangent(i); b = (D_BELLY - t * D_BELLY.dot(t)).normalized()
    if n.dot(b) > 0.5:
        arc = sum((PTS[k + 1] - PTS[k]).length for k in range(i)) + (c - PTS[i]).dot(t)
        return 'belly_dk' if (arc / 0.16) % 1 < 0.14 else 'belly'
    return 'body'
body = tube('gya_body', PTS, RADS, body_col, lambda c: {}, seg=24)

# ---- head (points -Y from the neck end) ----
HB = PTS[-1]; HD = Vector((0, -1, -0.15)).normalized()
skull = blob('gya_skull', HB + Vector((0, -0.12, 0.08)), (0.3, 0.36, 0.24), lambda c, n, p: 'body' if n.z > -0.4 else 'body_dk', 'head', seg=32, rings=18)
snout = blob('gya_snout', HB + Vector((0, -0.5, 0.02)), (0.2, 0.3, 0.12), 'body', 'head', seg=28, rings=14, rot=(-8, 0, 0))
upper_in = blob('gya_palate', HB + Vector((0, -0.48, -0.08)), (0.17, 0.28, 0.05), 'mouth', 'head', seg=20, rings=10, rot=(-8, 0, 0))
jaw = blob('gya_jaw', HB + Vector((0, -0.42, -0.3)), (0.18, 0.3, 0.07), lambda c, n, p: 'mouth' if n.z > 0.5 else 'belly', 'jaw', seg=24, rings=12, rot=(22, 0, 0))
blob('gya_tongue', HB + Vector((0, -0.38, -0.24)), (0.1, 0.2, 0.035), 'tongue', 'jaw', seg=16, rings=8, rot=(22, 0, 0))
for s in (1, -1):
    for k, (dy, L) in enumerate(((-0.66, 0.12), (-0.5, 0.08))):
        f = cone(f'gya_fang_u{k}{"l" if s > 0 else "r"}', 0.028, 0.002, L, verts=10, loc=HB + Vector((s * 0.12, dy, -0.09 - L / 2))); f.rotation_euler = (math.radians(180), 0, 0)
        colorize(f, 'fang'); reg(f, 'head')
    f = cone(f'gya_fang_l{"l" if s > 0 else "r"}', 0.024, 0.002, 0.08, verts=10, loc=HB + Vector((s * 0.12, -0.6, -0.33 + 0.04))); colorize(f, 'fang'); reg(f, 'jaw')
# crest: three blue prongs sweeping up and back
for k, (x, h, back) in enumerate(((0, 0.75, 0.3), (0.16, 0.52, 0.26), (-0.16, 0.52, 0.26))):
    p0 = HB + Vector((x * 0.8, -0.05, 0.25)); pts = [p0 + Vector((x * 0.5 * t, back * t * t, h * t)) for t in [j / 6 for j in range(7)]]
    tube(f'gya_crest{k}', pts, [0.075 * (1 - 0.85 * j / 6) for j in range(7)], lambda c, n, p: 'body_dk', 'head', seg=10)
# whiskers: long cream barbels from the snout sides, trailing down-back
for s, nm in ((1, 'l'), (-1, 'r')):
    p0 = HB + Vector((s * 0.18, -0.55, 0.0)); pts = [p0 + Vector((s * (0.25 * t), 0.35 * t, -0.55 * t * t + 0.1 * t)) for t in [j / 10 for j in range(11)]]
    tube(f'gya_whisker_{nm}', pts, [0.03 * (1 - 0.8 * j / 10) for j in range(11)], 'whisker', lambda c: {'head': 1.0}, seg=8)
    # angry eyes: slanted sclera, small pupil, heavy brow ridge
    e, loc, n = decal(f'gya_eye_{nm}', skull, HB + Vector((0, -0.2, 0.12)), (s * 0.8, -0.6, 0.35), (0.09, 0.03, 0.05), 'sclera', 'head', sink=0.25, up=(s * -0.4, 0, 1))
    decal(f'gya_pupil_{nm}', e, loc, n, (0.025, 0.012, 0.03), 'eye', 'head', sink=0.05, seg=12, rings=6)
    decal(f'gya_brow_{nm}', skull, HB + Vector((0, -0.2, 0.2)), (s * 0.7, -0.6, 0.55), (0.12, 0.05, 0.03), 'brow', 'head', sink=0.2, up=(s * -0.5, 0, 1))
    # side fins (ear-fins) on the cheeks
    blob(f'gya_cheekfin_{nm}', HB + Vector((s * 0.3, 0.05, 0.02)), (0.03, 0.2, 0.1), 'fin', 'head', seg=14, rings=8, rot=(20, 0, s * -30))

# ---- dorsal fins along the back of the rising body + tail fin ----
for k, i in enumerate(range(int(N * 0.35), int(N * 0.92), 4)):
    t = tangent(i); b = (D_BELLY - t * D_BELLY.dot(t)).normalized(); back = -b
    p = PTS[i] + back * RADS[i] * 0.85
    f = blob(f'gya_dorsal{k}', p + back * 0.14, (0.035, 0.22, 0.26), lambda c, n, p_: 'fin' if n.x * n.x < 0.8 else 'fin_dk', lambda c: {}, seg=12, rings=8)
    orient(f, Vector((1, 0, 0)), up=back + t * 0.6)
TT = PTS[0]
for k, a in enumerate((-30, 30, 0)):
    f = blob(f'gya_tail{k}', TT + Vector((0.05 * (k - 1), 0.3, 0.12 if k < 2 else 0.05)), (0.045, 0.36, 0.2), 'fin', lambda c: {}, seg=14, rings=8, rot=(a + 20, 0, 0))

# ---- rig: one chain from tail tip to head ----
IDX = [0, 7, 14, 21, 26, 31, 36, 42, 48, 53, N - 1]
chain = []
bones = [('root', (0, 0.3, 0), None)]
names = ['tail3', 'tail2', 'tail1', 'hips', 'body1', 'body2', 'body3', 'body4', 'body5', 'neck', 'head']
for k, (nm, i) in enumerate(zip(names, IDX)):
    parent = 'root' if nm == 'hips' else None
    bones.append((nm, tuple(PTS[min(i, N - 1)]), parent)); chain.append(nm)
# tail chain hangs off hips (backwards), body chain goes up
fixed = []
for nm, p, par in bones:
    if nm in ('tail1',): par = 'hips'
    elif nm == 'tail2': par = 'tail1'
    elif nm == 'tail3': par = 'tail2'
    elif nm == 'body1': par = 'hips'
    elif nm.startswith('body'): par = f'body{int(nm[4:]) - 1}'
    elif nm == 'neck': par = 'body5'
    elif nm == 'head': par = 'neck'
    fixed.append((nm, p, par))
bones = [fixed[0]] + [b for b in fixed[1:] if b[0] == 'hips'] + [b for b in fixed[1:] if b[0] not in ('hips',)]
order = ['root', 'hips', 'tail1', 'tail2', 'tail3', 'body1', 'body2', 'body3', 'body4', 'body5', 'neck', 'head']
bones = sorted(bones, key=lambda b: order.index(b[0]))
bones.append(('jaw', tuple(HB + Vector((0, -0.12, -0.18))), 'head'))
CH = ['tail3', 'tail2', 'tail1', 'hips', 'body1', 'body2', 'body3', 'body4', 'body5', 'neck', 'head']
for nm in list(PARTS):
    if nm == 'gya_body' or nm.startswith('gya_dorsal'): PARTS[nm] = lambda c: seg_w(c, CH)
    elif nm.startswith('gya_tail'): PARTS[nm] = 'tail3'
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HB + Vector((0, -0.75, -0.12))), 'head'), ('socket_fx', tuple(HB + Vector((0, -0.8, 0))), 'head')])

H = 3.3; s = 1.4
UP = ['body1', 'body2', 'body3', 'body4', 'body5', 'neck']
TL = ['tail1', 'tail2', 'tail3']
plan_clips(rig, 'serpent', size=s, over={
    'idle': (80, merge(wave(UP, 3, 80, 0.1, 1), wave(TL, 8, 80, 0.12, 1), {'head': swing(4, 80, 0.3, 4), 'jaw': loop([(0, {}), (40, {'r': (6, 0, 0)})], 80)}), True, None),
    'idle_alt': (110, merge(wave(TL, 14, 110, 0.12, 1), {'neck': [(0, {}), (25, {'r': (-15, 0, 0)}), (45, {'r': (-20, 0, 0)}), (70, {}), (110, {})],
                                                         'head': [(0, {}), (25, {'r': (-20, 0, 0)}), (45, {'r': (-25, 0, 0)}), (70, {}), (110, {})],
                                                         'jaw': [(0, {}), (25, {'r': (25, 0, 0)}), (45, {'r': (30, 0, 0)}), (60, {}), (110, {})]}), True, None),
    'walk': (40, merge(wave(UP, 6, 40, 0.1, 1), wave(TL, 18, 40, 0.14, 1), {'root': bob(0.05, 40, 0, 4)}), True, None),
    'run': (26, merge(wave(UP, 9, 26, 0.1, 1), wave(TL, 26, 26, 0.15, 1), {'root': bob(0.08, 26, 0, 4)}), True, None),
    'swim': (40, merge(wave(UP, 8, 40, 0.1, 1), wave(TL, 22, 40, 0.14, 1)), True, None),
    'attack_physical': (32, {   # rears back, then slams the head down (Bite / Aqua Tail)
        'body4': [(0, {}), (10, {'r': (-12, 0, 0)}), (17, {'r': (18, 0, 0)}), (32, {})], 'body5': [(0, {}), (10, {'r': (-15, 0, 0)}), (17, {'r': (22, 0, 0)}), (32, {})],
        'neck': [(0, {}), (10, {'r': (-18, 0, 0)}), (17, {'r': (25, 0, 0)}), (32, {})], 'head': [(0, {}), (10, {'r': (-15, 0, 0)}), (17, {'r': (10, 0, 0)}), (32, {})],
        'jaw': [(0, {}), (10, {'r': (35, 0, 0)}), (17, {'r': (-5, 0, 0)}), (24, {'r': (15, 0, 0)}), (32, {})],
        'root': [(0, {}), (10, {'l': (0, 0, -0.1)}), (17, {'l': (0, 0, 0.35)}), (32, {})], **wave(TL, 20, 32, 0.15, 1)}, False, 17),
    'attack_special': (48, {    # roar: neck back, jaws wide, then blast (Hydro Pump / Dragon Rage from socket_mouth)
        'body5': [(0, {}), (14, {'r': (-10, 0, 0)}), (24, {'r': (8, 0, 0)}), (48, {})], 'neck': [(0, {}), (14, {'r': (-22, 0, 0)}), (24, {'r': (10, 0, 0)}), (40, {'r': (8, 0, 0)}), (48, {})],
        'head': [(0, {}), (14, {'r': (-25, 0, 0)}), (24, {'r': (5, 0, 0)}), (48, {})], 'jaw': [(0, {}), (14, {'r': (40, 0, 0)}), (40, {'r': (40, 0, 0)}), (48, {})], **wave(TL, 16, 48, 0.12, 1)}, False, 24),
    'faint': (44, {'root': [(0, {}), (10, {'r': (0, 0, -6)}), (30, {'r': (0, 0, 80), 'l': (0.3, -0.2, 0)}), (44, {'r': (0, 0, 88), 'l': (0.35, -0.3, 0)})],
                   'neck': [(0, {}), (30, {'r': (25, 0, 0)}), (44, {'r': (28, 0, 0)})], 'jaw': [(0, {}), (30, {'r': (20, 0, 0)}), (44, {'r': (20, 0, 0)})]}, False, None),
    'sleep': (100, {'body3': hold({'r': (30, 0, 0)}, 100), 'body4': hold({'r': (35, 0, 0)}, 100), 'body5': hold({'r': (30, 0, 0)}, 100), 'neck': hold({'r': (30, 0, 0)}, 100),
                    'root': loop([(0, {'l': (0, -0.05, 0)}), (50, {'l': (0, -0.03, 0)})], 100), 'jaw': hold({}, 100)}, True, None),
})
sheet('check', H, poses=[('attack_physical', 17, 'side'), ('attack_special', 20, 'q34'), ('idle', 0, 'q34'), ('faint', 44, 'q34')])
export(130, 'gyarados', 6.5, 'serpent', rig, mesh, shiny={'body': '#c9383a', 'body_dk': '#9b2528', 'brow': '#7a1a1c', 'belly': '#f3e5c0'})

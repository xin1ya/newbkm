# Corphish (341) · water · 0.6 m. v2 — rebuilt against the pokemon-3d reference:
# an upright egg-shaped head-body leaning back and tapering to a point, a three-spike star crest on top, big white eyes high on the sides,
# a pale grey belly plate over the lower front, two oval pincers held out at the sides on short grey arm joints (red shells with jagged
# pale teeth along the seam), three pairs of short pointed legs underneath, and a flat segmented tail trailing back into a notched fan.
reset('341_corphish')
M = pal([('red', '#d9502f'), ('red_dk', '#a83a22'), ('red_lt', '#ec6a46'), ('plate', '#c9c4bc'), ('plate_dk', '#a8a29a'), ('joint', '#b8b4ae'),
         ('tooth', '#ece8e0'), ('eyew', '#ffffff'), ('eye', '#1a1418')])
BC = Vector((0, 0.01, 0.3)); TILT = math.radians(22)
def egg(v):
    k = 1 - 0.42 * max(0.0, v.z) ** 1.3          # taper towards the top point
    v = Vector((v.x * k, v.y * k, v.z))
    return Vector((v.x, v.y * math.cos(TILT) + v.z * math.sin(TILT) * 0.0, v.z))
body = blob('cor_body', BC, (0.13, 0.12, 0.2), 'red', lambda c: lerp_w('spine', 'head', (c.z - 0.25) / 0.12), seg=36, rings=20, fn=egg, rot=(22, 0, 0))
# pale belly plate on the lower front (separate shell, not per-face paint)
blob('cor_plate', BC + Vector((0, -0.045, -0.07)), (0.118, 0.085, 0.13), lambda c, n, p: 'plate_dk' if n.z < -0.6 else 'plate', 'spine', seg=32, rings=16, rot=(10, 0, 0))
# star crest: tall centre spike plus two side spikes, rising from the top point
TOPP = shoot(body, BC + Vector((0, 0, 0.1)), Vector((0, -math.sin(TILT), math.cos(TILT))))[0]
for k, (dx, dy, h, lean) in enumerate(((0, -0.005, 0.12, 0.0), (0.035, 0.005, 0.085, 1.0), (-0.035, 0.005, 0.085, -1.0))):
    b0 = TOPP + Vector((dx * 0.6, dy - 0.01, -0.03))
    tube(f'cor_spike{k}', [b0, b0 + Vector((lean * 0.02, -0.03, h * 0.55)), b0 + Vector((lean * 0.045, -0.05, h))], [0.028, 0.016, 0.001], 'red_lt' if k == 0 else 'red', 'head', seg=6, flat=0.55)
# eyes: big white discs high on the sides with forward-looking pupils
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'cor_eye_{nm}', body, BC + Vector((0, 0, 0.07)), (s * 0.62, -0.72, 0.3), (0.036, 0.012, 0.046), 'eyew', 'head', sink=0.25)
    decal(f'cor_pupil_{nm}', e, l + Vector((-s * 0.006, -0.004, 0.0)), n, (0.016, 0.006, 0.02), 'eye', 'head', sink=-0.05, seg=12, rings=6)
# pincers: short grey joint, oval red shell split by a seam with jagged pale teeth
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = BC + Vector((s * 0.11, -0.04, -0.04)); cc = Vector((s * 0.31, -0.055, 0.235))
    tube(f'cor_arm_{nm}', [sh, sh + Vector((s * 0.07, -0.01, 0.0)), cc - Vector((s * 0.07, -0.01, 0))], [0.02, 0.016, 0.018], 'joint',
         lambda c, nm=nm, sh=sh: lerp_w(f'arm_{nm}', f'claw_{nm}', ((c - sh).length - 0.08) / 0.06), seg=8)
    blob(f'cor_cup_{nm}', cc + Vector((0, 0, 0.012)), (0.08, 0.12, 0.055), 'red', f'claw_{nm}', seg=24, rings=12, fn=lambda v: Vector((v.x, v.y, max(v.z, -0.25))))
    blob(f'cor_jaw_{nm}', cc + Vector((0, -0.01, -0.012)), (0.075, 0.11, 0.045), 'red_dk', f'claw_{nm}', seg=24, rings=12, fn=lambda v: Vector((v.x, v.y, min(v.z, 0.25))))
    for i in range(9):   # teeth along the front half of the seam, alternating up/down
        a = math.radians(-85 + 170 * i / 8)
        p = cc + Vector((math.sin(a) * 0.079, -math.cos(a) * 0.12, 0.0))
        t = cone(f'cor_tooth{i}_{nm}', 0.014, 0.0, 0.034, verts=5, loc=p)
        t.rotation_euler = (0 if i % 2 else math.pi, 0, 0); colorize(t, 'tooth'); reg(t, f'claw_{nm}')
# six short pointed legs under the front of the body
for s, sd in ((1, 'l'), (-1, 'r')):
    for i, (y, out) in enumerate(((-0.06, 0.23), (0.0, 0.21), (0.06, 0.19))):
        p0 = BC + Vector((s * 0.07, y, -0.17)); ft = Vector((s * out, y - 0.03 * (1 - i), 0.0))
        kn = (p0 + ft) / 2 + Vector((s * 0.03, 0, 0.07))
        tube(f'cor_leg{i}_{sd}', [p0, kn, ft], [0.024, 0.017, 0.002], 'red_dk' if i == 1 else 'red', f'leg{i}_{sd}', seg=6)
# flat segmented tail trailing back, ending in a notched fan
TS = []
for i in range(3):
    c = BC + Vector((0, 0.13 + 0.06 * i, -0.17 + 0.025 * i)); TS.append(c)
    blob(f'cor_tseg{i}', c, (0.08 - 0.01 * i, 0.045, 0.04 - 0.006 * i), 'red' if i % 2 == 0 else 'red_lt', 'tail1' if i < 1 else 'tail2', seg=16, rings=8)
for k, a in enumerate((-40, 0, 40)):
    d = Vector((math.sin(math.radians(a)), math.cos(math.radians(a)), 0))
    blob(f'cor_fan{k}', TS[-1] + d * 0.075 + Vector((0, 0, 0.01)), (0.04, 0.06, 0.014), 'red_lt' if k == 1 else 'red', 'tail2', seg=12, rings=6, rot=(0, 0, -a))
bones = [('root', (0, 0, 0), None), ('hips', tuple(BC + Vector((0, 0.03, -0.17))), 'root'), ('spine', tuple(BC - Vector((0, 0, 0.05))), 'hips'), ('head', tuple(BC + Vector((0, 0.01, 0.07))), 'spine'),
         ('tail1', tuple(TS[0]), 'hips'), ('tail2', tuple(TS[1]), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.11, -0.04, -0.04))), 'spine'), (f'claw_{nm}', (s * 0.26, -0.05, 0.235), f'arm_{nm}')]
    for i, y in enumerate((-0.06, 0.0, 0.06)): bones.append((f'leg{i}_{nm}', tuple(BC + Vector((s * 0.07, y, -0.17))), 'hips'))
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.13, -0.02))), 'head'), ('socket_fx', tuple(TOPP + Vector((0, 0, 0.1))), 'head')])
LG = [f'leg{i}_{s}' for i in range(3) for s in 'lr']
scuttle = lambda L: {b: swing(18, L, 0.5 * (i % 2) + 0.15 * (i // 2), 4, 0) for i, b in enumerate(LG)} | {'root': swing(4, L, 0, 4, 2)}
snap = lambda L, a: {'claw_l': swing(a, L, 0, 4, 0), 'claw_r': swing(a, L, 0.5, 4, 0)}
plan_clips(rig, 'quadruped', size=0.3, over={'walk': (24, scuttle(24) | snap(24, 8), True, None), 'run': (14, scuttle(14) | snap(14, 12), True, None),
    'idle': (60, {'spine': loop([(0, {}), (30, {'s': (1.02, 1, 1.02)})], 60), **snap(60, 6)}, True, None),
    'attack_physical': (30, {'arm_r': [(0, {}), (8, {'r': (0, 0, 25)}), (14, {'r': (0, 0, -30)}), (30, {})], 'claw_r': [(0, {}), (8, {'r': (-20, 0, 0)}), (14, {'r': (15, 0, 0)}), (30, {})],
                             'root': [(0, {}), (14, {'l': (0, -0.08, 0)}), (30, {})]}, False, 14)})   # Vise Grip
sheet('check', 0.5, poses=[('walk', 6, 'side'), ('run', 4, 'q34'), ('attack_physical', 14, 'q34'), ('idle', 20, 'front')])
export(341, 'corphish', 0.6, 'quadruped', rig, mesh, shiny={'red': '#e88a3a', 'red_dk': '#c06a24', 'red_lt': '#f4a660'})

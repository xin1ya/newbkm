# Machoke (67) · fighting · 1.5 m. Evolution of Machop — geometry matched to the reference (art-source/reference, comparison only; the
# reference is in a T-pose, ours rests with arms lowered ~45°):
# tall bodybuilder: grey-blue skin with red muscle striations on the shoulders/forearms/chest, broad pecs and lats, narrow waist,
# black wrestling briefs with a gold championship belt, thick thighs, three-toed feet; small head on a thick neck with a three-ridge
# crest, red eyes under a heavy brow, pale lips; long arms with big hands.
reset('067_machoke')
M = pal([('skin', '#8a9cb0'), ('skin_lt', '#a4b4c6'), ('skin_dk', '#6a7c90'), ('vein', '#a8545a'), ('brief', '#1e1c22'), ('belt', '#d8b040'), ('belt_dk', '#8a6a1a'),
         ('crest', '#a8b4c0'), ('eyew', '#f4f4f0'), ('iris', '#c8402e'), ('pupil', '#1a1418'), ('lip', '#d8c8b8'), ('mouth', '#6a2a30'), ('nail', '#e8e4dc')])
HC = Vector((0, -0.08, 1.34)); CH = Vector((0, 0.0, 1.07)); HP = Vector((0, 0.0, 0.76))
# torso: V-taper (wide chest/lats, narrow waist)
def trunk(v):
    t = v.z
    wx = 1.0 + 0.22 * max(0, t) - 0.18 * math.exp(-((t + 0.45) / 0.3) ** 2)
    return Vector((v.x * wx, v.y * (1 + 0.06 * max(0, t)), v.z))
torso = blob('mk_torso', Vector((0, 0, 0.98)), (0.24, 0.2, 0.28), 'skin', lambda c: lerp_w('spine', 'chest', (c.z - 0.85) / 0.25), seg=36, rings=22, fn=trunk)
for s in (1, -1):
    decal(f'mk_pec{s + 1}', torso, CH, (s * 0.42, -1, 0.15), (0.11, 0.025, 0.07), 'skin_lt', 'chest', sink=0.55)
    decal(f'mk_pecv{s + 1}', torso, CH + Vector((0, 0, -0.03)), (s * 0.55, -1, 0.1), (0.05, 0.004, 0.006), 'vein', 'chest', sink=0.2, up=(s * 0.5, 0, 1))
    blob(f'mk_lat{s + 1}', Vector((s * 0.2, 0.03, 1.02)), (0.06, 0.1, 0.14), 'skin', 'chest', seg=16, rings=10)
for k, z in enumerate((0.95, 0.9, 0.85)):   # abs
    for s in (1, -1):
        decal(f'mk_ab{k}_{s + 1}', torso, Vector((0, 0, z)), (s * 0.18, -1, 0), (0.03, 0.012, 0.02), 'skin_lt', 'spine', sink=0.5)
# briefs + belt
blob('mk_brief', HP + Vector((0, 0.01, 0.0)), (0.21, 0.18, 0.11), 'brief', 'hips', seg=28, rings=14)
belt = tube('mk_belt', [HP + Vector((0.215 * math.sin(a), -0.185 * math.cos(a), 0.08)) for a in [2 * math.pi * i / 24 for i in range(25)]], 0.028, 'belt', 'hips', seg=8, flat=0.5)
blob('mk_buckle', HP + Vector((0, -0.195, 0.08)), (0.07, 0.02, 0.04), 'belt_dk', 'hips', seg=16, rings=8)
blob('mk_buckle_gem', HP + Vector((0, -0.215, 0.08)), (0.035, 0.008, 0.025), 'belt', 'hips', seg=12, rings=6)
# neck + head
tube('mk_neck', [CH + Vector((0, 0.0, 0.12)), HC + Vector((0, 0.03, -0.08))], [0.12, 0.1], 'skin', 'head', seg=14)
for s in (1, -1):   # trapezius
    blob(f'mk_trap{s + 1}', CH + Vector((s * 0.1, 0.03, 0.14)), (0.09, 0.07, 0.05), 'skin', 'chest', seg=14, rings=8)
def headf(v):
    jaw = max(0.0, -v.z) * max(0.0, -v.y)
    return Vector((v.x * (1 + 0.1 * jaw), v.y - 0.3 * jaw, v.z))
head = blob('mk_head', HC, (0.115, 0.13, 0.125), 'skin', 'head', seg=36, rings=22, fn=headf)
for k, x in enumerate((0.0, 0.03, -0.03)):
    h = 0.03 if k == 0 else 0.018
    pts = [HC + Vector((x, -0.08, 0.06)), HC + Vector((x, -0.04, 0.1 + h * 0.8)), HC + Vector((x, 0.02, 0.11 + h)), HC + Vector((x, 0.08, 0.07 + h * 0.5)), HC + Vector((x, 0.1, 0.02))]
    tube(f'mk_crest{k}', pts, [0.008, 0.02, 0.022, 0.016, 0.006], 'crest', 'head', seg=10, flat=0.35)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'mk_eye_{nm}', head, HC + Vector((0, 0, 0.02)), (s * 0.42, -1, 0.15), (0.026, 0.01, 0.018), 'eyew', 'head', sink=0.4, up=(-s * 0.3, 0, 1))
    ir, l2, n2 = decal(f'mk_iris_{nm}', e, l, n, (0.012, 0.004, 0.012), 'iris', 'head', sink=0.0, seg=10)
    decal(f'mk_pupil_{nm}', ir, l2, n2, (0.005, 0.003, 0.006), 'pupil', 'head', sink=0.0, seg=8, rings=5)
    decal(f'mk_brow_{nm}', head, HC + Vector((0, 0, 0.045)), (s * 0.4, -1, 0.35), (0.035, 0.016, 0.012), 'skin_dk', 'head', sink=0.2, up=(-s * 0.4, 0, 1))
decal('mk_lip', head, HC + Vector((0, 0, -0.045)), (0, -1, -0.1), (0.05, 0.014, 0.016), 'lip', 'head', sink=0.3)
decal('mk_mouth', head, HC + Vector((0, 0, -0.045)), (0, -1, -0.1), (0.04, 0.016, 0.005), 'mouth', 'head', sink=0.2)
ARM_DROP = 30
def arm(s, nm, sh, bone_u, bone_h, prefix, scale=1.0):
    # arm hangs ARM_DROP degrees below horizontal, slightly forward
    a = math.radians(ARM_DROP)
    d = Vector((s * math.cos(a), 0.0, -math.sin(a))).normalized()
    el = sh + d * 0.3 * scale; wr = el + d * 0.27 * scale
    tube(f'{prefix}_upper_{nm}', [sh - d * 0.1 + Vector((0, 0, -0.03)), sh, sh + d * 0.12 * scale, el], [0.07 * scale, 0.085 * scale, 0.08 * scale, 0.058 * scale], 'skin', bone_u, seg=14)
    tube(f'{prefix}_fore_{nm}', [el - d * 0.03, el + d * 0.09 * scale, wr], [0.058 * scale, 0.068 * scale, 0.045 * scale], 'skin', bone_h, seg=14)
    for k in range(3):   # red striations on the forearm
        p0 = el + d * (0.06 + 0.05 * k) * scale + Vector((0, -0.05 * scale, 0))
        blob(f'{prefix}_vein{k}_{nm}', p0, (0.03 * scale, 0.006, 0.006), 'vein', bone_h, seg=8, rings=4)
    hd = wr + d * 0.06 * scale
    blob(f'{prefix}_palm_{nm}', hd, (0.05 * scale, 0.04 * scale, 0.06 * scale), 'skin', bone_h, seg=14, rings=8)
    for k in range(4):
        f0 = hd + d * 0.04 * scale + Vector((0, (k - 1.5) * 0.022 * scale, 0))
        tube(f'{prefix}_finger{k}_{nm}', [f0, f0 + d * 0.05 * scale + Vector((0, -0.01, -0.02)) * scale, f0 + d * 0.07 * scale + Vector((0, -0.02, -0.04)) * scale], [0.015 * scale, 0.013 * scale, 0.011 * scale], 'skin', bone_h, seg=8)
    tube(f'{prefix}_thumb_{nm}', [hd + Vector((0, -0.04, 0.0)) * scale, hd + Vector((s * 0.02, -0.07, -0.03)) * scale], [0.016 * scale, 0.013 * scale], 'skin', bone_h, seg=8)
    return el, wr
EL = {}
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = CH + Vector((s * 0.28, 0.04, 0.08))
    EL[nm] = arm(s, nm, sh, f'arm_{nm}', f'hand_{nm}', 'mk', scale=1.35)
    blob(f'mk_shv_{nm}', sh + Vector((s * 0.03, -0.04, 0.03)), (0.05, 0.008, 0.012), 'vein', f'arm_{nm}', seg=8, rings=4)
    # legs: thick thighs, calves, three-toed feet
    hp = Vector((s * 0.12, 0.0, 0.72)); kn = Vector((s * 0.15, -0.02, 0.4)); an = Vector((s * 0.15, 0.02, 0.08))
    tube(f'mk_thigh_{nm}', [hp, (hp + kn) / 2 + Vector((s * 0.015, -0.01, 0)), kn], [0.13, 0.135, 0.09], 'skin', f'thigh_{nm}', seg=14)
    tube(f'mk_calf_{nm}', [kn, (kn + an) / 2 + Vector((0, 0.025, 0)), an], [0.088, 0.1, 0.065], 'skin', f'shin_{nm}', seg=14)
    blob(f'mk_foot_{nm}', Vector((s * 0.15, -0.05, 0.04)), (0.09, 0.14, 0.04), 'skin', f'foot_{nm}', seg=16, rings=8)
    for k in range(3):
        blob(f'mk_toe{k}_{nm}', Vector((s * 0.15 + (k - 1) * 0.05, -0.19, 0.028)), (0.018, 0.02, 0.018), 'nail', f'foot_{nm}', seg=8, rings=6)
bones = [('root', (0, 0, 0), None), ('hips', tuple(HP), 'root'), ('spine', (0, 0, 0.9), 'hips'), ('chest', tuple(CH), 'spine'), ('head', tuple(HC - Vector((0, 0, 0.08))), 'chest')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(CH + Vector((s * 0.25, 0, 0.08))), 'chest'), (f'hand_{nm}', tuple(EL[nm][0]), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.1, 0, 0.72), 'hips'), (f'shin_{nm}', (s * 0.12, -0.02, 0.4), f'thigh_{nm}'), (f'foot_{nm}', (s * 0.12, 0.02, 0.08), f'shin_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.1, -0.04))), 'head'), ('socket_fx', tuple(EL['l'][1]), 'hand_l')])
plan_clips(rig, 'biped', size=1.5, over={'idle_alt': (90, {'arm_l': [(0, {}), (15, {'r': (0, -30, 60)}), (45, {'r': (0, -30, 60)}), (60, {}), (90, {})],
                                                          'arm_r': [(0, {}), (15, {'r': (0, 30, -60)}), (45, {'r': (0, 30, -60)}), (60, {}), (90, {})]}, True, None)})   # double-biceps pose
sheet('check', 1.6, poses=[('walk', 6, 'side'), ('idle_alt', 30, 'front'), ('attack_physical', 14, 'q34'), ('idle', 0, 'front')])
export(67, 'machoke', 1.5, 'biped', rig, mesh, shiny={'skin': '#a8b890', 'skin_lt': '#c0d0a8', 'skin_dk': '#88986e'})

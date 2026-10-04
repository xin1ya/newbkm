# Machop (66) · fighting · 0.8 m. Stocky grey-blue humanoid: big rounded head with three bony ridges on top,
# red eyes under a heavy brow, cream lips, muscular arms with big hands, chest with abdominal lines, short thick legs, small tail.
reset('066_machop')
M = pal([('skin', '#9eb4c8'), ('skin_lt', '#b8cadb'), ('skin_dk', '#7890a8'), ('crest', '#b4c0cc'), ('lip', '#e8dcc0'), ('eyew', '#f4f4f0'),
         ('iris', '#c8402e'), ('socket', '#4a2024'), ('mouthin', '#e89aa0'), ('pupil', '#1a1418'), ('line', '#6a8098'), ('nail', '#e8e4dc')])
HC = Vector((0, -0.04, 0.645)); BC = Vector((0, 0.0, 0.4))
# one-piece torso + hips (no ball joints): barrel chest, slight waist, broad hips
def trunk(v):
    t = v.z
    wx = 1.0 + 0.12 * max(0, t) - 0.1 * math.exp(-((t + 0.2) / 0.25) ** 2) + 0.08 * max(0, -t - 0.4)
    wy = 1.0 + 0.08 * max(0, t)
    return Vector((v.x * wx, v.y * wy - 0.06 * max(0, t) * (v.y < 0), v.z))
torso = blob('mc_torso', BC, (0.098, 0.088, 0.15), 'skin', lambda c: lerp_w('hips', 'chest', (c.z - 0.3) / 0.2), seg=40, rings=24, fn=trunk)
for s in (1, -1):
    decal(f'mc_pec{s + 1}', torso, BC + Vector((0, 0, 0.08)), (s * 0.4, -1, 0.35), (0.038, 0.012, 0.026), 'skin_lt', 'chest', sink=0.6)
    decal(f'mc_pecl{s + 1}', torso, BC + Vector((0, 0, 0.055)), (s * 0.4, -1, 0.1), (0.03, 0.003, 0.003), 'line', 'chest', sink=0.2)
for k, z in enumerate((0.0, -0.04)):
    decal(f'mc_ab{k}', torso, BC + Vector((0, 0, z)), (0, -1, z * 2), (0.035, 0.003, 0.003), 'line', 'spine', sink=0.2)
decal('mc_abv', torso, BC + Vector((0, 0, -0.01)), (0, -1, 0), (0.003, 0.003, 0.05), 'line', 'spine', sink=0.2)
# neck
tube('mc_neck', [BC + Vector((0, 0, 0.12)), HC + Vector((0, 0.02, -0.08))], [0.062, 0.06], 'skin', 'head', seg=14)
# head: tall rounded dome, lower face pushed forward into a broad muzzle/jaw
def headf(v):
    jaw = max(0.0, -v.z) * max(0.0, -v.y)
    return Vector((v.x * (1 + 0.08 * jaw), v.y - 0.22 * jaw, v.z))
head = blob('mc_head', HC, (0.122, 0.118, 0.12), 'skin', 'head', seg=40, rings=24, fn=headf)
# crest: three tall thin blades running front-to-back, centre tallest
for k, x in enumerate((0.0, 0.04, -0.04)):
    h = 0.03 if k == 0 else 0.018
    pts = [HC + Vector((x, -0.09, 0.08)), HC + Vector((x, -0.05, 0.11 + h * 0.8)), HC + Vector((x, 0.02, 0.12 + h)), HC + Vector((x, 0.09, 0.09 + h * 0.6)), HC + Vector((x, 0.12, 0.03))]
    tube(f'mc_crest{k}', pts, [0.01, 0.024, 0.026, 0.02, 0.008], 'crest', 'head', seg=10, flat=0.35)
# eyes: big dark-red sockets with red irises
for s, nm in ((1, 'l'), (-1, 'r')):
    so, l0, n0 = decal(f'mc_socket_{nm}', head, HC + Vector((0, 0, 0.02)), (s * 0.44, -1, 0.2), (0.05, 0.016, 0.05), 'socket', 'head', sink=0.5, up=(-s * 0.25, 0, 1))
    i, l2, n2 = decal(f'mc_iris_{nm}', so, l0, n0, (0.024, 0.006, 0.03), 'iris', 'head', sink=0.1, seg=14)
    decal(f'mc_pupil_{nm}', i, l2, n2, (0.008, 0.004, 0.012), 'pupil', 'head', sink=0.0, seg=10, rings=6)
    decal(f'mc_shine_{nm}', i, l2 + Vector((0, 0, 0.008)), n2, (0.005, 0.003, 0.005), 'eyew', 'head', sink=-0.2, seg=8, rings=5)
# wide open smiling mouth on the muzzle
m, ml, mn = decal('mc_mouth', head, HC + Vector((0, 0, -0.03)), (0, -1, -0.2), (0.068, 0.014, 0.026), 'mouthin', 'head', sink=0.5, seg=24)
decal('mc_lip', head, HC + Vector((0, 0, -0.03)), (0, -1, -0.06), (0.07, 0.01, 0.008), 'lip', 'head', sink=0.3)
decal('mc_teeth', m, ml + Vector((0, 0, 0.012)), mn, (0.05, 0.004, 0.006), 'eyew', 'head', sink=-0.6)
# arms: smooth continuous tubes from inside the shoulder, hands with separate fingers
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = BC + Vector((s * 0.09, 0, 0.11)); el = BC + Vector((s * 0.16, 0.01, -0.0)); wr = BC + Vector((s * 0.19, -0.01, -0.1))
    tube(f'mc_upper_{nm}', [sh, (sh + el) / 2 + Vector((s * 0.012, -0.008, 0)), el], [0.04, 0.038, 0.03], 'skin', f'arm_{nm}', seg=14)
    tube(f'mc_fore_{nm}', [el, (el + wr) / 2 + Vector((0, -0.01, 0)), wr], [0.027, 0.03, 0.022], 'skin', f'hand_{nm}', seg=14)
    blob(f'mc_palm_{nm}', wr + Vector((0, -0.005, -0.025)), (0.017, 0.026, 0.026), 'skin', f'hand_{nm}', seg=14, rings=8)
    for k in range(3):
        y = -0.02 + 0.018 * k
        tube(f'mc_finger{k}_{nm}', [wr + Vector((0, y, -0.045)), wr + Vector((s * 0.003, y - 0.004, -0.07))], [0.008, 0.007], 'skin', f'hand_{nm}', seg=8)
    tube(f'mc_thumb_{nm}', [wr + Vector((-s * 0.01, -0.025, -0.025)), wr + Vector((-s * 0.016, -0.04, -0.05))], [0.008, 0.007], 'skin', f'hand_{nm}', seg=8)
# legs: thick, continuous from the hips, long flat feet
for s, nm in ((1, 'l'), (-1, 'r')):
    hp = Vector((s * 0.058, 0.0, 0.3)); kn = Vector((s * 0.068, -0.005, 0.15)); an = Vector((s * 0.072, 0.0, 0.04))
    tube(f'mc_leg_{nm}', [hp, kn, an], [0.058, 0.05, 0.042], 'skin', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.22 - c.z) / 0.15), seg=14)
    blob(f'mc_foot_{nm}', Vector((s * 0.074, -0.035, 0.024)), (0.048, 0.08, 0.026), 'skin', f'foot_{nm}', seg=16, rings=8)
    for k in range(3):
        blob(f'mc_toe{k}_{nm}', Vector((s * 0.074 + (k - 1) * 0.022, -0.11, 0.015)), (0.01, 0.01, 0.009), 'nail', f'foot_{nm}', seg=8, rings=6)
# thick cone tail
tube('mc_tail', [BC + Vector((0, 0.04, -0.08)), BC + Vector((0, 0.12, -0.12)), BC + Vector((0, 0.2, -0.14)), BC + Vector((0, 0.26, -0.14))], [0.045, 0.032, 0.018, 0.004], 'skin', 'tail1', seg=12)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.3), 'root'), ('spine', tuple(BC), 'hips'), ('chest', tuple(BC + Vector((0, 0, 0.12))), 'spine'),
         ('head', tuple(HC - Vector((0, 0, 0.08))), 'chest'), ('tail1', tuple(BC + Vector((0, 0.09, -0.12))), 'hips')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.09, 0, 0.11))), 'chest'), (f'hand_{nm}', tuple(BC + Vector((s * 0.16, 0.01, 0))), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.05, 0, 0.3), 'hips'), (f'foot_{nm}', (s * 0.06, 0, 0.04), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.12, -0.04))), 'head'), ('socket_fx', tuple(BC + Vector((0.25, -0.05, -0.14))), 'hand_l')])
plan_clips(rig, 'biped', size=0.8, over={'attack_physical': (28, {'arm_l': [(0, {}), (8, {'r': (-40, 0, 20)}), (14, {'r': (-85, 0, 0)}), (22, {'r': (-40, 0, 0)}), (28, {})],
                                                                 'chest': [(0, {}), (8, {'r': (0, 0, -15)}), (14, {'r': (0, 0, 20)}), (28, {})],
                                                                 'root': [(0, {}), (14, {'l': (0, -0.06, 0)}), (28, {})]}, False, 14),   # Karate Chop / Low Kick punch
                                        'idle_alt': (90, {'arm_l': [(0, {}), (15, {'r': (0, 0, 70)}), (25, {'r': (0, -30, 70)}), (45, {'r': (0, -30, 70)}), (60, {}), (90, {})],
                                                          'arm_r': [(0, {}), (15, {'r': (0, 0, -70)}), (25, {'r': (0, 30, -70)}), (45, {'r': (0, 30, -70)}), (60, {}), (90, {})]}, True, None)})   # flexing
sheet('check', 0.8, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_physical', 14, 'q34'), ('idle_alt', 30, 'front')])
export(66, 'machop', 0.8, 'biped', rig, mesh, shiny={'skin': '#c8b89a', 'skin_lt': '#ddd0b4', 'skin_dk': '#a89878', 'crest': '#b8a888'})

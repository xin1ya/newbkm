# Paras (46) · bug/grass · 0.3 m. v2 — geometry matched to the reference silhouette (art-source/reference, comparison only):
# low, wide, ribbed oval body with the face at the front, big white eyes at the lower front corners, two large teardrop pincers held out
# to the front-sides reaching the ground, two pink mushrooms (yellow spots) sitting low on the back and tilted outward, three pairs of thin splayed legs.
reset('046_paras')
M = pal([('shell', '#d88a3c'), ('shell_dk', '#a8642a'), ('belly', '#eab070'), ('cap', '#c97f9f'), ('cap_dk', '#a8607e'), ('spot', '#e2c33a'), ('stalk', '#e8b07a'),
         ('claw', '#d2843a'), ('eye', '#f2f0ea'), ('pupil', '#2a2420'), ('mouth', '#5a2a1a'), ('fang', '#fff8ec')])
BC = Vector((0, 0.02, 0.118))
RIB = 9
body = blob('par_body', BC, (0.118, 0.15, 0.098),
            lambda c, n, p: 'belly' if n.z < -0.55 else 'shell',
            lambda c: seg_w(c, ['head', 'chest', 'spine', 'hips']), seg=40, rings=24,
            fn=lambda v: Vector((v.x * (1 + 0.035 * math.cos(v.y * RIB * 0.5 * math.pi)) * (1 - 0.12 * max(0, v.y)), v.y, v.z * (1 + 0.035 * math.cos(v.y * RIB * 0.5 * math.pi)) * (1 - 0.25 * max(0, v.y)) * (0.85 if v.z < 0 else 1))))
# shell ribs: thin darker grooves across the back
for k, y in enumerate((-0.06, -0.02, 0.02, 0.06, 0.1, 0.135)):
    pts = []
    for i in range(13):
        ang = math.radians(-80 + 160 * i / 12); d = Vector((math.sin(ang), 0, math.cos(ang)))
        l, nn = shoot(body, Vector((0, y, BC.z)), d, fallback=True); pts.append(l + nn * 0.001)
    tube(f'par_rib{k}', pts, 0.0035, 'shell_dk', lambda c: seg_w(c, ['head', 'chest', 'spine', 'hips']), seg=5)
# face: eyes at the lower front corners, small mouth + fangs between them
for s, nm in ((1, 'l'), (-1, 'r')):
    ec = Vector((s * 0.068, -0.122, 0.085))
    blob(f'par_eye_{nm}', ec, (0.033, 0.028, 0.029), 'eye', 'head', seg=20, rings=12)
    blob(f'par_pupil_{nm}', ec + Vector((s * 0.004, -0.021, 0.004)), (0.007, 0.004, 0.008), 'pupil', 'head', seg=10, rings=6)
    f = cone(f'par_fang_{nm}', 0.006, 0.0, 0.016, verts=8, loc=Vector((s * 0.012, -0.142, 0.064))); f.rotation_euler = (math.radians(180), 0, 0)
    colorize(f, 'fang'); reg(f, 'head')
decal('par_mouth', body, Vector((0, -0.05, 0.075)), (0, -1, 0), (0.026, 0.006, 0.01), 'mouth', 'head', sink=0.3)
for k, (x, z) in enumerate(((-0.02, 0.125), (0.0, 0.12), (0.02, 0.125))):   # tiny nostril dots
    decal(f'par_dot{k}', body, Vector((x, -0.05, z - 0.02)), (0, -1, 0.2), (0.004, 0.002, 0.004), 'shell_dk', 'head', sink=0.2, seg=8, rings=5)
# pincers: short upper arm + big teardrop blade pointing forward / down / out
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = Vector((s * 0.09, -0.09, 0.11)); el = Vector((s * 0.15, -0.115, 0.11))
    tube(f'par_parm_{nm}', [sh, (sh + el) / 2 + Vector((0, 0, 0.01)), el], [0.016, 0.015, 0.014], 'claw', f'arm_{nm}', seg=10)
    d = Vector((s * 0.35, -0.55, -0.76)).normalized()
    blade = blob(f'par_claw_{nm}', el + d * 0.075, (0.046, 0.044, 0.1), lambda c, n_, p: 'shell_dk' if n_.dot(d) > 0.6 else 'claw', f'hand_{nm}', seg=20, rings=14,
                 fn=lambda v: Vector((v.x * (1 - 0.85 * max(0, -v.z)) * (1 + 0.15 * max(0, v.z)), v.y * 0.7 * (1 - 0.85 * max(0, -v.z)), v.z)))
    blade.rotation_mode = 'QUATERNION'; blade.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d)
    # mushroom: short stalk, wide cap tilted outward
    base = Vector((s * 0.05, 0.035, 0.175)); up = Vector((s * 0.55, 0.15, 1)).normalized()
    tube(f'par_stalk_{nm}', [base, base + up * 0.02, base + up * 0.04], [0.026, 0.022, 0.02], 'stalk', f'mush_{nm}', seg=10)
    cc = base + up * 0.055
    cap = blob(f'par_cap_{nm}', cc, (0.062, 0.062, 0.045), lambda c, n_, p, up=up: 'stalk' if n_.dot(up) < -0.35 else 'cap', f'mush_{nm}', seg=28, rings=14,
               fn=lambda v: Vector((v.x, v.y, v.z * (1 if v.z > 0 else 0.45))))
    cap.rotation_mode = 'QUATERNION'; cap.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(up)
    for j, (a, e) in enumerate(((0, 1.0), (0.0, 0.45), (2.1, 0.45), (4.2, 0.45), (1.05, 0.2), (3.15, 0.2), (5.25, 0.2))):
        q = Vector((0, 0, 1)).rotation_difference(up)
        dl = q @ Vector((math.cos(a) * math.sqrt(1 - e * e), math.sin(a) * math.sqrt(1 - e * e), e))
        decal(f'par_spot{j}_{nm}', cap, cc, dl, (0.014, 0.004, 0.012), 'spot', f'mush_{nm}', sink=0.25, seg=10, rings=6)
# legs: thin, splayed sideways with a raised knee (front & rear pairs rigged as legs, middle pair rides the spine)
LEGS = {}
for s, nm in ((1, 'l'), (-1, 'r')):
    for j, (y, name) in enumerate(((-0.04, 'arm'), (0.03, None), (0.1, 'thigh'))):
        hip = Vector((s * 0.095, y, 0.08)); knee = Vector((s * 0.15, y + 0.01 * (j - 1), 0.075)); foot = Vector((s * 0.17, y + 0.02 * (j - 1), 0.0))
        bn = f'{name}_{nm}' if name else 'spine'; bn2 = (('hand_' if name == 'arm' else 'foot_') + nm) if name else 'spine'
        tube(f'par_leg{j}_{nm}', [hip, knee], [0.009, 0.008], 'claw', bn, seg=8)
        tube(f'par_shin{j}_{nm}', [knee, (knee + foot) / 2 + Vector((s * 0.005, 0, 0)), foot + Vector((0, 0, 0.004))], [0.008, 0.007, 0.003], 'shell_dk', bn2, seg=8)
        if name: LEGS[f'{name}_{nm}'] = (tuple(hip), tuple(foot))
bones = quad_bones((0, 0.09, 0.1), (0, -0.05, 0.1), (0, -0.08, 0.1), (0, -0.1, 0.09), LEGS,
                   extra=[('mush_l', (0.05, 0.035, 0.175), 'spine'), ('mush_r', (-0.05, 0.035, 0.175), 'spine')])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.16, 0.07), 'head'), ('socket_fx', (0, 0.04, 0.27), 'spine')])
wob = lambda L, ph: swing(6, L, ph, 4, 1)
plan_clips(rig, 'quadruped', size=0.25, over={
    'idle': {'mush_l': wob(60, 0.0), 'mush_r': wob(60, 0.5), 'hand_l': swing(8, 60, 0.0, 4, 0), 'hand_r': swing(8, 60, 0.5, 4, 0)},
    'walk': {'mush_l': swing(8, 28, 0.0, 4, 1), 'mush_r': swing(8, 28, 0.5, 4, 1)},
    'attack_physical': {'hand_l': [(0, {}), (9, {'r': (35, 0, 0)}), (15, {'r': (-40, 0, 0)}), (28, {})], 'hand_r': [(0, {}), (9, {'r': (35, 0, 0)}), (15, {'r': (-40, 0, 0)}), (28, {})]},   # Scratch / Fury Cutter
    'attack_special': {'mush_l': [(0, {}), (14, {'s': (1.25, 1.25, 1.25)}), (22, {'s': (0.9, 0.9, 0.9)}), (40, {})], 'mush_r': [(0, {}), (14, {'s': (1.25, 1.25, 1.25)}), (22, {'s': (0.9, 0.9, 0.9)}), (40, {})]},   # spore puff
})
sheet('check', 0.3, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_special', 14, 'q34'), ('attack_physical', 15, 'q34')])
export(46, 'paras', 0.3, 'quadruped', rig, mesh, shiny={'shell': '#e8b23a', 'shell_dk': '#c08a2a', 'claw': '#e8b23a', 'cap': '#5aa83a', 'cap_dk': '#3a7a2a'})

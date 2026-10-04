# Gengar (94) · ghost/poison · 1.5 m. Evolution of Haunter — geometry matched to the reference silhouette (art-source/reference, comparison only):
# squat round dark-purple body that is all head, two pointed ears, a crest of big spikes running from the crown down the back,
# smaller spikes on the cheeks/flanks, red slanted eyes, huge wide grin full of square white teeth, short stubby arms with three
# clawed fingers, short legs with three-toed feet, little pointed tail.
reset('094_gengar')
M = pal([('body', '#5e4a8e'), ('body_dk', '#463668'), ('eyew', '#f0b0b8'), ('iris', '#d03040'), ('pupil', '#1a1018'), ('mouth', '#5a1a30'), ('teeth', '#f8f6ff'), ('claw', '#4a3a70')])
BC = Vector((0, 0.02, 0.72))
body = blob('gen_body', BC, (0.46, 0.42, 0.5), 'body', lambda c: lerp_w('spine', 'head', (c.z - 0.6) / 0.3), seg=48, rings=28,
            fn=lambda v: Vector((v.x * (1 + 0.08 * v.z), v.y * (1 + 0.04 * -v.z), v.z)))
def spike(name, base, d, r, length, bone, col='body'):
    o = cone(name, r, 0.004, length, verts=12, loc=base + d * length * 0.45)
    o.scale = (1, 0.6, 1); o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, col); reg(o, bone); return o
for s, nm in ((1, 'l'), (-1, 'r')):
    spike(f'gen_ear_{nm}', BC + Vector((s * 0.32, 0.0, 0.32)), Vector((s * 0.85, 0.05, 0.6)).normalized(), 0.14, 0.34, f'ear_{nm}')
    for j, (dz, L) in enumerate(((0.12, 0.2), (-0.05, 0.16))):   # cheek / flank spikes
        spike(f'gen_side{j}_{nm}', BC + Vector((s * 0.42, 0.05, dz)), Vector((s * 1, 0.25, 0.15 - 0.2 * j)).normalized(), 0.07, L, 'head' if j == 0 else 'spine')
    # back crest pairs
    for j, (z, y, L) in enumerate(((0.42, 0.2, 0.26), (0.25, 0.36, 0.3), (0.02, 0.43, 0.28), (-0.2, 0.38, 0.22))):
        spike(f'gen_back{j}_{nm}', Vector((s * 0.1, y, BC.z + z)), Vector((s * 0.35, 1, 0.6 - 0.3 * j)).normalized(), 0.09, L, 'head' if j < 2 else 'spine')
    # eyes: slanted, red iris, pale sclera
    e, l, n = decal(f'gen_eye_{nm}', body, BC + Vector((0, 0, 0.15)), (s * 0.36, -1, 0.35), (0.11, 0.015, 0.06), 'eyew', 'head', sink=0.25, up=(s * -0.35, 0, 1))
    ir, l2, n2 = decal(f'gen_iris_{nm}', e, l + Vector((-s * 0.015, 0, 0)), n, (0.05, 0.006, 0.045), 'iris', 'head', sink=0.0, seg=14)
    decal(f'gen_pupil_{nm}', ir, l2, n2, (0.014, 0.004, 0.014), 'pupil', 'head', sink=0.0, seg=8, rings=5)
    # arms: short, thick, three claws
    sh = BC + Vector((s * 0.4, -0.08, -0.12)); hd = sh + Vector((s * 0.16, -0.12, -0.08))
    tube(f'gen_arm_{nm}', [sh, (sh + hd) / 2, hd], [0.09, 0.075, 0.065], 'body', lambda c, nm=nm, sh=sh: lerp_w(f'arm_{nm}', f'hand_{nm}', (c - sh).length / 0.2), seg=14)
    for k in range(3):
        a = math.radians((k - 1) * 35)
        f0 = hd + Vector((s * 0.03, -0.03, 0)); d = Vector((s * 0.4 + math.sin(a) * 0.6, -0.8, -0.3 + math.cos(a) * 0.1)).normalized()
        tube(f'gen_finger{k}_{nm}', [f0, f0 + d * 0.07, f0 + d * 0.11], [0.03, 0.022, 0.004], 'body', f'hand_{nm}', seg=10)
    # legs: short, splayed, three toes
    th = Vector((s * 0.22, 0.05, 0.32)); ft = Vector((s * 0.3, -0.02, 0.06))
    tube(f'gen_leg_{nm}', [th, (th + ft) / 2, ft], [0.12, 0.1, 0.085], 'body', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.32 - c.z) / 0.26), seg=14)
    blob(f'gen_foot_{nm}', ft + Vector((0, -0.05, -0.02)), (0.1, 0.13, 0.05), 'body', f'foot_{nm}', seg=16, rings=10)
    for k in range(3):
        x = (k - 1) * 0.055
        t = cone(f'gen_toe{k}_{nm}', 0.025, 0.002, 0.06, verts=8, loc=ft + Vector((x + s * 0.01, -0.18, -0.03)))
        t.rotation_euler = (math.radians(90), 0, 0); colorize(t, 'claw'); reg(t, f'foot_{nm}')
# grin: huge crescent of white teeth (upper + lower rows separated by a dark line), tooth gaps as thin dark grooves
m, ml, mn = decal('gen_mouth', body, BC + Vector((0, 0, -0.05)), (0, -1, -0.05), (0.34, 0.015, 0.13), 'mouth', 'head', sink=0.25)
tw, tl, tn = decal('gen_teeth', m, ml + Vector((0, 0, 0.005)), mn, (0.31, 0.012, 0.11), 'teeth', 'head', sink=0.0, seg=32)
decal('gen_bite', tw, tl, tn, (0.3, 0.006, 0.008), 'mouth', 'head', sink=0.0, seg=16, rings=4)
for k in range(-4, 5):
    if k == 0: continue
    decal(f'gen_gap{k + 4}', tw, tl + Vector((k * 0.062, 0, 0)), tn, (0.004, 0.006, 0.1 - 0.012 * abs(k)), 'mouth', 'head', sink=0.0, seg=6, rings=4)
# tail
TP = [Vector(p) for p in ((0, 0.4, 0.38), (0, 0.52, 0.34), (0, 0.62, 0.36), (0, 0.68, 0.42))]
tube('gen_tail', TP, [0.08, 0.06, 0.035, 0.004], 'body', lambda c: seg_w(c, ['hips', 'tail1', 'tail2']), seg=12)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.05, 0.35), 'root'), ('spine', (0, 0.02, 0.6), 'hips'), ('chest', (0, 0.02, 0.8), 'spine'), ('head', (0, 0.02, 0.95), 'chest'),
         ('tail1', tuple(TP[1]), 'hips'), ('tail2', tuple(TP[2]), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'ear_{nm}', tuple(BC + Vector((s * 0.24, 0, 0.4))), 'head'), (f'arm_{nm}', tuple(BC + Vector((s * 0.4, -0.08, -0.12))), 'chest'),
              (f'hand_{nm}', tuple(BC + Vector((s * 0.56, -0.2, -0.2))), f'arm_{nm}'), (f'thigh_{nm}', (s * 0.22, 0.05, 0.32), 'hips'), (f'foot_{nm}', (s * 0.3, -0.02, 0.06), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.45, -0.06))), 'head'), ('socket_fx', tuple(BC + Vector((0, -0.5, 0.1))), 'head')])
plan_clips(rig, 'biped', size=1.0, over={'idle_alt': (90, {'chest': [(0, {}), (20, {'r': (-8, 0, 12)}), (45, {'r': (-8, 0, -12)}), (70, {}), (90, {})],
                                                          'arm_l': [(0, {}), (25, {'r': (0, 0, 30)}), (65, {'r': (0, 0, 30)}), (90, {})], 'arm_r': [(0, {}), (25, {'r': (0, 0, -30)}), (65, {'r': (0, 0, -30)}), (90, {})]}, True, None)})   # cackling sway
sheet('check', 1.6, poses=[('walk', 7, 'side'), ('idle_alt', 20, 'front'), ('attack_physical', 15, 'q34'), ('attack_special', 12, 'q34')])
export(94, 'gengar', 1.5, 'biped', rig, mesh, shiny={'body': '#8a8aa0', 'body_dk': '#5e5e74'})

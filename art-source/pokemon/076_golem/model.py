# Golem (76) · rock/ground · 1.4 m. Evolution of Graveler — geometry matched to the reference silhouette (art-source/reference, comparison only):
# a huge round boulder shell made of dark grey-green polygonal rock plates separated by deep grooves; a tan reptilian head pokes
# out low at the front (red eyes, heavy brow, open mouth with fangs); thick tan arms held out sideways with three white claws;
# short powerful legs with clawed feet; a small tail stub at the back.
reset('076_golem')
M = pal([('plate', '#5a6458'), ('plate_lt', '#6e786a'), ('groove', '#2e322c'), ('skin', '#9a7c68'), ('skin_dk', '#7a5e4c'), ('claw', '#ece8dc'),
         ('eye', '#c83030'), ('pupil', '#1a1210'), ('white', '#ffffff'), ('mouth', '#6a2a2a'), ('fang', '#f6f2ea')])
C = Vector((0, 0.08, 0.8)); RS = 0.56
shell = blob('gol_shell', C, (RS, RS, RS * 0.97), 'groove', 'spine', seg=56, rings=34)
# rock plates: fibonacci points, each a flattened faceted bulge leaving dark grooves between
N = 38
for i in range(N):
    z = 1 - 2 * (i + 0.5) / N; r = math.sqrt(1 - z * z); a = i * 2.39996
    d = Vector((math.cos(a) * r, math.sin(a) * r, z))
    if d.z < -0.75: continue
    if d.y < -0.6 and d.z < 0.0: continue   # opening for the head
    o, l, n = decal(f'gol_plate{i}', shell, C, d, (0.18, 0.035, 0.18), 'plate_lt' if i % 3 == 0 else 'plate', 'spine', sink=0.3, seg=6, rings=3)
# head: low in the front opening
HC = C + Vector((0, -0.55, -0.22))
head = blob('gol_head', HC, (0.2, 0.22, 0.15), lambda c, n, p: 'skin_dk' if n.z > 0.6 else 'skin', 'head', seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.25 * max(0, -v.y)), v.y, v.z)))
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'gol_eye_{nm}', head, HC + Vector((0, 0, 0.03)), (s * 0.45, -1, 0.3), (0.03, 0.01, 0.022), 'eye', 'head', sink=0.3, up=(s * -0.3, 0, 1))
    decal(f'gol_pupil_{nm}', e, l, n, (0.01, 0.004, 0.012), 'pupil', 'head', sink=0.0, seg=8, rings=5)
    decal(f'gol_brow_{nm}', head, HC + Vector((0, 0, 0.07)), (s * 0.4, -1, 0.6), (0.045, 0.02, 0.014), 'skin_dk', 'head', sink=0.1, up=(s * -0.4, 0, 1))
    f = cone(f'gol_fang_{nm}', 0.012, 0.0, 0.03, verts=8, loc=HC + Vector((s * 0.06, -0.19, -0.03))); f.rotation_euler = (math.radians(180), 0, 0); colorize(f, 'fang'); reg(f, 'head')
m, ml, mn = decal('gol_mouth', head, HC + Vector((0, 0, -0.04)), (0, -1, -0.2), (0.09, 0.015, 0.035), 'mouth', 'head', sink=0.3)
for s, nm in ((1, 'l'), (-1, 'r')):
    # arms out sideways
    sh = C + Vector((s * 0.48, -0.05, -0.12)); hd = C + Vector((s * 0.88, -0.06, -0.08))
    tube(f'gol_arm_{nm}', [sh, (sh + hd) / 2 + Vector((0, 0, 0.02)), hd], [0.11, 0.09, 0.085], 'skin', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (abs(c.x) - 0.6) / 0.2), seg=14)
    blob(f'gol_hand_{nm}', hd + Vector((s * 0.04, 0, 0)), (0.08, 0.085, 0.075), 'skin', f'hand_{nm}', seg=14, rings=8)
    for k in range(3):
        a = math.radians((k - 1) * 40)
        d = Vector((s * math.cos(a), -0.35 + math.sin(a) * 0.5, -0.1)).normalized()
        cl = cone(f'gol_claw{k}_{nm}', 0.03, 0.002, 0.12, verts=8, loc=hd + Vector((s * 0.1, 0, 0)) + d * 0.04)
        cl.rotation_mode = 'QUATERNION'; cl.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d); colorize(cl, 'claw'); reg(cl, f'hand_{nm}')
    # legs
    th = Vector((s * 0.3, 0.04, 0.38)); ft = Vector((s * 0.42, -0.02, 0.07))
    tube(f'gol_leg_{nm}', [th, (th + ft) / 2 + Vector((s * 0.03, -0.03, 0)), ft], [0.14, 0.12, 0.1], 'skin', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.36 - c.z) / 0.3), seg=14)
    blob(f'gol_foot_{nm}', ft + Vector((0, -0.05, -0.03)), (0.12, 0.15, 0.05), 'skin_dk', f'foot_{nm}', seg=16, rings=8)
    for k in range(3):
        cl = cone(f'gol_toe{k}_{nm}', 0.02, 0.002, 0.07, verts=8, loc=ft + Vector(((k - 1) * 0.06, -0.21, -0.04)))
        cl.rotation_euler = (math.radians(95), 0, 0); colorize(cl, 'claw'); reg(cl, f'foot_{nm}')
tube('gol_tail', [C + Vector((0, 0.5, -0.45)), C + Vector((0, 0.62, -0.55)), C + Vector((0, 0.7, -0.62))], [0.07, 0.05, 0.01], 'skin', 'hips', seg=10)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.36), 'root'), ('spine', tuple(C), 'hips'), ('head', tuple(HC), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(C + Vector((s * 0.48, -0.05, -0.12))), 'spine'), (f'hand_{nm}', tuple(C + Vector((s * 0.88, -0.06, -0.08))), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.3, 0.04, 0.38), 'hips'), (f'foot_{nm}', (s * 0.42, -0.02, 0.07), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.18, -0.04))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.22, 0.02))), 'head')])
plan_clips(rig, 'biped', size=1.2, over={'idle_alt': (90, {'head': [(0, {}), (15, {'t': (0, 0.1, 0.02)}), (60, {'t': (0, 0.1, 0.02)}), (75, {}), (90, {})],
                                                          'arm_l': [(0, {}), (15, {'r': (0, 0, -30)}), (60, {'r': (0, 0, -30)}), (90, {})], 'arm_r': [(0, {}), (15, {'r': (0, 0, 30)}), (60, {'r': (0, 0, 30)}), (90, {})]}, True, None)})   # pulls head and arms into the shell
sheet('check', 1.5, poses=[('walk', 7, 'side'), ('idle_alt', 30, 'front'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(76, 'golem', 1.4, 'biped', rig, mesh, shiny={'plate': '#8a7a50', 'plate_lt': '#a0905e', 'skin': '#c87a5a'})

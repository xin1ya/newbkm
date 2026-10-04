# Larvesta (636) · bug/fire · 1.1 m. Fuzzy larva: white fluffy segmented body, brown underside with stubby legs, five red horn-spikes crowning its head, blue eyes on a dark face.
reset('636_larvesta')
M = pal([('fluff', '#f4f0e8'), ('fluff_dk', '#d4ccc0'), ('brown', '#6a4a3a'), ('horn', '#e04a2a'), ('face', '#3a2e2a'), ('eye', '#5ab0e8'), ('white', '#ffffff')])
segs = [Vector((0, -0.18 + 0.15 * i, 0.16 - 0.01 * i)) for i in range(4)]
bones = [('root', (0, 0, 0), None), ('head', tuple(segs[0] + Vector((0, -0.05, 0.05))), 'root')]
for i, c in enumerate(segs):
    r = 0.17 - 0.025 * i
    blob(f'lv_seg{i}', c, (r, r * 0.8, r * 0.85), lambda c_, n, p: 'brown' if n.z < -0.6 else ('fluff_dk' if abs(n.y) > 0.75 else 'fluff'), 'head' if i == 0 else f'body{i}', seg=24, rings=14,
         fn=lambda v: Vector((v.x * (1 + 0.05 * math.sin(v.z * 20 + v.x * 13)), v.y, v.z * (1 + 0.05 * math.cos(v.x * 17)))))
    if i: bones.append((f'body{i}', tuple(c), 'head' if i == 1 else f'body{i - 1}'))
    for s in (1, -1):
        blob(f'lv_leg{i}_{s + 1}', c + Vector((s * r * 0.6, -0.01, -r * 0.8)), (0.03, 0.03, 0.03), 'brown', 'head' if i == 0 else f'body{i}', seg=8, rings=5)
H = segs[0] + Vector((0, -0.12, 0.03))
face = blob('lv_face', H, (0.1, 0.05, 0.08), 'face', 'head', seg=18, rings=10)
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'lv_eye_{nm}', face, H + Vector((0, 0, 0.01)), (s * 0.5, -1, 0.1), (0.028, 0.008, 0.03), 'eye', 'head', sink=0.2, seg=10, rings=6)
for k in range(5):
    a = math.radians(-60 + 30 * k)
    o = cone(f'lv_horn{k}', 0.035, 0.004, 0.17, verts=8, loc=segs[0] + Vector((math.sin(a) * 0.1, -0.02, 0.18 + 0.03 * math.cos(a)))); o.rotation_euler = (math.radians(-15), math.radians(math.degrees(a) * 0.8), 0); colorize(o, 'horn'); reg(o, 'head')
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(H + Vector((0, -0.06, -0.03))), 'head'), ('socket_fx', tuple(H + Vector((0, -0.1, 0))), 'head')])
plan_clips(rig, 'larva', size=1.1)
sheet('check', 1.1, poses=[('walk', 10, 'side'), ('attack_physical', 15, 'q34')])
export(636, 'larvesta', 1.1, 'larva', rig, mesh, shiny={'horn': '#4aa8e8', 'eye': '#e85a3a'})

# Steelix (208) · steel/ground · 9.2 m. Giant serpent of steel-grey cylinder segments, each ringed by blocky protrusions; long jaw head with a square mouth of teeth, horn-like crest plates, red eyes; spiked tail.
reset('208_steelix')
M = pal([('grey', '#8a96a8'), ('grey_dk', '#5a6474'), ('eye', '#d83a3a'), ('tooth', '#f0f0f0'), ('white', '#ffffff')])
N = 12
# body arcs: rises from the ground into an S-curve, head high at front
pts = []
for i in range(N):
    t = i / (N - 1)
    pts.append(Vector((0.6 * math.sin(t * 5.5), 0.3 + 3.5 * t - 1.2 * t * t, 0.4 + 3.6 * (1 - t) ** 1.6 * (0.6 + 0.4 * math.cos(t * 3)))))
pts = pts[::-1]  # pts[0] = tail end ... reversed so head last
pts = [p for p in reversed(pts)]
bones = [('root', (0, 0, 0), None)]
for i, p in enumerate(pts):
    r = 0.62 - 0.4 * (i / (N - 1))
    bn = 'head' if i == 0 else f'body{i}'
    fn = (lambda v: Vector((v.x + 0.08 * math.sin(v.y * 7) * v.x, v.y, v.z + 0.06 * math.cos(v.x * 6))))
    blob(f'stx_seg{i}', p, (r, r * 0.95, r * 0.9) if i else (0.55, 0.7, 0.42), lambda c, n, p_: 'grey_dk' if n.z < -0.5 else 'grey', bn, seg=14, rings=9, fn=fn)
    if i:
        for k in range(6):
            a = 2 * math.pi * k / 6 + i * 0.5
            blob(f'stx_knob{i}_{k}', p + Vector((math.cos(a) * r * 0.95, math.sin(a) * r * 0.2, math.sin(a) * r * 0.9)), (r * 0.28, r * 0.28, r * 0.28), 'grey_dk', bn, seg=4, rings=3)
    bones.append((bn, tuple(p), 'root' if i == 0 else ('head' if i == 1 else f'body{i - 1}')))
H = pts[0]
for s_ in (1, -1):
    o = cone(f'stx_crest{s_ + 1}', 0.2, 0.02, 0.7, verts=4, loc=H + Vector((s_ * 0.3, 0.3, 0.45))); o.scale = (0.35, 1, 1); o.rotation_euler = (math.radians(40), math.radians(s_ * 25), 0); colorize(o, 'grey_dk'); reg(o, 'head')
for k in range(6):
    blob(f'stx_tooth{k}', H + Vector(((k - 2.5) * 0.15, -0.68, -0.18)), (0.06, 0.04, 0.08), 'tooth', 'head', seg=6, rings=4)
o = cone('stx_horn', 0.22, 0.02, 0.6, verts=4, loc=H + Vector((0, 0.15, 0.55))); o.scale = (0.35, 1, 1); o.rotation_euler = (math.radians(20), 0, 0); colorize(o, 'grey_dk'); reg(o, 'head')
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'stx_eye_{nm}', bpy.data.objects['stx_seg0'], H + Vector((0, 0, 0.05)), (s * 0.6, -1, 0.3), (0.08, 0.02, 0.05), 'eye', 'head', sink=0.2)
o = cone('stx_tip', 0.15, 0.03, 0.4, verts=6, loc=pts[-1] + Vector((0, 0.3, 0.0))); o.rotation_euler = (math.radians(-80), 0, 0); colorize(o, 'grey'); reg(o, f'body{N - 1}')
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(H + Vector((0, -0.7, -0.1))), 'head'), ('socket_fx', tuple(H + Vector((0, -0.9, 0))), 'head')])
plan_clips(rig, 'serpent', size=4.0)
sheet('check', 4.2, poses=[('attack_physical', 15, 'side')])
export(208, 'steelix', 9.2, 'serpent', rig, mesh, shiny={'grey': '#d8b040', 'grey_dk': '#a88020'})

# Steelix (208) · steel/ground · 9.2 m. Giant serpent of steel-grey cylinder segments, each ringed by blocky protrusions; long jaw head with a square mouth of teeth, horn-like crest plates, red eyes; spiked tail.
reset('208_steelix')
M = pal([('grey', '#8a96a8'), ('grey_dk', '#5a6474'), ('eye', '#d83a3a'), ('tooth', '#f0f0f0'), ('white', '#ffffff')])
N = 8
SP = [0.344, 1.089, -0.601, 0.444, -0.061, -0.694, -0.271, -0.295]
CP = [-0.026, -2.076, 0.435, -0.040, -1.358, 0.462, -0.043, -0.337, 0.356, -0.135, 0.655, 0.280, 0.167, 1.821, 0.301, 0.030, 2.481, 0.302, 0.023, 3.311, 0.320]
RP = [0.6, 0.2, 1.0]
_C = [Vector(CP[i:i + 3]) for i in range(0, len(CP), 3)]
def _cr(t):
    n = len(_C) - 1; u = min(t * n, n - 1e-6); k = int(u); f = u - k
    p0, p1, p2, p3 = _C[max(k - 1, 0)], _C[k], _C[k + 1], _C[min(k + 2, n)]
    return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)
pts = [_cr(i / (N - 1)) for i in range(N)]
bones = [('root', (0, 0, 0), None)]
for i, p in enumerate(pts):
    r = RP[0] - (RP[0] - RP[1]) * (i / (N - 1)) ** RP[2]
    bn = 'head' if i == 0 else f'body{i}'
    fn = (lambda v: Vector((v.x + 0.08 * math.sin(v.y * 7) * v.x, v.y, v.z + 0.06 * math.cos(v.x * 6))))
    blob(f'stx_seg{i}', p, (r, r * 0.95, r * 0.9) if i else (0.85, 0.85, 0.5), lambda c, n, p_: 'grey_dk' if n.z < -0.5 else 'grey', bn, seg=14, rings=9, fn=fn)
    if i:
        L = SP[i]
        for sd in ((1, -1) if L > 0.08 else ()):
            o = cone(f'stx_spk{i}_{sd + 1}', r * 0.35, 0.02, L, verts=6, loc=p + Vector((sd * (r + L * 0.45), 0, 0))); o.rotation_euler = (0, math.radians(sd * 90), 0); colorize(o, 'grey_dk'); reg(o, bn)
        for k in range(4):
            a_ = math.pi / 4 + k * math.pi / 2
            blob(f'stx_knob{i}_{k}', p + Vector((math.cos(a_) * r * 0.9, 0, math.sin(a_) * r * 0.85)), (r * 0.22, r * 0.22, r * 0.22), 'grey_dk', bn, seg=4, rings=3)
    bones.append((bn, tuple(p), 'root' if i == 0 else ('head' if i == 1 else f'body{i - 1}')))
for i in range(1, N - 1):
    ra = RP[0] - (RP[0] - RP[1]) * ((i + 0.5) / (N - 1)) ** RP[2]
    blob(f'stx_link{i}', (pts[i] + pts[i + 1]) / 2, (ra * 0.7, ra * 0.8, ra * 0.65), 'grey_dk', lambda c, i=i: lerp_w(f'body{i}', f'body{i + 1}', 0.5), seg=10, rings=6)
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

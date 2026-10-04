# Onix (95) · rock/ground · 8.8 m. Giant snake of grey boulders, decreasing in size to the tail; rugged head boulder with a ridge horn on top, small eyes; tail ends in a small rock.
reset('095_onix')
M = pal([('grey', '#9a9aa2'), ('grey_dk', '#6a6a74'), ('eye', '#1a1418'), ('white', '#ffffff')])
N = 18
CP = [-1.452, -2.467, 3.481, -0.423, -0.975, 4.672, 1.165, -0.524, 3.691, 1.780, -0.064, 2.100, 1.220, 1.157, 1.127, 0.671, 1.985, 1.004, -1.245, 1.815, 0.902]
RP = [0.62, 0.22, 1.0]
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
    blob(f'ox_seg{i}', p, (r, r * 0.95, r * 0.9) if i else (0.55, 0.7, 0.42), lambda c, n, p_: 'grey_dk' if n.z < -0.5 else 'grey', bn, seg=14, rings=9, fn=fn)
    bones.append((bn, tuple(p), 'root' if i == 0 else ('head' if i == 1 else f'body{i - 1}')))
for i in range(1, N - 1):
    ra = RP[0] - (RP[0] - RP[1]) * ((i + 0.5) / (N - 1)) ** RP[2]
    blob(f'ox_link{i}', (pts[i] + pts[i + 1]) / 2, (ra * 0.75, ra * 0.75, ra * 0.7), 'grey_dk', lambda c, i=i: lerp_w(f'body{i}', f'body{i + 1}', 0.5), seg=10, rings=6)
H = pts[0]
o = cone('ox_horn', 0.22, 0.02, 0.8, verts=4, loc=H + Vector((0, 0.15, 0.75))); o.scale = (0.35, 1, 1); o.rotation_euler = (math.radians(20), 0, 0); colorize(o, 'grey_dk'); reg(o, 'head')
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'ox_eye_{nm}', bpy.data.objects['ox_seg0'], H + Vector((0, 0, 0.05)), (s * 0.6, -1, 0.3), (0.08, 0.02, 0.05), 'eye', 'head', sink=0.2)
o = cone('ox_tip', 0.15, 0.03, 0.4, verts=6, loc=pts[-1] + Vector((0, 0.3, 0.0))); o.rotation_euler = (math.radians(-80), 0, 0); colorize(o, 'grey'); reg(o, f'body{N - 1}')
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(H + Vector((0, -0.7, -0.1))), 'head'), ('socket_fx', tuple(H + Vector((0, -0.9, 0))), 'head')])
plan_clips(rig, 'serpent', size=4.0)
sheet('check', 4.2, poses=[('attack_physical', 15, 'side')])
export(95, 'onix', 8.8, 'serpent', rig, mesh, shiny={'grey': '#a8a060', 'grey_dk': '#787040'})

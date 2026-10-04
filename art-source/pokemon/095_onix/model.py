# Onix (95) · rock/ground · 8.8 m. Giant snake of grey boulders, decreasing in size to the tail; rugged head boulder with a ridge horn on top, small eyes; tail ends in a small rock.
reset('095_onix')
M = pal([('grey', '#9a9aa2'), ('grey_dk', '#6a6a74'), ('eye', '#1a1418'), ('white', '#ffffff')])
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
    blob(f'ox_seg{i}', p, (r, r * 0.95, r * 0.9) if i else (0.55, 0.7, 0.42), lambda c, n, p_: 'grey_dk' if n.z < -0.5 else 'grey', bn, seg=14, rings=9, fn=fn)
    bones.append((bn, tuple(p), 'root' if i == 0 else ('head' if i == 1 else f'body{i - 1}')))
H = pts[0]
o = cone('ox_horn', 0.22, 0.02, 0.6, verts=4, loc=H + Vector((0, 0.15, 0.55))); o.scale = (0.35, 1, 1); o.rotation_euler = (math.radians(20), 0, 0); colorize(o, 'grey_dk'); reg(o, 'head')
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'ox_eye_{nm}', bpy.data.objects['ox_seg0'], H + Vector((0, 0, 0.05)), (s * 0.6, -1, 0.3), (0.08, 0.02, 0.05), 'eye', 'head', sink=0.2)
o = cone('ox_tip', 0.15, 0.03, 0.4, verts=6, loc=pts[-1] + Vector((0, 0.3, 0.0))); o.rotation_euler = (math.radians(-80), 0, 0); colorize(o, 'grey'); reg(o, f'body{N - 1}')
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(H + Vector((0, -0.7, -0.1))), 'head'), ('socket_fx', tuple(H + Vector((0, -0.9, 0))), 'head')])
plan_clips(rig, 'serpent', size=4.0)
sheet('check', 4.2, poses=[('attack_physical', 15, 'side')])
export(95, 'onix', 8.8, 'serpent', rig, mesh, shiny={'grey': '#a8a060', 'grey_dk': '#787040'})

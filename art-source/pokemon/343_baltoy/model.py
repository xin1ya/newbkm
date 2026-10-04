# Baltoy (343) · ground/psychic · 0.5 m. Clay spinning-top figure: tan/brown body shaped like a top with a pointed base, a flat cap with red dots on top, many small black eye dots on the upper section, two stubby arms ending in round hands; it spins on its point.
reset('343_baltoy')
M = pal([('clay', '#c8a070'), ('clay_dk', '#8a6a44'), ('band', '#6a4a30'), ('red', '#c83a2a'), ('eye', '#1a1418'), ('white', '#ffffff')])
BC = Vector((0, 0, 0.26))
body = blob('bt_body', BC, (0.13, 0.13, 0.14), lambda c, n, p: 'band' if abs(c.z - BC.z) < 0.012 else ('clay_dk' if n.z < -0.4 else 'clay'), 'spine', seg=28, rings=16,
            fn=lambda v: Vector((v.x * (1 - 0.5 * max(0, -v.z) ** 1.5), v.y * (1 - 0.5 * max(0, -v.z) ** 1.5), v.z)))
o = cone('bt_point', 0.07, 0.005, 0.14, verts=16, loc=BC + Vector((0, 0, -0.18))); o.rotation_euler = (math.pi, 0, 0); colorize(o, 'clay_dk'); reg(o, 'spine')
cap = blob('bt_cap', BC + Vector((0, 0, 0.15)), (0.12, 0.12, 0.03), 'clay', 'head', seg=24, rings=8)
for k in range(4):
    a = 2 * math.pi * k / 4
    blob(f'bt_dot{k}', BC + Vector((math.cos(a) * 0.07, math.sin(a) * 0.07, 0.178)), (0.015, 0.015, 0.006), 'red', 'head', seg=8, rings=4)
for k in range(8):
    a = 2 * math.pi * k / 8
    decal(f'bt_eye{k}', body, BC + Vector((0, 0, 0.06)), (math.cos(a), math.sin(a), 0.5), (0.012, 0.004, 0.012), 'eye', 'head', sink=0.2, seg=8, rings=5)
for s, nm in ((1, 'l'), (-1, 'r')):
    tube(f'bt_arm_{nm}', [BC + Vector((s * 0.12, 0, 0.0)), BC + Vector((s * 0.19, 0, 0.0))], [0.018, 0.015], 'clay_dk', f'arm_{nm}', seg=8)
    blob(f'bt_hand_{nm}', BC + Vector((s * 0.21, 0, 0.0)), (0.03, 0.03, 0.03), 'clay', f'hand_{nm}', seg=12, rings=8)
bones = [('root', (0, 0, 0), None), ('spine', tuple(BC), 'root'), ('head', tuple(BC + Vector((0, 0, 0.1))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.12, 0, 0))), 'spine'), (f'hand_{nm}', tuple(BC + Vector((s * 0.2, 0, 0))), f'arm_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.14, 0.05))), 'head'), ('socket_fx', tuple(BC + Vector((0, 0, 0.3))), 'head')])
spin = lambda L: {'root': loop([(0, {'r': (0, 0, 0)}), (L // 2, {'r': (0, 180, 0)}), (L - 1, {'r': (0, 359, 0)})], L)}
plan_clips(rig, 'rigid', size=0.5, over={'walk': spin(20), 'run': spin(10), 'attack_special': spin(40)})
sheet('check', 0.5, poses=[('idle', 6, 'side'), ('attack_special', 12, 'q34')])
export(343, 'baltoy', 0.5, 'rigid', rig, mesh, shiny={'clay': '#e0c8a0', 'clay_dk': '#a88a64'})

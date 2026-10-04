# Quagsire (195) · water/ground · 1.4 m. Evolution of Wooper — geometry matched to the reference (art-source/reference, comparison only):
# one tall pear-shaped body with the head fused on top (no neck), blue with a paler belly, tiny dot eyes high on the face, a wide calm smile,
# two little rounded nubs on the crown, short arms held forward with three stubby fingers, short thick legs with flat feet,
# a long flat paddle tail, and a purple dorsal ridge running from the back of the head down the spine onto the tail.
reset('195_quagsire')
M = pal([('blue', '#5a9cc8'), ('blue_lt', '#86bede'), ('blue_dk', '#3c76a4'), ('ridge', '#7a5aa8'), ('ridge_dk', '#5a3e84'),
         ('eye', '#1a1418'), ('mouth', '#1e3c5c'), ('white', '#ffffff')])
BC = Vector((0, 0.0, 0.62))
def pear(v):
    k = 1 - 0.3 * max(0.0, v.z) ** 1.2 + 0.1 * max(0.0, -v.z) * (1 - max(0.0, -v.z) ** 4)
    return Vector((v.x * k, v.y * k, v.z))
body = blob('qua_body', BC, (0.33, 0.3, 0.58), lambda c, n, p: 'blue_lt' if (n.y < -0.55 and c.z < 0.95) else 'blue',
            lambda c: lerp_w('spine', 'head', (c.z - 0.75) / 0.3), seg=40, rings=26, fn=pear)
HZ = 1.05
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'qua_eye_{nm}', body, Vector((0, 0, HZ + 0.03)), (s * 0.35, -1, 0.0), (0.016, 0.008, 0.018), 'eye', 'head', sink=0.2, seg=12, rings=6)
    decal(f'qua_shine_{nm}', e, l + Vector((0, -0.002, 0.005)), n, (0.005, 0.002, 0.005), 'white', 'head', sink=0.05, seg=8, rings=5)
    # crown nubs
    l2, n2 = shoot(body, Vector((s * 0.06, 0, HZ + 0.1)), Vector((s * 0.4, 0.1, 1)).normalized())
    blob(f'qua_nub_{nm}', l2 + n2 * 0.01, (0.03, 0.03, 0.035), 'blue', 'head', seg=12, rings=8)
pts = []
for i in range(13):
    a = math.radians(-50 + 100 * i / 12)
    d = Vector((math.sin(a), -math.cos(a), 0.0)).normalized()
    l, nn = shoot(body, Vector((0, 0, HZ - 0.06 + 0.03 * (a / math.radians(50)) ** 2)), d); pts.append(l + nn * 0.002)
tube('qua_mouth', pts, 0.007, 'mouth', 'head', seg=6)
# dorsal ridge: a row of flat purple fins down the back, continuing onto the tail
RD = []
for i in range(7):
    z = HZ + 0.05 - i * 0.13
    l, nn = shoot(body, Vector((0, 0, z)), Vector((0, 1, 0.15)).normalized()); RD.append((l, nn))
for i, (l, nn) in enumerate(RD):
    blob(f'qua_ridge{i}', l + nn * 0.01, (0.008, 0.07, 0.03 - 0.002 * i), 'ridge' if i % 2 == 0 else 'ridge_dk',
         'head' if i < 2 else 'spine' if i < 5 else 'hips', seg=10, rings=6, rot=(math.degrees(math.atan2(nn.z, nn.y)) * 0.0 - 15, 0, 0))
# short arms held forward, stubby fingers
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = Vector((s * 0.22, -0.08, 0.68)); el = sh + Vector((s * 0.04, -0.14, 0.0)); wr = el + Vector((s * 0.0, -0.14, 0.0))
    tube(f'qua_arm_{nm}', [sh + Vector((-s * 0.04, 0.02, 0)), el, wr], [0.06, 0.05, 0.045], 'blue', lambda c, nm=nm, sh=sh: lerp_w(f'arm_{nm}', f'hand_{nm}', ((c - sh).length - 0.08) / 0.08), seg=12)
    blob(f'qua_hand_{nm}', wr + Vector((0, -0.03, 0)), (0.045, 0.045, 0.04), 'blue', f'hand_{nm}', seg=14, rings=8)
    for k in range(3):
        f0 = wr + Vector((s * (k - 1) * 0.022, -0.065, -0.005))
        blob(f'qua_finger{k}_{nm}', f0, (0.014, 0.022, 0.016), 'blue_dk', f'hand_{nm}', seg=8, rings=5)
# short thick legs, flat feet
for s, nm in ((1, 'l'), (-1, 'r')):
    hp = Vector((s * 0.14, 0.0, 0.18)); ft = Vector((s * 0.15, -0.01, 0.04))
    tube(f'qua_leg_{nm}', [hp, ft], [0.09, 0.075], 'blue', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.16 - c.z) / 0.1), seg=14)
    blob(f'qua_foot_{nm}', Vector((s * 0.15, -0.09, 0.025)), (0.09, 0.14, 0.03), 'blue_dk', f'foot_{nm}', seg=16, rings=8)
# long flat paddle tail
TP = [BC + Vector((0, 0.2, -0.42)), BC + Vector((0, 0.42, -0.53)), BC + Vector((0, 0.66, -0.56)), BC + Vector((0, 0.86, -0.55))]
tube('qua_tail', TP, [0.11, 0.12, 0.1, 0.04], lambda c, n, p: 'blue_lt' if n.z > 0.5 else 'blue', lambda c: seg_w(c, ['hips', 'tail1', 'tail2']), seg=14, flat=0.5)
for i in range(3):
    c0 = TP[0].lerp(TP[3], 0.15 + 0.3 * i) + Vector((0, 0, 0.05))
    blob(f'qua_tridge{i}', c0, (0.01, 0.06, 0.035), 'ridge', 'tail1' if i < 1 else 'tail2', seg=10, rings=6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.0, 0.25), 'root'), ('spine', tuple(BC), 'hips'), ('head', (0, 0, 0.9), 'spine'),
         ('tail1', tuple(TP[0]), 'hips'), ('tail2', tuple(TP[2]), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.22, -0.08, 0.68), 'spine'), (f'hand_{nm}', (s * 0.26, -0.22, 0.68), f'arm_{nm}'),
              (f'thigh_{nm}', (s * 0.14, 0, 0.18), 'hips'), (f'foot_{nm}', (s * 0.15, -0.01, 0.05), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.3, HZ - 0.06), 'head'), ('socket_fx', (0, -0.32, HZ), 'head')])
plan_clips(rig, 'biped', size=1.4)
sheet('check', 1.45, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_physical', 14, 'q34'), ('idle', 20, 'front')])
export(195, 'quagsire', 1.4, 'biped', rig, mesh, shiny={'blue': '#c8a0d8', 'blue_lt': '#dcbce8', 'blue_dk': '#a07ab8', 'ridge': '#5a8ad0'})

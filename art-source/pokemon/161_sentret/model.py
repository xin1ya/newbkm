# Sentret (161) · normal · 0.8 m. v2 — geometry matched to the reference silhouette (art-source/reference, comparison only):
# one egg-shaped head-body with a cream ring on the belly, long upright ears angled outward (pink inside, dark tips), short pointed arm stubs
# sticking out sideways, little legs dangling below — it stands balanced on its tail, which drops from the lower back and curls forward
# into a banded coil on the ground.
reset('161_sentret')
M = pal([('fur', '#8a5a3c'), ('fur_dk', '#4a2e22'), ('cream', '#f0dcb4'), ('ear_in', '#d97a8e'), ('eye', '#1a1418'), ('white', '#ffffff'), ('nose', '#3a2420'), ('mouth', '#5a3226')])
BC = Vector((0, 0.0, 0.46))
body = blob('sen_body', BC, (0.15, 0.148, 0.165), 'fur', lambda c: lerp_w('spine', 'head', (c.z - 0.42) / 0.14), seg=40, rings=24,
            fn=lambda v: Vector((v.x * (1 - 0.1 * max(0, v.z)), v.y * (1 - 0.06 * max(0, v.z)), v.z)))
# belly ring (cream "O")
ring_c = BC + Vector((0, 0, -0.03)); pts = []
for i in range(25):
    a = 2 * math.pi * i / 24; d = Vector((math.sin(a) * 0.32, -1, math.cos(a) * 0.42)).normalized()
    l, nn = shoot(body, ring_c, d); pts.append(l + nn * 0.002)
tube('sen_belly_ring', pts, 0.017, 'cream', 'spine', seg=8, flat=0.35)
# face (upper front of the egg): small eyes, nose, mouth, cheek tufts
for s, nm in ((1, 'l'), (-1, 'r')):
    eye(nm, body, BC + Vector((0, 0, 0.1)), (s * 0.36, -1, 0.55), 0.022, 0.028, 'head', sink=0.3)
    # ears: long, angled outward, pink inner, dark tip
    eb = BC + Vector((s * 0.06, 0.02, 0.14)); d = Vector((s * 0.36, 0.08, 1)).normalized(); L = 0.21
    def ecol(c, n_, p, eb=eb, d=d):
        t = (c - eb).dot(d) / 0.21
        if t > 0.8: return 'fur_dk'
        return 'ear_in' if (n_.y < -0.45 and t > 0.15) else 'fur'
    tube(f'sen_ear_{nm}', [eb + d * L * t for t in (0, 0.25, 0.55, 0.8, 0.95, 1.0)], [0.026, 0.032, 0.03, 0.022, 0.012, 0.003], ecol,
         lambda c, nm=nm, eb=eb, d=d: lerp_w('head', f'ear_{nm}', (c - eb).dot(d) / 0.21 * 2), seg=12, flat=0.55)
    # arm stubs: short, pointed, horizontal
    sh = BC + Vector((s * 0.13, -0.02, 0.0))
    tube(f'sen_arm_{nm}', [sh, sh + Vector((s * 0.05, -0.01, 0.01)), sh + Vector((s * 0.09, -0.015, 0.02)), sh + Vector((s * 0.1, -0.015, 0.022))], [0.034, 0.028, 0.014, 0.003], 'fur', f'arm_{nm}', seg=10)
    # legs: short, dangling below the body; cream feet
    th = Vector((s * 0.075, 0.0, 0.33)); ft = Vector((s * 0.09, -0.02, 0.215))
    tube(f'sen_leg_{nm}', [th, (th + ft) / 2, ft], [0.035, 0.03, 0.026], 'fur', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.33 - c.z) / 0.11), seg=12)
    blob(f'sen_foot_{nm}', ft + Vector((0, -0.015, -0.005)), (0.03, 0.04, 0.022), 'cream', f'foot_{nm}', seg=14, rings=8)
blob('sen_nose', BC + Vector((0, -0.145, 0.07)), (0.012, 0.008, 0.008), 'nose', 'head', seg=10, rings=6)
decal('sen_mouth', body, BC + Vector((0, 0, 0.045)), (0, -1, 0.3), (0.016, 0.005, 0.005), 'mouth', 'head', sink=0.3)
for s in (1, -1):   # whisker spots
    for k in range(3):
        decal(f'sen_wsp{k}_{s + 1}', body, BC + Vector((0, 0, 0.05)), (s * (0.35 + 0.08 * k), -1, 0.3 + 0.06 * (k % 2)), (0.004, 0.002, 0.004), 'fur_dk', 'head', sink=0.2, seg=6, rings=4)
# tail: from the lower back straight down, then curling forward along the ground into a coil; dark bands
TP = [Vector(p) for p in ((0, 0.08, 0.34), (0, 0.11, 0.25), (0, 0.1, 0.15), (0, 0.06, 0.07), (0, -0.01, 0.04), (0, -0.08, 0.045), (0, -0.125, 0.075), (0, -0.12, 0.12), (0, -0.075, 0.135), (0, -0.04, 0.11))]
TR = [0.04, 0.042, 0.046, 0.05, 0.052, 0.052, 0.05, 0.046, 0.04, 0.03]
dense = []
for i in range(len(TP) - 1):
    for k in range(10): dense.append(TP[i].lerp(TP[i + 1], k / 10))
dense.append(TP[-1])
def tail_t(c):
    j = min(range(len(dense)), key=lambda i: (dense[i] - c).length_squared); return j / (len(dense) - 1)
tube('sen_tail', TP, TR, lambda c, n, p: 'fur_dk' if (0.2 < tail_t(c) < 0.98 and int(tail_t(c) * 9) % 2 == 1) else 'fur',
     lambda c: seg_w(c, ['hips', 'tail1', 'tail2', 'tail3', 'tail4']), seg=16)
bones = [('root', (0, 0, 0), None), ('tail1', tuple(TP[4]), 'root'), ('hips', (0, 0.02, 0.33), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.52), 'spine'), ('head', (0, 0, 0.56), 'chest'),
         ('tail2', tuple(TP[2]), 'hips'), ('tail3', tuple(TP[6]), 'tail1'), ('tail4', tuple(TP[8]), 'tail3')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.13, -0.02, 0))), 'chest'), (f'thigh_{nm}', (s * 0.075, 0, 0.33), 'hips'), (f'foot_{nm}', (s * 0.09, -0.02, 0.22), f'thigh_{nm}'),
              (f'ear_{nm}', tuple(BC + Vector((s * 0.07, 0.02, 0.17))), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.16, 0.04))), 'head'), ('socket_fx', tuple(BC + Vector((0, -0.18, 0.06))), 'head')])
plan_clips(rig, 'biped', size=0.5, over={'idle_alt': (100, {'chest': [(0, {}), (20, {'r': (-6, 0, 0)}), (70, {'r': (-6, 0, 0)}), (100, {})],
                                                            'head': [(0, {}), (25, {'r': (-8, 30, 0)}), (50, {'r': (-8, -30, 0)}), (75, {'r': (-8, 0, 0)}), (100, {})]}, True, None)})   # lookout: stretches up on its tail and scans around
sheet('check', 0.85, poses=[('walk', 7, 'side'), ('idle_alt', 25, 'q34'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(161, 'sentret', 0.8, 'biped', rig, mesh, shiny={'fur': '#c9734a', 'fur_dk': '#7e3a20'})

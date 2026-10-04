# Furret (162) · normal · 1.8 m long. Evolution of Sentret — geometry matched to the reference silhouette (art-source/reference, comparison only):
# a very long, low, sausage-like ferret body ringed with cream / brown bands from neck to rounded tail tip, big round cat-like head with
# wide pointed ears, cream face with brown mask over the brow, large eyes, tiny stubby legs with cream paws.
reset('162_furret')
M = pal([('fur', '#8a5a3c'), ('fur_dk', '#5e3a28'), ('cream', '#e6d2b2'), ('ear_in', '#d97a8e'), ('eye', '#1a1418'), ('iris', '#2f6a5a'), ('white', '#ffffff'),
         ('nose', '#3a2420'), ('mouth', '#5a3226')])
HC = Vector((0, -0.66, 0.25))
# body: one long tube from behind the head to the rounded tail tip, slightly undulating; alternating cream/brown bands
BP = [Vector(p) for p in ((0, -0.6, 0.24), (0, -0.45, 0.235), (0, -0.2, 0.235), (0, 0.1, 0.24), (0, 0.4, 0.245), (0, 0.6, 0.24), (0, 0.8, 0.235), (0, 0.9, 0.23), (0, 0.96, 0.23), (0, 0.99, 0.23))]
BR = [0.15, 0.175, 0.18, 0.182, 0.18, 0.175, 0.16, 0.13, 0.08, 0.01]
CH = ['chest', 'spine', 'hips', 'tail1', 'tail2', 'tail3']
def band(c, n, p):
    k = int((c.y + 0.5) / 0.16)
    if c.y < -0.5: return 'fur'
    return 'cream' if k % 2 == 0 else 'fur'
DP, DR = [], []
for i in range(len(BP) - 1):
    for k in range(6): t = k / 6; DP.append(BP[i].lerp(BP[i + 1], t)); DR.append(BR[i] + (BR[i + 1] - BR[i]) * t)
DP.append(BP[-1]); DR.append(BR[-1])
body = tube('fur_body', DP, DR, band, lambda c: seg_w(c, CH), seg=24)

# head: round, slightly wider than tall, cream face, brown cap; ears wide and pointed
head = blob('fur_head', HC, (0.19, 0.17, 0.17), lambda c, n, p: 'fur' if (n.z > 0.45 or (n.y > -0.2 and n.z > -0.3) or abs(n.x) > 0.8) else 'cream', 'head', seg=36, rings=22,
            fn=lambda v: Vector((v.x * (1 + 0.08 * max(0, -v.z)), v.y, v.z)))
for s, nm in ((1, 'l'), (-1, 'r')):
    eye(nm, head, HC + Vector((0, 0, 0.02)), (s * 0.42, -1, 0.15), 0.036, 0.042, 'head', sink=0.3)
    eb = HC + Vector((s * 0.1, 0.02, 0.1)); d = Vector((s * 0.75, 0.05, 0.75)).normalized()
    def ecol(c, n_, p, eb=eb, d=d):
        return 'ear_in' if (n_.y < -0.4 and (c - eb).dot(d) > 0.02) else 'fur'
    tube(f'fur_ear_{nm}', [eb + d * 0.16 * t for t in (0, 0.3, 0.6, 0.85, 1.0)], [0.065, 0.058, 0.04, 0.018, 0.003], ecol,
         f'ear_{nm}', seg=10, flat=0.6)
    for k in range(3):   # whisker spots
        decal(f'fur_wsp{k}_{nm}', head, HC + Vector((0, 0, -0.04)), (s * (0.3 + 0.1 * k), -1, -0.15 + 0.07 * (k % 2)), (0.006, 0.003, 0.006), 'fur_dk', 'head', sink=0.2, seg=6, rings=4)
blob('fur_nose', HC + Vector((0, -0.152, -0.02)), (0.016, 0.01, 0.01), 'nose', 'head', seg=10, rings=6)
decal('fur_mouth', head, HC + Vector((0, 0, -0.05)), (0, -1, -0.25), (0.022, 0.005, 0.006), 'mouth', 'head', sink=0.3)
# tiny stubby legs with cream paws
LEGS = {'arm_l': ((0.1, -0.4, 0.1), (0.11, -0.42, 0.0)), 'arm_r': ((-0.1, -0.4, 0.1), (-0.11, -0.42, 0.0)),
        'thigh_l': ((0.1, 0.5, 0.1), (0.11, 0.48, 0.0)), 'thigh_r': ((-0.1, 0.5, 0.1), (-0.11, 0.48, 0.0))}
for nm, (sh, pw) in LEGS.items():
    leg4(nm[-1], nm.startswith('arm'), sh, pw, 0.04, 0.035, 'fur', paw_col='cream', toes=3, toe_col='cream')
bones = quad_bones((0, 0.45, 0.24), (0, -0.35, 0.24), (0, -0.55, 0.24), HC, LEGS, tail=[BP[6], BP[7], BP[8]],
                   ears=[('ear_l', HC + Vector((0.12, 0.02, 0.12))), ('ear_r', HC + Vector((-0.12, 0.02, 0.12)))])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.16, -0.05))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.2, 0))), 'head')])
plan_clips(rig, 'quadruped', size=0.5, over={'idle_alt': (110, {'neck': [(0, {}), (20, {'r': (-25, 0, 0)}), (45, {'r': (-25, 15, 0)}), (70, {'r': (-25, -15, 0)}), (95, {}), (110, {})],
                                                              'head': [(0, {}), (20, {'r': (10, 0, 0)}), (90, {'r': (10, 0, 0)}), (110, {})]}, True, None)})   # rears its head up to look around
sheet('check', 1.0, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('idle_alt', 45, 'q34')])
export(162, 'furret', 1.8, 'quadruped', rig, mesh, fit='length', shiny={'fur': '#d68a5c', 'fur_dk': '#a05a36', 'cream': '#f4dfbc'})

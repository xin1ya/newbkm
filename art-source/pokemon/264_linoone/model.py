# Linoone (264) · normal · 0.5 m. Evolution of Zigzagoon — geometry matched to the reference silhouette (art-source/reference, comparison only):
# long sleek low weasel with smooth (no longer spiky) cream fur and dark brown zigzag stripes running along the back and flanks into a
# long straight tail, wedge head with white muzzle, small pointed ears, blue eyes, straight front legs with long pale claws,
# hind legs folded flat behind in a stalking crouch.
reset('264_linoone')
M = pal([('cream', '#d9d0c4'), ('brown', '#5e4c40'), ('white', '#f4f0ea'), ('eye', '#1a1418'), ('iris', '#3a8ec8'), ('nose', '#1b1716'), ('claw', '#e8e4dc'), ('mouth', '#4a3a32')])
HC = Vector((0, -0.6, 0.31))
BP = [Vector(p) for p in ((0, -0.52, 0.31), (0, -0.38, 0.32), (0, -0.15, 0.335), (0, 0.1, 0.345), (0, 0.3, 0.34), (0, 0.45, 0.35), (0, 0.6, 0.38), (0, 0.72, 0.41), (0, 0.8, 0.43))]
BR = [0.09, 0.13, 0.155, 0.17, 0.175, 0.14, 0.095, 0.055, 0.008]
DP, DR = [], []
for i in range(len(BP) - 1):
    for k in range(12): t = k / 12; DP.append(BP[i].lerp(BP[i + 1], t)); DR.append(BR[i] + (BR[i + 1] - BR[i]) * t)
DP.append(BP[-1]); DR.append(BR[-1])
def stripes(c, n, p):
    z = 0.08 * math.sin(c.y * 10)   # zigzag
    if n.z < -0.35: return 'cream'
    if abs(n.x - z) < 0.16 and n.z > 0.4: return 'brown'           # dorsal zigzag
    if abs(abs(n.x) - 0.72 - z) < 0.11 and c.y > -0.4: return 'brown'  # flank zigzags
    return 'cream'
CH = ['chest', 'spine', 'hips', 'tail1', 'tail2', 'tail3']
body = tube('lin_body', DP, DR, stripes, lambda c: seg_w(c, CH), seg=48)
body.scale = (1, 1, 0.8); body.location.z += 0.075
head = blob('lin_head', HC, (0.1, 0.15, 0.09), lambda c, n, p: 'white' if (n.z < -0.1 or c.y < HC.y - 0.07) else ('brown' if abs(n.x) < 0.2 and n.z > 0.6 else 'cream'), 'head', seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.55 * max(0, -v.y)), v.y, v.z * (1 - 0.4 * max(0, -v.y)))))
blob('lin_nose', HC + Vector((0, -0.15, 0.0)), (0.018, 0.012, 0.012), 'nose', 'head', seg=12, rings=8)
decal('lin_mouth', head, HC + Vector((0, -0.05, -0.03)), (0, -0.6, -0.8), (0.02, 0.004, 0.004), 'mouth', 'head', sink=0.3)
for s, nm in ((1, 'l'), (-1, 'r')):
    eye(nm, head, HC + Vector((0, -0.02, 0.01)), (s * 0.6, -0.65, 0.4), 0.017, 0.012, 'head', sink=0.3)
    decal(f'lin_eyestripe_{nm}', head, HC + Vector((0, 0.04, 0.02)), (s * 0.85, 0.1, 0.45), (0.04, 0.006, 0.01), 'brown', 'head', sink=0.3)
    e = cone(f'lin_ear_{nm}', 0.028, 0.002, 0.045, verts=10, loc=HC + Vector((s * 0.05, 0.06, 0.07)))
    e.rotation_euler = (math.radians(-35), math.radians(s * 30), 0); colorize(e, lambda c, n_, p: 'cream'); reg(e, f'ear_{nm}')
    for j in range(2):   # cheek tufts
        t = cone(f'lin_tuft{j}_{nm}', 0.02, 0.001, 0.05, verts=4, loc=HC + Vector((s * 0.07, 0.05 + 0.03 * j, -0.03)))
        t.rotation_euler = (math.radians(70), math.radians(s * 50), 0); colorize(t, lambda c, n_, p: 'white'); reg(t, 'head')
LEGS = {'arm_l': ((0.06, -0.4, 0.28), (0.065, -0.42, 0.0)), 'arm_r': ((-0.06, -0.4, 0.28), (-0.065, -0.42, 0.0)),
        'thigh_l': ((0.08, 0.3, 0.2), (0.1, 0.46, 0.02)), 'thigh_r': ((-0.08, 0.3, 0.2), (-0.1, 0.46, 0.02))}
for nm, (sh, pw) in LEGS.items():
    if nm.startswith('arm'):
        leg4(nm[-1], True, sh, pw, 0.034, 0.026, 'cream', paw_col='cream', toes=3, toe_col='claw'); continue
    # hind legs folded flat: big low thigh, shin lying backward along the ground
    x = sh[0]; sg = 1 if x > 0 else -1
    blob(f'lin_thigh_{nm}', Vector((x * 1.2, 0.33, 0.24)), (0.075, 0.13, 0.1), 'cream', nm, seg=20, rings=12)
    kn = Vector((x * 1.35, 0.26, 0.06)); pv = Vector((x * 1.3, 0.48, 0.025))
    tube(f'lin_shin_{nm}', [Vector((x * 1.3, 0.3, 0.2)), kn, pv], [0.04, 0.032, 0.026], 'cream', nm, seg=12)
    for j in range(3):
        cl = cone(f'lin_hclaw{j}_{nm}', 0.008, 0.001, 0.035, verts=6, loc=pv + Vector(((j - 1) * 0.015, 0.03, -0.01)))
        cl.rotation_euler = (math.radians(-90), 0, 0); colorize(cl, lambda c, n_, p: 'claw'); reg(cl, nm)
bones = quad_bones((0, 0.3, 0.34), (0, -0.3, 0.33), (0, -0.48, 0.32), HC, LEGS, tail=[BP[5], BP[6], BP[7]],
                   ears=[('ear_l', HC + Vector((0.05, 0.06, 0.07))), ('ear_r', HC + Vector((-0.05, 0.06, 0.07)))])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.13, -0.02))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.16, 0))), 'head')])
plan_clips(rig, 'quadruped', size=0.5, over={'idle_alt': (110, {'neck': [(0, {}), (15, {'r': (20, 0, 0)}), (40, {'r': (20, 10, 0)}), (65, {'r': (20, -10, 0)}), (90, {}), (110, {})]}, True, None)})   # nose to the ground, tracking
sheet('check', 0.55, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('idle_alt', 40, 'q34')])
export(264, 'linoone', 0.5, 'quadruped', rig, mesh, shiny={'cream': '#e8dcc0', 'brown': '#a8865a'})

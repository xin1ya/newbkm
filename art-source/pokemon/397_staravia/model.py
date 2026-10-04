# Staravia (397) · normal/flying · 0.6 m. Evolution of Starly — geometry matched to the reference (art-source/reference, comparison only;
# reference has wings spread, ours folded):
# sleeker dark-grey starling standing upright: white V-shaped face mask from the beak back over the cheeks, a small white chest bib,
# big crest plume that rises from the forehead and curls forward into a hook, short orange beak and feet, long wings with paler
# bars, long upswept tail with white inner feathers.
reset('397_staravia')
M = pal([('grey', '#4a4a50'), ('grey_dk', '#2e2e34'), ('grey_lt', '#6a6a70'), ('mask', '#eeeef0'), ('eye', '#1a1418'), ('white', '#ffffff'), ('beak', '#f08a2a'),
         ('beak_dk', '#c86818'), ('feet', '#f0902a'), ('tip', '#d8d8de')])
BC = Vector((0, 0.03, 0.25)); HC = Vector((0, -0.04, 0.42))
body = blob('stv_body', BC, (0.11, 0.14, 0.15), lambda c, n, p: 'mask' if (n.y < -0.6 and c.z > 0.27 and abs(c.x) < 0.04) else 'grey',
            lambda c: lerp_w('spine', 'chest', (c.z - 0.2) / 0.12), seg=32, rings=20, fn=lambda v: Vector((v.x * (1 - 0.15 * max(0, v.z)), v.y + 0.25 * v.z * 0.0, v.z)))
body.rotation_euler = (math.radians(-18), 0, 0)
tube('stv_neck', [BC + Vector((0, -0.03, 0.1)), HC + Vector((0, 0.01, -0.04))], [0.075, 0.065], 'grey', 'neck', seg=16)
head = blob('stv_head', HC, (0.075, 0.08, 0.072), 'grey', 'head', seg=32, rings=18)
for s, nm in ((1, 'l'), (-1, 'r')):
    mk, ml, mn = decal(f'stv_mask_{nm}', head, HC + Vector((0, -0.01, -0.01)), (s * 0.55, -0.8, -0.1), (0.045, 0.012, 0.03), 'mask', 'head', sink=0.4, up=(s * 0.5, 0, 1))
    e, loc, n = decal(f'stv_eye_{nm}', head, HC + Vector((0, 0, 0.01)), (s * 0.7, -0.55, 0.2), (0.013, 0.006, 0.015), 'eye', 'head', sink=0.2)
    decal(f'stv_shine_{nm}', e, loc + Vector((0, -0.002, 0.005)), n, (0.004, 0.002, 0.004), 'white', 'head', sink=0.05, seg=8, rings=5)
beak = cone('stv_beak', 0.018, 0.002, 0.045, verts=12, loc=HC + Vector((0, -0.095, -0.01))); beak.rotation_euler = (math.radians(98), 0, 0)
colorize(beak, lambda c, n, p: 'beak' if n.z > -0.2 else 'beak_dk'); reg(beak, 'head')
# crest: tall plume from the forehead, curling forward into a hook
b0 = HC + Vector((0, -0.03, 0.06))
CP = [b0, b0 + Vector((0, 0.02, 0.06)), b0 + Vector((0, 0.01, 0.12)), b0 + Vector((0, -0.03, 0.16)), b0 + Vector((0, -0.07, 0.15)), b0 + Vector((0, -0.08, 0.11)), b0 + Vector((0, -0.065, 0.09))]
tube('stv_crest', CP, [0.045, 0.052, 0.048, 0.04, 0.03, 0.02, 0.006], 'grey_dk', 'head', seg=12, flat=0.6)
for side in 'lr':
    sg = 1 if side == 'l' else -1
    wing(side, (sg * 0.1, -0.03, 0.34), 0.34, 0.13, 'grey', n=6, tip_col='grey_dk')
    bird_leg(side, (sg * 0.045, 0.04, 0.12), (sg * 0.05, 0.02, 0.03), 'feet', r=0.013, toe_len=0.045)
# long upswept tail: dark outer feathers, white inner ones
for k, a in enumerate((-18, -6, 6, 18)):
    d = Vector((math.sin(math.radians(a)) * 0.35, 1, 0.55)).normalized(); c = Vector((0, 0.17, 0.17)) + d * 0.12
    o = blob(f'stv_tail{k}', c, (0.03, 0.15, 0.008), lambda c_, n, p, k=k: 'tip' if k in (1, 2) and c_.y > 0.24 else 'grey_dk', lambda c_: lerp_w('tail1', 'tail2', (c_.y - 0.17) / 0.12), seg=14, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.04, 0.16), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0.0, 0.33), 'spine'), ('neck', (0, -0.02, 0.37), 'chest'), ('head', tuple(HC), 'neck'),
         ('tail1', (0, 0.17, 0.17), 'hips'), ('tail2', (0, 0.28, 0.24), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.1, -0.03, 0.34), 'chest'), (f'wing2_{nm}', (s * 0.1, 0.12, 0.25), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.045, 0.04, 0.12), 'hips'), (f'foot_{nm}', (s * 0.05, 0.02, 0.03), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.13, -0.01))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.14, 0))), 'head')])
plan_clips(rig, 'bird', size=0.6)
sheet('check', 0.65, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('attack_special', 8, 'q34'), ('idle', 0, 'q34')])
export(397, 'staravia', 0.6, 'bird', rig, mesh, shiny={'grey': '#6a5a48', 'grey_dk': '#463a2c'})

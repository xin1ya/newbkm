# Staraptor (398) · normal/flying · 1.2 m. Evolution of Staravia — same skeleton/layout as the Staravia build (the runtime scales by
# heightM), reshaped to the reference (art-source/reference, comparison only; reference wings spread, ours folded):
# a fierce hawk: white face and broad white chest/belly patterned with dark chevrons, dark grey back and wings, a big crest swept FORWARD
# over the beak from the back of the head with a red tip, red mark on the brow, hooked yellow-orange beak, orange talons, long tail.
reset('398_staraptor')
M = pal([('grey', '#4a4a50'), ('grey_dk', '#2e2e34'), ('grey_lt', '#6a6a70'), ('mask', '#eeeef0'), ('eye', '#1a1418'), ('white', '#ffffff'), ('beak', '#f08a2a'),
         ('beak_dk', '#c86818'), ('feet', '#f0902a'), ('tip', '#d8d8de'), ('red', '#c8303a'), ('hook', '#e8b030')])
BC = Vector((0, 0.03, 0.25)); HC = Vector((0, -0.04, 0.42))
body = blob('spt_body', BC, (0.11, 0.14, 0.15), lambda c, n, p: ('grey_lt' if (math.sin((c.z - 1.2 * abs(c.x)) * 70) > 0.75 and c.z < 0.3) else 'mask') if (n.y < -0.25) else 'grey',
            lambda c: lerp_w('spine', 'chest', (c.z - 0.2) / 0.12), seg=32, rings=20, fn=lambda v: Vector((v.x * (1 - 0.15 * max(0, v.z)), v.y + 0.25 * v.z * 0.0, v.z)))
body.rotation_euler = (math.radians(-18), 0, 0)
tube('spt_neck', [BC + Vector((0, -0.03, 0.1)), HC + Vector((0, 0.01, -0.04))], [0.075, 0.065], 'grey', 'neck', seg=16)
head = blob('spt_head', HC, (0.075, 0.08, 0.072), 'grey', 'head', seg=32, rings=18)
for s, nm in ((1, 'l'), (-1, 'r')):
    mk, ml, mn = decal(f'spt_mask_{nm}', head, HC + Vector((0, -0.01, -0.01)), (s * 0.55, -0.8, -0.1), (0.06, 0.012, 0.045), 'mask', 'head', sink=0.4, up=(s * 0.5, 0, 1))
    e, loc, n = decal(f'spt_eye_{nm}', head, HC + Vector((0, 0, 0.01)), (s * 0.7, -0.55, 0.2), (0.013, 0.006, 0.015), 'eye', 'head', sink=0.2)
    decal(f'spt_shine_{nm}', e, loc + Vector((0, -0.002, 0.005)), n, (0.004, 0.002, 0.004), 'white', 'head', sink=0.05, seg=8, rings=5)
BP = [HC + Vector((0, -0.06, -0.005)), HC + Vector((0, -0.1, 0.0)), HC + Vector((0, -0.135, -0.02)), HC + Vector((0, -0.13, -0.055))]
tube('spt_beak', BP, [0.03, 0.024, 0.014, 0.003], 'hook', 'head', seg=12, flat=0.7)
decal('spt_browmark', head, HC + Vector((0, 0, 0.04)), (0, -1, 0.5), (0.02, 0.01, 0.012), 'red', 'head', sink=0.2)
# crest: tall plume from the forehead, curling forward into a hook
b0 = HC + Vector((0, 0.05, 0.05))
CP = [b0 + Vector((0, 0.02, -0.01)), b0 + Vector((0, -0.01, 0.07)), b0 + Vector((0, -0.06, 0.12)), b0 + Vector((0, -0.12, 0.13)), b0 + Vector((0, -0.17, 0.1)), b0 + Vector((0, -0.19, 0.06))]
tube('spt_crest', CP, [0.065, 0.075, 0.065, 0.048, 0.03, 0.008], 'grey_dk', 'head', seg=12, flat=0.45)
tube('spt_cresttip', [CP[3], CP[4], CP[5]], [0.05, 0.032, 0.01], 'red', 'head', seg=12, flat=0.45)
for j, (dx, dz) in enumerate(((0.03, 0.02), (-0.03, 0.02))):
    tube(f'spt_crestside{j}', [b0 + Vector((dx, 0, 0)), b0 + Vector((dx * 1.5, -0.04, 0.06 + dz)), b0 + Vector((dx * 1.8, -0.08, 0.06))], [0.03, 0.02, 0.004], 'grey_dk', 'head', seg=8, flat=0.45)
for side in 'lr':
    sg = 1 if side == 'l' else -1
    wing(side, (sg * 0.1, -0.03, 0.34), 0.4, 0.15, 'grey', n=6, tip_col='grey_dk')
    bird_leg(side, (sg * 0.045, 0.04, 0.12), (sg * 0.05, 0.02, 0.03), 'feet', r=0.016, toe_len=0.055)
# long upswept tail: dark outer feathers, white inner ones
for k, a in enumerate((-18, -6, 6, 18)):
    d = Vector((math.sin(math.radians(a)) * 0.35, 1, 0.55)).normalized(); c = Vector((0, 0.17, 0.17)) + d * 0.12
    o = blob(f'spt_tail{k}', c, (0.03, 0.15, 0.008), lambda c_, n, p, k=k: 'tip' if k in (1, 2) and c_.y > 0.24 else 'grey_dk', lambda c_: lerp_w('tail1', 'tail2', (c_.y - 0.17) / 0.12), seg=14, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.04, 0.16), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0.0, 0.33), 'spine'), ('neck', (0, -0.02, 0.37), 'chest'), ('head', tuple(HC), 'neck'),
         ('tail1', (0, 0.17, 0.17), 'hips'), ('tail2', (0, 0.28, 0.24), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.1, -0.03, 0.34), 'chest'), (f'wing2_{nm}', (s * 0.1, 0.12, 0.25), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.045, 0.04, 0.12), 'hips'), (f'foot_{nm}', (s * 0.05, 0.02, 0.03), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.13, -0.01))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.14, 0))), 'head')])
plan_clips(rig, 'bird', size=0.6)
sheet('check', 0.65, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('attack_special', 8, 'q34'), ('idle', 0, 'q34')])
export(398, 'staraptor', 1.2, 'bird', rig, mesh, shiny={'grey': '#6a5a48', 'grey_dk': '#463a2c'})

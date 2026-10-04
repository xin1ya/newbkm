# Crobat (169) · poison/flying · 1.8 m. Compact purple body, 4 wings (big upper pair, smaller lower pair) with blue-grey inner, yellow eyes with red irises, small mouth with fangs, pointed ears, two tiny legs.
reset('169_crobat')
M = pal([('purple', '#7a4aa8'), ('purple_dk', '#55307a'), ('inner', '#6a7aa8'), ('mouth', '#3a1a2a'), ('fang', '#ffffff'), ('eye', '#f2d23a'), ('iris', '#c82a2a'), ('pupil', '#1a1418'), ('white', '#ffffff')])
exec(open(D('art-source', 'tools', 'batwing.py'), encoding='utf-8').read())
Z = 1.0; BC = Vector((0, 0, Z))
body = blob('cb_body', BC, (0.2, 0.18, 0.22), lambda c, n, p: 'purple_dk' if n.z < -0.7 else 'purple', lambda c: lerp_w('spine', 'head', (c.z - Z + 0.1) / 0.2), seg=32, rings=18)
blob('cb_mouth', BC + Vector((0, -0.17, -0.07)), (0.06, 0.025, 0.03), 'mouth', 'head', seg=14, rings=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    tube(f'cb_fang_{nm}', [BC + Vector((s * 0.035, -0.19, -0.05)), BC + Vector((s * 0.035, -0.195, -0.1))], [0.012, 0.002], 'fang', 'head', seg=6)
    e, loc, n = decal(f'cb_eye_{nm}', body, BC + Vector((0, 0, 0.04)), (s * 0.45, -1, 0.1), (0.055, 0.015, 0.032), 'eye', 'head', sink=0.2)
    ir, l2, n2 = decal(f'cb_iris_{nm}', e, loc + Vector((s * -0.012, 0, 0)), n, (0.024, 0.006, 0.026), 'iris', 'head', sink=0.05, seg=12, rings=8)
    decal(f'cb_pupil_{nm}', ir, l2, n2, (0.01, 0.004, 0.02), 'pupil', 'head', sink=0.05, seg=10, rings=6)
    e0 = BC + Vector((s * 0.1, 0.02, 0.17))
    tube(f'cb_ear_{nm}', [e0, e0 + Vector((s * 0.05, 0.0, 0.1)), e0 + Vector((s * 0.08, 0.01, 0.18))], [0.05, 0.035, 0.003], lambda c, n_, p_: 'inner' if n_.y < -0.4 else 'purple', f'ear_{nm}', seg=10, flat=0.45)
    bat_wing('cb', s, nm, BC + Vector((s * 0.17, 0.03, 0.06)), 0.85, 1.0, 'purple', 'inner', fingers=3)
    bat_wing('cb2', s, nm, BC + Vector((s * 0.15, 0.05, -0.1)), 0.55, 0.7, 'purple', 'inner', fingers=2, bone=f'wing2_{nm}', zoff=-0.15)
    h = BC + Vector((s * 0.06, 0.06, -0.2))
    tube(f'cb_leg_{nm}', [h, h + Vector((0, 0.04, -0.08))], [0.025, 0.018], 'purple', f'foot_{nm}', seg=8)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, Z - 0.12), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, 0, 0.1))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.17, 0.03, Z + 0.06), 'spine'), (f'wing2_{nm}', (s * 0.15, 0.05, Z - 0.1), 'spine'), (f'ear_{nm}', tuple(BC + Vector((s * 0.1, 0.02, 0.17))), 'head'),
              (f'foot_{nm}', tuple(BC + Vector((s * 0.06, 0.06, -0.2))), 'hips')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.2, -0.07))), 'head'), ('socket_fx', tuple(BC + Vector((0, -0.25, 0))), 'head')])
bat_clips(rig, 1.8, 35, merge(bat_flap(24, 30, bones=('wing2_l', 'wing2_r'))))
sheet('check', 1.8, poses=[('idle', 5, 'front'), ('attack_physical', 15, 'side')])
export(169, 'crobat', 1.8, 'rigid', rig, mesh, shiny={'purple': '#d070a0', 'purple_dk': '#a04a7a', 'inner': '#a0c0e0'})

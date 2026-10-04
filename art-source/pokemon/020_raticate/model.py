# Raticate (20) · normal · 0.7 m. Stocky tan rat: brown back, cream belly & muzzle, huge yellow incisors, long stiff whiskers, small round ears, scaly thin tail, cream hind feet with 3 toes.
reset('020_raticate')
M = pal([('fur', '#b98a52'), ('fur_dk', '#8c6438'), ('cream', '#f1e2bf'), ('ear_in', '#e8b0a0'), ('eye', '#1a1418'), ('iris', '#c8323c'), ('white', '#ffffff'),
         ('nose', '#4a3020'), ('tooth', '#f4d77a'), ('whisker', '#f6efe0'), ('paw', '#efdcc0'), ('tail', '#a07850')])
BC = Vector((0, 0.06, 0.28)); HC = Vector((0, -0.24, 0.36))
body = blob('rc_body', BC, (0.19, 0.27, 0.18), lambda c, n, p: 'cream' if n.z < -0.4 else ('fur_dk' if n.z > 0.75 else 'fur'), lambda c: seg_w(c, ['chest', 'spine', 'hips']), seg=36, rings=20,
            fn=lambda v: Vector((v.x * (1 + 0.12 * v.y), v.y, v.z * (1 + 0.1 * v.y))))
head = blob('rc_head', HC, (0.14, 0.15, 0.13), lambda c, n, p: 'cream' if (n.y < -0.55 and n.z < 0.15) else 'fur', 'head', seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.15 * max(0, -v.y)), v.y * (1 + 0.2 * max(0, -v.y)), v.z)))
muzzle = blob('rc_muzzle', HC + Vector((0, -0.14, -0.04)), (0.08, 0.07, 0.06), 'cream', 'head', seg=20, rings=12)
blob('rc_nose', HC + Vector((0, -0.21, -0.01)), (0.02, 0.016, 0.014), 'nose', 'head', seg=12, rings=8)
for s in (1, -1):   # big buck teeth
    tube(f'rc_tooth_{"l" if s > 0 else "r"}', [HC + Vector((s * 0.013, -0.18, -0.08)), HC + Vector((s * 0.014, -0.2, -0.13)), HC + Vector((s * 0.013, -0.19, -0.165))], [0.012, 0.012, 0.009], 'tooth', 'head', seg=8, flat=0.55)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'rc_eye_{nm}', head, HC + Vector((0, -0.04, 0.03)), (s * 0.7, -0.62, 0.3), (0.034, 0.014, 0.036), 'eye', 'head', sink=0.2)
    ir, l2, n2 = decal(f'rc_iris_{nm}', e, loc, n, (0.02, 0.008, 0.022), 'iris', 'head', sink=0.05, seg=14, rings=8)
    decal(f'rc_shine_{nm}', ir, l2 + Vector((0, 0, 0.01)), n2, (0.008, 0.004, 0.008), 'white', 'head', sink=0.05, seg=10, rings=6)
    blob(f'rc_ear_{nm}', HC + Vector((s * 0.1, 0.04, 0.11)), (0.05, 0.016, 0.045), lambda c, n_, p: 'ear_in' if n_.y < -0.3 else 'fur', f'ear_{nm}', seg=18, rings=10, rot=(10, s * 20, s * -30))
    for k, dz in enumerate((0.01, -0.012, -0.034)):   # long stiff whiskers fanning back
        b0 = HC + Vector((s * 0.06, -0.17, -0.03 + dz))
        tube(f'rc_whisk{k}_{nm}', [b0, b0 + Vector((s * 0.1, 0.03, 0.01 - dz * 0.5)), b0 + Vector((s * 0.2, 0.08, 0.02 - dz))], [0.004, 0.003, 0.0015], 'whisker', 'head', seg=4)
    blob(f'rc_cheek_{nm}', HC + Vector((s * 0.1, -0.06, -0.05)), (0.05, 0.05, 0.045), 'fur', 'head', seg=14, rings=8)
tpts = [Vector((0, 0.3, 0.26)), Vector((0, 0.42, 0.2)), Vector((0, 0.55, 0.18)), Vector((0, 0.66, 0.22)), Vector((0, 0.72, 0.3))]
tube('rc_tail', tpts, [0.035, 0.026, 0.02, 0.014, 0.006], 'tail', lambda c: seg_w(c, ['hips', 'tail1', 'tail2', 'tail3']), seg=8)
for k in range(5):   # tail scale rings
    p = tpts[1].lerp(tpts[3], k / 4)
    blob(f'rc_ring{k}', p, (0.026 - k * 0.003, 0.006, 0.026 - k * 0.003), 'fur_dk', lambda c: seg_w(c, ['tail1', 'tail2', 'tail3']), seg=10, rings=4)
LEGS = {'arm_l': ((0.11, -0.12, 0.22), (0.11, -0.15, 0.0)), 'arm_r': ((-0.11, -0.12, 0.22), (-0.11, -0.15, 0.0)),
        'thigh_l': ((0.13, 0.18, 0.22), (0.13, 0.16, 0.0)), 'thigh_r': ((-0.13, 0.18, 0.22), (-0.13, 0.16, 0.0))}
for nm, (sh, pw) in LEGS.items():
    th = nm.startswith('thigh')
    leg4(nm[-1], not th, sh, pw, 0.07 if th else 0.045, 0.03, 'fur', paw_col='paw', toes=3, toe_col='paw')
bones = quad_bones((0, 0.2, 0.28), (0, -0.1, 0.3), (0, -0.17, 0.33), HC, LEGS, tail=[tpts[1], tpts[2], tpts[3]],
                   ears=[('ear_l', HC + Vector((0.09, 0.04, 0.1))), ('ear_r', HC + Vector((-0.09, 0.04, 0.1)))])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.22, -0.08))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.24, 0))), 'head')])
plan_clips(rig, 'quadruped', size=0.7, over={
    'attack_physical': {'head': [(0, {}), (9, {'r': (-18, 0, 0)}), (15, {'r': (18, 0, 0)}), (28, {})]},   # Hyper Fang
})
sheet('check', 0.6, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(20, 'raticate', 0.7, 'quadruped', rig, mesh, shiny={'fur': '#c8564a', 'fur_dk': '#9a3a30', 'tail': '#b05a40'}, fit='length')

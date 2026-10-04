# Rattata (19) · normal · 0.3 m. Purple rat, cream belly & muzzle, big round ears, buck teeth, whiskers, long curling tail.
reset('019_rattata')
M = pal([('fur', '#9a6fb8'), ('fur_dk', '#6f4c8c'), ('cream', '#f1e2bf'), ('ear_in', '#e8a6c8'), ('eye', '#1a1418'), ('iris', '#c8323c'), ('white', '#ffffff'),
         ('nose', '#5a3a6a'), ('tooth', '#fffdf6'), ('whisker', '#f3ecff'), ('paw', '#efdcc0')])
BC = Vector((0, 0.03, 0.14)); HC = Vector((0, -0.12, 0.19))
body = blob('rat_body', BC, (0.085, 0.14, 0.085), lambda c, n, p: 'cream' if n.z < -0.45 else 'fur', lambda c: seg_w(c, ['chest', 'spine', 'hips']), seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 + 0.15 * v.y), v.y, v.z * (1 + 0.12 * v.y))))
head = blob('rat_head', HC, (0.075, 0.08, 0.07), lambda c, n, p: 'cream' if (n.y < -0.6 and n.z < 0.2) else 'fur', 'head', seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.2 * max(0, -v.y)), v.y * (1 + 0.25 * max(0, -v.y)), v.z)))
muzzle = blob('rat_muzzle', HC + Vector((0, -0.075, -0.02)), (0.04, 0.04, 0.032), 'cream', 'head', seg=20, rings=12)
blob('rat_nose', HC + Vector((0, -0.115, -0.008)), (0.012, 0.01, 0.009), 'nose', 'head', seg=12, rings=8)
for s in (1, -1):
    t = blob(f'rat_tooth_{"l" if s > 0 else "r"}', HC + Vector((s * 0.008, -0.1, -0.05)), (0.008, 0.005, 0.016), 'tooth', 'head', seg=10, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'rat_eye_{nm}', head, HC + Vector((0, -0.02, 0.01)), (s * 0.7, -0.65, 0.3), (0.028, 0.012, 0.034), 'eye', 'head', sink=0.2)
    ir, l2, n2 = decal(f'rat_iris_{nm}', e, loc, n, (0.018, 0.008, 0.022), 'iris', 'head', sink=0.05, seg=14, rings=8)
    decal(f'rat_shine_{nm}', ir, l2 + Vector((0, 0, 0.01)), n2, (0.007, 0.004, 0.007), 'white', 'head', sink=0.05, seg=10, rings=6)
    ear = blob(f'rat_ear_{nm}', HC + Vector((s * 0.065, 0.02, 0.075)), (0.05, 0.015, 0.05), lambda c, n_, p: 'ear_in' if n_.y < -0.3 else 'fur', f'ear_{nm}', seg=20, rings=10, rot=(10, s * 20, s * -30))
    for k, dz in enumerate((0.0, -0.012)):   # whiskers
        b0 = HC + Vector((s * 0.03, -0.1, -0.02 + dz))
        tube(f'rat_whisk{k}_{nm}', [b0, b0 + Vector((s * 0.05, 0.005, 0.005 - dz)), b0 + Vector((s * 0.09, 0.02, 0.012 - 2 * dz))], [0.002, 0.0018, 0.001], 'whisker', 'head', seg=4)
# tail: long, thin, curling up into a loop at the end
tpts = [Vector((0, 0.16, 0.12)), Vector((0, 0.24, 0.1)), Vector((0, 0.32, 0.13)), Vector((0, 0.37, 0.2)), Vector((0, 0.35, 0.26)), Vector((0, 0.3, 0.26)), Vector((0, 0.29, 0.22))]
tube('rat_tail', tpts, [0.018, 0.015, 0.012, 0.01, 0.008, 0.007, 0.005], 'fur', lambda c: seg_w(c, ['hips', 'tail1', 'tail2', 'tail3']), seg=8)
LEGS = {'arm_l': ((0.05, -0.06, 0.12), (0.05, -0.08, 0.0)), 'arm_r': ((-0.05, -0.06, 0.12), (-0.05, -0.08, 0.0)),
        'thigh_l': ((0.06, 0.1, 0.12), (0.06, 0.1, 0.0)), 'thigh_r': ((-0.06, 0.1, 0.12), (-0.06, 0.1, 0.0))}
for nm, (sh, pw) in LEGS.items():
    leg4(nm[-1], nm.startswith('arm'), sh, pw, 0.025 if nm.startswith('thigh') else 0.018, 0.012, 'fur', paw_col='paw')
bones = quad_bones((0, 0.1, 0.14), (0, -0.05, 0.15), (0, -0.09, 0.17), HC, LEGS, tail=[tpts[1], tpts[3], tpts[5]],
                   ears=[('ear_l', HC + Vector((0.05, 0.02, 0.06))), ('ear_r', HC + Vector((-0.05, 0.02, 0.06)))])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.13, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.14, 0))), 'head')])
plan_clips(rig, 'quadruped', size=0.3, over={
    'attack_physical': {'head': [(0, {}), (9, {'r': (-15, 0, 0)}), (15, {'r': (15, 0, 0)}), (28, {})]},   # Bite / Hyper Fang: head snaps down on impact
})
sheet('check', 0.32, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(19, 'rattata', 0.3, 'quadruped', rig, mesh, shiny={'fur': '#c9d86a', 'fur_dk': '#9ea94a'})

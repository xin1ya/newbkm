# Marshtomp (259) · water/ground · 0.7 m. Stocky light-blue mudfish biped: pale belly, orange gill spikes on the cheeks, dark crest fin on the head, dark tail fin, stubby thick arms/legs.
reset('259_marshtomp')
M = pal([('blue', '#6fb6e0'), ('blue_dk', '#4a8ec0'), ('belly', '#d9eef7'), ('fin', '#2e3c55'), ('gill', '#f07a2a'), ('gill_dk', '#c65a18'), ('eye', '#1a1418'), ('iris', '#f0932a'),
         ('white', '#ffffff'), ('mouth', '#2a2230')])
BC = Vector((0, 0, 0.3)); HC = Vector((0, -0.04, 0.54))
body = blob('mt_body', BC, (0.17, 0.14, 0.2), lambda c, n, p: 'belly' if (n.y < -0.35 and c.z < 0.42) else 'blue', lambda c: lerp_w('spine', 'chest', (c.z - 0.2) / 0.2), seg=36, rings=20,
            fn=lambda v: Vector((v.x * (1 + 0.1 * -v.z), v.y, v.z)))
head = blob('mt_head', HC, (0.15, 0.13, 0.11), lambda c, n, p: 'belly' if (n.y < -0.5 and n.z < -0.2) else 'blue', 'head', seg=32, rings=18,
            fn=lambda v: Vector((v.x, v.y * (1 + 0.1 * max(0, -v.y)), v.z)))
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'mt_eye_{nm}', head, HC + Vector((0, 0, 0.03)), (s * 0.45, -1, 0.2), (0.024, 0.01, 0.022), 'eye', 'head', sink=0.2)
    ir, l2, n2 = decal(f'mt_iris_{nm}', e, loc, n, (0.016, 0.006, 0.015), 'iris', 'head', sink=0.05, seg=12, rings=8)
    decal(f'mt_pupil_{nm}', ir, l2, n2, (0.008, 0.004, 0.008), 'eye', 'head', sink=0.05, seg=10, rings=6)
    decal(f'mt_shine_{nm}', ir, l2 + Vector((0, 0, 0.006)), n2, (0.005, 0.003, 0.005), 'white', 'head', sink=0.05, seg=10, rings=6)
    for k, (dz, L, ang) in enumerate(((0.03, 0.09, 20), (-0.01, 0.11, 0), (-0.05, 0.08, -20))):   # cheek gill spikes
        b0 = HC + Vector((s * 0.14, 0.0, dz)); d = Vector((s, 0.25, math.sin(math.radians(ang)))).normalized()
        tube(f'mt_gill{k}_{nm}', [b0, b0 + d * L * 0.6, b0 + d * L], [0.022, 0.014, 0.003], lambda c, n_, p: 'gill' if n_.z > -0.3 else 'gill_dk', 'head', seg=8, flat=0.6)
    # arms: thick short, hanging, three-fingered paw blob
    sh = Vector((s * 0.15, -0.02, 0.38)); hd = Vector((s * 0.22, -0.05, 0.22))
    tube(f'mt_arm_{nm}', [sh, (sh + hd) / 2, hd], [0.05, 0.045, 0.042], 'blue', f'arm_{nm}', seg=12)
    blob(f'mt_hand_{nm}', hd + Vector((0, -0.01, -0.02)), (0.045, 0.045, 0.035), 'blue', f'arm_{nm}', seg=14, rings=8)
    leg = tube(f'mt_leg_{nm}', [(s * 0.09, 0, 0.16), (s * 0.1, -0.01, 0.07), (s * 0.1, -0.02, 0.03)], [0.06, 0.055, 0.05], 'blue', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.14 - c.z) / 0.1), seg=12)
    blob(f'mt_foot_{nm}', (s * 0.1, -0.04, 0.025), (0.06, 0.075, 0.03), 'blue_dk', f'foot_{nm}', seg=16, rings=10)
m, _, _ = decal('mt_mouth', head, HC + Vector((0, 0, -0.035)), (0, -1, -0.1), (0.06, 0.008, 0.01), 'mouth', 'head', sink=0.3)
# head crest fin (dark, rounded, running front-to-back)
crest = blob('mt_crest', HC + Vector((0, 0.01, 0.13)), (0.012, 0.1, 0.07), 'fin', 'head', seg=20, rings=12, fn=lambda v: Vector((v.x, v.y, max(v.z, -0.3) + 0.2 * max(0, v.y) * 0)))
# tail with dark fin
tp = [(0, 0.12, 0.2), (0, 0.22, 0.16), (0, 0.3, 0.15)]
tube('mt_tail', tp, [0.06, 0.04, 0.02], 'blue', lambda c: seg_w(c, ['hips', 'tail1', 'tail2']), seg=12)
blob('mt_tailfin', (0, 0.3, 0.2), (0.012, 0.09, 0.09), 'fin', 'tail2', seg=20, rings=12)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.18), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.42), 'spine'), ('head', tuple(HC - Vector((0, 0, 0.06))), 'chest'),
         ('tail1', tp[1], 'hips'), ('tail2', tp[2], 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.15, -0.02, 0.38), 'chest'), (f'thigh_{nm}', (s * 0.09, 0, 0.16), 'hips'), (f'foot_{nm}', (s * 0.1, -0.02, 0.04), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.14, -0.035))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.16, 0))), 'head')])
plan_clips(rig, 'biped', size=0.7, over={'walk': {'root': swing(8, 26, 0.0, 8, 1)}})   # heavy waddle
sheet('check', 0.72, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('attack_special', 22, 'front')])
export(259, 'marshtomp', 0.7, 'biped', rig, mesh, shiny={'blue': '#8ec8b8', 'blue_dk': '#6aa898', 'gill': '#e0503a'})

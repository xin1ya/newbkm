# Poliwag (60) · water · 0.6 m. Round blue tadpole body, white belly with black spiral, big eyes, pink lips, translucent tail fin, stubby feet.
reset('060_poliwag')
M = pal([('body', '#5a8fd8'), ('body_dk', '#3f6fb8'), ('belly', '#fafafa'), ('spiral', '#1c1c24'), ('eye', '#1a1418'), ('white', '#ffffff'), ('lip', '#f2a7b5'),
         ('feet', '#5a8fd8'), ('fin', '#e6f0ff')], extra_mats=[('fin', {'alpha': 0.75})])
BC = Vector((0, 0, 0.22)); RB = 0.2
body = blob('pol_body', BC, (RB, RB * 0.95, RB * 0.98), lambda c, n, p: 'belly' if (n.y < -0.55 and n.z < 0.45 and n.z > -0.75) else 'body', 'spine', seg=40, rings=24)
# spiral decal: a tube following an Archimedean spiral pressed onto the belly
pts = []
for k in range(60):
    t = k / 59; a = t * 4.2 * math.pi; r = 0.03 + 0.55 * t
    d = Vector((math.cos(a) * r, -1, math.sin(a) * r - 0.1)).normalized()
    loc, n = shoot(body, BC, d); pts.append(loc + n * 0.002)
tube('pol_spiral', pts, [0.007 + 0.006 * k / 59 for k in range(60)], 'spiral', 'spine', seg=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'pol_eyewhite_{nm}', body, BC, (s * 0.42, -0.6, 0.75), (0.07, 0.03, 0.075), 'white', 'head', sink=0.15)
    p, l2, n2 = decal(f'pol_pupil_{nm}', e, loc + Vector((-s * 0.01, -0.01, -0.005)), n, (0.035, 0.016, 0.045), 'eye', 'head', sink=0.05)
    decal(f'pol_shine_{nm}', p, l2 + Vector((0, 0, 0.018)), n2, (0.012, 0.005, 0.012), 'white', 'head', sink=0.05, seg=10, rings=6)
    blob(f'pol_foot_{nm}', (s * 0.1, -0.03, 0.03), (0.05, 0.07, 0.03), 'feet', f'foot_{nm}', seg=16, rings=8)
    blob(f'pol_leg_{nm}', (s * 0.1, -0.01, 0.06), (0.04, 0.045, 0.05), 'body', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.08 - c.z) / 0.05), seg=14, rings=8)
lipc = shoot(body, BC, (0, -1, 0.35))[0]
blob('pol_lips', lipc + Vector((0, -0.008, 0)), (0.04, 0.02, 0.022), 'lip', 'head', seg=18, rings=10)
# tail: thin translucent fin, curling up behind
tail_pts = [BC + Vector((0, RB * 0.8, 0.02)), BC + Vector((0, RB + 0.1, 0.06)), BC + Vector((0, RB + 0.2, 0.12)), BC + Vector((0, RB + 0.26, 0.2))]
tube('pol_tail', tail_pts, [0.05, 0.075, 0.065, 0.02], 'fin', lambda c: seg_w(c, ['tail1', 'tail2', 'tail3']), seg=14, mat=M['fin'], flat=0.25)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.12), 'root'), ('spine', tuple(BC), 'hips'), ('chest', tuple(BC + Vector((0, 0, 0.05))), 'spine'), ('head', tuple(BC + Vector((0, -0.05, 0.1))), 'chest'),
         ('tail1', tuple(tail_pts[0]), 'spine'), ('tail2', tuple(tail_pts[1]), 'tail1'), ('tail3', tuple(tail_pts[2]), 'tail2')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'thigh_{nm}', (s * 0.1, -0.01, 0.08), 'hips'), (f'foot_{nm}', (s * 0.1, -0.03, 0.03), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(lipc + Vector((0, -0.04, 0))), 'head'), ('socket_fx', tuple(lipc + Vector((0, -0.06, 0))), 'head')])
H = 0.6
plan_clips(rig, 'biped', size=H * 0.6, over={
    'swim': (30, merge({'root': bob(0.02, 30, 0, 4), 'thigh_l': swing(25, 30, 0), 'thigh_r': swing(25, 30, 0.5)}, wave(['tail1', 'tail2', 'tail3'], 30, 30, 0.15)), True, None),
    'attack_special': (40, {'root': [(0, {}), (12, {'r': (-12, 0, 0), 'l': (0, 0.03, 0)}), (22, {'r': (8, 0, 0)}), (40, {})], 'spine': [(0, {}), (12, {'s': (1.08, 1.08, 1.08)}), (22, {'s': (0.95, 1, 0.95)}), (40, {})],
                            **wave(['tail1', 'tail2', 'tail3'], 25, 40, 0.15)}, False, 22),   # Water Gun
})
sheet('check', H, poses=[('walk', 6, 'front'), ('attack_physical', 15, 'side'), ('attack_special', 20, 'q34'), ('swim', 8, 'back')])
export(60, 'poliwag', 0.6, 'biped', rig, mesh, shiny={'body': '#5ab8e0', 'body_dk': '#3a93bb', 'feet': '#5ab8e0'})

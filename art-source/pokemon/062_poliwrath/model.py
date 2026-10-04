# Poliwrath (62) · 1.3 m. Muscular dark-blue fighter: white belly with black spiral, stern brows, thick arms with big white gloves, powerful legs.
reset('062_poliwrath')
M = pal([('body', '#3a5fb0'), ('body_dk', '#284690'), ('belly', '#fafafa'), ('spiral', '#1c1c24'), ('eye', '#1a1418'), ('white', '#ffffff'), ('eyew', '#ffffff'),
         ('lid', '#1c2440'), ('glove', '#f6f6f6'), ('mouth', '#3a2230')])
ANGRY = True; ARM_R = 0.07; LEG_R = 0.075
BC = Vector((0, 0, 0.42)); RB = 0.27
body = blob('pw_body', BC, (RB, RB * 0.9, RB * 0.95), lambda c, n, p: 'belly' if (n.y < -0.5 and n.z < 0.55 and n.z > -0.7) else 'body', lambda c: lerp_w('spine', 'chest', (c.z - 0.3) / 0.3), seg=40, rings=24)
if '#1c1c24' != 'none':
    pts = []
    for k in range(60):
        t = k / 59; a = t * 4.2 * math.pi; r = 0.03 + 0.55 * t
        d = Vector((math.cos(a) * r, -1, math.sin(a) * r - 0.1)).normalized(); loc, n = shoot(body, BC, d); pts.append(loc + n * 0.002)
    tube('pw_spiral', pts, [0.009 + 0.008 * k / 59 for k in range(60)], 'spiral', 'chest', seg=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'pw_eyew_{nm}', body, BC, (s * 0.4, -0.55, 0.8), (0.07, 0.03, 0.07), 'eyew', 'head', sink=0.15)
    p, l2, n2 = decal(f'pw_pupil_{nm}', e, loc + Vector((-s * 0.012, -0.01, -0.006)), n, (0.03, 0.014, 0.036), 'eye', 'head', sink=0.05)
    decal(f'pw_shine_{nm}', p, l2 + Vector((0, 0, 0.014)), n2, (0.01, 0.005, 0.01), 'white', 'head', sink=0.05, seg=10, rings=6)
    if ANGRY:
        decal(f'pw_brow_{nm}', body, BC, (s * 0.38, -0.5, 0.93), (0.075, 0.02, 0.018), 'lid', 'head', sink=0.12, up=(s * 0.5, 0, 1))
    sh = BC + Vector((s * RB * 0.92, -0.02, 0.06)); el = sh + Vector((s * 0.12, -0.03, -0.04)); hd = el + Vector((s * 0.06, -0.05, -0.12))
    tube(f'pw_arm_{nm}', [sh, el, hd], [ARM_R, ARM_R * 1.05, ARM_R], 'body', f'arm_{nm}', seg=12)
    blob(f'pw_glove_{nm}', hd + Vector((0, -0.01, -0.03)), (ARM_R * 1.5, ARM_R * 1.4, ARM_R * 1.4), 'glove', f'arm_{nm}', seg=16, rings=10)
    hp = Vector((s * 0.13, 0.0, 0.2)); kn = Vector((s * 0.16, -0.05, 0.1))
    tube(f'pw_leg_{nm}', [hp, kn, Vector((s * 0.15, -0.02, 0.04))], [LEG_R, LEG_R * 0.9, LEG_R * 0.8], 'body', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.2 - c.z) / 0.15), seg=12)
    blob(f'pw_foot_{nm}', (s * 0.16, -0.07, 0.03), (LEG_R * 1.3, LEG_R * 1.9, 0.03), 'body_dk', f'foot_{nm}', seg=16, rings=10)
if False:   # politoed head curl
    cp = [BC + Vector((0, 0.02, RB * 0.9)), BC + Vector((0, -0.02, RB + 0.12)), BC + Vector((0, -0.1, RB + 0.14)), BC + Vector((0, -0.12, RB + 0.07)), BC + Vector((0, -0.08, RB + 0.05))]
    tube('pw_curl', cp, [0.03, 0.026, 0.022, 0.018, 0.012], 'body', 'extra_curl', seg=10)
    for s in (1, -1):   # cheek patches
        decal(f'pw_cheek{s}', body, BC, (s * 0.8, -0.5, 0.35), (0.04, 0.01, 0.03), 'glove', 'head', sink=0.3)
m, _, _ = decal('pw_mouth', body, BC, (0, -1, 0.42), (0.05, 0.008, 0.01), 'mouth', 'head', sink=0.3)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.2), 'root'), ('spine', tuple(BC), 'hips'), ('chest', tuple(BC + Vector((0, 0, 0.1))), 'spine'), ('head', tuple(BC + Vector((0, -0.05, 0.16))), 'chest')]
if False: bones.append(('extra_curl', tuple(BC + Vector((0, 0, RB))), 'head'))
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(BC + Vector((s * RB * 0.92, -0.02, 0.06))), 'chest'), (f'thigh_{nm}', (s * 0.13, 0, 0.2), 'hips'), (f'foot_{nm}', (s * 0.15, -0.03, 0.04), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -RB - 0.03, 0.1))), 'head'), ('socket_fx', tuple(BC + Vector((0, -RB - 0.06, 0.1))), 'head')])
plan_clips(rig, 'biped', size=1.3)
sheet('check', 1.3, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('attack_special', 20, 'front')])
export(62, 'poliwrath', 1.3, 'biped', rig, mesh, shiny={'body': '#3a9a70', 'body_dk': '#287a54'})

# Butterfree (12) · bug/flying · 1.1 m. Purple-blue butterfly: round dark-blue head with huge red compound eyes and two curled antennae, small purple body, two pairs of white wings with black veins/rims, tiny cream arms and feet. Hovers.
reset('012_butterfree')
M = pal([('body', '#5a4fa8'), ('body_dk', '#3c3480'), ('head', '#3a3f8a'), ('eye', '#d2283c'), ('eye_lt', '#ff7a8a'), ('wing', '#f6f6fa'), ('vein', '#1c1c26'), ('cream', '#bfe0f0'),
         ('mouth', '#f2f2f2'), ('white', '#ffffff')], extra_mats=[('wing', {'alpha': 0.92})])
Z = 0.55; HC = Vector((0, -0.04, Z + 0.17))
body = blob('bf_body', (0, 0.01, Z), (0.08, 0.075, 0.11), 'body', lambda c: lerp_w('spine', 'chest', (c.z - Z + 0.05) / 0.1), seg=24, rings=14)
head = blob('bf_head', HC, (0.1, 0.095, 0.09), 'head', 'head', seg=28, rings=16)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'bf_eye_{nm}', head, HC, (s * 0.65, -0.7, 0.1), (0.06, 0.035, 0.065), 'eye', 'head', sink=0.3)
    decal(f'bf_eyeshine_{nm}', e, loc + Vector((0, 0, 0.025)), n, (0.015, 0.006, 0.012), 'eye_lt', 'head', sink=0.05, seg=10, rings=6)
    a0 = HC + Vector((s * 0.035, -0.04, 0.08))
    tube(f'bf_ant_{nm}', [a0, a0 + Vector((s * 0.02, -0.01, 0.06)), a0 + Vector((s * 0.05, -0.02, 0.1)), a0 + Vector((s * 0.08, -0.04, 0.1)), a0 + Vector((s * 0.085, -0.05, 0.08))],
         [0.008, 0.007, 0.006, 0.006, 0.005], 'vein', f'ant_{nm}', seg=6)
    # wings: upper big rounded, lower smaller; white membrane with black rim
    for k, (cz, sz, tilt) in enumerate(((0.07, (0.25, 0.012, 0.2), 25), (-0.08, (0.16, 0.012, 0.13), -30))):
        c = Vector((s * (0.06 + sz[0] * 0.9), 0.06, Z + cz))
        w = blob(f'bf_wing{k}_{nm}', c, sz, lambda c_, n_, p, c0=c, sz=sz: 'vein' if (((c_.x - c0.x) / sz[0]) ** 2 + ((c_.z - c0.z) / sz[2]) ** 2) > 0.72 else 'wing', f'wing_{nm}', seg=28, rings=14, rot=(0, s * -tilt, 0))
        for j in range(3):   # black veins
            a = math.radians(-40 + 40 * j) ; d = Vector((s * math.cos(a), 0, math.sin(a) * (1 if k == 0 else -1)))
            p0 = Vector((s * 0.07, 0.055, Z + cz * 0.4))
            tube(f'bf_vein{k}{j}_{nm}', [p0, p0 + d * sz[0] * 0.8, p0 + d * sz[0] * 1.5], [0.006, 0.005, 0.003], 'vein', f'wing_{nm}', seg=5)
    # little arms and feet
    sh = Vector((s * 0.06, -0.05, Z + 0.03))
    tube(f'bf_arm_{nm}', [sh, sh + Vector((s * 0.04, -0.04, -0.03))], [0.016, 0.013], 'cream', f'arm_{nm}', seg=8)
    hp = Vector((s * 0.04, -0.02, Z - 0.09))
    tube(f'bf_leg_{nm}', [hp, hp + Vector((s * 0.01, -0.02, -0.06))], [0.018, 0.014], 'cream', 'hips', seg=8)
m, _, _ = decal('bf_mouth', head, HC, (0, -1, -0.45), (0.02, 0.01, 0.012), 'mouth', 'head', sink=0.3)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, Z - 0.05), 'root'), ('spine', (0, 0, Z), 'hips'), ('chest', (0, 0, Z + 0.07), 'spine'), ('head', tuple(HC), 'chest')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.06, 0.06, Z), 'chest'), (f'arm_{nm}', (s * 0.06, -0.05, Z + 0.03), 'chest'), (f'ant_{nm}', tuple(HC + Vector((s * 0.035, -0.04, 0.08))), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.1, -0.04))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.14, 0))), 'head')])
def flap(L, a, n=8):
    return {f'wing_{nm}': loop([(round(L * i / n), {'r': (0, sg * (20 + a * math.sin(2 * math.pi * i / n)), 0)}) for i in range(n)], L) for nm, sg in (('l', -1), ('r', 1))}
hover = lambda L, a: merge({'root': bob(0.04, L, 0, 4), 'ant_l': swing(8, L, 0.2, 4, 2), 'ant_r': swing(-8, L, 0.2, 4, 2)}, flap(L, a))
plan_clips(rig, 'rigid', size=1.1, over={'idle': (40, hover(40, 30), True, None), 'idle_alt': (80, hover(80, 18), True, None), 'walk': (24, hover(24, 35), True, None),
    'run': (16, merge(hover(16, 40), {'spine': hold({'r': (15, 0, 0)}, 16)}), True, None), 'fly': (20, hover(20, 40), True, None),
    'attack_special': (40, merge(flap(40, 45), {'root': [(0, {}), (12, {'l': (0, 0.06, 0.06), 'r': (-12, 0, 0)}), (22, {'r': (8, 0, 0)}), (40, {})]}), False, 22),   # Gust / powder burst
    'sleep': (90, merge(flap(90, 4, 4), {'root': loop([(0, {'l': (0, 0, -0.3)}), (45, {'l': (0, 0, -0.29)})], 90), 'head': hold({'r': (20, 0, 0)}, 90)}), True, None)})
sheet('check', 0.9, poses=[('idle', 5, 'front'), ('fly', 10, 'q34'), ('attack_special', 12, 'q34'), ('sleep', 0, 'side')])
export(12, 'butterfree', 1.1, 'rigid', rig, mesh, shiny={'body': '#c86aa8', 'head': '#a85090', 'wing': '#f6e6f0'})

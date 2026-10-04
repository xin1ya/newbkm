# Sandslash (28) · ground · 1.0 m. Upright, yellow with tan belly; back covered in many brown pointed quills (with cream bands); long white claws (2 big per hand), pointed snout, small eyes.
reset('028_sandslash')
M = pal([('yellow', '#e0c45a'), ('yellow_dk', '#b89a3a'), ('belly', '#f2e6c0'), ('quill', '#8a5a2a'), ('quill_lt', '#e8d8a8'), ('claw', '#ffffff'), ('eye', '#1a1418'), ('nose', '#3a2a1a'), ('white', '#ffffff')])
BC = Vector((0, 0.02, 0.42)); HC = Vector((0, -0.05, 0.75))
body = blob('sl_body', BC, (0.17, 0.15, 0.27), lambda c, n, p: 'belly' if n.y < -0.35 else 'yellow', lambda c: lerp_w('spine', 'chest', (c.z - 0.3) / 0.3), seg=32, rings=20)
head = blob('sl_head', HC, (0.11, 0.11, 0.1), lambda c, n, p: 'belly' if n.y < -0.3 and n.z < 0 else 'yellow', 'head', seg=28, rings=16)
blob('sl_snout', HC + Vector((0, -0.11, -0.03)), (0.045, 0.07, 0.04), 'yellow', 'head', seg=16, rings=10, fn=lambda v: Vector((v.x * (1 - 0.4 * max(0, -v.y)), v.y, v.z * (1 - 0.3 * max(0, -v.y)))))
blob('sl_nose', HC + Vector((0, -0.18, -0.02)), (0.013, 0.01, 0.01), 'nose', 'head', seg=8, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'sl_eye_{nm}', head, HC + Vector((0, 0, 0.02)), (s * 0.5, -1, 0.15), (0.018, 0.006, 0.014), 'eye', 'head', sink=0.2)
    sh = Vector((s * 0.15, -0.04, 0.58)); el = Vector((s * 0.22, -0.08, 0.46)); hd = Vector((s * 0.24, -0.14, 0.38))
    tube(f'sl_arm_{nm}', [sh, el, hd], [0.045, 0.04, 0.035], 'yellow', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (0.58 - c.z) / 0.2), seg=10)
    for k in (-1, 1):
        tube(f'sl_claw{k}_{nm}', [hd, hd + Vector((s * 0.01 + k * 0.025, -0.08, -0.06)), hd + Vector((s * 0.01 + k * 0.03, -0.1, -0.14))], [0.018, 0.012, 0.002], 'claw', f'hand_{nm}', seg=6)
    hip = Vector((s * 0.1, 0.02, 0.24)); kn = Vector((s * 0.12, -0.03, 0.12)); ft = Vector((s * 0.12, -0.02, 0.03))
    tube(f'sl_leg_{nm}', [hip, kn, ft], [0.07, 0.055, 0.045], 'yellow', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.24 - c.z) / 0.2), seg=10)
    blob(f'sl_foot_{nm}', ft + Vector((0, -0.04, -0.005)), (0.05, 0.07, 0.03), 'yellow', f'foot_{nm}', seg=12, rings=8)
    for k in range(3):
        tube(f'sl_toe{k}_{nm}', [ft + Vector(((k - 1) * 0.02, -0.09, 0.0)), ft + Vector(((k - 1) * 0.022, -0.12, -0.01))], [0.009, 0.002], 'claw', f'foot_{nm}', seg=6)
# quills over back and head
def quill(name, base, d, r, L, bone):
    o = cone(name, r, 0.002, L, verts=6, loc=base + d * L * 0.45)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, lambda c, n, p: 'quill_lt' if 0.35 < (c - base).length / L < 0.55 else 'quill'); reg(o, bone)
k = 0
for row, z in enumerate((0.25, 0.35, 0.45, 0.55, 0.65, 0.78)):
    for a in range(-60, 61, 30 if row % 2 else 40):
        aa = math.radians(a + (15 if row % 2 else 0)); C = Vector((0, 0.02, z)) if z < 0.7 else HC
        out = Vector((math.sin(aa), math.cos(aa), 0.3 + 0.1 * row)).normalized()
        l, nn = shoot(body if z < 0.7 else head, C, out, fallback=True)
        quill(f'sl_q{k}', l - nn * 0.01, (nn + Vector((0, 0.4, 0.6))).normalized(), 0.035, 0.15 + 0.02 * (row % 3), 'head' if z > 0.7 else ('chest' if z > 0.45 else 'spine')); k += 1
tube('sl_tail', [BC + Vector((0, 0.12, -0.18)), BC + Vector((0, 0.22, -0.28)), BC + Vector((0, 0.3, -0.36))], [0.05, 0.03, 0.005], 'yellow_dk', 'tail1', seg=8)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.02, 0.24), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.58), 'spine'), ('head', tuple(HC + Vector((0, 0, -0.05))), 'chest'), ('tail1', tuple(BC + Vector((0, 0.12, -0.18))), 'hips')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.15, -0.04, 0.58), 'chest'), (f'hand_{nm}', (s * 0.24, -0.14, 0.38), f'arm_{nm}'), (f'thigh_{nm}', (s * 0.1, 0.02, 0.24), 'hips'), (f'foot_{nm}', (s * 0.12, -0.02, 0.04), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.18, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.22, 0))), 'head')])
plan_clips(rig, 'biped', size=1.0, over={'attack_physical': {'arm_r': [(0, {}), (9, {'r': (-60, 0, -30)}), (15, {'r': (60, 0, 20)}), (28, {})], 'arm_l': [(0, {}), (9, {'r': (-60, 0, 30)}), (15, {'r': (60, 0, -20)}), (28, {})]}})   # Slash
sheet('check', 1.0, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(28, 'sandslash', 1.0, 'biped', rig, mesh, shiny={'yellow': '#4a8ac8', 'yellow_dk': '#2a5a9a', 'quill': '#8a2a2a'})

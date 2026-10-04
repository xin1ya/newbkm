# Magcargo (219) · fire/rock · 0.8 m. Lava slug carrying a big grey-brown volcanic rock shell (rough, with glowing cracks and a crater top) on its back; molten red body, yellow eyes.
reset('219_magcargo')
M = pal([('rock', '#7a6a62'), ('rock_dk', '#4a3e3a'), ('lava', '#e8442a'), ('lava_dk', '#b02a1a'), ('glow', '#ffb03a'), ('eye', '#f2d23a'), ('pupil', '#1a1418'), ('mouth', '#6a1a10'), ('white', '#ffffff')])
BC = Vector((0, 0.06, 0.15)); HC = Vector((0, -0.12, 0.4))
base = blob('sg_base', BC, (0.17, 0.26, 0.14), lambda c, n, p: 'glow' if n.z > 0.85 else ('lava_dk' if n.z < -0.4 else 'lava'), lambda c: lerp_w('hips', 'spine', (0.12 - c.y) / 0.25), seg=28, rings=14,
            fn=lambda v: Vector((v.x * (1 + 0.1 * math.sin(v.y * 9)), v.y, v.z * (0.6 if v.z < 0 else 1.0))))
tube('sg_neck', [Vector((0, -0.05, 0.2)), Vector((0, -0.06, 0.32)), HC + Vector((0, 0, -0.06))], [0.12, 0.1, 0.11], 'lava', lambda c: lerp_w('spine', 'head', (c.z - 0.2) / 0.2), seg=16)
head = blob('sg_head', HC, (0.13, 0.12, 0.12), lambda c, n, p: 'glow' if n.z > 0.8 else 'lava', 'head', seg=28, rings=16)
for k in range(4):
    a = math.radians(-60 + 40 * k)
    tube(f'sg_drip{k}', [HC + Vector((math.sin(a) * 0.1, 0.02, 0.07)), HC + Vector((math.sin(a) * 0.13, 0.04, 0.0)), HC + Vector((math.sin(a) * 0.135, 0.05, -0.05 - 0.02 * k))], [0.03, 0.022, 0.018], 'lava', 'head', seg=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'sg_eye_{nm}', head, HC + Vector((0, 0, 0.02)), (s * 0.4, -1, 0.1), (0.04, 0.012, 0.045), 'eye', 'head', sink=0.2)
    decal(f'sg_pupil_{nm}', e, loc, n, (0.014, 0.005, 0.016), 'pupil', 'head', sink=0.05, seg=10, rings=6)
decal('sg_mouth', head, HC + Vector((0, 0, -0.06)), (0, -1, -0.1), (0.025, 0.006, 0.01), 'mouth', 'head', sink=0.3)
cr = [Vector(v).normalized() for v in ((0.7, 0.3, 0.5), (-0.6, 0.4, 0.4), (0.2, 0.9, 0.3), (-0.3, -0.5, 0.7), (0.5, -0.4, 0.6))]
SC = Vector((0, 0.12, 0.33))
blob('mc_shell', SC, (0.2, 0.2, 0.18), lambda c, n, p: 'glow' if any(abs(n.dot(d)) > 0.97 for d in cr) else ('rock_dk' if n.z < -0.2 else 'rock'), 'spine', seg=20, rings=12,
     fn=lambda v: Vector((v.x * (1 + 0.12 * math.sin(v.z * 7 + v.y * 5)), v.y * (1 + 0.1 * math.cos(v.x * 6)), v.z)))
tube('mc_crater', [SC + Vector((0, 0, 0.15)), SC + Vector((0, 0, 0.21))], [0.08, 0.06], 'rock_dk', 'spine', seg=12)
blob('mc_vent', SC + Vector((0, 0, 0.215)), (0.05, 0.05, 0.01), 'glow', 'spine', seg=10, rings=4)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.15, 0.1), 'root'), ('spine', (0, -0.03, 0.22), 'hips'), ('head', tuple(HC + Vector((0, 0, -0.06))), 'spine'), ('tail1', (0, 0.25, 0.1), 'hips')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.13, -0.05))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.18, 0))), 'head')])
plan_clips(rig, 'larva', size=0.8)
sheet('check', 0.8, poses=[('walk', 10, 'side'), ('attack_special', 15, 'q34')])
export(219, 'magcargo', 0.8, 'larva', rig, mesh, shiny={'lava': '#8a8a90', 'lava_dk': '#5a5a60', 'glow': '#c8c8d0', 'rock': '#8a8a90'})

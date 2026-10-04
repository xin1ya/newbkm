# Decidueye (724) · grass/ghost · 1.6 m. Tall archer owl: brown body with cream chest, dark-green leaf hood wrapping the head, cream face mask with sharp eyes, green leaf bangs over one eye, leaf-quill bowstring vine on the chest, long wing cape, long legs.
reset('724_decidueye')
M = pal([('brown', '#8c5a3a'), ('brown_dk', '#6a4129'), ('cream', '#f4e6c8'), ('leaf', '#3a6a3a'), ('leaf_dk', '#24482a'), ('leaf_lt', '#7fc15d'), ('eye', '#1a1418'),
         ('iris', '#c97a2c'), ('white', '#ffffff'), ('beak', '#e7b24a'), ('feet', '#e39a4a'), ('lid', '#5b3a26')])
BC = Vector((0, 0.01, 0.42)); HC = Vector((0, -0.02, 0.7))
body = blob('dtx_body', BC, (0.12, 0.11, 0.22), lambda c, n, p: 'cream' if (n.y < -0.55 and c.z < 0.33 and c.z > 0.16) else 'brown', lambda c: lerp_w('spine', 'chest', (c.z - 0.37) / 0.15), seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.18 * v.z), v.y, v.z)))
head = blob('dtx_head', HC, (0.14, 0.12, 0.12), lambda c, n, p: 'brown', 'head', seg=32, rings=18, fn=lambda v: Vector((v.x, v.y, v.z * (1 + 0.1 * abs(v.x)))))
# heart-shaped face mask (two overlapping discs)
for s, nm in ((1, 'l'), (-1, 'r')):
    m, loc, n = decal(f'dtx_mask_{nm}', head, HC, (s * 0.35, -1, 0.02), (0.065, 0.02, 0.07), 'cream', 'head', sink=0.35)
    e, l2, n2 = decal(f'dtx_eye_{nm}', m, loc + Vector((0, 0, 0.01)), n, (0.036, 0.012, 0.03), 'eye', 'head', sink=0.1)
    ir, l3, n3 = decal(f'dtx_iris_{nm}', e, l2, n2, (0.022, 0.008, 0.02), 'iris', 'head', sink=0.05, seg=14, rings=8)
    decal(f'dtx_pupil_{nm}', ir, l3, n3, (0.011, 0.005, 0.012), 'eye', 'head', sink=0.05, seg=10, rings=6)
    decal(f'dtx_lid_{nm}', m, loc + Vector((0, 0, 0.028)), n, (0.042, 0.016, 0.018), 'lid', 'head', sink=0.05)   # cool half-lidded look
beak = cone('dtx_beak', 0.016, 0.002, 0.035, verts=10, loc=HC + Vector((0, -0.125, -0.03))); beak.rotation_euler = (math.radians(120), 0, 0); colorize(beak, 'beak'); reg(beak, 'head')
# leaf bangs sweeping over the right eye + two small leaf "ear" tufts
bang = blob('dtx_bang', HC + Vector((-0.04, -0.1, 0.05)), (0.06, 0.018, 0.035), lambda c, n, p: 'leaf' if n.y < 0 else 'leaf_dk', 'extra_bang', seg=18, rings=10, rot=(10, 0, -25))
for s in (1, -1):
    blob(f'dtx_tuft_{"l" if s > 0 else "r"}', HC + Vector((s * 0.1, 0.0, 0.11)), (0.03, 0.02, 0.06), 'brown_dk', 'head', seg=12, rings=8, rot=(0, s * -25, 0))
hood = blob('dcd_hood', HC + Vector((0, 0.03, 0.02)), (0.16, 0.13, 0.15), lambda c, n, p: 'leaf' if n.z > -0.3 else 'leaf_dk', 'head', seg=32, rings=18, fn=lambda v: Vector((v.x, v.y if v.y > -0.3 else 99, v.z)) if False else v)
for s_ in (1, -1): blob(f'dcd_hoodside{s_}', HC + Vector((s_ * 0.12, -0.04, -0.06)), (0.05, 0.08, 0.1), 'leaf', 'head', seg=14, rings=8)
# bowstring vine across chest
tube('dcd_vine', [(0.1, -0.09, 0.52), (0.0, -0.12, 0.42), (-0.1, -0.09, 0.3)], 0.01, 'leaf_lt', 'chest', seg=6)
# leaf collar / hood rim around the neck
tube('dtx_collar', [HC + Vector((math.sin(a) * 0.135, math.cos(a) * 0.115, -0.1)) for a in [2 * math.pi * k / 24 for k in range(25)]], 0.014, 'leaf_lt', 'chest', seg=8)
for side in 'lr':
    sg = 1 if side == 'l' else -1
    wing(side, (sg * 0.12, -0.04, 0.56), 0.48, 0.24, 'leaf', n=6, tip_col='leaf_dk', thick=0.022)
    bird_leg(side, (sg * 0.05, 0.02, 0.24), (sg * 0.06, 0.0, 0.025), 'feet', r=0.016, toe_len=0.05)
# leafy tail
for k, a in enumerate((-20, 0, 20)):
    d = Vector((math.sin(math.radians(a)) * 0.5, 1, -0.5)).normalized(); c = Vector((0, 0.12, 0.27)) + d * 0.07
    o = blob(f'dtx_tail{k}', c, (0.03, 0.075, 0.01), 'leaf_dk', 'tail1', seg=14, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.02, 0.3), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.55), 'spine'), ('neck', (0, -0.01, 0.62), 'chest'), ('head', tuple(HC), 'neck'),
         ('extra_bang', tuple(HC + Vector((0, -0.08, 0.07))), 'head'), ('tail1', (0, 0.11, 0.28), 'hips')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.12, -0.03, 0.56), 'chest'), (f'wing2_{nm}', (s * 0.13, 0.12, 0.38), f'wing_{nm}'),
              (f'thigh_{nm}', (s * 0.05, 0.02, 0.24), 'hips'), (f'foot_{nm}', (s * 0.055, 0.0, 0.025), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.16, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.18, 0))), 'head'), ('socket_back', (0, 0.12, 0.52), 'chest')])
plan_clips(rig, 'bird', size=1.6, over={
    'idle': {'extra_bang': swing(4, 60, 0.3, 4, 2)},
    'idle_alt': (100, {'extra_bang': [(0, {}), (20, {'r': (0, 0, 20)}), (26, {'r': (0, 0, -5)}), (32, {}), (100, {})],     # flicks the leaf bang off its eye (preening)
                       'wing_r': [(0, {}), (14, {'r': (0, 40, -40)}), (22, {'r': (0, 50, -60)}), (32, {}), (100, {})], 'head': [(0, {}), (20, {'r': (-8, 0, -10)}), (34, {}), (100, {})]}, True, None),
    'attack_special': (40, {   # Razor Leaf: flings arrow-quills from the wing
        'root': [(0, {}), (12, {'r': (0, 25, 0)}), (22, {'r': (0, -20, 0)}), (40, {})],
        'wing_r': [(0, {}), (12, {'r': (0, 70, -60)}), (22, {'r': (0, -10, 30)}), (40, {})], 'wing_l': [(0, {}), (12, {'r': (0, -20, 10)}), (40, {})],
        'head': [(0, {}), (12, {'r': (0, -20, 0)}), (22, {'r': (0, 10, 0)}), (40, {})]}, False, 22),
})
sheet('check', 0.9, poses=[('walk', 5, 'side'), ('fly', 3, 'front'), ('attack_special', 12, 'q34'), ('attack_physical', 15, 'side')])
export(724, 'decidueye', 1.6, 'bird', rig, mesh, shiny={'leaf': '#4a8fb8', 'leaf_dk': '#2f6a8e', 'leaf_lt': '#7ab5d6', 'brown': '#6b4a3a'})

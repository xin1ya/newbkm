# Caterpie (10) · bug · 0.3 m. Head reared up, four trailing segments (green, cream belly pads), yellow-ringed eyes, red forked antenna, tiny feet.
reset('010_caterpie')
M = pal([('body', '#79c24a'), ('body_dk', '#5a9b34'), ('belly', '#f3e6a0'), ('ring', '#f5d33a'), ('eye', '#1a1418'), ('white', '#ffffff'),
         ('horn', '#e2433a'), ('horn_dk', '#b52e28'), ('foot', '#f1cfa6'), ('mouth', '#4d7a2c')])
SEG = [((0, 0.19, 0.075), 0.075), ((0, 0.1, 0.085), 0.085), ((0, 0.01, 0.1), 0.09), ((0, -0.07, 0.14), 0.085)]  # tail .. neck
names = ['body4', 'body3', 'body2', 'body1']
for (p, r), nm in zip(SEG, names):
    blob(f'cat_{nm}', p, (r * 1.02, r * 0.95, r), lambda c, n, p_, P=p: 'belly' if n.z < -0.2 and n.y < 0.6 else 'body', nm, seg=24, rings=14)
    for s in (1, -1):   # little feet under each segment
        blob(f'cat_foot_{nm}_{"l" if s > 0 else "r"}', (s * r * 0.55, p[1], 0.012), (0.018, 0.018, 0.014), 'foot', nm, seg=10, rings=6)
# tail tip
blob('cat_tail', (0, 0.26, 0.06), (0.05, 0.05, 0.05), 'body', 'body4', seg=18, rings=10)
HC = Vector((0, -0.13, 0.22))
head = blob('cat_head', HC, (0.1, 0.095, 0.1), lambda c, n, p: 'belly' if (n.z < -0.55) else 'body', 'head', seg=32, rings=18)
for s, nm in ((1, 'l'), (-1, 'r')):
    ring, loc, n = decal(f'cat_ring_{nm}', head, HC, (s * 0.75, -0.6, 0.15), (0.05, 0.02, 0.05), 'ring', 'head', sink=0.2)
    e, l2, n2 = decal(f'cat_eye_{nm}', ring, loc, n, (0.035, 0.014, 0.038), 'eye', 'head', sink=0.05)
    decal(f'cat_shine_{nm}', e, l2 + Vector((0, 0, 0.014)) + n2.cross(Vector((0, 0, 1))).normalized() * 0.008 * s, n2, (0.011, 0.004, 0.011), 'white', 'head', sink=0.05, seg=10, rings=6)
decal('cat_mouth', head, HC, (0, -1, -0.45), (0.03, 0.01, 0.012), 'mouth', 'head', sink=0.3)
# forked red osmeterium on top of the head
base = HC + Vector((0, 0.01, 0.09))
tube('cat_horn', [base, base + Vector((0, 0.005, 0.04))], [0.014, 0.012], 'horn', 'extra_horn', seg=10)
for s in (1, -1):
    tube(f'cat_horn_{"l" if s > 0 else "r"}', [base + Vector((0, 0.005, 0.038)), base + Vector((s * 0.025, 0.012, 0.065))], [0.012, 0.008], 'horn', 'extra_horn', seg=10)
    blob(f'cat_hornball_{"l" if s > 0 else "r"}', base + Vector((s * 0.027, 0.012, 0.068)), (0.012, 0.012, 0.012), 'horn_dk', 'extra_horn', seg=10, rings=6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.1, 0.08), 'root'), ('body4', (0, 0.19, 0.075), 'hips'), ('body3', (0, 0.1, 0.085), 'hips'), ('body2', (0, 0.01, 0.1), 'body3'),
         ('body1', (0, -0.07, 0.14), 'body2'), ('neck', (0, -0.1, 0.17), 'body1'), ('head', tuple(HC), 'neck'), ('extra_horn', tuple(base), 'head')]
# the order in the chain file matters for plan waves: body1 (neck side) .. body4 (tail)
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.1, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.12, 0))), 'head')])
H = 0.3
plan_clips(rig, 'larva', size=H, over={
    'idle': {'extra_horn': loop([(0, S(1)), (30, S(1.1))], 60), 'head': swing(5, 60, 0.1, 4, 2)},
    'attack_physical': (28, {'root': [(0, {}), (9, {'l': (0, 0.02, -0.03)}), (15, {'l': (0, 0.03, 0.14)}), (22, {'l': (0, 0, 0.04)}), (28, {})],
                             'body1': [(0, {}), (9, {'r': (-20, 0, 0)}), (15, {'r': (25, 0, 0)}), (28, {})], 'head': [(0, {}), (9, {'r': (-15, 0, 0)}), (15, {'r': (20, 0, 0)}), (28, {})]}, False, 15),
    'attack_special': (40, {'body1': [(0, {}), (12, {'r': (-15, 0, 0)}), (22, {'r': (12, 0, 0)}), (40, {})], 'head': [(0, {}), (12, {'r': (-20, 0, 0)}), (22, {'r': (15, 0, 0)}), (40, {})],   # String Shot
                            'extra_horn': [(0, S(1)), (12, S(1.4)), (22, S(1.2)), (40, S(1))], 'root': [(0, {}), (12, {'l': (0, 0.02, 0)}), (22, {}), (40, {})]}, False, 22),
})
sheet('check', H, poses=[('walk', 10, 'side'), ('attack_physical', 15, 'q34'), ('attack_special', 12, 'q34'), ('faint', 40, 'q34')])
export(10, 'caterpie', 0.3, 'larva', rig, mesh, shiny={'body': '#e6c34a', 'body_dk': '#c09c2a', 'belly': '#f7ecc2'})

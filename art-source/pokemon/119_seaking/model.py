# Seaking (119) · water · 1.3 m long. Evolution of Goldeen — derived from the Goldeen build, reshaped to the reference (art-source/reference,
# comparison only): a short, round, tubby body (orange-red back, white belly) dotted with black spots, a black-and-white striped dorsal crest,
# thick pink lips with two small fangs, a stout white horn, white pectoral/pelvic fins with black spots held downward, and a broad split tail.
reset('119_seaking')
M = pal([('white', '#f2f0ea'), ('spot', '#262224'), ('white_dk', '#dcd8d0'), ('orange', '#d8562a'), ('orange_dk', '#a83c1a'), ('lip', '#f4a0a8'), ('horn', '#fbf6ea'), ('horn_dk', '#e0d6c0'),
         ('eye', '#1a1418'), ('iris', '#3a6ad0'), ('shine', '#ffffff')],
        extra_mats=[('veil', {'alpha': 0.85})])
LEN = 0.5; Z0 = 0.32
def fbody(v):
    t = min(1.0, max(0.0, (v.y + 1) / 2))
    w = 0.2 * (1 - 0.45 * t ** 1.6)
    hgt = 0.21 * (max(0.0, math.sin(math.pi * min(0.97, 0.1 + t * 0.9))) ** 0.6) + 0.02
    return Vector((v.x * w, v.y * LEN * 0.33, v.z * hgt))
def bcol(c, n, p):
    if math.sin(c.y * 22 + 1.2) * math.cos(c.z * 18) > 0.25 and c.y > -0.12 and n.z > -0.4: return 'orange'
    return 'white'
body = blob('sea_body', (0, 0, Z0), (1, 1, 1), lambda c, n, p: 'white' if n.z < -0.35 else 'orange', lambda c: {}, seg=40, rings=24, fn=fbody)
NOSE = shoot(body, (0, 0, Z0), (0, -1, 0))[0]
for k, (d, sz) in enumerate((((0.9, -0.3, 0.3), 0.03), ((-0.9, -0.3, 0.3), 0.03), ((0.95, 0.2, 0.1), 0.035), ((-0.95, 0.2, 0.1), 0.035), ((0.7, 0.6, 0.4), 0.025), ((-0.7, 0.6, 0.4), 0.025), ((0.5, 0.1, 0.85), 0.03), ((-0.5, 0.1, 0.85), 0.03), ((0.8, 0.35, -0.3), 0.022), ((-0.8, 0.35, -0.3), 0.022))):
    decal(f'sea_spot{k}', body, (0, 0.0, Z0), d, (sz, 0.008, sz * 1.1), 'spot', lambda c: seg_w(c, ['head', 'body1', 'body2', 'body3']), sink=0.5, seg=12, rings=6)
for s_ in (1, -1):
    t_ = cone(f'sea_fang{s_ + 1}', 0.008, 0.0, 0.022, verts=6, loc=(s_ * 0.018, NOSE.y + 0.003, Z0 - 0.045)); t_.rotation_euler = (math.pi, 0, 0); colorize(t_, 'shine'); reg(t_, 'head')
# pouty lips
tube('sea_lip', [(math.sin(a) * 0.028, NOSE.y + 0.005, Z0 - 0.015 + math.cos(a) * 0.022) for a in [2 * math.pi * k / 20 for k in range(21)]], 0.016, 'lip', 'head', seg=8)
# horn
H0 = shoot(body, (0, -0.12, Z0), (0, -0.55, 0.85))[0]
tube('sea_horn', [H0 - Vector((0, 0, 0.01)), H0 + Vector((0, -0.05, 0.05)), H0 + Vector((0, -0.12, 0.11))], [0.03, 0.018, 0.002], lambda c, n, p: 'horn_dk' if math.sin(c.z * 260) > 0.6 else 'horn', 'head', seg=10)
# eyes with lashes
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'sea_eye_{nm}', body, (0, -0.13, Z0 + 0.02), (s, -0.4, 0.2), (0.042, 0.014, 0.045), 'white', 'head', sink=0.25)
    i_, l2, n2 = decal(f'sea_iris_{nm}', e, loc, n, (0.022, 0.008, 0.028), 'iris', 'head', sink=0.0, seg=12, rings=6)
    decal(f'sea_pupil_{nm}', i_, l2, n2, (0.008, 0.004, 0.011), 'eye', 'head', sink=-0.1, seg=10, rings=5)
    for k in range(3):
        b = loc + Vector((0, -0.01 + 0.012 * k, 0.028))
        tube(f'sea_lash{k}_{nm}', [b, b + Vector((s * 0.012, 0.004 * k, 0.014))], [0.003, 0.0008], 'eye', 'head', seg=5)
# dorsal fin: tall flowing sail
TOP = lambda y: shoot(body, (0, y, Z0), (0, 0, 1))[0]
p = TOP(0.0)
blob('sea_dorsal', (0, p.y + 0.04, p.z + 0.02), (0.012, 0.19, 0.05), lambda c, n, p_: 'spot' if math.sin(c.y * 70) > 0.2 else 'white', lambda c: seg_w(c, ['body1', 'body2', 'body3']), seg=18, rings=10, rot=(-15, 0, 0), mat=M['veil'])
# pectoral veils spread wide to the sides
for s, nm in ((1, 'l'), (-1, 'r')):
    blob(f'sea_pec_{nm}', (s * 0.22, -0.02, Z0 - 0.12), (0.13, 0.1, 0.008), lambda c, n, p_: 'spot' if math.sin(c.x * 90) * math.sin(c.y * 80) > 0.7 else 'white', f'fin_{nm}', seg=20, rings=10, rot=(0, s * 55, s * 10), mat=M['veil'])
    blob(f'sea_pelv_{nm}', (s * 0.07, 0.1, Z0 - 0.1), (0.05, 0.07, 0.008), 'white', 'body2', seg=14, rings=8, rot=(30, s * -40, 0), mat=M['veil'])
# long trailing tail: three lobes
for i, (a, x, L) in enumerate(((22, 0, 0.32), (0, 0.06, 0.4), (-22, -0.06, 0.4))):
    if i == 0:
        blob('sea_tail_top', (0, 0.28, Z0 + 0.08), (0.008, 0.12, 0.05), lambda c, n, p_: 'spot' if math.sin(c.y * 60) * math.sin(c.z * 50) > 0.7 else 'white', 'tailfin', seg=18, rings=10, rot=(a, 0, 0), mat=M['veil'])
    else:
        blob(f'sea_tail{i}', (0, 0.36, Z0 + x * 2.2), (0.008, 0.16, 0.11), lambda c, n, p_: 'spot' if math.sin(c.z * 60) * math.sin(c.y * 50) > 0.7 else 'white', 'tailfin', seg=20, rings=10, rot=(x * 600, 0, 0), mat=M['veil'])
reg(body, lambda c: seg_w(c, ['head', 'body1', 'body2', 'body3']))
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.05, Z0), 'root'), ('spine', (0, -0.02, Z0), 'hips'), ('head', (0, -0.12, Z0), 'spine'),
         ('body1', (0, -0.02, Z0), 'hips'), ('body2', (0, 0.08, Z0), 'body1'), ('body3', (0, 0.16, Z0), 'body2'), ('tailfin', (0, 0.22, Z0), 'body3'),
         ('fin_l', (0.07, 0.0, Z0 - 0.04), 'spine'), ('fin_r', (-0.07, 0.0, Z0 - 0.04), 'spine')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, NOSE.y - 0.02, Z0 - 0.015), 'head'), ('socket_fx', tuple(H0 + Vector((0, -0.12, 0.11))), 'head')])
H = 0.5
glide = lambda L, a: {**wave(['body1', 'body2', 'body3', 'tailfin'], a, L, 0.12), 'fin_l': swing(14, L, 0, 4, 1), 'fin_r': swing(14, L, 0.5, 4, 1),
                      'root': loop([(0, {}), (L // 2, {'l': (0, 0, 0.04 * H)})], L)}
plan_clips(rig, 'fish', size=H, over={
    'idle': (60, glide(60, 8), True, None), 'walk': (30, glide(30, 14), True, None), 'run': (18, glide(18, 20), True, None),
    'attack_physical': (30, {'root': [(0, {}), (10, {'l': (0, 0.2 * H, 0), 'r': (12, 0, 0)}), (16, {'l': (0, -0.6 * H, 0), 'r': (-8, 0, 0)}), (30, {})]}, False, 16),   # Horn Attack lunge
})
sheet('check', 0.62, poses=[('walk', 6, 'side'), ('attack_physical', 16, 'q34'), ('swim', 9, 'q34'), ('idle', 20, 'front')])
export(119, 'seaking', 1.3, 'fish', rig, mesh, shiny={'orange': '#f4c03a', 'orange_dk': '#c89a22'}, fit='length')

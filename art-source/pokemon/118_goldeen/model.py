# Goldeen (118) · water · 0.6 m long. Elegant goldfish: plump white body with orange-red patches, a single white horn on the brow,
# pink pouty lips, big eyes with long lashes, flowing veil-like pectoral fins spread wide, a long trailing triple tail and tall dorsal fin.
reset('118_goldeen')
M = pal([('white', '#f6f4f0'), ('white_dk', '#dcd8d0'), ('orange', '#f06a32'), ('orange_dk', '#c84a1e'), ('lip', '#f4a0a8'), ('horn', '#fbf6ea'), ('horn_dk', '#e0d6c0'),
         ('eye', '#1a1418'), ('iris', '#3a6ad0'), ('shine', '#ffffff')],
        extra_mats=[('veil', {'alpha': 0.85})])
LEN = 0.6; Z0 = 0.3
def fbody(v):
    t = min(1.0, max(0.0, (v.y + 1) / 2))
    w = 0.2 * (1 - 0.6 * t ** 1.5)
    hgt = 0.17 * (max(0.0, math.sin(math.pi * min(0.97, 0.1 + t * 0.9))) ** 0.6) + 0.02
    return Vector((v.x * w, v.y * LEN * 0.33, v.z * hgt))
def bcol(c, n, p):
    if math.sin(c.y * 22 + 1.2) * math.cos(c.z * 18) > 0.25 and c.y > -0.12 and n.z > -0.4: return 'orange'
    return 'white'
body = blob('gol_body', (0, 0, Z0), (1, 1, 1), 'white', lambda c: {}, seg=40, rings=24, fn=fbody)
NOSE = shoot(body, (0, 0, Z0), (0, -1, 0))[0]
# soft orange patches on the back and flanks (separate decals, not per-face paint)
for k, (y, d, sz) in enumerate(((0.05, (0, 0.1, 1), (0.07, 0.008, 0.09)), (0.0, (1, 0.3, 0.5), (0.05, 0.008, 0.06)), (0.0, (-1, 0.3, 0.5), (0.05, 0.008, 0.06)),
                                (0.1, (0.8, 0.6, -0.1), (0.04, 0.008, 0.045)), (0.1, (-0.8, 0.6, -0.1), (0.04, 0.008, 0.045)))):
    decal(f'gol_patch{k}', body, (0, y, Z0), d, sz, 'orange', lambda c: seg_w(c, ['head', 'body1', 'body2', 'body3']), sink=0.6, seg=16, rings=8)
decal('gol_cap', body, (0, -0.1, Z0), (0, -0.4, 1), (0.07, 0.01, 0.08), 'orange', 'head', sink=0.6)
# pouty lips
tube('gol_lip', [(math.sin(a) * 0.028, NOSE.y + 0.005, Z0 - 0.015 + math.cos(a) * 0.022) for a in [2 * math.pi * k / 20 for k in range(21)]], 0.011, 'lip', 'head', seg=8)
# horn
H0 = shoot(body, (0, -0.12, Z0), (0, -0.55, 0.85))[0]
tube('gol_horn', [H0 - Vector((0, 0, 0.01)), H0 + Vector((0, -0.05, 0.05)), H0 + Vector((0, -0.12, 0.11))], [0.02, 0.012, 0.001], lambda c, n, p: 'horn_dk' if math.sin(c.z * 260) > 0.6 else 'horn', 'head', seg=10)
# eyes with lashes
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'gol_eye_{nm}', body, (0, -0.13, Z0 + 0.02), (s, -0.4, 0.2), (0.03, 0.012, 0.032), 'white', 'head', sink=0.25)
    i_, l2, n2 = decal(f'gol_iris_{nm}', e, loc, n, (0.016, 0.006, 0.02), 'iris', 'head', sink=0.0, seg=12, rings=6)
    decal(f'gol_pupil_{nm}', i_, l2, n2, (0.008, 0.004, 0.011), 'eye', 'head', sink=-0.1, seg=10, rings=5)
    for k in range(3):
        b = loc + Vector((0, -0.01 + 0.012 * k, 0.028))
        tube(f'gol_lash{k}_{nm}', [b, b + Vector((s * 0.012, 0.004 * k, 0.014))], [0.003, 0.0008], 'eye', 'head', seg=5)
# dorsal fin: tall flowing sail
TOP = lambda y: shoot(body, (0, y, Z0), (0, 0, 1))[0]
p = TOP(0.0)
blob('gol_dorsal', (0, p.y + 0.06, p.z + 0.03), (0.008, 0.16, 0.07), lambda c, n, p_: 'orange' if c.z > p.z + 0.08 else 'white', lambda c: seg_w(c, ['body1', 'body2', 'body3']), seg=18, rings=10, rot=(-15, 0, 0), mat=M['veil'])
# pectoral veils spread wide to the sides
for s, nm in ((1, 'l'), (-1, 'r')):
    blob(f'gol_pec_{nm}', (s * 0.27, 0.02, Z0 - 0.05), (0.24, 0.17, 0.008), lambda c, n, p_: 'orange' if abs(c.x) > 0.36 else 'white', f'fin_{nm}', seg=20, rings=10, rot=(0, s * 15, s * 20), mat=M['veil'])
    blob(f'gol_pelv_{nm}', (s * 0.07, 0.1, Z0 - 0.1), (0.05, 0.07, 0.008), 'white', 'body2', seg=14, rings=8, rot=(30, s * -40, 0), mat=M['veil'])
# long trailing tail: three lobes
for i, (a, x, L) in enumerate(((22, 0, 0.32), (0, 0.06, 0.4), (-22, -0.06, 0.4))):
    if i == 0:
        blob('gol_tail_top', (0, 0.34, Z0 + 0.06), (0.008, 0.2, 0.05), lambda c, n, p_: 'orange' if c.y > 0.38 else 'white', 'tailfin', seg=18, rings=10, rot=(a, 0, 0), mat=M['veil'])
    else:
        blob(f'gol_tail{i}', (x * 2.2, 0.44, Z0 - 0.02), (0.15, 0.26, 0.008), lambda c, n, p_: 'orange' if c.y > 0.45 else 'white', 'tailfin', seg=20, rings=10, rot=(-8, 0, x * 250), mat=M['veil'])
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
export(118, 'goldeen', 0.6, 'fish', rig, mesh, shiny={'orange': '#f4c03a', 'orange_dk': '#c89a22'}, fit='length')

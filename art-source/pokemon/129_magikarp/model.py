# Magikarp (129) · water · 0.9 m long. Upright on its fins, flat-sided orange body, crown fin, white lips, yellow barbels, vacant eyes.
reset('129_magikarp')
M = pal([('body', '#e8562e'), ('body_dk', '#c23f20'), ('belly', '#f6c7a0'), ('scale', '#d24a26'), ('fin', '#f5e1b0'), ('fin_dk', '#dcc28a'),
         ('lip', '#fbf3e6'), ('barbel', '#f2c43c'), ('eye', '#1a1418'), ('white', '#ffffff'), ('mouth', '#9a2b22')])
LEN = 0.9; Z0 = 0.34
def fbody(v):
    x, y, z = v.x, v.y, v.z
    t = min(1.0, max(0.0, (y + 1) / 2))                 # 0 nose .. 1 tail
    w = 0.13 * (1 - 0.55 * t ** 1.6)                    # flat sides, thin to the tail
    hgt = 0.26 * (max(0.0, math.sin(math.pi * min(0.97, 0.12 + t * 0.92))) ** 0.7) + 0.02
    return Vector((x * w / 0.13 * 0.13, y * LEN * 0.34, z * hgt + 0.02 * (1 - t) * max(0, z)))
body = blob('karp_body', (0, 0, Z0), (1, 1, 1), 'body', lambda c: {}, seg=40, rings=24, fn=fbody)
def body_col(c, n, p):
    if c.z < Z0 - 0.12 and n.z < 0.2: return 'belly'
    # crescent scale rows
    u = (c.y + 0.3) / 0.07; v = (c.z - Z0) / 0.07
    ph = (u + (0.5 if int(math.floor(v)) % 2 else 0)) % 1
    return 'body'
paint(body, MAT, body_col)

# lips: fat white ring around the open mouth at the nose
NOSE = shoot(body, (0, 0, Z0 - 0.02), (0, -1, 0))[0]
tube('karp_lip', [(math.sin(a) * 0.06, NOSE.y + 0.015 - 0.01 * math.cos(a) ** 2, Z0 - 0.02 + math.cos(a) * 0.055) for a in [2 * math.pi * k / 24 for k in range(25)]], 0.022, 'lip', 'head', seg=10)
blob('karp_mouth', (0, NOSE.y + 0.02, Z0 - 0.02), (0.045, 0.02, 0.04), 'mouth', 'jaw', seg=16, rings=8)
# barbels: long yellow whiskers from the upper lip corners, drooping back
for s, nm in ((1, 'l'), (-1, 'r')):
    base = Vector((s * 0.055, NOSE.y + 0.03, Z0 + 0.03))
    pts = [base + Vector((s * 0.16 * t, 0.16 * t, 0.08 * math.sin(t * 2.2) - 0.12 * t * t)) for t in [k / 8 for k in range(9)]]
    tube(f'karp_barbel_{nm}', pts, [0.018 * (1 - 0.6 * k / 8) for k in range(9)], 'barbel', 'head', seg=8)
# eyes: big white discs with a tiny centered pupil (the famous blank stare)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'karp_eye_{nm}', body, (0, -0.17, Z0 + 0.06), (s, -0.25, 0.12), (0.055, 0.02, 0.055), 'white', 'head', sink=0.2)
    decal(f'karp_pupil_{nm}', e, loc, n, (0.013, 0.008, 0.013), 'eye', 'head', sink=0.05, seg=12, rings=6)
    tube(f'karp_eyering_{nm}', [loc + (Vector((0, math.sin(a), math.cos(a))) - n * n.dot(Vector((0, math.sin(a), math.cos(a))))).normalized() * 0.056 + n * 0.004 for a in [2 * math.pi * k / 24 for k in range(25)]], 0.005, 'body_dk', 'head', seg=6)

# crown dorsal fin: three rounded lobes along the back
TOP = lambda y: shoot(body, (0, y, Z0), (0, 0, 1))[0]
for i, (y, h, lean) in enumerate(((-0.1, 0.12, -25), (0.0, 0.14, -10), (0.1, 0.11, 10))):
    p = TOP(y)
    blob(f'karp_crown{i}', (0, p.y, p.z + h * 0.35), (0.012, 0.05, h * 0.55), lambda c, n, p_: 'fin' if c.z > p.z + 0.03 else 'fin_dk', lambda c: seg_w(c, ['head', 'body1', 'body2', 'body3']), seg=16, rings=10, rot=(lean, 0, 0))
# tail fin: two broad lobes (V)
for i, a in enumerate((35, -35)):
    blob(f'karp_tail{i}', (0, 0.36, Z0 + 0.05 * (1 if a > 0 else -1)), (0.014, 0.1, 0.07), lambda c, n, p: 'fin', 'tailfin', seg=16, rings=10, rot=(a, 0, 0))
# pectoral + pelvic fins (stands on the pelvic pair)
for s, nm in ((1, 'l'), (-1, 'r')):
    o = blob(f'karp_fin_{nm}', (s * 0.12, -0.08, Z0 - 0.1), (0.012, 0.07, 0.05), 'fin', f'fin_{nm}', seg=14, rings=8, rot=(30, 0, s * 35))
    blob(f'karp_pelvic_{nm}', (s * 0.06, 0.08, 0.05), (0.012, 0.06, 0.05), 'fin', 'body2', seg=14, rings=8, rot=(35, 0, s * 20))
# body weights along the spine chain
reg(body, lambda c: seg_w(c, ['head', 'body1', 'body2', 'body3']))

bones = [('root', (0, 0, 0), None), ('hips', (0, 0.06, Z0), 'root'), ('spine', (0, -0.02, Z0), 'hips'), ('head', (0, -0.16, Z0), 'spine'), ('jaw', (0, NOSE.y + 0.02, Z0 - 0.02), 'head'),
         ('body1', (0, -0.02, Z0), 'hips'), ('body2', (0, 0.12, Z0), 'body1'), ('body3', (0, 0.24, Z0), 'body2'), ('tailfin', (0, 0.3, Z0), 'body3'),
         ('fin_l', (0.1, -0.08, Z0 - 0.08), 'spine'), ('fin_r', (-0.1, -0.08, Z0 - 0.08), 'spine')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, NOSE.y - 0.03, Z0 - 0.02), 'head'), ('socket_fx', (0, NOSE.y - 0.05, Z0), 'head')])
H = 0.6
flop = lambda L: {'root': [(0, {}), (L // 4, {'l': (0, 0.25 * H, 0.05), 'r': (0, 0, 30)}), (L // 2, {}), (3 * L // 4, {'l': (0, 0.25 * H, 0.05), 'r': (0, 0, -30)}), (L, {})],
                  **wave(['body1', 'body2', 'body3', 'tailfin'], 20, L, 0.12)}
plan_clips(rig, 'fish', size=H, over={
    'walk': (24, flop(24), True, None), 'run': (16, flop(16), True, None),
    'attack_special': (48, {   # Splash: flops high in the air, uselessly
        'root': [(0, {}), (8, {'l': (0, -0.05 * H, 0), 's': (1.05, 0.9, 1.05)}), (18, {'l': (0, 0.8 * H, 0), 'r': (0, 0, 60)}), (24, {'l': (0, 0.9 * H, 0), 'r': (0, 0, -60)}),
                 (30, {'l': (0, 0.8 * H, 0), 'r': (0, 0, 60)}), (40, {'l': (0, 0, 0), 'r': (0, 0, 0)}), (44, {'s': (1.05, 0.92, 1.05)}), (48, {})],
        **{b: swing(30, 12, -0.12 * i, 4, 1) + [] for i, b in enumerate(['body1', 'body2', 'body3', 'tailfin'])},
    }, False, 24),
    'attack_physical': (30, {'root': [(0, {}), (10, {'r': (-20, 0, 0), 'l': (0, 0.15 * H, -0.1 * H)}), (16, {'r': (25, 0, 0), 'l': (0, 0.1 * H, 0.45 * H)}), (22, {'l': (0, 0, 0.1 * H)}), (30, {})],
                             'body3': [(0, {}), (10, {'r': (0, 40, 0)}), (16, {'r': (0, -40, 0)}), (30, {})], 'tailfin': [(0, {}), (10, {'r': (0, 30, 0)}), (16, {'r': (0, -30, 0)}), (30, {})]}, False, 16),
})
sheet('check', 0.7, poses=[('walk', 6, 'front'), ('attack_special', 24, 'q34'), ('swim', 9, 'q34'), ('faint', 40, 'q34')])
export(129, 'magikarp', 0.9, 'fish', rig, mesh, shiny={'body': '#f2c23a', 'body_dk': '#c99a22', 'scale': '#dcaa2a', 'belly': '#fbe7b0'}, fit='length')

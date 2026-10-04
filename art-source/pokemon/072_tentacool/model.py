# Tentacool (72) · water/poison · 0.9 m. Translucent blue jelly dome with two red crystal orbs, small white beak, two long trailing tentacles (and short stubs). Floats.
reset('072_tentacool')
M = pal([('dome', '#6ec1f0'), ('dome_dk', '#3f8fcc'), ('red', '#e0303f'), ('red_lt', '#ff8a96'), ('white', '#f4f4f0'), ('eye', '#1a1418'), ('tent', '#3f7fd0'), ('tent_dk', '#2a5ca8')], extra_mats=[('dome', {'alpha': 0.8})])
Z = 0.55
dome = blob('tc_dome', (0, 0, Z), (0.2, 0.17, 0.22), lambda c, n, p: 'dome' if n.z > -0.3 else 'dome_dk', 'spine', seg=36, rings=20, mat=M['dome'],
            fn=lambda v: Vector((v.x * (1 - 0.18 * max(0, v.z)), v.y * (1 - 0.18 * max(0, v.z)), v.z * (0.55 if v.z < 0 else 1))))
for s, nm in ((1, 'l'), (-1, 'r')):
    blob(f'tc_orb_{nm}', (s * 0.1, -0.1, Z - 0.02), (0.06, 0.05, 0.06), 'red', 'spine', seg=24, rings=14)
    blob(f'tc_orbshine_{nm}', (s * 0.1 - s * 0.015, -0.145, Z + 0.01), (0.012, 0.008, 0.016), 'red_lt', 'spine', seg=10, rings=6)
    blob(f'tc_eye_{nm}', (s * 0.05, -0.145, Z - 0.1), (0.012, 0.008, 0.018), 'eye', 'spine', seg=10, rings=6)
blob('tc_orb_top', (0, 0.02, Z + 0.17), (0.035, 0.03, 0.03), 'red', 'spine', seg=16, rings=10)
beak = cone('tc_beak', 0.03, 0.004, 0.06, verts=12, loc=(0, -0.12, Z - 0.14)); beak.rotation_euler = (math.radians(160), 0, 0); colorize(beak, 'white'); reg(beak, 'spine')
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, Z - 0.1), 'root'), ('spine', (0, 0, Z), 'hips')]
TENT = []
for s, nm in ((1, 'l'), (-1, 'r')):
    b0 = Vector((s * 0.06, -0.02, Z - 0.1)); pts = [b0 + Vector((s * 0.03 * t, 0.05 * t, -0.52 * t)) + Vector((s * 0.03 * math.sin(t * 5), 0, 0)) for t in [j / 7 for j in range(8)]]
    ch = [f't{nm}{i}' for i in range(1, 4)]
    tube(f'tc_tent_{nm}', pts, [0.03 - 0.025 * j / 7 + 0.002 for j in range(8)], lambda c, n, p: 'tent' if n.y < 0.3 else 'tent_dk', lambda c, ch=ch: seg_w(c, ['hips'] + ch), seg=10)
    prev = 'hips'
    for i, c in enumerate(ch): bones.append((c, tuple(pts[i * 2 + 1]), prev)); prev = c
    TENT.append(ch)
for k in range(6):   # short stub tentacles ringing the skirt
    a = math.radians(30 + 60 * k); b0 = Vector((math.sin(a) * 0.14, math.cos(a) * 0.12, Z - 0.1))
    tube(f'tc_stub{k}', [b0, b0 + Vector((math.sin(a) * 0.02, math.cos(a) * 0.02, -0.07)), b0 + Vector((math.sin(a) * 0.03, math.cos(a) * 0.03, -0.12))], [0.018, 0.013, 0.004], 'tent', 'hips', seg=8)
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.14, Z - 0.17), 'spine'), ('socket_fx', (0, 0, Z + 0.22), 'spine')])
def TW(L, a, n=1):
    out = {}
    for j, ch in enumerate(TENT):
        for i, b in enumerate(ch): out[b] = swing(a * (1 + 0.4 * i), L, 0.15 * i + 0.3 * j, 4, n)
    return out
FLOAT = lambda L: {'root': loop([(0, {'l': (0, 0, 0.0)}), (L // 2, {'l': (0, 0, 0.04)})], L)}
plan_clips(rig, 'rigid', size=0.9, over={'idle': merge(TW(60, 12), {'hips': loop([(0, {}), (30, {'s': (1.06, 1.06, 0.95)})], 60)}), 'idle_alt': TW(80, 10), 'walk': TW(24, 18), 'run': TW(16, 25), 'sleep': TW(90, 5), 'hit': TW(12, 25),
    'attack_physical': TW(28, 30, 2),   # Wrap/Poison Sting: tentacles whip on the lunge
    'swim': (40, merge(TW(40, 22), {'root': loop([(0, {'r': (15, 0, 0)}), (20, {'r': (15, 0, 0), 'l': (0, 0, 0.05)})], 40), 'spine': loop([(0, {}), (10, {'s': (1.1, 1.1, 0.88)}), (20, {})], 40)}), True, None)})
sheet('check', 0.8, poses=[('idle', 10, 'front'), ('walk', 6, 'side'), ('attack_physical', 15, 'q34'), ('swim', 10, 'q34')])
export(72, 'tentacool', 0.9, 'rigid', rig, mesh, shiny={'dome': '#e6a4d8', 'dome_dk': '#c07ab5', 'tent': '#b8629e', 'tent_dk': '#8e3f7a'})

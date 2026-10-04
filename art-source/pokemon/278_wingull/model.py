# Wingull (278) · water/flying · 0.6 m. Sleek white gull, long straight wings held out (blue stripe + tips), long yellow beak, blue tail, tiny feet. Always gliding.
reset('278_wingull')
M = pal([('white', '#fbfbfd'), ('white_dk', '#dde3ec'), ('blue', '#4a86d4'), ('blue_dk', '#2f63a8'), ('beak', '#f4c63d'), ('beak_dk', '#d19a1f'), ('eye', '#1a1418'), ('shine', '#ffffff'), ('feet', '#f0b43a')])
Z = 0.3
body = blob('wgl_body', (0, 0.02, Z), (0.09, 0.2, 0.085), lambda c, n, p: 'white' if n.z > -0.5 else 'white_dk', lambda c: seg_w(c, ['head', 'chest', 'spine', 'hips']), seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.3 * max(0, v.y)), v.y, v.z * (1 - 0.35 * max(0, v.y)) + 0.1 * (1 - v.y * v.y) * 0)))
head = blob('wgl_head', (0, -0.17, Z + 0.035), (0.07, 0.07, 0.065), 'white', 'head', seg=28, rings=16)
beak = tube('wgl_beak', [(0, -0.22, Z + 0.03), (0, -0.3, Z + 0.025), (0, -0.37, Z + 0.015)], [0.025, 0.02, 0.016], lambda c, n, p: 'beak' if n.z > -0.3 else 'beak_dk', 'head', seg=12, flat=0.8)
blob('wgl_beaktip', (0, -0.372, Z + 0.012), (0.017, 0.02, 0.018), 'beak', 'head', seg=12, rings=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'wgl_eye_{nm}', head, (0, -0.18, Z + 0.05), (s * 0.8, -0.35, 0.3), (0.013, 0.007, 0.022), 'eye', 'head', sink=0.2)
    decal(f'wgl_shine_{nm}', e, loc + Vector((0, 0, 0.007)), n, (0.005, 0.003, 0.005), 'shine', 'head', sink=0.05, seg=10, rings=6)
    # long straight wing: shoulder -> elbow -> tip, flattened; top white, blue stripe along the leading edge, blue tip
    sh = Vector((s * 0.07, -0.03, Z + 0.03)); el = Vector((s * 0.3, -0.02, Z + 0.06)); tp = Vector((s * 0.58, 0.04, Z + 0.05))
    def wcol(c, n, p, s=s):
        ax = abs(c.x)
        if ax > 0.48: return 'blue_dk'
        if n.y < -0.75 and ax > 0.12: return 'blue'
        return 'white' if n.z > -0.2 else 'white_dk'
    tube(f'wgl_wing_{nm}', [sh, (sh + el) / 2, el, (el + tp) / 2, tp], [0.05, 0.06, 0.055, 0.045, 0.018], wcol,
         lambda c, nm=nm: lerp_w(f'wing_{nm}', f'wing2_{nm}', (abs(c.x) - 0.2) / 0.15), seg=12, flat=0.22)
    blob(f'wgl_foot_{nm}', (s * 0.03, 0.1, Z - 0.075), (0.015, 0.025, 0.01), 'feet', 'hips', seg=10, rings=6)
# tail: two blue-tipped feathers
for k, a in enumerate((-14, 14)):
    d = Vector((math.sin(math.radians(a)), 1, 0.05)).normalized(); c = Vector((0, 0.21, Z + 0.01)) + d * 0.06
    o = blob(f'wgl_tail{k}', c, (0.03, 0.07, 0.008), lambda c_, n, p: 'blue' if c_.y > 0.25 else 'white', 'tail1', seg=14, rings=8)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.12, Z), 'root'), ('spine', (0, 0.02, Z), 'hips'), ('chest', (0, -0.08, Z), 'spine'), ('head', (0, -0.17, Z + 0.035), 'chest'),
         ('tail1', (0, 0.2, Z), 'hips')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'wing_{nm}', (s * 0.07, -0.03, Z + 0.03), 'chest'), (f'wing2_{nm}', (s * 0.3, -0.02, Z + 0.06), f'wing_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.39, Z + 0.02), 'head'), ('socket_fx', (0, -0.4, Z + 0.02), 'head')])
def flap(L, a, lift=0, n=8, a2=0.6):
    out = {}
    for side, sg in (('l', 1), ('r', -1)):
        out[f'wing_{side}'] = loop([(round(L * i / n), {'r': (0, 0, sg * (lift + a * math.sin(2 * math.pi * i / n)))}) for i in range(n)], L)
        out[f'wing2_{side}'] = loop([(round(L * i / n), {'r': (0, 0, sg * a * a2 * math.sin(2 * math.pi * (i / n - 0.12)))}) for i in range(n)], L)
    return out
glide = lambda L: merge({'root': merge_keys(bob(0.03, L, 0, 4), swing(6, L, 0, 4, 2))}, flap(L, 6, 4, 4))
C = {
    'idle': (60, glide(60), True, None),
    'idle_alt': (90, merge({'root': [(0, {}), (30, {'r': (0, 0, 25)}), (60, {'r': (0, 0, -25)}), (90, {})], 'head': [(0, {}), (40, {'r': (0, 25, 0)}), (70, {'r': (0, -20, 0)}), (90, {})]}, flap(90, 5, 3, 4)), True, None),
    'walk': (30, merge({'root': merge_keys(bob(0.04, 30, 0, 4), swing(4, 30, 0, 4, 2))}, flap(30, 22, 5)), True, None),
    'run': (18, merge({'root': merge_keys(bob(0.05, 18, 0, 4), hold({'r': (6, 0, 0)}, 18))}, flap(18, 40, 5)), True, None),
    'fly': (24, merge({'root': bob(0.05, 24, 0, 4)}, flap(24, 35, 5)), True, None),
    'attack_physical': (28, merge({'root': [(0, {}), (8, {'r': (-15, 0, 0), 'l': (0, 0.08, -0.05)}), (15, {'r': (25, 0, 0), 'l': (0, 0.0, 0.3)}), (22, {'l': (0, 0, 0.08)}), (28, {})],
                                   'wing_l': [(0, {}), (8, {'r': (0, 0, 50)}), (15, {'r': (0, 0, -30)}), (28, {})], 'wing_r': [(0, {}), (8, {'r': (0, 0, -50)}), (15, {'r': (0, 0, 30)}), (28, {})]}), False, 15),
    'attack_special': (40, merge({'root': [(0, {}), (10, {'l': (0, 0.1, 0), 'r': (-12, 0, 0)}), (24, {'r': (8, 0, 0)}), (40, {})],   # Water Gun from the beak
                                  'head': [(0, {}), (12, {'r': (-15, 0, 0)}), (24, {'r': (10, 0, 0)}), (40, {})]}, flap(40, 30, 10, 8)), False, 24),
    'hit': (12, {'root': [(0, {}), (3, {'r': (-18, 0, 15), 'l': (0, 0.02, -0.08)}), (12, {})], 'wing_l': [(0, {}), (3, {'r': (0, 0, 40)}), (12, {})], 'wing_r': [(0, {}), (3, {'r': (0, 0, -40)}), (12, {})]}, False, None),
    'faint': (40, {'root': [(0, {}), (10, {'r': (0, 0, -15)}), (26, {'r': (20, 0, 60), 'l': (0.05, -0.15, 0)}), (40, {'r': (15, 0, 80), 'l': (0.05, -0.24, 0)})],
                   'wing_l': [(0, {}), (26, {'r': (0, 0, -20)}), (40, {'r': (0, 0, -25)})], 'wing_r': [(0, {}), (26, {'r': (0, 0, 40)}), (40, {'r': (0, 0, 45)})]}, False, None),
    'sleep': (90, merge({'root': loop([(0, {'l': (0, -0.2, 0)}), (45, {'l': (0, -0.195, 0)})], 90), 'head': hold({'r': (25, 0, 0)}, 90),
                         'wing_l': hold({'r': (0, -70, -10)}, 90), 'wing_r': hold({'r': (0, 70, 10)}, 90), 'wing2_l': hold({'r': (0, -60, 0)}, 90), 'wing2_r': hold({'r': (0, 60, 0)}, 90)}), True, None),
}
plan_clips(rig, 'rigid', size=0.6, over=C)
sheet('check', 0.7, poses=[('fly', 3, 'front'), ('fly', 9, 'q34'), ('attack_physical', 8, 'q34'), ('sleep', 0, 'q34')])
export(278, 'wingull', 0.6, 'bird', rig, mesh, shiny={'blue': '#58b85a', 'blue_dk': '#3a8a3f'}, fit='length')

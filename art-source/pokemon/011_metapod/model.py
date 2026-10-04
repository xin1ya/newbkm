# Metapod (11) · bug · 0.7 m. Hard green crescent chrysalis, faceted ridges, half-lidded eyes. Moves only by wobbling / hopping.
reset('011_metapod')
M = pal([('shell', '#6fae4a'), ('shell_dk', '#4f8a33'), ('shell_lt', '#8cc95e'), ('eye', '#1a1418'), ('white', '#ffffff'), ('lid', '#5c9a3c')])
CTRL = [Vector((0, 0.06, 0.02)), Vector((0, 0.02, 0.18)), Vector((0, -0.02, 0.36)), Vector((0, 0.0, 0.54)), Vector((0, 0.08, 0.68))]
PTS = []
for i in range(len(CTRL) - 1):
    for k in range(6): PTS.append(CTRL[i].lerp(CTRL[i + 1], k / 6))
PTS.append(CTRL[-1]); N = len(PTS)
RAD = [0.03 + 0.19 * math.sin(math.pi * min(1, (i / (N - 1)) * 1.05)) ** 0.7 for i in range(N)]
RAD[0] = 0.07; RAD[-1] = 0.03
def col(c, n, p):
    if abs(n.x) > 0.75: return 'shell_dk'
    if n.y < -0.5: return 'shell_lt'
    return 'shell'
body = tube('met_body', PTS, RAD, col, 'spine', seg=10, flat=0.85)
smooth(body, False)                      # hard faceted shell
# ridge "bands" (Metapod has a segmented lower shell)
for k, z in enumerate((0.1, 0.18)):
    i = min(range(N), key=lambda j: abs(PTS[j].z - z)); r = RAD[i]
    tube(f'met_band{k}', [PTS[i] + Vector((math.cos(a) * r * 0.87, math.sin(a) * r * 1.01, 0)) for a in [2 * math.pi * j / 20 for j in range(21)]], 0.012, 'shell_dk', 'spine', seg=6)
EC = PTS[int(N * 0.62)]
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'met_eye_{nm}', body, EC, (s * 0.45, -1, 0.05), (0.05, 0.015, 0.022), 'eye', 'spine', sink=0.2, up=(s * 0.15, 0, 1))
    decal(f'met_lid_{nm}', body, EC + Vector((0, 0, 0.02)), (s * 0.45, -1, 0.2), (0.06, 0.02, 0.018), 'lid', 'spine', sink=0.15, up=(s * 0.15, 0, 1))
    decal(f'met_shine_{nm}', e, loc - Vector((0, 0, 0.005)), n, (0.012, 0.005, 0.008), 'white', 'spine', sink=0.05, seg=10, rings=6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.04, 0.1), 'root'), ('spine', (0, 0.0, 0.35), 'hips'), ('chest', (0, 0.0, 0.5), 'spine'), ('head', tuple(EC), 'chest')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(EC + Vector((0, -0.2, 0))), 'head'), ('socket_fx', tuple(EC + Vector((0, -0.2, 0))), 'head')])
H = 0.7
plan_clips(rig, 'rigid', size=H, over={
    'attack_special': (40, {'root': [(0, {}), (10, {'s': (1.08, 0.94, 1.08)}), (14, {'s': (0.95, 1.06, 0.95)}), (18, {'s': (1.1, 0.92, 1.1)}), (22, {'s': (0.96, 1.05, 0.96)}), (40, {})],  # Harden: shell flexes & glints
                            'spine': [(0, {}), (22, {'s': (1.05, 1.05, 1.05)}), (40, {})]}, False, 22),
})
sheet('check', H, poses=[('walk', 6, 'front'), ('attack_physical', 15, 'side'), ('attack_special', 18, 'q34'), ('faint', 36, 'q34')])
export(11, 'metapod', 0.7, 'rigid', rig, mesh, shiny={'shell': '#e0a74a', 'shell_dk': '#b8832e', 'shell_lt': '#f0c26a', 'lid': '#c9913a'})

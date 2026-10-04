# Palossand (770) · ghost/ground · 1.3 m. Evolution of Sandygast — geometry matched to the reference silhouette (art-source/reference, comparison only):
# a whole sand castle: a central keep (round tower with a domed top and a battlement ring, small red shovel sticking out of the dome),
# an arched doorway mouth at the front and two dark window eyes, two shorter crenellated side towers that act as its arms (rising from
# sand mounds on either side), all sitting on a wide spreading sand skirt studded with little blue shells.
reset('770_palossand')
M = pal([('sand', '#c88a58'), ('sand_lt', '#d89c6a'), ('sand_dk', '#a86c40'), ('hole', '#2a1810'), ('shell', '#6ab0c8'), ('shovel', '#c8403a'), ('metal', '#c8ccd2')])
SW = lambda c: lerp_w('spine', 'head', (c.z - 0.5) / 0.4)
# central keep: lathe profile
KZ = [0.0, 0.1, 0.25, 0.45, 0.65, 0.8, 0.86, 0.9, 0.98, 1.06, 1.12, 1.14]
KR = [0.5, 0.36, 0.3, 0.27, 0.26, 0.26, 0.29, 0.25, 0.22, 0.16, 0.07, 0.0]
keep = tube('pal_keep', [Vector((0, 0, z)) for z in KZ], KR, lambda c, n, p: 'sand_lt' if n.z > 0.6 else 'sand', SW, seg=40)
# battlement ring + merlons around the shoulder
for k in range(10):
    a = 2 * math.pi * k / 10
    blob(f'pal_merlon{k}', Vector((math.cos(a) * 0.27, math.sin(a) * 0.27, 0.9)), (0.045, 0.045, 0.04), 'sand', 'head', seg=10, rings=6)
# face: arched doorway mouth, window eyes with heavy brows
m, ml, mn = decal('pal_mouth', keep, Vector((0, 0, 0.3)), (0, -1, 0), (0.1, 0.05, 0.14), 'hole', 'spine', sink=0.7, seg=24)
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'pal_eye_{nm}', keep, Vector((s * 0.1, 0, 0.6)), (0, -1, 0), (0.035, 0.03, 0.045), 'hole', 'head', sink=0.6, seg=14)
    decal(f'pal_brow_{nm}', keep, Vector((s * 0.1, 0, 0.67)), (0, -1, 0), (0.05, 0.02, 0.014), 'sand_dk', 'head', sink=0.2, up=(-s * 0.4, 0, 1), seg=10)
    for j in range(3):   # small windows on the dome
        decal(f'pal_win{j}_{nm}', keep, Vector((s * 0.08 * j, 0, 1.0)), (s * 0.4 * j, -1, 0.3), (0.018, 0.012, 0.025), 'hole', 'head', sink=0.5, seg=8, rings=5)
# shovel in the dome
SB = Vector((0, 0, 1.08))
tube('pal_handle', [SB, SB + Vector((0, 0, 0.08)), SB + Vector((0, 0, 0.13))], 0.012, 'metal', 'head', seg=8)
blob('pal_blade', SB + Vector((0, 0, 0.17)), (0.035, 0.01, 0.055), 'shovel', 'head', seg=14, rings=8,
     fn=lambda v: Vector((v.x * (0.2 + 0.9 * ((1 - v.z) / 2) ** 0.7), v.y, v.z)))
# side towers (arms): sand mound + tower + crenellated top
for s, nm in ((1, 'l'), (-1, 'r')):
    base = Vector((s * 0.62, 0.02, 0.0))
    blob(f'pal_mound_{nm}', base, (0.32, 0.3, 0.3), 'sand', f'arm_{nm}', seg=28, rings=14, fn=lambda v: Vector((v.x * (1 + 0.4 * (1 - max(0, v.z)) ** 3), v.y * (1 + 0.4 * (1 - max(0, v.z)) ** 3), max(0, v.z))))
    tz = [0.2, 0.4, 0.62, 0.72, 0.74]; tr = [0.17, 0.14, 0.13, 0.15, 0.0]
    tw = tube(f'pal_tower_{nm}', [base + Vector((s * 0.02 * i, 0, z)) for i, z in enumerate(tz)], tr, 'sand', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (c.z - 0.3) / 0.4), seg=24)
    top = base + Vector((s * 0.08, 0, 0.74))
    for k in range(6):
        a = 2 * math.pi * k / 6
        blob(f'pal_cren{k}_{nm}', top + Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, 0.03)), (0.04, 0.04, 0.05), 'sand_lt', f'hand_{nm}', seg=10, rings=6)
    for j in range(2):
        decal(f'pal_twin{j}_{nm}', tw, base + Vector((0, 0, 0.45 + 0.14 * j)), (s * 0.3, -1, 0), (0.02, 0.015, 0.03), 'hole', f'hand_{nm}', sink=0.5, seg=8, rings=5)
# sand skirt
def skirt(v):
    a = math.atan2(v.y, v.x); r = 1 + 0.12 * math.sin(a * 5 + 0.7) + 0.06 * math.sin(a * 11)
    return Vector((v.x * r, v.y * r, max(v.z, 0.0)))
blob('pal_skirt', Vector((0, 0.02, 0)), (0.95, 0.65, 0.06), lambda c, n, p: 'sand_dk' if n.z < 0.3 else 'sand', 'hips', seg=56, rings=12, fn=skirt)
import random; rnd = random.Random(770)
for k in range(18):   # little blue shells stuck in the sand
    a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0.35, 0.85)
    p_ = Vector((math.cos(a) * r, math.sin(a) * r * 0.68, 0.045))
    blob(f'pal_shell{k}', p_, (0.018, 0.018, 0.012), 'shell', 'hips', seg=8, rings=5)
for k in range(10):
    a = 2 * math.pi * k / 10
    decal(f'pal_kshell{k}', keep, Vector((0, 0, 0.82)), (math.cos(a), math.sin(a), 0), (0.014, 0.01, 0.014), 'shell', 'head', sink=0.2, seg=8, rings=5)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.05), 'root'), ('spine', (0, 0, 0.45), 'hips'), ('head', (0, 0, 0.85), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', (s * 0.62, 0.02, 0.15), 'hips'), (f'hand_{nm}', (s * 0.66, 0.02, 0.6), f'arm_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.35, 0.3), 'spine'), ('socket_fx', (0, -0.4, 0.6), 'head')])
plan_clips(rig, 'rigid', size=1.2, over={
    'idle': {'head': swing(3, 90, 0.0, 4, 1), 'hand_l': swing(5, 90, 0.2, 4, 1), 'hand_r': swing(5, 90, 0.7, 4, 1)},
    'attack_physical': {'hand_l': [(0, {}), (10, {'r': (0, 25, 0)}), (16, {'r': (0, -20, 0)}), (30, {})], 'hand_r': [(0, {}), (10, {'r': (0, -25, 0)}), (16, {'r': (0, 20, 0)}), (30, {})]},   # sand tower slam
    'attack_special': {'head': [(0, {}), (12, {'s': (1.08, 1.08, 1.08)}), (24, {'s': (0.96, 0.96, 0.96)}), (40, {})]},   # Shore Up / Shadow Ball
})
sheet('check', 1.4, poses=[('idle', 0, 'front'), ('idle', 0, 'side'), ('attack_physical', 16, 'q34'), ('attack_special', 12, 'q34')])
export(770, 'palossand', 1.3, 'rigid', rig, mesh, shiny={'sand': '#8a8a9a', 'sand_lt': '#a0a0b0', 'sand_dk': '#6a6a7a'})

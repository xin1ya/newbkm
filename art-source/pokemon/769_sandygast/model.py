# Sandygast (769) · ghost/ground · 0.5 m. A sand-castle mound: wide lumpy base narrowing to a rounded turret top,
# with a red-handled shovel stuck in the top, dark hollow eyes and a wide gaping mouth, small sand lumps around the base.
reset('769_sandygast')
M = pal([('sand', '#d6ccaa'), ('sand_lt', '#e4dcbe'), ('sand_dk', '#b8ae8c'), ('hole', '#2a1a14'), ('mouth', '#3a2018'),
         ('shovel', '#d8443a'), ('handle', '#e8e0d0'), ('metal', '#c8ccd2'), ('pupil', '#f6e27a')])
C = Vector((0, 0, 0.0))
# bell-shaped mound: rounded top, sides flaring into the ground
def mound(v):
    t = max(0.0, v.z)
    w = 1.0 + 0.25 * (1 - t) ** 3
    return Vector((v.x * w, v.y * w, max(v.z, 0.0)))
body = blob('sg_body', C, (0.15, 0.14, 0.26), lambda c, n, p: 'sand_lt' if n.z > 0.7 else 'sand', 'spine', seg=40, rings=22, fn=mound)
# wide lobed skirt of sand spreading on the ground
def skirt(v):
    a = math.atan2(v.y, v.x); r = 1 + 0.1 * math.sin(a * 7 + 0.5)
    return Vector((v.x * r, v.y * r, max(v.z, 0.0)))
blob('sg_skirt', C, (0.3, 0.28, 0.035), lambda c, n, p: 'sand_dk' if n.z < 0.3 else 'sand', 'hips', seg=48, rings=10, fn=skirt)
# face: big arched doorway mouth at the front bottom, small dark eyes with heavy brows high up
m, ml, mn = decal('sg_mouth', body, C + Vector((0, 0, 0.07)), (0, -1, 0), (0.06, 0.03, 0.085), 'hole', 'jaw', sink=0.7, seg=24)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'sg_eye_{nm}', body, C + Vector((0, 0, 0.17)), (s * 0.4, -1, 0.0), (0.017, 0.012, 0.014), 'hole', 'head', sink=0.5, seg=16)
    decal(f'sg_glint_{nm}', e, l, n, (0.005, 0.004, 0.005), 'pupil', 'head', sink=0.1, seg=8, rings=5)
    decal(f'sg_brow_{nm}', body, C + Vector((0, 0, 0.195)), (s * 0.4, -1, 0.0), (0.026, 0.012, 0.009), 'sand_dk', 'head', sink=0.1, up=(-s * 0.4, 0, 1), seg=12)
# shovel: handle sunk into the top, red heart-shaped scoop pointing up
SB = C + Vector((0, 0.0, 0.25))
tube('sg_handle', [SB + Vector((0, 0, 0.13)), SB + Vector((0, 0, 0.19)), SB + Vector((0, 0, 0.27))], [0.012, 0.012, 0.012], 'metal', 'extra_shovel', seg=10)
def heart(v):
    # wide rounded top, tapering to a point at the bottom (spade scoop)
    k = 0.15 + 0.95 * ((v.z + 1) / 2) ** 0.7
    return Vector((v.x * k, v.y, v.z))
blob('sg_blade', SB + Vector((0, 0, 0.09)), (0.045, 0.012, 0.06), 'shovel', 'extra_shovel', seg=16, rings=10, fn=heart)
for s in (1, -1):
    blob(f'sg_side{s + 1}', Vector((s * 0.2, 0.0, 0.03)), (0.05, 0.045, 0.055), 'sand', 'hips', seg=16, rings=8)
# pebbles and shells on the skirt
import random as _r; _r.seed(769)
for k in range(8):
    a = 2 * math.pi * k / 8 + 0.3
    r = _r.uniform(0.01, 0.016)
    blob(f'sg_lump{k}', Vector((math.cos(a) * 0.22, math.sin(a) * 0.2, 0.03)), (r, r, r * 0.7), 'handle' if k % 3 == 0 else 'sand_dk', 'hips', seg=10, rings=6)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.02), 'root'), ('spine', (0, 0, 0.1), 'hips'), ('head', (0, 0, 0.18), 'spine'),
         ('jaw', (0, -0.12, 0.07), 'spine'), ('extra_shovel', tuple(SB), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.17, 0.07), 'spine'), ('socket_fx', (0, -0.2, 0.15), 'spine')])
wob = lambda L, a: {'head': swing(a, L, 0.0, 4, 1), 'extra_shovel': swing(a * 1.5, L, 0.2, 4, 0)}
plan_clips(rig, 'rigid', size=0.5, over={'idle': wob(60, 3), 'walk': wob(24, 6), 'run': wob(16, 9),
                                        'attack_special': {'jaw': [(0, {}), (12, {'s': (1.2, 1.2, 1.4)}), (24, {'s': (1.25, 1.2, 1.5)}), (40, {})]}})   # Sand Attack / Absorb: mouth gapes
sheet('check', 0.5, poses=[('idle', 15, 'front'), ('walk', 6, 'side'), ('attack_special', 20, 'q34'), ('sleep', 0, 'q34')])
export(769, 'sandygast', 0.5, 'rigid', rig, mesh, shiny={'sand': '#a8a8b0', 'sand_lt': '#c0c0c8', 'sand_dk': '#888890'})

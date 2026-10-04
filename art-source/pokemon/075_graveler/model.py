# Graveler (75) · rock/ground · 1.0 m. Evolution of Geodude — geometry matched to the reference silhouette (art-source/reference, comparison only):
# a round boulder body covered in rocky nodules and shallow craters, heavy angry brow over deep-set eyes, big frowning lip ridge,
# FOUR arms: a long upper pair of segmented rock arms (held out sideways) ending in thick fingers, and a short lower pair with
# three hooked claws; two short stubby legs with blunt toes.
reset('075_graveler')
M = pal([('rock', '#8e8a80'), ('rock_lt', '#a8a498'), ('rock_dk', '#6a665e'), ('eye', '#1a1614'), ('white', '#f4f2ec'), ('hole', '#1e1a18'), ('claw', '#7a766c')])
C = Vector((0, 0, 0.5)); RB = 0.36
def g(d2, w): return math.exp(-d2 / (w * w))
def face(v):
    r = 1.0; fr = max(0.0, -v.y)
    for s in (1, -1):
        dx = v.x - s * 0.3; dz = v.z - 0.18 + 0.25 * (abs(v.x) - 0.3)
        r -= 0.3 * fr * g((dx / 2.4) ** 2 + (dz * 0.9) ** 2, 0.14)          # eye sockets
    bz = 0.36 + 0.3 * abs(v.x) - 0.06
    r += 0.16 * fr * g((v.z - bz) ** 2 * 6 + (abs(v.x) - 0.3) ** 2 * 0.6, 0.15)   # angry V brow
    r += 0.14 * fr * g((v.x / 1.8) ** 2 + (v.z + 0.25) ** 2 * 2.4, 0.2)   # lip ridge
    mz = -0.22 - 0.3 * v.x * v.x
    r -= 0.07 * fr * g((v.z - mz) ** 2 * 30 + max(0.0, abs(v.x) - 0.38) ** 2 * 40, 0.12)
    r += 0.035 * math.sin(v.x * 7 + 1) * math.sin(v.y * 6 + 2) * math.sin(v.z * 5 + 0.3)
    return Vector((v.x * r, v.y * r, v.z * r))
body = blob('grv_body', C, (RB, RB * 1.08, RB * 0.95), 'rock', lambda c: lerp_w('spine', 'head', (c.z - 0.45) / 0.2), seg=64, rings=40, fn=face)
bpy.context.view_layer.update()
import random; rnd = random.Random(75)
# rocky nodules + crater rims all over (skip the face)
for k in range(46):
    z = rnd.uniform(-0.85, 0.95); a = rnd.uniform(0, 2 * math.pi); r = math.sqrt(1 - z * z)
    d = Vector((math.cos(a) * r, math.sin(a) * r, z))
    if d.y < -0.55 and d.z > -0.5: continue
    l, nn = shoot(body, C, d, fallback=True)
    if k % 4 == 0:
        decal(f'grv_crater{k}', body, C, d, (0.04, 0.012, 0.04), 'rock_dk', 'spine', sink=0.6, seg=12, rings=6)
    else:
        sz = rnd.uniform(0.03, 0.055)
        blob(f'grv_nod{k}', l, (sz, sz, sz * 0.8), 'rock_lt' if k % 3 else 'rock', 'spine', seg=10, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    d = Vector((s * 0.3, -0.93, 0.18)).normalized(); l, nn = shoot(body, C, d)
    sk = blob(f'grv_sock_{nm}', l + nn * 0.01, (0.07, 0.006, 0.032), 'hole', 'head', seg=16, rings=8); orient(sk, nn, (s * -0.25, 0, 1))
    e, l2, n2 = decal(f'grv_eye_{nm}', sk, C, d, (0.014, 0.004, 0.012), 'white', 'head', sink=-0.3, seg=12, rings=6)
    decal(f'grv_pupil_{nm}', e, l2, n2, (0.007, 0.003, 0.008), 'eye', 'head', sink=-0.5, seg=8, rings=5)
def rocky(v):
    k = 1 + 0.08 * math.sin(v.x * 5 + 1) * math.sin(v.y * 4 + 2) + 0.05 * math.sin(v.z * 6)
    return Vector((v.x * k, v.y * k, v.z * k))
for s, nm in ((1, 'l'), (-1, 'r')):
    # upper arms: long, segmented, held out sideways, thick fingers
    sh = C + Vector((s * 0.32, 0.08, 0.06)); hd = C + Vector((s * 0.95, 0.08, 0.08))
    tube(f'grv_ucore_{nm}', [sh, hd], [0.07, 0.07], 'rock_dk', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (abs(c.x) - 0.5) / 0.25), seg=12)
    for k, t in enumerate((0.12, 0.32, 0.52, 0.72)):
        p0 = sh.lerp(hd, t); rr = 0.1 if k % 2 == 0 else 0.085
        blob(f'grv_useg{k}_{nm}', p0, (0.09, rr, rr), 'rock' if k % 2 == 0 else 'rock_lt', f'arm_{nm}' if k < 2 else f'hand_{nm}', seg=16, rings=10, fn=rocky)
    for k in range(3):
        z = 0.05 - 0.05 * k
        f0 = hd + Vector((0, -0.02, z))
        tube(f'grv_ufing{k}_{nm}', [f0, f0 + Vector((s * 0.07, -0.02, 0)), f0 + Vector((s * 0.1, -0.06, -0.01))], [0.03, 0.028, 0.02], 'rock_lt', f'hand_{nm}', seg=8)
    # lower arms: short, angled down/forward, three hooked claws
    ls_ = C + Vector((s * 0.3, -0.08, -0.16)); lh = ls_ + Vector((s * 0.12, -0.24, -0.14))
    tube(f'grv_larm_{nm}', [ls_, (ls_ + lh) / 2, lh], [0.06, 0.055, 0.05], 'rock', f'arm2_{nm}', seg=12)
    for k in range(3):
        a = (k - 1) * 0.04
        f0 = lh + Vector((a, -0.02, -0.02))
        tube(f'grv_claw{k}_{nm}', [f0, f0 + Vector((a * 0.5, -0.05, -0.04)), f0 + Vector((a * 0.6, -0.03, -0.1))], [0.022, 0.016, 0.004], 'claw', f'arm2_{nm}', seg=8)
    # legs
    th = Vector((s * 0.15, 0.02, 0.2)); ft = Vector((s * 0.18, -0.02, 0.05))
    tube(f'grv_leg_{nm}', [th, ft], [0.08, 0.075], 'rock', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', (0.2 - c.z) / 0.15), seg=12)
    blob(f'grv_foot_{nm}', ft + Vector((0, -0.03, -0.01)), (0.09, 0.11, 0.045), 'rock_lt', f'foot_{nm}', seg=14, rings=8, fn=rocky)
    for k in range(3):
        blob(f'grv_toe{k}_{nm}', ft + Vector(((k - 1) * 0.045, -0.12, -0.02)), (0.022, 0.025, 0.02), 'rock', f'foot_{nm}', seg=8, rings=5)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.25), 'root'), ('spine', tuple(C), 'hips'), ('head', tuple(C + Vector((0, -0.1, 0.12))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(C + Vector((s * 0.32, 0.02, 0.06))), 'spine'), (f'hand_{nm}', tuple(C + Vector((s * 0.68, 0.01, 0.07))), f'arm_{nm}'),
              (f'arm2_{nm}', tuple(C + Vector((s * 0.3, -0.08, -0.16))), 'spine'),
              (f'thigh_{nm}', (s * 0.15, 0.02, 0.22), 'hips'), (f'foot_{nm}', (s * 0.18, -0.02, 0.05), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(C + Vector((0, -0.4, -0.08))), 'head'), ('socket_fx', tuple(C + Vector((0, -0.42, 0.05))), 'head')])
plan_clips(rig, 'biped', size=0.9, over={'idle_alt': (80, {'arm_l': [(0, {}), (20, {'r': (0, 0, 25)}), (40, {}), (80, {})], 'arm_r': [(0, {}), (40, {}), (60, {'r': (0, 0, -25)}), (80, {})],
                                                          'arm2_l': [(0, {}), (20, {'r': (-20, 0, 0)}), (40, {}), (80, {})], 'arm2_r': [(0, {}), (40, {}), (60, {'r': (-20, 0, 0)}), (80, {})]}, True, None)})   # flexing all four arms
sheet('check', 1.0, poses=[('walk', 7, 'side'), ('idle_alt', 20, 'front'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(75, 'graveler', 1.0, 'biped', rig, mesh, shiny={'rock': '#a89a72', 'rock_lt': '#c0b48a', 'rock_dk': '#807452'})

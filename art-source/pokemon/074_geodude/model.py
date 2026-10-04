# Geodude (74) · rock/ground · 0.4 m. A floating grey boulder (faceted, with darker cracks/craters) with heavy brows,
# narrow determined eyes, and two thick muscular rock arms ending in big five-fingered fists. No legs.
reset('074_geodude')
M = pal([('rock', '#9a968a'), ('rock_lt', '#b4b0a4'), ('rock_dk', '#76726a'), ('eye', '#1a1614'), ('white', '#f4f2ec'), ('mouth', '#4a3a34'), ('hole', '#1e1a18')])
C = Vector((0, 0, 0.26)); R_ = 0.15
import random as _r; _r.seed(74)
def g(d2, w): return math.exp(-d2 / (w * w))
def face(v):
    """Sculpted boulder face (unit sphere, front = -Y): deep wide eye sockets under a V-shaped angry brow,
    a protruding frowning mouth ridge, cheek lumps and rocky ridges on the crown."""
    r = 1.0
    fr = max(0.0, -v.y)
    for s in (1, -1):
        dx = v.x - s * 0.34; dz = v.z - 0.1 + 0.25 * (abs(v.x) - 0.34)
        r -= 0.4 * fr * g((dx / 2.8) ** 2 + (dz * 0.85) ** 2, 0.15)                  # eye socket (wide)
        bz = 0.3 + 0.35 * abs(v.x) - 0.06                                  # brow line rises toward the outside -> angry V
        r += 0.26 * fr * g((v.z - bz) ** 2 * 6 + (abs(v.x) - 0.33) ** 2 * 0.6, 0.16)
        r += 0.06 * fr * g((v.x - s * 0.55) ** 2 + (v.z + 0.15) ** 2, 0.18)  # cheek lumps
    r -= 0.05 * fr * g(v.x * v.x * 8 + (v.z - 0.42) ** 2, 0.1)             # crease between the brows
    r += 0.2 * fr * g((v.x / 2.0) ** 2 + (v.z + 0.4) ** 2 * 2.2, 0.2)     # big mouth ridge / lips
    mz = -0.38 - 0.35 * v.x * v.x                                          # frown: corners droop
    r -= 0.1 * fr * g((v.z - mz) ** 2 * 30 + max(0.0, abs(v.x) - 0.42) ** 2 * 40, 0.12)
    top = max(0.0, v.z)
    r += 0.035 * top * math.sin(v.x * 11 + 0.5) * math.cos(v.y * 7)        # crown ridges
    r += 0.03 * math.sin(v.x * 6 + 1) * math.sin(v.y * 5 + 2) * math.sin(v.z * 4 + 0.3)
    return Vector((v.x * r, v.y * r, v.z * r))
def body_col(c, n, p):
    d = (c - C); d = Vector((d.x / R_, d.y / R_, d.z / R_))
    return 'rock'
body = blob('geo_body', C, (R_, R_ * 0.95, R_ * 0.92), body_col, 'spine', seg=64, rings=40, fn=face)
bpy.context.view_layer.update()
# dark socket inserts (seen through the recess) + frowning lips following the surface
for s_ in (1, -1):
    d = Vector((s_ * 0.34, -0.93, 0.1)).normalized()
    l, nn = shoot(body, C, d)
    blob(f'geo_sockdark{s_ + 1}', l + nn * 0.012, (0.075, 0.006, 0.04), 'hole', 'spine', seg=16, rings=8)
    o = bpy.data.objects[f'geo_sockdark{s_ + 1}']; orient(o, nn, (0, 0, 1))
def arc(zc, k, xs):
    pts = []
    for x in xs:
        l, nn = shoot(body, C, Vector((x, -0.92, zc - k * x * x)).normalized()); pts.append(l - nn * 0.006)
    return pts
XS = [-0.55, -0.35, -0.15, 0.0, 0.15, 0.35, 0.55]
tube('geo_lipup', arc(-0.3, 0.55, XS), 0.016, 'rock_lt', 'spine', seg=10)
tube('geo_mouthline', arc(-0.36, 0.55, XS[1:-1]), 0.006, 'hole', 'spine', seg=8)
tube('geo_liplo', arc(-0.43, 0.45, XS[1:-1]), 0.014, 'rock', 'spine', seg=10)
# small eyes deep inside the sockets
for s, nm in ((1, 'l'), (-1, 'r')):
    d = Vector((s * 0.3, -0.93, 0.1)).normalized()
    e, l, n = decal(f'geo_eye_{nm}', bpy.data.objects[f'geo_sockdark{s + 1}'], C, d, (0.012, 0.004, 0.01), 'eye', 'spine', sink=-0.3, seg=12, rings=6)
    decal(f'geo_shine_{nm}', e, l + Vector((s * 0.003, 0, 0.003)), n, (0.0035, 0.002, 0.0035), 'white', 'spine', sink=-0.5, seg=8, rings=5)
def rocky(v):
    k = 1 + 0.08 * math.sin(v.x * 5 + 1) * math.sin(v.y * 4 + 2) + 0.05 * math.sin(v.z * 6)
    return Vector((v.x * k, v.y * k, v.z * k))
# arms: thick rocky upper arm out of the sides, bulging forearm, big fist with knuckles
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = C + Vector((s * 0.13, 0.02, -0.03)); el = C + Vector((s * 0.3, 0.025, -0.035)); hd = C + Vector((s * 0.47, 0.025, -0.035))
    # chunky segmented rock arm: shoulder chunk, upper-arm chunk, elbow lump, flared forearm
    tube(f'geo_core_{nm}', [sh, el, hd], [0.034, 0.03, 0.034], 'rock_dk', lambda c, s=s, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (abs(c.x) - 0.2) / 0.1), seg=10)
    for k, (t, rr, b) in enumerate(((0.15, (0.06, 0.045, 0.045), 'arm'), (0.4, (0.07, 0.05, 0.05), 'arm'), (0.62, (0.045, 0.042, 0.042), 'hand'), (0.82, (0.07, 0.054, 0.056), 'hand'))):
        p0 = sh.lerp(hd, t)
        blob(f'geo_seg{k}_{nm}', p0 + Vector((0, -0.004, 0.006 * (k % 2))), rr, 'rock' if k % 2 == 0 else 'rock_lt', f'{b}_{nm}', seg=14, rings=8, fn=rocky)
    # fist: knuckle block with four curled fingers on the front and a thumb on top
    F = hd + Vector((s * 0.06, 0, 0))
    blob(f'geo_fist_{nm}', F, (0.045, 0.045, 0.042), 'rock_lt', f'hand_{nm}', seg=14, rings=8, fn=rocky)
    for k in range(4):
        z = 0.027 - 0.018 * k
        tube(f'geo_finger{k}_{nm}', [F + Vector((s * 0.03, -0.02, z)), F + Vector((s * 0.05, -0.04, z)), F + Vector((s * 0.035, -0.055, z))], [0.012, 0.012, 0.01], 'rock', f'hand_{nm}', seg=8)
    tube(f'geo_thumb_{nm}', [F + Vector((s * -0.01, -0.03, 0.035)), F + Vector((s * 0.02, -0.05, 0.04))], [0.013, 0.011], 'rock', f'hand_{nm}', seg=8)
bones = [('root', (0, 0, 0), None), ('hips', tuple(C - Vector((0, 0, 0.05))), 'root'), ('spine', tuple(C), 'hips'), ('head', tuple(C + Vector((0, -0.05, 0.05))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(C + Vector((s * 0.13, 0.02, -0.03))), 'spine'), (f'hand_{nm}', tuple(C + Vector((s * 0.3, 0.025, -0.035))), f'arm_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(C + Vector((0, -0.16, -0.03))), 'spine'), ('socket_fx', tuple(C + Vector((0, -0.2, 0))), 'spine')])
arms = lambda L, a: {'arm_l': swing(a, L, 0.0, 4, 1), 'arm_r': swing(-a, L, 0.0, 4, 1), 'hand_l': swing(a, L, 0.1, 4, 2), 'hand_r': swing(-a, L, 0.1, 4, 2)}
plan_clips(rig, 'rigid', size=0.4, over={'idle': arms(60, 6), 'walk': arms(24, 14), 'run': arms(16, 22),
                                        'attack_physical': {'arm_r': [(0, {}), (8, {'r': (0, 0, 40)}), (15, {'r': (0, 0, -55)}), (22, {}), (28, {})],
                                                            'hand_r': [(0, {}), (8, {'r': (0, 0, 30)}), (15, {'r': (0, 0, -20)}), (28, {})]},   # Tackle / Rock Throw punch
                                        'sleep': {'arm_l': hold({'r': (0, 40, 0)}, 90), 'arm_r': hold({'r': (0, -40, 0)}, 90)}})
sheet('check', 0.42, poses=[('idle', 15, 'front'), ('walk', 6, 'side'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(74, 'geodude', 0.4, 'rigid', rig, mesh, shiny={'rock': '#a89a6a', 'rock_lt': '#c4b688', 'rock_dk': '#827650'})

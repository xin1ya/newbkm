# Staryu (120) · water · 0.8 m. Five-pointed star standing on its two lower points, gold core ring with a red gem facing forward (-Y).
reset('120_staryu')
M = pal([
    ('body', '#b98a4e'), ('body_dk', '#946a37'), ('body_lt', '#d6a966'), ('ring', '#f2c94c'), ('ring_dk', '#c99a2e'),
    ('gem', '#e3343f'), ('gem_dk', '#a81f2a'), ('white', '#ffffff'),
], extra_mats=[('glow', {'emit': 0.8})])
H = 0.8
RO = H / (1 + math.cos(math.radians(36)))          # outer radius (top point up, lower two points on the ground)
CZ = RO * math.cos(math.radians(36))                # center height
RI = RO * 0.47                                      # inner radius (arm width)
DEPTH = 0.12                                        # half thickness at the center

def outline_r(th):   # polar outline, rounded tips: th = 0 points straight up
    k = (1 + math.cos(5 * th)) / 2
    return RI + (RO - RI) * k ** 1.35

# ---- star body: lofted lens, thick in the middle, thinner (but round) at the tips ----
me = bpy.data.meshes.new('staryu_body'); bm = bmesh.new()
NS = 120; LAY = 9
rings = []
for j in range(LAY):
    phi = -math.pi / 2 + math.pi * j / (LAY - 1)            # -90..90 back..front
    ring = []
    for i in range(NS):
        th = 2 * math.pi * i / NS; r = outline_r(th)
        sc = math.cos(phi) ** 0.55
        rn = r / RO
        y = -math.sin(phi) * DEPTH * (1.1 - 0.45 * rn)      # front (-Y) bulges more near the center
        ring.append(bm.verts.new((math.sin(th) * r * sc, y, CZ + math.cos(th) * r * sc)))
    rings.append(ring)
# the first/last "rings" collapse towards the center points
for j in range(LAY - 1):
    for i in range(NS):
        a, b = rings[j][i], rings[j][(i + 1) % NS]; c, d = rings[j + 1][(i + 1) % NS], rings[j + 1][i]
        bm.faces.new((a, b, c, d))
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me); bm.free()
body = new_obj('staryu_body', me); smooth(body)
def body_col(c, n, p):
    rr = math.hypot(c.x, c.z - CZ)
    if n.y > 0.55 and rr < RO * 0.8: return 'body_dk'      # back
    if rr > RO * 0.82: return 'body_lt'                     # tips lighter
    return 'body'
paint(body, MAT, body_col)

ARMS = {'head': 0, 'arm_l': 72, 'thigh_l': 144, 'thigh_r': 216, 'arm_r': 288}   # degrees from up, clockwise seen from the front (+x = model left)
def star_w(c):
    dx, dz = c.x, c.z - CZ; rr = math.hypot(dx, dz) / RO
    th = math.degrees(math.atan2(dx, dz)) % 360
    ws = {}
    for b, a in ARMS.items():
        d = abs((th - a + 180) % 360 - 180)
        if d < 72: ws[b] = (1 - d / 72) ** 2
    s = sum(ws.values()); arm = min(1, max(0, (rr - 0.18) / 0.35))
    out = {b: w / s * arm for b, w in ws.items()}
    out['spine'] = out.get('spine', 0) + (1 - arm)
    return out
reg(body, star_w)

# ---- core: gold ring with raised rim, red gem, highlight ----
FRONT = shoot(body, (0, 0, CZ), (0, -1, 0))[0].y
ring = blob('staryu_ring', (0, FRONT + 0.012, CZ), (0.105, 0.03, 0.105), lambda c, n, p: 'ring' if n.y < -0.35 else 'ring_dk', 'spine', seg=40, rings=14)
rim = tube('staryu_rim', [(math.sin(a) * 0.1, FRONT - 0.012, CZ + math.cos(a) * 0.1) for a in [2 * math.pi * k / 40 for k in range(41)]], 0.012, 'ring', 'spine', seg=10)
gem = blob('staryu_gem', (0, FRONT - 0.012, CZ), (0.078, 0.05, 0.078), lambda c, n, p: 'gem' if n.z > -0.3 else 'gem_dk', 'gem', seg=32, rings=16, mat=M['glow'])
decal('staryu_gem_shine', gem, (0, FRONT - 0.012, CZ), (-0.35, -1, 0.5), (0.02, 0.006, 0.014), 'white', 'gem', sink=0.1)
decal('staryu_gem_shine2', gem, (0, FRONT - 0.012, CZ), (0.3, -1, -0.45), (0.009, 0.004, 0.007), 'white', 'gem', sink=0.1)

# ---- rig: every arm pivots near the center so it can flex like a limb ----
def armpos(a, f):
    t = math.radians(a); return (math.sin(t) * RO * f, 0, CZ + math.cos(t) * RO * f)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, CZ), 'root'), ('spine', (0, 0, CZ), 'hips'), ('chest', (0, 0, CZ), 'spine'),
         ('gem', (0, FRONT - 0.012, CZ), 'chest')]
for b, a in ARMS.items():
    bones.append((b, armpos(a, 0.3), 'chest' if b in ('head', 'arm_l', 'arm_r') else 'hips'))
rig, mesh = make_rig(bones, sockets=[('socket_fx', (0, FRONT - 0.06, CZ), 'gem'), ('socket_mouth', (0, FRONT - 0.06, CZ), 'gem')])

# ---- clips: biped template (lower points = legs) with star-specific attacks ----
GL = lambda L, *fs: [(f, S(v)) for f, v in fs]
plan_clips(rig, 'biped', size=H, over={
    'idle': {'gem': loop([(0, S(1)), (30, S(1.07))], 60), 'head': swing(4, 60, 0.1, 4, 2)},
    'idle_alt': (100, {'root': [(0, {}), (15, {'r': (0, 0, 20)}), (30, {'r': (0, 0, -20)}), (45, {'r': (0, 0, 10)}), (60, {}), (100, {})],
                       'gem': [(0, S(1)), (60, S(1)), (66, S(1.25)), (72, S(1)), (78, S(1.25)), (84, S(1)), (100, S(1))]}, True, None),
    'attack_physical': (30, {   # Rapid Spin: spin on the forward axis while dashing
        'root': [(0, {}), (6, {'l': (0, 0.05 * H, -0.06 * H)}), (10, {'r': (0, 0, 180), 'l': (0, 0.08 * H, 0.2 * H)}), (14, {'r': (0, 0, 360), 'l': (0, 0.08 * H, 0.45 * H)}),
                 (18, {'r': (0, 0, 540), 'l': (0, 0.06 * H, 0.35 * H)}), (24, {'r': (0, 0, 720), 'l': (0, 0.02 * H, 0.1 * H)}), (30, {'r': (0, 0, 720)})],
    }, False, 14),
    'attack_special': (42, {    # gem charges and flashes (Water Gun / Swift fired from socket_fx)
        'root': [(0, {}), (12, {'r': (-12, 0, 0), 'l': (0, 0.04 * H, 0)}), (24, {'r': (6, 0, 0)}), (42, {})],
        'gem': [(0, S(1)), (12, S(1.25)), (20, S(1.4)), (24, S(0.9)), (30, S(1.1)), (42, S(1))],
        'arm_l': [(0, {}), (12, {'r': (0, 0, 25)}), (24, {'r': (0, 0, -10)}), (42, {})], 'arm_r': [(0, {}), (12, {'r': (0, 0, -25)}), (24, {'r': (0, 0, 10)}), (42, {})],
        'head': [(0, {}), (12, {'r': (-20, 0, 0)}), (24, {'r': (10, 0, 0)}), (42, {})],
    }, False, 24),
    'faint': (36, {'root': [(0, {}), (8, {'r': (0, 0, 15)}), (26, {'r': (-88, 0, 0), 'l': (0, -0.02 * H, 0.1 * H)}), (36, {'r': (-90, 0, 0), 'l': (0, -0.02 * H, 0.1 * H)})],
                   'gem': [(0, S(1)), (20, S(0.9)), (36, S(0.85))]}, False, None),
    'sleep': (90, {'root': loop([(0, {'r': (-80, 0, 0), 'l': (0, 0, 0.12 * H)}), (45, {'r': (-80, 0, 0), 'l': (0, 0, 0.12 * H)})], 90),
                   'gem': loop([(0, S(0.95)), (45, S(1.02))], 90)}, True, None),
})
sheet('check', H, poses=[('walk', 7, 'q34'), ('attack_physical', 12, 'front'), ('attack_special', 20, 'q34'), ('faint', 36, 'side')])
export(120, 'staryu', 0.8, 'biped', rig, mesh, shiny={'body': '#e6b85c', 'body_dk': '#c0913e', 'body_lt': '#f1d27a', 'gem': '#3c7fe0', 'gem_dk': '#28539a'})

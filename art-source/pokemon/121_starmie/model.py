# Starmie (121) · water/psychic · 1.1 m. Two stacked purple stars (back one rotated 36°), faceted red gem in a gold frame.
reset('121_starmie')
M = pal([('body', '#7d5aa8'), ('body_dk', '#5d3f86'), ('body_lt', '#9a78c4'), ('ring', '#f0c54a'), ('ring_dk', '#c0932c'),
         ('gem', '#e02f4a'), ('gem_dk', '#a31d34'), ('white', '#ffffff')], extra_mats=[('glow', {'emit': 0.9})])
H = 1.1
RO = H / (1 + math.cos(math.radians(36))) * 0.98; CZ = RO * math.cos(math.radians(36)) + 0.01; RI = RO * 0.52

def star(name, rot, depth, yoff, cols):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); NS = 120; LAY = 9; rings = []
    for j in range(LAY):
        phi = -math.pi / 2 + math.pi * j / (LAY - 1); ring = []
        for i in range(NS):
            th = 2 * math.pi * i / NS; k = (1 + math.cos(5 * (th - math.radians(rot)))) / 2; r = RI + (RO - RI) * k ** 1.2
            sc = math.cos(phi) ** 0.55; rn = r / RO
            ring.append(bm.verts.new((math.sin(th) * r * sc, yoff - math.sin(phi) * depth * (1.1 - 0.5 * rn), CZ + math.cos(th) * r * sc)))
        rings.append(ring)
    for j in range(LAY - 1):
        for i in range(NS):
            bm.faces.new((rings[j][i], rings[j][(i + 1) % NS], rings[j + 1][(i + 1) % NS], rings[j + 1][i]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free(); o = new_obj(name, me); smooth(o)
    paint(o, MAT, lambda c, n, p: cols[0] if math.hypot(c.x, c.z - CZ) > RO * 0.8 else cols[1] if n.y > 0.5 else cols[2]); return o

front = star("starmie_front", 0, 0.13, -0.03, ('body_lt', 'body_dk', 'body'))
back = star('starmie_back', 36, 0.08, 0.07, ('body', 'body_dk', 'body_dk'))
ARMS = {'head': 0, 'arm_l': 72, 'thigh_l': 144, 'thigh_r': 216, 'arm_r': 288}
def w_for(offset, names):
    def f(c):
        dx, dz = c.x, c.z - CZ; rr = math.hypot(dx, dz) / RO; th = math.degrees(math.atan2(dx, dz)) % 360; ws = {}
        for b, a in names.items():
            d = abs((th - a - offset + 180) % 360 - 180)
            if d < 72: ws[b] = (1 - d / 72) ** 2
        s = sum(ws.values()); arm = min(1, max(0, (rr - 0.2) / 0.35))
        out = {b: w / s * arm for b, w in ws.items()}; out['spine'] = 1 - arm; return out
    return f
reg(front, w_for(0, ARMS))
BACK = {f'back{i}': 36 + 72 * i for i in range(5)}
reg(back, w_for(0, {k: v - 0 for k, v in BACK.items()}))

FRONT = shoot(front, (0, 0, CZ), (0, -1, 0))[0].y
# gold frame: 10-point jagged ring (small cones around the gem) + base disc
blob('starmie_frame', (0, FRONT + 0.01, CZ), (0.17, 0.04, 0.17), lambda c, n, p: 'ring' if n.y < -0.3 else 'ring_dk', 'spine', seg=40, rings=14)
for k in range(10):
    a = 2 * math.pi * k / 10
    blob(f'starmie_spike{k}', (math.sin(a) * 0.175, FRONT - 0.004, CZ + math.cos(a) * 0.175), (0.036, 0.024, 0.065), 'ring', 'spine', seg=10, rings=6, rot=(0, -math.degrees(a), 0))
# faceted gem: low-seg sphere flat-shaded
g = blob('starmie_gem', (0, FRONT - 0.02, CZ), (0.105, 0.07, 0.105), lambda c, n, p: 'gem' if n.z > -0.2 else 'gem_dk', 'gem', seg=10, rings=6, mat=M['glow'])
smooth(g, False)
decal('starmie_shine', g, (0, FRONT - 0.02, CZ), (-0.4, -1, 0.5), (0.026, 0.006, 0.018), 'white', 'gem', sink=0.1)

def ap(a, f): t = math.radians(a); return (math.sin(t) * RO * f, 0, CZ + math.cos(t) * RO * f)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, CZ), 'root'), ('spine', (0, 0, CZ), 'hips'), ('chest', (0, 0, CZ), 'spine'), ('gem', (0, FRONT - 0.02, CZ), 'chest')]
for b, a in ARMS.items(): bones.append((b, ap(a, 0.3), 'chest' if b in ('head', 'arm_l', 'arm_r') else 'hips'))
bones.append(('back', (0, 0.07, CZ), 'spine'))
for b, a in BACK.items(): bones.append((b, (ap(a, 0.3)[0], 0.07, ap(a, 0.3)[2]), 'back'))
rig, mesh = make_rig(bones, sockets=[('socket_fx', (0, FRONT - 0.09, CZ), 'gem'), ('socket_mouth', (0, FRONT - 0.09, CZ), 'gem')])

plan_clips(rig, 'biped', size=H, over={
    'idle': {'gem': loop([(0, S(1)), (30, S(1.06))], 60), 'back': loop([(0, {}), (60, {'r': (0, 0, -72)})], 60) if False else loop([(0, {'r': (0, 0, 0)}), (30, {'r': (0, 0, 8)})], 60)},
    'idle_alt': (100, {'back': [(0, {}), (40, {'r': (0, 0, 72)}), (41, {'r': (0, 0, 72)}), (100, {'r': (0, 0, 72)})] if False else [(0, {}), (25, {'r': (0, 0, 36)}), (50, {'r': (0, 0, 72)}), (75, {'r': (0, 0, 36)}), (100, {})],
                       'gem': [(0, S(1)), (50, S(1.2)), (56, S(1)), (100, S(1))]}, True, None),
    'attack_physical': (30, {'root': [(0, {}), (6, {'l': (0, 0.05 * H, -0.05 * H)}), (10, {'r': (0, 0, 240), 'l': (0, 0.08 * H, 0.2 * H)}), (14, {'r': (0, 0, 480), 'l': (0, 0.08 * H, 0.4 * H)}),
                                          (20, {'r': (0, 0, 660), 'l': (0, 0.05 * H, 0.3 * H)}), (26, {'r': (0, 0, 720), 'l': (0, 0, 0.05 * H)}), (30, {'r': (0, 0, 720)})],
                             'back': [(0, {}), (14, {'r': (0, 0, -120)}), (30, {'r': (0, 0, -360)})]}, False, 14),
    'attack_special': (44, {'root': [(0, {}), (12, {'l': (0, 0.12 * H, 0)}), (32, {'l': (0, 0.12 * H, 0)}), (44, {})],
                            'back': [(0, {}), (12, {'r': (0, 0, 120)}), (24, {'r': (0, 0, 360)}), (44, {'r': (0, 0, 360)})],
                            'gem': [(0, S(1)), (14, S(1.3)), (22, S(1.45)), (26, S(0.9)), (34, S(1.1)), (44, S(1))]}, False, 24),
    'faint': (36, {'root': [(0, {}), (8, {'r': (0, 0, 15)}), (26, {'r': (-88, 0, 0), 'l': (0, 0, 0.1 * H)}), (36, {'r': (-90, 0, 0), 'l': (0, 0, 0.1 * H)})], 'gem': [(0, S(1)), (36, S(0.85))]}, False, None),
    'sleep': (90, {'root': loop([(0, {'r': (-80, 0, 0), 'l': (0, 0, 0.14 * H)}), (45, {'r': (-80, 0, 0), 'l': (0, 0, 0.14 * H)})], 90), 'gem': loop([(0, S(0.95)), (45, S(1.02))], 90)}, True, None),
})
sheet('check', H, poses=[('walk', 7, 'q34'), ('attack_physical', 12, 'front'), ('attack_special', 20, 'q34'), ('faint', 36, 'side')])
export(121, 'starmie', 1.1, 'biped', rig, mesh, shiny={'body': '#5a78c9', 'body_dk': '#3d579e', 'body_lt': '#7e98df'})

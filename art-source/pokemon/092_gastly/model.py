# Gastly (92) · ghost/poison · 1.3 m. Black core sphere fully enveloped in a highly transparent purple poison-gas cloud; wide white eyes with tiny pupils, big grin with two fangs. Floats.
reset('092_gastly')
M = pal([('core', '#231a2e'), ('gas', '#7a4ab0'), ('gas_lt', '#9d72cf'), ('gas_dk', '#5a3488'), ('eyew', '#f6f4ff'), ('pupil', '#151018'), ('mouth', '#7a1f3a'), ('tongue', '#e05a8a'), ('fang', '#ffffff')], extra_mats=[('gas', {'alpha': 0.38})])
CC = Vector((0, 0, 0.62)); RAD = 0.25
core = blob('gas_core', CC, (RAD, RAD * 0.95, RAD), 'core', 'spine', seg=40, rings=22)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'gas_eye_{nm}', core, CC + Vector((0, 0, 0.05)), (s * 0.45, -1, 0.25), (0.085, 0.015, 0.06), 'eyew', 'spine', sink=0.25, up=(s * -0.45, 0, 1))
    decal(f'gas_pupil_{nm}', e, l + Vector((-s * 0.012, -0.002, -0.004)), n, (0.012, 0.004, 0.012), 'pupil', 'spine', sink=0.0, seg=10, rings=6)
m, ml, mn = decal('gas_mouth', core, CC + Vector((0, 0, -0.07)), (0, -1, -0.35), (0.15, 0.015, 0.05), 'mouth', 'spine', sink=0.25)
decal('gas_tongue', m, ml + Vector((0, 0, -0.018)), mn, (0.07, 0.01, 0.04), 'tongue', 'spine', sink=0.0)
for s in (1, -1):
    f = cone(f'gas_fang_{s + 1}', 0.012, 0.0, 0.03, verts=8, loc=ml + Vector((s * 0.07, 0.004, 0.022)) - mn * 0.002); f.rotation_euler = (math.radians(180 - 20), 0, 0)
    colorize(f, 'fang'); reg(f, 'spine')
# gas aura (ref form): a lumpy gas cloud hugging the core on the sides/back/below, with curling tapered tendrils in every direction
import random as _r; _r.seed(92)
def _lump(v):
    k = 1 + 0.12 * math.sin(5 * v.x / 0.36 + 1.3) * math.sin(4 * v.z / 0.36) + 0.08 * math.sin(7 * v.y / 0.36 + 0.4)
    return Vector((v.x * k, v.y * k, v.z * k))
blob('gas_cloud', CC + Vector((0, 0.03, -0.04)), (0.44, 0.4, 0.36), lambda c_, n, p: 'gas_lt' if n.z > 0.55 else ('gas_dk' if n.z < -0.4 else 'gas'),
     'spine', seg=36, rings=20, fn=_lump, mat=M['gas'])
k = 0
dirs = []
for i in range(22):   # fibonacci sphere, skip the face cone
    z = 1 - 2 * (i + 0.5) / 22; r = math.sqrt(1 - z * z); a = i * 2.39996
    d = Vector((math.cos(a) * r, math.sin(a) * r, z))
    dirs.append(d)
for d in dirs:
    side = Vector((-d.y, d.x, 0.3)).normalized() if abs(d.z) < 0.95 else Vector((1, 0, 0))
    L = _r.uniform(0.12, 0.2); curl = _r.choice((1, -1)) * _r.uniform(0.07, 0.12)
    b0 = CC + Vector((0, 0.03, -0.04)) + Vector((d.x * 0.4, d.y * 0.36, d.z * 0.32))
    pts = [b0, b0 + d * L * 0.4 + side * curl * 0.3, b0 + d * L * 0.75 + side * curl, b0 + d * L + side * curl * 1.8 - d * 0.03]
    bone = 'gas3' if d.z < -0.4 else ('gas1' if d.y < 0 else 'gas2')
    tube(f'gas_tendril{k}', pts, [0.09, 0.055, 0.028, 0.004], 'gas_dk' if d.z < -0.3 else 'gas_lt', bone, seg=10, mat=M['gas']); k += 1
bones = [('root', (0, 0, 0), None), ('spine', tuple(CC), 'root'), ('gas1', tuple(CC + Vector((0, -0.2, 0))), 'spine'), ('gas2', tuple(CC + Vector((0, 0.2, 0))), 'spine'), ('gas3', tuple(CC + Vector((0, 0.05, -0.3))), 'spine')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(CC + Vector((0, -0.27, -0.08))), 'spine'), ('socket_fx', tuple(CC + Vector((0, -0.3, 0))), 'spine')])
churn = lambda L: {'gas1': loop([(0, {}), (L // 2, {'r': (0, 0, 10), 's': (1.06, 1.06, 0.96)})], L), 'gas2': loop([(0, {'r': (0, 0, 8)}), (L // 2, {'s': (0.96, 0.96, 1.06)})], L), 'gas3': swing(14, L, 0.25, 4, 0)}
plan_clips(rig, 'rigid', size=1.0, over={'idle': churn(60), 'walk': churn(24), 'run': churn(16), 'sleep': churn(90),
                                       'attack_special': {'gas1': [(0, {}), (12, {'s': (1.35, 1.35, 1.35)}), (22, {'s': (0.9, 0.9, 0.9)}), (40, {})], 'gas2': [(0, {}), (12, {'s': (1.35, 1.35, 1.35)}), (22, {'s': (0.9, 0.9, 0.9)}), (40, {})]}})   # gas burst (Lick / Night Shade)
sheet('check', 1.1, poses=[('idle', 15, 'front'), ('walk', 6, 'side'), ('attack_special', 12, 'q34'), ('hit', 3, 'q34')])
export(92, 'gastly', 1.3, 'rigid', rig, mesh, shiny={'gas': '#4a8ad0', 'gas_lt': '#7ab0e8', 'gas_dk': '#2e5e9a'})

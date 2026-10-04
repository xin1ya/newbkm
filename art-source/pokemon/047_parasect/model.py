# Parasect (47) · bug/grass · 1.0 m. Evolution of Paras — geometry matched to the reference silhouette (art-source/reference, comparison only):
# the mushroom has taken over: one huge bell-shaped pinkish-red cap (yellow spots, small rounded top knob) covering the whole back,
# the orange crab body crouched underneath, blank white eyes peeking out under the rim, two big curved pincers hanging down to the ground
# in front, three pairs of thin legs.
reset('047_parasect')
M = pal([('shell', '#c9762e'), ('shell_dk', '#9a5420'), ('belly', '#e0a060'), ('cap', '#b8607e'), ('cap_dk', '#8e4862'), ('spot', '#d8b83a'), ('gill', '#e6c49a'),
         ('claw', '#c97a32'), ('eye', '#eef0ee'), ('mouth', '#5a2a1a'), ('fang', '#fff8ec')])
BC = Vector((0, 0.03, 0.34))
SW = lambda c: seg_w(c, ['head', 'chest', 'spine', 'hips'])
body = blob('pst_body', BC, (0.24, 0.27, 0.16), lambda c, n, p: 'belly' if n.z < -0.5 else 'shell', SW, seg=36, rings=20)
for k, y in enumerate((-0.12, -0.04, 0.04, 0.12, 0.2)):   # shell ribs visible under the cap
    pts = []
    for i in range(13):
        ang = math.radians(-100 + 200 * i / 12); d = Vector((math.sin(ang), 0, math.cos(ang)))
        l, nn = shoot(body, Vector((0, y, BC.z)), d, fallback=True); pts.append(l + nn * 0.001)
    tube(f'pst_rib{k}', pts, 0.008, 'shell_dk', SW, seg=5)
# the mushroom cap: bell / dome, rim flaring down low around the body, small knob on top
CC = Vector((0, 0.02, 0.62))
# bell profile (lathe along +Z): wide deep rim low around the body, shoulders curving in, a raised rounded crown on top
CZ = [0.4, 0.43, 0.5, 0.62, 0.74, 0.84, 0.9, 0.935, 0.97, 0.995, 1.0]
CRr = [0.4, 0.44, 0.44, 0.39, 0.31, 0.23, 0.17, 0.15, 0.12, 0.06, 0.0]
cap = tube('pst_cap', [Vector((0, 0.02, z)) for z in CZ], CRr, lambda c, n, p: 'gill' if n.z < -0.5 else 'cap', 'cap', seg=48)
import random; rnd = random.Random(47)
for j in range(26):
    a = rnd.uniform(0, 2 * math.pi); e = rnd.uniform(-0.15, 0.85)
    d = Vector((math.cos(a) * math.sqrt(1 - e * e), math.sin(a) * math.sqrt(1 - e * e), e * 0.9))
    decal(f'pst_spot{j}', cap, CC + Vector((0, 0, -0.05)), d, (0.04 + 0.02 * rnd.random(), 0.008, 0.03 + 0.015 * rnd.random()), 'spot', 'cap', sink=0.25, seg=10, rings=6)
# face under the rim: blank white eyes, fangs
for s, nm in ((1, 'l'), (-1, 'r')):
    ec = Vector((s * 0.1, -0.25, 0.36))
    blob(f'pst_eye_{nm}', ec, (0.06, 0.04, 0.045), 'eye', 'head', seg=20, rings=12)
    f = cone(f'pst_fang_{nm}', 0.012, 0.0, 0.035, verts=8, loc=Vector((s * 0.03, -0.29, 0.22))); f.rotation_euler = (math.radians(180), 0, 0)
    colorize(f, 'fang'); reg(f, 'head')
decal('pst_mouth', body, Vector((0, -0.1, 0.25)), (0, -1, -0.1), (0.05, 0.01, 0.015), 'mouth', 'head', sink=0.3)
# pincers: arm out from the front sides, big curved blade hanging down and slightly inward to the ground
for s, nm in ((1, 'l'), (-1, 'r')):
    sh = Vector((s * 0.2, -0.2, 0.3)); el = Vector((s * 0.33, -0.3, 0.32))
    tube(f'pst_arm_{nm}', [sh, (sh + el) / 2 + Vector((0, 0, 0.03)), el], [0.04, 0.038, 0.036], 'claw', f'arm_{nm}', seg=12)
    BLp = [el, el + Vector((s * 0.05, -0.04, -0.08)), el + Vector((s * 0.05, -0.06, -0.18)), el + Vector((0, -0.05, -0.27)), el + Vector((-s * 0.07, -0.03, -0.31))]
    tube(f'pst_claw_{nm}', BLp, [0.065, 0.105, 0.1, 0.065, 0.01], lambda c, n_, p: 'shell_dk' if n_.y > 0.5 else 'claw', f'hand_{nm}', seg=14, flat=0.45)
LEGS = {}
for s, nm in ((1, 'l'), (-1, 'r')):
    for j, (y, name) in enumerate(((-0.06, 'arm'), (0.06, None), (0.18, 'thigh'))):
        if name == 'arm': y = -0.02
        hip = Vector((s * 0.2, y, 0.24)); knee = Vector((s * 0.33, y + 0.03 * (j - 1), 0.25)); foot = Vector((s * 0.37, y + 0.06 * (j - 1), 0.0))
        bn = f'{name}_{nm}' if name else 'spine'; bn2 = (('hand_' if name == 'arm' else 'foot_') + nm) if name else 'spine'
        if name != 'arm':
            tube(f'pst_leg{j}_{nm}', [hip, knee], [0.022, 0.02], 'claw', bn, seg=8)
            tube(f'pst_shin{j}_{nm}', [knee, (knee + foot) / 2, foot + Vector((0, 0, 0.008))], [0.019, 0.016, 0.006], 'shell_dk', bn2, seg=8)
        else:
            tube(f'pst_leg{j}_{nm}', [hip + Vector((0, 0.04, 0)), knee + Vector((0, 0.04, 0))], [0.022, 0.02], 'claw', 'spine', seg=8)
            tube(f'pst_shin{j}_{nm}', [knee + Vector((0, 0.04, 0)), foot + Vector((0, 0.04, 0.008))], [0.019, 0.006], 'shell_dk', 'spine', seg=8)
        if name: LEGS[f'{name}_{nm}'] = (tuple(hip), tuple(foot))
bones = quad_bones((0, 0.15, 0.3), (0, -0.1, 0.3), (0, -0.18, 0.3), (0, -0.22, 0.3), LEGS, extra=[('cap', tuple(CC), 'spine')])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.3, 0.24), 'head'), ('socket_fx', (0, 0.02, 1.0), 'cap')])
plan_clips(rig, 'quadruped', size=0.6, over={
    'idle': {'cap': swing(3, 80, 0.0, 4, 1), 'hand_l': swing(6, 80, 0.0, 4, 0), 'hand_r': swing(6, 80, 0.5, 4, 0)},
    'attack_physical': {'hand_l': [(0, {}), (9, {'r': (40, 0, 0)}), (15, {'r': (-45, 0, 0)}), (28, {})], 'hand_r': [(0, {}), (9, {'r': (40, 0, 0)}), (15, {'r': (-45, 0, 0)}), (28, {})]},   # X-Scissor / Slash
    'attack_special': {'cap': [(0, {}), (14, {'s': (1.12, 1.12, 1.12)}), (22, {'s': (0.95, 0.95, 0.95)}), (40, {})]},   # spore cloud
})
sheet('check', 1.05, poses=[('walk', 7, 'side'), ('attack_special', 14, 'q34'), ('attack_physical', 15, 'q34'), ('idle', 0, 'front')])
export(47, 'parasect', 1.0, 'quadruped', rig, mesh, shiny={'shell': '#e8b23a', 'shell_dk': '#c08a2a', 'claw': '#e8b23a', 'cap': '#e8d27a', 'cap_dk': '#c0a85a'})

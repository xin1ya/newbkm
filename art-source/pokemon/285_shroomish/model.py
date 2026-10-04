# Shroomish (285) · grass · 0.4 m. Round cream body with a big flat mushroom cap on top: light green with darker green spots, a rim of tan bumps; small beady eyes, tiny mouth, two stubby feet.
reset('285_shroomish')
M = pal([('cream', '#e8dcb0'), ('cream_dk', '#c4b484'), ('cap', '#a8d070'), ('cap_dk', '#5a9a40'), ('rim', '#d8c894'), ('eye', '#1a1418'), ('mouth', '#6a3a2a'), ('white', '#ffffff')])
BC = Vector((0, 0, 0.14))
body = blob('sh_body', BC, (0.14, 0.13, 0.12), lambda c, n, p: 'cream_dk' if n.z < -0.6 else 'cream', 'spine', seg=32, rings=18)
spots = [Vector((math.cos(a) * 0.55, math.sin(a) * 0.55, 0.65)).normalized() for a in [k * 2 * math.pi / 6 for k in range(6)]] + [Vector((0, 0, 1))]
CC = BC + Vector((0, 0.01, 0.1))
blob('sh_cap', CC, (0.2, 0.19, 0.09), lambda c, n, p: 'cap_dk' if any(n.dot(d) > 0.95 for d in spots) else ('rim' if n.z < -0.2 else 'cap'), 'head', seg=36, rings=18,
     fn=lambda v: Vector((v.x, v.y, v.z * (0.6 if v.z < 0 else 1.0))))
for k in range(14):
    a = 2 * math.pi * k / 14
    blob(f'sh_bump{k}', CC + Vector((math.cos(a) * 0.19, math.sin(a) * 0.18, -0.03)), (0.03, 0.03, 0.025), 'rim', 'head', seg=10, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'sh_eye_{nm}', body, BC + Vector((0, 0, 0.02)), (s * 0.35, -1, 0.05), (0.014, 0.008, 0.018), 'eye', 'head', sink=0.2)
    decal(f'sh_shine_{nm}', e, loc + Vector((0, 0, 0.005)), n, (0.005, 0.003, 0.005), 'white', 'head', sink=0.05, seg=8, rings=6)
    blob(f'sh_foot_{nm}', (s * 0.06, -0.03, 0.025), (0.04, 0.05, 0.025), 'cream_dk', f'foot_{nm}', seg=14, rings=8)
decal('sh_mouth', body, BC + Vector((0, 0, -0.03)), (0, -1, -0.1), (0.012, 0.005, 0.006), 'mouth', 'head', sink=0.3)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.06), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(CC), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'thigh_{nm}', (s * 0.06, -0.01, 0.06), 'hips'), (f'foot_{nm}', (s * 0.06, -0.03, 0.02), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.13, -0.02))), 'head'), ('socket_fx', tuple(CC + Vector((0, 0, 0.12))), 'head')])
plan_clips(rig, 'biped', size=0.4, over={'attack_special': {'head': [(0, {}), (12, {'s': (1.1, 1.1, 0.85)}), (22, {'s': (0.95, 0.95, 1.1)}), (40, {})]}})   # Stun Spore: cap puff
sheet('check', 0.4, poses=[('walk', 6, 'side'), ('attack_special', 12, 'q34')])
export(285, 'shroomish', 0.4, 'biped', rig, mesh, shiny={'cap': '#e8c060', 'cap_dk': '#c08a30'})

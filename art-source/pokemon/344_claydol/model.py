# Claydol (344) · ground/psychic · 1.5 m. Floating black clay idol: dark round body, rounded head with a row of small yellow-white eyes, red and cream dotted markings, two big floating arms (detached hands) with ringed segments; no legs, flat underside.
reset('344_claydol')
M = pal([('black', '#2e2a2a'), ('black_dk', '#1a1717'), ('cream', '#e8d8b0'), ('red', '#c83a2a'), ('eye', '#f2e090'), ('white', '#ffffff')])
BC = Vector((0, 0, 0.75)); HC = BC + Vector((0, 0, 0.45))
body = blob('cd_body', BC, (0.3, 0.28, 0.38), lambda c, n, p: 'black_dk' if n.z < -0.5 else 'black', 'spine', seg=32, rings=18, fn=lambda v: Vector((v.x, v.y, v.z * (0.7 if v.z < 0 else 1.0))))
head = blob('cd_head', HC, (0.22, 0.2, 0.17), 'black', 'head', seg=28, rings=14)
for k in range(8):
    a = math.radians(-70 + 140 * k / 7)
    decal(f'cd_eye{k}', head, HC + Vector((0, 0, 0.02)), (math.sin(a), -math.cos(a), 0.1), (0.022, 0.006, 0.022), 'eye', 'head', sink=0.2, seg=8, rings=5)
for k in range(10):
    a = 2 * math.pi * k / 10
    decal(f'cd_dot{k}', body, BC + Vector((0, 0, 0.12)), (math.cos(a), math.sin(a), 0.3), (0.03, 0.006, 0.03), 'red' if k % 2 else 'cream', 'spine', sink=0.2, seg=8, rings=5)
    decal(f'cd_dotb{k}', body, BC + Vector((0, 0, -0.08)), (math.cos(a + 0.3), math.sin(a + 0.3), -0.1), (0.025, 0.006, 0.025), 'cream', 'spine', sink=0.2, seg=8, rings=5)
for s, nm in ((1, 'l'), (-1, 'r')):
    A = BC + Vector((s * 0.48, -0.02, 0.1))
    for k in range(3):
        tube(f'cd_ring{k}_{nm}', [A + Vector((0, 0, -0.06 + 0.12 * k / 2 - 0.02)), A + Vector((0, 0, -0.06 + 0.12 * k / 2 + 0.02))], [0.09, 0.09], 'cream' if k == 1 else 'black', f'arm_{nm}', seg=12)
    tube(f'cd_forearm_{nm}', [A + Vector((0, 0, -0.08)), A + Vector((s * 0.02, -0.04, -0.3))], [0.08, 0.06], 'black', f'hand_{nm}', seg=12)
    blob(f'cd_hand_{nm}', A + Vector((s * 0.02, -0.05, -0.36)), (0.08, 0.06, 0.07), 'black', f'hand_{nm}', seg=14, rings=8)
bones = [('root', (0, 0, 0), None), ('spine', tuple(BC), 'root'), ('head', tuple(HC - Vector((0, 0, 0.1))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.48, -0.02, 0.1))), 'spine'), (f'hand_{nm}', tuple(BC + Vector((s * 0.48, -0.04, -0.1))), f'arm_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.22, 0))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.3, 0))), 'head')])
hover = lambda L: {'root': bob(0.06, L, 0, 4), 'arm_l': swing(6, L, 0.2, 4, 0), 'arm_r': swing(6, L, 0.7, 4, 0)}
plan_clips(rig, 'rigid', size=1.5, over={'idle': (60, hover(60), True, None), 'walk': (40, hover(40), True, None)})
sheet('check', 1.5, poses=[('idle', 6, 'side'), ('attack_special', 12, 'q34')])
export(344, 'claydol', 1.5, 'rigid', rig, mesh, shiny={'black': '#e8c8a0', 'black_dk': '#b89a70'})

# Bellossom (182) · grass · 0.4 m. Small light-green dancer: round head with two big red flowers (yellow centers), green leaf "skirt" of yellow-green petals, tiny arms, round body.
reset('182_bellossom')
M = pal([('green', '#7ac24a'), ('green_dk', '#4f9a2e'), ('skirt', '#d6e04a'), ('skirt_dk', '#a8b02a'), ('flower', '#e0383a'), ('flower_dk', '#a8222a'), ('fcenter', '#f6d23a'),
         ('eye', '#1a1418'), ('white', '#ffffff'), ('mouth', '#4a1a22'), ('cheek', '#f2a0a0')])
HC = Vector((0, 0, 0.27)); BC = Vector((0, 0, 0.13))
head = blob('bl_head', HC, (0.1, 0.09, 0.09), 'green', 'head', seg=32, rings=18)
blob('bl_body', BC, (0.06, 0.055, 0.07), 'green', 'spine', seg=24, rings=14)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'bl_eye_{nm}', head, HC + Vector((0, 0, 0.0)), (s * 0.38, -1, 0.05), (0.018, 0.008, 0.026), 'eye', 'head', sink=0.2)
    decal(f'bl_shine_{nm}', e, loc + Vector((0, 0, 0.01)), n, (0.007, 0.003, 0.007), 'white', 'head', sink=0.05, seg=10, rings=6)
    decal(f'bl_cheek_{nm}', head, HC + Vector((0, 0, -0.03)), (s * 0.7, -0.7, -0.2), (0.015, 0.006, 0.01), 'cheek', 'head', sink=0.3)
    tube(f'bl_arm_{nm}', [BC + Vector((s * 0.05, 0, 0.04)), BC + Vector((s * 0.1, -0.02, 0.07))], [0.016, 0.013], 'green', f'arm_{nm}', seg=8)
    blob(f'bl_leg_{nm}', (s * 0.03, -0.005, 0.03), (0.022, 0.025, 0.03), 'green', f'foot_{nm}', seg=12, rings=8)
    # head flowers: five round petals around a yellow center, tilted outward
    fc = HC + Vector((s * 0.07, 0.0, 0.08)); nrm = Vector((s * 0.6, -0.2, 0.8)).normalized()
    for k in range(5):
        a = 2 * math.pi * k / 5; u = nrm.cross(Vector((0, 0, 1))).normalized(); v = nrm.cross(u)
        blob(f'bl_fl{k}_{nm}', fc + (u * math.cos(a) + v * math.sin(a)) * 0.04, (0.03, 0.03, 0.012), lambda c, n_, p: 'flower' if n_.dot(nrm) > -0.2 else 'flower_dk', f'ear_{nm}', seg=12, rings=8,
             rot=(math.degrees(math.acos(max(-1, min(1, nrm.z)))) * (-1 if s > 0 else 1) * 0, s * 35, 0))
    blob(f'bl_fc_{nm}', fc + nrm * 0.01, (0.02, 0.02, 0.016), 'fcenter', f'ear_{nm}', seg=12, rings=8)
decal('bl_mouth', head, HC + Vector((0, 0, -0.035)), (0, -1, -0.1), (0.012, 0.005, 0.006), 'mouth', 'head', sink=0.3)
for k in range(8):   # petal skirt
    a = 2 * math.pi * k / 8 + 0.2; d = Vector((math.cos(a), math.sin(a), 0))
    blob(f'bl_skirt{k}', BC + d * 0.07 + Vector((0, 0, -0.03)), (0.06, 0.035, 0.012), lambda c, n_, p: 'skirt' if n_.z > -0.2 else 'skirt_dk', 'spine', seg=14, rings=8, rot=(0, -22, math.degrees(a)))
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.07), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, 0, 0.17), 'spine'), ('head', tuple(HC - Vector((0, 0, 0.06))), 'chest')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.05, 0, 0.04))), 'chest'), (f'thigh_{nm}', (s * 0.03, 0, 0.06), 'hips'), (f'foot_{nm}', (s * 0.03, -0.005, 0.02), f'thigh_{nm}'),
              (f'ear_{nm}', tuple(HC + Vector((s * 0.06, 0, 0.07))), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.1, -0.03))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.12, 0))), 'head')])
plan_clips(rig, 'biped', size=0.4, over={'idle': {'spine': swing(8, 60, 0, 4, 2), 'arm_l': swing(20, 60, 0, 4), 'arm_r': swing(20, 60, 0.5, 4)}})   # little dance sway
sheet('check', 0.42, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('idle', 15, 'front')])
export(182, 'bellossom', 0.4, 'biped', rig, mesh, shiny={'green': '#b8d86a', 'flower': '#f0a03a', 'flower_dk': '#c07a1a'})

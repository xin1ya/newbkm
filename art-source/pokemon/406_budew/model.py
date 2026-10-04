# Budew (406) · grass/poison · 0.2 m. Tiny green bud: round green body/face with closed eyes (lines), a big yellow-green closed flower bud on top (wrapped leaves), cream face, two leaf-like stubby feet, small leaf arms.
reset('406_budew')
M = pal([('green', '#7ab84a'), ('green_dk', '#4a8a30'), ('bud', '#d0e070'), ('bud_dk', '#9ab040'), ('face', '#e8f0c8'), ('eye', '#1a1418'), ('white', '#ffffff')])
BC = Vector((0, 0, 0.12))
body = blob('bw_body', BC, (0.1, 0.09, 0.09), lambda c, n, p: 'face' if n.y < -0.55 and abs(n.z) < 0.55 else 'green', 'spine', seg=28, rings=16)
for k in range(4):
    a = 2 * math.pi * k / 4 + 0.6
    o = blob(f'bw_budleaf{k}', BC + Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.15)), (0.045, 0.045, 0.09), lambda c, n, p: 'bud_dk' if n.z < 0 else 'bud', 'head', seg=14, rings=10, rot=(-math.sin(a) * 15, math.cos(a) * 15, 0))
for s, nm in ((1, 'l'), (-1, 'r')):
    tube(f'bw_eye_{nm}', [BC + Vector((s * 0.02, -0.088, 0.012)), BC + Vector((s * 0.045, -0.08, 0.008))], [0.004, 0.004], 'eye', 'spine', seg=6)
    blob(f'bw_foot_{nm}', Vector((s * 0.05, -0.02, 0.02)), (0.04, 0.05, 0.018), 'green_dk', f'foot_{nm}', seg=12, rings=6)
    tube(f'bw_arm_{nm}', [BC + Vector((s * 0.09, 0, 0)), BC + Vector((s * 0.13, -0.02, -0.02))], [0.02, 0.006], 'green_dk', f'arm_{nm}', seg=8, flat=0.4)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.05), 'root'), ('spine', tuple(BC), 'hips'), ('head', tuple(BC + Vector((0, 0, 0.08))), 'spine')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.09, 0, 0))), 'spine'), (f'thigh_{nm}', (s * 0.05, 0, 0.05), 'hips'), (f'foot_{nm}', (s * 0.05, -0.02, 0.02), f'thigh_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.1, 0))), 'spine'), ('socket_fx', tuple(BC + Vector((0, 0, 0.3))), 'head')])
plan_clips(rig, 'biped', size=0.2)
sheet('check', 0.3, poses=[('walk', 6, 'side'), ('attack_special', 12, 'q34')])
export(406, 'budew', 0.2, 'biped', rig, mesh, shiny={'green': '#a8c84a', 'bud': '#e8d080'})

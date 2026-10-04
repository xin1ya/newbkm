# Ledyba (165) · bug/flying · 1.0 m. Round ladybug: red domed shell with 5 black spots, black head with big eyes and two antennae, cream face, small wings, 6 thin black limbs (4 arms + 2 legs).
reset('165_ledyba')
M = pal([('red', '#d83a32'), ('red_dk', '#a82a24'), ('black', '#2a2830'), ('cream', '#f0e4c8'), ('eye', '#1a1418'), ('wing', '#e8f0f8'), ('white', '#ffffff')], extra_mats=[('wing', {'alpha': 0.6})])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
spots = [Vector(v).normalized() for v in ((0.5, 0.6, 0.6), (-0.5, 0.6, 0.6), (0.6, 0.6, -0.1), (-0.6, 0.6, -0.1), (0, 0.9, 0.3))]
Q = biped('lb', {'BZ': 0.42, 'by': 0.04, 'body': (0.22, 0.22, 0.24), 'bodyc': lambda c, n, p: 'black' if any(n.dot(d) > 0.94 for d in spots) else ('cream' if n.y < -0.6 else ('red_dk' if n.z < -0.6 else 'red')), 'HZ2': 0.72, 'hy': -0.05,
    'head': (0.14, 0.13, 0.12), 'headc': lambda c, n, p: 'cream' if n.y < -0.5 and n.z < 0.1 else 'black', 'eye': (0.05, 0.06), 'eyec': 'eye', 'eyex': 0.45, 'eyez': 0.2,
    'arm': ((0.16, -0.12, 0.5), (0.26, -0.18, 0.44), (0.3, -0.22, 0.38), 0.022, 0.018, 'black'), 'hand': 0.035, 'handc': 'white',
    'leg': ((0.09, -0.05, 0.22), (0.12, -0.05, 0.12), (0.12, 0.0, 0.05), 0.025, 0.02, 'black'), 'foot': (0.035, 0.05, 0.03), 'footc': 'black'})
HC = Q['HC']
for s, nm in ((1, 'l'), (-1, 'r')):
    tube(f'lb_ant_{nm}', [HC + Vector((s * 0.05, -0.02, 0.1)), HC + Vector((s * 0.1, 0.0, 0.22)), HC + Vector((s * 0.12, 0.05, 0.27))], [0.01, 0.008, 0.006], 'black', 'head', seg=6)
    blob(f'lb_antb_{nm}', HC + Vector((s * 0.12, 0.05, 0.28)), (0.02, 0.02, 0.02), 'black', 'head', seg=8, rings=6)
    sh = Vector((s * 0.16, -0.1, 0.38)); wr = Vector((s * 0.28, -0.18, 0.3))
    tube(f'lb_arm2_{nm}', [sh, (sh + wr) / 2 + Vector((0, 0, 0.03)), wr], [0.02, 0.018, 0.016], 'black', f'arm_{nm}', seg=6)
    blob(f'lb_hand2_{nm}', wr, (0.03, 0.03, 0.03), 'white', f'hand_{nm}', seg=10, rings=6)
    blob(f'lb_wing_{nm}', Vector((s * 0.12, 0.25, 0.55)), (0.12, 0.01, 0.07), 'wing', f'wing_{nm}', seg=12, rings=6, rot=(0, s * -30, 0), mat=M['wing'])
for s, nm in ((1, 'l'), (-1, 'r')): Q['bones'].append((f'wing_{nm}', (s * 0.06, 0.22, 0.55), 'chest'))
rig, mesh = biped_rig(Q, 1.0)
flap = {f'wing_{nm}': loop([(round(24 * i / 8), {'r': (0, sg * 30 * math.sin(2 * math.pi * i / 8), 0)}) for i in range(8)], 24) for nm, sg in (('l', -1), ('r', 1))}
plan_clips(rig, 'biped', size=1.0, over={'idle': flap, 'walk': flap})
sheet('check', 1.0, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(165, 'ledyba', 1.0, 'biped', rig, mesh, shiny={'red': '#e8a040', 'red_dk': '#b87a20'})

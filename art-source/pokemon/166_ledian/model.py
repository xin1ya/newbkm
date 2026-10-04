# Ledian (166) · bug/flying · 1.4 m. Slender flying ladybug: red shell with 4 black dots, thin dark-blue body, black head with big eyes and long antennae, 4 long thin arms with white ball fists, translucent wings, short legs.
reset('166_ledian')
M = pal([('red', '#d83a32'), ('red_dk', '#a82a24'), ('navy', '#2a3050'), ('cream', '#f0e4c8'), ('eye', '#1a1418'), ('wing', '#e8f0f8'), ('yellow', '#e8c84a'), ('white', '#ffffff')], extra_mats=[('wing', {'alpha': 0.6})])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
spots = [Vector(v).normalized() for v in ((0.5, 0.7, 0.4), (-0.5, 0.7, 0.4), (0.4, 0.8, -0.3), (-0.4, 0.8, -0.3))]
Q = biped('ld', {'BZ': 0.6, 'by': 0.02, 'body': (0.13, 0.14, 0.26), 'bodyc': lambda c, n, p: 'navy' if n.y < -0.2 else ('navy' if any(n.dot(d) > 0.94 for d in spots) else 'red'), 'HZ2': 0.98, 'hy': -0.03,
    'head': (0.11, 0.1, 0.1), 'headc': lambda c, n, p: 'cream' if n.y < -0.5 and n.z < 0.0 else 'navy', 'eye': (0.045, 0.05), 'eyec': 'eye', 'eyex': 0.45, 'eyez': 0.2,
    'arm': ((0.11, -0.05, 0.8), (0.3, -0.1, 0.72), (0.42, -0.14, 0.6), 0.02, 0.016, 'navy'), 'hand': 0.045, 'handc': 'white',
    'leg': ((0.06, 0.0, 0.36), (0.08, -0.02, 0.2), (0.08, 0.0, 0.06), 0.03, 0.02, 'navy'), 'foot': (0.035, 0.05, 0.03), 'footc': 'navy'})

HC = Q['HC']
for s, nm in ((1, 'l'), (-1, 'r')):
    tube(f'ld_ant_{nm}', [HC + Vector((s * 0.04, -0.02, 0.09)), HC + Vector((s * 0.1, 0.02, 0.25)), HC + Vector((s * 0.16, 0.08, 0.34))], [0.008, 0.006, 0.004], 'navy', 'head', seg=6)
    sh = Vector((s * 0.11, -0.04, 0.62)); wr = Vector((s * 0.4, -0.12, 0.45))
    tube(f'ld_arm2_{nm}', [sh, (sh + wr) / 2 + Vector((0, 0, 0.05)), wr], [0.018, 0.016, 0.014], 'navy', f'arm_{nm}', seg=6)
    blob(f'ld_hand2_{nm}', wr, (0.04, 0.04, 0.04), 'white', f'hand_{nm}', seg=10, rings=6)
    blob(f'ld_wing_{nm}', Vector((s * 0.18, 0.2, 0.8)), (0.2, 0.01, 0.1), 'wing', f'wing_{nm}', seg=12, rings=6, rot=(0, s * -35, 0), mat=M['wing'])
for s, nm in ((1, 'l'), (-1, 'r')): Q['bones'].append((f'wing_{nm}', (s * 0.05, 0.15, 0.8), 'chest'))
rig, mesh = biped_rig(Q, 1.4)
flap = {f'wing_{nm}': loop([(round(16 * i / 8), {'r': (0, sg * 35 * math.sin(2 * math.pi * i / 8), 0)}) for i in range(8)], 16) for nm, sg in (('l', -1), ('r', 1))}
plan_clips(rig, 'biped', size=1.4, over={'idle': merge(flap, {'root': bob(0.04, 16, 0, 4)}), 'walk': flap})
sheet('check', 1.4, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(166, 'ledian', 1.4, 'biped', rig, mesh, shiny={'red': '#e8a040', 'red_dk': '#b87a20'})

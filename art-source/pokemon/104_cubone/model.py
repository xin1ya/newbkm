# Cubone (104) · ground · 0.4 m. Small brown biped wearing a white skull helmet (eye holes, two horn nubs, ridges on top) over its face, cream belly, holds a bone club, short tail with spike.
reset('104_cubone')
M = pal([('brown', '#b8885a'), ('brown_dk', '#8a643e'), ('cream', '#f2e2b8'), ('bone', '#f0ece0'), ('bone_dk', '#b8b4a8'), ('eye', '#1a1418'), ('white', '#ffffff')])
exec(open(D("art-source", "tools", "bkit.py"), encoding="utf-8").read())
Q = biped('cu', {'BZ': 0.15, 'body': (0.1, 0.09, 0.11), 'bodyc': lambda c, n, p: 'cream' if n.y < -0.5 else 'brown', 'HZ2': 0.31, 'head': (0.1, 0.1, 0.09), 'headc': 'brown',
    'eye': (0.02, 0.02), 'eyex': 0.45, 'eyez': 0.0,
    'arm': ((0.08, -0.01, 0.2), (0.12, -0.03, 0.15), (0.13, -0.05, 0.11), 0.025, 0.02, 'brown'), 'hand': 0.022, 'fingers': 3, 'fingl': 0.4, 'clawc': 'brown',
    'leg': ((0.05, 0.0, 0.07), (0.06, -0.01, 0.04), (0.06, 0.0, 0.02), 0.035, 0.03, 'brown'), 'foot': (0.035, 0.05, 0.02), 'toes': 3, 'toec': 'cream',
    'tail': [(0, 0.08, 0.08), (0, 0.13, 0.05), (0, 0.16, 0.03)], 'tailr': [0.025, 0.015, 0.003], 'tailc': 'brown'})
HC = Q['HC']
sk = blob('cu_skull', HC + Vector((0, -0.005, 0.02)), (0.115, 0.12, 0.1), lambda c, n, p: 'bone_dk' if n.z < -0.6 else 'bone', 'head', seg=28, rings=16,
          fn=lambda v: Vector((v.x, v.y * (1.15 if v.y < 0 and v.z < 0.2 else 1.0), v.z)))
for s, nm in ((1, 'l'), (-1, 'r')):
    decal(f'cu_hole_{nm}', sk, HC + Vector((0, 0, 0.01)), (s * 0.4, -1, 0.1), (0.03, 0.01, 0.026), 'eye', 'head', sink=0.3)
    e, loc, n = decal(f'cu_peye_{nm}', sk, HC + Vector((0, 0, 0.01)), (s * 0.4, -1, 0.1), (0.012, 0.006, 0.012), 'white', 'head', sink=-0.6, seg=8, rings=6)
    o = cone(f'cu_horn_{nm}', 0.025, 0.004, 0.06, verts=8, loc=HC + Vector((s * 0.08, 0.02, 0.1))); o.rotation_euler = (math.radians(-10), math.radians(s * 40), 0); colorize(o, 'bone'); reg(o, 'head')
for k in range(3):
    tube(f'cu_ridge{k}', [HC + Vector(((k - 1) * 0.03, -0.06, 0.1)), HC + Vector(((k - 1) * 0.03, 0.06, 0.1))], [0.012, 0.012], 'bone_dk', 'head', seg=6)
wr = Vector((-0.13, -0.05, 0.11))
tube('cu_club', [wr + Vector((0, 0, -0.07)), wr + Vector((0, -0.02, 0.1))], [0.012, 0.012], 'bone', 'hand_r', seg=8)
for z in (-0.08, 0.11):
    for x in (-0.012, 0.012):
        blob(f'cu_knob{z}{x}', wr + Vector((x, -0.01 if z > 0 else 0.0, z)), (0.018, 0.018, 0.018), 'bone', 'hand_r', seg=10, rings=6)
rig, mesh = biped_rig(Q, 0.4)
plan_clips(rig, 'biped', size=0.4, over={'attack_physical': {'arm_r': [(0, {}), (9, {'r': (-80, 0, 0)}), (15, {'r': (60, 0, 0)}), (28, {})]}})   # Bone Club swing
sheet('check', 0.4, poses=[('walk', 6, 'side'), ('attack_physical', 15, 'q34')])
export(104, 'cubone', 0.4, 'biped', rig, mesh, shiny={'brown': '#b8a85a', 'brown_dk': '#8a7a3e'})

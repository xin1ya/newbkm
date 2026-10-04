# Masquerain (284) · bug/flying · 0.8 m. Evolution of Surskit — geometry matched to the reference (art-source/reference, comparison only):
# a small pale-blue round head with a tall pointed horn, a little round abdomen hanging behind, and the famous "eyespot" antennae —
# two large upturned wing-shaped panels above the head, peach-orange with a white dashed rim and a magenta eye circle with a dark centre —
# plus two pairs of thin translucent pale-blue diamond wings spread flat at the sides for hovering. Rigid hover plan like Butterfree.
reset('284_masquerain')
M = pal([('blue', '#9ab8cc'), ('blue_lt', '#bcd4e2'), ('blue_dk', '#6e90a8'), ('peach', '#e88a66'), ('peach_dk', '#c8664a'), ('rim', '#f6eee6'),
         ('eyespot', '#b0407a'), ('eyespot_dk', '#5a1e44'), ('eye', '#1a1418'), ('white', '#ffffff'), ('mouth', '#d86060')],
        extra_mats=[('wing', {'alpha': 0.7})])
Z = 0.42; HC = Vector((0, -0.02, Z))
head = blob('mq_head', HC, (0.085, 0.08, 0.08), lambda c, n, p: 'blue_lt' if n.z < -0.3 else 'blue', 'head', seg=28, rings=16)
abd = blob('mq_abd', Vector((0, 0.1, Z - 0.1)), (0.07, 0.08, 0.07), 'blue', 'hips', seg=24, rings=14)
tube('mq_waist', [HC + Vector((0, 0.04, -0.04)), Vector((0, 0.08, Z - 0.08))], [0.04, 0.04], 'blue_dk', 'spine', seg=10)
# tall horn
b0 = HC + Vector((0, 0.0, 0.06))
tube('mq_horn', [b0, b0 + Vector((0, 0.0, 0.12)), b0 + Vector((0, 0.01, 0.26))], [0.03, 0.016, 0.002], 'blue', 'head', seg=10)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'mq_eye_{nm}', head, HC, (s * 0.45, -1, 0.0), (0.012, 0.006, 0.014), 'eye', 'head', sink=0.2, seg=10, rings=6)
m, _, _ = decal('mq_mouth', head, HC, (0, -1, -0.35), (0.025, 0.008, 0.012), 'mouth', 'head', sink=0.3)
# eyespot antennae: big upturned panels
for s, nm in ((1, 'l'), (-1, 'r')):
    c = HC + Vector((s * 0.21, 0.0, 0.11))
    rot = (0, s * -60, 0)
    blob(f'mq_ant_{nm}', c, (0.19, 0.012, 0.12), lambda c_, n_, p, c0=c: 'peach_dk' if (c_ - c0).length > 0.17 else 'peach', f'ant_{nm}', seg=28, rings=12, rot=rot,
         fn=lambda v, s=s: Vector((v.x * (1 + 0.25 * max(0.0, v.x * s)), v.y, v.z * (1 - 0.85 * max(0.0, v.x * s) ** 1.5))))
    for side in (-1, 1):
        decal(f'mq_ring{side + 1}_{nm}', bpy.data.objects[f'mq_ant_{nm}'], c, (0, side, 0), (0.085, 0.006, 0.07), 'rim', f'ant_{nm}', sink=0.5, seg=18, rings=8)
        decal(f'mq_spot{side + 1}_{nm}', head if False else bpy.data.objects[f'mq_ant_{nm}'], c, (0, side, 0), (0.06, 0.006, 0.05), 'eyespot', f'ant_{nm}', sink=0.4, seg=16, rings=8)
        decal(f'mq_spotc{side + 1}_{nm}', bpy.data.objects[f'mq_ant_{nm}'], c, (0, side, 0), (0.025, 0.006, 0.02), 'eyespot_dk', f'ant_{nm}', sink=0.2, seg=12, rings=6)
    tube(f'mq_stalk_{nm}', [HC + Vector((s * 0.04, 0, 0.05)), c - Vector((s * 0.08, 0, 0.03))], [0.014, 0.01], 'blue_dk', f'ant_{nm}', seg=8)
# four translucent diamond wings spread flat
for s, nm in ((1, 'l'), (-1, 'r')):
    for k, (dy, ln, wd) in enumerate(((-0.03, 0.14, 0.04), (0.08, 0.12, 0.035))):
        c = Vector((s * (0.06 + ln * 0.8), 0.06 + dy, Z - 0.09))
        blob(f'mq_wing{k}_{nm}', c, (ln, wd, 0.006), 'blue_lt', f'wing_{nm}', seg=4, rings=6, rot=(0, s * 12, s * (12 if k == 0 else -15)), mat=M['wing'])
bones = [('root', (0, 0, 0), None), ('hips', (0, 0.1, Z - 0.1), 'root'), ('spine', (0, 0.05, Z - 0.06), 'hips'), ('chest', (0, 0.02, Z - 0.03), 'spine'), ('head', tuple(HC), 'chest')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'wing_{nm}', (s * 0.06, 0.06, Z - 0.06), 'chest'), (f'ant_{nm}', tuple(HC + Vector((s * 0.04, 0, 0.05))), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.09, -0.02))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.12, 0))), 'head')])
def flap(L, a, n=8):
    return {f'wing_{nm}': loop([(round(L * i / n), {'r': (0, sg * a * math.sin(2 * math.pi * i / n), 0)}) for i in range(n)], L) for nm, sg in (('l', -1), ('r', 1))}
hover = lambda L, a: merge({'root': bob(0.03, L, 0, 4), 'ant_l': swing(6, L, 0.2, 4, 1), 'ant_r': swing(-6, L, 0.2, 4, 1)}, flap(L, a))
plan_clips(rig, 'rigid', size=0.8, over={'idle': (24, hover(24, 25), True, None), 'idle_alt': (60, hover(60, 15), True, None), 'walk': (16, hover(16, 30), True, None),
    'run': (12, merge(hover(12, 35), {'spine': hold({'r': (15, 0, 0)}, 12)}), True, None), 'fly': (12, hover(12, 35), True, None),
    'attack_special': (40, merge(flap(40, 40), {'ant_l': [(0, {}), (12, {'r': (0, 25, 0)}), (40, {})], 'ant_r': [(0, {}), (12, {'r': (0, -25, 0)}), (40, {})]}), False, 14),   # Scary Face / Gust
    'sleep': (90, merge(flap(90, 3, 4), {'root': loop([(0, {'l': (0, 0, -0.25)}), (45, {'l': (0, 0, -0.24)})], 90), 'head': hold({'r': (15, 0, 0)}, 90)}), True, None)})
sheet('check', 0.85, poses=[('idle', 5, 'front'), ('fly', 6, 'q34'), ('attack_special', 12, 'q34'), ('idle', 0, 'side')])
export(284, 'masquerain', 0.8, 'rigid', rig, mesh, shiny={'blue': '#c8c0a8', 'peach': '#e8c066', 'eyespot': '#4a7ac0'})

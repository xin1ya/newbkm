# Raichu (26) · electric · 0.8 m. Plump orange mouse: cream belly, brown hands/feet tips, yellow oval cheeks, ears brown at the back with curled yellow tips, very long thin black tail ending in a yellow lightning-bolt blade.
reset('026_raichu')
M = pal([('orange', '#f0952a'), ('orange_dk', '#d27a1c'), ('cream', '#f7e3b0'), ('brown', '#7a4a24'), ('ear_in', '#f6d36a'), ('eye', '#1a1418'), ('white', '#ffffff'),
         ('cheek', '#f8d23a'), ('mouth', '#7a3a2a'), ('black', '#2a2420'), ('bolt', '#f8d23a')])
BC = Vector((0, 0.01, 0.26)); HC = Vector((0, -0.01, 0.6)); br = (0.19, 0.16, 0.22); hr = (0.2, 0.17, 0.165)
blob('rai_body', BC, br, lambda c, n, p: 'cream' if (n.y < -0.4 and c.z < 0.38) else 'orange', lambda c: lerp_w('spine', 'chest', (c.z - BC.z + br[2] * 0.3) / br[2]), seg=36, rings=20,
     fn=lambda v: Vector((v.x * (1 + 0.18 * -v.z), v.y * (1 + 0.12 * -v.z), v.z)))
head = blob('rai_head', HC, hr, lambda c, n, p: 'cream' if (n.y < -0.7 and n.z < -0.3) else 'orange', 'head', seg=36, rings=20, fn=lambda v: Vector((v.x * (1 + 0.1 * -v.z), v.y, v.z)))
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'rai_eye_{nm}', head, HC + Vector((0, 0, 0.025)), (s * 0.42, -1, 0.1), (0.036, 0.014, 0.042), 'eye', 'head', sink=0.2)
    decal(f'rai_shine_{nm}', e, loc + Vector((s * -0.005, 0, 0.012)), n, (0.012, 0.004, 0.012), 'white', 'head', sink=0.05, seg=10, rings=6)
    decal(f'rai_cheek_{nm}', head, HC + Vector((0, 0, -0.04)), (s * 0.85, -0.6, -0.2), (0.04, 0.01, 0.03), 'cheek', 'head', sink=0.3)
    # ears: wide, brown back, inner yellow, tip curls outward into a little spiral
    eb = HC + Vector((s * 0.1, 0.02, 0.13)); d = Vector((s * 0.55, 0.15, 0.85)).normalized()
    pts = [eb + d * 0.2 * t + Vector((s * 0.05 * max(0, t - 0.6) ** 2 * 6, 0, -0.03 * max(0, t - 0.75) * 4)) for t in (0, 0.25, 0.5, 0.7, 0.85, 1.0)]
    tube(f'rai_ear_{nm}', pts, [0.04, 0.06, 0.06, 0.045, 0.025, 0.006], lambda c, n_, p: 'ear_in' if n_.y < -0.2 else 'brown', lambda c, nm=nm, eb=eb: lerp_w('head', f'ear_{nm}', (c - eb).length / 0.1), seg=14, flat=0.35)
    sh = BC + Vector((s * 0.15, -0.08, 0.12)); hd = sh + Vector((s * 0.04, -0.1, -0.1))
    tube(f'rai_arm_{nm}', [sh, (sh + hd) / 2, hd], [0.035, 0.032, 0.03], 'orange', f'arm_{nm}', seg=10)
    blob(f'rai_hand_{nm}', hd, (0.034, 0.034, 0.03), 'brown', f'arm_{nm}', seg=12, rings=8)
    blob(f'rai_leg_{nm}', Vector((s * 0.11, -0.02, 0.09)), (0.07, 0.08, 0.07), 'orange', lambda c, nm=nm: lerp_w(f'thigh_{nm}', f'foot_{nm}', 0.4), seg=16, rings=10)
    blob(f'rai_foot_{nm}', Vector((s * 0.11, -0.07, 0.025)), (0.05, 0.075, 0.025), 'brown', f'foot_{nm}', seg=16, rings=10)
blob('rai_nose', HC + Vector((0, -0.168, -0.01)), (0.009, 0.006, 0.006), 'eye', 'head', seg=10, rings=6)
decal('rai_mouth', head, HC + Vector((0, 0, -0.05)), (0, -1, -0.05), (0.03, 0.008, 0.012), 'mouth', 'head', sink=0.3)
# long thin black tail, curving up, ending in a lightning-bolt blade
tp = [Vector((0, 0.15, 0.12)), Vector((0, 0.3, 0.06)), Vector((0, 0.45, 0.08)), Vector((0, 0.56, 0.18)), Vector((0, 0.6, 0.32))]
tube('rai_tail', tp, [0.022, 0.014, 0.011, 0.01, 0.01], 'black', lambda c: seg_w(c, ['hips', 'tail1', 'tail2', 'tail3']), seg=8)
bolt = [Vector((0, 0.6, 0.32)), Vector((0, 0.66, 0.42)), Vector((0, 0.6, 0.44)), Vector((0, 0.68, 0.56))]
tube('rai_bolt', bolt, [0.02, 0.05, 0.05, 0.004], 'bolt', 'tail3', seg=6, flat=0.25)
bones = [('root', (0, 0, 0), None), ('hips', tuple(BC - Vector((0, 0, 0.12))), 'root'), ('spine', tuple(BC), 'hips'), ('chest', tuple(BC + Vector((0, 0, 0.14))), 'spine'),
         ('head', tuple(HC - Vector((0, 0, 0.07))), 'chest'), ('tail1', tuple(tp[1]), 'hips'), ('tail2', tuple(tp[2]), 'tail1'), ('tail3', tuple(tp[3]), 'tail2')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'arm_{nm}', tuple(BC + Vector((s * 0.15, -0.08, 0.12))), 'chest'), (f'thigh_{nm}', (s * 0.11, 0, 0.14), 'hips'), (f'foot_{nm}', (s * 0.11, -0.03, 0.03), f'thigh_{nm}'),
              (f'ear_{nm}', tuple(HC + Vector((s * 0.09, 0.02, 0.12))), 'head')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.16, -0.05))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.18, 0))), 'head')])
plan_clips(rig, 'biped', size=0.8, over={'attack_special': {'tail1': [(0, {}), (12, {'r': (-20, 0, 0)}), (22, {'r': (10, 0, 0)}), (40, {})]}})
sheet('check', 0.85, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('idle_alt', 20, 'front')])
export(26, 'raichu', 0.8, 'biped', rig, mesh, shiny={'orange': '#e8a85a', 'orange_dk': '#c88a3a', 'brown': '#5a3a2a'})

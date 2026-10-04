# Victreebel (71) · grass/poison · 1.7 m. Huge yellow-green pitcher with a gaping pink-rimmed mouth facing up/front, two big leaves on top rim, long vine with a curled leaf tip trailing behind, brown spots.
reset('071_victreebel')
M = pal([('yellow', '#cfd256'), ('yellow_dk', '#9aa034'), ('green', '#7cb048'), ('spot', '#7a7a24'), ('lip', '#e6a0a6'), ('mouth', '#4a2228'), ('teeth', '#f4f0e0'),
         ('leaf', '#4f9a40'), ('leaf_dk', '#33702a'), ('vine', '#8a6a3c'), ('eye', '#1a1418'), ('white', '#ffffff')])
BC = Vector((0, 0, 0.62))
spots = [Vector(v).normalized() for v in ((0.6, 0.4, -0.3), (-0.6, 0.4, -0.3), (0.2, 0.9, -0.1), (-0.3, 0.8, -0.5), (0.85, 0.0, -0.4), (-0.85, 0.1, -0.4))]
def col(c, n, p):
    if any(n.dot(d) > 0.96 for d in spots): return 'spot'
    return 'yellow_dk' if n.z < -0.7 else ('green' if c.z > BC.z + 0.25 else 'yellow')
# pitcher tilted back so the mouth faces up-forward
body = blob('vb_body', BC, (0.44, 0.42, 0.6), col, lambda c: lerp_w('spine', 'head', (c.z - 0.4) / 0.6), seg=40, rings=24, rot=(40, 0, 0),
            fn=lambda v: Vector((v.x * (1.0 - 0.3 * max(0, v.z)), v.y * (1.0 - 0.3 * max(0, v.z)), v.z)))
RT = Matrix.Rotation(math.radians(40), 3, 'X')
MC = BC + RT @ Vector((0, 0, 0.5))
tube('vb_lip', [MC + RT @ Vector((math.cos(a) * 0.36, math.sin(a) * 0.33, 0)) for a in [2 * math.pi * k / 32 for k in range(33)]], 0.05, 'lip', 'head', seg=10)
blob('vb_mouth', MC + RT @ Vector((0, 0, -0.02)), (0.34, 0.31, 0.07), 'mouth', 'head', seg=24, rings=10, rot=(40, 0, 0))
for s in (1, -1):
    blob(f'vb_tooth{s}', MC + RT @ Vector((s * 0.12, -0.24, -0.02)), (0.03, 0.02, 0.05), 'teeth', 'head', seg=8, rings=6, rot=(40, 0, 0))
for s, nm in ((1, 'l'), (-1, 'r')):
    e, loc, n = decal(f'vb_eye_{nm}', body, BC + Vector((0, 0, -0.02)), (s * 0.45, -1, -0.1), (0.06, 0.02, 0.05), 'white', 'head', sink=0.2)
    decal(f'vb_pupil_{nm}', e, loc + Vector((s * -0.015, 0, -0.01)), n, (0.024, 0.008, 0.026), 'eye', 'head', sink=0.05, seg=10, rings=6)
    # two big leaves fanning from top rim, sideways
    a = MC + RT @ Vector((s * 0.22, 0.12, -0.02))
    pts = [a, a + Vector((s * 0.12, 0.05, 0.08)), a + Vector((s * 0.3, 0.08, 0.1)), a + Vector((s * 0.48, 0.08, 0.04)), a + Vector((s * 0.58, 0.06, -0.04))]
    tube(f'vb_leaf_{nm}', pts, [0.02, 0.13, 0.15, 0.1, 0.01], lambda c, n_, p_: 'leaf' if n_.z > -0.2 else 'leaf_dk', lambda c, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (abs(c.x) - 0.2) / 0.5), seg=12, flat=0.13)
# vine: from back top, arcs up and back, ends in a curled leaf bud
v0 = MC + RT @ Vector((0, 0.3, -0.05))
VP = [v0, v0 + Vector((0, 0.15, 0.25)), v0 + Vector((0, 0.4, 0.38)), v0 + Vector((0, 0.65, 0.35)), v0 + Vector((0, 0.8, 0.22))]
tube('vb_vine', VP, [0.025, 0.022, 0.02, 0.018, 0.016], 'vine', lambda c: lerp_w('tail1', 'tail2', (c.y - v0.y) / 0.8), seg=10)
blob('vb_bud', VP[-1] + Vector((0, 0.03, -0.06)), (0.05, 0.05, 0.1), 'leaf', 'tail2', seg=16, rings=10, rot=(20, 0, 0))
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.3), 'root'), ('spine', (0, 0, 0.6), 'hips'), ('head', tuple(BC + RT @ Vector((0, 0, 0.35))), 'spine'),
         ('tail1', tuple(v0), 'head'), ('tail2', tuple(VP[2]), 'tail1')]
for s, nm in ((1, 'l'), (-1, 'r')): bones += [(f'arm_{nm}', tuple(MC + RT @ Vector((s * 0.22, 0.12, 0))), 'head'), (f'hand_{nm}', tuple(MC + RT @ Vector((s * 0.5, 0.2, 0.1))), f'arm_{nm}')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(MC + Vector((0, -0.05, 0.05))), 'head'), ('socket_fx', (0, 0, 1.8), 'head')])
plan_clips(rig, 'rigid', size=1.7, over={'idle': {'arm_l': swing(6, 60, 0, 4, 1), 'arm_r': swing(-6, 60, 0, 4, 1), 'tail1': swing(8, 60, 0.2, 4, 0), 'tail2': swing(14, 60, 0.4, 4, 0)},
    'attack_physical': {'tail1': [(0, {}), (9, {'r': (-30, 0, 0)}), (15, {'r': (50, 0, 0)}), (28, {})], 'tail2': [(0, {}), (9, {'r': (-20, 0, 0)}), (15, {'r': (60, 0, 0)}), (28, {})]}})
sheet('check', 1.7, poses=[('attack_physical', 15, 'side'), ('sleep', 0, 'q34')])
export(71, 'victreebel', 1.7, 'rigid', rig, mesh, shiny={'yellow': '#e8c84a', 'yellow_dk': '#b8962a', 'green': '#c8b040', 'leaf': '#9ad04a'})

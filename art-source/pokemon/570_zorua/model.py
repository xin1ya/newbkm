# Zorua (570) · dark · 0.7 m. Small dark-gray fox kit: big ears with red inner, red eye shadow, spiky black mane tuft with red tips on the head, dark ruff at neck, bushy tail, teal eyes.
reset('570_zorua')
M = pal([('fur', '#5a6070'), ('fur_dk', '#2e323c'), ('fur_lt', '#6a7080'), ('red', '#c8323c'), ('red_dk', '#8e1f28'), ('eye', '#1a1418'), ('iris', '#3fb8b0'), ('white', '#ffffff'),
         ('nose', '#15161a'), ('black', '#1b1d23')])
BC = Vector((0, 0.04, 0.25)); HC = Vector((0, -0.14, 0.4))
body = blob('zor_body', BC, (0.1, 0.17, 0.1), lambda c, n, p: 'fur_lt' if n.z < -0.55 else 'fur', lambda c: seg_w(c, ['chest', 'spine', 'hips']), seg=32, rings=18,
            fn=lambda v: Vector((v.x * (1 - 0.1 * v.y), v.y, v.z * (1 - 0.08 * v.y))))
head = blob('zor_head', HC, (0.1, 0.095, 0.09), lambda c, n, p: 'fur_lt' if (n.y < -0.6 and n.z < -0.1) else 'fur', 'head', seg=32, rings=18)
snout = blob('zor_snout', HC + Vector((0, -0.09, -0.025)), (0.045, 0.06, 0.038), lambda c, n, p: 'fur_lt' if n.z < 0 else 'fur', 'head', seg=20, rings=12, rot=(8, 0, 0))
blob('zor_nose', HC + Vector((0, -0.15, -0.012)), (0.014, 0.011, 0.01), 'nose', 'head', seg=12, rings=8)
for s, nm in ((1, 'l'), (-1, 'r')):
    sh, loc, n = decal(f'zor_shadow_{nm}', head, HC + Vector((0, -0.02, 0.01)), (s * 0.6, -0.75, 0.2), (0.042, 0.014, 0.03), 'red', 'head', sink=0.25, up=(s * -0.5, 0, 1))
    e, l2, n2 = decal(f'zor_eye_{nm}', sh, loc, n, (0.028, 0.01, 0.026), 'eye', 'head', sink=0.05, up=(s * -0.3, 0, 1))
    ir, l3, n3 = decal(f'zor_iris_{nm}', e, l2, n2, (0.018, 0.006, 0.019), 'iris', 'head', sink=0.05, seg=14, rings=8)
    decal(f'zor_pupil_{nm}', ir, l3, n3, (0.008, 0.004, 0.012), 'eye', 'head', sink=0.05, seg=10, rings=6)
    decal(f'zor_shine_{nm}', ir, l3 + Vector((0, 0, 0.008)), n3, (0.006, 0.003, 0.006), 'white', 'head', sink=0.05, seg=10, rings=6)
    # big triangular ears: outer fur, red inner
    base = HC + Vector((s * 0.06, 0.02, 0.07))
    ear = cone(f'zor_ear_{nm}', 0.06, 0.004, 0.17, verts=16, loc=base + Vector((s * 0.02, 0, 0.06))); ear.rotation_euler = (math.radians(-10), math.radians(s * 22), 0)
    deform(ear, lambda v: Vector((v.x, v.y * 0.45, v.z))); smooth(ear)
    colorize(ear, lambda c, n_, p: 'red' if n_.y < -0.5 else 'fur'); reg(ear, f'ear_{nm}')
# spiky head tuft: black spikes with red tips curling forward/over
for k, (x, h, lean) in enumerate(((0, 0.18, -35), (0.04, 0.15, -25), (-0.04, 0.15, -25), (0.0, 0.13, 5))):
    b0 = HC + Vector((x, -0.02 + 0.03 * (k == 3), 0.08))
    pts = [b0 + Vector((x * 0.4 * t, -math.sin(math.radians(lean)) * h * t * 0.8 + 0.02 * t, h * t * math.cos(math.radians(lean)) * 0.9)) for t in [j / 5 for j in range(6)]]
    tube(f'zor_tuft{k}', pts, [0.042 * (1 - 0.85 * j / 5) for j in range(6)], lambda c, n, p, top=pts[-1], base_=pts[0]: 'red' if (c - base_).length > (top - base_).length * 0.7 else 'black',
         lambda c: lerp_w('head', 'extra_tuft', 0.6), seg=8)
# neck ruff: dark fluffy collar (ring of tufts around the neck base)
for k in range(10):
    a = 2 * math.pi * k / 10
    blob(f'zor_ruff{k}', Vector((math.sin(a) * 0.075, -0.11 + math.cos(a) * 0.06, 0.32 - 0.02 * math.cos(a))), (0.035, 0.035, 0.045), 'fur_dk', 'chest', seg=12, rings=8)
tpts = [Vector((0, 0.2, 0.26)), Vector((0, 0.28, 0.32)), Vector((0, 0.34, 0.4)), Vector((0, 0.36, 0.47))]
tube('zor_tail', tpts, [0.035, 0.06, 0.055, 0.02], lambda c, n, p: 'fur_dk' if c.z > 0.44 else 'fur', lambda c: seg_w(c, ['hips', 'tail1', 'tail2', 'tail3']), seg=14)
LEGS = {'arm_l': ((0.055, -0.06, 0.24), (0.055, -0.08, 0.0)), 'arm_r': ((-0.055, -0.06, 0.24), (-0.055, -0.08, 0.0)),
        'thigh_l': ((0.06, 0.13, 0.22), (0.06, 0.14, 0.0)), 'thigh_r': ((-0.06, 0.13, 0.22), (-0.06, 0.14, 0.0))}
for nm, (sh, pw) in LEGS.items():
    leg4(nm[-1], nm.startswith('arm'), sh, pw, 0.035 if nm.startswith('thigh') else 0.026, 0.018, lambda c, n, p: 'black' if c.z < 0.06 else 'fur', paw_col='red')
bones = quad_bones((0, 0.12, 0.25), (0, -0.05, 0.27), (0, -0.1, 0.33), HC, LEGS, tail=tpts[1:],
                   ears=[('ear_l', HC + Vector((0.06, 0.02, 0.08))), ('ear_r', HC + Vector((-0.06, 0.02, 0.08)))], extra=[('extra_tuft', HC + Vector((0, -0.02, 0.1)), 'head')])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -0.17, -0.02))), 'head'), ('socket_fx', tuple(HC + Vector((0, -0.18, 0.02))), 'head')])
plan_clips(rig, 'fox', size=0.7, over={
    'idle': {'extra_tuft': swing(5, 60, 0.3, 4)},
    'idle_alt': (110, {   # playful pounce-crouch and tail swish (mischief)
        'root': [(0, {}), (20, {'l': (0, -0.05, 0), 'r': (8, 0, 0)}), (34, {'l': (0, -0.05, 0), 'r': (8, 0, 0)}), (42, {'l': (0, 0.1, 0.08)}), (50, {}), (110, {})],
        'hips': [(0, {}), (20, {'r': (-15, 0, 0)}), (34, {'r': (-15, 0, 0)}), (42, {}), (110, {})],
        'tail1': [(0, {}), (20, {'r': (0, 30, 0)}), (26, {'r': (0, -30, 0)}), (32, {'r': (0, 30, 0)}), (42, {}), (110, {})],
        'head': [(0, {}), (60, {}), (70, {'r': (0, 0, 20)}), (85, {}), (110, {})]}, True, None),
})
sheet('check', 0.7, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('idle_alt', 25, 'q34')])
export(570, 'zorua', 0.7, 'fox', rig, mesh, shiny={'red': '#8a4cc8', 'red_dk': '#5e2f94', 'iris': '#e0b82a'})

# Shellder (90) · water · 0.3 m. Purple bivalve: two ribbed scalloped shell halves hinged at the back, opening to the front;
# inside a black pearl-like body with big white eyes (tiny black pupils) and a long pink tongue sticking out over the lower shell.
reset('090_shellder')
M = pal([('shell', '#7a5aa8'), ('shell_lt', '#9c7cc8'), ('shell_dk', '#5a3e82'), ('rib', '#8e6cbc'), ('inner', '#c8b8e0'),
         ('core', '#1c1622'), ('eyew', '#f8f8ff'), ('pupil', '#121014'), ('tongue', '#f07a9a'), ('tongue_dk', '#c85274')])
C = Vector((0, 0, 0.15))
HINGE = C + Vector((0, 0.17, 0))
OPEN = 14   # degrees each half opens from the hinge

def half(name, up, bone):
    """One shell half: flattened dome, scalloped rim, radial ribs. up=+1 top, -1 bottom."""
    def fn(v):
        # dome only on its side, thin lip on the other
        zz = v.z * up
        zz = zz if zz > 0 else zz * 0.12
        # scalloped rim: waves along the outline
        ang = math.atan2(v.x, -v.y)
        sc = 1 + 0.05 * max(0.0, math.cos(ang * 6)) * (1 - abs(v.z))
        return Vector((v.x * sc, v.y * sc, zz * up))
    o = blob(name, C, (0.17, 0.21, 0.1), lambda c, n, p: ('inner' if n.z * up < -0.3 else ('shell_lt' if n.z * up > 0.75 else 'shell')),
             bone, seg=40, rings=22, fn=fn)
    # radial ribs over the dome, fanning from the hinge
    for k in range(6):
        a = math.radians(-75 + 150 * k / 5)
        pts = []
        for t in (0.0, 0.25, 0.5, 0.75, 1.0):
            # run from the hinge (back) to the front rim, fanning out by angle a
            fx = math.sin(a) * math.sin(t * math.pi * 0.5) * 0.95
            fy = 0.9 - 1.85 * t
            d = Vector((fx, fy, up * max(0.05, 0.75 - 0.6 * abs(fy) - 0.5 * abs(fx)))).normalized()
            l, nn = shoot(o, C, d, fallback=True); pts.append(l + nn * 0.004)
        tube(f'{name}_rib{k}', pts, [0.01, 0.02, 0.024, 0.02, 0.01], 'rib', bone, seg=8)
    return o

top = half('sh_top', 1, 'shell_top')
bot = half('sh_bot', -1, 'shell_bot')
# pivot both halves open around the hinge line (X axis through HINGE)
def pivot(objs, deg):
    R_ = Matrix.Translation(HINGE) @ Matrix.Rotation(math.radians(deg), 4, 'X') @ Matrix.Translation(-HINGE)
    for o in objs: o.matrix_world = R_ @ o.matrix_world
bpy.context.view_layer.update()
pivot([o for o in bpy.data.objects if o.name.startswith('sh_top')], -OPEN)
pivot([o for o in bpy.data.objects if o.name.startswith('sh_bot')], OPEN * 0.55)
# hinge knob at the back
blob('sh_hinge', HINGE + Vector((0, 0.03, 0)), (0.06, 0.04, 0.04), 'shell_dk', 'spine', seg=16, rings=8)
# fluted fan at the hinge (the reference's flared 'tail' of the shell)
for k in range(5):
    a = math.radians(-40 + 20 * k)
    b0 = HINGE + Vector((math.sin(a) * 0.03, 0.04, 0))
    tube(f'sh_fan{k}', [b0, b0 + Vector((math.sin(a) * 0.06, 0.07, 0)), b0 + Vector((math.sin(a) * 0.11, 0.12, 0))], [0.025, 0.03, 0.034], 'shell', 'spine', seg=8, flat=0.5)
# horn spikes: one pair on each half, flaring outward
def horn(name, base, d, bone):
    o = cone(name, 0.022, 0.002, 0.09, verts=10, loc=base + d * 0.04)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, 'shell_lt'); reg(o, bone)
bpy.context.view_layer.update()
for s in (1, -1):
    horn(f'sh_horn_t{s + 1}', C + Vector((s * 0.16, 0.0, 0.07)), Vector((s * 0.8, 0.0, 0.6)).normalized(), 'shell_top')
    horn(f'sh_horn_b{s + 1}', C + Vector((s * 0.15, 0.04, -0.08)), Vector((s * 0.75, 0.15, -0.65)).normalized(), 'shell_bot')
# pearl body inside
core = blob('sh_core', C + Vector((0, -0.04, 0.0)), (0.11, 0.1, 0.075), 'core', 'spine', seg=32, rings=16)
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'sh_eye_{nm}', core, C + Vector((0, 0, 0.02)), (s * 0.45, -1, 0.15), (0.045, 0.014, 0.042), 'eyew', 'spine', sink=0.25, seg=20)
    decal(f'sh_pupil_{nm}', e, l + Vector((-s * 0.008, -0.001, -0.002)), n, (0.012, 0.005, 0.012), 'pupil', 'spine', sink=0.0, seg=10, rings=6)
# tongue: wide, droops out over the lower shell
TP = [C + Vector((0, -0.1, -0.03)), C + Vector((0, -0.2, -0.04)), C + Vector((0, -0.3, -0.05)), C + Vector((0, -0.37, -0.055))]
tube('sh_tongue', TP, [0.012, 0.015, 0.016, 0.013], lambda c, n, p: 'tongue' if n.z > -0.2 else 'tongue_dk', lambda c: lerp_w('tongue1', 'tongue2', (C.y - 0.1 - c.y) / 0.2), seg=16, flat=3.6)   # wide flat tongue
bones = [('root', (0, 0, 0), None), ('hips', tuple(C), 'root'), ('spine', tuple(C + Vector((0, 0, 0.01))), 'hips'),
         ('shell_top', tuple(HINGE), 'spine'), ('shell_bot', tuple(HINGE - Vector((0, 0, 0.001))), 'spine'),
         ('tongue1', tuple(TP[0]), 'spine'), ('tongue2', tuple(TP[2]), 'tongue1')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(C + Vector((0, -0.12, 0))), 'spine'), ('socket_fx', tuple(C + Vector((0, -0.16, 0.02))), 'spine')])
clap = lambda L, a: {'shell_top': loop([(0, {}), (L // 2, {'r': (a, 0, 0)})], L), 'shell_bot': loop([(0, {}), (L // 2, {'r': (-a * 0.5, 0, 0)})], L),
                     'tongue1': swing(8, L, 0.2, 4), 'tongue2': swing(12, L, 0.35, 4)}
plan_clips(rig, 'rigid', size=0.3, over={'idle': clap(60, 6), 'walk': clap(24, 14), 'run': clap(16, 20), 'sleep': {'shell_top': hold({'r': (-OPEN * 0.8, 0, 0)}, 90), 'shell_bot': hold({'r': (OPEN * 0.45, 0, 0)}, 90)},
                                         'attack_physical': {'shell_top': [(0, {}), (8, {'r': (12, 0, 0)}), (15, {'r': (-OPEN * 0.9, 0, 0)}), (22, {}), (28, {})],
                                                             'shell_bot': [(0, {}), (8, {'r': (-8, 0, 0)}), (15, {'r': (OPEN * 0.5, 0, 0)}), (22, {}), (28, {})]},   # Clamp
                                         'attack_special': {'tongue1': [(0, {}), (12, {'r': (-25, 0, 0)}), (22, {'r': (10, 0, 0)}), (40, {})]}})
sheet('check', 0.32, poses=[('idle', 15, 'front'), ('walk', 6, 'side'), ('attack_physical', 15, 'q34'), ('sleep', 0, 'q34')])
export(90, 'shellder', 0.3, 'rigid', rig, mesh, shiny={'shell': '#c87a3a', 'shell_lt': '#e09a5a', 'shell_dk': '#9a5626', 'rib': '#d88a48'})

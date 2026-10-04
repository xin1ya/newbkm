# Cloyster (91) · water/ice · 1.5 m. Evolution of Shellder — geometry matched to the reference silhouette (art-source/reference, comparison only):
# a big upright bivalve: two lavender-grey shell halves hinged at the back and parted into a vertical slit at the front, the outside
# lumpy with rounded knobs and short spikes, four large spikes flaring diagonally from the corners, a fluted fan-tail at the hinge;
# inside the dark grey-black pearl body with a sharp pale horn on top, white eyes with small pupils and a toothy grin.
reset('091_cloyster')
M = pal([('shell', '#8a82a8'), ('shell_lt', '#a8a0c4'), ('shell_dk', '#5e5680'), ('inner', '#c4c0d8'), ('core', '#2a2632'), ('horn', '#c8ccd8'),
         ('eyew', '#f4f4fa'), ('pupil', '#121014'), ('mouth', '#5a2a3a'), ('teeth', '#f4f4fa')])
C = Vector((0, 0.04, 0.76)); HINGE = C + Vector((0, 0.42, 0))
OPEN = 17
def half(name, sx, bone):
    def fn(v):
        xx = v.x * sx
        xx = xx if xx > 0 else xx * 0.1   # dome on its side, thin lip on the inner side
        sc = 1 + 0.04 * math.cos(math.atan2(v.z, -v.y) * 7)
        return Vector((xx * sx, v.y * sc, v.z * sc))
    o = blob(name, C, (0.4, 0.44, 0.62), lambda c, n, p: ('inner' if n.x * sx < -0.4 else ('shell_lt' if n.x * sx > 0.8 else 'shell')), bone, seg=44, rings=28, fn=fn)
    return o
SL = half('clo_shell_l', 1, 'shell_l'); SR = half('clo_shell_r', -1, 'shell_r')
bpy.context.view_layer.update()
for o, sx in ((SL, 1), (SR, -1)):
    o.matrix_world = Matrix.Translation(HINGE) @ Matrix.Rotation(math.radians(sx * OPEN), 4, 'Z') @ Matrix.Translation(-HINGE) @ o.matrix_world
bpy.context.view_layer.update()
import random; rnd = random.Random(91)
def spike(name, base, d, r, length, bone, col='shell_lt'):
    o = cone(name, r, 0.003, length, verts=10, loc=base + d * length * 0.45)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    colorize(o, col); reg(o, bone); return o
for o, sx, nm in ((SL, 1, 'l'), (SR, -1, 'r')):
    # four big corner spikes (2 per half), flaring diagonally up/down and out
    for j, dz in enumerate((1, -1)):
        d = Vector((sx * 0.65, -0.2, dz * 0.75)).normalized()
        l, nn = shoot(o, C + Vector((sx * 0.08, 0, 0)), Vector((sx * 0.7, -0.2, dz * 0.7)).normalized(), fallback=True)
        spike(f'clo_big{j}_{nm}', l - nn * 0.04, d, 0.09, 0.52, f'shell_{nm}')
    # knobs + small spikes over the dome
    for k in range(14):
        a = rnd.uniform(-1.3, 1.3); e = rnd.uniform(-0.8, 0.8)
        dd = Vector((sx * math.cos(e) * math.cos(a) * 0.9 + sx * 0.1, math.sin(a) * math.cos(e), math.sin(e))).normalized()
        l, nn = shoot(o, C + Vector((sx * 0.08, 0, 0)), dd, fallback=True)
        if k % 3 == 0: spike(f'clo_sp{k}_{nm}', l - nn * 0.02, nn, 0.035, 0.12, f'shell_{nm}')
        else: blob(f'clo_knob{k}_{nm}', l, (0.05, 0.05, 0.05), 'shell', f'shell_{nm}', seg=12, rings=8)
    spike(f'clo_side_{nm}', C + Vector((sx * 0.38, 0.0, 0.0)), Vector((sx, 0.05, 0)).normalized(), 0.05, 0.2, f'shell_{nm}')
# fluted fan-tail at the hinge
for k in range(7):
    a = math.radians(-45 + 15 * k)
    b0 = HINGE + Vector((0, -0.02, math.sin(a) * 0.1))
    tube(f'clo_fan{k}', [b0, b0 + Vector((0, 0.14, math.sin(a) * 0.15)), b0 + Vector((0, 0.3, math.sin(a) * 0.4))], [0.07, 0.08, 0.09], 'shell_dk' if k % 2 else 'shell', 'spine', seg=10, flat=0.45)
# pearl body peeking out of the slit
PC = C + Vector((0, -0.2, 0.05))
core = blob('clo_core', PC, (0.22, 0.24, 0.32), 'core', 'head', seg=32, rings=20)
hn = cone('clo_horn', 0.07, 0.003, 0.38, verts=12, loc=PC + Vector((0, -0.02, 0.42))); colorize(hn, 'horn'); reg(hn, 'head')
for s, nm in ((1, 'l'), (-1, 'r')):
    e, l, n = decal(f'clo_eye_{nm}', core, PC + Vector((0, 0, 0.08)), (s * 0.3, -1, 0.15), (0.065, 0.012, 0.055), 'eyew', 'head', sink=0.25, up=(s * -0.3, 0, 1))
    decal(f'clo_pupil_{nm}', e, l + Vector((-s * 0.01, 0, 0)), n, (0.012, 0.004, 0.014), 'pupil', 'head', sink=0.0, seg=8, rings=5)
m, ml, mn = decal('clo_mouth', core, PC + Vector((0, 0, -0.06)), (0, -1, -0.1), (0.1, 0.012, 0.04), 'mouth', 'head', sink=0.25)
decal('clo_teeth', m, ml + Vector((0, 0, 0.01)), mn, (0.085, 0.008, 0.016), 'teeth', 'head', sink=0.0)
bones = [('root', (0, 0, 0), None), ('spine', tuple(C), 'root'), ('head', tuple(PC), 'spine'), ('shell_l', tuple(HINGE + Vector((0.1, 0, 0))), 'spine'), ('shell_r', tuple(HINGE + Vector((-0.1, 0, 0))), 'spine')]
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(PC + Vector((0, -0.25, -0.05))), 'head'), ('socket_fx', tuple(PC + Vector((0, -0.3, 0.1))), 'head')])
plan_clips(rig, 'rigid', size=1.2, over={
    'idle': {'shell_l': swing(3, 80, 0.0, 4, 2), 'shell_r': swing(3, 80, 0.5, 4, 2), 'head': swing(4, 80, 0.25, 4, 0)},
    'attack_physical': {'shell_l': [(0, {}), (8, {'r': (0, 0, -6)}), (14, {'r': (0, 0, 14)}), (28, {})], 'shell_r': [(0, {}), (8, {'r': (0, 0, 6)}), (14, {'r': (0, 0, -14)}), (28, {})]},   # Clamp
    'attack_special': {'shell_l': [(0, {}), (12, {'r': (0, 0, 12)}), (30, {'r': (0, 0, 12)}), (40, {})], 'shell_r': [(0, {}), (12, {'r': (0, 0, -12)}), (30, {'r': (0, 0, -12)}), (40, {})]},   # Icicle Spear
})
sheet('check', 1.6, poses=[('idle', 0, 'front'), ('idle', 0, 'side'), ('attack_special', 14, 'q34'), ('attack_physical', 14, 'q34')])
export(91, 'cloyster', 1.5, 'rigid', rig, mesh, shiny={'shell': '#c0c0d0', 'shell_lt': '#dcdce8', 'shell_dk': '#8a8aa0'})

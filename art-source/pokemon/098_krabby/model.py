# Krabby (98) · water · 0.4 m. Low wide shell (red-orange top, cream belly), two big pincers, stalk eyes, 6 legs, side-scuttle.
reset('098_krabby')
M = pal([('shell', '#e0552f'), ('shell_dk', '#b83e1f'), ('cream', '#f4dfb0'), ('cream_dk', '#dcc08a'), ('eye', '#1a1418'), ('white', '#ffffff'),
         ('mouth', '#7a2a22'), ('spike', '#f6e7c8'), ('bubble', '#bfe6ff')])
Z = 0.19
def fshell(v):
    x, y, z = v.x, v.y, v.z
    top = z > 0
    return Vector((x * (1 - 0.1 * abs(y)), y, z * (0.9 if top else 0.6) + 0.12 * (1 - x * x) * (1 if top else 0) - 0.05 * y * y))
shell = blob('krb_shell', (0, 0, Z), (0.2, 0.15, 0.1), lambda c, n, p: ('shell' if (c.z > Z + 0.01 and n.z > -0.1) else 'cream'), 'spine', seg=40, rings=22, fn=fshell)
# two spikes on the shell top
for s in (1, -1):
    k = cone(f'krb_spike_{"l" if s > 0 else "r"}', 0.02, 0.001, 0.05, verts=10, loc=(s * 0.1, 0.02, Z + 0.13)); k.rotation_euler = (0, math.radians(s * 25), 0); colorize(k, 'spike'); reg(k, 'spine')
# mouth
decal('krb_mouth', shell, (0, 0, Z - 0.02), (0, -1, -0.3), (0.05, 0.015, 0.02), 'mouth', 'spine', sink=0.3)
# stalk eyes
for s, nm in ((1, 'l'), (-1, 'r')):
    base = Vector((s * 0.05, -0.08, Z + 0.1))
    tube(f'krb_stalk_{nm}', [base, base + Vector((s * 0.01, -0.01, 0.05))], [0.012, 0.011], 'cream', f'eye_{nm}', seg=10)
    eb = blob(f'krb_eyeball_{nm}', base + Vector((s * 0.012, -0.012, 0.07)), (0.03, 0.028, 0.03), 'eye', f'eye_{nm}', seg=16, rings=10)
    decal(f'krb_shine_{nm}', eb, base + Vector((s * 0.012, -0.012, 0.07)), (s * 0.3, -1, 0.6), (0.01, 0.004, 0.01), 'white', f'eye_{nm}', sink=0.1, seg=10, rings=6)
# pincers: upper arm -> forearm -> big claw (fixed top blade + moving lower blade)
for s, nm in ((1, 'l'), (-1, 'r')):
    a0 = Vector((s * 0.17, -0.05, Z)); a1 = Vector((s * 0.26, -0.12, Z + 0.06)); c0 = a1 + Vector((s * 0.02, -0.07, 0.04))
    tube(f'krb_arm_{nm}', [a0, (a0 + a1) / 2 + Vector((0, 0, 0.02)), a1], [0.03, 0.035, 0.035], 'shell', lambda c, s=s, nm=nm: lerp_w(f'arm_{nm}', f'hand_{nm}', (abs(c.x) - 0.17) / 0.09), seg=12)
    blob(f'krb_palm_{nm}', c0, (0.075, 0.1, 0.065), lambda c, n, p: 'shell' if n.z > -0.3 else 'cream', f'hand_{nm}', seg=24, rings=14, rot=(10, 0, s * -15))
    top = blob(f'krb_finger_{nm}', c0 + Vector((s * -0.01, -0.12, 0.03)), (0.04, 0.08, 0.03), 'shell', f'hand_{nm}', seg=16, rings=10, rot=(-12, 0, s * -15))
    blob(f'krb_thumb_{nm}', c0 + Vector((s * -0.005, -0.1, -0.04)), (0.035, 0.07, 0.025), 'cream', f'claw_{nm}', seg=16, rings=10, rot=(15, 0, s * -15))
    for k in range(3):   # little teeth on the blades
        t = cone(f'krb_tooth_{nm}{k}', 0.008, 0.001, 0.015, verts=6, loc=c0 + Vector((s * -0.01, -0.07 - 0.03 * k, 0.005))); t.rotation_euler = (math.radians(180), 0, 0); colorize(t, 'spike'); reg(t, f'hand_{nm}')
    # legs: three per side, jointed, pointing out and down
    for k in range(3):
        y = -0.01 + 0.06 * k; spread = (k - 0.6) * 0.06
        h0 = Vector((s * 0.15, y, Z - 0.04)); kn = Vector((s * 0.27, y + spread, Z + 0.05)); ft = Vector((s * 0.36, y + spread * 1.8, 0.004))
        tube(f'krb_leg{k}_{nm}', [h0, (h0 + kn) / 2 + Vector((0, 0, 0.02)), kn, ft], [0.024, 0.022, 0.018, 0.008], lambda c, n_, p: 'cream' if c.z < 0.06 else 'shell', f'leg{k + 1}_{nm}', seg=10)
bones = [('root', (0, 0, 0), None), ('hips', (0, 0, Z), 'root'), ('spine', (0, 0, Z), 'hips'), ('chest', (0, -0.05, Z), 'spine'), ('head', (0, -0.08, Z + 0.1), 'chest')]
for s, nm in ((1, 'l'), (-1, 'r')):
    bones += [(f'eye_{nm}', (s * 0.05, -0.08, Z + 0.1), 'head'), (f'arm_{nm}', (s * 0.17, -0.05, Z), 'chest'), (f'hand_{nm}', (s * 0.27, -0.14, Z + 0.07), f'arm_{nm}'),
              (f'claw_{nm}', (s * 0.27, -0.17, Z + 0.06), f'hand_{nm}')]
    for k in range(3): bones.append((f'leg{k + 1}_{nm}', (s * 0.16, 0.055 * k, Z - 0.03), 'hips'))
rig, mesh = make_rig(bones, sockets=[('socket_mouth', (0, -0.16, Z - 0.02), 'chest'), ('socket_fx', (0, -0.2, Z), 'chest')])

H = 0.4
def legs(L, amp, phase0=0.0):
    out = {}
    for k in range(3):
        for s, nm in ((1, 'l'), (-1, 'r')):
            ph = phase0 + (0.5 if (k + (nm == 'r')) % 2 else 0)
            out[f'leg{k + 1}_{nm}'] = [(f, {'r': (0, 0, s * amp * max(0, math.sin(2 * math.pi * (f / L + ph))))}) for f in range(0, L + 1, max(1, L // 8))]
    return out
snap = lambda f0, nm: [(0, {}), (f0, {'r': (-35, 0, 0)}), (f0 + 3, {}), (f0 + 6, {'r': (-35, 0, 0)}), (f0 + 9, {})]
plan_clips(rig, 'rigid', size=H, over={
    'idle': (60, merge({'root': bob(0.006, 60, 0, 4), 'arm_l': swing(4, 60, 0, 4, 2), 'arm_r': swing(-4, 60, 0, 4, 2), 'eye_l': swing(6, 60, 0.1, 4, 2), 'eye_r': swing(-6, 60, 0.3, 4, 2)}), True, None),
    'idle_alt': (90, {'claw_l': snap(20, 'l') + [(90, {})], 'claw_r': snap(40, 'r') + [(90, {})], 'hand_l': [(0, {}), (18, {'r': (-20, 0, 0)}), (32, {}), (90, {})],
                      'hand_r': [(0, {}), (38, {'r': (-20, 0, 0)}), (52, {}), (90, {})], 'eye_l': [(0, {}), (60, {'r': (0, 0, 20)}), (75, {}), (90, {})]}, True, None),
    'walk': (24, merge({'root': [(0, {}), (12, {'l': (0.03, 0.01, 0)}), (24, {})], 'spine': swing(4, 24, 0, 4, 2)}, legs(24, 25)), True, None),
    'run': (14, merge({'root': merge_keys(bob(0.012, 14, 0, 4), swing(6, 14, 0, 4, 2))}, legs(14, 35)), True, None),
    'attack_physical': (30, {   # Vice Grip: raise both claws, lunge, clamp shut on hit frame
        'root': [(0, {}), (10, {'l': (0, 0.02, -0.03)}), (16, {'l': (0, 0.03, 0.18)}), (24, {'l': (0, 0, 0.05)}), (30, {})],
        'arm_l': [(0, {}), (10, {'r': (-40, 0, 20)}), (16, {'r': (10, 0, 0)}), (30, {})], 'arm_r': [(0, {}), (10, {'r': (-40, 0, -20)}), (16, {'r': (10, 0, 0)}), (30, {})],
        'claw_l': [(0, {}), (10, {'r': (40, 0, 0)}), (16, {'r': (-5, 0, 0)}), (30, {})], 'claw_r': [(0, {}), (10, {'r': (40, 0, 0)}), (16, {'r': (-5, 0, 0)}), (30, {})]}, False, 16),
    'attack_special': (40, {    # Bubble: claws up, blow bubbles from the mouth
        'root': [(0, {}), (12, {'r': (-10, 0, 0)}), (20, {'r': (5, 0, 0)}), (26, {'r': (-4, 0, 0)}), (32, {'r': (5, 0, 0)}), (40, {})],
        'arm_l': [(0, {}), (12, {'r': (-50, 0, 30)}), (32, {'r': (-50, 0, 30)}), (40, {})], 'arm_r': [(0, {}), (12, {'r': (-50, 0, -30)}), (32, {'r': (-50, 0, -30)}), (40, {})],
        'claw_l': snap(14, 'l') + [(40, {})], 'claw_r': snap(14, 'r') + [(40, {})]}, False, 20),
    'sleep': (90, {'root': loop([(0, {'l': (0, -0.06, 0)}), (45, {'l': (0, -0.058, 0)})], 90), 'arm_l': hold({'r': (20, 0, -20)}, 90), 'arm_r': hold({'r': (20, 0, 20)}, 90),
                   'eye_l': hold({'r': (60, 0, 0), 's': (1, 0.6, 1)}, 90), 'eye_r': hold({'r': (60, 0, 0), 's': (1, 0.6, 1)}, 90),
                   **{f'leg{k + 1}_{nm}': hold({'r': (0, 0, (1 if nm == 'l' else -1) * 35)}, 90) for k in range(3) for nm in 'lr'}}, True, None),
})
sheet('check', 0.62, poses=[('walk', 6, 'front'), ('attack_physical', 10, 'q34'), ('attack_special', 20, 'q34'), ('faint', 36, 'q34')])
export(98, 'krabby', 0.4, 'crab', rig, mesh, shiny={'shell': '#e8b13a', 'shell_dk': '#c18a22'})

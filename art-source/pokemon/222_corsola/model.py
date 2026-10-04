# Corsola (222) · water/rock · 0.6 m. Round pink coral body with a cream underside, four stubby cream legs,
# a crown of thick branching coral horns (pink with white tips) on its back/head, small black eyes and a little smile.
reset('222_corsola')
M = pal([('pink', '#d47a8a'), ('pink_lt', '#e894a2'), ('pink_dk', '#b05a6c'), ('cream', '#d8e6ee'), ('tip', '#d47a8a'),
         ('eye', '#1a1418'), ('white', '#ffffff'), ('mouth', '#8a2a3e'), ('leg', '#dde8ee')])
BC = Vector((0, 0.0, 0.18)); R_ = 0.17
W = lambda c: seg_w(c, ['chest', 'spine', 'hips'])
body = blob('cor_body', BC, (R_, R_ * 1.18, R_ * 0.95), lambda c, n, p: 'cream' if (n.z < -0.5 or (n.z < -0.2 and math.sin(n.x * 9) * math.sin(n.y * 7) > 0.25)) else ('pink_lt' if n.z > 0.7 else 'pink'), W, seg=40, rings=22)
for s, nm in ((1, 'l'), (-1, 'r')):
    eye(nm, body, BC + Vector((0, 0, 0.02)), (s * 0.38, -1, 0.15), 0.026, 0.03, 'head')
decal('cor_mouth', body, BC, (0, -1, -0.12), (0.03, 0.006, 0.012), 'mouth', 'head', sink=0.3)
# coral horns: thick tapered branches with sub-branches, white tips
BR = []
def branch(name, base, pts_rel, radii, bone, subs=()):
    pts = [base + Vector(p) for p in pts_rel]
    tube(name, pts, radii, lambda c, n, p, top=pts[-1]: 'tip' if (c - top).length < radii[-2] * 1.6 else 'pink', bone, seg=12)
    blob(name + '_tipb', pts[-1], (radii[-2],) * 3, 'tip', bone, seg=12, rings=8)
    for k, (t, d, L, r) in enumerate(subs):
        p0 = pts[t]; d = Vector(d).normalized()
        sp = [p0, p0 + d * L * 0.6, p0 + d * L]
        tube(f'{name}_s{k}', sp, [r, r * 0.85, r * 0.75], lambda c, n, p, top=sp[-1], r=r: 'tip' if (c - top).length < r * 1.3 else 'pink', bone, seg=10)
        blob(f'{name}_s{k}_tipb', sp[-1], (r * 0.75,) * 3, 'tip', bone, seg=10, rings=6)
for s, nm in ((1, 'l'), (-1, 'r')):
    base = BC + Vector((s * 0.06, -0.04, 0.14)); bn = f'extra_horn_{nm}'; BR.append((bn, base))
    branch(f'cor_horn_{nm}', base, [(0, 0, 0), (s * 0.03, 0.0, 0.09), (s * 0.06, 0.01, 0.17), (s * 0.08, 0.02, 0.24)], [0.04, 0.036, 0.032, 0.028], bn,
           subs=[(1, (s * 1, 0.1, 0.35), 0.08, 0.026), (2, (s * 1, 0, 0.6), 0.06, 0.022)])
    # side branches: straight out from the flanks, forked
    base = BC + Vector((s * 0.11, -0.11, 0.05)); bn = f'extra_side_{nm}'; BR.append((bn, base))
    branch(f'cor_side_{nm}', base, [(0, 0, 0), (s * 0.05, -0.05, 0.03), (s * 0.09, -0.09, 0.07)], [0.035, 0.03, 0.026], bn, subs=[(1, (s * 0.3, -0.3, 1), 0.06, 0.022)])
    # rear branches pointing back and down
    base = BC + Vector((s * 0.11, 0.12, 0.04)); bn = f'extra_rear_{nm}'; BR.append((bn, base))
    branch(f'cor_rear_{nm}', base, [(0, 0, 0), (s * 0.05, 0.06, 0.04), (s * 0.1, 0.11, 0.09)], [0.032, 0.028, 0.024], bn)
# smaller back branches
for k, (x, y, h, lean) in enumerate(((0, 0.12, 0.1, 0.0), (0.1, 0.1, 0.08, 1.0), (-0.1, 0.1, 0.08, -1.0))):
    base = BC + Vector((x, y, 0.09)); bn = f'extra_back{k}'; BR.append((bn, base))
    branch(f'cor_back{k}', base, [(0, 0, 0), (lean * 0.04, 0.06, h * 0.6), (lean * 0.08, 0.11, h)], [0.032, 0.028, 0.024], bn)
# stubby legs
LEGS = {'arm_l': ((0.09, -0.08, 0.1), (0.1, -0.09, 0.0)), 'arm_r': ((-0.09, -0.08, 0.1), (-0.1, -0.09, 0.0)),
        'thigh_l': ((0.09, 0.08, 0.1), (0.1, 0.09, 0.0)), 'thigh_r': ((-0.09, 0.08, 0.1), (-0.1, 0.09, 0.0))}
for nm, (sh, pw) in LEGS.items():
    leg4(nm[-1], nm.startswith('arm'), sh, pw, 0.045, 0.04, 'leg', paw_col='leg')
bones = quad_bones((0, 0.06, 0.2), (0, -0.06, 0.2), (0, -0.08, 0.24), BC + Vector((0, -0.05, 0.08)), LEGS,
                   extra=[(bn, p, 'chest') for bn, p in BR])
rig, mesh = make_rig(bones, sockets=[('socket_mouth', tuple(BC + Vector((0, -0.18, -0.02))), 'head'), ('socket_fx', tuple(BC + Vector((0, 0, 0.36))), 'chest')])
sway = lambda L, a: {bn: swing(a, L, 0.15 * i, 4, 1) for i, (bn, _) in enumerate(BR)}
plan_clips(rig, 'quadruped', size=0.4, over={'idle': sway(60, 3), 'walk': sway(28, 5), 'run': sway(16, 8),
                                            'attack_special': merge(sway(40, 10), {'chest': [(0, {}), (12, {'r': (-10, 0, 0)}), (22, {'r': (8, 0, 0)}), (40, {})]})})
sheet('check', 0.6, poses=[('walk', 7, 'side'), ('run', 4, 'side'), ('attack_physical', 15, 'q34'), ('idle', 20, 'front')])
export(222, 'corsola', 0.6, 'quadruped', rig, mesh, shiny={'pink': '#a8a0f0', 'pink_lt': '#c8c0ff', 'pink_dk': '#8078c8'})

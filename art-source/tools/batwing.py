def bat_wing(P, s, nm, root, span, chord, col, col_in, fingers=3, bone=None, zoff=0.0):
    """Spread membrane wing: finger bones (tubes) fanning from root outwards, scalloped membrane between them (flat tubes)."""
    root = Vector(root); bn = bone or f'wing_{nm}'
    tips = []
    for k in range(fingers + 1):
        f = k / fingers
        a = math.radians(30 - 80 * f)
        tips.append(root + Vector((s * span * math.cos(a) * (1 - 0.25 * f), 0.03 * span * f, span * math.sin(a) * 0.8 + zoff)))
    # leading edge arm
    elbow = root + (tips[0] - root) * 0.45 + Vector((0, -0.02 * span, 0.05 * span))
    tube(f'{P}_warm_{nm}', [root, elbow, tips[0]], [chord * 0.06, chord * 0.05, chord * 0.02], col, bn, seg=8)
    for k in range(1, fingers + 1):
        tube(f'{P}_wf{k}_{nm}', [elbow, tips[k]], [chord * 0.035, chord * 0.012], col, bn, seg=6)
    # membrane: one fan surface root -> scalloped trailing edge through finger tips (double-sided, slight thickness)
    edge = [tips[0]]
    for k in range(fingers):
        a, b = tips[k], tips[k + 1]
        for t in (0.25, 0.5, 0.75):
            m = a.lerp(b, t); inward = (root - m).normalized() * (a - b).length * 0.22 * math.sin(math.pi * t)
            edge.append(m + inward)
        edge.append(b)
    edge.append(root + Vector((s * chord * 0.05, 0.03 * span, -0.25 * span)))
    th = Vector((0, chord * 0.008, 0))
    verts = [root - th, elbow - th] + [e - th for e in edge] + [root + th, elbow + th] + [e + th for e in edge]
    n = 2 + len(edge); faces = []
    for k in range(1, n - 1):
        faces.append((0, k, k + 1)); faces.append((n, n + k + 1, n + k))
    me = bpy.data.meshes.new(f'{P}_wm_{nm}'); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    o = new_obj(f'{P}_wm_{nm}', me)
    colorize(o, lambda c_, n_, p_: col if n_.y * -s > 0 else col_in); reg(o, bn)
def bat_flap(L, a, base=0, n=8, bones=('wing_l', 'wing_r')):
    return {b: loop([(round(L * i / n), {'r': (0, sg * (base + a * math.sin(2 * math.pi * i / n)), 0)}) for i in range(n)], L) for b, sg in zip(bones, (-1, 1))}
def bat_clips(rig, size, a=35, extra=None):
    hv = lambda L, a_: merge({'root': bob(0.05 * size, L, 0.25, 4)}, bat_flap(L, a_), extra or {})
    plan_clips(rig, 'rigid', size=size, over={'idle': (24, hv(24, a), True, None), 'idle_alt': (48, hv(48, a * 0.7), True, None), 'walk': (20, hv(20, a * 1.1), True, None),
        'run': (14, merge(hv(14, a * 1.2), {'spine': hold({'r': (18, 0, 0)}, 14)}), True, None), 'fly': (18, hv(18, a * 1.2), True, None),
        'attack_physical': (28, merge(bat_flap(28, a), {'root': [(0, {}), (9, {'l': (0, 0.05 * size, -0.1 * size), 'r': (-15, 0, 0)}), (15, {'l': (0, 0, 0.45 * size), 'r': (20, 0, 0)}), (28, {})]}), False, 15),
        'attack_special': (40, merge(bat_flap(40, a * 1.3), {'root': [(0, {}), (12, {'l': (0, 0.1 * size, 0), 's': (1.1, 1.1, 1.1)}), (22, {}), (40, {})]}), False, 22),
        'sleep': (90, merge(bat_flap(90, 4, base=-40, n=4), {'root': loop([(0, {'l': (0, -0.05 * size, 0)}), (45, {'l': (0, -0.06 * size, 0)})], 90)}), True, None)})

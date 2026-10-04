# ============ kit.py — shared model kit (prepended after common.py by bx.py) ============
# Conventions (same as the starters): model faces -Y, Z up, meters. All bones point world +Z (len 0.03):
#   pose rot X = pitch (+ = nose down / limb swings backward), Y = yaw, Z = roll; pose loc = (x, up, forward).
# A model script: reset(KEY) -> pal(...) -> parts via blob/tube/eye/reg -> make_rig(bones) -> clips(plan, ...) -> export(...)
from mathutils import Quaternion
PARTS = {}      # object name -> weight spec: 'bone' | {bone: w} | callable(world_co) -> {bone: w}
BONES = {}      # bone name -> head position (Vector), filled by make_rig before weighting
KEY = None
MAT = None
COLORS = []

def reset(key):
    global KEY, PARTS, BONES
    KEY = key; PARTS = {}; BONES = {}
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.curves, bpy.data.materials):
        for x in list(coll): coll.remove(x)

def pal(colors, extra_mats=()):
    """colors: [(name, hex)]; extra_mats: [(suffix, {'alpha': a, 'emit': s})] -> copies of the palette material."""
    global MAT, COLORS
    COLORS = list(colors)
    MAT = build_palette(KEY, COLORS)
    MAT['colors'] = json.dumps(COLORS)
    out = {'main': MAT}
    for suf, o in extra_mats:
        m = MAT.copy(); m.name = f'M_{KEY}_{suf}'
        bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        if 'alpha' in o:
            bs.inputs['Alpha'].default_value = o['alpha']
            try: m.surface_render_method = 'BLENDED'
            except Exception: pass
        if 'emit' in o:
            tex = next(n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE')
            m.node_tree.links.new(tex.outputs['Color'], bs.inputs['Emission Color'])
            bs.inputs['Emission Strength'].default_value = o['emit']
        out[suf] = m
    return out

def reg(o, spec):
    PARTS[o.name] = spec; return o

def colorize(o, col, mat=None):
    mat = mat or MAT
    if callable(col): paint(o, mat, col)
    else: paint_all(o, mat, col)
    return o

def blob(name, loc, r, col, bone, seg=24, rings=14, rot=(0, 0, 0), fn=None, mat=None):
    """Ellipsoid with radii r=(x,y,z) at loc; optional fn(local unit-sphere co) -> co deform before scaling."""
    o = sphere(name, radius=1, seg=seg, rings=rings)
    def f(v):
        if fn: v = fn(v)
        return Vector((v.x * r[0], v.y * r[1], v.z * r[2]))
    deform(o, f)
    o.location = loc; o.rotation_euler = tuple(math.radians(a) for a in rot)
    colorize(o, col, mat); return reg(o, bone)

def tube(name, pts, radii, col, bone, seg=12, mat=None, flat=1.0):
    """Tapered closed tube through pts (world) with per-point radii (parallel-transport frames). flat scales the side axis."""
    pts = [Vector(p) for p in pts]; n = len(pts)
    if not isinstance(radii, (list, tuple)): radii = [radii] * n
    me = bpy.data.meshes.new(name); bm = bmesh.new(); rings = []
    tan0 = (pts[1] - pts[0]).normalized()
    ref = Vector((0, 0, 1)) if abs(tan0.z) < 0.9 else Vector((1, 0, 0))
    nrm = tan0.cross(ref).normalized()
    prev_t = tan0
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        q = prev_t.rotation_difference(t); nrm = (q @ nrm).normalized(); prev_t = t
        bn = t.cross(nrm).normalized()
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ring.append(bm.verts.new(p + (nrm * math.cos(a) * flat + bn * math.sin(a)) * radii[i]))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(seg):
            a, b = rings[i][k], rings[i][(k + 1) % seg]; c, d = rings[i + 1][(k + 1) % seg], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    for ring, rev in ((rings[0], True), (rings[-1], False)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / seg)
        for k in range(seg):
            f = (ring[k], ring[(k + 1) % seg], c)
            bm.faces.new(tuple(reversed(f)) if rev else f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = new_obj(name, me); smooth(o)
    colorize(o, col, mat); return reg(o, bone)

def shoot(o, center, direction, fallback=False):
    """Surface point of o along `direction` from inside point `center` (ray from outside back towards center)."""
    bpy.context.view_layer.update()
    d = Vector(direction).normalized(); c = Vector(center)
    mi = o.matrix_world.inverted()
    start = mi @ (c + d * 2.0); dl = (mi.to_3x3() @ -d).normalized()
    ok, loc, n, _ = o.ray_cast(start, dl)
    if not ok and fallback: return c, d
    assert ok, (o.name, tuple(center), tuple(direction))
    nm = o.matrix_world.to_3x3().inverted().transposed()
    return o.matrix_world @ loc, (nm @ n).normalized()

def orient(o, normal, up=(0, 0, 1)):
    """Local Y -> -normal (thin axis into the surface), local Z -> up projected on the tangent plane."""
    n = Vector(normal).normalized(); u = Vector(up)
    u = (u - n * u.dot(n)); u = u.normalized() if u.length > 1e-5 else Vector((0, 0, 1))
    y = -n; x = y.cross(u).normalized(); z = x.cross(y).normalized()
    o.rotation_mode = 'XYZ'
    o.rotation_euler = Matrix((x, y, z)).transposed().to_euler()

def decal(name, surf, center, direction, size, col, bone, sink=0.35, up=(0, 0, 1), seg=20, rings=10, mat=None):
    """Flattened ellipsoid pressed onto `surf` (eyes, spots, markings). size=(w, thick, h)."""
    loc, n = shoot(surf, center, direction, fallback=True)
    o = sphere(name, radius=1, seg=seg, rings=rings, scale=size)
    orient(o, n, up)
    o.location = loc - n * size[1] * sink
    colorize(o, col, mat); return reg(o, bone), loc, n

def eye(side, surf, center, direction, w, h, bone, iris=None, col_eye='eye', col_shine='white', up=(0, 0, 1), shine=True, sink=0.3):
    """Big glossy Pokemon eye: dark oval (+ optional iris ring) + white highlight up-outward."""
    name = f'{KEY}_eye_{side}'
    e, loc, n = decal(name, surf, center, direction, (w, w * 0.35, h), col_eye, bone, sink=sink, up=up)
    if iris:
        decal(f'{KEY}_iris_{side}', e, loc - n * 0.001, n, (w * 0.62, w * 0.2, h * 0.62), iris, bone, sink=0.2, up=up)
    if shine:
        u = Vector(up); u = (u - n * u.dot(n)).normalized(); x = n.cross(u).normalized() * (1 if side == 'l' else -1)
        p = loc + u * h * 0.42 + x * w * 0.25
        decal(f'{KEY}_shine_{side}', e, p - n * 0.001, n, (w * 0.34, w * 0.15, w * 0.34), col_shine, bone, sink=0.1, up=up, seg=12, rings=6)
    return e

def mirror(o, bone_map=None):
    """Mirror a registered part to -X; bone names swap _l/_r (or via bone_map)."""
    nm = o.name[:-2] + '_r' if o.name.endswith('_l') else o.name + '_mr'
    c = mirror_copy(o, nm)
    spec = PARTS.get(o.name)
    def sw(b): return bone_map.get(b, b) if bone_map else (b[:-2] + '_r' if b.endswith('_l') else b)
    if isinstance(spec, str): spec = sw(spec)
    elif isinstance(spec, dict): spec = {sw(k): v for k, v in spec.items()}
    elif callable(spec):
        f = spec; spec = lambda c_, f=f: {sw(k): v for k, v in f(Vector((-c_.x, c_.y, c_.z))).items()}
    return reg(c, spec)

def lerp_w(a, b, t):
    t = min(1, max(0, t)); return {a: 1 - t, b: t}

def near(c, names, k=2, sharp=4.0):
    """Blend weights between the k nearest bone heads (inverse-distance^sharp)."""
    ds = sorted(((max(1e-5, (c - BONES[n]).length), n) for n in names))[:k]
    ws = {n: 1 / d ** sharp for d, n in ds}; s = sum(ws.values())
    return {n: w / s for n, w in ws.items()}

def seg_w(c, chain):
    """Weights along a bone chain [(name, head)...] by projecting onto the polyline (smooth for tails/serpents)."""
    best = None
    for i in range(len(chain) - 1):
        a = BONES[chain[i]]; b = BONES[chain[i + 1]]; ab = b - a
        t = max(0.0, min(1.0, (c - a).dot(ab) / max(1e-9, ab.length_squared)))
        d = (a + ab * t - c).length
        if best is None or d < best[0]: best = (d, i, t)
    _, i, t = best
    if i == len(chain) - 2 and t > 0.5: return {chain[-1]: 1.0} if t >= 1 else lerp_w(chain[i], chain[i + 1], t)
    return lerp_w(chain[i], chain[i + 1], t)

def make_rig(bones, sockets=()):
    """bones: [(name, (x,y,z), parent)] ; parts in PARTS are weighted, joined into one mesh named KEY."""
    arm_d = bpy.data.armatures.new(f'{KEY}_rig'); rig = new_obj(f'{KEY}_rig', arm_d)
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = rig; rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); B = {}
    for n, p, parent in list(bones) + list(sockets):
        b = arm_d.edit_bones.new(n); b.head = p; b.tail = (p[0], p[1], p[2] + 0.03); b.roll = 0
        if parent: b.parent = B[parent]
        B[n] = b; BONES[n] = Vector(p)
    bpy.ops.object.mode_set(mode='OBJECT')
    objs = [bpy.data.objects[n] for n in PARTS if n in bpy.data.objects]
    bpy.context.view_layer.update()
    for o in objs:
        spec = PARTS[o.name]; mw = o.matrix_world; G = {}
        for v in o.data.vertices:
            c = mw @ v.co
            w = {spec: 1.0} if isinstance(spec, str) else spec if isinstance(spec, dict) else spec(c)
            for bn, x in w.items():
                if x <= 0: continue
                assert bn in BONES, (o.name, bn)
                if bn not in G: G[bn] = o.vertex_groups.get(bn) or o.vertex_groups.new(name=bn)
                G[bn].add([v.index], x, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); mesh = bpy.context.active_object; mesh.name = KEY.split('_', 1)[1]; mesh.data.name = mesh.name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh.parent = rig; m = mesh.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    # clean: merge coincident verts per part island is unnecessary; drop loose verts
    print('rig', KEY, 'tris', tri_count([mesh]), 'bones', len(arm_d.bones), 'mats', [x.name for x in mesh.data.materials])
    return rig, mesh

# ---------------- bird builders ----------------
def wing(side, base, length, width, col, n=6, droop=0.35, thick=0.012, back_dir=(0, 1, 0), tip_col=None):
    """Folded wing lying against the body side: a fan of overlapping feather ellipsoids from `base`, pointing back & down.
    Inner half weighted to wing_<side>, outer half blends to wing2_<side>."""
    sg = 1 if side == 'l' else -1; base = Vector(base)
    back = Vector(back_dir).normalized(); down = Vector((0, 0, -1))
    parts = []
    def w(c):
        t = (c - base).dot(back) / length
        return lerp_w(f'wing_{side}', f'wing2_{side}', (t - 0.35) / 0.4)
    # covert (shoulder) plate
    parts.append(blob(f'{KEY}_wingcov_{side}', base + back * length * 0.3 + down * width * 0.2, (thick * 1.6, length * 0.38, width * 0.45), col, w, seg=18, rings=10))
    for i in range(n):
        f = i / max(1, n - 1)
        d = (back * math.cos(droop * f) + down * math.sin(droop * f)).normalized()
        L = length * (0.55 + 0.45 * math.sin(math.pi * (0.35 + 0.65 * f)))
        c = base + down * width * (0.15 + 0.6 * f) + d * L * 0.5
        o = blob(f'{KEY}_feather{i}_{side}', c, (thick, L * 0.5, width * 0.22), (tip_col if (tip_col and f > 0.5) else col), w, seg=14, rings=8)
        o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d)
        o.location.x += sg * thick * 1.2 * i * 0.3
        parts.append(o)
    return parts

def bird_leg(side, hip, foot, col, r=0.012, toes=3, toe_len=0.03):
    sg = 1 if side == 'l' else -1; hip = Vector(hip); foot = Vector(foot)
    tube(f'{KEY}_leg_{side}', [hip, (hip + foot) / 2, foot], [r * 1.4, r, r * 0.9], col, lambda c, s_=side: lerp_w(f'thigh_{s_}', f'foot_{s_}', (hip.z - c.z) / max(1e-4, hip.z - foot.z)), seg=8)
    for k in range(toes):
        a = math.radians((k - (toes - 1) / 2) * 32)
        tip = foot + Vector((math.sin(a) * toe_len, -math.cos(a) * toe_len, -foot.z + r * 0.5))
        tube(f'{KEY}_toe{k}_{side}', [foot, tip], [r * 0.8, r * 0.5], col, f'foot_{side}', seg=6)
    tube(f'{KEY}_toeb_{side}', [foot, foot + Vector((0, toe_len * 0.6, -foot.z + r * 0.5))], [r * 0.7, r * 0.4], col, f'foot_{side}', seg=6)

# ---------------- clips ----------------
R = math.radians
HIT = {}
def _clip(rig, name, length, keys, cyclic=True, hit=None):
    ad = rig.animation_data_create()
    a = bpy.data.actions.get(name)
    if a: bpy.data.actions.remove(a)
    act = bpy.data.actions.new(name); ad.action = act
    keys = {k: v for k, v in keys.items() if k in rig.pose.bones}
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'; pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    for pb in rig.pose.bones:
        if pb.name in keys: continue
        for f in (0, length):
            for path in ('rotation_euler', 'location', 'scale'): pb.keyframe_insert(path, frame=f)
    for bn, ks in keys.items():
        pb = rig.pose.bones[bn]
        for f, v in ks:
            pb.rotation_euler = [R(x) for x in v.get('r', (0, 0, 0))]
            pb.location = v.get('l', (0, 0, 0)); pb.scale = v.get('s', (1, 1, 1))
            for path in ('rotation_euler', 'location', 'scale'): pb.keyframe_insert(path, frame=f)
    act.use_frame_range = True; act.frame_start = 0; act.frame_end = length; act.use_cyclic = cyclic
    if hit is not None: act['hitTime'] = hit / 30.0; HIT[name] = hit / 30.0
    tr = ad.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, 0, act); st.name = name
    ad.action = None

def loop(kv, length): return kv + [(length, kv[0][1])]
def swing(amp, length, phase=0.0, n=8, axis=0, bias=0.0, loc=None):
    """Sine keys: rotation on `axis` (deg) or, with loc=(ax, amp), a location offset."""
    out = []
    for i in range(n):
        f = round(length * i / n); s = math.sin(2 * math.pi * (i / n + phase))
        if loc:
            l = [0, 0, 0]; l[loc[0]] = loc[1] * s + (loc[2] if len(loc) > 2 else 0); out.append((f, {'l': tuple(l)}))
        else:
            r = [0, 0, 0]; r[axis] = bias + amp * s; out.append((f, {'r': tuple(r)}))
    return loop(out, length)
def hold(v, length): return [(0, v), (length, v)]
def S(s): return {'s': (s, s, s)}
def bob(amp, length, phase=0.0, n=8): return swing(0, length, phase, n, loc=(1, amp))

def have(rig, *names): return all(n in rig.pose.bones for n in names)
def chain_names(rig, prefix):
    out = []; i = 1
    while f'{prefix}{i}' in rig.pose.bones: out.append(f'{prefix}{i}'); i += 1
    return out

def wave(chain, amp, length, lag=0.12, axis=1, n=8, grow=1.0):
    """Travelling wave down a bone chain (tails, serpent bodies, tentacles)."""
    return {b: swing(amp * (grow ** i), length, -lag * i, n, axis) for i, b in enumerate(chain)}

def merge(*ds):
    out = {}
    for d in ds:
        for k, v in d.items(): out[k] = v
    return out

def plan_clips(rig, plan, size=0.3, over=None, skip=()):
    """Generic clip set per body plan. size ~ body height (m) scales translations. over: {clip: (len, keys, cyclic, hit)} replaces."""
    s = size; C = {}
    tail = chain_names(rig, 'tail'); ears = [b for b in ('ear_l', 'ear_r') if b in rig.pose.bones]
    body = chain_names(rig, 'body')
    ear_twitch = lambda L: {e: [(0, {}), (int(L * .45), {}), (int(L * .5), {'r': (0, 0, 14 if e.endswith('l') else -14)}), (int(L * .56), {}), (L, {})] for e in ears}
    tail_sway = lambda L, a=14: wave(tail, a, L, 0.1) if tail else {}
    if plan in ('quadruped', 'fox', 'mouse'):
        L = 60; C['idle'] = (L, merge({'spine': loop([(0, {}), (30, {'s': (1.03, 1, 1.03)})], L), 'head': swing(3, L, 0.2, 4)}, tail_sway(L, 10), ear_twitch(L)), True, None)
        C['idle_alt'] = (110, merge({
            'neck': [(0, {}), (14, {'r': (16, 0, 0)}), (30, {'r': (20, 0, 0)}), (48, {'r': (-6, 0, 0)}), (110, {})],
            'head': [(0, {}), (48, {'r': (-4, 0, 0)}), (62, {'r': (-4, 28, 8)}), (78, {'r': (-4, -28, -8)}), (95, {}), (110, {})],
        }, wave(tail, 22, 110, 0.12) if tail else {}, ear_twitch(110)), True, None)
        L = 28; C['walk'] = (L, merge({
            'arm_l': swing(26, L, 0.0), 'thigh_r': swing(26, L, 0.0), 'arm_r': swing(26, L, 0.5), 'thigh_l': swing(26, L, 0.5),
            'hand_l': swing(-16, L, 0.12), 'foot_r': swing(-16, L, 0.12), 'hand_r': swing(-16, L, 0.62), 'foot_l': swing(-16, L, 0.62),
            'root': bob(0.02 * s, L, 0.0, 4), 'head': swing(3, L, 0.25, 4, 1)}, tail_sway(L, 12)), True, None)
        L = 16; C['run'] = (L, merge({
            'arm_l': swing(44, L, 0.0), 'arm_r': swing(44, L, 0.06), 'thigh_l': swing(44, L, 0.5), 'thigh_r': swing(44, L, 0.56),
            'hand_l': swing(-26, L, 0.15), 'hand_r': swing(-26, L, 0.2), 'foot_l': swing(-20, L, 0.65), 'foot_r': swing(-20, L, 0.7),
            'root': merge_keys(swing(7, L, 0.25), bob(0.05 * s, L, 0.0, 4)), 'spine': swing(7, L, 0.75)}, tail_sway(L, 18)), True, None)
        C['attack_physical'] = (28, {
            'root': [(0, {}), (9, {'r': (8, 0, 0), 'l': (0, -0.05 * s, -0.1 * s)}), (15, {'r': (10, 0, 0), 'l': (0, 0.04 * s, 0.45 * s)}), (21, {'l': (0, 0, 0.15 * s)}), (28, {})],
            'neck': [(0, {}), (9, {'r': (16, 0, 0)}), (15, {'r': (22, 0, 0)}), (28, {})],
            'arm_l': [(0, {}), (9, {'r': (22, 0, 0)}), (15, {'r': (-50, 0, 0)}), (28, {})], 'arm_r': [(0, {}), (9, {'r': (22, 0, 0)}), (15, {'r': (-50, 0, 0)}), (28, {})],
            'thigh_l': [(0, {}), (9, {'r': (-18, 0, 0)}), (15, {'r': (42, 0, 0)}), (28, {})], 'thigh_r': [(0, {}), (9, {'r': (-18, 0, 0)}), (15, {'r': (42, 0, 0)}), (28, {})],
            **({tail[0]: [(0, {}), (9, {'r': (-25, 0, 0)}), (15, {'r': (20, 0, 0)}), (28, {})]} if tail else {}),
        }, False, 15)
        C['attack_special'] = (40, merge({
            'root': [(0, {}), (12, {'r': (-18, 0, 0), 'l': (0, 0.05 * s, 0)}), (22, {'r': (6, 0, 0), 'l': (0, 0, 0.05 * s)}), (32, {'r': (3, 0, 0)}), (40, {})],
            'neck': [(0, {}), (12, {'r': (-18, 0, 0)}), (22, {'r': (12, 0, 0)}), (40, {})],
            'head': [(0, {}), (12, {'r': (-10, 0, 0)}), (22, {'r': (8, 0, 0)}), (40, {})],
            'arm_l': [(0, {}), (12, {'r': (-30, 0, 0)}), (22, {}), (40, {})], 'arm_r': [(0, {}), (12, {'r': (-30, 0, 0)}), (22, {}), (40, {})],
        }, {tail[i]: [(0, {}), (12, {'r': (-20 - 5 * i, 0, 0)}), (22, {'r': (10, 0, 0)}), (40, {})] for i in range(len(tail))},
           {e: [(0, {}), (12, {'r': (-20, 0, 0)}), (22, {}), (40, {})] for e in ears}), False, 22)
        C['hit'] = (12, merge({'root': [(0, {}), (3, {'r': (-12, 0, 6), 'l': (0, 0.02 * s, -0.12 * s)}), (12, {})], 'head': [(0, {}), (3, {'r': (-15, 0, 0)}), (12, {})]},
                              {e: [(0, {}), (3, {'r': (30, 0, 0)}), (12, {})] for e in ears}), False, None)
        C['faint'] = (36, merge({
            'root': [(0, {}), (8, {'r': (0, 0, -8)}), (22, {'r': (0, 0, 78), 'l': (0.1 * s, -0.1 * s, 0)}), (28, {'r': (0, 0, 90), 'l': (0.12 * s, -0.16 * s, 0)}), (36, {'r': (0, 0, 88), 'l': (0.12 * s, -0.16 * s, 0)})],
            'neck': [(0, {}), (22, {'r': (25, 0, 0)}), (36, {'r': (30, 0, 0)})],
            'arm_l': [(0, {}), (28, {'r': (-25, 0, 0)}), (36, {'r': (-25, 0, 0)})], 'thigh_l': [(0, {}), (28, {'r': (25, 0, 0)}), (36, {'r': (25, 0, 0)})]},
            {e: [(0, {}), (28, {'r': (35, 0, 0)}), (36, {'r': (35, 0, 0)})] for e in ears}), False, None)
        C['sleep'] = (90, merge({
            'root': loop([(0, {'l': (0, -0.12 * s, 0)}), (45, {'l': (0, -0.11 * s, 0)})], 90),
            'neck': loop([(0, {'r': (30, 0, 0)}), (45, {'r': (27, 0, 0)})], 90), 'head': hold({'r': (10, -22, 0)}, 90),
            'spine': loop([(0, {}), (45, {'s': (1.04, 1, 1.04)})], 90),
            'arm_l': hold({'r': (-55, 0, 0)}, 90), 'arm_r': hold({'r': (-55, 0, 0)}, 90), 'thigh_l': hold({'r': (55, 0, 0)}, 90), 'thigh_r': hold({'r': (55, 0, 0)}, 90)},
            {t: hold({'r': (-10, 25, 0)}, 90) for t in tail}, {e: hold({'r': (30, 0, 0)}, 90) for e in ears}), True, None)
    elif plan == 'biped':
        L = 60; C['idle'] = (L, merge({'spine': loop([(0, {}), (30, {'s': (1.03, 1.02, 1.03)})], L), 'head': swing(3, L, 0.2, 4, 2),
                                       'arm_l': swing(4, L, 0.0, 4, 2, 0), 'arm_r': swing(-4, L, 0.0, 4, 2, 0)}, tail_sway(L, 10), ear_twitch(L)), True, None)
        C['idle_alt'] = (100, merge({'root': [(0, {}), (20, {'l': (0, 0.12 * s, 0)}), (28, {}), (40, {'l': (0, 0.12 * s, 0)}), (48, {}), (100, {})],
                                     'head': [(0, {}), (55, {'r': (0, 25, 10)}), (75, {'r': (0, -25, -10)}), (100, {})],
                                     'arm_l': [(0, {}), (20, {'r': (0, 0, 60)}), (28, {}), (40, {'r': (0, 0, 60)}), (48, {}), (100, {})],
                                     'arm_r': [(0, {}), (20, {'r': (0, 0, -60)}), (28, {}), (40, {'r': (0, 0, -60)}), (48, {}), (100, {})]}, ear_twitch(100)), True, None)
        L = 26; C['walk'] = (L, merge({
            'thigh_l': swing(28, L, 0.0), 'thigh_r': swing(28, L, 0.5), 'foot_l': swing(-12, L, 0.1), 'foot_r': swing(-12, L, 0.6),
            'arm_l': swing(20, L, 0.5), 'arm_r': swing(20, L, 0.0), 'root': merge_keys(bob(0.04 * s, L, 0.25, 4), swing(4, L, 0.0, 8, 2)),
            'spine': swing(3, L, 0.0, 8, 1)}, tail_sway(L, 12)), True, None)
        L = 16; C['run'] = (L, merge({
            'thigh_l': swing(45, L, 0.0), 'thigh_r': swing(45, L, 0.5), 'foot_l': swing(-25, L, 0.1), 'foot_r': swing(-25, L, 0.6),
            'arm_l': swing(40, L, 0.5, bias=-10), 'arm_r': swing(40, L, 0.0, bias=-10), 'root': merge_keys(bob(0.07 * s, L, 0.25, 4), hold({'r': (10, 0, 0)}, L)),
            'spine': hold({'r': (8, 0, 0)}, L)}, tail_sway(L, 18)), True, None)
        C['attack_physical'] = (28, {
            'root': [(0, {}), (9, {'r': (-6, 0, 0), 'l': (0, -0.05 * s, -0.08 * s)}), (15, {'r': (14, 0, 0), 'l': (0, 0.05 * s, 0.4 * s)}), (21, {'l': (0, 0, 0.12 * s)}), (28, {})],
            'arm_l': [(0, {}), (9, {'r': (35, 0, 20)}), (15, {'r': (-80, 0, 0)}), (28, {})], 'arm_r': [(0, {}), (9, {'r': (35, 0, -20)}), (15, {'r': (-80, 0, 0)}), (28, {})],
            'head': [(0, {}), (9, {'r': (-8, 0, 0)}), (15, {'r': (12, 0, 0)}), (28, {})],
        }, False, 15)
        C['attack_special'] = (40, merge({
            'root': [(0, {}), (12, {'r': (-10, 0, 0), 'l': (0, 0.04 * s, 0)}), (22, {'r': (8, 0, 0)}), (40, {})],
            'arm_l': [(0, {}), (12, {'r': (0, 0, 70)}), (22, {'r': (-70, 0, 10)}), (32, {'r': (-60, 0, 10)}), (40, {})],
            'arm_r': [(0, {}), (12, {'r': (0, 0, -70)}), (22, {'r': (-70, 0, -10)}), (32, {'r': (-60, 0, -10)}), (40, {})],
            'head': [(0, {}), (12, {'r': (-15, 0, 0)}), (22, {'r': (5, 0, 0)}), (40, {})],
        }, {e: [(0, {}), (12, {'r': (-20, 0, 0)}), (22, {}), (40, {})] for e in ears}), False, 22)
        C['hit'] = (12, merge({'root': [(0, {}), (3, {'r': (-14, 0, 5), 'l': (0, 0.02 * s, -0.12 * s)}), (12, {})], 'head': [(0, {}), (3, {'r': (-15, 0, 0)}), (12, {})],
                               'arm_l': [(0, {}), (3, {'r': (0, 0, 40)}), (12, {})], 'arm_r': [(0, {}), (3, {'r': (0, 0, -40)}), (12, {})]},
                              {e: [(0, {}), (3, {'r': (30, 0, 0)}), (12, {})] for e in ears}), False, None)
        C['faint'] = (36, merge({
            'root': [(0, {}), (8, {'r': (-6, 0, 0)}), (24, {'r': (-85, 0, 0), 'l': (0, -0.1 * s, 0.35 * s)}), (30, {'r': (-92, 0, 0), 'l': (0, -0.12 * s, 0.4 * s)}), (36, {'r': (-90, 0, 0), 'l': (0, -0.12 * s, 0.4 * s)})],
            'arm_l': [(0, {}), (24, {'r': (0, 0, 70)}), (36, {'r': (0, 0, 70)})], 'arm_r': [(0, {}), (24, {'r': (0, 0, -70)}), (36, {'r': (0, 0, -70)})],
            'head': [(0, {}), (24, {'r': (-20, 0, 0)}), (36, {'r': (-20, 0, 0)})]}, {e: [(0, {}), (24, {'r': (30, 0, 0)}), (36, {'r': (30, 0, 0)})] for e in ears}), False, None)
        C['sleep'] = (90, merge({
            'root': loop([(0, {'l': (0, -0.2 * s, 0)}), (45, {'l': (0, -0.19 * s, 0)})], 90),
            'thigh_l': hold({'r': (-80, 0, 10)}, 90), 'thigh_r': hold({'r': (-80, 0, -10)}, 90), 'foot_l': hold({'r': (80, 0, 0)}, 90), 'foot_r': hold({'r': (80, 0, 0)}, 90),
            'head': loop([(0, {'r': (22, 0, 12)}), (45, {'r': (20, 0, 12)})], 90), 'spine': loop([(0, {'r': (10, 0, 0)}), (45, {'r': (10, 0, 0), 's': (1.04, 1, 1.04)})], 90),
            'arm_l': hold({'r': (-20, 0, -10)}, 90), 'arm_r': hold({'r': (-20, 0, 10)}, 90)},
            {t: hold({'r': (-10, 25, 0)}, 90) for t in tail}, {e: hold({'r': (30, 0, 0)}, 90) for e in ears}), True, None)
    elif plan == 'bird':
        # wings are modelled folded along the body (pointing back); pose: Y = spread outward (left -, right +), Z = flap (left +up, right -up)
        def W(spread, roll, side): return {'r': (0, -spread if side == 'l' else spread, roll if side == 'l' else -roll)}
        def flap(L, a=55, spread=75, lift=10, n=8):
            out = {}
            for side in 'lr':
                out[f'wing_{side}'] = loop([(round(L * i / n), W(spread, lift + a * math.sin(2 * math.pi * i / n), side)) for i in range(n)], L)
                out[f'wing2_{side}'] = loop([(round(L * i / n), W(15, 0.5 * a * math.sin(2 * math.pi * (i / n - 0.12)), side)) for i in range(n)], L)
            return out
        def pose2(frames):   # frames: [(f, spread, roll)] -> both wings
            return {f'wing_{sd}': [(f, W(sp, ro, sd)) for f, sp, ro in frames] for sd in 'lr'}
        L = 60; C['idle'] = (L, merge({'spine': loop([(0, {}), (30, {'s': (1.04, 1.02, 1.04)})], L),
                                       'head': [(0, {}), (14, {'r': (0, 22, 0)}), (18, {'r': (0, 22, 0)}), (22, {}), (40, {'r': (0, -18, 0)}), (46, {}), (L, {})]}, tail_sway(L, 6)), True, None)
        C['idle_alt'] = (90, merge(pose2([(0, 0, 0), (10, 70, 50), (16, 60, 10), (22, 70, 50), (28, 60, 10), (38, 0, 0), (90, 0, 0)]),
                              {'head': [(0, {}), (50, {}), (58, {'r': (35, 0, 0)}), (64, {'r': (10, 0, 0)}), (70, {'r': (35, 0, 0)}), (80, {}), (90, {})],
                               'root': [(0, {}), (12, {'l': (0, 0.06 * s, 0)}), (28, {}), (90, {})]}), True, None)
        L = 20; C['walk'] = (L, merge({'root': loop([(0, {}), (5, {'l': (0, 0.08 * s, 0.03 * s)}), (10, {}), (15, {'l': (0, 0.08 * s, 0.03 * s)})], L),
                                 'thigh_l': swing(30, L, 0.0), 'thigh_r': swing(30, L, 0.5), 'head': swing(8, L, 0.1, 4)},
                                 pose2([(0, 5, 4), (5, 8, 8), (10, 5, 4), (15, 8, 8), (20, 5, 4)])), True, None)
        L = 14; C['run'] = (L, merge({'root': merge_keys(bob(0.1 * s, L, 0.25, 4), hold({'r': (12, 0, 0)}, L)), 'thigh_l': swing(45, L, 0.0), 'thigh_r': swing(45, L, 0.5)},
                                     flap(L, 35, 55, 15)), True, None)
        L = 20; C['fly'] = (L, merge({'root': merge_keys(bob(0.08 * s, L, 0.1, 8), hold({'r': (8, 0, 0)}, L)), 'thigh_l': hold({'r': (60, 0, 0)}, L), 'thigh_r': hold({'r': (60, 0, 0)}, L),
                                      'head': swing(-4, L, 0.1, 4)}, flap(L, 55, 80, 10), wave(tail, 6, L, 0.1, 0) if tail else {}), True, None)
        C['attack_physical'] = (28, merge({   # Tackle / Quick Attack: wings up, dive forward
            'root': [(0, {}), (8, {'r': (-15, 0, 0), 'l': (0, 0.15 * s, -0.1 * s)}), (15, {'r': (30, 0, 0), 'l': (0, 0.05 * s, 0.45 * s)}), (22, {'l': (0, 0, 0.1 * s)}), (28, {})],
            'head': [(0, {}), (8, {'r': (-25, 0, 0)}), (15, {'r': (35, 0, 0)}), (28, {})]},
            pose2([(0, 0, 0), (8, 75, 70), (15, 60, -20), (28, 0, 0)])), False, 15)
        C['attack_special'] = (40, merge({'root': [(0, {}), (10, {'l': (0, 0.2 * s, 0)}), (30, {'l': (0, 0.2 * s, 0)}), (40, {})],   # Gust: hover and beat a gale forward
                                    'thigh_l': [(0, {}), (10, {'r': (40, 0, 0)}), (30, {'r': (40, 0, 0)}), (40, {})], 'thigh_r': [(0, {}), (10, {'r': (40, 0, 0)}), (30, {'r': (40, 0, 0)}), (40, {})],
                                    'head': [(0, {}), (14, {'r': (-10, 0, 0)}), (26, {'r': (10, 0, 0)}), (40, {})]},
                                   pose2([(0, 0, 0), (8, 80, 70), (14, 85, -30), (20, 80, 70), (26, 85, -40), (34, 40, 10), (40, 0, 0)])), False, 26)
        C['hit'] = (12, merge({'root': [(0, {}), (3, {'r': (-18, 0, 8), 'l': (0, 0.02 * s, -0.12 * s)}), (12, {})], 'head': [(0, {}), (3, {'r': (-20, 0, 0)}), (12, {})]},
                              pose2([(0, 0, 0), (3, 50, 45), (12, 0, 0)])), False, None)
        C['faint'] = (36, merge({'root': [(0, {}), (10, {'r': (0, 0, -10)}), (24, {'r': (0, 0, 85), 'l': (0.1 * s, -0.08 * s, 0)}), (36, {'r': (0, 0, 88), 'l': (0.1 * s, -0.12 * s, 0)})],
                                 'head': [(0, {}), (24, {'r': (25, 0, 0)}), (36, {'r': (25, 0, 0)})]},
                                {'wing_l': [(0, {}), (24, W(40, 30, 'l')), (36, W(35, 25, 'l'))], 'wing_r': [(0, {}), (24, W(20, 10, 'r')), (36, W(15, 8, 'r'))]}), False, None)
        C['sleep'] = (90, {'root': loop([(0, {'l': (0, -0.1 * s, 0)}), (45, {'l': (0, -0.095 * s, 0)})], 90), 'spine': loop([(0, {}), (45, {'s': (1.05, 1.02, 1.05)})], 90),
                           'thigh_l': hold({'r': (-40, 0, 0)}, 90), 'thigh_r': hold({'r': (-40, 0, 0)}, 90), 'head': hold({'r': (30, 40, 0)}, 90)}, True, None)
    elif plan in ('fish', 'serpent', 'larva'):
        ch = body or tail
        idle_w = 6 if plan != 'larva' else 3
        L = 60; C['idle'] = (L, merge({'root': bob(0.03 * s, L, 0.0, 4), 'head': swing(3, L, 0.1, 4)}, wave(ch, idle_w, L, 0.12),
                                      {f: swing(20, 30, 0.0, 4, 1) for f in ('fin_l', 'fin_r') if f in rig.pose.bones}), True, None)
        C['idle_alt'] = (90, merge({'head': [(0, {}), (20, {'r': (-20, 0, 0)}), (30, {'r': (-20, 20, 0)}), (45, {'r': (-20, -20, 0)}), (60, {}), (90, {})]},
                                   wave(ch, idle_w * 2, 90, 0.1)), True, None)
        if plan == 'larva':
            L = 40; C['walk'] = (L, merge({'root': loop([(0, {}), (20, {'l': (0, 0, 0.1 * s)})], L)},
                                          {b: loop([(0, {}), (int(10 + 20 * i / max(1, len(ch))), {'l': (0, 0.06 * s * math.sin(math.pi * i / max(1, len(ch) - 1)), 0), 'r': (0, 0, 0)}), (int(20 + 20 * i / max(1, len(ch))) % L, {})], L) for i, b in enumerate(ch)}), True, None)
            L = 24; C['run'] = (L, merge({'root': loop([(0, {}), (12, {'l': (0, 0, 0.12 * s)})], L)}, wave(ch, 16, L, 0.15, 0)), True, None)
        else:
            L = 30; C['walk'] = (L, merge({'root': bob(0.04 * s, L, 0.0, 4)}, wave(ch, 14, L, 0.14), {f: swing(25, L, 0.0, 4, 1) for f in ('fin_l', 'fin_r') if f in rig.pose.bones}), True, None)
            L = 18; C['run'] = (L, merge({'root': bob(0.06 * s, L, 0.0, 4)}, wave(ch, 24, L, 0.15)), True, None)
            C['swim'] = (36, merge({'root': bob(0.04 * s, 36, 0.0, 4)}, wave(ch, 18, 36, 0.14), {f: swing(30, 36, 0.0, 4, 1) for f in ('fin_l', 'fin_r') if f in rig.pose.bones}), True, None)
        C['attack_physical'] = (30, merge({'root': [(0, {}), (10, {'r': (-20, 0, 0), 'l': (0, 0.1 * s, -0.1 * s)}), (16, {'r': (25, 0, 0), 'l': (0, 0.05 * s, 0.45 * s)}), (22, {'l': (0, 0, 0.1 * s)}), (30, {})],
                                           'head': [(0, {}), (10, {'r': (-25, 0, 0)}), (16, {'r': (20, 0, 0)}), (30, {})]},
                                          {b: [(0, {}), (10, {'r': (25 + 5 * i, 0, 0)}), (16, {'r': (-20, 0, 0)}), (30, {})] for i, b in enumerate(ch)}), False, 16)
        C['attack_special'] = (42, merge({'root': [(0, {}), (14, {'r': (-25, 0, 0), 'l': (0, 0.12 * s, 0)}), (24, {'r': (10, 0, 0), 'l': (0, 0.05 * s, 0.05 * s)}), (42, {})],
                                          'head': [(0, {}), (14, {'r': (-25, 0, 0)}), (24, {'r': (12, 0, 0)}), (42, {})], 'jaw': [(0, {}), (14, {'r': (25, 0, 0)}), (30, {'r': (25, 0, 0)}), (42, {})]},
                                         {b: [(0, {}), (14, {'r': (15, 0, 0)}), (24, {'r': (-8, 0, 0)}), (42, {})] for b in ch}), False, 24)
        C['hit'] = (12, merge({'root': [(0, {}), (3, {'r': (-15, 0, 10), 'l': (0, 0.03 * s, -0.12 * s)}), (12, {})], 'head': [(0, {}), (3, {'r': (-20, 0, 0)}), (12, {})]},
                              {b: [(0, {}), (4, {'r': (0, 15, 0)}), (12, {})] for b in ch}), False, None)
        C['faint'] = (40, merge({'root': [(0, {}), (10, {'r': (0, 0, -10)}), (26, {'r': (0, 0, 88), 'l': (0.1 * s, -0.1 * s, 0)}), (40, {'r': (0, 0, 90), 'l': (0.1 * s, -0.15 * s, 0)})],
                                 'head': [(0, {}), (26, {'r': (15, 0, 0)}), (40, {'r': (15, 0, 0)})]},
                                {b: [(0, {}), (26, {'r': (0, 10, 0)}), (40, {'r': (0, 8, 0)})] for b in ch}), False, None)
        C['sleep'] = (90, merge({'root': loop([(0, {'l': (0, -0.05 * s, 0)}), (45, {'l': (0, -0.045 * s, 0)})], 90), 'head': hold({'r': (15, 0, 0)}, 90)},
                                {b: hold({'r': (0, 12 if plan != 'fish' else 4, 0)}, 90) for b in ch}), True, None)
    elif plan == 'rigid':   # cocoons, stars, jellies: whole-body motion only (+ optional extra bones)
        L = 60; C['idle'] = (L, {'root': merge_keys(bob(0.02 * s, L, 0, 4), swing(3, L, 0, 4, 2)), 'spine': loop([(0, {}), (30, {'s': (1.03, 0.98, 1.03)})], L)}, True, None)
        C['idle_alt'] = (80, {'root': [(0, {}), (10, {'r': (0, 0, 10)}), (20, {'r': (0, 0, -10)}), (30, {'r': (0, 0, 6)}), (40, {}), (80, {})]}, True, None)
        L = 24; C['walk'] = (L, {'root': loop([(0, {}), (6, {'l': (0, 0.08 * s, 0), 'r': (0, 0, 6)}), (12, {}), (18, {'l': (0, 0.08 * s, 0), 'r': (0, 0, -6)})], L)}, True, None)
        L = 16; C['run'] = (L, {'root': loop([(0, {}), (4, {'l': (0, 0.14 * s, 0), 'r': (8, 0, 6)}), (8, {}), (12, {'l': (0, 0.14 * s, 0), 'r': (8, 0, -6)})], L)}, True, None)
        C['attack_physical'] = (28, {'root': [(0, {}), (9, {'r': (-12, 0, 0), 'l': (0, -0.05 * s, -0.12 * s), 's': (1.1, 0.9, 1.1)}), (15, {'r': (15, 0, 0), 'l': (0, 0.08 * s, 0.45 * s), 's': (0.95, 1.08, 0.95)}), (21, {'l': (0, 0, 0.12 * s)}), (28, {})]}, False, 15)
        C['attack_special'] = (40, {'root': [(0, {}), (12, {'l': (0, 0.15 * s, 0), 's': (1.08, 1.08, 1.08)}), (22, {'l': (0, 0.1 * s, 0), 's': (0.95, 0.95, 0.95)}), (40, {})],
                                    'spine': [(0, {}), (12, {'s': (1.1, 1.1, 1.1)}), (22, {'s': (0.92, 0.92, 0.92)}), (40, {})]}, False, 22)
        C['hit'] = (12, {'root': [(0, {}), (3, {'r': (-14, 0, 8), 'l': (0, 0.02 * s, -0.12 * s)}), (12, {})]}, False, None)
        C['faint'] = (36, {'root': [(0, {}), (10, {'r': (0, 0, -10)}), (24, {'r': (0, 0, 85), 'l': (0.15 * s, -0.12 * s, 0)}), (36, {'r': (0, 0, 90), 'l': (0.15 * s, -0.2 * s, 0)})]}, False, None)
        C['sleep'] = (90, {'root': loop([(0, {'r': (0, 0, 4), 'l': (0, -0.03 * s, 0)}), (45, {'r': (0, 0, 2), 'l': (0, -0.03 * s, 0)})], 90), 'spine': loop([(0, {}), (45, {'s': (1.03, 0.98, 1.03)})], 90)}, True, None)
    for k, v in (over or {}).items():
        if v is None: C.pop(k, None)
        elif k in C and isinstance(v, dict): C[k] = (C[k][0], merge(C[k][1], v), C[k][2], C[k][3])
        else: C[k] = v
    for k in skip: C.pop(k, None)
    HIT.clear()
    order = ['idle', 'idle_alt', 'walk', 'run', 'attack_physical', 'attack_special', 'hit', 'faint', 'sleep', 'fly', 'swim']
    ad = rig.animation_data_create()
    for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
    for k in order + [x for x in C if x not in order]:
        if k in C:
            L, keys, cyc, hit = C[k]; _clip(rig, k, L, keys, cyc, hit)
    for pb in rig.pose.bones: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    print('clips', [t.name for t in ad.nla_tracks], 'hit', json.dumps(HIT))

def merge_keys(a, b):
    """Combine two key lists on the same bone (union of frames; r/l/s channel-wise add; missing frames sampled by nearest-left)."""
    fa = dict(a); fb = dict(b); frames = sorted(set(fa) | set(fb))
    def at(d, f):
        ks = sorted(d); prev = ks[0]
        for k in ks:
            if k <= f: prev = k
        return d[prev]
    out = []
    for f in frames:
        va, vb = at(fa, f), at(fb, f); v = {}
        for ch, dflt in (('r', (0, 0, 0)), ('l', (0, 0, 0))):
            x = [p + q for p, q in zip(va.get(ch, dflt), vb.get(ch, dflt))]
            if any(x): v[ch] = tuple(x)
        sa, sb = va.get('s', (1, 1, 1)), vb.get('s', (1, 1, 1))
        if sa != (1, 1, 1) or sb != (1, 1, 1): v['s'] = tuple(p * q for p, q in zip(sa, sb))
        out.append((f, v))
    return out

# ---------------- checks & export ----------------
def sheet(tag, height, poses=(), views=('front', 'q34', 'side', 'back'), res=300, center=None):
    """Contact sheet: row 1 = rest views, row 2 = (action, frame, view) poses. Saved to renders/<tag>.png"""
    import numpy as np
    setup_render(); sc = bpy.context.scene
    sc.render.resolution_x = res; sc.render.resolution_y = res
    rig = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    tmp = D('art-source', ASSET_DIR, KEY, 'renders', '_tmp.png'); os.makedirs(os.path.dirname(tmp), exist_ok=True)
    cam = bpy.data.objects.get('CheckCam') or bpy.data.objects.new('CheckCam', bpy.data.cameras.new('CheckCam'))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    cam.data.lens = 50; sc.camera = cam
    tgt = Vector((0, 0, height * 0.5 if center is None else center)); dist = height * 2.6 + 0.2
    def shot(view):
        el, az = VIEWS[view]; a = math.radians(az); e = math.radians(el)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(-e)))
        cam.location = tgt + d * dist
        cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp, check_existing=False)
        px = np.array(im.pixels[:]).reshape(res, res, 4); bpy.data.images.remove(im); return px
    tiles = []
    if rig and rig.animation_data: rig.animation_data.action = None
    for pb in (rig.pose.bones if rig else []): pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    saved = []
    if rig:
        for t in rig.animation_data.nla_tracks if rig.animation_data else []: saved.append((t, t.mute)); t.mute = True
    sc.frame_set(0); tiles.append([shot(v) for v in views])
    row = []
    for act, fr, view in poses:
        rig.animation_data.action = bpy.data.actions[act]; sc.frame_set(fr); row.append(shot(view))
    if rig and rig.animation_data: rig.animation_data.action = None
    for t, m in saved: t.mute = m
    if row:
        while len(row) % len(views): row.append(np.ones((res, res, 4)))
        for i in range(0, len(row), len(views)): tiles.append(row[i:i + len(views)])
    img = np.concatenate([np.concatenate(r, axis=1) for r in tiles[::-1]], axis=0)
    h, w = img.shape[:2]
    out = bpy.data.images.new('sheet', w, h); out.pixels = img.ravel().tolist()
    path = D('art-source', ASSET_DIR, KEY, 'renders', f'{tag}.png'); out.filepath_raw = path; out.file_format = 'PNG'; out.save()
    bpy.data.images.remove(out)
    for pb in (rig.pose.bones if rig else []): pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    print('sheet', path)

def export(pid, name, heightM, plan, rig, mesh, shiny=None, fit='height'):
    """Save .blend, export raw glb + meta (+ shiny palette PNG) to art-source/pokemon/<KEY>/export/."""
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = rig
    base = D('art-source', ASSET_DIR, KEY); exp = os.path.join(base, 'export'); os.makedirs(exp, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(base, f'{KEY}.blend'))
    glb = os.path.join(exp, f'{KEY}.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True,
        export_apply=True, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_force_sampling=False, export_cameras=False, export_lights=False, export_extras=True)
    meta = {'id': pid, 'name': name, 'heightM': heightM, 'plan': plan, 'tris': tri_count([mesh]),
            'fit': fit, 'bones': len(rig.data.bones), 'clips': [t.name for t in rig.animation_data.nla_tracks],
            'hitTime': {a.name: a['hitTime'] for a in bpy.data.actions if 'hitTime' in a}}
    if shiny:
        cols = [(n, shiny.get(n, h)) for n, h in COLORS]
        size = 256; cell = size // GRID
        img = bpy.data.images.new(f'PALS_{KEY}', size, size, alpha=False); px = [0.0] * (size * size * 4)
        for idx, (_, hx) in enumerate(cols):
            r, g, b = hexrgb(hx); cx, cy = idx % GRID, idx // GRID
            for y in range(cy * cell, (cy + 1) * cell):
                for x in range(cx * cell, (cx + 1) * cell):
                    o = (y * size + x) * 4; px[o:o + 4] = [r, g, b, 1.0]
        img.pixels = px; sp = os.path.join(exp, f'{KEY}_shiny.png'); img.filepath_raw = sp; img.file_format = 'PNG'; img.save()
        bpy.data.images.remove(img); meta['shiny'] = f'{KEY}_shiny.png'
    with open(os.path.join(exp, f'{KEY}.meta.json'), 'w', encoding='utf-8') as f: json.dump(meta, f, indent=2)
    print('export', json.dumps(meta), os.path.getsize(glb))

# ---------------- quadruped helpers ----------------
def leg4(side, front, shoulder, paw, r_top, r_bot, col, paw_col=None, paw_size=None, toes=0, toe_col=None):
    """One leg: tube shoulder->paw, paw blob. Bones: arm/hand (front) or thigh/foot (back)."""
    up, lo = ('arm', 'hand') if front else ('thigh', 'foot')
    a, b = f'{up}_{side}', f'{lo}_{side}'
    sh = Vector(shoulder); pw = Vector(paw); mid = (sh + pw) / 2 + Vector((0, 0.1 * (sh.z - pw.z) * (-1 if front else 1), 0))
    tube(f'{KEY}_leg_{a}', [sh, mid, pw + Vector((0, 0, r_bot))], [r_top, (r_top + r_bot) / 2, r_bot], col,
         lambda c: lerp_w(a, b, (sh.z - c.z) / max(1e-4, (sh.z - pw.z)) * 1.4 - 0.2), seg=12)
    ps = paw_size or (r_bot * 1.3, r_bot * 1.6, r_bot * 0.8)
    blob(f'{KEY}_paw_{a}', pw + Vector((0, -ps[1] * 0.25, ps[2])), ps, paw_col or col, b, seg=16, rings=8)
    for k in range(toes):
        ang = math.radians((k - (toes - 1) / 2) * 25)
        blob(f'{KEY}_toe{k}_{a}', pw + Vector((math.sin(ang) * ps[0] * 0.8, -ps[1] * 1.1 * math.cos(ang), ps[2] * 0.6)), (ps[0] * 0.25, ps[0] * 0.35, ps[2] * 0.6), toe_col or 'white', b, seg=8, rings=6)

def quad_bones(hip, chest, neck, head, legs, tail=(), ears=(), extra=()):
    """legs: {'arm_l': (shoulder, paw), 'thigh_l': (...), ...}; tail: list of points; ears: [(name, pos)]"""
    b = [('root', (0, 0, 0), None), ('hips', tuple(hip), 'root'), ('spine', tuple((Vector(hip) + Vector(chest)) / 2), 'hips'), ('chest', tuple(chest), 'spine'),
         ('neck', tuple(neck), 'chest'), ('head', tuple(head), 'neck')]
    for nm, (sh, pw) in legs.items():
        side = nm[-1]; lo = ('hand_' if nm.startswith('arm') else 'foot_') + side
        b.append((nm, tuple(sh), 'chest' if nm.startswith('arm') else 'hips'))
        b.append((lo, tuple(Vector(pw) + Vector((0, 0, 0.02))), nm))
    prev = 'hips'
    for i, p in enumerate(tail):
        b.append((f'tail{i + 1}', tuple(p), prev)); prev = f'tail{i + 1}'
    for nm, p in ears: b.append((nm, tuple(p), 'head'))
    for nm, p, par in extra: b.append((nm, tuple(p), par))
    return b

# ---------------- electric mouse builder ----------------
def build_mouse(P, cfg):
    H = cfg['H']; BC = Vector((0, 0.01, cfg['bz'])); HC = Vector((0, -0.01, cfg['hz']))
    br, hr = cfg['body'], cfg['head']
    blob(f'{P}_body', BC, br, 'yellow', lambda c: lerp_w('spine', 'chest', (c.z - BC.z + br[2] * 0.3) / br[2]), seg=32, rings=18,
         fn=lambda v: Vector((v.x * (1 + 0.15 * -v.z), v.y * (1 + 0.1 * -v.z), v.z)))
    head = blob(f'{P}_head', HC, hr, 'yellow', 'head', seg=36, rings=20, fn=lambda v: Vector((v.x * (1 + 0.08 * -v.z), v.y, v.z)))
    if cfg.get('stripes'):
        for k, dz in enumerate((0.04, -0.03)):
            decal(f'{P}_stripe{k}', bpy.data.objects[f'{P}_body'], BC + Vector((0, 0, dz)), (0, 1, 0.1), (0.07 - 0.01 * k, 0.012, 0.016), 'brown', 'spine', sink=0.35)
    if cfg.get('collar'):
        tube(f'{P}_collar', [HC + Vector((math.sin(a) * hr[0] * 0.62, math.cos(a) * hr[1] * 0.62 + 0.005, -hr[2] * 0.82)) for a in [2 * math.pi * k / 24 for k in range(25)]], 0.012, 'black', 'chest', seg=6)
    for s, nm in ((1, 'l'), (-1, 'r')):
        e, loc, n = decal(f'{P}_eye_{nm}', head, HC + Vector((0, 0, cfg['eyez'])), (s * cfg['eyex'], -1, 0.1), cfg['eye'], 'eye', 'head', sink=0.2)
        decal(f'{P}_shine_{nm}', e, loc + Vector((s * -0.004, 0, cfg['eye'][2] * 0.35)), n, (cfg['eye'][0] * 0.42, 0.004, cfg['eye'][0] * 0.42), 'white', 'head', sink=0.05, seg=10, rings=6)
        decal(f'{P}_cheek_{nm}', head, HC + Vector((0, 0, -hr[2] * 0.25)), (s * 0.85, -0.65, -0.2), cfg['cheek'], 'cheek', 'head', sink=0.3)
        # ears
        eb = HC + Vector((s * hr[0] * 0.5, 0.01, hr[2] * 0.75)); ang = cfg['ear_ang']
        d = Vector((s * math.sin(math.radians(ang)), 0.1, math.cos(math.radians(ang)))).normalized(); L = cfg['ear_len']; W = cfg['ear_w']
        pts = [eb + d * L * t for t in (0, 0.3, 0.6, 0.85, 1.0)]
        rad = [W * 0.8, W, W * 0.85, W * 0.45, 0.003]
        def ecol(c, n_, p, eb=eb, d=d, L=L):
            t = (c - eb).dot(d) / L
            if t > cfg['ear_tip']: return 'black'
            if cfg.get('ear_rim') and n_.y > -0.1 and abs(n_.x) > 0.4 and t > 0.25: return 'black'
            return 'yellow'
        tube(f'{P}_ear_{nm}', pts, rad, ecol, lambda c, nm=nm, eb=eb, d=d, L=L: lerp_w('head', f'ear_{nm}', (c - eb).dot(d) / L * 2), seg=14, flat=cfg['ear_flat'])
        # arms (stubby), feet
        sh = BC + Vector((s * br[0] * 0.8, -br[1] * 0.4, br[2] * 0.45)); hd = sh + Vector((s * 0.02, -br[1] * 0.6, -br[2] * 0.45))
        tube(f'{P}_arm_{nm}', [sh, (sh + hd) / 2, hd], [cfg['arm_r'], cfg['arm_r'] * 0.95, cfg['arm_r'] * 0.9], 'yellow', f'arm_{nm}', seg=10)
        blob(f'{P}_hand_{nm}', hd, (cfg['arm_r'] * 1.1,) * 3, 'yellow', f'arm_{nm}', seg=12, rings=8)
        blob(f'{P}_foot_{nm}', Vector((s * br[0] * 0.5, -br[1] * 0.35, cfg['foot'][2])), cfg['foot'], 'yellow', f'foot_{nm}', seg=16, rings=10)
    # face
    blob(f'{P}_nose', HC + Vector((0, -hr[1] * 0.98, -hr[2] * 0.12)), (0.007, 0.005, 0.005), 'eye', 'head', seg=10, rings=6)
    m, _, _ = decal(f'{P}_mouth', head, HC + Vector((0, 0, -hr[2] * 0.35)), (0, -1, -0.05), (hr[0] * 0.18, 0.008, hr[2] * 0.08), 'mouth', 'head', sink=0.3)
    # tail
    tp = [Vector(p) for p in cfg['tail']]
    tube(f'{P}_tail', tp, cfg['tail_r'], cfg['tail_col'], lambda c: seg_w(c, ['hips', 'tail1', 'tail2', 'tail3']), seg=8, flat=cfg['tail_flat'])
    bones = [('root', (0, 0, 0), None), ('hips', tuple(BC - Vector((0, 0, br[2] * 0.5))), 'root'), ('spine', tuple(BC), 'hips'), ('chest', tuple(BC + Vector((0, 0, br[2] * 0.6))), 'spine'),
             ('head', tuple(HC - Vector((0, 0, hr[2] * 0.5))), 'chest'), ('tail1', tuple(tp[1]), 'hips'), ('tail2', tuple(tp[len(tp) // 2]), 'tail1'), ('tail3', tuple(tp[-2]), 'tail2')]
    for s, nm in ((1, 'l'), (-1, 'r')):
        bones += [(f'arm_{nm}', tuple(BC + Vector((s * br[0] * 0.8, -br[1] * 0.4, br[2] * 0.45))), 'chest'),
                  (f'thigh_{nm}', (s * br[0] * 0.5, 0, BC.z - br[2] * 0.4), 'hips'), (f'foot_{nm}', (s * br[0] * 0.5, -0.01, cfg['foot'][2]), f'thigh_{nm}'),
                  (f'ear_{nm}', tuple(HC + Vector((s * hr[0] * 0.5, 0.01, hr[2] * 0.8))), 'head')]
    return make_rig(bones, sockets=[('socket_mouth', tuple(HC + Vector((0, -hr[1] - 0.02, -hr[2] * 0.3))), 'head'), ('socket_fx', tuple(HC + Vector((0, -hr[1] - 0.04, 0))), 'head')])

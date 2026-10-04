# 男主角（hero_m）· 几何复刻：用户生成式草模 art-source/characters/角色草模.fbx（Tripo）中的 C 号人物
# 流程：导入 → 取 C 组连通块 → 朝向 / 尺寸规范化（面朝 -Y、身高 1.60 m、脚底 z=0）→ 合并重复顶点
#       → 测量关节 → **逐部件拆分**（关节处平面切开：头 / 躯干 / 上臂 / 前臂 / 手 / 大腿 / 小腿 / 鞋；背包 + 背带按贴图颜色拆出）
#       → 每个部件独立封口（子部件向父部件伸入内衬套筒，父部件开口做圆顶封口）→ 重烘焙贴图
#       → 每个部件只蒙皮到自身骨骼 + 相邻骨骼（接缝两侧同为 50/50，弯曲时接缝不裂、不粘连其他部件）→ 通用动作 → 导出
import bmesh as _bm
reset('hero_m')
H = 1.60
bpy.ops.import_scene.fbx(filepath=D('art-source', 'characters', '角色草模.fbx'))
src = next(x for x in bpy.data.objects if x.type == 'MESH')
for x in list(bpy.data.objects):
    if x is not src: bpy.data.objects.remove(x, do_unlink=True)
bpy.context.view_layer.update()
mw = src.matrix_world.copy()
bm = _bm.new(); bm.from_mesh(src.data); bm.transform(mw); bm.verts.ensure_lookup_table()
# —— 只保留 C 组（世界 Y < -0.15 的连通块）
seen = set(); kill = []
for v in bm.verts:
    if v.index in seen: continue
    st = [v]; seen.add(v.index); comp = []
    while st:
        a = st.pop(); comp.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen: seen.add(b.index); st.append(b)
    if sum(x.co.y for x in comp) / len(comp) >= -0.15: kill += comp
_bm.ops.delete(bm, geom=kill, context='VERTS')
# —— 规范化：C 组面朝 +X → 旋转到面朝 -Y；缩放到 H；脚底落地；水平居中（以双脚中心）
bm.transform(Matrix.Rotation(math.radians(-90), 4, 'Z'))
zs = [v.co.z for v in bm.verts]; z0, z1 = min(zs), max(zs); k = H / (z1 - z0)
feet = [v.co for v in bm.verts if v.co.z < z0 + (z1 - z0) * 0.08]
cx = sum(c.x for c in feet) / len(feet); cy = sum(c.y for c in feet) / len(feet)
bm.transform(Matrix.Translation((-cx * k, -cy * k, -z0 * k)) @ Matrix.Scale(k, 4))
_bm.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
me = src.data; bm.to_mesh(me); bm.free(); src.matrix_world = Matrix.Identity(4); me.update()
src.name = 'hero_m_mesh'
for m in me.materials:
    if m: m.name = 'M_hero_m'
smooth(src, False)
# —— 贴图重烘焙：草模的 2048² 贴图同时装着 3 个人物 → 给本人物重新展 UV，Cycles 烘焙到专用 1024² 贴图
def rebake(o, size=1024):
    me_ = o.data; old_uv = me_.uv_layers.active.name
    nu = me_.uv_layers.new(name='UVBake'); me_.uv_layers.active = nu
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'TEX_{KEY}', size, size, alpha=False)
    mat = o.data.materials[0]; nt = mat.node_tree
    src_tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = old_uv; nt.links.new(uvn.outputs['UV'], src_tex.inputs['Vector'])
    dst = nt.nodes.new('ShaderNodeTexImage'); dst.image = img; nt.nodes.active = dst
    sc_ = bpy.context.scene; eng = sc_.render.engine; sc_.render.engine = 'CYCLES'
    sc_.cycles.samples = 1; sc_.cycles.device = 'CPU'
    sc_.render.bake.use_pass_direct = False; sc_.render.bake.use_pass_indirect = False; sc_.render.bake.margin = 4
    ref = bpy.data.objects.get('bake_ref')
    if ref:   # 投射烘焙：从原始网格取色
        ref.data.materials[0] = mat
        ref.select_set(True); bpy.context.view_layer.objects.active = o
        sc_.render.bake.use_selected_to_active = True; sc_.render.bake.cage_extrusion = 0.012; sc_.render.bake.max_ray_distance = 0.05
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, uv_layer='UVBake')
    if ref: sc_.render.bake.use_selected_to_active = False; bpy.data.objects.remove(ref, do_unlink=True)
    sc_.render.engine = eng
    path = D('art-source', ASSET_DIR, KEY, 'tex', f'{KEY}.jpg'); os.makedirs(os.path.dirname(path), exist_ok=True)
    sc_.render.image_settings.quality = 90
    img.filepath_raw = path; img.file_format = 'JPEG'; img.save()  # JPEG：glb 内嵌体积约为 PNG 的 1/5
    # 改用新贴图 + 新 UV，删除旧 UV 与旧图
    src_tex.image = img; nt.nodes.remove(uvn); nt.nodes.remove(dst)
    me_.uv_layers.remove(me_.uv_layers[old_uv]); me_.uv_layers[0].name = 'UVMap'
    for im in list(bpy.data.images):
        if im is not img and im.name.startswith('tripo'): bpy.data.images.remove(im)
    print('rebake', path, size)

import numpy as np
V = [v.co.copy() for v in me.vertices]
def band(z0_, z1_, f=lambda c: True): return [c for c in V if z0_ <= c.z <= z1_ and f(c)]
def cen(cs): return sum(cs, Vector()) / max(1, len(cs))
P = human_spec(H=H, heads=6.5)
Z = P['Z']
sh_z = Z['shoulder'] - 0.015 * H
torso_half = max(abs(c.x) for c in band(sh_z - 0.06 * H, sh_z - 0.03 * H, lambda c: abs(c.x) < 0.2 * H and abs(c.y) < 0.12 * H))
def axdist(c, a, d): q = c - a; return (q - d * q.dot(d)).length
# —— 手臂：肘 / 腕截面中心 → 手臂轴；从躯干外缘沿轴向外扫描，找到截面完全脱离躯干的位置 = 肩切面
ARM = {}
for side, s in (('l', 1), ('r', -1)):
    tip = max(V, key=lambda c: s * c.x)
    S0 = Vector((s * torso_half * 0.78, 0.0, sh_z))
    d = (tip - S0); L = d.length; d.normalize()
    def ctr(p, d=d):
        cs = [c for c in V if abs((c - p).dot(d)) < 0.012 * H and (c - p).length < 0.09 * H]
        return cen(cs) if cs else p
    E = ctr(S0 + d * L * 0.43); W = ctr(S0 + d * L * 0.80)
    ax = (W - E).normalized()                       # 前臂轴
    Sj = Vector((s * torso_half * 0.80, E.y, sh_z))
    u = (E - Sj).normalized()                       # 上臂轴
    r_ref = 0.03 * H
    A0 = Sj + u * (E - Sj).length * 0.28            # 肩切面（腋下附近，肩头留在躯干上做柔和过渡）
    nE = (u + ax).normalized()                      # 肘切面法向 = 上臂 / 前臂角平分线
    ARM[side] = dict(E=E, W=W, ax=ax, u=u, nE=nE, Sj=Sj, A0=A0, tip=tip, r=r_ref, s=s, d=d)
    print('arm', side, 'Sj', [round(a, 3) for a in Sj], 'cut', [round(a, 3) for a in A0], 'E', [round(a, 3) for a in E])
arm_angle = math.degrees(math.acos(max(-1, min(1, -ARM['l']['d'].z))))
# —— 腿：裆部高度（两腿之间出现网格的最高点）→ 大腿切面略低于裆部；膝 / 鞋口水平切
crotch = 0.3 * H
for i in range(200):
    z = 0.3 * H + i * 0.002 * H
    if any(abs(c.x) < 0.012 * H and abs(c.y) < 0.07 * H and abs(c.z - z) < 0.004 * H for c in V): crotch = z; break
z_leg = crotch - 0.012 * H
def leg_ctr(z, side): return cen(band(z - 0.012 * H, z + 0.012 * H, lambda c: c.x * side > 0.005 * H and abs(c.x) < 0.14 * H))
KL, KR = leg_ctr(Z['knee'], 1), leg_ctr(Z['knee'], -1)
AL, AR = leg_ctr(0.06 * H, 1), leg_ctr(0.06 * H, -1)
z_knee = (KL.z + KR.z) / 2
z_shoe = 0.085 * H
# 颈部切面：实测——肩线到 1.5 头之间，前半身（y<0）水平截面宽度最小处（戴帽子使脸比 6.5 头身理论位置低）
_nw = []
for i in range(40):
    z = sh_z + i * 0.003 * H
    xs = [abs(c.x) for c in V if abs(c.z - z) < 0.004 * H and c.y < 0.0 and abs(c.x) < 0.2 * H]
    if xs: _nw.append((max(xs), z))
print('neckScan', [(round(w, 3), round(z, 3)) for w, z in _nw[::4]])
z_neck = min(_nw)[1] if _nw else Z['chin'] - 0.035 * H
print('crotch', round(crotch, 3), 'zLeg', round(z_leg, 3), 'knee', round(z_knee, 3), 'neck', round(z_neck, 3), 'armAngle', round(arm_angle, 1))

# 烘焙源：原始网格（旧 UV + 草模贴图）的副本；拆分后的部件从它投射烘焙（封口 / 套筒也取到邻近表面颜色）
# ================================================================ 逐部件拆分
bm = _bm.new(); bm.from_mesh(me)
uvl = bm.loops.layers.uv.active
def cut(co, no, pred):
    fs = [f for f in bm.faces if pred(f.calc_center_median())]
    es = {e for f in fs for e in f.edges}; vs = {v for f in fs for v in f.verts}
    _bm.ops.bisect_plane(bm, geom=list(vs) + list(es) + fs, dist=1e-6, plane_co=co, plane_no=no)
def in_arm(c, A):
    if A['s'] * c.x < torso_half * 0.5: return False
    if (c - A['E']).dot(A['nE']) > 0: return axdist(c, A['E'], A['ax']) < 0.06 * H     # 前臂 / 手
    return (c - A['A0']).dot(A['u']) > -0.01 * H and axdist(c, A['Sj'], A['u']) < 0.055 * H
for A in ARM.values():
    for p, n in ((A['A0'], A['u']), (A['E'], A['nE']), (A['W'], A['ax'])): cut(p, n, lambda c, A=A: in_arm(c, A))
leg_pred = lambda c: c.z < z_leg + 0.03 * H and abs(c.x) < 0.2 * H
cut(Vector((0, 0, z_leg)), Vector((0, 0, 1)), lambda c: leg_pred(c) and abs(c.x) > 0.004 * H)
for z in (z_knee, z_shoe): cut(Vector((0, 0, z)), Vector((0, 0, 1)), leg_pred)
cut(Vector((0, 0, z_neck)), Vector((0, 0, 1)), lambda c: abs(c.x) < 0.16 * H and abs(c.z - z_neck) < 0.06 * H)
PARENT = {'head': 'torso', 'pack': 'torso'}
for side in 'lr':
    PARENT.update({f'upperarm_{side}': 'torso', f'forearm_{side}': f'upperarm_{side}', f'hand_{side}': f'forearm_{side}',
                   f'thigh_{side}': 'torso', f'shin_{side}': f'thigh_{side}', f'foot_{side}': f'shin_{side}'})
NAMES = ['torso'] + list(PARENT)
def classify(c):
    if c.z > z_neck and abs(c.x) < 0.17 * H: return 'head'
    for side, A in ARM.items():
        if (c - A['A0']).dot(A['u']) > 0 and in_arm(c, A):
            if (c - A['W']).dot(A['ax']) > 0: return f'hand_{side}'
            if (c - A['E']).dot(A['nE']) > 0: return f'forearm_{side}'
            return f'upperarm_{side}'
    if c.z < z_leg and abs(c.x) < 0.2 * H:
        side = 'l' if c.x > 0 else 'r'
        return f'foot_{side}' if c.z < z_shoe else f'shin_{side}' if c.z < z_knee else f'thigh_{side}'
    return 'torso'
# 贴图取色（背包 / 背带：橙黄）
mat = me.materials[0]; tex_img = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').image
tw, th = tex_img.size; PX = np.array(tex_img.pixels[:], dtype=np.float32).reshape(th, tw, 4)
def face_rgb(f):
    u = sum((l[uvl].uv for l in f.loops), Vector((0, 0))) / len(f.loops)
    return PX[int((u.y % 1) * (th - 1)), int((u.x % 1) * (tw - 1)), :3]
def is_pack_col(rgb):
    import colorsys
    h_, s_, v_ = colorsys.rgb_to_hsv(*[float(x) for x in rgb]); return 0.07 < h_ < 0.17 and s_ > 0.5 and v_ > 0.35
part = bm.faces.layers.int.new('part')
bm.faces.ensure_lookup_table()
PART = {}
for f in bm.faces:
    c = f.calc_center_median(); p = classify(c)
    if p in ('torso', 'upperarm_l', 'upperarm_r') and Z['waist'] - 0.08 * H < c.z < sh_z + 0.06 * H and is_pack_col(face_rgb(f)): p = 'pack'
    PART[f] = p
# 背包碎块（< 8 面）还原
seen = set()
for f in bm.faces:
    if PART[f] != 'pack' or f in seen: continue
    st = [f]; comp = []; seen.add(f)
    while st:
        a = st.pop(); comp.append(a)
        for e in a.edges:
            for b in e.link_faces:
                if b not in seen and PART[b] == 'pack': seen.add(b); st.append(b)
    if len(comp) < 8:
        for a in comp: PART[a] = classify(a.calc_center_median())
for f in bm.faces: f[part] = NAMES.index(PART[f])
# 记录接缝顶点的邻居部件
NB = {}
seam = [e for e in bm.edges if len(e.link_faces) == 2 and e.link_faces[0][part] != e.link_faces[1][part]]
for e in seam:
    a, b = e.link_faces[0][part], e.link_faces[1][part]
    for v in e.verts:
        k = tuple(round(x, 5) for x in v.co); NB.setdefault(k, set()).update((a, b))
class _VUV(dict):
    """顶点 → UV（按坐标；split_edges 复制出的顶点也能查到）"""
    def k(self, v): return tuple(round(x, 5) for x in v.co)
    def get(self, v, d=None): return dict.get(self, self.k(v), d)
    def setdefault(self, v, d): return dict.setdefault(self, self.k(v), d)
    def __setitem__(self, v, d): dict.__setitem__(self, self.k(v), d)
    def update(self, m):
        for v, d in m.items(): self[v] = d
VUV = _VUV()
for f in bm.faces:
    for l in f.loops: VUV.setdefault(l.vert, Vector(l[uvl].uv))
_bm.ops.split_edges(bm, edges=seam)
# —— 每个部件封口
RINGS = {n: [] for n in NAMES}   # 部件 → [(中心, 法向(向外), 半径, 邻居)]
OVL = 0.028 * H
def loops_of(pid):
    # 只取切缝边（两端都是接缝顶点）；草模原有开口的边不参与，避免与切缝连成一个大环横跨脸部
    es = [e for e in bm.edges if len(e.link_faces) == 1 and e.link_faces[0][part] == pid
          and all(tuple(round(x, 5) for x in v.co) in NB for v in e.verts)]
    left = set(es); out = []
    while left:
        e0 = left.pop(); grp = [e0]; st = [e0]
        while st:
            e = st.pop()
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in left: left.discard(e2); grp.append(e2); st.append(e2)
        out.append(grp)
    return out
def set_uv(faces, src_of):
    # 封口 / 套筒面：整面统一取一个 UV（单色），避免三个角落在不同贴图岛上拉出条纹
    for f in faces:
        uv = next((src_of(v) for v in f.verts if VUV.get(v) is not None), Vector((0, 0)))
        for l in f.loops: l[uvl].uv = uv
for pid, nm in enumerate(NAMES):
    pf = [f for f in bm.faces if f[part] == pid]
    if not pf: print('WARN empty part', nm); continue
    pc = cen([v.co for f in pf for v in f.verts])
    for grp in loops_of(pid):
        vs = list({v for e in grp for v in e.verts})
        c = cen([v.co for v in vs]); rad = sum((v.co - c).length for v in vs) / len(vs)
        cnt = {}
        for v in vs:
            for q in NB.get(tuple(round(x, 5) for x in v.co), ()):
                if q != pid: cnt[q] = cnt.get(q, 0) + 1
        nb = NAMES[max(cnt, key=cnt.get)] if cnt else None
        n = (c - pc); n = n.normalized() if n.length > 1e-6 else Vector((0, 0, 1))
        if nm == 'pack':
            n = (Vector((0, 0, c.z)) - c); n.z = 0; n = n.normalized() if n.length > 1e-6 else Vector((0, 1, 0))
        near = lambda v, vs=vs: min(vs, key=lambda u: (u.co - v.co).length)
        if len(vs) < 3 or nb is None: continue          # 草模原有开口（非切口）保持原样
        if nb is not None and PARENT.get(nm) == nb and nm != 'pack' and rad > 0.004 * H:
            # 子部件：内衬套筒伸入父部件（略收窄），末端封口
            r_ = _bm.ops.extrude_edge_only(bm, edges=grp)
            nv = [g for g in r_['geom'] if isinstance(g, _bm.types.BMVert)]
            sidef = [g for g in r_['geom'] if isinstance(g, _bm.types.BMFace)]
            for g in sidef: g[part] = pid
            for v in nv: v.co = c + (v.co - c) * 0.86 + n * OVL
            nsrc = {v: VUV.get(near(v), Vector((0, 0))) for v in nv}
            VUV.update(nsrc)
            ne = [e for e in bm.edges if len(e.link_faces) == 1 and all(v in nsrc for v in e.verts)]
            fl = _bm.ops.holes_fill(bm, edges=ne, sides=0)['faces']
            for f in fl: f[part] = pid
            set_uv(sidef, lambda v: VUV.get(v, Vector((0, 0))))
            set_uv(fl, lambda v: VUV.get(v, Vector((0, 0))))
            RINGS[nm].append((c, n, rad, nb, 'sleeve'))
        else:
            # 父部件开口 / 背包内侧：封口；关节开口做轻微圆顶，背包向身体内侧压一点厚度
            fl = _bm.ops.holes_fill(bm, edges=grp, sides=0)['faces']
            for f in fl: f[part] = pid
            if fl:
                pk = _bm.ops.poke(bm, faces=fl)
                cv = pk['verts']
                for v in cv:
                    VUV[v] = VUV.get(near(v), Vector((0, 0)))
                    lift = 0.006 * H if nm == 'pack' else -rad * 0.3 if nb == 'head' else rad * 0.25 if nb else 0.0
                    v.co = v.co + n * lift
                for f in pk['faces']: f[part] = pid
                set_uv(pk['faces'], lambda v: VUV.get(v, Vector((0, 0))))
            RINGS[nm].append((c, n, rad, nb, 'cap'))
_bm.ops.triangulate(bm, faces=bm.faces)
bm.to_mesh(me); bm.free(); me.update()
print('parts', json.dumps({nm: sum(1 for p in me.polygons if p.attributes if False) for nm in []}))
cnt = {}
pa = me.attributes['part'].data
for p in me.polygons: cnt[NAMES[pa[p.index].value]] = cnt.get(NAMES[pa[p.index].value], 0) + 1
print('parts', json.dumps(cnt), 'tris', len(me.polygons))
rebake(src)

# ================================================================ 骨架（关节取自切面中心）
def ring(nm, nb):
    rs = [r for r in RINGS[nm] if r[3] == nb]
    return max(rs, key=lambda r: r[2]) if rs else None
J = {}
for side, A in ARM.items():
    rS = ring(f'upperarm_{side}', 'torso'); rE = ring(f'forearm_{side}', f'upperarm_{side}'); rW = ring(f'hand_{side}', f'forearm_{side}')
    S = A['Sj']
    E = rE[0] if rE else A['E']; W = rW[0] if rW else A['W']
    rH = ring(f'thigh_{side}', 'torso'); rK = ring(f'shin_{side}', f'thigh_{side}'); rA = ring(f'foot_{side}', f'shin_{side}')
    K = (KL if side == 'l' else KR); An = (AL if side == 'l' else AR)
    Hj = Vector(((rH[0].x if rH else K.x * 1.05), 0.0, Z['hip']))
    K = Vector((rK[0].x, rK[0].y, z_knee)) if rK else K
    J[side] = dict(S=S, E=E, W=W, T=A['tip'], Hj=Hj, K=K, A=An)
bones = [('hips', (0, 0, Z['hips']), None), ('spine', (0, 0, Z['spine']), 'hips'), ('chest', (0, 0, Z['chest']), 'spine'),
         ('neck', (0, 0, Z['neck']), 'chest'), ('head', (0, 0, Z['chin'] + 0.01 * H), 'neck')]
for side, j in J.items():
    s = 1 if side == 'l' else -1
    bones += [(f'shoulder_{side}', (s * 0.03 * H, 0, sh_z + 0.005 * H), 'chest'), (f'upperarm_{side}', tuple(j['S']), f'shoulder_{side}'),
              (f'forearm_{side}', tuple(j['E']), f'upperarm_{side}'), (f'hand_{side}', tuple(j['W']), f'forearm_{side}'),
              (f'thigh_{side}', tuple(j['Hj']), 'hips'), (f'shin_{side}', tuple(j['K']), f'thigh_{side}'), (f'foot_{side}', tuple(j['A']), f'shin_{side}')]
print('joints', json.dumps({k: [round(a, 3) for a in v] for k, v in J['l'].items()}))

# ================================================================ 部件 → 独立物体 + 各自权重
BLEND = 0.035 * H
def ss(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def seam_w(c, rc, rn, rr):
    """接缝处 0.5，离开接缝 BLEND 后归零（只在开口附近生效）"""
    dpl = abs((c - rc).dot(rn)); lat = ((c - rc) - rn * (c - rc).dot(rn)).length
    if lat > rr * 1.8 + 0.01 * H: return 0.0
    return 0.5 * (1 - ss(dpl / BLEND))
BONE_OF = {'head': 'head', 'pack': 'chest'}
for side in 'lr':
    for b in ('upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot'): BONE_OF[f'{b}_{side}'] = f'{b}_{side}'
def torso_base(c):
    if c.z >= Z['chest']: return {'chest': 1.0}
    if c.z >= Z['spine']: t = (c.z - Z['spine']) / (Z['chest'] - Z['spine']); return {'spine': 1 - t, 'chest': t}
    if c.z >= Z['hips']: t = (c.z - Z['hips']) / (Z['spine'] - Z['hips']); return {'hips': 1 - t, 'spine': t}
    return {'hips': 1.0}
SEAM_BONE = lambda nm: 'neck' if nm == 'head' else BONE_OF.get(nm)
def make_weight(nm):
    base_b = BONE_OF.get(nm)
    def w(c):
        if nm == 'torso': W_ = torso_base(c)
        elif nm == 'pack':
            W_ = torso_base(c) if c.z < Z['chest'] else {'chest': 1.0}
            return W_
        else: W_ = {base_b: 1.0}
        # 接缝：本部件的每个开口 → 与邻居骨骼 50/50 过渡
        for (rc, rn, rr, nb, kind) in RINGS[nm]:
            if nb is None or nb == 'pack' or nm == 'pack': continue
            ob = 'neck' if 'head' in (nm, nb) else (BONE_OF.get(nb) if nb != 'torso' else 'chest' if 'arm' in nm else 'hips')
            if nm == 'torso': ob = SEAM_BONE(nb) if nb != 'head' else 'neck'
            x = seam_w(c, rc, rn, rr)
            if x <= 0: continue
            W_ = {k: v * (1 - x) for k, v in W_.items()}; W_[ob] = W_.get(ob, 0) + x
        return W_
    return w
objs = []
for pid, nm in enumerate(NAMES):
    o = src.copy(); o.data = src.data.copy(); o.name = f'P_{nm}'; bpy.context.scene.collection.objects.link(o)
    b2 = _bm.new(); b2.from_mesh(o.data); lay = b2.faces.layers.int['part']
    _bm.ops.delete(b2, geom=[f for f in b2.faces if f[lay] != pid], context='FACES')
    b2.to_mesh(o.data); b2.free()
    if len(o.data.polygons) == 0: bpy.data.objects.remove(o, do_unlink=True); continue
    reg(o, make_weight(nm)); objs.append(o)
bpy.data.objects.remove(src, do_unlink=True)
rig, mesh = make_rig(bones, sockets=[('prop_r', tuple(J['r']['T']), 'hand_r')])

# —— 通用动作；手臂静止张角与通用约定（9°）的差，补偿到上臂侧摆
P['Z'] = dict(Z); P['legLen'] = Z['hip'] - 0.045 * H
dz = arm_angle - 9.0
_clip0 = _clip
def _clip_comp(rig_, name, length, keys, cyclic=True, hit=None):
    keys = dict(keys)
    for b_, sg in (('upperarm_l', -1), ('upperarm_r', 1)):
        ks = keys.get(b_) or [(0, {}), (length, {})]
        out = []
        for f, v in ks:
            v = dict(v); r = list(v.get('r', (0, 0, 0))); r[2] += sg * dz; v['r'] = tuple(r); out.append((f, v))
        keys[b_] = out
    return _clip0(rig_, name, length, keys, cyclic, hit)
globals()['_clip'] = _clip_comp
human_clips(rig, P)
globals()['_clip'] = _clip0
print('armComp', round(dz, 1))
sheet('check', H, HUMAN_SHEET_POSES)
sheet('body', H * 0.62, views=('front', 'q34', 'side', 'back'), center=Z['hips'])
sheet('detail', H * 0.5, [('throw', 9, 'q34'), ('throw', 14, 'front'), ('walk', 8, 'front'), ('wave', 16, 'q34'), ('run', 6, 'back'), ('talk', 15, 'front')], views=('front', 'back'), res=380, center=Z['chest'])
sheet('face', H * 0.22, views=('front', 'q34', 'side'), center=Z['eye'] - 0.01 * H, res=400)
COLORS[:] = []
export_human('hero_m', '男主角', P, rig, mesh, recolor=[])

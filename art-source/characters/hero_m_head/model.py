# 男主角 · 头部阶段：头部 / 头发 / 帽子 —— 三个独立部件逐个雕刻（低多边形切面风格，与用户草模一致：平直着色）
# 尺寸取自用户草模 C 号人物（下巴 z≈1.30、帽顶 1.60、脸半宽≈0.125、眼睛 z≈1.43），造型参照已确认效果图。
#   头部 Head：四边形球 → 颅骨 / 下颌 / 下巴 / 面部压平 / 脸颊塑形 → 眼窝浅凹槽 + 鼻梁 → 耳朵、脖子；五官为正面投影贴图
#   头发 Hair：贴头发壳 + 尖刺发束（扁透镜截面、二次曲线走向、渐尖），刘海 / 鬓角 / 两侧 / 后脑两排
#   帽子 Cap ：帽冠（白色前片 + 红色侧后片、6 条缝线凹槽、顶扣、后开口 + 调节带、壁厚）+ 弯曲帽檐
import bmesh as _bm
import numpy as np
reset('hero_m_head')
H = 1.60
C = Vector((0.0, 0.006, 1.414))          # 头部中心
RX, RY, RZ = 0.101, 0.112, 0.121         # 颅骨半径（左右 / 前后 / 上下）
TEXDIR = D('art-source', 'characters', 'hero_m_head', 'tex'); os.makedirs(TEXDIR, exist_ok=True)
VIEWS.update({'hf': (-4, 0.0), 'hq': (-6, 35.0), 'hs': (-4, 90.0), 'hb': (-8, 160.0), 'hq2': (-6, -35.0)})

def ss(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def gauss(d2, s): return math.exp(-d2 / (2 * s * s))

# ---------------------------------------------------------------- 材质（每个材质都带图像节点，Workbench 贴图模式 / glTF 都可用）
def solid_img(name, rgb, n=4):
    im = bpy.data.images.new(name, n, n, alpha=False); im.pixels = [c for _ in range(n * n) for c in (*rgb, 1.0)]
    return im
def mk_mat(name, rgb, img=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); bs.inputs['Roughness'].default_value = 0.85
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img or solid_img(f'IMG_{name}', rgb); nt.links.new(tx.outputs['Color'], bs.inputs['Base Color'])
    nt.nodes.active = tx; m.diffuse_color = (*rgb, 1.0)
    return m

def quad_sphere(cuts):
    bm = _bm.new(); _bm.ops.create_cube(bm, size=2.0)
    _bm.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts: v.co.normalize()
    return bm

def to_obj(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = new_obj(name, me); smooth(o, False); return o

# ================================================================ 1. 头部
SKIN = (0.98, 0.82, 0.69)
def head_shape(p):
    """单位球上的点 → 头部表面（局部坐标，未加中心）"""
    x, y, z = p.x, p.y, p.z
    lo = max(0.0, -z)                                # 下半部
    front = max(0.0, -y)
    # 下颌：越往下越窄；后下方大幅内收（接脖子）
    x *= 1 - 0.30 * lo ** 1.8
    if y > 0: y *= 1 - 0.50 * lo ** 1.3
    else: y *= 1 - 0.10 * lo
    z *= 1 + 0.10 * lo ** 1.2                        # 下巴向下延伸
    X, Y, Z = x * RX, y * RY, z * RZ
    # 下巴前伸 + 收尖
    Y -= 0.010 * lo ** 2.2 * front
    X *= 1 - 0.12 * lo ** 3
    # 面部：前方压平（动漫脸较平），眉骨以上保持圆
    if y < 0: Y *= 1 - 0.13 * ss((0.55 - z) / 0.6) * front
    # 脸颊：前侧下方轻微鼓起
    Y -= 0.009 * gauss((p.x - (-0.55 if p.x < 0 else 0.55)) ** 2 + (p.z + 0.25) ** 2, 0.25) * front
    # 后脑饱满
    if y > 0 and z > -0.2: Y *= 1 + 0.06 * ss((z + 0.2) / 0.6)
    return Vector((X, Y, Z))
EYE_X, EYE_Z = 0.040, 1.428
# ---- 头部 = 有符号距离场（SDF）形体组合；局部坐标原点 C，-Y = 前
def _len(a): return np.sqrt((a * a).sum(-1))
def sd_ell(p, c, r):
    q = (p - np.array(c)) / np.array(r); k = _len(q); return (k - 1.0) * min(r)
def sd_cap(p, a, b, ra, rb):
    a = np.array(a); b = np.array(b); ba = b - a; pa = p - a
    h = np.clip((pa * ba).sum(-1) / (ba * ba).sum(), 0, 1)
    return _len(pa - ba * h[..., None]) - (ra + (rb - ra) * h)
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)
def smax(a, b, k): return -smin(-a, -b, k)
def head_sdf(p):
    # 正中侧面轮廓目标（y 前缘）：额顶 -0.075 → 额 -0.102（近垂直）→ 鼻梁 -0.104 → 鼻尖 -0.117 → 人中 -0.096
    #   → 上唇 -0.097 → 嘴缝浅凹 → 下唇 -0.095 → 唇下凹 → 下巴 -0.094 → 下巴底 z≈-0.120 → 下颌底回收到脖子
    d = sd_ell(p, (0, 0.010, 0.030), (0.096, 0.105, 0.102))                  # 颅骨
    d = smin(d, sd_ell(p, (0, -0.030, 0.040), (0.083, 0.072, 0.075)), 0.03)  # 前额
    d = smin(d, sd_ell(p, (0, -0.024, -0.040), (0.084, 0.072, 0.074)), 0.03) # 面部体块（宽脸）
    for sx in (-1, 1):
        d = smin(d, sd_ell(p, (sx * 0.054, -0.056, -0.018), (0.030, 0.028, 0.028)), 0.02)   # 颧骨 / 脸颊
        d = smin(d, sd_cap(p, (sx * 0.068, 0.008, -0.052), (sx * 0.030, -0.064, -0.104), 0.021, 0.018), 0.020)  # 下颌线
    d = smin(d, sd_ell(p, (0, -0.068, -0.101), (0.034, 0.025, 0.019)), 0.014)              # 下巴（偏方）
    for sx in (-1, 1):                                                                       # 眼窝（浅，只在两侧）
        d = smax(d, -sd_ell(p, (sx * 0.040, -0.110, 0.014), (0.022, 0.012, 0.016)), 0.010)
    d = smin(d, sd_cap(p, (0, -0.099, 0.000), (0, -0.1070, -0.026), 0.0030, 0.0055), 0.010)  # 鼻梁 → 鼻头
    for sx in (-1, 1):
        d = smin(d, sd_ell(p, (sx * 0.0058, -0.0995, -0.0305), (0.0042, 0.0038, 0.0036)), 0.005)  # 鼻翼
    d = smin(d, sd_ell(p, (0, -0.0875, -0.0690), (0.0090, 0.0060, 0.0034)), 0.006)         # 上唇
    d = smin(d, sd_ell(p, (0, -0.0865, -0.0815), (0.0080, 0.0065, 0.0042)), 0.006)         # 下唇
    d = smax(d, -sd_ell(p, (0, -0.0945, -0.0757), (0.0095, 0.0040, 0.0007)), 0.0010)       # 嘴缝（浅）
    for sx in (-1, 1):
        d = smax(d, -sd_ell(p, (sx * 0.0110, -0.0905, -0.0752), (0.0025, 0.0035, 0.0022)), 0.0022)  # 嘴角
    d = smax(d, -sd_ell(p, (0, -0.0935, -0.0905), (0.0095, 0.0030, 0.0022)), 0.0030)       # 唇下凹
    return d
O_RAY = np.array((0.0, -0.005, -0.005))
def project(dirs, off=0.0):
    """从 O_RAY 沿方向射线二分求 head_sdf = off 的表面点（头部形体对该点星形）"""
    dirs = dirs / _len(dirs)[..., None]; lo = np.zeros(len(dirs)); hi = np.full(len(dirs), 0.3)
    for _ in range(36):
        mid = (lo + hi) / 2; inside = head_sdf(O_RAY + dirs * mid[:, None]) < off
        lo = np.where(inside, mid, lo); hi = np.where(inside, hi, mid)
    return O_RAY + dirs * ((lo + hi) / 2)[:, None]
def head_surf(dirv, k=1.0):
    q = project(np.array([[dirv.x, dirv.y, dirv.z]]), 0.0 if k >= 1 else -(1 - k) * 0.1)[0]; return C + Vector(q)
bm = quad_sphere(12)
vs = list(bm.verts); P_ = project(np.array([[v.co.x, v.co.y, v.co.z] for v in vs]))
for v, q in zip(vs, P_): v.co = C + Vector(q)
# 鼻 / 嘴 / 眼窝区域局部加密（约 2 mm 间距，保住鼻梁、鼻翼、唇形）
def _face_zone(c, pad=0.0):
    q = c - C; return q.y < -0.065 and abs(q.x) < 0.040 + pad and -0.100 - pad < q.z < 0.022 + pad
for cuts in (1,):
    es = [e for e in bm.edges if all(_face_zone(v.co, 0.012) for v in e.verts)]
    _bm.ops.subdivide_edges(bm, edges=es, cuts=cuts, use_grid_fill=True)
    _bm.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    vs = list(bm.verts); P_ = project(np.array([[v.co.x - C.x, v.co.y - C.y, v.co.z - C.z] for v in vs]) - O_RAY)
    for v, q in zip(vs, P_): v.co = C + Vector(q)
# 均匀化：沿表面松弛 3 次再投影（避免射线投影在鼻 / 唇附近挤压）
for _ in range(2):
    newc = [sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges) for v in vs]
    P_ = project(np.array([[c.x - C.x, c.y - C.y, c.z - C.z] for c in newc]) - O_RAY)
    for v, q in zip(vs, P_): v.co = C + Vector(q)
head = to_obj(bm, 'Head')

# 耳朵：外耳轮 + 内凹（两层椭球，内层压扁作凹陷）
def ear(sx):
    bm = quad_sphere(2)
    for v in bm.verts:
        p = v.co.copy()
        # 局部：厚（x）、宽（y）、高（z）；外侧面向内凹
        inner = p.x * sx > 0.2
        X = p.x * 0.011 * (0.45 if inner else 1.0); Y = p.y * 0.021; Z = p.z * 0.033 * (1 - 0.18 * max(0, -p.z))
        v.co = Vector((X, Y, Z))
    R = Matrix.Rotation(math.radians(-24 * sx), 4, 'Z') @ Matrix.Rotation(math.radians(8), 4, 'X')
    bm.transform(Matrix.Translation((sx * 0.099, 0.012, 1.405)) @ R)
    return to_obj(bm, f'Ear_{"l" if sx > 0 else "r"}')
ears = [ear(1), ear(-1)]
# 脖子：上端藏进下颌、下端伸进衣领
bm = _bm.new(); _bm.ops.create_cone(bm, cap_ends=False, segments=8, radius1=0.050, radius2=0.046, depth=0.15)
bm.transform(Matrix.Translation((0, 0.018, 1.275)))
neck = to_obj(bm, 'Neck')
# 五官贴图：正面平面投影（u = x、v = z），只在面向前方的区域可见
TS = 1024; U0, V0, SPAN = -0.16, 1.26, 0.32
def face_texture():
    xs = U0 + (np.arange(TS) + 0.5) / TS * SPAN; zs = V0 + (np.arange(TS) + 0.5) / TS * SPAN
    X, Z = np.meshgrid(xs, zs)                      # 行 = z（图像自下而上）
    img = np.ones((TS, TS, 3), np.float32) * np.array(SKIN, np.float32)
    def paint(mask, rgb, a=1.0):
        m = np.clip(mask, 0, 1)[..., None] * a; img[:] = img * (1 - m) + np.array(rgb, np.float32) * m
    def soft(sd, w=0.0006): return np.clip(0.5 - sd / w, 0, 1)   # 有符号距离 → 抗锯齿遮罩
    # 腮红
    for sx in (-1, 1):
        paint(np.exp(-(((X - sx * 0.058) / 0.016) ** 2 + ((Z - 1.392) / 0.008) ** 2)), (0.98, 0.62, 0.58), 0.35)
    for sx in (-1, 1):
        ex, ez = sx * EYE_X, EYE_Z
        lx = (X - ex) * sx                           # 向外为正
        # 眼白：上缘平直略斜、下缘圆
        ax, az = 0.0225, 0.0190
        top = ez + az * 0.78 - 0.0035 * (lx / ax) ** 2 + 0.0018 * (lx / ax)
        bot = ez - az * np.sqrt(np.clip(1 - (lx / ax) ** 2, 0, 1))
        inside = (np.abs(lx) < ax) & (Z < top) & (Z > bot)
        sd_sclera = np.where(inside, -np.minimum.reduce([top - Z, Z - bot, ax - np.abs(lx)]), 0.001)
        paint(soft(sd_sclera), (0.97, 0.96, 0.94))
        m_eye = soft(sd_sclera)
        # 虹膜（深棕，上暗下亮）+ 瞳孔 + 高光；裁在眼白内
        ix, iz = ex - sx * 0.0015, ez - 0.0010
        r = np.sqrt((X - ix) ** 2 + ((Z - iz) / 1.12) ** 2) * 0.88
        t = np.clip((Z - (iz - 0.012)) / 0.024, 0, 1)
        iris = np.stack([0.50 - 0.22 * t, 0.53 - 0.22 * t, 0.48 - 0.20 * t], -1)   # 灰绿（草模）
        mi = soft(r - 0.0118) * m_eye; img[:] = img * (1 - mi[..., None]) + iris * mi[..., None]
        paint(soft(r - 0.0118) * soft(0.0098 - r) * m_eye, (0.16, 0.09, 0.06), 0.8)    # 虹膜外圈
        paint(soft(r - 0.0058) * m_eye, (0.07, 0.04, 0.03))
        hx, hz = ix + sx * 0.0040, iz + 0.0052
        paint(soft(np.sqrt((X - hx) ** 2 + (Z - hz) ** 2) - 0.0028) * m_eye, (1, 1, 1))
        paint(soft(np.sqrt((X - (ix - sx * 0.0035)) ** 2 + (Z - (iz - 0.0055)) ** 2) - 0.0013) * m_eye, (1, 1, 1), 0.8)
        # 上眼线（粗，外眼角略上挑）
        lash = (np.abs(Z - (top + 0.0008)) < 0.0028 + 0.0010 * np.clip(lx / ax, 0, 1)) & (lx > -ax * 1.02) & (lx < ax * 1.12)
        paint(lash.astype(np.float32), (0.12, 0.07, 0.05))
        flick = (lx > ax * 0.85) & (lx < ax * 1.25) & (np.abs(Z - (top + 0.0006 + (lx - ax * 0.85) * 0.35)) < 0.0012)
        paint(flick.astype(np.float32), (0.12, 0.07, 0.05))
        # 下眼线（细、只外侧一半）
        low = (np.abs(Z - bot + 0.0003) < 0.0006) & (lx > 0.0) & (lx < ax * 0.95)
        paint(low.astype(np.float32), (0.45, 0.28, 0.22), 0.8)
        # 双眼皮线
        crease = (np.abs(Z - (top + 0.0042 - 0.0012 * (lx / ax) ** 2)) < 0.0005) & (np.abs(lx) < ax * 0.8)
        paint(crease.astype(np.float32), (0.70, 0.48, 0.40), 0.7)
        # 眉毛（粗短，内高外低，大部分被刘海遮住）
        bz = ez + 0.027 + 0.004 * np.clip((lx + 0.014) / 0.040, 0, 1)
        brow = (np.abs(Z - bz) < 0.0042 * (1 - 0.45 * np.clip((lx + 0.014) / 0.040, 0, 1))) & (lx > -0.016) & (lx < 0.026)
        paint(brow.astype(np.float32), (0.25, 0.15, 0.10))
    # 嘴唇：淡淡的唇色（形状来自几何）
    paint(np.exp(-((X / 0.013) ** 2 + ((Z - 1.3395) / 0.0075) ** 2)), (0.90, 0.60, 0.55), 0.35)
    im = bpy.data.images.new('TEX_hero_m_face', TS, TS, alpha=False)
    im.pixels = np.concatenate([img, np.ones((TS, TS, 1), np.float32)], -1).ravel().tolist()
    im.filepath_raw = os.path.join(TEXDIR, 'face.png'); im.file_format = 'PNG'; im.save()
    return im
M_SKIN = mk_mat('M_skin', SKIN, face_texture())
for o in [head, neck] + ears:
    o.data.materials.append(M_SKIN)
    uv = o.data.uv_layers.new(name='UVMap')
    for l in o.data.loops:
        c = o.data.vertices[l.vertex_index].co
        uv.data[l.index].uv = ((c.x - U0) / SPAN, (c.z - V0) / SPAN)
    # 侧面 / 背面 / 耳朵 / 脖子：投影到贴图边缘的纯肤色区（避免把眼睛投到后脑）
    if o is head:
        for p in o.data.polygons:
            if p.normal.y > -0.35:
                for li in p.loop_indices: uv.data[li].uv = (0.02, 0.02)
    else:
        for l in o.data.loops: uv.data[l.index].uv = (0.02, 0.02)
bpy.context.view_layer.objects.active = head
for o in [head, neck] + ears: o.select_set(True)
bpy.ops.object.join(); head = bpy.context.active_object; head.name = 'Head'; bpy.ops.object.select_all(action='DESELECT')

# ================================================================ 2. 帽子
RED = (0.80, 0.12, 0.13); WHITE = (0.95, 0.95, 0.93); STRAP = (0.30, 0.08, 0.09)
M_RED = mk_mat('M_cap_red', RED); M_WHITE = mk_mat('M_cap_white', WHITE); M_STRAP = mk_mat('M_cap_strap', STRAP)
HC = Vector((0.0, 0.010, 1.474)); HRX, HRY, HRZ = 0.123, 0.135, 0.138
TILT = Matrix.Rotation(math.radians(-7), 4, 'X')            # 后侧略低
def dome(seg=12, rings=5):
    """低多边形圆顶：seg 瓣（瓣边在 k·360/seg）× rings 圈 + 顶点"""
    bm = _bm.new(); R_ = []
    for i in range(rings):
        th = math.radians(90 * i / rings)
        R_.append([bm.verts.new((math.sin(2 * math.pi * j / seg) * math.cos(th), -math.cos(2 * math.pi * j / seg) * math.cos(th), math.sin(th))) for j in range(seg)])
    top = bm.verts.new((0, 0, 1))
    for i in range(rings - 1):
        for j in range(seg):
            bm.faces.new((R_[i][j], R_[i][(j + 1) % seg], R_[i + 1][(j + 1) % seg], R_[i + 1][j]))
    for j in range(seg): bm.faces.new((R_[-1][j], R_[-1][(j + 1) % seg], top))
    return bm
bm = dome(12, 4)
lay_az = bm.verts.layers.float.new('az')
for v in bm.verts:
    p = v.co; z = max(0.0, p.z)
    az = math.atan2(p.x, -p.y)                               # 0 = 正前
    X, Y, Z = p.x * HRX, p.y * HRY, z * HRZ
    if p.y < 0: Z *= 1 + 0.10 * (-p.y) * (1 - z)               # 卡车帽：前片高挺
    if p.y < 0: Y *= 1 - 0.16 * (-p.y) * z                    # 前片平
    X *= 1 + 0.06 * (1 - abs(p.z - 0.5) * 2)                   # 帽冠偏方
    # 6 条缝线（前中、±60°、±120°、后中）：沿经线的浅凹槽
    seam = min(abs(((az - k * math.pi / 3) + math.pi) % (2 * math.pi) - math.pi) for k in range(6))
    sw = math.sqrt(p.x * p.x + p.y * p.y) * HRX
    dent = 0.0   # 低多边形：帽片由瓣边自然分出，不做缝线凹槽
    q = Vector((X, Y, Z)); n = q.normalized()
    v.co = HC + TILT @ (q - n * dent)
    v[lay_az] = az
# 红白分界（±60° 经线）与后开口（矩形 + 顶部圆角）用平面精确切开，边缘整齐
def bis(co, no):
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    _bm.ops.bisect_plane(bm, geom=g, dist=1e-6, plane_co=co, plane_no=no)
for k in (-1, 1):
    a = k * math.pi / 3
    bis(HC, TILT @ Vector((math.cos(a), math.sin(a), 0)))
OW, OH = 0.030, 0.050
for x in (-OW, OW): bis(HC + TILT @ Vector((x, 0, 0)), TILT @ Vector((1, 0, 0)))
bis(HC + TILT @ Vector((0, 0, OH)), TILT @ Vector((0, 0, 1)))
TI = TILT.inverted()
def loc(c): return TI @ (c - HC)
_bm.ops.delete(bm, geom=[f for f in bm.faces if (lambda q: q.y > 0.05 and abs(q.x) < OW and q.z < OH)(loc(f.calc_center_median()))], context='FACES')
for f in bm.faces:
    q = loc(f.calc_center_median()); az = math.atan2(q.x, -q.y)
    f.material_index = 1 if abs(az) < math.pi / 3 else 0
    f.smooth = False
cap = to_obj(bm, 'Cap'); cap.data.materials.append(M_RED); cap.data.materials.append(M_WHITE)
sol = cap.modifiers.new('wall', 'SOLIDIFY'); sol.thickness = 0.0045; sol.offset = -1; sol.use_rim = True
# 顶扣
bm = quad_sphere(1)
for v in bm.verts: v.co = Vector((v.co.x * 0.011, v.co.y * 0.011, v.co.z * 0.006))
bm.transform(Matrix.Translation(HC + TILT @ Vector((0, 0, HRZ + 0.002))))
btn = to_obj(bm, 'CapButton'); btn.data.materials.append(M_RED)
# 调节带：横跨后开口下缘
bm = _bm.new(); _bm.ops.create_cube(bm, size=1.0)
bm.transform(Matrix.Translation(HC + TILT @ Vector((0, HRY - 0.004, 0.010))) @ Matrix.Diagonal((0.075, 0.006, 0.013, 1)))
strap = to_obj(bm, 'CapStrap'); strap.data.materials.append(M_STRAP)
bv = strap.modifiers.new('bev', 'BEVEL'); bv.width = 0.0025; bv.segments = 1
# 帽檐：沿前方帽口的弧形板，前伸、下压、两侧下弯
NS, NT = 12, 3
bm = _bm.new(); grid = []
for i in range(NS + 1):
    s = -1 + 2 * i / NS; phi = s * math.radians(72)
    base = Vector((math.sin(phi) * HRX * 0.99, -math.cos(phi) * HRY * 0.99, 0.004))
    L = 0.082 * (1 - abs(s) ** 2.2) ** 0.55 + 0.004
    out = Vector((math.sin(phi) * 0.45, -1.0, 0)).normalized()
    row = []
    for j in range(NT + 1):
        t = j / NT
        p = base + out * L * t
        p.z -= L * t * math.tan(math.radians(16)) + 0.020 * (s ** 2) * t ** 1.2
        row.append(bm.verts.new(HC + TILT @ p))
    grid.append(row)
for i in range(NS):
    for j in range(NT):
        f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1])); f.smooth = False
brim = to_obj(bm, 'CapBrim'); brim.data.materials.append(M_RED)
bs_ = brim.modifiers.new('thick', 'SOLIDIFY'); bs_.thickness = 0.0105; bs_.offset = 0; bs_.use_rim = True
bpy.ops.object.select_all(action='DESELECT')
for o in (cap, brim, btn, strap): o.select_set(True)
bpy.context.view_layer.objects.active = cap
for o in (cap, brim, strap):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
bpy.context.view_layer.objects.active = cap
bpy.ops.object.join(); cap = bpy.context.active_object; cap.name = 'Cap'; bpy.ops.object.select_all(action='DESELECT')

# ================================================================ 3. 头发
HAIR = (0.085, 0.055, 0.045); HAIR_D = (0.20, 0.12, 0.08)
M_HAIR = mk_mat('M_hair', HAIR)
def clump(root, tip, bend=Vector(), w=0.024, t=0.009, ring=5, seg=4, twist=0.0, taper=0.75):
    """尖刺发束：二次贝塞尔走向，扁透镜截面（宽 w、厚 t），根部略鼓、末端收尖"""
    bm = _bm.new(); ctrl = (root + tip) / 2 + bend
    def P(u): return root * (1 - u) ** 2 + ctrl * 2 * u * (1 - u) + tip * u * u
    def T(u): return ((ctrl - root) * 2 * (1 - u) + (tip - ctrl) * 2 * u).normalized()
    rings = []
    for k in range(seg):
        u = k / seg; c = P(u); tg = T(u)
        out = (c - C); out = (out - tg * out.dot(tg)).normalized()       # 截面法向：背离头部中心
        side = tg.cross(out).normalized()
        if twist: side, out = (side * math.cos(twist * u) + out * math.sin(twist * u)), (out * math.cos(twist * u) - side * math.sin(twist * u))
        prof = (1 - u) ** taper * (1 + 0.45 * math.sin(math.pi * min(1, u * 1.5)))
        ww, tt = w * 0.5 * prof, t * 0.5 * max(0.25, prof)
        rings.append([bm.verts.new(c + side * math.cos(a) * ww + out * (math.sin(a) * tt + 0.25 * tt * (1 - abs(math.cos(a)))))
                      for a in [2 * math.pi * i / ring for i in range(ring)]])
    tipv = bm.verts.new(P(1.0))
    for k in range(seg - 1):
        for i in range(ring):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % ring], rings[k + 1][(i + 1) % ring], rings[k + 1][i]))
    for i in range(ring): bm.faces.new((rings[-1][i], rings[-1][(i + 1) % ring], tipv))
    bm.faces.new(list(reversed(rings[0])))
    for f in bm.faces: f.smooth = False
    return bm
HB = _bm.new()
def add(bm_):
    me_ = bpy.data.meshes.new('tmp'); bm_.to_mesh(me_); bm_.free(); HB.from_mesh(me_); bpy.data.meshes.remove(me_)
# 发壳：颅骨外扩 3.5%，只保留发际线以上 / 耳后 / 后脑
bm = quad_sphere(7)
_vs = list(bm.verts); _P = project(np.array([[v.co.x, v.co.y, v.co.z] for v in _vs]), -0.0065)
for v, q in zip(_vs, _P): v.co = C + Vector(q)
def keep(c):
    if c.z > 1.478: return True
    if c.y > -0.012 and c.z > 1.352 and abs(c.x) > 0.02 or c.y > 0.030 and c.z > 1.338 + 0.03 * ss((0.06 - c.y) / 0.05): return True
    if c.y > -0.045 and c.z > 1.405 - 0.03 * ss(c.y / 0.04) and abs(c.x) > 0.055: return True        # 鬓角上方
    return False
_bm.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
for f in bm.faces: f.smooth = False
add(bm)
# 刘海：从帽檐下伸出，尖端停在眉毛上方（不挡眼）
# 刘海：5 大束 + 2 小束，从帽檐下伸出，尖端停在眉毛上方（不挡眼）
BANGS = [(-0.072, (-0.100, -0.092, 1.405), 0.042), (-0.048, (-0.068, -0.110, 1.428), 0.050), (-0.022, (-0.034, -0.119, 1.440), 0.052),
         (0.002, (-0.004, -0.121, 1.446), 0.050), (0.026, (0.030, -0.119, 1.441), 0.052), (0.050, (0.070, -0.110, 1.430), 0.050),
         (0.074, (0.102, -0.092, 1.407), 0.042)]
for rx, tip, w in BANGS:
    r = head_surf(Vector((rx / RX, -1.0, (1.485 - C.z) / RZ * 1.6)), 0.93); r.z = 1.480
    add(clump(r, Vector(tip), bend=Vector((0, -0.020, -0.002)), w=w, t=0.022, taper=0.55))
# 鬓角 + 两侧翘发（粗块）
for sx in (-1, 1):
    add(clump(Vector((sx * 0.084, -0.046, 1.455)), Vector((sx * 0.101, -0.058, 1.380)), bend=Vector((sx * 0.010, -0.006, 0)), w=0.026, t=0.012))
    for (ry, rz), (tx_, ty, tz), w in (((-0.030, 1.472), (0.140, -0.055, 1.420), 0.052), ((0.006, 1.468), (0.162, 0.004, 1.410), 0.058),
                                     ((0.046, 1.460), (0.155, 0.072, 1.392), 0.054)):
        r = Vector((sx * 0.080, ry, rz - 0.012))
        add(clump(r, Vector((sx * tx_, ty, tz)), bend=Vector((sx * 0.012, 0, 0.002)), w=w, t=0.018))
# 耳后下垂发束（盖住耳后头皮）
for sx in (-1, 1):
    for ry, tip in ((0.028, (0.112, 0.040, 1.352)), (0.066, (0.104, 0.090, 1.345))):
        add(clump(Vector((sx * 0.080, ry, 1.432)), Vector((sx * tip[0], tip[1], tip[2])), bend=Vector((sx * 0.016, 0.004, 0)), w=0.044, t=0.016))
# 后脑：上排 6 束向外下翘，下排 5 束向后下（粗块，相互交叠）
for row, (zr, n, a0, a1, out_k, down, w) in enumerate(((1.455, 6, 112, 248, 0.054, 0.068, 0.056), (1.408, 5, 130, 230, 0.036, 0.074, 0.052))):
    for i in range(n):
        a = math.radians(a0 + (a1 - a0) * i / (n - 1))
        d = Vector((math.sin(a), -math.cos(a), 0))
        r = head_surf(Vector((d.x, d.y, (zr - C.z) / RZ * 1.3)), 0.96); r.z = zr
        jitter = 0.010 * math.sin(i * 2.3 + row)
        tip = r + d * (out_k + jitter) + Vector((0, 0, -down - 0.6 * jitter))
        add(clump(r, tip, bend=d * 0.012 + Vector((0, 0, 0.002)), w=w, t=0.020, twist=0.3 * math.sin(i)))
me_h = bpy.data.meshes.new('Hair'); HB.to_mesh(me_h); HB.free(); hair = new_obj('Hair', me_h); hair.data.materials.append(M_HAIR)

for o in (head, hair, cap):
    _b = _bm.new(); _b.from_mesh(o.data); _bm.ops.recalc_face_normals(_b, faces=_b.faces[:]); _b.to_mesh(o.data); _b.free()
def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
print('PARTS', json.dumps({o.name: tris(o) for o in (head, hair, cap)}), 'total', sum(tris(o) for o in (head, hair, cap)))
# —— 渲染：组合（平视 4 向）、脸部特写、三部件分解
sheet('head', 0.42, views=('hf', 'hq', 'hs', 'hb'), center=1.43, res=420)
sheet('face', 0.22, views=('hf', 'hq', 'hq2'), center=1.41, res=420)
hair.hide_render = cap.hide_render = True
sheet('bare', 0.20, views=('hf', 'hs', 'hq'), center=1.39, res=420)
hair.hide_render = cap.hide_render = False
cap.location = (0.32, 0, 0.0); hair.location = (-0.32, 0, 0.0)
sheet('parts', 0.60, views=('hf', 'hq', 'hb'), center=1.43, res=420)
cap.location = (0, 0, 0); hair.location = (0, 0, 0)
bpy.ops.wm.save_as_mainfile(filepath=D('art-source', 'characters', 'hero_m_head', 'hero_m_head.blend'))

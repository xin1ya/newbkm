# ============ hkit.py — human character kit (prepended after common.py + kit.py by `bx.py char`) ============
# 中等比例（约 5 头身）卡通人物。所有人物共用同一套骨骼「名称 + 层级 + 朝向」，但骨骼长度、身高、体型各自不同：
# kit 的骨骼一律指向 +Z、roll 0，动画只存旋转 → 同一套动作放在不同比例的骨架上都成立；髋部位移按身高生成。
# 约定同 kit：面朝 -Y，Z 向上，米。人物左侧在 +X（_l），右侧 -X（_r）。
#   pose rot X = 前后摆（下垂的肢体 + = 向后），Y = 扭转，Z = 侧摆（左臂 + = 向外张开）；pose loc = (x, 上, 前)。
# 人物脚本：reset(KEY) -> P = human_spec(...) -> C = palette -> build_human(P) + 专属配件 -> rig_human(P) -> human_clips -> export_human
ASSET_DIR = 'characters'

HUMAN_DEFAULT = dict(
    H=1.55,          # 身高（米）
    head=1.0,        # 头部大小倍率（5 头身基准：头高 0.2H）
    shoulder=1.0,    # 肩宽倍率
    hip=1.0,         # 胯宽倍率
    chest=1.0,       # 胸围倍率
    waist=1.0,       # 腰围倍率
    depth=0.72,      # 躯干厚 / 宽
    limb=1.0,        # 四肢粗细倍率
    leg=1.0,         # 腿长倍率（影响髋高；头身比随之变化）
    arm=1.0,         # 臂长倍率
    belly=0.0,       # 肚腩（0–1）
    bust=0.0,        # 胸部（0–1）
    stoop=0.0,       # 驼背角度（度），烘进所有动作
    sleeve='long',   # long / short / none
    pants='long',    # long / shorts / skirt / dress
    skirt_len=0.2,   # 裙长（H 的比例，从腰往下）
    open_jacket=False,  # 敞开外套：胸前露出 shirt 色竖条
    hair='short',    # short / spiky / long / ponytail / bun / bald / bob
    hat='none',      # none / cap / beanie / bandana / sunhat / nurse / sailor
    shoes='sneaker', # sneaker / boot / sandal
    brows=1.0,       # 眉毛粗细倍率
    eye=1.0,         # 眼睛大小倍率
    gait=1.0,        # 步态幅度倍率（老人 < 1，孩子 > 1）
    bounce=1.0,      # 走路上下起伏倍率
    heads=5.0,       # 头身比：5（中等 Q 版）或 6.5（效果图写实卡通）
    lowpoly=False,   # 低多边形精模：减面 + 平直着色 + 五官画在脸部贴图
    face=None,       # 脸部贴图参数（lowpoly）：见 _face_tex
    jacket_hem=None, # 夹克下摆高度（H 比例）；下摆以下到腰带之间露出 shirt
    cuff=None,       # 卷袖：袖口位置（沿手臂 0–1），袖口环用 top2 色
    collar=False,    # 立领
    cap_front=None,  # 帽子前片颜色槽（如 'brim' = 白色前片）
)

def human_spec(**kw):
    P = dict(HUMAN_DEFAULT); P.update(kw)
    H = P['H']; lg = P['leg']
    if P['heads'] >= 6:
        # 6.5 头身（效果图比例）：头高 H/6.5，关节按真实少年比例
        L = dict(top=1.0, head_c=0.923, eye=0.915, brow=0.945, mouth=0.868, chin=0.846,
                 neck=0.83, shoulder=0.805, chest=0.72, spine=0.62, waist=0.6, hips=0.535, belt=0.555,
                 hip=0.5 * lg, crotch=0.48 * lg, knee=0.27 * lg, ankle=0.045)
        P['Z'] = {k: v * H for k, v in L.items()}
        P['legLen'] = (L['hip'] - 0.045) * H
        P['hr'] = H / 13.0 * P['head']
        P['armLen'] = (0.185 * H, 0.16 * H)
        P['armk'] = 0.8
        return P
    # 关键高度（身高比例），腿长倍率拉伸下半身、压缩上半身，保证头顶 = H
    hipZ = 0.47 * lg / (0.47 * lg + 0.53) if lg != 1.0 else 0.47
    up = (1 - hipZ) / 0.53  # 上半身缩放
    def U(z): return hipZ + (z - 0.47) * up  # 上半身比例坐标 -> 实际比例
    L = dict(
        top=1.0, head_c=U(0.9), eye=U(0.886), brow=U(0.915), mouth=U(0.842), chin=U(0.8),
        neck=U(0.755), shoulder=U(0.725), chest=U(0.665), spine=U(0.575), waist=U(0.57), hips=U(0.5),
        belt=U(0.535), hip=hipZ, crotch=hipZ - 0.02, knee=hipZ * 0.255 / 0.47, ankle=0.055,
    )
    P['Z'] = {k: v * H for k, v in L.items()}
    P['legLen'] = (hipZ - 0.055) * H
    P['hr'] = 0.124 * H * P['head'] * up   # 头半高
    return P

# ---------------------------------------------------------------- body
def _clamp(x, a=0.0, b=1.0): return max(a, min(b, x))

def build_human(P):
    """身体、脸、头发、帽子、服装基础件。返回 dict（head 物体等），供人物脚本加配件。
    lowpoly：建模期间把 tube / blob 的分段压低，结束后所有部件改平直着色（面片分明的低多边形精模）。"""
    if not P['lowpoly']: return _build_human(P)
    g = globals(); t0, b0 = g['tube'], g['blob']
    def tube_lp(*a, seg=12, **kw): return t0(*a, seg=max(6, min(12, round(seg * 0.6))), **kw)
    def blob_lp(*a, seg=24, rings=14, **kw): return b0(*a, seg=max(6, round(seg * 0.5)), rings=max(4, round(rings * 0.55)), **kw)
    g['tube'], g['blob'] = tube_lp, blob_lp
    try:
        out = _build_human(P)
    finally:
        g['tube'], g['blob'] = t0, b0
    lp_finish()
    return out

def lp_finish():
    """人物脚本加完配件后也可再调用：所有已登记部件改平直着色"""
    for n in PARTS:
        o = bpy.data.objects.get(n)
        if o: smooth(o, False)

def lp_parts():
    """人物脚本里做配件时使用的低多边形 tube / blob"""
    g = globals(); t0, b0 = g['tube'], g['blob']
    return (lambda *a, seg=6, **kw: t0(*a, seg=seg, **kw)), (lambda *a, seg=10, rings=6, **kw: b0(*a, seg=seg, rings=rings, **kw))

def _build_human(P):
    H = P['H']; Z = P['Z']; hr = P['hr']; lm = P['limb']
    out = {}
    # —— 躯干（含骨盆）：宽 = 半宽（X），depth 控制厚度 ——
    sw = 0.115 * H * P['shoulder']; hw = 0.08 * H * P['hip']
    cw = 0.097 * H * P['chest']; ww = 0.074 * H * P['waist'] * (1 + 0.35 * P['belly'])
    pts = [(0, 0, Z['crotch']), (0, 0, Z['hips']), (0, 0, Z['waist']), (0, 0, Z['chest']), (0, 0, Z['shoulder'] - 0.004 * H), (0, 0, Z['neck'])]
    rad = [hw * 0.82, hw, ww, cw, sw * 0.7, 0.028 * H]
    dress = P['pants'] == 'dress'
    hem = P['jacket_hem'] * H if P['jacket_hem'] else None
    strip = (0.03 if P['lowpoly'] else 0.022) * H
    def torso_col(c, n, p):
        if c.z < Z['belt'] and not dress: return 'bottom'
        if hem is not None and c.z < hem: return 'shirt'
        if P['open_jacket'] and n.y < -0.3 and abs(c.x) < strip and c.z > Z['belt']: return 'shirt'
        return 'top'
    t = tube('torso', pts, rad, torso_col, lambda c: _torso_w(c, P), seg=20, flat=P['depth'])
    if P['belly'] > 0:
        b = P['belly']
        blob('belly', (0, -0.02 * H * (1 + b), (Z['waist'] + Z['hips']) / 2), (ww * 0.95, ww * 0.75 * (0.7 + b), 0.06 * H),
             'top' if dress else lambda c, n, p: 'bottom' if c.z < Z['belt'] else 'top', lambda c: _torso_w(c, P))
    if P['bust'] > 0:
        for s in (1, -1):
            blob(f'bust_{"l" if s > 0 else "r"}', (s * cw * 0.42, -cw * P['depth'] * 0.72, Z['chest'] + 0.01 * H),
                 (cw * 0.36, cw * 0.3 * P['bust'] + 0.01 * H, cw * 0.32), 'top', 'chest')
    if P['pants'] in ('skirt', 'dress'):
        z0 = Z['waist'] if not dress else Z['belt'] + 0.02 * H; z1 = Z['waist'] - P['skirt_len'] * H
        sk = tube('skirt', [(0, 0, z0), (0, 0, (z0 + z1) / 2), (0, 0, z1)], [ww * 1.02, hw * 1.25, hw * 1.55],
                  'top' if dress else 'bottom', lambda c: _skirt_w(c, P, z0, z1), seg=20, flat=0.85)
        out['skirt'] = sk
    # —— 脖子、头 ——
    tube('neck', [(0, 0, Z['shoulder'] - 0.01 * H), (0, 0, Z['chin'] + 0.01 * H)], [0.032 * H * lm, 0.029 * H * lm], 'skin',
         lambda c: near(c, ['chest', 'neck', 'head'], k=2), seg=12)
    if P['collar']:
        tube('collar', [(0, 0.004 * H, Z['shoulder'] - 0.004 * H), (0, 0.006 * H, Z['neck'] + 0.022 * H)], [0.05 * H, 0.043 * H],
             lambda c, n, p: 'top', lambda c: near(c, ['chest', 'neck'], k=2), seg=12, flat=0.9)
    if hem is not None:  # 夹克下摆边（略外扩），盖在 T 恤上
        tube('jacket_hem', [(0, 0, hem - 0.004 * H), (0, 0, hem + 0.022 * H)], [ww * 1.12, ww * 1.1],
             lambda c, n, p: 'shirt' if (P['open_jacket'] and n.y < -0.3 and abs(c.x) < strip) else 'top', lambda c: _torso_w(c, P), seg=16, flat=P['depth'] * 1.05)
    hc = Vector((0, 0.004 * H, Z['top'] - hr))
    def head_fn(v):
        # 下颌收窄、后脑饱满
        if v.z < 0: v = Vector((v.x * (1 + 0.28 * v.z), v.y * (1 + 0.12 * v.z), v.z))
        if v.y > 0.2: v = Vector((v.x, v.y * 1.05, v.z))
        return v
    head = blob('head', hc, (hr * 0.84, hr * 0.9, hr), 'skin', 'head', seg=28, rings=18, fn=head_fn)
    out['head'] = head; out['hc'] = hc
    for s, side in ((1, 'l'), (-1, 'r')):
        blob(f'ear_{side}', (s * hr * 0.82, hc.y + hr * 0.05, Z['eye'] - 0.004 * H), (hr * 0.1, hr * 0.17, hr * 0.22), 'skin', 'head', seg=12, rings=8)
    if P['lowpoly']: _face_tex(P, head, hc)
    else: _face(P, head, hc)
    _hair(P, hc)
    _hat(P, hc)
    # —— 手臂 ——
    for s, side in ((1, 'l'), (-1, 'r')):
        S, E, W, Hn = _arm_pts(P, s)
        sl = P['sleeve']; cf = P['cuff']
        def arm_col(c, n, p, S=S, W=W):
            t = (c - S).dot((W - S).normalized()) / (W - S).length
            if cf is not None: return 'top' if t < cf - 0.07 else 'top2' if t < cf + 0.01 else 'skin'
            if sl == 'long': return 'top' if t < 0.93 else 'skin'
            if sl == 'short': return 'top' if t < 0.36 else 'skin'
            return 'skin'
        th = 1.12 if sl != 'none' else 1.0
        lm = P['limb'] * P.get('armk', 1.0)
        chain = [f'upperarm_{side}', f'forearm_{side}', f'hand_{side}']
        if cf is not None:  # 卷起的袖口：一圈略粗的环
            cp = S.lerp(W, cf - 0.03)
            tube(f'cuff_{side}', [cp - (W - S).normalized() * 0.03 * H, cp + (W - S).normalized() * 0.012 * H], [0.03 * H * lm, 0.031 * H * lm], 'top2',
                 lambda c, chain=chain: seg_w(c, chain), seg=10)
        tube(f'arm_{side}', [S + Vector((0, 0, 0.012 * H)), S.lerp(E, 0.5), E, E.lerp(W, 0.5), W],
             [x * H * lm for x in (0.038 * th, 0.034 * th, 0.029 * th, 0.027 * (th if sl == 'long' else 1), 0.022)], arm_col,
             lambda c, chain=chain: seg_w(c, chain), seg=12)
        blob(f'shoulder_cap_{side}', S + Vector((-s * 0.004 * H, 0, 0.004 * H)), tuple(x * (0.78 if P['heads'] >= 6 else 1.0) for x in (0.042 * H * lm, 0.038 * H * lm, 0.036 * H * lm)),
             'skin' if sl == 'none' else 'top', lambda c, side=side: near(c, ['chest', f'upperarm_{side}'], k=2, sharp=3), seg=14, rings=10)
        d = (W - E).normalized()
        _hand(P, side, s, W, d)
    # —— 腿 ——
    lm = P['limb']
    for s, side in ((1, 'l'), (-1, 'r')):
        Hj, K, A = _leg_pts(P, s)
        pn = P['pants']
        def leg_col(c, n, p, K=K):
            if pn == 'long': return 'bottom'
            if pn == 'shorts': return 'bottom' if c.z > K.z + 0.045 * H else 'skin'
            return 'sock' if c.z < Z['ankle'] + 0.07 * H and P['shoes'] == 'boot' else 'skin'
        th = 1.08 if pn == 'long' else 1.0
        chain = [f'thigh_{side}', f'shin_{side}', f'foot_{side}']
        tube(f'leg_{side}', [Hj + Vector((0, 0, 0.03 * H)), Hj.lerp(K, 0.5), K, K.lerp(A, 0.5), A + Vector((0, 0, -0.01 * H))],
             [x * H * lm for x in (0.045 * th, 0.04 * th, 0.031 * th, 0.029 * th, 0.024 * th)], leg_col,
             lambda c, chain=chain, side=side: _leg_w(c, P, chain, side), seg=14)
        _shoe(P, A, side)
    return out

def _hand(P, side, s, W, d):
    """扁平手掌 + 四指（微屈，指尖朝内）+ 拇指。手心朝身体（-s·X），手背朝外。"""
    H = P['H']; lm = P['limb']; bn = f'hand_{side}'
    inward = Vector((-s, 0, 0))
    pc = W + d * 0.028 * H
    # 手掌：X 方向薄（厚 ~1.4 cm），Y 方向宽，沿手臂方向长
    blob(f'palm_{side}', pc, (0.011 * H * lm, 0.022 * H * lm, 0.026 * H), 'skin', bn, seg=14, rings=10,
         fn=lambda v: Vector((v.x, v.y, v.z * (1 - 0.15 * max(0, -v.z)))))
    base_z = pc + d * 0.022 * H
    for i, fy in enumerate((-0.015, -0.005, 0.005, 0.015)):
        ln = 0.03 * H * (0.85, 1.0, 0.95, 0.78)[i]
        b0 = base_z + Vector((0, fy * H * lm, 0))
        b1 = b0 + d * ln * 0.55 + inward * ln * 0.12
        b2 = b1 + d * ln * 0.35 + inward * ln * 0.28
        tube(f'finger{i}_{side}', [b0, b1, b2], [0.0062 * H * lm, 0.0056 * H * lm, 0.0045 * H * lm], 'skin', bn, seg=7)
    t0 = W + d * 0.018 * H + Vector((0, -0.02 * H * lm, 0)) + inward * 0.004 * H
    t1 = t0 + d * 0.014 * H + Vector((0, -0.01 * H, 0)) + inward * 0.008 * H
    t2 = t1 + d * 0.012 * H + inward * 0.008 * H
    tube(f'thumb_{side}', [t0, t1, t2], [0.0075 * H * lm, 0.0065 * H * lm, 0.005 * H * lm], 'skin', bn, seg=7)

def _arm_pts(P, s):
    H = P['H']; Z = P['Z']; a = math.radians(9)
    S = Vector((s * 0.112 * H * P['shoulder'] * 0.98, 0.002 * H, Z['shoulder'] - 0.012 * H))
    d = Vector((s * math.sin(a), 0, -math.cos(a)))
    ua, fa = P.get('armLen', (0.162 * H, 0.142 * H))
    E = S + d * ua * P['arm']; W = E + d * fa * P['arm']; Hn = W + d * 0.03 * H
    return S, E, W, Hn

def _leg_pts(P, s):
    H = P['H']; Z = P['Z']; hx = 0.054 * H * P['hip']
    return Vector((s * hx, 0, Z['hip'])), Vector((s * hx * 0.94, -0.004 * H, Z['knee'])), Vector((s * hx * 0.9, 0.004 * H, Z['ankle']))

def _torso_w(c, P):
    Z = P['Z']; H = P['H']
    w = seg_w(c, ['hips', 'spine', 'chest', 'neck'])
    if c.z < Z['hips']:
        k = _clamp((Z['hips'] - c.z) / (0.05 * H)) * 0.45 * _clamp(abs(c.x) / (0.05 * H))
        side = 'l' if c.x > 0 else 'r'
        w = {b: x * (1 - k) for b, x in w.items()}; w[f'thigh_{side}'] = w.get(f'thigh_{side}', 0) + k
    return w

def _skirt_w(c, P, z0, z1):
    k = _clamp((z0 - c.z) / max(1e-4, z0 - z1)) * 0.55 * _clamp(abs(c.x) / (0.06 * P['H']))
    side = 'l' if c.x > 0 else 'r'
    return {'hips': 1 - k, f'thigh_{side}': k}

def _leg_w(c, P, chain, side):
    Z = P['Z']; H = P['H']
    w = seg_w(c, chain)
    k = _clamp((c.z - (Z['hip'] - 0.02 * H)) / (0.05 * H)) * 0.6
    if k > 0:
        w = {b: x * (1 - k) for b, x in w.items()}; w['hips'] = w.get('hips', 0) + k
    return w

def _shoe(P, A, side):
    H = P['H']; st = P['shoes']
    c = Vector((A.x, A.y - 0.024 * H, 0.026 * H))
    r = (0.04 * H, 0.068 * H, 0.034 * H) if st != 'sandal' else (0.03 * H, 0.058 * H, 0.02 * H)
    def col(cc, n, p):
        if cc.z < 0.016 * H: return 'sole'
        if st == 'sneaker' and n.y < -0.35 and cc.z < 0.034 * H: return 'shoe2'
        return 'shoe'
    def fn(v):  # 平底、鞋头略翘
        z = max(v.z, -0.75)
        return Vector((v.x, v.y, z + (0.12 * max(0, -v.y) ** 2 if v.y < 0 else 0)))
    if st == 'sneaker' and P['lowpoly']:
        # 运动鞋：红色鞋面 + 白色鞋底板 + 白色鞋头 + 白色鞋带
        blob(f'shoe_{side}', c + Vector((0, 0, 0.006 * H)), (r[0] * 0.95, r[1] * 0.95, r[2] * 0.9), 'shoe', f'foot_{side}', seg=16, rings=10, fn=fn)
        box = lambda v: Vector((max(-0.9, min(0.9, v.x)) / 0.9, v.y, max(-0.7, min(0.7, v.z)) / 0.7))
        blob(f'sole_{side}', Vector((c.x, c.y, 0.009 * H)), (r[0] * 1.04, r[1] * 1.05, 0.009 * H), 'sole', f'foot_{side}', seg=16, rings=6, fn=box)
        blob(f'toecap_{side}', c + Vector((0, -r[1] * 0.62, -0.004 * H)), (r[0] * 0.9, r[1] * 0.42, r[2] * 0.6), 'sole', f'foot_{side}', seg=12, rings=6)
        for j in range(3):
            y = c.y - r[1] * (0.2 - j * 0.18); z = c.z + r[2] * (0.72 + j * 0.1)
            tube(f'lace{j}_{side}', [(c.x - r[0] * 0.45, y, z), (c.x + r[0] * 0.45, y, z)], 0.0035 * H, 'shoe2', f'foot_{side}', seg=4)
        return
    blob(f'shoe_{side}', c, r, col, f'foot_{side}', seg=16, rings=10, fn=fn)
    if st == 'boot':
        tube(f'boot_{side}', [A + Vector((0, 0, -0.01 * H)), A + Vector((0, 0, 0.08 * H))], [0.03 * H, 0.031 * H], 'shoe', f'shin_{side}' if False else f'foot_{side}', seg=12)
    if st == 'sandal':
        blob(f'foot_skin_{side}', c + Vector((0, 0, 0.012 * H)), (0.026 * H, 0.05 * H, 0.016 * H), 'skin', f'foot_{side}', seg=12, rings=8)

# ---------------------------------------------------------------- face
def _conform(o, surf, center, lift):
    """把贴花每个顶点沿「头心 → 顶点」方向投影到 surf 表面：外层抬高 lift，内层压到表面下（不可见）→ 贴花完全顺着头的弧度。"""
    bpy.context.view_layer.update()
    mw = o.matrix_world; mi = mw.inverted(); c = Vector(center)
    cen = sum((mw @ v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
    nrm = (cen - c).normalized()
    for v in o.data.vertices:
        w = mw @ v.co; dr = (w - c).normalized()
        hit, _ = shoot(surf, c, dr, fallback=True)
        if hit is c: continue
        outer = (w - cen).dot(nrm) >= 0
        v.co = mi @ (hit + dr * (lift if outer else -lift))
    o.data.update()

def _face(P, head, hc):
    H = P['H']; Z = P['Z']; hr = P['hr']; e = P['eye']
    hcv = Vector(hc)
    def D_(name, center, direction, size, col, lift, sink=0.3, seg=20, rings=10):
        o, loc, n = decal(name, head, center, direction, size, col, 'head', sink=sink, seg=seg, rings=rings)
        _conform(o, head, hcv, lift); return o, loc, n
    for s, side in ((1, 'l'), (-1, 'r')):
        cen = Vector((s * hr * 0.3, hc.y, Z['eye'] - hr * 0.04)); dr = Vector((s * 0.2, -1, 0.02))
        inward = Vector((-s * hr * 0.03, 0, 0))
        D_(f'sclera_{side}', cen, dr, (hr * 0.27 * e, hr * 0.05, hr * 0.36 * e), 'white', hr * 0.004)
        D_(f'iris_{side}', cen + inward, dr, (hr * 0.21 * e, hr * 0.04, hr * 0.3 * e), 'iris', hr * 0.008)
        D_(f'pupil_{side}', cen + inward, dr, (hr * 0.11 * e, hr * 0.03, hr * 0.16 * e), 'pupil', hr * 0.012)
        D_(f'shine_{side}', cen + inward + Vector((s * hr * 0.03, 0, hr * 0.07 * e)), dr, (hr * 0.06 * e, hr * 0.02, hr * 0.06 * e), 'white', hr * 0.016, seg=10, rings=6)
        D_(f'lash_{side}', cen + Vector((0, 0, hr * 0.175 * e)), dr + Vector((0, 0, 0.12)), (hr * 0.34 * e, hr * 0.05, hr * 0.05), 'lash', hr * 0.014)
        D_(f'brow_{side}', Vector((s * hr * 0.33, hc.y, Z['brow'] + hr * 0.04)), Vector((s * 0.22, -1, 0.25)),
           (hr * 0.26, hr * 0.05, hr * 0.055 * P['brows']), 'brow', hr * 0.006)
    decal('nose', head, Vector((0, hc.y, (Z['eye'] + Z['mouth']) / 2)), Vector((0, -1, 0)), (hr * 0.07, hr * 0.06, hr * 0.07), 'skin', 'head', sink=0.35, seg=10, rings=6)
    D_('mouth', Vector((0, hc.y, Z['mouth'])), Vector((0, -1, -0.15)), (hr * 0.18, hr * 0.03, hr * 0.035), 'mouth', hr * 0.004, seg=12, rings=6)

def _face_tex(P, head, hc):
    """低多边形：五官画进一张 512² 脸部贴图，正面平面投影到头上（不再用立体贴片，完全贴合、平涂感）。"""
    import numpy as np
    H = P['H']; Z = P['Z']; hr = P['hr']; F = dict(P['face'] or {})
    N = 512
    col = {n: hexrgb(h) for n, h in COLORS}
    img = np.zeros((N, N, 4)); img[..., :3] = col['skin']; img[..., 3] = 1
    # UV：u = 0.5 + x / (2·0.9hr)，v = (z - (hc.z - hr)) / 2hr；像素行从下往上
    ys, xs = np.mgrid[0:N, 0:N]; U = (xs + 0.5) / N; V = (ys + 0.5) / N
    X = (U - 0.5) * 2 * 0.9 * hr; Zw = hc.z - hr + V * 2 * hr
    def put(mask, c, a=1.0): img[mask, :3] = img[mask, :3] * (1 - a) + np.array(c) * a
    def ell(cx, cz, rx, rz, rot=0.0):
        ca, sa = math.cos(rot), math.sin(rot); dx, dz = X - cx, Zw - cz
        return ((dx * ca + dz * sa) / rx) ** 2 + ((-dx * sa + dz * ca) / rz) ** 2
    ez = hc.z - hr * 0.12; ex = hr * F.get('eyeX', 0.34); ew = hr * F.get('eyeW', 0.17); eh = hr * F.get('eyeH', 0.2)
    for s in (1, -1):
        cx = s * ex
        eye = ell(cx, ez, ew, eh, s * 0.08)
        put(eye <= 1, col['white'])
        ir = ell(cx - s * ew * 0.12, ez - eh * 0.05, ew * 0.66, eh * 0.78)
        put((ir <= 1) & (eye <= 1), col['iris'])
        put((ir <= 0.55) & (eye <= 1), [c * 0.72 for c in col['iris']])  # 虹膜下半深色（动漫双色瞳）
        put((ell(cx - s * ew * 0.12, ez - eh * 0.02, ew * 0.3, eh * 0.4) <= 1) & (eye <= 1), col['pupil'])
        put(ell(cx - s * ew * 0.28 + s * ew * 0.1, ez + eh * 0.35, ew * 0.2, eh * 0.16) <= 1, col['white'])
        put(ell(cx + s * ew * 0.1, ez - eh * 0.4, ew * 0.12, eh * 0.09) <= 1, [0.95, 0.95, 1.0], 0.8)
        # 上睫毛：眼眶上沿的粗弧线，外眼角上挑
        band = (eye > 0.75) & (ell(cx, ez + eh * 0.06, ew * 1.2, eh * 1.12, s * 0.08) <= 1) & (Zw > ez + eh * 0.1)
        put(band, col['lash'])
        put(ell(cx + s * ew * 0.95, ez + eh * 0.6, ew * 0.3, eh * 0.12, -s * 0.5) <= 1, col['lash'])
        put((eye > 0.82) & (eye <= 1.05) & (Zw < ez - eh * 0.45), col['lash'], 0.5)  # 下眼线淡
        # 眉毛：略粗的弧
        bz = ez + eh * 1.55
        br = ell(cx + s * ew * 0.1, bz - hr * 0.05, ew * 1.1, hr * 0.12, s * 0.12)
        put((br <= 1) & (br >= 0.62) & (Zw > bz - hr * 0.04), col['brow'])
    # 鼻子：一笔侧阴影；嘴：浅弧线
    nz = hc.z - hr * 0.38
    put(ell(hr * 0.03, nz, hr * 0.03, hr * 0.018) <= 1, [c * 0.82 for c in col['skin']])
    mz = hc.z - hr * 0.6
    m = ell(0, mz + hr * 0.05, hr * 0.13, hr * 0.07)
    put((m <= 1) & (m >= 0.6) & (Zw < mz + hr * 0.02), col['mouth'])
    # 腮红
    for s in (1, -1): put(ell(s * hr * 0.46, ez - hr * 0.3, hr * 0.12, hr * 0.06) <= 1, [0.98, 0.62, 0.58], 0.28)
    im = bpy.data.images.new(f'FACE_{KEY}', N, N, alpha=False); im.pixels = img.ravel().tolist()
    path = D('art-source', ASSET_DIR, KEY, 'tex', f'{KEY}_face.png'); os.makedirs(os.path.dirname(path), exist_ok=True)
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    fm = MAT.copy(); fm.name = f'M_{KEY}_face'
    tex = next(n for n in fm.node_tree.nodes if n.type == 'TEX_IMAGE'); tex.image = im; tex.interpolation = 'Linear'
    me = head.data; me.materials.append(fm); fi = len(me.materials) - 1
    bpy.context.view_layer.update()
    mw = head.matrix_world; nm = mw.to_3x3().inverted().transposed(); uv = me.uv_layers.active.data
    for poly in me.polygons:
        n = (nm @ poly.normal).normalized(); c = mw @ poly.center
        if n.y < -0.12 and c.z > hc.z - hr * 0.98:
            poly.material_index = fi
            for li in poly.loop_indices:
                w = mw @ me.vertices[me.loops[li].vertex_index].co
                uv[li].uv = (0.5 + w.x / (2 * 0.9 * hr), (w.z - (hc.z - hr)) / (2 * hr))

# ---------------------------------------------------------------- hair & hats
def _hair(P, hc):
    H = P['H']; hr = P['hr']; st = P['hair']
    if st == 'bald': return
    def cap_fn(v):
        # 面部让出：前方低处压到眉上
        if v.y < -0.1:
            v = Vector((v.x, v.y, max(v.z, 0.18 + (-v.y - 0.1) * 0.55)))
        if st in ('short', 'spiky', 'bun', 'ponytail') and v.z < -0.45: v = Vector((v.x, v.y, -0.45 + (v.z + 0.45) * 0.3))
        return v
    blob('hair_cap', hc + Vector((0, hr * 0.03, hr * 0.06)), (hr * 0.92, hr * 0.98, hr * 0.99), 'hair', 'head', seg=24, rings=16, fn=cap_fn)
    # 刘海：一排下垂的尖束
    n = 5 if st != 'spiky' else 6
    for i in range(n):
        u = (i / (n - 1)) * 2 - 1
        x = u * hr * 0.62
        hat = P['hat'] in ('cap', 'beanie', 'sailor', 'bandana')
        bz = 0.42 if hat else 0.62; tz = 0.2 if hat else 0.28
        base = hc + Vector((x, -hr * (0.8 if hat else 0.62), hr * bz))
        tip = hc + Vector((x * 1.12, -hr * 0.95 + abs(u) * hr * 0.1, hr * (tz + 0.1 * abs(u)) - (0.05 * hr if i % 2 else 0)))
        tube(f'bang_{i}', [base, base.lerp(tip, 0.55) + Vector((0, -hr * 0.04, 0)), tip], [hr * (0.14 if hat else 0.2), hr * 0.1, hr * 0.02], 'hair', 'head', seg=8)
    if st == 'spiky':
        for i, (ax, az) in enumerate(((0, 0.9), (0.55, 0.6), (-0.55, 0.6), (0.3, 0.2), (-0.3, 0.2), (0, 0.4))):
            az = az * (0.35 if P['hat'] != 'none' else 1.0); base = hc + Vector((ax * hr * 0.6, hr * 0.55, az * hr * 0.6)); tip = base + Vector((ax * hr * 0.35, hr * 0.5, -hr * 0.05))
            tube(f'spike_{i}', [base, tip], [hr * 0.22, hr * 0.02], 'hair', 'head', seg=8)
    if st in ('short', 'spiky', 'bob'):
        for s, side in ((1, 'l'), (-1, 'r')):  # 鬓角
            base = hc + Vector((s * hr * 0.8, -hr * 0.28, hr * 0.25)); tip = hc + Vector((s * hr * 0.84, -hr * 0.32, -hr * (0.3 if st != 'bob' else 0.62)))
            tube(f'side_{side}', [base, tip], [hr * 0.14, hr * 0.04], 'hair', 'head', seg=8)
    if st == 'bob':
        blob('hair_bob', hc + Vector((0, hr * 0.08, -hr * 0.25)), (hr * 0.98, hr * 0.95, hr * 0.55), 'hair', 'head', seg=20, rings=12)
    if st == 'long':
        blob('hair_back', hc + Vector((0, hr * 0.35, -hr * 0.6)), (hr * 0.85, hr * 0.5, hr * 1.1), 'hair', lambda c: near(c, ['head', 'chest'], k=2, sharp=3), seg=20, rings=12)
        for s, side in ((1, 'l'), (-1, 'r')):
            base = hc + Vector((s * hr * 0.78, -hr * 0.2, hr * 0.2)); tip = hc + Vector((s * hr * 0.85, -hr * 0.05, -hr * 1.35))
            tube(f'lock_{side}', [base, base.lerp(tip, 0.5) + Vector((s * hr * 0.1, 0, 0)), tip], [hr * 0.2, hr * 0.2, hr * 0.06], 'hair',
                 lambda c: near(c, ['head', 'chest'], k=2, sharp=3), seg=10)
    if st == 'ponytail':
        root = hc + Vector((0, hr * 0.85, hr * 0.25))
        blob('tie', root, (hr * 0.14, hr * 0.12, hr * 0.14), 'accent', 'head', seg=12, rings=8)
        tube('ponytail', [root, root + Vector((0, hr * 0.35, -hr * 0.3)), root + Vector((0, hr * 0.3, -hr * 1.05))],
             [hr * 0.22, hr * 0.25, hr * 0.05], 'hair', lambda c: near(c, ['head', 'neck'], k=2, sharp=3), seg=10)
    if st == 'bun':
        blob('bun', hc + Vector((0, hr * 0.55, hr * 0.72)), (hr * 0.38, hr * 0.36, hr * 0.34), 'hair', 'head', seg=16, rings=10)

def _hat(P, hc):
    H = P['H']; hr = P['hr']; st = P['hat']
    if st == 'none': return
    if st == 'cap':
        def dome(v): return Vector((v.x, v.y, max(v.z, 0.0)))
        cf_ = P['cap_front']
        def cap_col(c, n, p, hc=hc):
            az = math.degrees(math.atan2(c.x - hc.x, -(c.y - hc.y)))
            return cf_ if abs(az) < 52 else 'cap'
        blob('cap_dome', hc + Vector((0, hr * 0.04, hr * 0.42)), (hr * 0.98, hr * 1.04, hr * 0.72), cap_col if cf_ else 'cap', 'head', seg=40, rings=20, fn=dome)
        blob('cap_brim', hc + Vector((0, -hr * 0.9, hr * 0.46)), (hr * 0.74, hr * 0.55, hr * 0.05), 'cap' if cf_ else 'brim', 'head', seg=20, rings=8, rot=(-10, 0, 0))
        blob('cap_button', hc + Vector((0, hr * 0.04, hr * 1.14)), (hr * 0.1, hr * 0.1, hr * 0.05), 'cap', 'head', seg=10, rings=6)
        if not cf_: decal('cap_logo', bpy.data.objects['cap_dome'], hc + Vector((0, 0, hr * 0.75)), Vector((0, -1, 0.3)), (hr * 0.3, hr * 0.05, hr * 0.26), 'brim', 'head', sink=0.2)
    elif st == 'beanie':
        blob('beanie', hc + Vector((0, hr * 0.03, hr * 0.3)), (hr * 1.0, hr * 1.04, hr * 0.85), 'cap', 'head', seg=22, rings=12, fn=lambda v: Vector((v.x, v.y, max(v.z, -0.1))))
        tube('beanie_rim', [hc + Vector((0, 0, hr * 0.18)), hc + Vector((0, 0, hr * 0.36))], [hr * 1.02, hr * 1.02], 'brim', 'head', seg=22, flat=1.04)
    elif st == 'sunhat':
        blob('sunhat_crown', hc + Vector((0, hr * 0.03, hr * 0.55)), (hr * 0.85, hr * 0.88, hr * 0.55), 'cap', 'head', seg=20, rings=10, fn=lambda v: Vector((v.x, v.y, max(v.z, 0))))
        blob('sunhat_brim', hc + Vector((0, hr * 0.03, hr * 0.55)), (hr * 1.75, hr * 1.75, hr * 0.05), 'cap', 'head', seg=28, rings=8)
        tube('sunhat_band', [hc + Vector((0, 0.03 * hr, hr * 0.56)), hc + Vector((0, 0.03 * hr, hr * 0.72))], [hr * 0.87, hr * 0.84], 'brim', 'head', seg=20, flat=1.03)
    elif st == 'bandana':
        blob('bandana', hc + Vector((0, hr * 0.03, hr * 0.2)), (hr * 0.97, hr * 1.02, hr * 0.85), 'cap', 'head', seg=22, rings=12, fn=lambda v: Vector((v.x, v.y, max(v.z, 0.05 - v.y * 0.3))))
        blob('bandana_knot', hc + Vector((0, hr * 1.0, hr * 0.1)), (hr * 0.2, hr * 0.12, hr * 0.14), 'cap', 'head', seg=10, rings=6)
    elif st == 'nurse':
        blob('nurse_cap', hc + Vector((0, -hr * 0.1, hr * 0.95)), (hr * 0.6, hr * 0.35, hr * 0.22), 'cap', 'head', seg=16, rings=8)
        decal('nurse_cross', bpy.data.objects['nurse_cap'], hc + Vector((0, -hr * 0.1, hr * 0.95)), Vector((0, -1, 0.2)), (hr * 0.18, hr * 0.03, hr * 0.18), 'accent', 'head', sink=0.2)
    elif st == 'sailor':
        blob('sailor_hat', hc + Vector((0, hr * 0.02, hr * 0.62)), (hr * 0.9, hr * 0.92, hr * 0.4), 'cap', 'head', seg=20, rings=10, fn=lambda v: Vector((v.x, v.y, max(v.z, -0.2))))
        tube('sailor_band', [hc + Vector((0, 0.02 * hr, hr * 0.5)), hc + Vector((0, 0.02 * hr, hr * 0.62))], [hr * 0.93, hr * 0.93], 'brim', 'head', seg=20, flat=1.0)

# ---------------------------------------------------------------- rig
def human_bones(P):
    Z = P['Z']; H = P['H']
    B = [('hips', (0, 0, Z['hips']), None), ('spine', (0, 0, Z['spine']), 'hips'), ('chest', (0, 0, Z['chest']), 'spine'),
         ('neck', (0, 0, Z['neck']), 'chest'), ('head', (0, 0, Z['chin'] + 0.012 * H), 'neck')]
    for s, side in ((1, 'l'), (-1, 'r')):
        S, E, W, _ = _arm_pts(P, s); Hj, K, A = _leg_pts(P, s)
        B += [(f'shoulder_{side}', (s * 0.03 * H, 0, Z['shoulder'] - 0.004 * H), 'chest'),
              (f'upperarm_{side}', tuple(S), f'shoulder_{side}'), (f'forearm_{side}', tuple(E), f'upperarm_{side}'), (f'hand_{side}', tuple(W), f'forearm_{side}'),
              (f'thigh_{side}', tuple(Hj), 'hips'), (f'shin_{side}', tuple(K), f'thigh_{side}'), (f'foot_{side}', tuple(A), f'shin_{side}')]
    return B

def rig_human(P, extra=()):
    """extra: 额外骨骼（发束 / 裙摆 / 道具），[(name, pos, parent)]"""
    return make_rig(human_bones(P) + list(extra), sockets=[('prop_r', tuple(_arm_pts(P, -1)[3]), 'hand_r')])

# ---------------------------------------------------------------- clips
def _fk(L, n, fn):
    """fn(u∈[0,1)) -> {'r':..,'l':..} ; 均匀采样 n 个键并闭合"""
    return loop([(round(L * i / n), fn(i / n)) for i in range(n)], L)

def _cyc(L, n, fns):
    return {b: _fk(L, n, f) for b, f in fns.items()}

def _loco(P, L, A, knee, arm, elbow, lean, bob, flight=0.0):
    """通用步态：A 大腿摆幅，knee 摆动相屈膝，arm 手臂摆幅，elbow 常驻屈肘，lean 前倾，bob 起伏（米）。"""
    g = P['gait']; A *= g; arm *= g; knee *= g; st = P['stoop']; b = bob * P['bounce']
    sn = lambda u: math.sin(2 * math.pi * u); cs = lambda u: math.cos(2 * math.pi * u)
    def thigh(ph): return lambda u: {'r': (-A * sn(u + ph), 0, 0)}
    def shin(ph): return lambda u: {'r': (8 + knee * max(0.0, cs(u + ph)) ** 1.4 + (knee * 0.25 * max(0.0, -sn(u + ph)) if flight else 0), 0, 0)}
    def foot(ph): return lambda u: {'r': (-0.45 * (-A * sn(u + ph)) - 0.3 * (8 + knee * max(0.0, cs(u + ph)) ** 1.4) + 6, 0, 0)}
    def uarm(ph, s): return lambda u: {'r': (arm * sn(u + ph), 0, s * 4)}
    def farm(ph): return lambda u: {'r': (-elbow - arm * 0.35 * max(0.0, -sn(u + ph)), 0, 0)}
    fns = {
        'thigh_l': thigh(0), 'thigh_r': thigh(0.5), 'shin_l': shin(0), 'shin_r': shin(0.5), 'foot_l': foot(0), 'foot_r': foot(0.5),
        'upperarm_l': uarm(0, 1), 'upperarm_r': uarm(0.5, -1), 'forearm_l': farm(0), 'forearm_r': farm(0.5),
        'hips': lambda u: {'r': (0, 5 * g * sn(u), 0), 'l': (0, b * math.cos(4 * math.pi * u) - b * (0.6 + flight), 0)},
        'spine': lambda u: {'r': (lean * 0.5 + st * 0.5, -3 * g * sn(u), 0)},
        'chest': lambda u: {'r': (lean * 0.5 + st * 0.5, -4 * g * sn(u), 0)},
        'neck': lambda u: {'r': (-lean * 0.6 - st * 0.7, 2 * g * sn(u), 0)},
        'head': lambda u: {'r': (-lean * 0.2 - st * 0.2 + 1.5 * math.cos(4 * math.pi * u), 0, 0)},
    }
    return _cyc(L, 16, fns)

def _pose_keys(P, frames):
    """frames: [(frame, {bone: {'r':..,'l':..}})] -> keys；缺省骨骼取 0（stoop 叠加在 spine/chest/neck）"""
    bones = set(); [bones.update(d) for _, d in frames]
    bones |= {'spine', 'chest', 'neck', 'head'}
    st = P['stoop']; out = {}
    base = {'spine': (st * 0.5, 0, 0), 'chest': (st * 0.5, 0, 0), 'neck': (-st * 0.7, 0, 0), 'head': (-st * 0.2, 0, 0)}
    for bn in bones:
        ks = []
        for f, d in frames:
            v = dict(d.get(bn, {})); r = v.get('r', (0, 0, 0)); b0 = base.get(bn, (0, 0, 0))
            v['r'] = tuple(a + c for a, c in zip(r, b0)); ks.append((f, v))
        out[bn] = ks
    return out

def human_clips(rig, P, over=None):
    """通用动作：idle / idle_alt / walk / jog / run / talk / wave / throw / ride / surf / sit / nod。over: {name: (L, keys, cyclic, hit)} 覆盖或追加（人物专属动作）"""
    H = P['H']; st = P['stoop']; C = {}
    sn = lambda u: math.sin(2 * math.pi * u)
    # 待机：呼吸（胸口起伏）+ 手臂轻摆 + 头微动
    L = 90
    C['idle'] = (L, _cyc(L, 12, {
        'chest': lambda u: {'r': (st * 0.5 - 1.2 * sn(u), 0, 0), 's': (1 + 0.012 * sn(u), 1 + 0.01 * sn(u), 1 + 0.012 * sn(u))},
        'spine': lambda u: {'r': (st * 0.5, 0, 0)},
        'neck': lambda u: {'r': (-st * 0.7 + 1.0 * sn(u), 0, 0)},
        'head': lambda u: {'r': (-st * 0.2, 3 * math.sin(2 * math.pi * u + 1), 1.2 * sn(u * 1))},
        'upperarm_l': lambda u: {'r': (1.5 * sn(u), 0, 2 + 1.2 * sn(u))},
        'upperarm_r': lambda u: {'r': (1.5 * sn(u + 0.1), 0, -2 - 1.2 * sn(u))},
        'forearm_l': lambda u: {'r': (-8, 0, 0)}, 'forearm_r': lambda u: {'r': (-8, 0, 0)},
        'hips': lambda u: {'l': (0, -0.002 * H * (1 + sn(u)), 0)},
    }), True, None)
    # 待机变体：左右张望 + 重心换脚
    C['idle_alt'] = (150, _pose_keys(P, [
        (0, {}), (25, {'head': {'r': (0, 32, 0)}, 'neck': {'r': (0, 10, 0)}, 'hips': {'l': (0.012 * H, 0, 0), 'r': (0, 0, -2)}}),
        (60, {'head': {'r': (0, 32, 0)}, 'neck': {'r': (0, 10, 0)}, 'hips': {'l': (0.012 * H, 0, 0), 'r': (0, 0, -2)}}),
        (85, {'head': {'r': (4, -30, 0)}, 'neck': {'r': (0, -10, 0)}, 'hips': {'l': (-0.012 * H, 0, 0), 'r': (0, 0, 2)}}),
        (120, {'head': {'r': (4, -30, 0)}, 'neck': {'r': (0, -10, 0)}, 'hips': {'l': (-0.012 * H, 0, 0), 'r': (0, 0, 2)}}),
        (150, {}),
    ]), True, None)
    C['walk'] = (32, _loco(P, 32, 22, 40, 18, 10, 2, 0.012 * H), True, None)
    C['jog'] = (18, _loco(P, 18, 34, 70, 30, 55, 7, 0.02 * H, flight=0.2), True, None)
    C['run'] = (14, _loco(P, 14, 48, 95, 45, 80, 14, 0.028 * H, flight=0.5), True, None)
    # 说话：右手比划 + 点头
    C['talk'] = (60, _cyc(60, 12, {
        'upperarm_r': lambda u: {'r': (-28 - 8 * sn(u), 0, -8)}, 'forearm_r': lambda u: {'r': (-55 - 15 * sn(2 * u), 12 * sn(u), 0)},
        'hand_r': lambda u: {'r': (0, 20 * sn(2 * u), 0)},
        'head': lambda u: {'r': (-st * 0.2 + 4 * sn(2 * u), 5 * sn(u), 0)},
        'chest': lambda u: {'r': (st * 0.5, -4 * sn(u), 0)}, 'spine': lambda u: {'r': (st * 0.5, 0, 0)}, 'neck': lambda u: {'r': (-st * 0.7, 0, 0)},
        'forearm_l': lambda u: {'r': (-8, 0, 0)},
    }), True, None)
    # 挥手（右手举过头顶左右摆）
    wv = lambda a: {'upperarm_r': {'r': (-10, 0, -150)}, 'forearm_r': {'r': (0, 0, a)}, 'head': {'r': (-6, 0, 4)}}
    C['wave'] = (48, _pose_keys(P, [(0, {}), (8, wv(-20)), (16, wv(25)), (24, wv(-20)), (32, wv(25)), (40, wv(-10)), (48, {})]), False, None)
    # 投球：后引 → 过顶 → 放手（hit）→ 随挥
    C['throw'] = (34, _pose_keys(P, [
        (0, {}),
        (9, {'upperarm_r': {'r': (150, 0, -12)}, 'forearm_r': {'r': (-60, 0, 0)}, 'upperarm_l': {'r': (-60, 0, 10)}, 'chest': {'r': (-6, -28, 0)},
             'spine': {'r': (-4, -12, 0)}, 'hips': {'l': (0, -0.01 * H, 0.015 * H)}, 'thigh_l': {'r': (-25, 0, 0)}, 'shin_l': {'r': (15, 0, 0)}}),
        (14, {'upperarm_r': {'r': (215, 0, -8)}, 'forearm_r': {'r': (-25, 0, 0)}, 'upperarm_l': {'r': (-20, 0, 15)}, 'chest': {'r': (8, 18, 0)},
              'spine': {'r': (6, 8, 0)}, 'hips': {'l': (0, -0.015 * H, -0.02 * H)}, 'thigh_l': {'r': (-20, 0, 0)}, 'shin_l': {'r': (10, 0, 0)}}),
        (20, {'upperarm_r': {'r': (290, 0, 5)}, 'forearm_r': {'r': (-10, 0, 0)}, 'upperarm_l': {'r': (10, 0, 12)}, 'chest': {'r': (14, 24, 0)},
              'spine': {'r': (8, 10, 0)}, 'hips': {'l': (0, -0.015 * H, -0.02 * H)}}),
        (34, {'upperarm_r': {'r': (360, 0, 0)}}),
    ]), False, 14)
    # 骑乘坐姿（坐在坐骑上：大腿前抬、小腿下垂、双手前握）
    ride = {'thigh_l': {'r': (-78, 0, 14)}, 'thigh_r': {'r': (-78, 0, -14)}, 'shin_l': {'r': (72, 0, 0)}, 'shin_r': {'r': (72, 0, 0)},
            'upperarm_l': {'r': (-38, 0, 6)}, 'upperarm_r': {'r': (-38, 0, -6)}, 'forearm_l': {'r': (-38, 0, 0)}, 'forearm_r': {'r': (-38, 0, 0)},
            'spine': {'r': (6, 0, 0)}, 'chest': {'r': (4, 0, 0)}, 'neck': {'r': (-8, 0, 0)}}
    C['ride'] = (60, _pose_keys(P, [(0, ride), (30, merge(ride, {'chest': {'r': (6, 0, 0)}})), (60, ride)]), True, None)
    # 冲浪站姿（半蹲、双臂张开保持平衡）
    surf = lambda k: {'thigh_l': {'r': (-28, 0, 8)}, 'thigh_r': {'r': (-10, 0, -8)}, 'shin_l': {'r': (38, 0, 0)}, 'shin_r': {'r': (26, 0, 0)},
                      'foot_l': {'r': (-10, 0, 0)}, 'foot_r': {'r': (-14, 0, 0)}, 'hips': {'l': (0, -0.05 * H + k * 0.008 * H, 0), 'r': (0, 25, 0)},
                      'chest': {'r': (6, -20, 0)}, 'upperarm_l': {'r': (0, 0, 55 + k * 6)}, 'upperarm_r': {'r': (0, 0, -55 + k * 6)},
                      'forearm_l': {'r': (-20, 0, 0)}, 'forearm_r': {'r': (-20, 0, 0)}, 'head': {'r': (0, 22, 0)}}
    C['surf'] = (60, _pose_keys(P, [(0, surf(0)), (30, surf(1)), (60, surf(0))]), True, None)
    # 坐（长椅 / 地面）
    sit = {'hips': {'l': (0, -(P['Z']['hip'] - P['Z']['knee']) * 0.95, 0.02 * H)}, 'thigh_l': {'r': (-88, 0, 4)}, 'thigh_r': {'r': (-88, 0, -4)},
           'shin_l': {'r': (88, 0, 0)}, 'shin_r': {'r': (88, 0, 0)}, 'upperarm_l': {'r': (-15, 0, 4)}, 'upperarm_r': {'r': (-15, 0, -4)},
           'forearm_l': {'r': (-45, 0, 0)}, 'forearm_r': {'r': (-45, 0, 0)}}
    C['sit'] = (90, _pose_keys(P, [(0, sit), (45, merge(sit, {'head': {'r': (3, 8, 0)}})), (90, sit)]), True, None)
    # 点头（认可 / 回应）
    C['nod'] = (30, _pose_keys(P, [(0, {}), (8, {'head': {'r': (16, 0, 0)}, 'neck': {'r': (4, 0, 0)}}), (15, {'head': {'r': (-3, 0, 0)}}), (22, {'head': {'r': (10, 0, 0)}}), (30, {})]), False, None)
    if over: C.update(over)
    for name, (L, keys, cyc, hit) in C.items():
        _clip(rig, name, L, keys, cyc, hit)
    # 步态匹配速度（米/秒，timeScale = 1 时）：步长 ∝ 腿长 × sin(摆幅)
    g = P['gait']; ll = P['legLen']
    P['gaitSpeed'] = {
        'walk': round(2 * 2 * ll * math.sin(math.radians(22 * g)) / (32 / 30), 3),
        'jog': round(2 * 2 * ll * math.sin(math.radians(34 * g)) * 1.25 / (18 / 30), 3),
        'run': round(2 * 2 * ll * math.sin(math.radians(48 * g)) * 1.45 / (14 / 30), 3),
    }
    return C

def export_human(cid, name, P, rig, mesh, recolor=None):
    """recolor: 可运行时换色的调色槽（NPC 变体）；写入 meta。"""
    export(cid, name, P['H'], 'human', rig, mesh, fit='height')
    mp = D('art-source', ASSET_DIR, KEY, 'export', f'{KEY}.meta.json')
    with open(mp, encoding='utf-8') as f: meta = json.load(f)
    meta.update({'kind': 'human', 'gaitSpeed': P['gaitSpeed'], 'eyeHeight': round(P['Z']['eye'], 3),
                 'handBone': 'hand_r', 'palette': [n for n, _ in COLORS], 'colors': dict(COLORS), 'recolor': recolor or []})
    with open(mp, 'w', encoding='utf-8') as f: json.dump(meta, f, indent=2, ensure_ascii=False)
    print('meta', json.dumps({k: meta[k] for k in ('tris', 'bones', 'gaitSpeed', 'eyeHeight')}))

HUMAN_SHEET_POSES = [('walk', 8, 'q34'), ('jog', 4, 'side'), ('throw', 9, 'q34'), ('wave', 16, 'front'),
                     ('ride', 0, 'side'), ('surf', 0, 'q34'), ('talk', 15, 'q34'), ('sit', 0, 'side')]

# ================================================================ v2：连续网格人体（Skin 修改器）+ 外套/裤子外壳 + 发束
def skin_mesh(name, nodes, edges, col, weight, subdiv=1, root=0):
    """nodes: [(pos, (rx, ry))]；edges: [(i, j)]。Skin 修改器生成连续网格 → 细分 → 应用 → 平直着色、上色、登记权重。"""
    me = bpy.data.meshes.new(name)
    me.from_pydata([Vector(p) for p, _ in nodes], edges, []); me.update()
    o = new_obj(name, me)
    sk = o.modifiers.new('Skin', 'SKIN'); sk.use_smooth_shade = False; sk.branch_smoothing = 0.6
    for i, (_, r) in enumerate(nodes):
        me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[root].use_root = True
    if subdiv:
        ss = o.modifiers.new('Sub', 'SUBSURF'); ss.levels = subdiv; ss.render_levels = subdiv
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    smooth(o, False)
    colorize(o, col); return reg(o, weight)

def _auto_w(P):
    """按区域给连续网格分骨：手臂 / 腿 / 躯干链，交界处平滑过渡。"""
    Z = P['Z']; H = P['H']
    S = {s: _arm_pts(P, 1 if s == 'l' else -1)[0] for s in 'lr'}
    A = {s: _arm_pts(P, 1 if s == 'l' else -1) for s in 'lr'}
    def w(c):
        side = 'l' if c.x > 0 else 'r'
        ax = abs(S[side].x) * 0.62
        Sa, Ea, Wa, Ha = A[side]
        def dseg(a, b):
            ab = b - a; t = max(0.0, min(1.0, (c - a).dot(ab) / ab.length_squared)); return (a + ab * t - c).length
        near_arm = min(dseg(Sa, Ea), dseg(Ea, Wa), dseg(Wa, Ha)) < 0.055 * H
        if abs(c.x) > ax and (near_arm or c.z > Z['shoulder'] - 0.05 * H):
            aw = seg_w(c, [f'upperarm_{side}', f'forearm_{side}', f'hand_{side}'])
            k = _clamp((abs(c.x) - ax) / (abs(S[side].x) * 0.45))
            tw = near(c, ['chest', f'shoulder_{side}'], k=2, sharp=3)
            out = {b: x * k for b, x in aw.items()}
            for b, x in tw.items(): out[b] = out.get(b, 0) + x * (1 - k)
            return out
        if c.z < Z['hip'] + 0.01 * H:
            return _leg_w(c, P, [f'thigh_{side}', f'shin_{side}', f'foot_{side}'], side)
        return _torso_w(c, P)
    return w

def _graph(P, off=0.0, parts=('torso', 'arms', 'legs'), arm_to=1.0, top='neck', bottom=None):
    """人体骨架图（节点 + 半径），off = 外壳加厚（米），arm_to = 手臂截止（0–1，沿上臂→腕），bottom = 躯干下端高度"""
    H = P['H']; Z = P['Z']; o = off
    sw = 0.115 * H * P['shoulder']; hw = 0.08 * H * P['hip']; cw = 0.097 * H * P['chest']; ww = 0.074 * H * P['waist']; d = P['depth']
    N = []; E = []
    def add(p, r, parent=None):
        N.append((p, (r[0] + o, r[1] + o))); i = len(N) - 1
        if parent is not None: E.append((parent, i))
        return i
    zb = bottom if bottom is not None else Z['crotch']
    i_b = add((0, 0, zb), (hw * 0.85, hw * 0.85 * d))
    i_h = add((0, 0.004 * H, max(zb + 0.01 * H, Z['hips'])), (hw, hw * d), i_b)
    if 'torso' not in parts:  # 裤子：只到腰带
        add((0, 0.002 * H, Z['belt'] + 0.012 * H), (ww * 1.02, ww * d * 1.04), i_h)
        top = 'none'
    else:
        i_w = add((0, 0.002 * H, Z['waist']), (ww, ww * d * 1.02), i_h)
    i_s = None
    if 'torso' in parts:
        i_c = add((0, -0.004 * H, Z['chest']), (cw, cw * d * 1.02), i_w)
        i_s = add((0, 0.004 * H, Z['shoulder'] - 0.01 * H), (sw * 0.8, cw * d * 0.95), i_c)
    i_n = i_s
    if top in ('neck', 'collar') and i_s is not None:
        i_n = add((0, 0.006 * H, Z['neck'] + (0.02 * H if top == 'collar' else 0)), (0.034 * H, 0.032 * H) if top == 'collar' else (0.027 * H, 0.027 * H), i_s)
        if top == 'neck': add((0, 0.008 * H, Z['chin'] + 0.01 * H), (0.025 * H, 0.025 * H), i_n)
    if 'arms' in parts:
        ak = P.get('armk', 1.0) * P['limb']
        for s in (1, -1):
            S, Ee, W, _ = _arm_pts(P, s)
            i0 = add(tuple(S + Vector((-s * 0.012 * H, 0, 0.006 * H))), (0.04 * H * ak, 0.038 * H * ak), i_s)
            pts = [(0.0, 0.036), (0.5, 0.032), (1.0, 0.027), (1.5, 0.024), (2.0, 0.02)]  # 0–1 上臂，1–2 前臂
            prev = i0
            for t, r in pts:
                if t / 2.0 > arm_to + 1e-6: break
                p = S.lerp(Ee, t) if t <= 1 else Ee.lerp(W, t - 1)
                prev = add(tuple(p), (r * H * ak, r * H * ak * 0.92), prev)
            if arm_to < 1.0:
                p = S.lerp(Ee, arm_to * 2) if arm_to <= 0.5 else Ee.lerp(W, arm_to * 2 - 1)
                add(tuple(p), (0.024 * H * ak, 0.023 * H * ak), prev)
    if 'legs' in parts:
        for s in (1, -1):
            Hj, K, A = _leg_pts(P, s); lm = P['limb']
            i0 = add(tuple(Hj + Vector((0, 0, 0.01 * H))), (0.05 * H * lm, 0.05 * H * lm), i_h)
            i1 = add(tuple(Hj.lerp(K, 0.45)), (0.043 * H * lm, 0.044 * H * lm), i0)
            i2 = add(tuple(K), (0.032 * H * lm, 0.033 * H * lm), i1)
            i3 = add(tuple(K.lerp(A, 0.5) + Vector((0, 0.004 * H, 0))), (0.03 * H * lm, 0.031 * H * lm), i2)
            add(tuple(A + Vector((0, 0, 0.012 * H))), (0.025 * H * lm, 0.025 * H * lm), i3)
    return N, E

def _cut_front(o, P, zmin, zmax, half):
    """删掉正面竖条（敞开的夹克前襟），再加厚度"""
    import bmesh as _bm
    bm = _bm.new(); bm.from_mesh(o.data)
    kill = [f for f in bm.faces if f.calc_center_median().y < -0.01 * P['H'] and abs(f.calc_center_median().x) < half
            and zmin < f.calc_center_median().z < zmax and f.normal.y < 0.1]
    _bm.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); bm.free(); o.data.update()
    so = o.modifiers.new('Thick', 'SOLIDIFY'); so.thickness = 0.006 * P['H']; so.offset = -1
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='Thick'); smooth(o, False)

def _lock(name, root, out, down, w, ln, th, col='hair', bone='head', curl=0.25):
    """一片发簇：扁平椭球，贴着头皮（out = 头皮外法线），沿 down 方向伸展并收尖，发尖略向外翘（curl）。"""
    o = sphere(name, radius=1, seg=6, rings=6)
    def f(v):
        t = max(0.0, -v.z)                      # 0 根部 → 1 发尖
        x = v.x * (1 - 0.85 * t); y = v.y * (1 - 0.5 * t) - curl * t * t
        return Vector((x * w, y * th, v.z * ln * 0.5))
    deform(o, f)
    orient(o, out, up=tuple(-Vector(down)))
    o.location = Vector(root) + Vector(down).normalized() * ln * 0.5
    colorize(o, col); smooth(o, False); return reg(o, bone)

def hair_locks(P, hc, n_ring=(10, 9), bangs=5, col='hair', messy=1.0):
    """服帖成簇的乱发：帽檐下两圈扁平发簇（绕开正脸）+ 斜扫的刘海（止于眉上）。"""
    hr = P['hr']; k = 0
    for z0, rk, ln, n, tilt in ((0.28, 1.0, 0.55, n_ring[0], 0.35), (-0.05, 0.96, 0.5, n_ring[1], 0.2)):
        for i in range(n):
            a = math.pi * 0.44 + (math.pi * 2 - math.pi * 0.88) * i / (n - 1) + (0.07 if i % 2 else -0.05) * messy
            dx, dy = math.sin(a), -math.cos(a)
            out = Vector((dx, dy, 0.25)).normalized()
            root = hc + Vector((dx * hr * 0.86 * rk, dy * hr * 0.92 * rk, hr * z0))
            down = Vector((dx * tilt, dy * tilt, -1)).normalized()
            _lock(f'lock{k}', root, out, down, hr * 0.32, hr * ln * (0.9 + 0.2 * ((i * 5) % 3) / 2), hr * 0.06, col, curl=0.6 * messy); k += 1
    for s_ in (1, -1):
        _lock(f'sideburn{s_}', hc + Vector((s_ * hr * 0.8, -hr * 0.35, hr * 0.22)), Vector((s_, -0.3, 0)).normalized(), Vector((0, -0.1, -1)), hr * 0.2, hr * 0.42, hr * 0.04, col, curl=0.1)
    for i in range(bangs):
        u = (i / (bangs - 1)) * 2 - 1
        root = hc + Vector((u * hr * 0.52, -hr * 0.9, hr * 0.36))
        down = Vector((0.32 + 0.1 * u, -0.25, -1)).normalized()   # 斜扫向人物左侧
        out = Vector((u * 0.3, -1, 0.35)).normalized()
        _lock(f'bang{i}', root, out, down, hr * 0.28, hr * (0.34 - 0.06 * abs(u)), hr * 0.05, col, curl=0.25)

def build_human_v2(P, jacket=True):
    """连续网格人体：身体（T 恤 / 皮肤）+ 夹克外壳（敞开前襟、卷袖）+ 裤子外壳 + 头 / 脸 / 发束 / 帽 / 手 / 鞋"""
    H = P['H']; Z = P['Z']; hr = P['hr']; W = _auto_w(P)
    # 身体：躯干 + 手臂（皮肤），腿由裤子覆盖不建
    N, E = _graph(P, 0.0, parts=('torso', 'arms'), bottom=Z['hips'] - 0.02 * H)
    shirt_top = Z['shoulder'] + 0.02 * H
    sx = abs(_arm_pts(P, 1)[0].x) * 0.82
    skin_mesh('body', N, E, lambda c, n, p: 'skin' if (c.z > Z['neck'] - 0.01 * H or (abs(c.x) > sx and c.z < Z['shoulder'] - 0.01 * H)) else 'shirt', W)
    if jacket:
        cf = P['cuff'] or 0.9
        N, E = _graph(P, 0.008 * H, parts=('torso', 'arms'), arm_to=cf, top='collar', bottom=P['jacket_hem'] * H if P['jacket_hem'] else Z['belt'])
        jk = skin_mesh('jacket', N, E, 'top', W)
        if P['open_jacket']: _cut_front(jk, P, (P['jacket_hem'] or 0.55) * H - 0.02 * H, Z['neck'] + 0.05 * H, 0.042 * H)
        for s, side in ((1, 'l'), (-1, 'r')):  # 卷袖环
            S, Ee, Wr, _ = _arm_pts(P, s); ak = P.get('armk', 1.0) * P['limb']
            p = S.lerp(Ee, cf * 2) if cf <= 0.5 else Ee.lerp(Wr, cf * 2 - 1); dvec = (Wr - S).normalized()
            tube(f'cuff_{side}', [p - dvec * 0.028 * H, p + dvec * 0.004 * H], [0.034 * H * ak, 0.035 * H * ak], 'top2', W, seg=8)
    # 裤子：腰 → 两腿（略加厚），下摆盖住脚踝
    N, E = _graph(P, 0.004 * H, parts=('legs',), top='none', bottom=Z['crotch'])
    N[-1] = N[-1]
    Np = [(p, r) for p, r in N]
    # 把躯干节点截到腰带以下
    skin_mesh('pants', Np, E, 'bottom', W)
    # 头、脸、头发、帽子
    hc = Vector((0, 0.004 * H, Z['top'] - hr))
    def head_fn(v):
        if v.z < 0: v = Vector((v.x * (1 + 0.3 * v.z), v.y * (1 + 0.15 * v.z), v.z))
        if v.y > 0.2: v = Vector((v.x, v.y * 1.04, v.z))
        return v
    head = blob('head', hc, (hr * 0.8, hr * 0.88, hr), 'skin', 'head', seg=14, rings=10, fn=head_fn)
    for s, side in ((1, 'l'), (-1, 'r')):
        blob(f'ear_{side}', (s * hr * 0.78, hc.y + hr * 0.05, Z['eye'] - 0.006 * H), (hr * 0.1, hr * 0.16, hr * 0.2), 'skin', 'head', seg=6, rings=4)
    _face_tex(P, head, hc)
    hair_locks(P, hc)
    blob('hair_cap', hc + Vector((0, hr * 0.1, hr * 0.02)), (hr * 0.86, hr * 0.9, hr * 0.94), 'hair', 'head', seg=12, rings=8,
         fn=lambda v: Vector((v.x, v.y, max(v.z, 0.1 + max(0, -v.y - 0.2) * 0.8))) if v.y < -0.2 else v)
    _hat(P, hc)
    # 手、鞋
    for s, side in ((1, 'l'), (-1, 'r')):
        S, Ee, Wr, _ = _arm_pts(P, s); _hand(P, side, s, Wr, (Wr - Ee).normalized())
        _shoe(P, _leg_pts(P, s)[2], side)
    lp_finish()
    return {'head': head, 'hc': hc}

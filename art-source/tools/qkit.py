# qkit.py — generic quadruped builder (exec'd from model scripts after kit). Returns dict of key objects/points; per-species details added by caller.
def quad(P, c):
    """c: H (body center z), body (rx,ry,rz), bodyc (col or fn), head (rx,ry,rz), hc offset (y,z) from body front, headc, snout (rx,ry,rz) or None, snoutc,
    nose col, eye (w,h) eyec iris, ears [(side-offset x,y,z), r, len, tilt, col], leg (r_top, r_bot), legc, pawc, toes, tail points list + radii + col, neck radius."""
    H = c['H']; br = c['body']; BC = Vector((0, 0, H)); HC = Vector((0, -br[1] - c['hc'][0], H + c['hc'][1]))
    W = lambda co: seg_w(co, ['chest', 'spine', 'hips'])
    body = blob(f'{P}_body', BC, br, c['bodyc'], W, seg=32, rings=18, fn=c.get('bodyfn'))
    nk = c.get('neck', 0)
    if nk: tube(f'{P}_neck', [BC + Vector((0, -br[1] * 0.7, br[2] * 0.3)), HC + Vector((0, 0.03, -c['head'][2] * 0.4))], [nk, nk * 0.85], c.get('neckc', c['bodyc']), lambda co: lerp_w('neck', 'head', 0.5), seg=14)
    head = blob(f'{P}_head', HC, c['head'], c['headc'], 'head', seg=30, rings=16)
    SN = None
    if c.get('snout'):
        sr = c['snout']; SN = HC + Vector((0, -c['head'][1] * 0.85, -c['head'][2] * 0.25))
        blob(f'{P}_snout', SN, sr, c.get('snoutc', c['headc']), 'head', seg=22, rings=12, fn=lambda v: Vector((v.x * (1 - 0.3 * max(0, -v.y)), v.y, v.z * (1 - 0.25 * max(0, -v.y)))))
        blob(f'{P}_nose', SN + Vector((0, -sr[1] * 0.95, sr[2] * 0.4)), (sr[0] * 0.35, sr[0] * 0.25, sr[0] * 0.25), c.get('nose', 'nose'), 'head', seg=10, rings=6)
    ew, eh = c['eye']; eyes = {}
    for s, nm in ((1, 'l'), (-1, 'r')):
        e, loc, n = decal(f'{P}_eye_{nm}', head, HC + Vector((0, 0, c.get('eyez', 0.1) * c['head'][2])), (s * c.get('eyex', 0.5), -1, 0.15), (ew, ew * 0.4, eh), c.get('eyec', 'eye'), 'head', sink=0.2)
        if c.get('iris'):
            e2, loc2, n2 = decal(f'{P}_iris_{nm}', e, loc + Vector((s * -ew * 0.15, 0, 0)), n, (ew * 0.6, ew * 0.2, eh * 0.7), c['iris'], 'head', sink=0.05, seg=12, rings=8); e, loc, n = e2, loc2, n2
        decal(f'{P}_shine_{nm}', e, loc + Vector((0, 0, eh * 0.35)), n, (ew * 0.3, ew * 0.1, ew * 0.3), 'white', 'head', sink=0.05, seg=8, rings=6)
        eyes[nm] = loc
    for (ex, ey, ez), er, el, tilt, ecol in c.get('ears', []):
        for s, nm in ((1, 'l'), (-1, 'r')):
            b = HC + Vector((s * ex, ey, ez))
            tube(f'{P}_ear_{nm}', [b, b + Vector((s * math.sin(math.radians(tilt)) * el * 0.5, 0.01, el * 0.5)), b + Vector((s * math.sin(math.radians(tilt)) * el, 0.02, el))], [er, er * 0.7, er * 0.08], ecol, f'ear_{nm}', seg=10, flat=c.get('earflat', 0.5))
    lx, ly = c.get('legx', br[0] * 0.6), br[1] * 0.62; lz = H - br[2] * 0.2
    LEGS = {'arm_l': ((lx, -ly, lz), (lx * 1.05, -ly - 0.01, 0.0)), 'arm_r': ((-lx, -ly, lz), (-lx * 1.05, -ly - 0.01, 0.0)),
            'thigh_l': ((lx, ly, lz), (lx * 1.05, ly + 0.01, 0.0)), 'thigh_r': ((-lx, ly, lz), (-lx * 1.05, ly + 0.01, 0.0))}
    for nm, (sh, pw) in LEGS.items():
        leg4(nm[-1], nm.startswith('arm'), sh, pw, c['leg'][0], c['leg'][1], c['legc'], paw_col=c.get('pawc', c['legc']), toes=c.get('toes', 0), toe_col=c.get('toec', 'white'), paw_size=c.get('paw'))
    TP = [Vector(p) for p in c.get('tail', [])]
    if TP:
        tube(f'{P}_tail', TP, c['tailr'], c['tailc'], lambda co: seg_w(co, ['hips'] + [f'tail{i + 1}' for i in range(len(TP) - 2)]), seg=12, flat=c.get('tailflat', 1.0))
    ears = [] if not c.get('ears') else [('ear_l', HC + Vector((c['ears'][0][0][0], c['ears'][0][0][1], c['ears'][0][0][2]))), ('ear_r', HC + Vector((-c['ears'][0][0][0], c['ears'][0][0][1], c['ears'][0][0][2])))]
    bones = quad_bones((0, br[1] * 0.5, H), (0, -br[1] * 0.5, H), (0, -br[1] * 0.85, H + br[2] * 0.5), HC, LEGS, tail=TP[1:-1] if len(TP) > 2 else TP[1:], ears=ears, extra=c.get('extra_bones', ()))
    return {'BC': BC, 'HC': HC, 'body': body, 'head': head, 'SN': SN, 'eyes': eyes, 'bones': bones, 'TP': TP, 'LEGS': LEGS}
def quad_rig(P, Q, size, mouth=None):
    m = mouth or (Q['SN'] if Q['SN'] is not None else Q['HC']) + Vector((0, -0.05 * size, -0.02 * size))
    return make_rig(Q['bones'], sockets=[('socket_mouth', tuple(m), 'head'), ('socket_fx', tuple(m + Vector((0, -0.05 * size, 0))), 'head')])

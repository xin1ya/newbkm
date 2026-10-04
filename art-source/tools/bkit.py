# bkit.py — generic standing biped builder (exec'd from model scripts). Caller adds species details.
def biped(P, c):
    """c: hip z 'HZ', body (rx,ry,rz) center z 'BZ', bodyc, head (rx,ry,rz), 'HZ2' head center z, 'hy' head y, headc, snout (rx,ry,rz)/None snoutc nose,
    eye (w,h) eyec iris eyex eyez, arm: (shoulder(x,y,z), elbow, wrist, r_top, r_bot, col), hand r, fingers n, claw col, leg: (hip, knee, ankle, r_top, r_bot, col), foot (rx,ry,rz) footc toes,
    tail pts radii col."""
    BC = Vector((0, c.get('by', 0.0), c['BZ'])); HC = Vector((0, c.get('hy', 0.0), c['HZ2']))
    body = blob(f'{P}_body', BC, c['body'], c['bodyc'], lambda co: lerp_w('spine', 'chest', (co.z - BC.z + c['body'][2] * 0.4) / (c['body'][2] * 1.0)), seg=32, rings=18, fn=c.get('bodyfn'))
    head = blob(f'{P}_head', HC, c['head'], c['headc'], 'head', seg=30, rings=16, fn=c.get('headfn'))
    SN = None
    if c.get('snout'):
        sr = c['snout']; SN = HC + Vector((0, -c['head'][1] * 0.8, -c['head'][2] * c.get('snz', 0.3)))
        blob(f'{P}_snout', SN, sr, c.get('snoutc', c['headc']), 'head', seg=22, rings=12)
        if c.get('nose'): blob(f'{P}_nose', SN + Vector((0, -sr[1] * 0.95, sr[2] * 0.3)), (sr[0] * 0.3, sr[0] * 0.2, sr[0] * 0.2), c['nose'], 'head', seg=10, rings=6)
    ew, eh = c['eye']; eyes = {}
    for s, nm in ((1, 'l'), (-1, 'r')):
        e, loc, n = decal(f'{P}_eye_{nm}', head, HC + Vector((0, 0, c.get('eyez', 0.1) * c['head'][2])), (s * c.get('eyex', 0.5), -1, 0.15), (ew, ew * 0.4, eh), c.get('eyec', 'eye'), 'head', sink=0.2)
        if c.get('iris'):
            e2, loc2, n2 = decal(f'{P}_iris_{nm}', e, loc + Vector((s * -ew * 0.15, 0, 0)), n, (ew * 0.6, ew * 0.2, eh * 0.7), c['iris'], 'head', sink=0.05, seg=12, rings=8); e, loc, n = e2, loc2, n2
        if c.get('shine', True): decal(f'{P}_shine_{nm}', e, loc + Vector((0, 0, eh * 0.35)), n, (ew * 0.3, ew * 0.1, ew * 0.3), 'white', 'head', sink=0.05, seg=8, rings=6)
        eyes[nm] = (e, loc, n)
        sh, el, wr, rt, rb, ac = c['arm']; sh, el, wr = [Vector((s * p[0], p[1], p[2])) for p in (sh, el, wr)]
        tube(f'{P}_arm_{nm}', [sh, el, wr], [rt, (rt + rb) / 2, rb], ac, lambda co, nm=nm, sh=sh, wr=wr: lerp_w(f'arm_{nm}', f'hand_{nm}', (co - sh).length / max(1e-4, (wr - sh).length) * 1.3 - 0.2), seg=12)
        hr = c.get('hand', rb * 1.2)
        if hr: blob(f'{P}_hand_{nm}', wr + (wr - el).normalized() * hr * 0.6, (hr, hr, hr * 1.1), c.get('handc', ac), f'hand_{nm}', seg=14, rings=8)
        for k in range(c.get('fingers', 0)):
            d = (wr - el).normalized(); side = Vector((0, 1, 0)).cross(d).normalized() if abs(d.y) < 0.9 else Vector((1, 0, 0))
            tip0 = wr + d * hr * 1.3
            tube(f'{P}_fing{k}_{nm}', [tip0 + side * (k - (c['fingers'] - 1) / 2) * hr * 0.6, tip0 + side * (k - (c['fingers'] - 1) / 2) * hr * 0.8 + d * hr * c.get('fingl', 1.0)], [hr * 0.3, hr * 0.08], c.get('clawc', 'white'), f'hand_{nm}', seg=6)
        hp, kn, an, lt, lb, lc = c['leg']; hp, kn, an = [Vector((s * p[0], p[1], p[2])) for p in (hp, kn, an)]
        tube(f'{P}_leg_{nm}', [hp, kn, an], [lt, (lt + lb) / 2, lb], lc, lambda co, nm=nm, hp=hp, an=an: lerp_w(f'thigh_{nm}', f'foot_{nm}', (hp.z - co.z) / max(1e-4, hp.z - an.z) * 1.3 - 0.2), seg=12)
        fr = c['foot']; fc = an + Vector((0, -fr[1] * 0.4, -an.z + fr[2]))
        blob(f'{P}_foot_{nm}', fc, fr, c.get('footc', lc), f'foot_{nm}', seg=14, rings=8)
        for k in range(c.get('toes', 0)):
            tube(f'{P}_toe{k}_{nm}', [fc + Vector(((k - (c['toes'] - 1) / 2) * fr[0] * 0.6, -fr[1] * 0.8, 0)), fc + Vector(((k - (c['toes'] - 1) / 2) * fr[0] * 0.7, -fr[1] * 1.2, -fr[2] * 0.5))], [fr[0] * 0.22, fr[0] * 0.05], c.get('toec', 'white'), f'foot_{nm}', seg=6)
    TP = [Vector(p) for p in c.get('tail', [])]
    if TP: tube(f'{P}_tail', TP, c['tailr'], c['tailc'], lambda co: seg_w(co, ['hips'] + [f'tail{i + 1}' for i in range(len(TP) - 2)]), seg=12)
    hz = c['leg'][0][2]
    bones = [('root', (0, 0, 0), None), ('hips', (0, BC.y, hz), 'root'), ('spine', tuple(BC), 'hips'), ('chest', (0, BC.y, c['arm'][0][2]), 'spine'), ('head', tuple(HC + Vector((0, 0, -c['head'][2] * 0.6))), 'chest')]
    for s, nm in ((1, 'l'), (-1, 'r')):
        sh, el, wr = c['arm'][:3]; hp, kn, an = c['leg'][:3]
        bones += [(f'arm_{nm}', (s * sh[0], sh[1], sh[2]), 'chest'), (f'hand_{nm}', (s * el[0], el[1], el[2]), f'arm_{nm}'),
                  (f'thigh_{nm}', (s * hp[0], hp[1], hp[2]), 'hips'), (f'foot_{nm}', (s * an[0], an[1], an[2]), f'thigh_{nm}')]
    prev = 'hips'
    for i, p in enumerate(TP[1:-1] if len(TP) > 2 else TP[1:]): bones.append((f'tail{i + 1}', tuple(p), prev)); prev = f'tail{i + 1}'
    bones += list(c.get('extra_bones', ()))
    return {'BC': BC, 'HC': HC, 'body': body, 'head': head, 'SN': SN, 'eyes': eyes, 'bones': bones, 'TP': TP}
def biped_rig(Q, size, mouth=None):
    m = mouth or ((Q['SN'] if Q['SN'] is not None else Q['HC']) + Vector((0, -0.06 * size, -0.02 * size)))
    return make_rig(Q['bones'], sockets=[('socket_mouth', tuple(m), 'head'), ('socket_fx', tuple(m + Vector((0, -0.05 * size, 0))), 'head')])

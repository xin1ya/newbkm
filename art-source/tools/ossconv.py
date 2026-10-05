# ============ ossconv.py — open-source model conversion (ADR 0010), prepended after common.py + kit.py ============
# Pipeline: pokemon-3d glb -> clean (drop skeleton/anim/stubs/duplicates) -> normalize (faces -Y, feet z=0, height=heightM)
#           -> decimate (<=14000 tris) -> Toon textures (downscale + posterize, base color only) -> standard skeleton
#           (bone heads given in normalized bbox coords) + distance-to-segment weights -> optional rest-pose fix
#           (e.g. T-pose arms down) -> kit.plan_clips -> kit.export (+ Cycles check sheet).
# Config: art-source/pokemon/<KEY>/oss.json
#   {"id":125,"name":"electabuzz","heightM":1.1,"plan":"biped","src":"125.glb",
#    "drop":["Icosphere"], "bones":[[name,[nx,ny,nz],parent], ...]  nx in [-1,1] of half width (+x = model's left),
#    ny in [-1,1] of half depth (-y = front), nz in [0,1] of height;
#    "tips":{bone:[nx,ny,nz]} segment end for leaf bones; "rest":{bone:[rx,ry,rz]} degrees, applied as new rest pose;
#    "levels":6 posterize levels; "texMax":512; "alpha":false}
import numpy as np

def _oss_cfg(key):
    return json.load(open(D('art-source', 'pokemon', key, 'oss.json'), encoding='utf-8'))

def _bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx

def oss_import(cfg):
    src = D('art-source', 'reference', 'pokemon', cfg['src'])
    bpy.ops.import_scene.gltf(filepath=src)
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and not any(d in o.name for d in cfg.get('drop', []))]
    # duplicates (same poly count + same bbox) -> keep first
    seen, keep = set(), []
    for o in meshes:
        mn, mx = _bbox([o]); sig = (len(o.data.polygons), tuple(round(x, 3) for x in mn), tuple(round(x, 3) for x in mx))
        if sig in seen: continue
        seen.add(sig); keep.append(o)
    for o in keep:
        # bake the displayed pose first: some skinned sources have a bind space that differs from the shown pose
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
        if o.data.shape_keys: o.shape_key_clear()
        if o.data.users > 1: o.data = o.data.copy()
        for m in list(o.modifiers):
            try: bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception: o.modifiers.remove(m)
        mw = o.matrix_world.copy()
        o.parent = None; o.matrix_world = mw
        if o.data.shape_keys: o.shape_key_clear()
        o.vertex_groups.clear()
    for o in list(bpy.data.objects):
        if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep: o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(keep) > 1: bpy.ops.object.join()
    mesh = bpy.context.active_object; mesh.name = KEY.split('_', 1)[1]; mesh.data.name = mesh.name
    # normalize
    mn, mx = _bbox([mesh]); H = cfg['heightM']; k = H / (mx.z - mn.z)
    off = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for v in mesh.data.vertices: v.co = (v.co - off) * k
    mesh.data.update()
    # merge split verts so smooth weights don't tear seams, then decimate
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=H * 1e-4); bpy.ops.object.mode_set(mode='OBJECT')
    t = tri_count([mesh]); lim = cfg.get('maxTris', 14000)
    if t > lim:
        d = mesh.modifiers.new('dec', 'DECIMATE'); d.ratio = lim / t * 0.98
        bpy.ops.object.modifier_apply(modifier='dec')
    print('oss mesh', mesh.name, 'tris', t, '->', tri_count([mesh]))
    return mesh

def oss_toon_textures(mesh, cfg):
    """Base colour only; images downscaled to texMax and posterized to flat colour bands (runtime applies Toon shading)."""
    lv = cfg.get('levels', 6); tmax = cfg.get('texMax', 512); done = {}
    for slot in mesh.material_slots:
        m = slot.material
        if not m or not m.use_nodes: continue
        nt = m.node_tree; bs = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bs: continue
        base = bs.inputs['Base Color']; img_node = base.links[0].from_node if base.links else None
        while img_node and img_node.type != 'TEX_IMAGE' and img_node.inputs and any(i.links for i in img_node.inputs):
            img_node = next(i.links[0].from_node for i in img_node.inputs if i.links)
        for inp in bs.inputs:
            if inp.name != 'Base Color':
                for l in list(inp.links): nt.links.remove(l)
        bs.inputs['Metallic'].default_value = 0; bs.inputs['Roughness'].default_value = 1
        try: bs.inputs['Specular IOR Level'].default_value = 0
        except Exception: pass
        if not cfg.get('alpha'): m.blend_method = 'OPAQUE'
        if img_node and img_node.type == 'TEX_IMAGE' and img_node.image:
            im = img_node.image
            if im.name not in done:
                w, h = im.size; s = min(1.0, tmax / max(w, h))
                if s < 1: im.scale(max(1, int(w * s)), max(1, int(h * s)))
                w, h = im.size
                px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
                rgb = px[..., :3]
                # posterize in a perceptual-ish way: quantize luminance bands, keep chroma
                lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
                q = np.round(lum * (lv - 1)) / (lv - 1)
                ratio = np.where(lum > 1e-4, q / np.maximum(lum, 1e-4), 0)[..., None]
                rgb = np.clip(rgb * ratio * 0.5 + rgb * 0.5, 0, 1)   # half-strength band snap keeps texture readable
                rgb = np.round(rgb * 15) / 15                         # 16 levels per channel -> flat swatches
                px[..., :3] = rgb
                if not cfg.get('alpha'): px[..., 3] = 1
                nm = f'{KEY}_{len(done)}'
                out = bpy.data.images.new(nm, w, h, alpha=True); out.pixels = px.ravel().tolist()
                p = D('art-source', 'pokemon', KEY, 'tex', nm + '.png'); os.makedirs(os.path.dirname(p), exist_ok=True)
                out.filepath_raw = p; out.file_format = 'PNG'; out.save()
                done[im.name] = out
            img_node.image = done[im.name]; img_node.interpolation = 'Closest' if cfg.get('closest') else 'Linear'
            nt.links.new(img_node.outputs['Color'], base)
    for im in list(bpy.data.images):
        if im.users == 0: bpy.data.images.remove(im)

def oss_rig(mesh, cfg):
    mn, mx = _bbox([mesh]); hw = max(abs(mn.x), abs(mx.x)); hd = max(abs(mn.y), abs(mx.y)); H = mx.z
    P = lambda n: Vector((n[0] * hw, n[1] * hd, n[2] * H))
    bones = [(n, tuple(P(p)), par) for n, p, par in cfg['bones']]
    arm_d = bpy.data.armatures.new(f'{KEY}_rig'); rig = new_obj(f'{KEY}_rig', arm_d)
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = rig; rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); B = {}
    for n, p, par in bones:
        b = arm_d.edit_bones.new(n); b.head = p; b.tail = (p[0], p[1], p[2] + 0.03); b.roll = 0
        if par: b.parent = B[par]
        B[n] = b; BONES[n] = Vector(p)
    bpy.ops.object.mode_set(mode='OBJECT')
    # segments: head -> (mean of children heads | tip | head)
    kids = {}
    for n, p, par in bones:
        if par: kids.setdefault(par, []).append(n)
    tips = {k: P(v) for k, v in cfg.get('tips', {}).items()}
    skip = set(cfg.get('noWeight', ['root']))
    names = [n for n, _, _ in bones if n not in skip]
    A = np.array([BONES[n][:] for n in names]); E = []
    for n in names:
        if n in tips: E.append(tips[n][:])
        elif n in kids and n not in cfg.get('pointOnly', []): E.append(tuple(sum((BONES[c] for c in kids[n]), Vector()) / len(kids[n])))
        else: E.append(BONES[n][:])
    E = np.array(E)
    V = np.array([v.co[:] for v in mesh.data.vertices])
    AB = E - A; L2 = np.maximum((AB ** 2).sum(1), 1e-12)
    t = np.clip(((V[:, None, :] - A[None]) * AB[None]).sum(2) / L2[None], 0, 1)
    d = np.linalg.norm(V[:, None, :] - (A[None] + t[..., None] * AB[None]), axis=2)
    # side constraint: _l bones only for x > -eps, _r for x < eps
    eps = hw * cfg.get('sideEps', 0.04)
    for j, n in enumerate(names):
        if n.endswith('_l'): d[V[:, 0] < -eps, j] = 1e9
        if n.endswith('_r'): d[V[:, 0] > eps, j] = 1e9
    sharp = cfg.get('sharp', 6.0); k = min(cfg.get('k', 2), len(names))
    idx = np.argsort(d, 1)[:, :k]; dd = np.take_along_axis(d, idx, 1); w = 1 / np.maximum(dd, H * 1e-3) ** sharp
    w = w / w.sum(1, keepdims=True)
    G = {n: mesh.vertex_groups.new(name=n) for n in names}
    for vi in range(len(V)):
        for j in range(k):
            if w[vi, j] > 0.01: G[names[idx[vi, j]]].add([vi], float(w[vi, j]), 'REPLACE')
    mesh.parent = rig; mo = mesh.modifiers.new('Armature', 'ARMATURE'); mo.object = rig
    # rest-pose fix (T-pose arms etc.)
    rest = cfg.get('rest', {})
    if rest:
        for bn, r in rest.items():
            pb = rig.pose.bones[bn]; pb.rotation_mode = 'XYZ'; pb.rotation_euler = [math.radians(x) for x in r]
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = mesh; mesh.select_set(True)
        bpy.ops.object.modifier_apply(modifier='Armature')
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = rig; rig.select_set(True)
        bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply()
        bpy.ops.object.mode_set(mode='EDIT')
        for b in arm_d.edit_bones:
            h = b.head.copy(); b.tail = h + Vector((0, 0, 0.03)); b.roll = 0; BONES[b.name] = h
        bpy.ops.object.mode_set(mode='OBJECT')
        for pb in rig.pose.bones: pb.rotation_euler = (0, 0, 0)
        mo = mesh.modifiers.new('Armature', 'ARMATURE'); mo.object = rig
    print('oss rig', KEY, 'bones', len(arm_d.bones), 'tris', tri_count([mesh]))
    return rig, mesh

def oss_sheet(rig, mesh, H, poses, res=260):
    """Cycles (CPU) contact sheet: rest front / q34 / side, then (action, frame) poses at q34."""
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.use_denoising = False
    sc.render.resolution_x = res; sc.render.resolution_y = res; sc.render.film_transparent = False
    w = bpy.data.worlds.get('ossw') or bpy.data.worlds.new('ossw'); sc.world = w; w.use_nodes = True
    bg = next((n for n in w.node_tree.nodes if n.type == 'BACKGROUND'), None) or w.node_tree.nodes.new('ShaderNodeBackground')
    if not bg.outputs[0].links:
        outn = next((n for n in w.node_tree.nodes if n.type == 'OUTPUT_WORLD'), None) or w.node_tree.nodes.new('ShaderNodeOutputWorld')
        w.node_tree.links.new(bg.outputs[0], outn.inputs[0])
    bg.inputs[0].default_value = (0.9, 0.9, 0.92, 1); bg.inputs[1].default_value = 1.2
    sun = bpy.data.objects.new('ossSun', bpy.data.lights.new('ossSun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 3; sun.rotation_euler = (math.radians(40), 0, math.radians(30))
    cam = bpy.data.objects.new('ossCam', bpy.data.cameras.new('ossCam')); sc.collection.objects.link(cam); sc.camera = cam
    mn_, mx_ = _bbox([mesh]); span = max(H, (mx_ - mn_).length * 0.8)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = span * 1.3
    tgt = Vector((0, 0, H * 0.5)); tmp = D('art-source', 'pokemon', KEY, 'renders', '_t.png'); os.makedirs(os.path.dirname(tmp), exist_ok=True)
    def shot(az):
        a = math.radians(az); dvec = Vector((math.sin(a), -math.cos(a), 0.25)).normalized()
        cam.location = tgt + dvec * span * 4; cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp, check_existing=False); px = np.array(im.pixels[:]).reshape(res, res, 4); bpy.data.images.remove(im); return px
    ad = rig.animation_data; saved = [(t, t.mute) for t in ad.nla_tracks]
    for t in ad.nla_tracks: t.mute = True
    ad.action = None; sc.frame_set(0); row1 = [shot(0), shot(35), shot(90)]
    row2 = []
    for act, fr in poses:
        ad.action = bpy.data.actions[act]; sc.frame_set(fr); row2.append(shot(35))
    ad.action = None
    for t, m in saved: t.mute = m
    while len(row2) % 3: row2.append(np.ones((res, res, 4)))
    rows = [row1] + [row2[i:i + 3] for i in range(0, len(row2), 3)]
    img = np.concatenate([np.concatenate(r, 1) for r in rows[::-1]], 0); h, w_ = img.shape[:2]
    out = bpy.data.images.new('osssheet', w_, h); out.pixels = img.ravel().tolist()
    p = D('art-source', 'pokemon', KEY, 'renders', 'oss_check.png'); out.filepath_raw = p; out.file_format = 'PNG'; out.save()
    for o in (sun, cam): bpy.data.objects.remove(o, do_unlink=True)
    for pb in rig.pose.bones: pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    print('sheet', p)

def oss_build(key, sheet_poses=None):
    reset(key); cfg = _oss_cfg(key)
    for im in list(bpy.data.images): bpy.data.images.remove(im)
    mesh = oss_import(cfg)
    oss_toon_textures(mesh, cfg)
    rig, mesh = oss_rig(mesh, cfg)
    H = cfg['heightM']
    plan_clips(rig, cfg['plan'], size=H, skip=cfg.get('skipClips', ()))
    if os.environ.get('OSS_SHEET', '1') == '1':
        oss_sheet(rig, mesh, H, sheet_poses or [('walk', 7), ('attack_physical', 15), ('faint', 30)])
    bpy.ops.file.pack_all()
    export(cfg['id'], cfg['name'], H, cfg['plan'], rig, mesh, fit='oss')
    m = D('art-source', 'pokemon', key, 'export', f'{key}.meta.json')
    meta = json.load(open(m, encoding='utf-8')); meta['source'] = 'oss:pokemon-3d/' + cfg['src']
    json.dump(meta, open(m, 'w', encoding='utf-8'), indent=2)

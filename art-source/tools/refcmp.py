# Geometry reference check (reference glbs are for visual comparison only, never shipped):
# for each (key, id, heightM): load art-source/reference/pokemon/<id>.glb and our art-source/pokemon/<key>/export/<key>.glb,
# normalise both (feet on z=0, centred, same height), render orthographic front / side / top:
#   renders/ref.png  : reference, textured (row 1) + ours, textured (row 2)
#   renders/cmp.png  : silhouette overlay (red = reference only, cyan = ours only, white = overlap)
import bpy, math, os
import numpy as np
from mathutils import Vector

ORTHO = {'front': (0.0, 0.0), 'side': (0.0, 90.0), 'top': (89.9, 0.0), 'q34': (25.0, 40.0)}

def _load(path, hm, tag, rot=(0, 0, 0), keep=False):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    if any(rot):
        R = __import__('mathutils').Matrix.Identity(4)
        for ax, r in zip('XYZ', rot) if not isinstance(rot[0], (list, tuple)) else rot:   # rot = (x, y, z) or [(axis, deg), ...] applied in order
            R = __import__('mathutils').Matrix.Rotation(math.radians(r), 4, ax) @ R
        for o in objs:
            if o.parent is None: o.matrix_world = R @ o.matrix_world
        bpy.context.view_layer.update()
    for o in objs:
        if o.type == 'ARMATURE' and not keep:
            if o.animation_data:
                o.animation_data.action = None
                for t in o.animation_data.nla_tracks: t.mute = True
            for pb in o.pose.bones: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.scene.frame_set(0); bpy.context.view_layer.update()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3); dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != 'MESH' or not o.visible_get() or not o.users_collection: continue
        print('  mesh', o.name, len(o.data.vertices))
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    s = hm / (hi.z - lo.z); c = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for o in objs:
        if o.parent is None:
            o.matrix_world = __import__('mathutils').Matrix.Diagonal((s, s, s, 1)) @ __import__('mathutils').Matrix.Translation(-c) @ o.matrix_world
    bpy.context.view_layer.update()
    size = (hi - lo) * s
    print(tag, 'W x D x H = %.3f x %.3f x %.3f' % tuple(size))
    return objs, size

def _show(objs, on):
    for o in objs: o.hide_render = not on

def _shots(views, hm, res, mask):
    sc = bpy.context.scene; setup_render(); sh = sc.display.shading
    sc.render.resolution_x = res; sc.render.resolution_y = res
    if mask:
        sh.light = 'FLAT'; sh.color_type = 'SINGLE'; sh.single_color = (1, 1, 1); sh.show_object_outline = False
        sh.background_type = 'VIEWPORT'; sh.background_color = (0, 0, 0)
    cam = bpy.data.objects.get('OrthoCam') or bpy.data.objects.new('OrthoCam', bpy.data.cameras.new('OrthoCam'))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; sc.camera = cam
    tgt = Vector((0, 0, hm * 0.5)); out = []
    tmp = D('art-source', ASSET_DIR, KEY, 'renders', '_tmp.png'); os.makedirs(os.path.dirname(tmp), exist_ok=True)
    for v in views:
        el, az = ORTHO[v]; a = math.radians(az); e = math.radians(el)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.data.ortho_scale = hm * 1.9
        cam.location = tgt + d * 10; cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = tmp; bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(tmp, check_existing=False)
        px = np.array(im.pixels[:]).reshape(res, res, 4); bpy.data.images.remove(im); out.append(px)
    return out

def _save(img, name):
    h, w = img.shape[:2]; o = bpy.data.images.new(name, w, h); o.pixels = img.ravel().tolist()
    o.filepath_raw = D('art-source', ASSET_DIR, KEY, 'renders', name + '.png'); o.file_format = 'PNG'; o.save(); bpy.data.images.remove(o)

for item in REF_KEYS:
    key, pid, hm = item[:3]; rot = item[3] if len(item) > 3 else (0, 0, 0)
    views = ('front', 'side', 'top', 'q34')
    reset(key)
    ref, rs = _load(D('art-source', 'reference', 'pokemon', f'{pid}.glb'), hm, f'REF {key}', rot, len(item) > 4 and item[4])
    rt = _shots(views, hm, 360, False); rm = _shots(views[:3], hm, 360, True)
    reset(key)
    our, osz = _load(D('art-source', 'pokemon', key, 'export', f'{key}.glb'), hm, f'OUR {key}')
    ot = _shots(views, hm, 360, False); om = _shots(views[:3], hm, 360, True)
    _save(np.concatenate([np.concatenate(ot, 1), np.concatenate(rt, 1)], 0), 'ref')
    tiles = []
    for a, b in zip(rm, om):
        A = a[..., 0] > 0.5; B = b[..., 0] > 0.5
        t = np.zeros_like(a); t[..., 3] = 1
        t[A & ~B] = (0.9, 0.2, 0.2, 1); t[B & ~A] = (0.2, 0.8, 0.9, 1); t[A & B] = (0.92, 0.92, 0.92, 1)
        tiles.append(t)
        print('IOU', key, '%.2f' % ((A & B).sum() / max(1, (A | B).sum())))
    _save(np.concatenate(tiles, 1), 'cmp')
    print('ratio REF W/H %.2f D/H %.2f | OUR W/H %.2f D/H %.2f' % (rs.x / rs.z, rs.y / rs.z, osz.x / osz.z, osz.y / osz.z))

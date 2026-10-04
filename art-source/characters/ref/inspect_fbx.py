# 导入用户的生成式草模 FBX，输出几何统计 + 渲染检查图
import glob
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
src = D('art-source', 'characters', '角色草模.fbx')
bpy.ops.import_scene.fbx(filepath=src)
info = {'objects': []}
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in bpy.data.objects:
    e = {'name': o.name, 'type': o.type}
    if o.type == 'MESH':
        me = o.data
        e.update(verts=len(me.vertices), faces=len(me.polygons), tris=sum(len(p.vertices) - 2 for p in me.polygons),
                 mats=[m.name for m in me.materials if m], uv=[u.name for u in me.uv_layers], vcol=[a.name for a in me.color_attributes],
                 groups=len(o.vertex_groups), shape_keys=bool(me.shape_keys))
        for v in me.vertices:
            w = o.matrix_world @ v.co; mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    if o.type == 'ARMATURE': e['bones'] = len(o.data.bones)
    e['scale'] = tuple(round(x, 4) for x in o.scale); e['rot'] = tuple(round(x, 3) for x in o.rotation_euler)
    info['objects'].append(e)
info['bbox_min'] = tuple(round(x, 4) for x in mn); info['bbox_max'] = tuple(round(x, 4) for x in mx)
info['images'] = [(i.name, tuple(i.size), i.filepath) for i in bpy.data.images]
info['actions'] = [a.name for a in bpy.data.actions]
print('FBXINFO', json.dumps(info, ensure_ascii=False))
bpy.ops.wm.save_as_mainfile(filepath=D('art-source', 'characters', 'ref', 'ref_import.blend'))
# 渲染：材质预览（有贴图则显示贴图）
sc = bpy.context.scene; setup_render(); sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = 500; sc.render.resolution_y = 700
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; h = (mx - mn); c = (mx + mn) / 2; cam.data.ortho_scale = max(h.z, h.x, h.y) * 1.08
for nm, d in (('front', Vector((0, -1, 0))), ('side', Vector((1, 0, 0))), ('back', Vector((0, 1, 0))), ('q34', Vector((0.7, -0.7, 0.15)))):
    cam.location = c + d.normalized() * (h.length * 2); cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = D('art-source', 'characters', 'ref', 'renders', f'ref_{nm}.png'); bpy.ops.render.render(write_still=True)
print('RENDERED')

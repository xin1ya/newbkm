import bmesh as _bm
for x in list(bpy.data.objects): bpy.data.objects.remove(x, do_unlink=True)
bpy.ops.import_scene.fbx(filepath=D('art-source', 'characters', '角色草模.fbx'))
o = next(x for x in bpy.data.objects if x.type == 'MESH')
# 按顶点 Y 分 3 组，拆成 3 个物体
me = o.data
def grp(y): return 'A' if y > 0.15 else ('C' if y < -0.15 else 'B')
objs = {}
for g in 'ABC':
    c = o.copy(); c.data = me.copy(); c.name = f'fig_{g}'; bpy.context.scene.collection.objects.link(c)
    bm = _bm.new(); bm.from_mesh(c.data)
    # 每个连通块按其中心归组（避免个别顶点越界）
    bm.verts.ensure_lookup_table(); seen = set(); kill = []
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; seen.add(v.index); comp = []
        while st:
            a = st.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen: seen.add(b.index); st.append(b)
        cy = sum(x.co.y for x in comp) / len(comp)
        if grp((o.matrix_world @ Vector((0, cy, 0))).y) != g: kill += comp
    _bm.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(c.data); bm.free()
    objs[g] = c
bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; setup_render(); sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = 360; sc.render.resolution_y = 480
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
for g, c in objs.items():
    for x in objs.values(): x.hide_render = x is not c
    ws = [c.matrix_world @ v.co for v in c.data.vertices]
    mn = Vector([min(w[k] for w in ws) for k in range(3)]); mx = Vector([max(w[k] for w in ws) for k in range(3)]); ctr = (mn + mx) / 2
    cam.data.ortho_scale = (mx - mn).z * 1.15
    print('GRP', g, len(ws), [round(a, 3) for a in mn], [round(a, 3) for a in mx])
    for nm, d in (('px', Vector((1, 0, 0))), ('nx', Vector((-1, 0, 0))), ('py', Vector((0, 1, 0))), ('ny', Vector((0, -1, 0)))):
        cam.location = ctr + d; cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = D('art-source', 'characters', 'ref', 'renders', f'g{g}_{nm}.png'); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=D('art-source', 'characters', 'ref', 'ref_groups.blend'))
print('DONE')

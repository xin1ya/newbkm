import bmesh as _bm
for x in list(bpy.data.objects): bpy.data.objects.remove(x, do_unlink=True)
bpy.ops.import_scene.fbx(filepath=D('art-source', 'characters', '角色草模.fbx'))
o = next(x for x in bpy.data.objects if x.type == 'MESH')
bm = _bm.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
seen = set(); isl = []
for v in bm.verts:
    if v.index in seen: continue
    st = [v]; seen.add(v.index); comp = []
    while st:
        a = st.pop(); comp.append(a.index)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen: seen.add(b.index); st.append(b)
    ws = [o.matrix_world @ bm.verts[i].co for i in comp]
    mn = [round(min(w[k] for w in ws), 3) for k in range(3)]; mx = [round(max(w[k] for w in ws), 3) for k in range(3)]
    isl.append((len(comp), mn, mx))
isl.sort(key=lambda t: -t[0])
print('ISL', len(isl))
for t in isl[:25]: print('ISL', json.dumps(t))

import bmesh as _bm
reset('hero_m_head')
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

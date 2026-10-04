# 参考：草模 C 号人物面部特写（贴图 / 白模线框）
exec(open(D('art-source', 'characters', 'hero_m_head', 'tripo_c.inc.py'), encoding='utf-8').read())
VIEWS.update({'hf': (-3, 0.0), 'hq': (-5, 35.0), 'hs': (-3, 90.0), 'hb': (-8, 160.0), 'hlow': (12, 0.0), 'hq2': (-5, -35.0)})
sheet('tex', 0.22, views=('hf', 'hq', 'hs', 'hq2'), center=1.43, res=600)
sheet('texfull', 0.42, views=('hf', 'hq', 'hs', 'hb'), center=1.44, res=500)
# 白模 + 线框
sc = bpy.context.scene
setup_render(); sc.display.shading.color_type = 'SINGLE'; sc.display.shading.single_color = (0.85, 0.8, 0.75)
wf = src.modifiers.new('wf', 'WIREFRAME'); wf.thickness = 0.0006; wf.use_replace = False; wf.material_offset = 0
_orig = setup_render
globals()['setup_render'] = lambda: (_orig(), setattr(sc.display.shading, 'color_type', 'SINGLE'))
sheet('wire', 0.22, views=('hf', 'hq', 'hs', 'hq2'), center=1.43, res=600)
globals()['setup_render'] = _orig
# 贴图本身（面部区域 UV 岛）
mat = me.materials[0]; img = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE').image
img.filepath_raw = D('art-source', 'characters', 'ref_face', 'renders', 'tripo_tex.png'); img.file_format = 'PNG'; img.save()
print('TEXSIZE', img.size[:])

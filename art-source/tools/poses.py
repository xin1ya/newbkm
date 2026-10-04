# render key poses: POSES list of (clip, frame) set in caller
rig = bpy.data.objects[RIG]; ad = rig.animation_data; sc = bpy.context.scene
setup_render()
outs = []
for t in ad.nla_tracks: t.mute = True
for clipn, fr, view in POSES:
    ad.action = bpy.data.actions[clipn]; sc.frame_set(fr)
    render_views(D('art-source', 'pokemon', MODEL, 'renders', f'pose_{clipn}'), views=(view,), dist=DIST, target=globals().get('TARGET', (0, 0, 0.15)))
ad.action = None
for t in ad.nla_tracks: t.mute = False
sc.frame_set(0)

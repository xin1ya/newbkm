# Cyndaquil step 5: save .blend, export .glb (NLA tracks), write hitTime sidecar
rig = bpy.data.objects['cyn_rig']; mesh = bpy.data.objects['cyndaquil']
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = rig
blend = D('art-source', 'pokemon', '155_cyndaquil', '155_cyndaquil.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)
glb = D('assets', 'models', 'pokemon', '155_cyndaquil.glb'); os.makedirs(os.path.dirname(glb), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True,
    export_apply=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=False, export_cameras=False, export_lights=False, export_extras=True)
side = {'id': 155, 'name': 'cyndaquil', 'heightM': 0.5, 'tris': tri_count([mesh]),
        'clips': [t.name for t in rig.animation_data.nla_tracks],
        'hitTime': {a.name: a['hitTime'] for a in bpy.data.actions if 'hitTime' in a}}
with open(glb.replace('.glb', '.meta.json'), 'w', encoding='utf-8') as f: json.dump(side, f, indent=2)
print(json.dumps(side), os.path.getsize(glb))

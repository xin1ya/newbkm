# Rowlet step 3: armature + weights, join into one mesh
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('rowlet_')]
arm_d = bpy.data.armatures.new('rowlet_rig'); rig = new_obj('rowlet_rig', arm_d)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
B = {}
def bone(n, h, t, parent=None):
    b = arm_d.edit_bones.new(n); b.head = h; b.tail = t; b.roll = 0
    if parent: b.parent = B[parent]
    B[n] = b
bone('root', (0, 0, 0), (0, 0, 0.03))
bone('hips', (0, 0, 0.03), (0, 0, 0.11), 'root')
bone('head', (0, 0, 0.11), (0, 0, 0.30), 'hips')
for s, nm in ((1, 'l'), (-1, 'r')):
    bone(f'eye_{nm}', (0.045 * s, -0.09, 0.185), (0.045 * s, -0.14, 0.185), 'head')
    bone(f'wing_{nm}', (0.13 * s, 0.012, 0.2), (0.142 * s, 0.012, 0.12), 'hips')
    bone(f'wing_tip_{nm}', (0.142 * s, 0.012, 0.12), (0.15 * s, 0.012, 0.07), f'wing_{nm}')
    bone(f'foot_{nm}', (0.045 * s, -0.01, 0.05), (0.045 * s, -0.01, 0.005), 'hips')
bone('socket_mouth', (0, -0.13, 0.155), (0, -0.16, 0.155), 'head')
bone('socket_fx', (0, -0.14, 0.19), (0, -0.17, 0.19), 'head')
bone('socket_back', (0, 0.12, 0.2), (0, 0.15, 0.2), 'hips')
bpy.ops.object.mode_set(mode='OBJECT')

def weights(o, fn):
    """fn(world co) -> {bone: w}"""
    bpy.context.view_layer.update(); mw = o.matrix_world
    groups = {}
    for v in o.data.vertices:
        for bn, w in fn(mw @ v.co).items():
            if bn not in groups: groups[bn] = o.vertex_groups.get(bn) or o.vertex_groups.new(name=bn)
            groups[bn].add([v.index], w, 'REPLACE')

def body_w(c):
    t = min(1, max(0, (c.z - 0.07) / 0.07)); return {'head': t, 'hips': 1 - t}
for o in parts:
    n = o.name
    if n == 'rowlet_body': weights(o, body_w)
    elif 'eye_' in n or 'eyehl_' in n:
        s = n[-1]; weights(o, lambda c, s=s: {f'eye_{s}': 1.0})
    elif 'beak' in n: weights(o, lambda c: {'head': 1.0})
    elif 'bow' in n: weights(o, lambda c: {'head': 0.4, 'hips': 0.6})
    elif 'wing_' in n:
        s = n[-1]
        weights(o, lambda c, s=s: {f'wing_tip_{s}': min(1, max(0, (0.13 - c.z) / 0.05)), f'wing_{s}': 1 - min(1, max(0, (0.13 - c.z) / 0.05))})
    elif 'toe_' in n or 'leg_' in n or 'pad_' in n:
        s = n.split('_')[2][0]; weights(o, lambda c, s=s: {f'foot_{s}': 1.0})

bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
body = bpy.data.objects['rowlet_body']; bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'rowlet'; body.data.name = 'rowlet'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
body.parent = rig
m = body.modifiers.new('Armature', 'ARMATURE'); m.object = rig
print('tris', tri_count([body]), 'bones', len(arm_d.bones), 'mats', len(body.data.materials))

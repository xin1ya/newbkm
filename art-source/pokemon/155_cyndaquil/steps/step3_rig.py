# Cyndaquil step 3: quadruped rig. ALL bones point world +Z (length 0.03) so local axes are uniform:
#   rot X = pitch (+ nose down / leg swings back), rot Y = yaw, rot Z = roll ; loc = (x, up, forward)
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('cyn_')]
arm_d = bpy.data.armatures.new('cyn_rig'); rig = new_obj('cyn_rig', arm_d)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
B = {}
def bone(n, p, parent=None):
    b = arm_d.edit_bones.new(n); b.head = p; b.tail = (p[0], p[1], p[2] + 0.03); b.roll = 0
    if parent: b.parent = B[parent]
    B[n] = b
eyes = {s: bpy.data.objects[f'cyn_eye_{s}'].location.copy() for s in 'lr'}
bone('root', (0, 0, 0)); bone('hips', (0, 0.1, 0.12), 'root'); bone('spine', (0, 0.02, 0.13), 'hips')
bone('chest', (0, -0.07, 0.13), 'spine'); bone('neck', (0, -0.1, 0.16), 'chest'); bone('head', (0, -0.14, 0.2), 'neck')
for s, sg in (('l', 1), ('r', -1)):
    bone(f'eye_{s}', tuple(eyes[s]), 'head')
    bone(f'arm_{s}', (0.062 * sg, -0.085, 0.09), 'chest'); bone(f'hand_{s}', (0.062 * sg, -0.085, 0.028), f'arm_{s}')
    bone(f'thigh_{s}', (0.07 * sg, 0.13, 0.1), 'hips'); bone(f'foot_{s}', (0.07 * sg, 0.13, 0.028), f'thigh_{s}')
spots = [o.location for o in bpy.data.objects if o.name.startswith('cyn_spot_')]
fc = sum(spots, Vector()) / len(spots)          # pivot exactly at the vents so flames grow out of them
bone('extra_flame', (fc.x, fc.y, fc.z - 0.006), 'hips')
bone('socket_mouth', (0, -0.25, 0.19), 'head'); bone('socket_fx', (0, -0.26, 0.2), 'head')
bone('socket_back', (0, 0.02, 0.22), 'spine')
bpy.ops.object.mode_set(mode='OBJECT')

def weights(o, fn):
    bpy.context.view_layer.update(); mw = o.matrix_world; G = {}
    for v in o.data.vertices:
        for bn, w in fn(mw @ v.co).items():
            if w <= 0: continue
            if bn not in G: G[bn] = o.vertex_groups.get(bn) or o.vertex_groups.new(name=bn)
            G[bn].add([v.index], w, 'REPLACE')
def lerp_w(a, b, t):
    t = min(1, max(0, t)); return {a: 1 - t, b: t}
def body_w(c):
    if c.y < -0.03: return lerp_w('chest', 'spine', (c.y + 0.1) / 0.07)
    return lerp_w('spine', 'hips', (c.y + 0.0) / 0.09)
LEG = {'hand_l': 'arm_l', 'hand_r': 'arm_r', 'foot_l': 'thigh_l', 'foot_r': 'thigh_r'}
for o in parts:
    n = o.name
    if n == 'cyn_body': weights(o, body_w)
    elif n == 'cyn_head': weights(o, lambda c: lerp_w('neck', 'head', (-0.09 - c.y) / 0.04))
    elif n.startswith('cyn_eye_'): s = n[-1]; weights(o, lambda c, s=s: {f'eye_{s}': 1})
    elif n.startswith(('cyn_nose', 'cyn_mouth')): weights(o, lambda c: {'head': 1})
    elif n.startswith(('cyn_spot', )): weights(o, lambda c: {'hips': 1})
    elif n.startswith('cyn_flame'): weights(o, lambda c: {'extra_flame': 1})
    else:
        key = next(k for k in LEG if k in n)
        if n.startswith(('cyn_paw', 'cyn_claw')): weights(o, lambda c, k=key: {k: 1})
        elif n.startswith('cyn_thigh'): weights(o, lambda c, k=key: {LEG[k]: 1})
        else: weights(o, lambda c, k=key: lerp_w(k, LEG[k], (c.z - 0.02) / 0.04))
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
body = bpy.data.objects['cyn_body']; bpy.context.view_layer.objects.active = body
bpy.ops.object.join(); body.name = 'cyndaquil'; body.data.name = 'cyndaquil'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
body.parent = rig; m = body.modifiers.new('Armature', 'ARMATURE'); m.object = rig
print('tris', tri_count([body]), 'bones', len(arm_d.bones), 'mats', [x.name for x in body.data.materials])

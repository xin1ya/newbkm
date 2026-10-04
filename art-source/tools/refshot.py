# Reference-only render of rcghpge/pokemon-3d glbs (NOT imported into the game): art-source/reference/pokemon/<id>.glb -> art-source/pokemon/<key>/renders/ref.png
# Usage (bx.py code): REF_KEYS = [('161_sentret', 161, 0.8), ...]; exec(open(...).read())
import bpy, math, os
from mathutils import Vector
for key, pid, hm in REF_KEYS:
    reset(key)
    path = D('art-source', 'reference', 'pokemon', f'{pid}.glb')
    bpy.ops.import_scene.gltf(filepath=path)
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        if o.type == 'ARMATURE' and o.animation_data: o.animation_data.action = None
    bpy.context.scene.frame_set(0); bpy.context.view_layer.update()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in meshes:
        dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); me = ev.to_mesh()
        for v in me.vertices:
            w = o.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    size = hi - lo; s = hm / size.z
    roots = [o for o in bpy.data.objects if o.parent is None]
    for o in roots:
        o.location = (o.location - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))) * s
        o.scale = o.scale * s
    bpy.context.view_layer.update()
    print('REF', key, 'size(m) W x D x H =', tuple(round(c * s, 3) for c in size), 'ratio W/H %.2f D/H %.2f' % (size.x / size.z, size.y / size.z))
    sheet('ref', hm * 1.05, poses=())

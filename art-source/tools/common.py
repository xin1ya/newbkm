# Shared helpers prepended to every step script (each execute_code call is a fresh namespace).
import bpy, bmesh, math, os, json
from mathutils import Vector, Matrix, Euler
PROJECT = r"__PROJECT_ROOT__"

def D(*p):
    return os.path.join(PROJECT, *p)

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

# ---------- palette material (one material, flat swatches addressed by UV) ----------
ASSET_DIR = 'pokemon'  # hkit.py switches to 'characters'
GRID = 8  # 8x8 swatches on a 256px image

def build_palette(model_id, colors):
    """colors: ordered list of (name, hex). Returns material. Saves PNG next to the source."""
    size = 256; cell = size // GRID
    img = bpy.data.images.get(f"PAL_{model_id}") or bpy.data.images.new(f"PAL_{model_id}", size, size, alpha=False)
    px = [0.0] * (size * size * 4)
    for idx, (_, hx) in enumerate(colors):
        r, g, b = hexrgb(hx); cx, cy = idx % GRID, idx // GRID
        for y in range(cy * cell, (cy + 1) * cell):
            for x in range(cx * cell, (cx + 1) * cell):
                o = (y * size + x) * 4; px[o:o + 4] = [r, g, b, 1.0]
    img.pixels = px
    path = D('art-source', ASSET_DIR, model_id, 'tex', f'{model_id}.png')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    img.colorspace_settings.name = 'sRGB'
    mat = bpy.data.materials.get(f"M_{model_id}") or bpy.data.materials.new(f"M_{model_id}")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new('ShaderNodeTexImage')
    tex.image = img; tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    mat["palette"] = json.dumps([c[0] for c in colors])
    return mat

def swatch_uv(mat, name):
    names = json.loads(mat["palette"]); idx = names.index(name)
    cx, cy = idx % GRID, idx // GRID
    return ((cx + 0.5) / GRID, (cy + 0.5) / GRID)

def paint(obj, mat, fn):
    """fn(center_world: Vector, normal_world: Vector, face) -> swatch name."""
    if not obj.data.materials: obj.data.materials.append(mat)
    bpy.context.view_layer.update()
    me = obj.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    mw = obj.matrix_world; nm = mw.to_3x3().inverted().transposed()
    cache = {}
    for p in me.polygons:
        c = mw @ p.center; n = (nm @ p.normal).normalized()
        nme = fn(c, n, p)
        if nme not in cache: cache[nme] = swatch_uv(mat, nme)
        u = cache[nme]
        for li in p.loop_indices: uv[li].uv = u

def paint_all(obj, mat, name):
    paint(obj, mat, lambda c, n, p: name)

# ---------- primitives ----------
def new_obj(name, me):
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o

def sphere(name, loc=(0, 0, 0), radius=1.0, seg=32, rings=16, scale=(1, 1, 1)):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=radius)
    for v in bm.verts: v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    bm.to_mesh(me); bm.free()
    o = new_obj(name, me); o.location = loc; smooth(o); return o

def cone(name, r1, r2, depth, verts=12, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free(); o = new_obj(name, me); o.location = loc; return o

def smooth(o, on=True):
    for p in o.data.polygons: p.use_smooth = on

def deform(o, fn):
    """fn(Vector local) -> Vector local"""
    for v in o.data.vertices: v.co = fn(v.co.copy())
    o.data.update()

def apply_tf(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def mirror_copy(o, name):
    c = o.copy(); c.data = o.data.copy(); c.name = name; c.data.name = name
    bpy.context.scene.collection.objects.link(c)
    c.location.x = -o.location.x
    c.rotation_euler = (o.rotation_euler.x, -o.rotation_euler.y, -o.rotation_euler.z)
    c.scale = o.scale.copy()
    # flip geometry in local X so asymmetric local shapes mirror correctly
    for v in c.data.vertices: v.co.x = -v.co.x
    c.data.flip_normals(); c.data.update()
    c.rotation_euler = (o.rotation_euler.x, -o.rotation_euler.y, -o.rotation_euler.z)
    return c

def tri_count(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == 'MESH']
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)

# ---------- check renders ----------
def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sh.show_object_outline = True; sh.object_outline_color = (0.1, 0.08, 0.08)
    sh.show_cavity = False; sh.show_shadows = False
    sc.render.resolution_x = 560; sc.render.resolution_y = 560
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    w = sc.world or bpy.data.worlds.new('World'); sc.world = w

VIEWS = {
    'front': (-25, 0.0), 'q34': (-25, 40.0), 'side': (-20, 90.0), 'back': (-25, 160.0),
}

def render_views(path, target=(0, 0, 0.15), dist=1.0, views=('front', 'q34', 'side', 'back')):
    setup_render()
    sc = bpy.context.scene
    cam = bpy.data.objects.get('CheckCam')
    if not cam:
        cam = bpy.data.objects.new('CheckCam', bpy.data.cameras.new('CheckCam'))
        sc.collection.objects.link(cam)
    cam.data.lens = 50; sc.camera = cam
    base, ext = os.path.splitext(path)
    outs = []
    for v in views:
        el, az = VIEWS[v]
        a = math.radians(az); e = math.radians(el)
        # azimuth 0 = camera in front of the model (model faces -Y)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), -math.sin(e) * -1))
        d.z = math.sin(-e) * -1 * -1  # camera above target
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(-e)))
        cam.location = Vector(target) + d * dist
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = f"{base}_{v}{ext}"; sc.render.filepath = f
        bpy.ops.render.render(write_still=True); outs.append(f)
    print('rendered', json.dumps(outs))

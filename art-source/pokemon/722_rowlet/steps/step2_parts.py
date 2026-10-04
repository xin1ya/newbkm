# Rowlet step 2: eyes, beak, leaf bowtie, wings, feet (each a closed mesh)
mat = bpy.data.materials['M_722_rowlet']
body = bpy.data.objects['rowlet_body']

def surf_y(x, z):
    """front surface y of the body at (x,z) via raycast from the front"""
    ok, loc, n, i = body.ray_cast(Vector((x, -1, z)), Vector((0, 1, 0)))
    return loc.y if ok else -0.1

# eyes: flattened dark ovals with a white highlight
for side, nm in ((1, 'l'), (-1, 'r')):
    x, z = 0.045 * side, 0.185
    y = surf_y(x, z)
    e = sphere(f'rowlet_eye_{nm}', loc=(x, y + 0.004, z), radius=1, seg=24, rings=12, scale=(0.022, 0.009, 0.027))
    e.rotation_euler = (0, 0, math.radians(-14 * side)); paint_all(e, mat, 'eye')
    h = sphere(f'rowlet_eyehl_{nm}', loc=(x + 0.008 * side, y - 0.004, z + 0.01), radius=1, seg=12, rings=6, scale=(0.007, 0.004, 0.008))
    paint_all(h, mat, 'eye_hl')

# beak: small down-pointing cone
yb = surf_y(0, 0.158)
b = cone('rowlet_beak', 0.013, 0.0015, 0.03, verts=10, loc=(0, yb - 0.004, 0.155))
b.rotation_euler = (math.radians(200), 0, 0); smooth(b); paint_all(b, mat, 'beak')

# leaf bowtie: two leaves at the neck, plus a knot
def leaf(name, length, width, thick):
    o = sphere(name, radius=1, seg=16, rings=10)
    def f(v):
        t = (v.x + 1) / 2                       # 0 at knot, 1 at tip
        w = math.sin(math.pi * min(1, t ** 0.8)) * width
        return Vector((t * length, v.y * thick, v.z * w))
    deform(o, f); return o
yn = surf_y(0, 0.085)
for side, nm in ((1, 'l'), (-1, 'r')):
    lf = leaf(f'rowlet_bow_{nm}', 0.07, 0.026, 0.008)
    lf.location = (0.006 * side, yn - 0.008, 0.088)
    lf.rotation_euler = (0, math.radians(-12 if side > 0 else 192), math.radians(-18 * side))
    paint(lf, mat, lambda c, n, p: 'leaf_dk' if abs(c.z - 0.088 - (abs(c.x)) * 0.2) < 0.003 else 'leaf')
k = sphere('rowlet_bow_knot', loc=(0, yn - 0.012, 0.088), radius=1, seg=12, rings=8, scale=(0.012, 0.009, 0.011))
paint_all(k, mat, 'leaf_dk')

# wings: feathered teardrops sitting ON the body side (raycast from outside), cream feather tips
def surf_x(side, y, z):
    ok, loc, n, _ = body.ray_cast(Vector((side * 1.0, y, z)), Vector((-side, 0, 0)))
    return loc.x if ok else side * 0.13
for side, nm in ((1, 'l'), (-1, 'r')):
    w = sphere(f'rowlet_wing_{nm}', radius=1, seg=28, rings=16)
    def fw(v):
        t = (1 - v.z) / 2                          # 0 top, 1 bottom tip
        width = 0.055 * (1 - 0.55 * t ** 1.6)     # teardrop in side view
        sc = math.cos(v.y * 3 * math.pi) * t ** 2  # scalloped feather tips
        return Vector((v.x * 0.016, v.y * width, v.z * 0.075 - sc * 0.004))
    deform(w, fw)
    sx = surf_x(side, 0.012, 0.14)
    w.location = (sx + side * 0.006, 0.012, 0.14)
    w.rotation_euler = (math.radians(-8), math.radians(-12 * side), 0)
    paint(w, mat, lambda c, n, p: 'wing_tip' if c.z < 0.092 else 'brown_dk' if c.z < 0.106 else 'brown')

# legs + feet: short orange legs, a pad, 3 forward talons and 1 back toe
for side, nm in ((1, 'l'), (-1, 'r')):
    x = 0.045 * side
    lg = cone(f'rowlet_leg_{nm}', 0.009, 0.012, 0.04, verts=12, loc=(x, -0.01, 0.032))
    smooth(lg); paint_all(lg, mat, 'foot')
    pad = sphere(f'rowlet_pad_{nm}', loc=(x, -0.016, 0.009), radius=1, seg=16, rings=8, scale=(0.015, 0.016, 0.008))
    paint_all(pad, mat, 'foot')
    for i, a in enumerate((-28, 0, 28)):
        ar = math.radians(a); dx, dy = math.sin(ar), -math.cos(ar)
        t = sphere(f'rowlet_toe_{nm}{i}', radius=1, seg=12, rings=8, scale=(0.0065, 0.019, 0.0065))
        t.location = (x + dx * 0.02, -0.016 + dy * 0.02, 0.0072)
        t.rotation_euler = (math.radians(-6), 0, ar)      # long axis (local Y) rotated onto (dx, dy)
        paint(t, mat, lambda c, n, p, cx=x + dx * 0.036, cy=-0.016 + dy * 0.036: 'brown_dk' if (c.x - cx) ** 2 + (c.y - cy) ** 2 < 0.006 ** 2 else 'foot')
    bt = sphere(f'rowlet_toe_{nm}b', loc=(x, 0.004, 0.007), radius=1, seg=10, rings=6, scale=(0.006, 0.012, 0.006))
    paint_all(bt, mat, 'foot')
print('tris', tri_count())

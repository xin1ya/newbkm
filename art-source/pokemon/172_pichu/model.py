# Pichu (172) · electric · 0.3 m. Tiny big-headed mouse: wide ears with black rims, pink cheeks, black collar mark, thin black-tipped tail.
reset('172_pichu')
M = pal([('yellow', '#f8da58'), ('black', '#1d1a18'), ('eye', '#1a1418'), ('white', '#ffffff'), ('cheek', '#f28cae'), ('mouth', '#7a3a2a')])
T = [(0, 0.07, 0.07), (0, 0.13, 0.1), (0, 0.17, 0.15), (0, 0.16, 0.2), (0, 0.2, 0.24)]
rig, mesh = build_mouse('pichu', {'H': 0.3, 'bz': 0.09, 'hz': 0.22, 'body': (0.075, 0.07, 0.085), 'head': (0.11, 0.095, 0.095), 'eyez': 0.0, 'eyex': 0.45, 'eye': (0.022, 0.01, 0.026),
    'cheek': (0.024, 0.008, 0.02), 'ear_ang': 55, 'ear_len': 0.14, 'ear_w': 0.055, 'ear_tip': 0.8, 'ear_flat': 0.35, 'ear_rim': True, 'arm_r': 0.015, 'foot': (0.028, 0.04, 0.016),
    'tail': T, 'tail_r': [0.012, 0.011, 0.01, 0.012, 0.018], 'tail_col': lambda c, n, p: 'black' if c.z > 0.19 else 'yellow', 'tail_flat': 0.4, 'collar': True})
plan_clips(rig, 'biped', size=0.3)
sheet('check', 0.35, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('idle_alt', 20, 'front')])
export(172, 'pichu', 0.3, 'biped', rig, mesh, shiny={'yellow': '#f0c238'})

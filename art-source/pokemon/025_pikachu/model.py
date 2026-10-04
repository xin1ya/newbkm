# Pikachu (25) · electric · 0.4 m. Yellow chubby mouse, long black-tipped ears, red cheeks, brown back stripes, lightning-bolt tail with brown base.
reset('025_pikachu')
M = pal([('yellow', '#f7d23a'), ('brown', '#8a5a2b'), ('black', '#1d1a18'), ('eye', '#1a1418'), ('white', '#ffffff'), ('cheek', '#e5463a'), ('mouth', '#7a3a2a')])
Z = [(0, 0.1, 0.1), (0, 0.16, 0.16), (0, 0.13, 0.24), (0, 0.22, 0.3), (0, 0.18, 0.38), (0, 0.28, 0.46)]
rig, mesh = build_mouse('pika', {'H': 0.4, 'bz': 0.14, 'hz': 0.31, 'body': (0.105, 0.095, 0.13), 'head': (0.115, 0.1, 0.1), 'eyez': 0.015, 'eyex': 0.42, 'eye': (0.022, 0.01, 0.026),
    'cheek': (0.026, 0.008, 0.024), 'ear_ang': 28, 'ear_len': 0.2, 'ear_w': 0.03, 'ear_tip': 0.72, 'ear_flat': 0.5, 'arm_r': 0.018, 'foot': (0.035, 0.05, 0.02),
    'tail': Z, 'tail_r': [0.02, 0.025, 0.035, 0.045, 0.055, 0.06], 'tail_col': lambda c, n, p: 'brown' if c.z < 0.13 else 'yellow', 'tail_flat': 0.2, 'stripes': True})
plan_clips(rig, 'biped', size=0.4, over={
    'attack_special': {'tail1': [(0, {}), (12, {'r': (-20, 0, 0)}), (22, {'r': (10, 0, 0)}), (40, {})]},   # Thunder Shock: tail up, cheeks spark via fx socket
})
sheet('check', 0.45, poses=[('walk', 6, 'side'), ('run', 4, 'side'), ('attack_special', 12, 'q34'), ('idle_alt', 20, 'front')])
export(25, 'pikachu', 0.4, 'biped', rig, mesh, shiny={'yellow': '#f7c02a', 'cheek': '#e5463a'})

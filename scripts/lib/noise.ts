/**
 * 构建期脚本用的确定性噪声（2D 梯度噪声 + fBm + 脊状噪声）。
 * 与运行时无关：生成的高度图/材质图才是真源，改种子会整体改变地形。
 */
export function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  const grad = (h: number, x: number, y: number) => {
    const g = h & 7;
    const u = g < 4 ? x : y;
    const v = g < 4 ? y : x;
    return (g & 1 ? -u : u) + (g & 2 ? -2 * v : 2 * v);
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  /** 约 [-1, 1] */
  const noise = (x: number, y: number): number => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X]! + Y]!;
    const ab = perm[perm[X]! + Y + 1]!;
    const ba = perm[perm[X + 1]! + Y]!;
    const bb = perm[perm[X + 1]! + Y + 1]!;
    const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
    const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 0.5;
  };
  const fbm = (x: number, y: number, oct = 4, lac = 2, gain = 0.5): number => {
    let a = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += a * noise(x * f, y * f);
      norm += a;
      a *= gain;
      f *= lac;
    }
    return sum / norm;
  };
  /** [0, 1]，山脊处接近 1 */
  const ridged = (x: number, y: number, oct = 4): number => {
    let a = 0.5;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(noise(x * f, y * f));
      sum += a * n * n;
      norm += a;
      a *= 0.5;
      f *= 2.1;
    }
    return sum / norm;
  };
  return { noise, fbm, ridged, rnd };
}

export type Vec2 = [number, number];

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** 多边形有向距离：内部为负 */
export function sdPolygon(px: number, pz: number, poly: readonly Vec2[]): number {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    const ex = xj - xi;
    const ez = zj - zi;
    const wx = px - xi;
    const wz = pz - zi;
    const t = clamp((wx * ex + wz * ez) / (ex * ex + ez * ez), 0, 1);
    const dx = wx - ex * t;
    const dz = wz - ez * t;
    d = Math.min(d, dx * dx + dz * dz);
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside ? -Math.sqrt(d) : Math.sqrt(d);
}

/** 到折线的距离 */
export function distPolyline(px: number, pz: number, pts: readonly Vec2[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const ex = bx - ax;
    const ez = bz - az;
    const t = clamp(((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez), 0, 1);
    d = Math.min(d, Math.hypot(px - ax - ex * t, pz - az - ez * t));
  }
  return d;
}

/** 折线上离点最近的位置 */
export function nearestOnPolyline(px: number, pz: number, pts: readonly Vec2[]): { x: number; z: number; d: number; dir: Vec2 } {
  let best = { x: pts[0]![0], z: pts[0]![1], d: Infinity, dir: [1, 0] as Vec2 };
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const ex = bx - ax;
    const ez = bz - az;
    const len = Math.hypot(ex, ez);
    const t = clamp(((px - ax) * ex + (pz - az) * ez) / (len * len), 0, 1);
    const x = ax + ex * t;
    const z = az + ez * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < best.d) best = { x, z, d, dir: [ex / len, ez / len] };
  }
  return best;
}

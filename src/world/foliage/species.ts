/**
 * 生态自然化 · 新树种与林下植物几何体。
 * 约定：真实颜色写在顶点色里，实例色只做接近白色的明暗 / 色相微变（避免树干被染绿）。
 * 原点在根部，+Y 向上，aSway = 风摆权重。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../util/hash';
import { colorize, lumpy } from './geometries';

const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(parts)!;

/** 沿 +X 伸展、向下弯垂的扁叶片（薄盒子分段弯曲）。用于棕榈叶、蕨叶 */
function frond(len: number, width: number, droop: number, segs: number, color: string, swayFrom: number, swayTo: number, lift = 0.35): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(len, 0.03, width, segs, 1, 1).translate(len / 2, 0, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) / len;
    // 叶片先上扬再下垂，宽度两头收窄
    const taper = Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.08));
    p.setZ(i, p.getZ(i) * taper);
    p.setY(i, p.getY(i) + lift * len * t - droop * len * t * t);
  }
  g.computeVertexNormals();
  return colorize(g, color, swayFrom, swayTo);
}

/** 树冠法线向外膨胀（卡通树的球形法线） */
function inflateNormals(g: THREE.BufferGeometry, minY: number, cx: number, cy: number, cz: number, k = 0.65): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const v = new THREE.Vector3();
  const o = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < minY) continue;
    v.set(p.getX(i) - cx, p.getY(i) - cy, p.getZ(i) - cz).normalize();
    o.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(v, k).normalize();
    n.setXYZ(i, o.x, o.y, o.z);
  }
  return g;
}

/** 弯曲的分段树干：沿 bend 方向（+X）弯曲，返回顶部位置 */
function curvedTrunk(h: number, r0: number, r1: number, bend: number, segs: number, radial: number, colors: [string, string]): { geo: THREE.BufferGeometry; top: THREE.Vector3 } {
  const parts: THREE.BufferGeometry[] = [];
  const pos = (t: number): THREE.Vector3 => new THREE.Vector3(bend * t * t, h * t, 0);
  for (let s = 0; s < segs; s++) {
    const a = pos(s / segs);
    const b = pos((s + 1) / segs);
    const len = a.distanceTo(b);
    const ra = r0 + (r1 - r0) * (s / segs);
    const rb = r0 + (r1 - r0) * ((s + 1) / segs);
    const c = new THREE.CylinderGeometry(rb, ra * 1.06, len * 1.04, radial, 1).translate(0, len / 2, 0);
    const dir = b.clone().sub(a).normalize();
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    c.translate(a.x, a.y, a.z);
    parts.push(colorize(c, colors[s % 2]!, 0, h * 1.6));
  }
  return { geo: merge(parts), top: pos(1) };
}

/** 椰子树：弯曲的环纹树干 + 8 片下垂的羽状叶 + 椰子 */
export function palmTreeGeometry(detail: 0 | 1): THREE.BufferGeometry {
  const h = 6.2;
  const { geo: trunk, top } = curvedTrunk(h, 0.26, 0.17, 1.4, detail ? 7 : 4, detail ? 7 : 5, ['#b38b5d', '#9a7449']);
  const parts = [trunk];
  const n = detail ? 9 : 6;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (k % 2) * 0.2;
    const f = frond(detail ? 3.4 : 3.2, 0.95, 0.75 + (k % 3) * 0.12, detail ? 7 : 3, k % 2 ? '#5aa847' : '#4f9a3f', h - 0.5, h + 1.5);
    f.rotateZ(0.18).rotateY(a).translate(top.x, top.y, top.z);
    parts.push(f);
  }
  // 树冠中心的嫩叶簇
  parts.push(colorize(new THREE.ConeGeometry(0.28, 0.8, 5, 1).translate(top.x, top.y + 0.35, top.z), '#6dbb52', h - 0.5, h + 1.5));
  if (detail) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      parts.push(colorize(new THREE.SphereGeometry(0.17, 6, 5).translate(top.x + Math.cos(a) * 0.25, top.y - 0.25, top.z + Math.sin(a) * 0.25), '#6b4a2b', h - 0.5, h + 1.5));
    }
  }
  return merge(parts);
}

/** 垂柳：粗短树干 + 分叉 + 圆顶树冠 + 一圈垂下的枝条帘 */
export function willowTreeGeometry(detail: 0 | 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(colorize(new THREE.CylinderGeometry(0.3, 0.46, 3, detail ? 7 : 5, 1).translate(0, 1.5, 0), '#6e5338', 0, 12));
  for (const [ax, az] of [
    [0.9, 0.3],
    [-0.7, -0.6],
  ] as const) {
    const b = new THREE.CylinderGeometry(0.12, 0.2, 1.8, 5, 1).translate(0, 0.9, 0);
    b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ax, 1.4, az).normalize()));
    b.translate(0, 2.6, 0);
    parts.push(colorize(b, '#6e5338', 0, 12));
  }
  const dome = lumpy(new THREE.IcosahedronGeometry(2.5, detail ? 1 : 0), 0.15, 71).scale(1.15, 0.62, 1.15).translate(0, 4.7, 0);
  parts.push(inflateNormals(colorize(dome, '#9cc867', 3, 8), 3.5, 0, 4.4, 0));
  const strands = detail ? 16 : 8;
  const rnd = seeded(72);
  for (let k = 0; k < strands; k++) {
    const a = (k / strands) * Math.PI * 2 + rnd() * 0.3;
    const r = 2.2 + rnd() * 0.5;
    const len = 2.6 + rnd() * 1.1;
    const c = new THREE.ConeGeometry(0.5 + rnd() * 0.2, len, detail ? 5 : 4, 1).rotateX(Math.PI).translate(Math.cos(a) * r, 4.4 - len / 2, Math.sin(a) * r);
    // 枝条帘：顶部几乎不动，末梢摆幅最大（反向风摆，aSway 按离挂点距离计算）
    const g = colorize(c, k % 2 ? '#8fbf5a' : '#a3cf6c', 0, 1);
    const p = g.getAttribute('position');
    const sw = g.getAttribute('aSway');
    for (let i = 0; i < p.count; i++) sw.setX(i, 0.35 + THREE.MathUtils.clamp((4.4 - p.getY(i)) / len, 0, 1) * 0.65);
    parts.push(g);
  }
  return merge(parts);
}

/** 白桦：白色细树干 + 黑色横纹 + 稀疏的黄绿小树冠 */
export function birchTreeGeometry(detail: 0 | 1): THREE.BufferGeometry {
  const h = 5.2;
  const parts: THREE.BufferGeometry[] = [colorize(new THREE.CylinderGeometry(0.12, 0.19, h, detail ? 7 : 5, 1).translate(0, h / 2, 0), '#ece8dc', 0, 14)];
  if (detail) {
    const rnd = seeded(81);
    for (let k = 0; k < 7; k++) {
      const y = 0.6 + k * 0.62 + rnd() * 0.2;
      const r = 0.19 - (y / h) * 0.07 + 0.008;
      parts.push(colorize(new THREE.CylinderGeometry(r, r, 0.07 + rnd() * 0.06, 7, 1, true).translate(0, y, 0).rotateY(rnd() * 3), '#34322e', 0, 14));
    }
  }
  const blobs: Array<[number, number, number, number]> = [
    [0, 5.6, 0, 1.3],
    [0.75, 4.7, 0.3, 0.95],
    [-0.6, 4.9, -0.4, 1.0],
    [0.15, 6.5, 0.2, 0.85],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    if (!detail && i > 1) return;
    const s = lumpy(new THREE.IcosahedronGeometry(r * (detail ? 1 : 1.25), detail ? 1 : 0), 0.22, 83 + i).translate(x, y, z);
    parts.push(colorize(s, i % 2 ? '#c2dc72' : '#b0d266', 3.5, 8));
  });
  return inflateNormals(merge(parts), 3.8, 0, 5.5, 0);
}

/** 樱花树：深色弯干 + 斜伸枝 + 粉色团簇树冠 */
export function blossomTreeGeometry(detail: 0 | 1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const { geo: trunk, top } = curvedTrunk(2.6, 0.3, 0.2, 0.5, detail ? 4 : 2, detail ? 7 : 5, ['#5e4034', '#5e4034']);
  parts.push(trunk);
  const branches: Array<[number, number, number]> = [
    [1.6, 1.2, 0.5],
    [-1.3, 1.3, -0.6],
    [0.2, 1.5, -1.3],
  ];
  for (const [bx, by, bz] of branches) {
    const d = new THREE.Vector3(bx, by, bz);
    const b = new THREE.CylinderGeometry(0.08, 0.16, d.length(), 5, 1).translate(0, d.length() / 2, 0);
    b.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    b.translate(top.x, top.y - 0.2, top.z);
    parts.push(colorize(b, '#5e4034', 0, 12));
  }
  const blobs: Array<[number, number, number, number, string]> = [
    [top.x, 4.0, 0, 1.9, '#ffc4da'],
    [top.x + 1.6, 3.7, 0.5, 1.35, '#ffb0cd'],
    [top.x - 1.3, 3.8, -0.6, 1.4, '#ffd3e3'],
    [top.x + 0.2, 4.1, -1.3, 1.2, '#ffb8d2'],
    [top.x + 0.1, 4.9, 0.2, 1.2, '#ffcfe0'],
  ];
  blobs.forEach(([x, y, z, r, c], i) => {
    if (!detail && i > 2) return;
    const s = lumpy(new THREE.IcosahedronGeometry(r * (detail ? 1 : 1.2), detail ? 1 : 0), 0.2, 91 + i).scale(1, 0.8, 1).translate(x, y, z);
    parts.push(colorize(s, c, 2.4, 6));
  });
  return inflateNormals(merge(parts), 2.6, top.x, 3.9, 0);
}

/** 海崖风压松：树干倾斜，层叠树冠偏向背风一侧（+X） */
export function windPineGeometry(detail: 0 | 1): THREE.BufferGeometry {
  const { geo: trunk, top } = curvedTrunk(3.6, 0.24, 0.13, 1.1, detail ? 5 : 3, 5, ['#6e4a32', '#6e4a32']);
  const parts = [trunk];
  const L = detail ? 4 : 2;
  for (let k = 0; k < L; k++) {
    const t = k / Math.max(1, L - 1);
    const r = 1.9 - t * 0.9;
    const pad = lumpy(new THREE.CylinderGeometry(r * 0.75, r, 0.55, detail ? 8 : 6, 1), 0.18, 101 + k)
      .scale(1.35, 1, 0.85)
      .translate(top.x * (0.45 + t * 0.55) + r * 0.45, 2.2 + k * (detail ? 0.75 : 1.4), 0);
    parts.push(colorize(pad, k % 2 ? '#4d7f45' : '#44753f', 1.8, 6));
  }
  return merge(parts);
}

// ———————————————————— 林下植物（每块合并成一个静态网格） ————————————————————

/** 蕨类：一圈拱形羽叶 */
export function fernGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 6;
  for (let k = 0; k < n; k++) {
    const len = 0.6 + rnd() * 0.35;
    const f = frond(len, 0.2, 1.3, 3, k % 2 ? '#4f8f3e' : '#5d9e46', 0, 0.5, 1.2);
    f.rotateY((k / n) * Math.PI * 2 + rnd() * 0.4);
    parts.push(f);
  }
  return merge(parts);
}

/** 蘑菇丛：variant 0 红伞白点 / 1 褐色 / 2 幻影之森的荧光蓝 */
export function mushroomGeometry(variant: 0 | 1 | 2, seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const cap = ['#d6443a', '#a8724a', '#8fd6ea'][variant]!;
  const parts: THREE.BufferGeometry[] = [];
  const n = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const s = 0.6 + rnd() * 0.6;
    const x = (rnd() - 0.5) * 0.35;
    const z = (rnd() - 0.5) * 0.35;
    const h = 0.12 * s;
    parts.push(colorize(new THREE.CylinderGeometry(0.022 * s, 0.03 * s, h, 5, 1).translate(x, h / 2, z), '#efe6d2', 0, 100));
    parts.push(colorize(new THREE.SphereGeometry(0.075 * s, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(x, h, z), cap, 0, 100));
    if (variant === 0) {
      for (let d = 0; d < 3; d++) {
        const a = rnd() * Math.PI * 2;
        parts.push(colorize(new THREE.SphereGeometry(0.012 * s, 4, 3).translate(x + Math.cos(a) * 0.04 * s, h + 0.045 * s, z + Math.sin(a) * 0.04 * s), '#ffffff', 0, 100));
      }
    }
  }
  return merge(parts);
}

/** 落叶堆：散落的小叶片 */
export function leafLitterGeometry(seed: number, autumn: boolean): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const cols = autumn ? ['#c9813a', '#b5622f', '#d8a74a', '#8f5a32'] : ['#8a7a45', '#9c8650', '#7c8a45', '#a37a48'];
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 12; k++) {
    const r = rnd() * 0.85;
    const a = rnd() * Math.PI * 2;
    const leaf = new THREE.PlaneGeometry(0.14, 0.09).rotateX(-Math.PI / 2 + (rnd() - 0.5) * 0.4).rotateY(rnd() * 3).translate(Math.cos(a) * r, 0.02 + rnd() * 0.02, Math.sin(a) * r);
    parts.push(colorize(leaf, cols[k % cols.length]!, 0, 100));
  }
  return merge(parts);
}

/** 倒木：带青苔的横卧树干 + 断面年轮 */
export function fallenLogGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const len = 2.4 + rnd() * 1.4;
  const r = 0.22 + rnd() * 0.1;
  const parts = [
    colorize(new THREE.CylinderGeometry(r * 0.9, r, len, 8, 1, true).rotateZ(Math.PI / 2).translate(0, r * 0.85, 0), '#6f4f35', 0, 100),
    colorize(new THREE.CircleGeometry(r * 0.9, 8).rotateY(Math.PI / 2).translate(-len / 2, r * 0.85, 0), '#c9a27a', 0, 100),
    colorize(new THREE.CircleGeometry(r, 8).rotateY(-Math.PI / 2).translate(len / 2, r * 0.85, 0), '#c9a27a', 0, 100),
    colorize(lumpy(new THREE.IcosahedronGeometry(1, 0), 0.3, seed).scale(len * 0.32, r * 0.35, r * 0.75).translate((rnd() - 0.5) * len * 0.3, r * 1.62, 0), '#6f9a45', 0, 100),
  ];
  // 一根折断的侧枝
  const b = new THREE.CylinderGeometry(0.04, 0.07, 0.7, 5, 1).rotateZ(-0.9).translate(len * 0.15, r * 1.4, r * 0.4);
  parts.push(colorize(b, '#6f4f35', 0, 100));
  return merge(parts);
}

/** 树桩：年轮顶面 + 根爪 */
export function stumpGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const r = 0.3 + rnd() * 0.12;
  const h = 0.35 + rnd() * 0.25;
  const parts = [
    colorize(new THREE.CylinderGeometry(r, r * 1.2, h, 8, 1, true).translate(0, h / 2, 0), '#6f4f35', 0, 100),
    colorize(new THREE.CircleGeometry(r, 8).rotateX(-Math.PI / 2).translate(0, h, 0), '#d1ab80', 0, 100),
    colorize(new THREE.RingGeometry(r * 0.45, r * 0.52, 8).rotateX(-Math.PI / 2).translate(0, h + 0.004, 0), '#a8825a', 0, 100),
  ];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rnd();
    const root = new THREE.ConeGeometry(0.11, 0.5, 4, 1).rotateZ(Math.PI / 2 - 0.35).rotateY(-a).translate(Math.cos(a) * r * 1.15, 0.06, Math.sin(a) * r * 1.15);
    parts.push(colorize(root, '#6f4f35', 0, 100));
  }
  return merge(parts);
}

/** 卵石：几块灰色圆石 */
export function pebblesGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const cols = ['#9a9a92', '#b4b2a8', '#86847e', '#c4bfb2'];
  const parts: THREE.BufferGeometry[] = [];
  const n = 3 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const s = 0.06 + rnd() * 0.12;
    const g = lumpy(new THREE.DodecahedronGeometry(s, 0), 0.3, seed + k).scale(1, 0.55, 0.85).translate((rnd() - 0.5) * 0.9, s * 0.25, (rnd() - 0.5) * 0.9);
    parts.push(colorize(g, cols[k % cols.length]!, 0, 100));
  }
  return merge(parts);
}

/** 芦苇 + 香蒲：细长叶丛，几根顶着褐色蒲棒 */
export function reedsGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 9 + Math.floor(rnd() * 5);
  for (let k = 0; k < n; k++) {
    const h = 1.1 + rnd() * 0.9;
    const x = (rnd() - 0.5) * 0.7;
    const z = (rnd() - 0.5) * 0.7;
    const lean = (rnd() - 0.5) * 0.25;
    const blade = new THREE.ConeGeometry(0.025, h, 3, 1).translate(0, h / 2, 0).rotateZ(lean).rotateY(rnd() * 3).translate(x, 0, z);
    parts.push(colorize(blade, k % 3 ? '#7fa04a' : '#93b257', 0, h));
    if (k % 4 === 0) {
      const tx = x - Math.sin(lean) * h * 0.85;
      const ty = Math.cos(lean) * h * 0.85;
      parts.push(colorize(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 6, 1).translate(tx, ty, z), '#6b4428', 0, h));
    }
  }
  return merge(parts);
}

/** 睡莲叶（带缺口的圆叶），flower = 叶上开一朵粉白睡莲 */
export function lilyPadGeometry(seed: number, flower: boolean): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const r = 0.28 + rnd() * 0.22;
    const x = (rnd() - 0.5) * 1.2;
    const z = (rnd() - 0.5) * 1.2;
    const pad = new THREE.CircleGeometry(r, 10, 0.25, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2).rotateY(rnd() * 6).translate(x, 0.015, z);
    parts.push(colorize(pad, k % 2 ? '#4f9a45' : '#5aa64c', 0, 100));
    if (flower && k === 0) {
      for (let p = 0; p < 6; p++) {
        const petal = new THREE.ConeGeometry(0.05, 0.16, 4, 1).rotateZ(-0.9).translate(0.05, 0.07, 0).rotateY((p / 6) * Math.PI * 2);
        parts.push(colorize(petal.translate(x, 0.02, z), p % 2 ? '#ffd3e3' : '#ffffff', 0, 100));
      }
      parts.push(colorize(new THREE.SphereGeometry(0.03, 5, 4).translate(x, 0.07, z), '#ffd34d', 0, 100));
    }
  }
  return merge(parts);
}

/** 浮木：被海水漂白的弯曲树枝 */
export function driftwoodGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const len = 1.2 + rnd() * 1.2;
  const a = new THREE.CylinderGeometry(0.06, 0.11, len, 6, 1).rotateZ(Math.PI / 2).translate(0, 0.08, 0);
  const b = new THREE.CylinderGeometry(0.03, 0.06, len * 0.5, 5, 1).rotateZ(Math.PI / 2 - 0.6).rotateY(0.5).translate(len * 0.2, 0.15, 0.12);
  return merge([colorize(a, '#d2c6ae', 0, 100), colorize(b, '#c4b79c', 0, 100)]);
}

/** 贝壳：扇贝与螺 */
export function shellsGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const cols = ['#f6e6d4', '#f2b9a6', '#efd9b8', '#ffffff'];
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const x = (rnd() - 0.5) * 0.8;
    const z = (rnd() - 0.5) * 0.8;
    const g =
      k % 2
        ? new THREE.ConeGeometry(0.035, 0.1, 5, 1).rotateZ(Math.PI / 2).rotateY(rnd() * 6).translate(x, 0.03, z)
        : new THREE.SphereGeometry(0.06, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1.1).translate(x, 0, z);
    parts.push(colorize(g, cols[(k + Math.floor(rnd() * 4)) % 4]!, 0, 100));
  }
  return merge(parts);
}

/**
 * 把多个几何体按各自矩阵与色调直接写进一个大缓冲区（比 clone + mergeGeometries 省一半内存分配）。
 * 所有输入必须是非索引几何体且带 position / normal / color / aSway。
 */
export function mergeTransformed(items: ReadonlyArray<{ geo: THREE.BufferGeometry; matrix: THREE.Matrix4; tint: THREE.Color }>): THREE.BufferGeometry | null {
  let total = 0;
  for (const it of items) total += it.geo.getAttribute('position').count;
  if (!total) return null;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const sw = new Float32Array(total);
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let o = 0;
  for (const { geo, matrix, tint } of items) {
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    const c = geo.getAttribute('color');
    const s = geo.getAttribute('aSway');
    nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++, o++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      pos[o * 3] = v.x;
      pos[o * 3 + 1] = v.y;
      pos[o * 3 + 2] = v.z;
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor[o * 3] = v.x;
      nor[o * 3 + 1] = v.y;
      nor[o * 3 + 2] = v.z;
      col[o * 3] = c.getX(i) * tint.r;
      col[o * 3 + 1] = c.getY(i) * tint.g;
      col[o * 3 + 2] = c.getZ(i) * tint.b;
      sw[o] = s.getX(i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
  g.computeBoundingSphere();
  return g;
}

// ———————————————————— 树根融入地面 ————————————————————

/** 根部隆起：4–5 条贴地的根爪 + 一圈略粗的基座，让树干“长进”地里而不是插在地上 */
export function rootFlareGeometry(color: string, seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const parts: THREE.BufferGeometry[] = [colorize(new THREE.CylinderGeometry(0.3, 0.46, 0.35, 7, 1, true).translate(0, 0.1, 0), color, 0, 100)];
  const n = 4 + Math.floor(rnd() * 2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.5;
    const len = 0.55 + rnd() * 0.35;
    const root = new THREE.ConeGeometry(0.13, len, 4, 1).rotateZ(Math.PI / 2 - 0.28).translate(len * 0.42 + 0.18, 0.07, 0).rotateY(-a);
    parts.push(colorize(root, color, 0, 100));
  }
  return merge(parts);
}

/** 樱花树下的落瓣：一片粉色小花瓣 */
export function petalLitterGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 16; k++) {
    const r = Math.sqrt(rnd()) * 1.6;
    const a = rnd() * Math.PI * 2;
    const p = new THREE.PlaneGeometry(0.07, 0.05).rotateX(-Math.PI / 2 + (rnd() - 0.5) * 0.3).rotateY(rnd() * 3).translate(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    parts.push(colorize(p, k % 3 ? '#ffc4da' : '#ffe3ee', 0, 100));
  }
  return merge(parts);
}

/** 针叶树下的松针 + 松果 */
export function needleLitterGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const parts: THREE.BufferGeometry[] = [colorize(new THREE.CircleGeometry(1.1, 9).rotateX(-Math.PI / 2).translate(0, 0.015, 0), '#8a6a45', 0, 100)];
  for (let k = 0; k < 3; k++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.4 + rnd() * 0.8;
    parts.push(colorize(new THREE.ConeGeometry(0.05, 0.13, 5, 1).rotateZ(Math.PI / 2).rotateY(rnd() * 6).translate(Math.cos(a) * r, 0.04, Math.sin(a) * r), '#6e4a2c', 0, 100));
  }
  return merge(parts);
}

/** 椰子树下掉落的椰子 */
export function coconutsGeometry(seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 1 + Math.floor(rnd() * 2);
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.6 + rnd() * 0.8;
    parts.push(colorize(new THREE.SphereGeometry(0.16, 6, 5).scale(1, 0.85, 1.1).translate(Math.cos(a) * r, 0.12, Math.sin(a) * r), k ? '#7a5a32' : '#5f8a3a', 0, 100));
  }
  return merge(parts);
}

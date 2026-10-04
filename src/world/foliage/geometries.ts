/**
 * WLD-003 · 植被几何体（程序化灰盒版，美术模型到位后替换为 glb，接口不变）。
 * 所有几何体的原点在根部，+Y 向上；uv.y / 顶点属性 aSway 表示离根高度比例（风摆权重）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../util/hash';

/**
 * 草簇：5 片弯曲草叶，每片 3 段，锥形；uv.y = 高度比例。
 * 性能 P1 远景版：grassClumpGeometry(3, 1) = 3 片单段草叶（6 个三角形，原来 30 个）。
 */
export function grassClumpGeometry(blades = 5, segments = 3): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const rnd = seeded(7);
  const BLADES = blades;
  const SEG = segments;
  for (let b = 0; b < BLADES; b++) {
    const ang = (b / BLADES) * Math.PI * 2 + rnd() * 0.6;
    const r = 0.03 + rnd() * 0.09;
    const ox = Math.cos(ang) * r;
    const oz = Math.sin(ang) * r;
    const facing = ang + Math.PI / 2 + (rnd() - 0.5) * 0.8;
    const fx = Math.cos(facing);
    const fz = Math.sin(facing);
    const lean = 0.12 + rnd() * 0.18;
    const h = 0.75 + rnd() * 0.5;
    const w = 0.045 + rnd() * 0.02;
    const base = pos.length / 3;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const width = w * (1 - t * 0.92);
      const bend = lean * t * t;
      const cx = ox + Math.cos(ang) * bend;
      const cz = oz + Math.sin(ang) * bend;
      const y = h * t;
      pos.push(cx - fx * width, y, cz - fz * width, cx + fx * width, y, cz + fz * width);
      uv.push(0, t, 1, t);
      // 法线朝上偏外：草地整体受光更均匀（卡通草的常用做法）
      nrm.push(Math.cos(ang) * 0.3, 1, Math.sin(ang) * 0.3, Math.cos(ang) * 0.3, 1, Math.sin(ang) * 0.3);
    }
    for (let s = 0; s < SEG; s++) {
      const a = base + s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.normalizeNormals();
  return g;
}

export function colorize(g: THREE.BufferGeometry, c: THREE.ColorRepresentation, swayFrom: number, swayTo: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  const color = new THREE.Color(c);
  for (let i = 0; i < n; i++) color.toArray(col, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sway = new Float32Array(n);
  const p = geo.getAttribute('position');
  for (let i = 0; i < n; i++) sway[i] = THREE.MathUtils.clamp((p.getY(i) - swayFrom) / (swayTo - swayFrom), 0, 1);
  geo.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  geo.deleteAttribute('uv');
  return geo;
}

/** 扰动顶点，得到“手捏”的块状树冠 */
export function lumpy(g: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const rnd = seeded(seed);
  const p = g.getAttribute('position');
  const map = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let f = map.get(k);
    if (f === undefined) map.set(k, (f = 1 + (rnd() - 0.5) * amount));
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

/** 阔叶树：树干 + 3 团树冠。detail 0 = 远景低模 */
export function broadleafTreeGeometry(detail: 0 | 1): THREE.BufferGeometry {
  const trunkH = 3.2;
  const trunk = colorize(new THREE.CylinderGeometry(0.22, 0.34, trunkH, detail ? 7 : 5, 1).translate(0, trunkH / 2, 0), '#8a5a3b', 0, 12);
  const canopy: THREE.BufferGeometry[] = [];
  const blobs: Array<[number, number, number, number]> = [
    [0, 4.6, 0, 2.2],
    [1.1, 3.9, 0.4, 1.5],
    [-0.9, 4.1, -0.5, 1.6],
    [0.2, 5.6, -0.3, 1.4],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    if (!detail && i > 1) return;
    const s = lumpy(new THREE.IcosahedronGeometry(r * (detail ? 1 : 1.2), detail ? 1 : 0), 0.18, 11 + i);
    s.translate(x, y, z);
    canopy.push(colorize(s, i % 2 ? '#ffffff' : '#e8f3dd', 2.5, 7));
  });
  const g = mergeGeometries([trunk, ...canopy])!;
  // 树冠法线向外“膨胀”：卡通树常用的球形法线，明暗交界更干净
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 2.6) continue;
    const v = new THREE.Vector3(p.getX(i), p.getY(i) - 4.6, p.getZ(i)).normalize();
    const o = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i)).lerp(v, 0.7).normalize();
    n.setXYZ(i, o.x, o.y, o.z);
  }
  return g;
}

/** 针叶树：树干 + 3 层圆锥 */
export function pineTreeGeometry(detail: 0 | 1): THREE.BufferGeometry {
  const trunk = colorize(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5, 1).translate(0, 1.1, 0), '#7a5034', 0, 12);
  const layers: THREE.BufferGeometry[] = [];
  const L = detail ? 3 : 2;
  for (let k = 0; k < L; k++) {
    const r = 2.1 - k * (detail ? 0.55 : 0.8);
    const h = 2.6 - k * 0.3;
    const c = new THREE.ConeGeometry(r, h, detail ? 8 : 6, 1).translate(0, 2.2 + k * 1.45 + h / 2, 0);
    layers.push(colorize(c, '#ffffff', 1.8, 7.5));
  }
  return mergeGeometries([trunk, ...layers])!;
}

/** 灌木 */
export function bushGeometry(): THREE.BufferGeometry {
  const parts = [
    [0, 0.45, 0, 0.6],
    [0.45, 0.35, 0.15, 0.45],
    [-0.4, 0.35, -0.1, 0.48],
  ].map(([x, y, z, r], i) => colorize(lumpy(new THREE.IcosahedronGeometry(r!, 1), 0.2, 30 + i).translate(x!, y!, z!), '#ffffff', 0, 1));
  return mergeGeometries(parts)!;
}

/** 岩石（压扁的块状多面体） */
export function rockGeometry(seed: number): THREE.BufferGeometry {
  const g = lumpy(new THREE.DodecahedronGeometry(1, 0), 0.45, seed).scale(1, 0.62, 0.85).translate(0, 0.35, 0);
  return colorize(g, '#ffffff', 0, 100);
}

/** 花茎（绿色，不受实例色影响——使用单独的实例化网格） */
export function flowerStemGeometry(): THREE.BufferGeometry {
  return colorize(new THREE.CylinderGeometry(0.012, 0.016, 0.34, 4, 1).translate(0, 0.17, 0), '#5c9e3f', 0, 0.34);
}

/** 花头：5 片花瓣 + 花心（白色顶点色 × instanceColor = 花色） */
export function flowerHeadGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) parts.push(colorize(new THREE.SphereGeometry(0.06, 6, 4).scale(1, 0.3, 0.6).translate(0.065, 0, 0).rotateY((k / 5) * Math.PI * 2), '#ffffff', -1, 0));
  parts.push(colorize(new THREE.SphereGeometry(0.035, 6, 4).translate(0, 0.012, 0), '#ffe27a', -1, 0));
  const g = mergeGeometries(parts)!.translate(0, 0.35, 0);
  const sway = g.getAttribute('aSway');
  for (let i = 0; i < sway.count; i++) sway.setX(i, 1);
  return g;
}

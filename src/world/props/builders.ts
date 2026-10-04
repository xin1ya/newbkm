/**
 * WLD-005 · 灰盒建筑构件：输出带顶点色的非索引几何体（世界坐标），由 GrayboxProps 按块合并。
 * solid = 墙体、屋顶等（Toon 场景材质）；glow = 窗户、灯（夜间自发光）
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PropParts {
  solid: THREE.BufferGeometry[];
  glow: THREE.BufferGeometry[];
}

export function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, m?: THREE.Matrix4): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  const n = geo.getAttribute('position').count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (m) geo.applyMatrix4(m);
  return geo;
}

export const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) =>
  paint(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), color);

export const cyl = (rt: number, rb: number, h: number, seg: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) =>
  paint(new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z), color);

/** 双坡屋顶（三棱柱，沿 z 方向），底边宽 w、高 h、长 d */
export function gableRoof(w: number, h: number, d: number, color: THREE.ColorRepresentation, y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(0, y, -d / 2);
  return paint(g, color);
}

/** 窗户：在墙面 +Z / -Z / ±X 上贴一块略凸出的方块 */
function windowsOnFace(parts: PropParts, w: number, d: number, y: number, count: number, face: 'front' | 'back' | 'left' | 'right', size = 1.1): void {
  const len = face === 'front' || face === 'back' ? w : d;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1) - 0.5;
    const off = t * len;
    let g: THREE.BufferGeometry;
    if (face === 'front') g = box(size, size, 0.12, '#bfe3f2', off, y, d / 2 + 0.02);
    else if (face === 'back') g = box(size, size, 0.12, '#bfe3f2', off, y, -d / 2 - 0.02);
    else if (face === 'left') g = box(0.12, size, size, '#bfe3f2', -w / 2 - 0.02, y, off);
    else g = box(0.12, size, size, '#bfe3f2', w / 2 + 0.02, y, off);
    parts.glow.push(g);
    // 窗框
    const f = face === 'front' || face === 'back' ? box(size + 0.25, 0.14, 0.2, '#ffffff', off, y - 0.1, (face === 'front' ? 1 : -1) * (d / 2 + 0.05)) : box(0.2, 0.14, size + 0.25, '#ffffff', (face === 'left' ? -1 : 1) * (w / 2 + 0.05), y - 0.1, off);
    parts.solid.push(f);
  }
}

export function house(w: number, h: number, d: number, wall: string, roof: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  const wallH = h * 0.58;
  p.solid.push(box(w + 0.3, 0.4, d + 0.3, '#b9ad9a', 0, 0, 0)); // 地基
  p.solid.push(box(w, wallH, d, wall, 0, 0.4, 0));
  p.solid.push(gableRoof(w + 1.1, h - wallH - 0.4, d + 1.0, roof, wallH + 0.4));
  p.solid.push(box(1.4, 2.3, 0.2, '#7a5238', 0, 0.4, d / 2 + 0.05)); // 门
  p.solid.push(box(2.4, 0.18, 1.2, '#b9ad9a', 0, 0.2, d / 2 + 0.6)); // 台阶
  p.solid.push(box(0.8, 1.6, 0.8, '#9b6b54', w * 0.25, h - 1.2, -d * 0.2)); // 烟囱
  windowsOnFace(p, w, d, 0.4 + wallH * 0.45, 2, 'front');
  windowsOnFace(p, w, d, 0.4 + wallH * 0.45, 2, 'back');
  windowsOnFace(p, w, d, 0.4 + wallH * 0.45, 1, 'left');
  windowsOnFace(p, w, d, 0.4 + wallH * 0.45, 1, 'right');
  return p;
}

export function lab(w: number, h: number, d: number, wall: string, accent: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  p.solid.push(box(w + 0.4, 0.4, d + 0.4, '#c9c4bb'));
  p.solid.push(box(w, h - 1, d, wall, 0, 0.4, 0));
  p.solid.push(box(w + 0.6, 0.6, d + 0.6, accent, 0, h - 0.6, 0)); // 屋檐带
  p.solid.push(box(w * 0.4, 1.4, d * 0.4, '#dfe6ee', -w * 0.2, h, 0)); // 屋顶机房
  for (let i = 0; i < 3; i++) p.solid.push(paint(new THREE.BoxGeometry(2.4, 0.1, 1.6).rotateX(-0.35).translate(w * 0.15 + i * 2.6 - 2.6, h + 0.5, -d * 0.15), '#2f4f7a'));
  p.solid.push(box(3, 2.8, 0.2, '#8fc9e6', 0, 0.4, d / 2 + 0.05)); // 玻璃门
  p.solid.push(box(4.4, 0.35, 1.8, accent, 0, 3.4, d / 2 + 0.9)); // 雨棚
  windowsOnFace(p, w, d, 2.4, 4, 'front', 1.4);
  windowsOnFace(p, w, d, 2.4, 4, 'back', 1.4);
  windowsOnFace(p, w, d, 2.4, 2, 'left', 1.4);
  windowsOnFace(p, w, d, 2.4, 2, 'right', 1.4);
  return p;
}

export function pokecenter(w: number, h: number, d: number, wall: string, roof: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  p.solid.push(box(w + 0.4, 0.4, d + 0.4, '#d9d2c7'));
  p.solid.push(box(w, h - 1.6, d, wall, 0, 0.4, 0));
  p.solid.push(box(w + 1.2, 1.2, d + 1.2, roof, 0, h - 1.2, 0));
  p.solid.push(box(w * 0.5, 0.9, d * 0.5, roof, 0, h, 0));
  // 精灵球标志（白底红半圆）
  const ball = new THREE.CylinderGeometry(1.4, 1.4, 0.25, 24).rotateX(Math.PI / 2).translate(0, h - 0.6, d / 2 + 0.75);
  p.solid.push(paint(ball, '#ffffff'));
  const top = new THREE.CylinderGeometry(1.42, 1.42, 0.27, 24, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, h - 0.6, d / 2 + 0.76);
  p.glow.push(paint(top, '#ff5b52'));
  p.solid.push(box(3.4, 3, 0.2, '#9fd6ef', 0, 0.4, d / 2 + 0.05));
  windowsOnFace(p, w, d, 2.3, 3, 'back', 1.3);
  windowsOnFace(p, w, d, 2.3, 2, 'left', 1.3);
  windowsOnFace(p, w, d, 2.3, 2, 'right', 1.3);
  for (const sx of [-1, 1]) p.glow.push(box(3, 1.6, 0.12, '#bfe3f2', sx * (w / 2 - 2.6), 1.6, d / 2 + 0.02));
  return p;
}

export function mart(w: number, h: number, d: number, wall: string, roof: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  p.solid.push(box(w + 0.4, 0.4, d + 0.4, '#d0cabe'));
  p.solid.push(box(w, h - 1.2, d, wall, 0, 0.4, 0));
  p.solid.push(box(w + 0.8, 1.2, d + 0.8, roof, 0, h - 1.2, 0));
  p.glow.push(box(w * 0.6, 0.9, 0.2, '#e8f4ff', 0, h - 1.05, d / 2 + 0.45)); // 招牌灯箱
  p.solid.push(box(2.6, 2.6, 0.2, '#9fd6ef', 0, 0.4, d / 2 + 0.05));
  for (const sx of [-1, 1]) p.glow.push(box(2.4, 1.5, 0.12, '#bfe3f2', sx * (w / 2 - 2.2), 1.5, d / 2 + 0.02));
  windowsOnFace(p, w, d, 2.2, 2, 'left');
  windowsOnFace(p, w, d, 2.2, 2, 'right');
  return p;
}

export function gym(w: number, h: number, wall: string, roof: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  const r = w / 2;
  p.solid.push(cyl(r + 1.5, r + 2, 0.6, 8, '#cfd8dc')); // 平台
  p.solid.push(cyl(r, r, h * 0.55, 8, wall, 0, 0.6, 0));
  p.solid.push(paint(new THREE.SphereGeometry(r * 0.98, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.6 + h * 0.55, 0), roof));
  p.solid.push(cyl(0.6, 0.6, 2.4, 8, '#ffffff', 0, 0.6 + h * 0.55 + r * 0.58, 0));
  p.glow.push(paint(new THREE.OctahedronGeometry(1.1).translate(0, 0.6 + h * 0.55 + r * 0.58 + 3.2, 0), '#7fe3ff')); // 水之徽章塔尖
  // 八面窗带
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const g = new THREE.BoxGeometry(3.2, 1.4, 0.2).translate(0, 0, r * Math.cos(Math.PI / 8) + 0.05).rotateY(a).translate(0, 0.6 + h * 0.3, 0);
    p.glow.push(paint(g, '#bfe3f2'));
  }
  // 大门（朝 +Z，GrayboxProps 通过 yaw 旋转朝向栈桥）
  p.solid.push(box(4, 4, 1.2, '#2f7fa8', 0, 0.6, r * 0.92));
  return p;
}

export function lighthouse(w: number, h: number, wall: string, stripe: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  const r = w / 2;
  p.solid.push(cyl(r * 1.5, r * 1.6, 1.2, 12, '#b8b0a4'));
  const bands = 6;
  const tower = h - 5;
  for (let i = 0; i < bands; i++) {
    const y0 = 1.2 + (tower * i) / bands;
    const r0 = r * (1 - (0.35 * i) / bands);
    const r1 = r * (1 - (0.35 * (i + 1)) / bands);
    p.solid.push(cyl(r1, r0, tower / bands, 16, i % 2 ? stripe : wall, 0, y0, 0));
  }
  const top = 1.2 + tower;
  p.solid.push(cyl(r * 0.95, r * 0.95, 0.3, 16, '#3a3f4a', 0, top, 0)); // 瞭望台
  p.glow.push(cyl(r * 0.5, r * 0.5, 2.2, 12, '#fff3b0', 0, top + 0.3, 0)); // 灯室
  p.solid.push(paint(new THREE.ConeGeometry(r * 0.7, 1.8, 12).translate(0, top + 3.4, 0), stripe));
  return p;
}

export function warehouse(w: number, h: number, d: number, wall: string, roof: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  p.solid.push(box(w, h * 0.65, d, wall));
  const arch = new THREE.CylinderGeometry(w / 2 + 0.3, w / 2 + 0.3, d + 0.6, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(0);
  // 半圆柱沿 z：先绕 x 转，使轴沿 z，再压扁高度
  p.solid.push(paint(arch.scale(1, 1, 1), roof, new THREE.Matrix4().makeScale(1, (h * 0.35) / (w / 2), 1).premultiply(new THREE.Matrix4().makeTranslation(0, h * 0.65, 0))));
  p.solid.push(box(w * 0.45, h * 0.5, 0.2, '#6d7f8c', 0, 0, d / 2 + 0.05));
  windowsOnFace(p, w, d, h * 0.5, 3, 'left');
  windowsOnFace(p, w, d, h * 0.5, 3, 'right');
  return p;
}

export function dock(w: number, len: number, deckY: number, groundY: (lz: number) => number): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  p.solid.push(box(w, 0.35, len, '#b8875a', 0, deckY - 0.35, 0));
  for (let k = -len / 2 + 0.5; k < len / 2; k += 1.1) p.solid.push(box(w + 0.05, 0.04, 0.08, '#8c6340', 0, deckY, k)); // 板缝
  for (let z = -len / 2 + 1; z <= len / 2; z += 3.5)
    for (const sx of [-1, 1]) {
      const gy = Math.min(groundY(z), deckY - 1);
      p.solid.push(cyl(0.18, 0.2, deckY - gy + 0.6, 6, '#6e4a30', sx * (w / 2 - 0.2), gy, z));
    }
  p.solid.push(box(0.5, 0.5, 0.5, '#4f5560', w / 2 - 0.4, deckY, len / 2 - 0.8)); // 系缆桩
  p.solid.push(box(0.5, 0.5, 0.5, '#4f5560', -w / 2 + 0.4, deckY, len / 2 - 0.8));
  return p;
}

export function lamp(h: number): PropParts {
  return {
    solid: [cyl(0.07, 0.1, h, 6, '#3d4452'), box(0.7, 0.08, 0.12, '#3d4452', 0.25, h - 0.1, 0), cyl(0.2, 0.28, 0.12, 8, '#3d4452', 0.55, h - 0.25, 0)],
    glow: [paint(new THREE.SphereGeometry(0.2, 8, 6).translate(0.55, h - 0.35, 0), '#fff1c2')],
  };
}

export function sign(): PropParts {
  return { solid: [cyl(0.06, 0.06, 1.3, 5, '#7a5238'), cyl(0.06, 0.06, 1.3, 5, '#7a5238', 1.2, 0, 0), box(1.6, 0.8, 0.1, '#c89a64', 0.6, 0.8, 0)], glow: [] };
}

export function crate(s: number): PropParts {
  return { solid: [box(s, s, s, '#b9864f'), box(s + 0.04, 0.12, s + 0.04, '#8a5d34', 0, s * 0.45, 0)], glow: [] };
}

export function boat(w: number, h: number, d: number, hull: string, stripe: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  const hullG = new THREE.CylinderGeometry(w / 2, w / 2.6, d, 12, 1).rotateX(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.6, 0);
  p.solid.push(paint(hullG, hull));
  p.solid.push(box(w * 1.02, 0.35, d * 0.9, stripe, 0, 0.9, 0));
  p.solid.push(box(w * 0.7, h * 0.4, d * 0.4, '#ffffff', 0, 1.2, -d * 0.1));
  p.solid.push(box(w * 0.75, 0.3, d * 0.45, stripe, 0, 1.2 + h * 0.4, -d * 0.1));
  p.solid.push(cyl(0.35, 0.4, 1.8, 10, '#e25a4f', 0, 1.5 + h * 0.4, -d * 0.2));
  windowsOnFace(p, w * 0.7, d * 0.4, 1.8, 3, 'left', 0.7);
  windowsOnFace(p, w * 0.7, d * 0.4, 1.8, 3, 'right', 0.7);
  return p;
}

export function breakableRock(r: number): PropParts {
  const g = new THREE.DodecahedronGeometry(r, 0).scale(1, 0.8, 1).translate(0, r * 0.7, 0);
  const crack = box(0.12, r * 1.2, r * 1.9, '#4a4640', 0, r * 0.15, 0);
  return { solid: [paint(g, '#8e867c'), crack], glow: [] };
}

/**
 * 海崖洞口：嵌进崖壁的黑色洞穴 + 两侧岩柱与顶部横石组成的拱形洞框 + 洞前碎石。
 * 局部 +Z 为洞口朝向；原点在洞口地面中心。w / h 为洞口宽高。
 */
export function caveMouth(w: number, h: number): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  const rock = (r: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, rot = 0): void => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot * 0.7, rot, rot * 0.4)), new THREE.Vector3(sx, sy, sz));
    p.solid.push(paint(new THREE.DodecahedronGeometry(r, 0), color, m));
  };
  // 洞内：深黑色的“洞腔”（往崖里伸 4 m，前缘略露出崖面）+ 地面渐暗
  p.solid.push(box(w * 0.74, h * 0.82, 4.2, '#0d0b10', 0, 0, -2.4)); // 前缘缩在洞框岩石后面，不露出方角
  p.solid.push(box(w * 0.7, h * 0.55, 0.3, '#060508', 0, h * 0.12, -3.6));
  p.solid.push(box(w * 0.8, 0.08, 2.2, '#2c2a2e', 0, -0.02, -1.0));
  // 洞框：左右岩柱（各 3 块叠放），顶部横石（3 块），颜色深浅交错
  const cols = ['#7d766c', '#6b655d', '#8a8378'];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y = 0.6 + k * h * 0.32;
      rock(1, s * (w / 2 + 0.35 - k * 0.12), y, 0.15 - k * 0.1, 0.95 - k * 0.1, 0.85, 0.9, cols[(k + (s > 0 ? 1 : 0)) % 3]!, k * 0.7 + s);
    }
  }
  for (let k = -1; k <= 1; k++) rock(1, k * w * 0.36, h * 0.98 + (k === 0 ? 0.25 : 0), 0.05, 1.05, 0.7, 0.95, cols[(k + 3) % 3]!, k * 1.3 + 0.4);
  // 洞前碎石
  for (const [x, z, r] of [[-w * 0.62, 1.2, 0.35], [w * 0.55, 1.5, 0.28], [w * 0.2, 2.1, 0.2], [-w * 0.3, 2.4, 0.22]] as const) rock(r, x, r * 0.5, z, 1, 0.75, 1, '#77716a', x + z);
  return p;
}

export function well(): PropParts {
  return {
    solid: [
      cyl(1.1, 1.2, 0.9, 12, '#a7a198'),
      cyl(0.9, 0.9, 0.05, 12, '#2c5f7a', 0, 0.8, 0),
      cyl(0.08, 0.08, 2.2, 5, '#7a5238', -1, 0.9, 0),
      cyl(0.08, 0.08, 2.2, 5, '#7a5238', 1, 0.9, 0),
      gableRoof(2.8, 0.9, 1.8, '#c95e45', 3),
    ],
    glow: [],
  };
}

export function marketStall(w: number, h: number, d: number, canopy: string): PropParts {
  const p: PropParts = { solid: [], glow: [] };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(cyl(0.06, 0.06, h, 5, '#7a5238', (sx * w) / 2, 0, (sz * d) / 2));
  for (let i = 0; i < 4; i++) p.solid.push(box(w / 4 + 0.02, 0.15, d + 0.6, i % 2 ? '#ffffff' : canopy, -w / 2 + w / 8 + (i * w) / 4, h, 0));
  p.solid.push(box(w, 0.9, 0.8, '#c89a64', 0, 0, d / 2 - 0.4));
  for (let i = 0; i < 5; i++) p.solid.push(box(0.35, 0.3, 0.35, ['#f26b4f', '#f7d046', '#7ac74c'][i % 3]!, -w / 2 + 0.5 + i * 0.75, 0.9, d / 2 - 0.4));
  return p;
}

export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!parts.length) return null;
  for (const g of parts) {
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

/**
 * M1-02 / M1-03 / M1-04 · 城镇细化构件。
 *
 * 与 builders.ts 相同的约定：局部坐标，y = 0 为地面（或平台顶面），正面朝 +Z；
 * 输出带顶点色的非索引几何体，solid 走 Toon 场景材质，glow 为夜间自发光（窗、灯、灯笼）。
 * 所有随机细节（花色、窗帘、货物）由 seed 决定，保证同一份 props.json 每次生成一致。
 */
import * as THREE from 'three';
import { box, cyl, paint, type PropParts } from './builders';

// ———————————————————————— 基础工具 ————————————————————————

export function rng(seed: number): () => number {
  let s = (seed | 0) ^ 0x9e3779b9;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d);
    s = Math.imul(s ^ (s >>> 12), 0x297a2d39);
    s ^= s >>> 15;
    return (s >>> 0) / 4294967296;
  };
}

const newParts = (): PropParts => ({ solid: [], glow: [] });
const M = () => new THREE.Matrix4();

/** 任意朝向的方块：中心 (x, y, z)，依次绕 X、Y、Z 旋转 */
export function boxAt(w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.BufferGeometry {
  const m = M().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
  return paint(new THREE.BoxGeometry(w, h, d), color, m);
}

function sphere(r: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, detail = 1): THREE.BufferGeometry {
  return paint(new THREE.IcosahedronGeometry(r, detail).scale(sx, sy, sz).translate(x, y, z), color);
}

/** 两点之间的圆柱（绳索、斜撑、帆桁） */
function beam(a: THREE.Vector3, b: THREE.Vector3, r: number, color: THREE.ColorRepresentation, seg = 5): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  const m = M().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  return paint(g, color, m);
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const FLOWER_COLORS = ['#f26b8a', '#f7d046', '#ffffff', '#b98cf0', '#ff8c42', '#e94f4f', '#7fc8f8'];
const GLASS = '#bfe3f2';
const WARM_GLASS = '#ffe3a8';

// ———————————————————————— 建筑部件 ————————————————————————

/**
 * 双坡屋顶：两块坡面板 + 屋脊 + 封檐板 + 两端山墙三角（墙色）。
 * 屋脊沿 z，底面在 y，檐口外挑 ov。
 */
function gable(p: PropParts, w: number, rh: number, d: number, y: number, roof: string, wall: string, ov = 0.55, trim = '#ffffff'): void {
  const half = w / 2 + ov;
  const slope = Math.atan2(rh, w / 2);
  const len = Math.hypot(half, rh * (half / (w / 2)));
  const t = 0.26;
  for (const s of [-1, 1]) {
    const cx = (s * half) / 2;
    const cy = y + rh - (rh * (half / (w / 2))) / 2;
    p.solid.push(boxAt(len, t, d + ov * 2, roof, cx, cy + t / 2, 0, 0, 0, -s * slope));
    // 瓦楞：沿坡面的细横条
    const rows = Math.max(2, Math.floor(len / 0.7));
    for (let i = 1; i < rows; i++) {
      const k = i / rows;
      const lx = s * half * (1 - k);
      const ly = y + rh * (1 - (half * (1 - k)) / (w / 2)) + t + 0.02;
      p.solid.push(boxAt(0.1, 0.07, d + ov * 2, shade(roof, -0.12), lx, ly, 0, 0, 0, -s * slope));
    }
  }
  p.solid.push(boxAt(0.34, 0.34, d + ov * 2 + 0.1, shade(roof, -0.25), 0, y + rh + t + 0.05, 0)); // 屋脊
  // 山墙三角
  const tri = new THREE.Shape();
  tri.moveTo(-w / 2, 0);
  tri.lineTo(w / 2, 0);
  tri.lineTo(0, rh);
  tri.closePath();
  for (const s of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }).translate(0, y, s > 0 ? d / 2 - 0.12 : -d / 2);
    p.solid.push(paint(g, wall));
    // 封檐板（沿山墙两条斜边）
    for (const e of [-1, 1]) {
      const a = V(e * half, y - (ov * rh) / (w / 2), s * (d / 2 + ov));
      const b = V(0, y + rh + 0.05, s * (d / 2 + ov));
      p.solid.push(beam(a, b, 0.09, trim, 4));
    }
  }
}

/** 四坡屋顶（金字塔形，四角檐） */
function hip(p: PropParts, w: number, rh: number, d: number, y: number, roof: string, ov = 0.5): void {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).scale(w + ov * 2, rh, d + ov * 2).translate(0, y + rh / 2, 0);
  p.solid.push(paint(g, roof));
  p.solid.push(box(w + ov * 2 + 0.1, 0.18, d + ov * 2 + 0.1, shade(roof, -0.2), 0, y - 0.1, 0));
  p.solid.push(cyl(0.12, 0.2, 0.5, 6, shade(roof, -0.3), 0, y + rh - 0.1, 0));
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + k, 0, 1));
  return `#${c.getHexString()}`;
}

type Face = 'front' | 'back' | 'left' | 'right';

/** 墙面上的局部坐标 → 物体坐标（u 沿墙水平，off = 离墙外凸） */
function onFace(face: Face, w: number, d: number, u: number, off: number): { x: number; z: number; ry: number } {
  switch (face) {
    case 'front':
      return { x: u, z: d / 2 + off, ry: 0 };
    case 'back':
      return { x: -u, z: -d / 2 - off, ry: Math.PI };
    case 'left':
      return { x: -w / 2 - off, z: u, ry: -Math.PI / 2 };
    case 'right':
      return { x: w / 2 + off, z: -u, ry: Math.PI / 2 };
  }
}

interface WindowOpts {
  size?: [number, number];
  shutters?: string | null;
  flowerBox?: boolean;
  frame?: string;
  warm?: boolean;
  rand?: () => number;
  mullion?: boolean;
}

function windowAt(p: PropParts, face: Face, w: number, d: number, u: number, y: number, o: WindowOpts = {}): void {
  const [ww, wh] = o.size ?? [1.1, 1.25];
  const f = o.frame ?? '#ffffff';
  const at = (off: number) => onFace(face, w, d, u, off);
  const g = at(0.03);
  p.glow.push(boxAt(ww, wh, 0.08, o.warm ? WARM_GLASS : GLASS, g.x, y + wh / 2, g.z, g.ry));
  const fr = at(0.07);
  // 窗框：上下左右 + 十字窗棂
  p.solid.push(boxAt(ww + 0.22, 0.12, 0.14, f, fr.x, y + wh + 0.06, fr.z, fr.ry));
  p.solid.push(boxAt(ww + 0.34, 0.14, 0.3, f, at(0.13).x, y - 0.07, at(0.13).z, fr.ry)); // 窗台
  for (const s of [-1, 1]) {
    const side = onFace(face, w, d, u + (s * (ww + 0.11)) / 2, 0.07);
    p.solid.push(boxAt(0.11, wh, 0.14, f, side.x, y + wh / 2, side.z, fr.ry));
  }
  if (o.mullion !== false) {
    p.solid.push(boxAt(0.06, wh, 0.1, f, at(0.08).x, y + wh / 2, at(0.08).z, fr.ry));
    p.solid.push(boxAt(ww, 0.06, 0.1, f, at(0.08).x, y + wh * 0.55, at(0.08).z, fr.ry));
  }
  if (o.shutters) {
    for (const s of [-1, 1]) {
      const sh = onFace(face, w, d, u + s * (ww / 2 + 0.36), 0.06);
      p.solid.push(boxAt(0.5, wh + 0.1, 0.07, o.shutters, sh.x, y + wh / 2, sh.z, fr.ry));
      for (let k = 0; k < 4; k++) p.solid.push(boxAt(0.44, 0.04, 0.09, shade(o.shutters, -0.12), sh.x, y + 0.2 + k * (wh / 4), sh.z, fr.ry));
    }
  }
  if (o.flowerBox) {
    const fb = at(0.3);
    p.solid.push(boxAt(ww + 0.2, 0.3, 0.34, '#8a5a3c', fb.x, y - 0.3, fb.z, fr.ry));
    const r = o.rand ?? Math.random;
    for (let k = 0; k < 5; k++) {
      const fl = onFace(face, w, d, u - ww / 2 + 0.1 + (k * ww) / 4, 0.3);
      p.solid.push(sphere(0.13, '#5f9e4a', fl.x, y - 0.02, fl.z, 1, 0.8, 1, 0));
      p.solid.push(sphere(0.08, FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)]!, fl.x, y + 0.1, fl.z, 1, 1, 1, 0));
    }
  }
}

interface DoorOpts {
  color?: string;
  frame?: string;
  canopy?: string | null;
  width?: number;
  height?: number;
  lamp?: boolean;
  glass?: boolean;
  step?: string;
  y?: number;
}

function doorAt(p: PropParts, _w: number, d: number, u: number, o: DoorOpts = {}): void {
  const dw = o.width ?? 1.3;
  const dh = o.height ?? 2.25;
  const y = o.y ?? 0.4;
  const z = d / 2;
  const frame = o.frame ?? '#ffffff';
  if (o.glass) {
    p.glow.push(box(dw, dh, 0.1, GLASS, u, y, z + 0.03));
    p.solid.push(box(0.08, dh, 0.14, frame, u, y, z + 0.06));
  } else {
    p.solid.push(box(dw, dh, 0.12, o.color ?? '#7a5238', u, y, z + 0.03));
    // 门板凹槽 + 门上小窗 + 把手
    for (const s of [-1, 1]) p.solid.push(box(dw * 0.34, dh * 0.34, 0.05, shade(o.color ?? '#7a5238', 0.08), u + s * dw * 0.22, y + 0.25, z + 0.1));
    p.glow.push(box(dw * 0.6, 0.35, 0.05, WARM_GLASS, u, y + dh - 0.55, z + 0.1));
    p.solid.push(sphere(0.06, '#e3c46a', u + dw * 0.36, y + 1.05, z + 0.14, 1, 1, 1, 0));
  }
  p.solid.push(box(dw + 0.3, 0.16, 0.18, frame, u, y + dh, z + 0.07));
  for (const s of [-1, 1]) p.solid.push(box(0.15, dh, 0.18, frame, u + s * (dw / 2 + 0.07), y, z + 0.07));
  // 台阶 + 地垫
  p.solid.push(box(dw + 1.2, y * 0.5, 1.2, o.step ?? '#b9ad9a', u, 0, z + 0.6));
  p.solid.push(box(dw + 1.2, y * 0.5, 0.7, o.step ?? '#b9ad9a', u, y * 0.5, z + 0.35));
  p.solid.push(box(dw * 0.9, 0.03, 0.5, '#a0523d', u, y + 0.01, z + 0.35));
  if (o.canopy) {
    const cz = z + 0.55;
    p.solid.push(boxAt(dw + 1.1, 0.14, 1.2, o.canopy, u, y + dh + 0.55, cz, 0, 0.28));
    for (const s of [-1, 1]) p.solid.push(beam(V(u + s * (dw / 2 + 0.4), y + dh - 0.1, z + 0.05), V(u + s * (dw / 2 + 0.4), y + dh + 0.45, cz + 0.45), 0.05, frame, 4));
  }
  if (o.lamp !== false) {
    const lx = u + dw / 2 + 0.55;
    p.solid.push(box(0.14, 0.3, 0.14, '#3d4452', lx, y + dh - 0.1, z + 0.1));
    p.glow.push(box(0.22, 0.28, 0.22, '#fff1c2', lx, y + dh - 0.45, z + 0.2));
  }
}

function chimney(p: PropParts, x: number, y: number, z: number, h: number, color = '#9b6b54'): void {
  p.solid.push(box(0.8, h, 0.8, color, x, y, z));
  for (let k = 0.4; k < h; k += 0.5) p.solid.push(box(0.84, 0.05, 0.84, shade(color, -0.1), x, y + k, z));
  p.solid.push(box(1.0, 0.18, 1.0, '#6e6a66', x, y + h, z));
}

function cornerTrim(p: PropParts, w: number, d: number, y: number, h: number, color: string): void {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(box(0.26, h, 0.26, color, (sx * w) / 2, y, (sz * d) / 2));
}

function windowCount(len: number, spacing = 2.6): number {
  return Math.max(1, Math.floor((len - 1.4) / spacing));
}

function evenly(len: number, n: number, skipCenter = false): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(((i + 1) / (n + 1) - 0.5) * len);
  return skipCenter ? out.filter((u) => Math.abs(u) > 1.3) : out;
}

// ———————————————————————— 民居 ————————————————————————

/**
 * 民居。variant：
 *   gable（默认）单层双坡 · two-storey 两层带阳台 · timber 木构架（蒲婆婆家） · cottage 四坡顶带门廊 · townhouse 港湾商住楼（平顶女儿墙 + 雨棚）
 */
export function house(w: number, h: number, d: number, wall: string, roof: string, variant = 'gable', seed = 1, accent?: string): PropParts {
  const p = newParts();
  const r = rng(seed);
  const acc = accent ?? ['#5b8fb0', '#6aa56b', '#c86b5a', '#8a6fb0', '#d9a441'][Math.floor(r() * 5)]!;
  const plinth = '#b3a894';
  p.solid.push(box(w + 0.4, 0.45, d + 0.4, plinth));
  for (let k = -w / 2; k < w / 2; k += 0.9) p.solid.push(box(0.05, 0.3, d + 0.44, shade(plinth, -0.1), k, 0.08, 0)); // 石缝
  if (variant === 'townhouse') return townhouse(p, w, h, d, wall, roof, acc, r);
  const floors = variant === 'two-storey' ? 2 : 1;
  const wallH = variant === 'cottage' ? h * 0.55 : floors === 2 ? h * 0.66 : h * 0.58;
  const y0 = 0.4;
  p.solid.push(box(w, wallH, d, wall, 0, y0, 0));
  cornerTrim(p, w, d, y0, wallH, variant === 'timber' ? '#5a3e2b' : '#ffffff');
  p.solid.push(box(w + 0.1, 0.2, d + 0.1, variant === 'timber' ? '#5a3e2b' : shade(wall, -0.12), 0, y0 + wallH - 0.2, 0)); // 檐下带
  if (variant === 'timber') {
    // 木构架：横梁、立柱、斜撑
    const tc = '#5a3e2b';
    for (const face of ['front', 'back', 'left', 'right'] as Face[]) {
      const len = face === 'front' || face === 'back' ? w : d;
      const hb = onFace(face, w, d, 0, 0.04);
      p.solid.push(boxAt(len, 0.18, 0.08, tc, hb.x, y0 + wallH * 0.48, hb.z, hb.ry));
      const posts = Math.max(2, Math.round(len / 2));
      for (let i = 1; i < posts; i++) {
        const u = -len / 2 + (i * len) / posts;
        const pp = onFace(face, w, d, u, 0.04);
        p.solid.push(boxAt(0.16, wallH, 0.08, tc, pp.x, y0 + wallH / 2, pp.z, pp.ry));
        if (i % 2 === 1 && face !== 'front') {
          const a = onFace(face, w, d, u - len / posts, 0.05);
          const b = onFace(face, w, d, u, 0.05);
          p.solid.push(beam(V(a.x, y0 + 0.1, a.z), V(b.x, y0 + wallH * 0.46, b.z), 0.07, tc, 4));
        }
      }
    }
  }
  if (floors === 2) p.solid.push(box(w + 0.16, 0.16, d + 0.16, '#ffffff', 0, y0 + wallH / 2 - 0.08, 0));
  // 屋顶
  const rh = h - wallH - y0;
  if (variant === 'cottage') hip(p, w, rh, d, y0 + wallH, roof, 0.6);
  else gable(p, w, rh, d, y0 + wallH, roof, variant === 'timber' ? '#efe3c6' : wall, 0.6, variant === 'timber' ? '#5a3e2b' : '#ffffff');
  if (variant !== 'cottage') p.glow.push(box(0.8, 0.8, 0.08, WARM_GLASS, 0, y0 + wallH + rh * 0.3, d / 2 + 0.02)); // 山墙小窗
  chimney(p, w * 0.26 * (r() > 0.5 ? 1 : -1), y0 + wallH + rh * 0.35, -d * 0.18, rh * 0.75 + 0.8);
  // 门（门在正面，可略偏）
  const doorU = w > 8.5 && variant !== 'two-storey' ? 0 : 0;
  doorAt(p, w, d, doorU, { color: variant === 'timber' ? '#6b4a33' : shade(acc, -0.15), canopy: variant === 'cottage' ? null : roof, frame: variant === 'timber' ? '#5a3e2b' : '#ffffff' });
  // 窗
  const rows = floors === 2 ? [y0 + 0.95, y0 + wallH / 2 + 0.75] : [y0 + wallH * 0.3];
  for (const [ri, wy] of rows.entries()) {
    const nFront = windowCount(w);
    for (const u of evenly(w, Math.max(2, nFront), ri === 0)) windowAt(p, 'front', w, d, u, wy, { shutters: variant === 'timber' ? '#6b4a33' : acc, flowerBox: ri === rows.length - 1 || floors === 1, rand: r, frame: variant === 'timber' ? '#5a3e2b' : '#ffffff' });
    for (const u of evenly(w, windowCount(w))) windowAt(p, 'back', w, d, u, wy, { shutters: null });
    for (const face of ['left', 'right'] as Face[]) for (const u of evenly(d, windowCount(d, 3.2))) windowAt(p, face, w, d, u, wy, { shutters: variant === 'gable' ? acc : null });
  }
  if (floors === 2) {
    // 二楼小阳台（正面左侧）
    const bx = -w * 0.25;
    const by = y0 + wallH / 2;
    p.solid.push(box(2.6, 0.18, 1.1, '#ffffff', bx, by - 0.1, d / 2 + 0.55));
    for (let k = 0; k <= 6; k++) p.solid.push(box(0.06, 0.8, 0.06, '#ffffff', bx - 1.25 + k * (2.5 / 6), by, d / 2 + 1.05));
    p.solid.push(box(2.6, 0.08, 0.1, '#ffffff', bx, by + 0.8, d / 2 + 1.05));
    for (const s of [-1, 1]) p.solid.push(beam(V(bx + s * 1.1, by - 0.8, d / 2 + 0.05), V(bx + s * 1.1, by - 0.1, d / 2 + 1.0), 0.05, '#ffffff', 4));
  }
  if (variant === 'cottage') {
    // 门廊：两根柱 + 小坡顶
    const pz = d / 2 + 1.5;
    for (const s of [-1, 1]) p.solid.push(cyl(0.1, 0.12, wallH, 6, '#ffffff', s * 1.6, y0, pz));
    p.solid.push(box(4, 0.18, 2.4, '#c9b79c', 0, 0.22, d / 2 + 1.2));
    p.solid.push(boxAt(4.2, 0.16, 2.3, roof, 0, y0 + wallH + 0.05, d / 2 + 1.2, 0, 0.2));
  }
  // 雨水管
  for (const s of [-1, 1]) p.solid.push(cyl(0.06, 0.06, wallH, 5, '#8c9097', s * (w / 2 + 0.12), y0, d / 2 - 0.25));
  return p;
}

function townhouse(p: PropParts, w: number, h: number, d: number, wall: string, roof: string, acc: string, r: () => number): PropParts {
  const y0 = 0.4;
  const wallH = h - 0.9;
  p.solid.push(box(w, wallH, d, wall, 0, y0, 0));
  p.solid.push(box(w + 0.3, 0.5, d + 0.3, shade(wall, -0.15), 0, y0 + wallH, 0)); // 女儿墙
  p.solid.push(box(w - 0.6, 0.12, d - 0.6, '#8f8a83', 0, y0 + wallH + 0.1, 0));
  // 屋顶水箱与晾衣
  p.solid.push(cyl(0.6, 0.6, 1.2, 10, '#d0d4d8', w * 0.25, y0 + wallH + 0.2, -d * 0.2));
  p.solid.push(box(1.6, 0.9, 1.2, roof, -w * 0.25, y0 + wallH + 0.2, -d * 0.25));
  cornerTrim(p, w, d, y0, wallH, shade(wall, -0.1));
  p.solid.push(box(w + 0.12, 0.18, d + 0.12, '#ffffff', 0, y0 + 3.0, 0)); // 楼层线
  // 底层店面：大玻璃 + 条纹雨棚 + 招牌
  const shopW = w - 2.6;
  p.glow.push(box(shopW - 1.6, 1.7, 0.1, WARM_GLASS, -0.8, y0 + 0.6, d / 2 + 0.03));
  for (let k = 0; k <= 3; k++) p.solid.push(box(0.08, 1.7, 0.14, '#ffffff', -0.8 - (shopW - 1.6) / 2 + (k * (shopW - 1.6)) / 3, y0 + 0.6, d / 2 + 0.06));
  doorAt(p, w, d, shopW / 2 - 0.2, { glass: true, lamp: false, width: 1.2 });
  const stripes = Math.round(w / 0.8);
  for (let i = 0; i < stripes; i++) p.solid.push(boxAt(w / stripes + 0.01, 0.1, 1.5, i % 2 ? '#ffffff' : acc, -w / 2 + (i + 0.5) * (w / stripes), y0 + 2.75, d / 2 + 0.7, 0, 0.32));
  p.solid.push(box(w * 0.6, 0.6, 0.12, shade(acc, -0.2), 0, y0 + 3.2, d / 2 + 0.08));
  p.glow.push(box(w * 0.5, 0.36, 0.06, '#fff6dc', 0, y0 + 3.32, d / 2 + 0.16));
  // 上层窗
  for (let fy = y0 + 3.6; fy + 1.3 < y0 + wallH; fy += 2.3)
    for (const u of evenly(w, windowCount(w, 2.2))) windowAt(p, 'front', w, d, u, fy, { shutters: acc, flowerBox: r() > 0.4, rand: r, size: [0.95, 1.2] });
  for (const face of ['left', 'right', 'back'] as Face[]) {
    const len = face === 'back' ? w : d;
    for (let fy = y0 + 1.0; fy + 1.3 < y0 + wallH; fy += 2.3) for (const u of evenly(len, windowCount(len, 3))) windowAt(p, face, w, d, u, fy, { size: [0.9, 1.1] });
  }
  void roof;
  return p;
}

// ———————————————————————— 公共建筑 ————————————————————————

/** 木兰研究所：主楼 + 玻璃门厅 + 侧翼 + 屋顶太阳能板 / 风机 / 天线 */
export function lab(w: number, h: number, d: number, wall: string, accent: string): PropParts {
  const p = newParts();
  const y0 = 0.45;
  p.solid.push(box(w + 0.6, y0, d + 0.6, '#c9c4bb'));
  const mainH = h - 1.2;
  p.solid.push(box(w, mainH, d, wall, 0, y0, 0));
  // 竖向装饰肋 + 顶部色带
  for (let k = -w / 2 + 1.5; k < w / 2; k += 3) p.solid.push(box(0.3, mainH, 0.2, shade(wall, -0.06), k, y0, d / 2 + 0.05));
  p.solid.push(box(w + 0.7, 0.7, d + 0.7, accent, 0, y0 + mainH - 0.1, 0));
  p.solid.push(box(w + 0.3, 0.3, d + 0.3, '#ffffff', 0, y0 + mainH + 0.6, 0));
  // 玻璃门厅（突出正面）
  const aw = 6;
  const ad = 3;
  p.glow.push(box(aw - 0.2, 3.4, ad - 0.1, GLASS, 0, y0, d / 2 + ad / 2));
  for (let k = 0; k <= 4; k++) p.solid.push(box(0.12, 3.4, 0.14, '#ffffff', -aw / 2 + 0.1 + (k * (aw - 0.2)) / 4, y0, d / 2 + ad));
  for (const s of [-1, 1]) p.solid.push(box(0.14, 3.4, ad, '#ffffff', s * (aw / 2 - 0.05), y0, d / 2 + ad / 2));
  p.solid.push(box(aw + 0.8, 0.35, ad + 0.8, accent, 0, y0 + 3.4, d / 2 + ad / 2));
  p.solid.push(box(1.8, 2.5, 0.1, '#2f4f7a', 0, y0, d / 2 + ad + 0.06)); // 自动门
  p.solid.push(box(aw + 1.5, 0.2, 1.5, '#c9c4bb', 0, 0, d / 2 + ad + 0.6));
  // 招牌（叶子徽记）
  p.solid.push(box(4.4, 1.0, 0.18, '#ffffff', 0, y0 + mainH - 1.6, d / 2 + 0.1));
  p.glow.push(paint(new THREE.CircleGeometry(0.36, 16).translate(-1.6, y0 + mainH - 1.1, d / 2 + 0.21), '#7fd36b'));
  p.solid.push(box(2.6, 0.22, 0.05, accent, 0.4, y0 + mainH - 1.05, d / 2 + 0.2));
  p.solid.push(box(2.0, 0.14, 0.05, shade(accent, 0.2), 0.1, y0 + mainH - 1.35, d / 2 + 0.2));
  // 窗带
  for (const row of [y0 + 1.1, y0 + 3.7]) {
    for (const u of evenly(w, 6).filter((u) => Math.abs(u) > aw / 2 + 0.6 || row > 3)) windowAt(p, 'front', w, d, u, row, { size: [1.6, 1.4], frame: '#ffffff' });
    for (const u of evenly(w, 6)) windowAt(p, 'back', w, d, u, row, { size: [1.6, 1.4] });
    for (const face of ['left', 'right'] as Face[]) for (const u of evenly(d, 3)) windowAt(p, face, w, d, u, row, { size: [1.4, 1.4] });
  }
  // 屋顶：太阳能板阵列 + 小风机 + 碟形天线 + 栏杆
  const top = y0 + mainH + 0.9;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++) {
      p.solid.push(boxAt(2.2, 0.08, 1.4, '#243a5e', -w * 0.3 + i * 2.5, top + 0.55, -d * 0.2 + j * 1.8, 0, -0.35));
      p.solid.push(box(0.1, 0.4, 0.1, '#8c9097', -w * 0.3 + i * 2.5, top, -d * 0.2 + j * 1.8));
    }
  const tx = w * 0.32;
  const tz = -d * 0.18;
  p.solid.push(cyl(0.12, 0.18, 4.2, 8, '#e8ecef', tx, top, tz));
  p.solid.push(box(0.4, 0.4, 0.8, '#e8ecef', tx, top + 4.1, tz));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    p.solid.push(boxAt(0.22, 1.7, 0.05, '#ffffff', tx + Math.sin(a) * 0.85, top + 4.3 + Math.cos(a) * 0.85, tz + 0.45, 0, 0, -a));
  }
  const dish = new THREE.SphereGeometry(1.0, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3.2).rotateX(-0.9).translate(w * 0.1, top + 1.3, d * 0.2);
  p.solid.push(paint(dish, '#f2f4f5'));
  p.solid.push(cyl(0.08, 0.1, 1.2, 6, '#8c9097', w * 0.1, top, d * 0.2));
  for (let k = -w / 2 + 0.3; k <= w / 2 - 0.3; k += 1.2)
    for (const s of [-1, 1]) p.solid.push(box(0.06, 0.8, 0.06, '#d0d4d8', k, top, s * (d / 2 - 0.1)));
  for (const s of [-1, 1]) p.solid.push(box(w - 0.4, 0.06, 0.06, '#d0d4d8', 0, top + 0.8, s * (d / 2 - 0.1)));
  // 侧翼低层（右侧），接温室
  p.solid.push(box(4.5, 3.4, d * 0.7, shade(wall, -0.04), w / 2 + 2.25, y0, -d * 0.1));
  p.solid.push(box(4.9, 0.4, d * 0.7 + 0.4, accent, w / 2 + 2.25, y0 + 3.4, -d * 0.1));
  windowAt(p, 'front', w + 9, d * 0.7, w / 2 + 2.25, y0 + 1.2, { size: [2.2, 1.2] });
  return p;
}

/** 宝可梦中心：红顶白墙、玻璃自动门、入口雨棚、屋顶精灵球标志 */
export function pokecenter(w: number, h: number, d: number, wall: string, roof: string): PropParts {
  const p = newParts();
  const y0 = 0.45;
  p.solid.push(box(w + 0.6, y0, d + 0.6, '#d9d2c7'));
  const wallH = h - 2.1;
  p.solid.push(box(w, wallH, d, wall, 0, y0, 0));
  cornerTrim(p, w, d, y0, wallH, '#f0e6da');
  p.solid.push(box(w + 0.2, 0.5, d + 0.2, '#e8ddd0', 0, y0, 0)); // 墙裙
  // 红色斜面屋顶（四坡截顶）+ 白色檐口
  const rg = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.78, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).scale(w + 1.4, 1.5, d + 1.4).translate(0, y0 + wallH + 0.75, 0);
  p.solid.push(paint(rg, roof));
  p.solid.push(box(w + 1.5, 0.25, d + 1.5, '#ffffff', 0, y0 + wallH - 0.05, 0));
  p.solid.push(box((w + 1.4) * 0.78 - 0.2, 0.3, (d + 1.4) * 0.78 - 0.2, shade(roof, -0.1), 0, y0 + wallH + 1.5, 0));
  // 屋顶标志：立式精灵球 + 支架
  const sy = y0 + wallH + 3.0;
  const sz = d * 0.2;
  p.solid.push(box(0.3, 1.4, 0.3, '#d0d4d8', -0.8, y0 + wallH + 1.6, sz));
  p.solid.push(box(0.3, 1.4, 0.3, '#d0d4d8', 0.8, y0 + wallH + 1.6, sz));
  p.solid.push(paint(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 28).rotateX(Math.PI / 2).translate(0, sy, sz), '#ffffff'));
  p.glow.push(paint(new THREE.CylinderGeometry(1.52, 1.52, 0.32, 28, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, sy, sz), '#ff5b52'));
  p.solid.push(box(3.06, 0.22, 0.36, '#2b2b30', 0, sy - 0.11, sz));
  p.solid.push(paint(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 16).rotateX(Math.PI / 2).translate(0, sy, sz), '#2b2b30'));
  p.glow.push(paint(new THREE.CylinderGeometry(0.28, 0.28, 0.44, 16).rotateX(Math.PI / 2).translate(0, sy, sz), '#ffffff'));
  // 入口：双开玻璃门 + 红白雨棚 + 立柱
  const ew = 4.2;
  p.glow.push(box(ew, 2.8, 0.1, GLASS, 0, y0, d / 2 + 0.03));
  p.solid.push(box(0.1, 2.8, 0.16, '#ffffff', 0, y0, d / 2 + 0.06));
  p.solid.push(box(ew + 0.4, 0.2, 0.18, '#ffffff', 0, y0 + 2.8, d / 2 + 0.07));
  p.solid.push(box(ew + 3, 0.35, 3.2, roof, 0, y0 + 3.3, d / 2 + 1.6));
  p.solid.push(box(ew + 3.1, 0.12, 3.3, '#ffffff', 0, y0 + 3.2, d / 2 + 1.6));
  for (const s of [-1, 1]) p.solid.push(cyl(0.14, 0.16, 3.2, 8, '#ffffff', s * (ew / 2 + 1.2), y0, d / 2 + 2.9));
  p.solid.push(box(ew + 3.4, 0.22, 3.6, '#d9d2c7', 0, 0, d / 2 + 1.8));
  // 两侧大窗 + 花槽
  for (const s of [-1, 1]) {
    const u = s * (w / 2 - 2.8);
    p.glow.push(box(3.2, 1.7, 0.1, GLASS, u, y0 + 1.0, d / 2 + 0.03));
    for (let k = 0; k <= 2; k++) p.solid.push(box(0.1, 1.7, 0.14, '#ffffff', u - 1.6 + k * 1.6, y0 + 1.0, d / 2 + 0.06));
    p.solid.push(box(3.6, 0.5, 0.6, '#c9b79c', u, y0, d / 2 + 0.4));
    for (let k = 0; k < 6; k++) p.solid.push(sphere(0.2, k % 2 ? '#f26b8a' : '#5f9e4a', u - 1.5 + k * 0.6, y0 + 0.6, d / 2 + 0.4, 1, 0.8, 1, 0));
  }
  for (const face of ['left', 'right', 'back'] as Face[]) {
    const len = face === 'back' ? w : d;
    for (const u of evenly(len, windowCount(len, 3))) windowAt(p, face, w, d, u, y0 + 1.2, { size: [1.4, 1.4] });
  }
  return p;
}

/** 友好商店：蓝色条纹雨棚、灯箱招牌、橱窗货架 */
export function mart(w: number, h: number, d: number, wall: string, roof: string): PropParts {
  const p = newParts();
  const y0 = 0.45;
  p.solid.push(box(w + 0.6, y0, d + 0.6, '#d0cabe'));
  const wallH = h - 1.4;
  p.solid.push(box(w, wallH, d, wall, 0, y0, 0));
  cornerTrim(p, w, d, y0, wallH, '#dfe6ee');
  p.solid.push(box(w + 0.9, 1.0, d + 0.9, roof, 0, y0 + wallH, 0));
  p.solid.push(box(w + 1.0, 0.18, d + 1.0, '#ffffff', 0, y0 + wallH + 1.0, 0));
  // 屋顶空调外机
  for (const s of [-1, 1]) {
    p.solid.push(box(1.4, 0.9, 1.0, '#d0d4d8', s * w * 0.25, y0 + wallH + 1.18, -d * 0.2));
    p.solid.push(paint(new THREE.CircleGeometry(0.35, 12).translate(s * w * 0.25, y0 + wallH + 1.63, -d * 0.2 + 0.51), '#6d7f8c'));
  }
  // 灯箱招牌
  p.solid.push(box(w * 0.7, 1.1, 0.25, '#ffffff', 0, y0 + wallH - 1.35, d / 2 + 0.12));
  p.glow.push(box(w * 0.66, 0.8, 0.1, '#e8f4ff', 0, y0 + wallH - 1.2, d / 2 + 0.26));
  p.solid.push(box(w * 0.4, 0.3, 0.05, roof, 0, y0 + wallH - 1.0, d / 2 + 0.32));
  // 条纹雨棚
  const n = Math.round(w / 0.9);
  for (let i = 0; i < n; i++) p.solid.push(boxAt(w / n + 0.01, 0.12, 1.6, i % 2 ? '#ffffff' : roof, -w / 2 + (i + 0.5) * (w / n), y0 + 2.95, d / 2 + 0.75, 0, 0.35));
  // 玻璃门 + 橱窗（窗内货架色块）
  doorAt(p, w, d, 0, { glass: true, lamp: false, width: 2.4, height: 2.5 });
  for (const s of [-1, 1]) {
    const u = s * (w / 2 - 2.3);
    p.glow.push(box(2.8, 1.7, 0.08, GLASS, u, y0 + 0.8, d / 2 + 0.03));
    for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) p.solid.push(box(0.36, 0.3, 0.05, ['#f26b4f', '#f7d046', '#7ac74c', '#5aa9e6'][(k + j) % 4]!, u - 1.1 + j * 0.55, y0 + 0.95 + k * 0.5, d / 2 - 0.02));
    p.solid.push(box(3.1, 0.14, 0.24, '#ffffff', u, y0 + 0.72, d / 2 + 0.1));
  }
  for (const face of ['left', 'right'] as Face[]) for (const u of evenly(d, 2)) windowAt(p, face, w, d, u, y0 + 1.2);
  return p;
}

/** 仓库：波纹墙、拱形屋顶、推拉大门、装卸平台、屋顶通风帽 */
export function warehouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const wallH = h * 0.62;
  p.solid.push(box(w + 0.3, 0.3, d + 0.3, '#9c968c'));
  p.solid.push(box(w, wallH, d, wall, 0, 0.3, 0));
  for (let k = -w / 2 + 0.3; k < w / 2; k += 0.6)
    for (const s of [-1, 1]) p.solid.push(box(0.12, wallH, 0.08, shade(wall, -0.08), k, 0.3, s * (d / 2 + 0.03)));
  for (let k = -d / 2 + 0.3; k < d / 2; k += 0.6)
    for (const s of [-1, 1]) p.solid.push(box(0.08, wallH, 0.12, shade(wall, -0.08), s * (w / 2 + 0.03), 0.3, k));
  const arch = new THREE.CylinderGeometry(w / 2 + 0.4, w / 2 + 0.4, d + 0.8, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  p.solid.push(paint(arch, roof, M().makeScale(1, (h * 0.38) / (w / 2), 1).premultiply(M().makeTranslation(0, 0.3 + wallH, 0))));
  // 拱端山墙
  const ends = new THREE.CircleGeometry(w / 2, 20, 0, Math.PI);
  for (const s of [-1, 1]) p.solid.push(paint(ends.clone(), shade(wall, -0.05), M().makeScale(1, (h * 0.38) / (w / 2), 1).premultiply(M().makeTranslation(0, 0.3 + wallH, s * (d / 2 + 0.01))).multiply(s < 0 ? M().makeRotationY(Math.PI) : M())));
  // 拱肋
  for (let k = -d / 2; k <= d / 2; k += d / 4) {
    const rib = new THREE.TorusGeometry(w / 2 + 0.45, 0.08, 4, 20, Math.PI);
    p.solid.push(paint(rib, shade(roof, -0.2), M().makeScale(1, (h * 0.38) / (w / 2), 1).premultiply(M().makeTranslation(0, 0.3 + wallH, k))));
  }
  // 大门 + 轨道 + 编号牌
  const dw = w * 0.42;
  p.solid.push(box(dw, wallH * 0.8, 0.14, '#6d7f8c', r() > 0.5 ? dw * 0.35 : 0, 0.3, d / 2 + 0.1));
  for (let k = 0; k < 6; k++) p.solid.push(box(dw, 0.05, 0.16, '#5a6873', r() > 0.5 ? dw * 0.35 : 0, 0.5 + k * ((wallH * 0.8) / 6), d / 2 + 0.12));
  p.solid.push(box(dw * 2.1, 0.16, 0.2, '#4a4f55', 0, 0.3 + wallH * 0.8 + 0.1, d / 2 + 0.16));
  p.solid.push(box(1.6, 1.2, 0.1, '#f2c14e', -w / 2 + 1.6, 0.3 + wallH - 1.6, d / 2 + 0.1));
  p.solid.push(box(0.9, 0.7, 0.05, '#2b2b30', -w / 2 + 1.6, 0.3 + wallH - 1.35, d / 2 + 0.16));
  // 装卸平台 + 顶灯
  p.solid.push(box(dw + 2, 1.0, 2.2, '#8f8a83', 0, 0, d / 2 + 1.1));
  p.solid.push(box(dw + 2.2, 0.08, 2.4, '#f2c14e', 0, 1.0, d / 2 + 1.1));
  p.glow.push(box(0.5, 0.2, 0.3, '#fff1c2', 0, 0.3 + wallH * 0.8 + 0.5, d / 2 + 0.3));
  // 高侧窗
  for (const face of ['left', 'right'] as Face[]) for (const u of evenly(d, windowCount(d, 3))) windowAt(p, face, w, d, u, wallH - 0.9, { size: [1.6, 0.8], mullion: false });
  // 通风帽
  for (let k = -1; k <= 1; k++) {
    p.solid.push(cyl(0.4, 0.4, 0.8, 8, '#b8bcc0', 0, 0.3 + h - 0.3, k * d * 0.3));
    p.solid.push(paint(new THREE.ConeGeometry(0.55, 0.4, 8).translate(0, 0.3 + h + 0.7, k * d * 0.3), '#8c9097'));
  }
  return p;
}

/** 港湾大市场：长厅 + 高侧窗 + 三个入口色棚 + 屋顶旗帜 */
export function marketHall(w: number, h: number, d: number, wall: string, roof: string, seed = 3): PropParts {
  const p = newParts();
  const r = rng(seed);
  const y0 = 0.45;
  const wallH = h * 0.55;
  p.solid.push(box(w + 0.6, y0, d + 0.6, '#c9c1b3'));
  p.solid.push(box(w, wallH, d, wall, 0, y0, 0));
  // 砖柱
  for (let k = -w / 2; k <= w / 2 + 0.01; k += w / 6)
    for (const s of [-1, 1]) p.solid.push(box(0.6, wallH + 0.2, 0.5, '#b0674e', k, y0, s * (d / 2 + 0.1)));
  // 双坡主顶 + 高侧窗天窗
  gable(p, w, h * 0.22, d, y0 + wallH, roof, wall, 0.7);
  const cw = w * 0.36;
  p.solid.push(box(cw, 1.3, d * 0.9, wall, 0, y0 + wallH + h * 0.2, 0));
  for (const u of evenly(d * 0.9, 6)) for (const s of [-1, 1]) p.glow.push(boxAt(0.08, 0.8, 1.2, GLASS, s * (cw / 2 + 0.02), y0 + wallH + h * 0.2 + 0.65, u));
  gable(p, cw, 1.3, d * 0.9, y0 + wallH + h * 0.2 + 1.3, roof, wall, 0.4);
  // 正面三个入口：中门为真正入口（门口 = 正面中心）
  const awn = ['#e25a4f', '#f2b134', '#3f9fd6'];
  for (const [i, u] of [-w / 3, 0, w / 3].entries()) {
    if (u === 0) doorAt(p, w, d, 0, { width: 2.6, height: 2.8, color: '#6b4a33', lamp: true });
    else {
      p.glow.push(box(2.6, 2.0, 0.08, WARM_GLASS, u, y0 + 0.6, d / 2 + 0.03));
      for (let k = 0; k < 4; k++) p.solid.push(box(0.5, 0.4, 0.4, ['#f26b4f', '#f7d046', '#7ac74c', '#9b6b54'][k]!, u - 0.9 + k * 0.6, y0, d / 2 + 0.5));
    }
    const n = 6;
    for (let k = 0; k < n; k++) p.solid.push(boxAt(4 / n + 0.01, 0.1, 1.8, k % 2 ? '#ffffff' : awn[i]!, u - 2 + (k + 0.5) * (4 / n), y0 + 3.2, d / 2 + 0.85, 0, 0.32));
  }
  // 招牌
  p.solid.push(box(w * 0.5, 1.2, 0.2, '#3a4a5c', 0, y0 + wallH - 0.2, d / 2 + 0.15));
  p.glow.push(box(w * 0.46, 0.8, 0.06, '#fff0c8', 0, y0 + wallH, d / 2 + 0.27));
  for (let k = 0; k < 4; k++) p.solid.push(box(0.9, 0.4, 0.05, '#3a4a5c', -w * 0.18 + k * w * 0.12, y0 + wallH + 0.2, d / 2 + 0.31));
  // 屋顶旗杆
  for (const s of [-1, 1]) {
    const fx = s * w * 0.42;
    const fy = y0 + wallH + h * 0.1;
    p.solid.push(cyl(0.06, 0.06, 4, 5, '#d0d4d8', fx, fy, d / 2 - 0.5));
    p.solid.push(boxAt(1.6, 1.0, 0.04, awn[Math.floor(r() * 3)]!, fx + 0.8, fy + 3.4, d / 2 - 0.5));
  }
  for (const face of ['left', 'right', 'back'] as Face[]) {
    const len = face === 'back' ? w : d;
    for (const u of evenly(len, windowCount(len, 3.4))) windowAt(p, face, w, d, u, y0 + 1.4, { size: [1.6, 1.6], warm: true });
  }
  return p;
}

/** 渡船候船楼：玻璃立面 + 钟楼 + 锚形徽记 + 候船雨棚 */
export function terminal(w: number, h: number, d: number, wall: string, roof: string): PropParts {
  const p = newParts();
  const y0 = 0.45;
  const wallH = h * 0.6;
  p.solid.push(box(w + 0.6, y0, d + 0.6, '#cfc8bb'));
  p.solid.push(box(w, wallH, d, wall, 0, y0, 0));
  cornerTrim(p, w, d, y0, wallH, '#ffffff');
  p.glow.push(box(w - 2, wallH - 1.4, 0.1, GLASS, 0, y0 + 0.4, d / 2 + 0.03));
  for (let k = 0; k <= 6; k++) p.solid.push(box(0.1, wallH - 1.4, 0.16, '#ffffff', -(w - 2) / 2 + (k * (w - 2)) / 6, y0 + 0.4, d / 2 + 0.06));
  p.solid.push(box(w - 2, 0.1, 0.16, '#ffffff', 0, y0 + 2.6, d / 2 + 0.06));
  hip(p, w, h * 0.25, d, y0 + wallH, roof, 0.7);
  // 钟楼
  const ty = y0 + wallH;
  p.solid.push(box(2.6, h * 0.55, 2.6, wall, 0, ty, -d * 0.1));
  for (const face of ['front', 'back', 'left', 'right'] as Face[]) {
    const f = onFace(face, 2.6, 2.6, 0, 0.02);
    p.solid.push(paint(new THREE.CircleGeometry(0.8, 20), '#ffffff', M().makeRotationY(f.ry).setPosition(f.x, ty + h * 0.42, f.z - d * 0.1)));
    const f2 = onFace(face, 2.6, 2.6, 0, 0.05);
    p.solid.push(boxAt(0.08, 0.6, 0.03, '#2b2b30', f2.x, ty + h * 0.42 + 0.25, f2.z - d * 0.1, f.ry));
    p.solid.push(boxAt(0.45, 0.07, 0.03, '#2b2b30', f2.x + (face === 'front' ? 0.2 : 0), ty + h * 0.42, f2.z - d * 0.1, f.ry));
  }
  hip(p, 2.6, 1.8, 2.6, ty + h * 0.55, roof, 0.3);
  // 锚形徽记
  const ay = y0 + wallH - 0.6;
  p.solid.push(box(0.2, 1.2, 0.1, '#2f6db5', 0, ay - 0.6, d / 2 + 0.15));
  p.solid.push(box(0.9, 0.16, 0.1, '#2f6db5', 0, ay - 0.1, d / 2 + 0.15));
  p.solid.push(paint(new THREE.TorusGeometry(0.45, 0.08, 4, 12, Math.PI).rotateZ(Math.PI).translate(0, ay - 0.5, d / 2 + 0.15), '#2f6db5'));
  // 候船雨棚 + 长椅
  p.solid.push(box(w + 2, 0.25, 3, roof, 0, y0 + 3.1, d / 2 + 1.5));
  for (const s of [-1, 0, 1]) p.solid.push(cyl(0.1, 0.1, 3.1, 6, '#ffffff', s * (w / 2), y0, d / 2 + 2.8));
  doorAt(p, w, d, 0, { glass: true, lamp: false, width: 2.4, height: 2.6 });
  for (const face of ['left', 'right'] as Face[]) for (const u of evenly(d, 2)) windowAt(p, face, w, d, u, y0 + 1.2);
  return p;
}

/** 翠澜道馆（湖心水之殿）：八角平台、列柱回廊、波纹饰带、肋拱穹顶、水滴徽记、两侧水帘 */
export function gym(w: number, h: number, wall: string, roof: string): PropParts {
  const p = newParts();
  const r = w / 2;
  const base = 0.6;
  p.solid.push(cyl(r + 1.5, r + 2, base, 8, '#cfd8dc'));
  p.solid.push(cyl(r + 1.55, r + 1.55, 0.12, 8, '#9fc4d0', 0, base - 0.06, 0));
  // 大门前台阶（平台高 0.6，分两级 0.3，接栈桥 / 湖心岛地面）
  p.solid.push(box(7, 0.3, 1.6, '#cfd8dc', 0, 0, r + 2.4));
  p.solid.push(box(7.6, 0.06, 1.7, '#9fc4d0', 0, 0.27, r + 2.4));
  const bodyH = h * 0.55;
  p.solid.push(cyl(r, r, bodyH, 8, wall, 0, base, 0));
  // 波纹饰带（上下两道）
  p.solid.push(cyl(r + 0.08, r + 0.08, 0.5, 8, '#2f7fa8', 0, base + bodyH - 0.9, 0));
  p.solid.push(cyl(r + 0.1, r + 0.1, 0.2, 8, '#bfe8f5', 0, base + bodyH - 0.35, 0));
  p.solid.push(cyl(r + 0.08, r + 0.08, 0.35, 8, '#2f7fa8', 0, base, 0));
  // 列柱回廊：16 根柱 + 顶环
  const ring = r + 1.1;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.25) continue; // 大门前留空（+Z 方向 a=0）
    const x = Math.sin(a) * ring;
    const z = Math.cos(a) * ring;
    p.solid.push(cyl(0.26, 0.3, bodyH * 0.72, 10, '#ffffff', x, base, z));
    p.solid.push(box(0.8, 0.25, 0.8, '#e4f4f7', x, base, z));
    p.solid.push(box(0.8, 0.3, 0.8, '#e4f4f7', x, base + bodyH * 0.72, z));
  }
  p.solid.push(paint(new THREE.TorusGeometry(ring, 0.28, 4, 32).rotateX(Math.PI / 2).translate(0, base + bodyH * 0.72 + 0.3, 0), '#e4f4f7'));
  // 八面窗
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const n = r * Math.cos(Math.PI / 8) + 0.05;
    p.glow.push(paint(new THREE.BoxGeometry(3.0, 1.8, 0.16).translate(0, 0, n).rotateY(a).translate(0, base + bodyH * 0.42, 0), GLASS));
    p.solid.push(paint(new THREE.BoxGeometry(3.3, 0.2, 0.3).translate(0, 0, n + 0.05).rotateY(a).translate(0, base + bodyH * 0.42 - 1.0, 0), '#ffffff'));
    p.solid.push(paint(new THREE.BoxGeometry(0.14, 1.8, 0.22).translate(0, 0, n + 0.04).rotateY(a).translate(0, base + bodyH * 0.42, 0), '#ffffff'));
  }
  // 穹顶 + 肋 + 采光亭 + 水滴塔尖
  const dy = base + bodyH;
  p.solid.push(paint(new THREE.SphereGeometry(r * 0.98, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1).translate(0, dy, 0), roof));
  for (let k = 0; k < 8; k++) {
    const rib = new THREE.TorusGeometry(r * 0.99, 0.14, 4, 16, Math.PI / 2).rotateY((k / 8) * Math.PI * 2);
    p.solid.push(paint(rib, '#ffffff', M().makeScale(1, 0.62, 1).premultiply(M().makeTranslation(0, dy, 0))));
  }
  const ly = dy + r * 0.6;
  p.solid.push(cyl(1.4, 1.6, 1.4, 8, '#ffffff', 0, ly - 0.2, 0));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.glow.push(boxAt(0.8, 0.9, 0.08, GLASS, Math.sin(a) * 1.46, ly + 0.5, Math.cos(a) * 1.46, a));
  }
  p.solid.push(paint(new THREE.ConeGeometry(1.7, 1.2, 8).translate(0, ly + 1.8, 0), roof));
  p.solid.push(cyl(0.12, 0.12, 1.6, 6, '#ffffff', 0, ly + 2.3, 0));
  const drop = new THREE.SphereGeometry(0.7, 14, 10);
  const pos = drop.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = y > 0 ? 1 - y / 0.7 : 1;
    pos.setX(i, pos.getX(i) * (0.35 + 0.65 * k));
    pos.setZ(i, pos.getZ(i) * (0.35 + 0.65 * k));
    pos.setY(i, y > 0 ? y * 1.8 : y);
  }
  p.glow.push(paint(drop.translate(0, ly + 4.4, 0), '#7fe3ff'));
  // 大门：拱门框 + 双扇门 + 门上水滴徽记 + 台阶
  const gz = r * 0.93;
  p.solid.push(box(5.2, 4.8, 1.6, '#e4f4f7', 0, base, gz));
  p.solid.push(paint(new THREE.CylinderGeometry(2.6, 2.6, 1.6, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, base + 4.8, gz), '#e4f4f7'));
  p.solid.push(box(3.4, 3.8, 0.2, '#2f7fa8', 0, base, gz + 0.72));
  p.solid.push(box(0.08, 3.8, 0.24, '#bfe8f5', 0, base, gz + 0.74));
  p.glow.push(paint(drop.clone().scale(0.8, 0.8, 0.3).translate(0, base + 4.0, gz + 0.9), '#7fe3ff'));
  for (let k = 0; k < 3; k++) p.solid.push(box(6 - k * 0.4, 0.2, 1.2 - k * 0.3, '#cfd8dc', 0, base + k * 0.2 - 0.2, gz + 1.8 - k * 0.3));
  // 门前两侧：水帘（浅蓝竖板 + 底池）与旗帜
  for (const s of [-1, 1]) {
    const fx = s * 5.2;
    const fz = r + 1.4;
    p.solid.push(box(2.4, 0.6, 1.4, '#cfd8dc', fx, base, fz));
    p.glow.push(box(2.1, 0.08, 1.1, '#6fc6e8', fx, base + 0.5, fz));
    p.solid.push(box(0.4, 3.2, 0.4, '#e4f4f7', fx, base, fz - 0.6));
    p.glow.push(box(1.6, 2.6, 0.08, '#9ddcf2', fx, base + 0.6, fz - 0.35));
    p.solid.push(cyl(0.07, 0.07, 6, 5, '#d0d4d8', s * 3.2, base, r + 2.8));
    p.solid.push(box(0.04, 2.4, 1.2, '#2f7fa8', s * 3.2, base + 3.4, r + 2.8 + 0.6));
    p.solid.push(box(0.05, 0.6, 0.6, '#ffffff', s * 3.2, base + 4.3, r + 2.8 + 0.6));
  }
  return p;
}

/** 灯塔：砖红白相间塔身、塔门与小窗、瞭望回廊（栏杆）、灯室玻璃与窗棂、守塔人小屋（variant keeper） */
export function lighthouse(w: number, h: number, wall: string, stripe: string, variant = 'keeper'): PropParts {
  const p = newParts();
  const r = w / 2;
  p.solid.push(cyl(r * 1.6, r * 1.75, 1.2, 12, '#b8b0a4'));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.solid.push(boxAt(0.8, 0.5, 0.4, '#a39b8f', Math.sin(a) * r * 1.68, 0.9, Math.cos(a) * r * 1.68, a));
  }
  const bands = 6;
  const tower = h - 5.5;
  for (let i = 0; i < bands; i++) {
    const y0 = 1.2 + (tower * i) / bands;
    const r0 = r * (1 - (0.32 * i) / bands);
    const r1 = r * (1 - (0.32 * (i + 1)) / bands);
    p.solid.push(cyl(r1, r0, tower / bands, 20, i % 2 ? stripe : wall, 0, y0, 0));
    // 小窗（交错）
    const a = i * 1.7;
    const rr = (r0 + r1) / 2 + 0.02;
    p.glow.push(boxAt(0.5, 0.8, 0.1, WARM_GLASS, Math.sin(a) * rr, y0 + tower / bands / 2, Math.cos(a) * rr, a));
  }
  // 塔门
  p.solid.push(box(1.2, 2.2, 0.4, '#5a3e2b', 0, 1.2, r - 0.05));
  p.solid.push(box(1.6, 0.3, 0.5, wall, 0, 3.4, r));
  const top = 1.2 + tower;
  const tr = r * 0.68;
  // 回廊平台 + 栏杆
  p.solid.push(cyl(tr + 1.0, tr + 0.8, 0.35, 20, '#3a3f4a', 0, top, 0));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    p.solid.push(cyl(0.04, 0.04, 1.0, 4, '#3a3f4a', Math.sin(a) * (tr + 0.9), top + 0.35, Math.cos(a) * (tr + 0.9)));
  }
  p.solid.push(paint(new THREE.TorusGeometry(tr + 0.9, 0.05, 4, 32).rotateX(Math.PI / 2).translate(0, top + 1.35, 0), '#3a3f4a'));
  // 灯室
  p.solid.push(cyl(tr * 0.85, tr * 0.85, 0.5, 16, stripe, 0, top + 0.35, 0));
  p.glow.push(cyl(tr * 0.72, tr * 0.72, 2.2, 16, '#fff3b0', 0, top + 0.85, 0));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.solid.push(cyl(0.05, 0.05, 2.2, 4, '#3a3f4a', Math.sin(a) * tr * 0.74, top + 0.85, Math.cos(a) * tr * 0.74));
  }
  p.solid.push(cyl(tr * 0.9, tr * 0.8, 0.3, 16, '#3a3f4a', 0, top + 3.05, 0));
  p.solid.push(paint(new THREE.ConeGeometry(tr * 0.95, 1.8, 16).translate(0, top + 4.25, 0), stripe));
  p.solid.push(sphere(0.25, '#3a3f4a', 0, top + 5.3, 0, 1, 1, 1, 1));
  p.solid.push(cyl(0.03, 0.03, 1.2, 4, '#3a3f4a', 0, top + 5.4, 0));
  if (variant === 'keeper') {
    // 守塔人小屋（塔后方）
    const hp = house(5, 4.4, 4.2, '#f4ead7', stripe, 'cottage', 11, '#2f6db5');
    const m = M().makeTranslation(0, 0, -(r * 1.6 + 2.4)).multiply(M().makeRotationY(Math.PI));
    for (const g of hp.solid) p.solid.push(g.applyMatrix4(m));
    for (const g of hp.glow) p.glow.push(g.applyMatrix4(m));
  }
  return p;
}

// ———————————————————————— 特色建筑 ————————————————————————

/** 高脚屋（翠澜镇水上人家）。原点 = 平台顶面中心；平台 w×d，屋子占后 60%，前面为带栏杆的外廊 */
export function stiltHouse(w: number, h: number, d: number, wall: string, roof: string, bedY: (lx: number, lz: number) => number, seed = 1, accent = '#c8503c'): PropParts {
  const p = newParts();
  const r = rng(seed);
  deckInto(p, w, d, bedY, 'swe', [['s', 0, 1.6]]);
  const hd = d * 0.58;
  const hz = -d / 2 + hd / 2 + 0.2;
  const hw = w - 0.8;
  const wallH = h * 0.55;
  const hp = newParts();
  hp.solid.push(box(hw, wallH, hd, wall, 0, 0, 0));
  cornerTrim(hp, hw, hd, 0, wallH, '#6b4a33');
  hp.solid.push(box(hw + 0.1, 0.18, hd + 0.1, '#6b4a33', 0, wallH - 0.18, 0));
  // 水乡风：挑檐更深，屋脊两端上翘
  gable(hp, hw, h - wallH, hd, wallH, roof, wall, 0.9, '#6b4a33');
  for (const s of [-1, 1]) hp.solid.push(boxAt(0.3, 0.3, 0.9, shade(roof, -0.25), 0, h + 0.18, s * (hd / 2 + 1.0), 0, s * 0.5));
  doorAt(hp, hw, hd, -hw * 0.18, { y: 0.02, color: '#8a5a3c', frame: '#6b4a33', canopy: null, lamp: false, step: '#9c7a55' });
  windowAt(hp, 'front', hw, hd, hw * 0.24, 1.0, { frame: '#6b4a33', shutters: accent, flowerBox: true, rand: r, warm: true });
  for (const face of ['left', 'right', 'back'] as Face[]) windowAt(hp, face, hw, hd, 0, 1.0, { frame: '#6b4a33', warm: true });
  const m = M().makeTranslation(0, 0, hz);
  for (const g of hp.solid) p.solid.push(g.applyMatrix4(m));
  for (const g of hp.glow) p.glow.push(g.applyMatrix4(m));
  // 外廊：红灯笼、晾晒的渔网、盆栽
  const vz = hz + hd / 2;
  for (const s of [-1, 1]) {
    const lx = s * (hw / 2 - 0.3);
    p.solid.push(cyl(0.02, 0.02, 0.5, 3, '#3d3d3d', lx, wallH - 0.6, vz + 0.4));
    p.glow.push(sphere(0.26, accent, lx, wallH - 0.9, vz + 0.4, 1, 1.25, 1, 1));
    p.solid.push(cyl(0.2, 0.2, 0.06, 8, '#e3c46a', lx, wallH - 1.26, vz + 0.4));
  }
  if (r() > 0.4) potPlant(p, w / 2 - 0.6, d / 2 - 0.6, r);
  if (r() > 0.3) potPlant(p, -w / 2 + 0.6, d / 2 - 0.6, r);
  // 屋侧水缸
  p.solid.push(cyl(0.4, 0.34, 0.7, 10, '#6e7f8a', -w / 2 + 0.6, 0, hz + hd / 2 - 0.2));
  return p;
}

function potPlant(p: PropParts, x: number, z: number, r: () => number): void {
  p.solid.push(cyl(0.28, 0.22, 0.45, 8, '#b5653e', x, 0, z));
  p.solid.push(sphere(0.38, '#5f9e4a', x, 0.72, z, 1, 0.9, 1, 1));
  p.solid.push(sphere(0.1, FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)]!, x + 0.15, 0.98, z + 0.15, 1, 1, 1, 0));
}

/** 水上平台：木板 + 板缝 + 桩 + 栏杆（rails 指定边，gaps 开口） */
export function deck(w: number, d: number, bedY: (lx: number, lz: number) => number, rails = 'nsew', gaps: Array<[string, number, number]> = []): PropParts {
  const p = newParts();
  deckInto(p, w, d, bedY, rails, gaps);
  return p;
}

/** 栏杆每一段（局部坐标）——GrayboxProps 用同一份结果生成碰撞 */
export function railSegments(w: number, d: number, rails: string, gaps: Array<[string, number, number]>): Array<{ ax: number; az: number; bx: number; bz: number }> {
  const out: Array<{ ax: number; az: number; bx: number; bz: number }> = [];
  const sides: Record<string, { a: [number, number]; b: [number, number] }> = {
    n: { a: [-w / 2, -d / 2], b: [w / 2, -d / 2] },
    s: { a: [-w / 2, d / 2], b: [w / 2, d / 2] },
    w: { a: [-w / 2, -d / 2], b: [-w / 2, d / 2] },
    e: { a: [w / 2, -d / 2], b: [w / 2, d / 2] },
  };
  for (const side of rails) {
    const sd = sides[side];
    if (!sd) continue;
    const len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]);
    // 沿边的区间 [-len/2, len/2]，减去开口
    let spans: Array<[number, number]> = [[-len / 2, len / 2]];
    for (const [gs, c, gw] of gaps) {
      if (gs !== side) continue;
      const next: Array<[number, number]> = [];
      for (const [s0, s1] of spans) {
        if (c + gw / 2 <= s0 || c - gw / 2 >= s1) next.push([s0, s1]);
        else {
          if (c - gw / 2 > s0) next.push([s0, c - gw / 2]);
          if (c + gw / 2 < s1) next.push([c + gw / 2, s1]);
        }
      }
      spans = next;
    }
    for (const [s0, s1] of spans) {
      if (s1 - s0 < 0.3) continue;
      const t0 = s0 / len + 0.5;
      const t1 = s1 / len + 0.5;
      out.push({
        ax: sd.a[0] + (sd.b[0] - sd.a[0]) * t0,
        az: sd.a[1] + (sd.b[1] - sd.a[1]) * t0,
        bx: sd.a[0] + (sd.b[0] - sd.a[0]) * t1,
        bz: sd.a[1] + (sd.b[1] - sd.a[1]) * t1,
      });
    }
  }
  return out;
}

function deckInto(p: PropParts, w: number, d: number, bedY: (lx: number, lz: number) => number, rails: string, gaps: Array<[string, number, number]>): void {
  const wood = '#b8875a';
  p.solid.push(box(w, 0.3, d, wood, 0, -0.3, 0));
  const alongZ = d >= w;
  const L = alongZ ? d : w;
  const S = alongZ ? w : d;
  for (let k = -L / 2 + 0.55; k < L / 2; k += 0.55) p.solid.push(alongZ ? box(S + 0.04, 0.03, 0.06, '#8c6340', 0, 0, k) : box(0.06, 0.03, S + 0.04, '#8c6340', k, 0, 0));
  // 边梁
  for (const s of [-1, 1]) p.solid.push(alongZ ? box(0.2, 0.36, d, '#7a5238', s * (w / 2 - 0.1), -0.42, 0) : box(w, 0.36, 0.2, '#7a5238', 0, -0.42, s * (d / 2 - 0.1)));
  // 桩：四周每 3 m
  const nx = Math.max(1, Math.round(w / 3));
  const nz = Math.max(1, Math.round(d / 3));
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= nz; j++) {
      if (i !== 0 && i !== nx && j !== 0 && j !== nz && (i + j) % 2) continue;
      const x = -w / 2 + 0.25 + (i * (w - 0.5)) / nx;
      const z = -d / 2 + 0.25 + (j * (d - 0.5)) / nz;
      const gy = Math.min(bedY(x, z), -1.2);
      p.solid.push(cyl(0.16, 0.19, -gy + 0.1, 6, '#6e4a30', x, gy, z));
    }
  for (const s of railSegments(w, d, rails, gaps)) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const ry = Math.atan2(s.bx - s.ax, s.bz - s.az);
    const mx = (s.ax + s.bx) / 2;
    const mz = (s.az + s.bz) / 2;
    p.solid.push(boxAt(0.12, 0.1, len, '#f4efe6', mx, 0.98, mz, ry));
    p.solid.push(boxAt(0.06, 0.06, len, '#f4efe6', mx, 0.5, mz, ry));
    const n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      p.solid.push(box(0.12, 1.0, 0.12, '#f4efe6', s.ax + (s.bx - s.ax) * t, 0, s.az + (s.bz - s.az) * t));
    }
  }
}

/** 温室：白色钢架 + 玻璃（浅青实体）+ 内部作物 */
export function greenhouse(w: number, h: number, d: number, seed = 5): PropParts {
  const p = newParts();
  const r = rng(seed);
  const wallH = h * 0.55;
  p.solid.push(box(w + 0.2, 0.3, d + 0.2, '#c9c4bb'));
  // 作物（先画，在玻璃内侧可透过门口看到）
  for (let i = 0; i < 3; i++) {
    p.solid.push(box(w * 0.26, 0.5, d - 1.6, '#7a5238', -w / 3 + (i * w) / 3, 0.3, 0));
    for (let k = -d / 2 + 1.2; k < d / 2 - 0.8; k += 0.8) p.solid.push(sphere(0.3, r() > 0.5 ? '#5f9e4a' : '#7cbf5a', -w / 3 + (i * w) / 3, 1.05, k, 1, 0.8, 1, 0));
  }
  const glass = '#cdebea';
  for (const s of [-1, 1]) {
    p.solid.push(box(0.06, wallH, d, glass, s * (w / 2), 0.3, 0));
    p.solid.push(box(w, wallH, 0.06, glass, 0, 0.3, s * (d / 2)));
  }
  const rh = h - wallH - 0.3;
  const slope = Math.atan2(rh, w / 2);
  const len = Math.hypot(w / 2, rh);
  for (const s of [-1, 1]) p.solid.push(boxAt(len + 0.1, 0.06, d + 0.1, glass, (s * w) / 4, 0.3 + wallH + rh / 2, 0, 0, 0, -s * slope));
  // 钢架
  const f = '#ffffff';
  for (let k = -d / 2; k <= d / 2 + 0.01; k += d / Math.max(2, Math.round(d / 1.5))) {
    for (const s of [-1, 1]) {
      p.solid.push(box(0.1, wallH, 0.1, f, s * (w / 2), 0.3, k));
      p.solid.push(beam(V(s * (w / 2), 0.3 + wallH, k), V(0, 0.3 + wallH + rh, k), 0.05, f, 4));
    }
  }
  for (const s of [-1, 1]) p.solid.push(box(0.12, 0.12, d + 0.1, f, s * (w / 2), 0.3 + wallH, 0));
  p.solid.push(box(0.14, 0.14, d + 0.2, f, 0, 0.3 + wallH + rh, 0));
  p.solid.push(box(1.4, 2.2, 0.08, '#e8f4f4', 0, 0.3, d / 2 + 0.05));
  return p;
}

/** 开敞棚架（鱼市 / 候船 / 休憩亭）。variant fish：冰台上摆鱼；pavilion：四角亭 */
export function shed(w: number, h: number, d: number, roof: string, variant = 'fish', seed = 2): PropParts {
  const p = newParts();
  const r = rng(seed);
  p.solid.push(box(w + 0.4, 0.2, d + 0.4, '#b3aa9a'));
  const nx = Math.max(1, Math.round(w / 3.5));
  for (let i = 0; i <= nx; i++)
    for (const s of [-1, 1]) {
      const x = -w / 2 + (i * w) / nx;
      p.solid.push(cyl(0.14, 0.16, h - 1.2, 8, '#6b4a33', x, 0.2, (s * d) / 2));
    }
  if (variant === 'pavilion') hip(p, w, 1.6, d, h - 1.0, roof, 0.6);
  else gable(p, w, 1.4, d, h - 1.0, roof, '#e8dcc6', 0.5);
  if (variant === 'fish') {
    // 两排冰台：鱼、贝壳、价牌
    for (const s of [-1, 1]) {
      const z = s * (d / 2 - 1.0);
      p.solid.push(box(w - 1.2, 0.9, 1.2, '#8f9aa3', 0, 0.2, z));
      p.solid.push(boxAt(w - 1.3, 0.1, 1.1, '#e8f6fb', 0, 1.15, z, 0, -s * 0.12));
      for (let k = -w / 2 + 1.1; k < w / 2 - 0.8; k += 0.55) {
        const c = ['#9bb6c9', '#e3a07a', '#c9d4db', '#f2c14e'][Math.floor(r() * 4)]!;
        const fish = new THREE.SphereGeometry(0.2, 8, 6).scale(1.8, 0.45, 0.7);
        p.solid.push(paint(fish, c, M().makeRotationY(r() * 0.6 - 0.3).setPosition(k, 1.3, z + (r() - 0.5) * 0.5)));
      }
      for (let k = 0; k < 3; k++) p.solid.push(box(0.4, 0.3, 0.04, '#ffffff', -w / 3 + (k * w) / 3, 1.25, z + s * 0.62));
    }
    for (let k = 0; k < 4; k++) p.solid.push(box(0.8, 0.5, 0.6, '#5aa9e6', -w / 2 + 0.6 + k * 0.9, 0.2, 0)); // 泡沫箱
    p.glow.push(box(0.3, 0.3, 0.3, '#fff1c2', 0, h - 1.4, 0));
  } else {
    for (const s of [-1, 1]) {
      p.solid.push(box(w * 0.7, 0.1, 0.45, '#9b6b54', 0, 0.62, s * (d / 2 - 0.5)));
      p.solid.push(box(w * 0.7, 0.4, 0.08, '#9b6b54', 0, 0.62, s * (d / 2 - 0.3)));
    }
  }
  return p;
}

/** 风车：石砌塔身 + 木帽 + 四叶帆（静态，微倾） */
export function windmill(w: number, h: number, wall: string, roof: string): PropParts {
  const p = newParts();
  const r = w / 2;
  p.solid.push(cyl(r * 0.72, r, h * 0.7, 10, wall));
  for (let k = 0.6; k < h * 0.7; k += 0.8) p.solid.push(cyl(r * (1 - (0.28 * k) / (h * 0.7)) + 0.03, r * (1 - (0.28 * (k - 0.1)) / (h * 0.7)) + 0.03, 0.08, 10, shade(wall, -0.1), 0, k, 0));
  p.solid.push(box(1.2, 2.2, 0.4, '#6b4a33', 0, 0, r - 0.15));
  p.glow.push(box(0.6, 0.8, 0.1, WARM_GLASS, 0, h * 0.4, r * 0.85));
  const cy = h * 0.7;
  p.solid.push(cyl(r * 0.8, r * 0.8, 0.3, 10, '#6b4a33', 0, cy, 0));
  p.solid.push(paint(new THREE.ConeGeometry(r * 0.85, h * 0.22, 10).translate(0, cy + 0.3 + h * 0.11, 0), roof));
  const hub = V(0, cy + 0.6, r * 0.9);
  p.solid.push(beam(V(0, cy + 0.6, 0), hub.clone().add(V(0, 0, 0.3)), 0.18, '#4a3526', 8));
  const sail = h * 0.55;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    const tip = V(Math.sin(a) * sail, cy + 0.6 + Math.cos(a) * sail, r * 0.9 + 0.35);
    p.solid.push(beam(hub.clone().add(V(0, 0, 0.35)), tip, 0.08, '#4a3526', 4));
    // 帆布（格栅框 + 布面）
    const mid = hub.clone().add(V(0, 0, 0.35)).lerp(tip, 0.6);
    p.solid.push(boxAt(0.9, sail * 0.7, 0.04, '#f4efe6', mid.x + Math.cos(a) * 0.5, mid.y - Math.sin(a) * 0.5, mid.z + 0.05, 0, 0, -a));
    for (let j = 1; j < 5; j++) {
      const q = hub.clone().add(V(0, 0, 0.35)).lerp(tip, 0.3 + j * 0.14);
      p.solid.push(boxAt(1.0, 0.05, 0.06, '#4a3526', q.x + Math.cos(a) * 0.5, q.y - Math.sin(a) * 0.5, q.z + 0.08, 0, 0, -a));
    }
  }
  return p;
}

/** 港口门式起重机：四腿、横梁、吊臂、驾驶室、吊钩 */
export function crane(w: number, h: number, d: number, color: string): PropParts {
  const p = newParts();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    p.solid.push(box(0.6, h * 0.7, 0.6, color, (sx * w) / 2, 0, (sz * d) / 2));
    p.solid.push(box(1.2, 0.5, 1.4, '#4a4f55', (sx * w) / 2, 0, (sz * d) / 2));
  }
  for (const sz of [-1, 1]) {
    p.solid.push(box(w + 0.6, 0.7, 0.6, color, 0, h * 0.7, (sz * d) / 2));
    p.solid.push(beam(V(-w / 2, 1, (sz * d) / 2), V(w / 2, h * 0.68, (sz * d) / 2), 0.12, shade(color, -0.1), 4));
  }
  for (const sx of [-1, 1]) p.solid.push(box(0.5, 0.5, d, color, (sx * w) / 2, h * 0.45, 0));
  // 吊臂：沿 +X 伸出到海面
  const by = h * 0.7 + 0.7;
  p.solid.push(box(w * 2.6, 0.8, 1.0, color, w * 0.8, by, 0));
  for (let k = -w / 2; k < w * 2.1; k += 1.6) p.solid.push(beam(V(k, by, -0.45), V(k + 0.8, by + 0.8, -0.45), 0.06, shade(color, -0.15), 4));
  p.solid.push(box(1.6, 1.6, 1.6, '#e8ecef', w / 2 + 1, by - 1.6, 0.8));
  p.glow.push(box(1.2, 0.7, 0.05, GLASS, w / 2 + 1, by - 0.8, 1.62));
  p.solid.push(box(1.0, 1.4, 1.2, '#4a4f55', -w / 2 - 0.2, by + 0.8, 0)); // 配重
  const hx = w * 1.6;
  p.solid.push(cyl(0.03, 0.03, h * 0.45, 4, '#2b2b30', hx, by - h * 0.45, 0));
  p.solid.push(box(0.8, 0.5, 0.5, '#f2c14e', hx, by - h * 0.45 - 0.5, 0));
  p.solid.push(paint(new THREE.TorusGeometry(0.25, 0.07, 4, 10, Math.PI * 1.4).translate(hx, by - h * 0.45 - 0.9, 0), '#2b2b30'));
  p.glow.push(sphere(0.2, '#ff5b52', w * 2.1, by + 0.6, 0, 1, 1, 1, 0));
  return p;
}

/** 海堤：沿 z 的石砌护岸，顶面压顶石 + 系缆桩 */
export function seawall(w: number, h: number, d: number): PropParts {
  const p = newParts();
  p.solid.push(box(w, h, d, '#8f8a83', 0, -h, 0));
  for (let y = -h + 0.6; y < 0; y += 0.6) p.solid.push(box(w + 0.04, 0.05, d, '#76716a', 0, y, 0));
  for (let z = -d / 2; z < d / 2; z += 1.4) p.solid.push(box(w + 0.04, h, 0.05, '#76716a', 0, -h, z));
  p.solid.push(box(w + 0.3, 0.3, d, '#c9c4bb', 0, -0.05, 0));
  for (let z = -d / 2 + 2; z < d / 2; z += 8) bollardInto(p, w / 2 - 0.35, 0.25, z);
  return p;
}

// ———————————————————————— 小品 ————————————————————————

/** 树：round 阔叶 / pine 松 / palm 棕榈 / blossom 樱花 / shrub 灌木 */
export function tree(h: number, variant = 'round', seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const trunk = '#7a5238';
  const greens = ['#5c9a48', '#6aa84f', '#4f8a3f', '#78b358'];
  const g = () => greens[Math.floor(r() * greens.length)]!;
  switch (variant) {
    case 'pine': {
      p.solid.push(cyl(0.16, 0.24, h * 0.3, 6, trunk));
      for (let i = 0; i < 4; i++) {
        const rr = h * (0.3 - i * 0.06);
        p.solid.push(paint(new THREE.ConeGeometry(rr, h * 0.32, 8).translate(0, h * (0.36 + i * 0.16), 0), i % 2 ? '#3f7a45' : '#4a8a4f'));
      }
      break;
    }
    case 'palm': {
      let prev = V(0, 0, 0);
      const lean = r() * Math.PI * 2;
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const cur = V(Math.sin(lean) * t * t * h * 0.25, t * h, Math.cos(lean) * t * t * h * 0.25);
        p.solid.push(beam(prev, cur, 0.2 - t * 0.06, i % 2 ? '#9b7653' : '#8a6644', 6));
        prev = cur;
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + r();
        const leaf = new THREE.BoxGeometry(0.6, 0.06, h * 0.42).translate(0, 0, h * 0.21);
        p.solid.push(paint(leaf, k % 2 ? '#5c9a48' : '#6fb257', M().makeRotationFromEuler(new THREE.Euler(0.45, a, 0, 'YXZ')).setPosition(prev.x, prev.y, prev.z)));
      }
      for (let k = 0; k < 3; k++) p.solid.push(sphere(0.18, '#7a5a32', prev.x + Math.sin(k * 2) * 0.25, prev.y - 0.25, prev.z + Math.cos(k * 2) * 0.25, 1, 1, 1, 0));
      break;
    }
    case 'shrub': {
      for (let k = 0; k < 4; k++) p.solid.push(sphere(h * (0.35 + r() * 0.15), g(), (r() - 0.5) * h * 0.6, h * 0.4, (r() - 0.5) * h * 0.6, 1, 0.8, 1, 1));
      if (r() > 0.5) for (let k = 0; k < 5; k++) p.solid.push(sphere(0.08, FLOWER_COLORS[Math.floor(r() * 3)]!, (r() - 0.5) * h, h * 0.75, (r() - 0.5) * h, 1, 1, 1, 0));
      break;
    }
    default: {
      const blossom = variant === 'blossom';
      p.solid.push(cyl(0.2, 0.3, h * 0.45, 7, trunk));
      p.solid.push(beam(V(0, h * 0.35, 0), V(h * 0.15, h * 0.55, 0.1), 0.1, trunk, 5));
      p.solid.push(beam(V(0, h * 0.3, 0), V(-h * 0.12, h * 0.5, -0.1), 0.1, trunk, 5));
      const n = 4 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r();
        const rr = h * (0.2 + r() * 0.1);
        const c = blossom ? (r() > 0.4 ? '#f6b8c8' : '#f9d3dd') : g();
        p.solid.push(sphere(rr, c, Math.sin(a) * h * 0.18, h * (0.62 + r() * 0.15), Math.cos(a) * h * 0.18, 1, 0.85, 1, 1));
      }
      p.solid.push(sphere(h * 0.26, blossom ? '#f6b8c8' : g(), 0, h * 0.8, 0, 1, 0.85, 1, 1));
    }
  }
  return p;
}

export function bench(w: number): PropParts {
  const p = newParts();
  for (const s of [-1, 1]) {
    p.solid.push(box(0.1, 0.45, 0.5, '#3d4452', s * (w / 2 - 0.2), 0, 0));
    p.solid.push(box(0.1, 0.5, 0.08, '#3d4452', s * (w / 2 - 0.2), 0.45, -0.24));
  }
  for (let k = 0; k < 3; k++) p.solid.push(box(w, 0.05, 0.14, '#b8875a', 0, 0.45, -0.18 + k * 0.17));
  for (let k = 0; k < 2; k++) p.solid.push(boxAt(w, 0.12, 0.05, '#b8875a', 0, 0.68 + k * 0.18, -0.27, 0, -0.12));
  return p;
}

export function flowerbed(w: number, d: number, seed = 1, round = false): PropParts {
  const p = newParts();
  const r = rng(seed);
  if (round) {
    p.solid.push(cyl(w / 2, w / 2 + 0.05, 0.35, 16, '#c9c4bb'));
    p.solid.push(cyl(w / 2 - 0.2, w / 2 - 0.2, 0.05, 16, '#6b4a33', 0, 0.33, 0));
  } else {
    p.solid.push(box(w, 0.35, d, '#c9c4bb'));
    p.solid.push(box(w - 0.3, 0.05, d - 0.3, '#6b4a33', 0, 0.33, 0));
  }
  const n = Math.round(w * d * 2.2);
  const palette = [FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)]!, FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)]!, '#ffffff'];
  for (let k = 0; k < n; k++) {
    let x = (r() - 0.5) * (w - 0.5);
    let z = (r() - 0.5) * (d - 0.5);
    if (round && Math.hypot(x, z) > w / 2 - 0.3) {
      x *= 0.6;
      z *= 0.6;
    }
    p.solid.push(sphere(0.16, '#5f9e4a', x, 0.45, z, 1, 0.8, 1, 0));
    p.solid.push(sphere(0.09, palette[k % 3]!, x, 0.6, z, 1, 1, 1, 0));
  }
  return p;
}

export function hedge(w: number, h: number, d: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  p.solid.push(box(w, h * 0.85, d, '#4f8a3f'));
  for (let k = -w / 2 + 0.4; k < w / 2; k += 0.7) p.solid.push(sphere(d * 0.55, r() > 0.5 ? '#5c9a48' : '#4f8a3f', k, h * 0.85, (r() - 0.5) * 0.1, 1, 0.6, 1, 0));
  return p;
}

export function mailbox(color = '#d9453b'): PropParts {
  return {
    solid: [cyl(0.05, 0.05, 1.0, 5, '#6b4a33'), box(0.4, 0.35, 0.55, color, 0, 1.0, 0), paint(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 1.35, 0), color), box(0.04, 0.25, 0.1, '#f2c14e', 0.22, 1.3, 0.15)],
    glow: [],
  };
}

export function barrel(color = '#9b6b43'): PropParts {
  return { solid: [cyl(0.38, 0.34, 1.0, 10, color), cyl(0.4, 0.4, 0.07, 10, '#4a4f55', 0, 0.18, 0), cyl(0.4, 0.4, 0.07, 10, '#4a4f55', 0, 0.78, 0), cyl(0.34, 0.34, 0.03, 10, shade(color, -0.1), 0, 1.0, 0)], glow: [] };
}

function bollardInto(p: PropParts, x: number, y: number, z: number): void {
  p.solid.push(cyl(0.18, 0.22, 0.5, 8, '#3a3f4a', x, y, z));
  p.solid.push(cyl(0.28, 0.2, 0.14, 8, '#3a3f4a', x, y + 0.5, z));
}

export function bollard(): PropParts {
  const p = newParts();
  bollardInto(p, 0, 0, 0);
  return p;
}

export function buoy(color = '#e25a4f'): PropParts {
  return {
    solid: [cyl(0.5, 0.6, 0.6, 10, color, 0, -0.3, 0), cyl(0.52, 0.52, 0.15, 10, '#ffffff', 0, 0.05, 0), cyl(0.1, 0.25, 1.4, 6, color, 0, 0.3, 0), box(0.5, 0.06, 0.06, '#3a3f4a', 0, 1.6, 0)],
    glow: [sphere(0.14, '#fff1c2', 0, 1.8, 0, 1, 1, 1, 0)],
  };
}

/** 小划艇：船壳 + 坐板 + 桨；原点在水面 */
export function rowboat(w: number, d: number, color = '#5b93a8'): PropParts {
  const p = newParts();
  const hull = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(w / 2, 0.55, d / 2);
  p.solid.push(paint(hull, color));
  p.solid.push(paint(new THREE.TorusGeometry(1, 0.06, 4, 20).rotateX(Math.PI / 2).scale(w / 2, 1, d / 2), '#f4efe6'));
  p.solid.push(paint(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2).scale(w / 2 - 0.08, 1, d / 2 - 0.1).translate(0, -0.2, 0), '#b8875a'));
  for (const z of [-d * 0.2, d * 0.15]) p.solid.push(box(w * 0.85, 0.06, 0.3, '#8c6340', 0, -0.05, z));
  for (const s of [-1, 1]) p.solid.push(boxAt(0.08, 0.06, d * 0.8, '#b8875a', s * (w / 2 - 0.1), 0.05, 0, s * 0.25, 0.1));
  return p;
}

/** 晾网架：两根杆 + 横杆 + 网格 */
export function netRack(w: number, h: number): PropParts {
  const p = newParts();
  for (const s of [-1, 1]) p.solid.push(cyl(0.06, 0.07, h, 5, '#7a5238', (s * w) / 2, 0, 0));
  p.solid.push(beam(V(-w / 2 - 0.15, h, 0), V(w / 2 + 0.15, h, 0), 0.05, '#7a5238', 5));
  for (let k = -w / 2 + 0.2; k < w / 2; k += 0.3) p.solid.push(beam(V(k, h, 0.02), V(k + 0.1, h * 0.35, 0.12), 0.012, '#5f6b5a', 3));
  for (let y = h * 0.4; y < h; y += 0.3) p.solid.push(boxAt(w, 0.02, 0.02, '#5f6b5a', 0, y, 0.02 + ((h - y) / h) * 0.1));
  for (let k = 0; k < 5; k++) p.solid.push(sphere(0.07, '#f2c14e', -w / 2 + 0.4 + k * (w / 5), h * 0.36, 0.13, 1, 1, 1, 0));
  return p;
}

/** 喷泉：三层水盘 + 中央雕像（水滴 / 精灵球） */
export function fountain(w: number, stone = '#d8d2c8', emblem = 'droplet'): PropParts {
  const p = newParts();
  const r = w / 2;
  p.solid.push(cyl(r, r + 0.1, 0.6, 20, stone));
  p.solid.push(cyl(r - 0.3, r - 0.3, 0.05, 20, '#6fc6e8', 0, 0.5, 0));
  p.solid.push(paint(new THREE.TorusGeometry(r - 0.1, 0.16, 4, 24).rotateX(Math.PI / 2).translate(0, 0.62, 0), shade(stone, -0.08)));
  p.solid.push(cyl(0.35, 0.45, 1.6, 10, stone, 0, 0.5, 0));
  p.solid.push(cyl(r * 0.45, r * 0.3, 0.3, 16, stone, 0, 2.0, 0));
  p.solid.push(cyl(r * 0.42, r * 0.42, 0.04, 16, '#6fc6e8', 0, 2.28, 0));
  p.solid.push(cyl(0.2, 0.25, 0.8, 8, stone, 0, 2.3, 0));
  // 水流（浅蓝发光细柱，夜间也能看到）
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    p.glow.push(beam(V(Math.sin(a) * r * 0.42, 2.25, Math.cos(a) * r * 0.42), V(Math.sin(a) * r * 0.62, 0.55, Math.cos(a) * r * 0.62), 0.05, '#9ddcf2', 4));
  }
  if (emblem === 'ball') {
    p.solid.push(paint(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 3.6, 0), '#ffffff'));
    p.solid.push(paint(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 3.6, 0), '#e8484a'));
    p.solid.push(cyl(0.51, 0.51, 0.08, 16, '#2b2b30', 0, 3.56, 0));
  } else {
    p.glow.push(sphere(0.45, '#7fe3ff', 0, 3.5, 0, 0.8, 1.3, 0.8, 1));
  }
  return p;
}

/** 雕像：台座 + 五角星（海星星，水之道馆的象征）或锚 */
export function statue(h: number, variant = 'star', color = '#c9a86a'): PropParts {
  const p = newParts();
  p.solid.push(box(1.8, 0.4, 1.8, '#b3aa9a'));
  p.solid.push(box(1.4, h * 0.35, 1.4, '#d8d2c8', 0, 0.4, 0));
  p.solid.push(box(1.1, 0.3, 0.05, '#8a7a5a', 0, 0.4 + h * 0.15, 0.71)); // 铭牌
  const top = 0.4 + h * 0.35;
  if (variant === 'anchor') {
    p.solid.push(box(0.25, h * 0.5, 0.25, color, 0, top, 0));
    p.solid.push(box(1.1, 0.2, 0.2, color, 0, top + h * 0.42, 0));
    p.solid.push(paint(new THREE.TorusGeometry(0.6, 0.12, 6, 14, Math.PI).rotateZ(Math.PI).translate(0, top + 0.6, 0), color));
    p.solid.push(paint(new THREE.TorusGeometry(0.22, 0.06, 5, 10).translate(0, top + h * 0.55, 0), color));
    return p;
  }
  const s = new THREE.Shape();
  const R = h * 0.32;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const rr = k % 2 ? R * 0.42 : R;
    const x = Math.sin(a) * rr;
    const y = Math.cos(a) * rr;
    if (k === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 }).translate(0, R + top + 0.1, -0.15);
  p.solid.push(paint(g, color));
  p.glow.push(sphere(R * 0.18, '#ff6b6b', 0, R + top + 0.1, 0.22, 1, 1, 0.6, 1)); // 核心宝石
  return p;
}

export function container(w: number, h: number, d: number, color: string): PropParts {
  const p = newParts();
  p.solid.push(box(w, h, d, color));
  for (let k = -d / 2 + 0.3; k < d / 2; k += 0.45) for (const s of [-1, 1]) p.solid.push(box(0.06, h - 0.2, 0.18, shade(color, -0.1), s * (w / 2 + 0.02), 0.1, k));
  p.solid.push(box(w + 0.04, 0.12, d + 0.04, shade(color, -0.2), 0, h - 0.12, 0));
  for (const s of [-1, 1]) p.solid.push(box(0.06, h - 0.3, 0.06, '#d0d4d8', s * w * 0.18, 0.15, d / 2 + 0.03));
  return p;
}

/** 灯笼柱（水乡）：木柱 + 挑臂 + 红灯笼 */
export function lantern(h: number, color = '#d9453b'): PropParts {
  return {
    solid: [cyl(0.08, 0.1, h, 6, '#6b4a33'), box(0.9, 0.08, 0.1, '#6b4a33', 0.35, h - 0.2, 0), cyl(0.18, 0.18, 0.06, 8, '#e3c46a', 0.7, h - 0.52, 0), cyl(0.18, 0.18, 0.06, 8, '#e3c46a', 0.7, h - 1.12, 0), cyl(0.2, 0.2, 0.04, 8, '#6b4a33', 0, 0, 0)],
    glow: [sphere(0.3, color, 0.7, h - 0.82, 0, 1, 1.2, 1, 1)],
  };
}

export function reeds(w: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const n = Math.round(w * w * 3);
  for (let k = 0; k < n; k++) {
    const x = (r() - 0.5) * w;
    const z = (r() - 0.5) * w;
    const h = 0.9 + r() * 1.1;
    p.solid.push(beam(V(x, -0.6, z), V(x + (r() - 0.5) * 0.3, h, z + (r() - 0.5) * 0.3), 0.025, r() > 0.3 ? '#7c9a4a' : '#a3b45e', 3));
    if (r() > 0.6) p.solid.push(sphere(0.06, '#7a5a32', x, h - 0.1, z, 0.8, 2.2, 0.8, 0));
  }
  return p;
}

export function lilypads(w: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const n = Math.round(w * w * 0.5);
  for (let k = 0; k < n; k++) {
    const rr = 0.3 + r() * 0.35;
    const g = new THREE.CircleGeometry(rr, 12, 0.3, Math.PI * 2 - 0.3).rotateX(-Math.PI / 2).rotateY(r() * 6);
    p.solid.push(paint(g, r() > 0.5 ? '#5c9a48' : '#6aa84f', M().makeTranslation((r() - 0.5) * w, 0.02, (r() - 0.5) * w)));
    if (r() > 0.75) p.solid.push(sphere(0.12, r() > 0.5 ? '#f6b8c8' : '#ffffff', (r() - 0.5) * w, 0.1, (r() - 0.5) * w, 1, 0.7, 1, 0));
  }
  return p;
}

export function noticeboard(): PropParts {
  const p = newParts();
  for (const s of [-1, 1]) p.solid.push(cyl(0.07, 0.07, 2.1, 5, '#6b4a33', s * 0.9, 0, 0));
  p.solid.push(box(2.0, 1.2, 0.1, '#8a5a3c', 0, 0.8, 0));
  p.solid.push(box(1.8, 1.0, 0.04, '#d8c7a3', 0, 0.9, 0.06));
  const paper = ['#ffffff', '#fff3c2', '#d9ecff'];
  for (let k = 0; k < 4; k++) p.solid.push(boxAt(0.4, 0.5, 0.02, paper[k % 3]!, -0.6 + k * 0.4, 1.4 - (k % 2) * 0.3, 0.09, 0, 0, (k - 1.5) * 0.08));
  p.solid.push(boxAt(2.3, 0.08, 0.5, '#7a5238', 0, 2.1, 0.05, 0, 0.3));
  return p;
}

export function laundry(w: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  for (const s of [-1, 1]) p.solid.push(cyl(0.05, 0.06, 2.1, 5, '#8c9097', (s * w) / 2, 0, 0));
  p.solid.push(beam(V(-w / 2, 1.95, 0), V(w / 2, 1.95, 0), 0.015, '#f4efe6', 3));
  const cloth = ['#ffffff', '#7fc8f8', '#f26b8a', '#f7d046', '#9bd48a'];
  for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += 0.7) p.solid.push(boxAt(0.55, 0.6 + r() * 0.3, 0.03, cloth[Math.floor(r() * cloth.length)]!, x, 1.55, 0, 0, 0, (r() - 0.5) * 0.08));
  return p;
}

/** 菜园 / 药草园：田垄 + 作物 */
export function garden(w: number, d: number, variant = 'veg', seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  p.solid.push(box(w, 0.12, d, '#6b4a33'));
  const rows = Math.max(2, Math.round(w / 1.1));
  for (let i = 0; i < rows; i++) {
    const x = -w / 2 + (i + 0.5) * (w / rows);
    p.solid.push(box(w / rows - 0.35, 0.22, d - 0.4, '#7a5238', x, 0.1, 0));
    for (let z = -d / 2 + 0.5; z < d / 2 - 0.3; z += 0.55) {
      if (variant === 'herb') {
        p.solid.push(sphere(0.2, r() > 0.5 ? '#8fbf6a' : '#6f9e5a', x, 0.42, z, 1, 1.3, 1, 0));
        if (r() > 0.6) p.solid.push(sphere(0.07, r() > 0.5 ? '#b98cf0' : '#ffffff', x, 0.68, z, 1, 1, 1, 0));
      } else {
        const c = ['#5f9e4a', '#7cbf5a', '#e25a4f', '#f28c28'][i % 4]!;
        p.solid.push(sphere(0.22, i % 4 < 2 ? c : '#5f9e4a', x, 0.42, z, 1, 0.8, 1, 0));
        if (i % 4 >= 2) p.solid.push(sphere(0.1, c, x, 0.55, z + 0.1, 1, 1, 1, 0));
      }
    }
  }
  // 稻草人 / 木牌
  p.solid.push(cyl(0.05, 0.05, 1.8, 4, '#7a5238', w / 2 - 0.3, 0, -d / 2 + 0.3));
  p.solid.push(box(1.0, 0.08, 0.08, '#7a5238', w / 2 - 0.3, 1.3, -d / 2 + 0.3));
  p.solid.push(sphere(0.22, '#e8d8a8', w / 2 - 0.3, 1.75, -d / 2 + 0.3, 1, 1, 1, 1));
  p.solid.push(paint(new THREE.ConeGeometry(0.35, 0.3, 8).translate(w / 2 - 0.3, 2.0, -d / 2 + 0.3), '#d9a441'));
  return p;
}

export function rocks(w: number, seed = 1, color = '#9a958d'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const rr = w * (0.2 + r() * 0.2);
    p.solid.push(paint(new THREE.DodecahedronGeometry(rr, 0).scale(1, 0.7, 1).rotateY(r() * 6).translate((r() - 0.5) * w * 0.6, rr * 0.4, (r() - 0.5) * w * 0.6), shade(color, (r() - 0.5) * 0.12)));
  }
  return p;
}

/** 彩旗串：points 为世界折线，高度 h；返回世界坐标几何（不再经 place 变换） */
export function bunting(points: ReadonlyArray<readonly [number, number, number]>, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const colors = ['#e25a4f', '#f2b134', '#3f9fd6', '#7ac74c', '#ffffff', '#c85d7c'];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay, az] = points[i]!;
    const [bx, by, bz] = points[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.round(len / 0.7));
    let prev = V(ax, ay, az);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const sag = Math.sin(t * Math.PI) * Math.min(1.2, len * 0.06);
      const cur = V(ax + (bx - ax) * t, ay + (by - ay) * t - sag, az + (bz - az) * t);
      p.solid.push(beam(prev, cur, 0.015, '#f4efe6', 3));
      const tri = new THREE.BufferGeometry().setFromPoints([V(-0.22, 0, 0), V(0.22, 0, 0), V(0, -0.45, 0)]);
      tri.setIndex([0, 1, 2, 0, 2, 1]);
      tri.computeVertexNormals();
      const ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
      p.solid.push(paint(tri, colors[Math.floor(r() * colors.length)]!, M().makeRotationY(ry).setPosition((prev.x + cur.x) / 2, (prev.y + cur.y) / 2, (prev.z + cur.z) / 2)));
      prev = cur;
    }
  }
  return p;
}

/** 市集摊位（细化）：条纹顶棚、柜台、货物箱、价牌、挂灯 */
export function marketStall(w: number, h: number, d: number, canopy: string, seed = 1, goods = 'fruit'): PropParts {
  const p = newParts();
  const r = rng(seed);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(cyl(0.06, 0.06, h, 5, '#7a5238', (sx * w) / 2, 0, (sz * d) / 2));
  const n = 6;
  for (let i = 0; i < n; i++) p.solid.push(boxAt(w / n + 0.01, 0.08, d + 0.8, i % 2 ? '#ffffff' : canopy, -w / 2 + (i + 0.5) * (w / n), h + 0.15, 0, 0, 0.18));
  for (let i = 0; i < n; i++) p.solid.push(paint(new THREE.CylinderGeometry(w / n / 2, w / n / 2, 0.06, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), i % 2 ? '#ffffff' : canopy, M().makeTranslation(-w / 2 + (i + 0.5) * (w / n), h - 0.05, d / 2 + 0.4)));
  p.solid.push(box(w, 0.9, 0.9, '#c89a64', 0, 0, d / 2 - 0.45));
  p.solid.push(box(w + 0.1, 0.06, 1.0, '#9b6b43', 0, 0.9, d / 2 - 0.45));
  const palettes: Record<string, string[]> = {
    fruit: ['#f26b4f', '#f7d046', '#7ac74c', '#b0476a', '#f28c28'],
    fish: ['#9bb6c9', '#c9d4db', '#e3a07a'],
    berry: ['#5a3d8a', '#e25a4f', '#2f6db5', '#f7d046'],
    goods: ['#5aa9e6', '#f2c14e', '#ffffff', '#c86b5a'],
  };
  const pal = palettes[goods] ?? palettes.fruit!;
  const crates = Math.max(2, Math.floor(w / 0.8));
  for (let i = 0; i < crates; i++) {
    const x = -w / 2 + 0.45 + i * ((w - 0.9) / Math.max(1, crates - 1));
    p.solid.push(box(0.6, 0.18, 0.55, '#b9864f', x, 0.96, d / 2 - 0.45));
    const c = pal[Math.floor(r() * pal.length)]!;
    for (let k = 0; k < 4; k++) p.solid.push(sphere(0.11, c, x + ((k % 2) - 0.5) * 0.25, 1.2, d / 2 - 0.45 + (Math.floor(k / 2) - 0.5) * 0.22, 1, 1, 1, 0));
    if (i % 2 === 0) p.solid.push(box(0.26, 0.18, 0.02, '#ffffff', x, 1.18, d / 2 + 0.05));
  }
  // 背后货架 + 挂灯
  p.solid.push(box(w * 0.9, 1.4, 0.4, '#9b6b43', 0, 0, -d / 2 + 0.3));
  for (let k = 0; k < 3; k++) p.solid.push(box(0.5, 0.35, 0.3, pal[k % pal.length]!, -w * 0.3 + k * w * 0.3, 1.4, -d / 2 + 0.3));
  p.glow.push(sphere(0.14, '#fff1c2', 0, h - 0.3, 0, 1, 1, 1, 0));
  return p;
}

/** 水井（细化）：石砌井身 + 井台 + 摇辘 + 木桶 + 小瓦顶 */
export function well(): PropParts {
  const p = newParts();
  p.solid.push(cyl(1.5, 1.6, 0.2, 14, '#b3aa9a'));
  p.solid.push(cyl(1.05, 1.15, 0.9, 14, '#a7a198', 0, 0.2, 0));
  for (let y = 0.35; y < 1.1; y += 0.3) p.solid.push(cyl(1.16, 1.16, 0.04, 14, '#8f8a83', 0, y, 0));
  p.solid.push(paint(new THREE.TorusGeometry(1.05, 0.12, 4, 16).rotateX(Math.PI / 2).translate(0, 1.12, 0), '#c9c4bb'));
  p.solid.push(cyl(0.9, 0.9, 0.05, 14, '#2c5f7a', 0, 0.85, 0));
  for (const s of [-1, 1]) p.solid.push(box(0.16, 2.3, 0.16, '#7a5238', s * 1.0, 1.0, 0));
  p.solid.push(beam(V(-1.1, 2.4, 0), V(1.1, 2.4, 0), 0.09, '#7a5238', 6));
  p.solid.push(box(0.08, 0.5, 0.08, '#7a5238', 1.2, 2.2, 0));
  p.solid.push(cyl(0.01, 0.01, 1.2, 3, '#d8c7a3', 0, 1.2, 0));
  p.solid.push(cyl(0.2, 0.16, 0.3, 8, '#8a5a3c', 0, 1.2, 0));
  p.solid.push(cyl(0.22, 0.18, 0.35, 8, '#8a5a3c', 1.35, 0.2, 0.6));
  gable(p, 2.6, 0.9, 1.8, 3.1, '#c95e45', '#c95e45', 0.2, '#7a5238');
  return p;
}

// M2 碧潮群岛构件（tideBuilders.ts）复用的内部工具
export { beam, chimney, cornerTrim, doorAt, evenly, gable, hip, shade, sphere, V, windowAt, windowCount, type Face };

/**
 * 头目巢穴精细化建模（计划文档 §3 头目）：按头目的类型生成不同主题的巢穴场景。
 *  - nest      大鸟巢（比雕）：岩丘 + 层层编织的巨型枝条巢 + 干草内衬 + 大羽毛 + 蛋壳 + 枯树栖木 + 被风压倒的草
 *  - whirlpool 漩涡浅滩（暴鲤龙）：破碎的玄武岩尖柱环 + 海藻 + 沉船残骸 + 旋转漩涡 + 泡沫环
 *  - seacliff  海崖鸟巢（大嘴鸥）：漂流木巢 + 海带 + 鸟粪白痕的岩石 + 鱼骨 + 破渔网 + 系缆桩与绳圈
 *  - shadow    幻影石圈（索罗亚克）：黑紫方尖石 + 发光符文 + 扭曲树根拱门 + 爪痕树桩 + 红叶 + 幻影光点 + 地面法阵
 *  - rock      石冢（小拳石）：叠石塔 + 巨石堆 + 碎石 + 矿石晶簇 + 地裂缝
 *  - mudflat   泥滩（巨钳蟹）：湿泥坑 + 巨型扇贝 / 蛤壳 + 蟹壳碎片 + 芦苇丛 + 漂流木 + 冒泡 + 钳痕
 * 输出：静态部分按材质合并（实体顶点色 1 个 + 发光 1 个 draw call），动画部分单独（每帧 update）。
 * 巢穴中心 den.radius 内保持可走（头目在此踱步），大件放在外圈。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { AlphaDenTheme } from '@/systems/alpha';

export type DenTheme = AlphaDenTheme;

export interface DenGround {
  heightAt(x: number, z: number): number;
  /** 水面高度（无水 = null） */
  waterLevel(x: number, z: number): number | null;
}

export interface DenBuild {
  group: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

/** 按物种属性推断主题（配置里没写 theme 时） */
export function denThemeFor(types: readonly string[], onWater: boolean): DenTheme {
  const [a, b] = types;
  if (a === 'dark' || a === 'ghost' || b === 'dark') return 'shadow';
  if (a === 'rock' || a === 'ground' || a === 'steel') return 'rock';
  if (a === 'water' && (b === 'flying' || types.includes('flying'))) return onWater ? 'whirlpool' : 'seacliff';
  if (a === 'water') return onWater ? 'whirlpool' : 'mudflat';
  if (types.includes('flying')) return 'nest';
  return 'rock';
}

// ———————————————— 几何工具 ————————————————

type Rnd = () => number;
function mkRnd(seedStr: string): Rnd {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) | 0;
  s = (s & 0x7fffffff) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** 给几何体刷顶点色（可选每顶点明暗抖动），去掉 uv，变成非索引 */
function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0, rnd?: Rnd): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  const n = geo.getAttribute('position').count;
  const base = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  const c = new THREE.Color();
  // 每个三角面同色（平直着色的低多边形风格）
  for (let i = 0; i < n; i += 3) {
    const k = jitter && rnd ? 1 + (rnd() - 0.5) * jitter : 1;
    c.copy(base).multiplyScalar(k);
    for (let j = 0; j < 3 && i + j < n; j++) c.toArray(arr, (i + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  geo.computeVertexNormals();
  return geo;
}

/** 低多边形岩石：二十面体顶点抖动 + 非等比缩放 */
function rockGeo(r: number, rnd: Rnd, sx = 1, sy = 0.75, sz = 1, detail = 0, rough = 0.28): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  // 同一位置的顶点要同样抖动（否则裂缝）：按坐标哈希
  const map = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let d = map.get(key);
    if (!d) {
      d = [1 + (rnd() - 0.5) * rough * 2, 1 + (rnd() - 0.5) * rough * 2, 1 + (rnd() - 0.5) * rough * 2];
      map.set(key, d);
    }
    p.setXYZ(i, p.getX(i) * sx * d[0], p.getY(i) * sy * d[1], p.getZ(i) * sz * d[2]);
  }
  return g;
}

/** 两点之间的圆柱（枝条、骨头、根） */
function stickGeo(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, seg = 5): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.BufferGeometry {
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
  g.translate(x, y, z);
  return g;
}

/** 让平面几何的每个顶点贴合地形（y = 地面 + offset） */
function drape(g: THREE.BufferGeometry, ground: DenGround, offset: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, ground.heightAt(p.getX(i), p.getZ(i)) + offset + p.getY(i));
  g.computeVertexNormals();
  return g;
}

/** 水平圆盘（世界坐标，贴地前 y=0） */
function discGeo(cx: number, cz: number, r: number, seg: number, rnd?: Rnd, wobble = 0): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, seg, 0, Math.PI * 2);
  g.rotateX(-Math.PI / 2);
  if (rnd && wobble) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 1; i < p.count; i++) {
      const k = 1 + (rnd() - 0.5) * wobble;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
  }
  g.translate(cx, 0, cz);
  return g;
}

/** 羽毛：羽轴 + 两片羽瓣（扁锥），长 len */
function featherGeo(len: number, color: string, tip: string, rnd: Rnd): THREE.BufferGeometry[] {
  const vane = new THREE.ConeGeometry(len * 0.16, len, 6, 1);
  vane.scale(1, 1, 0.18);
  vane.rotateX(Math.PI); // 尖朝下 → 根部
  vane.translate(0, len * 0.55, 0);
  const tipG = new THREE.ConeGeometry(len * 0.12, len * 0.3, 6, 1);
  tipG.scale(1, 1, 0.18);
  tipG.translate(0, len * 1.08, 0);
  const shaft = new THREE.CylinderGeometry(0.012, 0.02, len * 1.1, 4);
  shaft.translate(0, len * 0.55, 0);
  return [paint(vane, color, 0.12, rnd), paint(tipG, tip, 0.1, rnd), paint(shaft, '#efe6d2')];
}

/** 扇贝：一圈放射状肋条（扁锥）拼成的扇形 + 铰合部 */
function scallopGeo(r: number, color: string, rib: string, rnd: Rnd): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.42 + (i / (n - 1)) * Math.PI * 0.84;
    const c = new THREE.ConeGeometry(r * 0.2, r, 4, 1);
    c.rotateX(Math.PI / 2);
    c.translate(0, 0, r / 2);
    c.scale(1, 0.45, 1);
    c.rotateY(a);
    c.rotateX(-0.25);
    out.push(paint(c, i % 2 ? color : rib, 0.1, rnd));
  }
  const hinge = new THREE.BoxGeometry(r * 0.5, r * 0.12, r * 0.18);
  out.push(paint(hinge, rib));
  return out;
}

/** 结果收集器：实体（顶点色 Toon）/ 发光（不受光） */
class Parts {
  solid: THREE.BufferGeometry[] = [];
  glow: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry | THREE.BufferGeometry[]): void {
    if (Array.isArray(g)) this.solid.push(...g);
    else this.solid.push(g);
  }
  addGlow(g: THREE.BufferGeometry): void {
    this.glow.push(g);
  }
}

function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!list.length) return null;
  const clean = list.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(name)) x.deleteAttribute(name);
    if (!x.getAttribute('normal')) x.computeVertexNormals();
    return x;
  });
  return mergeGeometries(clean);
}

// ———————————————— 主入口 ————————————————

export function buildAlphaDen(
  den: { id: string; position: [number, number]; radius: number },
  theme: DenTheme,
  ground: DenGround,
  solidMaterial: THREE.Material,
): DenBuild {
  const rnd = mkRnd(den.id);
  const [cx, cz] = den.position;
  const parts = new Parts();
  const fx: { obj: THREE.Object3D; tick: (t: number) => void }[] = [];
  const disposables: { dispose(): void }[] = [];
  const group = new THREE.Group();
  group.name = `den:${den.id}`;
  const ctx: Ctx = { cx, cz, r: den.radius, rnd, ground, parts, group, fx, disposables };
  switch (theme) {
    case 'nest':
      buildNest(ctx);
      break;
    case 'whirlpool':
      buildWhirlpool(ctx);
      break;
    case 'seacliff':
      buildSeacliff(ctx);
      break;
    case 'shadow':
      buildShadow(ctx);
      break;
    case 'rock':
      buildRockCairn(ctx);
      break;
    case 'mudflat':
      buildMudflat(ctx);
      break;
  }
  const solid = mergeAll(parts.solid);
  if (solid) {
    const m = new THREE.Mesh(solid, solidMaterial);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `den-solid:${den.id}`;
    group.add(m);
    disposables.push(solid);
  }
  const glow = mergeAll(parts.glow);
  if (glow) {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const m = new THREE.Mesh(glow, mat);
    m.userData.keepMaterial = true;
    m.name = `den-glow:${den.id}`;
    group.add(m);
    disposables.push(glow, mat);
  }
  return {
    group,
    update(t: number) {
      for (const f of fx) f.tick(t);
    },
    dispose() {
      group.removeFromParent();
      for (const d of disposables) d.dispose();
    },
  };
}

interface Ctx {
  cx: number;
  cz: number;
  r: number;
  rnd: Rnd;
  ground: DenGround;
  parts: Parts;
  group: THREE.Group;
  fx: { obj: THREE.Object3D; tick: (t: number) => void }[];
  disposables: { dispose(): void }[];
}

const h = (c: Ctx, x: number, z: number) => c.ground.heightAt(x, z);
const polar = (c: Ctx, a: number, d: number): [number, number] => [c.cx + Math.sin(a) * d, c.cz + Math.cos(a) * d];

/** 被风压倒 / 普通的草丛（几片尖叶） */
function tuft(c: Ctx, x: number, z: number, color: string, lean: number, leanDir: number, size = 1): void {
  const y = h(c, x, z);
  const n = 4 + Math.floor(c.rnd() * 3);
  for (let i = 0; i < n; i++) {
    const blade = new THREE.ConeGeometry(0.05 * size, (0.45 + c.rnd() * 0.35) * size, 3, 1);
    blade.translate(0, 0.25 * size, 0);
    place(blade, x + (c.rnd() - 0.5) * 0.3, y - 0.02, z + (c.rnd() - 0.5) * 0.3, leanDir + (c.rnd() - 0.5) * 0.6, lean + (c.rnd() - 0.5) * 0.3, 0);
    c.parts.add(paint(blade, color, 0.25, c.rnd));
  }
}

function scatterRocks(c: Ctx, n: number, rMin: number, rMax: number, dMin: number, dMax: number, colors: string[], sink = 0.3): void {
  for (let i = 0; i < n; i++) {
    const a = c.rnd() * Math.PI * 2;
    const d = dMin + c.rnd() * (dMax - dMin);
    const [x, z] = polar(c, a, d);
    const r = rMin + c.rnd() * (rMax - rMin);
    const g = rockGeo(r, c.rnd, 1 + c.rnd() * 0.4, 0.55 + c.rnd() * 0.3, 1 + c.rnd() * 0.3);
    place(g, x, h(c, x, z) + r * (0.35 - sink), z, c.rnd() * Math.PI * 2);
    c.parts.add(paint(g, colors[i % colors.length]!, 0.18, c.rnd));
  }
}

// ———————————————— 1. 大鸟巢 ————————————————

function buildNest(c: Ctx): void {
  const { cx, cz, rnd } = c;
  const R = c.r * 0.92; // 巢的内半径：头目在巢里踱步
  const y0 = h(c, cx, cz);
  // 岩丘：巢下面一圈压扁的大岩石（巢像架在岩丘上）
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.2;
    const [x, z] = polar(c, a, R + 1.6 + rnd() * 0.8);
    const r = 1.1 + rnd() * 0.7;
    const g = rockGeo(r, rnd, 1.4, 0.5, 1.1, 1, 0.2);
    place(g, x, h(c, x, z) + 0.05, z, a);
    c.parts.add(paint(g, i % 3 ? '#9a9286' : '#7f8a64', 0.16, rnd));
  }
  // 巢底：干草内衬（贴地圆盘，略带起伏），中间压出凹窝
  const lining = drape(discGeo(cx, cz, R + 0.4, 28, rnd, 0.12), c.ground, 0.08);
  c.parts.add(paint(lining, '#d8c38a', 0.14, rnd));
  const hollow = drape(discGeo(cx, cz, R * 0.45, 18, rnd, 0.2), c.ground, 0.11);
  c.parts.add(paint(hollow, '#c4a86a', 0.12, rnd));
  // 巢壁：多层切向交错的枝条，越往上越向外翻
  const layers = 5;
  for (let L = 0; L < layers; L++) {
    const n = 46 + L * 6;
    const rr = R + 0.35 + L * 0.18;
    const yy = 0.15 + L * 0.2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.15;
      const span = 0.32 + rnd() * 0.25; // 枝条覆盖的弧度
      const a0 = a - span / 2;
      const a1 = a + span / 2;
      const r0 = rr + (rnd() - 0.5) * 0.35;
      const r1 = rr + (rnd() - 0.5) * 0.35;
      const p0 = new THREE.Vector3(cx + Math.sin(a0) * r0, 0, cz + Math.cos(a0) * r0);
      const p1 = new THREE.Vector3(cx + Math.sin(a1) * r1, 0, cz + Math.cos(a1) * r1);
      p0.y = h(c, p0.x, p0.z) + yy + (rnd() - 0.5) * 0.18;
      p1.y = h(c, p1.x, p1.z) + yy + (rnd() - 0.5) * 0.18;
      const col = ['#7a5634', '#8d6a42', '#6a4a2c', '#a07c4e', '#5e4228'][Math.floor(rnd() * 5)]!;
      c.parts.add(paint(stickGeo(p0, p1, 0.07 + rnd() * 0.04, 0.05, 5), col, 0.1, rnd));
    }
  }
  // 斜插、伸出巢沿的长枝（让轮廓毛糙自然）
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2;
    const rIn = R + 0.2;
    const rOut = R + 1.3 + rnd() * 1.1;
    const p0 = new THREE.Vector3(cx + Math.sin(a) * rIn, 0, cz + Math.cos(a) * rIn);
    const a2 = a + (rnd() - 0.5) * 0.5;
    const p1 = new THREE.Vector3(cx + Math.sin(a2) * rOut, 0, cz + Math.cos(a2) * rOut);
    p0.y = h(c, p0.x, p0.z) + 0.5 + rnd() * 0.6;
    p1.y = h(c, p1.x, p1.z) + 0.1 + rnd() * 0.9;
    c.parts.add(paint(stickGeo(p0, p1, 0.06, 0.03, 4), rnd() < 0.5 ? '#7a5634' : '#93704a', 0.1, rnd));
  }
  // 巢里的大羽毛（比雕配色：棕羽 + 奶油羽 + 红黄冠羽）
  const featherCols: [string, string][] = [
    ['#a8743e', '#5a3a20'],
    ['#efdcb0', '#c79a5a'],
    ['#d9443a', '#f2c230'],
    ['#a8743e', '#efdcb0'],
  ];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = (i < 5 ? 0.3 : 1.05) * R * (0.4 + rnd() * 0.6);
    const [x, z] = polar(c, a, d);
    const [col, tip] = featherCols[i % featherCols.length]!;
    const len = 0.7 + rnd() * 0.6;
    for (const g of featherGeo(len, col, tip, rnd)) {
      // 平躺在地上（绕 X 放倒），随机方向
      place(g, x, h(c, x, z) + 0.14 + rnd() * 0.05, z, rnd() * Math.PI * 2, Math.PI / 2 - 0.12, 0);
      c.parts.add(g);
    }
  }
  // 插在巢沿上的几根竖羽
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 0.6);
    for (const g of featherGeo(0.9, '#a8743e', '#5a3a20', rnd)) {
      place(g, x, h(c, x, z) + 0.6, z, a, 0.5 + rnd() * 0.3, 0);
      c.parts.add(g);
    }
  }
  // 蛋壳碎片（白底褐斑的弯曲碎片）
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R * 0.25 + rnd() * 0.6);
    const g = new THREE.SphereGeometry(0.22, 6, 4, rnd() * 6, 1.6, 0, 1.4);
    place(g, x, h(c, x, z) + 0.17, z, rnd() * 6, rnd() * 2, 0);
    c.parts.add(paint(g, i % 2 ? '#f4efe2' : '#e8dcc4', 0.1, rnd));
  }
  // 栖木：巢边的枯树（主干 + 递归分枝），树杈上有一根长羽
  const ta = rnd() * Math.PI * 2;
  const [tx, tz] = polar(c, ta, R + 3.6);
  const base = new THREE.Vector3(tx, h(c, tx, tz) - 0.2, tz);
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    c.parts.add(paint(stickGeo(from, to, rad, rad * 0.68, 6), depth > 2 ? '#6e655c' : '#5d544b', 0.12, rnd));
    if (depth >= 4) return;
    const kids = depth === 0 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const nd = dir
        .clone()
        .add(new THREE.Vector3((rnd() - 0.5) * 1.3, 0.25 + rnd() * 0.3, (rnd() - 0.5) * 1.3))
        .normalize();
      branch(to, nd, len * (0.62 + rnd() * 0.12), rad * 0.62, depth + 1);
    }
  };
  branch(base, new THREE.Vector3(Math.sin(ta + Math.PI) * 0.15, 1, Math.cos(ta + Math.PI) * 0.15).normalize(), 3.4, 0.32, 0);
  // 树根
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rnd();
    const to = new THREE.Vector3(tx + Math.sin(a) * 1.1, 0, tz + Math.cos(a) * 1.1);
    to.y = h(c, to.x, to.z) - 0.1;
    c.parts.add(paint(stickGeo(base.clone().setY(base.y + 0.5), to, 0.18, 0.08, 5), '#5d544b', 0.1, rnd));
  }
  // 被风压倒、向外辐射的草（巨大翅膀扇出来的风痕）
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 3 + rnd() * 5);
    tuft(c, x, z, rnd() < 0.5 ? '#7fae4a' : '#97bf55', 1.05, a + Math.PI, 1.1);
  }
  scatterRocks(c, 10, 0.25, 0.5, R + 2.5, R + 6, ['#9a9286', '#8a8478']);
  void y0;
}

// ———————————————— 2. 漩涡浅滩 ————————————————

function buildWhirlpool(c: Ctx): void {
  const { cx, cz, rnd } = c;
  const R = c.r + 2;
  const water = c.ground.waterLevel(cx, cz) ?? h(c, cx, cz) + 0.5;
  // 玄武岩尖柱：一圈破碎的、向外倾斜的六棱柱群（有高有低，像被撞碎过）
  const nGroups = 9;
  for (let gI = 0; gI < nGroups; gI++) {
    if (gI === 3) continue; // 留一个缺口（看起来是被撞开的）
    const a = (gI / nGroups) * Math.PI * 2 + rnd() * 0.2;
    const cols = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < cols; k++) {
      const [x, z] = polar(c, a + (k - cols / 2) * 0.09, R + rnd() * 1.2);
      const g0 = h(c, x, z);
      const top = water + 0.6 + rnd() * (gI % 2 ? 3.6 : 2.2);
      const len = top - g0;
      const rad = 0.45 + rnd() * 0.3;
      const col = new THREE.CylinderGeometry(rad * 0.85, rad, len, 6, 1);
      col.translate(0, len / 2, 0);
      // 顶端斜切的碎块
      const cap = new THREE.CylinderGeometry(rad * 0.2, rad * 0.85, rad * 1.2, 6, 1);
      cap.translate(0, len + rad * 0.6, 0);
      const tilt = 0.12 + rnd() * 0.18;
      for (const g of [col, cap]) {
        place(g, x, g0 - 0.3, z, rnd() * Math.PI, -Math.cos(a) * tilt, Math.sin(a) * tilt);
        c.parts.add(paint(g, k % 2 ? '#3d434c' : '#4b525c', 0.14, rnd));
      }
      // 水线附近的海藻 / 苔藓带
      const band = new THREE.CylinderGeometry(rad * 1.04, rad * 1.08, 0.5, 6, 1, true);
      place(band, x, water - 0.15, z, 0, -Math.cos(a) * tilt, Math.sin(a) * tilt);
      c.parts.add(paint(band, '#3f6b3a', 0.2, rnd));
      // 垂下的海藻条
      for (let s = 0; s < 3; s++) {
        const aa = rnd() * Math.PI * 2;
        const p0 = new THREE.Vector3(x + Math.sin(aa) * rad, water + 0.2 + rnd() * 0.6, z + Math.cos(aa) * rad);
        const p1 = p0.clone().add(new THREE.Vector3(Math.sin(aa) * 0.25, -0.9, Math.cos(aa) * 0.25));
        c.parts.add(paint(stickGeo(p0, p1, 0.05, 0.02, 3), '#2f5a32', 0.2, rnd));
      }
    }
  }
  // 沉船残骸：断成两截的小船 + 歪倒的桅杆 + 漂浮木板
  const wa = rnd() * Math.PI * 2;
  const [wx, wz] = polar(c, wa, R + 3.2);
  const wy = Math.max(h(c, wx, wz), water - 0.5);
  for (let s = -1; s <= 1; s += 2) {
    const hull = new THREE.CylinderGeometry(1.0, 1.0, 2.2, 8, 1, true, 0, Math.PI);
    hull.rotateZ(Math.PI / 2);
    hull.rotateX(Math.PI);
    place(hull, wx + Math.sin(wa) * s * 1.4, wy + 0.2, wz + Math.cos(wa) * s * 1.4, wa + Math.PI / 2 + s * 0.3, s * 0.2, 0.35 * s);
    c.parts.add(paint(hull, '#7b5838', 0.16, rnd));
  }
  const mastBase = new THREE.Vector3(wx, wy + 0.2, wz);
  const mastTop = mastBase.clone().add(new THREE.Vector3(Math.sin(wa + 1) * 2.6, 2.4, Math.cos(wa + 1) * 2.6));
  c.parts.add(paint(stickGeo(mastBase, mastTop, 0.11, 0.08, 6), '#5e4228', 0.1, rnd));
  const sail = new THREE.PlaneGeometry(1.4, 1.6, 2, 2);
  const sp = sail.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(sp.getX(i) * 2 + sp.getY(i)) * 0.15);
  place(sail, (mastBase.x + mastTop.x) / 2, (mastBase.y + mastTop.y) / 2, (mastBase.z + mastTop.z) / 2, wa + 1, 0.4, 0.6);
  const sailG = paint(sail, '#d8ccb0', 0.1, rnd);
  c.parts.add(sailG);
  c.parts.add(paint(sail.clone().scale(-1, 1, 1), '#d8ccb0'));
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R * 0.6 + rnd() * (R * 0.9));
    const plank = new THREE.BoxGeometry(1.1 + rnd() * 0.6, 0.08, 0.22);
    place(plank, x, water + 0.03, z, rnd() * Math.PI);
    c.parts.add(paint(plank, '#8d6a42', 0.15, rnd));
  }
  // 漩涡：两层旋转的螺旋带（加色混合）+ 外圈泡沫
  const swirlMat = new THREE.MeshBasicMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const swirlMat2 = new THREE.MeshBasicMaterial({ color: '#7fd0e6', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  c.disposables.push(swirlMat, swirlMat2);
  const spiral = (arms: number, turns: number, rMax: number, width: number): THREE.BufferGeometry => {
    const pos: number[] = [];
    const idx: number[] = [];
    const steps = 60;
    let base = 0;
    for (let arm = 0; arm < arms; arm++) {
      const off = (arm / arms) * Math.PI * 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = off + t * turns * Math.PI * 2;
        const rr = 0.3 + t * rMax;
        const w = width * Math.sin(t * Math.PI);
        const dip = -(1 - t) * 0.5; // 中心下陷
        pos.push(Math.sin(a) * (rr - w), dip, Math.cos(a) * (rr - w), Math.sin(a) * (rr + w), dip, Math.cos(a) * (rr + w));
        if (i < steps) idx.push(base + i * 2, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
      }
      base += (steps + 1) * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  };
  const s1 = spiral(3, 1.4, c.r * 0.95, 0.35);
  const s2 = spiral(4, 1.1, c.r * 0.8, 0.22);
  c.disposables.push(s1, s2);
  const m1 = new THREE.Mesh(s1, swirlMat);
  const m2 = new THREE.Mesh(s2, swirlMat2);
  for (const m of [m1, m2]) {
    m.position.set(cx, water + 0.06, cz);
    m.userData.keepMaterial = true;
    m.renderOrder = 4;
    c.group.add(m);
  }
  m2.position.y = water + 0.04;
  const foamG = new THREE.RingGeometry(c.r * 1.0, c.r * 1.25, 48, 1);
  foamG.rotateX(-Math.PI / 2);
  const fp = foamG.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < fp.count; i++) {
    const k = 1 + (Math.sin(i * 1.7) * 0.06);
    fp.setX(i, fp.getX(i) * k);
    fp.setZ(i, fp.getZ(i) * k);
  }
  const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
  c.disposables.push(foamG, foamMat);
  const foam = new THREE.Mesh(foamG, foamMat);
  foam.position.set(cx, water + 0.05, cz);
  foam.userData.keepMaterial = true;
  c.group.add(foam);
  c.fx.push({
    obj: m1,
    tick: (t) => {
      m1.rotation.y = -t * 0.9;
      m2.rotation.y = -t * 1.5;
      foam.rotation.y = t * 0.2;
      foamMat.opacity = 0.28 + Math.sin(t * 2) * 0.08;
    },
  });
}

// ———————————————— 3. 海崖鸟巢 ————————————————

function buildSeacliff(c: Ctx): void {
  const { cx, cz, rnd } = c;
  const R = c.r * 0.85;
  // 崖顶的风化岩块，顶上有白色鸟粪痕（每块两层：岩体 + 顶部白斑）
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd() * 0.3;
    const [x, z] = polar(c, a, R + 2.2 + rnd() * 1.6);
    const r = 0.8 + rnd() * 0.8;
    const g = rockGeo(r, rnd, 1.3, 0.7, 1.1, 1, 0.22);
    const y = h(c, x, z) + r * 0.15;
    place(g, x, y, z, rnd() * 6);
    c.parts.add(paint(g, i % 2 ? '#8c8f93' : '#a3a29a', 0.14, rnd));
    const splat = rockGeo(r * 0.72, rnd, 1.25, 0.2, 1.05, 0, 0.15);
    place(splat, x, y + r * 0.48, z, rnd() * 6);
    c.parts.add(paint(splat, '#f2f0e8', 0.06, rnd));
    // 往下流的白色痕迹
    for (let s = 0; s < 2; s++) {
      const aa = rnd() * Math.PI * 2;
      const streak = new THREE.BoxGeometry(0.12, r * 0.6, 0.04);
      place(streak, x + Math.sin(aa) * r * 1.1, y + r * 0.15, z + Math.cos(aa) * r * 1.1, aa, 0, 0);
      c.parts.add(paint(streak, '#ecebe2'));
    }
  }
  // 漂流木巢：灰白色粗漂流木交叉堆成的环 + 海带
  for (let L = 0; L < 3; L++) {
    const n = 18 + L * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.2;
      const span = 0.45 + rnd() * 0.3;
      const rr = R + 0.4 + L * 0.25;
      const p0 = new THREE.Vector3(cx + Math.sin(a - span / 2) * rr, 0, cz + Math.cos(a - span / 2) * rr);
      const p1 = new THREE.Vector3(cx + Math.sin(a + span / 2) * (rr + 0.3), 0, cz + Math.cos(a + span / 2) * (rr + 0.3));
      p0.y = h(c, p0.x, p0.z) + 0.15 + L * 0.28;
      p1.y = h(c, p1.x, p1.z) + 0.15 + L * 0.28 + (rnd() - 0.5) * 0.2;
      c.parts.add(paint(stickGeo(p0, p1, 0.12 + rnd() * 0.06, 0.09, 6), ['#b8afa2', '#a59a8a', '#cfc6b8'][i % 3]!, 0.1, rnd));
    }
  }
  // 海带堆：深绿褐色的扁带
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 0.2 + rnd() * 0.9);
    const kelp = new THREE.PlaneGeometry(0.22, 1.2 + rnd() * 0.8, 1, 4);
    const kp = kelp.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < kp.count; k++) kp.setZ(k, Math.sin(kp.getY(k) * 3) * 0.12);
    place(kelp, x, h(c, x, z) + 0.25 + rnd() * 0.35, z, rnd() * 6, Math.PI / 2 - 0.2, 0);
    c.parts.add(paint(kelp, rnd() < 0.5 ? '#4a5a2a' : '#5a4a26', 0.2, rnd));
    c.parts.add(paint(kelp.clone().scale(1, 1, -1), '#3f4d24'));
  }
  // 巢内铺的软羽（白 + 蓝，大嘴鸥配色）
  const lining = drape(discGeo(cx, cz, R + 0.2, 24, rnd, 0.15), c.ground, 0.07);
  c.parts.add(paint(lining, '#d9d2bf', 0.12, rnd));
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, rnd() * R);
    for (const g of featherGeo(0.55 + rnd() * 0.3, i % 3 ? '#f4f4f0' : '#4f8fc8', i % 2 ? '#d8dde4' : '#f2c230', rnd)) {
      place(g, x, h(c, x, z) + 0.12, z, rnd() * 6, Math.PI / 2 - 0.1, 0);
      c.parts.add(g);
    }
  }
  // 鱼骨：脊椎 + 肋骨 + 头骨
  for (let f = 0; f < 4; f++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R * (0.3 + rnd() * 0.9));
    const y = h(c, x, z) + 0.12;
    const yaw = rnd() * Math.PI * 2;
    const len = 0.8 + rnd() * 0.5;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const p0 = new THREE.Vector3(x, y, z).addScaledVector(dir, -len / 2);
    const p1 = new THREE.Vector3(x, y, z).addScaledVector(dir, len / 2);
    c.parts.add(paint(stickGeo(p0, p1, 0.025, 0.02, 4), '#f2ecdc'));
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    for (let k = 1; k < 6; k++) {
      const q = p0.clone().lerp(p1, k / 7);
      for (const s of [-1, 1]) {
        const tip = q.clone().addScaledVector(side, s * 0.18 * Math.sin((k / 6) * Math.PI)).addScaledVector(dir, -0.06);
        c.parts.add(paint(stickGeo(q, tip, 0.012, 0.008, 3), '#efe8d6'));
      }
    }
    const skull = new THREE.ConeGeometry(0.1, 0.24, 5);
    skull.rotateX(Math.PI / 2);
    place(skull, p1.x + dir.x * 0.1, y, p1.z + dir.z * 0.1, yaw);
    c.parts.add(paint(skull, '#f2ecdc'));
    const tail = new THREE.ConeGeometry(0.12, 0.2, 3);
    tail.scale(1, 1, 0.2);
    tail.rotateX(-Math.PI / 2);
    place(tail, p0.x - dir.x * 0.08, y, p0.z - dir.z * 0.08, yaw);
    c.parts.add(paint(tail, '#efe8d6'));
  }
  // 系缆桩 + 绳圈 + 破渔网（挂在桩和岩石之间）
  const pa = rnd() * Math.PI * 2;
  const [px, pz] = polar(c, pa, R + 3.4);
  const py = h(c, px, pz);
  const post = new THREE.CylinderGeometry(0.22, 0.26, 1.6, 7);
  post.translate(px, py + 0.7, pz);
  c.parts.add(paint(post, '#6a5a48', 0.14, rnd));
  const capG = new THREE.CylinderGeometry(0.3, 0.22, 0.12, 7);
  capG.translate(px, py + 1.52, pz);
  c.parts.add(paint(capG, '#5a4a38'));
  for (let k = 0; k < 3; k++) {
    const t = new THREE.TorusGeometry(0.42 - k * 0.04, 0.05, 4, 14);
    t.rotateX(Math.PI / 2);
    t.translate(px + 0.6, py + 0.06 + k * 0.08, pz + 0.2);
    c.parts.add(paint(t, '#c9a86a', 0.1, rnd));
  }
  // 渔网：桩与地面之间下垂的网格（细杆）
  const netA = new THREE.Vector3(px, py + 1.2, pz);
  const [nx, nz] = polar(c, pa + 0.5, R + 1.2);
  const netB = new THREE.Vector3(nx, h(c, nx, nz) + 0.1, nz);
  const NW = 6;
  const NH = 4;
  const nodes: THREE.Vector3[][] = [];
  for (let i = 0; i <= NW; i++) {
    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= NH; j++) {
      const t = i / NW;
      const p = netA.clone().lerp(netB, t);
      p.y -= Math.sin(t * Math.PI) * 0.4 + (j / NH) * 0.9 * (1 - t * 0.6);
      p.x += (j / NH) * 0.5 * Math.cos(pa);
      p.z -= (j / NH) * 0.5 * Math.sin(pa);
      p.y = Math.max(p.y, h(c, p.x, p.z) + 0.04);
      row.push(p);
    }
    nodes.push(row);
  }
  for (let i = 0; i <= NW; i++)
    for (let j = 0; j <= NH; j++) {
      if (i < NW && !(i === 3 && j === 2)) c.parts.add(paint(stickGeo(nodes[i]![j]!, nodes[i + 1]![j]!, 0.015, 0.015, 3), '#4a6a5a'));
      if (j < NH && !(i === 4 && j === 1)) c.parts.add(paint(stickGeo(nodes[i]![j]!, nodes[i]![j + 1]!, 0.015, 0.015, 3), '#4a6a5a'));
    }
  // 浮球
  const buoy = new THREE.SphereGeometry(0.18, 8, 6);
  buoy.translate(nodes[NW]![0]!.x, nodes[NW]![0]!.y + 0.1, nodes[NW]![0]!.z);
  c.parts.add(paint(buoy, '#e86a3a'));
  // 海风吹弯的草
  for (let i = 0; i < 28; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 2 + rnd() * 5);
    tuft(c, x, z, rnd() < 0.5 ? '#9cae6a' : '#b4b878', 0.6, Math.PI * 0.75, 0.9);
  }
  // 贝壳
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R * 0.5 + rnd() * R);
    for (const g of scallopGeo(0.16 + rnd() * 0.08, '#f2d6c0', '#e0b090', rnd)) {
      place(g, x, h(c, x, z) + 0.1, z, rnd() * 6);
      c.parts.add(g);
    }
  }
}

// ———————————————— 4. 幻影石圈 ————————————————

function buildShadow(c: Ctx): void {
  const { cx, cz, rnd } = c;
  const R = c.r + 2.2;
  // 方尖石：黑紫色、略微内倾，正面嵌着发光符文（发光材质）
  const n = 8;
  const runeColors = ['#ff3a5a', '#b04aff'];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, z] = polar(c, a, R);
    const y = h(c, x, z);
    const tall = 2.4 + (i % 2) * 0.9 + rnd() * 0.5;
    const w = 0.7 + rnd() * 0.15;
    const body = new THREE.CylinderGeometry(w * 0.55, w, tall, 4, 1);
    body.rotateY(Math.PI / 4);
    body.translate(0, tall / 2, 0);
    const tip = new THREE.ConeGeometry(w * 0.55 * Math.SQRT2 * 0.72, w * 0.9, 4, 1);
    tip.rotateY(Math.PI / 4);
    tip.translate(0, tall + w * 0.45, 0);
    const lean = 0.08;
    for (const g of [body, tip]) {
      place(g, x, y - 0.25, z, a, Math.cos(a) * lean, -Math.sin(a) * lean);
      c.parts.add(paint(g, i % 2 ? '#2a2333' : '#352b40', 0.16, rnd));
    }
    // 底座碎石
    const plinth = rockGeo(w * 1.1, rnd, 1.3, 0.35, 1.3, 0, 0.2);
    place(plinth, x, y + 0.05, z, rnd() * 6);
    c.parts.add(paint(plinth, '#3a3540', 0.14, rnd));
    // 符文：朝向圆心的一面上的 3 段发光折线
    const face = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
    const col = runeColors[i % 2]!;
    for (let k = 0; k < 3; k++) {
      const rh = 0.5 + k * 0.6;
      const glyph = new THREE.BoxGeometry(0.06, 0.36, 0.03);
      const g2 = new THREE.BoxGeometry(0.26, 0.06, 0.03);
      g2.translate(0.08 * (k % 2 ? 1 : -1), 0.12, 0);
      const comb = mergeGeometries([glyph.toNonIndexed(), g2.toNonIndexed()])!;
      const radiusAt = w * (1 - (rh / tall) * 0.45) * 0.72;
      place(comb, x + face.x * radiusAt, y - 0.25 + rh, z + face.z * radiusAt, a + Math.PI, Math.cos(a) * lean, -Math.sin(a) * lean);
      c.parts.addGlow(paint(comb, col));
    }
  }
  // 扭曲树根拱门：两条粗根从地里钻出、在空中交缠（TubeGeometry）
  const arch = (a: number) => {
    const [x0, z0] = polar(c, a - 0.22, R + 1.6);
    const [x1, z1] = polar(c, a + 0.22, R + 1.6);
    for (let s = 0; s < 2; s++) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const yb = h(c, x, z);
        const lift = Math.sin(t * Math.PI) * 3.4;
        const twist = Math.sin(t * Math.PI * 3 + s * Math.PI) * 0.35;
        pts.push(new THREE.Vector3(x + Math.cos(a) * twist, yb + lift - 0.3 + s * 0.12, z - Math.sin(a) * twist));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 24, 0.28 - s * 0.06, 6, false);
      c.parts.add(paint(tube, s ? '#3b2e26' : '#4a3a2e', 0.15, rnd));
    }
    // 拱门上垂下的细根
    for (let k = 0; k < 6; k++) {
      const t = 0.25 + rnd() * 0.5;
      const [x, z] = [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
      const top = new THREE.Vector3(x, h(c, x, z) + Math.sin(t * Math.PI) * 3.4 - 0.4, z);
      const bot = top.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.3, -0.8 - rnd() * 0.9, (rnd() - 0.5) * 0.3));
      c.parts.add(paint(stickGeo(top, bot, 0.05, 0.015, 4), '#3b2e26'));
    }
  };
  arch(rnd() * Math.PI * 2);
  // 带爪痕的枯树桩（爪痕 = 发光暗红的三道细缝）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4 + rnd() * 0.3;
    const [x, z] = polar(c, a, R + 3.5 + rnd() * 1.5);
    const y = h(c, x, z);
    const stump = new THREE.CylinderGeometry(0.5, 0.7, 1.4 + rnd() * 0.6, 8, 1);
    stump.translate(x, y + 0.6, z);
    c.parts.add(paint(stump, '#4a3d33', 0.15, rnd));
    const top = new THREE.CylinderGeometry(0.46, 0.5, 0.08, 8);
    top.translate(x, y + 1.35 + rnd() * 0.1, z);
    c.parts.add(paint(top, '#8a7258'));
    const face = Math.atan2(cx - x, cz - z);
    for (let k = 0; k < 3; k++) {
      const slash = new THREE.BoxGeometry(0.05, 0.8, 0.03);
      place(slash, x + Math.sin(face) * 0.6 + Math.cos(face) * (k - 1) * 0.16, y + 0.75, z + Math.cos(face) * 0.6 - Math.sin(face) * (k - 1) * 0.16, face, 0, 0.35);
      c.parts.addGlow(paint(slash, '#a01a32'));
    }
    // 根须
    for (let k = 0; k < 4; k++) {
      const ra = rnd() * Math.PI * 2;
      const p0 = new THREE.Vector3(x, y + 0.3, z);
      const p1 = new THREE.Vector3(x + Math.sin(ra) * 1.2, 0, z + Math.cos(ra) * 1.2);
      p1.y = h(c, p1.x, p1.z) - 0.05;
      c.parts.add(paint(stickGeo(p0, p1, 0.16, 0.05, 5), '#3f342b'));
    }
  }
  // 地面法阵：两圈发光细环 + 六芒放射线（贴地）
  const ringPts = (rr: number, w: number, seg: number) => {
    const g = new THREE.RingGeometry(rr - w, rr + w, seg, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, cz);
    return drape(g, c.ground, 0.07);
  };
  const sigilMat = new THREE.MeshBasicMaterial({ color: '#c02a5a', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
  const sigilParts = [ringPts(c.r * 0.95, 0.06, 64), ringPts(c.r * 0.62, 0.05, 48)];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const line = new THREE.PlaneGeometry(0.1, c.r * 0.95 * 2 * Math.sin(Math.PI / 3), 1, 8);
    line.rotateX(-Math.PI / 2);
    line.rotateY(a);
    const mid = c.r * 0.95 * Math.cos(Math.PI / 3);
    line.translate(cx + Math.sin(a + Math.PI / 2) * mid, 0, cz + Math.cos(a + Math.PI / 2) * mid);
    sigilParts.push(drape(line, c.ground, 0.075));
  }
  const sigilGeo = mergeGeometries(sigilParts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const nm of Object.keys(g.attributes)) if (nm !== 'position') g.deleteAttribute(nm);
    return g;
  }))!;
  const sigil = new THREE.Mesh(sigilGeo, sigilMat);
  sigil.userData.keepMaterial = true;
  sigil.renderOrder = 3;
  c.group.add(sigil);
  c.disposables.push(sigilGeo, sigilMat);
  // 红黑落叶
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * (R + 4);
    const [x, z] = polar(c, a, d);
    const leaf = new THREE.CircleGeometry(0.12 + rnd() * 0.08, 5);
    leaf.scale(1, 0.55, 1);
    place(leaf, x, h(c, x, z) + 0.05, z, rnd() * 6, -Math.PI / 2 + (rnd() - 0.5) * 0.4, 0);
    c.parts.add(paint(leaf, ['#8a1f2a', '#5a1a22', '#2a1a20', '#a8323a'][Math.floor(rnd() * 4)]!));
  }
  // 幻影光点：漂浮的发光球（悬停摆动）+ 雾环
  const orbMat = new THREE.MeshBasicMaterial({ color: '#d070ff', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const orbG = new THREE.IcosahedronGeometry(0.14, 1);
  c.disposables.push(orbMat, orbG);
  const orbs: { m: THREE.Mesh; a: number; d: number; y: number; s: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(orbG, orbMat);
    m.userData.keepMaterial = true;
    const o = { m, a: rnd() * Math.PI * 2, d: c.r * 0.6 + rnd() * (R - c.r * 0.4), y: 1 + rnd() * 2.2, s: 0.2 + rnd() * 0.35 };
    orbs.push(o);
    c.group.add(m);
  }
  c.fx.push({
    obj: sigil,
    tick: (t) => {
      sigilMat.opacity = 0.45 + Math.sin(t * 1.6) * 0.25;
      for (const o of orbs) {
        const a = o.a + t * o.s;
        const x = cx + Math.sin(a) * o.d;
        const z = cz + Math.cos(a) * o.d;
        o.m.position.set(x, h(c, x, z) + o.y + Math.sin(t * 1.3 + o.a * 3) * 0.35, z);
        const k = 0.7 + Math.sin(t * 3 + o.a * 5) * 0.3;
        o.m.scale.setScalar(k);
      }
    },
  });
}

// ———————————————— 5. 石冢 ————————————————

function buildRockCairn(c: Ctx): void {
  const { cx, cz, rnd } = c;
  const R = c.r + 1.8;
  // 叠石塔：5 座，每座 3–6 块逐渐变小、略错位的扁石
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.3;
    const [x, z] = polar(c, a, R + rnd() * 0.8);
    let y = h(c, x, z) - 0.05;
    const n = 3 + Math.floor(rnd() * 4);
    let r = 0.75 + rnd() * 0.2;
    for (let k = 0; k < n; k++) {
      const g = rockGeo(r, rnd, 1.25, 0.45, 1.1, 0, 0.18);
      const hh = r * 0.45;
      place(g, x + (rnd() - 0.5) * 0.12, y + hh * 0.9, z + (rnd() - 0.5) * 0.12, rnd() * 6);
      c.parts.add(paint(g, ['#9a9286', '#8a8478', '#a59f92', '#7f796e'][k % 4]!, 0.14, rnd));
      y += hh * 1.7;
      r *= 0.8;
    }
  }
  // 巨石堆：外圈 3 组大圆石（小拳石滚来滚去撞出来的）
  for (let gI = 0; gI < 3; gI++) {
    const a = (gI / 3) * Math.PI * 2 + 0.5 + rnd() * 0.4;
    const [x, z] = polar(c, a, R + 3.2);
    for (let k = 0; k < 4; k++) {
      const r = (k === 0 ? 1.5 : 0.7 + rnd() * 0.5) * (1 + rnd() * 0.2);
      const ox = (rnd() - 0.5) * 2.4;
      const oz = (rnd() - 0.5) * 2.4;
      const g = rockGeo(r, rnd, 1.1, 0.85, 1.05, 1, 0.24);
      place(g, x + ox, h(c, x + ox, z + oz) + r * 0.45, z + oz, rnd() * 6);
      c.parts.add(paint(g, k % 2 ? '#8a8172' : '#9d9483', 0.16, rnd));
    }
  }
  // 矿石晶簇：琥珀 / 青色八面体（发光芯 + 实体外壳）
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R * 0.7 + rnd() * (R * 0.7));
    const y = h(c, x, z);
    const col = i % 3 === 0 ? '#5ad0e8' : '#f2a83a';
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const s = 0.2 + rnd() * 0.25;
      const g = new THREE.OctahedronGeometry(s, 0);
      g.scale(0.55, 1.6, 0.55);
      place(g, x + (rnd() - 0.5) * 0.4, y + s * 0.9, z + (rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.8);
      if (k === 0) c.parts.addGlow(paint(g, col));
      else c.parts.add(paint(g, col, 0.2, rnd));
    }
    const base = rockGeo(0.4, rnd, 1.3, 0.4, 1.2);
    place(base, x, y + 0.05, z, rnd() * 6);
    c.parts.add(paint(base, '#6f695f', 0.15, rnd));
  }
  // 地裂缝：中心向外放射的深色折线带（贴地）
  for (let i = 0; i < 6; i++) {
    let a = rnd() * Math.PI * 2;
    let d = 0.8;
    let [x, z] = polar(c, a, d);
    for (let k = 0; k < 5; k++) {
      const na = a + (rnd() - 0.5) * 0.5;
      const nd = d + 0.9 + rnd() * 0.6;
      const [x2, z2] = polar(c, na, nd);
      const len = Math.hypot(x2 - x, z2 - z);
      const crack = new THREE.PlaneGeometry(0.16 - k * 0.02, len, 1, 2);
      crack.rotateX(-Math.PI / 2);
      crack.rotateY(Math.atan2(x2 - x, z2 - z));
      crack.translate((x + x2) / 2, 0, (z + z2) / 2);
      c.parts.add(paint(drape(crack, c.ground, 0.05), '#2c2620'));
      a = na;
      d = nd;
      x = x2;
      z = z2;
    }
  }
  // 中心：被反复撞击的浅坑（深色圆盘 + 边缘一圈碎石）
  const pit = drape(discGeo(cx, cz, 1.6, 16, rnd, 0.25), c.ground, 0.04);
  c.parts.add(paint(pit, '#6b5f4e', 0.12, rnd));
  scatterRocks(c, 26, 0.12, 0.32, 1.4, R + 5, ['#8a8478', '#9a9286', '#6f695f'], 0.2);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 1 + rnd() * 4);
    tuft(c, x, z, '#8a9a58', 0.15, rnd() * 6, 0.8);
  }
}

// ———————————————— 6. 泥滩 ————————————————

function buildMudflat(c: Ctx): void {
  const { cx, cz, rnd } = c;
  const R = c.r;
  // 湿泥坑：两层（外圈浅褐、内圈深湿泥，带水光）
  const outer = drape(discGeo(cx, cz, R + 2.2, 32, rnd, 0.18), c.ground, 0.04);
  c.parts.add(paint(outer, '#7a6248', 0.12, rnd));
  const inner = drape(discGeo(cx, cz, R * 0.9, 28, rnd, 0.2), c.ground, 0.06);
  c.parts.add(paint(inner, '#4f3d2c', 0.1, rnd));
  const sheenMat = new THREE.MeshBasicMaterial({ color: '#9fc4d0', transparent: true, opacity: 0.22, depthWrite: false });
  const sheenG = drape(discGeo(cx + 0.6, cz - 0.4, R * 0.5, 18, rnd, 0.35), c.ground, 0.075);
  const sheen = new THREE.Mesh(sheenG, sheenMat);
  sheen.userData.keepMaterial = true;
  c.group.add(sheen);
  c.disposables.push(sheenMat, sheenG);
  // 巨型扇贝 / 蛤壳：外圈 7 个，竖插 / 半埋
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.3;
    const [x, z] = polar(c, a, R + 2.4 + rnd() * 0.8);
    const y = h(c, x, z);
    const s = 0.8 + rnd() * 0.5;
    const stand = i % 2 === 0;
    for (const g of scallopGeo(s, ['#f2d6c0', '#e8b8a0', '#f4e4d0'][i % 3]!, '#c98a6a', rnd)) {
      if (stand) place(g, x, y + 0.1, z, a + Math.PI, -1.2, 0);
      else place(g, x, y + 0.12, z, rnd() * 6, 0, 0);
      c.parts.add(g);
    }
  }
  // 蛤壳（两片半球壳，张开）
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 1 + rnd());
    const y = h(c, x, z);
    for (const s of [0, 1]) {
      const g = new THREE.SphereGeometry(0.55, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, 0.4, 0.8);
      place(g, x, y + 0.05, z, a, s ? -2.2 : 0, 0);
      c.parts.add(paint(g, s ? '#8a8fa8' : '#a8adc2', 0.12, rnd));
    }
  }
  // 蟹壳碎片：红色弧形甲壳 + 一只断钳
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R * 0.6 + rnd() * R);
    const g = new THREE.SphereGeometry(0.35 + rnd() * 0.15, 7, 4, rnd() * 6, 1.8, 0, 1.2);
    g.scale(1, 0.5, 1);
    place(g, x, h(c, x, z) + 0.1, z, rnd() * 6, (rnd() - 0.5) * 0.6, 0);
    c.parts.add(paint(g, i % 2 ? '#d0503a' : '#e8784a', 0.12, rnd));
  }
  {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 1.2);
    const y = h(c, x, z) + 0.25;
    const claw = new THREE.SphereGeometry(0.5, 8, 6);
    claw.scale(1.3, 0.6, 0.8);
    place(claw, x, y, z, a);
    c.parts.add(paint(claw, '#d0503a', 0.1, rnd));
    for (const s of [-1, 1]) {
      const pin = new THREE.ConeGeometry(0.16, 0.8, 5);
      pin.rotateZ(-Math.PI / 2);
      pin.translate(0.95, s * 0.1, 0);
      pin.rotateZ(s * 0.18);
      place(pin, x, y, z, a);
      c.parts.add(paint(pin, s > 0 ? '#e8d8c0' : '#d0503a'));
    }
  }
  // 芦苇丛：细长茎 + 褐色穗
  for (let gI = 0; gI < 7; gI++) {
    const a = rnd() * Math.PI * 2;
    const [x0, z0] = polar(c, a, R + 3.5 + rnd() * 2.5);
    for (let k = 0; k < 9; k++) {
      const x = x0 + (rnd() - 0.5) * 1.4;
      const z = z0 + (rnd() - 0.5) * 1.4;
      const y = h(c, x, z);
      const tall = 1.4 + rnd() * 1;
      const lean = new THREE.Vector3((rnd() - 0.5) * 0.4, 1, (rnd() - 0.5) * 0.4).normalize();
      const p0 = new THREE.Vector3(x, y - 0.1, z);
      const p1 = p0.clone().addScaledVector(lean, tall);
      c.parts.add(paint(stickGeo(p0, p1, 0.035, 0.02, 3), '#8aa25a', 0.15, rnd));
      if (k % 2 === 0) {
        const head = new THREE.CylinderGeometry(0.06, 0.05, 0.35, 5);
        head.translate(0, 0.17, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lean);
        head.applyQuaternion(q);
        head.translate(p1.x, p1.y, p1.z);
        c.parts.add(paint(head, '#7a5a3a'));
      } else {
        const leaf = new THREE.PlaneGeometry(0.06, 0.9);
        leaf.translate(0, 0.45, 0);
        place(leaf, x, y + 0.2, z, rnd() * 6, 0.5, 0);
        c.parts.add(paint(leaf, '#9ab868'));
      }
    }
  }
  // 漂流木
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, R + 2 + rnd() * 2);
    const yaw = rnd() * Math.PI;
    const len = 2.2 + rnd() * 1.5;
    const p0 = new THREE.Vector3(x - Math.sin(yaw) * len / 2, 0, z - Math.cos(yaw) * len / 2);
    const p1 = new THREE.Vector3(x + Math.sin(yaw) * len / 2, 0, z + Math.cos(yaw) * len / 2);
    p0.y = h(c, p0.x, p0.z) + 0.15;
    p1.y = h(c, p1.x, p1.z) + 0.2;
    c.parts.add(paint(stickGeo(p0, p1, 0.2, 0.14, 7), '#b0a492', 0.12, rnd));
    const twig = p0.clone().lerp(p1, 0.7);
    c.parts.add(paint(stickGeo(twig, twig.clone().add(new THREE.Vector3(0.3, 0.6, 0.2)), 0.06, 0.03, 4), '#a59a8a'));
  }
  // 钳痕：泥上成对的 V 形拖痕
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, rnd() * R * 0.85);
    const yaw = rnd() * Math.PI * 2;
    for (const s of [-1, 1]) {
      const mark = new THREE.PlaneGeometry(0.1, 0.7, 1, 2);
      mark.rotateX(-Math.PI / 2);
      mark.rotateY(yaw + s * 0.35);
      mark.translate(x + Math.sin(yaw + Math.PI / 2) * s * 0.12, 0, z + Math.cos(yaw + Math.PI / 2) * s * 0.12);
      c.parts.add(paint(drape(mark, c.ground, 0.08), '#33281e'));
    }
  }
  // 冒泡：泥里不断升起、变大、破掉的气泡
  const bubMat = new THREE.MeshBasicMaterial({ color: '#e6f2f6', transparent: true, opacity: 0.55, depthWrite: false });
  const bubG = new THREE.SphereGeometry(0.1, 8, 6);
  c.disposables.push(bubMat, bubG);
  const bubbles: { m: THREE.Mesh; x: number; z: number; ph: number; sp: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const [x, z] = polar(c, a, rnd() * R * 0.8);
    const m = new THREE.Mesh(bubG, bubMat);
    m.userData.keepMaterial = true;
    c.group.add(m);
    bubbles.push({ m, x, z, ph: rnd(), sp: 0.4 + rnd() * 0.5 });
  }
  c.fx.push({
    obj: sheen,
    tick: (t) => {
      sheenMat.opacity = 0.18 + Math.sin(t * 0.8) * 0.06;
      for (const b of bubbles) {
        const k = (t * b.sp + b.ph) % 1;
        const y = h(c, b.x, b.z) + 0.06;
        b.m.position.set(b.x, y + k * 0.18, b.z);
        b.m.scale.set(0.4 + k * 1.4, (0.4 + k * 1.4) * 0.7, 0.4 + k * 1.4);
        b.m.visible = k < 0.92;
      }
    },
  });
}

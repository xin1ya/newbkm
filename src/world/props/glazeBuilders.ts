/**
 * M3-04 · 琉璃群岛野外构件（与 builders / townBuilders / tideBuilders / thunderBuilders 同约定：局部坐标，y = 0 为地面，
 * 正面朝 +Z；solid = Toon 场景材质，glow = 夜间 / 自发光部件）。
 *
 * - 海蚀石林：喀斯特石笋（层层收分的灰白石灰岩尖塔，竖向溶沟 + 顶部苔草）
 * - 幽灵沼泽：枯树（扭曲枝干，无叶；bleached = 沙丘里被晒白的枯木）、墓碑（平板 / 圆顶 / 十字）、鬼火（悬浮的冷色火团）
 * - 玻璃海岸：玻璃晶簇（一簇倾斜的六棱晶柱，晶尖微光）
 * - 幻影镇（M3-11）：白灰泥穹顶屋、宣礼塔式蜃楼塔、马蹄拱门、预言石柱、月影塔、超能系道馆「幻月」
 */
import * as THREE from 'three';
import { box, cyl, paint, type PropParts } from './builders';
import { beam, boxAt, doorAt, evenly, rng, shade, sphere, V, windowAt, windowCount } from './townBuilders';

const newParts = (): PropParts => ({ solid: [], glow: [] });

/** 喀斯特石笋：3–5 段逐级收分的扭曲棱柱，段间错位；竖向溶沟（深色细条）；顶部一撮苔草 */
export function karstPinnacle(w: number, h: number, seed = 1, color = '#b9b4ab'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const segs = 3 + Math.floor(r() * 3);
  let y = 0;
  let rad = w / 2;
  let ox = 0;
  let oz = 0;
  for (let s = 0; s < segs; s++) {
    const sh = (h / segs) * (0.8 + r() * 0.4);
    const top = rad * (0.62 + r() * 0.16);
    const sides = 5 + Math.floor(r() * 3);
    const g = new THREE.CylinderGeometry(top, rad, sh, sides, 2);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const k = 0.85 + r() * 0.3;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
    }
    p.solid.push(paint(g.rotateY(r() * 6.28).translate(ox, y + sh / 2, oz), s % 2 ? color : shade(color, -0.06)));
    // 溶沟：沿柱身的深色细条
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2;
      const rr = (rad + top) / 2;
      p.solid.push(boxAt(0.12, sh * 0.85, 0.12, shade(color, -0.25), ox + Math.cos(a) * rr * 0.98, y + sh / 2, oz + Math.sin(a) * rr * 0.98, -a));
    }
    y += sh * 0.96;
    rad = top;
    ox += (r() - 0.5) * rad * 0.35;
    oz += (r() - 0.5) * rad * 0.35;
  }
  // 顶部苔草
  for (let k = 0; k < 3; k++) p.solid.push(sphere(rad * (0.5 + r() * 0.3), k % 2 ? '#6f8f4f' : '#5f7d45', ox + (r() - 0.5) * rad, y + rad * 0.2, oz + (r() - 0.5) * rad, 1, 0.45, 1, 0));
  // 柱脚碎石
  for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2;
    p.solid.push(sphere(w * (0.1 + r() * 0.08), shade(color, -0.1), Math.cos(a) * w * 0.6, 0.1, Math.sin(a) * w * 0.6, 1, 0.6, 1, 0));
  }
  return p;
}

/** 枯树：弯曲主干 + 2–4 根分叉枝（每根再分一次），根部外露；bleached = 晒白的沙丘枯木 */
export function deadTree(h: number, seed = 1, variant = 'marsh'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const bark = variant === 'bleached' ? '#cfc4ae' : r() > 0.5 ? '#4a4038' : '#3d3631';
  const lean = r() * Math.PI * 2;
  let prev = V(0, 0, 0);
  const trunk: THREE.Vector3[] = [prev];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    const cur = V(Math.sin(lean) * t * h * 0.12 + (r() - 0.5) * 0.3, t * h * 0.7, Math.cos(lean) * t * h * 0.12 + (r() - 0.5) * 0.3);
    p.solid.push(beam(prev, cur, 0.28 * (1 - t * 0.55), bark, 6));
    trunk.push(cur);
    prev = cur;
  }
  const nb = 2 + Math.floor(r() * 3);
  for (let b = 0; b < nb; b++) {
    const from = trunk[2 + Math.floor(r() * 3)]!;
    const a = r() * Math.PI * 2;
    const len = h * (0.25 + r() * 0.2);
    const tip = V(from.x + Math.cos(a) * len, from.y + len * (0.4 + r() * 0.5), from.z + Math.sin(a) * len);
    p.solid.push(beam(from, tip, 0.1, bark, 5));
    for (let s = 0; s < 2; s++) {
      const a2 = a + (s ? 0.7 : -0.7);
      const l2 = len * 0.45;
      p.solid.push(beam(tip, V(tip.x + Math.cos(a2) * l2, tip.y + l2 * 0.5, tip.z + Math.sin(a2) * l2), 0.05, bark, 4));
    }
  }
  // 外露树根
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r();
    p.solid.push(beam(V(0, 0.4, 0), V(Math.cos(a) * 1.1, -0.1, Math.sin(a) * 1.1), 0.12, bark, 4));
  }
  // 沼泽枯树挂着灰绿色的松萝
  if (variant !== 'bleached')
    for (let k = 0; k < 3; k++) {
      const at = trunk[2 + (k % 3)]!;
      p.solid.push(boxAt(0.5, 1.1 + r() * 0.6, 0.06, '#7d8b6a', at.x + (r() - 0.5) * 0.6, at.y - 0.6, at.z + (r() - 0.5) * 0.6, r() * 3));
    }
  return p;
}

/** 墓碑：slab 平板 / round 圆顶 / cross 十字；底座 + 苔斑，略微倾斜 */
export function tombstone(w: number, h: number, variant = 'slab', seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const stone = r() > 0.5 ? '#8e8a90' : '#7c7882';
  const tilt = (r() - 0.5) * 0.18;
  p.solid.push(boxAt(w * 1.25, 0.25, 0.7, shade(stone, -0.15), 0, 0.12, 0));
  if (variant === 'cross') {
    p.solid.push(boxAt(0.28, h, 0.24, stone, 0, h / 2 + 0.25, 0, 0, tilt));
    p.solid.push(boxAt(w * 0.8, 0.24, 0.24, stone, 0, h * 0.72 + 0.25, 0, 0, tilt));
  } else {
    const bodyH = variant === 'round' ? h - w / 2 : h;
    p.solid.push(boxAt(w, bodyH, 0.26, stone, 0, bodyH / 2 + 0.25, 0, 0, tilt));
    if (variant === 'round') {
      const g = new THREE.CylinderGeometry(w / 2, w / 2, 0.26, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
      p.solid.push(paint(g.translate(0, bodyH + 0.25, 0), stone));
    }
    // 碑文刻痕
    for (let k = 0; k < 3; k++) p.solid.push(boxAt(w * 0.55, 0.05, 0.02, shade(stone, -0.35), 0, bodyH * (0.45 + k * 0.14) + 0.25, 0.14));
  }
  for (let k = 0; k < 2; k++) p.solid.push(sphere(0.14 + r() * 0.08, '#5f7348', (r() - 0.5) * w, 0.3 + r() * 0.3, 0.15, 1, 0.5, 0.4, 0));
  return p;
}

/** 玻璃晶簇：5–9 根六棱晶柱从一点向外倾斜，晶尖为锥；中心一根最高，晶尖发出微光 */
export function glassCrystal(w: number, h: number, seed = 1, color = '#8fdcdc'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const n = 5 + Math.floor(r() * 5);
  for (let k = 0; k < n; k++) {
    const main = k === 0;
    const len = main ? h : h * (0.35 + r() * 0.45);
    const rad = main ? w * 0.18 : w * (0.08 + r() * 0.07);
    const tiltA = r() * Math.PI * 2;
    const tilt = main ? r() * 0.12 : 0.3 + r() * 0.5;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.sin(tiltA) * tilt, 0, Math.cos(tiltA) * tilt, 'XYZ'));
    const c = k % 3 === 0 ? color : shade(color, k % 3 === 1 ? 0.12 : -0.1);
    const body = new THREE.CylinderGeometry(rad, rad * 1.05, len * 0.8, 6).translate(0, len * 0.4, 0).applyMatrix4(m);
    const tip = new THREE.ConeGeometry(rad, len * 0.2, 6).translate(0, len * 0.9, 0).applyMatrix4(m);
    p.solid.push(paint(body, c));
    p.solid.push(paint(tip, shade(c, 0.18)));
    if (main || r() > 0.6) {
      const tipPos = new THREE.Vector3(0, len, 0).applyMatrix4(m);
      p.glow.push(sphere(rad * 0.45, '#dffcff', tipPos.x, tipPos.y - rad * 0.3, tipPos.z, 1, 1, 1, 0));
    }
  }
  // 底座：玻璃沙堆
  p.solid.push(sphere(w * 0.45, '#cfeee8', 0, 0, 0, 1, 0.3, 1, 1));
  return p;
}

/** 鬼火：悬浮的冷色火团（内核 + 外焰 + 两颗小火星），只有发光部件，没有碰撞 */
export function wisp(h: number, color = '#8fe8ff', seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  p.glow.push(sphere(0.22, '#ffffff', 0, h, 0, 1, 1.2, 1, 1));
  p.glow.push(sphere(0.38, color, 0, h + 0.08, 0, 1, 1.5, 1, 1));
  p.glow.push(paint(new THREE.ConeGeometry(0.26, 0.6, 6).translate(0, h + 0.55, 0), color));
  for (let k = 0; k < 2; k++) p.glow.push(sphere(0.07, color, (r() - 0.5) * 1.2, h + (r() - 0.5) * 0.8, (r() - 0.5) * 1.2, 1, 1, 1, 0));
  return p;
}

// ———————————————————————— M3-11 幻影镇 ————————————————————————

const GLASS = '#7fd6d8';
const MOON = '#e8e2ff';
const PSY = '#c86ad8';

/** 马蹄拱（半圆拱 + 两侧略内收的拱脚）：面朝 +Z，开口宽 w，拱脚高 h，厚 t */
function horseshoe(p: PropParts, w: number, h: number, t: number, color: string, x = 0, y = 0, z = 0, ry = 0): void {
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  const r = w / 2;
  const seg = 9;
  for (let k = 0; k <= seg; k++) {
    // 拱圈从 -20° 到 200°（马蹄形：比半圆多出两截向内收的拱脚）
    const a0 = (-20 + (k / (seg + 1)) * 220) * (Math.PI / 180);
    const a1 = (-20 + ((k + 1) / (seg + 1)) * 220) * (Math.PI / 180);
    const am = (a0 + a1) / 2;
    const len = r * (a1 - a0) + 0.05;
    p.solid.push(paint(new THREE.BoxGeometry(len, 0.45, t).rotateZ(am + Math.PI / 2).translate(Math.cos(am) * r, h + Math.sin(am) * r, 0), color, m));
  }
  // 两侧拱墩
  for (const s of [-1, 1]) p.solid.push(paint(new THREE.BoxGeometry(0.5, h - 0.2, t).translate(s * (r + 0.05), (h - 0.2) / 2, 0), color, m));
}

/** 新月尖饰（穹顶 / 塔尖顶端）：细杆 + 三颗金球 + 新月 */
function crescent(p: PropParts, x: number, y: number, z: number, s = 1): void {
  p.solid.push(cyl(0.04 * s, 0.05 * s, 0.9 * s, 5, '#c9a86a', x, y, z));
  for (let k = 0; k < 3; k++) p.solid.push(sphere((0.13 - k * 0.025) * s, '#d8b46a', x, y + (0.25 + k * 0.22) * s, z, 1, 1, 1, 0));
  const g = new THREE.TorusGeometry(0.28 * s, 0.06 * s, 5, 12, Math.PI * 1.3).rotateZ(-Math.PI * 0.15).translate(x, y + 1.15 * s, z);
  p.solid.push(paint(g, '#e8c870'));
}

/**
 * 幻影镇民居：白灰泥立方体 + 女儿墙平顶、马蹄拱门（彩色门扇 + 门楣瓷砖带）、拱形窗配青色百叶，
 * 屋顶二选一：青玻璃穹顶（鼓座 + 新月尖饰）或屋顶露台（遮阳棚 + 盆栽），侧面外挂楼梯，墙脚一圈陶罐。
 */
export function mirageHouse(w: number, h: number, d: number, wall: string, dome: string, seed = 1, accent = '#3f7a8a'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const plinth = shade(wall, -0.18);
  p.solid.push(box(w + 0.5, 0.4, d + 0.5, plinth));
  const wallH = h * (0.62 + r() * 0.08);
  // 墙体：微微不平整的灰泥（两层错位）
  p.solid.push(box(w, wallH, d, wall, 0, 0.4, 0));
  p.solid.push(box(w + 0.08, 0.35, d + 0.08, shade(wall, -0.05), 0, 0.4 + wallH * 0.48, 0));
  // 门楣瓷砖带（青 / 白相间的小方块）
  for (const u of evenly(w, Math.round(w / 0.6))) p.solid.push(box(0.5, 0.28, 0.06, Math.round(u / 0.6) % 2 ? accent : '#f4f0e6', u, 0.4 + wallH - 0.6, d / 2 + 0.03));
  // 女儿墙 + 齿状墙头
  const top = 0.4 + wallH;
  for (const [ww, dd, x, z] of [[w, 0.3, 0, d / 2 - 0.15], [w, 0.3, 0, -d / 2 + 0.15], [0.3, d, w / 2 - 0.15, 0], [0.3, d, -w / 2 + 0.15, 0]] as const) p.solid.push(box(ww, 0.6, dd, wall, x, top, z));
  for (const u of evenly(w, Math.round(w / 1.1))) p.solid.push(box(0.4, 0.3, 0.32, wall, u, top + 0.6, d / 2 - 0.15));
  // 马蹄拱门：门扇 + 拱圈 + 两侧小灯
  doorAt(p, w, d, 0, { width: 1.3, height: 2.1, y: 0.4, frame: accent, color: r() > 0.5 ? '#3f6a9a' : '#9a4a3a', canopy: null });
  horseshoe(p, 1.7, 2.2, 0.3, shade(wall, -0.1), 0, 0.4, d / 2 + 0.12);
  for (const s of [-1, 1]) p.glow.push(sphere(0.14, '#ffd59a', s * 1.25, 0.4 + 2.1, d / 2 + 0.25, 1, 1.3, 1, 0));
  // 拱形窗 + 青色百叶
  for (const u of evenly(w, windowCount(w, 2.8), true)) {
    windowAt(p, 'front', w, d, u, 0.4 + 1.1, { frame: '#f4f0e6', warm: true, size: [0.8, 1.1], shutters: accent });
    p.solid.push(paint(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(u, 0.4 + 2.2, d / 2 + 0.06), '#f4f0e6'));
  }
  for (const face of ['left', 'right'] as const) for (const u of evenly(d, windowCount(d, 3.2))) windowAt(p, face, w, d, u, 0.4 + 1.1, { frame: '#f4f0e6', warm: true, size: [0.7, 1.0], shutters: accent });
  if (r() > 0.42) {
    // 穹顶：八角鼓座 + 青玻璃半球（压扁）+ 新月
    const dr = Math.min(w, d) * 0.3;
    p.solid.push(paint(new THREE.CylinderGeometry(dr * 1.02, dr * 1.08, 0.9, 8).translate(0, top + 0.45, 0), wall));
    p.solid.push(paint(new THREE.SphereGeometry(dr, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(0, top + 0.9, 0), dome));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.solid.push(boxAt(0.06, dr * 0.95, 0.06, shade(dome, -0.2), Math.sin(a) * dr * 0.72, top + 0.9 + dr * 0.42, Math.cos(a) * dr * 0.72, a, -0.75));
    }
    crescent(p, 0, top + 0.9 + dr * 1.15, 0, 0.9);
  } else {
    // 屋顶露台：遮阳棚 + 盆栽 + 晾着的地毯
    const ax = (r() - 0.5) * w * 0.3;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(cyl(0.06, 0.06, 2.0, 5, '#7a5a38', ax + sx * 1.3, top, sz * 1.0));
    p.solid.push(boxAt(3.0, 0.08, 2.4, r() > 0.5 ? '#d86a4a' : accent, ax, top + 2.05, 0, 0, 0.08));
    for (let k = 0; k < 3; k++) {
      const px = -w / 2 + 0.8 + r() * (w - 1.6);
      p.solid.push(cyl(0.22, 0.16, 0.4, 7, '#b8643a', px, top, d / 2 - 0.7));
      p.solid.push(sphere(0.32, '#5f8f4f', px, top + 0.6, d / 2 - 0.7, 1, 0.8, 1, 0));
    }
    p.solid.push(boxAt(1.4, 1.0, 0.04, r() > 0.5 ? '#9a3a4a' : '#3a5a9a', w / 2 - 0.9, top + 0.3, -d / 2 + 0.2));
  }
  // 外挂楼梯（右侧，上到屋顶）
  const steps = Math.max(5, Math.round(wallH / 0.42));
  for (let k = 0; k < steps; k++) p.solid.push(box(0.9, 0.18, 0.7, shade(wall, -0.08), w / 2 + 0.45, 0.4 + (k + 1) * (wallH / steps) - 0.18, d / 2 - 0.6 - k * (d - 1.2) / steps));
  // 墙脚陶罐
  for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
    const px = (r() > 0.5 ? 1 : -1) * (1.6 + r() * (w / 2 - 2));
    p.solid.push(sphere(0.28, '#c8784a', px, 0.68, d / 2 + 0.5, 1, 1.2, 1, 1));
    p.solid.push(cyl(0.12, 0.16, 0.15, 6, '#a8603a', px, 0.98, d / 2 + 0.5));
  }
  return p;
}

/** 蜃楼塔（宣礼塔式细高塔）：方形底座 → 八角塔身（两道阳台）→ 灯笼亭 → 尖顶 + 新月；阳台窗夜里发光 */
export function minaret(h: number, color = '#f4ecd8', accent = GLASS): PropParts {
  const p = newParts();
  const bw = Math.max(2.4, h * 0.11);
  p.solid.push(box(bw, h * 0.22, bw, color));
  p.solid.push(box(bw + 0.3, 0.3, bw + 0.3, shade(color, -0.1), 0, h * 0.22, 0));
  const shaft = h * 0.5;
  p.solid.push(paint(new THREE.CylinderGeometry(bw * 0.36, bw * 0.42, shaft, 8).translate(0, h * 0.22 + 0.3 + shaft / 2, 0), color));
  for (const f of [0.45, 0.72]) {
    const y = h * f;
    p.solid.push(paint(new THREE.CylinderGeometry(bw * 0.62, bw * 0.4, 0.6, 8).translate(0, y, 0), shade(color, -0.06)));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.solid.push(box(0.08, 0.7, 0.08, shade(color, -0.15), Math.sin(a) * bw * 0.6, y + 0.3, Math.cos(a) * bw * 0.6));
    }
    p.glow.push(paint(new THREE.CylinderGeometry(bw * 0.37, bw * 0.37, 0.5, 8, 1, true).translate(0, y + 0.8, 0), '#ffe0a0'));
  }
  const ly = h * 0.22 + 0.3 + shaft;
  p.solid.push(paint(new THREE.CylinderGeometry(bw * 0.3, bw * 0.34, h * 0.1, 8).translate(0, ly + h * 0.05, 0), color));
  p.solid.push(paint(new THREE.ConeGeometry(bw * 0.38, h * 0.16, 8).translate(0, ly + h * 0.1 + h * 0.08, 0), accent));
  crescent(p, 0, ly + h * 0.26, 0, Math.max(1, h / 18));
  // 底座拱门
  horseshoe(p, bw * 0.45, bw * 0.55, 0.2, shade(color, -0.12), 0, 0, bw / 2 + 0.05);
  return p;
}

/** 城门：两座方墩 + 马蹄拱 + 齿状墙头 + 门额青瓷带；两侧悬挂黄铜灯 */
export function mirageGate(w: number, h: number, color = '#efe4cc', accent = '#3f7a8a'): PropParts {
  const p = newParts();
  const pier = 2.2;
  for (const s of [-1, 1]) {
    p.solid.push(box(pier, h, pier, color, s * (w / 2 + pier / 2), 0, 0));
    p.solid.push(box(pier + 0.3, 0.3, pier + 0.3, shade(color, -0.1), s * (w / 2 + pier / 2), h, 0));
    for (let k = 0; k < 2; k++) p.solid.push(box(0.5, 0.5, pier, color, s * (w / 2 + pier / 2) + (k ? 0.6 : -0.6), h + 0.3, 0));
    p.solid.push(cyl(0.03, 0.03, 0.6, 4, '#3a3a40', s * (w / 2 - 0.2), h * 0.62, pier / 2 + 0.4));
    p.glow.push(sphere(0.22, '#ffd59a', s * (w / 2 - 0.2), h * 0.62 - 0.2, pier / 2 + 0.4, 1, 1.3, 1, 1));
  }
  const archH = h * 0.62;
  horseshoe(p, w, archH - w / 2 + 0.6, pier, color, 0, 0, 0);
  // 拱上墙
  p.solid.push(box(w + 0.2, h - archH - 0.3, pier, color, 0, archH + 0.3, 0));
  for (const u of evenly(w, Math.round(w / 0.7))) p.solid.push(box(0.55, 0.4, 0.06, Math.round(u / 0.7) % 2 ? accent : '#f4f0e6', u, h - 1.1, pier / 2 + 0.03));
  for (const u of evenly(w, Math.round(w / 0.7))) p.solid.push(box(0.55, 0.4, 0.06, Math.round(u / 0.7) % 2 ? accent : '#f4f0e6', u, h - 1.1, -pier / 2 - 0.03));
  for (const u of evenly(w + pier * 2, Math.round((w + pier * 2) / 1.0))) p.solid.push(box(0.45, 0.45, pier * 0.9, color, u, h, 0));
  return p;
}

/** 预言石柱：四棱方尖碑 + 底座台阶，碑面刻着会发光的超能符文（夜里更亮）+ 顶端浮着一颗紫色水晶 */
export function prophecyObelisk(h: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  p.solid.push(box(2.4, 0.3, 2.4, '#bfb6a4'));
  p.solid.push(box(1.8, 0.3, 1.8, '#cfc6b2', 0, 0.3, 0));
  const g = new THREE.CylinderGeometry(0.45, 0.7, h, 4).rotateY(Math.PI / 4).translate(0, 0.6 + h / 2, 0);
  p.solid.push(paint(g, '#d8d0bc'));
  p.solid.push(paint(new THREE.ConeGeometry(0.5, 0.8, 4).rotateY(Math.PI / 4).translate(0, 0.6 + h + 0.4, 0), '#c9a86a'));
  for (let f = 0; f < 4; f++) {
    const a = (f / 4) * Math.PI * 2;
    for (let k = 0; k < 5; k++) {
      const y = 1.2 + k * (h * 0.15);
      const rr = 0.66 - (y / (h + 0.6)) * 0.22;
      const gw = 0.12 + r() * 0.18;
      p.glow.push(boxAt(gw, 0.12 + r() * 0.2, 0.04, PSY, Math.sin(a) * rr, y, Math.cos(a) * rr, a));
    }
  }
  p.glow.push(paint(new THREE.OctahedronGeometry(0.35).scale(1, 1.5, 1).translate(0, 0.6 + h + 1.6, 0), '#e0a8f0'));
  return p;
}

/** 月影塔（只在夜里出现的蜃楼）：细长的白塔，塔身螺旋窗带，顶部开敞亭里悬着一轮发光的满月 */
export function moonTower(w: number, h: number): PropParts {
  const p = newParts();
  p.solid.push(cyl(w * 0.62, w * 0.7, 0.6, 12, '#cfc8e0'));
  p.solid.push(paint(new THREE.CylinderGeometry(w * 0.36, w * 0.5, h * 0.78, 12).translate(0, 0.6 + h * 0.39, 0), '#ece8f8'));
  // 螺旋窗带
  for (let k = 0; k < 18; k++) {
    const a = k * 0.9;
    const y = 2 + k * (h * 0.68 / 18);
    const rr = w * 0.5 - (y / h) * w * 0.14 + 0.03;
    p.glow.push(boxAt(0.5, 0.9, 0.06, '#c8d0ff', Math.sin(a) * rr, y, Math.cos(a) * rr, a));
  }
  const ty = 0.6 + h * 0.78;
  p.solid.push(cyl(w * 0.55, w * 0.38, 0.5, 12, '#cfc8e0', 0, ty, 0));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    p.solid.push(cyl(0.12, 0.12, h * 0.14, 5, '#ece8f8', Math.sin(a) * w * 0.48, ty + 0.5, Math.cos(a) * w * 0.48));
  }
  p.solid.push(paint(new THREE.ConeGeometry(w * 0.62, h * 0.12, 12).translate(0, ty + 0.5 + h * 0.14 + h * 0.06, 0), '#6a5a9a'));
  p.glow.push(sphere(w * 0.3, MOON, 0, ty + 0.5 + h * 0.07, 0, 1, 1, 1, 2));
  return p;
}

/**
 * 超能系道馆「幻月」：圆形砂岩馆体（紫 / 金横带）+ 尖拱窗，高鼓座上的紫色洋葱顶，顶上一轮新月；
 * 馆体上空悬浮三道倾斜的金环（静态几何）环绕一颗发光的「心眼」宝珠；正门两侧是带眼纹的方尖碑。
 */
export function gymMirage(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  p.solid.push(box(w + 3, 0.6, w + 3, '#c8bca4'));
  p.solid.push(box(7, 0.3, 1.6, '#c8bca4', 0, 0, half + 2.4));
  const wallH = h * 0.46;
  p.solid.push(cyl(half * 0.86, half * 0.9, wallH, 20, '#efe4cc', 0, 0.6, 0));
  for (const [f, c] of [[0.18, '#7a4a9a'], [0.8, '#c9a86a']] as const) p.solid.push(cyl(half * 0.9 + 0.05, half * 0.9 + 0.05, 0.45, 20, c, 0, 0.6 + wallH * f, 0));
  // 尖拱窗（发光）
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    if (Math.cos(a) > 0.9) continue;
    const rr = half * 0.88 + 0.05;
    p.glow.push(boxAt(0.9, wallH * 0.42, 0.1, '#e8c8f4', Math.sin(a) * rr, 0.6 + wallH * 0.32, Math.cos(a) * rr, a));
    p.glow.push(paint(new THREE.ConeGeometry(0.48, 0.8, 4).rotateY(Math.PI / 4).scale(1, 1, 0.2).rotateY(a).translate(Math.sin(a) * rr, 0.6 + wallH * 0.53 + 0.4, Math.cos(a) * rr), '#e8c8f4'));
  }
  // 女儿墙
  p.solid.push(cyl(half * 0.92, half * 0.92, 0.7, 20, '#e4d8c0', 0, 0.6 + wallH, 0));
  // 鼓座 + 洋葱顶
  const dy = 0.6 + wallH + 0.7;
  const dr = half * 0.55;
  p.solid.push(cyl(dr * 0.9, dr * 0.95, h * 0.12, 16, '#efe4cc', 0, dy, 0));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.glow.push(boxAt(0.5, h * 0.07, 0.08, '#e8c8f4', Math.sin(a) * dr * 0.93, dy + h * 0.06, Math.cos(a) * dr * 0.93, a));
  }
  const oy = dy + h * 0.12;
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    // 洋葱轮廓：底部外鼓、上部收尖
    const rr = dr * (Math.sin(Math.PI * Math.min(1, t * 1.25)) * 1.15 * (1 - t * 0.55) + (t < 0.1 ? 0.85 * (1 - t * 10) : 0));
    pts.push(new THREE.Vector2(Math.max(0.02, rr), t * h * 0.42));
  }
  p.solid.push(paint(new THREE.LatheGeometry(pts, 16).translate(0, oy, 0), '#7a4a9a'));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.solid.push(beam(V(Math.sin(a) * dr * 0.86, oy + 0.3, Math.cos(a) * dr * 0.86), V(Math.sin(a) * dr * 0.3, oy + h * 0.36, Math.cos(a) * dr * 0.3), 0.08, '#c9a86a', 4));
  }
  crescent(p, 0, oy + h * 0.42, 0, 2.2);
  // 浮空金环 + 心眼宝珠（馆体前上方）
  const cy = 0.6 + wallH + 1.5;
  const cz = half * 0.95;
  for (let k = 0; k < 3; k++) {
    const g = new THREE.TorusGeometry(2.2 + k * 0.5, 0.09, 6, 28).rotateX(Math.PI / 2 + (k - 1) * 0.5).rotateZ((k - 1) * 0.35).translate(0, cy + 2.4, cz);
    p.solid.push(paint(g, k === 1 ? '#e8c870' : '#c9a86a'));
  }
  p.glow.push(sphere(0.9, PSY, 0, cy + 2.4, cz, 1, 1, 1, 2));
  p.glow.push(sphere(0.38, '#fff0ff', 0, cy + 2.4, cz + 0.62, 1, 1, 0.4, 1));
  // 正门：马蹄拱 + 发光门扇
  horseshoe(p, 4.4, 4.0, 1.4, '#c9a86a', 0, 0.6, half * 0.9 + 0.3);
  p.glow.push(box(3.6, 4.6, 0.12, '#e8c8f4', 0, 0.6, half * 0.9 + 0.08));
  p.solid.push(box(0.12, 4.6, 0.2, '#7a4a9a', 0, 0.6, half * 0.9 + 0.14));
  // 门前方尖碑（眼纹）
  for (const s of [-1, 1]) {
    const x = s * 5.2;
    const z = half + 1.4;
    p.solid.push(box(1.2, 0.4, 1.2, '#bfb6a4', x, 0.6, z));
    p.solid.push(paint(new THREE.CylinderGeometry(0.3, 0.5, 4.2, 4).rotateY(Math.PI / 4).translate(x, 1.0 + 2.1, z), '#d8d0bc'));
    p.solid.push(paint(new THREE.ConeGeometry(0.34, 0.6, 4).rotateY(Math.PI / 4).translate(x, 1.0 + 4.2 + 0.3, z), '#c9a86a'));
    p.glow.push(sphere(0.22, PSY, x, 3.6, z + 0.42, 1.4, 0.8, 0.3, 1));
  }
  return p;
}

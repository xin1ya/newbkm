/**
 * M3-04 · 琉璃群岛野外构件（与 builders / townBuilders / tideBuilders / thunderBuilders 同约定：局部坐标，y = 0 为地面，
 * 正面朝 +Z；solid = Toon 场景材质，glow = 夜间 / 自发光部件）。
 *
 * - 海蚀石林：喀斯特石笋（层层收分的灰白石灰岩尖塔，竖向溶沟 + 顶部苔草）
 * - 幽灵沼泽：枯树（扭曲枝干，无叶；bleached = 沙丘里被晒白的枯木）、墓碑（平板 / 圆顶 / 十字）、鬼火（悬浮的冷色火团）
 * - 玻璃海岸：玻璃晶簇（一簇倾斜的六棱晶柱，晶尖微光）
 * - 幽冥镇（M3-12）：石墓屋（陡四坡板岩顶 + 冷光尖窗 + 铁栅前院）、灵堂（尖山墙 + 玫瑰窗 + 小钟楼）、钟楼、幽灯、
 *   幽灵系道馆「幽魄」
 * - 幻影镇（M3-11）：白灰泥穹顶屋、宣礼塔式蜃楼塔、马蹄拱门、预言石柱、月影塔、超能系道馆「幻月」
 */
import * as THREE from 'three';
import { box, cyl, paint, type PropParts } from './builders';
import { beam, boxAt, chimney, doorAt, evenly, hip, rng, shade, sphere, V, windowAt, windowCount } from './townBuilders';

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

// ———————————————————————— M3-12 幽冥镇 ————————————————————————

const SOUL = '#8fe8d8';
const GHOST = '#a88af0';

/** 尖拱窗（冷光）：face 前 / 后墙；u 沿墙偏移 */
function lancet(p: PropParts, d: number, u: number, y: number, ww: number, wh: number, frame: string, glow = SOUL, back = false): void {
  const z = (back ? -1 : 1) * (d / 2 + 0.05);
  const ry = back ? Math.PI : 0;
  p.glow.push(boxAt(ww, wh, 0.06, glow, u, y + wh / 2, z, ry));
  p.glow.push(paint(new THREE.ConeGeometry(ww * 0.72, ww * 0.9, 4).rotateY(Math.PI / 4).scale(1, 1, 0.12).rotateY(ry).translate(u, y + wh + ww * 0.45, z), glow));
  p.solid.push(boxAt(ww + 0.24, 0.14, 0.16, frame, u, y - 0.05, z, ry));
  p.solid.push(boxAt(0.06, wh, 0.1, frame, u, y + wh / 2, z + (back ? -0.03 : 0.03), ry));
}

/**
 * 石墓屋：粗糙暗石墙（错缝石块凸出）+ 陡四坡板岩顶 + 歪烟囱，尖拱冷光窗，门上挂一盏幽灯；
 * 门前一圈矮铁栅小院（中间开口），墙角堆着两只瓦罐，墙面爬着暗紫苔。
 */
export function cryptHouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1, accent = '#5b4a78'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const wallH = h * 0.5;
  p.solid.push(box(w + 0.6, 0.5, d + 0.6, shade(wall, -0.25)));
  p.solid.push(box(w, wallH, d, wall, 0, 0.5, 0));
  // 凸出的石块
  for (let k = 0; k < Math.round(w * d * 0.18); k++) {
    const face = Math.floor(r() * 4);
    const u = (r() - 0.5) * (face < 2 ? w - 0.6 : d - 0.6);
    const y = 0.7 + r() * (wallH - 0.6);
    const bw = 0.5 + r() * 0.5;
    const c = shade(wall, (r() - 0.5) * 0.18);
    if (face === 0) p.solid.push(box(bw, 0.3, 0.08, c, u, y, d / 2 + 0.02));
    else if (face === 1) p.solid.push(box(bw, 0.3, 0.08, c, u, y, -d / 2 - 0.08));
    else p.solid.push(box(0.08, 0.3, bw, c, (face === 2 ? 1 : -1) * (w / 2 + 0.02), y, u));
  }
  // 苔痕
  for (let k = 0; k < 3; k++) p.solid.push(sphere(0.5 + r() * 0.4, '#5e5372', (r() - 0.5) * w, 0.6, d / 2 + 0.05, 1, 0.5 + r() * 0.6, 0.2, 0));
  hip(p, w, h - wallH - 0.5, d, 0.5 + wallH, roof, 0.45);
  chimney(p, w * 0.28 * (r() > 0.5 ? 1 : -1), 0.5 + wallH + (h - wallH - 0.5) * 0.35, -d * 0.18, h - wallH - 0.5 + 1.4, shade(wall, -0.1));
  doorAt(p, w, d, 0, { width: 1.2, height: 2.3, y: 0.5, frame: shade(wall, -0.3), color: '#3a2e3a', canopy: null });
  p.solid.push(paint(new THREE.ConeGeometry(0.85, 0.9, 4).rotateY(Math.PI / 4).scale(1, 1, 0.15).translate(0, 0.5 + 2.3 + 0.45, d / 2 + 0.06), shade(wall, -0.3)));
  // 门灯（铁臂 + 冷光灯罩）
  p.solid.push(boxAt(0.05, 0.05, 0.6, '#2a2a30', 0.95, 0.5 + 2.5, d / 2 + 0.3));
  p.glow.push(sphere(0.16, SOUL, 0.95, 0.5 + 2.2, d / 2 + 0.6, 1, 1.4, 1, 1));
  p.solid.push(paint(new THREE.ConeGeometry(0.22, 0.25, 6).translate(0.95, 0.5 + 2.5, d / 2 + 0.6), '#2a2a30'));
  for (const u of evenly(w, windowCount(w, 3), true)) lancet(p, d, u, 0.5 + 1.0, 0.55, 1.0, shade(wall, -0.3));
  for (const s of [-1, 1]) for (const u of evenly(d, windowCount(d, 3.4))) {
    const m = new THREE.Matrix4().makeRotationY((s * Math.PI) / 2);
    const g: PropParts = { solid: [], glow: [] };
    lancet(g, w, -u * s, 0.5 + 1.0, 0.5, 0.9, shade(wall, -0.3));
    for (const q of g.solid) p.solid.push(q.applyMatrix4(m));
    for (const q of g.glow) p.glow.push(q.applyMatrix4(m));
  }
  // 前院铁栅（中间留门）
  const yd = 2.2;
  for (let u = -w / 2; u <= w / 2 + 0.01; u += 0.35) {
    if (Math.abs(u) < 0.9) continue;
    p.solid.push(box(0.05, 0.9, 0.05, '#2a2a30', u, 0, d / 2 + yd));
    p.solid.push(paint(new THREE.ConeGeometry(0.05, 0.14, 4).translate(u, 0.97, d / 2 + yd), accent));
  }
  for (const s of [-1, 1]) {
    p.solid.push(box(w / 2 - 0.9, 0.05, 0.05, '#2a2a30', s * (w / 4 + 0.45), 0.75, d / 2 + yd));
    for (let z = 0.4; z < yd; z += 0.35) p.solid.push(box(0.05, 0.9, 0.05, '#2a2a30', s * (w / 2), 0, d / 2 + z));
  }
  for (let k = 0; k < 2; k++) p.solid.push(sphere(0.3, '#6a5a50', (k ? -1 : 1) * (w / 2 - 0.5), 0.75, d / 2 + 0.7, 1, 1.2, 1, 1));
  return p;
}

/** 灵堂：长方石堂 + 前后尖山墙（陡）+ 正面玫瑰窗与尖拱门 + 屋脊小钟亭；两侧扶壁，墙内透出紫光 */
export function ossuary(w: number, h: number, d: number, wall = '#6e6878', roof = '#2e2a3a'): PropParts {
  const p = newParts();
  const wallH = h * 0.48;
  p.solid.push(box(w + 1, 0.5, d + 1, shade(wall, -0.25)));
  p.solid.push(box(w, wallH, d, wall, 0, 0.5, 0));
  // 尖山墙屋顶（陡 60°）
  const rh = (w / 2) * 1.7;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.4, 0);
  shape.lineTo(0, rh);
  shape.lineTo(w / 2 + 0.4, 0);
  shape.lineTo(-w / 2 - 0.4, 0);
  p.solid.push(paint(new THREE.ExtrudeGeometry(shape, { depth: d + 0.8, bevelEnabled: false }).translate(0, 0.5 + wallH, -d / 2 - 0.4), roof));
  // 山墙面（墙色）
  for (const s of [-1, 1]) {
    const g = new THREE.Shape();
    g.moveTo(-w / 2, 0);
    g.lineTo(0, rh * 0.94);
    g.lineTo(w / 2, 0);
    g.lineTo(-w / 2, 0);
    p.solid.push(paint(new THREE.ExtrudeGeometry(g, { depth: 0.1, bevelEnabled: false }).translate(0, 0.5 + wallH, s * (d / 2) - (s > 0 ? 0 : 0.1)), wall));
  }
  // 扶壁
  for (const s of [-1, 1]) for (const z of evenly(d, 3, true)) p.solid.push(boxAt(0.6, wallH * 0.9, 0.8, shade(wall, -0.12), s * (w / 2 + 0.3), 0.5 + wallH * 0.45, z, 0, 0, s * 0.08));
  // 玫瑰窗
  const ry = 0.5 + wallH + rh * 0.3;
  p.glow.push(paint(new THREE.CircleGeometry(1.1, 16).translate(0, ry, d / 2 + 0.12), GHOST));
  p.solid.push(paint(new THREE.TorusGeometry(1.15, 0.12, 6, 18).translate(0, ry, d / 2 + 0.14), shade(wall, -0.3)));
  for (let k = 0; k < 8; k++) p.solid.push(boxAt(0.06, 2.1, 0.05, shade(wall, -0.3), 0, ry, d / 2 + 0.16, 0, 0, (k / 8) * Math.PI));
  // 尖拱门
  p.solid.push(boxAt(2.0, 3.0, 0.1, '#2a2230', 0, 0.5 + 1.5, d / 2 + 0.06));
  p.solid.push(paint(new THREE.ConeGeometry(1.42, 1.4, 4).rotateY(Math.PI / 4).scale(1, 1, 0.08).translate(0, 0.5 + 3.0 + 0.7, d / 2 + 0.06), '#2a2230'));
  p.glow.push(boxAt(0.1, 2.6, 0.04, GHOST, 0, 0.5 + 1.4, d / 2 + 0.12));
  for (const u of evenly(d, 3)) for (const s of [-1, 1]) {
    p.glow.push(boxAt(0.06, 1.6, 0.5, GHOST, s * (w / 2 + 0.03), 0.5 + 1.2 + 0.8, u));
  }
  // 屋脊钟亭
  const by = 0.5 + wallH + rh * 0.62;
  p.solid.push(box(1.4, 1.6, 1.4, wall, 0, by, d / 2 - 1.2));
  p.solid.push(paint(new THREE.ConeGeometry(1.1, 2.4, 4).rotateY(Math.PI / 4).translate(0, by + 1.6 + 1.2, d / 2 - 1.2), roof));
  p.solid.push(paint(new THREE.SphereGeometry(0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).translate(0, by + 1.3, d / 2 - 1.2), '#8a7a4a'));
  return p;
}

/** 钟楼：方形石塔（逐层收分）+ 开敞钟室（铜钟）+ 尖顶 + 风向鸡（乌鸦）；钟室四面透冷光 */
export function bellTower(w: number, h: number, stone = '#6e6878', roof = '#2e2a3a'): PropParts {
  const p = newParts();
  const base = h * 0.62;
  p.solid.push(box(w + 0.6, 0.5, w + 0.6, shade(stone, -0.2)));
  p.solid.push(box(w, base * 0.5, w, stone, 0, 0.5, 0));
  p.solid.push(box(w * 0.88, base * 0.5, w * 0.88, shade(stone, 0.04), 0, 0.5 + base * 0.5, 0));
  for (let k = 0; k < 3; k++) {
    const y = 0.5 + base * (0.25 + k * 0.25);
    lancet(p, w * 0.88 + (k ? 0 : w * 0.12), 0, y, 0.35, 0.8, shade(stone, -0.3));
  }
  // 钟室
  const cy = 0.5 + base;
  const cw = w * 0.88;
  p.solid.push(box(cw + 0.3, 0.3, cw + 0.3, shade(stone, -0.15), 0, cy, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(box(0.6, h * 0.16, 0.6, stone, sx * (cw / 2 - 0.3), cy + 0.3, sz * (cw / 2 - 0.3)));
  p.solid.push(box(cw + 0.3, 0.4, cw + 0.3, shade(stone, -0.15), 0, cy + 0.3 + h * 0.16, 0));
  const bellY = cy + 0.3 + h * 0.08;
  p.solid.push(paint(new THREE.CylinderGeometry(0.35, 0.8, 1.2, 12).translate(0, bellY, 0), '#8a7a4a'));
  p.glow.push(sphere(cw * 0.32, SOUL, 0, bellY - 0.2, 0, 1, 0.8, 1, 1));
  // 尖顶 + 乌鸦风向标
  const ty = cy + 0.7 + h * 0.16;
  p.solid.push(paint(new THREE.ConeGeometry(cw * 0.78, h - ty + 0.5, 4).rotateY(Math.PI / 4).translate(0, ty + (h - ty + 0.5) / 2, 0), roof));
  p.solid.push(cyl(0.04, 0.04, 1.2, 4, '#2a2a30', 0, h + 0.4, 0));
  p.solid.push(sphere(0.22, '#1e1e24', 0.05, h + 1.6, 0, 1.6, 0.8, 0.6, 1));
  p.solid.push(paint(new THREE.ConeGeometry(0.08, 0.3, 4).rotateZ(-Math.PI / 2).translate(0.45, h + 1.65, 0), '#c9a86a'));
  return p;
}

/** 幽灯：歪斜铁杆 + 吊臂，铁笼灯罩里一团冷色火焰（夜灯光源） */
export function ghostLamp(h: number, color = SOUL): PropParts {
  const p = newParts();
  p.solid.push(cyl(0.18, 0.24, 0.3, 6, '#3a3640'));
  p.solid.push(beam(V(0, 0.3, 0), V(0.12, h, 0), 0.06, '#2a2a30', 5));
  p.solid.push(beam(V(0.12, h - 0.1, 0), V(0.75, h, 0), 0.04, '#2a2a30', 4));
  p.solid.push(cyl(0.02, 0.02, 0.3, 3, '#2a2a30', 0.75, h - 0.3, 0));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    p.solid.push(boxAt(0.03, 0.5, 0.03, '#2a2a30', 0.75 + Math.cos(a) * 0.17, h - 0.6, Math.sin(a) * 0.17));
  }
  p.solid.push(paint(new THREE.ConeGeometry(0.26, 0.2, 4).rotateY(Math.PI / 4).translate(0.75, h - 0.28, 0), '#2a2a30'));
  p.glow.push(sphere(0.13, '#ffffff', 0.75, h - 0.68, 0, 1, 1.2, 1, 1));
  p.glow.push(paint(new THREE.ConeGeometry(0.12, 0.32, 6).translate(0.75, h - 0.5, 0), color));
  return p;
}

/**
 * 幽灵系道馆「幽魄」：暗石哥特馆体（八角，四角细尖塔）+ 中央高尖塔，紫色尖拱窗 + 玫瑰窗，
 * 尖塔周围浮着三团鬼火；正门为深色双扇尖拱门，门前一对石像鬼底座 + 幽灯。
 */
export function gymGhost(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  p.solid.push(box(w + 3, 0.6, w + 3, '#4e4a58'));
  p.solid.push(box(7, 0.3, 1.6, '#4e4a58', 0, 0, half + 2.4));
  const wallH = h * 0.42;
  p.solid.push(paint(new THREE.CylinderGeometry(half * 0.92, half * 0.95, wallH, 8).rotateY(Math.PI / 8).translate(0, 0.6 + wallH / 2, 0), '#5e5868'));
  p.solid.push(paint(new THREE.CylinderGeometry(half * 0.97, half * 0.97, 0.5, 8).rotateY(Math.PI / 8).translate(0, 0.6 + wallH, 0), '#4a4654'));
  // 每面两扇尖拱窗
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (Math.cos(a) > 0.9) continue;
    const rr = half * 0.88;
    for (const o of [-1.6, 1.6]) {
      const x = Math.sin(a) * rr + Math.cos(a) * o;
      const z = Math.cos(a) * rr - Math.sin(a) * o;
      p.glow.push(boxAt(0.8, wallH * 0.45, 0.1, GHOST, x, 0.6 + wallH * 0.22 + wallH * 0.225, z, a));
      p.glow.push(paint(new THREE.ConeGeometry(0.57, 0.8, 4).rotateY(Math.PI / 4).scale(1, 1, 0.15).rotateY(a).translate(x, 0.6 + wallH * 0.67 + 0.4, z), GHOST));
    }
  }
  // 八角上的小尖塔
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.sin(a) * half * 0.95;
    const z = Math.cos(a) * half * 0.95;
    p.solid.push(cyl(0.45, 0.55, 1.6, 6, '#5e5868', x, 0.6 + wallH, z));
    p.solid.push(paint(new THREE.ConeGeometry(0.55, 2.6, 6).translate(x, 0.6 + wallH + 1.6 + 1.3, z), '#2e2a3a'));
  }
  // 屋顶 + 中央塔
  const ry = 0.6 + wallH + 0.5;
  p.solid.push(paint(new THREE.ConeGeometry(half * 0.95, h * 0.18, 8).rotateY(Math.PI / 8).translate(0, ry + h * 0.09, 0), '#2e2a3a'));
  const tw = half * 0.32;
  p.solid.push(paint(new THREE.CylinderGeometry(tw * 0.9, tw, h * 0.3, 8).rotateY(Math.PI / 8).translate(0, ry + h * 0.15, 0), '#5e5868'));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    p.glow.push(boxAt(0.6, h * 0.12, 0.1, GHOST, Math.sin(a) * tw * 0.92, ry + h * 0.2, Math.cos(a) * tw * 0.92, a));
  }
  const sy = ry + h * 0.3;
  p.solid.push(paint(new THREE.ConeGeometry(tw * 1.05, h * 0.42, 8).rotateY(Math.PI / 8).translate(0, sy + h * 0.21, 0), '#2e2a3a'));
  p.solid.push(cyl(0.05, 0.05, 1.4, 4, '#2a2a30', 0, sy + h * 0.42, 0));
  p.glow.push(sphere(0.3, GHOST, 0, sy + h * 0.42 + 1.6, 0, 1, 1.3, 1, 1));
  // 鬼火
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    const x = Math.sin(a) * tw * 2.4;
    const z = Math.cos(a) * tw * 2.4;
    const y = sy + h * (0.05 + k * 0.08);
    p.glow.push(sphere(0.45, GHOST, x, y, z, 1, 1.4, 1, 1));
    p.glow.push(paint(new THREE.ConeGeometry(0.3, 0.8, 6).translate(x, y + 0.75, z), GHOST));
  }
  // 玫瑰窗 + 正门
  const fz = half * 0.92 + 0.05;
  p.glow.push(paint(new THREE.CircleGeometry(1.5, 16).translate(0, 0.6 + wallH * 0.78, fz + 0.12), GHOST));
  p.solid.push(paint(new THREE.TorusGeometry(1.55, 0.14, 6, 18).translate(0, 0.6 + wallH * 0.78, fz + 0.14), '#3a3644'));
  p.solid.push(box(5.2, 4.6, 1.2, '#4a4654', 0, 0.6, fz));
  p.solid.push(paint(new THREE.ConeGeometry(3.7, 2.2, 4).rotateY(Math.PI / 4).scale(1, 1, 0.24).translate(0, 0.6 + 4.6 + 1.1, fz + 0.2), '#4a4654'));
  p.solid.push(box(3.4, 4.0, 0.1, '#241e2a', 0, 0.6, fz + 0.62));
  p.glow.push(box(0.1, 3.8, 0.06, GHOST, 0, 0.7, fz + 0.68));
  for (const s of [-1, 1]) {
    const x = s * 5.2;
    const z = half + 1.4;
    p.solid.push(box(1.3, 1.3, 1.3, '#5e5868', x, 0.6, z));
    // 石像鬼：蹲坐身体 + 头 + 翅
    p.solid.push(sphere(0.55, '#6e6878', x, 2.4, z, 1, 1.1, 0.9, 1));
    p.solid.push(sphere(0.32, '#6e6878', x, 3.2, z + 0.25, 1, 1, 1, 1));
    for (const t of [-1, 1]) p.solid.push(boxAt(0.9, 0.7, 0.08, '#5e5868', x + t * 0.6, 2.7, z - 0.2, t * 0.6, 0, t * 0.4));
    p.glow.push(sphere(0.07, GHOST, x + 0.12, 3.25, z + 0.55, 1, 1, 1, 0));
    p.glow.push(sphere(0.07, GHOST, x - 0.12, 3.25, z + 0.55, 1, 1, 1, 0));
  }
  return p;
}

// ———————————————————————— 琉璃镇（M3-13） ————————————————————————
const SEA = '#5fc8e0';
const DEEP = '#2a6aa8';
const FOAM = '#e8fbff';
const SEAGLASS = ['#7fd6d8', '#9fe0c8', '#6ab8e8', '#b8e8f0', '#8fc8f8'];

/** 圆形彩色玻璃舷窗（贴在前墙）：外圈铜框 + 十字窗棂 */
function porthole(p: PropParts, d: number, u: number, y: number, r: number, color: string): void {
  const z = d / 2 + 0.06;
  p.glow.push(paint(new THREE.CircleGeometry(r, 14).translate(u, y, z), color));
  p.solid.push(paint(new THREE.TorusGeometry(r + 0.05, 0.08, 5, 16).translate(u, y, z + 0.02), '#b08a4a'));
  p.solid.push(boxAt(0.05, r * 2, 0.04, '#b08a4a', u, y, z + 0.03));
  p.solid.push(boxAt(r * 2, 0.05, 0.04, '#b08a4a', u, y, z + 0.03));
}

/**
 * 琉璃屋：珊瑚白灰泥墙 + 海蓝勒脚，四坡顶铺海玻璃瓦（屋脊一排小晶尖），正面圆形彩玻舷窗；
 * 玻璃雨篷门，门边挂一串渔网玻璃浮球，窗下蓝花槽。
 */
export function glassHouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1, accent = DEEP): PropParts {
  const p = newParts();
  const r = rng(seed);
  const wallH = h * 0.55;
  p.solid.push(box(w + 0.5, 0.4, d + 0.5, '#d8d2c4'));
  p.solid.push(box(w, wallH, d, wall, 0, 0.4, 0));
  p.solid.push(box(w + 0.06, 0.7, d + 0.06, accent, 0, 0.4, 0));
  p.solid.push(box(w + 0.12, 0.14, d + 0.12, shade(wall, -0.08), 0, 0.4 + wallH - 0.14, 0));
  const rh = h - wallH - 0.4;
  hip(p, w, rh, d, 0.4 + wallH, roof, 0.45);
  // 檐口一圈海玻璃瓦当（明暗相间）
  for (let k = 0; k < Math.round(w / 0.7); k++) {
    const u = (k / Math.max(1, Math.round(w / 0.7) - 1) - 0.5) * (w + 0.6);
    p.glow.push(sphere(0.12, k % 2 ? shade(roof, 0.2) : SEAGLASS[k % SEAGLASS.length]!, u, 0.4 + wallH - 0.05, d / 2 + 0.45, 1, 0.7, 0.6, 0));
  }
  // 屋脊晶尖
  const ridgeY = 0.4 + wallH + rh;
  for (const u of [-0.5, 0, 0.5]) p.glow.push(paint(new THREE.ConeGeometry(0.16, 0.7, 6).translate(u * Math.min(1.4, w * 0.12), ridgeY + 0.2, 0), SEAGLASS[Math.floor(r() * SEAGLASS.length)]!));
  doorAt(p, w, d, 0, { width: 1.25, height: 2.3, y: 0.4, frame: '#f4f0e6', color: '#3f7a9a', canopy: SEA, lamp: true, step: '#cfc8b8' });
  // 舷窗
  for (const u of evenly(w, windowCount(w, 2.8), true)) porthole(p, d, u, 0.4 + wallH * 0.55, 0.5, SEAGLASS[Math.floor(r() * SEAGLASS.length)]!);
  for (const face of ['left', 'right', 'back'] as const) {
    const len = face === 'back' ? w : d;
    for (const u of evenly(len, windowCount(len, 3))) windowAt(p, face, w, d, u, 0.4 + 1.0, { size: [0.9, 1.1], frame: '#f4f0e6', shutters: face === 'back' ? null : accent, rand: r });
  }
  // 渔网玻璃浮球
  const fx = -0.95 - 0.4;
  p.solid.push(boxAt(0.04, 1.4, 0.04, '#8a7a5a', fx, 0.4 + 1.2, d / 2 + 0.12));
  for (let k = 0; k < 3; k++) p.glow.push(sphere(0.17, SEAGLASS[(seed + k) % SEAGLASS.length]!, fx + (k - 1) * 0.12, 0.4 + 0.9 + k * 0.38, d / 2 + 0.2, 1, 1, 1, 1));
  // 花槽（蓝花）
  for (const s of [-1, 1]) {
    p.solid.push(box(1.2, 0.4, 0.4, '#e8e2d4', s * (w / 2 - 1.0), 0, d / 2 + 0.35));
    for (let k = 0; k < 3; k++) p.solid.push(sphere(0.16, k % 2 ? '#6a9ad8' : '#9ac8f0', s * (w / 2 - 1.0) + (k - 1) * 0.35, 0.5, d / 2 + 0.35, 1, 0.8, 1, 0));
  }
  return p;
}

/**
 * 玻璃工坊：宽体砖石工坊，正面大圆拱开口内是发红光的熔炉，侧面高砖烟囱（顶口透火光）；
 * 门外木架上陈列一排彩色玻璃瓶 / 玻璃球，屋顶天窗。
 */
export function glassworks(w: number, h: number, d: number, wall = '#e8dcc8', roof = '#3f7a9a'): PropParts {
  const p = newParts();
  const wallH = h * 0.55;
  p.solid.push(box(w + 0.6, 0.4, d + 0.6, '#c8bca8'));
  p.solid.push(box(w, wallH, d, wall, 0, 0.4, 0));
  // 砖缝
  for (let y = 0.9; y < wallH; y += 0.55) p.solid.push(box(w + 0.04, 0.05, d + 0.04, shade(wall, -0.12), 0, 0.4 + y, 0));
  hip(p, w, h - wallH - 0.4, d, 0.4 + wallH, roof, 0.5);
  // 天窗
  p.glow.push(boxAt(w * 0.3, 0.08, d * 0.25, '#bfe3f2', 0, 0.4 + wallH + (h - wallH - 0.4) * 0.45, d * 0.12, 0, -0.5));
  // 圆拱开口 + 熔炉
  const aw = Math.min(3.4, w * 0.4);
  p.solid.push(box(aw, 2.6, 0.1, '#2a1e1a', 0, 0.4, d / 2 + 0.03));
  p.solid.push(paint(new THREE.CircleGeometry(aw / 2, 12, 0, Math.PI).translate(0, 0.4 + 2.6, d / 2 + 0.04), '#2a1e1a'));
  p.solid.push(paint(new THREE.TorusGeometry(aw / 2 + 0.1, 0.16, 5, 12, Math.PI).translate(0, 0.4 + 2.6, d / 2 + 0.08), shade(wall, -0.2)));
  p.solid.push(box(1.6, 1.4, 1.2, '#7a4a3a', 0, 0.4, d / 2 - 1.0));
  p.glow.push(paint(new THREE.CircleGeometry(0.45, 10).translate(0, 0.4 + 0.75, d / 2 - 0.38), '#ff8a3a'));
  p.glow.push(sphere(0.6, '#ffb060', 0, 0.4 + 0.6, d / 2 - 0.2, 1.4, 0.6, 0.3, 1));
  // 烟囱
  const cx = w / 2 - 0.9;
  p.solid.push(box(1.1, h + 2.2, 1.1, '#9a5a44', cx, 0, -d / 2 + 0.9));
  for (let k = 1; k < h + 2; k += 0.6) p.solid.push(box(1.14, 0.05, 1.14, '#7a4434', cx, k, -d / 2 + 0.9));
  p.glow.push(box(0.7, 0.12, 0.7, '#ff7a2a', cx, h + 2.2, -d / 2 + 0.9));
  // 陈列架 + 玻璃器
  for (const s of [-1, 1]) {
    const x = s * (aw / 2 + 1.3);
    p.solid.push(box(1.6, 0.06, 0.5, '#8a6a48', x, 0.9, d / 2 + 0.4));
    p.solid.push(box(1.6, 0.06, 0.5, '#8a6a48', x, 1.5, d / 2 + 0.4));
    for (const sy of [-0.75, 0.75]) p.solid.push(box(0.06, 1.6, 0.5, '#8a6a48', x + sy, 0, d / 2 + 0.4));
    for (let k = 0; k < 4; k++) {
      const c = SEAGLASS[(k + (s > 0 ? 2 : 0)) % SEAGLASS.length]!;
      p.glow.push(sphere(0.13, c, x - 0.5 + k * 0.33, 1.08, d / 2 + 0.4, 1, 1.2, 1, 1));
      p.glow.push(cyl(0.05, 0.1, 0.32, 6, c, x - 0.5 + k * 0.33, 1.56, d / 2 + 0.4));
    }
  }
  // 招牌：玻璃瓶剪影
  p.solid.push(box(2.0, 0.6, 0.1, '#3f7a9a', 0, 0.4 + 3.6, d / 2 + 0.06));
  p.glow.push(cyl(0.1, 0.2, 0.45, 6, '#9fe0c8', 0, 0.4 + 3.66, d / 2 + 0.16));
  return p;
}

/**
 * 水系道馆「琉璃」：白石圆形馆体，外绕一圈环形水渠（四只喷泉口），上覆分瓣玻璃穹顶（金属肋 + 顶部水滴形晶体）；
 * 正门两侧立海浪纹柱，门楣上是雨滴徽记。
 */
export function gymWater(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  const wallH = h * 0.38;
  p.solid.push(paint(new THREE.CylinderGeometry(half + 1.6, half + 1.8, 0.6, 32).translate(0, 0.3, 0), '#e4e0d8'));
  // 环形水渠：外沿石栏 + 水面
  p.solid.push(paint(new THREE.TorusGeometry(half + 0.9, 0.18, 5, 40).rotateX(Math.PI / 2).translate(0, 0.85, 0), '#f4f0e8'));
  p.glow.push(paint(new THREE.RingGeometry(half * 0.9 + 0.05, half + 0.8, 40).rotateX(-Math.PI / 2).translate(0, 0.66, 0), SEA));
  // 馆体
  p.solid.push(paint(new THREE.CylinderGeometry(half * 0.9, half * 0.92, wallH, 32).translate(0, 0.6 + wallH / 2, 0), '#f6f4ee'));
  p.solid.push(paint(new THREE.CylinderGeometry(half * 0.93, half * 0.93, 0.5, 32).translate(0, 0.6 + wallH, 0), DEEP));
  // 海浪纹带
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    p.solid.push(paint(new THREE.TorusGeometry(0.5, 0.09, 4, 8, Math.PI).rotateY(a + Math.PI / 2).translate(Math.sin(a) * half * 0.905, 0.6 + wallH * 0.75, Math.cos(a) * half * 0.905), SEA));
  }
  // 竖窗
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    if (Math.cos(a) > 0.95) continue;
    p.glow.push(boxAt(0.9, wallH * 0.42, 0.1, '#bfe8f8', Math.sin(a) * half * 0.905, 0.6 + wallH * 0.18 + wallH * 0.21, Math.cos(a) * half * 0.905, a));
  }
  // 玻璃穹顶 + 金属肋
  const dy = 0.6 + wallH + 0.5;
  const dr = half * 0.88;
  p.glow.push(paint(new THREE.SphereGeometry(dr, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1).translate(0, dy, 0), '#a8e4f0'));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const g = new THREE.TorusGeometry(dr, 0.12, 4, 16, Math.PI / 2).rotateZ(0).scale(1, 0.62, 1);
    p.solid.push(paint(g.rotateY(a).translate(0, dy, 0), '#d8dce4'));
  }
  p.solid.push(paint(new THREE.TorusGeometry(dr * 0.35, 0.14, 4, 20).rotateX(Math.PI / 2).translate(0, dy + dr * 0.62 * 0.94, 0), '#d8dce4'));
  // 顶部水滴晶体
  const ty = dy + dr * 0.62;
  p.glow.push(sphere(0.9, '#6ad0f0', 0, ty + 1.2, 0, 1, 1, 1, 2));
  p.glow.push(paint(new THREE.ConeGeometry(0.88, 1.6, 16).translate(0, ty + 2.4, 0), '#6ad0f0'));
  p.solid.push(cyl(0.3, 0.4, 0.6, 8, '#d8dce4', 0, ty, 0));
  // 喷泉口：四只鱼形出水口 + 水柱
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.sin(a) * (half + 0.4);
    const z = Math.cos(a) * (half + 0.4);
    p.solid.push(cyl(0.35, 0.45, 0.9, 8, '#e4e0d8', x, 0.6, z));
    p.glow.push(paint(new THREE.ConeGeometry(0.22, 2.2, 8).translate(x, 1.5 + 1.1, z), FOAM));
    p.glow.push(sphere(0.35, FOAM, x, 3.8, z, 1.2, 0.6, 1.2, 1));
  }
  // 正门：栈桥跨过水渠，两侧浪纹柱 + 雨滴徽记
  const fz = half * 0.9;
  p.solid.push(box(4.2, 0.3, half * 0.2 + 2.2, '#e4e0d8', 0, 0.6, fz + (half * 0.2 + 2.2) / 2 - 0.4));
  p.solid.push(box(4.6, 4.6, 1.0, '#f6f4ee', 0, 0.6, fz - 0.2));
  p.solid.push(box(3.0, 3.8, 0.1, '#2a5a8a', 0, 0.6, fz + 0.32));
  p.glow.push(box(0.08, 3.6, 0.06, '#bfe8f8', 0, 0.7, fz + 0.38));
  p.solid.push(paint(new THREE.CylinderGeometry(2.3, 2.3, 1.0, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 0.6 + 4.6, fz + 0.3), '#f6f4ee'));
  p.glow.push(sphere(0.55, '#4ab8f0', 0, 0.6 + 5.2, fz + 0.9, 1, 1, 0.4, 1));
  p.glow.push(paint(new THREE.ConeGeometry(0.54, 0.9, 12).scale(1, 1, 0.4).translate(0, 0.6 + 5.95, fz + 0.9), '#4ab8f0'));
  for (const s of [-1, 1]) {
    const x = s * 3.0;
    p.solid.push(cyl(0.45, 0.5, 5.2, 10, '#f6f4ee', x, 0.6, fz + 0.6));
    for (let k = 0; k < 4; k++) p.solid.push(paint(new THREE.TorusGeometry(0.5, 0.07, 4, 10).rotateX(Math.PI / 2).translate(x, 1.4 + k * 1.1, fz + 0.6), SEA));
    p.glow.push(sphere(0.32, '#6ad0f0', x, 6.1, fz + 0.6, 1, 1.2, 1, 1));
  }
  return p;
}

/**
 * 海底神殿之门：海中石台上的古代门楼。两根爬满珊瑚与藤壶的粗石柱，弧形门楣中央嵌着封印宝珠（深蓝微光），
 * 门楣刻浪纹；门前石阶一级级没入海里（潜水入口，M3-18 开放）。石台四角立着矮石灯。
 */
export function templeGate(w: number, h: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const stone = '#9aa8a8';
  const half = w / 2;
  // 石台（深入水下）
  p.solid.push(box(w + 4, 3.4, 9, shade(stone, -0.15), 0, -3.0, 0));
  p.solid.push(box(w + 3.4, 0.3, 8.4, stone, 0, 0.4, 0));
  // 前方没入海里的台阶（+Z 方向）
  for (let k = 0; k < 6; k++) p.solid.push(box(w - 0.5, 0.4, 1.0, shade(stone, -0.05 - k * 0.04), 0, 0.4 - (k + 1) * 0.42, 4.2 + k * 0.9));
  // 石柱
  for (const s of [-1, 1]) {
    const x = s * (half - 0.4);
    p.solid.push(box(1.8, 0.5, 1.8, shade(stone, -0.1), x, 0.7, 0));
    p.solid.push(cyl(0.65, 0.75, h - 1.6, 10, stone, x, 1.2, 0));
    for (let k = 0; k < 5; k++) p.solid.push(paint(new THREE.TorusGeometry(0.72, 0.05, 4, 12).rotateX(Math.PI / 2).translate(x, 1.6 + k * (h - 2.6) / 5, 0), shade(stone, -0.18)));
    // 珊瑚 / 藤壶
    for (let k = 0; k < 7; k++) {
      const a = r() * Math.PI * 2;
      const y = 1.3 + r() * (h * 0.45);
      p.solid.push(sphere(0.18 + r() * 0.16, k % 3 ? '#e88a8a' : '#f0c8a0', x + Math.cos(a) * 0.72, y, Math.sin(a) * 0.72, 1, 0.7, 1, 0));
    }
    p.solid.push(box(1.7, 0.4, 1.7, shade(stone, -0.1), x, h - 0.4, 0));
  }
  // 弧形门楣 + 浪纹
  p.solid.push(paint(new THREE.TorusGeometry(half - 0.4, 0.55, 6, 18, Math.PI).translate(0, h - 0.2, 0), stone));
  p.solid.push(box(w + 1.2, 0.6, 1.4, shade(stone, -0.08), 0, h - 0.2, 0));
  for (let k = 0; k < 7; k++) p.solid.push(paint(new THREE.TorusGeometry(0.35, 0.06, 4, 8, Math.PI).translate((k - 3) * (w / 8), h - 0.05, 0.72), SEA));
  // 封印宝珠
  const oy = h - 0.2 + half - 0.4;
  p.solid.push(paint(new THREE.TorusGeometry(0.9, 0.16, 6, 18).translate(0, oy, 0.1), '#c9a86a'));
  p.glow.push(sphere(0.75, '#2a7ac8', 0, oy, 0.1, 1, 1, 0.7, 2));
  p.glow.push(sphere(0.3, '#bfe8ff', 0.2, oy + 0.2, 0.55, 1, 1, 0.5, 1));
  // 门内：水面泛光（门洞里一层蓝光幕，提示入口）
  p.glow.push(boxAt(w - 2.4, h - 1.8, 0.06, '#5fc8e0', 0, 0.6 + (h - 1.8) / 2, -0.2));
  // 四角石灯
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * (half + 1.2);
    const z = sz * 3.4;
    p.solid.push(box(0.6, 1.2, 0.6, stone, x, 0.7, z));
    p.solid.push(box(0.9, 0.2, 0.9, shade(stone, -0.1), x, 1.9, z));
    p.glow.push(box(0.4, 0.4, 0.4, '#8fe8ff', x, 2.1, z));
    p.solid.push(paint(new THREE.ConeGeometry(0.6, 0.5, 4).rotateY(Math.PI / 4).translate(x, 2.75, z), shade(stone, -0.1)));
  }
  return p;
}

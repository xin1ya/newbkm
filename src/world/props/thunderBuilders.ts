/**
 * M3 · 雷鸣群岛专用构件（与 builders / townBuilders / tideBuilders 同约定：局部坐标，y = 0 为地面，正面朝 +Z；
 * solid = Toon 场景材质，glow = 夜间 / 自发光部件）。
 *
 * - 雷鸣镇：板岩石屋（屋脊避雷针 + 铜引下线）、避雷塔（格构塔 + 绝缘子 + 发光针尖）
 * - 晨光镇：沿用风车 / 农舍；日晷
 * - 雪原镇：原木雪屋（屋顶积雪 + 冰棱 + 柴垛）、冰屋（雪砖穹顶 + 入口拱道）、雪橇、雪人
 * - 云雀镇：崖屋（木构 + 屋顶风车）、滑翔台（悬挑平台 + 风向袋）、风力机（风力桥两端）
 * - 道馆：电（线圈塔）/ 晨辉（日轮穹顶）/ 冰（冰晶穹顶）/ 云翎（展翼高台）
 */
import * as THREE from 'three';
import { box, cyl, paint, type PropParts } from './builders';
import { beam, boxAt, doorAt, evenly, gable, rng, shade, sphere, V, windowAt, windowCount } from './townBuilders';

const newParts = (): PropParts => ({ solid: [], glow: [] });
const WARM = '#ffd59a';
const SPARK = '#ffe45a';
const SNOW = '#eef4f8';
const ICE = '#a9d8ee';
const COPPER = '#b8743a';

// ———————————————————————— 雷鸣镇 ————————————————————————

/** 屋脊避雷针 + 沿山墙下来的铜引下线 */
function roofRod(p: PropParts, x: number, ridgeY: number, z: number, groundZ: number, h = 2.2): void {
  p.solid.push(cyl(0.05, 0.08, h, 5, '#5a5a62', x, ridgeY, z));
  p.solid.push(paint(new THREE.ConeGeometry(0.12, 0.4, 6).translate(x, ridgeY + h + 0.2, z), COPPER));
  p.glow.push(sphere(0.09, SPARK, x, ridgeY + h + 0.45, z, 1, 1, 1, 0));
  p.solid.push(beam(V(x, ridgeY + 0.1, z), V(x + 0.1, 0.2, groundZ), 0.035, COPPER, 4));
}

/**
 * 板岩石屋：粗石勒脚 + 灰泥墙 + 陡坡板岩顶，屋脊避雷针，窗下花箱（耐风的石楠），侧面石砌烟囱。
 */
export function slateHouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1, accent = '#e8b73a'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const plinth = 1.1;
  const wallH = h * 0.56;
  // 粗石勒脚：错缝石块
  for (const face of [-1, 1]) {
    for (let u = -w / 2 + 0.5; u < w / 2; u += 1.0) p.solid.push(box(0.95, plinth * (0.85 + r() * 0.15), 0.5, r() > 0.5 ? '#6f6a78' : '#5f5b68', u, 0, face * (d / 2 + 0.05)));
    for (let u = -d / 2 + 0.5; u < d / 2; u += 1.0) p.solid.push(box(0.5, plinth * (0.85 + r() * 0.15), 0.95, r() > 0.5 ? '#6f6a78' : '#5f5b68', face * (w / 2 + 0.05), 0, u));
  }
  p.solid.push(box(w, wallH, d, wall, 0, 0, 0));
  // 转角石
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
    for (let y = plinth; y < wallH - 0.4; y += 0.8) p.solid.push(box(0.5, 0.36, 0.5, '#8a8594', sx * (w / 2 - 0.15), y, sz * (d / 2 - 0.15)));
  // 陡坡板岩顶
  const rh = h - wallH;
  gable(p, w, rh, d, wallH, roof, wall, 0.5, shade(roof, 0.25));
  roofRod(p, 0, h + 0.2, d / 4, d / 2 + 0.2);
  // 门 + 雨棚
  doorAt(p, w, d, 0, { width: 1.3, height: 2.3, y: 0.3, frame: shade(accent, -0.25) });
  p.solid.push(boxAt(2.4, 0.14, 1.1, roof, 0, 2.95, d / 2 + 0.5, 0, 0.25));
  // 窗 + 花箱（石楠紫）
  for (const u of evenly(w, windowCount(w, 2.8), true)) {
    windowAt(p, 'front', w, d, u, plinth + 0.5, { frame: '#e8e4dc', warm: true, size: [1.0, 1.15] });
    p.solid.push(box(1.2, 0.3, 0.35, '#5a3e2b', u, plinth + 0.25, d / 2 + 0.2));
    for (let k = 0; k < 4; k++) p.solid.push(sphere(0.16, r() > 0.5 ? '#9c6bb0' : '#b88ac8', u - 0.45 + k * 0.3, plinth + 0.62, d / 2 + 0.22, 1, 0.8, 1, 0));
  }
  for (const face of ['left', 'right', 'back'] as const)
    for (const u of evenly(face === 'back' ? w : d, windowCount(face === 'back' ? w : d, 3.0))) windowAt(p, face, w, d, u, plinth + 0.5, { frame: '#e8e4dc', warm: true, size: [0.9, 1.0] });
  // 石砌烟囱
  p.solid.push(box(1.0, h + 0.8 - wallH * 0.3, 1.0, '#6f6a78', w / 2 - 1.0, wallH * 0.3, -d / 4));
  p.solid.push(box(1.2, 0.2, 1.2, '#5f5b68', w / 2 - 1.0, h + 0.8, -d / 4));
  // 防风百叶窗（强调色）
  for (const u of evenly(w, windowCount(w, 2.8), true)) for (const s of [-1, 1]) p.solid.push(box(0.35, 1.2, 0.08, accent, u + s * 0.72, plinth + 0.48, d / 2 + 0.06));
  return p;
}

/**
 * 避雷塔：四柱格构塔身（逐段收分 + X 斜撑），三层瓷绝缘子环，顶部铜针 + 发光放电球；
 * 塔脚混凝土基座与接地铜带。h 为总高。
 */
export function lightningTower(w: number, h: number): PropParts {
  const p = newParts();
  const steel = '#4a4c5a';
  const seg = Math.max(4, Math.round(h / 4));
  p.solid.push(box(w + 1.2, 0.6, w + 1.2, '#8a8690'));
  const half = (t: number) => (w / 2) * (1 - t * 0.72);
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg;
    const t1 = (i + 1) / seg;
    const y0 = 0.6 + t0 * (h - 3);
    const y1 = 0.6 + t1 * (h - 3);
    const a = half(t0);
    const b = half(t1);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
    for (let k = 0; k < 4; k++) {
      const [sx, sz] = corners[k]!;
      const [nx, nz] = corners[(k + 1) % 4]!;
      p.solid.push(beam(V(sx * a, y0, sz * a), V(sx * b, y1, sz * b), 0.12, steel, 4));
      // X 斜撑
      p.solid.push(beam(V(sx * a, y0, sz * a), V(nx * b, y1, nz * b), 0.05, steel, 3));
      p.solid.push(beam(V(nx * a, y0, nz * a), V(sx * b, y1, sz * b), 0.05, steel, 3));
      // 横杆
      p.solid.push(beam(V(sx * b, y1, sz * b), V(nx * b, y1, nz * b), 0.06, steel, 3));
    }
  }
  const top = 0.6 + (h - 3);
  // 绝缘子环
  for (let k = 0; k < 3; k++) p.solid.push(cyl(0.45 - k * 0.06, 0.45 - k * 0.06, 0.22, 10, '#e8e4dc', 0, top + 0.1 + k * 0.42, 0));
  p.solid.push(cyl(0.08, 0.14, 2.4, 6, COPPER, 0, top, 0));
  p.glow.push(sphere(0.35, SPARK, 0, top + 2.6, 0, 1, 1, 1, 1));
  // 光晕环（夜里像一圈电弧）
  p.glow.push(paint(new THREE.TorusGeometry(0.75, 0.05, 4, 16).rotateX(Math.PI / 2).translate(0, top + 2.6, 0), '#bfe8ff'));
  // 接地铜带
  p.solid.push(beam(V(half(1), top, half(1)), V(w / 2 + 0.4, 0.62, w / 2 + 0.4), 0.05, COPPER, 4));
  // 警示牌
  p.solid.push(box(0.9, 0.7, 0.06, '#f2c230', 0, 1.6, w / 2 + 0.1));
  p.solid.push(box(0.12, 0.5, 0.07, '#2a2a2a', 0, 1.7, w / 2 + 0.14));
  return p;
}

// ———————————————————————— 晨光镇 ————————————————————————

/** 日晷：圆形石台 + 刻度 + 斜指针（晨光镇广场） */
export function sundial(w: number): PropParts {
  const p = newParts();
  p.solid.push(cyl(w / 2, w / 2 + 0.2, 0.5, 20, '#d8d0c0'));
  p.solid.push(cyl(w / 2 - 0.3, w / 2 - 0.3, 0.08, 20, '#ece6d8', 0, 0.5, 0));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.solid.push(boxAt(0.12, 0.06, k % 3 === 0 ? 0.7 : 0.4, '#8a6a3a', Math.sin(a) * (w / 2 - 0.7), 0.6, Math.cos(a) * (w / 2 - 0.7), a));
  }
  p.solid.push(boxAt(0.12, w * 0.32, w * 0.4, '#b8903a', 0, 0.58 + w * 0.12, -w * 0.05, 0, 0, 0));
  return p;
}

// ———————————————————————— 雪原镇 ————————————————————————

/** 原木雪屋：横叠原木墙 + 陡坡顶（顶上积雪层 + 檐口冰棱），侧面柴垛，门廊 */
export function chaletHouse(w: number, h: number, d: number, roof: string, seed = 1, accent = '#c8402e'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const wallH = h * 0.5;
  p.solid.push(box(w + 0.6, 0.6, d + 0.6, '#7a7480'));
  // 横叠原木（每根圆柱横放）
  for (let y = 0.6, i = 0; y < wallH; y += 0.42, i++) {
    const c = i % 2 ? '#8a5a36' : '#7a4c2c';
    for (const s of [-1, 1]) {
      p.solid.push(paint(new THREE.CylinderGeometry(0.22, 0.22, w + 0.6, 6).rotateZ(Math.PI / 2).translate(0, y + 0.21, s * (d / 2)), c));
      p.solid.push(paint(new THREE.CylinderGeometry(0.22, 0.22, d + 0.6, 6).rotateX(Math.PI / 2).translate(s * (w / 2), y + 0.21, 0), c));
    }
  }
  p.solid.push(box(w - 0.3, wallH - 0.6, d - 0.3, '#6a4428', 0, 0.6, 0));
  const rh = h - wallH;
  gable(p, w, rh, d, wallH, roof, '#7a4c2c', 0.8, '#e8e0d0');
  // 积雪层：比屋顶略大、略高的白色坡面
  const half = w / 2 + 0.9;
  const slope = Math.atan2(rh, w / 2);
  const len = Math.hypot(half, rh * (half / (w / 2)));
  for (const s of [-1, 1]) {
    const cy = wallH + rh - (rh * (half / (w / 2))) / 2;
    p.solid.push(boxAt(len * 0.96, 0.32, d + 1.7, SNOW, (s * half) / 2, cy + 0.42, 0, 0, 0, -s * slope));
  }
  // 冰棱：两侧檐口
  for (const s of [-1, 1])
    for (let u = -d / 2; u <= d / 2; u += 0.55) {
      const l = 0.3 + r() * 0.6;
      p.solid.push(paint(new THREE.ConeGeometry(0.07, l, 4).rotateX(Math.PI).translate(s * (w / 2 + 0.75), wallH - 0.05 - l / 2, u), ICE));
    }
  // 门廊 + 门
  doorAt(p, w, d, 0, { width: 1.3, height: 2.2, y: 0.6, frame: accent });
  for (const sx of [-1, 1]) p.solid.push(cyl(0.12, 0.12, 2.6, 6, '#6a4428', sx * 1.2, 0.6, d / 2 + 1.3));
  p.solid.push(boxAt(3.0, 0.16, 1.8, roof, 0, 3.2, d / 2 + 0.8, 0, 0.22));
  p.solid.push(boxAt(3.0, 0.14, 1.8, SNOW, 0, 3.36, d / 2 + 0.8, 0, 0.22));
  // 暖窗（窗台积雪）
  for (const face of ['front', 'left', 'right'] as const)
    for (const u of evenly(face === 'front' ? w : d, windowCount(face === 'front' ? w : d, 2.8), face === 'front')) {
      windowAt(p, face, w, d, u, 1.4, { frame: '#f2ece0', warm: true, size: [1.0, 1.0], mullion: true });
    }
  // 柴垛
  for (let k = 0; k < 12; k++) p.solid.push(paint(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 6).rotateX(Math.PI / 2).translate(-w / 2 - 0.6, 0.2 + Math.floor(k / 4) * 0.3, -d / 4 + ((k % 4) - 1.5) * 0.34), k % 3 ? '#9a6a3e' : '#b88a5a'));
  // 烟囱（顶上积雪）
  p.solid.push(box(0.9, rh + 1.2, 0.9, '#7a7480', w / 4, wallH, -d / 4));
  p.solid.push(box(1.1, 0.2, 1.1, SNOW, w / 4, wallH + rh + 1.2, -d / 4));
  return p;
}

/** 冰屋：雪砖穹顶（砖缝刻线）+ 入口拱道，门洞透出暖光 */
export function igloo(w: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const R = w / 2;
  p.solid.push(paint(new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), SNOW));
  // 砖缝：纬线环 + 错位竖缝
  const rings = 5;
  for (let i = 1; i < rings; i++) {
    const phi = (i / rings) * (Math.PI / 2);
    const rr = R * Math.cos(phi) + 0.02;
    const y = R * Math.sin(phi);
    p.solid.push(paint(new THREE.TorusGeometry(rr, 0.04, 3, 24).rotateX(Math.PI / 2).translate(0, y, 0), '#c8dbe6'));
    const n = Math.max(4, Math.round(rr * 2.2));
    for (let k = 0; k < n; k++) {
      const a = ((k + (i % 2) * 0.5) / n) * Math.PI * 2;
      const phi0 = ((i - 1) / rings) * (Math.PI / 2);
      const ya = R * Math.sin(phi0);
      const ra = R * Math.cos(phi0) + 0.02;
      p.solid.push(beam(V(Math.sin(a) * ra, ya, Math.cos(a) * ra), V(Math.sin(a) * rr, y, Math.cos(a) * rr), 0.03, '#c8dbe6', 3));
    }
  }
  // 入口拱道（半圆柱）
  const tw = Math.max(1.4, R * 0.5);
  p.solid.push(paint(new THREE.CylinderGeometry(tw / 2 + 0.3, tw / 2 + 0.3, 1.8, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 0, R + 0.4), SNOW));
  p.glow.push(paint(new THREE.CircleGeometry(tw / 2, 10, 0, Math.PI).translate(0, 0, R + 1.31), WARM));
  // 门口散落雪块
  for (let k = 0; k < 4; k++) p.solid.push(boxAt(0.5, 0.35, 0.4, SNOW, (r() - 0.5) * 3, 0, R + 2 + r(), r() * 3));
  return p;
}

/** 木雪橇（弯起的滑板） */
export function sled(w: number, color = '#c8402e'): PropParts {
  const p = newParts();
  const L = w;
  for (const s of [-1, 1]) {
    p.solid.push(box(0.08, 0.08, L, '#3a3a40', s * 0.4, 0, 0));
    p.solid.push(beam(V(s * 0.4, 0.04, L / 2), V(s * 0.4, 0.5, L / 2 + 0.3), 0.04, '#3a3a40', 4));
    for (const z of [-L / 3, 0, L / 3]) p.solid.push(box(0.06, 0.3, 0.06, '#5a3e2b', s * 0.4, 0.08, z));
  }
  for (let z = -L / 2 + 0.15; z < L / 2; z += 0.22) p.solid.push(box(1.0, 0.06, 0.18, color, 0, 0.38, z));
  return p;
}

/** 雪人：三球 + 树枝手 + 胡萝卜鼻 + 围巾 */
export function snowman(h: number, scarf = '#d9453b'): PropParts {
  const p = newParts();
  const r0 = h * 0.22;
  p.solid.push(sphere(r0, SNOW, 0, r0 * 0.9, 0, 1, 0.9, 1, 1));
  p.solid.push(sphere(r0 * 0.72, SNOW, 0, r0 * 2.2, 0, 1, 1, 1, 1));
  p.solid.push(sphere(r0 * 0.5, SNOW, 0, r0 * 3.2, 0, 1, 1, 1, 1));
  p.solid.push(paint(new THREE.ConeGeometry(0.06 * h, 0.22 * h, 5).rotateX(Math.PI / 2).translate(0, r0 * 3.2, r0 * 0.6), '#f08a2a'));
  for (const s of [-1, 1]) {
    p.solid.push(sphere(0.035 * h, '#202024', s * r0 * 0.2, r0 * 3.35, r0 * 0.44, 1, 1, 1, 0));
    p.solid.push(beam(V(s * r0 * 0.6, r0 * 2.3, 0), V(s * r0 * 1.6, r0 * 2.9, 0), 0.025 * h, '#5a3e2b', 4));
  }
  p.solid.push(paint(new THREE.TorusGeometry(r0 * 0.5, 0.06 * h, 4, 12).rotateX(Math.PI / 2).translate(0, r0 * 2.75, 0), scarf));
  p.solid.push(box(0.12 * h, 0.35 * h, 0.04 * h, scarf, r0 * 0.3, r0 * 2.1, r0 * 0.52));
  return p;
}

// ———————————————————————— 云雀镇 ————————————————————————

/** 崖屋：木构高脚屋（前廊出挑）+ 屋顶风车（四叶）+ 鸟巢屋檐 */
export function larkHouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1, accent = '#4b8ac8'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const y0 = 0.8;
  const wallH = h * 0.55;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(box(0.4, y0, 0.4, '#5a3e2b', sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3)));
  p.solid.push(box(w + 0.4, 0.2, d + 2.4, '#8a6a48', 0, y0, 1.0));
  p.solid.push(box(w, wallH, d, wall, 0, y0 + 0.2, 0));
  // 竖向护墙板
  for (const u of evenly(w, Math.round(w / 0.5))) p.solid.push(box(0.06, wallH, 0.06, shade(wall, -0.12), u, y0 + 0.2, d / 2 + 0.03));
  gable(p, w, h - wallH - y0, d, y0 + 0.2 + wallH, roof, wall, 0.6);
  // 前廊栏杆
  for (let u = -w / 2; u <= w / 2 + 0.01; u += 0.6) p.solid.push(box(0.08, 0.9, 0.08, '#5a3e2b', u, y0 + 0.2, d / 2 + 2.1));
  p.solid.push(box(w + 0.1, 0.1, 0.12, '#5a3e2b', 0, y0 + 1.1, d / 2 + 2.1));
  doorAt(p, w, d, 0, { width: 1.2, height: 2.2, y: y0 + 0.2, frame: accent });
  for (const u of evenly(w, windowCount(w, 2.6), true)) windowAt(p, 'front', w, d, u, y0 + 1.0, { frame: '#ffffff', warm: true, size: [1.0, 1.1] });
  for (const face of ['left', 'right'] as const) for (const u of evenly(d, windowCount(d, 3))) windowAt(p, face, w, d, u, y0 + 1.0, { frame: '#ffffff', warm: true, size: [0.9, 1.0] });
  // 屋顶风车：塔杆 + 机头 + 四叶
  const ty = h + 0.1;
  p.solid.push(cyl(0.07, 0.1, 2.0, 5, '#4a4c5a', -w / 4, ty - 0.6, 0));
  p.solid.push(box(0.4, 0.3, 0.7, accent, -w / 4, ty + 1.4, 0));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r();
    p.solid.push(boxAt(0.22, 1.5, 0.05, '#f2f0ea', -w / 4 + Math.sin(a) * 0.8, ty + 1.55 + Math.cos(a) * 0.8, 0.4, 0, 0, -a));
  }
  // 鸟巢
  p.solid.push(sphere(0.35, '#8a6a3a', w / 2 + 0.2, y0 + wallH, d / 2 + 0.3, 1, 0.5, 1, 0));
  return p;
}

/** 滑翔台：悬挑木平台（下有斜撑）+ 起跳坡 + 风向袋 + 旗杆 */
export function glideDeck(w: number, d: number, accent = '#e8b73a'): PropParts {
  const p = newParts();
  p.solid.push(box(w, 0.3, d, '#8a6a48', 0, 0, 0));
  for (let u = -w / 2 + 0.3; u < w / 2; u += 0.5) p.solid.push(box(0.04, 0.02, d, '#6a4c30', u, 0.3, 0));
  // 斜撑（向崖下）
  for (const s of [-1, 1]) {
    p.solid.push(beam(V(s * (w / 2 - 0.3), 0, d / 2 - 0.2), V(s * (w / 2 - 0.3), -4, -d / 2 + 0.4), 0.14, '#5a3e2b', 5));
    p.solid.push(beam(V(s * (w / 2 - 0.3), 0, 0), V(s * (w / 2 - 0.3), -3, -d / 2 + 0.4), 0.1, '#5a3e2b', 4));
  }
  // 起跳坡（前端微微上翘）
  p.solid.push(boxAt(w * 0.6, 0.2, 2.2, accent, 0, 0.45, d / 2 - 0.6, 0, -0.18));
  // 两侧栏杆
  for (const s of [-1, 1]) {
    for (let z = -d / 2; z <= d / 2 - 2.4; z += 0.8) p.solid.push(box(0.08, 1.0, 0.08, '#5a3e2b', s * (w / 2 - 0.05), 0.3, z));
    p.solid.push(box(0.1, 0.1, d - 2.3, '#5a3e2b', s * (w / 2 - 0.05), 1.3, -1.15));
  }
  // 风向袋
  p.solid.push(cyl(0.05, 0.06, 4.2, 5, '#d8d8d8', w / 2 - 0.3, 0.3, -d / 2 + 0.4));
  for (let k = 0; k < 4; k++) p.solid.push(paint(new THREE.CylinderGeometry(0.28 - k * 0.04, 0.32 - k * 0.04, 0.45, 8, 1, true).rotateZ(Math.PI / 2).translate(w / 2 - 0.3 - 0.4 - k * 0.45, 4.3, -d / 2 + 0.4), k % 2 ? '#ffffff' : '#f07a2a'));
  return p;
}

/** 风力机（风力桥两端的桥塔）：钢塔 + 机舱 + 三叶 */
export function windTurbine(h: number, color = '#f2f0ea'): PropParts {
  const p = newParts();
  p.solid.push(cyl(1.2, 1.4, 0.5, 10, '#8a8690'));
  p.solid.push(cyl(0.28, 0.5, h, 10, color, 0, 0.5, 0));
  p.solid.push(box(0.9, 0.8, 2.0, color, 0, h + 0.3, -0.2));
  p.solid.push(sphere(0.35, '#d8d8d8', 0, h + 0.7, 0.9, 1, 1, 1.4, 1));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    const L = h * 0.4;
    p.solid.push(boxAt(0.35, L, 0.08, color, Math.sin(a) * (L / 2), h + 0.7 + Math.cos(a) * (L / 2), 1.0, 0, 0, -a));
  }
  p.glow.push(sphere(0.15, '#ff4a3a', 0, h + 0.8, -1.1, 1, 1, 1, 0)); // 夜间航空警示灯
  return p;
}

// ———————————————————————— 道馆 ————————————————————————

function gymBase(p: PropParts, w: number, color: string): void {
  p.solid.push(box(w + 3, 0.6, w + 3, color));
  p.solid.push(box(7, 0.3, 1.6, color, 0, 0, w / 2 + 2.4));
}

function gymDoor(p: PropParts, half: number, frame: string, emblem: string): void {
  p.solid.push(box(1.0, 5.0, 1.0, frame, -2.6, 0.6, half + 0.2));
  p.solid.push(box(1.0, 5.0, 1.0, frame, 2.6, 0.6, half + 0.2));
  p.solid.push(box(6.4, 1.0, 1.3, frame, 0, 5.6, half + 0.2));
  p.glow.push(box(3.8, 4.4, 0.12, '#cfe8f4', 0, 0.6, half + 0.06));
  p.solid.push(box(0.1, 4.4, 0.2, frame, 0, 0.6, half + 0.12));
  p.glow.push(sphere(0.6, emblem, 0, 6.1, half + 0.95, 1, 1, 0.4, 1));
}

/** 电系道馆「雷霆」：八角馆体 + 黄黑警示带 + 顶部特斯拉线圈塔（环圈 + 放电球），四角避雷针 */
export function gymElectric(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  gymBase(p, w, '#5a5866');
  const wallH = h * 0.5;
  p.solid.push(paint(new THREE.CylinderGeometry(half, half, wallH, 8).rotateY(Math.PI / 8).translate(0, 0.6 + wallH / 2, 0), '#d8d6e0'));
  // 警示带（黄黑斜纹）
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    p.solid.push(boxAt(half * 0.2, 0.7, 0.12, k % 2 ? '#f2c230' : '#2a2a30', Math.sin(a) * (half * 0.93), 0.6 + wallH - 0.9, Math.cos(a) * (half * 0.93), a));
  }
  // 圆锥屋顶 + 线圈塔
  p.solid.push(paint(new THREE.ConeGeometry(half + 0.8, h * 0.2, 8).rotateY(Math.PI / 8).translate(0, 0.6 + wallH + h * 0.1, 0), '#4b4a78'));
  const ty = 0.6 + wallH + h * 0.18;
  p.solid.push(cyl(0.9, 1.3, h * 0.28, 10, '#5a5a62', 0, ty, 0));
  for (let k = 0; k < 6; k++) p.solid.push(paint(new THREE.TorusGeometry(1.0 + (k % 2) * 0.1, 0.14, 5, 18).rotateX(Math.PI / 2).translate(0, ty + 0.4 + k * (h * 0.04), 0), COPPER));
  p.solid.push(paint(new THREE.TorusGeometry(1.8, 0.45, 8, 20).rotateX(Math.PI / 2).translate(0, ty + h * 0.3, 0), '#c8c8d0'));
  p.glow.push(sphere(0.8, SPARK, 0, ty + h * 0.3 + 0.9, 0, 1, 1, 1, 1));
  // 四角避雷针
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k / 4) * Math.PI * 2;
    const x = Math.sin(a) * (half - 0.5);
    const z = Math.cos(a) * (half - 0.5);
    p.solid.push(cyl(0.08, 0.12, 4.5, 5, '#5a5a62', x, 0.6 + wallH, z));
    p.glow.push(sphere(0.18, SPARK, x, 0.6 + wallH + 4.7, z, 1, 1, 1, 0));
  }
  // 窗带（电光蓝）
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.abs(Math.sin(a)) < 0.4 && Math.cos(a) > 0) continue;
    p.glow.push(boxAt(2.0, 1.2, 0.1, '#9fd2ee', Math.sin(a) * (half * 0.93 + 0.05), 0.6 + wallH * 0.45, Math.cos(a) * (half * 0.93 + 0.05), a));
  }
  gymDoor(p, half * 0.93, '#3a3a48', SPARK);
  return p;
}

/** 晨辉道馆：白石圆厅 + 金色日轮穹顶（放射肋条）+ 门前双方尖碑 */
export function gymDawn(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  gymBase(p, w, '#d8ccb0');
  const wallH = h * 0.45;
  p.solid.push(cyl(half, half, wallH, 24, '#f6f0e2', 0, 0.6, 0));
  // 柱廊
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    if (Math.cos(a) > 0.9) continue;
    p.solid.push(cyl(0.35, 0.4, wallH, 8, '#ffffff', Math.sin(a) * (half + 0.4), 0.6, Math.cos(a) * (half + 0.4)));
  }
  p.solid.push(cyl(half + 1.0, half + 1.0, 0.5, 24, '#e8dcc0', 0, 0.6 + wallH, 0));
  // 金色穹顶 + 放射肋
  p.solid.push(paint(new THREE.SphereGeometry(half * 0.92, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1).translate(0, 1.1 + wallH, 0), '#f0c24a'));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.solid.push(beam(V(Math.sin(a) * half * 0.92, 1.1 + wallH, Math.cos(a) * half * 0.92), V(0, 1.1 + wallH + half * 0.57, 0), 0.12, '#c8902a', 4));
  }
  // 顶上日轮（发光）
  const sy = 1.1 + wallH + half * 0.57 + 1.4;
  p.glow.push(paint(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 18).rotateX(Math.PI / 2).translate(0, sy, 0), '#ffd86a'));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    p.solid.push(boxAt(0.18, 0.8, 0.12, '#f0b02a', Math.sin(a) * 1.7, sy + Math.cos(a) * 1.7, 0, 0, 0, -a));
  }
  // 方尖碑
  for (const s of [-1, 1]) {
    p.solid.push(box(1.2, 0.6, 1.2, '#d8ccb0', s * 5, 0.6, half + 2.6));
    p.solid.push(cyl(0.2, 0.5, 4.2, 4, '#f6f0e2', s * 5, 1.2, half + 2.6));
    p.glow.push(sphere(0.25, '#ffd86a', s * 5, 5.6, half + 2.6, 1, 1, 1, 0));
  }
  gymDoor(p, half, '#c8902a', '#ffd86a');
  return p;
}

/** 冰系道馆「霜凝」：冰砖穹顶 + 外圈冰晶尖柱（半透亮色作 glow）+ 雪檐 */
export function gymIce(w: number, h: number, seed = 17): PropParts {
  const p = newParts();
  const r = rng(seed);
  const half = w / 2;
  gymBase(p, w, '#8aa0b0');
  const wallH = h * 0.35;
  p.solid.push(cyl(half, half, wallH, 20, '#dbeef8', 0, 0.6, 0));
  p.solid.push(paint(new THREE.SphereGeometry(half, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, 0.6 + wallH, 0), '#c8e6f4'));
  // 穹顶冰砖缝
  for (let i = 1; i < 5; i++) {
    const phi = (i / 5) * (Math.PI / 2);
    p.solid.push(paint(new THREE.TorusGeometry(half * Math.cos(phi) + 0.03, 0.06, 3, 28).rotateX(Math.PI / 2).translate(0, 0.6 + wallH + half * 0.8 * Math.sin(phi), 0), '#9cc8dc'));
  }
  // 冰晶尖柱：一圈高低不一的六棱锥
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    if (Math.cos(a) > 0.88) continue;
    const L = 3 + r() * 5;
    const x = Math.sin(a) * (half + 1.2);
    const z = Math.cos(a) * (half + 1.2);
    const g = new THREE.ConeGeometry(0.6 + r() * 0.3, L, 6).translate(0, L / 2, 0).rotateZ((r() - 0.5) * 0.3).translate(x, 0.6, z);
    p.glow.push(paint(g, k % 3 ? '#bfe6fa' : '#e6f6ff'));
  }
  // 顶部雪花徽记
  const ty = 0.6 + wallH + half * 0.8;
  for (let k = 0; k < 3; k++) p.glow.push(boxAt(0.25, 3.0, 0.25, '#e6f6ff', 0, ty + 1.6, 0, 0, 0, (k / 3) * Math.PI));
  // 雪檐冰棱
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const l = 0.4 + r() * 0.8;
    p.solid.push(paint(new THREE.ConeGeometry(0.1, l, 4).rotateX(Math.PI).translate(Math.sin(a) * (half + 0.05), 0.6 + wallH - l / 2, Math.cos(a) * (half + 0.05)), ICE));
  }
  gymDoor(p, half, '#6a8aa0', '#e6f6ff');
  return p;
}

/** 飞行系道馆「云翎」：架高的圆形平台（立柱）+ 两侧展开的羽翼形屋顶 + 塔顶风标 */
export function gymFlying(w: number, h: number): PropParts {
  const p = newParts();
  const half = w / 2;
  gymBase(p, w, '#9a9aa8');
  const wallH = h * 0.42;
  p.solid.push(cyl(half * 0.82, half * 0.88, wallH, 18, '#f2f2f6', 0, 0.6, 0));
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    if (Math.cos(a) > 0.92) continue;
    p.glow.push(boxAt(1.0, wallH * 0.5, 0.1, '#cfe8f4', Math.sin(a) * (half * 0.85 + 0.05), 0.6 + wallH * 0.3, Math.cos(a) * (half * 0.85 + 0.05), a));
  }
  // 羽翼屋顶：每侧 5 片羽板，从中央塔向外后方扇形展开，轻微上扬
  for (const s of [-1, 1])
    for (let k = 0; k < 5; k++) {
      const L = half * (1.25 - k * 0.1);
      const fan = (k - 1) * 0.22; // 绕 y 的扇形角（向后掠）
      const lift = 0.12 + k * 0.04;
      const dx = Math.cos(fan) * (L / 2 + 1.2);
      const dz = -Math.sin(fan) * (L / 2 + 1.2);
      p.solid.push(boxAt(L, 0.3, 2.2 - k * 0.15, k % 2 ? '#4b8ac8' : '#5aa0dc', s * dx, 0.6 + wallH + 0.8 + k * 0.25 + (L / 2) * Math.sin(lift), dz, s * fan, 0, s * lift));
    }
  // 中央塔 + 风标
  p.solid.push(cyl(1.4, 1.8, h * 0.4, 10, '#e8e8ee', 0, 0.6 + wallH, 0));
  p.solid.push(paint(new THREE.ConeGeometry(2.2, 2.4, 10).translate(0, 0.6 + wallH + h * 0.4 + 1.2, 0), '#4b8ac8'));
  const vy = 0.6 + wallH + h * 0.4 + 2.4;
  p.solid.push(cyl(0.06, 0.06, 2.0, 4, '#3a3a40', 0, vy, 0));
  p.solid.push(boxAt(2.0, 0.5, 0.06, '#e8b73a', 0.4, vy + 1.6, 0));
  p.solid.push(paint(new THREE.ConeGeometry(0.3, 0.7, 4).rotateZ(-Math.PI / 2).translate(1.7, vy + 1.85, 0), '#e8b73a'));
  gymDoor(p, half * 0.85, '#3a5a80', '#bfe8ff');
  return p;
}

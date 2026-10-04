/**
 * M2 · 碧潮群岛专用构件（与 builders / townBuilders 同约定：局部坐标，y = 0 为地面，正面朝 +Z；
 * 输出带顶点色的非索引几何体，solid = Toon 场景材质，glow = 夜间 / 自发光部件）。
 *
 * - 碧潮镇：巨树（根拱 + 多层树冠 + 环树平台）、树屋、吊桥、藤蔓封锁
 * - 矿石镇：土坯矿工屋、矿井井架、矿车轨道、矿车、矿石堆
 * - 火山镇：黑曜石屋（熔岩缝发光）、熔岩喷口、玄武岩柱
 * - 温泉乡：汤屋（曲檐瓦顶）、温泉池石圈、牌坊、石灯笼、竹篱
 * - 道馆：草（树冠穹顶）/ 岩（石堡）/ 火（黑曜石阶梯塔）
 * - 遗迹：残柱、拱门、石碑；海域：珊瑚丛、沉船
 */
import * as THREE from 'three';
import { box, cyl, paint, type PropParts } from './builders';
import { beam, boxAt, doorAt, gable, hip, rng, shade, sphere, V, windowAt, evenly, windowCount } from './townBuilders';

const newParts = (): PropParts => ({ solid: [], glow: [] });
const WARM = '#ffd59a';
const LAVA = '#ff7a2a';

/** 不规则岩块（低多边形） */
function rock(r: number, color: string, x: number, y: number, z: number, rand: () => number, sy = 0.75): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const k = 0.82 + rand() * 0.36;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * sy, pos.getZ(i) * k);
  }
  return paint(g.translate(x, y + r * sy * 0.6, z), color);
}

// ———————————————————————— 碧潮镇 ————————————————————————

/**
 * 巨树：粗壮主干（底部张开成根拱）、6 条拱起的大根、分叉主枝、多层扁平树冠团，
 * 主干上两圈环形平台（扶栏 + 支撑斜撑）和螺旋木梯，挂灯笼（glow）。
 */
export function giantTree(h: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const bark = '#6b4a32';
  const barkDark = '#563a26';
  const trunkR = h * 0.13;
  // 主干：分段圆柱，底部外张
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const rb = trunkR * (1.0 + Math.max(0, 0.35 - t0) * 2.2) * (1 - t0 * 0.35);
    const rt = trunkR * (1.0 + Math.max(0, 0.35 - t1) * 2.2) * (1 - t1 * 0.35);
    p.solid.push(cyl(rt, rb, (h * 0.62) / segs + 0.05, 12, i % 2 ? bark : barkDark, 0, t0 * h * 0.62, 0));
  }
  // 树皮纵纹
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    p.solid.push(boxAt(0.35, h * 0.5, 0.3, barkDark, Math.sin(a) * trunkR * 1.02, h * 0.28, Math.cos(a) * trunkR * 1.02, a));
  }
  // 拱起的大根：从主干向外弯成拱再扎进地面
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r() * 0.4;
    const reach = trunkR * (2.4 + r() * 0.9);
    let prev = V(Math.sin(a) * trunkR * 0.9, trunkR * 1.4, Math.cos(a) * trunkR * 0.9);
    for (let s = 1; s <= 5; s++) {
      const t = s / 5;
      const d = trunkR * 0.9 + (reach - trunkR * 0.9) * t;
      const y = trunkR * 1.4 * (1 - t) + Math.sin(t * Math.PI) * trunkR * 0.9 - t * 0.6;
      const cur = V(Math.sin(a) * d, Math.max(-0.4, y), Math.cos(a) * d);
      p.solid.push(beam(prev, cur, trunkR * (0.42 - t * 0.26), s % 2 ? bark : barkDark, 7));
      prev = cur;
    }
  }
  // 主枝 + 树冠团
  const crownY = h * 0.62;
  const greens = ['#2f7a46', '#3a8a50', '#27693c', '#45975a'];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + r() * 0.5;
    const len = h * (0.28 + r() * 0.1);
    const end = V(Math.sin(a) * len, crownY + h * (0.12 + r() * 0.1), Math.cos(a) * len);
    p.solid.push(beam(V(0, crownY - h * 0.05, 0), end, trunkR * 0.32, bark, 7));
    for (let c = 0; c < 3; c++) {
      p.solid.push(sphere(h * (0.13 + r() * 0.06), greens[Math.floor(r() * greens.length)]!, end.x + (r() - 0.5) * h * 0.12, end.y + h * 0.04 + r() * h * 0.04, end.z + (r() - 0.5) * h * 0.12, 1.25, 0.55, 1.25, 1));
    }
  }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    p.solid.push(sphere(h * 0.2, greens[k % greens.length]!, Math.sin(a) * h * 0.12, crownY + h * 0.3, Math.cos(a) * h * 0.12, 1.3, 0.6, 1.3, 1));
  }
  p.solid.push(sphere(h * 0.22, greens[0]!, 0, crownY + h * 0.4, 0, 1.2, 0.55, 1.2, 1));
  // 垂挂的气根 / 藤
  for (let k = 0; k < 16; k++) {
    const a = r() * Math.PI * 2;
    const d = h * (0.18 + r() * 0.2);
    const y0 = crownY + h * 0.06;
    p.solid.push(cyl(0.06, 0.06, h * (0.12 + r() * 0.18), 4, '#5f8a3a', Math.sin(a) * d, y0 - h * 0.25, Math.cos(a) * d));
  }
  // 环树平台（两层）
  for (const [lvl, ry] of [[0, h * 0.2], [1, h * 0.42]] as const) {
    const ringR = trunkR * (lvl === 0 ? 2.1 : 1.65) + 2.2;
    p.solid.push(paint(new THREE.CylinderGeometry(ringR, ringR, 0.35, 20, 1, false).translate(0, ry, 0), '#a0784e'));
    // 扶栏
    p.solid.push(paint(new THREE.TorusGeometry(ringR - 0.1, 0.07, 4, 28).rotateX(Math.PI / 2).translate(0, ry + 1.05, 0), '#7a5a38'));
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      p.solid.push(cyl(0.06, 0.06, 1.0, 4, '#7a5a38', Math.sin(a) * (ringR - 0.1), ry + 0.15, Math.cos(a) * (ringR - 0.1)));
    }
    // 斜撑
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      p.solid.push(beam(V(Math.sin(a) * trunkR * 0.9, ry - 3.2, Math.cos(a) * trunkR * 0.9), V(Math.sin(a) * (ringR - 0.4), ry - 0.1, Math.cos(a) * (ringR - 0.4)), 0.14, '#7a5a38', 5));
    }
    // 灯笼
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const lx = Math.sin(a) * (ringR + 0.1);
      const lz = Math.cos(a) * (ringR + 0.1);
      p.solid.push(cyl(0.02, 0.02, 0.5, 3, '#3a2a1c', lx, ry + 0.6, lz));
      p.glow.push(sphere(0.24, WARM, lx, ry + 0.45, lz, 1, 1.25, 1, 1));
    }
  }
  // 螺旋木梯（地面 → 一层平台）
  const stairs = 26;
  for (let i = 0; i < stairs; i++) {
    const t = i / stairs;
    const a = t * Math.PI * 1.6;
    const sr = trunkR * 1.25 + 1.1;
    p.solid.push(boxAt(1.4, 0.16, 0.6, '#a0784e', Math.sin(a) * sr, t * h * 0.2 + 0.1, Math.cos(a) * sr, a + Math.PI / 2));
  }
  // 树洞门（发光）
  p.solid.push(boxAt(2.4, 3.2, 0.5, '#4a3020', 0, 1.6, trunkR * 1.75));
  p.glow.push(boxAt(1.7, 2.6, 0.2, WARM, 0, 1.4, trunkR * 1.98));
  return p;
}

/** 树屋：四根原木桩撑起的平台 + 小屋（圆木墙、草顶） + 绳梯 */
export function treehouse(w: number, h: number, d: number, deckY: number, roof: string, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const log = '#8a6644';
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(cyl(0.32, 0.4, deckY + 0.1, 7, log, sx * (w / 2 - 0.4), 0, sz * (d / 2 - 0.4)));
  // 交叉斜撑
  for (const sz of [-1, 1]) {
    p.solid.push(beam(V(-w / 2 + 0.4, 0.6, sz * (d / 2 - 0.4)), V(w / 2 - 0.4, deckY - 0.4, sz * (d / 2 - 0.4)), 0.1, log, 4));
    p.solid.push(beam(V(w / 2 - 0.4, 0.6, sz * (d / 2 - 0.4)), V(-w / 2 + 0.4, deckY - 0.4, sz * (d / 2 - 0.4)), 0.1, log, 4));
  }
  p.solid.push(box(w + 1.2, 0.3, d + 1.2, '#a0784e', 0, deckY - 0.3, 0));
  for (let k = -w / 2 - 0.6; k < w / 2 + 0.6; k += 0.5) p.solid.push(box(0.04, 0.32, d + 1.24, '#8a6644', k, deckY - 0.31, 0));
  // 扶栏
  for (const sz of [-1, 1]) p.solid.push(box(w + 1.2, 0.1, 0.1, log, 0, deckY + 0.9, sz * (d / 2 + 0.55)));
  for (const sx of [-1, 1]) p.solid.push(box(0.1, 0.1, d + 1.2, log, sx * (w / 2 + 0.55), deckY + 0.9, 0));
  // 小屋：圆木墙
  const hw = w - 0.6;
  const hd = d - 0.8;
  const wallH = h * 0.55;
  for (let y = 0; y < wallH; y += 0.42) {
    for (const sz of [-1, 1]) p.solid.push(paint(new THREE.CylinderGeometry(0.21, 0.21, hw + 0.3, 6).rotateZ(Math.PI / 2).translate(0, deckY + y + 0.21, (sz * hd) / 2), y % 0.84 < 0.42 ? '#9b7653' : '#8a6644'));
    for (const sx of [-1, 1]) p.solid.push(paint(new THREE.CylinderGeometry(0.21, 0.21, hd + 0.3, 6).rotateX(Math.PI / 2).translate((sx * hw) / 2, deckY + y + 0.21, 0), '#8a6644'));
  }
  // 草顶（四坡 + 毛边）
  hip(p, hw, h - wallH, hd, deckY + wallH, roof, 0.7);
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    p.solid.push(boxAt(0.5, 0.25, 0.12, shade(roof, -0.12), Math.sin(a) * (hw / 2 + 0.6), deckY + wallH - 0.05, Math.cos(a) * (hd / 2 + 0.6), a));
  }
  doorAt(p, hw, hd, 0, { color: '#5a3e2b', canopy: null, frame: '#5a3e2b', y: deckY });
  windowAt(p, 'left', hw, hd, 0, deckY + wallH * 0.45, { shutters: '#6aa56b', frame: '#5a3e2b', warm: true });
  windowAt(p, 'right', hw, hd, 0, deckY + wallH * 0.45, { shutters: '#6aa56b', frame: '#5a3e2b', warm: true });
  // 绳梯
  for (const sx of [-0.4, 0.4]) p.solid.push(cyl(0.04, 0.04, deckY, 4, '#c9b48a', sx, 0, d / 2 + 0.7));
  for (let y = 0.4; y < deckY; y += 0.45) p.solid.push(box(0.9, 0.08, 0.12, '#a0784e', 0, y, d / 2 + 0.7));
  // 花盆 / 晾晒的草药
  for (let k = 0; k < 3; k++) p.solid.push(sphere(0.25, ['#6aa84f', '#f26b8a', '#f7d046'][k]!, -w / 2 + 0.2 + k * 0.6, deckY + 0.3, d / 2 + 0.3, 1, 0.8, 1, 0));
  void r;
  return p;
}

/** 吊桥：points 为 [x, y, z]（局部）折线；木板 + 两侧扶绳 + 垂绳 */
export function ropeBridge(points: ReadonlyArray<readonly [number, number, number]>): PropParts {
  const p = newParts();
  for (let s = 0; s + 1 < points.length; s++) {
    const a = V(...points[s]!);
    const b = V(...points[s + 1]!);
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const n = Math.max(2, Math.floor(len / 0.5));
    const sag = Math.min(1.2, len * 0.06);
    const at = (t: number) => a.clone().lerp(b, t).add(V(0, -Math.sin(t * Math.PI) * sag, 0));
    for (let i = 0; i < n; i++) {
      const c = at((i + 0.5) / n);
      p.solid.push(boxAt(1.6, 0.08, 0.38, i % 3 ? '#a0784e' : '#8a6644', c.x, c.y, c.z, yaw));
    }
    const side = V(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(0.85);
    for (const s2 of [-1, 1]) {
      let prev = at(0).add(side.clone().multiplyScalar(s2)).add(V(0, 1.0, 0));
      for (let i = 1; i <= 8; i++) {
        const cur = at(i / 8).add(side.clone().multiplyScalar(s2)).add(V(0, 1.0, 0));
        p.solid.push(beam(prev, cur, 0.04, '#c9b48a', 3));
        const foot = at(i / 8).add(side.clone().multiplyScalar(s2));
        p.solid.push(beam(foot, cur, 0.025, '#c9b48a', 3));
        prev = cur;
      }
    }
  }
  return p;
}

/** 藤蔓封锁：一面粗藤交织的墙（宽 w、高 h），叶片与紫色小花 */
export function vineWall(w: number, h: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const vine = ['#3c6b2c', '#4a7d33', '#355e27'];
  for (let k = 0; k < 14; k++) {
    let prev = V((r() - 0.5) * w, 0, (r() - 0.5) * 0.8);
    for (let s = 1; s <= 6; s++) {
      const cur = V(prev.x + (r() - 0.5) * w * 0.35, (s / 6) * h * (0.8 + r() * 0.3), (r() - 0.5) * 1.0);
      p.solid.push(beam(prev, cur, 0.12 + r() * 0.08, vine[k % 3]!, 5));
      prev = cur;
    }
  }
  for (let k = 0; k < 70; k++) {
    const x = (r() - 0.5) * w;
    const y = r() * h;
    const z = (r() - 0.5) * 1.1;
    p.solid.push(paint(new THREE.CircleGeometry(0.28 + r() * 0.15, 5).rotateY(r() * Math.PI).rotateX((r() - 0.5) * 1.2).translate(x, y, z), r() > 0.5 ? '#5c9a48' : '#6fb257'));
    if (r() > 0.85) p.solid.push(sphere(0.09, '#b98cf0', x, y + 0.1, z + 0.1, 1, 1, 1, 0));
  }
  return p;
}

// ———————————————————————— 矿石镇 ————————————————————————

/** 土坯矿工屋：赭色抹灰墙、平顶 + 外伸木椽、木格窗、门口矿灯 */
export function adobeHouse(w: number, h: number, d: number, wall: string, accent: string, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const y0 = 0.35;
  p.solid.push(box(w + 0.3, y0, d + 0.3, '#8a6a4a'));
  p.solid.push(box(w, h - y0, d, wall, 0, y0, 0));
  // 抹灰色斑
  for (let k = 0; k < 10; k++) {
    const face = Math.floor(r() * 4);
    const u = (r() - 0.5) * (face < 2 ? w : d) * 0.8;
    const y = y0 + 0.4 + r() * (h - 1.4);
    const c = shade(wall, (r() - 0.5) * 0.08);
    if (face === 0) p.solid.push(box(0.8 + r(), 0.5 + r() * 0.5, 0.04, c, u, y, d / 2 + 0.01));
    else if (face === 1) p.solid.push(box(0.8 + r(), 0.5 + r() * 0.5, 0.04, c, u, y, -d / 2 - 0.01));
    else p.solid.push(box(0.04, 0.5 + r() * 0.5, 0.8 + r(), c, (face === 2 ? -1 : 1) * (w / 2 + 0.01), y, u));
  }
  // 女儿墙与木椽
  p.solid.push(box(w + 0.2, 0.45, d + 0.2, shade(wall, -0.06), 0, h, 0));
  p.solid.push(box(w - 0.4, 0.1, d - 0.4, '#7a6a58', 0, h + 0.1, 0));
  for (const u of evenly(w, Math.max(3, Math.round(w / 1.3)))) p.solid.push(paint(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6).rotateX(Math.PI / 2).translate(u, h - 0.25, d / 2 + 0.4), '#6b4a33'));
  // 门 + 木门楣 + 矿灯
  doorAt(p, w, d, w > 7 ? -w * 0.15 : 0, { color: '#6b4a33', canopy: null, frame: '#4a3020' });
  p.solid.push(box(2.0, 0.25, 0.4, '#5a3e2b', w > 7 ? -w * 0.15 : 0, y0 + 2.5, d / 2 + 0.2));
  p.solid.push(cyl(0.05, 0.05, 0.6, 4, '#333', (w > 7 ? -w * 0.15 : 0) + 1.2, y0 + 2.0, d / 2 + 0.35));
  p.glow.push(sphere(0.2, WARM, (w > 7 ? -w * 0.15 : 0) + 1.2, y0 + 1.95, d / 2 + 0.35, 1, 1.2, 1, 1));
  for (const u of evenly(w, windowCount(w, 3), true)) windowAt(p, 'front', w, d, u, y0 + 1.2, { shutters: accent, frame: '#5a3e2b', warm: true, rand: r, size: [0.9, 1.0] });
  for (const face of ['left', 'right', 'back'] as const) for (const u of evenly(face === 'back' ? w : d, windowCount(face === 'back' ? w : d, 3.4))) windowAt(p, face, w, d, u, y0 + 1.2, { frame: '#5a3e2b', size: [0.8, 0.9] });
  // 屋顶上的水桶 / 工具箱
  p.solid.push(cyl(0.45, 0.45, 0.9, 8, '#7a5a38', w * 0.25, h + 0.2, -d * 0.2));
  p.solid.push(box(1.2, 0.6, 0.8, '#5a6a7a', -w * 0.25, h + 0.2, -d * 0.25));
  return p;
}

/** 矿井井架：四柱桁架塔 + 顶部天轮 + 吊笼 + 斜拉杆 */
export function headframe(w: number, h: number): PropParts {
  const p = newParts();
  const steel = '#6a5a4a';
  const half = w / 2;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(beam(V(sx * half, 0, sz * half), V(sx * half * 0.55, h, sz * half * 0.55), 0.18, steel, 6));
  for (let y = 2; y < h; y += 2.4) {
    const k = 1 - (y / h) * 0.45;
    for (const s of [-1, 1]) {
      p.solid.push(box(w * k, 0.14, 0.14, steel, 0, y, s * half * k));
      p.solid.push(box(0.14, 0.14, w * k, steel, s * half * k, y, 0));
    }
    const k2 = 1 - ((y + 2.4) / h) * 0.45;
    p.solid.push(beam(V(-half * k, y, half * k), V(half * k2, Math.min(h, y + 2.4), half * k2), 0.06, steel, 4));
    p.solid.push(beam(V(half * k, y, -half * k), V(-half * k2, Math.min(h, y + 2.4), -half * k2), 0.06, steel, 4));
  }
  // 天轮
  p.solid.push(paint(new THREE.TorusGeometry(1.4, 0.12, 6, 18).translate(0, h + 1.0, 0), '#c8503c'));
  for (let k = 0; k < 6; k++) p.solid.push(boxAt(0.08, 2.8, 0.08, '#c8503c', 0, h + 1.0, 0, 0, 0, (k / 6) * Math.PI));
  p.solid.push(box(w * 0.6, 0.3, 0.5, steel, 0, h - 0.1, 0));
  // 吊笼与钢缆
  p.solid.push(cyl(0.03, 0.03, h - 2.4, 3, '#333', 0, 2.6, 0.2));
  p.solid.push(box(1.6, 2.2, 1.6, '#8a7a6a', 0, 0.4, 0));
  p.solid.push(box(1.7, 0.12, 1.7, '#5a4a3a', 0, 2.6, 0));
  // 斜拉支撑
  p.solid.push(beam(V(0, h * 0.85, 0), V(0, 0, -h * 0.5), 0.2, steel, 6));
  p.glow.push(sphere(0.25, '#ffcf7a', half * 0.55, h - 0.4, half * 0.55, 1, 1, 1, 1));
  return p;
}

/** 矿车轨道段：沿局部 z 长 len 米（枕木 + 两条钢轨） */
export function railTrack(len: number): PropParts {
  const p = newParts();
  for (let z = -len / 2 + 0.3; z < len / 2; z += 0.75) p.solid.push(box(1.6, 0.12, 0.28, '#6b4a33', 0, 0, z));
  for (const s of [-1, 1]) p.solid.push(box(0.1, 0.14, len, '#8a8f96', s * 0.55, 0.12, 0));
  return p;
}

/** 矿车：铁斗 + 四轮 + 满载矿石（赭 / 灰 / 少量发光的异变矿晶） */
export function mineCart(seed = 1, glowing = false): PropParts {
  const p = newParts();
  const r = rng(seed);
  p.solid.push(box(1.3, 0.9, 1.9, '#6a6e74', 0, 0.35, 0));
  p.solid.push(box(1.45, 0.12, 2.05, '#4a4e54', 0, 1.2, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(paint(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 10).rotateZ(Math.PI / 2).translate(sx * 0.6, 0.28, sz * 0.65), '#333'));
  for (let k = 0; k < 8; k++) p.solid.push(rock(0.28 + r() * 0.12, ['#b07a4a', '#8a8580', '#c49a5a'][k % 3]!, (r() - 0.5) * 0.8, 1.05, (r() - 0.5) * 1.3, r));
  if (glowing) p.glow.push(paint(new THREE.OctahedronGeometry(0.22).scale(1, 1.8, 1).translate(0.2, 1.55, 0.1), '#c06cff'));
  return p;
}

/** 矿石堆 */
export function orePile(w: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  for (let k = 0; k < 9; k++) p.solid.push(rock(w * (0.18 + r() * 0.12), ['#b07a4a', '#8a8580', '#c49a5a', '#9a6a3a'][k % 4]!, (r() - 0.5) * w * 0.7, 0, (r() - 0.5) * w * 0.7, r));
  return p;
}

// ———————————————————————— 火山镇 ————————————————————————

/** 黑曜石屋：玄武岩块墙、墙缝透出熔岩光（glow）、陡坡铁瓦屋顶、石烟囱冒火光 */
export function obsidianHouse(w: number, h: number, d: number, roof: string, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const y0 = 0.4;
  const wallH = h * 0.6;
  p.solid.push(box(w + 0.5, y0, d + 0.5, '#3a3436'));
  // 石块墙（交错砌筑）
  const rows = Math.round(wallH / 0.7);
  for (let i = 0; i < rows; i++) {
    const y = y0 + i * (wallH / rows);
    const bh = wallH / rows - 0.06;
    p.solid.push(box(w, bh, d, i % 2 ? '#3d3638' : '#2f2a2c', 0, y, 0));
    // 墙缝熔岩光：每层之间一条细发光线（只在正面与两侧的部分段落）
    if (i > 0 && r() > 0.35) p.glow.push(box(w * (0.3 + r() * 0.5), 0.05, 0.04, LAVA, (r() - 0.5) * w * 0.4, y - 0.03, d / 2 + 0.01));
  }
  // 转角大石
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) for (let y = y0; y < y0 + wallH; y += 0.9) p.solid.push(box(0.6, 0.8, 0.6, '#4a4245', (sx * w) / 2, y, (sz * d) / 2));
  gable(p, w, h - wallH - y0, d, y0 + wallH, roof, '#2f2a2c', 0.5, '#5a4a40');
  doorAt(p, w, d, 0, { color: '#5a2e1e', canopy: roof, frame: '#5a4a40' });
  for (const u of evenly(w, windowCount(w, 3), true)) windowAt(p, 'front', w, d, u, y0 + wallH * 0.35, { frame: '#5a4a40', warm: true, size: [0.9, 1.0] });
  for (const face of ['left', 'right'] as const) for (const u of evenly(d, windowCount(d, 3.4))) windowAt(p, face, w, d, u, y0 + wallH * 0.35, { frame: '#5a4a40', warm: true, size: [0.8, 0.9] });
  // 石烟囱 + 火光
  const cx = w * 0.28;
  p.solid.push(box(1.0, h * 0.6, 1.0, '#3a3436', cx, y0 + wallH, -d * 0.2));
  p.glow.push(box(0.6, 0.15, 0.6, LAVA, cx, y0 + wallH + h * 0.6, -d * 0.2));
  return p;
}

/** 熔岩喷口：玄武岩环 + 发光熔岩池 + 裂纹 */
export function lavaVent(w: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    p.solid.push(rock(w * 0.16 + r() * 0.2, '#2f2a2c', Math.sin(a) * w * 0.48, 0, Math.cos(a) * w * 0.48, r, 0.9));
  }
  p.glow.push(paint(new THREE.CircleGeometry(w * 0.42, 14).rotateX(-Math.PI / 2).translate(0, 0.18, 0), LAVA));
  p.glow.push(paint(new THREE.CircleGeometry(w * 0.2, 10).rotateX(-Math.PI / 2).translate(0, 0.2, 0), '#ffd04a'));
  for (let k = 0; k < 5; k++) {
    const a = r() * Math.PI * 2;
    p.glow.push(boxAt(0.12, 0.04, w * (0.5 + r() * 0.6), LAVA, Math.sin(a) * w * 0.7, 0.03, Math.cos(a) * w * 0.7, a));
  }
  return p;
}

/** 玄武岩柱群（六棱柱，高低错落） */
export function basaltColumns(w: number, h: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const n = 7 + Math.floor(r() * 5);
  for (let k = 0; k < n; k++) {
    const x = (r() - 0.5) * w;
    const z = (r() - 0.5) * w;
    const ch = h * (0.4 + r() * 0.6);
    p.solid.push(paint(new THREE.CylinderGeometry(0.55, 0.6, ch, 6).translate(x, ch / 2, z), r() > 0.5 ? '#3a3436' : '#2c2729'));
    p.solid.push(paint(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 6).translate(x, ch + 0.02, z), '#4d4447'));
  }
  return p;
}

// ———————————————————————— 温泉乡 ————————————————————————

/** 汤屋 / 旅馆：木构白墙、曲檐瓦顶（两层檐）、檐下灯笼、门帘 */
export function onsenHouse(w: number, h: number, d: number, wall: string, roof: string, seed = 1, curtain = '#2f5d8a'): PropParts {
  const p = newParts();
  const r = rng(seed);
  const y0 = 0.5;
  const wallH = h * 0.55;
  p.solid.push(box(w + 1.2, y0, d + 1.2, '#8a8078'));
  // 木框架 + 白墙
  p.solid.push(box(w, wallH, d, wall, 0, y0, 0));
  for (const u of evenly(w, Math.max(3, Math.round(w / 1.6)))) for (const s of [-1, 1]) p.solid.push(box(0.18, wallH, 0.1, '#6b4a33', u, y0, s * (d / 2 + 0.03)));
  for (const u of evenly(d, Math.max(3, Math.round(d / 1.6)))) for (const s of [-1, 1]) p.solid.push(box(0.1, wallH, 0.18, '#6b4a33', s * (w / 2 + 0.03), y0, u));
  p.solid.push(box(w + 0.1, 0.2, d + 0.1, '#6b4a33', 0, y0 + wallH * 0.5, 0));
  // 下檐（四周外挑） + 上层四坡顶，檐角上翘
  const ey = y0 + wallH;
  p.solid.push(boxAt(w + 2.6, 0.22, d + 2.6, roof, 0, ey + 0.1, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) p.solid.push(boxAt(0.5, 0.2, 1.4, roof, sx * (w / 2 + 1.2), ey + 0.35, sz * (d / 2 + 1.2), Math.atan2(sx, sz), 0.4));
  hip(p, w * 0.82, h - wallH - y0, d * 0.82, ey + 0.2, roof, 0.9);
  p.solid.push(box(w * 0.5, 0.3, 0.3, shade(roof, -0.2), 0, h + 0.1, 0));
  // 门帘（暖帘）
  p.solid.push(box(2.6, 2.4, 0.16, '#4a3020', 0, y0, d / 2 + 0.05));
  for (let k = 0; k < 3; k++) p.solid.push(box(0.8, 1.0, 0.04, curtain, -0.85 + k * 0.85, y0 + 1.4, d / 2 + 0.16));
  p.glow.push(box(2.2, 1.3, 0.04, WARM, 0, y0 + 0.05, d / 2 + 0.14));
  // 纸窗（暖光）
  for (const face of ['left', 'right', 'back'] as const) for (const u of evenly(face === 'back' ? w : d, windowCount(face === 'back' ? w : d, 2.6))) windowAt(p, face, w, d, u, y0 + wallH * 0.3, { frame: '#6b4a33', warm: true, size: [1.2, 1.0], mullion: true });
  // 檐下灯笼
  for (const s of [-1, 1]) {
    p.solid.push(cyl(0.02, 0.02, 0.4, 3, '#3a2a1c', s * 2.0, ey - 0.6, d / 2 + 0.9));
    p.glow.push(sphere(0.3, '#ff9f5a', s * 2.0, ey - 0.85, d / 2 + 0.9, 1, 1.3, 1, 1));
  }
  void r;
  return p;
}

/** 温泉池石圈：大小卵石围成的椭圆（水面由 waterBodies 提供） */
export function springRim(w: number, d: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const n = Math.round((w + d) * 1.2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    p.solid.push(rock(0.45 + r() * 0.35, r() > 0.5 ? '#8a8580' : '#9a958d', Math.sin(a) * (w / 2), -0.2, Math.cos(a) * (d / 2), r, 0.6));
  }
  // 竹制注水口
  p.solid.push(beam(V(w / 2 + 0.8, 1.4, 0), V(w / 2 - 0.6, 1.0, 0), 0.09, '#9ab35a', 6));
  p.solid.push(cyl(0.12, 0.12, 1.4, 6, '#6b4a33', w / 2 + 0.8, 0, 0));
  return p;
}

/** 牌坊：两柱一楼（曲檐） */
export function pailou(w: number, h: number, color = '#b8442e'): PropParts {
  const p = newParts();
  for (const s of [-1, 1]) {
    p.solid.push(cyl(0.32, 0.36, h * 0.82, 10, color, (s * w) / 2, 0, 0));
    p.solid.push(box(1.1, 0.6, 1.1, '#8a8078', (s * w) / 2, 0, 0));
  }
  p.solid.push(box(w + 1.0, 0.45, 0.5, color, 0, h * 0.62, 0));
  p.solid.push(box(w * 0.5, 0.9, 0.16, '#2f5d8a', 0, h * 0.7, 0.26));
  p.solid.push(box(w + 1.6, 0.35, 0.7, color, 0, h * 0.82, 0));
  p.solid.push(boxAt(w + 3.0, 0.3, 1.8, '#3a3a3e', 0, h * 0.9, 0, 0, 0, 0));
  for (const s of [-1, 1]) p.solid.push(boxAt(1.0, 0.25, 1.6, '#3a3a3e', (s * (w + 3.0)) / 2, h * 0.93, 0, 0, 0, s * -0.35));
  p.solid.push(box(w + 1.4, 0.4, 0.3, '#2c2c30', 0, h * 0.97, 0));
  return p;
}

/** 石灯笼 */
export function stoneLantern(h: number): PropParts {
  const p = newParts();
  p.solid.push(cyl(0.5, 0.6, 0.3, 6, '#9a958d'));
  p.solid.push(cyl(0.18, 0.22, h * 0.45, 6, '#9a958d', 0, 0.3, 0));
  p.solid.push(box(0.8, 0.15, 0.8, '#8a8580', 0, 0.3 + h * 0.45, 0));
  p.solid.push(box(0.6, h * 0.22, 0.6, '#9a958d', 0, 0.45 + h * 0.45, 0));
  p.glow.push(box(0.4, h * 0.14, 0.64, WARM, 0, 0.5 + h * 0.45, 0));
  p.solid.push(paint(new THREE.ConeGeometry(0.75, 0.45, 6).translate(0, 0.45 + h * 0.67 + 0.22, 0), '#8a8580'));
  p.solid.push(sphere(0.12, '#8a8580', 0, 0.45 + h * 0.67 + 0.55, 0, 1, 1, 1, 0));
  return p;
}

/** 竹篱（沿局部 x 长 w） */
export function bambooFence(w: number, h: number): PropParts {
  const p = newParts();
  for (let x = -w / 2; x <= w / 2; x += 0.16) p.solid.push(cyl(0.06, 0.06, h * (0.92 + ((x * 7.3) % 1) * 0.08), 5, x % 0.32 < 0.16 ? '#9ab35a' : '#8aa34a', x, 0, 0));
  for (const y of [h * 0.3, h * 0.75]) p.solid.push(box(w, 0.08, 0.1, '#6b4a33', 0, y, 0.08));
  return p;
}

// ———————————————————————— 道馆外观 ————————————————————————

/** 草系道馆：巨木围成的圆厅，上方是叶片穹顶（多层树冠团），正门是藤蔓拱门 */
export function gymGrass(w: number, h: number): PropParts {
  const p = newParts();
  const r = rng(7);
  const R = w / 2;
  p.solid.push(cyl(R + 1.5, R + 2, 0.6, 12, '#8a7a5a'));
  p.solid.push(box(7, 0.3, 1.6, '#8a7a5a', 0, 0, R + 2.4));
  // 原木墙（竖立圆木一圈）
  const n = 30;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.22) continue;
    p.solid.push(cyl(0.55, 0.62, h * 0.5, 7, k % 2 ? '#7a5a38' : '#6b4a32', Math.sin(a) * R, 0.6, Math.cos(a) * R));
  }
  p.solid.push(cyl(R - 0.3, R - 0.3, h * 0.5, 16, '#e8dcc0', 0, 0.6, 0));
  p.solid.push(paint(new THREE.TorusGeometry(R, 0.45, 5, 30).rotateX(Math.PI / 2).translate(0, 0.6 + h * 0.5, 0), '#5a3e2b'));
  // 叶片穹顶
  const dy = 0.6 + h * 0.5;
  p.solid.push(paint(new THREE.SphereGeometry(R * 1.02, 20, 9, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, dy, 0), '#3a8a50'));
  for (let k = 0; k < 22; k++) {
    const a = r() * Math.PI * 2;
    const t = r() * 0.9;
    const rr = R * Math.cos(t * Math.PI * 0.5);
    p.solid.push(sphere(R * (0.22 + r() * 0.1), ['#2f7a46', '#45975a', '#27693c'][k % 3]!, Math.sin(a) * rr, dy + Math.sin(t * Math.PI * 0.5) * R * 0.7, Math.cos(a) * rr, 1.2, 0.6, 1.2, 1));
  }
  p.solid.push(sphere(R * 0.35, '#5fae5f', 0, dy + R * 0.75, 0, 1, 0.7, 1, 1));
  // 顶部嫩芽徽记（发光）
  p.glow.push(paint(new THREE.ConeGeometry(0.8, 2.2, 6).translate(0, dy + R * 1.05, 0), '#9cf07a'));
  // 藤蔓拱门
  const gz = R + 0.2;
  for (const s of [-1, 1]) p.solid.push(cyl(0.45, 0.55, 4.8, 7, '#6b4a32', s * 2.2, 0.6, gz));
  p.solid.push(paint(new THREE.TorusGeometry(2.2, 0.4, 6, 14, Math.PI).translate(0, 0.6 + 4.8, gz), '#4a7d33'));
  p.solid.push(box(3.2, 3.8, 0.2, '#3c6b2c', 0, 0.6, gz - 0.1));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI;
    p.solid.push(paint(new THREE.CircleGeometry(0.35, 5).translate(Math.cos(a) * 2.2, 0.6 + 4.8 + Math.sin(a) * 2.2, gz + 0.4), k % 2 ? '#5c9a48' : '#6fb257'));
  }
  // 两侧花坛与叶形旗
  for (const s of [-1, 1]) {
    p.solid.push(box(2.4, 0.6, 1.4, '#8a7a5a', s * 5.2, 0.6, R + 1.4));
    for (let k = 0; k < 5; k++) p.solid.push(sphere(0.3, ['#f26b8a', '#f7d046', '#b98cf0'][k % 3]!, s * 5.2 + (k - 2) * 0.4, 1.4, R + 1.4, 1, 0.8, 1, 0));
    p.solid.push(cyl(0.07, 0.07, 6, 5, '#d0d4d8', s * 3.4, 0.6, R + 2.8));
    p.solid.push(box(0.04, 2.4, 1.2, '#3a8a50', s * 3.4, 0.6 + 3.4, R + 3.4));
  }
  return p;
}

/** 岩石系道馆：粗石城堡式方厅、四角石塔、正门巨石门楣与锤形徽记 */
export function gymRock(w: number, h: number): PropParts {
  const p = newParts();
  const r = rng(11);
  const half = w / 2;
  p.solid.push(box(w + 3, 0.6, w + 3, '#7a6a58'));
  p.solid.push(box(7, 0.3, 1.6, '#7a6a58', 0, 0, half + 2.4));
  const wallH = h * 0.6;
  // 粗石墙：分层石块
  for (let y = 0.6; y < 0.6 + wallH; y += 1.0)
    for (const [face, len] of [['front', w], ['back', w], ['left', w], ['right', w]] as const) {
      for (let u = -len / 2 + 0.8; u < len / 2; u += 1.6) {
        if (face === 'front' && Math.abs(u) < 2.4 && y < 5) continue;
        const c = r() > 0.5 ? '#9a8a74' : '#8a7a64';
        const off = (Math.floor(y) % 2) * 0.8;
        const uu = Math.min(len / 2 - 0.8, u + off);
        if (face === 'front') p.solid.push(box(1.55, 0.95, 0.9, c, uu, y, half - 0.45));
        else if (face === 'back') p.solid.push(box(1.55, 0.95, 0.9, c, uu, y, -half + 0.45));
        else p.solid.push(box(0.9, 0.95, 1.55, c, (face === 'left' ? -1 : 1) * (half - 0.45), y, uu));
      }
    }
  p.solid.push(box(w - 1.6, wallH, w - 1.6, '#6a5a48', 0, 0.6, 0));
  // 雉堞
  for (let u = -half + 0.6; u < half; u += 1.6) {
    p.solid.push(box(0.9, 0.9, 0.9, '#8a7a64', u, 0.6 + wallH, half - 0.45));
    p.solid.push(box(0.9, 0.9, 0.9, '#8a7a64', u, 0.6 + wallH, -half + 0.45));
    p.solid.push(box(0.9, 0.9, 0.9, '#8a7a64', half - 0.45, 0.6 + wallH, u));
    p.solid.push(box(0.9, 0.9, 0.9, '#8a7a64', -half + 0.45, 0.6 + wallH, u));
  }
  // 四角石塔
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    p.solid.push(cyl(2.0, 2.3, h * 0.85, 8, '#8a7a64', sx * half, 0.6, sz * half));
    p.solid.push(paint(new THREE.ConeGeometry(2.6, h * 0.3, 8).translate(sx * half, 0.6 + h * 0.85 + h * 0.15, sz * half), '#7a4a32'));
    p.glow.push(box(0.6, 1.0, 0.1, WARM, sx * half, 0.6 + h * 0.55, sz * half + sz * 2.15));
  }
  // 中央屋顶：低四坡
  hip(p, w - 2, h * 0.25, w - 2, 0.6 + wallH, '#7a4a32', 0.4);
  // 正门：巨石门楣 + 木门 + 铁箍
  p.solid.push(box(1.4, 5.2, 1.4, '#6a5a48', -2.6, 0.6, half + 0.2));
  p.solid.push(box(1.4, 5.2, 1.4, '#6a5a48', 2.6, 0.6, half + 0.2));
  p.solid.push(box(7.0, 1.3, 1.6, '#5a4a3a', 0, 5.8, half + 0.2));
  p.solid.push(box(3.8, 4.6, 0.25, '#5a3e2b', 0, 0.6, half + 0.05));
  for (const y of [1.6, 3.2, 4.4]) p.solid.push(box(3.9, 0.12, 0.3, '#3a3a3e', 0, 0.6 + y, half + 0.1));
  // 锤形徽记
  p.solid.push(box(0.3, 1.6, 0.2, '#c49a5a', 0, 6.0, half + 1.05));
  p.solid.push(box(1.4, 0.6, 0.3, '#c49a5a', 0, 7.0, half + 1.05));
  // 门前石狮（简化为岩块蹲兽）
  for (const s of [-1, 1]) {
    p.solid.push(box(1.4, 1.0, 1.8, '#8a7a64', s * 5, 0.6, half + 2.2));
    p.solid.push(rock(0.7, '#9a8a74', s * 5, 1.6, half + 2.6, r, 0.9));
  }
  return p;
}

/** 火系道馆：黑曜石阶梯塔（三层收分），每层檐口熔岩光带，塔顶火盆，门前火焰柱 */
export function gymFire(w: number, h: number): PropParts {
  const p = newParts();
  const r = rng(13);
  const half = w / 2;
  p.solid.push(box(w + 3, 0.6, w + 3, '#2f2a2c'));
  p.solid.push(box(7, 0.3, 1.6, '#2f2a2c', 0, 0, half + 2.4));
  let y = 0.6;
  const tiers = [[w, h * 0.38], [w * 0.74, h * 0.28], [w * 0.5, h * 0.2]] as const;
  for (const [tw, th] of tiers) {
    p.solid.push(box(tw, th, tw, '#3a3436', 0, y, 0));
    // 竖向石棱
    for (const u of evenly(tw, Math.max(3, Math.round(tw / 2.2)))) for (const s of [-1, 1]) {
      p.solid.push(box(0.4, th, 0.3, '#2c2729', u, y, s * (tw / 2 + 0.1)));
      p.solid.push(box(0.3, th, 0.4, '#2c2729', s * (tw / 2 + 0.1), y, u));
    }
    p.solid.push(box(tw + 1.0, 0.35, tw + 1.0, '#4d4447', 0, y + th, 0));
    p.glow.push(box(tw + 1.02, 0.12, tw + 1.02, LAVA, 0, y + th - 0.1, 0));
    y += th + 0.35;
  }
  // 塔顶火盆
  p.solid.push(cyl(1.6, 1.0, 1.0, 8, '#4d4447', 0, y, 0));
  p.glow.push(paint(new THREE.ConeGeometry(1.2, 2.6, 7).translate(0, y + 2.2, 0), '#ff9a3a'));
  p.glow.push(paint(new THREE.ConeGeometry(0.7, 1.8, 6).translate(0, y + 2.0, 0), '#ffd04a'));
  // 正门：尖拱 + 熔岩光门缝
  const gz = half + 0.1;
  p.solid.push(box(5.6, 5.4, 1.2, '#2c2729', 0, 0.6, gz));
  p.solid.push(paint(new THREE.ConeGeometry(2.9, 2.2, 4).rotateY(Math.PI / 4).scale(1, 1, 0.4).translate(0, 0.6 + 5.4 + 1.1, gz), '#2c2729'));
  p.solid.push(box(3.4, 4.4, 0.2, '#5a2e1e', 0, 0.6, gz + 0.62));
  p.glow.push(box(0.1, 4.4, 0.22, LAVA, 0, 0.6, gz + 0.64));
  p.glow.push(paint(new THREE.CircleGeometry(0.7, 6).translate(0, 0.6 + 5.0, gz + 0.62), '#ff9a3a'));
  // 门前火焰柱
  for (const s of [-1, 1]) {
    p.solid.push(cyl(0.6, 0.8, 3.4, 6, '#3a3436', s * 5.0, 0.6, half + 2.2));
    p.glow.push(paint(new THREE.ConeGeometry(0.55, 1.6, 6).translate(s * 5.0, 0.6 + 3.4 + 0.8, half + 2.2), '#ff7a2a'));
    p.solid.push(rock(0.6, '#2f2a2c', s * 6.6, 0.6, half + 1.0, r, 0.8));
  }
  return p;
}

// ———————————————————————— 遗迹 / 海域 ————————————————————————

/** 遗迹残柱（断裂、带纹样、可选紫色异变晶体） */
export function ruinPillar(h: number, seed = 1, anomaly = false): PropParts {
  const p = newParts();
  const r = rng(seed);
  const stone = '#b8ae9c';
  p.solid.push(box(1.6, 0.5, 1.6, '#a49a88'));
  const ch = h * (0.5 + r() * 0.5);
  p.solid.push(cyl(0.55, 0.62, ch, 8, stone, 0, 0.5, 0));
  for (let y = 1.2; y < ch; y += 1.4) p.solid.push(cyl(0.64, 0.64, 0.14, 8, '#9a907e', 0, 0.5 + y, 0));
  // 断口斜面
  p.solid.push(boxAt(1.2, 0.3, 1.2, stone, 0, 0.5 + ch, 0, r() * 3, 0.25, 0.1));
  if (ch > h * 0.85) p.solid.push(box(1.5, 0.45, 1.5, '#a49a88', 0, 0.5 + ch, 0));
  // 青苔
  for (let k = 0; k < 4; k++) p.solid.push(sphere(0.25, '#6a8a4a', Math.sin(k) * 0.55, 0.6 + r() * ch * 0.5, Math.cos(k) * 0.55, 1, 0.5, 1, 0));
  if (anomaly) p.glow.push(paint(new THREE.OctahedronGeometry(0.35).scale(1, 2, 1).translate(0.7, 0.9, 0.3), '#c06cff'));
  // 散落石块
  for (let k = 0; k < 3; k++) p.solid.push(rock(0.3 + r() * 0.2, stone, (r() - 0.5) * 3, 0, (r() - 0.5) * 3, r));
  return p;
}

/** 遗迹拱门：两根方柱 + 浮雕横梁（异变纹样发紫光） */
export function ruinArch(w: number, h: number): PropParts {
  const p = newParts();
  for (const s of [-1, 1]) {
    p.solid.push(box(1.4, h, 1.4, '#b8ae9c', (s * w) / 2, 0, 0));
    p.solid.push(box(1.8, 0.6, 1.8, '#a49a88', (s * w) / 2, 0, 0));
  }
  p.solid.push(box(w + 2.2, 1.2, 1.6, '#a49a88', 0, h, 0));
  for (let k = 0; k < 5; k++) p.glow.push(box(0.5, 0.5, 0.06, '#b07cff', -w / 2 + (k + 0.5) * (w / 5), h + 0.35, 0.82));
  return p;
}

/** 石碑（古代文字，刻纹发微光） */
export function stele(h: number): PropParts {
  const p = newParts();
  p.solid.push(box(2.0, 0.5, 1.2, '#8a8580'));
  p.solid.push(box(1.4, h, 0.4, '#a49a88', 0, 0.5, 0));
  p.solid.push(paint(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.5 + h, 0), '#a49a88'));
  for (let k = 0; k < 6; k++) p.glow.push(box(0.9 - (k % 2) * 0.3, 0.08, 0.04, '#8fd3ff', 0, 0.9 + k * (h / 7), 0.22));
  return p;
}

/** 珊瑚丛（浅水装饰） */
export function coral(w: number, seed = 1): PropParts {
  const p = newParts();
  const r = rng(seed);
  const colors = ['#ff7f7f', '#ff9fd0', '#ffb347', '#9f7fff', '#7fd6ff'];
  for (let k = 0; k < 9; k++) {
    const x = (r() - 0.5) * w;
    const z = (r() - 0.5) * w;
    const c = colors[Math.floor(r() * colors.length)]!;
    if (r() > 0.5) {
      // 鹿角珊瑚
      const base = V(x, 0, z);
      for (let b = 0; b < 4; b++) {
        const tip = V(x + (r() - 0.5) * 1.2, 0.8 + r() * 0.8, z + (r() - 0.5) * 1.2);
        p.solid.push(beam(base, tip, 0.1, c, 5));
        p.solid.push(sphere(0.13, shade(c, 0.1), tip.x, tip.y, tip.z, 1, 1, 1, 0));
      }
    } else p.solid.push(sphere(0.35 + r() * 0.3, c, x, 0.25, z, 1, 0.6, 1, 1)); // 脑珊瑚
  }
  return p;
}

/** 沉船：倾斜的船身半埋在沙里、断桅、破帆 */
export function shipwreck(w: number, d: number): PropParts {
  const p = newParts();
  const tilt = 0.32;
  const hull = new THREE.CylinderGeometry(w / 2, w / 2.6, d, 10, 1, true, Math.PI * 0.5, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI);
  p.solid.push(paint(hull, '#6b4a33', new THREE.Matrix4().makeRotationZ(tilt).setPosition(0, 0.6, 0)));
  for (let k = -d / 2 + 1; k < d / 2; k += 1.6) p.solid.push(boxAt(w * 0.95, 0.2, 0.3, '#5a3e2b', 0, 0.9 + Math.sin(tilt) * 0, k, 0, 0, tilt));
  p.solid.push(boxAt(w * 0.8, 0.18, d * 0.7, '#8a6644', 0.2, 1.6, 0, 0, 0, tilt));
  // 断桅
  p.solid.push(beam(V(0.5, 1.6, -d * 0.1), V(2.4, 7.5, -d * 0.12), 0.22, '#5a3e2b', 6));
  p.solid.push(beam(V(-0.4, 1.4, d * 0.25), V(-1.6, 3.8, d * 0.3), 0.18, '#5a3e2b', 6));
  // 破帆
  p.solid.push(paint(new THREE.PlaneGeometry(3.2, 2.4).rotateY(0.3).translate(2.0, 5.2, -d * 0.1), '#d8cfb8'));
  // 船首像
  p.solid.push(sphere(0.5, '#c9a86a', 0, 1.4, d / 2 + 0.3, 1, 1.2, 1, 1));
  return p;
}

/** 怪力巨石：圆滚的大石块 + 底部碎石，表面有手印状凹痕（提示可以推） */
export function boulder(r: number, seed = 1): PropParts {
  const p = newParts();
  const rand = rng(seed);
  p.solid.push(rock(r, '#8d8478', 0, -r * 0.15, 0, rand, 0.92));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand();
    p.solid.push(rock(r * (0.14 + rand() * 0.1), '#7a7268', Math.cos(a) * r * 1.05, 0, Math.sin(a) * r * 1.05, rand));
  }
  // 手印凹痕（正面两块深色小板）
  for (const s of [-1, 1]) p.solid.push(box(r * 0.22, r * 0.28, 0.06, '#5f584f', s * r * 0.22, r * 0.75, r * 0.86));
  return p;
}

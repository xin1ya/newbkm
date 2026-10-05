/**
 * M3-04 · 琉璃群岛地形生成器（输出格式与 gen-thunder 相同：height / splat0-2 / props / preview / meta）。
 *   pnpm gen:glaze              生成到 assets/islands/glaze/
 *   pnpm gen:glaze --seed 7     换种子（只改变起伏细节，海岸线 / 冠军山 / 沼泽等手工布局不变）
 *
 * 输入：src/config/islands/glaze.ts（区域、道路、水体、河流、POI、阻挡）
 * splat2 扩展层（GLAZE.ext）：玻璃沙 / 沼泥 / 暗紫苔 / 浅色沙丘。
 *
 * 地貌（设计 §3.2「玻璃海岸、幽灵沼泽、海蚀石林、冠军之路」，主色板玻璃青 / 暗紫）：
 *   - 主岛一条连续海岸线（COAST）+ 噪声湾岬；西岸外 6 根海蚀柱（20–36 m 的陡峭石柱），南方外海一片低平沙洲。
 *   - 南：幻影镇（6 m）+ 蜃景沙丘（西南—东北走向的新月形沙丘，向内陆抬升）。
 *   - 西：海蚀石林 —— 8–14 m 台地上密布喀斯特石笋（地形尖峰 + 石柱摆放物）。
 *   - 西北：幽冥镇（3.5 m）与幽灵沼泽（2–4 m 的低湿地，黑水塘、泥沼、小土丘），北缘贴冠军山西绝壁。
 *   - 中：暗影林（12–26 m 起伏森林，林间池）。
 *   - 东：琉璃镇（7 m）+ 玻璃海岸（宽沙滩 = 玻璃质青沙），琉璃水脉从冠军山东麓流下入海；镇外近海是 30 m 深的暗区。
 *   - 中北：冠军山 —— 椭圆山体：山麓 20–45 m，r = 0.88–1.0 一圈 70°以上的环形绝壁，山顶 140–210 m；
 *     北面是 96 m 的联盟高原（彩幽市），高原三面海崖、南面贴山壁，步行 / 冲浪都上不去（只能走冠军之路）。
 *   - 道路 / 城镇压平，道路纵坡 ≤ 17°。
 */
import { encode } from 'fast-png';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLAZE } from '../src/config/islands/glaze';
import { GLAZE_TOWNS } from '../src/config/islands/towns/glaze';
import { SURFACE_CHANNELS, type PropInstance, type PropsFile, type TownLayout, type Vec2 } from '../src/config/islands/types';
import { clamp, distPolyline, lerp, makeNoise, nearestOnPolyline, sdPolygon, smoothstep } from './lib/noise';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', GLAZE.heightmap.replace(/\/[^/]+$/, ''));
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 20261006;
/** 城镇手工布局在 M3-11 ~ M3-14 加入 */
const TOWNS: TownLayout[] = GLAZE_TOWNS;

const N = 1025;
const SIZE = GLAZE.size[0];
const HALF = SIZE / 2;
const CELL = SIZE / (N - 1);
const [H_MIN, H_MAX] = GLAZE.heightRange;
const SPLAT = 2048;
const { fbm, ridged, noise, rnd } = makeNoise(SEED);
const T0 = Date.now();
const log = (s: string) => console.info(`[glaze ${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`);

const zone = (id: string) => {
  const z = GLAZE.zones.find((q) => q.id === id);
  if (!z) throw new Error(`缺少区域 ${id}`);
  return z;
};
const LAND_ZONES = GLAZE.zones.filter((z) => z.kind !== 'sea');
/** 区域包围盒（landSdf 远处跳过 sdPolygon） */
const ZBOX = LAND_ZONES.map((z) => {
  const xs = z.polygon.map((p) => p[0]);
  const zs = z.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
});
const RIVERS = GLAZE.rivers ?? [];
const WATER = GLAZE.waterBodies;
/** 盛行风浪来向（西南，+Z 为南）：西岸 / 西南迎浪多礁岩与海蚀柱，东岸背风湾是宽阔的玻璃沙滩 */
const WAVE_FROM: Vec2 = [-0.75, 0.66];

/**
 * 主岛海岸线（+Z 为南）：南岸幻影镇码头与沙丘海岸、东南沙嘴、东岸琉璃镇码头湾与玻璃海岸、
 * 东北冠军山东麓岩岸、北部联盟高原三面海崖、西北沼泽低岸、西岸海蚀石林的岩岸。
 */
const COAST: Vec2[] = [
  [-520, 556], [-430, 580], [-380, 584], [-330, 574], [-260, 552], [-180, 566], [-80, 560], [20, 552], [120, 538], [220, 534], [320, 510], [400, 476],
  [470, 452], [560, 440], [640, 400], [690, 330], [680, 270], [640, 225], [618, 190], [624, 110], [650, 60], [710, 10], [740, -80], [720, -170],
  [670, -230], [600, -300], [540, -390], [500, -500], [490, -620], [470, -720], [420, -820], [330, -880], [220, -930], [100, -950], [-30, -945],
  [-170, -930], [-300, -880], [-400, -800], [-450, -700], [-520, -630], [-610, -580], [-680, -500], [-710, -380], [-700, -260], [-720, -150],
  [-700, -50], [-690, 50], [-710, 150], [-700, 250], [-680, 340], [-650, 420], [-600, 500],
];
/**
 * M3-05 礁石迷宫（雷鸣—琉璃海域北段，x -640 ~ -120，z 680 ~ 1000）：
 * 两道南北向的侧墙 + 四道东西向的礁墙，每道礁墙只留一个缺口，缺口左右交错；礁岩是 4–6 m 的陡峭尖礁，上不了岸。
 * 迷宫南口接雷鸣地图北缘（systems/travel 的 glaze ↔ thunder 连接），北口出去就是幻影镇码头。
 */
const REEF_MAZE: Array<{ a: Vec2; b: Vec2; gap?: number }> = [
  { a: [-640, 680], b: [-640, 1000] },
  { a: [-120, 680], b: [-120, 1000] },
  { a: [-640, 940], b: [-120, 940], gap: -520 },
  { a: [-640, 860], b: [-120, 860], gap: -230 },
  { a: [-640, 780], b: [-120, 780], gap: -500 },
  { a: [-640, 700], b: [-120, 700], gap: -200 },
];
/** 迷宫缺口宽度（米） */
const MAZE_GAP = 34;
function reefWall(w: (typeof REEF_MAZE)[number], wi: number): Array<{ id: string; x: number; z: number; r: number; top: number; stack?: boolean }> {
  const out: Array<{ id: string; x: number; z: number; r: number; top: number; stack?: boolean }> = [];
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const n = Math.ceil(len / 11);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = w.a[0] + (w.b[0] - w.a[0]) * t;
    const z = w.a[1] + (w.b[1] - w.a[1]) * t;
    if (w.gap !== undefined && Math.abs(x - w.gap) < MAZE_GAP / 2 + 7) continue;
    // 礁墙沿法向弯曲（不是笔直的一排），间距略有疏密
    const nx = -(w.b[1] - w.a[1]) / len;
    const nz = (w.b[0] - w.a[0]) / len;
    const bend = fbm(t * 3.1 + wi * 7.3, wi * 1.7) * 26 + fbm(t * 11 + wi, 4.2) * 5;
    out.push({ id: `reef-${wi}-${k}`, x: x + nx * bend, z: z + nz * bend, r: 6.5 + ((k * 7 + wi) % 3), top: 4 + ((k * 5 + wi) % 3), stack: true });
  }
  return out;
}
/** 离岛：海蚀柱（stack = 陡峭石柱）、沙洲（低平） */
const ISLETS: Array<{ id: string; x: number; z: number; r: number; top: number; stack?: boolean }> = [
  { id: 'stack-1', x: -760, z: 330, r: 11, top: 26, stack: true },
  { id: 'stack-2', x: -790, z: 200, r: 13, top: 36, stack: true },
  { id: 'stack-3', x: -765, z: 90, r: 9, top: 22, stack: true },
  { id: 'stack-4', x: -800, z: -10, r: 14, top: 32, stack: true },
  { id: 'stack-5', x: -770, z: -140, r: 10, top: 28, stack: true },
  { id: 'stack-6', x: -740, z: 440, r: 8, top: 20, stack: true },
  { id: 'sandbar', x: -60, z: 662, r: 46, top: 2.4 },
  ...REEF_MAZE.flatMap((w, wi) => reefWall(w, wi)),
];
/** 琉璃镇外海的深水暗区（海底神殿所在，M3-13 / M3-18） */
const ABYSS = { x: 800, z: 200, r: 90 };

/** 河流：离 (x, z) 最近的河段 → 距离、水面高度 */
function riverProject(x: number, z: number, only?: string): { d: number; level: number; width: number } | null {
  let best: { d: number; level: number; width: number } | null = null;
  for (const r of RIVERS) {
    if (only && r.id !== only) continue;
    for (let s = 0; s + 1 < r.points.length; s++) {
      const [ax, az] = r.points[s]!;
      const [bx, bz] = r.points[s + 1]!;
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
      if (!best || d < best.d) best = { d, level: lerp(r.levels[s]!, r.levels[s + 1]!, t), width: r.width };
    }
  }
  return best;
}

/** 冠军山：椭圆山体（中心 (20, -430)，半轴 330 × 190），r = 椭圆归一化半径 */
const MTN = { x: 20, z: -430, rx: 330, rz: 190 };
/** 联盟高原台地高度 */
const PLATEAU_H = 96;
function mountainR(x: number, z: number): number {
  // 方位噪声：让山体轮廓有山嘴与凹湾，而不是正椭圆
  const a = Math.atan2((z - MTN.z) / MTN.rz, (x - MTN.x) / MTN.rx);
  const wob = fbm(Math.cos(a) * 1.8 + 5, Math.sin(a) * 1.8) * 0.16 + fbm(x / 90 + 11, z / 90) * 0.06 + fbm(x / 30, z / 30 + 4) * 0.02;
  return Math.sqrt(((x - MTN.x) / MTN.rx) ** 2 + ((z - MTN.z) / MTN.rz) ** 2) + wob;
}
function mountainHeight(x: number, z: number): number {
  const r = mountainR(x, z);
  // 北侧（z < -590）山外即联盟高原；其余方向是山麓
  const zr = z + fbm(x / 120 + 2, 3.3) * 40 + fbm(x / 35, 1.7) * 8;
  const plateauSide = smoothstep(-582, -598, zr);
  const foothill = 10 + 30 * smoothstep(1.6, 1.0, r) + 3 * ridged(x / 60, z / 60);
  const outside = lerp(foothill, PLATEAU_H + 1.5 * fbm(x / 50, z / 50), plateauSide);
  if (r >= 1) return outside;
  // 环形绝壁：r 0.88–1.0 从山麓 / 高原抬升到 140 m
  const wall = smoothstep(1.0, 0.88, r);
  // 山顶：从绝壁顶（约 115 m）向中心升起的群峰，脊状噪声给出山脊与沟谷
  const summit = 115 + 70 * Math.pow(smoothstep(0.9, 0.0, r), 1.2) + 30 * ridged(x / 90 + 3, z / 90 + 8) + 4 * fbm(x / 20, z / 20);
  return lerp(outside, summit, wall);
}
/** 蜃景沙丘：西南—东北走向的新月丘（垂直于西南风），向内陆抬升 */
function duneHeight(x: number, z: number): number {
  const phase = (x * 0.78 - z * 0.62) / 34 + fbm(x / 160, z / 160) * 3.2;
  const crest = Math.pow(0.5 + 0.5 * Math.sin(phase), 2.2);
  return 4 + 6 * crest * (0.6 + 0.5 * fbm(x / 90 + 2, z / 90)) + smoothstep(520, 280, z) * 6 + 0.6 * fbm(x / 20, z / 20);
}
/** 海蚀石林：台地上的喀斯特石笋（脊状噪声尖峰） */
function stoneForestHeight(x: number, z: number): number {
  // 北端向幽冥镇缓降（8 号路接沼泽低地）
  const base = 9 + 4 * fbm(x / 110 + 4, z / 110) + smoothstep(-660, -420, x) * 3 - smoothstep(80, -90, z) * 6;
  const spike = Math.max(0, ridged(x / 22 + 7, z / 22 + 1) - 0.62) / 0.38;
  // 石笋成片分布（林间有开阔草地）
  const cluster = smoothstep(-0.1, 0.25, fbm(x / 110 + 30, z / 110 + 12));
  return base + 13 * Math.pow(spike, 1.6) * cluster;
}
/** 幽灵沼泽：2.6–4 m 低湿地，小土丘 */
function marshHeight(x: number, z: number): number {
  const hummock = Math.max(0, fbm(x / 18 + 3, z / 18)) * 1.6;
  return 2.7 + 0.5 * fbm(x / 70, z / 70 + 9) + hummock;
}

/** 每个区域的地貌函数 */
const REGION: Record<string, (x: number, z: number) => number> = {
  'mirage-town': (x, z) => 6 + 0.4 * fbm(x / 40, z / 40),
  'ghost-town': (x, z) => 3.6 + 0.3 * fbm(x / 40, z / 40),
  'glaze-town': (x, z) => 7 + 0.4 * fbm(x / 40, z / 40),
  'ever-city': (x, z) => PLATEAU_H + 0.3 * fbm(x / 40, z / 40),
  'stone-forest': stoneForestHeight,
  'ghost-marsh': marshHeight,
  'shadow-wood': (x, z) => 12 + smoothstep(250, -150, z) * 10 + 5 * ridged(x / 100 + 9, z / 100) + 1.4 * fbm(x / 26, z / 26),
  'mirage-dunes': duneHeight,
  'glass-coast': (x, z) => 6 + 4 * fbm(x / 80 + 6, z / 80) + smoothstep(-40, -240, z) * 18 + 1.2 * fbm(x / 22, z / 22),
  'victory-mountain': mountainHeight,
  'league-plateau': (x, z) => PLATEAU_H + 1.5 * fbm(x / 60, z / 60) + 0.5 * fbm(x / 15, z / 15),
};
/** 各区域的影响范围（米）：城镇过渡短；冠军山 / 高原用短过渡保住绝壁 */
const FALLOFF: Record<string, number> = { 'victory-mountain': 30, 'league-plateau': 10, 'ever-city': 20, 'ghost-town': 30, 'ghost-marsh': 50 };
/** 冠军山 / 联盟高原在这两个区域里（崖岸短坡、山体高度不被平均） */
const CLIFF_ZONES = new Set(['victory-mountain', 'league-plateau', 'ever-city']);

/** 区域之外的底色：低丘 */
function highlands(x: number, z: number): number {
  return 12 + 8 * ridged(x / 160, z / 160);
}

function landSdf(x: number, z: number): number {
  // 海岸线只由 COAST 决定（区域多边形只影响高度）
  let d = Infinity;
  const wobble = fbm(x / 140 + 20, z / 140) * 22 + fbm(x / 60 + 3, z / 60) * 10 + fbm(x / 22, z / 22 + 9) * 3;
  d = Math.min(d, sdPolygon(x, z, COAST) + wobble);
  for (const it of ISLETS) {
    if (Math.abs(x - it.x) > it.r + 60 || Math.abs(z - it.z) > it.r + 60) continue;
    d = Math.min(d, Math.hypot(x - it.x, z - it.z) - it.r + fbm(x / 14 + it.r, z / 14) * (it.stack ? 2 : 6));
  }
  d = Math.max(d, Math.max(Math.abs(x), Math.abs(z)) - (HALF - 16)); // 世界边缘留海
  return d;
}

function isletHeight(x: number, z: number): { k: number; h: number } {
  let best = { k: 0, h: 0 };
  for (const it of ISLETS) {
    if (Math.abs(x - it.x) > it.r + 40 || Math.abs(z - it.z) > it.r + 40) continue;
    const r = Math.hypot(x - it.x, z - it.z);
    const k = smoothstep(it.r + (it.stack ? 8 : 30), it.r + (it.stack ? 1 : 5), r);
    if (k <= best.k) continue;
    // 海蚀柱：几乎垂直的柱身 + 顶部草帽；沙洲：低平
    // 尖礁 / 海蚀柱：柱脚在水面下（-0.8 m），不留可以落脚的平台
    const h = it.stack ? -0.8 + (it.top + 0.8) * smoothstep(it.r, it.r * 0.72, r) + fbm(x / 6, z / 6) * 1.2 * smoothstep(it.r, it.r * 0.8, r) : 0.6 + (it.top - 0.6) * smoothstep(it.r, 0, r) + fbm(x / 12, z / 12) * 0.4;
    best = { k, h };
  }
  return best;
}

function coastInfo(x: number, z: number, sdf: number): { bw: number; rocky: number; shelter: number } {
  const e = 3;
  let gx = landSdf(x + e, z) - landSdf(x - e, z);
  let gz = landSdf(x, z + e) - landSdf(x, z - e);
  const gl = Math.hypot(gx, gz) || 1;
  gx /= gl;
  gz /= gl;
  const cx = x - gx * sdf;
  const cz = z - gz * sdf;
  let land = 0;
  const R = 60;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    if (landSdf(cx + Math.cos(a) * R, cz + Math.sin(a) * R) < 0) land++;
  }
  const bay = land / 10 - 0.5;
  const exposure = Math.max(0, gx * WAVE_FROM[0] + gz * WAVE_FROM[1]);
  const shelter = clamp(0.56 + 2.1 * bay - 0.25 * exposure + 0.25 * fbm(cx / 45 + 9, cz / 45), 0, 1);
  // 东岸玻璃海岸、南岸沙丘海岸沙滩更宽
  const eastK = smoothstep(380, 600, cx) * smoothstep(-200, -60, cz) + smoothstep(300, 480, cz) * smoothstep(-300, -200, cx);
  const bw = lerp(8, 40, smoothstep(0.25, 0.8, shelter)) + 16 * clamp(eastK, 0, 1);
  const rocky = smoothstep(0.42, 0.18, shelter) * (1 - clamp(eastK, 0, 1) * 0.7);
  return { bw, rocky, shelter };
}

const COAST_BW = new Float32Array(N * N);
const COAST_ROCKY = new Float32Array(N * N);
const SHORE_T = new Float32Array(N * N);

function rawHeight(x: number, z: number, cell: number): { h: number; sea: number } {
  const sdf = landSdf(x, z);
  const t = -sdf;
  SHORE_T[cell] = t;
  if (t < 0) {
    let depth = Math.min(24, 1.2 + -t * 0.09 + Math.max(0, -t - 40) * 0.08);
    // 沙洲周围浅滩
    const sb = ISLETS.find((q) => q.id === 'sandbar')!;
    depth = Math.min(depth, 0.8 + Math.max(0, Math.hypot(x - sb.x, z - sb.z) - sb.r) * 0.05);
    // 深水暗区：海底神殿
    const ab = Math.hypot(x - ABYSS.x, z - ABYSS.z);
    depth = Math.max(depth, 34 * smoothstep(ABYSS.r, ABYSS.r * 0.35, ab));
    return { h: -depth + fbm(x / 40, z / 40) * 0.6, sea: 1 };
  }
  let wsum = 0;
  let hsum = 0;
  let town = 0;
  let cliff = 0;
  let rockyZone = 0;
  let mountainW = 0;
  for (let k = 0; k < LAND_ZONES.length; k++) {
    const zn = LAND_ZONES[k]!;
    const f = REGION[zn.id];
    if (!f) continue;
    const fall = FALLOFF[zn.id] ?? 45;
    const b = ZBOX[k]!;
    if (x < b.minX - fall || x > b.maxX + fall || z < b.minZ - fall || z > b.maxZ + fall) continue;
    const sd = sdPolygon(x, z, zn.polygon);
    const w = smoothstep(fall, -12, sd);
    if (w <= 0) continue;
    wsum += w;
    hsum += w * f(x, z);
    if (zn.kind === 'town' && zn.id !== 'ever-city') town = Math.max(town, smoothstep(30, -5, sd));
    if (CLIFF_ZONES.has(zn.id)) cliff = Math.max(cliff, w);
    if (zn.id === 'victory-mountain') mountainW = w;
    if (zn.id === 'stone-forest') rockyZone = Math.max(rockyZone, w * 0.8);
  }
  let inland = wsum > 1 ? hsum / wsum : hsum + (1 - wsum) * highlands(x, z);
  // 冠军山绝壁 / 山体：不被邻区平均（保证步行翻不过去）
  if (mountainW > 0) {
    const mh = mountainHeight(x, z);
    if (mh > inland && mountainR(x, z) < 1.04) inland = lerp(inland, mh, smoothstep(0.05, 0.6, mountainW));
  }
  const isl = isletHeight(x, z);
  if (isl.k > 0) inland = lerp(inland, isl.h, isl.k);
  inland += noise(x / 18, z / 18) * 0.35;

  let bw = 0;
  let rocky = 0;
  if (t < 90) {
    const ci = coastInfo(x, z, sdf);
    bw = lerp(ci.bw, Math.min(ci.bw, 4), Math.max(cliff, town * 0.6));
    const coveK = smoothstep(0.6, 0.85, ci.shelter);
    rocky = Math.max(ci.rocky * (1 - town), (rockyZone * 0.8 + cliff) * (1 - coveK * (1 - cliff)));
    bw = lerp(bw, 3, Math.max(rockyZone, cliff) * 0.8 * (1 - coveK));
  }
  COAST_BW[cell] = bw;
  COAST_ROCKY[cell] = rocky;
  // 高原 / 山体：海崖（10 m 内直接拔起）
  const rampLen = lerp(lerp(45, 10, cliff), 14, rocky * 0.7) - bw * 0.4;
  const ramp = smoothstep(bw, bw + Math.max(cliff > 0.5 ? 4 : 8, rampLen), t);
  const fore = 0.3 + 1.3 * smoothstep(0, Math.max(5, bw * 0.55), t);
  const dune = bw > 14 ? smoothstep(bw * 0.55, bw * 0.95, t) * (0.5 + 0.7 * Math.max(0, fbm(x / 16 + 5, z / 16))) : 0;
  const shelf = 0.6 + 1.6 * Math.abs(noise(x / 6 + 2, z / 6)) + 0.6 * smoothstep(0, 8, t);
  const shoreH = lerp(fore + dune, shelf, rocky);
  return { h: lerp(shoreH, inland, ramp), sea: 0 };
}
// ———————————— 1. 高度场 ————————————
log(`seed=${SEED}，计算 ${N}×${N} 高度场…`);
const H = new Float32Array(N * N);
const SEA = new Uint8Array(N * N);
const wx = (i: number) => -HALF + i * CELL;
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const r = rawHeight(wx(i), wx(j), k);
    H[k] = r.h;
    SEA[k] = r.sea;
  }
log('原始高度完成');

function blur(src: Float32Array, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let j = 0; j < N; j++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += src[j * N + clamp(k, 0, N - 1)]!;
    for (let i = 0; i < N; i++) {
      tmp[j * N + i] = s / (2 * radius + 1);
      s += src[j * N + clamp(i + radius + 1, 0, N - 1)]! - src[j * N + clamp(i - radius, 0, N - 1)]!;
    }
  }
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += tmp[clamp(k, 0, N - 1) * N + i]!;
    for (let j = 0; j < N; j++) {
      out[j * N + i] = s / (2 * radius + 1);
      s += tmp[clamp(j + radius + 1, 0, N - 1) * N + i]! - tmp[clamp(j - radius, 0, N - 1) * N + i]!;
    }
  }
  return out;
}
function bilinear(x: number, z: number): number {
  const fx = clamp((x + HALF) / CELL, 0, N - 1.0001);
  const fz = clamp((z + HALF) / CELL, 0, N - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  return lerp(lerp(H[j * N + i]!, H[j * N + i + 1]!, tx), lerp(H[(j + 1) * N + i]!, H[(j + 1) * N + i + 1]!, tx), tz);
}
/** 在 (x, z) 半径 r 内的格子上执行 fn */
function eachCell(minX: number, maxX: number, minZ: number, maxZ: number, fn: (k: number, x: number, z: number) => void): void {
  const i0 = Math.max(0, Math.floor((minX + HALF) / CELL));
  const i1 = Math.min(N - 1, Math.ceil((maxX + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((minZ + HALF) / CELL));
  const j1 = Math.min(N - 1, Math.ceil((maxZ + HALF) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * N + i, wx(i), wx(j));
}

// 2. 城镇与道路压平（向平滑地形靠拢）
const smooth = blur(H, 4);
const smoothWide = blur(smooth, 4);
const landRoads = GLAZE.roads.filter((r) => r.surface !== 'boardwalk');
for (const zn of GLAZE.zones.filter((q) => q.kind === 'town')) {
  const xs = zn.polygon.map((p) => p[0]);
  const zs = zn.polygon.map((p) => p[1]);
  eachCell(Math.min(...xs) - 12, Math.max(...xs) + 12, Math.min(...zs) - 12, Math.max(...zs) + 12, (k, x, z) => {
    if (SEA[k]) return;
    const f = smoothstep(10, -25, sdPolygon(x, z, zn.polygon)) * 0.85;
    if (f > 0) H[k] = lerp(H[k]!, lerp(smooth[k]!, smoothWide[k]!, 0.6), f);
  });
}

// 2b. 道路纵坡限制（≤ 17°）：沿路 1 m 采样，往返夹紧剖面，再把路面两侧 8 m 融合到剖面
const ROAD_GRADE = Math.tan((17 * Math.PI) / 180);
function gradeRoads(): void {
for (const r of landRoads) {
  const pts: Array<{ x: number; z: number }> = [];
  for (let s = 0; s + 1 < r.points.length; s++) {
    const [ax, az] = r.points[s]!;
    const [bx, bz] = r.points[s + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let i = s === 0 ? 0 : 1; i <= n; i++) pts.push({ x: ax + ((bx - ax) * i) / n, z: az + ((bz - az) * i) / n });
  }
  const prof = pts.map((p) => {
    // 路面高度先做 5 m 横向平均（避免沿崖边的路一侧高一侧低）
    return bilinear(p.x, p.z);
  });
  for (let it = 0; it < 80; it++) {
    for (let i = 1; i < prof.length; i++) prof[i] = clamp(prof[i]!, prof[i - 1]! - ROAD_GRADE, prof[i - 1]! + ROAD_GRADE);
    for (let i = prof.length - 2; i >= 0; i--) prof[i] = clamp(prof[i]!, prof[i + 1]! - ROAD_GRADE, prof[i + 1]! + ROAD_GRADE);
  }
  const hw = r.width / 2;
  const reach = hw + 8;
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  eachCell(Math.min(...xs) - reach, Math.max(...xs) + reach, Math.min(...zs) - reach, Math.max(...zs) + reach, (k, x, z) => {
    if (SEA[k]) return;
    let bd = Infinity;
    let bi = 0;
    for (let q = 0; q < pts.length; q += 2) {
      const d = (pts[q]!.x - x) ** 2 + (pts[q]!.z - z) ** 2;
      if (d < bd) {
        bd = d;
        bi = q;
      }
    }
    const d = Math.sqrt(bd);
    if (d > reach) return;
    H[k] = lerp(H[k]!, prof[bi]!, smoothstep(reach, hw + 1, d));
  });
}
}
gradeRoads();
log('道路压平完成');

// 3. 水体：池床 + 池岸（池岸高出水面 1.2 m，保证水不外溢）
function waterShape(w: (typeof WATER)[number], x: number, z: number): number {
  return ((x - w.center[0]) / w.radius[0]) ** 2 + ((z - w.center[1]) / w.radius[1]) ** 2;
}
for (const wb of WATER) {
  const rx = wb.radius[0] * 1.6 + 6;
  const rz = wb.radius[1] * 1.6 + 6;
  eachCell(wb.center[0] - rx, wb.center[0] + rx, wb.center[1] - rz, wb.center[1] + rz, (k, x, z) => {
    const e = waterShape(wb, x, z) + fbm(x / 20, z / 20) * 0.05;
    const bank = wb.level + 1.0;
    // 池岸：1–1.5 倍半径内抬到水面以上（向外平滑回到原地形）
    if (e >= 1 && e < 1.5) H[k] = lerp(Math.max(H[k]!, bank), H[k]!, smoothstep(1.15, 1.5, e));
    if (e < 1) {
      const deep = wb.id.startsWith('marsh') ? 1.6 : 4;
      const bed = wb.level - 0.3 - deep * Math.pow(1 - e, 0.55) + fbm(x / 9, z / 9) * 0.2;
      H[k] = Math.min(Math.max(H[k]!, bed), lerp(wb.level + 0.3, bed, smoothstep(1, 0.86, e)));
    }
  });
}

// 3b. 河流：河谷缓坡岸、河床、低洼处筑堤
for (const rv of RIVERS) {
  const xs = rv.points.map((p) => p[0]);
  const zs = rv.points.map((p) => p[1]);
  const pad = rv.width / 2 + 28;
  eachCell(Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad, (k, x, z) => {
    const r = riverProject(x, z);
    if (!r) return;
    const hw = r.width / 2;
    if (r.d > hw + 26) return;
    const bank = r.level + 0.9;
    if (H[k]! > bank) H[k] = lerp(bank, H[k]!, smoothstep(hw + 1, hw + 24, r.d));
    if (r.d < hw + 1) {
      const u = r.d / (hw + 1);
      H[k] = Math.min(H[k]!, r.level - (0.45 + 1.1 * (1 - u * u)) + fbm(x / 9, z / 9) * 0.15);
    } else if (r.d < hw + 5 && H[k]! < r.level + 0.3 && r.level > 0.6) H[k] = r.level + 0.3;
  });
}

const LAVA_MASK = new Float32Array(N * N); // 琉璃群岛没有熔岩（POI 自检沿用）
log('水系完成');

// 4. 洞口崖壁：洞穴 POI 背后 3–30 m 抬起一面陡崖（洞口贴在崖脚）
for (const p of GLAZE.pois.filter((q) => q.kind === 'cave')) {
  const yaw = p.doorYaw ?? 0;
  const [cx, , cz] = p.position;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const y0 = bilinear(cx, cz);
  eachCell(cx - 34, cx + 34, cz - 34, cz + 34, (k, x, z) => {
    const dx = x - cx;
    const dz = z - cz;
    const back = -(dx * fx + dz * fz); // 洞口背后为正
    const side = Math.abs(dx * fz - dz * fx);
    if (back < 1 || side > 30) return;
    const lift = y0 + 12 * smoothstep(1, 8, back) * smoothstep(30, 14, side) + 4 * fbm(x / 12, z / 12);
    H[k] = Math.max(H[k]!, lerp(H[k]!, lift, smoothstep(34, 18, Math.hypot(dx, dz))));
  });
}

// 4b. POI 周边保证可走
const FLAT_SPOTS: Array<[number, number, number]> = [
  [GLAZE.spawnPoint[0], GLAZE.spawnPoint[2], 16],
  ...GLAZE.pois.filter((p) => p.kind !== 'quest' && p.kind !== 'cave' && p.kind !== 'gym').map((p) => [p.position[0], p.position[2], 10] as [number, number, number]),
];
const H2 = blur(H, 2);
for (const [cx, cz, r] of FLAT_SPOTS) {
  eachCell(cx - r - 10, cx + r + 10, cz - r - 10, cz + r + 10, (k, x, z) => {
    if (SEA[k] && H[k]! < -0.5) return;
    H[k] = lerp(H[k]!, H2[k]!, smoothstep(r + 10, r, Math.hypot(x - cx, z - cz)));
  });
}

function heightAt(x: number, z: number): number {
  return bilinear(x, z);
}
function slopeDeg(x: number, z: number): number {
  const e = CELL;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
}

// 5. 城镇地块压平：每栋建筑压出平台（核心外扩 2.5 m，3.5 m 过渡）；布局 pads 按给定 / 中位高度压平
const PAD_TYPES = new Set<string>(['house', 'pokecenter', 'mart', 'warehouse', 'statue', 'well', 'igloo', 'sundial', 'windmill']);
interface Pad { x: number; z: number; hw: number; hd: number; yaw: number; y: number | null; blend: number }
const pads: Pad[] = [];
for (const t of TOWNS) {
  for (const q of t.pads ?? []) pads.push({ x: q.position[0], z: q.position[1], hw: q.size[0] / 2, hd: q.size[1] / 2, yaw: q.yaw ?? 0, y: q.y ?? null, blend: q.blend ?? 4 });
  for (const q of t.props) {
    if (!PAD_TYPES.has(q.type) || q.y !== undefined || q.mirage) continue;
    const front = q.type === 'pokecenter' ? 3.5 : 1.5;
    const [w, , d] = q.size;
    pads.push({ x: q.position[0] + Math.sin(q.yaw) * (front / 2), z: q.position[1] + Math.cos(q.yaw) * (front / 2), hw: w / 2 + 2.5, hd: d / 2 + 2.5 + front / 2, yaw: q.yaw, y: null, blend: 3.5 });
  }
}
function padLocal(pd: Pad, x: number, z: number): number {
  const s = Math.sin(pd.yaw);
  const c = Math.cos(pd.yaw);
  const dx = x - pd.x;
  const dz = z - pd.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.hypot(Math.max(0, Math.abs(lx) - pd.hw), Math.max(0, Math.abs(lz) - pd.hd));
}
for (const pd of pads) {
  if (pd.y !== null) continue;
  const samples: number[] = [];
  const r = Math.hypot(pd.hw, pd.hd);
  for (let gz = pd.z - r; gz <= pd.z + r; gz += CELL)
    for (let gx = pd.x - r; gx <= pd.x + r; gx += CELL) if (padLocal(pd, gx, gz) <= 0) samples.push(bilinear(gx, gz));
  samples.sort((a, b) => a - b);
  pd.y = samples[Math.floor(samples.length / 2)] ?? 0;
}
const padBest = new Float32Array(N * N).fill(Infinity);
const padOwner = new Int32Array(N * N).fill(-1);
pads.forEach((pd, idx) => {
  const r = Math.hypot(pd.hw, pd.hd) + pd.blend + CELL;
  eachCell(pd.x - r, pd.x + r, pd.z - r, pd.z + r, (k, x, z) => {
    const d = padLocal(pd, x, z);
    if (d > pd.blend) return;
    const score = d <= 0 ? -1 - idx * 1e-6 : d;
    if (score < padBest[k]!) {
      padBest[k] = score;
      padOwner[k] = idx;
    }
  });
});
let padCells = 0;
for (let k = 0; k < N * N; k++) {
  const o = padOwner[k]!;
  if (o < 0) continue;
  const pd = pads[o]!;
  const d = Math.max(0, padBest[k]!);
  H[k] = lerp(H[k]!, pd.y!, d <= 0 ? 1 : smoothstep(pd.blend, 0, d));
  padCells++;
}
log(`城镇地块压平 ${pads.length} 块（${padCells} 格）`);
// 地块压平后再做一次道路纵坡（城镇出入口与地块边缘衔接）
gradeRoads();

// ———————————— 6. 编码高度图 ————————————
mkdirSync(outDir, { recursive: true });
const h16 = new Uint16Array(N * N);
let hmin = Infinity;
let hmax = -Infinity;
let clipped = 0;
for (let k = 0; k < N * N; k++) {
  const h = H[k]!;
  hmin = Math.min(hmin, h);
  hmax = Math.max(hmax, h);
  if (h < H_MIN || h > H_MAX) clipped++;
  h16[k] = Math.round(clamp((h - H_MIN) / (H_MAX - H_MIN), 0, 1) * 65535);
}
writeFileSync(join(outDir, 'height.png'), encode({ width: N, height: N, data: h16, depth: 16, channels: 1 }));
log(`height.png  高度 ${hmin.toFixed(1)} ~ ${hmax.toFixed(1)} m，越界 ${clipped} 像素`);

// ———————————— 7. 材质权重 ————————————
log(`计算 ${SPLAT}×${SPLAT} 材质权重…`);
const CH = SURFACE_CHANNELS.length;
const splat0 = new Uint8Array(SPLAT * SPLAT * 4);
const splat1 = new Uint8Array(SPLAT * SPLAT * 4);
const splat2 = new Uint8Array(SPLAT * SPLAT * 4); // 扩展：赭石 / 火山灰 / 熔岩 / 苔藓
const ch = Object.fromEntries(SURFACE_CHANNELS.map((c, i) => [c, i])) as Record<(typeof SURFACE_CHANNELS)[number], number>;
const wildZones = GLAZE.zones.filter((z) => z.kind === 'wild');
const towns = GLAZE.zones.filter((z) => z.kind === 'town');
const mirageZone = zone('mirage-dunes');
const stoneZone = zone('stone-forest');
const marshZone = zone('ghost-marsh');
const woodZone = zone('shadow-wood');
const glassZone = zone('glass-coast');
const mountainZone = zone('victory-mountain');
const plateauZone = zone('league-plateau');
const roadBoxes = GLAZE.roads
  .filter((r) => r.surface !== 'boardwalk')
  .map((r) => {
    const xs = r.points.map((p) => p[0]);
    const zs = r.points.map((p) => p[1]);
    const m = r.width / 2 + 3;
    return { r, minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minZ: Math.min(...zs) - m, maxZ: Math.max(...zs) + m };
  });
const stats = new Float64Array(CH);
const extStats = new Float64Array(4);
const w = new Float32Array(CH);
const e = new Float32Array(4); // 玻璃沙 / 沼泥 / 暗紫苔 / 浅色沙丘
const zoneSd = (zn: { polygon: Vec2[] }, x: number, z: number, margin: number) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of zn.polygon) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1];
    if (p[1] > maxZ) maxZ = p[1];
  }
  if (x < minX - margin || x > maxX + margin || z < minZ - margin || z > maxZ + margin) return margin + 1;
  return sdPolygon(x, z, zn.polygon);
};
for (let j = 0; j < SPLAT; j++)
  for (let i = 0; i < SPLAT; i++) {
    const x = -HALF + (i + 0.5) * (SIZE / SPLAT);
    const z = -HALF + (j + 0.5) * (SIZE / SPLAT);
    const h = heightAt(x, z);
    const slope = slopeDeg(x, z);
    w.fill(0);
    e.fill(0);
    w[ch.grass] = 1;
    let wild = 0;
    for (const zn of wildZones) wild = Math.max(wild, smoothstep(8, -12, zoneSd(zn, x, z, 10)));
    const tallN = fbm(x / 28 + 40, z / 28) + fbm(x / 7, z / 7) * 0.25;
    w[ch.tallgrass] = wild * smoothstep(0.0, 0.14, tallN) * 1.8;
    w[ch.flowers] = smoothstep(0.25, 0.36, fbm(x / 22 + 90, z / 22 + 13)) * (0.3 + wild * 0.3);
    let town = 0;
    for (const zn of towns) town = Math.max(town, smoothstep(12, -8, zoneSd(zn, x, z, 14)));
    const grove = smoothstep(0.24, 0.36, fbm(x / 50 + 7, z / 50 + 70));
    w[ch.forest] = grove * 0.7 * (1 - town);
    // 暗影林：几乎全覆盖的密林 + 暗紫苔地
    const inWood = smoothstep(15, -25, zoneSd(woodZone, x, z, 16));
    if (inWood > 0) {
      w[ch.forest] = Math.max(w[ch.forest]!, inWood * (0.9 + 0.6 * smoothstep(-0.2, 0.2, fbm(x / 40 + 3, z / 40))));
      e[2] = Math.max(e[2]!, inWood * smoothstep(-0.1, 0.25, fbm(x / 24 + 8, z / 24)) * 0.7);
      w[ch.flowers] = w[ch.flowers]! * (1 - inWood);
    }
    // 幽灵沼泽：沼泥 + 苔地 + 芦苇高草，零星枯林
    const inMarsh = smoothstep(15, -25, zoneSd(marshZone, x, z, 16));
    if (inMarsh > 0) {
      const mud = smoothstep(-0.15, 0.15, fbm(x / 30 + 21, z / 30)) * smoothstep(4.4, 3.0, h);
      e[1] = Math.max(e[1]!, inMarsh * (0.35 + 0.6 * mud));
      e[2] = Math.max(e[2]!, inMarsh * (1 - mud) * 0.5);
      w[ch.tallgrass] = Math.max(w[ch.tallgrass]!, inMarsh * (1 - mud) * 1.2);
      w[ch.forest] = w[ch.forest]! * (1 - inMarsh * 0.6);
      w[ch.flowers] = w[ch.flowers]! * (1 - inMarsh);
    }
    // 海蚀石林：灰白岩 + 短草
    const inStone = smoothstep(10, -20, zoneSd(stoneZone, x, z, 12));
    if (inStone > 0) {
      w[ch.rock] = Math.max(w[ch.rock]!, inStone * (smoothstep(0.05, 0.3, fbm(x / 12 + 8, z / 12)) * 1.4 + smoothstep(16, 30, slope) * 2));
      w[ch.forest] = w[ch.forest]! * (1 - inStone * 0.7);
    }
    // 蜃景沙丘：浅色沙丘覆盖，丘间残草
    const inDune = smoothstep(10, -25, zoneSd(mirageZone, x, z, 12));
    if (inDune > 0) {
      const crestK = smoothstep(7, 12, h);
      e[3] = Math.max(e[3]!, inDune * (0.55 + 0.45 * crestK) * (0.85 + 0.25 * fbm(x / 18, z / 18)));
      w[ch.sand] = Math.max(w[ch.sand]!, inDune * 1.2);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - inDune * 0.8);
      w[ch.forest] = w[ch.forest]! * (1 - inDune);
      w[ch.flowers] = w[ch.flowers]! * (1 - inDune);
    }
    // 玻璃海岸：草地上散落玻璃沙斑块
    const inGlass = smoothstep(10, -20, zoneSd(glassZone, x, z, 12));
    if (inGlass > 0) e[0] = Math.max(e[0]!, inGlass * smoothstep(0.1, 0.35, fbm(x / 26 + 14, z / 26)) * 0.6);
    // 冠军山：山麓草坡 → 绝壁岩面 → 山顶草甸与碎石
    const inMtn = smoothstep(12, -20, zoneSd(mountainZone, x, z, 14));
    if (inMtn > 0) {
      w[ch.rock] = Math.max(w[ch.rock]!, inMtn * smoothstep(120, 170, h) * smoothstep(0.0, 0.3, fbm(x / 16 + 2, z / 16)) * 2);
      w[ch.stone] = Math.max(w[ch.stone]!, inMtn * smoothstep(150, 190, h) * 0.8);
      w[ch.forest] = w[ch.forest]! * (1 - inMtn * smoothstep(60, 110, h));
    }
    // 联盟高原：修剪过的草甸 + 花
    const inPlateau = smoothstep(10, -15, zoneSd(plateauZone, x, z, 12));
    if (inPlateau > 0) {
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - inPlateau * 0.5);
      w[ch.flowers] = Math.max(w[ch.flowers]!, inPlateau * smoothstep(0.1, 0.3, fbm(x / 20 + 60, z / 20)) * 0.8);
    }
    // 城镇：草坪 + 石板
    if (town > 0) {
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - town);
      w[ch.forest] = w[ch.forest]! * (1 - town * 0.8);
      e[1] = e[1]! * (1 - town);
      e[0] = e[0]! * (1 - town * 0.4);
    }
    // 道路（积雪路段压出泥路）
    for (const rb of roadBoxes) {
      if (x < rb.minX || x > rb.maxX || z < rb.minZ || z > rb.maxZ) continue;
      const r = rb.r;
      const d = distPolyline(x, z, r.points) + noise(x / 3, z / 3) * 0.8;
      const k = smoothstep(r.width / 2 + 1.2, r.width / 2 - 0.4, d);
      if (k <= 0) continue;
      const c = r.surface === 'stone' ? ch.stone : ch.dirt;
      w[c] = Math.max(w[c]!, k * 3);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - k);
      w[ch.forest] = w[ch.forest]! * (1 - k);
      w[ch.flowers] = w[ch.flowers]! * (1 - k);
      e[0] = e[0]! * (1 - k * 0.75);
      e[1] = e[1]! * (1 - k);
      e[3] = e[3]! * (1 - k);
    }
    if (town > 0.5) w[ch.stone] = Math.max(w[ch.stone]!, smoothstep(0.35, 0.5, fbm(x / 16 + 50, z / 16)) * town * 1.2);
    // 海岸
    const gi = clamp(Math.round((x + HALF) / CELL), 0, N - 1);
    const gj = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    const gk = gj * N + gi;
    const st = SHORE_T[gk]!;
    const cbw = COAST_BW[gk]!;
    const crk = COAST_ROCKY[gk]!;
    let beach = 0;
    if (st >= -2 && h < 4.2) {
      beach = smoothstep(cbw + 3, cbw - 3, st) * (1 - smoothstep(15, 28, slope)) * (1 - crk * 0.85);
      const rockShore = crk * smoothstep(cbw + 10, 0, st);
      if (rockShore > 0) {
        w[ch.rock] = Math.max(w[ch.rock]!, rockShore * (2.5 + 2 * Math.max(0, fbm(x / 7 + 3, z / 7))));
        w[ch.stone] = Math.max(w[ch.stone]!, rockShore * 0.8);
        w[ch.forest] = w[ch.forest]! * (1 - rockShore);
        w[ch.tallgrass] = w[ch.tallgrass]! * (1 - rockShore);
      }
      const wet = beach * smoothstep(cbw * 0.38, 0, st);
      if (wet > 0) w[ch.dirt] = Math.max(w[ch.dirt]!, wet * 0.9);
    }
    if (st >= -2 && st < 10 && h < 6) {
      const steep = smoothstep(8, 0, st) * (1 - Math.min(1, beach * 1.5));
      if (steep > 0) {
        w[ch.rock] = Math.max(w[ch.rock]!, steep * 2.4);
        w[ch.grass] = w[ch.grass]! * (1 - steep * 0.8);
        w[ch.tallgrass] = w[ch.tallgrass]! * (1 - steep);
        w[ch.forest] = w[ch.forest]! * (1 - steep);
      }
    }
    let poolBeach = 0;
    for (const wb of WATER) poolBeach = Math.max(poolBeach, smoothstep(1.35, 1.05, waterShape(wb, x, z)) * smoothstep(wb.level + 1.4, wb.level + 0.5, h));
    const sand = Math.max(beach, poolBeach * 0.8);
    if (sand > 0) {
      w[ch.sand] = Math.max(w[ch.sand]!, sand * 4);
      // 东岸 = 玻璃沙（青色），南岸 = 浅色沙丘沙
      const glassK = smoothstep(330, 520, x) * smoothstep(440, 300, z);
      e[0] = Math.max(e[0]!, beach * glassK * 0.95);
      e[3] = Math.max(e[3]!, beach * (1 - glassK) * smoothstep(250, 420, z) * 0.6);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - sand * 0.6);
      w[ch.forest] = w[ch.forest]! * (1 - sand);
      w[ch.flowers] = w[ch.flowers]! * (1 - sand);
      e[0] = e[0]! * (1 - sand * 0.6);
    }
    const rv = riverProject(x, z);
    if (rv && rv.d < rv.width / 2 + 4) {
      const kb = smoothstep(rv.width / 2 + 4, rv.width / 2 + 1, rv.d);
      w[ch.sand] = Math.max(w[ch.sand]!, kb * 2);
      w[ch.rock] = Math.max(w[ch.rock]!, kb * smoothstep(0.0, 0.25, fbm(x / 6, z / 6)) * 2.5);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - kb);
      w[ch.forest] = w[ch.forest]! * (1 - kb);
      e[1] = e[1]! * (1 - kb);
    }
    // 水下
    let underwater = h < 0;
    for (const wb of WATER) if (waterShape(wb, x, z) < 1 && h < wb.level) underwater = true;
    if (rv && rv.d < rv.width / 2 + 1 && h < rv.level) underwater = true;
    if (underwater) {
      w.fill(0);
      w[ch.sand] = 1;
      w[ch.rock] = smoothstep(0.1, 0.4, fbm(x / 20, z / 20));
      e.fill(0);
    }
    // 陡坡 = 岩石（高原 / 高崖崖壁染板岩色）
    const rock = smoothstep(30, 42, slope);
    if (rock > 0) {
      const keep = 1 - Math.min(1, rock);
      w[ch.sand] = w[ch.sand]! * keep;
      w[ch.grass] = w[ch.grass]! * keep;
      w[ch.dirt] = w[ch.dirt]! * keep;
      w[ch.rock] = Math.max(w[ch.rock]!, rock * 5);
      w[ch.tallgrass] = w[ch.tallgrass]! * keep;
      w[ch.flowers] = w[ch.flowers]! * keep;
      e[0] = e[0]! * keep;
      e[1] = e[1]! * keep;
      e[3] = e[3]! * keep;
      e[2] = e[2]! * keep;
    }
    let sum = 0;
    for (let c = 0; c < CH; c++) {
      w[c] = Math.max(0, w[c]!);
      sum += w[c]!;
    }
    if (sum <= 1e-6) {
      w[ch.grass] = 1;
      sum = 1;
    }
    const k = (j * SPLAT + i) * 4;
    let acc = 0;
    let maxC = 0;
    for (let c = 0; c < CH; c++) {
      const v = Math.round((w[c]! / sum) * 255);
      if (w[c]! > w[maxC]!) maxC = c;
      acc += v;
      stats[c] = stats[c]! + w[c]! / sum;
      (c < 4 ? splat0 : splat1)[k + (c % 4)] = v;
    }
    {
      const arr = maxC < 4 ? splat0 : splat1;
      arr[k + (maxC % 4)] = arr[k + (maxC % 4)]! + 255 - acc;
    }
    let es = 0;
    for (let c = 0; c < 4; c++) es += clamp(e[c]!, 0, 1);
    const norm = es > 1 ? 1 / es : 1;
    for (let c = 0; c < 4; c++) {
      const v = clamp(e[c]!, 0, 1) * norm;
      splat2[k + c] = Math.round(v * 255);
      extStats[c] = extStats[c]! + v;
    }
  }
writeFileSync(join(outDir, 'splat0.png'), encode({ width: SPLAT, height: SPLAT, data: splat0, depth: 8, channels: 4 }));
writeFileSync(join(outDir, 'splat1.png'), encode({ width: SPLAT, height: SPLAT, data: splat1, depth: 8, channels: 4 }));
writeFileSync(join(outDir, 'splat2.png'), encode({ width: SPLAT, height: SPLAT, data: splat2, depth: 8, channels: 4 }));
const EXT = GLAZE.ext!.names;
log(`splat  ${SURFACE_CHANNELS.map((c, i) => `${c} ${((stats[i]! / (SPLAT * SPLAT)) * 100).toFixed(1)}%`).join(' · ')}`);
log(`splat2 ${EXT.map((c, i) => `${c} ${((extStats[i]! / (SPLAT * SPLAT)) * 100).toFixed(2)}%`).join(' · ')}`);

// ———————————— 8. 摆放物 ————————————
const props: PropInstance[] = [];
const allRoads = GLAZE.roads.filter((r) => r.surface !== 'boardwalk');
function faceRoad(x: number, z: number): number {
  let best = { d: Infinity, x: 0, z: 0 };
  for (const r of allRoads) {
    const n = nearestOnPolyline(x, z, r.points);
    if (n.d < best.d) best = n;
  }
  return Math.atan2(best.x - x, best.z - z);
}
/** 离 (x, z) 最近道路的走向（弧度） */
function roadDir(x: number, z: number): number {
  let best = { d: Infinity, dir: [0, 1] as Vec2 };
  for (const r of allRoads) {
    const n = nearestOnPolyline(x, z, r.points);
    if (n.d < best.d) best = n;
  }
  return Math.atan2(best.dir[0], best.dir[1]);
}

// 城镇（手工布局）
for (const t of TOWNS) props.push(...t.props);
const townRefs = new Set(props.map((q) => q.ref).filter((r): r is string => !!r));

// POI 自动构件：洞口 / 地标告示
for (const p of GLAZE.pois) {
  if (townRefs.has(p.id)) continue;
  const door: Vec2 = [p.position[0], p.position[2]];
  if (p.kind === 'cave') {
    const yaw = p.doorYaw ?? 0;
    const y0 = bilinear(door[0], door[1]);
    let d = 0.5;
    while (d < 14 && bilinear(door[0] - Math.sin(yaw) * d, door[1] - Math.cos(yaw) * d) < y0 + 3) d += 0.5;
    props.push({ type: 'cave-mouth', ref: p.id, position: [door[0] - Math.sin(yaw) * (d - 0.5), door[1] - Math.cos(yaw) * (d - 0.5)], yaw, size: p.id.startsWith('victory-road') ? [7, 7, 5] : [4.6, 5, 4.4] });
  } else if (p.kind === 'landmark' && p.id !== 'league-gate' && p.id !== 'mirage-sandbar') {
    props.push({ type: 'sign', ref: p.id, position: door, yaw: faceRoad(door[0], door[1]), size: [1.6, 1.6, 0.2] });
  }
}

// 木桥
for (const bridge of GLAZE.roads.filter((r) => r.surface === 'boardwalk')) {
  const a = bridge.points[0]!;
  const b = bridge.points[bridge.points.length - 1]!;
  const mid = riverProject((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const y = Math.max((mid?.level ?? 0) + 1.3, heightAt(a[0], a[1]), heightAt(b[0], b[1]));
  props.push({ type: 'boardwalk', id: bridge.id, position: [0, 0], y, yaw: 0, size: [bridge.width, 0.35, 0], points: bridge.points });
}

// 阻挡物：碎岩 / 藤蔓 / 巨石（ref = 阻挡 id，清除后整体隐藏）
for (const b of GLAZE.blockers) {
  const pos: Vec2 = [b.position[0], b.position[2]];
  const r = b.radius ?? 2;
  if (b.type === 'rock-smash') props.push({ type: 'breakable-rock', ref: b.id, position: pos, yaw: 0, size: [r * 2, 2.4, r * 2] });
  else if (b.type === 'vines') props.push({ type: 'vine-wall', ref: b.id, position: pos, yaw: roadDir(pos[0], pos[1]), size: [r * 2 + 1, 4.2, 1.2], seed: Math.round(pos[0] - pos[1]) });
  else if (b.type === 'strength') props.push({ type: 'boulder', ref: b.id, position: pos, yaw: 0, size: [r * 2, r * 2, r * 2], seed: Math.round(pos[0] + pos[1]) });
}

// 海蚀石林：灰白石笋（与地形尖峰相配）+ 海蚀柱脚下的乱石
{
  const r = makeNoise(SEED + 7).rnd;
  const sz = zone('stone-forest');
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 70; tries++) {
    const x = -680 + r() * 400;
    const z = -100 + r() * 520;
    if (sdPolygon(x, z, sz.polygon) > -6) continue;
    if (allRoads.some((q) => distPolyline(x, z, q.points) < q.width / 2 + 5)) continue;
    if (heightAt(x, z) < 2) continue;
    const s = Math.round(r() * 1e4);
    const hh = 6 + r() * 12;
    props.push({ type: 'karst-pinnacle', position: [x, z], yaw: r() * 6.28, size: [2.4 + r() * 2.2, hh, 2.4 + r() * 2.2], seed: 6100 + s, color: r() > 0.5 ? '#b9b4ab' : '#a7a39c' });
    placed++;
  }
}
for (const it of ISLETS.filter((q) => q.id.startsWith('stack-')))
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + it.z;
    const cx = it.x + Math.cos(a) * (it.r + 4);
    const cz = it.z + Math.sin(a) * (it.r + 4);
    props.push({ type: 'rocks', position: [cx, cz], y: Math.max(0.2, heightAt(cx, cz)), yaw: k, size: [4, 2.2, 4], seed: 6200 + k + Math.round(-it.z), color: '#a7a39c' });
  }
// 幽灵沼泽：枯树、古墓群（墓碑 + 残柱）、鬼火
{
  const r = makeNoise(SEED + 11).rnd;
  const mz = zone('ghost-marsh');
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 46; tries++) {
    const x = -680 + r() * 400;
    const z = -580 + r() * 560;
    if (sdPolygon(x, z, mz.polygon) > -6) continue;
    if (WATER.some((wb) => waterShape(wb, x, z) < 1.3)) continue;
    if (allRoads.some((q) => distPolyline(x, z, q.points) < q.width / 2 + 3)) continue;
    if (heightAt(x, z) < 2.6 || slopeDeg(x, z) > 20) continue;
    props.push({ type: 'dead-tree', position: [x, z], yaw: r() * 6.28, size: [3, 5 + r() * 4, 3], seed: 6300 + placed });
    placed++;
  }
  const g = GLAZE.pois.find((p) => p.id === 'marsh-graves')!;
  const [gx, , gz] = g.position;
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++) {
      if (r() < 0.2) continue;
      const x = gx - 22 + col * 8 + (r() - 0.5) * 2;
      const z = gz - 10 + row * 7 + (r() - 0.5) * 2;
      props.push({ type: 'tombstone', position: [x, z], yaw: (r() - 0.5) * 0.5, size: [1.1, 1.3 + r() * 0.6, 0.35], seed: 6400 + row * 6 + col, variant: r() > 0.7 ? 'cross' : r() > 0.4 ? 'round' : 'slab' });
    }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    props.push({ type: 'ruin-pillar', position: [gx + Math.cos(a) * 36, gz + Math.sin(a) * 26], yaw: k, size: [1.3, 2.5 + (k % 3) * 1.4, 1.3], seed: 6450 + k, variant: 'moss' });
  }
  props.push({ type: 'stele', ref: 'marsh-graves-stele', position: [gx, gz - 18], yaw: 0, size: [1.6, 3, 0.8] });
  for (let k = 0; k < 18; k++) {
    let x = 0;
    let z = 0;
    for (let t = 0; t < 30; t++) {
      x = -660 + r() * 360;
      z = -560 + r() * 520;
      if (sdPolygon(x, z, mz.polygon) < -10) break;
    }
    props.push({ type: 'wisp', position: [x, z], yaw: 0, size: [0.5, 1.6 + r() * 1.4, 0.5], seed: 6500 + k, color: r() > 0.5 ? '#8fe8ff' : '#b99aff' });
  }
}
// 暗影林：林间古灯笼（幽冥镇方向的引路灯）
for (const [x, z] of [[-280, -175], [-200, -160], [-100, -110], [0, -80], [100, -60], [200, -20], [290, 40]] as Vec2[]) {
  const yaw = roadDir(x, z);
  props.push({ type: 'stone-lantern', position: [x + Math.cos(yaw) * 4.2, z - Math.sin(yaw) * 4.2], yaw, size: [0.9, 2, 0.9] });
}
// 玻璃海岸：海岸晶簇（玻璃质的青色晶体）
{
  const r = makeNoise(SEED + 13).rnd;
  const gz = zone('glass-coast');
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 40; tries++) {
    const x = 360 + r() * 380;
    const z = -260 + r() * 680;
    if (sdPolygon(x, z, gz.polygon) > -4) continue;
    const h = heightAt(x, z);
    if (h < 0.6 || h > 14) continue;
    if (allRoads.some((q) => distPolyline(x, z, q.points) < q.width / 2 + 3)) continue;
    const rv = riverProject(x, z);
    if (rv && rv.d < rv.width / 2 + 4) continue;
    props.push({ type: 'glass-crystal', position: [x, z], yaw: r() * 6.28, size: [1.6 + r() * 1.6, 1.4 + r() * 2.4, 1.6 + r() * 1.6], seed: 6600 + placed, color: r() > 0.6 ? '#bfeef0' : '#8fdcdc' });
    placed++;
  }
  const gb = GLAZE.pois.find((p) => p.id === 'glass-beach')!;
  for (let k = 0; k < 5; k++)
    props.push({ type: 'glass-crystal', position: [gb.position[0] - 10 + k * 5, gb.position[2] - 8 + (k % 2) * 4], yaw: k, size: [2.4, 3.4 + (k % 3), 2.4], seed: 6700 + k, color: '#a6e9e6' });
}
// 琉璃水脉泉眼：泉池石圈 + 石碑
{
  const vs = GLAZE.pois.find((p) => p.id === 'vein-spring')!;
  props.push({ type: 'spring-rim', position: [vs.position[0] + 8, vs.position[2] + 8], yaw: 0.4, size: [7, 0.8, 5] });
  props.push({ type: 'stele', ref: 'vein-spring-stele', position: [vs.position[0] - 2, vs.position[2] + 2], yaw: 0.6, size: [1.4, 2.6, 0.7] });
}
// 蜃景沙丘：风蚀石与枯木（沙丘之间）
for (const [x, z, s] of [[-120, 360, 1], [40, 330, 2], [180, 350, 3], [300, 420, 4], [-60, 480, 5], [120, 470, 6]] as Array<[number, number, number]>)
  props.push({ type: 'rocks', position: [x, z], yaw: s, size: [3.6, 2.2, 3.6], seed: 6800 + s, color: '#d9c49a' });
for (const [x, z, s] of [[-200, 400, 1], [80, 400, 2], [250, 330, 3]] as Array<[number, number, number]>)
  props.push({ type: 'dead-tree', position: [x, z], yaw: s, size: [2.4, 4, 2.4], seed: 6850 + s, variant: 'bleached' });
// 精灵联盟大门（高原北端）：先立门前石碑，联盟大门建筑在 M3-14
{
  const lg = GLAZE.pois.find((p) => p.id === 'league-gate')!;
  props.push({ type: 'ruin-arch', ref: 'league-gate', position: [lg.position[0], lg.position[2] - 4], yaw: 0, size: [12, 10, 2], variant: 'league' });
  for (const s of [-1, 1]) props.push({ type: 'statue', position: [lg.position[0] + s * 9, lg.position[2] + 6], yaw: 0, size: [2, 4, 2], variant: 'star', color: '#d8c27a' });
}
// 蜃景沙洲：搁浅的旧船
props.push({ type: 'shipwreck', ref: 'sandbar-wreck', position: [-40, 672], y: heightAt(-40, 672) - 0.4, yaw: 0.9, size: [6, 3, 18] });
// 礁石迷宫：每个缺口两侧一红一绿的航标；迷宫南口一块告示浮标
for (const w of REEF_MAZE)
  if (w.gap !== undefined)
    for (const s of [-1, 1]) props.push({ type: 'buoy', position: [w.gap + s * (MAZE_GAP / 2 - 2), w.a[1] + 6], y: 0, yaw: 0, size: [0.9, 1.8, 0.9], color: s < 0 ? '#d9453b' : '#3f9f4a' });
for (const it of ISLETS.filter((q) => q.id.startsWith('reef-') && Number(q.id.split('-')[2]) % 3 === 0))
  props.push({ type: 'rocks', position: [it.x + 3, it.z - 2], y: Math.max(0.3, heightAt(it.x + 3, it.z - 2)), yaw: it.x, size: [3.4, 2, 3.4], seed: 6900 + Math.round(-it.x + it.z), color: '#7d7a80' });
// 深水暗区边缘的警示浮标
for (let k = 0; k < 6; k++) {
  const a = (k / 6) * Math.PI * 2;
  props.push({ type: 'buoy', position: [ABYSS.x + Math.cos(a) * (ABYSS.r + 10), ABYSS.z + Math.sin(a) * (ABYSS.r + 10)], y: 0, yaw: 0, size: [0.9, 1.9, 0.9], color: '#7a5bd6' });
}

let drowned = 0;
for (const p of props) if (p.y === undefined && p.type !== 'fence' && p.type !== 'boardwalk' && p.type !== 'rail' && p.type !== 'rope-bridge' && heightAt(p.position[0], p.position[1]) < 0.3) drowned++;
const propsFile: PropsFile = { version: 1, island: 'glaze', generatedBy: `gen-glaze seed=${SEED}`, props };
writeFileSync(join(outDir, 'props.json'), JSON.stringify(propsFile, null, 1));
log(`props.json  ${props.length} 个摆放物（落水 ${drowned}）`);

// ———————————— 9. 预览图（1024²，2 m/px） ————————————
const PV = 1024;
const pv = new Uint8Array(PV * PV * 3);
const COLORS: Record<string, [number, number, number]> = {
  grass: [124, 196, 90],
  forest: [58, 122, 58],
  tallgrass: [86, 160, 60],
  dirt: [201, 164, 107],
  sand: [239, 224, 168],
  rock: [142, 138, 132],
  stone: [185, 180, 170],
  flowers: [230, 150, 190],
};
const EXT_RGB: Array<[number, number, number]> = [[166, 233, 230], [75, 70, 54], [94, 83, 114], [241, 226, 189]];
const PX = SIZE / PV;
for (let j = 0; j < PV; j++)
  for (let i = 0; i < PV; i++) {
    const x = -HALF + (i + 0.5) * PX;
    const z = -HALF + (j + 0.5) * PX;
    const h = heightAt(x, z);
    const si = Math.floor(((i + 0.5) / PV) * SPLAT);
    const sj = Math.floor(((j + 0.5) / PV) * SPLAT);
    const k = (sj * SPLAT + si) * 4;
    let c: [number, number, number] = [0, 0, 0];
    SURFACE_CHANNELS.forEach((name, ci) => {
      const v = (ci < 4 ? splat0 : splat1)[k + (ci % 4)]! / 255;
      c = [c[0] + COLORS[name]![0] * v, c[1] + COLORS[name]![1] * v, c[2] + COLORS[name]![2] * v];
    });
    for (let q = 0; q < 4; q++) {
      const v = splat2[k + q]! / 255;
      c = [lerp(c[0], EXT_RGB[q]![0], v), lerp(c[1], EXT_RGB[q]![1], v), lerp(c[2], EXT_RGB[q]![2], v)];
    }
    const shade = clamp(0.8 + (heightAt(x - 2, z - 2) - h) * 0.12, 0.55, 1.2);
    c = [c[0] * shade, c[1] * shade, c[2] * shade];
    let wl = h < 0 ? 0 : -Infinity;
    for (const wb of WATER) if (waterShape(wb, x, z) < 1.1 && h < wb.level) wl = Math.max(wl, wb.level);
    const rp = riverProject(x, z);
    if (rp && rp.d < rp.width / 2 + 3 && h < rp.level) wl = Math.max(wl, rp.level);
    if (wl > -Infinity) {
      const t = clamp((wl - h) / 12, 0, 1);
      c = [lerp(110, 30, t), lerp(200, 90, t), lerp(225, 170, t)];
    }
    const o = (j * PV + i) * 3;
    pv[o] = clamp(c[0], 0, 255);
    pv[o + 1] = clamp(c[1], 0, 255);
    pv[o + 2] = clamp(c[2], 0, 255);
  }
const plot = (x: number, z: number, rgb: [number, number, number]) => {
  const i = Math.round((x + HALF) / PX);
  const j = Math.round((z + HALF) / PX);
  if (i < 0 || j < 0 || i >= PV || j >= PV) return;
  pv.set(rgb, (j * PV + i) * 3);
};
for (const zn of GLAZE.zones)
  for (let s = 0; s < zn.polygon.length; s++) {
    const [ax, az] = zn.polygon[s]!;
    const [bx, bz] = zn.polygon[(s + 1) % zn.polygon.length]!;
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 1.5) plot(ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len, zn.kind === 'town' ? [255, 240, 120] : zn.kind === 'sea' ? [160, 220, 255] : [255, 255, 255]);
  }
for (const p of props) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) plot(p.position[0] + dx * PX, p.position[1] + dz * PX, [200, 60, 50]);
for (const p of GLAZE.pois) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) plot(p.position[0] + dx * PX, p.position[2] + dz * PX, [40, 40, 220]);
writeFileSync(join(outDir, 'preview.png'), encode({ width: PV, height: PV, data: pv, depth: 8, channels: 3 }));

// ———————————— 10. 元数据 + 自检 ————————————
let land = 0;
let ok = 0;
for (let j = 0; j < N; j += 2)
  for (let i = 0; i < N; i += 2) {
    const x = wx(i);
    const z = wx(j);
    if (heightAt(x, z) < 0) continue;
    land++;
    if (slopeDeg(x, z) < 40) ok++;
  }
// 道路坡度自检：每条路最大纵坡
const roadReport: string[] = [];
for (const r of landRoads) {
  let maxG = 0;
  let at = '';
  let wet = 0;
  for (let s = 0; s + 1 < r.points.length; s++) {
    const [ax, az] = r.points[s]!;
    const [bx, bz] = r.points[s + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let q = 0; q < n; q++) {
      const x0 = ax + ((bx - ax) * q) / n;
      const z0 = az + ((bz - az) * q) / n;
      const x1 = ax + ((bx - ax) * (q + 1)) / n;
      const z1 = az + ((bz - az) * (q + 1)) / n;
      const g = Math.abs(heightAt(x1, z1) - heightAt(x0, z0)) / Math.hypot(x1 - x0, z1 - z0);
      const gd = (Math.atan(g) * 180) / Math.PI;
      if (gd > maxG) {
        maxG = gd;
        at = `(${x0.toFixed(0)},${z0.toFixed(0)})`;
      }
      if (heightAt(x0, z0) < 0.2) wet++;
    }
  }
  if (maxG > 24 || wet > 0) roadReport.push(`${r.id} 最大纵坡 ${maxG.toFixed(1)}° @${at}${wet ? `，${wet} 段在水里` : ''}`);
}
// POI 自检：落水 / 熔岩
const poiReport: string[] = [];
for (const p of GLAZE.pois) {
  const h = heightAt(p.position[0], p.position[2]);
  const gi = clamp(Math.round((p.position[0] + HALF) / CELL), 0, N - 1);
  const gj = clamp(Math.round((p.position[2] + HALF) / CELL), 0, N - 1);
  if (p.kind !== 'dock' && h < 0.3) poiReport.push(`${p.id} 在水里（${h.toFixed(1)} m）`);
  if (LAVA_MASK[gj * N + gi]! > 0.3) poiReport.push(`${p.id} 在熔岩里`);
}
const meta = {
  seed: SEED,
  generatedAt: new Date().toISOString(),
  heightmap: { size: N, cell: CELL, range: GLAZE.heightRange, min: hmin, max: hmax, clipped },
  splat: {
    size: SPLAT,
    channels: SURFACE_CHANNELS,
    coverage: Object.fromEntries(SURFACE_CHANNELS.map((c, i) => [c, +(stats[i]! / (SPLAT * SPLAT)).toFixed(4)])),
    ext: Object.fromEntries(EXT.map((c, i) => [c, +(extStats[i]! / (SPLAT * SPLAT)).toFixed(4)])),
  },
  props: props.length,
  landRatio: +(land / ((N + 1) / 2) ** 2).toFixed(3),
  landKm2: +((land * (CELL * 2) ** 2) / 1e6).toFixed(2),
  walkableRatio: +(ok / land).toFixed(3),
  roadIssues: roadReport,
  poiIssues: poiReport,
};
writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
log(`完成：陆地 ${meta.landKm2} km²，可行走 ${(meta.walkableRatio * 100).toFixed(1)}%`);
if (roadReport.length) log(`道路问题：\n  ${roadReport.join('\n  ')}`);
if (poiReport.length) log(`POI 问题：\n  ${poiReport.join('\n  ')}`);
void rnd;

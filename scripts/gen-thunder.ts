/**
 * M3-02 / M3-03 · 雷鸣群岛地形生成器（输出格式与 gen-tide 相同：height / splat0-2 / props / preview / meta）。
 *   pnpm gen:thunder              生成到 assets/islands/thunder/
 *   pnpm gen:thunder --seed 7     换种子（只改变起伏细节，海岸线 / 河道 / 冰川等手工布局不变）
 *
 * 输入：src/config/islands/thunder.ts（区域、道路、水体、河流、洋流、漩涡、POI、阻挡）
 * splat2 扩展层（THUNDER.ext）：积雪 / 冰面 / 板岩 / 石楠。
 *
 * 地貌（设计 §3.2「南部平原 → 中部冰川 → 北部高崖」，主色板紫灰 / 金黄 / 冰蓝）：
 *   - 西段 x < -620 为碧潮—雷鸣海域：走廊两侧暗礁群（礁岩露出海面），中部 14–22 m 深；洋流 / 漩涡在运行时表现。
 *   - 主岛一条连续海岸线（COAST）+ 噪声湾岬；西北「雷鸣屿」、东南「灯塔礁」两座小岛。
 *   - 西南：雷鸣镇（16 m）坐在雷暴高原的南缘台地上，码头坡道下到西岸。
 *   - 西：雷暴高原 —— 分层板岩台地（每级约 7 m 的阶地），东北缘 晶石洞窟。
 *   - 南：雷鸣平原（6–12 m，开阔草地 / 农田），东南晨光镇（8 m，风车水塘）与古灯塔岬（岩岸，岬角 20 m）。
 *   - 中：晨光丘陵向北逐级抬升到雪原镇（30 m）；融雪溪从冰舌流下，经晨光镇西侧入海。
 *   - 中北：冰川雪原（平滑冰盖，向北由 32 m 升到 58 m，冰湖 / 冰川遗迹 / 冰裂纹）。
 *   - 北：云顶高崖（74 m 台地）南侧 16–20 m 崖壁、北侧海崖；云雀镇在崖顶，崖路下到北岸码头。
 *   - 东：盘山雪道所在的东部山脊（峰顶 100 m 上下），雪道沿山腰盘绕上崖。
 *   - 道路 / 城镇压平，道路纵坡 ≤ 17°。
 */
import { encode } from 'fast-png';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THUNDER } from '../src/config/islands/thunder';
import { THUNDER_TOWNS } from '../src/config/islands/towns/thunder';
import { SURFACE_CHANNELS, type PropInstance, type PropsFile, type Vec2 } from '../src/config/islands/types';
import { applyWaterfalls } from './lib/falls';
import { clamp, distPolyline, lerp, makeNoise, nearestOnPolyline, sdPolygon, smoothstep } from './lib/noise';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', THUNDER.heightmap.replace(/\/[^/]+$/, ''));
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 20261004;

const N = 1025;
const SIZE = THUNDER.size[0];
const HALF = SIZE / 2;
const CELL = SIZE / (N - 1);
const [H_MIN, H_MAX] = THUNDER.heightRange;
const SPLAT = 2048;
const { fbm, ridged, noise, rnd } = makeNoise(SEED);
const T0 = Date.now();
const log = (s: string) => console.info(`[thunder ${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`);

const zone = (id: string) => {
  const z = THUNDER.zones.find((q) => q.id === id);
  if (!z) throw new Error(`缺少区域 ${id}`);
  return z;
};
const LAND_ZONES = THUNDER.zones.filter((z) => z.kind !== 'sea');
/** 区域包围盒（landSdf 远处跳过 sdPolygon） */
const ZBOX = LAND_ZONES.map((z) => {
  const xs = z.polygon.map((p) => p[0]);
  const zs = z.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
});
const RIVERS = THUNDER.rivers ?? [];
const WATER = THUNDER.waterBodies;
/** 盛行风浪来向（西北，-Z 为北）：西北岸迎浪多礁石，东南背风湾多沙滩 */
const WAVE_FROM: Vec2 = [-0.6, -0.8];
/** 走廊东口：x 大于此值才可能是主岛陆地 */
const CORRIDOR_X = -620;

/**
 * 主岛海岸线（+Z 为南）：西岸雷鸣镇码头、西南平原沙滩弧、南岸融雪溪口、东南古灯塔岬、
 * 东岸东部山脊的岩岸、东北与北岸云顶高崖的海崖（北岸中部的码头海湾）、西北雷暴高原的礁岸。
 */
const COAST: Vec2[] = [
  [-520, -600], [-600, -500], [-662, -420], [-600, -340], [-560, -280], [-620, -200], [-642, -100], [-600, -20], [-650, 80], [-662, 170], [-614, 250],
  [-612, 360], [-628, 420], [-600, 480], [-540, 515], [-500, 560], [-540, 620], [-610, 690], [-560, 742], [-460, 712], [-380, 682], [-300, 712],
  [-220, 772], [-130, 742], [-60, 692], [20, 662], [100, 692], [170, 740], [226, 744], [290, 702], [360, 642], [430, 622], [500, 660], [580, 650],
  [660, 690], [760, 682], [860, 652], [930, 602], [962, 530], [900, 482], [800, 462], [740, 420], [720, 340], [780, 280], [880, 250], [960, 180],
  [990, 60], [960, -40], [900, -120], [930, -220], [980, -320], [950, -440], [900, -540], [820, -600], [780, -700], [700, -780], [600, -762],
  [520, -782], [440, -832], [330, -852], [220, -822], [120, -792], [40, -762], [-40, -742], [-100, -722], [-150, -700], [-200, -732], [-270, -782],
  [-360, -762], [-440, -702],
];
/** 离岛与暗礁：中心、半径、最高点；reef = 走廊边的礁岩（露出海面 1–3 m） */
const ISLETS: Array<{ id: string; x: number; z: number; r: number; top: number; reef?: boolean }> = [
  { id: 'thunder-isle', x: -760, z: -520, r: 46, top: 26 },
  { id: 'lighthouse-reef', x: 990, z: 640, r: 22, top: 9 },
  // 走廊北缘礁群（z ≈ 90）与南缘礁群（z ≈ 710）
  ...[-980, -900, -820, -720].map((x, k) => ({ id: `reef-n${k}`, x, z: 84 - (k % 2) * 14, r: 9 + (k % 3) * 2, top: 2.6, reef: true })),
  ...[-960, -870, -780, -700].map((x, k) => ({ id: `reef-s${k}`, x, z: 716 + (k % 2) * 12, r: 10 + (k % 2) * 3, top: 2.4, reef: true })),
];

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

/** 雷暴高原：分层板岩阶地（每级 7 m），南缘接雷鸣镇台地，向北东抬升 */
function highlandHeight(x: number, z: number): number {
  const base = 24 + smoothstep(330, -280, z) * 22 + 8 * ridged(x / 120 + 3, z / 120 + 1);
  const step = 7;
  const terr = Math.floor(base / step) * step + smoothstep(0.7, 1, (base / step) % 1) * step;
  return lerp(base, terr, 0.55) + 1.2 * fbm(x / 25, z / 25);
}
/** 冰川：平滑冰盖，向北升高；冰湖处压平 */
const FROZEN_LAKE = { x: -150, z: -440, rx: 70, rz: 44 };
const NUNATAKS: Array<[number, number, number, number]> = [[-380, -440, 60, 22], [60, -470, 50, 16], [300, -400, 70, 26], [-20, -300, 34, 9], [380, -300, 40, 12]];
function glacierHeight(x: number, z: number): number {
  const base = 32 + smoothstep(-200, -540, z) * 26 + 3 * fbm(x / 140 + 7, z / 140) + 0.6 * fbm(x / 30, z / 30);
  const e = ((x - FROZEN_LAKE.x) / FROZEN_LAKE.rx) ** 2 + ((z - FROZEN_LAKE.z) / FROZEN_LAKE.rz) ** 2;
  const lakeH = 44;
  let h = lerp(base, lakeH, smoothstep(1.6, 1.0, e));
  // 冰原石峰（nunatak）：冰盖上露出的岩峰
  for (const [nx, nz, nr, nh] of NUNATAKS) h += nh * Math.pow(Math.max(0, 1 - Math.hypot(x - nx, z - nz) / nr), 1.8) * (0.8 + 0.4 * ridged(x / 20, z / 20));
  return h;
}
/** 东部山脊：南北走向的脊线（x ≈ 760），峰顶 90–110 m */
const RIDGE_AXIS: Vec2[] = [[700, 120], [760, -60], [790, -240], [760, -420], [700, -560]];
function ridgeHeight(x: number, z: number): number {
  const d = distPolyline(x + fbm(x / 90, z / 90) * 30, z, RIDGE_AXIS);
  const peak = 70 + 30 * ridged(x / 140 + 5, z / 140 + 2);
  // 北段向云顶高崖抬升（雪道沿山腰缓升到崖顶）
  const north = smoothstep(-420, -660, z) * 34;
  return Math.max(36 + north, 36 + (peak - 36) * Math.pow(Math.max(0, 1 - d / 260), 1.5)) + 4 * ridged(x / 50, z / 50);
}

/** 每个区域的地貌函数 */
const REGION: Record<string, (x: number, z: number) => number> = {
  'thunder-town': (x, z) => 11 + 0.4 * fbm(x / 40, z / 40),
  'dawn-town': (x, z) => 8 + 0.4 * fbm(x / 40, z / 40),
  'snow-town': (x, z) => 30 + 0.5 * fbm(x / 40, z / 40),
  'lark-town': (x, z) => 74 + 0.4 * fbm(x / 40, z / 40),
  'lighthouse-cape': (x, z) => 8 + 8 * fbm(x / 70 + 3, z / 70) + 12 * smoothstep(700, 860, x) * smoothstep(460, 560, z) + 3 * ridged(x / 30, z / 30),
  'storm-highland': highlandHeight,
  'thunder-plain': (x, z) => 7 + 4 * fbm(x / 120 + 2, z / 120 + 6) + 0.8 * fbm(x / 25, z / 25) + smoothstep(380, 240, z) * 4,
  'dawn-hills': (x, z) => 10 + smoothstep(360, -160, z) * 18 + 7 * ridged(x / 110 + 9, z / 110) + 1.5 * fbm(x / 30, z / 30),
  glacier: glacierHeight,
  'frost-road': ridgeHeight,
  'cloud-cliffs': (x, z) => 72 + 3 * fbm(x / 80 + 1, z / 80 + 4) + 2 * ridged(x / 40, z / 40),
};
/** 各区域的影响范围（米）：城镇过渡短，高崖 / 高原阶地较陡 */
const FALLOFF: Record<string, number> = { 'cloud-cliffs': 14, 'storm-highland': 40, 'frost-road': 70, glacier: 50, 'snow-town': 30, 'lark-town': 20 };

/** 区域之外的底色：低山 */
function highlands(x: number, z: number): number {
  return 24 + 14 * ridged(x / 160, z / 160);
}

function landSdf(x: number, z: number): number {
  // 雷鸣群岛：海岸线只由 COAST 决定（区域多边形只影响高度，避免沿区域直边出现方正海岸）
  let d = Infinity;
  const wobble = fbm(x / 140 + 20, z / 140) * 22 + fbm(x / 60 + 3, z / 60) * 10 + fbm(x / 22, z / 22 + 9) * 3;
  d = Math.min(d, sdPolygon(x, z, COAST) + wobble);
  // 航线走廊：x < -612 一律是海（码头外 10 m 起）
  d = Math.max(d, CORRIDOR_X - x + fbm(z / 50, 7) * 3);
  for (const it of ISLETS) d = Math.min(d, Math.hypot(x - it.x, z - it.z) - it.r + fbm(x / 14 + it.r, z / 14) * 4);
  d = Math.max(d, Math.max(Math.abs(x), Math.abs(z)) - (HALF - 16)); // 世界边缘留海
  return d;
}

function isletHeight(x: number, z: number): { k: number; h: number } {
  let best = { k: 0, h: 0 };
  for (const it of ISLETS) {
    const r = Math.hypot(x - it.x, z - it.z);
    const k = smoothstep(it.r + 30, it.r + 5, r);
    if (k > best.k) best = { k, h: 1 + (it.top - 1) * smoothstep(it.r, 0, r) + fbm(x / 9, z / 9) * (it.reef ? 0.5 : 1.4) };
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
  const bw = lerp(8, 40, smoothstep(0.25, 0.8, shelter));
  const rocky = smoothstep(0.42, 0.18, shelter);
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
    // 礁群周围是 1–4 m 的浅滩；走廊中部 14–22 m
    let depth = Math.min(22, 1.2 + -t * 0.09 + Math.max(0, -t - 40) * 0.08);
    for (const it of ISLETS) if (it.reef) depth = Math.min(depth, 1 + Math.max(0, Math.hypot(x - it.x, z - it.z) - it.r) * 0.06);
    return { h: -depth + fbm(x / 40, z / 40) * 0.6, sea: 1 };
  }
  let wsum = 0;
  let hsum = 0;
  let town = 0;
  let cliff = 0;
  let forest = 0;
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
    if (zn.kind === 'town') town = Math.max(town, smoothstep(30, -5, sd));
    if (zn.id === 'cloud-cliffs' || zn.id === 'storm-highland' || zn.id === 'frost-road') cliff = Math.max(cliff, w);
    if (zn.id === 'lighthouse-cape') forest = Math.max(forest, w * 0.8); // 岬角：岩岸
  }
  let inland = wsum > 1 ? hsum / wsum : hsum + (1 - wsum) * highlands(x, z);
  const isl = isletHeight(x, z);
  if (isl.k > 0) inland = lerp(inland, isl.h, isl.k);
  inland += noise(x / 18, z / 18) * 0.35;

  let bw = 0;
  let rocky = 0;
  if (t < 90) {
    const ci = coastInfo(x, z, sdf);
    bw = lerp(ci.bw, Math.min(ci.bw, 4), Math.max(cliff * 0.8, town));
    const coveK = smoothstep(0.6, 0.85, ci.shelter);
    rocky = Math.max(ci.rocky * (1 - town), (forest * 0.7 + cliff * 0.7) * (1 - coveK));
    bw = lerp(bw, 3, Math.max(forest, cliff) * 0.8 * (1 - coveK));
  }
  COAST_BW[cell] = bw;
  COAST_ROCKY[cell] = rocky;
  const rampLen = lerp(lerp(45, 12, cliff), 14, rocky * 0.7) - bw * 0.4;
  const ramp = smoothstep(bw, bw + Math.max(8, rampLen), t);
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
const landRoads = THUNDER.roads.filter((r) => r.surface !== 'boardwalk');
for (const zn of THUNDER.zones.filter((q) => q.kind === 'town')) {
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
// M3-19 瀑布的泉池 / 瀑潭由 applyWaterfalls 雕刻
const FALL_BODIES = new Set((THUNDER.waterfalls ?? []).flatMap((f) => [`${f.id}-pool`, `${f.id}-plunge`]));
for (const wb of WATER) {
  if (FALL_BODIES.has(wb.id)) continue;
  const rx = wb.radius[0] * 1.6 + 6;
  const rz = wb.radius[1] * 1.6 + 6;
  eachCell(wb.center[0] - rx, wb.center[0] + rx, wb.center[1] - rz, wb.center[1] + rz, (k, x, z) => {
    const e = waterShape(wb, x, z) + fbm(x / 20, z / 20) * 0.05;
    const bank = wb.level + 1.0;
    // 池岸：1–1.5 倍半径内抬到水面以上（向外平滑回到原地形）
    if (e >= 1 && e < 1.5) H[k] = lerp(Math.max(H[k]!, bank), H[k]!, smoothstep(1.15, 1.5, e));
    if (e < 1) {
      const deep = wb.id.startsWith('spring') ? 1.4 : 4;
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

const LAVA_MASK = new Float32Array(N * N); // 雷鸣群岛没有熔岩（POI 自检沿用）
log('水系完成');

// 4. 洞口崖壁：洞穴 POI 背后 3–30 m 抬起一面陡崖（洞口贴在崖脚）
for (const p of THUNDER.pois.filter((q) => q.kind === 'cave')) {
  const yaw = p.doorYaw ?? 0;
  const [cx, , cz] = p.position;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const y0 = bilinear(cx, cz);
  if (p.id === 'glacier-ruins') {
    // M3-17 冰川遗迹：洞口背后是一座四面陡立的冰岩台（13 m，边缘 3 m 内立起），台顶只能攀爬上去
    eachCell(cx - 40, cx + 40, cz - 40, cz + 40, (k, x, z) => {
      const dx = x - cx;
      const dz = z - cz;
      const back = -(dx * fx + dz * fz);
      const side = Math.abs(dx * fz - dz * fx);
      const m = smoothstep(1, 4, back) * smoothstep(26, 23, back) * smoothstep(17, 14, side);
      if (m <= 0) return;
      H[k] = Math.max(H[k]!, y0 + m * (13 + 0.8 * fbm(x / 9, z / 9)));
    });
    continue;
  }
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

// 4a. M3-17 陡崖：沿 THUNDER.scarps 折线把缓坡改成 > 60° 的崖壁（左手侧 = 高处）。
// 高处取折线外 +26 m 的原高度（台地），低处取 −46 m 的原高度（冰原），崖脚留 1–2 m 碎石坡；终点 25 m 内渐弱并入山脊。
{
  const H0 = H.slice();
  const bil0 = (x: number, z: number): number => {
    const fx = clamp((x + HALF) / CELL, 0, N - 1.0001);
    const fz = clamp((z + HALF) / CELL, 0, N - 1.0001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    return lerp(lerp(H0[j * N + i]!, H0[j * N + i + 1]!, tx), lerp(H0[(j + 1) * N + i]!, H0[(j + 1) * N + i + 1]!, tx), tz);
  };
  for (const sc of THUNDER.scarps ?? []) {
    const pts = sc.points;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    const total = cum[cum.length - 1]!;
    const xs = pts.map((q) => q[0]);
    const zs = pts.map((q) => q[1]);
    eachCell(Math.min(...xs) - 60, Math.max(...xs) + 60, Math.min(...zs) - 60, Math.max(...zs) + 60, (k, x, z) => {
      if (SEA[k]) return;
      // 最近线段 + 沿线位置
      let best = { d: Infinity, along: 0, nx: 0, nz: 0, cx: 0, cz: 0 };
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, az] = pts[i]!;
        const [bx, bz] = pts[i + 1]!;
        const ex = bx - ax;
        const ez = bz - az;
        const len = Math.hypot(ex, ez);
        const t = clamp(((x - ax) * ex + (z - az) * ez) / (len * len), 0, 1);
        const qx = ax + ex * t;
        const qz = az + ez * t;
        const d = Math.hypot(x - qx, z - qz);
        // 左手法线（行进方向 (ex, ez) → 左 = (ez, −ex)）
        if (d < best.d) best = { d, along: cum[i]! + t * len, nx: ez / len, nz: -ex / len, cx: qx, cz: qz };
      }
      if (best.d > 50) return;
      const sd = (x - best.cx) * best.nx + (z - best.cz) * best.nz + 1.6 * fbm(x / 22 + 7, z / 22 - 3);
      const fade = smoothstep(total, total - 25, best.along);
      if (fade <= 0) return;
      const top = bil0(best.cx + best.nx * 26, best.cz + best.nz * 26);
      const low = bil0(best.cx - best.nx * 46, best.cz - best.nz * 46);
      if (top - low < 6) return;
      let target: number;
      if (sd >= 2) target = lerp(H0[k]!, Math.max(H0[k]!, top), smoothstep(30, 2, sd));
      else if (sd > -2) target = lerp(low + 1.6, top, smoothstep(-2, 2, sd)) + 0.6 * fbm(x / 3, z / 3);
      else target = lerp(H0[k]!, low + 1.6 * smoothstep(-46, -2, sd), smoothstep(-46, -24, sd));
      H[k] = lerp(H0[k]!, target, fade);
    });
  }
}

// 4b. POI 周边保证可走
const FLAT_SPOTS: Array<[number, number, number]> = [
  [THUNDER.spawnPoint[0], THUNDER.spawnPoint[2], 16],
  ...THUNDER.pois.filter((p) => p.kind !== 'quest' && p.kind !== 'cave' && p.kind !== 'gym' && p.id !== 'glacier-ledge-cache').map((p) => [p.position[0], p.position[2], 10] as [number, number, number]),
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
for (const t of THUNDER_TOWNS) {
  for (const q of t.pads ?? []) pads.push({ x: q.position[0], z: q.position[1], hw: q.size[0] / 2, hd: q.size[1] / 2, yaw: q.yaw ?? 0, y: q.y ?? null, blend: q.blend ?? 4 });
  for (const q of t.props) {
    if (!PAD_TYPES.has(q.type) || q.y !== undefined) continue;
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

// M3-19 瀑布石台 + 台顶泉池 + 崖脚瀑潭（最后一步，覆盖压平 / 河谷雕刻）
{
  const n = applyWaterfalls(H, N, CELL, HALF, THUNDER.waterfalls ?? [], (x, z) => fbm(x, z));
  if (n) console.info(`[thunder] 瀑布石台 ${(THUNDER.waterfalls ?? []).length} 座（${n} 格）`);
}

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
const wildZones = THUNDER.zones.filter((z) => z.kind === 'wild');
const towns = THUNDER.zones.filter((z) => z.kind === 'town');
const highlandZone = zone('storm-highland');
const glacierZone = zone('glacier');
const cliffZone = zone('cloud-cliffs');
const ridgeZone = zone('frost-road');
const plainZone = zone('thunder-plain');
const capeZone = zone('lighthouse-cape');
const roadBoxes = THUNDER.roads
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
const e = new Float32Array(4); // 积雪 / 冰面 / 板岩 / 石楠
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
/** 雪线：北高南低（北部 26 m 起积雪，南部 60 m 以上才有雪） */
const snowLine = (z: number) => lerp(26, 60, smoothstep(-500, 200, z));
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
    w[ch.flowers] = smoothstep(0.22, 0.34, fbm(x / 22 + 90, z / 22 + 13)) * (0.4 + wild * 0.4);
    let town = 0;
    for (const zn of towns) town = Math.max(town, smoothstep(12, -8, zoneSd(zn, x, z, 14)));
    // 林地：平原东部与丘陵的零星树丛（针叶林在雪线附近）
    const grove = smoothstep(0.24, 0.36, fbm(x / 50 + 7, z / 50 + 70));
    w[ch.forest] = grove * 0.9 * (1 - town);
    // 雷鸣平原：大片金黄色农田带（干草色泥土 + 花）
    const inPlain = smoothstep(10, -20, zoneSd(plainZone, x, z, 12));
    if (inPlain > 0) {
      const field = smoothstep(0.05, 0.2, fbm(x / 60 + 31, z / 60 + 3)) * inPlain;
      w[ch.dirt] = Math.max(w[ch.dirt]!, field * 0.9);
      w[ch.flowers] = Math.max(w[ch.flowers]!, field * 0.5);
      w[ch.forest] = w[ch.forest]! * (1 - field);
    }
    // 雷暴高原：板岩阶地 + 石楠
    const inHigh = smoothstep(15, -20, zoneSd(highlandZone, x, z, 16));
    if (inHigh > 0) {
      e[2] = Math.max(e[2]!, inHigh * (0.25 + 0.6 * smoothstep(12, 28, slope)) * (0.8 + 0.3 * fbm(x / 18, z / 18)));
      e[3] = Math.max(e[3]!, inHigh * smoothstep(-0.05, 0.2, fbm(x / 26 + 5, z / 26)) * 0.65);
      w[ch.rock] = Math.max(w[ch.rock]!, inHigh * smoothstep(0.1, 0.35, fbm(x / 14 + 2, z / 14)) * 1.6);
      w[ch.forest] = w[ch.forest]! * (1 - inHigh * 0.8);
    }
    // 古灯塔岬：岩石草甸
    const inCape = smoothstep(10, -15, zoneSd(capeZone, x, z, 12));
    if (inCape > 0) w[ch.rock] = Math.max(w[ch.rock]!, inCape * smoothstep(0.05, 0.3, fbm(x / 12 + 8, z / 12)) * 1.4);
    // 冰川：平滑冰盖（冰面）+ 积雪；冰湖整片冰面
    const inGlacier = smoothstep(20, -30, zoneSd(glacierZone, x, z, 22));
    const lakeE = ((x - FROZEN_LAKE.x) / FROZEN_LAKE.rx) ** 2 + ((z - FROZEN_LAKE.z) / FROZEN_LAKE.rz) ** 2 + fbm(x / 15, z / 15) * 0.08;
    const lake = smoothstep(1.02, 0.92, lakeE);
    const crevasse = smoothstep(0.55, 0.85, Math.abs(fbm(x / 9 + 2, z / 40)) * 2.2) * inGlacier * 0.6;
    // 积雪：雪线以上；高崖与东部山脊大部分覆雪；陡坡露岩
    const inCliff = smoothstep(10, -15, zoneSd(cliffZone, x, z, 12));
    const inRidge = smoothstep(15, -20, zoneSd(ridgeZone, x, z, 16));
    let snow = smoothstep(snowLine(z) - 4, snowLine(z) + 6, h);
    snow = Math.max(snow * (1 - inCliff * 0.45), inGlacier * 0.95, inCliff * smoothstep(-0.15, 0.25, fbm(x / 60 + 17, z / 60)) * 0.8, inRidge * smoothstep(40, 60, h));
    snow *= 1 - smoothstep(32, 44, slope) * 0.85;
    snow *= 0.85 + 0.25 * fbm(x / 20 + 3, z / 20);
    if (snow > 0) {
      e[0] = Math.max(e[0]!, Math.min(1, snow));
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - snow);
      w[ch.flowers] = w[ch.flowers]! * (1 - snow);
      w[ch.forest] = w[ch.forest]! * (1 - snow * 0.6);
      e[3] = e[3]! * (1 - snow);
      e[2] = e[2]! * (1 - snow * 0.7);
    }
    const ice = Math.max(lake, inGlacier * smoothstep(0.1, 0.35, fbm(x / 70 + 13, z / 70 + 5)) * 0.55, crevasse);
    if (ice > 0) {
      e[1] = Math.max(e[1]!, ice);
      e[0] = e[0]! * (1 - ice * 0.7);
    }
    // 城镇：草坪 + 石板（雪原镇 / 云雀镇保留积雪）
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
        e[2] = Math.max(e[2]!, rockShore * (z < 0 && x < 0 ? 0.6 : 0));
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
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - sand * 0.6);
      w[ch.forest] = w[ch.forest]! * (1 - sand);
      w[ch.flowers] = w[ch.flowers]! * (1 - sand);
      e[0] = e[0]! * (1 - sand * 0.6);
      e[3] = e[3]! * (1 - sand);
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
      e[2] = Math.max(e[2]!, rock * Math.max(inHigh, inCliff * 0.8) * 0.7);
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
const EXT = THUNDER.ext!.names;
log(`splat  ${SURFACE_CHANNELS.map((c, i) => `${c} ${((stats[i]! / (SPLAT * SPLAT)) * 100).toFixed(1)}%`).join(' · ')}`);
log(`splat2 ${EXT.map((c, i) => `${c} ${((extStats[i]! / (SPLAT * SPLAT)) * 100).toFixed(2)}%`).join(' · ')}`);

// ———————————— 8. 摆放物 ————————————
const props: PropInstance[] = [];
const allRoads = THUNDER.roads.filter((r) => r.surface !== 'boardwalk');
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
for (const t of THUNDER_TOWNS) props.push(...t.props);
const townRefs = new Set(props.map((q) => q.ref).filter((r): r is string => !!r));

// POI 自动构件：洞口 / 地标告示
for (const p of THUNDER.pois) {
  if (townRefs.has(p.id)) continue;
  const door: Vec2 = [p.position[0], p.position[2]];
  if (p.kind === 'cave') {
    const yaw = p.doorYaw ?? 0;
    const y0 = bilinear(door[0], door[1]);
    let d = 0.5;
    while (d < 14 && bilinear(door[0] - Math.sin(yaw) * d, door[1] - Math.cos(yaw) * d) < y0 + 3) d += 0.5;
    props.push({ type: 'cave-mouth', ref: p.id, position: [door[0] - Math.sin(yaw) * (d - 0.5), door[1] - Math.cos(yaw) * (d - 0.5)], yaw, size: p.id === 'glacier-ruins' ? [6, 6.5, 5] : [4.6, 5, 4.4] });
  } else if (p.kind === 'landmark' && p.id !== 'old-lighthouse') {
    props.push({ type: 'sign', ref: p.id, position: door, yaw: faceRoad(door[0], door[1]), size: [1.6, 1.6, 0.2] });
  }
}

// 木桥
for (const bridge of THUNDER.roads.filter((r) => r.surface === 'boardwalk')) {
  const a = bridge.points[0]!;
  const b = bridge.points[bridge.points.length - 1]!;
  const mid = riverProject((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const y = Math.max((mid?.level ?? 0) + 1.3, heightAt(a[0], a[1]), heightAt(b[0], b[1]));
  props.push({ type: 'boardwalk', id: bridge.id, position: [0, 0], y, yaw: 0, size: [bridge.width, 0.35, 0], points: bridge.points });
}

// 阻挡物：碎岩 / 藤蔓 / 巨石（ref = 阻挡 id，清除后整体隐藏）
for (const b of THUNDER.blockers) {
  const pos: Vec2 = [b.position[0], b.position[2]];
  const r = b.radius ?? 2;
  if (b.type === 'rock-smash') props.push({ type: 'breakable-rock', ref: b.id, position: pos, yaw: 0, size: [r * 2, 2.4, r * 2] });
  else if (b.type === 'vines') props.push({ type: 'vine-wall', ref: b.id, position: pos, yaw: roadDir(pos[0], pos[1]), size: [r * 2 + 1, 4.2, 1.2], seed: Math.round(pos[0] - pos[1]) });
  else if (b.type === 'strength') props.push({ type: 'boulder', ref: b.id, position: pos, yaw: 0, size: [r * 2, r * 2, r * 2], seed: Math.round(pos[0] + pos[1]) });
}

// 古灯塔（岬角尖端，内部多层塔在 M3-23）
{
  const lh = THUNDER.pois.find((p) => p.id === 'old-lighthouse')!;
  props.push({ type: 'lighthouse', ref: 'old-lighthouse', position: [lh.position[0] + 6, lh.position[2] + 6], yaw: -0.6, size: [7, 24, 7], variant: 'old' });
  props.push({ type: 'rocks', position: [lh.position[0] + 16, lh.position[2] + 14], yaw: 1, size: [5, 2, 5], seed: 5001 });
}
// 雷暴高原：板岩石柱林（避雷石林）与零散巨岩
for (const [x, z, h, s] of [[-430, 50, 9, 1], [-410, 70, 12, 2], [-445, 80, 7, 3], [-400, 40, 8, 4], [-520, -40, 10, 5], [-300, -100, 9, 6], [-480, 180, 7, 7], [-250, 100, 8, 8], [-540, -200, 11, 9]] as Array<[number, number, number, number]>)
  props.push({ type: 'basalt', position: [x, z], yaw: s, size: [4, h, 4], seed: 5100 + s, color: '#5f5b70' });
for (const [x, z, s] of [[-360, 160, 1], [-560, 100, 2], [-280, -60, 3], [-470, -120, 4], [-350, -250, 5]] as Array<[number, number, number]>)
  props.push({ type: 'rocks', position: [x, z], yaw: s, size: [4.5, 1.8, 4.5], seed: 5200 + s });
// 雷云观测站（支线·雷云观测站；观测站建筑在 M3-07 一并做）
{
  const ob = THUNDER.pois.find((p) => p.id === 'storm-observatory')!;
  props.push({ type: 'stele', ref: 'storm-observatory-stele', position: [ob.position[0] + 6, ob.position[2]], yaw: 0.4, size: [1.4, 2.8, 0.7] });
}
// 冰川遗迹入口：残柱环 + 拱门（冰封的古代文明）
{
  const g = THUNDER.pois.find((p) => p.id === 'glacier-ruins')!;
  const [gx, , gz] = g.position;
  const yaw = g.doorYaw ?? 0;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (let k = 0; k < 8; k++) {
    const a = yaw + (k / 7 - 0.5) * 2.2;
    const rr = 20 + (k % 2) * 3;
    props.push({ type: 'ruin-pillar', position: [gx + Math.sin(a) * rr, gz + Math.cos(a) * rr], yaw: k * 0.8, size: [1.4, 4 + (k % 3) * 1.5, 1.4], seed: 5300 + k, variant: 'ice' });
  }
  props.push({ type: 'ruin-arch', position: [gx + fx * 10, gz + fz * 10], yaw, size: [8, 7, 1.6], variant: 'ice' });
  props.push({ type: 'stele', ref: 'glacier-stele', position: [gx + fx * 14 + fz * 6, gz + fz * 14 - fx * 6], yaw, size: [1.6, 3, 0.8] });
}
// M3-17 冰岩台台顶：封着蓝光的冰晶 + 古代石匣（只能攀爬上来）
{
  const c = THUNDER.pois.find((p) => p.id === 'glacier-ledge-cache')!;
  const [cx, , cz] = c.position;
  props.push({ type: 'crate', ref: 'glacier-ledge-cache', position: [cx, cz], yaw: 0.5, size: [1.1, 0.8, 0.8], color: '#6a7a9a' });
  props.push({ type: 'glass-crystal', position: [cx - 3.2, cz - 2.4], yaw: 0.3, size: [1.6, 3.4, 1.6], color: '#6ab8ff' });
  props.push({ type: 'glass-crystal', position: [cx - 4.4, cz + 1.2], yaw: 1.4, size: [1.0, 2.2, 1.0], color: '#9ad8ff' });
  props.push({ type: 'glass-crystal', position: [cx + 2.6, cz - 3.6], yaw: 2.2, size: [1.2, 2.6, 1.2], color: '#6ab8ff' });
  props.push({ type: 'ruin-pillar', position: [cx + 4.2, cz + 2.2], yaw: 0.9, size: [1.3, 3.2, 1.3], seed: 5390, variant: 'ice' });
}
// 冰湖边的冰岩
for (const [x, z, s] of [[-230, -440, 1], [-80, -470, 2], [-140, -390, 3], [-200, -490, 4]] as Array<[number, number, number]>)
  props.push({ type: 'rocks', position: [x, z], yaw: s, size: [3.4, 1.4, 3.4], seed: 5400 + s, color: '#c8dbe8' });
// 雷鸣平原：风车（金黄麦田间）
for (const [x, z, s] of [[-180, 560, 1], [-40, 600, 2], [80, 560, 3], [160, 620, 4], [-300, 560, 5]] as Array<[number, number, number]>)
  props.push({ type: 'windmill', position: [x, z], yaw: s * 0.7, size: [6, 14, 6], seed: 5500 + s });
// 盘山雪道：路边的石堆路标（雪天指路）
for (const [x, z, s] of [[400, -214, 1], [600, -312, 2], [676, -480, 3], [520, -606, 4]] as Array<[number, number, number]>)
  props.push({ type: 'rocks', position: [x, z], yaw: s, size: [1.6, 1.8, 1.6], seed: 5600 + s });
// 海域：暗礁礁岩、沉船（被洋流卷上礁的货船）、航标浮标 + 漩涡警示浮标
for (const it of ISLETS.filter((q) => q.reef))
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + it.x;
    const cx = it.x + Math.cos(a) * (it.r * 0.6);
    const cz = it.z + Math.sin(a) * (it.r * 0.6);
    props.push({ type: 'rocks', position: [cx, cz], y: Math.max(0.2, heightAt(cx, cz)), yaw: k, size: [5, 2.6, 5], seed: 5700 + k + Math.round(-it.x) });
  }
props.push({ type: 'shipwreck', ref: 'reef-wreck', position: [-860, 676], y: heightAt(-860, 676), yaw: 2.2, size: [7, 3, 22] });
for (let k = 0; k < 8; k++) {
  const x = -990 + k * 48;
  for (const s of [-1, 1]) props.push({ type: 'buoy', position: [x, 400 + s * (230 - (k % 2) * 12)], y: 0, yaw: 0, size: [0.8, 1.6, 0.8], color: s < 0 ? '#d9453b' : '#3f9f4a' });
}
for (const wp of THUNDER.whirlpools ?? [])
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const r = wp.radius + 14;
    props.push({ type: 'buoy', position: [wp.center[0] + Math.cos(a) * r, wp.center[1] + Math.sin(a) * r], y: 0, yaw: 0, size: [0.9, 1.9, 0.9], color: '#f2c230' });
  }

let drowned = 0;
for (const p of props) if (p.y === undefined && p.type !== 'fence' && p.type !== 'boardwalk' && p.type !== 'rail' && p.type !== 'rope-bridge' && heightAt(p.position[0], p.position[1]) < 0.3) drowned++;
const propsFile: PropsFile = { version: 1, island: 'thunder', generatedBy: `gen-thunder seed=${SEED}`, props };
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
const EXT_RGB: Array<[number, number, number]> = [[238, 243, 248], [169, 211, 234], [95, 91, 112], [140, 122, 150]];
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
for (const zn of THUNDER.zones)
  for (let s = 0; s < zn.polygon.length; s++) {
    const [ax, az] = zn.polygon[s]!;
    const [bx, bz] = zn.polygon[(s + 1) % zn.polygon.length]!;
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 1.5) plot(ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len, zn.kind === 'town' ? [255, 240, 120] : zn.kind === 'sea' ? [160, 220, 255] : [255, 255, 255]);
  }
for (const p of props) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) plot(p.position[0] + dx * PX, p.position[1] + dz * PX, [200, 60, 50]);
for (const p of THUNDER.pois) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) plot(p.position[0] + dx * PX, p.position[2] + dz * PX, [40, 40, 220]);
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
for (const p of THUNDER.pois) {
  const h = heightAt(p.position[0], p.position[2]);
  const gi = clamp(Math.round((p.position[0] + HALF) / CELL), 0, N - 1);
  const gj = clamp(Math.round((p.position[2] + HALF) / CELL), 0, N - 1);
  if (p.kind !== 'dock' && h < 0.3) poiReport.push(`${p.id} 在水里（${h.toFixed(1)} m）`);
  if (LAVA_MASK[gj * N + gi]! > 0.3) poiReport.push(`${p.id} 在熔岩里`);
}
const meta = {
  seed: SEED,
  generatedAt: new Date().toISOString(),
  heightmap: { size: N, cell: CELL, range: THUNDER.heightRange, min: hmin, max: hmax, clipped },
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

/**
 * M2-02 · 碧潮群岛地形生成器（输出格式与 gen-sprout 相同，另加第三张扩展 splat）。
 *   pnpm gen:tide              生成到 assets/islands/tide/
 *   pnpm gen:tide --seed 7     换种子（只改变起伏细节，海岸线 / 河道 / 火山等手工布局不变）
 *
 * 输入：src/config/islands/tide.ts（区域、道路、水体、河流、熔岩流、POI、阻挡）
 * 输出：height.png（1025² 16 位，2 m 格）/ splat0/1.png（8 通道）/ splat2.png（扩展：赭石 / 火山灰 / 熔岩 / 苔藓）
 *       props.json / preview.png / meta.json
 *
 * 地貌（设计 §3.3「深绿 / 赭石 / 熔岩橙」）：
 *   - 西段 x < -612 为萌芽—碧潮海域：走廊内 3 座珊瑚礁小岛、浅滩、沉船。
 *   - 主岛一条连续海岸线（COAST）+ 噪声湾岬；东北余烬屿、南面温泉屿两座离岛。
 *   - 西：碧潮镇（6 m）与碧潮古森（12–30 m，古池 13 m）；根须溪从古池流经镇北入海。
 *   - 中：矿石峡谷（谷底 14–24 m，两侧 50 m 赭石崖壁）+ 矿石镇（16 m）；北面中央高原台地（48–53 m），异变遗迹在台地北缘。
 *   - 东：活火山（火山锥 150 m，火山口直径约 140 m，口底熔岩湖），两条熔岩流向东 / 北入海；火山镇（24 m）在南麓。
 *   - 东南：温泉溪谷（谷地随温泉溪逐级下降）与温泉乡（9 m，两座温泉池）。
 *   - 道路 / 城镇压平，道路纵坡 ≤ 17°。
 */
import { encode } from 'fast-png';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIDE } from '../src/config/islands/tide';
import { TIDE_TOWNS } from '../src/config/islands/towns/tide';
import { SURFACE_CHANNELS, type PropInstance, type PropsFile, type Vec2 } from '../src/config/islands/types';
import { applyWaterfalls } from './lib/falls';
import { clamp, distPolyline, lerp, makeNoise, nearestOnPolyline, sdPolygon, smoothstep } from './lib/noise';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', TIDE.heightmap.replace(/\/[^/]+$/, ''));
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 20261004;

const N = 1025;
const SIZE = TIDE.size[0];
const HALF = SIZE / 2;
const CELL = SIZE / (N - 1);
const [H_MIN, H_MAX] = TIDE.heightRange;
const SPLAT = 2048;
const { fbm, ridged, noise, rnd } = makeNoise(SEED);
const T0 = Date.now();
const log = (s: string) => console.info(`[tide ${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`);

const zone = (id: string) => {
  const z = TIDE.zones.find((q) => q.id === id);
  if (!z) throw new Error(`缺少区域 ${id}`);
  return z;
};
const LAND_ZONES = TIDE.zones.filter((z) => z.kind !== 'sea');
/** 区域包围盒（landSdf 远处跳过 sdPolygon） */
const ZBOX = LAND_ZONES.map((z) => {
  const xs = z.polygon.map((p) => p[0]);
  const zs = z.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
});
const RIVERS = TIDE.rivers ?? [];
const LAVA = TIDE.lavaFlows ?? [];
const WATER = TIDE.waterBodies;
/** 盛行风浪来向（西南，+Z 为南）：西南岸迎浪多礁石，东北背风湾多沙滩 */
const WAVE_FROM: Vec2 = [-0.7, 0.71];
/** 走廊东口：x 大于此值才可能是主岛陆地 */
const CORRIDOR_X = -612;

/** 火山：火山口中心、火山口半径、锥体半径、峰高、口底高度 */
const VOLCANO = { x: 640, z: -320, rim: 70, r: 520, peak: 150, floor: 106, lakeR: 32 };

/**
 * 主岛海岸线（+Z 为南）：西岸碧潮镇码头、西南碧潮海岸弧形沙滩、南岸赭石丘陵的岬角、
 * 东南温泉乡海湾（码头向南）、东岸温泉溪谷与火山东麓（熔岩流入海处的黑沙岸）、北岸火山北麓与中央高原的海崖、西北古森礁岸。
 */
const COAST: Vec2[] = [
  [-614, -90], [-612, -20], [-610, 40], [-612, 100], [-614, 150], [-590, 252], [-548, 320], [-492, 388], [-420, 452], [-340, 532], [-268, 568], [-200, 594],
  [-120, 626], [-60, 654], [20, 676], [140, 694], [228, 668], [300, 636], [362, 664], [420, 690], [500, 680], [560, 664], [596, 620], [612, 568],
  [700, 524], [800, 482], [868, 380], [894, 262], [920, 150], [946, 40], [950, -80], [956, -200], [952, -320], [912, -440], [852, -556], [760, -630],
  [640, -676], [520, -664], [420, -654], [330, -612], [250, -578], [160, -650], [60, -714], [-60, -708], [-160, -694], [-230, -656], [-320, -628],
  [-406, -604], [-480, -530], [-542, -450], [-584, -360], [-610, -262], [-616, -170],
];
/** 离岛与珊瑚礁：中心、半径、最高点 */
const ISLETS: Array<{ id: string; x: number; z: number; r: number; top: number; coral?: boolean }> = [
  { id: 'ember-isle', x: 900, z: -660, r: 42, top: 22 },
  { id: 'spring-isle', x: 300, z: 760, r: 30, top: 12 },
  { id: 'coral-north', x: -760, z: -130, r: 15, top: 3.5, coral: true },
  { id: 'coral-south', x: -880, z: 140, r: 12, top: 3, coral: true },
  { id: 'coral-east', x: -700, z: 176, r: 10, top: 2.6, coral: true },
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
/** 熔岩流：最近距离与宽度 */
function lavaProject(x: number, z: number): { d: number; width: number; t: number } | null {
  let best: { d: number; width: number; t: number } | null = null;
  for (const f of LAVA) {
    const total = f.points.length - 1;
    for (let s = 0; s < total; s++) {
      const [ax, az] = f.points[s]!;
      const [bx, bz] = f.points[s + 1]!;
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
      if (!best || d < best.d) best = { d, width: f.width, t: (s + t) / total };
    }
  }
  return best;
}

/** 火山锥：外坡 (1 - d/r)^1.6，火山口内向口底下凹 */
function volcanoHeight(x: number, z: number): number {
  const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  const outer = VOLCANO.peak * Math.pow(Math.max(0, 1 - d / VOLCANO.r), 1.6);
  if (d >= VOLCANO.rim) return outer;
  const rimH = VOLCANO.peak * Math.pow(1 - VOLCANO.rim / VOLCANO.r, 1.6);
  const u = d / VOLCANO.rim;
  return lerp(VOLCANO.floor, rimH + 4, Math.pow(u, 2.4));
}

/** 矿石峡谷：谷底（北高南低）+ 两侧赭石崖壁（区域边缘 50 m 内抬升） */
const CANYON = zone('ore-canyon');
const CANYON_AXIS: Vec2[] = [[104, -112], [112, -60], [96, -10], [118, 40], [92, 90], [100, 150], [92, 220]];
function canyonHeight(x: number, z: number): number {
  // 沿蜿蜒谷轴：谷底半宽 30–48 m（噪声扭曲边界），两侧 45 m 内抬升成分层赭石崖
  const wx2 = x + fbm(x / 70 + 4, z / 70) * 18;
  const wz2 = z + fbm(x / 70, z / 70 + 9) * 18;
  const d = distPolyline(wx2, wz2, CANYON_AXIS);
  const half = 38 + 10 * fbm(x / 90 + 2, z / 90 + 5);
  const floor = 14 + smoothstep(150, -110, z) * 10 + 0.6 * fbm(x / 30, z / 30);
  const wall = smoothstep(half, half + 45, d) * (34 + 12 * ridged(x / 60 + 3, z / 60));
  const terr = Math.floor(wall / 6) * 6 + smoothstep(0.55, 1, (wall / 6) % 1) * 6;
  return floor + lerp(wall, terr, 0.35);
}

/** 温泉溪谷：地面随温泉溪逐级下降，离溪越远越高 */
function springValleyHeight(x: number, z: number): number {
  const r = riverProject(x, z, 'spring-creek');
  const base = r ? r.level + 2 + 9 * smoothstep(8, 150, r.d) : 14;
  return base + 3 * fbm(x / 60 + 8, z / 60) + volcanoHeight(x, z) * 0.25;
}

/** 每个区域的地貌函数 */
const REGION: Record<string, (x: number, z: number) => number> = {
  'tide-town': (x, z) => 6 + 0.5 * fbm(x / 50, z / 50),
  'ore-town': (x, z) => 16 + 0.4 * fbm(x / 40, z / 40),
  'flame-town': (x, z) => 24 + 0.5 * fbm(x / 40, z / 40),
  'spring-village': (x, z) => 9 + 0.4 * fbm(x / 40, z / 40),
  'crater-rim': (x, z) => volcanoHeight(x, z) + 3 * ridged(x / 40, z / 40),
  'ruins-plaza': (x, z) => 52 + smoothstep(-440, -476, z) * 16 + 0.3 * fbm(x / 20, z / 20),
  'azure-forest': (x, z) => 12 + 9 * fbm(x / 80 + 5, z / 80 + 9) + smoothstep(-200, -520, z) * 8,
  'root-trail': (x, z) => 10 + 5 * fbm(x / 90 + 2, z / 90),
  'tide-coast': (x, z) => 5 + 4 * fbm(x / 80 + 6, z / 80 + 2),
  'ancient-plateau': (x, z) => 48 + 4 * fbm(x / 70 + 1, z / 70 + 4) + 2 * ridged(x / 30, z / 30),
  'ore-canyon': canyonHeight,
  'ember-trail': (x, z) => lerp(20 + 6 * fbm(x / 60, z / 60 + 3), volcanoHeight(x, z), 0.35),
  'volcano-slope': (x, z) => volcanoHeight(x, z) + 5 * ridged(x / 70 + 9, z / 70) + 2 * fbm(x / 20, z / 20),
  'spring-valley': springValleyHeight,
  'ochre-hills': (x, z) => 12 + 16 * ridged(x / 110 + 4, z / 110 + 1) + 3 * fbm(x / 30, z / 30),
};
/** 各区域的影响范围（米）：城镇过渡短，台地 / 峡谷崖壁较陡 */
const FALLOFF: Record<string, number> = { 'ancient-plateau': 38, 'ore-canyon': 30, 'volcano-slope': 80, 'crater-rim': 30 };

/** 区域之外的底色：低山 */
function highlands(x: number, z: number): number {
  return 22 + 18 * ridged(x / 160, z / 160) + volcanoHeight(x, z) * 0.6;
}

function landSdf(x: number, z: number): number {
  let d = Infinity;
  for (let k = 0; k < LAND_ZONES.length; k++) {
    const b = ZBOX[k]!;
    const bx = Math.max(b.minX - x, 0, x - b.maxX);
    const bz = Math.max(b.minZ - z, 0, z - b.maxZ);
    if (Math.hypot(bx, bz) - 4 > d) continue;
    d = Math.min(d, sdPolygon(x, z, LAND_ZONES[k]!.polygon) - 4);
  }
  const wobble = fbm(x / 70 + 20, z / 70) * 10 + fbm(x / 22, z / 22 + 9) * 3;
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
    if (k > best.k) best = { k, h: 1 + (it.top - 1) * smoothstep(it.r, 0, r) + fbm(x / 9, z / 9) * (it.coral ? 0.4 : 1.2) };
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
    // 珊瑚礁周围是 1–4 m 的浅滩；走廊中部 12–20 m
    let depth = Math.min(20, 1.2 + -t * 0.09 + Math.max(0, -t - 40) * 0.08);
    for (const it of ISLETS) if (it.coral) depth = Math.min(depth, 1 + Math.max(0, Math.hypot(x - it.x, z - it.z) - it.r) * 0.06);
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
    if (zn.id === 'ancient-plateau' || zn.id === 'volcano-slope') cliff = Math.max(cliff, w);
    if (zn.id === 'azure-forest') forest = Math.max(forest, w);
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
const landRoads = TIDE.roads.filter((r) => r.surface !== 'boardwalk');
for (const zn of TIDE.zones.filter((q) => q.kind === 'town')) {
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
const FALL_BODIES = new Set((TIDE.waterfalls ?? []).flatMap((f) => [`${f.id}-pool`, `${f.id}-plunge`]));
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

// 3c. 熔岩流：沿流向的平滑剖面上刻出 1.2 m 深的熔岩河道，两侧 4 m 的冷却熔岩堤
const LAVA_MASK = new Float32Array(N * N); // 0–1 熔岩
for (const f of LAVA) {
  const xs = f.points.map((p) => p[0]);
  const zs = f.points.map((p) => p[1]);
  const pad = f.width / 2 + 10;
  const sm = blur(H, 6);
  eachCell(Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad, (k, x, z) => {
    const lp = lavaProject(x, z);
    if (!lp || lp.d > lp.width / 2 + 10) return;
    const hw = lp.width / 2;
    const base = sm[k]!;
    if (lp.d < hw) {
      H[k] = Math.max(0.2, base - 1.2 * (1 - (lp.d / hw) ** 2));
      LAVA_MASK[k] = Math.max(LAVA_MASK[k]!, smoothstep(hw, hw - 1.5, lp.d));
    } else if (lp.d < hw + 4) H[k] = Math.max(H[k]!, base + 0.8 * Math.sin(((lp.d - hw) / 4) * Math.PI));
    else H[k] = lerp(base + 0.2, H[k]!, smoothstep(hw + 4, hw + 10, lp.d));
  });
}
// 火山口熔岩湖
eachCell(VOLCANO.x - VOLCANO.lakeR - 4, VOLCANO.x + VOLCANO.lakeR + 4, VOLCANO.z - VOLCANO.lakeR - 4, VOLCANO.z + VOLCANO.lakeR + 4, (k, x, z) => {
  const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z) + fbm(x / 10, z / 10) * 3;
  if (d < VOLCANO.lakeR) {
    H[k] = Math.min(H[k]!, VOLCANO.floor - 1);
    LAVA_MASK[k] = Math.max(LAVA_MASK[k]!, smoothstep(VOLCANO.lakeR, VOLCANO.lakeR - 2, d));
  }
});
log('水系 / 熔岩完成');

// 4. 洞口崖壁：洞穴 POI 背后 3–30 m 抬起一面陡崖（洞口贴在崖脚）
for (const p of TIDE.pois.filter((q) => q.kind === 'cave')) {
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
  [TIDE.spawnPoint[0], TIDE.spawnPoint[2], 16],
  ...TIDE.pois.filter((p) => p.kind !== 'quest' && p.kind !== 'cave' && p.kind !== 'gym').map((p) => [p.position[0], p.position[2], 10] as [number, number, number]),
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
const PAD_TYPES = new Set<string>(['house', 'pokecenter', 'mart', 'warehouse', 'statue', 'well']);
interface Pad { x: number; z: number; hw: number; hd: number; yaw: number; y: number | null; blend: number }
const pads: Pad[] = [];
for (const t of TIDE_TOWNS) {
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
  const n = applyWaterfalls(H, N, CELL, HALF, TIDE.waterfalls ?? [], (x, z) => fbm(x, z));
  if (n) console.info(`[tide] 瀑布石台 ${(TIDE.waterfalls ?? []).length} 座（${n} 格）`);
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
const wildZones = TIDE.zones.filter((z) => z.kind === 'wild');
const towns = TIDE.zones.filter((z) => z.kind === 'town');
const forestZone = zone('azure-forest');
const rootZone = zone('root-trail');
const ochreZone = zone('ochre-hills');
const volcanoZones = [zone('volcano-slope'), zone('crater-rim'), zone('ember-trail')];
const plateauZone = zone('ancient-plateau');
const roadBoxes = TIDE.roads
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
const e = new Float32Array(4);
const zoneSd = (zn: { polygon: Vec2[] }, x: number, z: number, margin: number) => {
  // 包围盒外直接视为远离
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
    w[ch.flowers] = smoothstep(0.2, 0.32, fbm(x / 22 + 90, z / 22 + 13)) * (0.5 + wild * 0.5);
    let town = 0;
    for (const zn of towns) town = Math.max(town, smoothstep(12, -8, zoneSd(zn, x, z, 14)));
    // 碧潮古森：深绿密林 + 苔藓地面
    const inForest = smoothstep(20, -25, zoneSd(forestZone, x, z, 22));
    const inRoot = smoothstep(15, -20, zoneSd(rootZone, x, z, 16));
    const grove = smoothstep(0.22, 0.34, fbm(x / 45 + 7, z / 45 + 70)) * 0.9;
    w[ch.forest] = Math.max(inForest * (0.9 + 0.3 * fbm(x / 12, z / 12)), inRoot * grove * 1.1, grove * 0.5 * (1 - town)) * 1.4;
    e[3] = Math.max(inForest * smoothstep(-0.1, 0.25, fbm(x / 14 + 3, z / 14)) * 0.55, town * 0.25 * smoothstep(0.2, 0.4, fbm(x / 9, z / 9 + 5)) * (x < -300 ? 1 : 0));
    // 中央高原：短草 + 裸岩
    const inPlateau = smoothstep(10, -20, zoneSd(plateauZone, x, z, 12));
    if (inPlateau > 0) {
      w[ch.rock] = Math.max(w[ch.rock]!, inPlateau * smoothstep(0.05, 0.3, fbm(x / 16 + 2, z / 16)) * 1.5);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - inPlateau * 0.4);
    }
    // 矿石峡谷 / 赭石丘陵 / 矿石镇：赭石（谷底沙土、崖壁岩层）
    const inCanyon = smoothstep(10, -12, zoneSd(CANYON, x, z, 12));
    const inOchre = smoothstep(10, -15, zoneSd(ochreZone, x, z, 12));
    const ochre = Math.max(inCanyon, inOchre * smoothstep(-0.15, 0.2, fbm(x / 40 + 11, z / 40)), town * (x > -50 && x < 200 ? 0.7 : 0));
    if (ochre > 0) {
      e[0] = Math.max(e[0]!, ochre * (0.55 + 0.35 * smoothstep(14, 30, slope)));
      w[ch.dirt] = Math.max(w[ch.dirt]!, ochre * 1.4);
      w[ch.forest] = w[ch.forest]! * (1 - ochre * 0.85);
      w[ch.flowers] = w[ch.flowers]! * (1 - ochre);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - inCanyon * 0.5);
    }
    // 火山：海拔越高越多火山灰与裸岩，熔岩两侧是黑色冷却熔岩
    let inVolcano = 0;
    for (const zn of volcanoZones) inVolcano = Math.max(inVolcano, smoothstep(15, -20, zoneSd(zn, x, z, 16)));
    const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    const ash = Math.max(inVolcano * smoothstep(30, 70, h), smoothstep(VOLCANO.r * 0.55, VOLCANO.r * 0.25, dv), town * (x > 430 && z < 170 ? 0.45 : 0));
    if (ash > 0) {
      e[1] = Math.max(e[1]!, ash * (0.6 + 0.3 * fbm(x / 20 + 1, z / 20)));
      w[ch.rock] = Math.max(w[ch.rock]!, ash * 1.8);
      w[ch.grass] = w[ch.grass]! * (1 - ash * 0.8);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - ash * 0.9);
      w[ch.forest] = w[ch.forest]! * (1 - ash);
      w[ch.flowers] = w[ch.flowers]! * (1 - ash);
    }
    // 城镇：草坪 + 石板
    if (town > 0) {
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - town);
      w[ch.forest] = w[ch.forest]! * (1 - town * 0.8);
    }
    // 道路
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
      e[3] = e[3]! * (1 - k);
      e[1] = e[1]! * (1 - k * 0.5);
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
    // 熔岩入海处：黑沙
    const blackSand = ash > 0.3 ? 1 : 0;
    // 水体池岸
    let poolBeach = 0;
    for (const wb of WATER) poolBeach = Math.max(poolBeach, smoothstep(1.35, 1.05, waterShape(wb, x, z)) * smoothstep(wb.level + 1.4, wb.level + 0.5, h));
    const sand = Math.max(beach, poolBeach * 0.8);
    if (sand > 0) {
      w[ch.sand] = Math.max(w[ch.sand]!, sand * 4);
      if (blackSand) e[1] = Math.max(e[1]!, sand * 0.85);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - sand * 0.6);
      w[ch.forest] = w[ch.forest]! * (1 - sand);
      w[ch.flowers] = w[ch.flowers]! * (1 - sand);
      e[3] = e[3]! * (1 - sand);
    }
    const rv = riverProject(x, z);
    if (rv && rv.d < rv.width / 2 + 4) {
      const kb = smoothstep(rv.width / 2 + 4, rv.width / 2 + 1, rv.d);
      w[ch.sand] = Math.max(w[ch.sand]!, kb * 3);
      w[ch.rock] = Math.max(w[ch.rock]!, kb * smoothstep(0.1, 0.3, fbm(x / 6, z / 6)) * 2);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - kb);
      w[ch.forest] = w[ch.forest]! * (1 - kb);
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
    // 陡坡 = 岩石
    const rock = smoothstep(30, 42, slope) + smoothstep(90, 130, h) * 0.6;
    if (rock > 0) {
      const keep = 1 - Math.min(1, rock);
      w[ch.sand] = w[ch.sand]! * keep;
      w[ch.grass] = w[ch.grass]! * keep;
      w[ch.dirt] = w[ch.dirt]! * keep;
      w[ch.rock] = Math.max(w[ch.rock]!, rock * 5);
      w[ch.tallgrass] = w[ch.tallgrass]! * keep;
      w[ch.flowers] = w[ch.flowers]! * keep;
      e[3] = e[3]! * keep;
    }
    // 熔岩（覆盖一切）
    const lava = LAVA_MASK[gk]!;
    if (lava > 0) {
      e[2] = lava;
      e[1] = Math.max(e[1]! * (1 - lava), 1 - lava);
      w[ch.rock] = Math.max(w[ch.rock]!, 4);
      w[ch.tallgrass] = 0;
      w[ch.forest] = 0;
      w[ch.flowers] = 0;
    } else {
      // 熔岩堤（冷却的黑色熔岩）
      const lp = lavaProject(x, z);
      if (lp && lp.d < lp.width / 2 + 12) {
        const k = smoothstep(lp.width / 2 + 12, lp.width / 2 + 1, lp.d);
        e[1] = Math.max(e[1]!, k);
        w[ch.rock] = Math.max(w[ch.rock]!, k * 3);
        w[ch.tallgrass] = w[ch.tallgrass]! * (1 - k);
        w[ch.forest] = w[ch.forest]! * (1 - k);
      }
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
    // 扩展层：总和 ≤ 1（覆盖比例）
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
const EXT = ['ochre', 'ash', 'lava', 'moss'];
log(`splat  ${SURFACE_CHANNELS.map((c, i) => `${c} ${((stats[i]! / (SPLAT * SPLAT)) * 100).toFixed(1)}%`).join(' · ')}`);
log(`splat2 ${EXT.map((c, i) => `${c} ${((extStats[i]! / (SPLAT * SPLAT)) * 100).toFixed(2)}%`).join(' · ')}`);

// ———————————— 8. 摆放物 ————————————
const props: PropInstance[] = [];
const allRoads = TIDE.roads.filter((r) => r.surface !== 'boardwalk');
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
for (const t of TIDE_TOWNS) props.push(...t.props);
const townRefs = new Set(props.map((q) => q.ref).filter((r): r is string => !!r));

// POI 自动构件：洞口 / 地标告示
for (const p of TIDE.pois) {
  if (townRefs.has(p.id)) continue;
  const door: Vec2 = [p.position[0], p.position[2]];
  if (p.kind === 'cave') {
    const yaw = p.doorYaw ?? 0;
    const y0 = bilinear(door[0], door[1]);
    let d = 0.5;
    while (d < 14 && bilinear(door[0] - Math.sin(yaw) * d, door[1] - Math.cos(yaw) * d) < y0 + 3) d += 0.5;
    props.push({ type: 'cave-mouth', ref: p.id, position: [door[0] - Math.sin(yaw) * (d - 0.5), door[1] - Math.cos(yaw) * (d - 0.5)], yaw, size: p.id === 'ruins-gate' ? [6, 6.5, 5] : [4.2, 4.6, 4] });
  } else if (p.kind === 'landmark' && p.id !== 'coral-wreck' && p.id !== 'hot-spring') {
    props.push({ type: 'sign', ref: p.id, position: door, yaw: faceRoad(door[0], door[1]), size: [1.6, 1.6, 0.2] });
  }
}

// 木桥
for (const bridge of TIDE.roads.filter((r) => r.surface === 'boardwalk')) {
  const a = bridge.points[0]!;
  const b = bridge.points[bridge.points.length - 1]!;
  const mid = riverProject((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const y = Math.max((mid?.level ?? 0) + 1.3, heightAt(a[0], a[1]), heightAt(b[0], b[1]));
  props.push({ type: 'boardwalk', id: bridge.id, position: [0, 0], y, yaw: 0, size: [bridge.width, 0.35, 0], points: bridge.points });
}

// 阻挡物：碎岩 / 藤蔓 / 巨石（ref = 阻挡 id，清除后整体隐藏）
for (const b of TIDE.blockers) {
  const pos: Vec2 = [b.position[0], b.position[2]];
  const r = b.radius ?? 2;
  if (b.type === 'rock-smash') props.push({ type: 'breakable-rock', ref: b.id, position: pos, yaw: 0, size: [r * 2, 2.4, r * 2] });
  else if (b.type === 'vines') props.push({ type: 'vine-wall', ref: b.id, position: pos, yaw: roadDir(pos[0], pos[1]), size: [r * 2 + 1, 4.2, 1.2], seed: Math.round(pos[0] - pos[1]) });
  else if (b.type === 'strength') props.push({ type: 'boulder', ref: b.id, position: pos, yaw: 0, size: [r * 2, r * 2, r * 2], seed: Math.round(pos[0] + pos[1]) });
}

// 异变遗迹入口广场：残柱环 + 拱门 + 石碑（台地北缘）
{
  const gate = TIDE.pois.find((p) => p.id === 'ruins-gate')!;
  const [gx, , gz] = gate.position;
  for (let k = 0; k < 10; k++) {
    const a = Math.PI * (0.15 + (k / 9) * 0.7) + Math.PI;
    const rr = 26 + (k % 2) * 3;
    const px = gx + Math.cos(a) * rr;
    const pz = gz + 30 + Math.sin(a) * rr * -1;
    props.push({ type: 'ruin-pillar', position: [px, pz], yaw: k * 0.7, size: [1.4, 5 + (k % 3) * 1.6, 1.4], seed: 3100 + k, ...(k % 3 === 0 ? { variant: 'anomaly' } : {}) });
  }
  props.push({ type: 'ruin-arch', position: [gx, gz + 22], yaw: 0, size: [8, 7, 1.6] });
  props.push({ type: 'stele', ref: 'ruins-stele', position: [gx + 12, gz + 14], yaw: -0.4, size: [1.6, 3.2, 0.8] });
  props.push({ type: 'stele', position: [gx - 13, gz + 16], yaw: 0.5, size: [1.6, 2.6, 0.8] });
}
// 中央高原：散落的残柱与古碑（古代文明的痕迹）
for (const [x, z, h, s] of [[-60, -540, 4, 1], [-80, -590, 6, 2], [-20, -600, 3, 3], [120, -480, 5, 4], [160, -420, 3.5, 5], [-110, -330, 4.5, 6]] as Array<[number, number, number, number]>)
  props.push({ type: 'ruin-pillar', position: [x, z], yaw: s, size: [1.4, h, 1.4], seed: 3200 + s });
props.push({ type: 'stele', ref: 'plateau-stele', position: [-40, -560], yaw: 0.3, size: [1.6, 3, 0.8] });
// 古森神龛（藤蔓后）
{
  const sh = TIDE.pois.find((p) => p.id === 'forest-shrine');
  if (sh) {
    props.push({ type: 'stele', ref: 'forest-shrine-stele', position: [sh.position[0], sh.position[2]], yaw: faceRoad(sh.position[0], sh.position[2]), size: [1.8, 3.4, 0.9] });
    props.push({ type: 'stone-lantern', position: [sh.position[0] - 3, sh.position[2] + 2], yaw: 0, size: [0.8, 1.7, 0.8] });
    props.push({ type: 'stone-lantern', position: [sh.position[0] + 3, sh.position[2] + 2], yaw: 0, size: [0.8, 1.7, 0.8] });
  }
}
// 古森：几棵巨树地标
for (const [x, z, h, s] of [[-300, -520, 34, 1], [-460, -330, 30, 2], [-250, -240, 28, 3], [-220, -470, 32, 4]] as Array<[number, number, number, number]>)
  props.push({ type: 'giant-tree', position: [x, z], yaw: s, size: [1, h, 1], seed: 3300 + s });
// 矿石峡谷：矿石堆 / 矿车残骸
for (const [x, z, s] of [[60, -40, 1], [140, 40, 2], [40, 60, 3], [160, -110, 4], [70, 100, 5]] as Array<[number, number, number]>)
  props.push({ type: 'ore-pile', position: [x, z], yaw: s, size: [2.6, 1.6, 2.6], seed: 3400 + s });
// 火山：玄武岩柱群 / 喷气口
for (const [x, z, h, s] of [[520, -200, 8, 1], [760, -180, 10, 2], [820, -40, 7, 3], [450, -340, 9, 4], [700, -470, 8, 5], [560, -500, 6, 6]] as Array<[number, number, number, number]>)
  props.push({ type: 'basalt', position: [x, z], yaw: s, size: [5, h, 5], seed: 3500 + s });
for (const [x, z, s] of [[540, -150, 1], [740, -240, 2], [700, -60, 3], [610, -420, 4]] as Array<[number, number, number]>)
  props.push({ type: 'lava-vent', position: [x, z], yaw: 0, size: [3.4, 1, 3.4], seed: 3600 + s });
// 海域：珊瑚丛（浅滩）、沉船、航标浮标
for (const it of ISLETS.filter((q) => q.coral))
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + it.x;
    const rr = it.r + 6 + (k % 3) * 5;
    const cx = it.x + Math.cos(a) * rr;
    const cz = it.z + Math.sin(a) * rr;
    props.push({ type: 'coral', position: [cx, cz], y: heightAt(cx, cz), yaw: k, size: [2 + (k % 3), 1.5, 2], seed: 3700 + k + Math.round(it.x) });
  }
{
  const wreck = TIDE.pois.find((p) => p.id === 'coral-wreck')!;
  props.push({ type: 'shipwreck', ref: 'coral-wreck', position: [wreck.position[0], wreck.position[2]], y: heightAt(wreck.position[0], wreck.position[2]), yaw: 0.6, size: [7, 3, 22] });
}
for (let k = 0; k < 9; k++) {
  const x = -980 + k * 44;
  for (const s of [-1, 1]) props.push({ type: 'buoy', position: [x, s * (150 - (k % 2) * 10)], y: 0, yaw: 0, size: [0.8, 1.6, 0.8], color: s < 0 ? '#d9453b' : '#3f9f4a' });
}
// 碧潮海岸：渔网架 / 礁石
for (const [x, z, s] of [[-500, 300, 1], [-420, 400, 2], [-300, 500, 3]] as Array<[number, number, number]>) props.push({ type: 'rocks', position: [x, z], yaw: s, size: [4, 1.6, 4], seed: 3800 + s });

let drowned = 0;
for (const p of props) if (p.y === undefined && p.type !== 'fence' && p.type !== 'boardwalk' && p.type !== 'rail' && p.type !== 'rope-bridge' && heightAt(p.position[0], p.position[1]) < 0.3) drowned++;
const propsFile: PropsFile = { version: 1, island: 'tide', generatedBy: `gen-tide seed=${SEED}`, props };
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
const EXT_RGB: Array<[number, number, number]> = [[200, 135, 74], [74, 68, 64], [255, 106, 26], [63, 122, 58]];
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
    if (wl > -Infinity && splat2[k + 2]! < 100) {
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
for (const zn of TIDE.zones)
  for (let s = 0; s < zn.polygon.length; s++) {
    const [ax, az] = zn.polygon[s]!;
    const [bx, bz] = zn.polygon[(s + 1) % zn.polygon.length]!;
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 1.5) plot(ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len, zn.kind === 'town' ? [255, 240, 120] : zn.kind === 'sea' ? [160, 220, 255] : [255, 255, 255]);
  }
for (const p of props) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) plot(p.position[0] + dx * PX, p.position[1] + dz * PX, [200, 60, 50]);
for (const p of TIDE.pois) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) plot(p.position[0] + dx * PX, p.position[2] + dz * PX, [40, 40, 220]);
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
for (const p of TIDE.pois) {
  const h = heightAt(p.position[0], p.position[2]);
  const gi = clamp(Math.round((p.position[0] + HALF) / CELL), 0, N - 1);
  const gj = clamp(Math.round((p.position[2] + HALF) / CELL), 0, N - 1);
  if (p.kind !== 'dock' && h < 0.3) poiReport.push(`${p.id} 在水里（${h.toFixed(1)} m）`);
  if (LAVA_MASK[gj * N + gi]! > 0.3) poiReport.push(`${p.id} 在熔岩里`);
}
const meta = {
  seed: SEED,
  generatedAt: new Date().toISOString(),
  heightmap: { size: N, cell: CELL, range: TIDE.heightRange, min: hmin, max: hmax, clipped },
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

/**
 * M4-01 · 秘境岛地形生成器（输出格式与 gen-secret 相同：height / splat0-2 / props / preview / meta）。
 *   pnpm gen:secret              生成到 assets/islands/secret/
 *   pnpm gen:secret --seed 7     换种子（只改变起伏细节，海岸线 / 峡谷 / 方山等手工布局不变）
 *
 * 输入：src/config/islands/secret.ts（区域、道路、水体、河流、POI）
 * splat2 扩展层（SECRET.ext）：积雪 / 荒原赭土 / 暗紫苔 / 冰面。
 *
 * 地貌（设计 §3.2 岛5「龙之峡谷、月魇荒原、永冻冰窟、神兽祭坛」，主色板暗金 / 深紫）：
 *   - 主岛一条连续海岸线（COAST），南岸背风宽沙滩（码头平原），北岸 / 东北迎浪岩岸。
 *   - 中：龙之峡谷 —— 沿中线切出谷底（14 → 28 m），两侧岩原被 rimBoost 抬到 50–70 m，谷壁 18 m 内拔起；
 *     南端是寐龙镇盆地，北端收口接月魇荒原。
 *   - 北：月魇荒原 24–36 m 风化岩丘 + 月镜池；东北：永冻冰原 40–85 m 冰川山脊 + 冰湖。
 *   - 西：神兽祭坛台地 20 m + 平顶方山 38 m；东：龙脊岩原向东海岸缓降。
 *   - 道路 / 城镇压平，道路纵坡 ≤ 17°。
 */
import { encode } from 'fast-png';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET } from '../src/config/islands/secret';
import { SECRET_TOWNS } from '../src/config/islands/towns/secret';
import { SURFACE_CHANNELS, type PropInstance, type PropsFile, type TownLayout, type Vec2 } from '../src/config/islands/types';
import { clamp, distPolyline, lerp, makeNoise, nearestOnPolyline, sdPolygon, smoothstep } from './lib/noise';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', SECRET.heightmap.replace(/\/[^/]+$/, ''));
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 20261006;
/** 城镇手工布局在 M3-11 ~ M3-14 加入 */
const TOWNS: TownLayout[] = SECRET_TOWNS;

const N = 1025;
const SIZE = SECRET.size[0];
const HALF = SIZE / 2;
const CELL = SIZE / (N - 1);
const [H_MIN, H_MAX] = SECRET.heightRange;
const SPLAT = 2048;
const { fbm, ridged, noise, rnd } = makeNoise(SEED);
const T0 = Date.now();
const log = (s: string) => console.info(`[secret ${((Date.now() - T0) / 1000).toFixed(1)}s] ${s}`);

const zone = (id: string) => {
  const z = SECRET.zones.find((q) => q.id === id);
  if (!z) throw new Error(`缺少区域 ${id}`);
  return z;
};
const LAND_ZONES = SECRET.zones.filter((z) => z.kind !== 'sea');
/** 区域包围盒（landSdf 远处跳过 sdPolygon） */
const ZBOX = LAND_ZONES.map((z) => {
  const xs = z.polygon.map((p) => p[0]);
  const zs = z.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
});
const RIVERS = SECRET.rivers ?? [];
const WATER = SECRET.waterBodies;

/** 盛行风浪来向（西北）：北岸荒原 / 冰原是岩岸海崖，南岸码头平原背风，沙滩宽阔 */
const WAVE_FROM: Vec2 = [-0.6, -0.8];

/**
 * 主岛海岸线（+Z 为南）：南岸码头平原的宽弧形海湾、东岸龙脊岩原海崖与实验室岬角、
 * 东北冰原岩岸、北岸荒原海崖、西岸祭坛台地。
 */
const COAST: Vec2[] = [
  [-140, 520], [-40, 548], [40, 566], [110, 556], [190, 522], [270, 474], [340, 410], [400, 340], [450, 240], [485, 120], [500, 0],
  [495, -120], [470, -230], [420, -330], [330, -410], [220, -465], [90, -500], [-40, -505], [-160, -480], [-270, -430], [-360, -350],
  [-430, -250], [-480, -140], [-505, -20], [-500, 100], [-460, 210], [-395, 310], [-310, 400], [-225, 470],
];

function riverProject(x: number, z: number, only?: string): { d: number; level: number; width: number } | null {
  let best: { d: number; level: number; width: number } | null = null;
  for (const rv of RIVERS) {
    if (only && rv.id !== only) continue;
    const pts = rv.points;
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s]!;
      const [bx, bz] = pts[s + 1]!;
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
      if (!best || d < best.d) best = { d, level: lerp(rv.levels[s]!, rv.levels[s + 1]!, t), width: rv.width };
    }
  }
  return best;
}

/** 龙之峡谷中线（南 → 北）与半宽：寐龙镇盆地宽，峡谷段窄 */
const CANYON: Vec2[] = [[0, 330], [4, 240], [2, 170], [-10, 90], [-14, 30], [-6, -50], [-2, -130], [0, -200]];
function canyonHalfWidth(z: number): number {
  return lerp(52, 98, smoothstep(140, 200, z)) * (1 - 0.0) + 6 * fbm(z / 40, 3.1);
}
/** 谷底高度：南 14 m（寐龙镇）→ 北 28 m（接月魇荒原） */
function canyonFloor(x: number, z: number): number {
  return lerp(28, 14, smoothstep(-200, 170, z)) + 0.6 * fbm(x / 30, z / 30);
}
/** 峡谷两侧的岩壁顶：离谷越近越高；南北两端收口（南接平原，北接荒原） */
function rimBoost(x: number, z: number): number {
  const p = nearestOnPolyline(x, z, CANYON);
  const d = Math.max(0, p.d - canyonHalfWidth(z));
  const along = smoothstep(-210, -140, z) * smoothstep(330, 260, z);
  return 42 * smoothstep(150, 20, d) * along * (0.85 + 0.25 * ridged(x / 50 + 4, z / 50));
}
/** 神兽祭坛方山：平顶 38 m，四周 40 m 陡坡（坡道由道路纵坡处理） */
const ALTAR = { x: -330, z: 0, r: 72 };
function altarHeight(x: number, z: number): number {
  const a = Math.atan2(z - ALTAR.z, x - ALTAR.x);
  const r = Math.hypot(x - ALTAR.x, z - ALTAR.z) * (1 + 0.1 * fbm(Math.cos(a) * 1.5 + 2, Math.sin(a) * 1.5));
  const base = 18 + 4 * fbm(x / 110 + 4, z / 110) + rimBoost(x, z) - smoothstep(-300, -480, x) * 6;
  const mesa = 38 + 0.4 * fbm(x / 20, z / 20);
  const k = smoothstep(ALTAR.r + 45, ALTAR.r, r);
  return Math.max(base, lerp(base, mesa, k));
}
/** 月魇荒原：24–36 m 起伏，风化岩丘（脊状噪声） */
function wastesHeight(x: number, z: number): number {
  const knoll = Math.max(0, ridged(x / 40 + 7, z / 40 + 1) - 0.6) / 0.4;
  return 26 + 6 * fbm(x / 120 + 3, z / 120) + 7 * Math.pow(knoll, 1.5) * smoothstep(-0.1, 0.2, fbm(x / 90 + 30, z / 90)) + rimBoost(x, z) * 0.6;
}
/** 永冻冰原：西南 40 m → 东北 85 m 的冰川山脊 */
function frostHeight(x: number, z: number): number {
  const t = clamp(((x - 220) * 0.6 - (z + 150) * 0.8) / 260, 0, 1);
  return 38 + 45 * Math.pow(t, 1.2) + 10 * ridged(x / 70 + 2, z / 70 + 5) * t + 1.2 * fbm(x / 18, z / 18);
}
/** 龙脊岩原：峡谷边 60 m → 东海岸 18 m 的岩原，岩脊成列 */
function cragsHeight(x: number, z: number): number {
  return 18 + 6 * fbm(x / 90 + 6, z / 90) + 8 * ridged(x / 60 + 1, z / 60 + 9) + rimBoost(x, z) + smoothstep(-40, -180, z) * 10;
}

/** 每个区域的地貌函数 */
const REGION: Record<string, (x: number, z: number) => number> = {
  'dragon-town': (x, z) => 14 + 0.3 * fbm(x / 40, z / 40),
  'moon-town': (x, z) => 30 + 0.3 * fbm(x / 40, z / 40),
  'dragon-canyon': canyonFloor,
  'frost-ridge': frostHeight,
  'moon-wastes': wastesHeight,
  'altar-mesa': altarHeight,
  'dragon-crags': cragsHeight,
  'secret-shore': (x, z) => 4 + 3 * fbm(x / 90, z / 90 + 4) + smoothstep(460, 300, z) * 5 + 0.6 * fbm(x / 20, z / 20),
};
/** 各区域的影响范围（米）：城镇过渡短；峡谷由 carve 单独处理 */
const FALLOFF: Record<string, number> = { 'dragon-town': 30, 'moon-town': 30, 'dragon-canyon': 20, 'frost-ridge': 40 };
const CLIFF_ZONES = new Set<string>(['frost-ridge']);

/** 区域之外的底色：低丘 */
function highlands(x: number, z: number): number {
  return 14 + 8 * ridged(x / 160, z / 160) + rimBoost(x, z);
}

function landSdf(x: number, z: number): number {
  const wobble = fbm(x / 140 + 20, z / 140) * 18 + fbm(x / 60 + 3, z / 60) * 8 + fbm(x / 22, z / 22 + 9) * 3;
  let d = sdPolygon(x, z, COAST) + wobble;
  d = Math.max(d, Math.max(Math.abs(x), Math.abs(z)) - (HALF - 16));
  return d;
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
  // 南岸码头平原：沙滩更宽
  const southK = smoothstep(330, 470, cz) * smoothstep(380, 250, Math.abs(cx));
  const bw = lerp(8, 34, smoothstep(0.25, 0.8, shelter)) + 18 * clamp(southK, 0, 1);
  const rocky = smoothstep(0.42, 0.18, shelter) * (1 - clamp(southK, 0, 1) * 0.8);
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
    const depth = Math.min(26, 1.2 + -t * 0.09 + Math.max(0, -t - 40) * 0.08);
    return { h: -depth + fbm(x / 40, z / 40) * 0.6, sea: 1 };
  }
  let wsum = 0;
  let hsum = 0;
  let town = 0;
  let cliff = 0;
  let rockyZone = 0;
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
    if (CLIFF_ZONES.has(zn.id)) cliff = Math.max(cliff, w * 0.6);
    if (zn.id === 'dragon-crags' || zn.id === 'moon-wastes') rockyZone = Math.max(rockyZone, w * 0.6);
  }
  let inland = wsum > 1 ? hsum / wsum : hsum + (1 - wsum) * highlands(x, z);
  // 龙之峡谷：沿中线切出谷底，谷壁 18 m 内拔起（步行只能走谷底）
  {
    const p = nearestOnPolyline(x, z, CANYON);
    const hw = canyonHalfWidth(z);
    const k = smoothstep(hw + 18, hw, p.d + noise(x / 9, z / 9) * 2.5);
    if (k > 0) {
      const floor = z > 300 ? lerp(canyonFloor(x, z), inland, smoothstep(300, 340, z)) : canyonFloor(x, z);
      inland = lerp(inland, Math.min(inland, floor), k);
    }
  }
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
const landRoads = SECRET.roads.filter((r) => r.surface !== 'boardwalk');
for (const zn of SECRET.zones.filter((q) => q.kind === 'town')) {
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
for (const p of SECRET.pois.filter((q) => q.kind === 'cave')) {
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
  [SECRET.spawnPoint[0], SECRET.spawnPoint[2], 16],
  ...SECRET.pois.filter((p) => p.kind !== 'quest' && p.kind !== 'cave' && p.kind !== 'gym').map((p) => [p.position[0], p.position[2], 10] as [number, number, number]),
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
const wildZones = SECRET.zones.filter((z) => z.kind === 'wild');
const towns = SECRET.zones.filter((z) => z.kind === 'town');
const canyonZone = zone('dragon-canyon');
const cragsZone = zone('dragon-crags');
const wastesZone = zone('moon-wastes');
const moonTown = zone('moon-town');
const frostZone = zone('frost-ridge');
const altarZone = zone('altar-mesa');
const shoreZone = zone('secret-shore');
const roadBoxes = SECRET.roads
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
    // 龙之峡谷 / 龙脊岩原：赭红岩壁 + 砂砾谷底，零星耐旱灌丛
    const inCanyon = Math.max(smoothstep(10, -20, zoneSd(canyonZone, x, z, 12)), smoothstep(10, -20, zoneSd(cragsZone, x, z, 12)));
    if (inCanyon > 0) {
      w[ch.dirt] = Math.max(w[ch.dirt]!, inCanyon * smoothstep(-0.1, 0.25, fbm(x / 20 + 4, z / 20)) * 1.4);
      w[ch.rock] = Math.max(w[ch.rock]!, inCanyon * (smoothstep(18, 30, slope) * 2 + smoothstep(0.15, 0.4, fbm(x / 10, z / 10 + 3))));
      e[1] = Math.max(e[1]!, inCanyon * 0.35 * smoothstep(0, 0.3, fbm(x / 30 + 9, z / 30)));
      w[ch.forest] = w[ch.forest]! * (1 - inCanyon * 0.7);
      w[ch.flowers] = w[ch.flowers]! * (1 - inCanyon);
    }
    // 月魇荒原：赭土荒地 + 暗紫苔斑 + 枯草
    const inWaste = Math.max(smoothstep(15, -25, zoneSd(wastesZone, x, z, 16)), smoothstep(15, -25, zoneSd(moonTown, x, z, 16)) * 0.6);
    if (inWaste > 0) {
      e[1] = Math.max(e[1]!, inWaste * (0.5 + 0.4 * smoothstep(-0.2, 0.2, fbm(x / 26 + 2, z / 26))));
      e[2] = Math.max(e[2]!, inWaste * smoothstep(0.1, 0.35, fbm(x / 22 + 17, z / 22)) * 0.7);
      w[ch.forest] = w[ch.forest]! * (1 - inWaste * 0.9);
      w[ch.flowers] = w[ch.flowers]! * (1 - inWaste);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - inWaste * 0.4);
    }
    // 永冻冰原：积雪覆盖，高处冰面；冰湖周围冰面
    const inFrost = smoothstep(15, -30, zoneSd(frostZone, x, z, 16));
    if (inFrost > 0) {
      e[0] = Math.max(e[0]!, inFrost * smoothstep(34, 46, h));
      e[3] = Math.max(e[3]!, inFrost * smoothstep(62, 78, h) * smoothstep(-0.1, 0.2, fbm(x / 30 + 5, z / 30)));
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - inFrost);
      w[ch.forest] = w[ch.forest]! * (1 - inFrost * 0.7);
      w[ch.flowers] = w[ch.flowers]! * (1 - inFrost);
    }
    // 神兽祭坛台地：草甸 + 花，方山顶石板
    const inAltar = smoothstep(10, -20, zoneSd(altarZone, x, z, 12));
    if (inAltar > 0) {
      const top = smoothstep(ALTAR.r + 6, ALTAR.r - 10, Math.hypot(x - ALTAR.x, z - ALTAR.z));
      w[ch.flowers] = Math.max(w[ch.flowers]!, inAltar * smoothstep(0.1, 0.3, fbm(x / 20 + 60, z / 20)) * 0.6);
      w[ch.stone] = Math.max(w[ch.stone]!, top * smoothstep(0.05, 0.3, fbm(x / 12, z / 12 + 8)) * 1.5);
      w[ch.forest] = w[ch.forest]! * (1 - top);
    }
    // 码头平原：大片草甸 + 花
    const inShore = smoothstep(10, -20, zoneSd(shoreZone, x, z, 12));
    if (inShore > 0) w[ch.flowers] = Math.max(w[ch.flowers]!, inShore * smoothstep(0.2, 0.35, fbm(x / 24 + 30, z / 24)) * 0.7);
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
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - sand * 0.6);
      w[ch.forest] = w[ch.forest]! * (1 - sand);
      w[ch.flowers] = w[ch.flowers]! * (1 - sand);
      
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
const EXT = SECRET.ext!.names;
log(`splat  ${SURFACE_CHANNELS.map((c, i) => `${c} ${((stats[i]! / (SPLAT * SPLAT)) * 100).toFixed(1)}%`).join(' · ')}`);
log(`splat2 ${EXT.map((c, i) => `${c} ${((extStats[i]! / (SPLAT * SPLAT)) * 100).toFixed(2)}%`).join(' · ')}`);

// ———————————— 8. 摆放物 ————————————
const props: PropInstance[] = [];
const allRoads = SECRET.roads.filter((r) => r.surface !== 'boardwalk');
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
for (const p of SECRET.pois) {
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
for (const bridge of SECRET.roads.filter((r) => r.surface === 'boardwalk')) {
  const a = bridge.points[0]!;
  const b = bridge.points[bridge.points.length - 1]!;
  const mid = riverProject((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const y = Math.max((mid?.level ?? 0) + 1.3, heightAt(a[0], a[1]), heightAt(b[0], b[1]));
  props.push({ type: 'boardwalk', id: bridge.id, position: [0, 0], y, yaw: 0, size: [bridge.width, 0.35, 0], points: bridge.points });
}

// 阻挡物：碎岩 / 藤蔓 / 巨石（ref = 阻挡 id，清除后整体隐藏）
for (const b of SECRET.blockers) {
  const pos: Vec2 = [b.position[0], b.position[2]];
  const r = b.radius ?? 2;
  if (b.type === 'rock-smash') props.push({ type: 'breakable-rock', ref: b.id, position: pos, yaw: 0, size: [r * 2, 2.4, r * 2] });
  else if (b.type === 'vines') props.push({ type: 'vine-wall', ref: b.id, position: pos, yaw: roadDir(pos[0], pos[1]), size: [r * 2 + 1, 4.2, 1.2], seed: Math.round(pos[0] - pos[1]) });
  else if (b.type === 'strength') props.push({ type: 'boulder', ref: b.id, position: pos, yaw: 0, size: [r * 2, r * 2, r * 2], seed: Math.round(pos[0] + pos[1]) });
}

const r = makeNoise(SEED + 7).rnd;
// 龙之峡谷：谷底乱石与石柱，谷口一对龙首残柱
{
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 40; tries++) {
    const z = -180 + r() * 340;
    const p = nearestOnPolyline(0, z, CANYON);
    const x = p.x + (r() - 0.5) * 2 * (canyonHalfWidth(z) - 8);
    if (allRoads.some((q) => distPolyline(x, z, q.points) < q.width / 2 + 4)) continue;
    if (riverProject(x, z) && riverProject(x, z)!.d < 6) continue;
    if (slopeDeg(x, z) > 20) continue;
    props.push({ type: 'rocks', position: [x, z], yaw: r() * 6.28, size: [2 + r() * 3, 1.2 + r() * 2, 2 + r() * 3], seed: 7000 + placed });
    placed++;
  }
  for (const [x, z, s] of [[-30, 168, 0], [30, 168, 1], [-24, -186, 2], [26, -186, 3]] as Array<[number, number, number]>)
    props.push({ type: 'ruin-pillar', position: [x, z], yaw: s, size: [2, 6 + (s % 2), 2], seed: 7100 + s, variant: 'moss' });
}
// 月魇荒原：枯树、遗址残柱与断拱（遗址的白天面貌；M4-04 夜间小镇另行加入）
{
  const wz = zone('moon-wastes');
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 36; tries++) {
    const x = -340 + r() * 600;
    const z = -500 + r() * 320;
    if (sdPolygon(x, z, wz.polygon) > -8) continue;
    if (WATER.some((wb) => waterShape(wb, x, z) < 1.3)) continue;
    if (allRoads.some((q) => distPolyline(x, z, q.points) < q.width / 2 + 3)) continue;
    if (slopeDeg(x, z) > 20) continue;
    props.push({ type: 'dead-tree', position: [x, z], yaw: r() * 6.28, size: [3, 5 + r() * 4, 3], seed: 7200 + placed, variant: 'bleached' });
    placed++;
  }
  const m = SECRET.pois.find((p) => p.id === 'moon-ruins')!;
  const [mx, , mz] = m.position;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    if (k % 4 === 1) continue;
    props.push({ type: 'ruin-pillar', position: [mx + Math.cos(a) * 52, mz + Math.sin(a) * 40], yaw: k, size: [1.4, 2 + (k % 3) * 1.6, 1.4], seed: 7300 + k, variant: 'moss' });
  }
  props.push({ type: 'ruin-arch', position: [mx - 60, mz + 8], yaw: Math.PI / 2, size: [6, 6, 1.4], seed: 7320 });
  props.push({ type: 'ruin-arch', position: [mx + 70, mz + 6], yaw: Math.PI / 2, size: [6, 5, 1.4], seed: 7321 });
  for (let k = 0; k < 14; k++) {
    const a = r() * 6.28;
    const rr = 14 + r() * 40;
    props.push({ type: 'wisp', position: [mx + Math.cos(a) * rr, mz + Math.sin(a) * rr * 0.8], yaw: 0, size: [0.5, 1.6 + r() * 1.4, 0.5], seed: 7400 + k, color: r() > 0.5 ? '#f0d98a' : '#b99aff' });
  }
  const mm = SECRET.pois.find((p) => p.id === 'moon-mirror')!;
  props.push({ type: 'stele', ref: 'moon-mirror-stele', position: [mm.position[0], mm.position[2] + 4], yaw: 0, size: [1.4, 2.6, 0.7] });
}
// 永冻冰原：雪中冰晶（冰蓝色晶簇）与巨石
{
  const fz = zone('frost-ridge');
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 30; tries++) {
    const x = 220 + r() * 280;
    const z = -440 + r() * 320;
    if (sdPolygon(x, z, fz.polygon) > -8) continue;
    if (WATER.some((wb) => waterShape(wb, x, z) < 1.3)) continue;
    if (allRoads.some((q) => distPolyline(x, z, q.points) < q.width / 2 + 3)) continue;
    if (slopeDeg(x, z) > 24) continue;
    props.push({ type: 'glass-crystal', position: [x, z], yaw: r() * 6.28, size: [1.4 + r() * 1.6, 1.6 + r() * 2.6, 1.4 + r() * 1.6], seed: 7500 + placed, color: '#bfe8ff' });
    placed++;
  }
}
// 神兽祭坛：方山顶的石柱环 + 中央石碑（祭坛本体在 M4-09）
{
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    props.push({ type: 'ruin-pillar', position: [ALTAR.x + Math.cos(a) * 26, ALTAR.z + Math.sin(a) * 26], yaw: a, size: [1.6, 4.5, 1.6], seed: 7600 + k });
  }
  props.push({ type: 'stele', ref: 'beast-altar-stele', position: [ALTAR.x, ALTAR.z + 12], yaw: 0, size: [1.8, 3.2, 0.9] });
}
// 码头平原：沿路的石灯笼
for (const [x, z] of [[20, 380], [40, 430], [-80, 400], [-190, 372], [160, 440]] as Vec2[]) {
  const yaw = roadDir(x, z);
  props.push({ type: 'stone-lantern', position: [x + Math.cos(yaw) * 4.2, z - Math.sin(yaw) * 4.2], yaw, size: [0.9, 2, 0.9] });
}
let drowned = 0;
for (const p of props) if (p.y === undefined && p.type !== 'fence' && p.type !== 'boardwalk' && p.type !== 'rail' && p.type !== 'rope-bridge' && heightAt(p.position[0], p.position[1]) < 0.3) drowned++;
const propsFile: PropsFile = { version: 1, island: 'secret', generatedBy: `gen-secret seed=${SEED}`, props };
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
const EXT_RGB: Array<[number, number, number]> = [[238, 243, 247], [138, 116, 88], [90, 74, 110], [191, 226, 240]];
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
for (const zn of SECRET.zones)
  for (let s = 0; s < zn.polygon.length; s++) {
    const [ax, az] = zn.polygon[s]!;
    const [bx, bz] = zn.polygon[(s + 1) % zn.polygon.length]!;
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 1.5) plot(ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len, zn.kind === 'town' ? [255, 240, 120] : zn.kind === 'sea' ? [160, 220, 255] : [255, 255, 255]);
  }
for (const p of props) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) plot(p.position[0] + dx * PX, p.position[1] + dz * PX, [200, 60, 50]);
for (const p of SECRET.pois) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) plot(p.position[0] + dx * PX, p.position[2] + dz * PX, [40, 40, 220]);
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
for (const p of SECRET.pois) {
  const h = heightAt(p.position[0], p.position[2]);
  const gi = clamp(Math.round((p.position[0] + HALF) / CELL), 0, N - 1);
  const gj = clamp(Math.round((p.position[2] + HALF) / CELL), 0, N - 1);
  // 站在栈桥 / 石堤 / 海中石台上的地标不算落水
  const onDeck = TOWNS.some((t) =>
    t.props.some((q) => {
      if (q.type !== 'deck' && q.type !== 'temple-gate') return false;
      const c = Math.cos(q.yaw);
      const sn = Math.sin(q.yaw);
      const dx = p.position[0] - q.position[0];
      const dz = p.position[2] - q.position[1];
      const lx = dx * c - dz * sn;
      const lz = dx * sn + dz * c;
      const [w, , d] = q.size;
      return Math.abs(lx) <= w / 2 + 1 && Math.abs(lz) <= d / 2 + 1;
    }),
  );
  if (p.kind !== 'dock' && !onDeck && h < 0.3) poiReport.push(`${p.id} 在水里（${h.toFixed(1)} m）`);
  if (LAVA_MASK[gj * N + gi]! > 0.3) poiReport.push(`${p.id} 在熔岩里`);
}
const meta = {
  seed: SEED,
  generatedAt: new Date().toISOString(),
  heightmap: { size: N, cell: CELL, range: SECRET.heightRange, min: hmin, max: hmax, clipped },
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
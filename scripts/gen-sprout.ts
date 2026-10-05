/**
 * M1-01 · 萌芽群岛正式地形生成器（取代 WLD-005 灰盒版，输出格式不变）。
 *   pnpm gen:sprout              生成到 assets/islands/sprout/
 *   pnpm gen:sprout --seed 7     换种子（只改变起伏细节，海岸线 / 河道 / 海崖等手工布局不变）
 *
 * 输入：src/config/islands/sprout.ts（区域、道路、湖泊、河流、POI、阻挡）
 * 输出：height.png（513² 16 位）/ splat0/1.png（1024² RGBA）/ props.json / preview.png / meta.json
 *
 * 地貌（设计 §3.2「温带草原、海岸、浅海、雾林」）：
 *   - 手绘海岸线（COAST）+ 噪声：南岸萌芽镇海湾与码头；西岸萌芽草原 14–18 m 海崖，崖下海滩通往隐藏洞穴；
 *     东岸港湾市与强制为海的水路 1；东南岸收成海湾，翠澜河在此入海；北岸为雾林与海崖外侧的礁岸。
 *   - 外围 3 座小岛（萌芽礁 / 海鸥岛 / 东望屿），体现「群岛」。
 *   - 水系：北部山地的澜源溪 → 翠澜湖 → 翠澜河 → 东南入海；河床与河谷由本脚本刻出，道路过河处为木桥。
 *   - 区域高度：萌芽镇 4 m、草原 7–16 m（西高东低）、翠澜镇 8.5 m、湖面 5 m、河谷 4–9 m、港湾市 3 m、
 *     海崖 25–60 m、幻影之森 12–22 m；区域之间为山地（翠澜山最高约 68 m）。
 *   - 道路 / 城镇压平，保证坡度可走（< 25°）。
 */
import { encode } from 'fast-png';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPROUT } from '../src/config/islands/sprout';
import { SPROUT_TOWNS } from '../src/config/islands/towns';
import { SURFACE_CHANNELS, type PropInstance, type PropsFile, type Vec2 } from '../src/config/islands/types';
import { applyWaterfalls } from './lib/falls';
import { clamp, distPolyline, lerp, makeNoise, nearestOnPolyline, sdPolygon, smoothstep } from './lib/noise';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', SPROUT.heightmap.replace(/\/[^/]+$/, ''));
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 20260721;

const N = 513;
const HALF = SPROUT.size[0] / 2;
const CELL = SPROUT.size[0] / (N - 1);
const [H_MIN, H_MAX] = SPROUT.heightRange;
const SPLAT = 1024;
const { fbm, ridged, noise, rnd } = makeNoise(SEED);

const zone = (id: string) => {
  const z = SPROUT.zones.find((q) => q.id === id);
  if (!z) throw new Error(`缺少区域 ${id}`);
  return z;
};
/**
 * 地貌参与者：只有在 REGION 里有地貌函数的区域会并入陆地 / 影响高度。
 * 2026-10 生态扩充的「林缘小径 / 澜源高地」只是遇敌区域（叠在现有地形上），不改地形；
 * 「西岸沙滩 / 翠澜河口」是新造的低平海岸地（BEACH_REGION），在原海岸外侧加宽，原陆地高度不受影响。
 */
const LAND_ZONES = SPROUT.zones.filter((z) => z.kind !== 'sea' && z.id in REGION_IDS());
function REGION_IDS(): Record<string, true> {
  return { 'sprout-town': true, 'sprout-meadow': true, 'cuilan-town': true, 'cuilan-lakeside': true, 'harbor-city': true, 'harbor-cliffs': true, 'phantom-forest': true, 'cuilan-river': true };
}
/** 西岸沙丘带：只影响高度与地表，不参与陆地轮廓（轮廓统一由 COAST 决定） */
const DUNE_ZONE = SPROUT.zones.find((z) => z.id === 'west-beach');
/** 翠澜河口三角洲：以翠澜河入海口为中心的冲积扇（区域多边形即扇形范围） */
const DELTA = SPROUT.zones.find((z) => z.id === 'river-delta');
/** 盛行风浪来向（西北偏北，单位向量；+Z 为南）：迎浪岸多礁石，背风湾多沙滩 */
const WAVE_FROM: Vec2 = [-0.55, -0.835];
const LAKE = SPROUT.waterBodies[0]!;
const GYM_ISLET = { x: LAKE.center[0], z: LAKE.center[1], r: 17 };
const EAST_SEA_X = 446;
const RIVERS = SPROUT.rivers ?? [];

/**
 * 手绘海岸线（顺时针，+Z 为南）。区域多边形仍会并入陆地（外扩 4 m），保证所有区域都在岛上。
 * 西岸（2026-10）：海岸线外扩 50–75 m 成弧形沙丘海岸，原海崖（崖脚 x ≈ -244）退为沙丘平原后方的古海崖，隐藏洞穴仍在崖脚。
 */
const COAST: Vec2[] = [
  [60, 450], [-10, 452], [-70, 444], [-130, 450], [-190, 446],
  // 2026-10 西岸：海岸线整体外扩为平滑的弧形沙丘海岸（原海崖退为沙丘后方的古海崖）
  [-232, 434], [-262, 414], [-292, 386], [-313, 334], [-322, 268], [-319, 200], [-325, 130], [-322, 66], [-326, 12], [-345, -42], [-410, -70], [-458, -150], [-466, -270],
  [-440, -390], [-350, -455], [-230, -468], [-110, -452], [0, -462], [110, -470], [210, -455], [290, -445],
  [380, -435], [440, -405], [448, -300], [448, 160], [410, 196], [350, 236], [300, 290], [258, 352],
  // 2026-10 翠澜河口：泥沙在入海口外堆出缓弧形的三角洲前缘
  [238, 398], [223, 436], [200, 458], [160, 466], [118, 458],
];
/** 外围小岛：中心、半径、最高点 */
const ISLETS: Array<{ id: string; x: number; z: number; r: number; top: number }> = [
  { id: 'sprout-reef', x: -318, z: 462, r: 24, top: 6 },
  { id: 'gull-isle', x: 250, z: -490, r: 18, top: 9 },
  { id: 'dongwang-islet', x: 488, z: -160, r: 17, top: 7 },
];
/** 西岸海崖：崖脚 x（随 z 轻微起伏；洞穴处 z = 110 精确落在 -244.5） */
const cliffFootX = (z: number) => -244.5 + 3 * Math.sin((z - 110) / 28);
/** 海崖段强度：z 20–260 为完整海崖，两端 40 m 过渡 */
const cliffK = (z: number) => smoothstep(-20, 30, z) * smoothstep(290, 240, z);

/** 河流：离 (x, z) 最近的河段 → 距离、水面高度 */
function riverProject(x: number, z: number): { d: number; level: number; width: number } | null {
  let best: { d: number; level: number; width: number } | null = null;
  for (const r of RIVERS)
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
  return best;
}

/** 每个区域的“地貌函数” */
const REGION: Record<string, (x: number, z: number) => number> = {
  'sprout-town': (x, z) => 4 + 0.4 * fbm(x / 60, z / 60),
  'sprout-meadow': (x, z) => 7 + 5 * fbm(x / 110 + 3, z / 110) + smoothstep(290, 60, z) * 5 + smoothstep(-120, -230, x) * 4,
  'cuilan-town': (x, z) => 8.5 + 0.5 * fbm(x / 50, z / 50),
  'cuilan-lakeside': (x, z) => 8 + 3.5 * fbm(x / 80 + 7, z / 80 + 1),
  'harbor-city': (x, z) => 3.2 + 0.3 * fbm(x / 40, z / 40),
  'harbor-cliffs': (x, z) => 28 + 26 * ridged(x / 140 + 11, z / 140) + smoothstep(-170, -400, z) * 8,
  'phantom-forest': (x, z) => 13 + 8 * fbm(x / 70 + 5, z / 70 + 9),
  'cuilan-river': (x, z) => 6.5 + 3 * fbm(x / 70 + 13, z / 70 + 4),
};
/** 区域之间：山脊（中部偏北最高），给视野一个“远处有山”的轮廓 */
function highlands(x: number, z: number): number {
  // 翠澜山：岛中北部主峰；东南丘陵低矮
  const peak = Math.exp(-(((x + 20) / 150) ** 2 + ((z + 300) / 130) ** 2));
  const southEast = smoothstep(100, 300, z) * smoothstep(0, 150, x);
  return lerp(16 + 22 * ridged(x / 160, z / 160) + 34 * peak, 9 + 5 * fbm(x / 90, z / 90), southEast);
}
/** 西岸沙丘带内陆高度：2–3.8 m 的沙丘（背海一侧逐渐抬升） */
function duneHeight(x: number, z: number): number {
  return 2.1 + 1.5 * Math.max(0, fbm(x / 20 + 31, z / 34)) + 0.4 * fbm(x / 7, z / 7 + 3);
}
/** 西岸沙丘带的有符号距离（< 0 在区域内） */
function duneSdf(x: number, z: number): number {
  return DUNE_ZONE ? sdPolygon(x, z, DUNE_ZONE.polygon) + fbm(x / 40 + 7, z / 40) * 6 : Infinity;
}
/** 三角洲扇形的有符号距离（外缘带噪声，形成不规则的泥滩边） */
function deltaSdf(x: number, z: number): number {
  if (!DELTA) return Infinity;
  return sdPolygon(x, z, DELTA.polygon) + fbm(x / 18 + 41, z / 18) * 6;
}
/** 三角洲湿地高度：0.3–1.3 m，低洼处为与海相通的浅水塘（< 0） */
function marshHeight(x: number, z: number): number {
  const base = 0.75 + 0.35 * fbm(x / 30 + 3, z / 30 + 11) + 0.2 * fbm(x / 8, z / 8);
  const pond = smoothstep(-0.18, -0.34, fbm(x / 16 + 61, z / 16 + 7));
  return lerp(base, -0.45, pond);
}
/** 全部海岸（原岛 + 新沙丘带 + 三角洲）的有符号距离：< 0 为陆地 */
function shoreSdf(x: number, z: number): number {
  return landSdf(x, z); // 唯一的岛屿轮廓
}
/**
 * 海岸类型：把点沿 SDF 梯度投到最近的海岸线上，在该处评估
 *   bay      凹凸度（半径 60 m 圆周上陆地占比 − 0.5；> 0 海湾，< 0 岬角）
 *   exposure 迎浪度（海岸外法线与盛行风浪来向的点积，0–1）
 * shelter = 0.5 + 1.8·bay − 0.55·exposure + 噪声；沙滩宽度 3–38 m，shelter 低处为礁石岸
 */
function coastInfo(x: number, z: number, sdf: number): { bw: number; rocky: number; shelter: number } {
  const e = 3;
  let gx = shoreSdf(x + e, z) - shoreSdf(x - e, z);
  let gz = shoreSdf(x, z + e) - shoreSdf(x, z - e);
  const gl = Math.hypot(gx, gz) || 1;
  gx /= gl;
  gz /= gl;
  const cx = x - gx * sdf;
  const cz = z - gz * sdf;
  let land = 0;
  const R = 60;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    if (shoreSdf(cx + Math.cos(a) * R, cz + Math.sin(a) * R) < 0) land++;
  }
  const bay = land / 16 - 0.5;
  const exposure = Math.max(0, gx * WAVE_FROM[0] + gz * WAVE_FROM[1]); // 外法线朝向浪来的方向 = 迎浪
  // 迎浪只轻微减分：迎岸风正是沙丘的成因；岩岸主要出现在岬角（凸出处）
  const shelter = clamp(0.56 + 2.1 * bay - 0.22 * exposure + 0.25 * fbm(cx / 45 + 9, cz / 45), 0, 1);
  const bw = lerp(3, 38, smoothstep(0.3, 0.85, shelter));
  const rocky = smoothstep(0.42, 0.18, shelter);
  return { bw, rocky, shelter };
}
/** 各区域的影响范围（米）：城镇边缘过渡短，海崖过渡长 */
const FALLOFF: Record<string, number> = { 'harbor-cliffs': 70, 'phantom-forest': 60 };

function landSdf(x: number, z: number): number {
  let d = Infinity;
  for (const zn of LAND_ZONES) d = Math.min(d, sdPolygon(x, z, zn.polygon) - 4);
  // 海岸线噪声：西岸海崖段保持笔直（海滩宽度稳定），其他地方 ±10 m 的湾岬
  const wobble = fbm(x / 70 + 20, z / 70) * 10 + fbm(x / 22, z / 22 + 9) * 3;
  const coast = sdPolygon(x, z, COAST) + wobble; // 全岛统一的湾岬噪声（西岸海崖已退到沙丘后方）
  d = Math.min(d, coast);
  d = Math.max(d, x - EAST_SEA_X + fbm(z / 60, 3) * 4); // 东侧水路 1 必须是海
  d = Math.max(d, Math.hypot(x, z) - 505); // 世界边缘留海
  for (const it of ISLETS) d = Math.min(d, Math.hypot(x - it.x, z - it.z) - it.r + fbm(x / 14 + it.r, z / 14) * 4);
  return d;
}

function isletHeight(x: number, z: number): { k: number; h: number } {
  let best = { k: 0, h: 0 };
  for (const it of ISLETS) {
    const r = Math.hypot(x - it.x, z - it.z);
    const k = smoothstep(it.r + 30, it.r + 5, r);
    if (k > best.k) best = { k, h: 1 + (it.top - 1) * smoothstep(it.r, 0, r) + fbm(x / 9, z / 9) * 0.8 };
  }
  return best;
}

/** 海岸信息（逐格保存，供材质 / 调试图使用） */
const COAST_BW = new Float32Array(513 * 513);
const COAST_ROCKY = new Float32Array(513 * 513);
const SHORE_T = new Float32Array(513 * 513);

function rawHeight(x: number, z: number, cell = -1): { h: number; sea: number } {
  const sdf = shoreSdf(x, z);
  const t = -sdf; // 深入陆地的距离（含新海岸地）
  if (cell >= 0) SHORE_T[cell] = t;
  const dDelta = deltaSdf(x, z);
  const inDelta = smoothstep(8, -30, dDelta);
  if (t < 0) {
    const depth = Math.min(20, 1.2 + -t * 0.09 + Math.max(0, -t - 40) * 0.08);
    return { h: -depth + fbm(x / 40, z / 40) * 0.6, sea: 1 };
  }
  // —— 内陆高度 ——
  let wsum = 0;
  let hsum = 0;
  let cliff = 0;
  let town = 0;
  let forest = 0; // 幻影之森：雾林直抵礁岸
  for (const zn of LAND_ZONES) {
    const f = REGION[zn.id];
    if (!f) continue;
    const sd = sdPolygon(x, z, zn.polygon);
    const w = smoothstep(FALLOFF[zn.id] ?? 45, -12, sd);
    if (w <= 0) continue;
    wsum += w;
    hsum += w * f(x, z);
    if (zn.id === 'harbor-cliffs') cliff = Math.max(cliff, w);
    if (zn.id === 'phantom-forest') forest = Math.max(forest, w);
    if (zn.kind === 'town') town = Math.max(town, smoothstep(30, -5, sd));
  }
  let inland = wsum > 1 ? hsum / wsum : hsum + (1 - wsum) * highlands(x, z);
  // 原海岸外的新沙丘带：内陆就是沙丘
  // 西岸沙丘带：沙丘平原取代山地底色，向古海崖方向平滑过渡
  const dd = duneSdf(x, z);
  if (dd < 20) inland = lerp(inland, duneHeight(x, z), smoothstep(20, -25, dd));
  const isl = isletHeight(x, z);
  if (isl.k > 0) inland = lerp(inland, isl.h, isl.k);
  inland += noise(x / 18, z / 18) * 0.35;

  // —— 海岸带：按海岸类型决定宽度与剖面 ——
  let bw = 0;
  let rocky = 0;
  if (t < 90) {
    const ci = coastInfo(x, z, sdf);
    const narrow = Math.max(cliff, town, 0);
    bw = lerp(ci.bw, Math.min(ci.bw, 4), narrow);
    // 幻影之森 / 海崖：以礁石岸为主，但海湾处（shelter 高）仍留小沙湾
    const coveK = smoothstep(0.6, 0.85, ci.shelter);
    rocky = Math.max(ci.rocky * (1 - town), (forest * 0.75 + cliff * 0.6) * (1 - coveK));
    bw = lerp(bw, 3, Math.max(forest, cliff) * 0.8 * (1 - coveK));
  }
  if (cell >= 0) {
    COAST_BW[cell] = bw;
    COAST_ROCKY[cell] = rocky;
  }
  const rampLen = lerp(lerp(45, 10, cliff), 14, rocky * 0.7) - bw * 0.4;
  const ramp = smoothstep(bw, bw + Math.max(8, rampLen), t);
  // 沙滩剖面：水线 0.3 m（湿沙）→ 前滩缓升 → 宽滩后部堆出 0.5–1.2 m 的沙丘脊
  const fore = 0.3 + 1.3 * smoothstep(0, Math.max(5, bw * 0.55), t);
  const dune = bw > 14 ? smoothstep(bw * 0.55, bw * 0.95, t) * (0.5 + 0.7 * Math.max(0, fbm(x / 16 + 5, z / 16))) : 0;
  // 礁石岸：参差的岩台（0.6–2.2 m）
  const shelf = 0.6 + 1.6 * Math.abs(noise(x / 6 + 2, z / 6)) + 0.6 * smoothstep(0, 8, t);
  const shoreH = lerp(fore + dune, shelf, rocky);
  let h = lerp(shoreH, inland, ramp);
  // —— 三角洲：湿地覆盖（河谷下游缓降到 0.3–1.3 m）——
  if (inDelta > 0) {
    h = lerp(h, marshHeight(x, z), inDelta);
    // 水道两岸不低于水面（河床稍后由河道雕刻挖出），避免水面浮在湿地上
    const rv = riverProject(x, z);
    if (rv && rv.d < rv.width / 2 + 14) h = Math.max(h, rv.level + 0.2 * smoothstep(rv.width / 2 + 14, rv.width / 2, rv.d) + 0.05); // 天然堤：水道两侧 14 m 内无水塘
  }
  return { h, sea: h < 0 && inDelta > 0.5 ? 1 : 0 };
}

function lakeShape(x: number, z: number): number {
  return ((x - LAKE.center[0]) / LAKE.radius[0]) ** 2 + ((z - LAKE.center[1]) / LAKE.radius[1]) ** 2;
}

// ———————————— 1. 高度场 ————————————
console.info(`[sprout] seed=${SEED}，计算 ${N}×${N} 高度场…`);
const H = new Float32Array(N * N);
const SEA = new Uint8Array(N * N);
const wx = (i: number) => -HALF + i * CELL;
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) {
    const r = rawHeight(wx(i), wx(j), j * N + i);
    H[j * N + i] = r.h;
    SEA[j * N + i] = r.sea;
  }

function blur(src: Float32Array, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      let s = 0;
      let c = 0;
      for (let k = -radius; k <= radius; k++) {
        const ii = clamp(i + k, 0, N - 1);
        s += src[j * N + ii]!;
        c++;
      }
      tmp[j * N + i] = s / c;
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      let s = 0;
      let c = 0;
      for (let k = -radius; k <= radius; k++) {
        const jj = clamp(j + k, 0, N - 1);
        s += tmp[jj * N + i]!;
        c++;
      }
      out[j * N + i] = s / c;
    }
  return out;
}

// 2. 城镇与道路压平（向平滑地形靠拢）
const smooth = blur(H, 8);
const smoothWide = blur(smooth, 8);
const landRoads = SPROUT.roads.filter((r) => r.surface !== 'boardwalk');
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) {
    const x = wx(i);
    const z = wx(j);
    const k = j * N + i;
    if (SEA[k]) continue;
    let flat = 0;
    for (const zn of SPROUT.zones) if (zn.kind === 'town') flat = Math.max(flat, smoothstep(10, -25, sdPolygon(x, z, zn.polygon)) * 0.85);
    for (const r of landRoads) {
      const d = distPolyline(x, z, r.points);
      flat = Math.max(flat, smoothstep(r.width / 2 + 10, r.width / 2, d));
    }
    if (flat > 0) H[k] = lerp(H[k]!, lerp(smooth[k]!, smoothWide[k]!, 0.6), flat);
  }

// 2b. 道路纵坡限制：沿路每 1 m 取高度，前后往返夹紧到 ≤ ROAD_GRADE（挖高填低），再把路面两侧 8 m 融合到该剖面
const ROAD_GRADE = Math.tan((17 * Math.PI) / 180);
function bilinear(x: number, z: number): number {
  const fx = clamp((x + HALF) / CELL, 0, N - 1.0001);
  const fz = clamp((z + HALF) / CELL, 0, N - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  return lerp(lerp(H[j * N + i]!, H[j * N + i + 1]!, tx), lerp(H[(j + 1) * N + i]!, H[(j + 1) * N + i + 1]!, tx), tz);
}
for (const r of landRoads) {
  // 1 m 采样的弧长参数化
  const pts: Array<{ x: number; z: number }> = [];
  for (let s = 0; s + 1 < r.points.length; s++) {
    const [ax, az] = r.points[s]!;
    const [bx, bz] = r.points[s + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len));
    for (let i = s === 0 ? 0 : 1; i <= n; i++) pts.push({ x: ax + ((bx - ax) * i) / n, z: az + ((bz - az) * i) / n });
  }
  const prof = pts.map((p) => bilinear(p.x, p.z));
  for (let it = 0; it < 60; it++) {
    for (let i = 1; i < prof.length; i++) prof[i] = clamp(prof[i]!, prof[i - 1]! - ROAD_GRADE, prof[i - 1]! + ROAD_GRADE);
    for (let i = prof.length - 2; i >= 0; i--) prof[i] = clamp(prof[i]!, prof[i + 1]! - ROAD_GRADE, prof[i + 1]! + ROAD_GRADE);
  }
  const hw = r.width / 2;
  const reach = hw + 8;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const i0 = Math.max(0, Math.floor((minX - reach + HALF) / CELL));
  const i1 = Math.min(N - 1, Math.ceil((maxX + reach + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((minZ - reach + HALF) / CELL));
  const j1 = Math.min(N - 1, Math.ceil((maxZ + reach + HALF) / CELL));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const k = j * N + i;
      if (SEA[k]) continue;
      const x = wx(i);
      const z = wx(j);
      let bd = Infinity;
      let bi = 0;
      for (let q = 0; q < pts.length; q += 1) {
        const d = (pts[q]!.x - x) ** 2 + (pts[q]!.z - z) ** 2;
        if (d < bd) {
          bd = d;
          bi = q;
        }
      }
      const d = Math.sqrt(bd);
      if (d > reach) continue;
      H[k] = lerp(H[k]!, prof[bi]!, smoothstep(reach, hw + 1, d));
    }
}

// 3. 湖：湖床、湖岸、湖心道馆小岛
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) {
    const x = wx(i);
    const z = wx(j);
    const k = j * N + i;
    const e = lakeShape(x, z) + fbm(x / 35, z / 35) * 0.06;
    if (e < 1.35) {
      const bank = LAKE.level + 1.2 + (H[k]! - LAKE.level - 1.2) * smoothstep(1.08, 1.35, e);
      H[k] = Math.min(H[k]!, bank);
    }
    if (e < 1) {
      const bed = LAKE.level - 0.4 - 5 * Math.pow(1 - e, 0.55) + fbm(x / 25, z / 25) * 0.4;
      H[k] = Math.min(H[k]!, lerp(LAKE.level + 0.3, bed, smoothstep(1, 0.86, e)));
    }
    const di = Math.hypot(x - GYM_ISLET.x, z - GYM_ISLET.z);
    if (di < GYM_ISLET.r + 10) H[k] = lerp(LAKE.level + 1.4, H[k]!, smoothstep(GYM_ISLET.r, GYM_ISLET.r + 10, di));
  }

// 3b. 河流：河谷（22 m 宽的缓坡岸）、河床（中线最深约 1.8 m）、低洼处筑起河堤（水面不溢出河道）
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) {
    const x = wx(i);
    const z = wx(j);
    const k = j * N + i;
    const r = riverProject(x, z);
    if (!r) continue;
    const hw = r.width / 2;
    if (r.d > hw + 26) continue;
    const bank = r.level + 0.9;
    if (H[k]! > bank) H[k] = lerp(bank, H[k]!, smoothstep(hw + 1, hw + 24, r.d));
    if (r.d < hw + 1) {
      const u = r.d / (hw + 1);
      const bed = r.level - (0.45 + 1.35 * (1 - u * u)) + fbm(x / 9, z / 9) * 0.15;
      H[k] = Math.min(H[k]!, bed);
    } else if (r.d < hw + 5 && H[k]! < r.level + 0.3 && r.level > 0.6) H[k] = r.level + 0.3;
  }

// 4. 出生点、码头周边保证可走（再压一次）
const FLAT_SPOTS: Array<[number, number, number]> = [
  [SPROUT.spawnPoint[0], SPROUT.spawnPoint[2], 20],
  ...SPROUT.pois.filter((p) => p.kind !== 'quest' && p.kind !== 'cave').map((p) => [p.position[0], p.position[2], 12] as [number, number, number]),
];
const H2 = blur(H, 3);
for (const [cx, cz, r] of FLAT_SPOTS) {
  const i0 = Math.floor((cx - r - 10 + HALF) / CELL);
  const i1 = Math.ceil((cx + r + 10 + HALF) / CELL);
  const j0 = Math.floor((cz - r - 10 + HALF) / CELL);
  const j1 = Math.ceil((cz + r + 10 + HALF) / CELL);
  for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++)
    for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
      const k = j * N + i;
      if (SEA[k] && H[k]! < -0.5) continue;
      const d = Math.hypot(wx(i) - cx, wx(j) - cz);
      H[k] = lerp(H[k]!, H2[k]!, smoothstep(r + 10, r, d));
    }
}

// 4b. 西岸海崖：崖脚以西是 20 m 宽的海滩（1.0–1.8 m），崖脚以东 7 m 内升到崖顶（≥ 14 m）
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) {
    const x = wx(i);
    const z = wx(j);
    const k = j * N + i;
    const ck = cliffK(z);
    const foot = cliffFootX(z);
    if (ck <= 0 || x < foot - 30 || x > -200) continue;
    let target: number;
    if (x < foot) {
      // 2026-10：海岸线外扩后，古海崖脚下是沙丘平原，不再有水线
      // 崖脚 14 m 内是平缓的碎石 / 沙裙（1.6–1.8 m，洞穴门口与崖下小路在此），再往西 26 m 过渡到沙丘
      target = lerp(H[k]!, lerp(1.6, 1.8, smoothstep(foot - 14, foot, x)), smoothstep(foot - 40, foot - 14, x));
    } else {
      const top = Math.max(H[k]!, 14 + 3 * fbm(x / 30, z / 30 + 2));
      target = lerp(1.8, top, smoothstep(foot, foot + 7, x) ** 0.7);
    }
    H[k] = lerp(H[k]!, target, ck);
  }

// 高度查询（生成 splat / props 用）
function heightAt(x: number, z: number): number {
  const fx = clamp((x + HALF) / CELL, 0, N - 1.0001);
  const fz = clamp((z + HALF) / CELL, 0, N - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const a = H[j * N + i]!;
  const b = H[j * N + i + 1]!;
  const c = H[(j + 1) * N + i]!;
  const d = H[(j + 1) * N + i + 1]!;
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
function slopeDeg(x: number, z: number): number {
  const e = CELL;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
}

// ———————————— 4b. 城镇地块压平（M1-02/03/04） ————————————
// 每栋建筑（及喷泉、雕像、风车等落地构筑物）压出一块平台：占地外扩 2.5 m 完全压平，再 3.5 m 平滑过渡；
// 城镇布局里的 pads（如港湾码头）按给定高度压平。高度缺省取地块内高度中位数。
const PAD_TYPES = new Set<string>(['house', 'lab', 'pokecenter', 'mart', 'warehouse', 'market-hall', 'terminal', 'greenhouse', 'windmill', 'shed', 'fountain', 'statue', 'well', 'lighthouse']);
interface Pad { x: number; z: number; hw: number; hd: number; yaw: number; y: number | null; blend: number }
const pads: Pad[] = [];
for (const t of SPROUT_TOWNS) {
  for (const q of t.pads ?? []) pads.push({ x: q.position[0], z: q.position[1], hw: q.size[0] / 2, hd: q.size[1] / 2, yaw: q.yaw ?? 0, y: q.y ?? null, blend: q.blend ?? 4 });
  for (const q of t.props) {
    if (!PAD_TYPES.has(q.type) || q.y !== undefined) continue;
    const front = q.type === 'lab' ? 4 : q.type === 'pokecenter' || q.type === 'terminal' ? 3.5 : 1.5;
    // 前方（门口 / 台阶 / 雨棚）多压一些：把矩形中心向前推 front/2
    const [w, , d] = q.size;
    const ext = q.type === 'lighthouse' ? w * 1.2 + 3 : 0;
    pads.push({
      x: q.position[0] + Math.sin(q.yaw) * (front / 2) - Math.sin(q.yaw) * (ext / 2),
      z: q.position[1] + Math.cos(q.yaw) * (front / 2) - Math.cos(q.yaw) * (ext / 2),
      hw: w / 2 + 2.5 + (q.type === 'lab' ? 3 : 0),
      hd: d / 2 + 2.5 + front / 2 + ext / 2,
      yaw: q.yaw,
      y: null,
      blend: 3.5,
    });
  }
}
function padLocal(pd: Pad, x: number, z: number): number {
  const s = Math.sin(pd.yaw);
  const c = Math.cos(pd.yaw);
  const dx = x - pd.x;
  const dz = z - pd.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const ox = Math.max(0, Math.abs(lx) - pd.hw);
  const oz = Math.max(0, Math.abs(lz) - pd.hd);
  return Math.hypot(ox, oz);
}
for (const pd of pads) {
  if (pd.y !== null) continue;
  const samples: number[] = [];
  const r = Math.hypot(pd.hw, pd.hd);
  for (let gz = pd.z - r; gz <= pd.z + r; gz += CELL)
    for (let gx = pd.x - r; gx <= pd.x + r; gx += CELL) {
      if (padLocal(pd, gx, gz) > 0) continue;
      const i = Math.round((gx + HALF) / CELL);
      const j = Math.round((gz + HALF) / CELL);
      if (i >= 0 && j >= 0 && i < N && j < N) samples.push(H[j * N + i]!);
    }
  samples.sort((a, b) => a - b);
  pd.y = samples[Math.floor(samples.length / 2)] ?? 0;
}
// 每个格子只受「最近的地块」影响：相邻建筑高度不同时，核心区互不侵蚀，过渡带取最近者
let padCells = 0;
const padBest = new Float32Array(N * N).fill(Infinity);
const padOwner = new Int32Array(N * N).fill(-1);
pads.forEach((pd, idx) => {
  const r = Math.hypot(pd.hw, pd.hd) + pd.blend + CELL;
  const i0 = Math.max(0, Math.floor((pd.x - r + HALF) / CELL));
  const i1 = Math.min(N - 1, Math.ceil((pd.x + r + HALF) / CELL));
  const j0 = Math.max(0, Math.floor((pd.z - r + HALF) / CELL));
  const j1 = Math.min(N - 1, Math.ceil((pd.z + r + HALF) / CELL));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const d = padLocal(pd, -HALF + i * CELL, -HALF + j * CELL);
      if (d > pd.blend) continue;
      const k = j * N + i;
      // 核心区（d = 0）一律优先；同为核心时后摆放的建筑（更小的地块）覆盖大地块
      const score = d <= 0 ? -1 - idx * 1e-6 : d;
      if (score < padBest[k]!) {
        padBest[k] = score;
        padOwner[k] = idx;
      }
    }
});
for (let k = 0; k < N * N; k++) {
  const o = padOwner[k]!;
  if (o < 0) continue;
  const pd = pads[o]!;
  const d = Math.max(0, padBest[k]!);
  const t = d <= 0 ? 1 : smoothstep(pd.blend, 0, d);
  H[k] = lerp(H[k]!, pd.y!, t);
  padCells++;
}
console.info(`[sprout] 城镇地块压平 ${pads.length} 块（${padCells} 格）`);

// M3-19 瀑布石台 + 台顶泉池 + 崖脚瀑潭（最后一步，覆盖压平 / 河谷雕刻）
{
  const n = applyWaterfalls(H, N, CELL, HALF, SPROUT.waterfalls ?? [], (x, z) => fbm(x, z));
  if (n) console.info(`[sprout] 瀑布石台 ${(SPROUT.waterfalls ?? []).length} 座（${n} 格）`);
}

// ———————————— 5. 编码高度图 ————————————
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
console.info(`[sprout] height.png  高度 ${hmin.toFixed(1)} ~ ${hmax.toFixed(1)} m，越界 ${clipped} 像素`);

// ———————————— 6. 材质权重 ————————————
console.info(`[sprout] 计算 ${SPLAT}×${SPLAT} 材质权重…`);
const CH = SURFACE_CHANNELS.length;
const splat0 = new Uint8Array(SPLAT * SPLAT * 4);
const splat1 = new Uint8Array(SPLAT * SPLAT * 4);
const ch = Object.fromEntries(SURFACE_CHANNELS.map((c, i) => [c, i])) as Record<(typeof SURFACE_CHANNELS)[number], number>;
const forestZone = zone('phantom-forest');
const wildZones = SPROUT.zones.filter((z) => z.kind === 'wild');
const towns = SPROUT.zones.filter((z) => z.kind === 'town');
const stats = new Float64Array(CH);
const w = new Float32Array(CH);
for (let j = 0; j < SPLAT; j++)
  for (let i = 0; i < SPLAT; i++) {
    const x = -HALF + (i + 0.5) * (SPROUT.size[0] / SPLAT);
    const z = -HALF + (j + 0.5) * (SPROUT.size[1] / SPLAT);
    const h = heightAt(x, z);
    const slope = slopeDeg(x, z);
    w.fill(0);
    w[ch.grass] = 1;
    // 野外：高草（遇敌草丛）成片分布，花丛点缀
    let wild = 0;
    for (const zn of wildZones) wild = Math.max(wild, smoothstep(8, -12, sdPolygon(x, z, zn.polygon)));
    const tallN = fbm(x / 28 + 40, z / 28) + fbm(x / 7, z / 7) * 0.25;
    w[ch.tallgrass] = wild * smoothstep(0.0, 0.14, tallN) * 1.8;
    const flowerN = fbm(x / 22 + 90, z / 22 + 13);
    w[ch.flowers] = smoothstep(0.16, 0.3, flowerN) * (0.6 + wild * 0.6);
    // 森林：幻影之森密林 + 各处零散树丛
    const inForest = smoothstep(20, -25, sdPolygon(x, z, forestZone.polygon));
    const grove = smoothstep(0.22, 0.34, fbm(x / 45 + 7, z / 45 + 70)) * 0.9;
    let town = 0;
    for (const zn of towns) town = Math.max(town, smoothstep(12, -8, sdPolygon(x, z, zn.polygon)));
    w[ch.forest] = Math.max(inForest * (0.85 + 0.3 * fbm(x / 12, z / 12)), grove * (1 - town)) * 1.4;
    // 高地（区域之外的山脊）多树与岩
    const highland = smoothstep(18, 28, h);
    w[ch.forest] = w[ch.forest]! + highland * 0.5 * smoothstep(0.05, 0.25, fbm(x / 30, z / 30 + 5));
    // 城镇：草坪为主，花坛
    if (town > 0) {
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - town);
      w[ch.flowers] = Math.max(w[ch.flowers]!, town * smoothstep(0.25, 0.35, fbm(x / 9 + 3, z / 9)) * 0.8);
    }
    // 道路
    for (const r of SPROUT.roads) {
      if (r.surface === 'boardwalk') continue;
      const d = distPolyline(x, z, r.points) + noise(x / 3, z / 3) * 0.8;
      const k = smoothstep(r.width / 2 + 1.2, r.width / 2 - 0.4, d);
      if (k <= 0) continue;
      const c = r.surface === 'stone' ? ch.stone : ch.dirt;
      w[c] = Math.max(w[c]!, k * 3);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - k);
      w[ch.forest] = w[ch.forest]! * (1 - k);
      w[ch.flowers] = w[ch.flowers]! * (1 - k);
    }
    // 城镇广场的石板：离道路稍远的区域也铺一部分
    if (town > 0.5) w[ch.stone] = Math.max(w[ch.stone]!, smoothstep(0.35, 0.5, fbm(x / 16 + 50, z / 16)) * town * 1.2);
    // 沙滩：海平面附近；湖岸
    // 海岸材质（2026-10 自然化）：按海岸类型——
    //   沙滩：湿沙（近水，偏暗）→ 干沙 → 沙丘草（沙 + 高草斑块）→ 内陆
    //   礁石岸：岩石为主、夹砾石；三角洲：泥 + 湿地草，水塘边露泥
    const gi = clamp(Math.round((x + HALF) / CELL), 0, N - 1);
    const gj = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    const gk = gj * N + gi;
    const st = SHORE_T[gk]!;
    const cbw = COAST_BW[gk]!;
    const crk = COAST_ROCKY[gk]!;
    const marsh = smoothstep(4, -20, deltaSdf(x, z));
    let beach = 0;
    if (st >= -2 && h < 4.2 && marsh < 0.5) {
      beach = smoothstep(cbw + 3, cbw - 3, st) * (1 - smoothstep(15, 28, slope)) * (1 - crk * 0.85);
      // 窄滩（< 6 m）以砾石为主
      const gravel = smoothstep(8, 3, cbw) * smoothstep(cbw + 3, 0, st) * (1 - crk);
      if (gravel > 0) {
        w[ch.stone] = Math.max(w[ch.stone]!, gravel * 1.6);
        w[ch.rock] = Math.max(w[ch.rock]!, gravel * 0.6 * smoothstep(0.0, 0.3, fbm(x / 5, z / 5)));
      }
      const rockShore = crk * smoothstep(cbw + 10, 0, st);
      if (rockShore > 0) {
        w[ch.rock] = Math.max(w[ch.rock]!, rockShore * (2.5 + 2 * Math.max(0, fbm(x / 7 + 3, z / 7))));
        w[ch.stone] = Math.max(w[ch.stone]!, rockShore * 0.8);
        w[ch.forest] = w[ch.forest]! * (1 - rockShore);
        w[ch.tallgrass] = w[ch.tallgrass]! * (1 - rockShore);
      }
      // 湿沙：近水 35% 宽度掺泥色
      const wet = beach * smoothstep(cbw * 0.38, 0, st);
      if (wet > 0) w[ch.dirt] = Math.max(w[ch.dirt]!, wet * 0.9);
      // 沙丘草：沙滩后半段的成簇海滨草
      const duneGrass = cbw > 12 ? smoothstep(cbw * 0.5, cbw * 0.85, st) * smoothstep(cbw + 8, cbw, st) * smoothstep(0, 0.35, fbm(x / 9 + 13, z / 9)) : 0;
      if (duneGrass > 0) {
        w[ch.tallgrass] = Math.max(w[ch.tallgrass]!, duneGrass * 1.6);
        w[ch.grass] = Math.max(w[ch.grass]!, duneGrass * 0.8);
        beach *= 1 - duneGrass * 0.45;
      }
    }
    // 陡岸（沙铺不上去的地方）：水线 10 m 内为岩石 / 砾石，不让草直接伸进海里
    if (st >= -2 && st < 10 && h < 6 && marsh < 0.5) {
      const steep = smoothstep(8, 0, st) * (1 - Math.min(1, beach * 1.5));
      if (steep > 0) {
        w[ch.rock] = Math.max(w[ch.rock]!, steep * (2 + 1.5 * Math.max(0, fbm(x / 6, z / 6 + 4))));
        w[ch.stone] = Math.max(w[ch.stone]!, steep * 1.2);
        w[ch.grass] = w[ch.grass]! * (1 - steep * 0.8);
        w[ch.tallgrass] = w[ch.tallgrass]! * (1 - steep);
        w[ch.forest] = w[ch.forest]! * (1 - steep);
      }
    }
    // 贴近海平面（< 1.8 m）却没铺沙的地面：砾石 / 礁石（与离岸距离判定互补，覆盖地形起伏造成的偏差）
    if (h < 1.8 && h >= 0 && marsh < 0.5 && lakeShape(x, z) > 1.35) {
      const lowBare = smoothstep(1.8, 0.7, h) * (1 - Math.min(1, beach * 1.5));
      if (lowBare > 0) {
        w[ch.rock] = Math.max(w[ch.rock]!, lowBare * 2.2);
        w[ch.stone] = Math.max(w[ch.stone]!, lowBare * 1.2);
        w[ch.grass] = w[ch.grass]! * (1 - lowBare * 0.85);
        w[ch.tallgrass] = w[ch.tallgrass]! * (1 - lowBare);
      }
    }
    // 礁石岬角顶部：岩盘 + 稀疏海滨草（不是草坪）
    if (crk > 0.45 && st >= 0 && st < cbw + 26 && h < 12) {
      const heath = smoothstep(0.45, 0.8, crk) * smoothstep(cbw + 26, cbw + 6, st);
      const outcrop = smoothstep(-0.1, 0.25, fbm(x / 9 + 17, z / 9 + 3));
      w[ch.rock] = Math.max(w[ch.rock]!, heath * (1 + outcrop * 3));
      w[ch.tallgrass] = Math.max(w[ch.tallgrass]! * (1 - heath * 0.5), heath * (1 - outcrop) * 0.9);
      w[ch.grass] = w[ch.grass]! * (1 - heath * 0.55);
      w[ch.flowers] = Math.max(w[ch.flowers]!, heath * (1 - outcrop) * 0.25);
    }
    // 西岸沙丘带腹地：整片沙地，成簇海滨草与低矮灌丛（不是草甸）
    const dz = duneSdf(x, z);
    if (dz < 0 && st > cbw - 3) {
      // 前丘沙地 → 后丘灌草：离水线 15–45 m 以外逐渐过渡为草地，与草原 / 古海崖下的植被衔接
      const k = smoothstep(0, -10, dz) * (1 - crk) * smoothstep(cbw + 45, cbw + 15, st);
      const tuft = smoothstep(-0.05, 0.3, fbm(x / 8 + 21, z / 8));
      w[ch.sand] = Math.max(w[ch.sand]!, k * (3 - tuft * 1.6));
      w[ch.tallgrass] = Math.max(w[ch.tallgrass]! * (1 - k), k * tuft * 1.5);
      w[ch.grass] = w[ch.grass]! * (1 - k * 0.6) + k * tuft * 0.6;
      w[ch.forest] = w[ch.forest]! * (1 - k * 0.8);
      w[ch.flowers] = w[ch.flowers]! * (1 - k);
    }
    if (marsh > 0) {
      const mud = smoothstep(0.9, 0.2, h);
      w[ch.dirt] = Math.max(w[ch.dirt]!, marsh * (0.6 + mud * 2));
      w[ch.tallgrass] = Math.max(w[ch.tallgrass]!, marsh * (1 - mud) * (1.4 + fbm(x / 7, z / 7)));
      w[ch.grass] = Math.max(w[ch.grass]!, marsh * 1.0);
      w[ch.forest] = w[ch.forest]! * (1 - marsh);
      w[ch.sand] = w[ch.sand]! * (1 - marsh);
    }
    const lakeBeach = smoothstep(1.28, 1.02, lakeShape(x, z)) * smoothstep(LAKE.level + 1.6, LAKE.level + 0.6, h);
    const sand = Math.max(beach, lakeBeach);
    if (sand > 0) {
      w[ch.sand] = Math.max(w[ch.sand]!, sand * 4 * (1 - marsh));
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - sand * 0.55); // 保留沙丘草
      w[ch.forest] = w[ch.forest]! * (1 - sand);
      w[ch.flowers] = w[ch.flowers]! * (1 - sand);
    }
    // 河岸：卵石沙滩
    const rv = riverProject(x, z);
    if (rv && rv.d < rv.width / 2 + 4) {
      const kb = smoothstep(rv.width / 2 + 4, rv.width / 2 + 1, rv.d);
      w[ch.sand] = Math.max(w[ch.sand]!, kb * 3);
      w[ch.rock] = Math.max(w[ch.rock]!, kb * smoothstep(0.1, 0.3, fbm(x / 6, z / 6)) * 2);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - kb);
      w[ch.forest] = w[ch.forest]! * (1 - kb);
    }
    // 水下：沙 + 岩
    if (h < 0 || (lakeShape(x, z) < 1 && h < LAKE.level) || (rv && rv.d < rv.width / 2 + 1 && h < rv.level)) {
      w.fill(0);
      w[ch.sand] = 1;
      w[ch.rock] = smoothstep(0.1, 0.4, fbm(x / 20, z / 20));
    }
    // 陡坡 = 岩石（海崖 / 河谷陡岸上的沙、草都让位给岩石）
    const rock = smoothstep(30, 42, slope) + smoothstep(48, 62, h) * 0.8;
    if (rock > 0) {
      const keep = 1 - Math.min(1, rock);
      w[ch.sand] = w[ch.sand]! * keep;
      w[ch.grass] = w[ch.grass]! * keep;
      w[ch.dirt] = w[ch.dirt]! * keep;
      w[ch.rock] = Math.max(w[ch.rock]!, rock * 5);
      w[ch.tallgrass] = w[ch.tallgrass]! * (1 - Math.min(1, rock));
      w[ch.flowers] = w[ch.flowers]! * (1 - Math.min(1, rock));
    }
    // 归一化为和 = 255（先去掉负权重；全为 0 时退回草地）
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
    // 舍入误差补到最大通道
    { const arr = maxC < 4 ? splat0 : splat1; arr[k + (maxC % 4)] = arr[k + (maxC % 4)]! + 255 - acc; }
  }
writeFileSync(join(outDir, 'splat0.png'), encode({ width: SPLAT, height: SPLAT, data: splat0, depth: 8, channels: 4 }));
writeFileSync(join(outDir, 'splat1.png'), encode({ width: SPLAT, height: SPLAT, data: splat1, depth: 8, channels: 4 }));
console.info(`[sprout] splat0/1.png  覆盖率 ${SURFACE_CHANNELS.map((c, i) => `${c} ${((stats[i]! / (SPLAT * SPLAT)) * 100).toFixed(1)}%`).join(' · ')}`);

// ———————————— 7. 灰盒摆放物 ————————————
const props: PropInstance[] = [];
const allRoads = SPROUT.roads.filter((r) => r.surface !== 'boardwalk');
/** 建筑正面（+Z）朝向最近的道路 */
function faceRoad(x: number, z: number): number {
  let best = { d: Infinity, x: 0, z: 0 };
  for (const r of allRoads) {
    const n = nearestOnPolyline(x, z, r.points);
    if (n.d < best.d) best = n;
  }
  return Math.atan2(best.x - x, best.z - z);
}
/** 由门的位置反推建筑中心 */
function building(type: PropInstance['type'], door: Vec2, size: [number, number, number], extra: Partial<PropInstance> = {}): void {
  const yaw = extra.yaw ?? faceRoad(door[0], door[1]);
  const back = size[2] / 2 + 0.6;
  props.push({
    type,
    position: [door[0] - Math.sin(yaw) * back, door[1] - Math.cos(yaw) * back],
    yaw,
    size,
    ...extra,
  });
}
const WALLS = ['#f4ead7', '#efe2c8', '#f7f1e6', '#e8dcc6', '#f2e6d0'];
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;

// 城镇布局已手工摆放的 POI 建筑 / 码头不再自动生成
const townRefs = new Set(SPROUT_TOWNS.flatMap((t) => t.props.map((q) => q.ref).filter((r): r is string => !!r)));
for (const p of SPROUT.pois) {
  if (townRefs.has(p.id) || (p.kind === 'ferry' && townRefs.has('ferry-boat')) || (p.kind === 'fishing' && p.id === 'harbor-pier') || p.id === 'sprout-dock') continue;
  const door: Vec2 = [p.position[0], p.position[2]];
  switch (p.kind) {
    case 'door':
      if (p.id === 'magnolia-lab') building('lab', door, [18, 7, 12], { ref: p.id, color: '#f3f5f7', roof: '#5c8fcf' });
      else if (p.id === 'player-house') building('house', door, [10, 6.5, 9], { ref: p.id, color: '#f6ecda', roof: '#d9674e' });
      else building('house', door, [9, 6, 8], { ref: p.id, color: pick(WALLS), roof: '#7d9a52' });
      break;
    case 'pokecenter':
      building('pokecenter', door, [15, 7.5, 12], { ref: p.id, color: '#fbf5ee', roof: '#e25a4f' });
      break;
    case 'mart':
      building(p.id === 'harbor-market' ? 'warehouse' : 'mart', door, p.id === 'harbor-market' ? [22, 8, 14] : [12, 6.5, 10], {
        ref: p.id,
        color: '#f4f6f8',
        roof: '#3f7fd6',
      });
      break;
    case 'gym':
      props.push({ type: 'gym', ref: p.id, position: door, y: LAKE.level + 1.4, yaw: -Math.PI / 2, size: [24, 11, 24], color: '#dff1f7', roof: '#3aa0c8' });
      break;
    case 'landmark':
      if (p.id === 'harbor-lighthouse') props.push({ type: 'lighthouse', ref: p.id, position: door, yaw: 0, size: [6, 26, 6], color: '#fbfbf6', roof: '#d9453b' });
      else props.push({ type: 'sign', ref: p.id, position: door, yaw: faceRoad(door[0], door[1]), size: [1.6, 1.6, 0.2] });
      break;
    case 'dock':
    case 'fishing':
    case 'ferry': {
      // 码头：从陆地伸向海面，方向 = 最近的海方向（朝外）
      const dir = Math.atan2(door[0] - 0, door[1] - 0);
      const len = p.kind === 'ferry' ? 26 : 20;
      props.push({ type: 'dock', ref: p.id, position: [door[0] + Math.sin(dir) * (len / 2 - 4), door[1] + Math.cos(dir) * (len / 2 - 4)], y: 1.3, yaw: dir, size: [p.kind === 'ferry' ? 8 : 5, 0.4, len] });
      if (p.kind === 'ferry') props.push({ type: 'boat', ref: 'ferry-boat', position: [door[0] + Math.sin(dir) * len + 6, door[1] + Math.cos(dir) * len], y: 0, yaw: dir + Math.PI / 2, size: [7, 5, 20], color: '#f5f5f0', roof: '#2f6db5', collide: true });
      break;
    }
    case 'cave': {
      // 洞口贴在崖脚：从 POI 沿 doorYaw 反方向往崖里找第一处高出 POI 3 m 的地面，洞口放在它前面 0.5 m
      const yaw = p.doorYaw ?? 0;
      const y0 = bilinear(door[0], door[1]);
      let d = 0.5;
      while (d < 14 && bilinear(door[0] - Math.sin(yaw) * d, door[1] - Math.cos(yaw) * d) < y0 + 3) d += 0.5;
      props.push({ type: 'cave-mouth', ref: p.id, position: [door[0] - Math.sin(yaw) * (d - 0.5), door[1] - Math.cos(yaw) * (d - 0.5)], yaw, size: [4.2, 4.6, 4] });
      break;
    }
    default:
      break;
  }
}

// M1-02/03/04 城镇（手工布局）
for (const t of SPROUT_TOWNS) props.push(...t.props);
// 围栏：港湾海崖路边
props.push({ type: 'fence', position: [0, 0], yaw: 0, size: [0.12, 1.1, 0.12], points: [[352, -150], [338, -262], [327, -355]] });
// 栈桥（湖心道馆）
for (const bridge of SPROUT.roads.filter((r) => r.surface === 'boardwalk')) {
  // 湖心栈桥贴湖面；河上木桥高出水面 1.3 m，并与两岸地面齐平
  let y = LAKE.level + 1.1;
  if (bridge.id !== 'bridge-gym') {
    const a = bridge.points[0]!;
    const b = bridge.points[bridge.points.length - 1]!;
    const mid = riverProject((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    y = Math.max((mid?.level ?? 0) + 1.3, heightAt(a[0], a[1]), heightAt(b[0], b[1]));
  }
  props.push({ type: 'boardwalk', id: bridge.id, position: [0, 0], y, yaw: 0, size: [bridge.width, 0.35, 0], points: bridge.points });
}
// 可破坏岩石（阻挡）
for (const b of SPROUT.blockers) {
  if (b.type === 'rock-smash') props.push({ type: 'breakable-rock', ref: b.id, position: [b.position[0], b.position[2]], yaw: 0, size: [b.radius! * 2, 2.4, b.radius! * 2] });
}
// 所有摆放物标记地面高度（y 缺省 = 地形），并检查是否压在水里
let drowned = 0;
for (const p of props) {
  if (p.y === undefined && p.type !== 'fence' && p.type !== 'boardwalk' && heightAt(p.position[0], p.position[1]) < 0.3) drowned++;
}
const propsFile: PropsFile = { version: 1, island: 'sprout', generatedBy: `gen-sprout seed=${SEED}`, props };
writeFileSync(join(outDir, 'props.json'), JSON.stringify(propsFile, null, 1));
console.info(`[sprout] props.json  ${props.length} 个摆放物（落水 ${drowned}）`);

// ———————————— 8. 预览图 ————————————
const PV = 512;
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
for (let j = 0; j < PV; j++)
  for (let i = 0; i < PV; i++) {
    const x = -HALF + (i + 0.5) * 2;
    const z = -HALF + (j + 0.5) * 2;
    const h = heightAt(x, z);
    const si = Math.floor(((i + 0.5) / PV) * SPLAT);
    const sj = Math.floor(((j + 0.5) / PV) * SPLAT);
    const k = (sj * SPLAT + si) * 4;
    let c: [number, number, number] = [0, 0, 0];
    SURFACE_CHANNELS.forEach((name, ci) => {
      const v = (ci < 4 ? splat0 : splat1)[k + (ci % 4)]! / 255;
      c = [c[0] + COLORS[name]![0] * v, c[1] + COLORS[name]![1] * v, c[2] + COLORS[name]![2] * v];
    });
    const shade = clamp(0.8 + (heightAt(x - 2, z - 2) - h) * 0.12, 0.55, 1.2);
    c = [c[0] * shade, c[1] * shade, c[2] * shade];
    const inLake = lakeShape(x, z) < 1.1 && h < LAKE.level;
    const rp = riverProject(x, z);
    const inRiver = !!rp && rp.d < rp.width / 2 + 3 && h < rp.level;
    if (h < 0 || inLake || inRiver) {
      const depth = inLake ? LAKE.level - h : inRiver ? rp!.level - h : -h;
      const t = clamp(depth / 12, 0, 1);
      c = [lerp(110, 30, t), lerp(200, 90, t), lerp(225, 170, t)];
    }
    const o = (j * PV + i) * 3;
    pv[o] = clamp(c[0], 0, 255);
    pv[o + 1] = clamp(c[1], 0, 255);
    pv[o + 2] = clamp(c[2], 0, 255);
  }
// 在预览图上画出区域边界与摆放物
const plot = (x: number, z: number, rgb: [number, number, number]) => {
  const i = Math.round((x + HALF) / 2);
  const j = Math.round((z + HALF) / 2);
  if (i < 0 || j < 0 || i >= PV || j >= PV) return;
  const o = (j * PV + i) * 3;
  pv[o] = rgb[0];
  pv[o + 1] = rgb[1];
  pv[o + 2] = rgb[2];
};
for (const zn of SPROUT.zones)
  for (let s = 0; s < zn.polygon.length; s++) {
    const [ax, az] = zn.polygon[s]!;
    const [bx, bz] = zn.polygon[(s + 1) % zn.polygon.length]!;
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 1.5) plot(ax + ((bx - ax) * t) / len, az + ((bz - az) * t) / len, zn.kind === 'town' ? [255, 240, 120] : [255, 255, 255]);
  }
for (const p of props) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) plot(p.position[0] + dx * 2, p.position[1] + dz * 2, [200, 60, 50]);
writeFileSync(join(outDir, 'preview.png'), encode({ width: PV, height: PV, data: pv, depth: 8, channels: 3 }));

// ———————————— 9. 元数据 ————————————
const walkable = (() => {
  let ok = 0;
  let land = 0;
  for (let j = 0; j < N; j += 2)
    for (let i = 0; i < N; i += 2) {
      const x = wx(i);
      const z = wx(j);
      if (heightAt(x, z) < 0) continue;
      land++;
      if (slopeDeg(x, z) < 40) ok++;
    }
  return { land, ok };
})();
const meta = {
  seed: SEED,
  generatedAt: new Date().toISOString(),
  heightmap: { size: N, cell: CELL, range: SPROUT.heightRange, min: hmin, max: hmax, clipped },
  splat: { size: SPLAT, channels: SURFACE_CHANNELS, coverage: Object.fromEntries(SURFACE_CHANNELS.map((c, i) => [c, +(stats[i]! / (SPLAT * SPLAT)).toFixed(4)])) },
  props: props.length,
  landRatio: +(walkable.land / (((N + 1) / 2) ** 2)).toFixed(3),
  walkableRatio: +(walkable.ok / walkable.land).toFixed(3),
};
writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
console.info(`[sprout] 完成：陆地 ${(meta.landRatio * 100).toFixed(1)}%，可行走 ${(meta.walkableRatio * 100).toFixed(1)}% → ${outDir}`);

// —— 调试：海岸类型分布图（pnpm gen:sprout --debug → .sync/coast-types.png）——
if (process.argv.includes('--debug')) {
  const img = new Uint8Array(N * N * 3);
  for (let k = 0; k < N * N; k++) {
    const x = wx(k % N);
    const z = wx(Math.floor(k / N));
    const h = H[k]!;
    let c: [number, number, number];
    if (h < 0) c = [40, 90, 150];
    else if (deltaSdf(x, z) < 0) c = [40, 170, 150]; // 三角洲湿地
    else if (SHORE_T[k]! > COAST_BW[k]! + 6 || h > 6) c = [70, 110, 70]; // 内陆
    else if (COAST_ROCKY[k]! > 0.5) c = [130, 130, 135]; // 礁石岸
    else if (COAST_BW[k]! >= 14) c = [240, 215, 120]; // 宽沙滩
    else if (COAST_BW[k]! >= 6) c = [245, 235, 185]; // 窄沙滩
    else c = [215, 140, 70]; // 砾石滩
    img.set(c, k * 3);
  }
  mkdirSync(join(root, '.sync'), { recursive: true });
  writeFileSync(join(root, '.sync', 'coast-types.png'), encode({ width: N, height: N, data: img, depth: 8, channels: 3 }));
  console.info('[sprout] 调试：.sync/coast-types.png');
}

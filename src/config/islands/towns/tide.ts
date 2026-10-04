/**
 * M2-05/06/07/08 碧潮群岛四座城镇（手工布局）。
 *
 * - 碧潮镇（西·森林边）：巨树根部的树屋小镇，草系道馆「碧潮道馆」在镇北。
 * - 矿石镇（中·峡谷底）：土坯房、矿车轨道、井架，岩系道馆在主街北侧。
 * - 火山镇（东·火山脚）：黑曜岩屋与玄武岩柱，炎系道馆在主街北侧，东面是喷气口。
 * - 温泉乡（东南·溪谷）：汤屋、牌坊、石灯笼，露天温泉在主街南侧，码头通往碧潮—雷鸣海域。
 *
 * 门口坐标与 tide.ts 的 POI 一一对应（atDoor 反推建筑中心；道馆 = 门口沿朝向后退 w/2 + 1）。
 */
import type { PropInstance, TownLayout, Vec2, Vec3 } from '../types';
import { FACE, PI, atDoor, deck, fence, lamps, prop, trees } from './helpers';

/** 道馆：门口坐标 → 圆形馆体中心 */
function gymAt(ref: string, door: Vec2, yaw: number, w: number, h: number, variant: string, color: string, roof: string): PropInstance {
  const back = w / 2 + 1;
  return { type: 'gym', ref, position: [door[0] - Math.sin(yaw) * back, door[1] - Math.cos(yaw) * back], yaw, size: [w, h, w], variant, color, roof };
}

const stoneLanterns = (list: Vec2[], h = 1.9): PropInstance[] => list.map((p, i) => ({ type: 'stone-lantern', position: p, yaw: (i * 0.4) % PI, size: [0.8, h, 0.8] }));
const ores = (list: Array<[number, number, number]>, seed: number): PropInstance[] => list.map(([x, z, w], i) => ({ type: 'ore-pile', position: [x, z], yaw: i * 1.3, size: [w, w * 0.6, w], seed: seed + i }));
const crates = (list: Vec2[]): PropInstance[] => list.map((p, i) => ({ type: 'crate', position: p, yaw: i * 0.6, size: [1.2, 1.2, 1.2] }));
const barrels = (list: Vec2[], color = '#7a5a32'): PropInstance[] => list.map((p) => ({ type: 'barrel', position: p, yaw: 0, size: [0.8, 1, 0.8], color }));
const house = (door: Vec2, yaw: number, size: Vec3, variant: string, color: string, roof: string, seed: number, extra: Partial<PropInstance> = {}): PropInstance =>
  atDoor('house', door, yaw, size, { variant, color, roof, seed, ...extra });

// ———————————————————————— 碧潮镇 ————————————————————————
/** 镇中心的千年巨树（根部拱起，树冠覆盖半个镇子） */
const GIANT_TREE: Vec2 = [-455, 96];

const tideTown: PropInstance[] = [
  // 公共建筑（主街北侧，门朝南）
  atDoor('pokecenter', [-500, 22], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-tide', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [-440, 22], FACE.south, [12, 6.5, 10], { ref: 'mart-tide', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-azure', [-470, -52], FACE.south, 26, 12, 'grass', '#e4f0d4', '#3f8a4a'),
  // 巨树与环绕它的树屋
  { type: 'giant-tree', position: GIANT_TREE, yaw: 0.3, size: [1, 46, 1], seed: 2101 },
  atDoor('treehouse', [-540, 78], FACE.north, [8, 4.2, 7], { ref: 'tide-elder-house', y: 5.2, roof: '#7d9a52', seed: 2102 }),
  atDoor('treehouse', [-410, 64], FACE.west, [7, 3.8, 6], { y: 4.4, roof: '#b8a05a', seed: 2103 }),
  atDoor('treehouse', [-500, 132], FACE.east, [7, 3.8, 6], { y: 4.8, roof: '#a7695a', seed: 2104 }),
  atDoor('treehouse', [-412, 128], FACE.west, [6.5, 3.6, 6], { y: 4.0, roof: '#6aa56b', seed: 2105 }),
  atDoor('treehouse', [-560, 120], FACE.north, [6.5, 3.6, 6], { y: 4.6, roof: '#b8a05a', seed: 2106 }),
  // 树屋之间的吊桥（中段下垂 1.2 m）
  { type: 'rope-bridge', position: [-520, 104], yaw: 0, size: [1.6, 1.2, 1], y: 0, points: [[-536, 86], [-520, 104], [-505, 126]] },
  { type: 'rope-bridge', position: [-414, 96], yaw: 0, size: [1.6, 1.0, 1], points: [[-412, 70], [-413, 96], [-413, 122]] },
  // 主街南侧民居（门朝北）
  house([-540, 38], FACE.north, [9, 6, 8], 'timber', '#efe3c6', '#5b7a3a', 2111),
  house([-524, 38], FACE.north, [9, 5.6, 8], 'cottage', '#f4ead7', '#7d9a52', 2112),
  house([-408, 38], FACE.north, [9, 6.2, 8], 'gable', '#f2e6d0', '#a7695a', 2113, { accent: '#5b8a5a' }),
  house([-392, 38], FACE.north, [9, 7.2, 8], 'two-storey', '#e8dcc6', '#46708a', 2114, { accent: '#3f8a4a' }),
  house([-556, 22], FACE.south, [9, 6, 8], 'timber', '#f7f1e6', '#6b4a33', 2115),
  house([-412, 22], FACE.south, [9, 5.6, 8], 'cottage', '#efe2c8', '#5b8a5a', 2116),
  // 道馆前广场：花坛 + 道馆名牌
  prop('flowerbed', [-479, -36], [3, 0.4, 1.2], { seed: 2121 }),
  prop('flowerbed', [-461, -36], [3, 0.4, 1.2], { seed: 2122 }),
  { type: 'sign', ref: 'gym-azure-sign', position: [-462, -44], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', position: [-470, 18], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'bench', position: [-478, 44], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [-462, 44], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
  { type: 'well', position: [-470, 56], yaw: 0, size: [2, 3, 2] },
  prop('garden', [-575, 60], [6, 0.4, 5], { variant: 'herb', seed: 2123 }),
  prop('garden', [-388, 58], [5, 0.4, 6], { variant: 'veg', seed: 2124 }),
  fence([[-579, 56], [-579, 64], [-571, 64]]),
  { type: 'laundry', position: [-532, 50], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 2125 },
  ...lamps([[-548, 25], [-520, 35], [-490, 25], [-450, 35], [-420, 25], [-385, 35]]),
  ...stoneLanterns([[-476, -24], [-464, -24], [-476, -6], [-464, -6]], 1.6),
  // 林间巨石与蕨丛
  prop('rocks', [-430, -20], [3.4, 1.2, 3.4], { seed: 2131 }),
  prop('rocks', [-575, -40], [4, 1.4, 4], { seed: 2132 }),
  ...trees(
    [
      [-590, -20, 12, 'pine'], [-585, 10, 11, 'pine'], [-560, -60, 13, 'pine'], [-530, -80, 12], [-420, -70, 12], [-395, -40, 11, 'pine'],
      [-380, 0, 9], [-560, 160, 11], [-520, 165, 12, 'pine'], [-470, 165, 10], [-420, 160, 12, 'pine'], [-385, 120, 9], [-595, 100, 10],
      [-545, 0, 5, 'shrub'], [-395, 10, 5, 'shrub'], [-486, 64, 4.5, 'shrub'], [-452, 64, 4.5, 'shrub'],
    ],
    2140,
  ),
  // 码头（西岸）
  deck([-616, 30], 28, 6, 2.4, 'nsw', [['e', 0, 6]]),
  { type: 'rowboat', position: [-622, 38], yaw: 0.2, size: [1.6, 0.6, 4], y: 0.2 },
  { type: 'bollard', position: [-626, 27], yaw: 0, size: [0.4, 0.7, 0.4], y: 2.4 },
  { type: 'bollard', position: [-626, 33], yaw: 0, size: [0.4, 0.7, 0.4], y: 2.4 },
  { type: 'net-rack', position: [-596, 44], yaw: FACE.west, size: [3, 2, 0.3] },
  { type: 'sign', ref: 'tide-dock-sign', position: [-598, 22], yaw: FACE.east, size: [1.6, 1.6, 0.2] },
];

export const TIDE_TOWN: TownLayout = {
  id: 'tide-town',
  zone: 'tide-town',
  paths: [
    { id: 'town-tide-gym-walk', surface: 'stone', width: 6, points: [[-470, 26], [-470, -50]] },
    { id: 'town-tide-tree-ring', surface: 'dirt', width: 4, points: [[-470, 34], [-500, 60], [-500, 120], [-455, 140], [-416, 112], [-420, 60], [-470, 34]] },
    { id: 'town-tide-elder-walk', surface: 'dirt', width: 3, points: [[-540, 34], [-540, 78]] },
    { id: 'town-tide-dock-walk', surface: 'dirt', width: 4, points: [[-560, 30], [-602, 30]] },
  ],
  pads: [
    { position: [-470, 20], size: [200, 30], blend: 10 },
    { position: [-470, -50], size: [44, 48], blend: 10 },
  ],
  props: tideTown,
};

// ———————————————————————— 矿石镇 ————————————————————————
const RAIL: Vec2[] = [[98, 150], [102, 60], [108, -20], [110, -96]];

const oreTown: PropInstance[] = [
  atDoor('pokecenter', [40, 230], FACE.north, [15, 7.5, 12], { ref: 'pokecenter-ore', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [90, 232], FACE.north, [12, 6.5, 10], { ref: 'mart-ore', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-ore', [120, 200], FACE.south, 24, 12, 'rock', '#c9a27a', '#8a5a3c'),
  // 土坯房（主街两侧）
  house([150, 240], FACE.north, [10, 6, 9], 'adobe', '#c98d5e', '#8a5a3c', 2201, { ref: 'ore-foreman-house', accent: '#3f7a8a' }),
  house([30, 200], FACE.south, [9, 5.2, 8], 'adobe', '#d4a273', '#8a5a3c', 2202, { accent: '#b8503c' }),
  house([48, 200], FACE.south, [9, 5.6, 8], 'adobe', '#c99466', '#8a5a3c', 2203, { accent: '#3f7a8a' }),
  house([66, 202], FACE.south, [8, 5, 7], 'adobe', '#d9ac80', '#8a5a3c', 2204, { accent: '#e0a13a' }),
  house([150, 206], FACE.south, [9, 5.4, 8], 'adobe', '#cf9a6b', '#8a5a3c', 2205, { accent: '#5b8a5a' }),
  house([166, 210], FACE.south, [8, 5, 7], 'adobe', '#c48a5a', '#8a5a3c', 2206, { accent: '#3f7a8a' }),
  house([118, 236], FACE.north, [9, 5.2, 8], 'adobe', '#d4a273', '#8a5a3c', 2207, { accent: '#b8503c' }),
  house([20, 228], FACE.north, [8, 5, 7], 'adobe', '#cf9a6b', '#8a5a3c', 2208, { accent: '#e0a13a' }),
  // 井架 + 矿车轨道（通往北面的矿洞）
  { type: 'headframe', position: [84, 158], yaw: 0.1, size: [5, 13, 5] },
  { type: 'rail', position: [98, 150], yaw: 0, size: [1.6, 0.2, 1], points: RAIL },
  { type: 'mine-cart', position: [98.2, 140], yaw: 0, size: [1.4, 1.4, 2], seed: 2211 },
  { type: 'mine-cart', position: [101.5, 72], yaw: 0.05, size: [1.4, 1.4, 2], seed: 2212 },
  { type: 'mine-cart', position: [109.6, -80], yaw: 0.03, size: [1.4, 1.4, 2], seed: 2213, variant: 'anomaly' },
  ...ores([[74, 148, 3.2], [70, 156, 2.4], [112, 150, 2.6], [176, 228, 2.2], [8, 214, 2.8], [118, -92, 3]], 2220),
  ...crates([[78, 166], [79.3, 167.2], [128, 214], [129, 215.4], [58, 214], [12, 220]]),
  ...barrels([[86, 168], [87, 169.2], [140, 216], [26, 216], [62, 230]]),
  { type: 'noticeboard', position: [104, 207], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'sign', ref: 'gym-ore-sign', position: [112, 204], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'bench', position: [70, 222], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
  { type: 'well', position: [66, 238], yaw: 0, size: [2, 3, 2] },
  { type: 'bunting', position: [92, 218], yaw: 0, size: [1, 5, 1], points: [[20, 212], [92, 214], [166, 220]], seed: 2230 },
  ...lamps([[24, 214], [56, 224], [88, 216], [132, 226], [160, 218]]),
  prop('rocks', [0, 190], [5, 2, 5], { seed: 2231 }),
  prop('rocks', [186, 244], [4.4, 1.6, 4.4], { seed: 2232 }),
  prop('rocks', [60, 120], [6, 2.4, 6], { seed: 2233 }),
  ...trees([[10, 246, 6, 'shrub'], [176, 196, 5, 'shrub'], [140, 254, 6.5], [60, 250, 6], [190, 210, 7, 'pine']], 2240),
];

export const ORE_TOWN: TownLayout = {
  id: 'ore-town',
  zone: 'ore-town',
  paths: [
    { id: 'town-ore-gym-walk', surface: 'stone', width: 6, points: [[120, 214], [120, 202]] },
    { id: 'town-ore-headframe', surface: 'dirt', width: 4, points: [[92, 214], [86, 166]] },
    { id: 'town-ore-south-gate', surface: 'dirt', width: 4, points: [[100, 220], [100, 322]] },
  ],
  pads: [
    { position: [92, 218], size: [180, 44], yaw: 0.066, blend: 12 },
    { position: [120, 186], size: [34, 34], blend: 8 },
  ],
  props: oreTown,
};

// ———————————————————————— 火山镇 ————————————————————————
const flameTown: PropInstance[] = [
  atDoor('pokecenter', [490, 76], FACE.north, [15, 7.5, 12], { ref: 'pokecenter-flame', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [540, 76], FACE.north, [12, 6.5, 10], { ref: 'mart-flame', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-flame', [600, 34], FACE.south, 24, 13, 'fire', '#3a3030', '#d9542a'),
  house([626, 98], FACE.north, [12, 7.5, 10], 'obsidian', '#3b3640', '#c8502a', 2301, { ref: 'flame-observatory' }),
  house([470, 46], FACE.south, [9, 5.8, 8], 'obsidian', '#4a4248', '#a8452a', 2302),
  house([520, 44], FACE.south, [9, 6.2, 8], 'obsidian', '#3f3a3e', '#d0662e', 2303),
  house([560, 42], FACE.south, [8, 5.4, 7], 'obsidian', '#4a4248', '#b85a30', 2304),
  house([640, 30], FACE.south, [9, 5.8, 8], 'obsidian', '#3b3640', '#a8452a', 2305),
  house([580, 70], FACE.north, [9, 6, 8], 'obsidian', '#453f44', '#c8502a', 2306),
  house([460, 80], FACE.north, [8, 5.4, 7], 'obsidian', '#3f3a3e', '#d0662e', 2307),
  // 玄武岩柱 + 喷气口（镇东）
  { type: 'basalt', position: [668, 70], yaw: 0, size: [6, 7, 6], seed: 2311 },
  { type: 'basalt', position: [676, 30], yaw: 1, size: [5, 9, 5], seed: 2312 },
  { type: 'basalt', position: [440, 30], yaw: 2, size: [4, 5, 4], seed: 2313 },
  { type: 'lava-vent', position: [660, 0], yaw: 0, size: [4, 1, 4], seed: 2314 },
  { type: 'lava-vent', position: [690, 50], yaw: 0, size: [3, 1, 3], seed: 2315 },
  { type: 'lava-vent', position: [600, -40], yaw: 0, size: [3.4, 1, 3.4], seed: 2316 },
  { type: 'statue', position: [520, 60], yaw: FACE.south, size: [1.8, 4.6, 1.8], color: '#3b3640' },
  { type: 'sign', ref: 'gym-flame-sign', position: [592, 40], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', position: [552, 60], yaw: FACE.south, size: [2, 2.2, 0.3] },
  ...stoneLanterns([[480, 66], [510, 64], [560, 60], [590, 58], [620, 56], [640, 54]], 2.0),
  ...crates([[455, 56], [456.2, 57.2], [612, 76]]),
  ...barrels([[630, 76], [631, 77.2]], '#5a3a2a'),
  ...ores([[674, 90, 2.6], [450, 96, 2]], 2320),
  ...trees([[470, 20, 5, 'shrub'], [640, 110, 6, 'pine'], [500, 104, 5, 'shrub']], 2330),
];

export const FLAME_TOWN: TownLayout = {
  id: 'flame-town',
  zone: 'flame-town',
  paths: [
    { id: 'town-flame-gym-walk', surface: 'stone', width: 6, points: [[600, 56], [600, 36]] },
    { id: 'town-flame-observatory-walk', surface: 'stone', width: 4, points: [[620, 54], [626, 98]] },
    { id: 'town-flame-south-gate', surface: 'dirt', width: 5, points: [[515, 62], [518, 110], [540, 160]] },
    { id: 'town-flame-cave-gate', surface: 'dirt', width: 4, points: [[630, 54], [620, -20]] },
    { id: 'town-flame-crater-gate', surface: 'dirt', width: 3, points: [[572, 58], [580, -46]] },
  ],
  pads: [
    { position: [551, 58], size: [210, 40], yaw: -0.07, blend: 12 },
    { position: [600, 20], size: [34, 34], blend: 8 },
  ],
  props: flameTown,
};

// ———————————————————————— 温泉乡 ————————————————————————
const springTown: PropInstance[] = [
  atDoor('pokecenter', [372, 498], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-spring', color: '#fbf5ee', roof: '#e25a4f' }),
  house([340, 548], FACE.north, [14, 7, 10], 'onsen', '#efe3c6', '#4a5a6a', 2401, { ref: 'spring-breeder', accent: '#e07a8a' }),
  house([410, 600], FACE.north, [18, 8, 12], 'onsen', '#f2e6d0', '#3f4a5a', 2402, { ref: 'spring-inn', accent: '#3f6db5' }),
  house([330, 494], FACE.south, [9, 6, 8], 'onsen', '#efe2c8', '#5a4a3a', 2403, { accent: '#c8503c' }),
  house([400, 502], FACE.south, [9, 6, 8], 'onsen', '#f4ead7', '#4a5a6a', 2404, { accent: '#5b8a5a' }),
  house([470, 524], FACE.south, [9, 6.4, 8], 'onsen', '#efe3c6', '#5a4a3a', 2405, { accent: '#e0a13a' }),
  house([500, 572], FACE.north, [9, 6, 8], 'onsen', '#f2e6d0', '#3f4a5a', 2406, { accent: '#c85d7c' }),
  // 露天温泉（主池 + 上游小池）
  { type: 'spring-rim', position: [452, 566], yaw: 0, size: [30, 0.6, 22], y: 7.6, seed: 2411 },
  { type: 'spring-rim', position: [494, 598], yaw: 0, size: [16, 0.6, 12], y: 8.4, seed: 2412 },
  { type: 'bamboo-fence', position: [452, 580], yaw: 0, size: [32, 2.2, 0.3] },
  { type: 'bamboo-fence', position: [436, 566], yaw: FACE.east, size: [24, 2.2, 0.3] },
  { type: 'sign', ref: 'hot-spring-sign', position: [452, 548], yaw: FACE.north, size: [1.6, 1.6, 0.2] },
  // 牌坊（西入口）
  { type: 'pailou', position: [306, 500], yaw: FACE.east, size: [9, 7, 1], color: '#c8402e' },
  ...stoneLanterns([[322, 506], [350, 512], [384, 518], [420, 526], [454, 536], [486, 546], [526, 566]]),
  { type: 'bench', position: [440, 548], yaw: FACE.south, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [466, 548], yaw: FACE.south, size: [1.8, 0.9, 0.6] },
  prop('garden', [320, 560], [7, 0.4, 6], { variant: 'flower', seed: 2421 }),
  fence([[314, 556], [314, 566], [326, 566]]),
  { type: 'laundry', position: [384, 580], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 2422 },
  { type: 'noticeboard', position: [360, 504], yaw: FACE.south, size: [2, 2.2, 0.3] },
  ...trees(
    [
      [300, 470, 8, 'blossom'], [314, 530, 7, 'blossom'], [390, 470, 9, 'pine'], [440, 500, 7, 'blossom'], [520, 520, 8, 'pine'],
      [480, 620, 7, 'blossom'], [430, 640, 9, 'pine'], [360, 620, 8], [540, 600, 7, 'blossom'], [470, 590, 4.5, 'shrub'],
    ],
    2430,
  ),
  // 码头（南岸）
  deck([566, 672], 6, 40, 1.6, 'ew', [['n', 0, 6]]),
  { type: 'boat', ref: 'spring-ferry', position: [576, 690], yaw: 0, size: [6, 4.5, 16], y: 0, color: '#f5f5f0', roof: '#c8402e', collide: true },
  { type: 'bollard', position: [563, 688], yaw: 0, size: [0.4, 0.7, 0.4], y: 1.6 },
  { type: 'bollard', position: [569, 688], yaw: 0, size: [0.4, 0.7, 0.4], y: 1.6 },
  ...stoneLanterns([[560, 646], [572, 646]], 1.6),
];

export const SPRING_VILLAGE: TownLayout = {
  id: 'spring-village',
  zone: 'spring-village',
  paths: [
    { id: 'town-spring-north-gate', surface: 'dirt', width: 5, points: [[420, 470], [420, 522]] },
    { id: 'town-spring-inn-walk', surface: 'stone', width: 4, points: [[410, 524], [410, 600]] },
    { id: 'town-spring-pool-walk', surface: 'stone', width: 4, points: [[452, 534], [452, 552]] },
    { id: 'town-spring-breeder-walk', surface: 'stone', width: 3, points: [[340, 514], [340, 548]] },
    { id: 'town-spring-dock-walk', surface: 'stone', width: 4, points: [[540, 560], [566, 600], [566, 652]] },
  ],
  pads: [
    { position: [370, 510], size: [130, 34], yaw: 0.18, blend: 10 },
    { position: [470, 540], size: [140, 30], yaw: 0.32, blend: 10 },
  ],
  props: springTown,
};

export const TIDE_TOWNS: TownLayout[] = [TIDE_TOWN, ORE_TOWN, FLAME_TOWN, SPRING_VILLAGE];

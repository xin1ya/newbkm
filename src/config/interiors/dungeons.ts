/**
 * M3-23 · 洞窟 / 塔场景：
 * - 晶石洞窟（雷鸣 · 雷暴高原东北缘）：入口洞厅 → 晶石回廊（怪力推石压住两块压力板，晶石栅栏才会沉下）→ 晶洞深处
 * - 古灯塔（雷鸣 · 古灯塔岬）：一层 → 二层（漆黑，闪光；落石堵住楼梯，碎岩）→ 三层 → 灯室
 * - 冰川遗迹（雷鸣 · 冰川雪原）：冰封前厅（冰块挡住侧室，碎岩）→ 石碑之间（推石填平冰裂缝）→ 冰封圣坛
 * - 暗影洞窟（琉璃 · 冠军山西侧绝壁脚下，高等级）：洞口 → 暗影迷廊（漆黑；怪力巨石 / 碎岩落石）→ 深渊大厅
 *
 * 各房间散落「裂纹小岩」（smashRocks）：有「碎岩」可以撞碎，掉道具或跳出野生宝可梦，离开房间后复原。
 * 推石谜题都由 tests/unit/dungeons.test.ts 用 BFS 证明可解。
 * 圣坛 / 灯室 / 晶核 / 暗影祭坛是第三、四章主线与支线（M3-24/25/26/27）的剧情锚点，这里只放可调查的场景物件。
 */
import type { BoulderPuzzleConfig } from '@/systems/puzzles/boulders';
import type { SmashLootEntry } from '@/systems/field/rockSmash';
import type { FurnitureConfig, InteriorConfig } from './types';

const PI = Math.PI;
const FLASH = 'field-flash';
const STRENGTH = 'hm06-strength';
const ROCK_SMASH = 'hm05-rock-smash';

function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** 沿洞壁（-X / +X / -Z 三面）的确定性碎石与晶簇，避开 avoid 圆 */
function wallDressing(w: number, d: number, n: number, seed: number, rock: string, crystal: string | null, avoid: Array<[number, number, number]> = []): FurnitureConfig[] {
  const rnd = rng(seed);
  const out: FurnitureConfig[] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const side = Math.floor(rnd() * 3);
    const t = rnd() * 2 - 1;
    const x = side < 2 ? (side === 0 ? -1 : 1) * (w / 2 - 0.8 - rnd() * 0.7) : t * (w / 2 - 1.4);
    const z = side === 2 ? -(d / 2 - 0.8 - rnd() * 0.7) : t * (d / 2 - 1.6);
    if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    const big = rnd();
    if (crystal && rnd() < 0.4) out.push({ type: 'crystal', position: [x, z], size: [0.4 + big * 0.5, 0.8 + big * 1.4, 0.4 + big * 0.5], color: crystal });
    else out.push({ type: 'boulder', position: [x, z], size: [0.8 + big * 1.1, 0.5 + big * 0.8, 0.7 + big * 0.9], color: rock });
  }
  return out;
}

// ———————————————— 掉落表 ————————————————
const CRYSTAL_LOOT: SmashLootEntry[] = [
  { item: 'gravel', weight: 40, qty: [1, 3] },
  { item: 'hard-ore', weight: 22 },
  { item: 'thunder-stone', weight: 8 },
  { item: 'hard-stone', weight: 8 },
  { item: 'magnet', weight: 3 },
  { item: 'pearl', weight: 6 },
];
const ICE_LOOT: SmashLootEntry[] = [
  { item: 'gravel', weight: 36, qty: [1, 2] },
  { item: 'hard-ore', weight: 20 },
  { item: 'never-melt-ice', weight: 5 },
  { item: 'water-stone', weight: 8 },
  { item: 'ice-heal', weight: 14 },
  { item: 'pearl', weight: 6 },
];
const TOWER_LOOT: SmashLootEntry[] = [
  { item: 'gravel', weight: 40, qty: [1, 2] },
  { item: 'hard-ore', weight: 14 },
  { item: 'super-potion', weight: 16 },
  { item: 'spell-tag', weight: 3 },
  { item: 'pearl', weight: 10 },
];
const SHADOW_LOOT: SmashLootEntry[] = [
  { item: 'gravel', weight: 32, qty: [1, 3] },
  { item: 'hard-ore', weight: 22 },
  { item: 'black-glasses', weight: 3 },
  { item: 'spell-tag', weight: 3 },
  { item: 'revive', weight: 8 },
  { item: 'dusk-ball', weight: 10 },
  { item: 'fire-stone', weight: 4 },
  { item: 'leaf-stone', weight: 4 },
];

// ———————————————— 晶石回廊：压力板推石（最少 10 推） ————————————————
const GALLERY_ROW: [number, number][] = [];
for (let c = 0; c < 12; c++) if (c !== 5 && c !== 6) GALLERY_ROW.push([c, 3]);

export const CRYSTAL_GALLERY_PUZZLE: BoulderPuzzleConfig = {
  id: 'crystal-gallery',
  origin: [-12, -12],
  cell: 2,
  cols: 12,
  rows: 12,
  walls: [...GALLERY_ROW, [4, 6], [4, 7], [7, 5], [10, 8], [1, 10], [8, 10], [2, 5], [6, 7]],
  holes: [],
  plates: [
    [1, 6],
    [10, 4],
  ],
  gate: [
    [5, 3],
    [6, 3],
  ],
  boulders: [
    [3, 8],
    [8, 8],
    [5, 9],
  ],
  start: [6, 11],
  goal: [6, 1],
};

// ———————————————— 石碑之间：推石填平冰裂缝（最少 12 推） ————————————————
const CREVASSE: [number, number][] = [];
for (let c = 0; c < 12; c++) for (const r of [4, 5]) if (c !== 8) CREVASSE.push([c, r]);

export const GLACIER_TABLET_PUZZLE: BoulderPuzzleConfig = {
  id: 'glacier-tablets',
  origin: [-12, -12],
  cell: 2,
  cols: 12,
  rows: 12,
  walls: [
    [7, 7],
    [9, 7],
    [6, 9],
    [10, 10],
    [3, 9],
    [4, 7],
    [11, 8],
  ],
  chasm: CREVASSE,
  holes: [
    [8, 5],
    [8, 4],
  ],
  boulders: [
    [5, 8],
    [9, 9],
    [3, 8],
  ],
  start: [5, 11],
  goal: [5, 1],
};

const CAVE_ROCK = '#5e5a66';
const CAVE_DARK = '#3e3a46';
const CRYSTAL_BLUE = '#8fd0ff';
const CRYSTAL_VIOLET = '#c8a8ff';
const ICE = '#cfeeff';
const ICE_DEEP = '#8cc4e8';
const SHADOW_ROCK = '#3a3442';

// =====================================================================================
// 晶石洞窟
// =====================================================================================
export const CRYSTAL_CAVE_INTERIOR: InteriorConfig = {
  id: 'crystal-cave',
  name: '晶石洞窟',
  entryRoom: 'entrance',
  entryExit: 'front',
  bgm: 'cave',
  rooms: [
    {
      id: 'entrance',
      name: '晶石洞窟 · 入口洞厅',
      size: [24, 22, 8],
      floor: { color: '#6a6474', pattern: 'rock', accent: '#58525f' },
      wall: { color: CAVE_ROCK, trim: CAVE_DARK },
      lighting: 'cave',
      encounters: { table: 'crystal-cave', ratePerMeter: 0.045 },
      cameraDistance: 12,
      furniture: [
        ...wallDressing(24, 22, 14, 4101, CAVE_ROCK, CRYSTAL_BLUE, [
          [0, 10, 3.5],
          [0, -10, 3.5],
          [-9.6, -8.6, 2],
          [10.6, 6, 2],
        ]),
        { type: 'crystal', position: [-4.5, -2], size: [1.2, 3.2, 1.2], color: CRYSTAL_BLUE },
        { type: 'crystal', position: [-3.6, -1.2], size: [0.6, 1.6, 0.6], color: CRYSTAL_BLUE },
        { type: 'crystal', position: [5.2, 2.6], size: [1.0, 2.6, 1.0], color: CRYSTAL_VIOLET },
        { type: 'crystal', position: [6.0, 3.4], size: [0.5, 1.2, 0.5], color: CRYSTAL_VIOLET },
        { type: 'stalagmite', position: [-7.4, 4.6], size: [1.1, 2.6, 1.1], color: '#7a7484' },
        { type: 'stalagmite', position: [7.6, -5.2], size: [1.2, 3.2, 1.2], color: '#7a7484' },
        { type: 'torch', position: [-2.2, 9.4], color: '#9ad8ff' },
        { type: 'torch', position: [2.2, 9.4], color: '#9ad8ff' },
        { type: 'crate', position: [-9.6, -8.6], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'cc-crate-entrance' },
        { type: 'poster', position: [-11.96, 6], yaw: PI / 2, size: [1.2, 0.9, 0.02], color: '#c8b48a', accent: '#3a2a1a', interact: 'cc-sign-entrance' },
      ],
      smashRocks: {
        rocks: [
          [-8.6, 0.4],
          [3.2, -6.4],
          [9.0, 1.0],
          [-2.4, 5.6],
        ],
        loot: CRYSTAL_LOOT,
      },
      exits: [
        { id: 'front', position: [0, 10.65], radius: 0.95, spawnOffset: [0, -1.5], spawnYaw: PI, to: { overworld: true }, label: '出口' },
        { id: 'north', position: [0, -10.2], radius: 1.1, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'gallery', exit: 'south' }, label: '晶石回廊' },
      ],
      npcs: [
        { id: 'cc-miner', position: [-6.2, 7.0], yaw: PI / 2 },
        { id: 'cc-trainer-hiker', position: [4.0, -3.2], yaw: -PI / 2 },
      ],
    },
    {
      id: 'gallery',
      name: '晶石洞窟 · 晶石回廊',
      size: [28, 28, 9],
      floor: { color: '#605a6c', pattern: 'rock', accent: '#4e4858' },
      wall: { color: CAVE_ROCK, trim: CAVE_DARK },
      lighting: 'cave',
      encounters: { table: 'crystal-cave', ratePerMeter: 0.03 },
      cameraDistance: 14,
      boulders: CRYSTAL_GALLERY_PUZZLE,
      furniture: [
        // 晶石墙两端与洞壁之间的缝（谜题方格外 2 m）用晶簇岩壁封死
        { type: 'cliffwall', position: [-13, -5], size: [2.0, 6, 2.2], color: CAVE_DARK },
        { type: 'cliffwall', position: [13, -5], size: [2.0, 6, 2.2], color: CAVE_DARK },
        { type: 'crystal', position: [-13, -3.4], size: [0.6, 1.8, 0.6], color: CRYSTAL_BLUE },
        { type: 'crystal', position: [13, -3.4], size: [0.6, 1.8, 0.6], color: CRYSTAL_BLUE },
        { type: 'crystal', position: [-13.2, 8], size: [0.8, 2.2, 0.8], color: CRYSTAL_VIOLET },
        { type: 'crystal', position: [13.2, 10], size: [0.7, 1.6, 0.7], color: CRYSTAL_BLUE },
        { type: 'crystal', position: [-13.2, -11], size: [0.7, 2.0, 0.7], color: CRYSTAL_BLUE },
        { type: 'crystal', position: [13.2, -11.6], size: [0.9, 2.6, 0.9], color: CRYSTAL_VIOLET },
        { type: 'torch', position: [-13.4, 2], color: '#9ad8ff' },
        { type: 'torch', position: [13.4, 2], color: '#9ad8ff' },
        { type: 'poster', position: [-13.96, 11], yaw: PI / 2, size: [1.0, 0.8, 0.02], color: '#8a7e90', accent: '#2a2a3a', interact: 'cc-plate-sign' },
      ],
      exits: [
        { id: 'south', position: [1, 13.2], radius: 1.0, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'entrance', exit: 'north' }, label: '回到入口洞厅' },
        { id: 'north', position: [1, -13.2], radius: 1.0, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'geode', exit: 'south' }, label: '晶洞深处' },
      ],
    },
    {
      id: 'geode',
      name: '晶石洞窟 · 晶洞深处',
      size: [22, 20, 10],
      floor: { color: '#5a5268', pattern: 'rock', accent: '#4a4258' },
      wall: { color: '#4e4860', trim: '#2e2a3a' },
      lighting: 'cave',
      encounters: { table: 'crystal-cave-deep', ratePerMeter: 0.04 },
      cameraDistance: 12,
      furniture: [
        ...wallDressing(22, 20, 16, 4303, '#4e4860', CRYSTAL_VIOLET, [
          [0, 9, 3.5],
          [0, -6, 4.5],
          [8.6, -7.4, 2],
        ]),
        // 中央巨型晶簇（晶核）
        { type: 'crystal', position: [0, -6], size: [2.2, 5.6, 2.2], color: CRYSTAL_BLUE, interact: 'cc-crystal-core' },
        { type: 'crystal', position: [-1.6, -5.2], size: [1.0, 3.0, 1.0], color: CRYSTAL_VIOLET },
        { type: 'crystal', position: [1.7, -5.0], size: [0.9, 2.6, 0.9], color: CRYSTAL_VIOLET },
        { type: 'crystal', position: [0.4, -4.2], size: [0.5, 1.4, 0.5], color: CRYSTAL_BLUE },
        { type: 'rug', position: [0, -2.6], size: [3.2, 0.02, 1.6], color: '#4a6aa8', accent: '#9ad8ff', noCollide: true },
        { type: 'machine', position: [-7.4, 3.6], yaw: PI / 2, size: [1.6, 1.4, 0.9], color: '#8a96a4', accent: '#9ad8ff', interact: 'cc-survey-machine' },
        { type: 'crate', position: [8.6, -7.4], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'cc-crate-geode' },
      ],
      smashRocks: {
        rocks: [
          [-6.8, -3.4],
          [6.4, 2.8],
          [-3.0, 5.6],
        ],
        loot: CRYSTAL_LOOT,
        wildChance: 0.25,
      },
      exits: [{ id: 'south', position: [0, 8.9], radius: 1.0, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'gallery', exit: 'north' }, label: '回到晶石回廊' }],
      npcs: [{ id: 'cc-trainer-researcher', position: [4.6, 0.6], yaw: -PI / 2 }],
    },
  ],
};

// =====================================================================================
// 古灯塔
// =====================================================================================
const TOWER_STONE = '#a49c8c';
const TOWER_DARK = '#6e665a';

export const OLD_LIGHTHOUSE_INTERIOR: InteriorConfig = {
  id: 'old-lighthouse',
  name: '古灯塔',
  entryRoom: '1f',
  entryExit: 'front',
  bgm: 'cave',
  rooms: [
    {
      id: '1f',
      name: '古灯塔 · 一层',
      size: [16, 16, 6],
      floor: { color: '#8a8070', pattern: 'plank', accent: '#6e6456' },
      wall: { color: TOWER_STONE, trim: TOWER_DARK, wainscot: '#7a7264' },
      lighting: 'cave',
      encounters: { table: 'old-lighthouse', ratePerMeter: 0.03 },
      cameraDistance: 11,
      furniture: [
        { type: 'desk', position: [-5.4, -6.2], size: [2.0, 0.8, 0.9], color: '#6e5038', interact: 'lh-keeper-log' },
        { type: 'chair', position: [-5.4, -5.2], yaw: PI, color: '#6e5038' },
        { type: 'bookshelf', position: [-2.4, -7.5], size: [2.2, 2.4, 0.5], color: '#5e4430' },
        { type: 'barrel', position: [6.6, 6.0] },
        { type: 'barrel', position: [6.6, 4.9] },
        { type: 'crate', position: [5.4, 6.4], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'lh-crate-1f' },
        { type: 'crate', position: [-6.6, 6.2], size: [1.0, 0.9, 1.0], color: '#7a5030' },
        { type: 'window', position: [-7.96, -1], yaw: PI / 2, size: [1.0, 1.4, 0.05] },
        { type: 'window', position: [7.96, -1], yaw: -PI / 2, size: [1.0, 1.4, 0.05], interact: 'lh-window' },
        { type: 'lamp', position: [-6.8, -3.4], color: '#ffd9a0' },
        { type: 'rug', position: [0, 2.6], size: [3.0, 0.02, 4.0], color: '#7a3a2a', accent: '#d8b070', noCollide: true },
        { type: 'boulder', position: [2.6, -2.4], size: [1.2, 0.6, 1.0], color: TOWER_DARK },
      ],
      smashRocks: { rocks: [[-3.6, 3.4]], loot: TOWER_LOOT, wildChance: 0.15 },
      exits: [
        { id: 'front', position: [0, 7.65], radius: 0.9, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出口' },
        { id: 'stairs-up', position: [5.6, -5.6], radius: 0.9, spawnOffset: [-1.4, 0], spawnYaw: -PI / 2, to: { room: '2f', exit: 'stairs-down' }, label: '上楼' },
      ],
      npcs: [{ id: 'lh-repairman', position: [-2.2, 1.6], yaw: PI / 4 }],
    },
    {
      id: '2f',
      name: '古灯塔 · 二层',
      size: [16, 16, 6],
      floor: { color: '#7a7264', pattern: 'plank', accent: '#5e584c' },
      wall: { color: '#948c7c', trim: TOWER_DARK },
      lighting: 'cave',
      encounters: { table: 'old-lighthouse', ratePerMeter: 0.045 },
      dark: { flag: FLASH, hint: '窗户全被木板钉死了，伸手不见五指……楼板吱呀作响。需要「闪光」照亮四周。' },
      cameraDistance: 11,
      furniture: [
        // 楼梯角落：东侧用旧书架隔开，北侧被塌落的石块堵住
        { type: 'shelf', position: [-3.4, -6.8], yaw: PI / 2, size: [2.4, 2.0, 0.5], color: '#5e4430' },
        { type: 'poster', position: [0, -7.96], size: [2.4, 1.4, 0.02], color: '#5a6a7a', accent: '#d8d0b8', interact: 'lh-mural-2f' },
        { type: 'crate', position: [6.8, 6.6], size: [0.9, 0.8, 0.9], color: '#7a5030' },
        { type: 'barrel', position: [-6.8, 6.4] },
        { type: 'boulder', position: [-1.8, 3.6], size: [1.0, 0.5, 0.9], color: TOWER_DARK },
        { type: 'boulder', position: [2.8, -1.4], size: [0.8, 0.4, 0.8], color: TOWER_DARK },
      ],
      blockers: [
        { id: 'lh-stair-rubble', type: 'rock-smash', requiresFlag: ROCK_SMASH, position: [-5.8, -4.8], size: [4.4, 1.6, 1.6], hint: '塌下来的石块堵住了上楼的楼梯……似乎能用「碎岩」撞开。' },
      ],
      smashRocks: { rocks: [[3.4, 4.2], [-5.6, 0.6]], loot: TOWER_LOOT },
      exits: [
        { id: 'stairs-down', position: [5.6, -5.6], radius: 0.9, spawnOffset: [-1.4, 0], spawnYaw: -PI / 2, to: { room: '1f', exit: 'stairs-up' }, label: '下楼' },
        { id: 'stairs-up', position: [-6.0, -6.6], radius: 0.9, spawnOffset: [1.4, 0], spawnYaw: PI / 2, to: { room: '3f', exit: 'stairs-down' }, label: '上楼' },
      ],
      npcs: [
        { id: 'lh-trainer-channeler-1', position: [1.6, 1.2], yaw: PI / 2 },
        { id: 'lh-trainer-sailor', position: [-2.6, -2.2], yaw: 0 },
      ],
    },
    {
      id: '3f',
      name: '古灯塔 · 三层',
      size: [14, 14, 6],
      floor: { color: '#827a6a', pattern: 'plank', accent: '#625a4e' },
      wall: { color: TOWER_STONE, trim: TOWER_DARK },
      lighting: 'cave',
      encounters: { table: 'old-lighthouse', ratePerMeter: 0.04 },
      cameraDistance: 10,
      furniture: [
        { type: 'machine', position: [4.6, -5.6], size: [1.8, 1.6, 0.9], color: '#6a7480', accent: '#c8b070', interact: 'lh-gearbox' },
        { type: 'window', position: [-6.96, 0], yaw: PI / 2, size: [1.0, 1.4, 0.05] },
        { type: 'window', position: [6.96, 1], yaw: -PI / 2, size: [1.0, 1.4, 0.05] },
        { type: 'crate', position: [5.6, 5.4], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'lh-crate-3f' },
        { type: 'barrel', position: [-5.6, 5.4] },
        { type: 'lamp', position: [-5.6, -1.6], color: '#ffd9a0' },
      ],
      smashRocks: { rocks: [[2.4, 3.0]], loot: TOWER_LOOT },
      exits: [
        { id: 'stairs-down', position: [-4.6, -5.4], radius: 0.9, spawnOffset: [1.4, 0], spawnYaw: PI / 2, to: { room: '2f', exit: 'stairs-up' }, label: '下楼' },
        { id: 'stairs-up', position: [0, -5.6], radius: 0.9, spawnOffset: [0, 1.4], spawnYaw: 0, to: { room: 'lamp', exit: 'stairs-down' }, label: '上到灯室' },
      ],
      npcs: [{ id: 'lh-trainer-channeler-2', position: [-1.6, 1.0], yaw: PI / 2 }],
    },
    {
      id: 'lamp',
      name: '古灯塔 · 灯室',
      size: [12, 12, 7],
      floor: { color: '#6a7078', pattern: 'checker', accent: '#4a5058' },
      wall: { color: '#c8c0b0', trim: '#3a3f4a' },
      lighting: 'cave',
      cameraDistance: 9,
      furniture: [
        // 熄灭的大透镜（灯芯台 + 菲涅耳透镜）
        { type: 'dais', position: [0, -1.6], size: [3.0, 0.4, 3.0], color: '#3a3f4a' },
        { type: 'crystal', position: [0, -1.6], size: [1.4, 2.4, 1.4], color: '#e8e0b0', interact: 'lh-lamp' },
        { type: 'window', position: [-5.96, -1], yaw: PI / 2, size: [1.6, 2.2, 0.05] },
        { type: 'window', position: [5.96, -1], yaw: -PI / 2, size: [1.6, 2.2, 0.05] },
        { type: 'window', position: [-2, -5.96], size: [1.6, 2.2, 0.05] },
        { type: 'window', position: [2, -5.96], size: [1.6, 2.2, 0.05] },
        { type: 'crate', position: [4.4, 4.0], size: [0.8, 0.7, 0.8], color: '#7a5030' },
      ],
      exits: [{ id: 'stairs-down', position: [-3.6, 3.6], radius: 0.9, spawnOffset: [1.4, 0], spawnYaw: PI / 2, to: { room: '3f', exit: 'stairs-up' }, label: '下楼' }],
    },
  ],
};

// =====================================================================================
// 冰川遗迹
// =====================================================================================
export const GLACIER_RUINS_INTERIOR: InteriorConfig = {
  id: 'glacier-ruins',
  name: '冰川遗迹',
  entryRoom: 'hall',
  entryExit: 'front',
  bgm: 'cave',
  rooms: [
    {
      id: 'hall',
      name: '冰川遗迹 · 冰封前厅',
      size: [24, 20, 8],
      floor: { color: '#c4dcea', pattern: 'tile', accent: '#a4c4d8' },
      wall: { color: '#9ab8cc', trim: '#5a7a94', relief: 'wave', reliefColor: '#cfe6f4' },
      lighting: 'cave',
      encounters: { table: 'glacier-ruins', ratePerMeter: 0.04 },
      cameraDistance: 12,
      furniture: [
        ...wallDressing(24, 20, 12, 5101, '#a8c4d8', ICE, [
          [0, 9, 3.5],
          [0, -9, 3.5],
          [8.8, -6.4, 4.2],
        ]),
        { type: 'column', position: [-4.5, 3], size: [1.0, 7.6, 1.0], color: '#b8ccd8' },
        { type: 'column', position: [4.5, 3], size: [1.0, 7.6, 1.0], color: '#b8ccd8' },
        { type: 'column', position: [-4.5, -4], size: [1.0, 7.6, 1.0], color: '#b8ccd8' },
        { type: 'column', position: [4.5, -4], size: [1.0, 7.6, 1.0], color: '#b8ccd8' },
        { type: 'crystal', position: [-9.6, 2], size: [1.2, 2.8, 1.2], color: ICE_DEEP },
        { type: 'crystal', position: [-9.0, -5], size: [0.8, 1.8, 0.8], color: ICE },
        // 侧室（东北角）：冰块堵住，里面有补给箱
        { type: 'cliffwall', position: [6.6, -6.4], yaw: PI / 2, size: [7.2, 6, 0.8], color: '#9ab8cc' },
        { type: 'crate', position: [10.4, -8.4], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'gr-crate-ice' },
        { type: 'poster', position: [-11.96, 6], yaw: PI / 2, size: [1.2, 0.9, 0.02], color: '#d8e8f0', accent: '#3a4a5a', interact: 'gr-sign-hall' },
      ],
      blockers: [
        { id: 'gr-ice-block', type: 'rock-smash', requiresFlag: ROCK_SMASH, position: [9.5, -2.6], size: [5.0, 2.2, 1.6], hint: '厚厚的冰块封住了侧室的入口……用「碎岩」或许能撞碎。', color: '#bfe6ff' },
      ],
      smashRocks: {
        rocks: [
          [-7.2, 6.4],
          [1.6, -1.2],
          [-1.8, 6.0],
        ],
        loot: ICE_LOOT,
      },
      exits: [
        { id: 'front', position: [0, 9.65], radius: 0.95, spawnOffset: [0, -1.5], spawnYaw: PI, to: { overworld: true }, label: '出口' },
        { id: 'north', position: [0, -9.2], radius: 1.1, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'tablets', exit: 'south' }, label: '石碑之间' },
      ],
      npcs: [
        { id: 'gr-scholar', position: [-6.4, -1.4], yaw: PI / 2 },
        { id: 'gr-trainer-hiker', position: [2.6, 4.6], yaw: -PI / 2 },
      ],
    },
    {
      id: 'tablets',
      name: '冰川遗迹 · 石碑之间',
      size: [26, 26, 9],
      floor: { color: '#b8d4e4', pattern: 'tile', accent: '#98b8cc' },
      wall: { color: '#8eaec4', trim: '#4e6e88', relief: 'wave', reliefColor: '#c4dcec' },
      lighting: 'cave',
      encounters: { table: 'glacier-ruins', ratePerMeter: 0.03 },
      cameraDistance: 14,
      boulders: { ...GLACIER_TABLET_PUZZLE },
      furniture: [
        // 冰裂缝两端贴墙的冰壁（谜题方格外 1 m）
        { type: 'cliffwall', position: [-12.5, -2], yaw: PI / 2, size: [4.2, 6, 1.0], color: '#8eaec4' },
        { type: 'cliffwall', position: [12.5, -2], yaw: -PI / 2, size: [4.2, 6, 1.0], color: '#8eaec4' },
        // 三块古代石碑（北侧，裂缝之后）
        { type: 'emblem', position: [-6, -12.96], size: [1.6, 2.2, 0.1], y: 2.2, color: '#a0b4c0', accent: '#5a7a94', interact: 'gr-tablet-1' },
        { type: 'emblem', position: [3, -12.96], size: [1.6, 2.2, 0.1], y: 2.2, color: '#a0b4c0', accent: '#5a7a94', interact: 'gr-tablet-2' },
        { type: 'emblem', position: [9, -12.96], size: [1.6, 2.2, 0.1], y: 2.2, color: '#a0b4c0', accent: '#5a7a94', interact: 'gr-tablet-3' },
        { type: 'poster', position: [-12.96, 10], yaw: PI / 2, size: [1.0, 0.8, 0.02], color: '#d8e8f0', accent: '#3a4a5a', interact: 'gr-boulder-sign' },
        { type: 'crystal', position: [12.6, 11.6], size: [0.6, 1.6, 0.6], color: ICE },
        { type: 'crystal', position: [-12.6, -11.4], size: [0.7, 2.0, 0.7], color: ICE_DEEP },
      ],
      exits: [
        { id: 'south', position: [-1, 12.2], radius: 1.0, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'hall', exit: 'north' }, label: '回到冰封前厅' },
        { id: 'north', position: [-1, -12.2], radius: 1.0, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'sanctum', exit: 'south' }, label: '冰封圣坛' },
      ],
    },
    {
      id: 'sanctum',
      name: '冰川遗迹 · 冰封圣坛',
      size: [20, 18, 10],
      floor: { color: '#d0e4f0', pattern: 'checker', accent: '#a8c8dc' },
      wall: { color: '#a4c0d4', trim: '#4e6e88', relief: 'wave', reliefColor: '#d8ecf8' },
      lighting: 'cave',
      encounters: { table: 'glacier-ruins-deep', ratePerMeter: 0.03 },
      cameraDistance: 12,
      furniture: [
        { type: 'dais', position: [0, -5], size: [5.0, 0.6, 3.4], color: '#b0c8d8' },
        { type: 'crystal', position: [0, -5.4], size: [1.6, 3.6, 1.6], color: ICE_DEEP, interact: 'gr-altar' },
        { type: 'column', position: [-4.4, -5.6], size: [0.9, 8.4, 0.9], color: '#c0d4e0' },
        { type: 'column', position: [4.4, -5.6], size: [0.9, 8.4, 0.9], color: '#c0d4e0' },
        { type: 'column', position: [-6.6, 1.4], size: [0.9, 8.4, 0.9], color: '#c0d4e0' },
        { type: 'column', position: [6.6, 1.4], size: [0.9, 8.4, 0.9], color: '#c0d4e0' },
        { type: 'rug', position: [0, 1.4], size: [2.4, 0.02, 7.0], color: '#5a7a94', accent: '#d8ecf8', noCollide: true },
        { type: 'crystal', position: [-8.6, -7.4], size: [0.8, 2.2, 0.8], color: ICE },
        { type: 'crystal', position: [8.6, -7.0], size: [0.7, 1.8, 0.7], color: ICE },
        { type: 'crate', position: [-8.4, 6.6], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'gr-crate-sanctum' },
      ],
      smashRocks: { rocks: [[7.4, 5.6]], loot: ICE_LOOT },
      exits: [{ id: 'south', position: [0, 7.9], radius: 1.0, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'tablets', exit: 'north' }, label: '回到石碑之间' }],
      npcs: [{ id: 'gr-trainer-researcher', position: [3.2, 0.4], yaw: -PI / 2 }],
    },
  ],
};

// =====================================================================================
// 暗影洞窟
// =====================================================================================
export const SHADOW_CAVE_INTERIOR: InteriorConfig = {
  id: 'shadow-cave',
  name: '暗影洞窟',
  entryRoom: 'mouth',
  entryExit: 'front',
  bgm: 'cave',
  rooms: [
    {
      id: 'mouth',
      name: '暗影洞窟 · 洞口',
      size: [22, 20, 8],
      floor: { color: '#4a4452', pattern: 'rock', accent: '#3a3442' },
      wall: { color: SHADOW_ROCK, trim: '#221e28' },
      lighting: 'cave',
      encounters: { table: 'shadow-cave', ratePerMeter: 0.04 },
      cameraDistance: 12,
      furniture: [
        ...wallDressing(22, 20, 14, 6101, SHADOW_ROCK, '#7a5aa8', [
          [0, 9, 3.5],
          [0, -9, 3.5],
          [-8.6, -7.4, 2],
        ]),
        { type: 'stalagmite', position: [-5, 1], size: [1.2, 3.4, 1.2], color: '#4e4858' },
        { type: 'stalagmite', position: [5.6, -2.4], size: [1.4, 4.0, 1.4], color: '#4e4858' },
        { type: 'torch', position: [-2.2, 8.4], color: '#b890ff' },
        { type: 'torch', position: [2.2, 8.4], color: '#b890ff' },
        { type: 'poster', position: [-10.96, 5], yaw: PI / 2, size: [1.2, 0.9, 0.02], color: '#8a7e70', accent: '#2a1a2a', interact: 'sc-sign-mouth' },
        { type: 'crate', position: [-8.6, -7.4], size: [0.9, 0.8, 0.9], color: '#5a4030', interact: 'sc-crate-mouth' },
      ],
      smashRocks: { rocks: [[7.4, 4.6], [-6.8, 5.8]], loot: SHADOW_LOOT },
      exits: [
        { id: 'front', position: [0, 9.65], radius: 0.95, spawnOffset: [0, -1.5], spawnYaw: PI, to: { overworld: true }, label: '出口' },
        { id: 'north', position: [0, -9.2], radius: 1.1, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'maze', exit: 'south' }, label: '暗影迷廊' },
      ],
      npcs: [
        { id: 'sc-guide', position: [-3.2, 5.2], yaw: PI / 2 },
        { id: 'sc-trainer-ace', position: [3.0, -4.4], yaw: -PI / 2 },
      ],
    },
    {
      id: 'maze',
      name: '暗影洞窟 · 暗影迷廊',
      size: [30, 28, 9],
      floor: { color: '#423c4a', pattern: 'rock', accent: '#322c3a' },
      wall: { color: '#36303e', trim: '#1e1a24' },
      lighting: 'cave',
      encounters: { table: 'shadow-cave', ratePerMeter: 0.05 },
      dark: { flag: FLASH, hint: '浓得化不开的黑暗……隐约有什么东西在盯着你。需要「闪光」照亮四周。' },
      cameraDistance: 14,
      furniture: [
        // 迷廊隔墙：南北两道东西向岩壁，各留缺口（一个被怪力巨石堵住，一个被碎岩落石堵住）
        { type: 'cliffwall', position: [-9, 4], size: [12, 6, 1.2], color: '#2e2834' },
        { type: 'cliffwall', position: [7.5, 4], size: [15, 6, 1.2], color: '#2e2834' },
        { type: 'cliffwall', position: [-6.25, -5], size: [17.5, 6, 1.2], color: '#2e2834' },
        { type: 'cliffwall', position: [10.25, -5], size: [9.5, 6, 1.2], color: '#2e2834' },
        { type: 'stalagmite', position: [-10, 10], size: [1.2, 3.0, 1.2], color: '#4a4454' },
        { type: 'stalagmite', position: [11, 9], size: [1.0, 2.4, 1.0], color: '#4a4454' },
        { type: 'stalagmite', position: [-4, -10], size: [1.3, 3.6, 1.3], color: '#4a4454' },
        { type: 'crystal', position: [13.6, -12.4], size: [0.6, 1.6, 0.6], color: '#9a6ad8' },
        { type: 'crystal', position: [-13.6, -0.4], size: [0.5, 1.2, 0.5], color: '#9a6ad8' },
        { type: 'crate', position: [-13.4, -12.4], size: [0.9, 0.8, 0.9], color: '#5a4030', interact: 'sc-crate-maze' },
      ],
      blockers: [
        { id: 'sc-maze-boulder', type: 'strength', requiresFlag: STRENGTH, position: [-1.5, 4], size: [3.2, 2.6, 2.4], hint: '一块巨石堵住了岩壁的缺口……需要「怪力」才能推开。' },
        { id: 'sc-maze-rubble', type: 'rock-smash', requiresFlag: ROCK_SMASH, position: [4, -5], size: [3.2, 1.8, 1.8], hint: '碎石堆住了去路……用「碎岩」可以撞开。', color: '#5a5060' },
      ],
      smashRocks: {
        rocks: [
          [-8, 9],
          [8, 0],
          [-10, -1],
          [9.6, -10],
        ],
        loot: SHADOW_LOOT,
      },
      exits: [
        { id: 'south', position: [0, 13.2], radius: 1.0, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'mouth', exit: 'north' }, label: '回到洞口' },
        { id: 'down', position: [0, -12.6], radius: 1.0, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'abyss', exit: 'up' }, label: '下到深渊大厅' },
      ],
      npcs: [
        { id: 'sc-trainer-channeler', position: [-6, 0], yaw: PI / 2 },
        { id: 'sc-trainer-veteran', position: [6, 9], yaw: -PI / 2 },
      ],
    },
    {
      id: 'abyss',
      name: '暗影洞窟 · 深渊大厅',
      size: [26, 24, 12],
      floor: { color: '#3a3442', pattern: 'rock', accent: '#2a2432' },
      wall: { color: '#2e2834', trim: '#18141c' },
      lighting: 'abyss',
      encounters: { table: 'shadow-cave-deep', ratePerMeter: 0.045 },
      cameraDistance: 13,
      furniture: [
        ...wallDressing(26, 24, 14, 6303, '#2e2834', '#8a5ac8', [
          [0, 11, 3.5],
          [0, -8, 5],
          [10.6, -9.4, 2],
        ]),
        // 暗影祭坛：断裂的石环 + 紫色晶簇
        { type: 'dais', position: [0, -8], size: [5.6, 0.5, 4.0], color: '#3a3444' },
        { type: 'ruin', position: [-2.6, -8.8], size: [0.9, 3.2, 0.9], color: '#4a4454' },
        { type: 'ruin', position: [2.6, -8.8], size: [0.9, 2.2, 0.9], color: '#4a4454' },
        { type: 'crystal', position: [0, -8.6], size: [1.2, 2.6, 1.2], color: '#8a5ac8', interact: 'sc-shrine' },
        { type: 'torch', position: [-4.4, -6.2], color: '#b890ff' },
        { type: 'torch', position: [4.4, -6.2], color: '#b890ff' },
        { type: 'river', position: [-8.6, 2], size: [4.0, 0.3, 8], color: '#1a1830', accent: 'still' },
        { type: 'crate', position: [10.6, -9.4], size: [0.9, 0.8, 0.9], color: '#5a4030', interact: 'sc-crate-abyss' },
      ],
      smashRocks: { rocks: [[6.4, 3.6], [-3.6, 6.4]], loot: SHADOW_LOOT, wildChance: 0.25 },
      exits: [{ id: 'up', position: [0, 10.9], radius: 1.0, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'maze', exit: 'down' }, label: '回到暗影迷廊' }],
      npcs: [{ id: 'sc-trainer-hex', position: [4.0, -1.6], yaw: -PI / 2 }],
    },
  ],
};

export const DUNGEON_INTERIORS: InteriorConfig[] = [CRYSTAL_CAVE_INTERIOR, OLD_LIGHTHOUSE_INTERIOR, GLACIER_RUINS_INTERIOR, SHADOW_CAVE_INTERIOR];

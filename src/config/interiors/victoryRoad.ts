/**
 * M3-20 · 冠军之路（琉璃群岛，冠军山腹地）。
 *
 * 南口（大地图 POI victory-road-south）→ 南关所（徽章检查：11 枚徽章）→ 一层 · 石柱大厅（训练家）
 * → 巨石大厅（怪力推石：把巨石推进裂谷缺口的两个地洞，填平后才能过谷）
 * → 地下暗河（漆黑，需要「闪光」；石桥过河；攀瀑老人传授「攀瀑」；逆瀑而上）
 * → 二层 · 瀑上岩台（训练家；攀岩上崖）→ 山顶洞口（冠军之路通关，北口通往联盟高原 / 彩幽市）。
 *
 * 北口（victory-road-north）进来落在山顶洞口，可以反向走回去。
 * 联盟高原上空的乱流（islands/glaze.ts plateau-windwall）在 victory-road-cleared 后平息。
 */
import type { BoulderPuzzleConfig } from '@/systems/puzzles/boulders';
import type { FurnitureConfig, InteriorConfig } from './types';

const PI = Math.PI;

/** 冠军之路南关所的徽章检查：四座岛全部 11 枚徽章 */
export const VICTORY_ROAD_BADGES = [
  'badge-verdant',
  'badge-azure',
  'badge-ore',
  'badge-flame',
  'badge-thunder',
  'badge-dawn',
  'badge-snow',
  'badge-lark',
  'badge-mirage',
  'badge-ghost',
  'badge-glaze',
] as const;

export const VICTORY_ROAD_CLEARED = 'victory-road-cleared';
export const WATERFALL_FLAG = 'hm07-waterfall';
export const CLIMB_FLAG = 'hm08-rock-climb';

// ———————————————— 巨石大厅：推石谜题（tests/unit/victory-road.test.ts 求解验证，最少 13 推） ————————————————
const CHASM: [number, number][] = [];
for (let c = 0; c < 14; c++) for (const r of [4, 5]) if (c !== 10) CHASM.push([c, r]);

export const VR_BOULDERS: BoulderPuzzleConfig = {
  id: 'vr-boulder-hall',
  origin: [-14, -14],
  cell: 2,
  cols: 14,
  rows: 14,
  walls: [
    [9, 6],
    [11, 6],
    [9, 7],
    [12, 8],
    [13, 8],
    [4, 8],
    [5, 8],
    [6, 11],
    [7, 11],
    [8, 11],
    [2, 12],
    [3, 12],
    [11, 12],
    [12, 12],
    [9, 10],
  ],
  chasm: CHASM,
  holes: [
    [10, 5],
    [10, 4],
  ],
  boulders: [
    [7, 8],
    [11, 10],
    [3, 10],
  ],
  start: [0, 10],
  goal: [11, 1],
};

const ROCK = '#5c5249';
const ROCK_DARK = '#40382f';

/** 洞壁边缘随机碎石（确定性），避开 keep 半径内的中心通道 */
function rubble(w: number, d: number, n: number, seed: number, color: string, avoid: Array<[number, number, number]> = []): FurnitureConfig[] {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: FurnitureConfig[] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const side = Math.floor(rnd() * 4);
    const t = rnd() * 2 - 1;
    const x = side < 2 ? (side === 0 ? -1 : 1) * (w / 2 - 0.9 - rnd() * 0.8) : t * (w / 2 - 1.4);
    const z = side >= 2 ? (side === 2 ? -1 : 1) * (d / 2 - 0.9 - rnd() * 0.8) : t * (d / 2 - 1.4);
    if (side === 3) continue; // +Z 剖切墙一侧不放（挡镜头）
    if (avoid.some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r)) continue;
    const big = rnd();
    out.push({ type: 'boulder', position: [x, z], size: [0.9 + big * 1.2, 0.6 + big * 0.9, 0.8 + big], color: big > 0.6 ? color : ROCK_DARK });
  }
  return out;
}

export const VICTORY_ROAD_INTERIOR: InteriorConfig = {
  id: 'victory-road',
  name: '冠军之路',
  entryRoom: 'south-gate',
  entryExit: 'front',
  bgm: 'cave',
  rooms: [
    // ————————————————————————— 南关所（徽章检查） —————————————————————————
    {
      id: 'south-gate',
      name: '冠军之路 · 南关所',
      size: [18, 16, 6],
      floor: { color: '#c9c2b4', pattern: 'checker', accent: '#8a8274' },
      wall: { color: '#e4ddd0', trim: '#2a4a7a', wainscot: '#6a6a78' },
      lighting: 'center',
      bgm: 'pokecenter',
      furniture: [
        { type: 'rug', position: [0, 0.4], size: [3.0, 0.02, 12.4], color: '#2a4a7a', accent: '#e8c870' },
        { type: 'healer', position: [-5.6, -6.7], interact: 'healer' },
        { type: 'counter', position: [-5.6, -4.5], size: [3.2, 1.0, 0.7], color: '#e8e2d8', accent: '#d84a4a' },
        { type: 'pc', position: [6.8, -7.1], interact: 'pc-home' },
        { type: 'poster', position: [-2.6, -7.96], size: [2.0, 1.4, 0.02], color: '#2a4a7a', accent: '#e8c870', interact: 'vr-badge-plaque' },
        { type: 'poster', position: [2.6, -7.96], size: [1.6, 1.1, 0.02], color: '#e8e2d8', accent: '#3a3a4a', interact: 'vr-gate-notice' },
        { type: 'banner', position: [-8.96, -2], yaw: PI / 2, size: [1.2, 2.6, 0.05], color: '#2a4a7a', accent: '#e8c870' },
        { type: 'banner', position: [8.96, -2], yaw: -PI / 2, size: [1.2, 2.6, 0.05], color: '#2a4a7a', accent: '#e8c870' },
        { type: 'sofa', position: [-6.6, 2.4], yaw: PI / 2, size: [2.6, 0.9, 0.9], color: '#4a6a9a' },
        { type: 'sofa', position: [6.6, 2.4], yaw: -PI / 2, size: [2.6, 0.9, 0.9], color: '#4a6a9a' },
        { type: 'plant', position: [-7.8, 6.6] },
        { type: 'plant', position: [7.8, 6.6] },
        { type: 'plant', position: [-7.8, -7.0] },
        { type: 'pennant', position: [-1.8, -6.4], color: '#2a4a7a', accent: '#e8c870' },
        { type: 'pennant', position: [1.8, -6.4], color: '#2a4a7a', accent: '#e8c870' },
        { type: 'lamp', position: [0, 3], color: '#fff2d0' },
      ],
      exits: [
        { id: 'front', position: [0, 7.65], radius: 0.9, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true, poi: 'victory-road-south' }, label: '出口' },
        {
          id: 'north',
          position: [0, -7.4],
          radius: 1.0,
          spawnOffset: [0, 1.5],
          spawnYaw: 0,
          to: { room: 'hall-1f', exit: 'south' },
          label: '冠军之路',
          requires: [...VICTORY_ROAD_BADGES],
          lockedHint: '「站住！冠军之路只对集齐翠澜四岛全部 11 枚徽章的训练家开放。」',
        },
      ],
      npcs: [
        { id: 'vr-gate-guard', position: [1.9, -5.4], yaw: PI },
        { id: 'vr-gate-nurse', position: [-5.6, -5.7], yaw: 0 },
        { id: 'vr-gate-rookie', position: [6.0, 4.6], yaw: -PI / 2 },
      ],
      triggers: [{ id: 'vr-gate-enter', position: [0, 4.6], radius: 3.2, script: 'vr-gate-enter', doneFlag: 'vr-entered' }],
    },
    // ————————————————————————— 一层 · 石柱大厅 —————————————————————————
    {
      id: 'hall-1f',
      name: '冠军之路 · 石柱大厅',
      size: [26, 34, 8],
      floor: { color: '#6e6255', pattern: 'rock', accent: '#5a5046' },
      wall: { color: ROCK, trim: ROCK_DARK },
      lighting: 'cave',
      encounters: { table: 'victory-road', ratePerMeter: 0.045 },
      cameraDistance: 13,
      // M3-23 碎岩：裂纹小岩（掉道具 / 跳出野生宝可梦）
      smashRocks: {
        rocks: [
          [-9, 8],
          [9, -2],
          [-2.6, -13],
        ],
      },
      furniture: [
        ...rubble(26, 34, 14, 2011, ROCK, [
          [0, 16, 3.5],
          [-11.4, -14, 3.5],
        ]),
        // 两排石柱（钟乳石连成的天然柱）
        { type: 'stalagmite', position: [-5.5, 9], size: [1.4, 7.6, 1.4], color: '#7a6e60' },
        { type: 'stalagmite', position: [5.5, 9], size: [1.4, 7.6, 1.4], color: '#7a6e60' },
        { type: 'stalagmite', position: [-5.5, 0], size: [1.5, 7.6, 1.5], color: '#7a6e60' },
        { type: 'stalagmite', position: [5.5, 0], size: [1.5, 7.6, 1.5], color: '#7a6e60' },
        { type: 'stalagmite', position: [-5.5, -9], size: [1.4, 7.6, 1.4], color: '#7a6e60' },
        { type: 'stalagmite', position: [5.5, -9], size: [1.4, 7.6, 1.4], color: '#7a6e60' },
        { type: 'stalagmite', position: [9.6, 4.4], size: [1.0, 2.2, 1.0], color: '#8a7e70' },
        { type: 'stalagmite', position: [-9.8, -4.6], size: [0.9, 1.8, 0.9], color: '#8a7e70' },
        { type: 'torch', position: [-2.4, 13.6], color: '#ffb05a' },
        { type: 'torch', position: [2.4, 13.6], color: '#ffb05a' },
        { type: 'torch', position: [-4.2, 4.5], color: '#ffb05a' },
        { type: 'torch', position: [4.2, -4.5], color: '#ffb05a' },
        { type: 'torch', position: [-10.2, -12.2], color: '#ffb05a' },
        // 东侧地下泉（静水，不能走）
        { type: 'river', position: [10.4, -10.4], size: [3.6, 0.3, 9], color: '#2f6f98', accent: 'still' },
        { type: 'crystal', position: [11.8, -15.4], size: [0.6, 1.2, 0.6], color: '#9ad8ff' },
        { type: 'crystal', position: [8.8, -15.6], size: [0.4, 0.8, 0.4], color: '#9ad8ff' },
        { type: 'crate', position: [11.4, 13.4], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'vr-crate-hall' },
        { type: 'poster', position: [-12.96, 12], yaw: PI / 2, size: [1.2, 0.9, 0.02], color: '#c8b48a', accent: '#3a2a1a', interact: 'vr-sign-hall' },
      ],
      exits: [
        { id: 'south', position: [0, 16.2], radius: 1.1, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'south-gate', exit: 'north' }, label: '回到南关所' },
        { id: 'to-boulder', position: [-11.6, -15.6], radius: 1.1, spawnOffset: [1.2, 1.4], spawnYaw: PI / 2, to: { room: 'boulder-hall', exit: 'west' }, label: '往深处走' },
      ],
      npcs: [
        { id: 'vr-trainer-ace-1', position: [-2.6, 4.4], yaw: PI / 2 },
        { id: 'vr-trainer-ace-2', position: [2.6, -6.6], yaw: -PI / 2 },
        { id: 'vr-trainer-blackbelt', position: [-8.6, -10.6], yaw: PI / 4 },
      ],
    },
    // ————————————————————————— 巨石大厅（怪力推石） —————————————————————————
    {
      id: 'boulder-hall',
      name: '冠军之路 · 巨石大厅',
      size: [30, 30, 7],
      floor: { color: '#6a5e52', pattern: 'rock', accent: '#544a40' },
      wall: { color: ROCK, trim: ROCK_DARK },
      lighting: 'cave',
      encounters: { table: 'victory-road', ratePerMeter: 0.03 },
      cameraDistance: 14,
      boulders: VR_BOULDERS,
      furniture: [
        // 裂谷两端贴墙的岩壁（谜题方格外的 1 米边缝）
        { type: 'cliffwall', position: [-14.5, -4], yaw: PI / 2, size: [4.2, 6, 1.0], color: ROCK_DARK },
        { type: 'cliffwall', position: [14.5, -4], yaw: -PI / 2, size: [4.2, 6, 1.0], color: ROCK_DARK },
        { type: 'torch', position: [-14.4, 10.2], color: '#ffb05a' },
        { type: 'torch', position: [-14.4, 3.8], color: '#ffb05a' },
        { type: 'torch', position: [14.4, 10.2], color: '#ffb05a' },
        { type: 'torch', position: [6.6, -14.4], color: '#ffb05a' },
        { type: 'torch', position: [11.6, -14.4], color: '#ffb05a' },
        { type: 'poster', position: [-14.96, 9], yaw: PI / 2, size: [1.0, 0.8, 0.02], color: '#8a7e70', accent: '#3a2a1a', interact: 'vr-strength-sign' },
        { type: 'crystal', position: [-10, -14.6], size: [0.6, 1.4, 0.6], color: '#c8b0ff' },
        { type: 'crystal', position: [-11.2, -14.4], size: [0.4, 0.8, 0.4], color: '#c8b0ff' },
        { type: 'crate', position: [-14.45, -12.5], size: [0.85, 0.8, 0.85], color: '#8a6038', interact: 'vr-crate-boulder' },
      ],
      exits: [
        { id: 'west', position: [-14.3, 7], radius: 1.0, spawnOffset: [1.6, 0], spawnYaw: PI / 2, to: { room: 'hall-1f', exit: 'to-boulder' }, label: '回到石柱大厅' },
        { id: 'down', position: [9, -13.4], radius: 1.0, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'river-b1', exit: 'up' }, label: '下到暗河' },
      ],
    },
    // ————————————————————————— 地下暗河（漆黑 · 攀瀑） —————————————————————————
    {
      id: 'river-b1',
      name: '冠军之路 · 地下暗河',
      size: [34, 30, 10],
      floor: { color: '#4e4a46', pattern: 'rock', accent: '#3e3a36' },
      wall: { color: '#4a443e', trim: '#2c2824' },
      lighting: 'cave',
      encounters: { table: 'victory-road-river', ratePerMeter: 0.045 },
      cameraDistance: 15,
      dark: { flag: 'field-flash', hint: '伸手不见五指……暗河的水声震耳欲聋。需要「闪光」照亮四周。' },
      furniture: [
        ...rubble(34, 30, 12, 7331, '#4e4a46', [
          [-12, 13, 3.5],
          [10, -12, 5],
          [-6, 0, 4],
        ]),
        // 横贯大厅的暗河（东 → 西流），石桥下那一段不挡（桥面可走）
        { type: 'river', position: [-12.2, 0], yaw: -PI / 2, size: [4.4, 0.3, 9.6], color: '#21608a' },
        { type: 'river', position: [-6, 0], yaw: -PI / 2, size: [4.4, 0.3, 2.8], color: '#21608a', noCollide: true },
        { type: 'river', position: [6.2, 0], yaw: -PI / 2, size: [4.4, 0.3, 21.6], color: '#21608a' },
        { type: 'bridge', position: [-6, 0], size: [2.8, 0.3, 6.4], color: '#7a6a58' },
        // 北墙的瀑布（逆瀑而上通往二层）
        { type: 'waterfall', position: [10, -14.2], size: [4.4, 10, 1.6], color: '#4a443e', accent: '#a8e2ff' },
        { type: 'river', position: [10, -7], size: [3.6, 0.3, 4.4], color: '#2a74a4', noCollide: true },
        { type: 'stalagmite', position: [3.4, -11.2], size: [1.2, 3.0, 1.2], color: '#6a625a' },
        { type: 'stalagmite', position: [15.2, -9.4], size: [1.0, 2.4, 1.0], color: '#6a625a' },
        { type: 'stalagmite', position: [-15, 6.4], size: [1.1, 2.6, 1.1], color: '#6a625a' },
        { type: 'stalagmite', position: [2.4, 8.6], size: [0.9, 2.0, 0.9], color: '#6a625a' },
        { type: 'crystal', position: [-15.6, -13.6], size: [0.6, 1.3, 0.6], color: '#7ad8c8' },
        { type: 'crystal', position: [-14.2, -14.4], size: [0.4, 0.9, 0.4], color: '#7ad8c8' },
        { type: 'crate', position: [-15.4, -11.4], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'vr-crate-river' },
        { type: 'poster', position: [-16.96, 10], yaw: PI / 2, size: [1.0, 0.8, 0.02], color: '#8a7e70', accent: '#3a2a1a', interact: 'vr-river-sign' },
      ],
      exits: [
        { id: 'up', position: [-12, 13.2], radius: 1.1, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'boulder-hall', exit: 'down' }, label: '回到巨石大厅' },
        {
          id: 'falls',
          position: [10, -11.2],
          radius: 1.4,
          spawnOffset: [0, 2.2],
          spawnYaw: 0,
          to: { room: 'cliff-2f', exit: 'falls-top' },
          label: '逆瀑而上',
          action: 'waterfall',
          requires: [WATERFALL_FLAG],
          lockedHint: '奔涌的瀑布挡住了去路……会「攀瀑」的宝可梦或许能逆流而上。',
        },
      ],
      npcs: [
        { id: 'vr-falls-master', position: [5.6, -8.2], yaw: PI / 2 },
        { id: 'vr-trainer-dragon', position: [-11.4, -7.4], yaw: PI / 2 },
        { id: 'vr-trainer-psychic', position: [9.6, 7.4], yaw: -PI / 2 },
      ],
    },
    // ————————————————————————— 二层 · 瀑上岩台（攀岩） —————————————————————————
    {
      id: 'cliff-2f',
      name: '冠军之路 · 瀑上岩台',
      size: [30, 30, 10],
      floor: { color: '#74685a', pattern: 'rock', accent: '#5e5448' },
      wall: { color: ROCK, trim: ROCK_DARK },
      lighting: 'cave',
      encounters: { table: 'victory-road', ratePerMeter: 0.045 },
      cameraDistance: 14,
      smashRocks: {
        rocks: [
          [-4, 10],
          [9, 6],
        ],
      },
      furniture: [
        ...rubble(30, 30, 12, 9001, ROCK, [
          [-10, -10, 4],
          [8, -11, 4.5],
        ]),
        // 上游的瀑布（顺瀑布而下回暗河）
        { type: 'waterfall', position: [-10, -14.2], size: [4.0, 9, 1.6], color: ROCK, accent: '#a8e2ff' },
        { type: 'river', position: [-10, -9.2], size: [3.4, 0.3, 4.4], color: '#2a74a4', noCollide: true },
        // 北墙东段的裂缝岩壁（攀岩上崖）
        { type: 'cliffwall', position: [8, -14.4], size: [6.4, 10, 1.2], color: '#6a5e50', accent: 'crack' },
        { type: 'stalagmite', position: [0, 2], size: [1.8, 9.6, 1.8], color: '#7a6e60' },
        { type: 'stalagmite', position: [-8, 6], size: [1.2, 3.2, 1.2], color: '#7a6e60' },
        { type: 'stalagmite', position: [11, 4], size: [1.2, 3.0, 1.2], color: '#7a6e60' },
        { type: 'torch', position: [-5.6, -13.2], color: '#ffb05a' },
        { type: 'torch', position: [3.6, -13.4], color: '#ffb05a' },
        { type: 'torch', position: [-12.4, 8.2], color: '#ffb05a' },
        { type: 'torch', position: [12.6, 10.2], color: '#ffb05a' },
        { type: 'pennant', position: [12.4, -11.6], color: '#d84a4a', accent: '#f2f2f2' },
        { type: 'crate', position: [13.2, 13.0], size: [0.9, 0.8, 0.9], color: '#8a6038', interact: 'vr-crate-cliff' },
      ],
      exits: [
        {
          id: 'falls-top',
          position: [-10, -9.6],
          radius: 1.4,
          spawnOffset: [0, 2.4],
          spawnYaw: 0,
          to: { room: 'river-b1', exit: 'falls' },
          label: '顺瀑布而下',
          action: 'waterfall',
          requires: [WATERFALL_FLAG],
        },
        {
          id: 'climb-up',
          position: [8, -12.6],
          radius: 1.3,
          spawnOffset: [0, 1.8],
          spawnYaw: 0,
          to: { room: 'summit', exit: 'climb-down' },
          label: '攀上岩壁',
          action: 'climb',
          requires: [CLIMB_FLAG],
          lockedHint: '陡峭的岩壁上有一道道裂缝……会「攀岩」的宝可梦能爬上去。',
        },
      ],
      npcs: [
        { id: 'vr-trainer-veteran-1', position: [-4.6, 0.4], yaw: PI / 2 },
        { id: 'vr-trainer-veteran-2', position: [6.4, -4.6], yaw: -PI / 2 },
      ],
    },
    // ————————————————————————— 山顶洞口（北口） —————————————————————————
    {
      id: 'summit',
      name: '冠军之路 · 山顶洞口',
      size: [22, 18, 9],
      floor: { color: '#8a7e6e', pattern: 'rock', accent: '#74685a' },
      wall: { color: '#6a6054', trim: ROCK_DARK },
      lighting: 'cave',
      cameraDistance: 12,
      furniture: [
        { type: 'cliffwall', position: [-7, -8.4], size: [5.6, 9, 1.2], color: '#6a5e50', accent: 'crack' },
        { type: 'stalagmite', position: [7.6, -5.4], size: [1.2, 3.0, 1.2], color: '#8a7e70' },
        { type: 'stalagmite', position: [9.2, 2.4], size: [1.0, 2.2, 1.0], color: '#8a7e70' },
        { type: 'torch', position: [-2.4, 7.6], color: '#ffb05a' },
        { type: 'torch', position: [2.4, 7.6], color: '#ffb05a' },
        { type: 'pennant', position: [-4.0, 6.0], color: '#2a4a7a', accent: '#e8c870' },
        { type: 'pennant', position: [4.0, 6.0], color: '#2a4a7a', accent: '#e8c870' },
        { type: 'rug', position: [0, 4.4], size: [2.6, 0.02, 6.4], color: '#8a2a2a', accent: '#e8c870' },
        { type: 'poster', position: [10.96, 0], yaw: -PI / 2, size: [1.4, 1.0, 0.02], color: '#2a4a7a', accent: '#e8c870', interact: 'vr-summit-plaque' },
      ],
      exits: [
        { id: 'out', position: [0, 8.65], radius: 0.95, spawnOffset: [0, -1.5], spawnYaw: PI, to: { overworld: true, poi: 'victory-road-north' }, label: '前往联盟高原' },
        {
          id: 'climb-down',
          position: [-7, -6.4],
          radius: 1.3,
          spawnOffset: [0, 1.8],
          spawnYaw: 0,
          to: { room: 'cliff-2f', exit: 'climb-up' },
          label: '沿岩壁下去',
          action: 'climb',
          requires: [CLIMB_FLAG],
        },
      ],
      npcs: [{ id: 'vr-summit-guard', position: [2.6, 3.0], yaw: -PI / 2 }],
      triggers: [{ id: 'vr-cleared', position: [0, 2.4], radius: 3.4, script: 'vr-cleared', doneFlag: VICTORY_ROAD_CLEARED }],
    },
  ],
};

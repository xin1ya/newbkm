/**
 * M2-05/06/07/08/09/14/15 · 碧潮群岛室内场景（3 座道馆、民居、矿洞、火山洞窟、温泉设施、异变遗迹）。
 * 对应 islands/tide.ts 中 PoiConfig.interior；宝可梦中心 / 商店共用 sprout.ts 的 'pokecenter' / 'mart'。
 * 主色板：深绿（碧潮镇）/ 赭石（矿石镇）/ 熔岩橙（火山镇）。
 */
import type { ExitConfig, FurnitureConfig, InteriorConfig } from './types';

const PI = Math.PI;

/** 正门：固定在 +Z 墙中央 */
function frontDoor(depth: number, x = 0): ExitConfig {
  return { id: 'front', position: [x, depth / 2 - 0.35], radius: 0.85, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出门' };
}

/** 洞窟里散落的岩块（按种子确定位置，避开中线通道 |x| < keep） */
function scatterRocks(w: number, d: number, n: number, seed: number, keep: number, color: string): FurnitureConfig[] {
  const out: FurnitureConfig[] = [];
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (keep + rnd() * (w / 2 - keep - 1.2));
    const z = -d / 2 + 1.5 + rnd() * (d - 4);
    const r = 0.8 + rnd() * 1.4;
    out.push({ type: 'boulder', position: [x, z], size: [r * 1.4, r, r * 1.2], color });
  }
  return out;
}

export const TIDE_INTERIORS: InteriorConfig[] = [
  // ————————————————————————— 碧潮道馆（草 · 叶岚）：巨树根系大厅 —————————————————————————
  // 布局：入口大厅 → 根须回廊（两名训练家分站左右根桥）→ 树心战斗场 → 馆主台（巨树树洞前）
  {
    id: 'gym-azure',
    name: '碧潮道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      {
        id: 'main',
        name: '碧潮道馆 · 树心大厅',
        size: [28, 36, 7],
        floor: { color: '#4f7a3a', pattern: 'plank', accent: '#3f6a2e' },
        wall: { color: '#6b8a4a', trim: '#4a3a24', wainscot: '#7a5a38' },
        lighting: 'gym',
        cameraDistance: 15,
        battleStage: { position: [0, -6], yaw: PI, radius: 6.5 },
        furniture: [
          // 入口：接待台、奖杯柜、挑战须知
          { type: 'reception', position: [-9.5, 14.5], yaw: PI / 2, color: '#6a4a2a', accent: '#cfe8b0' },
          { type: 'trophy', position: [13.45, 13.5], yaw: -PI / 2, color: '#5a3e24', accent: '#3f7a3a' },
          { type: 'poster', position: [-13.96, 10], yaw: PI / 2, size: [1.4, 1.0, 0.02], color: '#3f7a3a', accent: '#f6f0d0', interact: 'gym-azure-rules' },
          { type: 'rug', position: [0, 13], size: [4, 0.02, 8], color: '#3f6a2e', accent: '#cfe8b0' },
          // 根须回廊：两侧巨根（立柱）与苔藓地毯，中间是盘根小径
          { type: 'column', position: [-6, 6], size: [1.6, 7, 1.6], color: '#6a4a2a', accent: '#3f7a3a' },
          { type: 'column', position: [6, 6], size: [1.6, 7, 1.6], color: '#6a4a2a', accent: '#3f7a3a' },
          { type: 'column', position: [-9, 1], size: [1.4, 7, 1.4], color: '#6a4a2a', accent: '#3f7a3a' },
          { type: 'column', position: [9, 1], size: [1.4, 7, 1.4], color: '#6a4a2a', accent: '#3f7a3a' },
          { type: 'boulder', position: [-3.6, 8], size: [3.2, 1.0, 1.4], color: '#5a4028' },
          { type: 'boulder', position: [3.8, 3.6], size: [3.4, 1.0, 1.4], color: '#5a4028' },
          { type: 'boulder', position: [-4.4, 0.8], size: [2.6, 0.9, 1.2], color: '#5a4028' },
          { type: 'rug', position: [-7.6, 4], size: [4.6, 0.02, 6], color: '#5d8f3e', accent: '#8fc06a' },
          { type: 'rug', position: [8, 4], size: [4.6, 0.02, 6], color: '#5d8f3e', accent: '#8fc06a' },
          { type: 'plant', position: [-12.6, 6] },
          { type: 'plant', position: [12.6, 6] },
          { type: 'plant', position: [-12.6, -1] },
          { type: 'plant', position: [12.6, -1] },
          { type: 'plant', position: [-1.8, 9.5], size: [0.8, 1.4, 0.8] },
          { type: 'plant', position: [2.2, 9.5], size: [0.8, 1.4, 0.8] },
          // 树心战斗场（圆形苔地 + 天窗光柱）
          { type: 'rug', position: [0, -6], size: [11, 0.02, 9], color: '#6aa04a', accent: '#cfe8b0' },
          { type: 'skylight', position: [0, -6], size: [5, 0.3, 4], y: 6.6, color: '#8fc06a' },
          { type: 'bleacher', position: [-11.4, -6], yaw: PI / 2, size: [7, 1.4, 2.6], color: '#7a5a38', accent: '#3f7a3a' },
          { type: 'bleacher', position: [11.4, -6], yaw: -PI / 2, size: [7, 1.4, 2.6], color: '#7a5a38', accent: '#3f7a3a' },
          // 馆主台：巨树树洞
          { type: 'dais', position: [0, -15.4], size: [7, 0.36, 2.6], color: '#5a4028', accent: '#8fc06a' },
          { type: 'emblem', position: [0, -17.96], size: [2.6, 2.6, 0.02], y: 4.6, color: '#3f7a3a', accent: '#f6f0d0' },
          { type: 'banner', position: [-5.2, -17.96], size: [1.3, 3.2, 0.02], y: 6.2, color: '#3f7a3a', accent: '#f6f0d0' },
          { type: 'banner', position: [5.2, -17.96], size: [1.3, 3.2, 0.02], y: 6.2, color: '#3f7a3a', accent: '#f6f0d0' },
          { type: 'column', position: [-8.6, -15.6], size: [2.2, 7, 2.2], color: '#5a3e24', accent: '#3f7a3a' },
          { type: 'column', position: [8.6, -15.6], size: [2.2, 7, 2.2], color: '#5a3e24', accent: '#3f7a3a' },
          { type: 'plant', position: [-11.8, -16.4], size: [1.4, 2.4, 1.4] },
          { type: 'plant', position: [11.8, -16.4], size: [1.4, 2.4, 1.4] },
          { type: 'crystal', position: [-3.8, -16.8], color: '#a6e07a' },
          { type: 'crystal', position: [3.8, -16.8], color: '#a6e07a' },
          { type: 'beam', position: [0, -10], size: [28, 0.5, 0.6], y: 6.6, color: '#5a3e24' },
          { type: 'beam', position: [0, 2], size: [28, 0.5, 0.6], y: 6.6, color: '#5a3e24' },
          { type: 'lamp', position: [-6, -12.5], color: '#e8f6c0' },
          { type: 'lamp', position: [6, -12.5], color: '#e8f6c0' },
          { type: 'window', position: [-13.96, -6], yaw: PI / 2 },
          { type: 'window', position: [13.96, -6], yaw: -PI / 2 },
        ],
        exits: [frontDoor(36)],
        npcs: [
          { id: 'gym-azure-guide', position: [3, 14.6], yaw: -PI / 2 },
          { id: 'yelan', position: [0, -14.2], yaw: 0 },
          { id: 'gym-azure-trainer-1', position: [-7.6, 4.4], yaw: 0.4 },
          { id: 'gym-azure-trainer-2', position: [8, 2.6], yaw: -0.6 },
        ],
      },
    ],
  },

  // ————————————————————————— 树语长老的树屋 —————————————————————————
  {
    id: 'tide-elder-house',
    name: '树语长老的树屋',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '树语长老的树屋',
        size: [9, 8, 3],
        floor: { color: '#8a6a44', pattern: 'plank', accent: '#7a5a38' },
        wall: { color: '#c8b48a', trim: '#5a4028', wainscot: '#9a7a50' },
        lighting: 'home',
        furniture: [
          { type: 'rug', position: [0, 0.4], size: [3.2, 0.02, 2.4], color: '#5d8f3e', accent: '#e8d8a0' },
          { type: 'table', position: [0, 0.4], size: [1.4, 0.5, 1.0], color: '#7a5a38' },
          { type: 'bookshelf', position: [-3.2, -3.55], size: [1.6, 2.0, 0.45], color: '#5a4028', interact: 'elder-tide-books' },
          { type: 'bed', position: [3.0, -2.4], color: '#6a4a2a', accent: '#5d8f3e', interact: 'bed-tide-elder' },
          { type: 'plant', position: [-4.0, 3.3] },
          { type: 'plant', position: [4.0, 3.3] },
          { type: 'lamp', position: [-4.0, -3.3], color: '#f6e7b5' },
          { type: 'poster', position: [0.4, -4], size: [1.4, 1.0, 0.02], color: '#3f7a3a', accent: '#f6f0d0', interact: 'elder-tide-map' },
          { type: 'window', position: [-1.6, -4], size: [1.2, 1.0, 0.1] },
          { type: 'window', position: [4.5, 0.6], yaw: -PI / 2, size: [1.2, 1.0, 0.1] },
        ],
        exits: [frontDoor(8)],
        npcs: [{ id: 'tide-elder', position: [-1.2, -0.8], yaw: 0 }],
      },
    ],
  },

  // ————————————————————————— 矿石道馆（岩 · 岩磊）：峡谷采石场 —————————————————————————
  // 布局：入口 → 采石阶地（两层石台之间的碎石坡道、矿车轨道）→ 石英战斗场 → 馆主台（岩壁凿出的王座）
  {
    id: 'gym-ore',
    name: '矿石道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      {
        id: 'main',
        name: '矿石道馆 · 采石场',
        size: [30, 36, 7.5],
        floor: { color: '#a8865a', pattern: 'rock', accent: '#8f6f48' },
        wall: { color: '#b98a5a', trim: '#5a3e24', wainscot: '#8a6440' },
        lighting: 'gym',
        cameraDistance: 15,
        battleStage: { position: [0, -6], yaw: PI, radius: 6.5 },
        furniture: [
          { type: 'reception', position: [-10.5, 14.5], yaw: PI / 2, color: '#6a4a2a', accent: '#f2d9a0' },
          { type: 'trophy', position: [14.45, 13.5], yaw: -PI / 2, color: '#5a3e24', accent: '#c08a3e' },
          { type: 'poster', position: [-14.96, 10], yaw: PI / 2, size: [1.4, 1.0, 0.02], color: '#c08a3e', accent: '#3a2a1a', interact: 'gym-ore-rules' },
          // 采石阶地：碎石堆、木箱、矿车（machine）、桶，形成左右两条迂回路线
          { type: 'boulder', position: [-4.6, 10.4], size: [2.4, 1.4, 1.8], color: '#8f6f48' },
          { type: 'boulder', position: [4.8, 9.6], size: [2.0, 1.2, 1.6], color: '#8f6f48' },
          { type: 'boulder', position: [-11.4, 8.2], size: [2.2, 1.6, 1.8], color: '#8f6f48' },
          { type: 'boulder', position: [11.6, 10.4], size: [2.0, 1.4, 1.6], color: '#8f6f48' },
          { type: 'boulder', position: [-4.2, 2.6], size: [2.6, 1.2, 1.6], color: '#8f6f48' },
          { type: 'boulder', position: [4.4, 6.2], size: [1.8, 1.0, 1.4], color: '#8f6f48' },
          { type: 'machine', position: [-6.5, 9], size: [2.0, 1.4, 1.2], color: '#6a6a72', accent: '#c08a3e' },
          { type: 'machine', position: [7, 0.5], size: [2.0, 1.4, 1.2], color: '#6a6a72', accent: '#c08a3e' },
          { type: 'crate', position: [-12.6, 4], size: [1.2, 1.0, 1.2], color: '#a07040' },
          { type: 'crate', position: [-12.6, 5.3], size: [1.0, 0.8, 1.0], color: '#8a6038' },
          { type: 'crate', position: [12.6, 7], size: [1.2, 1.0, 1.2], color: '#a07040' },
          { type: 'barrel', position: [12.8, 2] },
          { type: 'barrel', position: [-12.8, -1] },
          { type: 'crystal', position: [-13.2, 9], color: '#f2c46b' },
          { type: 'crystal', position: [13.2, -1.5], color: '#f2c46b' },
          // 战斗场（石英嵌地）
          { type: 'rug', position: [0, -6], size: [11, 0.02, 9], color: '#c9a878', accent: '#f6e6c0' },
          { type: 'skylight', position: [0, -6], size: [5, 0.3, 4], y: 7, color: '#f2c46b' },
          { type: 'bleacher', position: [-12, -6], yaw: PI / 2, size: [7, 1.4, 2.6], color: '#8a6440', accent: '#c08a3e' },
          { type: 'bleacher', position: [12, -6], yaw: -PI / 2, size: [7, 1.4, 2.6], color: '#8a6440', accent: '#c08a3e' },
          // 馆主台：岩壁王座
          { type: 'dais', position: [0, -15.4], size: [7, 0.5, 2.6], color: '#7a5a38', accent: '#f2c46b' },
          { type: 'boulder', position: [-6.5, -16.6], size: [3.4, 3.2, 2.2], color: '#8f6f48' },
          { type: 'boulder', position: [6.5, -16.6], size: [3.4, 3.4, 2.2], color: '#8f6f48' },
          { type: 'emblem', position: [0, -17.96], size: [2.6, 2.6, 0.02], y: 4.8, color: '#c08a3e', accent: '#3a2a1a' },
          { type: 'banner', position: [-3.6, -17.96], size: [1.2, 3.0, 0.02], y: 6.4, color: '#c08a3e', accent: '#3a2a1a' },
          { type: 'banner', position: [3.6, -17.96], size: [1.2, 3.0, 0.02], y: 6.4, color: '#c08a3e', accent: '#3a2a1a' },
          { type: 'column', position: [-10.5, -14], color: '#b98a5a', accent: '#5a3e24' },
          { type: 'column', position: [10.5, -14], color: '#b98a5a', accent: '#5a3e24' },
          { type: 'beam', position: [0, -10], size: [30, 0.5, 0.6], y: 7, color: '#5a3e24' },
          { type: 'beam', position: [0, 2], size: [30, 0.5, 0.6], y: 7, color: '#5a3e24' },
          { type: 'lamp', position: [-6, -12.5], color: '#ffd9a0' },
          { type: 'lamp', position: [6, -12.5], color: '#ffd9a0' },
          { type: 'lamp', position: [-9, 12], color: '#ffd9a0' },
          { type: 'lamp', position: [9, 12], color: '#ffd9a0' },
        ],
        exits: [frontDoor(36)],
        npcs: [
          { id: 'gym-ore-guide', position: [3, 14.6], yaw: -PI / 2 },
          { id: 'yanlei', position: [0, -14.2], yaw: 0 },
          { id: 'gym-ore-trainer-1', position: [-8.5, 6], yaw: 0.3 },
          { id: 'gym-ore-trainer-2', position: [9, 3], yaw: -0.4 },
        ],
      },
    ],
  },

  // ————————————————————————— 矿工工头之家 —————————————————————————
  {
    id: 'ore-foreman-house',
    name: '矿工工头之家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '矿工工头之家',
        size: [10, 8, 3],
        floor: { color: '#9a7450', pattern: 'plank', accent: '#86623f' },
        wall: { color: '#e2c9a0', trim: '#6a4a2a', wainscot: '#b98a5a' },
        lighting: 'home',
        furniture: [
          { type: 'table', position: [-1.2, 0.4], size: [1.8, 0.75, 1.1], color: '#7a5a38' },
          { type: 'chair', position: [-2.4, 0.4], yaw: PI / 2, color: '#7a5a38' },
          { type: 'chair', position: [0, 0.4], yaw: -PI / 2, color: '#7a5a38' },
          { type: 'workbench', position: [3.2, -3.3], color: '#6a4a2a', interact: 'foreman-bench' },
          { type: 'shelf', position: [-3.4, -3.55], size: [2.0, 1.6, 0.45], color: '#6a4a2a', interact: 'foreman-shelf' },
          { type: 'crate', position: [4.3, 2.8], size: [0.9, 0.8, 0.9], color: '#a07040' },
          { type: 'barrel', position: [4.3, 1.6] },
          { type: 'stove', position: [0.6, -3.35] },
          { type: 'poster', position: [-1.2, -4], size: [1.6, 1.0, 0.02], color: '#c08a3e', accent: '#3a2a1a', interact: 'foreman-mine-map' },
          { type: 'lamp', position: [-4.5, 3.2], color: '#ffd9a0' },
          { type: 'window', position: [2, -4], size: [1.2, 1.0, 0.1] },
        ],
        exits: [frontDoor(8)],
        npcs: [
          { id: 'ore-foreman', position: [1.6, 0.6], yaw: -PI / 2 },
          { id: 'foreman-wife', position: [-3.2, 2.4], yaw: PI / 2 },
        ],
      },
    ],
  },

  // ————————————————————————— 矿石镇矿洞（三层地城） —————————————————————————
  // 入口坑道（暗雷）→ 深层矿脉（被困矿工 / 异变痕迹）→ 怪力巨石后的古代石室（古代石板）
  {
    id: 'tide-mine',
    name: '矿石镇矿洞',
    entryRoom: 'entrance',
    entryExit: 'front',
    bgm: 'cave',
    rooms: [
      {
        id: 'entrance',
        name: '矿洞 · 入口坑道',
        size: [16, 30, 5],
        floor: { color: '#6a5440', pattern: 'rock', accent: '#5a4636' },
        wall: { color: '#5a4636', trim: '#3a2c20' },
        lighting: 'cave',
        encounters: { table: 'ore-mine', ratePerMeter: 0.045 },
        furniture: [
          ...scatterRocks(16, 30, 10, 311, 2.6, '#6a5440'),
          { type: 'beam', position: [0, 8], size: [16, 0.4, 0.5], y: 4.4, color: '#6a4a2a' },
          { type: 'beam', position: [0, -2], size: [16, 0.4, 0.5], y: 4.4, color: '#6a4a2a' },
          { type: 'beam', position: [0, -11], size: [16, 0.4, 0.5], y: 4.4, color: '#6a4a2a' },
          { type: 'lamp', position: [-2.2, 10], color: '#ffc870' },
          { type: 'lamp', position: [2.2, 0], color: '#ffc870' },
          { type: 'lamp', position: [-2.2, -9], color: '#ffc870' },
          { type: 'machine', position: [5.8, 11], size: [1.8, 1.3, 1.1], color: '#5a5a62', accent: '#c08a3e' },
          { type: 'crate', position: [-6.2, 12.5], size: [1.0, 0.9, 1.0], color: '#8a6038', interact: 'mine-supply-crate' },
          { type: 'crystal', position: [6.4, -6], size: [0.5, 0.9, 0.5], color: '#f2c46b' },
          { type: 'poster', position: [-7.96, 6], yaw: PI / 2, size: [1.2, 0.9, 0.02], color: '#c08a3e', accent: '#3a2a1a', interact: 'mine-warning' },
        ],
        exits: [
          frontDoor(30),
          { id: 'down', position: [0, -14.2], radius: 1.1, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'deep', exit: 'up' }, label: '往深处走' },
        ],
      },
      {
        id: 'deep',
        name: '矿洞 · 深层矿脉',
        size: [24, 24, 6],
        floor: { color: '#5a4636', pattern: 'rock', accent: '#4a382a' },
        wall: { color: '#4a382a', trim: '#2c2018' },
        lighting: 'cave',
        encounters: { table: 'ore-mine', ratePerMeter: 0.05 },
        furniture: [
          { type: 'boulder', position: [-9.2, 8.6], size: [2.4, 1.6, 2.0], color: '#5a4636' },
          { type: 'boulder', position: [9.0, 7.4], size: [2.2, 1.4, 1.8], color: '#5a4636' },
          { type: 'boulder', position: [-9.8, 1.2], size: [1.8, 1.2, 1.6], color: '#5a4636' },
          { type: 'boulder', position: [9.6, 0.4], size: [2.0, 1.6, 1.8], color: '#5a4636' },
          { type: 'boulder', position: [-4.4, 3.6], size: [1.4, 0.9, 1.2], color: '#5a4636' },
          { type: 'boulder', position: [4.6, -2.4], size: [1.2, 0.8, 1.0], color: '#5a4636' },
          // 异变痕迹：泛紫的晶簇 + 塌方
          { type: 'crystal', position: [-8.6, -8.6], size: [0.8, 1.6, 0.8], color: '#b48cff', interact: 'mine-anomaly-crystal' },
          { type: 'crystal', position: [-9.6, -7.2], size: [0.5, 1.0, 0.5], color: '#b48cff' },
          { type: 'crystal', position: [-7.4, -9.8], size: [0.5, 1.1, 0.5], color: '#e8484a' },
          { type: 'boulder', position: [8.2, -6.2], size: [3.0, 2.0, 2.0], color: '#5a4636' },
          { type: 'boulder', position: [6.0, -8.8], size: [2.2, 1.4, 1.6], color: '#5a4636' },
          { type: 'crate', position: [7.6, -10.6], size: [0.8, 0.6, 0.8], color: '#8a6038' },
          { type: 'lamp', position: [-3, 9], color: '#ffc870' },
          { type: 'lamp', position: [3, -3], color: '#ffc870' },
          { type: 'beam', position: [0, 4], size: [24, 0.4, 0.5], y: 5.4, color: '#6a4a2a' },
        ],
        blockers: [{ id: 'mine-boulder', type: 'strength', requiresFlag: 'hm06-strength', position: [0, -10.2], size: [2.6, 2.4, 2.4], hint: '一块巨石挡住了更深处的坑道……似乎需要「怪力」才能推开。' }],
        triggers: [
          { id: 'mine-anomaly', position: [-7, -7], radius: 3.2, script: 'mine-anomaly', doneFlag: 'mine-anomaly-found', repeat: true, showIf: ['mine-anomaly-start'] },
          { id: 'mine-rescue', position: [7, -8], radius: 3.6, script: 'mine-rescue', doneFlag: 'mine-miner-rescued', repeat: true, showIf: ['mine-rescue-start'] },
        ],
        exits: [
          { id: 'up', position: [0, 11.2], radius: 1.1, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'entrance', exit: 'down' }, label: '回到入口' },
          { id: 'tablet', position: [0, -11.4], radius: 1.0, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'chamber', exit: 'back' }, label: '进入石室' },
        ],
        npcs: [{ id: 'trapped-miner', position: [8.6, -9.4], yaw: -PI / 2 }],
      },
      {
        id: 'chamber',
        name: '矿洞 · 古代石室',
        size: [14, 12, 5],
        floor: { color: '#7a7064', pattern: 'tile', accent: '#6a6054' },
        wall: { color: '#6a6054', trim: '#4a4238', relief: 'wave', reliefColor: '#8a8074' },
        lighting: 'cave',
        furniture: [
          { type: 'column', position: [-4.6, -2], color: '#8a8074', accent: '#b48cff' },
          { type: 'column', position: [4.6, -2], color: '#8a8074', accent: '#b48cff' },
          { type: 'dais', position: [0, -3.8], size: [3, 0.4, 1.6], color: '#6a6054', accent: '#b48cff' },
          { type: 'desk', position: [0, -3.8], size: [1.4, 0.9, 0.7], color: '#8a8074', interact: 'ancient-tablet' },
          { type: 'emblem', position: [0, -5.96], size: [2.2, 2.2, 0.02], y: 2.8, color: '#6a6054', accent: '#b48cff' },
          { type: 'crystal', position: [-6, -5], color: '#b48cff' },
          { type: 'crystal', position: [6, -5], color: '#b48cff' },
        ],
        exits: [{ id: 'back', position: [0, 5.6], radius: 1.0, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'deep', exit: 'tablet' }, label: '回到矿脉' }],
      },
    ],
  },

  // ————————————————————————— 碧焰道馆（火 · 炎棘）：熔岩炉厅 —————————————————————————
  // 布局：入口 → 熔岩沟之间的玄武岩栈道（两名训练家）→ 黑曜石战斗场 → 馆主台（熔炉前）
  {
    id: 'gym-flame',
    name: '碧焰道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      {
        id: 'main',
        name: '碧焰道馆 · 熔炉大厅',
        size: [28, 36, 7.5],
        floor: { color: '#3b3640', pattern: 'tile', accent: '#2c2830' },
        wall: { color: '#4a3a3a', trim: '#c8502a', wainscot: '#2c2428' },
        lighting: 'gym',
        cameraDistance: 15,
        battleStage: { position: [0, -6], yaw: PI, radius: 6.5 },
        furniture: [
          { type: 'reception', position: [-9.5, 14.5], yaw: PI / 2, color: '#2c2428', accent: '#f0742a' },
          { type: 'trophy', position: [13.45, 13.5], yaw: -PI / 2, color: '#2c2428', accent: '#f0742a' },
          { type: 'poster', position: [-13.96, 10], yaw: PI / 2, size: [1.4, 1.0, 0.02], color: '#c8502a', accent: '#fff0d0', interact: 'gym-flame-rules' },
          // 熔岩沟（发光的浅池，不可走：pool 自带碰撞）
          { type: 'pool', position: [-7.5, 5], size: [6, 0.3, 9], color: '#f0742a' , accent: 'lava' },
          { type: 'pool', position: [7.5, 5], size: [6, 0.3, 9], color: '#f0742a' , accent: 'lava' },
          { type: 'pool', position: [0, 1.5], size: [4, 0.3, 2], color: '#f0742a' , accent: 'lava' },
          { type: 'crystal', position: [-11.8, 9.4], color: '#ff8a3c' },
          { type: 'crystal', position: [11.8, 9.4], color: '#ff8a3c' },
          { type: 'crystal', position: [-11.8, 0.6], color: '#ff8a3c' },
          { type: 'crystal', position: [11.8, 0.6], color: '#ff8a3c' },
          { type: 'column', position: [-3.2, 8.5], color: '#2c2830', accent: '#f0742a' },
          { type: 'column', position: [3.2, 8.5], color: '#2c2830', accent: '#f0742a' },
          // 战斗场
          { type: 'rug', position: [0, -6], size: [11, 0.02, 9], color: '#2c2830', accent: '#f0742a' },
          { type: 'skylight', position: [0, -6], size: [5, 0.3, 4], y: 7, color: '#f0742a' },
          { type: 'bleacher', position: [-11.4, -6], yaw: PI / 2, size: [7, 1.4, 2.6], color: '#3b3640', accent: '#c8502a' },
          { type: 'bleacher', position: [11.4, -6], yaw: -PI / 2, size: [7, 1.4, 2.6], color: '#3b3640', accent: '#c8502a' },
          // 馆主台与熔炉
          { type: 'dais', position: [0, -15.4], size: [7, 0.5, 2.6], color: '#2c2830', accent: '#f0742a' },
          { type: 'fountain', position: [-4.7, -16.9], size: [1.6, 3, 1.0], color: '#2c2830', accent: '#ff7a2a' },
          { type: 'fountain', position: [4.7, -16.9], size: [1.6, 3, 1.0], color: '#2c2830', accent: '#ff7a2a' },
          { type: 'emblem', position: [0, -17.96], size: [2.6, 2.6, 0.02], y: 4.8, color: '#c8502a', accent: '#fff0d0' },
          { type: 'banner', position: [-7.2, -17.96], size: [1.3, 3.2, 0.02], y: 6.4, color: '#c8502a', accent: '#fff0d0' },
          { type: 'banner', position: [7.2, -17.96], size: [1.3, 3.2, 0.02], y: 6.4, color: '#c8502a', accent: '#fff0d0' },
          { type: 'pool', position: [-10.5, -16.2], size: [4, 0.3, 2.4], color: '#f0742a' , accent: 'lava' },
          { type: 'pool', position: [10.5, -16.2], size: [4, 0.3, 2.4], color: '#f0742a' , accent: 'lava' },
          { type: 'beam', position: [0, -10], size: [28, 0.5, 0.6], y: 7, color: '#2c2428' },
          { type: 'beam', position: [0, 2], size: [28, 0.5, 0.6], y: 7, color: '#2c2428' },
          { type: 'lamp', position: [-6, -12.5], color: '#ffb070' },
          { type: 'lamp', position: [6, -12.5], color: '#ffb070' },
        ],
        exits: [frontDoor(36)],
        npcs: [
          { id: 'gym-flame-guide', position: [3, 14.6], yaw: -PI / 2 },
          { id: 'yanji', position: [0, -14.2], yaw: 0 },
          { id: 'gym-flame-trainer-1', position: [-2.4, 5.4], yaw: 0.6 },
          { id: 'gym-flame-trainer-2', position: [2.4, -0.6], yaw: -0.4 },
        ],
      },
    ],
  },

  // ————————————————————————— 地热观测站 —————————————————————————
  {
    id: 'flame-observatory',
    name: '地热观测站',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'lab',
    rooms: [
      {
        id: 'main',
        name: '地热观测站',
        size: [14, 10, 3.6],
        floor: { color: '#4a4650', pattern: 'tile', accent: '#3b3640' },
        wall: { color: '#d8d2c8', trim: '#c8502a', wainscot: '#8a8078' },
        lighting: 'lab',
        furniture: [
          { type: 'machine', position: [-4.6, -4.0], size: [2.6, 2.2, 1.0], color: '#6a6a72', accent: '#f0742a', interact: 'obs-seismograph' },
          { type: 'machine', position: [-1.2, -4.0], size: [1.8, 1.8, 0.9], color: '#6a6a72', accent: '#43d6b5', interact: 'obs-thermo' },
          { type: 'desk', position: [3.6, -3.9], size: [2.6, 0.78, 0.9], color: '#5a5660' },
          { type: 'pc', position: [3.6, -4.1], interact: 'obs-pc' },
          { type: 'chair', position: [3.6, -2.9], yaw: PI, color: '#2c2830' },
          { type: 'bookshelf', position: [6.55, -0.6], yaw: -PI / 2, size: [2.2, 2.2, 0.5], color: '#5a4636', interact: 'obs-books' },
          { type: 'table', position: [-2.4, 1.2], size: [2.4, 0.85, 1.2], color: '#8a8078' },
          { type: 'crystal', position: [-2.4, 1.2], size: [0.4, 0.6, 0.4], color: '#ff8a3c' },
          { type: 'poster', position: [0.8, -5], size: [1.8, 1.2, 0.02], color: '#c8502a', accent: '#fff0d0', interact: 'obs-volcano-chart' },
          { type: 'plant', position: [-6.2, 4.2] },
          { type: 'window', position: [-6.96, 0], yaw: PI / 2 },
        ],
        exits: [frontDoor(10)],
        npcs: [
          { id: 'obs-chief', position: [1.2, -2.2], yaw: 0 },
          { id: 'obs-aide', position: [-4.6, -2.6], yaw: PI },
        ],
      },
    ],
  },

  // ————————————————————————— 火山洞窟（三层：入口 → 黑暗熔岩隧道 → 地热核心） —————————————————————————
  {
    id: 'volcano-cave',
    name: '火山洞窟',
    entryRoom: 'entrance',
    entryExit: 'front',
    bgm: 'cave',
    rooms: [
      {
        id: 'entrance',
        name: '火山洞窟 · 入口',
        size: [16, 22, 6],
        floor: { color: '#3b3236', pattern: 'rock', accent: '#2c2428' },
        wall: { color: '#3a2c2c', trim: '#1e1618' },
        lighting: 'cave',
        encounters: { table: 'volcano-cave', ratePerMeter: 0.045 },
        furniture: [
          ...scatterRocks(16, 22, 8, 909, 2.6, '#3b3236'),
          { type: 'pool', position: [-5.2, -3], size: [3.0, 0.3, 4.0], color: '#f0742a' , accent: 'lava' },
          { type: 'crystal', position: [5.8, 4], color: '#ff8a3c' },
          { type: 'crystal', position: [-6, 7], size: [0.5, 0.9, 0.5], color: '#ff8a3c' },
          { type: 'poster', position: [7.96, 6], yaw: -PI / 2, size: [1.2, 0.9, 0.02], color: '#c8502a', accent: '#fff0d0', interact: 'volcano-warning' },
        ],
        exits: [
          frontDoor(22),
          { id: 'down', position: [0, -10.2], radius: 1.1, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'tunnel', exit: 'up' }, label: '往深处走' },
        ],
      },
      {
        id: 'tunnel',
        name: '火山洞窟 · 熔岩隧道',
        size: [18, 32, 6],
        floor: { color: '#2c2428', pattern: 'rock', accent: '#221c1e' },
        wall: { color: '#2c2222', trim: '#140e10' },
        lighting: 'cave',
        encounters: { table: 'volcano-cave', ratePerMeter: 0.05 },
        dark: { flag: 'lit:volcano-tunnel', hint: '隧道里一片漆黑，只能看清脚边……「闪光」能照亮这里（碧焰道馆徽章）。' },
        furniture: [
          ...scatterRocks(18, 32, 12, 4242, 2.4, '#2c2428'),
          { type: 'pool', position: [5.6, 6], size: [3.4, 0.3, 6], color: '#f0742a' , accent: 'lava' },
          { type: 'pool', position: [-5.4, -6], size: [3.4, 0.3, 6], color: '#f0742a' , accent: 'lava' },
          // 火山口的蛋（侧室凹处）
          { type: 'boulder', position: [-7.2, 10.2], size: [1.6, 1.2, 1.4], color: '#3b3236' },
          { type: 'crate', position: [-7.4, 12.4], size: [0.9, 0.5, 0.9], color: '#6a4a2a', interact: 'volcano-egg-nest' },
          { type: 'crystal', position: [7.6, -12], color: '#ff8a3c' },
        ],
        exits: [
          { id: 'up', position: [0, 15.2], radius: 1.1, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'entrance', exit: 'down' }, label: '回到入口' },
          { id: 'core', position: [0, -15.2], radius: 1.1, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'core', exit: 'back' }, label: '前往地热核心' },
        ],
      },
      {
        id: 'core',
        name: '火山洞窟 · 地热核心',
        size: [20, 18, 7],
        floor: { color: '#3b2a26', pattern: 'rock', accent: '#2c1e1a' },
        wall: { color: '#3a2222', trim: '#1e1010' },
        lighting: 'cave',
        battleStage: { position: [0, 2], yaw: PI, radius: 6 },
        furniture: [
          { type: 'pool', position: [0, -5.6], size: [10, 0.3, 4], color: '#ff6a1a' , accent: 'lava' },
          { type: 'crystal', position: [-3.6, -5.4], size: [0.9, 1.8, 0.9], color: '#f08a3c', interact: 'volcano-core-crystal' },
          { type: 'crystal', position: [3.8, -5.0], size: [0.7, 1.4, 0.7], color: '#9a5ae0' },
          { type: 'boulder', position: [-8, -6], size: [2.6, 2.4, 2.2], color: '#3b2a26' },
          { type: 'boulder', position: [8, -6], size: [2.6, 2.6, 2.2], color: '#3b2a26' },
          { type: 'boulder', position: [-8.2, 4], size: [1.8, 1.2, 1.6], color: '#3b2a26' },
          { type: 'boulder', position: [8.4, 3], size: [1.6, 1.1, 1.4], color: '#3b2a26' },
        ],
        triggers: [{ id: 'volcano-core', position: [0, -1.5], radius: 3.4, script: 'volcano-core', doneFlag: 'volcano-heat-source-found', repeat: true, showIf: ['volcano-heat-start'] }],
        exits: [{ id: 'back', position: [0, 8.2], radius: 1.1, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'tunnel', exit: 'core' }, label: '回到隧道' }],
      },
    ],
  },

  // ————————————————————————— 温泉乡培育屋 —————————————————————————
  {
    id: 'spring-breeder',
    name: '培育屋',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '温泉乡培育屋',
        size: [12, 9, 3],
        floor: { color: '#c8a878', pattern: 'plank', accent: '#b8986a' },
        wall: { color: '#f2e6d0', trim: '#4a5a6a', wainscot: '#d8c8a8' },
        lighting: 'home',
        furniture: [
          { type: 'counter', position: [0, -3.2], size: [4.6, 0.95, 0.8], color: '#8a6a48', accent: '#e07a8a' },
          { type: 'rug', position: [0, 1], size: [4, 0.02, 3], color: '#e07a8a', accent: '#fff4e0' },
          { type: 'pool', position: [-4, 2.2], size: [2.4, 0.3, 2.0], color: '#7ac8d8' },
          { type: 'bed', position: [4.4, -2.6], color: '#8a6a48', accent: '#f2c8a0', interact: 'breeder-egg-bed' },
          { type: 'shelf', position: [-4.6, -3.95], size: [1.8, 1.4, 0.45], color: '#8a6a48', interact: 'breeder-shelf' },
          { type: 'plant', position: [5.2, 3.6] },
          { type: 'plant', position: [-5.2, -0.6] },
          { type: 'window', position: [2.4, -4.5], size: [1.4, 1.0, 0.1] },
          { type: 'lamp', position: [5.2, -0.6], color: '#f6e7b5' },
        ],
        exits: [frontDoor(9)],
        npcs: [
          { id: 'spring-breeder-lady', position: [0, -2.2], yaw: 0 },
          { id: 'spring-breeder-man', position: [3.2, 1.4], yaw: -PI / 2 },
        ],
      },
    ],
  },

  // ————————————————————————— 温泉旅馆「汤之庭」 —————————————————————————
  {
    id: 'spring-inn',
    name: '温泉旅馆「汤之庭」',
    entryRoom: 'lobby',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'lobby',
        name: '汤之庭 · 大堂',
        size: [16, 11, 3.4],
        floor: { color: '#c8b088', pattern: 'plank', accent: '#b89e76' },
        wall: { color: '#f2e6d0', trim: '#3f4a5a', wainscot: '#d8c8a8' },
        lighting: 'home',
        furniture: [
          { type: 'counter', position: [-4, -4.3], size: [4.4, 0.95, 0.8], color: '#6a5038', accent: '#3f6db5' },
          { type: 'rug', position: [1.8, 0.6], size: [5, 0.02, 3.4], color: '#3f6db5', accent: '#f2e6d0' },
          { type: 'sofa', position: [1.8, 2.4], yaw: PI, color: '#6a5038', accent: '#e8d8b8' },
          { type: 'table', position: [1.8, 0.6], size: [1.6, 0.45, 0.9], color: '#6a5038' },
          { type: 'sofa', position: [1.8, -1.4], yaw: 0, color: '#6a5038', accent: '#e8d8b8' },
          { type: 'bookshelf', position: [7.55, -2], yaw: -PI / 2, size: [2.2, 2.0, 0.5], color: '#6a5038', interact: 'inn-history-books' },
          { type: 'poster', position: [2, -5.5], size: [2.0, 1.2, 0.02], color: '#3f6db5', accent: '#f2e6d0', interact: 'inn-mural' },
          { type: 'plant', position: [-7.2, 4.6] },
          { type: 'plant', position: [7.2, 4.6] },
          { type: 'lamp', position: [-7.2, -4.6], color: '#f6e7b5' },
          { type: 'window', position: [-7.96, 0], yaw: PI / 2 },
        ],
        exits: [
          frontDoor(11),
          { id: 'rooms', position: [6.6, 3.6], radius: 0.9, spawnOffset: [-1.2, 0], spawnYaw: -PI / 2, to: { room: 'guest', exit: 'hall' }, label: '去客房' },
        ],
        npcs: [
          { id: 'inn-owner', position: [-4, -3.4], yaw: 0 },
          { id: 'inn-grandma', position: [4.6, 0.6], yaw: -PI / 2 },
        ],
      },
      {
        id: 'guest',
        name: '汤之庭 · 客房',
        size: [9, 8, 3],
        floor: { color: '#d8c898', pattern: 'checker', accent: '#c8b888' },
        wall: { color: '#f6ecd8', trim: '#3f4a5a', wainscot: '#e0d0b0' },
        lighting: 'home',
        furniture: [
          { type: 'bed', position: [-2.4, -2.2], color: '#6a5038', accent: '#f2f2f2', interact: 'inn-bed' },
          { type: 'bed', position: [0.4, -2.2], color: '#6a5038', accent: '#f2f2f2' },
          { type: 'table', position: [2.8, 1.2], size: [1.2, 0.4, 0.9], color: '#6a5038' },
          { type: 'lamp', position: [3.8, -3.2], color: '#f6e7b5' },
          { type: 'window', position: [-1, -4], size: [1.6, 1.1, 0.1] },
        ],
        exits: [{ id: 'hall', position: [-3.8, 2.8], radius: 0.9, spawnOffset: [1.2, 0], spawnYaw: PI / 2, to: { room: 'lobby', exit: 'rooms' }, label: '回大堂' }],
      },
    ],
  },

  // ————————————————————————— 异变遗迹（三层：前殿 → 壁画回廊 → 守护者圣所） —————————————————————————
  {
    id: 'tide-ruins',
    name: '异变遗迹',
    entryRoom: 'hall',
    entryExit: 'front',
    bgm: 'cave',
    rooms: [
      {
        id: 'hall',
        name: '异变遗迹 · 前殿',
        size: [20, 26, 7],
        floor: { color: '#6a6470', pattern: 'tile', accent: '#5a5462' },
        wall: { color: '#5a5462', trim: '#3a3442', relief: 'wave', reliefColor: '#7a6a8a' },
        lighting: 'cave',
        encounters: { table: 'anomaly-ruins', ratePerMeter: 0.04 },
        furniture: [
          { type: 'column', position: [-6, 6], color: '#7a7484', accent: '#9a5ae0' },
          { type: 'column', position: [6, 6], color: '#7a7484', accent: '#9a5ae0' },
          { type: 'column', position: [-6, -2], color: '#7a7484', accent: '#9a5ae0' },
          { type: 'column', position: [6, -2], color: '#7a7484', accent: '#9a5ae0' },
          { type: 'column', position: [-6, -9], color: '#7a7484', accent: '#9a5ae0' },
          { type: 'column', position: [6, -9], color: '#7a7484', accent: '#9a5ae0' },
          { type: 'boulder', position: [-8.2, 2], size: [1.8, 1.2, 1.6], color: '#6a6470' },
          { type: 'boulder', position: [8.4, -5.6], size: [2.0, 1.4, 1.6], color: '#6a6470' },
          { type: 'crystal', position: [-8.6, -11], color: '#b48cff' },
          { type: 'crystal', position: [8.6, 10], color: '#b48cff' },
          { type: 'poster', position: [-9.96, 4], yaw: PI / 2, size: [1.6, 1.2, 0.02], color: '#5a5462', accent: '#b48cff', interact: 'ruins-inscription-1' },
          { type: 'rug', position: [0, 0], size: [3, 0.02, 22], color: '#4a4452', accent: '#9a5ae0' },
        ],
        exits: [
          frontDoor(26),
          { id: 'down', position: [0, -12.2], radius: 1.1, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'gallery', exit: 'up' }, label: '进入回廊' },
        ],
        triggers: [{ id: 'ruins-enter', position: [0, 9], radius: 3, script: 'ruins-enter', doneFlag: 'ruins-entered' }],
      },
      {
        id: 'gallery',
        name: '异变遗迹 · 壁画回廊',
        size: [28, 14, 6],
        floor: { color: '#5a5462', pattern: 'tile', accent: '#4a4452' },
        wall: { color: '#4a4452', trim: '#2c2834', relief: 'wave', reliefColor: '#6a5a7a' },
        lighting: 'cave',
        encounters: { table: 'anomaly-ruins', ratePerMeter: 0.045 },
        furniture: [
          { type: 'poster', position: [-9, -6.96], size: [3.0, 1.8, 0.02], color: '#4a4452', accent: '#e8484a', interact: 'ruins-mural-1' },
          { type: 'poster', position: [-3, -6.96], size: [3.0, 1.8, 0.02], color: '#4a4452', accent: '#f08a3c', interact: 'ruins-mural-2' },
          { type: 'poster', position: [3, -6.96], size: [3.0, 1.8, 0.02], color: '#4a4452', accent: '#9a5ae0', interact: 'ruins-mural-3' },
          { type: 'poster', position: [9, -6.96], size: [3.0, 1.8, 0.02], color: '#4a4452', accent: '#7fc8e8', interact: 'ruins-mural-4' },
          { type: 'column', position: [-12, 0], color: '#6a6470', accent: '#9a5ae0' },
          { type: 'column', position: [12, 0], color: '#6a6470', accent: '#9a5ae0' },
          { type: 'crystal', position: [-12.6, 5.6], color: '#b48cff' },
          { type: 'crystal', position: [12.6, 5.6], color: '#b48cff' },
          { type: 'boulder', position: [-6, 4.4], size: [1.6, 1.0, 1.4], color: '#5a5462' },
          { type: 'boulder', position: [7, 4.6], size: [1.4, 0.9, 1.2], color: '#5a5462' },
        ],
        exits: [
          { id: 'up', position: [-12.6, -2.8], radius: 1.1, spawnOffset: [1.6, 0], spawnYaw: PI / 2, to: { room: 'hall', exit: 'down' }, label: '回到前殿' },
          { id: 'sanctum', position: [12.6, -2.8], radius: 1.1, spawnOffset: [-1.6, 0], spawnYaw: -PI / 2, to: { room: 'sanctum', exit: 'back' }, label: '进入圣所' },
        ],
      },
      {
        id: 'sanctum',
        name: '异变遗迹 · 守护者圣所',
        size: [22, 24, 9],
        floor: { color: '#4a4452', pattern: 'checker', accent: '#3a3442' },
        wall: { color: '#3a3442', trim: '#9a5ae0', relief: 'wave', reliefColor: '#5a4a6a' },
        lighting: 'cave',
        battleStage: { position: [0, 2], yaw: PI, radius: 7 },
        furniture: [
          { type: 'dais', position: [0, -8.4], size: [8, 0.6, 3.4], color: '#5a5462', accent: '#9a5ae0' },
          { type: 'emblem', position: [0, -11.96], size: [3.2, 3.2, 0.02], y: 5.4, color: '#3a3442', accent: '#b48cff' },
          { type: 'column', position: [-7.6, -8], size: [1.6, 9, 1.6], color: '#6a6470', accent: '#9a5ae0' },
          { type: 'column', position: [7.6, -8], size: [1.6, 9, 1.6], color: '#6a6470', accent: '#9a5ae0' },
          { type: 'column', position: [-7.6, 2], size: [1.6, 9, 1.6], color: '#6a6470', accent: '#9a5ae0' },
          { type: 'column', position: [7.6, 2], size: [1.6, 9, 1.6], color: '#6a6470', accent: '#9a5ae0' },
          { type: 'crystal', position: [-4, -9.6], size: [0.8, 1.8, 0.8], color: '#b48cff' },
          { type: 'crystal', position: [4, -9.6], size: [0.8, 1.8, 0.8], color: '#b48cff' },
          { type: 'skylight', position: [0, -3], size: [4, 0.3, 4], y: 8.6, color: '#b48cff' },
          { type: 'rug', position: [0, 0], size: [10, 0.02, 10], color: '#3a3442', accent: '#9a5ae0' },
          // 守护者的石座（战胜前守护者沉睡在上面；剧情战斗时苏醒）
          { type: 'boulder', position: [0, -8.6], size: [2.6, 2.8, 2.0], color: '#8a7a64', interact: 'guardian-seat' },
          // 落石后的侧室：遗迹宝物
          { type: 'crate', position: [10.2, -11.2], size: [0.8, 0.6, 0.8], color: '#6a5a7a', noCollide: true, interact: 'ruins-hidden-item' },
        ],
        // 守护者身后的落石（碎岩后可通往遗迹深处的小间：隐藏道具）
        blockers: [{ id: 'ruins-rubble', type: 'rock-smash', requiresFlag: 'hm05-rock-smash', position: [9.2, -10.4], size: [3.6, 2.4, 3.2], hint: '裂开的落石堵住了侧室……似乎能用「碎岩」撞开。' }],
        triggers: [
          { id: 'ruins-sanctum', position: [-8, 7], radius: 3, script: 'ruins-sanctum', doneFlag: 'ruins-sanctum-reached' },
          { id: 'ruins-guardian', position: [0, -3.5], radius: 3.2, script: 'ruins-guardian', doneFlag: 'ruins-guardian-defeated', repeat: true, showIf: ['ruins-sanctum-reached'] },
        ],
        exits: [{ id: 'back', position: [-10.6, 9.2], radius: 1.1, spawnOffset: [1.6, 0], spawnYaw: PI / 2, to: { room: 'gallery', exit: 'sanctum' }, label: '回到回廊' }],
      },
    ],
  },
];

/**
 * M1-03 · 翠澜镇（设计 §3.2「湖畔水乡，道馆在湖中」）。
 *
 * 陆上（x -95…15，地面 8.5 m）：南北向石板主街（town-cuilan-main），西侧宝可梦中心 / 友好商店 / 民居，
 * 东侧民居；主街中段向东的「临湖路」直通湖岸广场与道馆栈桥。街上挂灯笼、彩旗，早市摊位。
 * 湖上（湖面 5 m，平台顶面 6.1 m）：沿岸南北向主栈道（x 24…28），三条连岸栈道；
 * 主栈道东侧与外环栈道（x 44…48）两侧是高脚屋，外环南端为钓台；芦苇、睡莲、系泊的小划艇。
 * 道馆栈桥（bridge-gym）从主栈道东侧出发通往湖心道馆。
 */
import type { PropInstance, TownLayout, Vec2 } from '../types';
import { atDoor, deck, FACE, lamps, prop, trees } from './helpers';

/** 湖上平台顶面高度（湖面 5 + 1.1，与道馆栈桥一致） */
export const CUILAN_DECK_Y = 6.1;
const Y = CUILAN_DECK_Y;

/** 主栈道：x 24…28，z -125…5 */
const PROM: { x: number; z0: number; z1: number } = { x: 26, z0: -125, z1: 5 };
const promC = (PROM.z0 + PROM.z1) / 2;
/** 主栈道东侧高脚屋（门朝西） */
const EAST_HOUSES = [-118, -30, -15, -1];
/** 外环栈道两侧高脚屋 */
const RING_WEST = [-103, -77];
const RING_EAST = [-102, -78];
const SHORE_LINKS = [-100, -55, -15];

function stilt(center: Vec2, yaw: number, seed: number, roof: string, wall = '#f1e6cf', accent = '#c8503c'): PropInstance {
  return { type: 'stilt-house', position: center, yaw, size: [8, 5.6, 7], y: Y, color: wall, roof, accent, seed };
}

const ROOFS = ['#3f6f8f', '#5b8a5a', '#8a5a3c', '#46708a', '#6b6b8a', '#9a5a48'];

const waterTown: PropInstance[] = [
  // 主栈道：东侧开口 = 高脚屋 + 道馆栈桥 + 通往外环的横栈道；西侧开口 = 连岸栈道
  deck([PROM.x, promC], 4, PROM.z1 - PROM.z0, Y, 'nsew', [
    ...EAST_HOUSES.map((z): [string, number, number] => ['e', z - promC, 1.8]),
    ['e', -55 - promC, 3.2],
    ['e', -90 - promC, 4],
    ...SHORE_LINKS.map((z): [string, number, number] => ['w', z - promC, z === -55 ? 6 : 3.4]),
  ]),
  // 连岸栈道（西端埋进岸坡）
  ...SHORE_LINKS.map((z) => deck([18, z], 12, z === -55 ? 6 : 3.4, Y, 'ns')),
  // 主栈道东侧高脚屋（正面朝西对着栈道）
  ...EAST_HOUSES.map((z, i) => stilt([PROM.x + 2 + 3.5, z], FACE.west, 400 + i, ROOFS[i % ROOFS.length]!)),
  // 通往外环的横栈道 + 外环
  deck([36, -90], 16, 4, Y, 'ns'),
  deck([46, -90], 4, 40, Y, 'nsew', [
    ['w', 0, 4],
    ['s', 0, 4],
    ...RING_WEST.map((z): [string, number, number] => ['w', z + 90, 1.8]),
    ...RING_EAST.map((z): [string, number, number] => ['e', z + 90, 1.8]),
  ]),
  ...RING_WEST.map((z, i) => stilt([44 - 3.5, z], FACE.east, 420 + i, ROOFS[(i + 2) % ROOFS.length]!, '#efe2c8')),
  ...RING_EAST.map((z, i) => stilt([48 + 3.5, z], FACE.west, 430 + i, ROOFS[(i + 4) % ROOFS.length]!, '#f4ead7', '#d9a441')),
  // 外环南端钓台
  deck([46, -66.5], 9, 7, Y, 'sew'),
  { type: 'bench', position: [43, -64], yaw: FACE.south, size: [1.6, 0.9, 0.6], y: Y },
  { type: 'bench', position: [49, -64], yaw: FACE.south, size: [1.6, 0.9, 0.6], y: Y },
  { type: 'barrel', position: [49.8, -69.5], yaw: 0, size: [0.8, 1, 0.8], y: Y },
  // 栈道灯笼：主栈道西侧每 13 m，外环东侧
  ...[-120, -107, -94, -80, -68, -42, -28, -8, 3].map((z): PropInstance => ({ type: 'lantern', position: [PROM.x - 1.6, z], yaw: 0, size: [0.3, 3.2, 0.3], y: Y })),
  ...[-106, -94, -84, -72].map((z): PropInstance => ({ type: 'lantern', position: [46 - 1.6, z], yaw: 0, size: [0.3, 3.2, 0.3], y: Y, color: '#f2b134' })),
  // 系泊小划艇、浮标
  { type: 'rowboat', position: [33, -46], yaw: 0.3, size: [1.6, 0.6, 4], y: 5.05, color: '#5b93a8' },
  { type: 'rowboat', position: [31, -128], yaw: -0.4, size: [1.6, 0.6, 4], y: 5.05, color: '#d9674e' },
  { type: 'rowboat', position: [55, -62], yaw: 1.2, size: [1.6, 0.6, 4], y: 5.05, color: '#f2f0e6' },
  { type: 'rowboat', position: [34, 8], yaw: 0.9, size: [1.6, 0.6, 4], y: 5.05, color: '#6aa56b' },
  { type: 'buoy', position: [60, -40], yaw: 0, size: [1, 2, 1], y: 5 },
  { type: 'buoy', position: [62, -115], yaw: 0, size: [1, 2, 1], y: 5, color: '#f2f0e6' },
  // 芦苇与睡莲
  ...([[21, -132], [20, -142], [22, 12], [21, 20], [23, -74], [23, -36]] as Vec2[]).map((p, i): PropInstance => ({ type: 'reeds', position: p, yaw: 0, size: [3, 2, 3], seed: 500 + i })),
  ...([[38, -40], [40, -126], [60, -95], [36, 12], [58, -72], [34, -74]] as Vec2[]).map((p, i): PropInstance => ({ type: 'lilypads', position: p, yaw: i, size: [5, 0.1, 5], y: 5.02, seed: 520 + i })),
];

const land: PropInstance[] = [
  // 宝可梦中心 / 友好商店（门朝东，对着主街）
  atDoor('pokecenter', [-40, -10], FACE.east, [15, 7.5, 12], { ref: 'pokecenter-cuilan', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [-55, -70], FACE.east, [12, 6.5, 10], { ref: 'mart-cuilan', color: '#f4f6f8', roof: '#3f7fd6' }),
  // 主街西侧民居（门朝东）
  atDoor('house', [-42, -38], FACE.east, [9, 6.2, 8], { color: '#f1e6cf', roof: '#3f6f8f', variant: 'timber', seed: 71 }),
  atDoor('house', [-42, -95], FACE.east, [10, 7.4, 8], { color: '#efe2c8', roof: '#5b8a5a', variant: 'two-storey', seed: 72 }),
  atDoor('house', [-42, -120], FACE.east, [9, 5.6, 8], { color: '#f4ead7', roof: '#8a5a3c', variant: 'cottage', seed: 73 }),
  atDoor('house', [-70, -110], FACE.east, [9, 6, 8], { color: '#f2e6d0', roof: '#46708a', variant: 'gable', seed: 74 }),
  atDoor('house', [-72, -20], FACE.east, [9, 6, 8], { color: '#efe3c6', roof: '#9a5a48', variant: 'timber', seed: 75 }),
  // 主街东侧民居（门朝西）
  atDoor('house', [-22, -30], FACE.west, [9, 6.2, 8], { color: '#f4ead7', roof: '#6b6b8a', variant: 'gable', seed: 76 }),
  atDoor('house', [-22, -85], FACE.west, [9, 6, 8], { color: '#f1e6cf', roof: '#3f6f8f', variant: 'timber', seed: 77 }),
  atDoor('house', [-22, -112], FACE.west, [10, 7.4, 8], { color: '#efe2c8', roof: '#5b8a5a', variant: 'two-storey', seed: 78 }),
  atDoor('house', [-22, -140], FACE.west, [9, 5.6, 8], { color: '#f2e6d0', roof: '#8a5a3c', variant: 'cottage', seed: 79 }),

  // 湖岸广场：海星星雕像（道馆象征）、水井、长椅面湖、花坛
  prop('statue', [-4, -44.5], [1.8, 4.2, 1.8], { variant: 'star', color: '#d9a441' }),
  prop('well', [-4, -66], [2.4, 2.8, 2.4]),
  { type: 'bench', position: [10.5, -46], yaw: FACE.east, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [10.5, -64], yaw: FACE.east, size: [1.8, 0.9, 0.6] },
  prop('flowerbed', [2, -46], [1.8, 0.5, 1.8], { variant: 'round', seed: 81 }),
  prop('flowerbed', [2, -64], [1.8, 0.5, 1.8], { variant: 'round', seed: 82 }),
  { type: 'noticeboard', position: [-12, -48.5], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'sign', position: [8.5, -58.8], yaw: FACE.east, size: [1.6, 1.6, 0.2] },

  // 早市（临湖路两侧）
  { type: 'market-stall', position: [-19, -48.5], yaw: FACE.south, size: [3.6, 2.8, 2.6], roof: '#c8503c', variant: 'fish', seed: 83 },
  { type: 'market-stall', position: [-19, -61.5], yaw: FACE.north, size: [3.6, 2.8, 2.6], roof: '#5b8a5a', variant: 'fruit', seed: 84 },
  { type: 'market-stall', position: [-11, -61.5], yaw: FACE.north, size: [3.6, 2.8, 2.6], roof: '#d9a441', variant: 'berry', seed: 85 },
  { type: 'bunting', position: [-30, -55], yaw: 0, size: [1, 4.6, 1], points: [[-26.5, -51], [-12, -51], [4, -51]], seed: 86 },
  { type: 'bunting', position: [-30, -55], yaw: 0, size: [1, 4.6, 1], points: [[-26.5, -59], [-12, -59], [4, -59]], seed: 87 },

  // 主街灯笼（两侧交错）+ 彩旗
  ...[-15, -45, -75, -105, -130].map((z): PropInstance => ({ type: 'lantern', position: [-35, z], yaw: 0, size: [0.3, 3.6, 0.3] })),
  ...[-30, -60, -90, -120].map((z): PropInstance => ({ type: 'lantern', position: [-25, z], yaw: Math.PI, size: [0.3, 3.6, 0.3] })),
  { type: 'bunting', position: [-30, -100], yaw: 0, size: [1, 4.8, 1], points: [[-34.5, -80], [-25.5, -80]], seed: 88 },
  { type: 'bunting', position: [-30, -100], yaw: 0, size: [1, 4.8, 1], points: [[-34.5, -100], [-25.5, -100]], seed: 89 },
  { type: 'bunting', position: [-30, -100], yaw: 0, size: [1, 4.8, 1], points: [[-34.5, -24], [-25.5, -24]], seed: 90 },

  // 镇口（北）：灯笼门 + 木牌
  { type: 'lantern', position: [-31.5, 20], yaw: Math.PI, size: [0.3, 4, 0.3] },
  { type: 'lantern', position: [-20.5, 22], yaw: 0, size: [0.3, 4, 0.3] },
  { type: 'sign', position: [-17, 26], yaw: FACE.north, size: [1.6, 1.6, 0.2] },

  // 生活气息：晾衣、盆景花坛、木桶、菜园
  { type: 'laundry', position: [-54, -38], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 91 },
  { type: 'laundry', position: [-9, -86], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 92 },
  prop('garden', [-60, -128], [6, 0.4, 5], { variant: 'veg', seed: 93 }),
  prop('barrel', [-47.5, -63.5], [0.8, 1, 0.8]),
  prop('barrel', [-48.4, -62.4], [0.8, 1, 0.8], { color: '#7a5a32' }),
  prop('crate', [-48, -76.5], [1, 1, 1], { yaw: 0.4 }),
  prop('flowerbed', [-38, -26], [2.4, 0.4, 1.2], { seed: 94, yaw: FACE.east }),
  prop('flowerbed', [-24, -44], [2.4, 0.4, 1.2], { seed: 95, yaw: FACE.east }),
  { type: 'hedge', position: [-38, -133], yaw: 0, size: [7, 1.1, 0.9], seed: 4 },

  // 湖岸与街边树木（柳 / 樱 / 松）
  ...trees(
    [
      [12, -30, 7.5, 'blossom'], [13, -80, 7, 'blossom'], [12, -118, 7.5], [12, 12, 7], [8, -138, 6.5, 'blossom'],
      [-85, -60, 8, 'pine'], [-85, -85, 7], [-80, -135, 7.5, 'pine'], [-88, 0, 7], [-60, 30, 6.5],
      [-10, 30, 7], [0, -10, 5, 'shrub'], [-8, -100, 5, 'shrub'], [-62, -50, 6], [-50, -150, 7, 'pine'],
    ],
    600,
  ),
  ...lamps([[-9, -44], [-9, -66]]),
];

export const CUILAN_TOWN: TownLayout = {
  id: 'cuilan-town',
  zone: 'cuilan-town',
  paths: [
    { id: 'town-cuilan-main', surface: 'stone', width: 7, points: [[-30, -20], [-30, -145]] },
    { id: 'town-cuilan-lakeway', surface: 'stone', width: 6, points: [[-30, -55], [14, -55]] },
    { id: 'town-cuilan-shore', surface: 'stone', width: 12, points: [[2, -44], [2, -66]] },
    { id: 'town-cuilan-center-walk', surface: 'stone', width: 3.5, points: [[-39.4, -10], [-30, -10]] },
    { id: 'town-cuilan-mart-walk', surface: 'stone', width: 3.5, points: [[-54.4, -70], [-30, -70]] },
    { id: 'town-cuilan-shore-north', surface: 'dirt', width: 3, points: [[-30, -15], [12, -15]] },
    { id: 'town-cuilan-shore-south', surface: 'dirt', width: 3, points: [[-30, -100], [12, -100]] },
    { id: 'town-cuilan-west-lane', surface: 'dirt', width: 3, points: [[-30, -110], [-69.4, -110]] },
    { id: 'town-cuilan-west-lane-2', surface: 'dirt', width: 3, points: [[-30, -25], [-71.4, -20]] },
  ],
  props: [...land, ...waterTown],
};

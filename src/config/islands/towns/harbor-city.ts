/**
 * M1-04 · 港湾市（设计 §3.2：东岸港口城市，渡船码头 / 市场 / 灯塔）。
 *
 * 布局（地面约 3.2 m，海岸 x≈440）：
 *   - 港湾大街（town-harbor-street，东西向）北侧：宝可梦中心、三栋商住楼；南侧：两栋商住楼
 *   - 大街以南：市集广场（两排摊位 + 彩旗）→ 港湾大市场（可进入）
 *   - 西侧南北向住宅巷，两侧民居
 *   - 东侧码头区：压平的石砌码头（海堤 + 系缆桩），候船楼、渡船栈桥与渡轮、钓鱼栈桥、鱼市棚、
 *     仓库、集装箱堆、两台门式起重机
 *   - 北端海岬：灯塔 + 守塔人小屋；候船楼西侧锚形纪念碑小广场
 */
import type { PropInstance, TownLayout, Vec2 } from '../types';
import { atDoor, deck, FACE, fence, lamps, prop, trees } from './helpers';

/** 码头压平高度与栈桥顶面 */
export const HARBOR_QUAY_Y = 2.6;
const QY = HARBOR_QUAY_Y;
const PIER_Y = 2.4;

const CONTAINER_COLORS = ['#c8503c', '#2f6db5', '#e0a13a', '#5b8a5a', '#8a6fb0', '#46708a'];

function containers(origin: Vec2, cols: number, rows: number, stack: number[], seed: number): PropInstance[] {
  const out: PropInstance[] = [];
  let k = seed;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const h = stack[(i * rows + j) % stack.length] ?? 1;
      for (let s = 0; s < h; s++) {
        out.push({ type: 'container', position: [origin[0] + i * 2.7, origin[1] + j * 6.4], yaw: 0, size: [2.4, 2.6, 6], y: QY + s * 2.6, color: CONTAINER_COLORS[k++ % CONTAINER_COLORS.length]! });
      }
    }
  return out;
}

const quay: PropInstance[] = [
  { type: 'seawall', position: [441.2, 40], yaw: 0, size: [1.6, 5.2, 200], y: QY },
  // 渡船栈桥 + 渡轮
  deck([453.5, 25], 25, 6, PIER_Y, 'nse'),
  { type: 'boat', position: [458, 15.5], yaw: Math.PI / 2, size: [7, 5, 20], y: 0, color: '#f5f5f0', roof: '#2f6db5', collide: true, ref: 'ferry-boat' },
  { type: 'bollard', position: [463, 22.6], yaw: 0, size: [0.4, 0.6, 0.4], y: PIER_Y },
  { type: 'bollard', position: [452, 22.6], yaw: 0, size: [0.4, 0.6, 0.4], y: PIER_Y },
  { type: 'lantern', position: [465, 27.5], yaw: 0, size: [0.3, 3.6, 0.3], y: PIER_Y, color: '#f2b134' },
  // 钓鱼栈桥（T 形）
  deck([457, 115], 30, 4, PIER_Y, 'nse', [['e', 0, 4]]),
  deck([474, 115], 6, 14, PIER_Y, 'nse', [['w', 0, 4]]),
  { type: 'bench', position: [474, 110], yaw: FACE.east, size: [1.6, 0.9, 0.6], y: PIER_Y },
  { type: 'bench', position: [474, 120], yaw: FACE.east, size: [1.6, 0.9, 0.6], y: PIER_Y },
  { type: 'barrel', position: [476, 121.2], yaw: 0, size: [0.8, 1, 0.8], y: PIER_Y },
  { type: 'lantern', position: [462, 113.2], yaw: 0, size: [0.3, 3.4, 0.3], y: PIER_Y },
  { type: 'rowboat', position: [466, 108], yaw: 1.4, size: [1.8, 0.6, 4.4], y: 0.05, color: '#d9674e' },
  { type: 'rowboat', position: [448, 121], yaw: -1.3, size: [1.7, 0.6, 4.2], y: 0.05, color: '#5b93a8' },
  { type: 'buoy', position: [488, 95], yaw: 0, size: [1, 2, 1], y: 0 },
  { type: 'buoy', position: [490, 40], yaw: 0, size: [1, 2, 1], y: 0, color: '#f2f0e6' },
  { type: 'buoy', position: [486, -20], yaw: 0, size: [1, 2, 1], y: 0 },
  // 鱼市棚
  { type: 'shed', position: [428, 108], yaw: FACE.east, size: [10, 4.6, 6], roof: '#2f6db5', variant: 'fish', y: QY },
  // 起重机 + 集装箱 + 货箱木桶
  { type: 'crane', position: [433, -28], yaw: 0, size: [7, 15, 5], color: '#e0a13a', y: QY },
  { type: 'crane', position: [433, 70], yaw: 0, size: [7, 15, 5], color: '#c8503c', y: QY },
  ...containers([424, -44], 3, 2, [2, 1, 3, 1, 2, 1], 0),
  ...containers([424, 78], 2, 2, [1, 2, 1, 3], 3),
  ...([[436, 48], [437.2, 49.1], [436.4, 50.4], [429, 92], [430.2, 93], [436, 136]] as Vec2[]).map((p, i): PropInstance => ({ type: 'crate', position: p, yaw: i * 0.7, size: [1.2, 1.2, 1.2], y: QY })),
  ...([[437, 5], [437.8, 6], [436.6, 7], [425, 99], [437, 140]] as Vec2[]).map((p, i): PropInstance => ({ type: 'barrel', position: p, yaw: 0, size: [0.8, 1, 0.8], y: QY, color: i % 2 ? '#7a5a32' : '#9b6b43' })),
  // 码头路灯
  ...([[438, -10], [438, 40], [438, 60], [438, 95], [438, 130]] as Vec2[]).map((p): PropInstance => ({ type: 'lamp', position: p, yaw: Math.PI, size: [0.3, 4.6, 0.3], y: QY })),
];

const town: PropInstance[] = [
  // 宝可梦中心（门朝南对着大街）
  atDoor('pokecenter', [350, 10], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-harbor', color: '#fbf5ee', roof: '#e25a4f' }),
  // 大街北侧商住楼（门朝南）
  atDoor('house', [368, 30], FACE.south, [10, 9.5, 9], { variant: 'townhouse', color: '#f2e6d0', roof: '#8a5a3c', accent: '#c8503c', seed: 801 }),
  atDoor('house', [381, 30], FACE.south, [10, 12, 9], { variant: 'townhouse', color: '#e8dcc6', roof: '#46708a', accent: '#2f6db5', seed: 802 }),
  atDoor('house', [394, 30], FACE.south, [10, 9.5, 9], { variant: 'townhouse', color: '#f4ead7', roof: '#5b8a5a', accent: '#5b8a5a', seed: 803 }),
  atDoor('house', [322, 30], FACE.south, [10, 9.5, 9], { variant: 'townhouse', color: '#efe2c8', roof: '#9a5a48', accent: '#e0a13a', seed: 804 }),
  atDoor('house', [335, 30], FACE.south, [10, 12, 9], { variant: 'townhouse', color: '#f7f1e6', roof: '#3f6f8f', accent: '#8a6fb0', seed: 805 }),
  // 大街南侧商住楼（门朝北）
  atDoor('house', [322, 46], FACE.north, [10, 9.5, 9], { variant: 'townhouse', color: '#f2e6d0', roof: '#6b6b8a', accent: '#46708a', seed: 806 }),
  atDoor('house', [335, 46], FACE.north, [10, 12, 9], { variant: 'townhouse', color: '#e8dcc6', roof: '#8a5a3c', accent: '#c85d7c', seed: 807 }),

  // 市集广场：两排摊位面对面，中间走道
  ...[356, 365, 374, 383, 392, 401].map((x, i): PropInstance => ({ type: 'market-stall', position: [x, 57.5], yaw: FACE.south, size: [4, 3, 3], roof: ['#e25a4f', '#f2b134', '#3f9fd6', '#6aa56b', '#c85d7c', '#8a6fb0'][i]!, variant: ['fruit', 'fish', 'goods', 'berry', 'fruit', 'goods'][i]!, seed: 820 + i })),
  ...[356, 365, 383, 392, 401].map((x, i): PropInstance => ({ type: 'market-stall', position: [x, 76.5], yaw: FACE.north, size: [4, 3, 3], roof: ['#3f9fd6', '#e25a4f', '#6aa56b', '#f2b134', '#e25a4f'][i]!, variant: ['fish', 'berry', 'fruit', 'goods', 'fish'][i]!, seed: 830 + i })),
  { type: 'bunting', position: [378, 67], yaw: 0, size: [1, 5, 1], points: [[352, 62], [378, 64], [405, 62]], seed: 840 },
  { type: 'bunting', position: [378, 67], yaw: 0, size: [1, 5, 1], points: [[352, 72], [378, 70], [405, 72]], seed: 841 },
  ...lamps([[350, 62], [350, 72], [407, 62], [407, 72]]),
  // 港湾大市场（门朝北对着广场）
  atDoor('market-hall', [380, 90], FACE.north, [26, 10, 16], { ref: 'harbor-market', color: '#efe2c8', roof: '#46708a', seed: 850 }),
  prop('flowerbed', [372, 88], [3, 0.4, 1.2], { seed: 851 }),
  prop('flowerbed', [388, 88], [3, 0.4, 1.2], { seed: 852 }),

  // 候船楼（门朝东对着码头）+ 纪念碑小广场
  atDoor('terminal', [417.2, 14], FACE.east, [14, 8, 9], { ref: 'harbor-terminal', color: '#f4f6f8', roof: '#2f6db5' }),
  prop('statue', [383, 4], [1.8, 4.6, 1.8], { variant: 'anchor', color: '#5d6d7e' }),
  { type: 'bench', position: [376, 4], yaw: FACE.east, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [390, 4], yaw: FACE.west, size: [1.8, 0.9, 0.6] },
  prop('flowerbed', [383, -2.5], [4, 0.4, 1.4], { seed: 861 }),
  prop('flowerbed', [383, 10.5], [4, 0.4, 1.4], { seed: 862 }),
  ...lamps([[370, -3], [396, -3], [370, 11], [396, 11]]),
  { type: 'noticeboard', position: [400, 18], yaw: FACE.south, size: [2, 2.2, 0.3] },

  // 仓库（门朝东对码头）
  atDoor('warehouse', [418, -22], FACE.east, [16, 8, 11], { color: '#d9cbb4', roof: '#8b6f55', seed: 871 }),
  atDoor('warehouse', [418, 124], FACE.east, [16, 8, 11], { color: '#cfc4b0', roof: '#6d7f8c', seed: 872 }),
  atDoor('warehouse', [418, 142], FACE.east, [14, 7, 10], { color: '#d9cbb4', roof: '#8b6f55', seed: 873 }),

  // 住宅巷（x 345）两侧民居
  atDoor('house', [340, 72], FACE.east, [9, 6.2, 8], { color: '#f4ead7', roof: '#d9674e', variant: 'gable', seed: 881 }),
  atDoor('house', [340, 94], FACE.east, [9, 7.2, 8], { color: '#efe2c8', roof: '#4f7fc9', variant: 'two-storey', seed: 882 }),
  atDoor('house', [340, 116], FACE.east, [9, 5.6, 8], { color: '#f7f1e6', roof: '#6aa56b', variant: 'cottage', seed: 883 }),
  atDoor('house', [340, 138], FACE.east, [9, 6.2, 8], { color: '#f2e6d0', roof: '#a7695a', variant: 'gable', seed: 884 }),
  atDoor('house', [350, 102], FACE.west, [9, 6, 8], { color: '#e8dcc6', roof: '#5b93a8', variant: 'gable', seed: 885 }),
  atDoor('house', [350, 124], FACE.west, [9, 7.2, 8], { color: '#f4ead7', roof: '#c85d7c', variant: 'two-storey', seed: 886 }),
  atDoor('house', [350, 142], FACE.west, [9, 5.6, 8], { color: '#efe2c8', roof: '#e0a13a', variant: 'cottage', seed: 887 }),
  { type: 'laundry', position: [329, 84], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 888 },
  prop('garden', [327, 127], [5, 0.4, 6], { variant: 'veg', seed: 889 }),
  // 北部（往海崖方向）
  atDoor('house', [350, -40], FACE.east, [9, 6, 8], { color: '#f2e6d0', roof: '#46708a', variant: 'timber', seed: 891 }),
  atDoor('house', [372, -45], FACE.west, [9, 5.6, 8], { color: '#f7f1e6', roof: '#9a5a48', variant: 'cottage', seed: 892 }),
  atDoor('house', [330, 5], FACE.east, [9, 6.2, 8], { color: '#efe2c8', roof: '#5b8a5a', variant: 'gable', seed: 893 }),

  // 灯塔海岬
  { type: 'lighthouse', position: [425, -64], yaw: Math.PI, size: [6, 26, 6], color: '#fbfbf6', roof: '#d9453b', ref: 'harbor-lighthouse', variant: 'keeper' },
  fence([[414, -74], [414, -53]]),
  fence([[422, -48], [436, -48]]),
  prop('rocks', [436, -74], [3, 1, 3], { seed: 895 }),
  prop('rocks', [412, -80], [2.4, 1, 2.4], { seed: 896 }),
  { type: 'bench', position: [431, -46], yaw: FACE.north, size: [1.6, 0.9, 0.6] },

  // 大街路灯（两侧交错）
  ...lamps([[340, 33.9], [356, 44.4], [372, 32.5], [388, 43.0], [404, 31.0], [420, 41.5]]),
  // 行道树（棕榈沿大街与码头，阔叶树在住宅区）
  ...trees(
    [
      [360, 43.5, 7.5, 'palm'], [412, 42, 8, 'palm'], [402, 24, 7, 'palm'], [345, 16, 6.5, 'palm'], [410, -6, 7.5, 'palm'],
      [362, 108, 6.5], [335, 60, 6], [355, 150, 7], [320, 150, 6.5, 'pine'], [312, 100, 7], [312, 60, 6.5],
      [318, -20, 7], [338, -60, 7.5, 'pine'], [390, -28, 6.5], [405, 100, 6], [405, 84, 5, 'shrub'], [360, 17, 5, 'shrub'],
    ],
    900,
  ),
];

export const HARBOR_CITY: TownLayout = {
  id: 'harbor-city',
  zone: 'harbor-city',
  paths: [
    { id: 'town-harbor-market-square', surface: 'stone', width: 26, points: [[360, 67], [398, 67]] },
    { id: 'town-harbor-hall-walk', surface: 'stone', width: 6, points: [[380, 80], [380, 90]] },
    { id: 'town-harbor-center-walk', surface: 'stone', width: 5, points: [[350, 10.6], [350, 36]] },
    { id: 'town-harbor-plaza', surface: 'stone', width: 14, points: [[372, 4], [396, 4]] },
    { id: 'town-harbor-terminal-walk', surface: 'stone', width: 6, points: [[418.5, 14], [440, 14]] },
    { id: 'town-harbor-lane', surface: 'stone', width: 5, points: [[345, 41], [345, 148]] },
    { id: 'town-harbor-quay', surface: 'stone', width: 12, points: [[433, -50], [433, 150]] },
    { id: 'town-harbor-lighthouse-path', surface: 'dirt', width: 3, points: [[398, 0], [401, -36], [418, -52]] },
    { id: 'town-harbor-north-lane', surface: 'dirt', width: 3.5, points: [[358, -30], [371.2, -45]] },
  ],
  pads: [{ position: [431, 45], size: [20, 210], y: QY, blend: 5 }],
  props: [...town, ...quay],
};

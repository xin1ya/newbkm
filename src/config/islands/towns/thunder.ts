/**
 * M3-07 ~ M3-10 雷鸣群岛四座城镇（手工布局）。
 *
 * - 雷鸣镇（西南·台地 11 m）：避雷塔之城。板岩石屋顶上都有避雷针，镇中心是「主避雷塔」广场；
 *   电系道馆「雷霆」在主街北侧，码头在台地下方西岸。
 * - 晨光镇（东南·平原 8 m）：风车与麦田的小镇，广场上有日晷；晨辉道馆在主街南侧。
 * - 雪原镇（中部·冰川脚下 30 m）：原木雪屋、冰屋、雪橇与雪人；霜凝道馆在主街南侧。
 * - 云雀镇（北部·高崖顶 74 m）：木构崖屋顶上的小风车、风力机、北崖边的滑翔台；云翎道馆在主街北侧。
 *
 * 门口坐标与 thunder.ts 的 POI 一一对应（atDoor 反推建筑中心；道馆 = 门口沿朝向后退 w/2 + 1）。
 */
import type { PropInstance, TownLayout, Vec2, Vec3 } from '../types';
import { FACE, PI, atDoor, deck, fence, lamps, prop, trees } from './helpers';

function gymAt(ref: string, door: Vec2, yaw: number, w: number, h: number, variant: string): PropInstance {
  const back = w / 2 + 1;
  return { type: 'gym', ref, position: [door[0] - Math.sin(yaw) * back, door[1] - Math.cos(yaw) * back], yaw, size: [w, h, w], variant };
}
const house = (door: Vec2, yaw: number, size: Vec3, variant: string, color: string, roof: string, seed: number, extra: Partial<PropInstance> = {}): PropInstance =>
  atDoor('house', door, yaw, size, { variant, color, roof, seed, ...extra });
const towers = (list: Array<[number, number, number]>): PropInstance[] => list.map(([x, z, h]) => ({ type: 'lightning-tower', position: [x, z], yaw: 0, size: [h > 20 ? 4.5 : 3, h, h > 20 ? 4.5 : 3] }));
const crates = (list: Vec2[]): PropInstance[] => list.map((p, i) => ({ type: 'crate', position: p, yaw: i * 0.6, size: [1.2, 1.2, 1.2] }));
const barrels = (list: Vec2[], color = '#7a5a32'): PropInstance[] => list.map((p) => ({ type: 'barrel', position: p, yaw: 0, size: [0.8, 1, 0.8], color }));

// ———————————————————————— 雷鸣镇 ————————————————————————
// 主街 z = 418（x -566 → -376），北侧门口 z = 412 朝南，南侧门口 z = 424 朝北；南面第二排沿后巷 z = 452。
const thunderTown: PropInstance[] = [
  atDoor('pokecenter', [-470, 412], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-thunder', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [-420, 412], FACE.south, [12, 6.5, 10], { ref: 'mart-thunder', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-thunder', [-500, 360], FACE.south, 26, 14, 'electric'),
  // 北侧石屋
  house([-548, 412], FACE.south, [9, 7, 8], 'slate', '#d8d4cc', '#4b4a5e', 3101, { accent: '#e8b73a' }),
  house([-531, 412], FACE.south, [9, 6.6, 8], 'slate', '#e4ded2', '#56546a', 3102, { accent: '#c8402e' }),
  house([-514, 412], FACE.south, [8, 6.4, 7], 'slate', '#d0ccd8', '#4b4a5e', 3103, { accent: '#4b8ac8' }),
  house([-395, 412], FACE.south, [9, 7, 8], 'slate', '#e0dad0', '#5f5b70', 3104, { ref: 'thunder-engineer-house', accent: '#e8b73a' }),
  // 南侧石屋（门朝北）
  house([-548, 424], FACE.north, [9, 6.8, 8], 'slate', '#dcd6cc', '#56546a', 3111, { accent: '#4b8ac8' }),
  house([-531, 424], FACE.north, [9, 6.4, 8], 'slate', '#e8e2d6', '#4b4a5e', 3112, { accent: '#e8b73a' }),
  house([-514, 424], FACE.north, [8, 6.6, 7], 'slate', '#d4d0dc', '#5f5b70', 3113, { accent: '#c8402e' }),
  house([-430, 424], FACE.north, [9, 6.8, 8], 'slate', '#e0dace', '#4b4a5e', 3114, { accent: '#5aa05a' }),
  house([-413, 424], FACE.north, [9, 6.4, 8], 'slate', '#d8d2c8', '#56546a', 3115, { accent: '#e8b73a' }),
  house([-396, 424], FACE.north, [8, 6.2, 7], 'slate', '#e4dfd6', '#5f5b70', 3116, { accent: '#4b8ac8' }),
  // 后巷第二排（门朝北，z = 458）
  house([-545, 458], FACE.north, [10, 7.2, 9], 'slate', '#d8d4cc', '#4b4a5e', 3121, { accent: '#c8402e' }),
  house([-526, 458], FACE.north, [9, 6.6, 8], 'slate', '#e2dcd2', '#56546a', 3122, { accent: '#e8b73a' }),
  house([-415, 458], FACE.north, [9, 6.8, 8], 'slate', '#dcd8e2', '#5f5b70', 3123, { accent: '#4b8ac8' }),
  house([-396, 458], FACE.north, [9, 6.4, 8], 'slate', '#e6e0d4', '#4b4a5e', 3124, { accent: '#5aa05a' }),
  // 主避雷塔广场（镇中心，主街南侧）：主塔 + 四角小塔 + 长椅 + 警示牌
  ...towers([[-470, 446, 30], [-488, 434, 9], [-452, 434, 9], [-488, 462, 9], [-452, 462, 9]]),
  { type: 'bench', position: [-478, 432], yaw: FACE.south, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [-462, 432], yaw: FACE.south, size: [1.8, 0.9, 0.6] },
  { type: 'sign', ref: 'thunder-tower-sign', position: [-470, 430], yaw: FACE.north, size: [1.6, 1.6, 0.2] },
  // 镇边避雷塔（台地四角，暴雨夜里针尖发光）
  ...towers([[-584, 350, 18], [-384, 340, 18], [-588, 480, 16], [-380, 482, 16]]),
  // 道馆前：警示带花坛 + 名牌
  prop('flowerbed', [-509, 368], [3, 0.4, 1.2], { seed: 3131 }),
  prop('flowerbed', [-491, 368], [3, 0.4, 1.2], { seed: 3132 }),
  { type: 'sign', ref: 'gym-thunder-sign', position: [-492, 364], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', position: [-445, 410], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'mailbox', position: [-542, 409], yaw: FACE.south, size: [0.5, 1.2, 0.4], color: '#e8b73a' },
  { type: 'well', position: [-440, 446], yaw: 0, size: [2, 3, 2] },
  prop('garden', [-560, 444], [6, 0.4, 5], { variant: 'herb', seed: 3133 }),
  fence([[-564, 440], [-564, 448], [-556, 448]]),
  { type: 'laundry', position: [-536, 470], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 3134 },
  ...crates([[-405, 440], [-404, 441.4]]),
  ...barrels([[-560, 410], [-559, 411.3]], '#5a5a62'),
  ...lamps([[-556, 421], [-524, 415], [-490, 421], [-450, 415], [-420, 421], [-384, 415]]),
  // 台地边缘石块与耐风矮树
  prop('rocks', [-590, 380], [4, 1.4, 4], { seed: 3141 }),
  prop('rocks', [-376, 470], [3.4, 1.2, 3.4], { seed: 3142 }),
  ...trees(
    [
      [-592, 440, 7, 'pine'], [-585, 455, 6, 'pine'], [-380, 395, 7, 'pine'], [-560, 340, 8, 'pine'], [-420, 340, 7, 'pine'],
      [-505, 478, 5, 'shrub'], [-438, 478, 5, 'shrub'], [-556, 395, 4.5, 'shrub'], [-384, 432, 4.5, 'shrub'],
    ],
    3150,
  ),
  // 码头（台地下方西岸）
  deck([-622, 420], 32, 7, 2.2, 'nsw', [['e', 0, 7]]),
  { type: 'boat', ref: 'thunder-ferry', position: [-640, 436], yaw: PI / 2, size: [6, 4.5, 16], y: 0, color: '#f5f5f0', roof: '#4b4a78', collide: true },
  { type: 'bollard', position: [-634, 417], yaw: 0, size: [0.4, 0.7, 0.4], y: 2.2 },
  { type: 'bollard', position: [-634, 423], yaw: 0, size: [0.4, 0.7, 0.4], y: 2.2 },
  { type: 'net-rack', position: [-598, 430], yaw: FACE.west, size: [3, 2, 0.3] },
  { type: 'sign', ref: 'thunder-dock-sign', position: [-600, 412], yaw: FACE.east, size: [1.6, 1.6, 0.2] },
];

export const THUNDER_TOWN: TownLayout = {
  id: 'thunder-town',
  zone: 'thunder-town',
  paths: [
    { id: 'town-thunder-gym-walk', surface: 'stone', width: 6, points: [[-500, 416], [-500, 362]] },
    { id: 'town-thunder-plaza', surface: 'stone', width: 5, points: [[-470, 420], [-470, 430], [-494, 448], [-470, 468], [-446, 448], [-470, 430]] },
    { id: 'town-thunder-lane', surface: 'stone', width: 4, points: [[-560, 452], [-494, 452]] },
    { id: 'town-thunder-lane-e', surface: 'stone', width: 4, points: [[-446, 452], [-386, 452]] },
  ],
  pads: [
    { position: [-480, 410], size: [190, 150], blend: 14 },
    { position: [-500, 344], size: [36, 36], blend: 8 },
  ],
  props: thunderTown,
};

// ———————————————————————— 晨光镇 ————————————————————————
// 主街：(290,440) → (512,450)，z ≈ 440 + (x − 290) × 0.045；北侧门口在街北 6 m 朝南，南侧门口在街南 6 m 朝北。
const sz = (x: number) => 440 + (x - 290) * 0.045;
const dawnTown: PropInstance[] = [
  atDoor('pokecenter', [340, 432], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-dawn', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [390, 432], FACE.south, [12, 6.5, 10], { ref: 'mart-dawn', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-dawn', [430, 480], FACE.north, 26, 13, 'dawn'),
  // 北侧农舍
  house([310, sz(310) - 6], FACE.south, [9, 6, 8], 'cottage', '#f6ecd6', '#c8703a', 3201),
  house([420, sz(420) - 6], FACE.south, [9, 6.6, 8], 'gable', '#f2e8d2', '#a8563a', 3202, { accent: '#5aa05a' }),
  house([437, sz(437) - 6], FACE.south, [9, 6.2, 8], 'timber', '#f4ead8', '#7a5a3a', 3203),
  house([470, sz(470) - 6], FACE.south, [10, 7.2, 9], 'two-storey', '#efe4cc', '#c8703a', 3204, { accent: '#e8b73a' }),
  house([490, sz(490) - 6], FACE.south, [9, 6, 8], 'cottage', '#f6eedc', '#a8563a', 3205),
  // 南侧（门朝北）
  house([312, sz(312) + 6], FACE.north, [9, 6.2, 8], 'gable', '#f4e8d0', '#7a5a3a', 3211, { accent: '#c8402e' }),
  house([330, sz(330) + 6], FACE.north, [9, 6, 8], 'cottage', '#f8f0de', '#c8703a', 3212),
  house([348, sz(348) + 6], FACE.north, [9, 6.4, 8], 'timber', '#efe2c8', '#a8563a', 3213),
  house([372, sz(372) + 6], FACE.north, [10, 6.8, 9], 'gable', '#f4ead6', '#c8703a', 3214, { ref: 'dawn-miller-house', accent: '#e8b73a' }),
  house([470, sz(470) + 6], FACE.north, [9, 6, 8], 'cottage', '#f6ecd6', '#7a5a3a', 3215),
  house([490, sz(490) + 6], FACE.north, [9, 6.4, 8], 'gable', '#f2e6d0', '#a8563a', 3216, { accent: '#4b8ac8' }),
  // 风车（镇子三面，北面一架靠近水塘）
  { type: 'windmill', position: [318, 392], yaw: 0.3, size: [7, 16, 7], color: '#f4ead8', roof: '#a8563a' },
  { type: 'windmill', position: [478, 392], yaw: -0.4, size: [6.5, 15, 6.5], color: '#f6eedc', roof: '#c8703a' },
  { type: 'windmill', position: [330, 505], yaw: 0.9, size: [6.5, 14, 6.5], color: '#efe4cc', roof: '#7a5a3a' },
  { type: 'windmill', position: [495, 505], yaw: -1.1, size: [6, 13, 6], color: '#f4ead8', roof: '#a8563a' },
  // 日晷广场（主街北侧）
  { type: 'sundial', position: [455, 418], yaw: 0, size: [6, 0.6, 6] },
  { type: 'bench', position: [447, 424], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [463, 424], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
  { type: 'sign', ref: 'dawn-sundial-sign', position: [455, 425], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  // 道馆前：花坛 + 名牌
  prop('flowerbed', [421, 474], [3, 0.4, 1.2], { seed: 3221 }),
  prop('flowerbed', [439, 474], [3, 0.4, 1.2], { seed: 3222 }),
  { type: 'sign', ref: 'gym-dawn-sign', position: [438, 476], yaw: FACE.north, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', position: [365, 431], yaw: FACE.south, size: [2, 2.2, 0.3] },
  // 麦田 / 菜园 + 篱笆
  prop('garden', [356, 386], [14, 0.4, 10], { variant: 'veg', seed: 3231 }),
  prop('garden', [400, 386], [14, 0.4, 10], { variant: 'veg', seed: 3232 }),
  prop('garden', [445, 386], [12, 0.4, 10], { variant: 'herb', seed: 3233 }),
  fence([[347, 379], [347, 393], [453, 393], [453, 379]]),
  prop('garden', [370, 500], [12, 0.4, 8], { variant: 'veg', seed: 3234 }),
  prop('garden', [470, 500], [12, 0.4, 8], { variant: 'veg', seed: 3235 }),
  { type: 'bunting', position: [455, 418], yaw: 0, size: [0.1, 4, 0.1], points: [[440, sz(440) - 4], [455, sz(455) - 3], [470, sz(470) - 4]], seed: 3236 },
  { type: 'market-stall', position: [410, 455], yaw: FACE.north, size: [3, 2.6, 2], color: '#e8b73a', variant: 'fruit' },
  ...crates([[300, 425], [301, 426.4], [505, 462]]),
  ...barrels([[407, 459], [413, 459]]),
  { type: 'well', position: [455, 470], yaw: 0, size: [2, 3, 2] },
  ...lamps([[300, sz(300) + 4], [330, sz(330) - 4], [365, sz(365) + 4], [405, sz(405) - 4], [445, sz(445) + 4], [480, sz(480) - 4], [505, sz(505) + 4]]),
  ...trees(
    [
      [295, 380, 9], [300, 515, 10], [510, 375, 9], [520, 470, 8], [285, 470, 8], [400, 515, 9], [455, 515, 8, 'blossom'],
      [362, 425, 4.5, 'shrub'], [418, 425, 4.5, 'shrub'], [455, 432, 5, 'blossom'],
    ],
    3240,
  ),
];

export const DAWN_TOWN: TownLayout = {
  id: 'dawn-town',
  zone: 'dawn-town',
  paths: [
    { id: 'town-dawn-gym-walk', surface: 'stone', width: 6, points: [[430, sz(430) + 2], [430, 478]] },
    { id: 'town-dawn-field-walk', surface: 'dirt', width: 3, points: [[400, sz(400) - 2], [400, 396], [318, 396]] },
    { id: 'town-dawn-mill-walk', surface: 'dirt', width: 3, points: [[455, sz(455) - 2], [470, 400], [478, 398]] },
    { id: 'town-dawn-south-walk', surface: 'dirt', width: 3, points: [[330, sz(330) + 2], [330, 498]] },
  ],
  pads: [
    { position: [400, 440], size: [200, 150], blend: 14 },
    { position: [430, 494], size: [36, 36], blend: 8 },
  ],
  props: dawnTown,
};

// ———————————————————————— 雪原镇 ————————————————————————
// 主街 z = −170（x 16 → 248）；北侧门口 z = −180 朝南，南侧门口 z = −160 朝北。
const snowTown: PropInstance[] = [
  atDoor('pokecenter', [80, -180], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-snow', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [130, -180], FACE.south, [12, 6.5, 10], { ref: 'mart-snow', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-snow', [160, -132], FACE.north, 26, 14, 'ice'),
  // 北侧原木雪屋
  house([40, -180], FACE.south, [9, 7, 8], 'chalet', '#7a4c2c', '#8a3a2e', 3301, { accent: '#c8402e' }),
  house([58, -180], FACE.south, [9, 6.6, 8], 'chalet', '#7a4c2c', '#3f4a6a', 3302, { accent: '#4b8ac8' }),
  house([105, -180], FACE.south, [8, 6.4, 7], 'chalet', '#7a4c2c', '#5a3a2a', 3303, { accent: '#e8b73a' }),
  house([158, -180], FACE.south, [9, 7, 8], 'chalet', '#7a4c2c', '#8a3a2e', 3304, { accent: '#5aa05a' }),
  house([178, -180], FACE.south, [9, 6.8, 8], 'chalet', '#7a4c2c', '#3f4a6a', 3305, { accent: '#c8402e' }),
  house([205, -180], FACE.south, [10, 7.4, 9], 'chalet', '#7a4c2c', '#5a3a2a', 3306, { accent: '#4b8ac8' }),
  // 南侧（门朝北；道馆两侧留空）
  house([40, -160], FACE.north, [9, 6.6, 8], 'chalet', '#7a4c2c', '#3f4a6a', 3311, { accent: '#e8b73a' }),
  house([60, -160], FACE.north, [9, 6.8, 8], 'chalet', '#7a4c2c', '#8a3a2e', 3312, { accent: '#4b8ac8' }),
  house([85, -160], FACE.north, [8, 6.2, 7], 'chalet', '#7a4c2c', '#5a3a2a', 3313, { accent: '#c8402e' }),
  house([195, -160], FACE.north, [9, 6.8, 8], 'chalet', '#7a4c2c', '#3f4a6a', 3314, { accent: '#5aa05a' }),
  house([215, -160], FACE.north, [9, 7, 8], 'chalet', '#7a4c2c', '#8a3a2e', 3315, { accent: '#e8b73a' }),
  // 冰屋群（镇南雪地）：最大的一座是冰屋老人的家
  { type: 'igloo', ref: 'snow-igloo-elder', position: [110, -124], yaw: FACE.north, size: [8, 4, 8], seed: 3321 },
  { type: 'igloo', position: [92, -118], yaw: FACE.north + 0.4, size: [6, 3, 6], seed: 3322 },
  { type: 'igloo', position: [36, -126], yaw: FACE.east, size: [6.5, 3.2, 6.5], seed: 3323 },
  { type: 'igloo', position: [210, -122], yaw: FACE.west, size: [6, 3, 6], seed: 3324 },
  // 雪橇与雪人
  { type: 'sled', position: [120, -140], yaw: 0.3, size: [1.1, 0.6, 2.4], color: '#c8402e' },
  { type: 'sled', position: [48, -140], yaw: -0.5, size: [1.1, 0.6, 2.2], color: '#4b8ac8' },
  { type: 'sled', position: [190, -138], yaw: 1.2, size: [1.1, 0.6, 2.4], color: '#e8b73a' },
  { type: 'snowman', position: [70, -144], yaw: FACE.north, size: [1, 2.2, 1], color: '#d9453b' },
  { type: 'snowman', position: [140, -150], yaw: FACE.north + 0.3, size: [1, 1.8, 1], color: '#4b8ac8' },
  { type: 'snowman', position: [225, -142], yaw: FACE.west, size: [1, 2.4, 1], color: '#5aa05a' },
  // 道馆前：冰灯 + 名牌
  { type: 'lantern', position: [151, -128], yaw: 0, size: [0.5, 1.6, 0.5], color: '#9fd2ee' },
  { type: 'lantern', position: [169, -128], yaw: 0, size: [0.5, 1.6, 0.5], color: '#9fd2ee' },
  { type: 'sign', ref: 'gym-snow-sign', position: [168, -130], yaw: FACE.north, size: [1.6, 1.6, 0.2] },
  { type: 'noticeboard', position: [118, -181], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'well', position: [140, -195], yaw: 0, size: [2, 3, 2] },
  ...crates([[25, -150], [26, -148.6]]),
  ...barrels([[230, -178], [231, -176.6]]),
  ...lamps([[24, -173], [55, -167], [95, -173], [140, -167], [185, -173], [230, -167]]),
  ...trees(
    [
      [20, -215, 11, 'pine'], [40, -230, 12, 'pine'], [200, -230, 12, 'pine'], [228, -210, 11, 'pine'], [10, -110, 10, 'pine'],
      [240, -110, 10, 'pine'], [120, -230, 13, 'pine'], [70, -228, 11, 'pine'],
    ],
    3330,
  ),
];

export const SNOW_TOWN: TownLayout = {
  id: 'snow-town',
  zone: 'snow-town',
  paths: [
    { id: 'town-snow-gym-walk', surface: 'stone', width: 6, points: [[160, -168], [160, -134]] },
    { id: 'town-snow-igloo-walk', surface: 'dirt', width: 3, points: [[110, -168], [110, -131]] },
  ],
  pads: [
    { position: [125, -170], size: [200, 140], blend: 16 },
    { position: [160, -118], size: [36, 36], blend: 8 },
  ],
  props: snowTown,
};

// ———————————————————————— 云雀镇 ————————————————————————
// 主街：(194,−660) → (452,−640)，z ≈ −660 + (x − 194) × 0.0775；北侧门口在街北 6 m 朝南，南侧门口在街南 6 m 朝北。
const lz = (x: number) => -660 + (x - 194) * 0.0775;
const larkTown: PropInstance[] = [
  atDoor('pokecenter', [260, lz(260) - 6], FACE.south, [15, 7.5, 12], { ref: 'pokecenter-lark', color: '#fbf5ee', roof: '#e25a4f' }),
  atDoor('mart', [310, lz(310) - 6], FACE.south, [12, 6.5, 10], { ref: 'mart-lark', color: '#f4f6f8', roof: '#3f7fd6' }),
  gymAt('gym-lark', [370, -690], FACE.south, 26, 14, 'flying'),
  // 北侧崖屋
  house([215, lz(215) - 6], FACE.south, [9, 6.4, 8], 'lark', '#f2ece0', '#4b8ac8', 3401, { accent: '#e8b73a' }),
  house([233, lz(233) - 6], FACE.south, [9, 6.2, 8], 'lark', '#ece4d4', '#5aa05a', 3402, { accent: '#4b8ac8' }),
  house([410, lz(410) - 6], FACE.south, [9, 6.6, 8], 'lark', '#f4eee2', '#c8703a', 3403, { accent: '#4b8ac8' }),
  house([428, lz(428) - 6], FACE.south, [9, 6.2, 8], 'lark', '#efe8da', '#4b8ac8', 3404, { accent: '#c8402e' }),
  // 南侧（门朝北）
  house([215, lz(215) + 6], FACE.north, [9, 6.2, 8], 'lark', '#f0e8d8', '#c8703a', 3411, { accent: '#4b8ac8' }),
  house([233, lz(233) + 6], FACE.north, [9, 6.6, 8], 'lark', '#f4eee2', '#4b8ac8', 3412, { accent: '#e8b73a' }),
  house([270, lz(270) + 6], FACE.north, [11, 7.2, 10], 'lark', '#ece4d4', '#3f6a9a', 3413, { ref: 'lark-glider-club', accent: '#e8b73a' }),
  house([350, lz(350) + 6], FACE.north, [9, 6.4, 8], 'lark', '#f2ece0', '#5aa05a', 3414, { accent: '#c8402e' }),
  house([368, lz(368) + 6], FACE.north, [9, 6.2, 8], 'lark', '#efe8da', '#c8703a', 3415, { accent: '#4b8ac8' }),
  house([410, lz(410) + 6], FACE.north, [9, 6.6, 8], 'lark', '#f4eee2', '#4b8ac8', 3416, { accent: '#5aa05a' }),
  // 风力机：镇东、镇西与北崖（风力桥的动力来自这里）
  { type: 'wind-turbine', position: [205, -700], yaw: 0.2, size: [2, 18, 2] },
  { type: 'wind-turbine', position: [440, -700], yaw: -0.2, size: [2, 18, 2] },
  { type: 'wind-turbine', position: [300, -740], yaw: 0, size: [2, 22, 2] },
  { type: 'wind-turbine', position: [420, -600], yaw: 0.5, size: [2, 16, 2] },
  // 北崖滑翔台（崖边悬挑，朝北）
  { type: 'glide-deck', ref: 'lark-glide-deck', position: [250, -776], yaw: PI, size: [6, 0.4, 12], y: 73.4, color: '#e8b73a' },
  fence([[240, -768], [240, -760], [260, -760], [260, -768]]),
  { type: 'sign', ref: 'lark-glide-sign', position: [256, -762], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  // 道馆前：风向袋 + 名牌
  { type: 'sign', ref: 'gym-lark-sign', position: [378, -686], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
  { type: 'bunting', position: [370, -680], yaw: 0, size: [0.1, 4, 0.1], points: [[358, -684], [370, -682], [382, -684]], seed: 3421 },
  { type: 'noticeboard', position: [288, lz(288) - 5], yaw: FACE.south, size: [2, 2.2, 0.3] },
  { type: 'bench', position: [300, lz(300) + 4], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [330, lz(330) + 4], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
  { type: 'statue', position: [330, lz(330) - 6], yaw: FACE.south, size: [1.8, 3.2, 1.8], variant: 'star', color: '#c9a86a' },
  ...crates([[200, -646], [201, -644.6]]),
  ...barrels([[446, -630], [447, -628.6]]),
  ...lamps([[205, lz(205) + 4], [245, lz(245) - 4], [285, lz(285) + 4], [335, lz(335) - 4], [385, lz(385) + 4], [440, lz(440) - 4]]),
  ...trees(
    [
      [215, -600, 8, 'pine'], [380, -600, 8, 'pine'], [440, -665, 7, 'pine'], [200, -620, 6, 'pine'],
      [395, -620, 4.5, 'shrub'], [250, -612, 4.5, 'shrub'], [345, -712, 4.5, 'shrub'],
    ],
    3430,
  ),
  // 北岸码头（崖路下到海湾）
  deck([-150, -712], 7, 30, 1.8, 'ew', [['s', 0, 7]]),
  { type: 'rowboat', position: [-160, -720], yaw: 0.3, size: [1.6, 0.6, 4], y: 0.2 },
  { type: 'bollard', position: [-147, -724], yaw: 0, size: [0.4, 0.7, 0.4], y: 1.8 },
  { type: 'sign', ref: 'lark-dock-sign', position: [-144, -692], yaw: FACE.south, size: [1.6, 1.6, 0.2] },
];

export const LARK_TOWN: TownLayout = {
  id: 'lark-town',
  zone: 'lark-town',
  paths: [
    { id: 'town-lark-gym-walk', surface: 'stone', width: 6, points: [[370, lz(370) - 2], [370, -688]] },
    { id: 'town-lark-glide-walk', surface: 'dirt', width: 3, points: [[250, lz(250) - 2], [250, -700], [250, -760]] },
  ],
  pads: [
    { position: [320, -650], size: [220, 120], blend: 24 },
    { position: [370, -704], size: [36, 36], blend: 10 },
  ],
  props: larkTown,
};

export const THUNDER_TOWNS: TownLayout[] = [THUNDER_TOWN, DAWN_TOWN, SNOW_TOWN, LARK_TOWN];

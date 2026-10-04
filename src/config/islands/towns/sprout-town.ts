/**
 * M1-02 · 萌芽镇（设计 §3.2：南岸海湾边的小村，主角出生地）。
 *
 * 布局（北 = -Z）：
 *   - 中轴：东西向石板大路（town-sprout-plaza），北侧是自己家、民居、木兰研究所（+ 温室 + 北侧观测牧场与风车）
 *   - 路南：喷泉广场（村子的中心，长椅 / 花坛 / 公告栏），南侧民居沿小巷分布
 *   - 西头：蒲婆婆的木构老屋、药草园、晾架、水井
 *   - 南岸：沙滩、木栈码头（T 形头）、小划艇、浮标、晾网架、海边凉亭、棕榈
 * 门口坐标必须与 islands/sprout.ts 的 POI 一致（player-house / magnolia-lab / elder-pu-house / sprout-dock）。
 */
import type { TownLayout } from '../types';
import { along, atDoor, deck, FACE, fence, lamps, prop, trees } from './helpers';


export const SPROUT_TOWN: TownLayout = {
  id: 'sprout-town',
  zone: 'sprout-town',
  paths: [
    { id: 'town-sprout-square', surface: 'stone', width: 16, points: [[-106, 380], [-84, 380]] },
    { id: 'town-sprout-lab-walk', surface: 'stone', width: 5, points: [[-20, 357], [-20, 344]] },
    { id: 'town-sprout-south-lane', surface: 'dirt', width: 4, points: [[-80, 389], [-74, 415], [-70, 437]] },
    { id: 'town-sprout-west-lane', surface: 'dirt', width: 3.5, points: [[-150, 365], [-160, 382], [-165, 394]] },
    { id: 'town-sprout-lane-1', surface: 'stone', width: 3, points: [[-45, 362], [-45, 372]] },
    { id: 'town-sprout-lane-2', surface: 'stone', width: 3, points: [[-10, 360], [-10, 370]] },
    { id: 'town-sprout-lane-3', surface: 'stone', width: 3, points: [[-130, 368], [-130, 378]] },
    { id: 'town-sprout-lane-4', surface: 'dirt', width: 3, points: [[-98, 388], [-105, 405]] },
    { id: 'town-sprout-lane-5', surface: 'dirt', width: 3, points: [[5, 360], [20, 385]] },
  ],
  props: [
    // ———————————————— 自己家（两层，红顶）+ 后院 ————————————————
    atDoor('house', [-120, 360], FACE.south, [11, 7.2, 9], { ref: 'player-house', color: '#f6ecda', roof: '#d9674e', variant: 'two-storey', accent: '#5b8fb0', seed: 7 }),
    prop('flowerbed', [-124.5, 361.2], [2.6, 0.4, 1.2], { seed: 3 }),
    prop('flowerbed', [-115.5, 361.2], [2.6, 0.4, 1.2], { seed: 4 }),
    prop('mailbox', [-113.2, 360.6], [0.4, 1.5, 0.5], { color: '#d9453b' }),
    fence([[-127.5, 358.6], [-127.5, 337.5], [-111.5, 337.5], [-111.5, 358.6]]),
    prop('garden', [-121, 341.5], [8, 0.4, 5], { variant: 'veg', seed: 11 }),
    { type: 'laundry', position: [-113.8, 345], yaw: FACE.east, size: [3.2, 2.1, 0.2], seed: 5 },
    prop('bench', [-125.8, 348], [1.6, 0.9, 0.6], { yaw: FACE.east }),
    ...trees([[-125.5, 340.5, 6.5, 'blossom'], [-114, 339.8, 4, 'shrub']], 100),

    // ———————————————— 木兰博士研究所 + 温室 + 观测牧场 ————————————————
    atDoor('lab', [-20, 345], FACE.south, [20, 8.5, 13], { ref: 'magnolia-lab', color: '#f3f5f7', roof: '#5c8fcf' }),
    prop('greenhouse', [1.5, 334], [7, 4.4, 10], { seed: 21 }),
    prop('flowerbed', [-26, 345.8], [3, 0.4, 1.4], { seed: 12 }),
    prop('flowerbed', [-14, 345.8], [3, 0.4, 1.4], { seed: 13 }),
    { type: 'sign', position: [-28.5, 350.5], yaw: 0, size: [1.6, 1.6, 0.2] },
    prop('bench', [-33, 342], [1.6, 0.9, 0.6], { yaw: FACE.east }),
    fence([[-36, 324], [-36, 304], [8, 304], [8, 324]]),
    { type: 'windmill', position: [-2, 312], yaw: FACE.south, size: [4.5, 11, 4.5], color: '#e9e2d4', roof: '#5c8fcf' },
    prop('rocks', [-28, 310], [2.4, 1, 2.4], { seed: 4 }),
    prop('rocks', [-14, 318], [1.6, 1, 1.6], { seed: 9 }),
    { type: 'noticeboard', position: [-24, 322.5], yaw: FACE.south, size: [2, 2.2, 0.3] },
    ...trees([[-32, 308, 7], [-20, 306.5, 6, 'pine'], [5, 321, 5.5], [-10, 307, 7.5, 'pine']], 140),

    // ———————————————— 大路北侧民居 ————————————————
    atDoor('house', [-60, 352.5], FACE.south, [9, 6.2, 8], { color: '#f4ead7', roof: '#4f7fc9', variant: 'gable', seed: 31 }),
    prop('flowerbed', [-64, 353.6], [2, 0.4, 1], { seed: 31 }),
    atDoor('house', [-145, 357.5], FACE.south, [9, 5.6, 8], { color: '#efe2c8', roof: '#6aa56b', variant: 'cottage', seed: 32 }),
    prop('mailbox', [-140, 358.6], [0.4, 1.5, 0.5], { color: '#2f6db5' }),
    atDoor('house', [-88, 351], FACE.south, [9, 6.4, 8], { color: '#f7f1e6', roof: '#e0a13a', variant: 'gable', seed: 33 }),
    { type: 'hedge', position: [-95, 348], yaw: FACE.east, size: [6, 1.2, 0.9], seed: 2 },

    // ———————————————— 大路南侧民居（门朝北） ————————————————
    atDoor('house', [-45, 373], FACE.north, [9, 6, 8], { color: '#f2e6d0', roof: '#c85d7c', variant: 'gable', seed: 41 }),
    atDoor('house', [-10, 371], FACE.north, [10, 7.2, 8], { color: '#e8dcc6', roof: '#5b93a8', variant: 'two-storey', seed: 42 }),
    atDoor('house', [-130, 379], FACE.north, [9, 6, 8], { color: '#f4ead7', roof: '#a7695a', variant: 'gable', seed: 43 }),
    atDoor('house', [-105, 406], FACE.north, [8, 5.4, 7], { color: '#f7f1e6', roof: '#4f7fc9', variant: 'cottage', seed: 44 }),
    atDoor('house', [-40, 402], FACE.west, [9, 6, 8], { color: '#efe2c8', roof: '#6aa56b', variant: 'gable', seed: 45 }),
    atDoor('house', [20, 386], FACE.west, [9, 6.2, 8], { color: '#f2e6d0', roof: '#d9674e', variant: 'cottage', seed: 46 }),
    { type: 'hedge', position: [-45, 368.2], yaw: 0, size: [0.9, 1.1, 0.9], seed: 3 },
    fence([[-52, 386], [-52, 396], [-38, 396]]),
    prop('garden', [-18, 392], [6, 0.4, 4], { variant: 'veg', seed: 17 }),
    { type: 'laundry', position: [-136, 391], yaw: 0, size: [3.4, 2.1, 0.2], seed: 8 },
    ...trees([[-138, 392, 6], [-5, 381, 5, 'shrub'], [-52, 381, 6.5], [12, 398, 6]], 180),

    // ———————————————— 喷泉广场（村子中心） ————————————————
    prop('fountain', [-95, 380], [5, 3.8, 5], { variant: 'ball', color: '#e2dbcf' }),
    { type: 'bench', position: [-95, 386.8], yaw: FACE.north, size: [1.8, 0.9, 0.6] },
    { type: 'bench', position: [-95, 373.2], yaw: FACE.south, size: [1.8, 0.9, 0.6] },
    { type: 'bench', position: [-101.8, 380], yaw: FACE.east, size: [1.8, 0.9, 0.6] },
    { type: 'bench', position: [-88.2, 380], yaw: FACE.west, size: [1.8, 0.9, 0.6] },
    prop('flowerbed', [-100.5, 374.5], [1.8, 0.5, 1.8], { variant: 'round', seed: 51 }),
    prop('flowerbed', [-89.5, 374.5], [1.8, 0.5, 1.8], { variant: 'round', seed: 52 }),
    prop('flowerbed', [-100.5, 385.5], [1.8, 0.5, 1.8], { variant: 'round', seed: 53 }),
    prop('flowerbed', [-89.5, 385.5], [1.8, 0.5, 1.8], { variant: 'round', seed: 54 }),
    { type: 'noticeboard', position: [-108.5, 380], yaw: FACE.east, size: [2, 2.2, 0.3] },
    ...lamps([[-107, 372.5], [-83, 372.5], [-107, 387.5], [-83, 387.5]]),
    ...trees([[-111, 391, 7, 'blossom'], [-80, 392.5, 6.5, 'blossom'], [-112, 369, 6]], 200),
    // 进村路口的木牌与花坛
    { type: 'sign', position: [-64.5, 306], yaw: 0, size: [1.6, 1.6, 0.2] },
    prop('flowerbed', [-66, 312], [1.6, 0.5, 1.6], { variant: 'round', seed: 55 }),
    prop('flowerbed', [-75, 310], [1.6, 0.5, 1.6], { variant: 'round', seed: 56 }),

    // ———————————————— 大路路灯（南侧） ————————————————
    ...along([[-150, 365], [0, 355]], 26, (p) => ({ type: 'lamp', position: p, yaw: 0, size: [0.3, 4.2, 0.3] }), -6.3, 8),

    // ———————————————— 西头：蒲婆婆家 ————————————————
    atDoor('house', [-165, 395], FACE.north, [10, 6.6, 8], { ref: 'elder-pu-house', color: '#efe3c6', roof: '#8a5a3c', variant: 'timber', accent: '#6b4a33', seed: 61 }),
    prop('garden', [-178, 398], [5, 0.4, 7], { variant: 'herb', seed: 62, yaw: 0 }),
    fence([[-181.5, 393.5], [-181.5, 402.5], [-174.5, 402.5]]),
    { type: 'net-rack', position: [-156.5, 400], yaw: FACE.east, size: [2.6, 1.9, 0.2] },
    prop('well', [-154, 388], [2.4, 2.8, 2.4]),
    prop('barrel', [-159.5, 394.8], [0.8, 1, 0.8]),
    prop('barrel', [-170.8, 394.6], [0.8, 1, 0.8], { color: '#7a5a32' }),
    ...trees([[-178, 388, 7.5], [-186, 408, 6.5, 'pine'], [-150, 408, 5, 'shrub'], [-185, 380, 7]], 220),

    // ———————————————— 南岸：码头与海滩 ————————————————
    deck([-70, 451], 5, 26, 1.7, 'ew'),
    deck([-70, 465.5], 14, 4, 1.7, 'nse', [['n', 0, 5]]),
    { type: 'bollard', position: [-72, 463], yaw: 0, size: [0.4, 0.6, 0.4], y: 1.7 },
    { type: 'bollard', position: [-68, 463], yaw: 0, size: [0.4, 0.6, 0.4], y: 1.7 },
    { type: 'lantern', position: [-66.8, 466.8], yaw: 0, size: [0.3, 3.4, 0.3], y: 1.7, color: '#f2b134' },
    { type: 'rowboat', position: [-75.5, 457], yaw: 0.1, size: [1.7, 0.6, 4.2], y: 0.05, color: '#5b93a8' },
    { type: 'rowboat', position: [-64.5, 459], yaw: -0.15, size: [1.6, 0.6, 4], y: 0.05, color: '#d9674e' },
    { type: 'rowboat', position: [-79, 469], yaw: 0.8, size: [1.6, 0.6, 4], y: 0.05, color: '#f2f0e6' },
    { type: 'buoy', position: [-56, 474], yaw: 0, size: [1, 2, 1], y: 0 },
    { type: 'buoy', position: [-86, 476], yaw: 0, size: [1, 2, 1], y: 0, color: '#f2f0e6' },
    { type: 'net-rack', position: [-90, 431], yaw: 0, size: [3, 2, 0.2] },
    { type: 'net-rack', position: [-95, 433], yaw: 0.3, size: [2.6, 1.9, 0.2] },
    prop('barrel', [-74.5, 435.5], [0.8, 1, 0.8]),
    prop('barrel', [-75.4, 434.4], [0.8, 1, 0.8], { color: '#7a5a32' }),
    prop('crate', [-65.5, 435.2], [1.1, 1.1, 1.1], { yaw: 0.3 }),
    prop('crate', [-64.4, 436.4], [0.9, 0.9, 0.9], { yaw: 0.8 }),
    { type: 'shed', position: [-44, 428], yaw: FACE.south, size: [5.2, 3.8, 4], roof: '#4f7fc9', variant: 'pavilion' },
    { type: 'sign', position: [-77, 431], yaw: 0, size: [1.6, 1.6, 0.2] },
    fence([[-200, 432], [-110, 438], [-80, 440]]),
    fence([[-60, 440], [40, 428]]),
    ...trees([[-140, 428, 7.5, 'palm'], [-120, 431, 6.5, 'palm'], [-30, 432, 7, 'palm'], [0, 428, 8, 'palm'], [-170, 426, 7, 'palm'], [22, 424, 6.5, 'palm']], 240),
    prop('rocks', [-160, 437], [2.2, 1, 2.2], { seed: 7 }),
    prop('rocks', [30, 432], [1.8, 1, 1.8], { seed: 8 }),

    // ———————————————— 村边绿化 ————————————————
    ...trees(
      [
        [-180, 320, 8, 'pine'], [-172, 308, 7], [-150, 312, 6.5], [-125, 318, 7.5, 'pine'], [-100, 312, 6], [-90, 326, 7],
        [-58, 318, 6.5], [-45, 330, 5, 'shrub'], [20, 342, 7], [30, 360, 7.5, 'pine'], [34, 375, 6], [36, 405, 6.5],
        [-190, 350, 7], [-192, 372, 7.5, 'pine'], [-196, 415, 6], [-60, 410, 6], [-20, 412, 5, 'shrub'], [-150, 342, 5, 'shrub'],
      ],
      300,
    ),
  ],
};


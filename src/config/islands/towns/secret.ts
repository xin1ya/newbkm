/**
 * M4-02 / M4-03 · 秘境岛城镇（手工布局）。
 *
 * 寐龙镇（谷底盆地，地面 14 m）：在巨兽遗骸旁生长起来的化石村落。
 *   一条 8 m 宽的板石主街从南门（z = 300）一路向北，穿过半埋在土里的巨兽龙骨肋拱，
 *   尽头就是嵌在崖壁前的龙渊道馆（道馆正门罩在一具低头的龙头骨里）；
 *   东侧发掘场里横卧着那具完整的骨架化石（M4-03 新增构件 dragon-skeleton），
 *   学者们的帆布工棚、量尺桩与碎骨堆围在坑沿。民居全部是崖石砌体的「岩窟屋」
 *   （variant 'roost'：下毛石、上木构、陡草顶，门楣上横架小兽肋）；
 *   宝可梦中心与商店在西街北段，守龙老人之家（可入内）在东街北段。
 *
 * 门口坐标与 secret.ts 的 POI 一一对应（atDoor 反推建筑中心；道馆 = 门口沿朝向后退 w/2 + 1）。
 * 月魇镇（M4-04）继续在此文件填充。
 */
import type { PropInstance, TownLayout, Vec2 } from '../types';
import { FACE, PI, atDoor, deck, fence, lamps, prop, trees } from './helpers';

function gymAt(ref: string, door: Vec2, yaw: number, w: number, h: number, variant: string): PropInstance {
  const back = w / 2 + 1;
  return { type: 'gym', ref, position: [door[0] - Math.sin(yaw) * back, door[1] - Math.cos(yaw) * back], yaw, size: [w, h, w], variant };
}
const roost = (door: Vec2, yaw: number, size: [number, number, number], wall: string, roof: string, seed: number, extra: Partial<PropInstance> = {}): PropInstance =>
  atDoor('house', door, yaw, size, { variant: 'roost', color: wall, roof, seed, accent: '#8a5a3a', ...extra });

const W_A = '#8d8478';
const W_B = '#968a76';
const W_C = '#7f7a70';
const ROOF_A = '#5a4a38';
const ROOF_B = '#6a5844';

// ———————————————————————— 寐龙镇 ————————————————————————
// 主街 x = 0（z 175 → 300，宽 8）；西门口 x = −8 朝东、东门口 x = 8 朝西；
// 发掘场在东街以东 x 12..40、z 226..262；道馆坐在街口 (0, 199)。
const dragonTown: PropInstance[] = [
  // 北端：龙渊道馆（外观 M4-03，入内 M4-06）
  gymAt('gym-dragon', [0, 199], FACE.south, 26, 15, 'dragon'),
  // 西街（门口 x = −8，朝东）
  atDoor('pokecenter', [-8, 206], FACE.east, [15, 7, 11], { ref: 'pokecenter-dragon', color: '#e8ddd0', roof: '#b0483e' }),
  atDoor('mart', [-8, 224], FACE.east, [11, 6.5, 9], { ref: 'mart-dragon', color: '#e0d8c6', roof: '#3f6fa8' }),
  roost([-8, 246], FACE.east, [9.5, 6.2, 8], W_B, ROOF_A, 5101),
  roost([-8, 264], FACE.east, [9, 6, 8], W_C, ROOF_B, 5102),
  roost([-8, 282], FACE.east, [9.5, 6.4, 8], W_A, ROOF_A, 5103),
  // 东街（门口 x = 8，朝西）
  roost([8, 212], FACE.west, [12, 7, 10], '#877f72', ROOF_A, 5111, { ref: 'dragon-keeper-house' }),
  roost([8, 276], FACE.west, [9, 6.2, 8], W_B, ROOF_B, 5112),
  roost([8, 292], FACE.west, [9.5, 6, 8], W_C, ROOF_A, 5113),
  roost([26, 294], FACE.south, [10, 6.4, 8], W_A, ROOF_B, 5114),
  // 巨兽龙骨化石：横穿发掘场，头骨朝向镇南门（yaw −0.35 = 东南偏南）
  prop('dragon-skeleton', [24, 244], [12, 8.5, 34], { yaw: -0.35, ref: 'dragon-bones' }),
  // 发掘场：坑沿围栏（南面留 6 m 开口作参观口）、木箱、量尺桩、帆布工棚
  fence([[10, 226], [10, 238]]),
  fence([[34, 224], [44, 228], [46, 240], [44, 256], [36, 264], [30, 266]]),
  prop('crate', [13, 232], [1.4, 1.4, 1.4], { yaw: 0.4 }),
  prop('crate', [15, 235], [1.1, 1.1, 1.1], { yaw: -0.3 }),
  prop('crate', [40, 250], [1.3, 1.3, 1.3], { yaw: 0.9 }),
  { type: 'market-stall', position: [40, 234], yaw: -0.6, size: [5.4, 2.8, 3.6], roof: '#b9a887', variant: 'goods', seed: 5301 },
  { type: 'market-stall', position: [41, 244], yaw: 0.5, size: [4.6, 2.6, 3.2], roof: '#a9977a', variant: 'goods', seed: 5302 },
  // 街道设施：石板灯柱沿主街两侧、南门口公告板、西街井台
  ...lamps([[-5.6, 214], [5.6, 202], [5.6, 226], [-5.6, 256], [5.6, 262], [-5.6, 292], [5.6, 286]]),
  { type: 'noticeboard', position: [-6, 296], yaw: 0, size: [2, 2.2, 0.3], ref: 'dragon-town-notice' },
  { type: 'well', position: [-18, 258], yaw: 0, size: [2, 3, 2] },
  { type: 'bench', position: [-11, 199], yaw: FACE.east, size: [1.8, 0.9, 0.6] },
  { type: 'bench', position: [11, 201], yaw: FACE.west, size: [1.8, 0.9, 0.6] },
  prop('flowerbed', [-13, 216], [3, 0.4, 1.2], { seed: 5201 }),
  prop('flowerbed', [-13, 234], [3, 0.4, 1.2], { seed: 5202 }),
  prop('flowerbed', [14, 268], [3, 0.4, 1.2], { seed: 5203 }),
  // 谷底少树多石：崖松与风蚀岩点缀盆地边缘
  ...trees(
    [
      [-30, 208, 7, 'pine'],
      [-36, 226, 8, 'pine'],
      [-26, 288, 7, 'pine'],
      [34, 214, 6, 'pine'],
      [44, 276, 8, 'pine'],
      [-42, 252, 7, 'pine'],
      [40, 206, 6, 'pine'],
    ],
    5211,
  ),
  prop('rocks', [-24, 196], [4, 1.6, 3], { yaw: 0.5, seed: 5221 }),
  prop('rocks', [30, 282], [5, 2, 4], { yaw: -0.8, seed: 5222 }),
  prop('rocks', [-40, 268], [4.5, 1.8, 3.4], { yaw: 1.4, seed: 5223 }),
  // 南门口：石栈到主街的过渡 + 指路牌；北口外的峡谷路牌
  prop('sign', [4.5, 298], [1.6, 1.6, 0.2], { yaw: FACE.west }),
  prop('sign', [-6, 178], [1.6, 1.6, 0.2], { yaw: FACE.east, ref: 'dragon-canyon-sign' }),
];

export const SECRET_TOWNS: TownLayout[] = [
  {
    id: 'secret-dock-area',
    zone: 'secret-shore',
    paths: [],
    // 栈桥根部由 road-secret-dock 压平带 + secret-dock POI 平整半径覆盖，无需额外地块
    props: [
      // 南北向石栈桥（宽 4.5 m，从岸上伸到 -z 方向的海里；南端 = 渡轮泊位）
      deck([58, 546], 4.5, 34, 1.2, 'ns', [['south', 0, 0]], 0),
      prop('boat', [70, 552], [4, 3.5, 11], { y: 0, yaw: PI / 2, color: '#f5f5f0', roof: '#7a5bd6', collide: true }),
      prop('bollard', [56, 538], [0.4, 0.7, 0.4], { y: 1.6 }),
      prop('bollard', [61, 556], [0.4, 0.7, 0.4], { y: 1.6 }),
      prop('crate', [62, 528], [1.2, 1.2, 1.2], { yaw: 0.4 }),
      prop('sign', [64, 534], [1.6, 1.6, 0.2], { yaw: FACE.west, ref: 'secret-dock-sign' }),
    ],
  },
  {
    id: 'dragon-town',
    zone: 'dragon-town',
    paths: [
      // 道馆前小广场 + 发掘场参观步道 + 东巷
      { id: 'town-dragon-plaza', surface: 'stone', width: 20, points: [[0, 200], [0, 208]] },
      { id: 'town-dragon-dig', surface: 'dirt', width: 3.4, points: [[6, 246], [12, 246], [22, 240]] },
      { id: 'town-dragon-east-lane', surface: 'dirt', width: 3, points: [[16, 270], [26, 272], [34, 268]] },
      { id: 'town-dragon-west-lane', surface: 'dirt', width: 3, points: [[-16, 258], [-22, 262], [-30, 262]] },
    ],
    pads: [
      // 道馆台地 + 发掘场（盆地地面本就压到 14 m，这两块抹平施工扰动）
      { position: [0, 185], size: [34, 30], y: 14, blend: 10 },
      { position: [24, 246], size: [52, 46], y: 14, blend: 12 },
    ],
    props: dragonTown,
  },
];

/**
 * M4-02 秘境岛码头（M4-03 / M4-04 城镇布局继续填充）。
 * 石栈桥 + 渡轮：渡船航线（琉璃镇 ↔ 秘境岛）的靠泊处。
 */
import type { PropInstance, TownLayout } from '../types';
import { FACE, PI, deck, prop } from './helpers';

const dockProps: PropInstance[] = [
  // 南北向石栈桥（宽 4.5 m，从岸上伸到 -z 方向的海里；南端 = 渡轮泊位）
  deck([58, 546], 4.5, 34, 1.2, 'ns', [['south', 0, 0]], 0),
  prop('boat', [70, 552], [4, 3.5, 11], { y: 0, yaw: PI / 2, color: '#f5f5f0', roof: '#7a5bd6', collide: true }),
  prop('bollard', [56, 538], [0.4, 0.7, 0.4], { y: 1.6 }),
  prop('bollard', [61, 556], [0.4, 0.7, 0.4], { y: 1.6 }),
  prop('crate', [62, 528], [1.2, 1.2, 1.2], { yaw: 0.4 }),
  prop('sign', [64, 534], [1.6, 1.6, 0.2], { yaw: FACE.west, ref: 'secret-dock-sign' }),
];

export const SECRET_TOWNS: TownLayout[] = [
  {
    id: 'secret-dock-area',
    zone: 'secret-shore',
    paths: [],
    // 栈桥根部由 road-secret-dock 压平带 + secret-dock POI 平整半径覆盖，无需额外地块
    props: dockProps,
  },
];

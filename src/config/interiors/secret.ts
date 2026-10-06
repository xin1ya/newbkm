/**
 * M4-03 · 秘境岛室内场景（寐龙镇特色民居；道馆内部在 M4-06，梦之实验室在 M4-05）。
 * 宝可梦中心 / 商店共用 sprout.ts 的 'pokecenter' / 'mart'。
 */
import type { ExitConfig, InteriorConfig } from './types';

const PI = Math.PI;

function frontDoor(depth: number, x = 0): ExitConfig {
  return { id: 'front', position: [x, depth / 2 - 0.35], radius: 0.85, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出门' };
}

export const SECRET_INTERIORS: InteriorConfig[] = [
  // ————————————————————————— 寐龙镇 · 守龙老人之家 —————————————————————————
  {
    id: 'dragon-keeper-house',
    name: '守龙老人之家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '守龙老人之家',
        size: [11, 9.4, 3.6],
        floor: { color: '#7a6248', pattern: 'plank', accent: '#5a4634' },
        wall: { color: '#8d8478', trim: '#d4c9a8' },
        lighting: 'home',
        furniture: [
          // 正中：一张占了半间屋的测绘桌，摊着整条脊椎的图纸与一具小龙头骨模型
          { type: 'table', position: [0, -0.8], size: [2.6, 0.75, 1.6], color: '#5a4634', interact: 'keeper-table' },
          { type: 'crystal', position: [0.7, -0.8], color: '#e8e0c8', interact: 'keeper-skull' },
          { type: 'chair', position: [-1.4, 0.4], yaw: -PI / 2, color: '#5a4634' },
          { type: 'chair', position: [1.6, 0.7], yaw: PI / 2, color: '#5a4634' },
          { type: 'rug', position: [0, 1.6], size: [3.6, 0.02, 2.4], color: '#6e5f4a', accent: '#d4c9a8' },
          // 东墙：骨头与出土器物架；西墙：历代测绘图
          { type: 'shelf', position: [5.1, -1.6], size: [2.4, 2.0, 0.5], color: '#5a4634', yaw: PI / 2, interact: 'keeper-shelves' },
          { type: 'bookshelf', position: [5.1, 1.4], size: [2.2, 2.4, 0.5], color: '#5a4634', yaw: PI / 2 },
          { type: 'poster', position: [-5.46, -1.0], yaw: PI / 2, size: [2.2, 1.4, 0.02], color: '#cfc4a8', accent: '#5a4634', interact: 'keeper-map' },
          { type: 'poster', position: [-5.46, 1.6], yaw: PI / 2, size: [1.8, 1.2, 0.02], color: '#b8a88a', accent: '#3a3230' },
          // 北墙挂着一条木雕龙幡，下是一盆崖松盆景
          { type: 'banner', position: [0, -4.66], size: [1.4, 2.4, 0.05], color: '#4a4038', accent: '#e8e0c8' },
          { type: 'plant', position: [-3.4, -3.6] },
          { type: 'plant', position: [3.4, -3.6] },
          // 起居角
          { type: 'bed', position: [-3.6, 3.2], yaw: PI / 2, color: '#5a4634', accent: '#9a5f3e' },
          { type: 'stove', position: [4.4, 3.4], yaw: -PI / 2, color: '#4a4038' },
          { type: 'lamp', position: [0, -3.4], color: '#ffd59a' },
          { type: 'window', position: [-2.6, 4.66], size: [1.2, 1.3, 0.1] },
          { type: 'window', position: [2.6, 4.66], size: [1.2, 1.3, 0.1] },
        ],
        exits: [frontDoor(9.4)],
        npcs: [{ id: 'dragon-keeper', position: [3.6, 2.2], yaw: PI }],
      },
    ],
  },
];

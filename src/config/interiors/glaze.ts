/**
 * M3-11 ~ M3-14 · 琉璃群岛室内场景（城镇特色民居；道馆内部在 M3-16）。
 * 宝可梦中心 / 商店共用 sprout.ts 的 'pokecenter' / 'mart'。
 */
import type { ExitConfig, InteriorConfig } from './types';

const PI = Math.PI;

function frontDoor(depth: number, x = 0): ExitConfig {
  return { id: 'front', position: [x, depth / 2 - 0.35], radius: 0.85, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出门' };
}

export const GLAZE_INTERIORS: InteriorConfig[] = [
  // ————————————————————————— 幻影镇 · 先知之家 —————————————————————————
  {
    id: 'mirage-seer-house',
    name: '先知之家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '先知之家',
        size: [11, 10, 3.6],
        floor: { color: '#c8b48a', pattern: 'tile', accent: '#3f7a8a' },
        wall: { color: '#efe4d4', trim: '#7a4a9a', wainscot: '#c9a86a' },
        lighting: 'home',
        furniture: [
          { type: 'rug', position: [0, -0.6], size: [4.2, 0.02, 3.2], color: '#7a4a9a', accent: '#e8c870' },
          { type: 'crystal', position: [0, -0.6], color: '#c86ad8', interact: 'seer-crystal-ball' },
          { type: 'table', position: [0, -0.6], size: [1.2, 0.7, 1.2], color: '#5a3e2b' },
          { type: 'bookshelf', position: [-3.6, -4.5], size: [2.4, 2.2, 0.45], color: '#5a3e2b', interact: 'seer-books' },
          { type: 'shelf', position: [3.4, -4.5], size: [2.2, 1.8, 0.45], color: '#5a3e2b', interact: 'seer-jars' },
          { type: 'poster', position: [0, -5], size: [2.0, 1.3, 0.02], color: '#1e1a3a', accent: '#e8e2ff', interact: 'seer-star-chart' },
          { type: 'banner', position: [-5.46, 0], yaw: PI / 2, size: [1.2, 2.2, 0.05], color: '#7a4a9a', accent: '#e8c870' },
          { type: 'banner', position: [5.46, 0], yaw: -PI / 2, size: [1.2, 2.2, 0.05], color: '#3f7a8a', accent: '#e8c870' },
          { type: 'bed', position: [4.0, 2.6], yaw: PI, color: '#5a3e2b', accent: '#7a4a9a' },
          { type: 'chair', position: [0, 0.6], yaw: PI, color: '#5a3e2b' },
          { type: 'plant', position: [-4.8, 3.8] },
          { type: 'lamp', position: [-4.6, 1.6], color: '#ffd59a' },
          { type: 'window', position: [-2.4, -5], size: [1.0, 1.4, 0.1] },
          { type: 'window', position: [2.4, -5], size: [1.0, 1.4, 0.1] },
        ],
        exits: [frontDoor(10)],
        npcs: [
          { id: 'mirage-seer', position: [0, -2.0], yaw: 0 },
          { id: 'mirage-seer-apprentice', position: [-3.0, 1.2], yaw: PI / 2 },
        ],
      },
    ],
  },
];

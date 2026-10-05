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
  // ————————————————————————— 幽冥镇 · 守墓人之家 —————————————————————————
  {
    id: 'ghost-gravekeeper-house',
    name: '守墓人之家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '守墓人之家',
        size: [10, 9, 3.2],
        floor: { color: '#5a5660', pattern: 'tile', accent: '#4a4652' },
        wall: { color: '#b8b2bc', trim: '#3a3444', wainscot: '#6e6878' },
        lighting: 'home',
        furniture: [
          { type: 'rug', position: [0, 0.4], size: [3.2, 0.02, 2.2], color: '#4a3e5a', accent: '#8fe8d8' },
          { type: 'table', position: [0, 0.4], size: [1.6, 0.75, 1.0], color: '#4a3a2e' },
          { type: 'chair', position: [-1.2, 0.4], yaw: PI / 2, color: '#4a3a2e' },
          { type: 'workbench', position: [3.0, -3.8], color: '#4a3a2e', interact: 'gravekeeper-tools' },
          { type: 'shelf', position: [-2.6, -4.05], size: [2.2, 1.8, 0.45], color: '#3a3444', interact: 'gravekeeper-ledger' },
          { type: 'lamp', position: [-4.4, -3.6], color: '#8fe8d8', interact: 'gravekeeper-lantern' },
          { type: 'stove', position: [0.4, -3.8] },
          { type: 'bed', position: [-3.6, 2.6], yaw: PI / 2, color: '#3a3444', accent: '#6e6878' },
          { type: 'crate', position: [4.2, 3.4], size: [0.9, 0.8, 0.9], color: '#6a5a48' },
          { type: 'poster', position: [4.96, 0], yaw: -PI / 2, size: [1.4, 1.0, 0.02], color: '#2e2a3a', accent: '#a88af0', interact: 'gravekeeper-map' },
          { type: 'window', position: [-1.0, -4.5], size: [1.0, 1.2, 0.1] },
        ],
        exits: [frontDoor(9)],
        npcs: [{ id: 'ghost-gravekeeper', position: [1.4, -2.0], yaw: PI }],
      },
    ],
  },
  // ————————————————————————— 幽冥镇 · 灵堂 —————————————————————————
  {
    id: 'ghost-ossuary',
    name: '幽冥灵堂',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '幽冥灵堂',
        size: [14, 12, 5],
        floor: { color: '#4a4652', pattern: 'checker', accent: '#3a3644' },
        wall: { color: '#8a8494', trim: '#2e2a3a', wainscot: '#5a5464' },
        lighting: 'cave',
        furniture: [
          { type: 'dais', position: [0, -4.2], size: [4, 0.4, 2], color: '#5a5464' },
          { type: 'emblem', position: [0, -5.9], size: [1.6, 1.6, 0.1], color: '#a88af0', accent: '#8fe8d8', interact: 'ossuary-altar' },
          { type: 'column', position: [-4.5, -2], color: '#6e6878' },
          { type: 'column', position: [4.5, -2], color: '#6e6878' },
          { type: 'column', position: [-4.5, 2], color: '#6e6878' },
          { type: 'column', position: [4.5, 2], color: '#6e6878' },
          { type: 'shelf', position: [-6.75, -1], yaw: PI / 2, size: [3.0, 2.6, 0.45], color: '#3a3444', interact: 'ossuary-niches' },
          { type: 'shelf', position: [6.75, -1], yaw: -PI / 2, size: [3.0, 2.6, 0.45], color: '#3a3444', interact: 'ossuary-niches' },
          { type: 'chair', position: [-2, 1.5], color: '#4a3a2e' },
          { type: 'chair', position: [2, 1.5], color: '#4a3a2e' },
          { type: 'lamp', position: [-2.2, -4.6], color: '#8fe8d8' },
          { type: 'lamp', position: [2.2, -4.6], color: '#8fe8d8' },
          { type: 'banner', position: [-6.96, 3.5], yaw: PI / 2, size: [1.0, 2.6, 0.05], color: '#2e2a3a', accent: '#a88af0' },
          { type: 'banner', position: [6.96, 3.5], yaw: -PI / 2, size: [1.0, 2.6, 0.05], color: '#2e2a3a', accent: '#a88af0' },
          { type: 'desk', position: [3.6, 3.4], color: '#4a3a2e', interact: 'ossuary-register' },
        ],
        exits: [frontDoor(12)],
        npcs: [
          { id: 'ghost-priestess', position: [0, -2.6], yaw: 0 },
          { id: 'ghost-mourner', position: [-2.0, 2.6], yaw: PI },
        ],
      },
    ],
  },
];

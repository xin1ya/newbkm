/**
 * M3-07 ~ M3-10 · 雷鸣群岛室内场景（城镇特色民居；道馆内部在 M3-15，洞窟 / 遗迹在 M3-26 / M3-27）。
 * 宝可梦中心 / 商店共用 sprout.ts 的 'pokecenter' / 'mart'。
 */
import type { ExitConfig, InteriorConfig } from './types';

const PI = Math.PI;

function frontDoor(depth: number, x = 0): ExitConfig {
  return { id: 'front', position: [x, depth / 2 - 0.35], radius: 0.85, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出门' };
}

export const THUNDER_INTERIORS: InteriorConfig[] = [
  // ————————————————————————— 雷鸣镇 · 发电工程师之家 —————————————————————————
  {
    id: 'thunder-engineer-house',
    name: '发电工程师之家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '发电工程师之家',
        size: [10, 8, 3],
        floor: { color: '#7a7684', pattern: 'tile', accent: '#6a6674' },
        wall: { color: '#d8d4cc', trim: '#4b4a5e', wainscot: '#8a8594' },
        lighting: 'home',
        furniture: [
          { type: 'workbench', position: [3.0, -3.3], color: '#5a5a62', interact: 'engineer-bench' },
          { type: 'machine', position: [-3.4, -3.2], size: [2.0, 1.6, 1.0], color: '#6a6a72', accent: '#e8b73a', interact: 'engineer-generator' },
          { type: 'desk', position: [-3.6, 1.0], yaw: PI / 2, color: '#5a4a3a' },
          { type: 'chair', position: [-2.7, 1.0], yaw: -PI / 2, color: '#5a4a3a' },
          { type: 'shelf', position: [0.2, -3.55], size: [2.0, 1.8, 0.45], color: '#4b4a5e', interact: 'engineer-shelf' },
          { type: 'poster', position: [3.2, -4], size: [1.6, 1.0, 0.02], color: '#4b4a78', accent: '#ffe45a', interact: 'engineer-grid-map' },
          { type: 'table', position: [1.0, 1.2], size: [1.6, 0.75, 1.0], color: '#7a5a38' },
          { type: 'chair', position: [2.2, 1.2], yaw: -PI / 2, color: '#7a5a38' },
          { type: 'bed', position: [3.6, 2.6], yaw: PI, color: '#5a4a3a', accent: '#4b8ac8' },
          { type: 'crate', position: [-4.3, 3.0], size: [0.9, 0.8, 0.9], color: '#8a7a64' },
          { type: 'lamp', position: [-4.5, -1.6], color: '#ffe8a0' },
          { type: 'window', position: [-1.6, -4], size: [1.2, 1.0, 0.1] },
          { type: 'window', position: [5, 0], yaw: -PI / 2, size: [1.2, 1.0, 0.1] },
        ],
        exits: [frontDoor(8)],
        npcs: [{ id: 'thunder-engineer', position: [1.6, -2.2], yaw: PI }],
      },
    ],
  },
  // ————————————————————————— 晨光镇 · 磨坊主之家 —————————————————————————
  {
    id: 'dawn-miller-house',
    name: '磨坊主之家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '磨坊主之家',
        size: [10, 9, 3],
        floor: { color: '#b8905a', pattern: 'plank', accent: '#a07a48' },
        wall: { color: '#f4ead6', trim: '#7a5a3a', wainscot: '#d8b880' },
        lighting: 'home',
        furniture: [
          { type: 'rug', position: [0, 0.6], size: [3.4, 0.02, 2.4], color: '#e8b73a', accent: '#c8703a' },
          { type: 'table', position: [0, 0.6], size: [1.8, 0.75, 1.1], color: '#8a6a40' },
          { type: 'chair', position: [-1.3, 0.6], yaw: PI / 2, color: '#8a6a40' },
          { type: 'chair', position: [1.3, 0.6], yaw: -PI / 2, color: '#8a6a40' },
          { type: 'stove', position: [-3.2, -3.8], interact: 'miller-oven' },
          { type: 'counter', position: [-0.8, -3.8], size: [2.4, 0.9, 0.7], color: '#a07a48' },
          { type: 'barrel', position: [4.2, -3.6] },
          { type: 'crate', position: [4.2, -2.3], size: [0.9, 0.8, 0.9], color: '#c8a060', interact: 'miller-flour' },
          { type: 'shelf', position: [2.0, -4.05], size: [2.0, 1.6, 0.45], color: '#7a5a3a', interact: 'miller-shelf' },
          { type: 'bed', position: [-3.6, 2.6], yaw: PI / 2, color: '#7a5a3a', accent: '#e8b73a' },
          { type: 'plant', position: [4.3, 3.6] },
          { type: 'poster', position: [-4.96, 0], yaw: PI / 2, size: [1.4, 1.0, 0.02], color: '#5aa05a', accent: '#f6f0d0', interact: 'miller-calendar' },
          { type: 'window', position: [0, -4.5], size: [1.2, 1.0, 0.1] },
          { type: 'window', position: [5, 1], yaw: -PI / 2, size: [1.2, 1.0, 0.1] },
        ],
        exits: [frontDoor(9)],
        npcs: [
          { id: 'dawn-miller', position: [0.6, -2.6], yaw: 0 },
          { id: 'dawn-miller-kid', position: [2.8, 1.8], yaw: -PI / 2 },
        ],
      },
    ],
  },
  // ————————————————————————— 雪原镇 · 冰屋老人的家 —————————————————————————
  {
    id: 'snow-igloo-elder',
    name: '冰屋老人的家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '冰屋',
        size: [8, 8, 2.8],
        floor: { color: '#dfe8ee', pattern: 'tile', accent: '#c8d8e2' },
        wall: { color: '#eef4f8', trim: '#a9d3ea', wainscot: '#dbe8f0' },
        lighting: 'home',
        furniture: [
          { type: 'rug', position: [0, 0], size: [3.6, 0.02, 3.0], color: '#8a3a2e', accent: '#e8d8a0' },
          { type: 'stove', position: [0, -3.3], interact: 'igloo-stove' },
          { type: 'sofa', position: [-2.6, 0.4], yaw: PI / 2, color: '#7a4c2c', accent: '#eef4f8' },
          { type: 'bed', position: [2.6, -2.0], color: '#7a4c2c', accent: '#d8d0c0' },
          { type: 'shelf', position: [-2.4, -3.55], size: [1.6, 1.4, 0.45], color: '#7a4c2c', interact: 'igloo-carvings' },
          { type: 'crystal', position: [3.2, 2.6], size: [0.6, 1.2, 0.6], color: '#a9d8ee', interact: 'igloo-ice-crystal' },
          { type: 'barrel', position: [-3.3, 3.0] },
          { type: 'lamp', position: [3.3, 0.6], color: '#ffd59a' },
        ],
        exits: [frontDoor(8)],
        npcs: [{ id: 'snow-igloo-elder', position: [-1.0, -1.2], yaw: 0 }],
      },
    ],
  },
  // ————————————————————————— 云雀镇 · 滑翔俱乐部 —————————————————————————
  {
    id: 'lark-glider-club',
    name: '云雀滑翔俱乐部',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '云雀滑翔俱乐部',
        size: [12, 10, 3.4],
        floor: { color: '#9a7a58', pattern: 'plank', accent: '#86684a' },
        wall: { color: '#ece4d4', trim: '#3f6a9a', wainscot: '#b8c8d8' },
        lighting: 'home',
        furniture: [
          { type: 'reception', position: [0, -3.4], color: '#3f6a9a', accent: '#e8b73a' },
          { type: 'banner', position: [-5.96, -1], yaw: PI / 2, size: [1.2, 2.0, 0.05], color: '#4b8ac8', accent: '#e8b73a' },
          { type: 'banner', position: [5.96, -1], yaw: -PI / 2, size: [1.2, 2.0, 0.05], color: '#4b8ac8', accent: '#e8b73a' },
          { type: 'trophy', position: [4.6, -4.55], color: '#3f6a9a', accent: '#e8b73a', interact: 'glider-trophies' },
          { type: 'poster', position: [-3.6, -5], size: [1.8, 1.1, 0.02], color: '#9fd2ee', accent: '#3f6a9a', interact: 'glider-wind-chart' },
          { type: 'sofa', position: [-4.0, 2.4], yaw: PI / 2, color: '#3f6a9a', accent: '#ece4d4' },
          { type: 'table', position: [-2.4, 2.4], size: [1.0, 0.5, 1.6], color: '#7a5a38' },
          { type: 'shelf', position: [4.4, 2.0], yaw: -PI / 2, size: [2.2, 1.8, 0.45], color: '#5a4a3a', interact: 'glider-gear' },
          { type: 'plant', position: [5.2, 4.2] },
          { type: 'plant', position: [-5.2, 4.2] },
          { type: 'window', position: [-1, -5], size: [1.4, 1.1, 0.1] },
          { type: 'window', position: [2, -5], size: [1.4, 1.1, 0.1] },
        ],
        exits: [frontDoor(10)],
        npcs: [
          { id: 'lark-glider-master', position: [0, -2.4], yaw: 0 },
          { id: 'lark-glider-student', position: [-2.6, 1.0], yaw: PI / 2 },
        ],
      },
    ],
  },
];

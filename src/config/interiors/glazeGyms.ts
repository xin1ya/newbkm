/**
 * M3-16 · 琉璃群岛三座道馆内部（房间 30 × 40，门在 +z）。
 * - 幻影道馆（超）：6 间水晶镜厅 + 传送镜 + 念力水晶球（glazeMechanisms.ts）；
 * - 幽冥道馆（鬼）：常暗墓厅 + 灵火墙 + 烛台 / 长明灯（glazeMechanisms.ts）；
 * - 琉璃道馆（水）：玻璃穹顶下的大水池，4 座阀门石岛轮流升降水位（M1-11 水位机关的加长版：最少 4 次阀门）。
 */
import type { InteriorConfig, RoomConfig } from './types';
import type { WaterPuzzleConfig } from '@/systems/puzzles/waterLevel';
import { gymRoom, type Theme } from './thunderGyms';
import { GHOST_GYM_MECH, MIRAGE_GYM_MECH } from './glazeMechanisms';

const PI = Math.PI;

const MIRAGE_T: Theme = { main: '#3a2a5a', accent: '#c86ad8', dark: '#1e1630', light: '#f0e0ff' };
const GHOST_T: Theme = { main: '#2a2a3a', accent: '#7a5ab8', dark: '#14141e', light: '#c8b8f0' };

/** 琉璃道馆水池：门口 (0, 18) → 馆主台 (0, −8)。高水位起步。 */
export const GLAZE_WATER_PUZZLE: WaterPuzzleConfig = {
  pool: [-15, -5, 15, 13],
  start: 'high',
  levels: { high: 0.14, low: -1.1 },
  tiles: [
    { id: 'raft-1', kind: 'raft', when: 'high', rect: [-12, 10, -10, 13] },
    { id: 'isle-a', kind: 'island', when: 'always', rect: [-14, 6, -8, 10] },
    { id: 'walk-1', kind: 'walkway', when: 'low', rect: [-8, 7, 2, 9] },
    { id: 'isle-b', kind: 'island', when: 'always', rect: [2, 5, 7, 10] },
    { id: 'raft-2', kind: 'raft', when: 'high', rect: [3, 1, 5, 5] },
    { id: 'isle-c', kind: 'island', when: 'always', rect: [1, -2, 9, 1] },
    { id: 'walk-2', kind: 'walkway', when: 'low', rect: [-6, -1, 1, 1] },
    { id: 'isle-d', kind: 'island', when: 'always', rect: [-10, -3, -6, 1] },
    { id: 'raft-3', kind: 'raft', when: 'high', rect: [-9, -5, -7, -3] },
    // 迷惑项：低水位露出的栈道通向东北角的死岛；高水位的木筏通向东南角的死岛
    { id: 'walk-dead', kind: 'walkway', when: 'low', rect: [7, 8, 11, 9.5] },
    { id: 'isle-dead-ne', kind: 'island', when: 'always', rect: [11, 7, 14, 11] },
    { id: 'raft-dead', kind: 'raft', when: 'high', rect: [9, -1, 12, 0.5] },
    { id: 'isle-dead-se', kind: 'island', when: 'always', rect: [12, -3, 14, 2] },
    // 中央玻璃雕像台（装饰，任何水位都走不到）
    { id: 'isle-statue', kind: 'island', when: 'always', rect: [-3, 2.5, 0, 5] },
  ],
  valves: [
    { id: 'valve-a', position: [-11, 7.2] },
    { id: 'valve-b', position: [4.5, 7.5] },
    { id: 'valve-c', position: [7.8, -0.5] },
    { id: 'valve-d', position: [-8, -1.8] },
  ],
};

const glazeRoom: RoomConfig = {
  id: 'main',
  name: '琉璃道馆 · 玻璃穹顶',
  size: [30, 40, 8],
  floor: { color: '#d6ecf0', pattern: 'wave', accent: '#b4dde6', deep: '#5aa8c8' },
  wall: { color: '#e8f6f8', trim: '#2a8a9a', wainscot: '#9fd8e0', relief: 'wave', reliefColor: '#f4fbfd' },
  lighting: 'gym',
  cameraDistance: 17,
  floorHole: [-15, -5, 15, 13],
  battleStage: { position: [0, -6.4], yaw: PI, radius: 5.5 },
  waterPuzzle: GLAZE_WATER_PUZZLE,
  furniture: [
    // 大厅
    { type: 'reception', position: [-10, 16.5], yaw: PI / 2, color: '#2a8a9a', accent: '#e8f6f8' },
    { type: 'trophy', position: [14.45, 16], yaw: -PI / 2, color: '#5a4a3a', accent: '#5fd0e0' },
    { type: 'poster', position: [-14.96, 14], yaw: PI / 2, size: [1.6, 1.1, 0.02], color: '#2a8a9a', accent: '#ffffff', interact: 'gym-glaze-rules' },
    { type: 'aquarium', position: [-8, 19.4], size: [4, 1.4, 0.8], color: '#2a8a9a', accent: '#6ad0f0' },
    { type: 'aquarium', position: [8, 19.4], size: [4, 1.4, 0.8], color: '#2a8a9a', accent: '#6ad0f0' },
    { type: 'plant', position: [-13.6, 18.8] },
    { type: 'plant', position: [13.6, 18.8] },
    { type: 'crystal', position: [-13.4, 14.2], color: '#5fd0e0' },
    { type: 'crystal', position: [13.4, 14.2], color: '#5fd0e0' },
    { type: 'lamp', position: [-2.6, 19], color: '#bfe8f5' },
    { type: 'lamp', position: [2.6, 19], color: '#bfe8f5' },
    // 水池：玻璃雕像、池壁灯、天窗
    { type: 'crystal', position: [-1.5, 3.75], color: '#8fe0f0', noCollide: true },
    { type: 'skylight', position: [0, 4], size: [8, 0.3, 6], y: 7.6, color: '#bfeaf5' },
    { type: 'skylight', position: [0, -12], size: [5, 0.3, 4], y: 7.6, color: '#bfeaf5' },
    { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [-10, -4.9], y: -0.75, color: '#8ff0ff' },
    { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [0, -4.9], y: -0.75, color: '#8ff0ff' },
    { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [10, -4.9], y: -0.75, color: '#8ff0ff' },
    { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [-4, 12.9], yaw: PI, y: -0.75, color: '#8ff0ff' },
    { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [5, 12.9], yaw: PI, y: -0.75, color: '#8ff0ff' },
    { type: 'banner', position: [-14.96, 2], yaw: PI / 2, y: 6.6, color: '#2a8a9a', accent: '#e8f6f8' },
    { type: 'banner', position: [14.96, 2], yaw: -PI / 2, y: 6.6, color: '#2a8a9a', accent: '#e8f6f8' },
    { type: 'beam', position: [0, -12], size: [30, 0.4, 0.5], y: 7.6, color: '#2a8a9a' },
    { type: 'beam', position: [0, 13], size: [30, 0.4, 0.5], y: 7.6, color: '#2a8a9a' },
    // 馆主台
    { type: 'dais', position: [0, -18.4], size: [7, 0.4, 2.4], color: '#2a8a9a', accent: '#9fd8e0' },
    { type: 'emblem', position: [0, -19.96], size: [2.6, 2.6, 0.02], y: 5, color: '#2a8a9a', accent: '#e8f6f8' },
    { type: 'banner', position: [-5.2, -19.96], size: [1.3, 3.2, 0.02], y: 6.6, color: '#2a8a9a', accent: '#e8f6f8' },
    { type: 'banner', position: [5.2, -19.96], size: [1.3, 3.2, 0.02], y: 6.6, color: '#2a8a9a', accent: '#e8f6f8' },
    { type: 'fountain', position: [-4.7, -18.9], size: [1.6, 3, 1.0], color: '#e8f6f8', accent: '#2a8a9a' },
    { type: 'fountain', position: [4.7, -18.9], size: [1.6, 3, 1.0], color: '#e8f6f8', accent: '#2a8a9a' },
    { type: 'bleacher', position: [-11, -12], yaw: PI / 2, size: [6, 1.4, 2.7], color: '#9fd8e0', accent: '#2a8a9a' },
    { type: 'bleacher', position: [11, -12], yaw: -PI / 2, size: [6, 1.4, 2.7], color: '#9fd8e0', accent: '#2a8a9a' },
    { type: 'column', position: [-14.2, -8.6], color: '#e8f6f8', accent: '#2a8a9a' },
    { type: 'column', position: [14.2, -8.6], color: '#e8f6f8', accent: '#2a8a9a' },
    { type: 'aquarium', position: [-12, -18.8], size: [3.6, 1.6, 1.2], color: '#2a8a9a', accent: '#6ad0f0' },
    { type: 'aquarium', position: [12, -18.8], size: [3.6, 1.6, 1.2], color: '#2a8a9a', accent: '#6ad0f0' },
    { type: 'lamp', position: [-8.5, -6.4], color: '#bfe8f5' },
    { type: 'lamp', position: [8.5, -6.4], color: '#bfe8f5' },
    { type: 'window', position: [-14.96, -14], yaw: PI / 2 },
    { type: 'window', position: [14.96, -14], yaw: -PI / 2 },
  ],
  exits: [{ id: 'front', position: [0, 19.65], radius: 0.85, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出门' }],
  npcs: [
    { id: 'gym-glaze-guide', position: [3.2, 16.4], yaw: -PI / 2 },
    { id: 'liuli', position: [0, -16.6], yaw: 0 },
    { id: 'gym-glaze-trainer-1', position: [-12.4, 8.6], yaw: -0.4 },
    { id: 'gym-glaze-trainer-2', position: [5.6, 8.8], yaw: -1.0 },
    { id: 'gym-glaze-trainer-3', position: [3, -1.2], yaw: 0.6 },
  ],
};

export const GLAZE_GYM_INTERIORS: InteriorConfig[] = [
  // ————————————————————————— 幻影道馆（超）· 传送镜 —————————————————————————
  {
    id: 'gym-mirage',
    name: '幻影道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      gymRoom(
        'gym-mirage',
        '幻影道馆 · 镜之回廊',
        MIRAGE_T,
        { color: '#2a2240', pattern: 'checker', accent: '#3a2e58' },
        [
          { type: 'crystal', position: [-13.4, 14.4], color: '#c86ad8' },
          { type: 'crystal', position: [13.4, 14.4], color: '#6a9ad8' },
          { type: 'crystal', position: [-6.4, -16.6], color: '#e8c870' },
          { type: 'crystal', position: [6.4, -16.6], color: '#e8c870' },
          { type: 'banner', position: [-14.96, -7], yaw: PI / 2, size: [1.2, 3.2, 0.02], y: 6.6, color: '#c86ad8', accent: '#f0e0ff' },
          { type: 'banner', position: [14.96, -7], yaw: -PI / 2, size: [1.2, 3.2, 0.02], y: 6.6, color: '#6a9ad8', accent: '#f0e0ff' },
        ],
        {
          mechanism: MIRAGE_GYM_MECH,
          npcs: [
            { id: 'gym-mirage-guide', position: [3, 17.6], yaw: PI },
            { id: 'huanyue', position: [0, -14.2], yaw: 0 },
            { id: 'gym-mirage-trainer-1', position: [-10.5, 10.5], yaw: PI },
            { id: 'gym-mirage-trainer-2', position: [11, 11], yaw: PI },
            { id: 'gym-mirage-trainer-3', position: [10, -1.5], yaw: -PI / 2 },
          ],
        },
        '#4a3a6a',
      ),
    ],
  },
  // ————————————————————————— 幽冥道馆（鬼）· 暗灯 —————————————————————————
  {
    id: 'gym-ghost',
    name: '幽冥道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      gymRoom(
        'gym-ghost',
        '幽冥道馆 · 长明墓厅',
        GHOST_T,
        { color: '#2e2e38', pattern: 'rock', accent: '#24242e' },
        [
          { type: 'crystal', position: [-6.4, -16.6], color: '#9a7ad8' },
          { type: 'crystal', position: [6.4, -16.6], color: '#9a7ad8' },
          { type: 'boulder', position: [-13.2, -10.5], size: [1.6, 1.2, 1.2], color: '#4a4a58' },
          { type: 'boulder', position: [13.2, -10.5], size: [1.6, 1.2, 1.2], color: '#4a4a58' },
          { type: 'banner', position: [-14.96, -7], yaw: PI / 2, size: [1.2, 3.2, 0.02], y: 6.6, color: '#4a3a7a', accent: '#c8b8f0' },
          { type: 'banner', position: [14.96, -7], yaw: -PI / 2, size: [1.2, 3.2, 0.02], y: 6.6, color: '#4a3a7a', accent: '#c8b8f0' },
        ],
        {
          mechanism: GHOST_GYM_MECH,
          npcs: [
            { id: 'gym-ghost-guide', position: [3, 17.6], yaw: PI },
            { id: 'youpo', position: [0, -14.2], yaw: 0 },
            { id: 'gym-ghost-trainer-1', position: [-10, 9.5], yaw: PI / 2 },
            { id: 'gym-ghost-trainer-2', position: [10, 9.5], yaw: -PI / 2 },
            { id: 'gym-ghost-trainer-3', position: [3, 1], yaw: -PI / 2 },
          ],
        },
        '#3a3048',
      ),
    ],
  },
  // ————————————————————————— 琉璃道馆（水）· 水位 —————————————————————————
  { id: 'gym-glaze', name: '琉璃道馆', entryRoom: 'main', entryExit: 'front', bgm: 'gym', rooms: [glazeRoom] },
];

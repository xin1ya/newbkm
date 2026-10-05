/**
 * M3-15 · 雷鸣群岛四座道馆内部（房间 30 × 40，门在 +z；机关见 thunderMechanisms.ts）。
 * 布局统一：入口大厅 z 13…20（接待台 / 奖杯柜 / 须知牌 / 向导）→ 机关区 z −3…13 → 战斗场 (0, −7) → 馆主台 z −15.4。
 * 机关区内不放带碰撞的家具（可解性由 BFS 证明，家具只放在大厅、战斗场两侧与馆主台）。
 */
import type { ExitConfig, FurnitureConfig, InteriorConfig, RoomConfig } from './types';
import { DAWN_GYM_MECH, LARK_GYM_MECH, SNOW_GYM_MECH, THUNDER_GYM_MECH } from './thunderMechanisms';

const PI = Math.PI;
const W = 30;
const D = 40;

function frontDoor(): ExitConfig {
  return { id: 'front', position: [0, D / 2 - 0.35], radius: 0.85, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出门' };
}

interface Theme {
  main: string;
  accent: string;
  dark: string;
  light: string;
}

/** 大厅 + 战斗场 + 馆主台的共用家具（按主题配色） */
function commonFurniture(gym: string, t: Theme, rug: string): FurnitureConfig[] {
  return [
    // 大厅
    { type: 'reception', position: [-10.5, 17.5], yaw: PI / 2, color: t.dark, accent: t.light },
    { type: 'trophy', position: [14.45, 17], yaw: -PI / 2, color: t.dark, accent: t.accent },
    { type: 'poster', position: [-14.96, 15], yaw: PI / 2, size: [1.4, 1.0, 0.02], color: t.accent, accent: t.dark, interact: `${gym}-rules` },
    { type: 'plant', position: [-13.6, 19] },
    { type: 'plant', position: [13.6, 19] },
    { type: 'lamp', position: [-7, 19.2], color: '#ffe0a0' },
    { type: 'lamp', position: [7, 19.2], color: '#ffe0a0' },
    // 战斗场
    { type: 'rug', position: [0, -7], size: [11, 0.02, 7.5], color: rug, accent: t.light },
    { type: 'skylight', position: [0, -7], size: [5, 0.3, 4], y: 7.5, color: t.light },
    { type: 'bleacher', position: [-12.2, -7], yaw: PI / 2, size: [6.5, 1.4, 2.6], color: t.dark, accent: t.accent },
    { type: 'bleacher', position: [12.2, -7], yaw: -PI / 2, size: [6.5, 1.4, 2.6], color: t.dark, accent: t.accent },
    // 馆主台
    { type: 'dais', position: [0, -15.4], size: [7, 0.5, 2.6], color: t.dark, accent: t.light },
    { type: 'emblem', position: [0, -19.96], size: [2.6, 2.6, 0.02], y: 5, color: t.accent, accent: t.dark },
    { type: 'banner', position: [-4, -19.96], size: [1.2, 3.2, 0.02], y: 6.6, color: t.main, accent: t.light },
    { type: 'banner', position: [4, -19.96], size: [1.2, 3.2, 0.02], y: 6.6, color: t.main, accent: t.light },
    { type: 'column', position: [-10.5, -16.5], color: t.main, accent: t.dark },
    { type: 'column', position: [10.5, -16.5], color: t.main, accent: t.dark },
    { type: 'beam', position: [0, -12], size: [W, 0.5, 0.6], y: 7.6, color: t.dark },
    { type: 'beam', position: [0, 13], size: [W, 0.5, 0.6], y: 7.6, color: t.dark },
    { type: 'lamp', position: [-6, -13], color: '#ffe0a0' },
    { type: 'lamp', position: [6, -13], color: '#ffe0a0' },
  ];
}

function gymRoom(id: string, name: string, t: Theme, floor: RoomConfig['floor'], extra: FurnitureConfig[], rest: Pick<RoomConfig, 'mechanism' | 'npcs'>, rug: string): RoomConfig {
  return {
    id: 'main',
    name,
    size: [W, D, 8],
    floor,
    wall: { color: t.main, trim: t.dark, wainscot: t.accent },
    lighting: 'gym',
    cameraDistance: 17,
    battleStage: { position: [0, -7], yaw: PI, radius: 6 },
    furniture: [...commonFurniture(id, t, rug), ...extra],
    exits: [frontDoor()],
    ...rest,
  };
}

const THUNDER_T: Theme = { main: '#4a5068', accent: '#f2c230', dark: '#2a2e3a', light: '#fff2a0' };
const DAWN_T: Theme = { main: '#efe0b8', accent: '#d8a83a', dark: '#8a6a3a', light: '#fff4d0' };
const SNOW_T: Theme = { main: '#d8ecf6', accent: '#6ab0d8', dark: '#4a6a8a', light: '#ffffff' };
const LARK_T: Theme = { main: '#e8f0fa', accent: '#5a8ad8', dark: '#3a4a6a', light: '#ffffff' };

export const THUNDER_GYM_INTERIORS: InteriorConfig[] = [
  // ————————————————————————— 雷鸣道馆（电）· 导电开关 —————————————————————————
  {
    id: 'gym-thunder',
    name: '雷鸣道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      gymRoom(
        'gym-thunder',
        '雷鸣道馆 · 变电厅',
        THUNDER_T,
        { color: '#5a6070', pattern: 'checker', accent: '#4a505e' },
        [
          // 大厅：特斯拉线圈与配电柜
          { type: 'machine', position: [-13.2, 14.6], size: [1.6, 2.2, 1.0], color: '#4a5060', accent: '#f2c230', interact: 'gym-thunder-panel' },
          { type: 'machine', position: [13.2, 14.6], size: [1.6, 2.2, 1.0], color: '#4a5060', accent: '#f2c230' },
          { type: 'crystal', position: [-8.6, 14.4], color: '#ffe060' },
          { type: 'crystal', position: [8.6, 14.4], color: '#ffe060' },
          // 战斗场两侧：线圈塔
          { type: 'column', position: [-8, -2.8], size: [0.8, 6, 0.8], color: '#c8a050', accent: '#3a3f4a' },
          { type: 'column', position: [8, -2.8], size: [0.8, 6, 0.8], color: '#c8a050', accent: '#3a3f4a' },
          { type: 'crystal', position: [-6.4, -16.6], color: '#ffe060' },
          { type: 'crystal', position: [6.4, -16.6], color: '#ffe060' },
          { type: 'poolLight', position: [0, -11.2], color: '#ffd23a' },
        ],
        {
          mechanism: THUNDER_GYM_MECH,
          npcs: [
            { id: 'gym-thunder-guide', position: [3, 17.6], yaw: PI },
            { id: 'leiting', position: [0, -14.2], yaw: 0 },
            { id: 'gym-thunder-trainer-1', position: [10, 7], yaw: 0 },
            { id: 'gym-thunder-trainer-2', position: [-10, 7], yaw: 0 },
            { id: 'gym-thunder-trainer-3', position: [0, 6], yaw: 0 },
          ],
        },
        '#3a4050',
      ),
    ],
  },
  // ————————————————————————— 晨光道馆（普）· 昼夜机关 —————————————————————————
  {
    id: 'gym-dawn',
    name: '晨光道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      gymRoom(
        'gym-dawn',
        '晨光道馆 · 日月回廊',
        DAWN_T,
        { color: '#e8d8b0', pattern: 'tile', accent: '#d8c08a' },
        [
          { type: 'emblem', position: [-14.96, 0], yaw: PI / 2, size: [2.2, 2.2, 0.02], y: 4.6, color: '#d8a83a', accent: '#fff4d0' },
          { type: 'emblem', position: [14.96, 0], yaw: -PI / 2, size: [2.2, 2.2, 0.02], y: 4.6, color: '#5a4a9a', accent: '#e8ecff' },
          { type: 'window', position: [-14.96, 9], yaw: PI / 2, size: [1.6, 2.4, 0.1] },
          { type: 'window', position: [14.96, 9], yaw: -PI / 2, size: [1.6, 2.4, 0.1] },
          { type: 'plant', position: [-13.6, 14.4] },
          { type: 'plant', position: [13.6, 14.4] },
          { type: 'skylight', position: [0, 5], size: [6, 0.3, 4], y: 7.5, color: '#fff4d0' },
        ],
        {
          mechanism: DAWN_GYM_MECH,
          npcs: [
            { id: 'gym-dawn-guide', position: [3, 17.6], yaw: PI },
            { id: 'chenhui', position: [0, -14.2], yaw: 0 },
            { id: 'gym-dawn-trainer-1', position: [-7, 5.5], yaw: PI / 2 },
            { id: 'gym-dawn-trainer-2', position: [7, 5.5], yaw: -PI / 2 },
            { id: 'gym-dawn-trainer-3', position: [-8, 0.5], yaw: PI / 2 },
          ],
        },
        '#d8b878',
      ),
    ],
  },
  // ————————————————————————— 雪原道馆（冰）· 滑冰 —————————————————————————
  {
    id: 'gym-snow',
    name: '雪原道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      gymRoom(
        'gym-snow',
        '雪原道馆 · 冰晶滑场',
        SNOW_T,
        { color: '#eef6fb', pattern: 'plain', accent: '#d8ecf6' },
        [
          { type: 'crystal', position: [-13.4, 14.4], color: '#9ad8f0' },
          { type: 'crystal', position: [13.4, 14.4], color: '#9ad8f0' },
          { type: 'crystal', position: [-13.2, -4.6], color: '#9ad8f0' },
          { type: 'crystal', position: [13.2, -4.6], color: '#9ad8f0' },
          { type: 'crystal', position: [-6.4, -16.6], color: '#bfe8ff' },
          { type: 'crystal', position: [6.4, -16.6], color: '#bfe8ff' },
          { type: 'boulder', position: [-12.8, -10.5], size: [1.8, 1.2, 1.6], color: '#f2f8fc' },
          { type: 'boulder', position: [12.8, -10.5], size: [1.8, 1.2, 1.6], color: '#f2f8fc' },
        ],
        {
          mechanism: SNOW_GYM_MECH,
          npcs: [
            { id: 'gym-snow-guide', position: [3, 17.6], yaw: PI },
            { id: 'shuangning', position: [0, -14.2], yaw: 0 },
            { id: 'gym-snow-trainer-1', position: [-7, 15.2], yaw: PI / 2 },
            { id: 'gym-snow-trainer-2', position: [8, -5.2], yaw: -PI / 2 },
          ],
        },
        '#bfe0f0',
      ),
    ],
  },
  // ————————————————————————— 云雀道馆（飞）· 风力桥 —————————————————————————
  {
    id: 'gym-lark',
    name: '云雀道馆',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      gymRoom(
        'gym-lark',
        '云雀道馆 · 风之回廊',
        LARK_T,
        { color: '#dce8f6', pattern: 'plain', accent: '#c8d8ee' },
        [
          { type: 'banner', position: [-14.96, 6], yaw: PI / 2, size: [1.2, 3.4, 0.02], y: 6.8, color: '#5a8ad8', accent: '#ffffff' },
          { type: 'banner', position: [14.96, 6], yaw: -PI / 2, size: [1.2, 3.4, 0.02], y: 6.8, color: '#5a8ad8', accent: '#ffffff' },
          { type: 'window', position: [-14.96, -7], yaw: PI / 2, size: [2, 2.6, 0.1] },
          { type: 'window', position: [14.96, -7], yaw: -PI / 2, size: [2, 2.6, 0.1] },
          { type: 'skylight', position: [0, 5], size: [8, 0.3, 6], y: 7.5, color: '#e8f4ff' },
        ],
        {
          mechanism: LARK_GYM_MECH,
          npcs: [
            { id: 'gym-lark-guide', position: [3, 17.6], yaw: PI },
            { id: 'yunling', position: [0, -14.2], yaw: 0 },
            { id: 'gym-lark-trainer-1', position: [-10, 5], yaw: PI / 2 },
            { id: 'gym-lark-trainer-2', position: [9.5, 6.5], yaw: -PI / 2 },
            { id: 'gym-lark-trainer-3', position: [2.5, 2.5], yaw: 0 },
          ],
        },
        '#a8c8ee',
      ),
    ],
  },
];

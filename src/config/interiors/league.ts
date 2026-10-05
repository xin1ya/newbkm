/**
 * M3-21 · 精灵联盟（琉璃群岛 · 联盟高原，彩幽市北端的联盟大门）。
 *
 * 大厅（护士 / 联盟商店 / 电脑 / 守卫）
 *   → 【确认后进入，身后的门锁上】花月之间（恶）→ 第 1 回廊（补给台）
 *   → 芙蓉之间（鬼）→ 第 2 回廊 → 波妮之间（冰）→ 第 3 回廊 → 源治之间（龙）→ 第 4 回廊
 *   → 冠军之间（米可利）→ 名人堂（入殿演出 → 出口回到彩幽市）
 *
 * 规则（systems/league）：
 * - 从大厅走进花月之间时确认，清掉上一轮的击败记录（四天王 / 冠军可反复挑战）并置位 league-run；
 * - 挑战中每间的「回去」出口都锁着（requires 一个永不置位的 flag），厅间回廊只有补给台（买药，不能恢复）；
 * - 全队倒下 → 黑屏回到复活点，下一次从大厅重新开始；
 * - 战胜冠军 → 冠军之间北门打开 → 名人堂：记录队伍（GameState.hallOfFame）、首次成为冠军置位 league-champion-title。
 */
import type { FurnitureConfig, InteriorConfig, RoomConfig } from './types';
import { LEAGUE_HOF_RUN_FLAG, LEAGUE_RUN_FLAG, leagueRunResetFlags, trainerDefeatedFlag } from '@/systems/league';
import { VICTORY_ROAD_CLEARED } from './victoryRoad';

const PI = Math.PI;
/** 永不置位：挑战途中身后的门 */
export const LEAGUE_SEALED = 'league-door-sealed';
const SEALED_HINT = '身后的门已经牢牢锁上了……只能继续向前。';

interface HallTheme {
  id: string;
  name: string;
  floor: RoomConfig['floor'];
  wall: RoomConfig['wall'];
  /** 主色 / 点缀色（地毯、台座、挂旗） */
  main: string;
  accent: string;
  decor: FurnitureConfig[];
  npc: string;
  trainer: string;
  prev: { room: string; exit: string };
  next: { room: string; exit: string };
  lockedHint: string;
  bgm?: string;
}

/** 四天王之间：24 × 28，南门进（锁）、北门出（击败后开），台座 + 徽纹 + 四根立柱 */
function eliteHall(t: HallTheme): RoomConfig {
  return {
    id: t.id,
    name: t.name,
    size: [24, 28, 9],
    floor: t.floor,
    wall: t.wall,
    lighting: 'gym',
    cameraDistance: 15,
    battleStage: { position: [0, -1.2], yaw: PI, radius: 5.5 },
    bgm: t.bgm ?? 'league',
    furniture: [
      { type: 'rug', position: [0, 3.6], size: [3.2, 0.02, 17], color: t.main, accent: t.accent },
      { type: 'dais', position: [0, -9.6], size: [7, 0.4, 2.4], color: t.main, accent: t.accent },
      { type: 'emblem', position: [-4.6, -13.96], size: [2.2, 2.2, 0.02], y: 5.4, color: t.main, accent: t.accent },
      { type: 'emblem', position: [4.6, -13.96], size: [2.2, 2.2, 0.02], y: 5.4, color: t.main, accent: t.accent },
      { type: 'banner', position: [-11.96, -6], yaw: PI / 2, size: [1.3, 3.4, 0.02], y: 7.2, color: t.main, accent: t.accent },
      { type: 'banner', position: [11.96, -6], yaw: -PI / 2, size: [1.3, 3.4, 0.02], y: 7.2, color: t.main, accent: t.accent },
      { type: 'banner', position: [-11.96, 5], yaw: PI / 2, size: [1.3, 3.4, 0.02], y: 7.2, color: t.main, accent: t.accent },
      { type: 'banner', position: [11.96, 5], yaw: -PI / 2, size: [1.3, 3.4, 0.02], y: 7.2, color: t.main, accent: t.accent },
      { type: 'column', position: [-8.8, -6.5], color: t.wall.color, accent: t.main },
      { type: 'column', position: [8.8, -6.5], color: t.wall.color, accent: t.main },
      { type: 'column', position: [-8.8, 4.5], color: t.wall.color, accent: t.main },
      { type: 'column', position: [8.8, 4.5], color: t.wall.color, accent: t.main },
      { type: 'beam', position: [0, -11], size: [24, 0.4, 0.5], y: 8.4, color: t.main },
      { type: 'beam', position: [0, 8], size: [24, 0.4, 0.5], y: 8.4, color: t.main },
      ...t.decor,
    ],
    exits: [
      { id: 'south', position: [0, 13.65], radius: 0.9, spawnOffset: [0, -1.7], spawnYaw: PI, to: t.prev, label: '来时的门', requires: [LEAGUE_SEALED], lockedHint: SEALED_HINT },
      { id: 'north', position: [0, -13.4], radius: 1.0, spawnOffset: [0, 1.7], spawnYaw: 0, to: t.next, label: '下一间', requires: [trainerDefeatedFlag(t.trainer)], lockedHint: t.lockedHint },
    ],
    npcs: [{ id: t.npc, position: [0, -7.6], yaw: 0 }],
  };
}

/** 厅间回廊：10 × 18，补给台服务员 + 长椅 + 下一间的说明牌 */
function corridor(n: number, prev: string, next: { room: string; exit: string }, color: string): RoomConfig {
  return {
    id: `corridor-${n}`,
    name: `精灵联盟 · 第 ${n} 回廊`,
    size: [10, 18, 6],
    floor: { color: '#e8e2d6', pattern: 'checker', accent: '#cfc6b4' },
    wall: { color: '#f2eee6', trim: color, wainscot: '#8a8478' },
    lighting: 'center',
    bgm: 'league',
    cameraDistance: 10,
    furniture: [
      { type: 'rug', position: [0, 0], size: [2.4, 0.02, 14], color, accent: '#e8c870' },
      { type: 'counter', position: [-2.6, -2.4], yaw: PI / 2, size: [2.6, 1.0, 0.7], color: '#e8e2d8', accent: color },
      { type: 'shelf', position: [-4.7, -2.4], yaw: PI / 2, size: [2.4, 2.0, 0.4], color: '#a88a68' },
      { type: 'sofa', position: [4.1, 2.6], yaw: -PI / 2, size: [2.4, 0.9, 0.9], color },
      { type: 'plant', position: [4.2, -6.6] },
      { type: 'plant', position: [-4.2, 6.8] },
      { type: 'lamp', position: [4.2, 6.6], color: '#fff2d0' },
      { type: 'poster', position: [4.96, -2.4], yaw: -PI / 2, size: [1.4, 1.0, 0.02], color, accent: '#ffffff', interact: `league-corridor-${n}-sign` },
      { type: 'pennant', position: [-1.8, -7.2], color, accent: '#e8c870' },
      { type: 'pennant', position: [1.8, -7.2], color, accent: '#e8c870' },
    ],
    exits: [
      { id: 'south', position: [0, 8.65], radius: 0.9, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: prev, exit: 'north' }, label: '来时的门', requires: [LEAGUE_SEALED], lockedHint: SEALED_HINT },
      { id: 'north', position: [0, -8.4], radius: 1.0, spawnOffset: [0, 1.6], spawnYaw: 0, to: next, label: '继续前进' },
    ],
    npcs: [{ id: `league-attendant-${n}`, position: [-3.7, -2.4], yaw: PI / 2 }],
  };
}

const lobby: RoomConfig = {
  id: 'lobby',
  name: '精灵联盟 · 大厅',
  size: [28, 22, 8],
  floor: { color: '#ece6da', pattern: 'checker', accent: '#d2c8b4' },
  wall: { color: '#f4f0e8', trim: '#2a4a7a', wainscot: '#6a6a78' },
  lighting: 'center',
  bgm: 'league',
  cameraDistance: 15,
  furniture: [
    { type: 'rug', position: [0, 0.2], size: [3.4, 0.02, 18.6], color: '#2a4a7a', accent: '#e8c870' },
    // 护士站（西）
    { type: 'healer', position: [-8, -9.8], interact: 'healer' },
    { type: 'counter', position: [-8, -7.4], size: [4.2, 1.0, 0.7], color: '#e8e2d8', accent: '#d84a4a' },
    // 联盟商店（东）
    { type: 'shelf', position: [8, -10.5], size: [3.6, 2.2, 0.6], color: '#a88a68' },
    { type: 'counter', position: [8, -7.4], size: [4.2, 1.0, 0.7], color: '#e8e2d8', accent: '#3a7ac8' },
    { type: 'pc', position: [12.6, -10.4], interact: 'pc-home' },
    // 通往四天王之间的大门两侧
    { type: 'column', position: [-3.2, -9.8], color: '#f4f0e8', accent: '#2a4a7a' },
    { type: 'column', position: [3.2, -9.8], color: '#f4f0e8', accent: '#2a4a7a' },
    { type: 'emblem', position: [0, -10.96], size: [2.4, 2.4, 0.02], y: 5.6, color: '#2a4a7a', accent: '#e8c870' },
    { type: 'poster', position: [-13.96, -2], yaw: PI / 2, size: [2.2, 1.4, 0.02], color: '#2a4a7a', accent: '#e8c870', interact: 'league-rules' },
    { type: 'trophy', position: [13.45, 0], yaw: -PI / 2, color: '#5a4a3a', accent: '#e8c870', interact: 'league-trophy' },
    { type: 'banner', position: [-13.96, 4.6], yaw: PI / 2, size: [1.2, 3.0, 0.02], y: 6.4, color: '#2a4a7a', accent: '#e8c870' },
    { type: 'banner', position: [13.96, 4.6], yaw: -PI / 2, size: [1.2, 3.0, 0.02], y: 6.4, color: '#2a4a7a', accent: '#e8c870' },
    { type: 'sofa', position: [-11.6, 5.6], yaw: PI / 2, size: [2.8, 0.9, 0.9], color: '#4a6a9a' },
    { type: 'sofa', position: [11.6, 5.6], yaw: -PI / 2, size: [2.8, 0.9, 0.9], color: '#4a6a9a' },
    { type: 'table', position: [-9.8, 5.6], size: [1.2, 0.5, 1.2], color: '#c8b48a' },
    { type: 'plant', position: [-13, 9.6] },
    { type: 'plant', position: [13, 9.6] },
    { type: 'plant', position: [-13, -10.2] },
    { type: 'skylight', position: [0, 0], size: [8, 0.3, 6], y: 7.6, color: '#fff4dc' },
    { type: 'lamp', position: [-4.6, 8.6], color: '#fff2d0' },
    { type: 'lamp', position: [4.6, 8.6], color: '#fff2d0' },
  ],
  exits: [
    { id: 'front', position: [0, 10.65], radius: 0.9, spawnOffset: [0, -1.5], spawnYaw: PI, to: { overworld: true, poi: 'league-entrance' }, label: '出口' },
    {
      id: 'north',
      position: [0, -10.4],
      radius: 1.0,
      spawnOffset: [0, 1.6],
      spawnYaw: 0,
      to: { room: 'elite-1', exit: 'south' },
      label: '四天王之间',
      requires: [VICTORY_ROAD_CLEARED],
      lockedHint: '「只有走完冠军之路的训练家，才能挑战四天王。」',
      confirm: ['前面就是四天王之间。', '一旦进去，在打倒冠军——或者全队倒下——之前，都无法回到这间大厅。', '要开始挑战吗？'],
      onPass: { clear: leagueRunResetFlags(), set: [LEAGUE_RUN_FLAG] },
    },
  ],
  npcs: [
    { id: 'league-guard', position: [2.2, -8.2], yaw: 0 },
    { id: 'league-nurse', position: [-8, -8.6], yaw: 0 },
    { id: 'league-clerk', position: [8, -8.6], yaw: 0 },
    { id: 'league-fan', position: [-9.4, 2.4], yaw: PI / 2 },
  ],
};

const champion: RoomConfig = {
  id: 'champion',
  name: '精灵联盟 · 冠军之间',
  size: [30, 32, 10],
  floor: { color: '#e4f2f6', pattern: 'wave', accent: '#c4e2ec', deep: '#5aa8c8' },
  wall: { color: '#f0f8fa', trim: '#2a6ab8', wainscot: '#9fd0e8', relief: 'wave', reliefColor: '#f8fcfd' },
  lighting: 'gym',
  bgm: 'league',
  cameraDistance: 17,
  battleStage: { position: [0, -2], yaw: PI, radius: 6 },
  furniture: [
    { type: 'rug', position: [0, 4], size: [3.6, 0.02, 20], color: '#2a6ab8', accent: '#e8c870' },
    { type: 'dais', position: [0, -11.4], size: [8, 0.5, 2.8], color: '#2a6ab8', accent: '#bfe6f8' },
    { type: 'emblem', position: [-5.6, -15.96], size: [2.8, 2.8, 0.02], y: 6, color: '#2a6ab8', accent: '#e8f6f8' },
    { type: 'emblem', position: [5.6, -15.96], size: [2.8, 2.8, 0.02], y: 6, color: '#2a6ab8', accent: '#e8f6f8' },
    { type: 'fountain', position: [-6, -12], size: [1.8, 3.4, 1.0], color: '#e8f6f8', accent: '#2a6ab8' },
    { type: 'fountain', position: [6, -12], size: [1.8, 3.4, 1.0], color: '#e8f6f8', accent: '#2a6ab8' },
    { type: 'aquarium', position: [-13, -13], size: [3.6, 1.6, 1.2], color: '#2a6ab8', accent: '#6ad0f0' },
    { type: 'aquarium', position: [13, -13], size: [3.6, 1.6, 1.2], color: '#2a6ab8', accent: '#6ad0f0' },
    { type: 'column', position: [-11, -7], color: '#f0f8fa', accent: '#2a6ab8' },
    { type: 'column', position: [11, -7], color: '#f0f8fa', accent: '#2a6ab8' },
    { type: 'column', position: [-11, 5], color: '#f0f8fa', accent: '#2a6ab8' },
    { type: 'column', position: [11, 5], color: '#f0f8fa', accent: '#2a6ab8' },
    { type: 'banner', position: [-14.96, -1], yaw: PI / 2, size: [1.4, 3.8, 0.02], y: 8, color: '#2a6ab8', accent: '#e8c870' },
    { type: 'banner', position: [14.96, -1], yaw: -PI / 2, size: [1.4, 3.8, 0.02], y: 8, color: '#2a6ab8', accent: '#e8c870' },
    { type: 'skylight', position: [0, -2], size: [10, 0.3, 8], y: 9.6, color: '#d8f2fc' },
    { type: 'skylight', position: [0, -12], size: [6, 0.3, 3], y: 9.6, color: '#d8f2fc' },
    { type: 'beam', position: [0, -14], size: [30, 0.4, 0.5], y: 9.4, color: '#2a6ab8' },
    { type: 'beam', position: [0, 10], size: [30, 0.4, 0.5], y: 9.4, color: '#2a6ab8' },
    { type: 'crystal', position: [-13.4, 12.6], color: '#8fe0f0' },
    { type: 'crystal', position: [13.4, 12.6], color: '#8fe0f0' },
    { type: 'lamp', position: [-8, -2], color: '#bfe8f5' },
    { type: 'lamp', position: [8, -2], color: '#bfe8f5' },
  ],
  exits: [
    { id: 'south', position: [0, 15.65], radius: 0.9, spawnOffset: [0, -1.7], spawnYaw: PI, to: { room: 'corridor-4', exit: 'north' }, label: '来时的门', requires: [LEAGUE_SEALED], lockedHint: SEALED_HINT },
    {
      id: 'north',
      position: [0, -15.4],
      radius: 1.0,
      spawnOffset: [1.8, 0],
      spawnYaw: PI / 2,
      to: { room: 'hall-of-fame', exit: 'west' },
      label: '名人堂',
      requires: [trainerDefeatedFlag('league-champion')],
      lockedHint: '冠军米可利站在通往名人堂的门前。',
    },
  ],
  npcs: [{ id: 'league-mikuli', position: [0, -9.2], yaw: 0 }],
};

const hallOfFame: RoomConfig = {
  id: 'hall-of-fame',
  name: '精灵联盟 · 名人堂',
  size: [22, 20, 9],
  floor: { color: '#f2e6c8', pattern: 'tile', accent: '#e0cc9a' },
  wall: { color: '#f8f0dc', trim: '#c8a040', wainscot: '#a8884a' },
  lighting: 'gym',
  bgm: 'league',
  cameraDistance: 13,
  furniture: [
    { type: 'rug', position: [0, 0], size: [3.0, 0.02, 15], color: '#c8a040', accent: '#8a2a2a' },
    { type: 'rug', position: [-5.4, 0], size: [8, 0.02, 2.4], color: '#c8a040', accent: '#8a2a2a' },
    { type: 'machine', position: [0, -8.6], size: [3.2, 2.2, 1.0], color: '#c8a040', accent: '#5fd0e0', interact: 'league-hof-machine' },
    { type: 'dais', position: [0, -6.4], size: [6, 0.3, 2.0], color: '#c8a040', accent: '#f8e8b0' },
    { type: 'emblem', position: [0, -9.96], size: [2.6, 2.6, 0.02], y: 5.6, color: '#c8a040', accent: '#fff4d0' },
    { type: 'trophy', position: [-6.4, -9.2], color: '#5a4a3a', accent: '#e8c870' },
    { type: 'trophy', position: [6.4, -9.2], color: '#5a4a3a', accent: '#e8c870' },
    { type: 'column', position: [-8, -5], color: '#f8f0dc', accent: '#c8a040' },
    { type: 'column', position: [8, -5], color: '#f8f0dc', accent: '#c8a040' },
    { type: 'column', position: [8, 4], color: '#f8f0dc', accent: '#c8a040' },
    { type: 'banner', position: [10.96, -1], yaw: -PI / 2, size: [1.3, 3.4, 0.02], y: 7.2, color: '#c8a040', accent: '#8a2a2a' },
    { type: 'banner', position: [-4, -9.96], size: [1.2, 3.0, 0.02], y: 7.2, color: '#8a2a2a', accent: '#e8c870' },
    { type: 'banner', position: [4, -9.96], size: [1.2, 3.0, 0.02], y: 7.2, color: '#8a2a2a', accent: '#e8c870' },
    { type: 'skylight', position: [0, -4], size: [7, 0.3, 6], y: 8.6, color: '#fff4dc' },
    { type: 'plant', position: [9.6, 8.6] },
    { type: 'plant', position: [-9.6, 8.6] },
  ],
  exits: [
    { id: 'west', position: [-10.65, 0], radius: 0.9, spawnOffset: [1.8, 0], spawnYaw: PI / 2, to: { room: 'champion', exit: 'north' }, label: '冠军之间', requires: [LEAGUE_SEALED], lockedHint: '冠军之间的门已经合上了。出口在南边。' },
    { id: 'front', position: [0, 9.65], radius: 0.9, spawnOffset: [0, -1.5], spawnYaw: PI, to: { overworld: true, poi: 'league-entrance' }, label: '回到彩幽市' },
  ],
  npcs: [{ id: 'league-hof-keeper', position: [3.6, -5.2], yaw: -0.5 }],
  triggers: [
    {
      id: 'league-hof',
      position: [-8, 0],
      radius: 3.2,
      script: 'league-hall-of-fame',
      doneFlag: LEAGUE_HOF_RUN_FLAG,
      showIf: [trainerDefeatedFlag('league-champion')],
    },
  ],
};

export const LEAGUE_INTERIOR: InteriorConfig = {
  id: 'pokemon-league',
  name: '精灵联盟',
  entryRoom: 'lobby',
  entryExit: 'front',
  bgm: 'league',
  rooms: [
    lobby,
    eliteHall({
      id: 'elite-1',
      name: '四天王 · 花月之间',
      floor: { color: '#241e2c', pattern: 'checker', accent: '#3a2e48' },
      wall: { color: '#2e2838', trim: '#c83a5a', wainscot: '#1a1620' },
      main: '#c83a5a',
      accent: '#2a1a24',
      decor: [
        { type: 'torch', position: [-4.6, -10.6], color: '#ff5a7a' },
        { type: 'torch', position: [4.6, -10.6], color: '#ff5a7a' },
        { type: 'torch', position: [-11, 0], color: '#ff5a7a' },
        { type: 'torch', position: [11, 0], color: '#ff5a7a' },
        { type: 'crystal', position: [-10.6, -12.4], color: '#8a2a4a' },
        { type: 'crystal', position: [10.6, -12.4], color: '#8a2a4a' },
        { type: 'crystal', position: [-10.6, 11.6], color: '#5a1a3a' },
        { type: 'crystal', position: [10.6, 11.6], color: '#5a1a3a' },
      ],
      npc: 'league-huayue',
      trainer: 'league-e1',
      prev: { room: 'lobby', exit: 'north' },
      next: { room: 'corridor-1', exit: 'south' },
      lockedHint: '花月抱着手臂挡在门前：「想过去？先打倒我。」',
    }),
    corridor(1, 'elite-1', { room: 'elite-2', exit: 'south' }, '#9a7ad8'),
    eliteHall({
      id: 'elite-2',
      name: '四天王 · 芙蓉之间',
      floor: { color: '#2a2440', pattern: 'tile', accent: '#3a3258' },
      wall: { color: '#3a3450', trim: '#9a7ad8', wainscot: '#221e30' },
      main: '#6a4aa8',
      accent: '#d8c8ff',
      decor: [
        { type: 'torch', position: [-4.6, -10.6], color: '#a080ff' },
        { type: 'torch', position: [4.6, -10.6], color: '#a080ff' },
        { type: 'lamp', position: [-10.8, -2], color: '#c8a0ff' },
        { type: 'lamp', position: [10.8, -2], color: '#c8a0ff' },
        { type: 'lamp', position: [-10.8, 9], color: '#c8a0ff' },
        { type: 'lamp', position: [10.8, 9], color: '#c8a0ff' },
        { type: 'stalagmite', position: [-10.4, -12.2], size: [0.9, 2.2, 0.9], color: '#4a4060' },
        { type: 'stalagmite', position: [10.4, -12.2], size: [0.9, 2.2, 0.9], color: '#4a4060' },
        { type: 'pennant', position: [-6.4, 10.4], color: '#6a4aa8', accent: '#d8c8ff' },
        { type: 'pennant', position: [6.4, 10.4], color: '#6a4aa8', accent: '#d8c8ff' },
      ],
      npc: 'league-furong',
      trainer: 'league-e2',
      prev: { room: 'corridor-1', exit: 'north' },
      next: { room: 'corridor-2', exit: 'south' },
      lockedHint: '一团幽幽的鬼火挡在门前……芙蓉在台座前微笑着。',
    }),
    corridor(2, 'elite-2', { room: 'elite-3', exit: 'south' }, '#5aa8d8'),
    eliteHall({
      id: 'elite-3',
      name: '四天王 · 波妮之间',
      floor: { color: '#dceef8', pattern: 'wave', accent: '#b8dcf0', deep: '#7ab8dc' },
      wall: { color: '#e8f4fb', trim: '#5aa8d8', wainscot: '#a8d4ec', relief: 'wave', reliefColor: '#f4fafd' },
      main: '#5aa8d8',
      accent: '#f4fbff',
      decor: [
        { type: 'crystal', position: [-4.6, -11.2], size: [0.9, 2.2, 0.9], color: '#bfe8ff' },
        { type: 'crystal', position: [4.6, -11.2], size: [0.9, 2.2, 0.9], color: '#bfe8ff' },
        { type: 'crystal', position: [-10.6, -12.2], size: [1.0, 2.6, 1.0], color: '#d8f2ff' },
        { type: 'crystal', position: [10.6, -12.2], size: [1.0, 2.6, 1.0], color: '#d8f2ff' },
        { type: 'crystal', position: [-10.8, -1], color: '#a8dcff' },
        { type: 'crystal', position: [10.8, -1], color: '#a8dcff' },
        { type: 'crystal', position: [-10.6, 11.4], size: [0.8, 1.8, 0.8], color: '#d8f2ff' },
        { type: 'crystal', position: [10.6, 11.4], size: [0.8, 1.8, 0.8], color: '#d8f2ff' },
        { type: 'skylight', position: [0, -2], size: [8, 0.3, 6], y: 8.6, color: '#e8f8ff' },
      ],
      npc: 'league-boni',
      trainer: 'league-e3',
      prev: { room: 'corridor-2', exit: 'north' },
      next: { room: 'corridor-3', exit: 'south' },
      lockedHint: '门前结着一层厚厚的冰。波妮静静地等着你。',
    }),
    corridor(3, 'elite-3', { room: 'elite-4', exit: 'south' }, '#d8a040'),
    eliteHall({
      id: 'elite-4',
      name: '四天王 · 源治之间',
      floor: { color: '#5a4030', pattern: 'rock', accent: '#4a3428' },
      wall: { color: '#6a4a38', trim: '#d8a040', wainscot: '#3e2a20' },
      main: '#a83a2a',
      accent: '#e8c060',
      decor: [
        { type: 'torch', position: [-4.6, -10.6], color: '#ffa040' },
        { type: 'torch', position: [4.6, -10.6], color: '#ffa040' },
        { type: 'torch', position: [-11, 0], color: '#ffa040' },
        { type: 'torch', position: [11, 0], color: '#ffa040' },
        { type: 'stalagmite', position: [-10.4, -12], size: [1.4, 4.2, 1.4], color: '#7a5a44' },
        { type: 'stalagmite', position: [10.4, -12], size: [1.4, 4.2, 1.4], color: '#7a5a44' },
        { type: 'stalagmite', position: [-10.6, 11.2], size: [1.1, 2.6, 1.1], color: '#7a5a44' },
        { type: 'stalagmite', position: [10.6, 11.2], size: [1.1, 2.6, 1.1], color: '#7a5a44' },
        { type: 'pennant', position: [-6.4, 10.4], color: '#a83a2a', accent: '#e8c060' },
        { type: 'pennant', position: [6.4, 10.4], color: '#a83a2a', accent: '#e8c060' },
      ],
      npc: 'league-yuanzhi',
      trainer: 'league-e4',
      prev: { room: 'corridor-3', exit: 'north' },
      next: { room: 'corridor-4', exit: 'south' },
      lockedHint: '源治像一座山一样挡在门前：「风暴还没过去呢。」',
    }),
    corridor(4, 'elite-4', { room: 'champion', exit: 'south' }, '#2a6ab8'),
    champion,
    hallOfFame,
  ],
};

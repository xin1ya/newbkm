/**
 * M1-05 · 萌芽群岛室内场景（灰盒布置，家具程序化生成；美术模型到位后按同一坐标替换）。
 * 对应 sprout.ts 中 PoiConfig.interior。
 */
import type { ExitConfig, InteriorConfig } from './types';

const PI = Math.PI;

/** 正门：固定在 +Z 墙中央 */
function frontDoor(depth: number, x = 0): ExitConfig {
  return { id: 'front', position: [x, depth / 2 - 0.35], radius: 0.85, spawnOffset: [0, -1.4], spawnYaw: PI, to: { overworld: true }, label: '出门' };
}

export const SPROUT_INTERIORS: InteriorConfig[] = [
  // ————————————————————————— 自己家（两层） —————————————————————————
  {
    id: 'sprout-player-house',
    name: '自己家',
    entryRoom: '1f',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: '1f',
        name: '自己家 1F',
        size: [10, 8, 3],
        floor: { color: '#c89a6a', pattern: 'plank', accent: '#b08658' },
        wall: { color: '#f3e6cf', trim: '#8a6a4a', wainscot: '#d9c3a0' },
        lighting: 'home',
        furniture: [
          { type: 'rug', position: [-1.2, 0.6], size: [3.4, 0.02, 2.4], color: '#d9674e', accent: '#f2c46b' },
          { type: 'table', position: [-1.2, 0.6], size: [1.8, 0.75, 1.1], color: '#a0703f' },
          { type: 'chair', position: [-2.4, 0.6], yaw: PI / 2, color: '#a0703f' },
          { type: 'chair', position: [0, 0.6], yaw: -PI / 2, color: '#a0703f' },
          { type: 'sofa', position: [-3.6, -2.6], yaw: 0, color: '#5b8fc9', accent: '#e8eef6' },
          { type: 'tv', position: [-3.6, -0.6], yaw: PI, interact: 'house-tv' },
          { type: 'counter', position: [2.6, -3.35], size: [3.2, 0.95, 0.7], color: '#f0f0ea', accent: '#8fa6b8' },
          { type: 'stove', position: [1.4, -3.35] },
          { type: 'fridge', position: [4.35, -3.3], interact: 'house-fridge' },
          { type: 'plant', position: [-4.5, 3.3] },
          { type: 'plant', position: [4.5, 3.3] },
          { type: 'bookshelf', position: [0.4, -3.55], size: [1.4, 1.9, 0.45], color: '#8a6040', interact: 'house-books' },
          { type: 'window', position: [-2.2, -4], size: [1.6, 1.1, 0.1] },
          { type: 'window', position: [-5, 0.8], yaw: PI / 2, size: [1.4, 1.1, 0.1] },
          { type: 'lamp', position: [-4.5, -3.4], color: '#f6e7b5' },
          // 计划文档 §9.5：爸爸留下的能量方块机（靠右墙）
          { type: 'blender', position: [4.35, 1.9], yaw: -PI / 2, interact: 'block-machine-home' },
        ],
        exits: [
          frontDoor(8),
          { id: 'stairs-up', position: [4.1, -0.4], radius: 0.8, spawnOffset: [-1.2, 0], spawnYaw: -PI / 2, to: { room: '2f', exit: 'stairs-down' }, label: '上楼' },
        ],
        npcs: [{ id: 'mom', position: [2.2, -2.3], yaw: PI }],
      },
      {
        id: '2f',
        name: '自己家 2F · 我的房间',
        size: [8, 7, 2.8],
        floor: { color: '#d8b48a', pattern: 'plank', accent: '#c29f78' },
        wall: { color: '#dfe9f2', trim: '#6f8aa6', wainscot: '#c4d4e3' },
        lighting: 'home',
        furniture: [
          { type: 'bed', position: [-2.7, -2.1], color: '#8a5a3a', accent: '#e85d5d', interact: 'bed' },
          { type: 'desk', position: [1.4, -3.05], size: [1.6, 0.75, 0.7], color: '#9d7650' },
          { type: 'pc', position: [1.4, -3.15], interact: 'pc-home' },
          { type: 'chair', position: [1.4, -2.3], yaw: PI, color: '#4a6fa5' },
          { type: 'rug', position: [0, 0.4], size: [2.6, 0.02, 2], color: '#6ab0de', accent: '#fff4c2' },
          { type: 'tv', position: [3.4, 0.2], yaw: -PI / 2, size: [1.1, 0.7, 0.2], interact: 'game-console' },
          { type: 'shelf', position: [-3.7, 1.2], yaw: PI / 2, size: [1.4, 1.2, 0.4], color: '#9d7650' },
          { type: 'plant', position: [3.5, -3.1] },
          { type: 'poster', position: [-0.9, -3.5], size: [0.8, 1.0, 0.02], color: '#f2c14e', accent: '#3a7bd5' },
          { type: 'window', position: [-1.2, -3.5], size: [1.2, 1.0, 0.1] },
        ],
        exits: [{ id: 'stairs-down', position: [3.2, 2.6], radius: 0.8, spawnOffset: [0, -1.2], spawnYaw: PI, to: { room: '1f', exit: 'stairs-up' }, label: '下楼' }],
      },
    ],
  },

  // ————————————————————————— 木兰博士研究所 —————————————————————————
  {
    id: 'sprout-lab',
    name: '木兰博士研究所',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'lab',
    rooms: [
      {
        id: 'main',
        name: '木兰博士研究所',
        size: [16, 11, 3.6],
        floor: { color: '#e6e9ec', pattern: 'tile', accent: '#cfd6dc' },
        wall: { color: '#f7f8f4', trim: '#4f9a8c', wainscot: '#d8ece6' },
        lighting: 'lab',
        furniture: [
          // 御三家精灵球桌（剧情 M1-13 使用）
          { type: 'table', position: [0, -2.2], size: [2.6, 0.9, 1.1], color: '#5d7a8c', accent: '#e9eef1', interact: 'starter-table' },
          { type: 'machine', position: [-6.2, -4.6], size: [2.2, 2.2, 1.0], color: '#9aa7b4', accent: '#43d6b5', interact: 'lab-scanner' },
          // 新手村治疗点：研究所的宝可梦恢复机（与宝可梦中心同款）
          { type: 'healer', position: [-3.6, -4.7], interact: 'lab-healer' },
          { type: 'pc', position: [4.8, -4.9], interact: 'pc-lab' },
          { type: 'desk', position: [4.8, -4.6], size: [2.4, 0.78, 0.9], color: '#8a9ba8' },
          { type: 'chair', position: [4.8, -3.6], yaw: PI, color: '#35536b' },
          { type: 'bookshelf', position: [7.55, -3.2], yaw: -PI / 2, size: [2.2, 2.4, 0.5], color: '#7a5a3c', interact: 'lab-books-1' },
          { type: 'bookshelf', position: [7.55, -0.6], yaw: -PI / 2, size: [2.2, 2.4, 0.5], color: '#7a5a3c', interact: 'lab-books-2' },
          { type: 'bookshelf', position: [-7.55, -1.4], yaw: PI / 2, size: [2.2, 2.4, 0.5], color: '#7a5a3c', interact: 'lab-books-3' },
          { type: 'aquarium', position: [-6.4, 2.4], size: [2.2, 1.3, 0.9], interact: 'lab-aquarium' },
          { type: 'table', position: [4.6, 1.6], size: [2.2, 0.85, 1.0], color: '#dfe5ea' },
          { type: 'crate', position: [6.9, 3.9], size: [0.9, 0.9, 0.9], color: '#b88a55' },
          { type: 'crate', position: [6.9, 2.9], size: [0.8, 0.7, 0.8], color: '#a57a48' },
          { type: 'plant', position: [-7.2, 4.8] },
          { type: 'plant', position: [7.2, 4.8] },
          { type: 'plant', position: [-1.8, -5.0] },
          { type: 'window', position: [-2, -5.5], size: [2.2, 1.3, 0.1] },
          { type: 'window', position: [2, -5.5], size: [2.2, 1.3, 0.1] },
          { type: 'poster', position: [0, -5.5], size: [1.1, 0.8, 0.02], color: '#43a38a', accent: '#ffffff' },
        ],
        exits: [frontDoor(11)],
        npcs: [
          { id: 'magnolia', position: [0, -3.4], yaw: 0 },
          { id: 'lab-aide-1', position: [-5.0, -3.4], yaw: PI },
          { id: 'lab-aide-2', position: [4.6, 0.6], yaw: 0 },
        ],
      },
    ],
  },

  // ————————————————————————— 蒲婆婆家 —————————————————————————
  {
    id: 'sprout-elder-house',
    name: '蒲婆婆家',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'home',
    rooms: [
      {
        id: 'main',
        name: '蒲婆婆家',
        size: [8, 7, 2.9],
        floor: { color: '#9c7a55', pattern: 'plank', accent: '#8a6a48' },
        wall: { color: '#efe2c4', trim: '#6b4f33', wainscot: '#c7ae83' },
        lighting: 'home',
        furniture: [
          { type: 'rug', position: [0, 0.3], size: [2.8, 0.02, 2.0], color: '#7d9a52', accent: '#e8d9a8' },
          { type: 'table', position: [0, 0.3], size: [1.3, 0.7, 0.9], color: '#7a5634' },
          { type: 'chair', position: [-1.0, 0.3], yaw: PI / 2, color: '#7a5634' },
          { type: 'shelf', position: [-2.6, -3.1], size: [2.2, 1.6, 0.5], color: '#6b4a2c', accent: '#8fbf5a', interact: 'herb-shelf' },
          { type: 'barrel', position: [3.3, -2.9] },
          { type: 'barrel', position: [2.5, -3.0], size: [0.6, 0.8, 0.6] },
          { type: 'stove', position: [1.0, -3.2], color: '#4b4b52' },
          { type: 'bed', position: [2.9, 0.8], yaw: -PI / 2, size: [1.1, 0.55, 2.0], color: '#6b4a2c', accent: '#d9b36a' },
          { type: 'plant', position: [-3.5, 3.0] },
          { type: 'plant', position: [-3.5, -1.3], size: [0.5, 0.9, 0.5] },
          { type: 'window', position: [-4, 0.4], yaw: PI / 2, size: [1.2, 1.0, 0.1] },
          { type: 'lamp', position: [3.5, 3.0], color: '#f3d9a0' },
        ],
        exits: [frontDoor(7)],
        npcs: [{ id: 'elder-pu', position: [0.9, 0.3], yaw: -PI / 2 }],
      },
    ],
  },

  // ————————————————————————— 宝可梦中心（各镇共用布局） —————————————————————————
  {
    id: 'pokecenter',
    name: '宝可梦中心',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'pokecenter',
    rooms: [
      {
        id: 'main',
        name: '宝可梦中心',
        size: [14, 11, 3.6],
        floor: { color: '#f4ece4', pattern: 'checker', accent: '#e8d6c8' },
        wall: { color: '#fff7f2', trim: '#e0525a', wainscot: '#f7d6d2' },
        lighting: 'center',
        furniture: [
          { type: 'counter', position: [0, -3.2], size: [5.6, 1.05, 0.9], color: '#e0525a', accent: '#fff4ef', interact: 'nurse-counter' },
          { type: 'healer', position: [-1.6, -4.7], interact: 'healer' },
          { type: 'pc', position: [5.6, -4.9], interact: 'pc-center' },
          { type: 'desk', position: [5.6, -4.6], size: [1.8, 0.78, 0.8], color: '#d8dde2' },
          { type: 'sofa', position: [-5.2, 1.6], yaw: PI / 2, color: '#ef8a7a', accent: '#fff4ef' },
          { type: 'sofa', position: [5.2, 1.6], yaw: -PI / 2, color: '#ef8a7a', accent: '#fff4ef' },
          { type: 'table', position: [-3.9, 1.6], size: [0.8, 0.45, 1.3], color: '#f0e3d4' },
          { type: 'rug', position: [0, 2.8], size: [3.2, 0.02, 3.2], color: '#e0525a', accent: '#fff4ef' },
          { type: 'plant', position: [-6.3, -4.8] },
          { type: 'plant', position: [6.3, 4.8] },
          { type: 'plant', position: [-6.3, 4.8] },
          { type: 'poster', position: [-4.5, -5.5], size: [1.2, 0.9, 0.02], color: '#ffffff', accent: '#e0525a' },
          { type: 'window', position: [3.5, -5.5], size: [1.8, 1.2, 0.1] },
          // 计划文档 §9.5：工坊工作台（工匠阿铁）
          { type: 'workbench', position: [-4.7, -4.85], size: [1.7, 0.9, 0.75], color: '#9a6a3e', accent: '#7a7f8c' },
        ],
        exits: [frontDoor(11)],
        npcs: [
          { id: 'nurse', position: [0, -4.1], yaw: 0 },
          { id: 'workshop-tie', position: [-4.7, -3.9], yaw: 0 },
          { id: 'center-visitor', position: [4.2, 2.8], yaw: -PI / 2 },
          { id: 'move-reminder', position: [-4.0, 3.0], yaw: PI / 2 },
        ],
      },
    ],
  },

  // ————————————————————————— 友好商店 —————————————————————————
  {
    id: 'mart',
    name: '友好商店',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'mart',
    rooms: [
      {
        id: 'main',
        name: '友好商店',
        size: [11, 9, 3.2],
        floor: { color: '#e9eef2', pattern: 'tile', accent: '#d5dee6' },
        wall: { color: '#f6fbff', trim: '#3a7bd5', wainscot: '#d4e4f7' },
        lighting: 'mart',
        furniture: [
          { type: 'counter', position: [-3.6, 1.8], yaw: PI / 2, size: [3.0, 1.0, 0.9], color: '#3a7bd5', accent: '#f6fbff', interact: 'mart-counter' },
          { type: 'shelf', position: [1.2, -1.2], size: [3.2, 1.7, 0.7], color: '#c7d3de', accent: '#f2a23a', interact: 'mart-shelf-1' },
          { type: 'shelf', position: [1.2, 1.2], size: [3.2, 1.7, 0.7], color: '#c7d3de', accent: '#58b368', interact: 'mart-shelf-2' },
          { type: 'shelf', position: [1.2, -4.1], size: [6.0, 2.0, 0.6], color: '#c7d3de', accent: '#e0525a' },
          { type: 'fridge', position: [5.0, -1.6], yaw: -PI / 2, size: [1.0, 2.0, 0.8], color: '#e8f2f8', accent: '#9fd4f0' },
          { type: 'fridge', position: [5.0, -0.5], yaw: -PI / 2, size: [1.0, 2.0, 0.8], color: '#e8f2f8', accent: '#9fd4f0' },
          { type: 'crate', position: [4.6, 3.3], size: [0.8, 0.6, 0.8], color: '#c8a26e' },
          { type: 'plant', position: [-4.9, -3.8] },
          { type: 'poster', position: [-2.4, -4.5], size: [1.2, 0.8, 0.02], color: '#f2c14e', accent: '#3a7bd5' },
        ],
        exits: [frontDoor(9, 1.6)],
        npcs: [
          { id: 'clerk', position: [-4.5, 1.8], yaw: PI / 2 },
          { id: 'mart-shopper', position: [3.2, 0], yaw: -PI / 2 },
        ],
      },
    ],
  },

  // ————————————————————————— 翠澜道馆（水系 · M1-11 水位机关） —————————————————————————
  // 布局（房间 30 × 40，+Z 为正门）：
  //   大厅 z 13 … 20 → 水池 z -5 … 13（两档水位）→ 馆主台 z -20 … -5
  //   高水位：木筏 R1 连接大厅与石岛 A；木筏 R2 连接石岛 B 与馆主台
  //   低水位：石栈道 W1 连接石岛 A 与石岛 B
  //   解法：R1 → A（转阀门 → 低）→ W1 → B（转阀门 → 高）→ R2 → 馆主台；原路返回同理
  {
    id: 'gym-cuilan',
    name: '翠澜道馆',
    entryRoom: 'hall',
    entryExit: 'front',
    bgm: 'gym',
    rooms: [
      {
        id: 'hall',
        name: '翠澜道馆',
        size: [30, 40, 7],
        // 第二轮：水纹马赛克地面 + 护墙板水波浮雕
        floor: { color: '#d6ecf0', pattern: 'wave', accent: '#b4dde6', deep: '#7cc0d6' },
        wall: { color: '#e4f4f7', trim: '#2f7fa8', wainscot: '#9fd0dd', relief: 'wave', reliefColor: '#f4fbfd' },
        lighting: 'gym',
        cameraDistance: 16,
        floorHole: [-15, -5, 15, 13],
        // 场地中心 = 舞台前方 5.6 m（z -11.8），半径 5.5 → z -6.3 … -17.3，不压水池（z > -5）和池沿
        battleStage: { position: [0, -6.2], yaw: PI, radius: 5.5 },
        waterPuzzle: {
          pool: [-15, -5, 15, 13],
          start: 'high',
          levels: { high: 0.14, low: -1.1 },
          tiles: [
            { id: 'isle-a', kind: 'island', when: 'always', rect: [-12, 3, -6, 9] },
            { id: 'isle-b', kind: 'island', when: 'always', rect: [6, -2, 12, 4] },
            // 中央石台：纯装饰（喷泉像），任何水位都走不到
            { id: 'isle-statue', kind: 'island', when: 'always', rect: [-2, 8.5, 2, 11.5] },
            { id: 'raft-1', kind: 'raft', when: 'high', rect: [-10, 9, -8, 13] },
            { id: 'walk-1a', kind: 'walkway', when: 'low', rect: [-6, 5, 9, 7] },
            { id: 'walk-1b', kind: 'walkway', when: 'low', rect: [7, 4, 9, 5] },
            { id: 'raft-2', kind: 'raft', when: 'high', rect: [8, -5, 10, -2] },
            // 迷惑项：低水位露出、通向死路的短栈道
            { id: 'walk-dead', kind: 'walkway', when: 'low', rect: [-12, -1, -10, 3] },
            { id: 'isle-dead', kind: 'island', when: 'always', rect: [-13, -4, -9, -1] },
          ],
          valves: [
            { id: 'valve-a', position: [-11, 4] },
            { id: 'valve-b', position: [11, -1] },
          ],
        },
        furniture: [
          // 大厅：地毯、服务台、向导旁的雕像与盆栽
          { type: 'rug', position: [0, 16.5], size: [3, 0.02, 6], color: '#2f7fa8', accent: '#e4f4f7' },
          { type: 'plant', position: [-13.6, 18.6] },
          { type: 'plant', position: [13.6, 18.6] },
          { type: 'plant', position: [-13.6, 14.2] },
          { type: 'lamp', position: [-2.4, 18.8], color: '#bfe8f5' },
          { type: 'lamp', position: [2.4, 18.8], color: '#bfe8f5' },
          { type: 'aquarium', position: [-8, 19.4], size: [4, 1.3, 0.8], color: '#2f7fa8', accent: '#6ad0f0' },
          { type: 'aquarium', position: [8, 19.4], size: [4, 1.3, 0.8], color: '#2f7fa8', accent: '#6ad0f0' },
          { type: 'poster', position: [-14.96, 13.4], yaw: PI / 2, size: [3, 1.6, 0.02], color: '#2f7fa8', accent: '#ffffff', interact: 'gym-rules' },
          { type: 'barrel', position: [-13.4, 12.2], color: '#6ab7d6' },
          { type: 'barrel', position: [13.4, 12.2], color: '#6ab7d6' },
          // 第二轮：大厅接待台（左侧，面向地毯）与奖杯柜（右墙，原盆栽位置）
          { type: 'reception', position: [-10, 16], yaw: PI / 2, color: '#2f7fa8', accent: '#e4f4f7' },
          { type: 'trophy', position: [14.45, 15.1], yaw: -PI / 2, color: '#7a5a3c', accent: '#2f7fa8' },
          // 第二轮：馆主台两侧水幕喷泉（对战时升起；顶端 3.6 m，低于挂旗下沿 3.4 m 以上的墙面区）
          { type: 'fountain', position: [-4.7, -18.9], size: [1.6, 3, 1.0], color: '#e4f4f7', accent: '#2f7fa8' },
          { type: 'fountain', position: [4.7, -18.9], size: [1.6, 3, 1.0], color: '#e4f4f7', accent: '#2f7fa8' },
          // 第二轮：天窗光柱（避开 z -12 / 0 / 10 的顶梁）：战斗场上方一扇、水池上方一扇
          { type: 'skylight', position: [0, -8], size: [4, 0.3, 3], y: 7, color: '#2f7fa8' },
          { type: 'skylight', position: [0, 5], size: [5, 0.3, 3.5], y: 7, color: '#2f7fa8' },
          // 第二轮：池壁水下灯（夜间点亮，池底泛光）：近池壁 z -5 三盏、远池壁 z 13 三盏（避开石岛 / 木筏 / 石台）
          { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [-6, -4.9], y: -0.75, color: '#8ff0ff' },
          { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [0, -4.9], y: -0.75, color: '#8ff0ff' },
          { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [6, -4.9], y: -0.75, color: '#8ff0ff' },
          { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [-5, 12.9], yaw: PI, y: -0.75, color: '#8ff0ff' },
          { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [5, 12.9], yaw: PI, y: -0.75, color: '#8ff0ff' },
          { type: 'poolLight', size: [0.8, 0.6, 0.2], position: [12, 12.9], yaw: PI, y: -0.75, color: '#8ff0ff' },
          // 馆主台：台座、背景壁画、两侧水缸与灯
          // 馆主台（两级台阶 + 金边 + 水纹镶嵌），身后墙面水系徽纹浮雕与两面挂旗
          { type: 'dais', position: [0, -18.4], size: [7, 0.36, 2.4], color: '#2f7fa8', accent: '#9fd0dd' },
          { type: 'emblem', position: [0, -19.96], size: [2.6, 2.6, 0.02], y: 4.9, color: '#2f7fa8', accent: '#e4f4f7' },
          { type: 'banner', position: [-5.2, -19.96], size: [1.3, 3.2, 0.02], y: 6.6, color: '#2f7fa8', accent: '#e4f4f7' },
          { type: 'banner', position: [5.2, -19.96], size: [1.3, 3.2, 0.02], y: 6.6, color: '#2f7fa8', accent: '#e4f4f7' },
          // 馆主区两侧：观众看台（面向战斗场）与立柱（避开窗户 z -12）
          { type: 'bleacher', position: [-10.9, -12], yaw: PI / 2, size: [6, 1.4, 2.7], color: '#9fd0dd', accent: '#2f7fa8' },
          { type: 'bleacher', position: [10.9, -12], yaw: -PI / 2, size: [6, 1.4, 2.7], color: '#9fd0dd', accent: '#2f7fa8' },
          { type: 'column', position: [-14.2, -8.6], color: '#e4f4f7', accent: '#2f7fa8' },
          { type: 'column', position: [14.2, -8.6], color: '#e4f4f7', accent: '#2f7fa8' },
          { type: 'column', position: [-14.2, -15.6], color: '#e4f4f7', accent: '#2f7fa8' },
          { type: 'column', position: [14.2, -15.6], color: '#e4f4f7', accent: '#2f7fa8' },
          // 水池两侧墙面挂旗 + 三道顶梁（带吊灯）
          { type: 'banner', position: [-14.96, 1], yaw: PI / 2, y: 6.4, color: '#2f7fa8', accent: '#e4f4f7' },
          { type: 'banner', position: [-14.96, 8], yaw: PI / 2, y: 6.4, color: '#6ab7d6', accent: '#ffffff' },
          { type: 'banner', position: [14.96, 1], yaw: -PI / 2, y: 6.4, color: '#2f7fa8', accent: '#e4f4f7' },
          { type: 'banner', position: [14.96, 8], yaw: -PI / 2, y: 6.4, color: '#6ab7d6', accent: '#ffffff' },
          { type: 'beam', position: [0, -12], size: [30, 0.4, 0.5], y: 6.75, color: '#2f7fa8' },
          { type: 'beam', position: [0, 0], size: [30, 0.4, 0.5], y: 6.75, color: '#2f7fa8' },
          { type: 'beam', position: [0, 10], size: [30, 0.4, 0.5], y: 6.75, color: '#2f7fa8' },
          { type: 'poster', position: [0, -19.96], size: [6, 3, 0.02], color: '#2f7fa8', accent: '#ffffff' },
          { type: 'aquarium', position: [-12, -18.8], size: [3.6, 1.6, 1.2], color: '#2f7fa8', accent: '#6ad0f0' },
          { type: 'aquarium', position: [12, -18.8], size: [3.6, 1.6, 1.2], color: '#2f7fa8', accent: '#6ad0f0' },
          { type: 'lamp', position: [-8.5, -6.2], color: '#bfe8f5' },
          { type: 'lamp', position: [8.5, -6.2], color: '#bfe8f5' },
          { type: 'lamp', position: [-8.5, -17.5], color: '#bfe8f5' },
          { type: 'lamp', position: [8.5, -17.5], color: '#bfe8f5' },
          { type: 'plant', position: [-13.6, -13] },
          { type: 'plant', position: [13.6, -13] },
          { type: 'crystal', position: [-13.4, -7], color: '#6ad0f0' },
          { type: 'crystal', position: [13.4, -7], color: '#6ad0f0' },
          { type: 'window', position: [-14.96, -12], yaw: PI / 2 },
          { type: 'window', position: [14.96, -12], yaw: -PI / 2 },
          { type: 'window', position: [-14.96, 17], yaw: PI / 2 },
          { type: 'window', position: [14.96, 17], yaw: -PI / 2 },
        ],
        exits: [frontDoor(40)],
        npcs: [
          { id: 'gym-guide', position: [3.2, 16.4], yaw: -PI / 2 },
          { id: 'canglan', position: [0, -16.6], yaw: 0 },
          { id: 'gym-trainer-1', position: [-7.2, 4.4], yaw: -0.35 },
          { id: 'gym-trainer-2', position: [10.6, 2.8], yaw: -1.0 },
        ],
      },
    ],
  },

  // ————————————————————————— 海崖下的洞穴（碎岩后开放；M2 的秘密基地 / 隐藏道具位） —————————————————————————
  {
    id: 'sprout-hidden-cave',
    name: '海崖下的洞穴',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'cave',
    rooms: [
      {
        id: 'main',
        name: '海崖下的洞穴',
        size: [14, 12, 5],
        floor: { color: '#4a4750', pattern: 'rock', accent: '#5c5963' },
        wall: { color: '#3d3a42', trim: '#2c2a30' },
        lighting: 'cave',
        furniture: [
          { type: 'boulder', position: [-4.8, -3.6], size: [2.2, 1.8, 2.0] },
          { type: 'boulder', position: [4.6, -4.2], size: [1.8, 1.4, 1.6], color: '#5d5a63' },
          { type: 'boulder', position: [-5.6, 2.6], size: [1.4, 1.0, 1.3] },
          { type: 'boulder', position: [5.4, 2.0], size: [1.6, 1.3, 1.4], color: '#605c66' },
          { type: 'boulder', position: [1.8, -1.4], size: [1.0, 0.7, 0.9] },
          { type: 'crystal', position: [-2.6, -4.9], color: '#7fe0ff', interact: 'cave-crystal' },
          { type: 'crystal', position: [6.2, -1.2], size: [0.5, 0.9, 0.5], color: '#b48cff' },
          { type: 'crystal', position: [-6.3, -0.4], size: [0.5, 1.0, 0.5], color: '#7fe0ff' },
          { type: 'pool', position: [2.6, -4.2], size: [3.0, 0.3, 2.0], color: '#1f5d7a' },
          { type: 'crate', position: [-1.2, -4.9], size: [0.7, 0.5, 0.6], color: '#7a5a38', interact: 'cave-hidden-item' },
        ],
        exits: [frontDoor(12)],
      },
    ],
  },

  // ————————————————————————— 港湾大市场 —————————————————————————
  {
    id: 'harbor-market',
    name: '港湾大市场',
    entryRoom: 'main',
    entryExit: 'front',
    bgm: 'market',
    rooms: [
      {
        id: 'main',
        name: '港湾大市场',
        size: [20, 13, 5],
        floor: { color: '#b9a48a', pattern: 'plank', accent: '#a8927a' },
        wall: { color: '#e9dcc6', trim: '#5a6f86', wainscot: '#c9b597' },
        lighting: 'market',
        cameraDistance: 13,
        furniture: [
          { type: 'stall', position: [-6.5, -3.6], size: [3.4, 2.4, 1.6], color: '#9a6a3c', accent: '#e05a4a', interact: 'stall-fish' },
          { type: 'stall', position: [-1.5, -3.6], size: [3.4, 2.4, 1.6], color: '#9a6a3c', accent: '#f2c14e', interact: 'stall-fruit' },
          { type: 'stall', position: [3.5, -3.6], size: [3.4, 2.4, 1.6], color: '#9a6a3c', accent: '#4aa3e0', interact: 'stall-tools' },
          { type: 'stall', position: [-4.0, 1.6], yaw: PI, size: [3.4, 2.4, 1.6], color: '#9a6a3c', accent: '#8fbf5a', interact: 'stall-berries' },
          { type: 'stall', position: [2.0, 1.6], yaw: PI, size: [3.4, 2.4, 1.6], color: '#9a6a3c', accent: '#c36fd6', interact: 'stall-souvenir' },
          { type: 'aquarium', position: [8.4, -4.8], size: [2.4, 1.4, 1.0], interact: 'market-tank' },
          { type: 'crate', position: [8.6, 1.0], size: [1.0, 1.0, 1.0], color: '#b88a55' },
          { type: 'crate', position: [8.6, 2.1], size: [1.0, 0.8, 1.0], color: '#a57a48' },
          { type: 'crate', position: [7.5, 1.2], size: [0.9, 0.7, 0.9], color: '#b88a55' },
          { type: 'barrel', position: [-9.0, 4.9] },
          { type: 'barrel', position: [-8.2, 5.1], size: [0.6, 0.8, 0.6] },
          { type: 'barrel', position: [-9.0, -5.6] },
          { type: 'lamp', position: [-9.2, 0], color: '#f6d88a' },
          { type: 'window', position: [-5, -6.5], size: [2.4, 1.4, 0.1] },
          { type: 'window', position: [5, -6.5], size: [2.4, 1.4, 0.1] },
        ],
        exits: [frontDoor(13)],
        npcs: [
          { id: 'vendor-fish', position: [-6.5, -4.7], yaw: 0 },
          { id: 'vendor-fruit', position: [-1.5, -4.7], yaw: 0 },
          { id: 'vendor-tools', position: [3.5, -4.7], yaw: 0 },
          { id: 'lost-item-sailor', position: [6.8, 4.2], yaw: PI },
          { id: 'vendor-tms', position: [2.0, 2.7], yaw: PI },
          { id: 'move-reminder-harbor', position: [-7.6, 2.6], yaw: PI / 2 },
        ],
      },
    ],
  },
];

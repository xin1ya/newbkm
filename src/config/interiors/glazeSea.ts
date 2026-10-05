/**
 * M3-18 · 琉璃海底（潜水骑乘场景）与海底神殿。
 *
 * 大地图潜水点（config/islands/glaze.ts diveSpots）：
 * - 珊瑚花园 coral-garden (752, 330) → 房间 reef
 * - 神殿海沟 temple-abyss (800, 200) → 房间 trench
 * 房间之间：reef ⇄ trench（礁石拱门），trench → 海底神殿前殿 temple-hall → 圣殿 temple-sanctum。
 * 每个海底房间都有上浮光柱（exits[0]，surfaceAt = 潜水点 id），走进去回到海面继续冲浪。
 *
 * 前殿机关「潮汐三螺」（gymMechanism kind 'tide'，tests/unit/sea-temple.test.ts BFS 验证可解、无死局、最少 3 次）：
 * - 西翼 / 东翼各一只潮汐螺（tide-w / tide-e），中殿一只（tide-c）；
 * - 西翼入口水幕：东螺吹响（tide-e = 1）才退去；东翼入口水幕：西螺、中螺都沉默（tide-w = 0 且 tide-c = 0）才退去；
 * - 西翼中段的回流暗流（tide-c = 0 时生效）把人冲回南边，必须先吹响中螺才过得去；
 * - 圣殿水幕：西螺、东螺都吹响才退去。顺序：东螺 → 中螺 → 西螺。先吹中螺会把东翼关上（要再吹一次撤回）。
 * - 东翼的横向漩流（tide-e = 0 时生效）只是把人推到东墙边，中殿的上升泉一直把人往北送。
 * 第一次走进圣殿后置位 sea-temple-hall-open，之后再来前殿机关保持解开状态（solvedFlag）。
 */
import type { InteriorConfig } from './types';

const PI = Math.PI;

const SAND = { color: '#cdbb8e', pattern: 'wave' as const, accent: '#b8a676', deep: '#a8966a' };
const REEF_WALL = { color: '#3e5a5e', trim: '#2e4448' };
const TRENCH_FLOOR = { color: '#33424e', pattern: 'rock' as const, accent: '#2a3640', deep: '#222c34' };
const TEMPLE_FLOOR = { color: '#7f9fa8', pattern: 'tile' as const, accent: '#5f7f8a', deep: '#4a6a74' };
const TEMPLE_WALL = { color: '#4a6f7a', trim: '#2f8aa8', wainscot: '#3a5a64', relief: 'wave' as const, reliefColor: '#5fb8d0' };

export const GLAZE_SEA_INTERIORS: InteriorConfig[] = [
  {
    id: 'glaze-sea',
    name: '琉璃海底',
    entryRoom: 'trench',
    entryExit: 'surface',
    bgm: 'undersea',
    rooms: [
      // ———————————————————— 珊瑚花园 ————————————————————
      {
        id: 'reef',
        name: '珊瑚花园',
        size: [28, 24, 7],
        floor: SAND,
        wall: REEF_WALL,
        lighting: 'undersea',
        underwater: { rocks: 0.9 },
        encounters: { table: 'glaze-reef', ratePerMeter: 0.035 },
        exits: [
          { id: 'surface', position: [-6, 4], radius: 1.1, spawnOffset: [0, 1.8], spawnYaw: 0, to: { overworld: true }, surfaceAt: 'coral-garden', label: '上浮' },
          { id: 'to-trench', position: [13.3, -3], radius: 1.1, spawnOffset: [-1.6, 0], spawnYaw: -PI / 2, to: { room: 'trench', exit: 'to-reef' }, label: '前往神殿海沟' },
        ],
        furniture: [
          // 珊瑚丛：粉 / 橙 / 紫 / 黄，围出几条「花径」
          { type: 'coral', position: [-10, -8], size: [1.6, 1.4, 1.4], color: '#f27a8a', accent: '#ffd0d8' },
          { type: 'coral', position: [-8.2, -9.4], size: [1.2, 1.0, 1.2], color: '#f2a04a', accent: '#ffe0a8' },
          { type: 'coral', position: [-11.5, -5.6], size: [1.3, 1.2, 1.2], color: '#a86ad8', accent: '#e8c8ff' },
          { type: 'coral', position: [-3, -9], size: [1.5, 1.5, 1.4], color: '#f2d04a', accent: '#fff4c0' },
          { type: 'coral', position: [-1.2, -7.6], size: [1.1, 0.9, 1.0], color: '#f27a8a', accent: '#ffd0d8' },
          { type: 'coral', position: [4, -8.6], size: [1.6, 1.6, 1.5], color: '#e86a5a', accent: '#ffc8b8' },
          { type: 'coral', position: [6, -7], size: [1.2, 1.1, 1.1], color: '#a86ad8', accent: '#e8c8ff' },
          { type: 'coral', position: [9.5, -9], size: [1.4, 1.2, 1.3], color: '#f2a04a', accent: '#ffe0a8' },
          { type: 'coral', position: [10.5, 6], size: [1.5, 1.4, 1.4], color: '#f27a8a', accent: '#ffd0d8' },
          { type: 'coral', position: [8.2, 8.6], size: [1.2, 1.0, 1.1], color: '#f2d04a', accent: '#fff4c0' },
          { type: 'coral', position: [-11, 8.5], size: [1.4, 1.3, 1.3], color: '#e86a5a', accent: '#ffc8b8' },
          { type: 'coral', position: [1.5, 1.5], size: [1.8, 1.7, 1.6], color: '#a86ad8', accent: '#e8c8ff' },
          { type: 'coral', position: [3.2, 3.4], size: [1.1, 1.0, 1.0], color: '#f2a04a', accent: '#ffe0a8' },
          // 海带林（西北、东南两片）
          { type: 'kelp', position: [-6.5, -6.5], size: [1.6, 4.2, 1.6] },
          { type: 'kelp', position: [-12, -1.5], size: [1.4, 4.6, 1.4] },
          { type: 'kelp', position: [-9.5, 2], size: [1.5, 3.8, 1.5] },
          { type: 'kelp', position: [11.6, -4.8], size: [1.4, 4.4, 1.4] },
          { type: 'kelp', position: [6.5, 4.2], size: [1.6, 4.0, 1.6] },
          { type: 'kelp', position: [-2.5, 8.5], size: [1.3, 3.6, 1.3] },
          // 海葵
          { type: 'anemone', position: [-4.6, -3.2], color: '#e86aa8', accent: '#ffd8ec' },
          { type: 'anemone', position: [0.6, -4.4], color: '#4ac8a8', accent: '#d8fff0' },
          { type: 'anemone', position: [7.8, 1.2], color: '#f2a04a', accent: '#fff0c8' },
          { type: 'anemone', position: [-7.4, 6.6], color: '#a86ad8', accent: '#f0e0ff' },
          // 巨蚌（两只有珍珠，可调查）
          { type: 'clam', position: [-9.2, -2.8], yaw: 0.4, interact: 'reef-clam-west' },
          { type: 'clam', position: [9.8, -1.4], yaw: -0.6, interact: 'reef-clam-east' },
          { type: 'clam', position: [4.6, 8.2], yaw: PI, size: [1.0, 0.6, 0.9] },
          // 沉船残骸：倾覆的货箱 + 木桶 + 断桅（可调查的那只箱子里有东西）
          { type: 'crate', position: [0.8, 8.6], yaw: 0.5, color: '#6a5a3a', interact: 'reef-wreck-crate' },
          { type: 'crate', position: [2.2, 9.4], yaw: -0.3, size: [0.7, 0.7, 0.7], color: '#5a4a32' },
          { type: 'barrel', position: [-0.8, 9.6], color: '#5a4a32' },
          { type: 'beam', position: [1.6, 7.2], yaw: 0.9, size: [4.2, 0.3, 0.3], y: 0.2, color: '#4a3a2a' },
          { type: 'boulder', position: [-4.2, 2.4], size: [1.6, 1.0, 1.4], color: '#5a6a6a' },
          { type: 'boulder', position: [6.2, -3.8], size: [1.3, 0.8, 1.2], color: '#5a6a6a' },
        ],
      },
      // ———————————————————— 神殿海沟 ————————————————————
      {
        id: 'trench',
        name: '神殿海沟',
        size: [30, 34, 9],
        floor: TRENCH_FLOOR,
        wall: { color: '#22303c', trim: '#1a2630' },
        lighting: 'abyss',
        underwater: { rocks: 1 },
        encounters: { table: 'glaze-trench', ratePerMeter: 0.04 },
        exits: [
          { id: 'surface', position: [0, 13], radius: 1.1, spawnOffset: [0, -1.8], spawnYaw: PI, to: { overworld: true }, surfaceAt: 'temple-abyss', label: '上浮' },
          { id: 'to-reef', position: [-14.3, 9], radius: 1.1, spawnOffset: [1.6, 0], spawnYaw: PI / 2, to: { room: 'reef', exit: 'to-trench' }, label: '前往珊瑚花园' },
          { id: 'temple-door', position: [0, -16.3], radius: 1.0, spawnOffset: [0, 1.6], spawnYaw: 0, to: { room: 'temple-hall', exit: 'entrance' }, label: '进入海底神殿' },
        ],
        furniture: [
          // 神殿大门：两根巨柱 + 横梁 + 门楣浪纹徽
          { type: 'column', position: [-2.6, -15.6], size: [1.1, 8.6, 1.1], color: '#9ab8c0', accent: '#2f8aa8' },
          { type: 'column', position: [2.6, -15.6], size: [1.1, 8.6, 1.1], color: '#9ab8c0', accent: '#2f8aa8' },
          { type: 'beam', position: [0, -15.6], size: [6.6, 0.7, 1.2], y: 6.0, noCollide: true, color: '#7f9fa8' },
          { type: 'emblem', position: [0, -16.9], size: [1.6, 1.6, 0.1], y: 4.8, color: '#5fd8ff', accent: '#2f8aa8' },
          // 沉没的神道：两排断柱
          { type: 'ruin', position: [-4.5, -10], color: '#8aa0a8' },
          { type: 'ruin', position: [4.5, -10], color: '#8aa0a8', size: [1.0, 2.2, 1.0] },
          { type: 'ruin', position: [-4.5, -4], color: '#8aa0a8', size: [1.0, 1.6, 1.0] },
          { type: 'ruin', position: [4.5, -4], color: '#8aa0a8' },
          { type: 'ruin', position: [-4.5, 2], color: '#8aa0a8', size: [1.0, 2.6, 1.0] },
          { type: 'ruin', position: [4.5, 2], color: '#8aa0a8', size: [1.0, 1.4, 1.0] },
          // 神道旁的石碑（可调查）
          { type: 'boulder', position: [-2.6, -12.2], size: [1.0, 1.8, 0.4], color: '#6a8088', interact: 'trench-stele' },
          // 发光水晶簇（海沟里唯一的光源）
          { type: 'crystal', position: [-11, -12], size: [0.9, 1.6, 0.9], color: '#5fd8ff' },
          { type: 'crystal', position: [11.5, -9], size: [0.8, 1.4, 0.8], color: '#7fe8ff' },
          { type: 'crystal', position: [-12, 2], size: [0.7, 1.2, 0.7], color: '#5fb8ff' },
          { type: 'crystal', position: [10.5, 6], size: [0.9, 1.5, 0.9], color: '#5fd8ff' },
          { type: 'crystal', position: [-6, 11], size: [0.6, 1.0, 0.6], color: '#7fe8ff' },
          // 海带与深海珊瑚
          { type: 'kelp', position: [-10, -5], size: [1.4, 6.0, 1.4] },
          { type: 'kelp', position: [11, -2], size: [1.4, 6.5, 1.4] },
          { type: 'kelp', position: [-8, 7], size: [1.2, 5.0, 1.2] },
          { type: 'kelp', position: [8, 11], size: [1.3, 5.5, 1.3] },
          { type: 'coral', position: [9, -13], size: [1.4, 1.3, 1.3], color: '#4a6ad8', accent: '#b8d0ff' },
          { type: 'coral', position: [-9, -9], size: [1.2, 1.1, 1.1], color: '#6a4ab8', accent: '#d8c8ff' },
          { type: 'anemone', position: [7.5, -6.5], color: '#4ac8e8', accent: '#d8f8ff' },
          { type: 'anemone', position: [-7, 4.5], color: '#e84a8a', accent: '#ffd0e8' },
          { type: 'boulder', position: [8, 3], size: [2.2, 1.4, 1.8], color: '#3a4a56' },
          { type: 'boulder', position: [-11.5, -9], size: [1.8, 1.2, 1.6], color: '#3a4a56' },
        ],
      },
      // ———————————————————— 海底神殿 · 前殿（潮汐三螺） ————————————————————
      {
        id: 'temple-hall',
        name: '海底神殿 · 前殿',
        size: [26, 30, 8],
        floor: TEMPLE_FLOOR,
        wall: TEMPLE_WALL,
        lighting: 'abyss',
        bgm: 'sea-temple',
        underwater: { rocks: 0.25 },
        triggers: [{ id: 'hall-first', position: [0, 12.6], radius: 2.2, script: 'sea-temple-hall-enter', doneFlag: 'sea-temple-entered' }],
        exits: [
          { id: 'entrance', position: [0, 14.6], radius: 0.9, spawnOffset: [0, -1.6], spawnYaw: PI, to: { room: 'trench', exit: 'temple-door' }, label: '返回海沟' },
          { id: 'to-sanctum', position: [0, -14.5], radius: 0.8, spawnOffset: [0, 1.0], spawnYaw: 0, to: { room: 'temple-sanctum', exit: 'entrance' }, label: '进入圣殿' },
        ],
        furniture: [
          // 门内两侧的浪纹柱（贴着隔墙尽头，不占通路）
          { type: 'column', position: [-4.5, 10.5], size: [0.9, 7.6, 0.9], color: '#a8c8d0', accent: '#2f8aa8', noCollide: true },
          { type: 'column', position: [4.5, 10.5], size: [0.9, 7.6, 0.9], color: '#a8c8d0', accent: '#2f8aa8', noCollide: true },
          // 圣殿门楣
          { type: 'emblem', position: [0, -14.95], size: [1.4, 1.4, 0.1], y: 3.6, color: '#5fd8ff', accent: '#2f8aa8' },
          { type: 'banner', position: [-6, -14.95], size: [1.0, 3.0, 0.05], y: 6.2, color: '#2f6a8a', accent: '#5fd8ff' },
          { type: 'banner', position: [6, -14.95], size: [1.0, 3.0, 0.05], y: 6.2, color: '#2f6a8a', accent: '#5fd8ff' },
          // 角落的水晶（照明）
          { type: 'crystal', position: [-12.3, -14.3], size: [0.7, 1.3, 0.7], color: '#5fd8ff', noCollide: true },
          { type: 'crystal', position: [12.3, -14.3], size: [0.7, 1.3, 0.7], color: '#5fd8ff', noCollide: true },
          { type: 'crystal', position: [-12.3, 14.3], size: [0.7, 1.3, 0.7], color: '#7fe8ff', noCollide: true },
          { type: 'crystal', position: [12.3, 14.3], size: [0.7, 1.3, 0.7], color: '#7fe8ff', noCollide: true },
          // 须知石板（入口旁，可调查）
          { type: 'boulder', position: [2.6, 13.2], size: [0.9, 1.4, 0.35], color: '#6a8a94', interact: 'temple-hall-tablet', noCollide: true },
        ],
        mechanism: {
          kind: 'tide',
          bounds: [-13, -15, 13, 15],
          start: [0, 13.5],
          goal: [0, -13.5],
          solvedFlag: 'sea-temple-hall-open',
          solvedState: { 'tide-w': 1, 'tide-e': 1, 'tide-c': 1 },
          switches: [
            { id: 'conch-w', position: [-9, -9], style: 'conch', variable: 'tide-w', stateNames: ['沉默', '吹响'] },
            { id: 'conch-e', position: [9, -9], style: 'conch', variable: 'tide-e', stateNames: ['沉默', '吹响'] },
            { id: 'conch-c', position: [0, -6.5], style: 'conch', variable: 'tide-c', stateNames: ['沉默', '吹响'] },
          ],
          gates: [
            { id: 'veil-w', rect: [-13, 8, -5, 9], style: 'tide', openWhen: { 'tide-e': 1 } },
            { id: 'veil-e', rect: [5, 8, 13, 9], style: 'tide', openWhen: { 'tide-w': 0, 'tide-c': 0 } },
            { id: 'veil-sanctum', rect: [-2, -13, 2, -12], style: 'tide', openWhen: { 'tide-w': 1, 'tide-e': 1 } },
          ],
          walls: [
            { rect: [-5, -12, -4, 9], style: 'coral' },
            { rect: [4, -12, 5, 9], style: 'coral' },
            { rect: [-13, -13, -2, -12], style: 'coral' },
            { rect: [2, -13, 13, -12], style: 'coral' },
          ],
          currents: [
            { id: 'west-undertow', rect: [-13, -4, -5, 3], dir: [0, 1], variable: 'tide-c', activeWhen: 0 },
            { id: 'east-eddy', rect: [5, -3, 13, -1], dir: [1, 0], variable: 'tide-e', activeWhen: 0 },
            { id: 'central-spring', rect: [-1, -4, 1, 5], dir: [0, -1] },
          ],
        },
      },
      // ———————————————————— 海底神殿 · 圣殿 ————————————————————
      {
        id: 'temple-sanctum',
        name: '海底神殿 · 圣殿',
        size: [16, 18, 9],
        floor: TEMPLE_FLOOR,
        wall: TEMPLE_WALL,
        lighting: 'undersea',
        bgm: 'sea-temple',
        underwater: { rocks: 0.15 },
        triggers: [{ id: 'sanctum-first', position: [0, 6.5], radius: 2.2, script: 'sea-temple-sanctum-enter', doneFlag: 'sea-temple-hall-open' }],
        exits: [{ id: 'entrance', position: [0, 8.6], radius: 0.8, spawnOffset: [0, -1.4], spawnYaw: PI, to: { room: 'temple-hall', exit: 'to-sanctum' }, label: '返回前殿' }],
        furniture: [
          // 祭坛：三级台阶 + 中央水晶 + 两侧浪纹柱
          { type: 'dais', position: [0, -4.5], size: [5.2, 0.5, 3.6], color: '#9ab8c0', accent: '#2f8aa8' },
          { type: 'crystal', position: [0, -5], size: [1.4, 2.6, 1.4], color: '#5fe8ff', interact: 'sea-temple-altar' },
          { type: 'column', position: [-3.6, -6.2], size: [1.0, 8.6, 1.0], color: '#a8c8d0', accent: '#2f8aa8' },
          { type: 'column', position: [3.6, -6.2], size: [1.0, 8.6, 1.0], color: '#a8c8d0', accent: '#2f8aa8' },
          { type: 'column', position: [-6.2, 2], size: [0.9, 8.6, 0.9], color: '#a8c8d0', accent: '#2f8aa8' },
          { type: 'column', position: [6.2, 2], size: [0.9, 8.6, 0.9], color: '#a8c8d0', accent: '#2f8aa8' },
          { type: 'emblem', position: [0, -8.95], size: [2.2, 2.2, 0.1], y: 5.4, color: '#5fd8ff', accent: '#2f8aa8' },
          { type: 'banner', position: [-5, -8.95], size: [1.1, 3.4, 0.05], y: 6.8, color: '#2f6a8a', accent: '#5fd8ff' },
          { type: 'banner', position: [5, -8.95], size: [1.1, 3.4, 0.05], y: 6.8, color: '#2f6a8a', accent: '#5fd8ff' },
          // 壁画石板（两侧，可调查）
          { type: 'poster', position: [-7.96, -2], yaw: PI / 2, size: [2.4, 1.6, 0.02], color: '#2a4a5a', accent: '#5fd8ff', interact: 'sanctum-mural-west' },
          { type: 'poster', position: [7.96, -2], yaw: -PI / 2, size: [2.4, 1.6, 0.02], color: '#2a4a5a', accent: '#5fd8ff', interact: 'sanctum-mural-east' },
          { type: 'skylight', position: [0, -4.5], size: [3.2, 9, 3.2], color: '#bff8ff' },
          { type: 'clam', position: [-5.6, 6.2], size: [1.0, 0.6, 0.9], yaw: 0.6 },
          { type: 'clam', position: [5.6, 6.2], size: [1.0, 0.6, 0.9], yaw: -0.6 },
          { type: 'kelp', position: [-6.6, -7.6], size: [0.8, 3.6, 0.8] },
          { type: 'kelp', position: [6.6, -7.6], size: [0.8, 3.6, 0.8] },
        ],
      },
    ],
  },
];

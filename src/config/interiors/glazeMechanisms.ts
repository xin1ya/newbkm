/**
 * M3-16 · 琉璃群岛道馆 9–10 的馆内机关（房间 30 × 40，门在 +z；与雷鸣四馆同一套坐标约定）。
 * 道馆 11（琉璃，水）沿用 M1-11 的水位机关（systems/puzzles/waterLevel），配置写在 glazeGyms.ts。
 * 可解性 / 非平凡 / 无死局由 tests/unit/glaze-gyms.test.ts 的 BFS 证明。
 */
import type { GymMechanismConfig, Rect, Vec2 } from '@/systems/puzzles/gymMechanism';
import { colWall, gate, rowWall } from './thunderMechanisms';

const BOUNDS: Rect = [-15, -20, 15, 20];
const START = [0, 18] as const;
const GOAL = [0, -11.5] as const;
const HALL: Vec2 = [0, 17];

// ———————————————————— 幻影道馆 · 传送镜 ————————————————————
// 机关区被水晶墙分成 6 间封闭镜厅（前排 F-W / F-C / F-E，后排 B-W / B-C / B-E），只能靠镜子来往。
// 前中厅的念力水晶球有 3 档，同时旋转两面镜子的去向：中厅镜（c1）与终点镜（f1）。
// 解法：西镜 → 前西厅 → 前中厅，把水晶球拨到第 3 档 → 回大厅 → 东镜 → 前东厅 → 后东厅 → 后中厅 → 终点镜。
const F_W: Vec2 = [-10, 10];
const F_C: Vec2 = [0, 11.5];
const F_E: Vec2 = [10, 10];
const B_W: Vec2 = [-10, 0];
const B_C: Vec2 = [0, 1.5];
const B_E: Vec2 = [10, 0];
const ARENA: Vec2 = [0, -5.5];
export const MIRAGE_GYM_MECH: GymMechanismConfig = {
  kind: 'mirror',
  bounds: BOUNDS,
  start: START,
  goal: GOAL,
  switches: [{ id: 'orb', position: [0, 8.5], style: 'orb', states: 3, stateNames: ['紫光', '蓝光', '金光'] }],
  walls: [...rowWall(13, [], 'crystal', 3), ...rowWall(5, [], 'crystal', 3), ...rowWall(-3, [], 'crystal', 3), ...colWall(-5, -2.5, 12.5, [], 'crystal', 3), ...colWall(5, -2.5, 12.5, [], 'crystal', 3)],
  gates: [],
  mirrors: [
    // 大厅
    { id: 'hall-west', at: [-6, 15.5], to: F_W, color: '#c86ad8' },
    { id: 'hall-east', at: [6, 15.5], to: F_E, color: '#6a9ad8' },
    // 前西厅
    { id: 'fw-back', at: [-12.5, 7], to: HALL, color: '#8a8a9a' },
    { id: 'fw-center', at: [-7.5, 7], to: F_C, color: '#c86ad8' },
    // 前中厅
    { id: 'fc-turn', at: [-2.5, 6.5], variable: 'orb', targets: [B_W, B_E, HALL], color: '#e8c870' },
    { id: 'fc-back', at: [3, 11.5], to: HALL, color: '#8a8a9a' },
    // 前东厅
    { id: 'fe-down', at: [12.5, 7], to: B_E, color: '#6a9ad8' },
    { id: 'fe-back', at: [7.5, 7], to: HALL, color: '#8a8a9a' },
    // 后西厅（死路：两面都回去）
    { id: 'bw-up', at: [-12.5, -1], to: F_W, color: '#c86ad8' },
    { id: 'bw-back', at: [-7.5, 2.5], to: HALL, color: '#8a8a9a' },
    // 后东厅
    { id: 'be-back', at: [12.5, -1], to: HALL, color: '#8a8a9a' },
    { id: 'be-center', at: [7.5, 2.5], to: B_C, color: '#6a9ad8' },
    // 后中厅：终点镜只在金光时通向战斗场
    { id: 'bc-final', at: [0, -1.2], variable: 'orb', targets: [HALL, HALL, ARENA], color: '#e8c870' },
    // 战斗场回程镜
    { id: 'arena-back', at: [9, -4.5], to: HALL, color: '#8a8a9a' },
  ],
};

// ———————————————————— 幽冥道馆 · 暗灯 ————————————————————
// 常暗墓厅。入口烛台（3 档）轮流点亮西翼 / 东翼 / 中廊，灵火墙只在对应的灯亮着时退散；
// 西翼、东翼各有一座长明灯，点亮后永远亮着（直到再拨）。
// 解法：烛台照西翼 → 点西灯 → 烛台照东翼 → 点东灯 → 烛台照中廊 → 中廊灵火（要中廊 + 西灯）→ 终点灵火（要东灯）。
export const GHOST_GYM_MECH: GymMechanismConfig = {
  kind: 'lamp',
  bounds: BOUNDS,
  start: START,
  goal: GOAL,
  dark: true,
  switches: [
    { id: 'candelabra', position: [0, 9.5], style: 'lamp', variable: 'C', states: 3, stateNames: ['照亮西翼', '照亮东翼', '照亮中廊'] },
    { id: 'lamp-west', position: [-12.5, 3], style: 'lamp', variable: 'W', stateNames: ['熄灭', '点亮'] },
    { id: 'lamp-east', position: [12.5, 3], style: 'lamp', variable: 'E', stateNames: ['熄灭', '点亮'] },
  ],
  walls: [
    ...rowWall(13, [[-1, 1]], 'grave'),
    ...colWall(-5, -1.5, 12.5, [[8, 10]], 'grave'),
    ...colWall(5, -1.5, 12.5, [[8, 10]], 'grave'),
    ...rowWall(4, [[-1, 1]], 'grave', undefined, -4.5, 4.5),
    ...rowWall(-2, [[-1, 1]], 'grave'),
    // 墓碑与石棺（装饰性的小障碍，形成翼厅里的迂回）
    { rect: [-12, 6, -8, 7], style: 'grave', height: 1.2 },
    { rect: [8, 6, 12, 7], style: 'grave', height: 1.2 },
    { rect: [-12, 0, -10, 1], style: 'grave', height: 1.2 },
    { rect: [10, 0, 12, 1], style: 'grave', height: 1.2 },
  ],
  gates: [
    gate('wing-west', [-5.5, 8, -4.5, 10], 'spirit', { C: 0 }),
    gate('wing-east', [4.5, 8, 5.5, 10], 'spirit', { C: 1 }),
    gate('nave', [-1, 3.5, 1, 4.5], 'spirit', { C: 2, W: 1 }),
    gate('final', [-1, -2.5, 1, -1.5], 'spirit', { E: 1 }),
  ],
};

/**
 * M3-15 · 雷鸣群岛四座道馆的馆内机关（房间 30 × 40：x −15…15、z −20…20，门在 +z）。
 * 入口大厅 z 13…20；机关区 z −3…13；战斗场 z −11…−3；馆主台 z −15.4。
 * 可解性 / 非平凡 / 无死局由 tests/unit/thunder-gyms.test.ts 的 BFS 证明。
 */
import type { GymMechanismConfig, MechGate, MechWall, Rect, WallStyle } from '@/systems/puzzles/gymMechanism';

const BOUNDS: Rect = [-15, -20, 15, 20];
const START = [0, 18] as const;
const GOAL = [0, -11.5] as const;

/** 横墙（z 方向 1 m 厚，中心 z），gaps = 留空的 x 区间 */
function rowWall(z: number, gaps: Array<[number, number]>, style: WallStyle, height?: number, x0 = -15, x1 = 15): MechWall[] {
  const out: MechWall[] = [];
  let x = x0;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > x) out.push({ rect: [x, z - 0.5, a, z + 0.5], style, ...(height ? { height } : {}) });
    x = b;
  }
  if (x < x1) out.push({ rect: [x, z - 0.5, x1, z + 0.5], style, ...(height ? { height } : {}) });
  return out;
}
/** 纵墙（x 方向 1 m 厚，中心 x），gaps = 留空的 z 区间 */
function colWall(x: number, z0: number, z1: number, gaps: Array<[number, number]>, style: WallStyle, height?: number): MechWall[] {
  const out: MechWall[] = [];
  let z = z0;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > z) out.push({ rect: [x - 0.5, z, x + 0.5, a], style, ...(height ? { height } : {}) });
    z = b;
  }
  if (z < z1) out.push({ rect: [x - 0.5, z, x + 0.5, z1], style, ...(height ? { height } : {}) });
  return out;
}
const gate = (id: string, rect: Rect, style: MechGate['style'], openWhen: Record<string, number>): MechGate => ({ id, rect, style, openWhen });

// ———————————————————— 雷霆道馆 · 导电开关 ————————————————————
// 三条通道：西道（拉杆 C）、东道（拉杆 B）、中道（通往战斗场）。入口拉杆 A 在西 / 东道入口之间二选一；
// 中道侧门要 B、C 都通电才开，最后的电栅要 C 通电。解法：东道拉 B → 回入口拉 A → 西道拉 C → 回入口拉 A → 东道 → 中道。
export const THUNDER_GYM_MECH: GymMechanismConfig = {
  kind: 'electric',
  bounds: BOUNDS,
  start: START,
  goal: GOAL,
  switches: [
    { id: 'A', position: [-5, 16], style: 'lever', stateNames: ['东道通电', '西道通电'] },
    { id: 'B', position: [12, -0.2], style: 'lever', stateNames: ['断开', '接通'] },
    { id: 'C', position: [-12, -0.2], style: 'lever', stateNames: ['断开', '接通'] },
  ],
  walls: [...rowWall(13, [[-11, -9], [9, 11]], 'metal'), ...colWall(-5, -1.5, 12.5, [], 'metal'), ...colWall(5, -1.5, 12.5, [[2, 4]], 'metal'), ...rowWall(-2, [[-1.5, 1.5]], 'metal')],
  gates: [
    gate('west', [-11, 12.5, -9, 13.5], 'electric', { A: 1 }),
    gate('east', [9, 12.5, 11, 13.5], 'electric', { A: 0 }),
    gate('mid', [4.5, 2, 5.5, 4], 'electric', { B: 1, C: 1 }),
    gate('final', [-1.5, -2.5, 1.5, -1.5], 'electric', { C: 1 }),
  ],
};

// ———————————————————— 晨辉道馆 · 昼夜机关 ————————————————————
// 日光墙白天是实体、夜里消散；影墙相反。四座日晷共用「昼夜」，进门时取真实时间。
export const DAWN_GYM_MECH: GymMechanismConfig = {
  kind: 'sundial',
  bounds: BOUNDS,
  start: START,
  goal: GOAL,
  fromClock: 'sun',
  switches: [
    { id: 'dial-hall', position: [6, 16], style: 'sundial', variable: 'sun', stateNames: ['白昼', '黑夜'] },
    { id: 'dial-west', position: [-12.5, 5.5], style: 'sundial', variable: 'sun', stateNames: ['白昼', '黑夜'] },
    { id: 'dial-east', position: [12.5, 5.5], style: 'sundial', variable: 'sun', stateNames: ['白昼', '黑夜'] },
    { id: 'dial-south', position: [12.5, 0.5], style: 'sundial', variable: 'sun', stateNames: ['白昼', '黑夜'] },
  ],
  walls: [...rowWall(13, [[-1.5, 1.5]], 'stone'), ...rowWall(8, [[-11, -9], [9, 11]], 'stone'), ...colWall(0, 3.5, 7.5, [], 'stone'), ...rowWall(3, [[-5, -3], [3, 5]], 'stone'), ...rowWall(-2, [[-1, 1]], 'stone')],
  gates: [
    gate('row8-west', [-11, 7.5, -9, 8.5], 'shadow', { sun: 0 }),
    gate('row8-east', [9, 7.5, 11, 8.5], 'sunlight', { sun: 1 }),
    gate('row3-west', [-5, 2.5, -3, 3.5], 'sunlight', { sun: 1 }),
    gate('row3-east', [3, 2.5, 5, 3.5], 'shadow', { sun: 0 }),
    gate('final', [-1, -2.5, 1, -1.5], 'shadow', { sun: 0 }),
  ],
};

// ———————————————————— 霜凝道馆 · 滑冰 ————————————————————
// 冰场 x −12…12、z −2…12；踏上冰面会一直滑到撞上冰块。冰块为 2 m 方块（块坐标 bx 0…11、bz 0…6）。
const ICE_BLOCKS: Array<[number, number]> = [[7, 3], [9, 5], [2, 6], [8, 6], [2, 4], [6, 1], [10, 4], [5, 4], [3, 0], [10, 3], [4, 4], [10, 1], [11, 3], [11, 6]];
export const ICE_RINK: Rect = [-12, -2, 12, 12];
export const SNOW_GYM_MECH: GymMechanismConfig = {
  kind: 'ice',
  bounds: BOUNDS,
  start: START,
  goal: GOAL,
  switches: [],
  gates: [],
  ice: [ICE_RINK],
  walls: [
    ...rowWall(13, [[-1, 1]], 'ice', 1.6).map((w): MechWall => ({ ...w, rect: [w.rect[0], 12, w.rect[2], 14] })),
    ...rowWall(-3, [[-1, 1]], 'ice', 1.6).map((w): MechWall => ({ ...w, rect: [w.rect[0], -4, w.rect[2], -2] })),
    { rect: [-15, -2, -12, 12], style: 'ice', height: 1.6 },
    { rect: [12, -2, 15, 12], style: 'ice', height: 1.6 },
    ...ICE_BLOCKS.map(([bx, bz]): MechWall => ({ rect: [-12 + 2 * bx, -2 + 2 * bz, -10 + 2 * bx, 2 * bz], style: 'ice', height: 1.4 })),
  ],
};

// ———————————————————— 云翎道馆 · 风力桥 ————————————————————
// 三座浮台（西 P1 / 中 P3 / 东 P2）悬在深谷上，风扇吹出的气流托起风桥。
// 入口风扇 F1 决定风桥吹向西台还是东台；中台风扇 F2 驱动西台 ↔ 中台的桥，东台风扇 F3 驱动东台 ↔ 中台的桥；
// 中台通往战斗场的长桥要 F2 停、F3 转（两股气流交汇）。解法：F1 吹向东台 → 东台开 F3 → 过桥到中台 → 长桥。
export const LARK_GYM_MECH: GymMechanismConfig = {
  kind: 'wind',
  bounds: BOUNDS,
  start: START,
  goal: GOAL,
  switches: [
    { id: 'F1', position: [0, 16], style: 'fan', stateNames: ['吹向西台', '吹向东台'] },
    { id: 'F2', position: [0, 7.5], style: 'fan', stateNames: ['停转', '运转'] },
    { id: 'F3', position: [13, 2.5], style: 'fan', stateNames: ['停转', '运转'] },
  ],
  walls: [],
  pits: [
    // 谷 A（入口大厅 ↔ 浮台）：留出 4 座桥位
    [-15, 9, -13, 13],
    [-11, 9, 11, 13],
    [13, 9, 15, 13],
    // 浮台之间
    [-6, 1, -4, 4],
    [-6, 6, -4, 9],
    [4, 1, 6, 4],
    [4, 6, 6, 9],
    // 谷 B（浮台 ↔ 战斗场）
    [-15, -3, -1, 1],
    [1, -3, 15, 1],
  ],
  gates: [
    gate('to-west', [-13, 9, -11, 13], 'wind', { F1: 0 }),
    gate('to-east', [11, 9, 13, 13], 'wind', { F1: 1 }),
    gate('west-mid', [-6, 4, -4, 6], 'wind', { F2: 1 }),
    gate('east-mid', [4, 4, 6, 6], 'wind', { F3: 1 }),
    gate('final', [-1, -3, 1, 1], 'wind', { F2: 0, F3: 1 }),
  ],
};

/**
 * M1-07 · 互动检测（纯函数，不依赖 three）。
 * 设计 3D §8.5：原「面朝相邻格检测」改为「玩家前方 2 m 扇形范围内最近的可交互物」。
 * 各场景把 NPC / 门 / 家具 / 地标 / 封锁点 / 水边 等整理成 InteractCandidate，统一由 pickInteraction 选出焦点。
 */

/** 互动类型（提示文字与按键沿用 07-22 §4.6 的表，按键按 3D 设计改为 E / F / 骑乘键） */
export type InteractKind =
  | 'talk' // NPC 对话
  | 'enter' // 门 / 洞口
  | 'examine' // 查看家具、告示牌、地标
  | 'use' // 使用（电脑、扫描仪等）
  | 'rest' // 床：休息并恢复队伍
  | 'ferry' // 渡船码头
  | 'fish' // 水边钓鱼（需要钓竿）
  | 'surf' // 水面骑乘（需要 hm03-surf）
  | 'blocked'; // 封锁点：只显示所需能力，不可按键

/** 触发按键对应的输入动作（null = 无按键，仅提示） */
export type InteractAction = 'interact' | 'sendOut' | 'ride' | null;

export interface InteractCandidate {
  id: string;
  kind: InteractKind;
  x: number;
  z: number;
  /** 提示气泡锚点高度（世界 y） */
  y: number;
  /** 提示文字，如「对话」「进入 木兰博士研究所」 */
  label: string;
  action: InteractAction;
  /** 检测半径（缺省 2 m；门、水面等可放宽） */
  range?: number;
  /** 同距离下的优先级（越大越优先，NPC > 门 > 家具） */
  priority?: number;
  /** 封锁点等附加说明 */
  hint?: string | undefined;
  /** 封锁点需要的能力（显示图标） */
  ability?: string | undefined;
  /** 气泡锚点（缺省为 x / y / z；家具等按边缘点检测、气泡放在中心上方） */
  anchor?: { x: number; y: number; z: number };
}

export const DEFAULT_RANGE = 2;
/** 扇形半角 60° */
export const HALF_ANGLE = Math.PI / 3;
/** 贴身距离内忽略朝向 */
export const CLOSE_RANGE = 0.9;

export const INTERACT_ACTION: Record<InteractKind, InteractAction> = {
  talk: 'interact',
  enter: 'interact',
  examine: 'interact',
  use: 'interact',
  rest: 'interact',
  ferry: 'interact',
  fish: 'sendOut',
  surf: 'ride',
  blocked: null,
};

export const KIND_PRIORITY: Record<InteractKind, number> = {
  talk: 5,
  ferry: 4,
  enter: 3,
  rest: 2,
  use: 2,
  examine: 1,
  fish: 0,
  surf: 0,
  blocked: -1,
};

/**
 * 从候选中选出焦点：在各自检测半径内、位于前方扇形（贴身时不限朝向），
 * 评分 = 距离 + 偏角惩罚 − 优先级加成；最小者胜。
 */
export function pickInteraction<T extends InteractCandidate>(px: number, pz: number, facing: number, cands: readonly T[]): T | null {
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  const cosLimit = Math.cos(HALF_ANGLE);
  let best: T | null = null;
  let bestScore = Infinity;
  for (const c of cands) {
    const dx = c.x - px;
    const dz = c.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > (c.range ?? DEFAULT_RANGE)) continue;
    const cos = d < 1e-6 ? 1 : (dx * fx + dz * fz) / d;
    if (d > CLOSE_RANGE && cos < cosLimit) continue;
    const score = d + (1 - cos) * 0.6 - (c.priority ?? KIND_PRIORITY[c.kind]) * 0.15;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best ? acrossCounter(px, pz, facing, best, cands) : null;
}

/**
 * 隔柜台对话：焦点是家具、而 NPC 就在家具后方（同一方向、更远、在其对话半径内）时，改为与 NPC 对话。
 * 这样柜台 / 讲桌后的店员、博士可以直接搭话；家具仍可从其他方向查看。
 */
function acrossCounter<T extends InteractCandidate>(px: number, pz: number, facing: number, best: T, cands: readonly T[]): T {
  if (best.kind !== 'examine' && best.kind !== 'use') return best;
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  const bd = Math.hypot(best.x - px, best.z - pz);
  const bdir = bd < 1e-6 ? { x: fx, z: fz } : { x: (best.x - px) / bd, z: (best.z - pz) / bd };
  let npc: T | null = null;
  let nd = Infinity;
  for (const c of cands) {
    if (c.kind !== 'talk') continue;
    const dx = c.x - px;
    const dz = c.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > (c.range ?? DEFAULT_RANGE) || d <= bd) continue;
    // NPC 在玩家前方，且与家具大致同一方向（约 35° 内）
    if ((dx * fx + dz * fz) / d < Math.cos(HALF_ANGLE)) continue;
    if ((dx * bdir.x + dz * bdir.z) / d < Math.cos((35 * Math.PI) / 180)) continue;
    if (d < nd) {
      nd = d;
      npc = c;
    }
  }
  return npc ?? best;
}

/**
 * 前方水面探测（钓鱼 / 冲浪）：沿朝向每 0.25 m 采样到 maxDist，返回第一处水面点。
 * 玩家自己站在深水里时返回 null（已经在水上）。
 */
export function probeWaterAhead(
  px: number,
  pz: number,
  facing: number,
  waterDepthAt: (x: number, z: number) => number,
  maxDist = 2.5,
  minDepth = 0.6,
): { x: number; z: number; dist: number } | null {
  if (waterDepthAt(px, pz) >= minDepth) return null;
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  for (let d = 0.5; d <= maxDist + 1e-6; d += 0.25) {
    const x = px + fx * d;
    const z = pz + fz * d;
    if (waterDepthAt(x, z) >= minDepth) return { x, z, dist: d };
  }
  return null;
}

/** 按键显示名：KeyboardEvent.code → 键帽文字 */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = { Space: '空格', Enter: 'Enter', Escape: 'Esc', ShiftLeft: 'Shift', ShiftRight: 'Shift', Tab: 'Tab', Backspace: '退格', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return map[code] ?? code;
}

/** 手柄按钮显示名（Standard Gamepad，Xbox 命名） */
export const PAD_LABEL: Record<number, string> = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Menu', 10: 'LS', 11: 'RS' };

/** 封锁点类型 → 需要的能力（中文名，HM 改为骑乘能力，flag 名不变：决策 0008） */
export const BLOCKER_ABILITY: Record<string, string> = {
  surf: '水上骑乘',
  'rock-smash': '碎岩',
  strength: '怪力',
  vines: '居合劈',
  climb: '攀岩',
  waterfall: '攀瀑',
  dive: '潜水',
  dark: '照明',
  story: '剧情',
};

/** 旋转矩形上离 (px,pz) 最近的点（家具占地；点在内部时返回自身） */
export function closestOnRect(px: number, pz: number, r: { x: number; z: number; hx: number; hz: number; yaw: number }): { x: number; z: number } {
  const c = Math.cos(r.yaw);
  const s = Math.sin(r.yaw);
  const dx = px - r.x;
  const dz = pz - r.z;
  // 世界 → 局部（three 的 rotation.y：局部 x 轴 = (cos, -sin)）
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const cx = Math.max(-r.hx, Math.min(r.hx, lx));
  const cz = Math.max(-r.hz, Math.min(r.hz, lz));
  return { x: r.x + cx * c + cz * s, z: r.z - cx * s + cz * c };
}
export * from './types';

import type { InteractionDef } from './types';

/** flag 条件：'x' 需要置位，'!x' 需要未置位 */
export function flagCond(cond: string, flags: Readonly<Record<string, boolean>>): boolean {
  return cond.startsWith('!') ? !flags[cond.slice(1)] : flags[cond] === true;
}

/** 选出这次要显示的文字：byFlag（首个满足）→ 夜间 → 默认 */
export function resolvePages(def: InteractionDef, flags: Readonly<Record<string, boolean>>, isNight: boolean): { pages: string[]; conditional: boolean } {
  const hit = def.byFlag?.find((b) => flagCond(b.when, flags));
  if (hit) return { pages: hit.pages, conditional: true };
  if (isNight && def.night) return { pages: def.night, conditional: false };
  return { pages: def.pages, conditional: false };
}

export const KIND_LABEL: Record<InteractKind, string> = {
  talk: '对话',
  enter: '进入',
  examine: '查看',
  use: '使用',
  rest: '休息',
  ferry: '渡船',
  fish: '钓鱼',
  surf: '水上骑乘',
  blocked: '',
};

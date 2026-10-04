/**
 * M2-01 多岛旅行：岛与岛之间的连接（海域走廊边缘）、到访记录、飞行限岛规则。
 *
 * 规则（2026-10-04 决议）：
 * - 冲浪 / 渡船可以前往下一座岛（第一次跨海由主线剧情放行）；
 * - 飞行只能在「已到访的岛屿 + 海域走廊」内：飞到走廊尽头时，对面的岛屿已到访才放行，否则挡回并提示；
 * - 步行 / 自行车到不了地图边缘（海上），不会触发。
 *
 * 实现：切换岛屿 = 写入目的地位置 → 存档 → 重新加载页面（OverworldScene 按 state.position.island 重建）。
 */
import type { GameState, IslandId } from '../state/GameState';

export interface IslandLink {
  id: string;
  from: IslandId;
  /** 触发矩形 [x0, z0, x1, z1]（来源岛坐标） */
  rect: [number, number, number, number];
  to: IslandId;
  /** 到达点：根据离开时的位置换算（保持航线内的横向偏移） */
  arrive: (x: number, z: number) => { x: number; z: number; yaw: number };
  /** 首次通过前必须为真的 flag（第一次跨海由剧情放行） */
  requiresFlag?: string;
  /** 被挡回时推回的方向（单位向量，来源岛坐标） */
  pushBack: [number, number];
}

const clampZ = (z: number) => Math.max(-200, Math.min(200, z));

/** 萌芽东海岸（水路 1 东端）↔ 碧潮地图西端的萌芽—碧潮海域 */
export const ISLAND_LINKS: readonly IslandLink[] = [
  {
    id: 'sprout-to-tide',
    from: 'sprout',
    rect: [498, -230, 512, 230],
    to: 'tide',
    arrive: (_x, z) => ({ x: -990, z: clampZ(z), yaw: Math.PI / 2 }),
    requiresFlag: 'cross-sea-1-done',
    pushBack: [-1, 0],
  },
  {
    id: 'tide-to-sprout',
    from: 'tide',
    rect: [-1024, -260, -1006, 260],
    to: 'sprout',
    arrive: (_x, z) => ({ x: 488, z: clampZ(z), yaw: -Math.PI / 2 }),
    pushBack: [1, 0],
  },
];

export const visitedFlag = (island: IslandId): string => `visited-${island}`;

export function hasVisited(state: GameState, island: IslandId): boolean {
  return island === 'sprout' || !!state.flags[visitedFlag(island)];
}

export function linkAt(island: IslandId, x: number, z: number): IslandLink | null {
  for (const l of ISLAND_LINKS) {
    if (l.from !== island) continue;
    const [x0, z0, x1, z1] = l.rect;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return l;
  }
  return null;
}

export type TravelVerdict = { ok: true } | { ok: false; reason: 'fly-unvisited' | 'locked' | 'on-foot'; hint: string };

/** 当前移动方式能否经过该连接 */
export function canUseLink(state: GameState, link: IslandLink, mode: 'walk' | 'surf' | 'bike' | 'fly'): TravelVerdict {
  if (link.requiresFlag && !state.flags[link.requiresFlag]) return { ok: false, reason: 'locked', hint: '前方的航线还没有开通……' };
  if (mode === 'fly' && !hasVisited(state, link.to)) return { ok: false, reason: 'fly-unvisited', hint: '飞行只能前往已经到访过的岛屿。先冲浪渡海过去吧！' };
  if (mode === 'walk' || mode === 'bike') return { ok: false, reason: 'on-foot', hint: '' };
  return { ok: true };
}

/** 写入目的地（不存档、不重载；由场景层负责） */
export function applyTravel(state: GameState, to: IslandId, x: number, z: number, yaw: number): void {
  state.position = { island: to, xyz: [x, 0, z], yaw, interior: null };
  state.flags[visitedFlag(to)] = true;
}

/** 重新加载后自动进入同一存档位（跳过标题画面） */
export const TRAVEL_SLOT_KEY = 'cuilan-travel-slot';

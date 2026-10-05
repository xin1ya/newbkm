/**
 * M3-22 城镇快速旅行（飞行传送）：在已到访城镇的宝可梦中心之间飞行，跨岛也可以。
 *
 * 规则：
 * - 飞行点 = 各岛 kind === 'pokecenter' 的 POI（数据驱动，新增宝可梦中心自动成为飞行点），外加萌芽镇「自己家」；
 * - 登记：走到宝可梦中心附近（FLY_REVEAL_RADIUS 米内）自动登记 flag `fly-point:<poiId>`；
 *   旧存档按「到访过的区域」（zone-visited.<zoneId>）补登记——飞行点所在区域到访过就算；
 * - 可用：已登记，且所在岛屿已到访（hasVisited）；
 * - 前提：拥有飞行骑乘（第一枚徽章），且不在室内 / 联盟挑战中 / 冲浪、攀爬、潜水中。
 */
import type { GameState, IslandId } from '../state/GameState';
import { ZONE_VISITED_PREFIX } from '../state/GameState';
import { hasVisited } from './index';

/** 登记半径（米，水平距离） */
export const FLY_REVEAL_RADIUS = 45;
export const FLY_POINT_PREFIX = 'fly-point:';
/** 萌芽镇「自己家」也是飞行点（新游戏起即登记） */
export const HOME_FLY_POINT = 'player-house';

export interface FlyPoint {
  id: string;
  island: IslandId;
  islandName: string;
  /** 城镇名（「宝可梦中心（翠澜镇）」→「翠澜镇」） */
  name: string;
  x: number;
  z: number;
}

/** 岛屿配置里快速旅行需要的最小子集（systems 层不依赖 config 实现） */
export interface FlyIslandSource {
  id: IslandId;
  name: string;
  pois: readonly { id: string; kind: string; name: string; position: readonly [number, number, number] }[];
  zones: readonly { id: string; polygon: readonly (readonly [number, number])[] }[];
}

export const flyPointFlag = (id: string): string => `${FLY_POINT_PREFIX}${id}`;

/** 「宝可梦中心（X）」→ X；没有括号时原样返回 */
export function townNameOf(poiName: string): string {
  const m = /[（(]([^）)]+)[）)]/.exec(poiName);
  return m ? m[1]!.trim() : poiName;
}

export function flyPointsOf(src: FlyIslandSource): FlyPoint[] {
  const out: FlyPoint[] = [];
  for (const p of src.pois) {
    const home = src.id === 'sprout' && p.id === HOME_FLY_POINT;
    if (p.kind !== 'pokecenter' && !home) continue;
    out.push({ id: p.id, island: src.id, islandName: src.name, name: home ? '萌芽镇' : townNameOf(p.name), x: p.position[0], z: p.position[2] });
  }
  return out;
}

export function allFlyPoints(islands: readonly FlyIslandSource[]): FlyPoint[] {
  return islands.flatMap(flyPointsOf);
}

export function isFlyPointRegistered(state: GameState, id: string): boolean {
  return id === HOME_FLY_POINT || state.flags[flyPointFlag(id)] === true;
}

export function isFlyPointUnlocked(state: GameState, p: FlyPoint): boolean {
  return hasVisited(state, p.island) && isFlyPointRegistered(state, p.id);
}

/** 靠近时登记；返回新登记的飞行点（用于提示） */
export function revealNear(state: GameState, points: readonly FlyPoint[], island: IslandId, x: number, z: number, radius = FLY_REVEAL_RADIUS): FlyPoint[] {
  const got: FlyPoint[] = [];
  for (const p of points) {
    if (p.island !== island || isFlyPointRegistered(state, p.id)) continue;
    if (Math.hypot(p.x - x, p.z - z) <= radius) {
      state.flags[flyPointFlag(p.id)] = true;
      got.push(p);
    }
  }
  return got;
}

export function pointInPolygon(x: number, z: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 旧存档补登记：飞行点所在区域到访过即登记。返回补登记数量 */
export function backfillFromZones(state: GameState, islands: readonly FlyIslandSource[]): number {
  let n = 0;
  for (const src of islands) {
    if (!hasVisited(state, src.id)) continue;
    for (const p of flyPointsOf(src)) {
      if (isFlyPointRegistered(state, p.id)) continue;
      const zone = src.zones.find((zn) => pointInPolygon(p.x, p.z, zn.polygon));
      if (zone && state.flags[`${ZONE_VISITED_PREFIX}${zone.id}`] === true) {
        state.flags[flyPointFlag(p.id)] = true;
        n++;
      }
    }
  }
  return n;
}

export interface FastTravelContext {
  hasFlyRide: boolean;
  indoors: boolean;
  mode: 'walk' | 'surf' | 'bike' | 'fly' | 'climb' | 'dive';
  busy: boolean;
}

/** 不能快速旅行的原因；null = 可以 */
export function fastTravelBlock(state: GameState, ctx: FastTravelContext): string | null {
  if (!ctx.hasFlyRide) return '需要拿到「翠澜徽章」，才能骑着宝可梦飞往其他城镇。';
  if (state.flags['league-run'] === true) return '联盟挑战中不能离开！';
  if (ctx.indoors) return '在室内不能飞行，先到外面去吧。';
  if (ctx.busy) return '现在不能飞行。';
  if (ctx.mode === 'surf' || ctx.mode === 'dive') return '在水上不能起飞，先上岸吧。';
  if (ctx.mode === 'climb') return '攀爬中不能起飞。';
  return null;
}

/** 已解锁的飞行点按岛分组（选单显示用；未到访岛屿的分组也保留，全部锁定） */
export function groupedFlyPoints(state: GameState, islands: readonly FlyIslandSource[]): { island: IslandId; name: string; visited: boolean; points: (FlyPoint & { unlocked: boolean })[] }[] {
  return islands.map((src) => ({
    island: src.id,
    name: src.name,
    visited: hasVisited(state, src.id),
    points: flyPointsOf(src).map((p) => ({ ...p, unlocked: isFlyPointUnlocked(state, p) })),
  }));
}

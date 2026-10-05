import { describe, expect, it } from 'vitest';
import { ISLANDS, type IslandConfig } from '@/config/islands';
import { createNewGame } from '@/systems/state';
import { ZONE_VISITED_PREFIX } from '@/systems/state/GameState';
import {
  allFlyPoints,
  backfillFromZones,
  fastTravelBlock,
  flyPointFlag,
  flyPointsOf,
  groupedFlyPoints,
  isFlyPointUnlocked,
  pointInPolygon,
  revealNear,
  townNameOf,
  type FlyIslandSource,
} from '@/systems/travel/fastTravel';
import { visitedFlag } from '@/systems/travel';
import { DEFAULT_BINDINGS } from '@/core/input/bindings';

const islands: FlyIslandSource[] = Object.values(ISLANDS)
  .filter((c): c is IslandConfig => !!c && c.id !== 'secret')
  .map((c) => ({ id: c.id, name: c.name, pois: c.pois, zones: c.zones }));
const newGame = () => createNewGame({ name: 'T', gender: 'boy', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });

describe('M3-22 城镇快速旅行', () => {
  it('飞行点：每座岛的宝可梦中心 + 萌芽镇自己家，城镇名从括号提取', () => {
    expect(townNameOf('宝可梦中心（翠澜镇）')).toBe('翠澜镇');
    expect(townNameOf('宝可梦中心')).toBe('宝可梦中心');
    const all = allFlyPoints(islands);
    const ids = all.map((p) => p.id);
    for (const id of ['player-house', 'pokecenter-cuilan', 'pokecenter-harbor', 'pokecenter-tide', 'pokecenter-thunder', 'pokecenter-lark', 'pokecenter-glaze', 'pokecenter-ever']) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const src of islands) expect(flyPointsOf(src).length, src.id).toBeGreaterThanOrEqual(2);
    for (const p of all) {
      expect(p.name).not.toMatch(/[（）]/);
      expect(Math.abs(p.x)).toBeLessThan(1024);
      expect(Math.abs(p.z)).toBeLessThan(1024);
    }
  });

  it('飞行点都在某个区域内（补登记依赖区域到访）', () => {
    for (const src of islands)
      for (const p of flyPointsOf(src)) expect(src.zones.some((z) => pointInPolygon(p.x, p.z, z.polygon)), `${p.id}`).toBe(true);
  });

  it('靠近登记；需要岛屿已到访才可用', () => {
    const s = newGame();
    const all = allFlyPoints(islands);
    const home = all.find((p) => p.id === 'player-house')!;
    expect(isFlyPointUnlocked(s, home)).toBe(true);
    const cui = all.find((p) => p.id === 'pokecenter-cuilan')!;
    expect(isFlyPointUnlocked(s, cui)).toBe(false);
    expect(revealNear(s, all, 'sprout', cui.x + 100, cui.z)).toEqual([]);
    expect(revealNear(s, all, 'sprout', cui.x + 30, cui.z).map((p) => p.id)).toEqual(['pokecenter-cuilan']);
    expect(revealNear(s, all, 'sprout', cui.x, cui.z)).toEqual([]);
    expect(isFlyPointUnlocked(s, cui)).toBe(true);
    const tide = all.find((p) => p.id === 'pokecenter-tide')!;
    // 别的岛的点不会因为同坐标被登记
    expect(revealNear(s, all, 'sprout', tide.x, tide.z).some((p) => p.id === 'pokecenter-tide')).toBe(false);
    s.flags[flyPointFlag('pokecenter-tide')] = true;
    expect(isFlyPointUnlocked(s, tide)).toBe(false);
    s.flags[visitedFlag('tide')] = true;
    expect(isFlyPointUnlocked(s, tide)).toBe(true);
  });

  it('旧存档按到访区域补登记', () => {
    const s = newGame();
    const sprout = islands.find((i) => i.id === 'sprout')!;
    const cui = flyPointsOf(sprout).find((p) => p.id === 'pokecenter-cuilan')!;
    const zone = sprout.zones.find((z) => pointInPolygon(cui.x, cui.z, z.polygon))!;
    s.flags[`${ZONE_VISITED_PREFIX}${zone.id}`] = true;
    expect(backfillFromZones(s, islands)).toBeGreaterThanOrEqual(1);
    expect(s.flags[flyPointFlag('pokecenter-cuilan')]).toBe(true);
    expect(backfillFromZones(s, islands)).toBe(0);
  });

  it('前提条件', () => {
    const s = newGame();
    const ok = { hasFlyRide: true, indoors: false, mode: 'walk' as const, busy: false };
    expect(fastTravelBlock(s, ok)).toBeNull();
    expect(fastTravelBlock(s, { ...ok, mode: 'bike' })).toBeNull();
    expect(fastTravelBlock(s, { ...ok, mode: 'fly' })).toBeNull();
    expect(fastTravelBlock(s, { ...ok, hasFlyRide: false })).toMatch(/徽章/);
    expect(fastTravelBlock(s, { ...ok, indoors: true })).toMatch(/室内/);
    expect(fastTravelBlock(s, { ...ok, mode: 'surf' })).toMatch(/水上/);
    expect(fastTravelBlock(s, { ...ok, mode: 'climb' })).toMatch(/攀爬/);
    s.flags['league-run'] = true;
    expect(fastTravelBlock(s, ok)).toMatch(/联盟/);
  });

  it('选单分组：未到访岛屿全部锁定；B 键绑定', () => {
    const s = newGame();
    const g = groupedFlyPoints(s, islands);
    expect(g.find((x) => x.island === 'sprout')!.visited).toBe(true);
    const glaze = g.find((x) => x.island === 'glaze')!;
    expect(glaze.visited).toBe(false);
    expect(glaze.points.every((p) => !p.unlocked)).toBe(true);
    expect(DEFAULT_BINDINGS.flyTravel.keys).toEqual(['KeyB']);
  });
});

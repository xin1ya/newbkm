/**
 * M3-18 · 潜水骑乘 + 海底神殿：机关可解 / 非平凡、潜水点、支线与互动配置一致性。
 */
import { describe, expect, it } from 'vitest';
import { INTERIORS } from '@/config/interiors';
import { ISLANDS } from '@/config/islands';
import { RIDES } from '@/config/rides';
import { STORY_PICKUPS, STORY_SCRIPTS } from '@/config/story';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { GLAZE_QUESTS } from '@/config/quests/glaze';
import { blockingRects, inRect, solveMechanism, type GymMechanismConfig } from '@/systems/puzzles/gymMechanism';

const SEA = INTERIORS['glaze-sea']!;
const room = (id: string) => SEA.rooms.find((r) => r.id === id)!;
const HALL = room('temple-hall').mechanism!;

describe('M3-18 海底神殿', () => {
  it('四个海底房间都存在且标记为水下', () => {
    for (const id of ['reef', 'trench', 'temple-hall', 'temple-sanctum']) expect(room(id)?.underwater, id).toBeTruthy();
  });
  it('前厅机关：可解、无死局、至少 3 次吹螺', () => {
    const r = solveMechanism(HALL);
    expect(r.solvable).toBe(true);
    expect(r.softlocks).toBe(0);
    expect(r.minToggles).toBeGreaterThanOrEqual(3);
  });
  it('暗流参与谜题：去掉暗流后更容易', () => {
    const noCur: GymMechanismConfig = { ...HALL, currents: [] };
    expect(solveMechanism(noCur).minToggles).toBeLessThan(solveMechanism(HALL).minToggles);
  });
  it('solvedState 下直接可达终点（解开后进门不复位）', () => {
    expect(HALL.solvedFlag).toBe('sea-temple-hall-open');
    const solved: GymMechanismConfig = { ...HALL, initial: { ...HALL.solvedState } };
    const r = solveMechanism(solved);
    expect(r.solvable).toBe(true);
    expect(r.minToggles).toBe(0);
  });
  it('海螺不站在墙 / 水幕里', () => {
    const block = blockingRects(HALL, {});
    for (const s of HALL.switches) expect(block.some((b) => inRect(b, s.position[0], s.position[1], 0.3)), s.id).toBe(false);
  });
  it('每个海底房间都有上浮出口，且 surfaceAt 指向琉璃的潜水点', () => {
    const spots = new Set((ISLANDS.glaze!.diveSpots ?? []).map((d) => d.id));
    for (const r of SEA.rooms.filter((x) => x.exits.some((e) => e.surfaceAt))) {
      for (const e of r.exits.filter((x) => x.surfaceAt)) expect(spots.has(e.surfaceAt!), `${r.id}/${e.id}`).toBe(true);
    }
    expect(room('reef').exits.some((e) => e.surfaceAt === 'coral-garden')).toBe(true);
    expect(room('trench').exits.some((e) => e.surfaceAt === 'temple-abyss')).toBe(true);
  });
  it('潜水点指向存在的房间', () => {
    for (const d of ISLANDS.glaze!.diveSpots ?? []) {
      expect(d.interior).toBe('glaze-sea');
      expect(room(d.room), d.id).toBeTruthy();
    }
  });
  it('潜水骑乘由 hm08-dive 解锁', () => {
    const dive = RIDES.find((r) => r.id === 'dive');
    expect(dive?.flag).toBe('hm08-dive');
  });
  it('剧情脚本与拾取物都已注册', () => {
    for (const id of ['diver-compass-pickup', 'diver-compass-return', 'sea-temple-hall-enter', 'sea-temple-sanctum-enter', 'sea-temple-altar']) expect(STORY_SCRIPTS.has(id), id).toBe(true);
    const p = STORY_PICKUPS.find((x) => x.id === 'diver-compass');
    expect(p?.floating).toBe(true);
    expect(p?.showIf).toContain('diver-quest-start');
  });
  it('海底所有可互动家具都有互动定义', () => {
    const ids = new Set(ALL_INTERACTIONS.map((i) => i.id));
    for (const r of SEA.rooms) for (const f of r.furniture ?? []) if (f.interact) expect(ids.has(f.interact), f.interact).toBe(true);
  });
  it('支线：深叔 → 潜水许可 → 潮落之门', () => {
    const diver = GLAZE_QUESTS.find((q) => q.id === 'side-old-diver')!;
    expect(diver.reward?.hm).toBe('hm08-dive');
    expect(diver.prerequisites).toContain('badge-glaze');
    const temple = GLAZE_QUESTS.find((q) => q.id === 'side-sea-temple')!;
    expect(temple.prerequisites).toContain('side-old-diver');
    expect(temple.completeFlag).toBe('sea-temple-cleared');
  });
});

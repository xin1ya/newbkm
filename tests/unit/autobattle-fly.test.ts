import { describe, expect, it } from 'vitest';
import { battle, dex, mon } from './helpers';
import { decideAutoAction, defaultAutoConfig, estimateDamage, sanitizeAutoConfig, autoSwitchIndex, type AutoBattleConfig } from '@/systems/autobattle';
import { chooseFlyMount, FLY_ABS_MAX, FLY_CEILING, FLY_CLEARANCE } from '@/systems/ride';
import { RIDE_BY_ID } from '@/config/rides';
import type { BattleRequest } from '@/systems/battle/engine';

type Act = Extract<BattleRequest, { kind: 'action' }>;
const cfg = (o: Partial<AutoBattleConfig> = {}): AutoBattleConfig => ({ ...defaultAutoConfig(), ...o });
const req = (b: ReturnType<typeof battle>): Act => {
  const r = b.request(0);
  if (r.kind !== 'action') throw new Error('expected action');
  return r;
};

describe('自动战斗决策', () => {
  it('非目标 → 逃跑', () => {
    const b = battle([mon(722, 15)], [mon(16, 3)]);
    const d = decideAutoAction(b, req(b), null, cfg(), {});
    expect(d).toMatchObject({ kind: 'act', action: { type: 'run' } });
  });

  it('打倒：使用指定招式；自动时选估算伤害最高的', () => {
    const b = battle([mon(722, 15)], [mon(16, 5)]);
    const r = req(b);
    const d1 = decideAutoAction(b, r, 'defeat', cfg({ moveSlot: 0 }), {});
    expect(d1).toMatchObject({ kind: 'act', action: { type: 'move', moveIndex: 0 } });
    const d2 = decideAutoAction(b, r, 'defeat', cfg({ moveSlot: -1 }), {});
    expect(d2.kind).toBe('act');
    if (d2.kind === 'act' && d2.action.type === 'move') {
      const dmg = r.moves.map((m) => estimateDamage(b, m.index, 0.925));
      expect(dmg[d2.action.moveIndex]).toBe(Math.max(...dmg));
    }
  });

  it('HP 低于阈值 → 用勾选的回复道具；没有道具 → 停止', () => {
    const me = mon(722, 15);
    const b = battle([me], [mon(16, 5)]);
    me.hp = 3;
    const r = req(b);
    expect(decideAutoAction(b, r, 'defeat', cfg({ hpPct: 0.5 }), { potion: 2 })).toMatchObject({ action: { type: 'item', itemId: 'potion', partyIndex: 0 } });
    expect(decideAutoAction(b, r, 'defeat', cfg({ hpPct: 0.5 }), {}).kind).toBe('stop');
  });

  it('所选招式 PP 低 → 用苹野果（战斗中可用，回复 10 PP）', () => {
    const me = mon(722, 15);
    const b = battle([me], [mon(16, 5)]);
    me.moves[0]!.pp = 1;
    const d = decideAutoAction(b, req(b), 'defeat', cfg({ moveSlot: 0, ppMin: 2 }), { 'leppa-berry': 1 });
    expect(d).toMatchObject({ action: { type: 'item', itemId: 'leppa-berry' } });
    if (d.kind === 'act') b.submit(d.action, { type: 'move', moveIndex: 0 });
    expect(me.moves[0]!.pp).toBe(Math.min(me.moves[0]!.maxPp, 11));
  });

  it('捕捉：红血扔球；否则不用会打倒对方的招式；球用完停止', () => {
    const foe = mon(16, 5);
    const b = battle([mon(722, 30)], [foe]);
    const r = req(b);
    const fm = b.maxHp(b.active(1));
    foe.hp = Math.max(1, Math.floor(fm * 0.15));
    expect(decideAutoAction(b, r, 'capture', cfg({ ball: 'poke-ball' }), { 'poke-ball': 3 })).toMatchObject({ action: { type: 'ball', itemId: 'poke-ball' } });
    expect(decideAutoAction(b, r, 'capture', cfg({ ball: 'poke-ball' }), {}).kind).toBe('stop');
    foe.hp = fm;
    // 等级差太大：每招都会打倒 → 直接扔球
    expect(decideAutoAction(b, r, 'capture', cfg(), { 'poke-ball': 3 })).toMatchObject({ action: { type: 'ball' } });
    // 势均力敌：选不会打倒的招式
    const foe2 = mon(19, 12);
    const b2 = battle([mon(722, 10)], [foe2]);
    const d = decideAutoAction(b2, req(b2), 'capture', cfg(), { 'poke-ball': 3 });
    expect(d.kind).toBe('act');
    if (d.kind === 'act' && d.action.type === 'move') expect(estimateDamage(b2, d.action.moveIndex, 1)).toBeLessThan(foe2.hp);
  });

  it('首发倒下 → 换第一只能战斗的', () => {
    const a = mon(722, 10);
    const c = mon(155, 10);
    const b = battle([a, c], [mon(16, 5)]);
    a.hp = 0;
    expect(autoSwitchIndex(b)).toBe(1);
  });

  it('配置清洗', () => {
    const c = sanitizeAutoConfig({ targets: { 16: 'capture', 19: 'x', abc: 'defeat' }, ball: 'master-ball', moveSlot: 9, hpPct: 5, healItems: ['potion', 'rare-candy'] });
    expect(c.targets).toEqual({ 16: 'capture' });
    expect(c.ball).toBe('poke-ball');
    expect(c.moveSlot).toBe(3);
    expect(c.hpPct).toBe(0.9);
    expect(c.healItems).toEqual(['potion']);
  });
});

describe('飞行骑乘', () => {
  const ride = RIDE_BY_ID.get('fly')!;
  it('已实装，徽章解锁', () => {
    expect(ride.implemented).toBe(true);
    expect(ride.flag).toBe('badge-verdant');
    expect(FLY_CLEARANCE).toBeLessThan(FLY_CEILING);
    expect(FLY_ABS_MAX).toBeGreaterThan(FLY_CEILING);
  });
  it('坐骑：优先有 fly 动画的大型飞行系；太小的不行；没有时租借大比鸟', () => {
    const fly = new Set([17, 18]);
    const has = (id: number) => fly.has(id);
    expect(chooseFlyMount(dex, [mon(16, 5)], ride, has).uid).toBeNull(); // 波波 0.3 m 太小
    expect(chooseFlyMount(dex, [mon(16, 5)], ride, has).speciesId).toBe(18);
    const p = mon(17, 20);
    expect(chooseFlyMount(dex, [mon(722, 10), p], ride, has).uid).toBe(p.uid);
  });
});

describe('区域图鉴', () => {
  it('从岛屿配置与遇敌表生成：野外区域、等级、物种占比合计 ≈ 1、到访标记', async () => {
    const { ISLANDS } = await import('@/config/islands');
    const { ENCOUNTER_TABLES } = await import('@/config/encounters');
    const { buildZoneDex } = await import('@/scenes/common/zoneDex');
    const isl = ISLANDS.sprout!;
    const zd = buildZoneDex(isl, ENCOUNTER_TABLES, { 'zone-visited.sprout-meadow': true });
    const meadow = zd.zones.find((z) => z.id === 'sprout-meadow')!;
    expect(meadow.visited).toBe(true);
    expect(meadow.species.some((s) => s.speciesId === 16)).toBe(true);
    const sum = meadow.species.reduce((s, x) => s + x.share, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
    expect(zd.zones.every((z) => z.kind !== 'town' || z.species.length > 0)).toBe(true);
    expect(zd.zones.filter((z) => z.alpha).length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { chooseAction, scoreMoves } from '@/systems/battle';
import { attemptCapture, captureChance, fieldThrowMultiplier, FIELD_THROW_CAP, modifiedCatchRate } from '@/systems/capture';
import { checkEvolution, evolve, expGain, gainExp, movesLearnedAt } from '@/systems/progression';
import { createRng } from '@/systems/rng';
import { battle, dex, mon, SPECIES } from './helpers';

const smartTrainer = { id: 'gym', name: '沧澜', title: '馆主', ai: 'smart' as const };

describe('SYS-011 战斗 AI', () => {
  it('智能 AI 不使用被属性免疫的招式', () => {
    const foe = mon(SPECIES.pikachu, 30, { moves: ['thunderbolt', 'quick-attack'] });
    const b = battle([mon(260, 30)], [foe], { kind: 'trainer', foe: { party: [foe], trainer: smartTrainer } });
    // 巨沼怪（水/地面）对电免疫
    const scores = scoreMoves(b, 1);
    expect(scores.find((s) => s.id === 'thunderbolt')?.score).toBe(0);
    for (let i = 0; i < 10; i++) expect(chooseAction(b, 1)).toEqual({ type: 'move', moveIndex: 1 });
  });

  it('智能 AI 优先选择克制招式', () => {
    const foe = mon(SPECIES.staryu, 25, { moves: ['tackle', 'water-gun'] });
    const b = battle([mon(SPECIES.cyndaquil, 25)], [foe], { kind: 'trainer', foe: { party: [foe], trainer: smartTrainer } });
    expect(chooseAction(b, 1)).toEqual({ type: 'move', moveIndex: 1 });
  });

  it('智能 AI 考虑吸收特性（储水）', () => {
    const me = mon(SPECIES.poliwag, 25);
    me.ability = 'water-absorb';
    const foe = mon(SPECIES.staryu, 25, { moves: ['water-gun', 'tackle'] });
    const b = battle([me], [foe], { kind: 'trainer', foe: { party: [foe], trainer: smartTrainer } });
    expect(chooseAction(b, 1)).toEqual({ type: 'move', moveIndex: 1 });
  });

  it('野生 AI 随机选招，且只选可用招式', () => {
    const wild = mon(SPECIES.rattata, 5, { moves: ['tackle', 'tail-whip'] });
    wild.moves[1]!.pp = 0;
    const b = battle([mon(SPECIES.rowlet, 5)], [wild]);
    for (let i = 0; i < 20; i++) expect(chooseAction(b, 1)).toEqual({ type: 'move', moveIndex: 0 });
  });

  it('智能 AI 在不利对位时换人', () => {
    const krabby = mon(SPECIES.krabby, 25, { moves: ['splash'] });
    const oddish = mon(SPECIES.oddish, 25, { moves: ['absorb'] });
    const b = battle([mon(SPECIES.pikachu, 25, { moves: ['thunderbolt'] })], [krabby, oddish], { kind: 'trainer', foe: { party: [krabby, oddish], trainer: smartTrainer } });
    expect(chooseAction(b, 1)).toEqual({ type: 'switch', partyIndex: 1 });
  });
});

describe('SYS-005 捕获', () => {
  const ctx = { turn: 2, targetTypes: ['water' as const], isNight: false, inCave: false };
  it('公式：满 HP 普通球 a = 捕获率 / 3 × 3 … HP 越低越容易', () => {
    const full = modifiedCatchRate({ maxHp: 100, hp: 100, captureRate: 255, ball: 'poke-ball', ballContext: ctx, status: null });
    expect(full).toBeCloseTo(85);
    const low = modifiedCatchRate({ maxHp: 100, hp: 1, captureRate: 255, ball: 'poke-ball', ballContext: ctx, status: null });
    expect(low).toBeGreaterThan(full);
  });

  it('状态 / 球种加成', () => {
    const base = { maxHp: 100, hp: 50, captureRate: 45, ballContext: ctx };
    const p = captureChance({ ...base, ball: 'poke-ball', status: null });
    expect(captureChance({ ...base, ball: 'ultra-ball', status: null })).toBeGreaterThan(p);
    expect(captureChance({ ...base, ball: 'poke-ball', status: 'slp' })).toBeGreaterThan(captureChance({ ...base, ball: 'poke-ball', status: 'par' }));
    expect(captureChance({ ...base, ball: 'net-ball', status: null })).toBeGreaterThan(captureChance({ ...base, ball: 'great-ball', status: null }));
    expect(captureChance({ ...base, ball: 'master-ball', status: null })).toBe(1);
  });

  it('实测成功率与理论值一致（±4%）', () => {
    const input = { maxHp: 100, hp: 40, captureRate: 45, ball: 'great-ball' as const, ballContext: ctx, status: null };
    const rng = createRng(5);
    let ok = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) if (attemptCapture(input, rng).success) ok++;
    expect(Math.abs(ok / N - captureChance(input))).toBeLessThan(0.04);
  });

  it('摇晃次数 0–3', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const r = attemptCapture({ maxHp: 100, hp: 100, captureRate: 3, ball: 'poke-ball', ballContext: ctx, status: null }, rng);
      expect(r.shakes).toBeGreaterThanOrEqual(0);
      expect(r.shakes).toBeLessThanOrEqual(3);
    }
  });

  it('野外投球情境系数（设计 §9）', () => {
    const none = { sleeping: false, fromBehind: false, levelAdvantage: 0, alerted: false, alpha: false };
    expect(fieldThrowMultiplier(none)).toBe(1);
    expect(fieldThrowMultiplier({ ...none, sleeping: true })).toBe(2);
    expect(fieldThrowMultiplier({ ...none, fromBehind: true })).toBe(1.5);
    expect(fieldThrowMultiplier({ ...none, levelAdvantage: 10 })).toBeCloseTo(1.3);
    expect(fieldThrowMultiplier({ ...none, sleeping: true, fromBehind: true, levelAdvantage: 20 })).toBe(FIELD_THROW_CAP);
    expect(fieldThrowMultiplier({ ...none, alerted: true, alpha: true })).toBeCloseTo(0.375);
  });
});

describe('SYS-004 成长', () => {
  it('训练家宝可梦经验 ×1.5，参战人数平分', () => {
    const base = { defeatedSpeciesBaseExp: 100, defeatedLevel: 10, victorLevel: 10, isTrainer: false, participants: 1 };
    const wild = expGain(base);
    expect(expGain({ ...base, isTrainer: true })).toBeGreaterThan(wild * 1.4);
    expect(expGain({ ...base, participants: 2 })).toBeLessThan(wild);
    // 等级差越大（己方更高），获得越少
    expect(expGain({ ...base, victorLevel: 30 })).toBeLessThan(wild);
  });

  it('升级并自动学会招式', () => {
    const p = mon(SPECIES.rowlet, 5, { moves: ['tackle'] });
    const records = gainExp(dex, p, 5000);
    expect(p.level).toBeGreaterThan(5);
    expect(records.length).toBe(p.level - 5);
    expect(records.flatMap((r) => r.learned).length).toBeGreaterThan(0);
    for (const r of records) expect(r.after.hp).toBeGreaterThanOrEqual(r.before.hp);
  });

  it('招式栏已满时新招式进入待定列表', () => {
    const p = mon(SPECIES.rowlet, 5, { moves: ['tackle', 'growl', 'leafage', 'astonish'] });
    const learnAt = dex.species(SPECIES.rowlet).learnset.find((l) => l.level > 5 && !['tackle', 'growl', 'leafage', 'astonish'].includes(l.move));
    expect(learnAt).toBeDefined();
    const records = gainExp(dex, p, 200000);
    expect(records.flatMap((r) => r.pending)).toContain(learnAt!.move);
    expect(p.moves).toHaveLength(4);
    expect(movesLearnedAt(dex, p, 0)).toBeInstanceOf(Array);
  });

  it('等级进化：木木枭 Lv17 → 投羽枭', () => {
    const p = mon(SPECIES.rowlet, 16);
    expect(checkEvolution(dex, p, { timeOfDay: 'day' })).toBeNull();
    p.level = 17;
    expect(checkEvolution(dex, p, { timeOfDay: 'day' })).toBe(723);
    const hpLost = 5;
    p.hp -= hpLost;
    evolve(dex, p, 723);
    expect(p.speciesId).toBe(723);
  });

  it('道具进化：走路草系 → 霸王花需要叶之石', () => {
    const gloom = mon(44, 30);
    expect(checkEvolution(dex, gloom, { timeOfDay: 'day' })).toBeNull();
    expect(checkEvolution(dex, gloom, { timeOfDay: 'day', usedItem: 'leaf-stone' })).toBe(45);
    expect(checkEvolution(dex, gloom, { timeOfDay: 'day', usedItem: 'sun-stone' })).toBe(182);
  });
});

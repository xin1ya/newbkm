import { describe, expect, it } from 'vitest';
import { addEvs, calcStat, evTotal, natureMultiplier, stageMultiplier, accuracyStageMultiplier, zeroStats } from '@/systems/pokemon/stats';
import { expForLevel, levelForExp } from '@/systems/pokemon/growth';
import { dex, mon, SPECIES } from './helpers';
import { getStats } from '@/systems/pokemon/Pokemon';

describe('SYS-008 能力值', () => {
  it('HP 与其他能力值公式（Bulbapedia 示例：Lv78 烈咬陆鲨）', () => {
    // 种族值 108/130/95/80/85/102，IV 24/12/30/16/23/5，EV 74/190/91/48/84/23，性格 Adamant
    const adamant = dex.nature('adamant');
    expect(calcStat('hp', 108, 24, 74, 78)).toBe(289);
    expect(calcStat('atk', 130, 12, 190, 78, adamant)).toBe(278);
    expect(calcStat('def', 95, 30, 91, 78, adamant)).toBe(193);
    expect(calcStat('spa', 80, 16, 48, 78, adamant)).toBe(135);
    expect(calcStat('spd', 85, 23, 84, 78, adamant)).toBe(171);
    expect(calcStat('spe', 102, 5, 23, 78, adamant)).toBe(171);
  });

  it('25 种性格，中性性格不修正', () => {
    expect(dex.natureIds()).toHaveLength(25);
    const neutral = dex.natureIds().map((n) => dex.nature(n)).filter((n) => n.plus === n.minus || n.plus === null);
    expect(neutral).toHaveLength(5);
    expect(natureMultiplier(dex.nature('hardy'), 'atk')).toBe(1);
    expect(natureMultiplier(dex.nature('modest'), 'spa')).toBe(1.1);
    expect(natureMultiplier(dex.nature('modest'), 'atk')).toBe(0.9);
    expect(natureMultiplier(dex.nature('modest'), 'hp')).toBe(1);
  });

  it('努力值单项 252、总计 510 上限', () => {
    const evs = zeroStats();
    addEvs(evs, { atk: 300 });
    expect(evs.atk).toBe(252);
    addEvs(evs, { spe: 252 });
    addEvs(evs, { hp: 100 });
    expect(evTotal(evs)).toBe(510);
    expect(evs.hp).toBe(6);
  });

  it('能力阶倍率', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3);
    expect(stageMultiplier(6)).toBe(4);
    expect(stageMultiplier(-6)).toBe(0.25);
    expect(stageMultiplier(9)).toBe(4);
    expect(accuracyStageMultiplier(-1)).toBe(0.75);
    expect(accuracyStageMultiplier(3)).toBe(2);
  });

  it('创建个体：HP 满、招式来自学招表、最多 4 个', () => {
    const p = mon(SPECIES.rowlet, 15);
    expect(p.hp).toBe(getStats(dex, p).hp);
    expect(p.moves.length).toBeGreaterThan(0);
    expect(p.moves.length).toBeLessThanOrEqual(4);
    const learnable = new Set(dex.species(SPECIES.rowlet).learnset.map((l) => l.move));
    for (const m of p.moves) expect(learnable.has(m.id)).toBe(true);
  });
});

describe('经验曲线', () => {
  it('6 种成长速度 Lv100 经验', () => {
    expect(expForLevel('fast', 100)).toBe(800000);
    expect(expForLevel('medium', 100)).toBe(1000000);
    expect(expForLevel('medium-slow', 100)).toBe(1059860);
    expect(expForLevel('slow', 100)).toBe(1250000);
    expect(expForLevel('slow-then-very-fast', 100)).toBe(600000);
    expect(expForLevel('fast-then-very-slow', 100)).toBe(1640000);
    expect(expForLevel('medium-slow', 1)).toBe(0);
  });
  it('单调递增且可反推', () => {
    for (const r of ['fast', 'medium', 'medium-slow', 'slow', 'slow-then-very-fast', 'fast-then-very-slow'] as const) {
      for (let l = 2; l <= 100; l++) expect(expForLevel(r, l)).toBeGreaterThan(expForLevel(r, l - 1));
      expect(levelForExp(r, expForLevel(r, 37))).toBe(37);
      expect(levelForExp(r, expForLevel(r, 37) - 1)).toBe(36);
    }
  });
});

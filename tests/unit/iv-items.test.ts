import { describe, expect, it } from 'vitest';
import { applyIvItem, ivItemStatUsable, ivItemUsable } from '@/systems/pokemon';
import type { StatTable } from '@/systems/data/types';

const ivs = (v: Partial<StatTable> = {}): StatTable => ({ hp: 10, atk: 20, def: 31, spa: 5, spd: 0, spe: 31, ...v });

describe('个体值洗练道具', () => {
  it('银王冠：指定项变 31，已经 31 的不能选，不选能力返回 null', () => {
    const t = ivs();
    expect(ivItemStatUsable('bottle-cap', t, 'def')).toBe(false);
    expect(applyIvItem('bottle-cap', t, undefined, () => 0)).toBeNull();
    const c = applyIvItem('bottle-cap', t, 'atk', () => 0);
    expect(c).toEqual([{ stat: 'atk', from: 20, to: 31 }]);
    expect(t.atk).toBe(31);
    expect(t.hp).toBe(10);
  });

  it('金王冠：全部变 31；全满时不可用', () => {
    const t = ivs();
    applyIvItem('gold-bottle-cap', t, undefined, () => 0);
    expect(Object.values(t).every((v) => v === 31)).toBe(true);
    expect(ivItemUsable('gold-bottle-cap', t)).toBe(false);
    expect(applyIvItem('gold-bottle-cap', t, undefined, () => 0)).toBeNull();
  });

  it('洗练石：6 项全部按 roll 重新随机（可以变差），并夹在 0–31', () => {
    const t = ivs();
    const seq = [0, 31, 40, -3, 12.7, 7];
    let i = 0;
    const c = applyIvItem('reroll-stone', t, undefined, () => seq[i++]!)!;
    expect(c).toHaveLength(6);
    expect(t).toEqual({ hp: 0, atk: 31, def: 31, spa: 0, spd: 12, spe: 7 });
    expect(c.find((x) => x.stat === 'spe')).toEqual({ stat: 'spe', from: 31, to: 7 });
  });

  it('单属性洗练石：只改指定项，31 也可以重洗', () => {
    const t = ivs();
    expect(ivItemStatUsable('focus-reroll-stone', t, 'def')).toBe(true);
    applyIvItem('focus-reroll-stone', t, 'def', () => 4);
    expect(t).toEqual(ivs({ def: 4 }));
  });

  it('未知道具不可用', () => {
    expect(ivItemUsable('potion', ivs())).toBe(false);
    expect(applyIvItem('potion', ivs(), 'hp', () => 1)).toBeNull();
  });
});

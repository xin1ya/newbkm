import { describe, expect, it } from 'vitest';
import { calcDamage } from '@/systems/battle';
import { battle, dex, mon, SPECIES } from './helpers';
import { getStats } from '@/systems/pokemon/Pokemon';

describe('SYS-003 伤害公式', () => {
  it('与手算一致（本系 + 克制 + 随机数）', () => {
    const b = battle([mon(SPECIES.mudkip, 20, { moves: ['water-gun'] })], [mon(SPECIES.cyndaquil, 20, { moves: ['tackle'] })]);
    const user = b.active(0);
    const target = b.active(1);
    const move = dex.move('water-gun');
    const res = calcDamage(b, { user, target, move, basePower: 40, type: 'water', crit: false, targetSide: b.sides[1], roll: 1 });
    const A = getStats(dex, user.pokemon).spa;
    const D = getStats(dex, target.pokemon).spd;
    let expected = Math.floor(Math.floor((Math.floor((2 * 20) / 5 + 2) * 40 * A) / D) / 50) + 2;
    expected = Math.floor(expected * 1.5); // 本系
    expected = Math.floor(expected * 2); // 水 → 火
    expect(res.damage).toBe(expected);
    expect(res.effectiveness).toBe(2);
  });

  it('随机数范围 85%–100%', () => {
    const b = battle([mon(SPECIES.rattata, 30, { moves: ['tackle'] })], [mon(SPECIES.krabby, 30, { moves: ['tackle'] })]);
    const args = { user: b.active(0), target: b.active(1), move: dex.move('tackle'), basePower: 40, type: 'normal' as const, crit: false, targetSide: b.sides[1] };
    const lo = calcDamage(b, { ...args, roll: 0.85 }).damage;
    const hi = calcDamage(b, { ...args, roll: 1 }).damage;
    expect(lo).toBeLessThan(hi);
    expect(lo).toBeGreaterThanOrEqual(Math.floor(hi * 0.85) - 1);
  });

  it('要害 ×1.5，且忽略攻击方负能力阶 / 防御方正能力阶', () => {
    const b = battle([mon(SPECIES.rattata, 30, { moves: ['tackle'] })], [mon(SPECIES.krabby, 30, { moves: ['tackle'] })]);
    const user = b.active(0);
    const target = b.active(1);
    const args = { user, target, move: dex.move('tackle'), basePower: 40, type: 'normal' as const, targetSide: b.sides[1], roll: 1 };
    const normal = calcDamage(b, { ...args, crit: false }).damage;
    const crit = calcDamage(b, { ...args, crit: true }).damage;
    expect(crit).toBeGreaterThanOrEqual(Math.floor(normal * 1.5) - 1);
    user.stages.atk = -2;
    target.stages.def = 2;
    expect(calcDamage(b, { ...args, crit: true }).damage).toBe(crit);
    expect(calcDamage(b, { ...args, crit: false }).damage).toBeLessThan(normal);
  });

  it('属性免疫为 0，双属性叠乘', () => {
    expect(dex.effectiveness('normal', ['ghost'])).toBe(0);
    expect(dex.effectiveness('electric', ['water', 'flying'])).toBe(4);
    expect(dex.effectiveness('grass', ['fire', 'flying'])).toBe(0.25);
    expect(dex.effectiveness('ground', ['flying'])).toBe(0);
    expect(dex.typeChart.types).toHaveLength(18);
  });

  it('灼伤物理减半、根性无视灼伤并 ×1.5', () => {
    const b = battle([mon(SPECIES.rattata, 30, { moves: ['tackle'] })], [mon(SPECIES.krabby, 30, { moves: ['tackle'] })]);
    const user = b.active(0);
    const args = { user, target: b.active(1), move: dex.move('tackle'), basePower: 40, type: 'normal' as const, crit: false, targetSide: b.sides[1], roll: 1 };
    const base = calcDamage(b, args).damage;
    user.pokemon.status = { kind: 'brn' };
    const burned = calcDamage(b, args).damage;
    expect(burned).toBeLessThanOrEqual(Math.ceil(base / 2));
    user.pokemon.ability = 'guts';
    expect(calcDamage(b, args).damage).toBeGreaterThan(base);
  });

  it('天气：雨天水 ×1.5、火 ×0.5', () => {
    const b = battle([mon(SPECIES.mudkip, 30, { moves: ['water-gun'] })], [mon(SPECIES.rattata, 30, { moves: ['tackle'] })]);
    const args = { user: b.active(0), target: b.active(1), move: dex.move('water-gun'), basePower: 40, type: 'water' as const, crit: false, targetSide: b.sides[1], roll: 1 };
    const clear = calcDamage(b, args).damage;
    b.weather = 'rain';
    expect(calcDamage(b, args).damage).toBeGreaterThanOrEqual(Math.floor(clear * 1.5) - 1);
    b.weather = 'sun';
    expect(calcDamage(b, args).damage).toBeLessThanOrEqual(Math.ceil(clear * 0.5) + 1);
  });

  it('反射壁减半，要害无视', () => {
    const b = battle([mon(SPECIES.rattata, 30, { moves: ['tackle'] })], [mon(SPECIES.krabby, 30, { moves: ['tackle'] })]);
    const args = { user: b.active(0), target: b.active(1), move: dex.move('tackle'), basePower: 40, type: 'normal' as const, targetSide: b.sides[1], roll: 1 };
    const base = calcDamage(b, { ...args, crit: false }).damage;
    const critBase = calcDamage(b, { ...args, crit: true }).damage;
    b.sides[1].conditions.reflect = 5;
    expect(calcDamage(b, { ...args, crit: false }).damage).toBeLessThanOrEqual(Math.ceil(base / 2));
    expect(calcDamage(b, { ...args, crit: true }).damage).toBe(critBase);
  });
});

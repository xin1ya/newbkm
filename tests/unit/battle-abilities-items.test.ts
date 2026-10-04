import { describe, expect, it } from 'vitest';
import { calcDamage, IMPLEMENTED_ABILITIES, IMPLEMENTED_ITEMS } from '@/systems/battle';
import { battle, dex, mon, SPECIES } from './helpers';
import { maxHp } from '@/systems/pokemon/Pokemon';

describe('SYS-010 特性', () => {
  it('实现数量达到规格（核心特性 ≥ 15），萌芽群岛物种的特性全部登记', () => {
    expect(IMPLEMENTED_ABILITIES.size).toBeGreaterThanOrEqual(15);
    for (const a of ['intimidate', 'overgrow', 'blaze', 'torrent', 'water-absorb', 'lightning-rod', 'static', 'chlorophyll', 'swift-swim', 'rain-dish', 'sturdy', 'shed-skin']) {
      expect(IMPLEMENTED_ABILITIES.has(a)).toBe(true);
    }
    for (const s of dex.allSpecies()) for (const a of s.abilities) expect(IMPLEMENTED_ABILITIES.has(a.id), `${s.key}: ${a.id}`).toBe(true);
  });

  it('威吓：出场降低对手攻击', () => {
    const b = battle([mon(SPECIES.rattata, 20)], [mon(SPECIES.gyarados, 20, { abilitySlot: 'first' })]);
    expect(b.active(1).pokemon.ability).toBe('intimidate');
    expect(b.active(0).stages.atk).toBe(-1);
  });

  it('怪力钳阻止攻击下降', () => {
    const k = mon(SPECIES.krabby, 20);
    k.ability = 'hyper-cutter';
    const b = battle([k], [mon(SPECIES.gyarados, 20)]);
    expect(b.active(0).stages.atk).toBe(0);
  });

  it('储水：吸收水属性招式回复 HP', () => {
    const pol = mon(SPECIES.poliwag, 20, { moves: ['splash'] });
    pol.ability = 'water-absorb';
    pol.hp = 10;
    const b = battle([mon(SPECIES.mudkip, 20, { moves: ['water-gun'] })], [pol]);
    const evs = b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(evs.some((e) => e.type === 'ability' && e.ability === 'water-absorb')).toBe(true);
    expect(pol.hp).toBeGreaterThan(10);
  });

  it('避雷针：吸收电属性并提高特攻', () => {
    const pk = mon(SPECIES.pikachu, 20, { moves: ['splash'] });
    pk.ability = 'lightning-rod';
    const b = battle([mon(SPECIES.pikachu, 20, { moves: ['thunder-shock'] })], [pk]);
    b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(b.active(1).stages.spa).toBe(1);
    expect(pk.hp).toBe(maxHp(dex, pk));
  });

  it('结实：满 HP 时保留 1 HP', () => {
    const g = mon(SPECIES.caterpie, 2, { moves: ['string-shot'] });
    g.ability = 'sturdy';
    const b = battle([mon(SPECIES.gyarados, 60, { moves: ['waterfall'] })], [g]);
    b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(g.hp).toBe(1);
  });

  it('茂盛：HP ≤ 1/3 时草属性威力 ×1.5', () => {
    const r = mon(SPECIES.rowlet, 20, { moves: ['leafage'] });
    const b = battle([r], [mon(SPECIES.krabby, 20, { moves: ['splash'] })]);
    const args = { user: b.active(0), target: b.active(1), move: dex.move('leafage'), basePower: 40, type: 'grass' as const, crit: false, targetSide: b.sides[1], roll: 1 };
    const full = calcDamage(b, args).damage;
    r.hp = 1;
    expect(calcDamage(b, args).damage).toBeGreaterThan(full);
  });

  it('悠游自如：雨天速度翻倍', () => {
    const m = mon(SPECIES.magikarp, 20);
    m.ability = 'swift-swim';
    const b = battle([m], [mon(SPECIES.pidgey, 20)]);
    const s0 = b.effectiveSpeed(b.active(0));
    b.weather = 'rain';
    expect(b.effectiveSpeed(b.active(0))).toBe(s0 * 2);
  });

  it('静电：接触类招式有概率麻痹攻击方（统计）', () => {
    let paralyzed = 0;
    for (let i = 0; i < 60; i++) {
      const pk = mon(SPECIES.pikachu, 40, { moves: ['splash'] }, i);
      pk.ability = 'static';
      const b = battle([mon(SPECIES.rattata, 10, { moves: ['tackle'] }, i)], [pk], {}, 1000 + i);
      b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
      if (b.active(0).pokemon.status?.kind === 'par') paralyzed++;
    }
    expect(paralyzed).toBeGreaterThan(5);
    expect(paralyzed).toBeLessThan(40);
  });

  it('未实现的特性按 no-op 处理', () => {
    const p = mon(SPECIES.rattata, 20, { moves: ['tackle'] });
    p.ability = 'some-future-ability';
    const b = battle([p], [mon(SPECIES.magikarp, 20, { moves: ['splash'] })]);
    expect(() => b.submit({ type: 'move', moveIndex: 0 })).not.toThrow();
  });
});

describe('SYS-010 携带物', () => {
  it('实现数量达到规格（核心携带物 ≥ 10）', () => {
    expect(IMPLEMENTED_ITEMS.size).toBeGreaterThanOrEqual(10);
  });

  it('吃剩的东西：回合末回复 1/16', () => {
    const p = mon(SPECIES.krabby, 30, { moves: ['splash'], heldItem: 'leftovers' });
    p.hp = 20;
    const b = battle([p], [mon(SPECIES.magikarp, 30, { moves: ['splash'] })]);
    b.submit({ type: 'move', moveIndex: 0 });
    expect(p.hp).toBe(20 + Math.floor(maxHp(dex, p) / 16));
  });

  it('讲究头带：锁定第一次使用的招式', () => {
    const p = mon(SPECIES.rattata, 30, { moves: ['tackle', 'quick-attack'], heldItem: 'choice-band' });
    const b = battle([p], [mon(SPECIES.gyarados, 60, { moves: ['splash'] })]);
    b.submit({ type: 'move', moveIndex: 0 });
    const req = b.request(0);
    expect(req.kind === 'action' && req.moves[1]?.disabled).toBe(true);
    expect(() => b.submit({ type: 'move', moveIndex: 1 })).toThrow();
  });

  it('生命宝珠：伤害 ×1.3，攻击后损失 1/10 HP', () => {
    const p = mon(SPECIES.rattata, 30, { moves: ['tackle'], heldItem: 'life-orb' });
    const b = battle([p], [mon(SPECIES.gyarados, 60, { moves: ['splash'] })]);
    const evs = b.submit({ type: 'move', moveIndex: 0 });
    expect(evs.some((e) => e.type === 'damage' && e.source === 'life-orb' && e.side === 0)).toBe(true);
  });

  it('文柚果：HP ≤ 1/2 时回复 1/4 并消耗', () => {
    const p = mon(SPECIES.krabby, 30, { moves: ['splash'], heldItem: 'sitrus-berry' });
    const b = battle([p], [mon(SPECIES.rattata, 30, { moves: ['splash'] })]);
    const max = maxHp(dex, p);
    b.damage(b.active(0), Math.ceil(max / 2) + 1, 'move');
    expect(b.active(0).itemUsed).toBe(true);
    expect(p.hp).toBe(max - (Math.ceil(max / 2) + 1) + Math.floor(max / 4));
  });

  it('气势披带：满 HP 时保留 1 HP', () => {
    const c = mon(SPECIES.caterpie, 2, { moves: ['string-shot'], heldItem: 'focus-sash' });
    const b = battle([mon(SPECIES.gyarados, 60, { moves: ['waterfall'] })], [c]);
    b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(c.hp).toBe(1);
  });

  it('属性强化道具 ×1.2', () => {
    const p = mon(SPECIES.mudkip, 30, { moves: ['water-gun'] });
    const b = battle([p], [mon(SPECIES.rattata, 30)]);
    const args = { user: b.active(0), target: b.active(1), move: dex.move('water-gun'), basePower: 40, type: 'water' as const, crit: false, targetSide: b.sides[1], roll: 1 };
    const base = calcDamage(b, args).damage;
    p.heldItem = 'mystic-water';
    expect(calcDamage(b, args).damage).toBeGreaterThan(base);
  });
});

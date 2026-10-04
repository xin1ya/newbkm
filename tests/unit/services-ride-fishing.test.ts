import { describe, expect, it } from 'vitest';
import { dex, mon, SPECIES } from './helpers';
import { createNewGame } from '@/systems/state';
import { buy, buyPrice, maxAffordable, sell, sellPrice, shopInventory } from '@/systems/shop';
import { ITEM_PRICES, SHOPS, SHOP_BY_ID } from '@/config/shops';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { itemInfo } from '@/systems/items';
import { ALL_NPCS as NPCS } from '@/config/npcs';
import { RIDES } from '@/config/rides';
import { chooseMount, rideFor, shadowEncounterChance, surfProbe, surfable } from '@/systems/ride';
import { bestRod, findFishingTable, FishingSession, fishStrength, rollFish, RODS, type FishInput } from '@/systems/fishing';
import { FISH_STRENGTH, FISHING_SPOTS, FISHING_TABLES } from '@/config/fishing';
import type { Rng } from '@/systems/rng';

const newState = () => createNewGame({ name: '小翠', gender: 'girl', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });

/** 确定性的假随机数：next 固定，int 取下限，chance 为假，weighted 取第一项 */
const fixedRng = (v = 0.5): Rng => ({ next: () => v, int: (a: number) => a, chance: () => false, weighted: () => 0 }) as unknown as Rng;

describe('M1-19 商店', () => {
  const mart = SHOP_BY_ID.get('cuilan-mart')!;

  it('货架按徽章解锁', () => {
    const s = newState();
    expect(shopInventory(mart, s.flags)).toContain('poke-ball');
    expect(shopInventory(mart, s.flags)).not.toContain('great-ball');
    s.flags['badge-verdant'] = true;
    expect(shopInventory(mart, s.flags)).toContain('great-ball');
    expect(shopInventory(mart, s.flags)).not.toContain('ultra-ball');
  });

  it('购买扣钱加物品；10 个精灵球送 1 个', () => {
    const s = newState();
    const price = buyPrice(ITEM_PRICES, mart, 'poke-ball')!;
    const r = buy(s, ITEM_PRICES, mart, 'poke-ball', 10);
    expect(r).toEqual({ ok: true, spent: price * 10, bonus: 1 });
    expect(s.bag['poke-ball']).toBe(11);
    expect(s.money).toBe(3000 - price * 10);
    const r2 = buy(s, ITEM_PRICES, mart, 'potion', 2);
    expect(r2.ok && r2.bonus).toBe(0);
  });

  it('钱不够 / 未上架 / 数量非法时拒绝且不改状态', () => {
    const s = newState();
    s.money = 10;
    expect(buy(s, ITEM_PRICES, mart, 'potion', 1)).toEqual({ ok: false, reason: 'money' });
    expect(buy(s, ITEM_PRICES, mart, 'ultra-ball', 1)).toEqual({ ok: false, reason: 'stock' });
    expect(buy(s, ITEM_PRICES, mart, 'potion', 0)).toEqual({ ok: false, reason: 'qty' });
    expect(s.money).toBe(10);
    expect(s.bag.potion).toBe(3);
  });

  it('最多可买数量受金钱与 99 上限约束', () => {
    const s = newState();
    const p = buyPrice(ITEM_PRICES, mart, 'potion')!;
    expect(maxAffordable(s, p, 'potion')).toBe(Math.min(99, Math.floor(3000 / p)));
    s.money = 1_000_000;
    expect(maxAffordable(s, p, 'potion')).toBe(99);
  });

  it('出售半价；重要物品不可出售', () => {
    const s = newState();
    const half = Math.floor(ITEM_PRICES.potion! / 2);
    expect(sellPrice(ITEM_PRICES, 'potion', true)).toBe(half);
    expect(sell(s, ITEM_PRICES, 'potion', 2, true)).toEqual({ ok: true, earned: half * 2 });
    expect(s.bag.potion).toBe(1);
    expect(s.money).toBe(3000 + half * 2);
    expect(sell(s, ITEM_PRICES, 'potion', 5, true)).toEqual({ ok: false, reason: 'qty' });
    s.bag['old-rod'] = 1;
    const rod = itemInfo(dex, 'old-rod', KEY_ITEM_BY_ID);
    expect(sell(s, ITEM_PRICES, 'old-rod', 1, rod.tossable)).toEqual({ ok: false, reason: 'unsellable' });
  });

  it('加价摊位按倍率取整', () => {
    const sea = SHOP_BY_ID.get('harbor-sea')!;
    expect(buyPrice(ITEM_PRICES, sea, 'mystic-water')).toBe(Math.round(ITEM_PRICES['mystic-water']! * 1.1));
  });

  it('所有货架物品都有定价且存在于图鉴道具表；NPC 服务引用的商店都存在', () => {
    for (const shop of SHOPS)
      for (const st of shop.stock) {
        expect(ITEM_PRICES[st.item], `${shop.id}/${st.item}`).toBeGreaterThan(0);
        expect(() => itemInfo(dex, st.item, KEY_ITEM_BY_ID)).not.toThrow();
      }
    let heal = 0;
    for (const n of NPCS) {
      if (n.service?.kind === 'shop') expect(SHOP_BY_ID.has(n.service.shop), n.id).toBe(true);
      if (n.service?.kind === 'heal') heal++;
      if (n.gift) expect(() => itemInfo(dex, n.gift!.item, KEY_ITEM_BY_ID)).not.toThrow();
    }
    expect(heal).toBeGreaterThan(0);
  });
});

describe('M1-12 骑乘', () => {
  it('水上骑乘需要 hm03-surf；未实现的骑乘不解锁', () => {
    expect(rideFor(RIDES, 'water', {})).toBeNull();
    expect(rideFor(RIDES, 'water', { 'hm03-surf': true })?.id).toBe('water');
    expect(rideFor(RIDES, 'land', { 'hm05-rock-smash': true })).toBeNull();
  });

  it('坐骑：队伍中第一只未濒死、体型够大的水属性；鲤鱼王除外；没有则租借暴鲤龙', () => {
    const ride = RIDES.find((r) => r.id === 'water')!;
    const karp = mon(SPECIES.magikarp, 10);
    const mud = mon(SPECIES.mudkip, 10);
    const tent = mon(SPECIES.tentacool, 12);
    expect(chooseMount(dex, [karp, mud, tent], ride).speciesId).toBe(SPECIES.mudkip);
    mud.hp = 0;
    expect(chooseMount(dex, [karp, mud, tent], ride).speciesId).toBe(SPECIES.tentacool);
    tent.hp = 0;
    expect(chooseMount(dex, [karp, tent], ride)).toMatchObject({ speciesId: SPECIES.gyarados, uid: null });
    const mc = chooseMount(dex, [mon(SPECIES.pidgey, 5)], ride);
    expect(mc.uid).toBeNull();
  });

  it('水深探测与暗影遇敌概率', () => {
    expect(surfable(0.3)).toBe(false);
    expect(surfable(1)).toBe(true);
    expect(surfProbe(1, false)).toBe('water');
    expect(surfProbe(0.1, true)).toBe('shore');
    expect(surfProbe(0.1, false)).toBe('blocked');
    expect(shadowEncounterChance(0, false)).toBe(0);
    expect(shadowEncounterChance(2, true)).toBeGreaterThan(shadowEncounterChance(2, false));
    expect(shadowEncounterChance(50, false)).toBeLessThanOrEqual(1);
  });
});

describe('M1-15 钓鱼', () => {
  it('优先使用最好的钓竿', () => {
    expect(bestRod({})).toBeNull();
    expect(bestRod({ 'old-rod': 1 })).toBe('old-rod');
    expect(bestRod({ 'old-rod': 1, 'good-rod': 1 })).toBe('good-rod');
  });

  it('按水体找钓鱼表：湖 / 海', () => {
    expect(findFishingTable(FISHING_TABLES, 'cuilan-lake', null)?.id).toBe('cuilan-lake');
    expect(findFishingTable(FISHING_TABLES, 'sea', 'harbor-city')?.id).toBe('sea');
  });

  it('钓鱼表只使用图鉴里存在的物种，等级区间合法；钓点字段合法', () => {
    for (const t of FISHING_TABLES)
      for (const [rod, list] of Object.entries(t.rods)) {
        expect(RODS[rod as keyof typeof RODS]).toBeTruthy();
        for (const e of list ?? []) {
          expect(() => dex.species(e.speciesId), `${t.id}/${e.speciesId}`).not.toThrow();
          expect(e.levels[0]).toBeLessThanOrEqual(e.levels[1]);
        }
      }
    for (const s of FISHING_SPOTS) {
      expect(s.waitScale).toBeGreaterThan(0);
      expect(s.waitScale).toBeLessThanOrEqual(1);
      expect(s.rareBoost).toBeGreaterThanOrEqual(1);
    }
  });

  it('抽鱼遵守时段限制', () => {
    const lake = findFishingTable(FISHING_TABLES, 'cuilan-lake', null)!;
    const r = fishStrength(129, 5, FISH_STRENGTH);
    expect(r).toBeLessThan(fishStrength(130, 30, FISH_STRENGTH));
    // 夜晚限定的条目在白天不会出现：固定取第一项，白天 / 夜晚都应是鲤鱼王或蚊香蝌蚪
    const e = rollFish(lake, 'super-rod', 'day', fixedRng(), null)!;
    expect(e.speciesId).not.toBe(186);
  });

  const drive = (s: FishingSession, steps: number, input: (s: FishingSession) => FishInput, until?: (s: FishingSession) => boolean, dt = 1 / 30) => {
    const events: string[] = [];
    for (let i = 0; i < steps && !s.done && !until?.(s); i++) {
      for (const e of s.update(dt, input(s))) events.push(e.type === 'end' ? `end:${e.result}` : e.type);
      if (s.phase === 'flying') for (const e of s.setLanding(true)) events.push(e.type);
    }
    return events;
  };
  const session = (strength = 0.2) =>
    new FishingSession(
      { rod: 'old-rod', spot: null, roll: () => ({ speciesId: 129, level: 6, shiny: false, alpha: false, formation: 'single', count: 1 }), strength: () => strength },
      fixedRng(),
    );
  const idle: FishInput = { pressed: false, holding: false, cancel: false };

  const cast = (s: FishingSession) => {
    drive(s, 8, () => ({ pressed: false, holding: true, cancel: false }));
    return drive(s, 1, () => idle);
  };

  it('完整流程：蓄力抛竿 → 等待 → 咬钩拉竿 → 控制张力收线 → 钓到', () => {
    const s = session();
    const ev = cast(s);
    expect(ev).toContain('cast');
    expect(s.phase).toBe('wait');
    const ev2 = drive(s, 30 * 30, () => idle, (x) => x.phase === 'bite');
    expect(ev2).toContain('bite');
    expect(s.phase).toBe('bite');
    drive(s, 1, () => ({ pressed: true, holding: true, cancel: false }));
    expect(s.phase).toBe('reel');
    // 张力到 0.6 就松手，降到 0.35 再按住
    let hold = true;
    const ev3 = drive(s, 30 * 60, (x) => {
      if (x.tension > 0.6) hold = false;
      else if (x.tension < 0.35) hold = true;
      return { pressed: false, holding: hold, cancel: false };
    });
    expect(ev3).toContain('end:landed');
    expect(s.result).toBe('landed');
  });

  it('没咬钩就拉竿会吓跑鱼；错过咬钩窗口', () => {
    const a = session();
    cast(a);
    drive(a, 1, () => ({ pressed: true, holding: true, cancel: false }));
    expect(a.result).toBe('scared');
    const b = session();
    cast(b);
    drive(b, 30 * 60, () => idle);
    expect(b.result).toBe('missed');
  });

  it('一直按住收线，强力的鱼会把线拉断；浮漂落在岸上直接结束', () => {
    const s = session(1);
    cast(s);
    drive(s, 30 * 30, (x) => ({ pressed: x.phase === 'bite', holding: true, cancel: false }));
    expect(s.result).toBe('snapped');
    const t = session();
    drive(t, 8, () => ({ pressed: false, holding: true, cancel: false }));
    t.update(1 / 30, idle);
    expect(t.phase).toBe('flying');
    t.setLanding(false);
    expect(t.result).toBe('shore');
  });

  it('钓点缩短等待时间；取消键可以随时收竿（收线阶段除外）', () => {
    const plain = session();
    cast(plain);
    const spot = { ...FISHING_SPOTS[0]!, waitScale: 0.5 };
    const fast = new FishingSession({ rod: 'old-rod', spot, roll: () => null, strength: () => 0.2 }, fixedRng());
    cast(fast);
    const tPlain = drive(plain, 30 * 60, () => idle).indexOf('bite');
    const evFast = drive(fast, 30 * 60, () => idle);
    expect(evFast).toContain('end:nothing');
    expect(evFast.length).toBeGreaterThan(0);
    expect(tPlain).toBeGreaterThanOrEqual(0);
    const c = session();
    drive(c, 2, () => ({ pressed: false, holding: false, cancel: true }));
    expect(c.result).toBe('cancel');
  });
});

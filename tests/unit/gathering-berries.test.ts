import { describe, expect, it } from 'vitest';
import { BERRIES, BERRY_BY_ID, BERRY_ITEMS, FLAVORS, mainFlavor } from '@/config/berries';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { ITEM_PRICES } from '@/config/shops';
import { GATHER_POINTS } from '@/config/gather';
import { SPROUT } from '@/config/islands/sprout';
import { applyToPokemon, itemInfo } from '@/systems/items';
import { createNewGame, deserializeSave, serializeSave } from '@/systems/state';
import { createRng, sequenceRng } from '@/systems/rng';
import {
  availability,
  daysUntilReady,
  gather,
  gatherState,
  honeyStatus,
  HONEY_TABLE,
  HONEY_WAIT_MINUTES,
  isLowTide,
  regrowDays,
  rollGather,
  slatherHoney,
  sniffPickup,
  type GatherContext,
  type GatherPointDef,
} from '@/systems/gathering';
import { battle, dex, mon, SPECIES } from './helpers';
import { maxHp } from '@/systems/pokemon/Pokemon';

const newGame = () => createNewGame({ name: '小翠', gender: 'boy', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });
const ctx = (o: Partial<GatherContext> = {}): GatherContext => ({ day: 5, hour: 12, weather: 'clear', flags: {}, followerTypes: [], ...o });
const tree: GatherPointDef = { id: 't-1', kind: 'berryTree', position: [0, 0], zone: 'sprout-meadow', berry: 'oran-berry' };

describe('计划文档 §9.1 树果', () => {
  it('24 种树果：id 唯一、5 维风味、产量与生长时间合法', () => {
    expect(BERRIES.length).toBe(24);
    expect(new Set(BERRIES.map((b) => b.id)).size).toBe(24);
    for (const b of BERRIES) {
      expect(b.id.endsWith('-berry')).toBe(true);
      for (const f of FLAVORS) expect(b.flavor[f]).toBeGreaterThanOrEqual(0);
      expect(b.yield[0]).toBeGreaterThanOrEqual(1);
      expect(b.yield[1]).toBeGreaterThanOrEqual(b.yield[0]);
      expect(b.growHours).toBeGreaterThanOrEqual(8);
      expect(b.growHours).toBeLessThanOrEqual(48);
    }
    const cats = BERRIES.reduce<Record<string, number>>((a, b) => ((a[b.category] = (a[b.category] ?? 0) + 1), a), {});
    expect(cats).toEqual({ heal: 3, status: 6, ev: 6, resist: 6, flavor: 3 });
    expect(mainFlavor(BERRY_BY_ID.get('figy-berry')!)).toBe('spicy');
  });

  it('新树果登记到「树果」口袋，有价格可以买卖', () => {
    expect(BERRY_ITEMS.length).toBe(21);
    for (const b of BERRIES) {
      expect(itemInfo(dex, b.id, KEY_ITEM_BY_ID).pocket).toBe('berries');
      expect(itemInfo(dex, b.id, KEY_ITEM_BY_ID).holdable).toBe(true);
      expect(ITEM_PRICES[b.id], b.id).toBeGreaterThan(0);
    }
    expect(itemInfo(dex, 'cheri-berry', KEY_ITEM_BY_ID).name).toBe('樱子果');
  });

  it('野外使用：樱子果治麻痹、苹野果回复 PP、降努力值树果降 10 点并提升亲密度', () => {
    const p = mon(SPECIES.pikachu, 20);
    p.status = { kind: 'par' };
    expect(applyToPokemon(dex, 'chesto-berry', p, KEY_ITEM_BY_ID, { timeOfDay: 'day' }).ok).toBe(false);
    expect(applyToPokemon(dex, 'cheri-berry', p, KEY_ITEM_BY_ID, { timeOfDay: 'day' }).ok).toBe(true);
    expect(p.status).toBeNull();

    p.moves[0]!.pp = 0;
    const r = applyToPokemon(dex, 'leppa-berry', p, KEY_ITEM_BY_ID, { timeOfDay: 'day' });
    expect(r.ok).toBe(true);
    expect(p.moves[0]!.pp).toBe(Math.min(10, p.moves[0]!.maxPp));

    p.evs.atk = 25;
    p.friendship = 70;
    expect(applyToPokemon(dex, 'kelpsy-berry', p, KEY_ITEM_BY_ID, { timeOfDay: 'day' }).ok).toBe(true);
    expect(p.evs.atk).toBe(15);
    expect(p.friendship).toBe(80);
    p.evs.atk = 0;
    p.friendship = 255;
    expect(applyToPokemon(dex, 'kelpsy-berry', p, KEY_ITEM_BY_ID, { timeOfDay: 'day' }).ok).toBe(false);
  });

  it('战斗：半减树果抵挡一次效果绝佳的伤害并消耗', () => {
    const run = (item: string | null) => {
      const target = mon(SPECIES.pidgey, 20, { moves: ['splash'] });
      target.heldItem = item;
      const b = battle([mon(SPECIES.pikachu, 30, { moves: ['thunder-shock'] })], [target], {}, 99);
      const evs = b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
      return { lost: maxHp(dex, target) - target.hp, ate: evs.some((e) => e.type === 'item' && e.item === 'wacan-berry'), used: b.active(1).itemUsed };
    };
    const plain = run(null);
    const berry = run('wacan-berry');
    expect(berry.ate).toBe(true);
    expect(berry.used).toBe(true);
    expect(berry.lost).toBeLessThan(plain.lost);
  });

  it('战斗：桃桃果在中毒时自动食用', () => {
    const target = mon(SPECIES.pidgey, 20, { moves: ['splash'] });
    target.heldItem = 'pecha-berry';
    const b = battle([mon(SPECIES.oddish, 30, { moves: ['poison-powder'] })], [target], {}, 5);
    for (let i = 0; i < 4 && !b.active(1).itemUsed; i++) b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(b.active(1).itemUsed).toBe(true);
    expect(target.status).toBeNull();
  });
});

describe('计划文档 §9.2 野外采集', () => {
  it('采集点：id 唯一、都在岛上对应区域内，每个野区 4–10 棵树果树', () => {
    const ids = GATHER_POINTS.map((p) => p.def.id);
    expect(new Set(ids).size).toBe(ids.length);
    const zones = new Map(SPROUT.zones.map((z) => [z.id, z]));
    const inPoly = (x: number, z: number, P: number[][]) => {
      let c = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, zi] = P[i] as [number, number];
        const [xj, zj] = P[j] as [number, number];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
      }
      return c;
    };
    const trees = new Map<string, number>();
    for (const { def } of GATHER_POINTS) {
      const zone = zones.get(def.zone);
      expect(zone, def.id).toBeTruthy();
      expect(inPoly(def.position[0], def.position[1], zone!.polygon as number[][]), def.id).toBe(true);
      if (def.kind === 'berryTree') {
        expect(BERRY_BY_ID.has(def.berry ?? ''), def.id).toBe(true);
        trees.set(def.zone, (trees.get(def.zone) ?? 0) + 1);
      }
    }
    for (const [z, n] of trees) expect(n, z).toBeGreaterThanOrEqual(4);
    expect(trees.size).toBe(9);
    const kinds = new Set(GATHER_POINTS.map((p) => p.def.kind));
    expect([...kinds].sort()).toEqual(['berryTree', 'herb', 'honey', 'mushroom', 'ore', 'shell']);
  });

  it('树果树：摘完后 1–3 天重新结果，同一天结果稳定', () => {
    const s = newGame();
    const r = gather(s, tree, ctx(), createRng(1));
    expect(r.ok).toBe(true);
    expect(s.bag['oran-berry']).toBeGreaterThanOrEqual(1);
    expect(s.bag['oran-berry']).toBeLessThanOrEqual(4);
    const rec = gatherState(s).points['t-1']!;
    expect(rec.regrow).toBe(regrowDays('t-1', 5));
    expect(rec.regrow).toBeGreaterThanOrEqual(1);
    expect(rec.regrow).toBeLessThanOrEqual(3);
    expect(gather(s, tree, ctx(), createRng(1)).ok).toBe(false);
    expect(daysUntilReady(tree, rec, 5 + rec.regrow!)).toBe(0);
    expect(availability(tree, rec, ctx({ day: 5 + rec.regrow! })).ok).toBe(true);
  });

  it('贝壳只在退潮露出；矿点需要碎岩；异奇果只在夜里成熟', () => {
    const shell: GatherPointDef = { id: 's', kind: 'shell', position: [0, 0], zone: 'west-beach' };
    expect(isLowTide(6)).toBe(true);
    expect(isLowTide(12)).toBe(false);
    expect(availability(shell, undefined, ctx({ hour: 12 }))).toMatchObject({ ok: false, reason: 'tide' });
    expect(availability(shell, undefined, ctx({ hour: 18 })).ok).toBe(true);
    const ore: GatherPointDef = { id: 'o', kind: 'ore', position: [0, 0], zone: 'harbor-cliffs' };
    expect(availability(ore, undefined, ctx())).toMatchObject({ ok: false, reason: 'tool' });
    expect(availability(ore, undefined, ctx({ flags: { 'hm05-rock-smash': true } })).ok).toBe(true);
    expect(availability(ore, { day: 5 }, ctx({ day: 6, flags: { 'hm05-rock-smash': true } })).ok).toBe(false);
    expect(availability(ore, { day: 5 }, ctx({ day: 7, flags: { 'hm05-rock-smash': true } })).ok).toBe(true);
    const wiki: GatherPointDef = { ...tree, id: 'w', berry: 'wiki-berry' };
    expect(availability(wiki, undefined, ctx({ hour: 12 }))).toMatchObject({ ok: false, reason: 'night' });
    expect(availability(wiki, undefined, ctx({ hour: 22 })).ok).toBe(true);
  });

  it('跟随宝可梦协助：草系采草药 +1，岩石 / 格斗系采矿 +1；蘑菇夜晚 / 雾天翻倍', () => {
    const herb: GatherPointDef = { id: 'h', kind: 'herb', position: [0, 0], zone: 'sprout-meadow' };
    const fixed = () => sequenceRng([0.5, 0.9, 0.9, 0.9, 0.9, 0.9]);
    const a = rollGather(herb, ctx(), fixed());
    const b = rollGather(herb, ctx({ followerTypes: ['grass'] }), fixed());
    const qty = (r: typeof a, id: string) => r.items.find((i) => i.id === id)?.qty ?? 0;
    expect(b.assist).toBe(1);
    expect(qty(b, 'medicinal-herb')).toBe(qty(a, 'medicinal-herb') + 1);
    const ore: GatherPointDef = { id: 'o', kind: 'ore', position: [0, 0], zone: 'harbor-cliffs' };
    expect(rollGather(ore, ctx({ followerTypes: ['fighting'] }), fixed()).assist).toBe(1);
    const mush: GatherPointDef = { id: 'm', kind: 'mushroom', position: [0, 0], zone: 'phantom-forest' };
    const day = rollGather(mush, ctx(), fixed());
    const fog = rollGather(mush, ctx({ weather: 'fog' }), fixed());
    expect(fog.doubled).toBe(true);
    expect(qty(fog, 'tiny-mushroom')).toBe(qty(day, 'tiny-mushroom') * 2);
    const night = rollGather(mush, ctx({ hour: 23 }), sequenceRng([0.5, 0.9, 0.1]));
    expect(qty(night, 'glow-mushroom')).toBeGreaterThan(0);
  });

  it('蜂蜜树：涂蜜消耗甜甜蜜，6 小时后吸引宝可梦；表内物种都有模型来源', () => {
    const s = newGame();
    const honey: GatherPointDef = { id: 'hn', kind: 'honey', position: [0, 0], zone: 'sprout-woodland' };
    expect(slatherHoney(s, honey, 100)).toBe(false);
    s.bag['honey'] = 1;
    expect(slatherHoney(s, honey, 100)).toBe(true);
    expect(s.bag['honey']).toBeUndefined();
    expect(honeyStatus(s, honey, 100 + HONEY_WAIT_MINUTES - 1).state).toBe('waiting');
    expect(honeyStatus(s, honey, 100 + HONEY_WAIT_MINUTES).state).toBe('ready');
    for (const slot of HONEY_TABLE) expect(dex.species(slot.speciesId)).toBeTruthy();
  });

  it('嗅觉好的跟随宝可梦每天捡一次道具', () => {
    const s = newGame();
    expect(sniffPickup(s, 25, 3, createRng(2))).toBeNull();
    const id = sniffPickup(s, 263, 3, createRng(2));
    expect(id).toBeTruthy();
    expect(s.bag[id!]).toBe(1);
    expect(sniffPickup(s, 263, 3, createRng(3))).toBeNull();
    expect(sniffPickup(s, 263, 4, createRng(3))).toBeTruthy();
  });

  it('存档：采集记录随存档保存，损坏时重置', () => {
    const s = newGame();
    gather(s, tree, ctx(), createRng(1));
    const back = deserializeSave(serializeSave(s)).state;
    expect(back.gather?.points['t-1']?.day).toBe(5);
    const broken = JSON.parse(serializeSave(s));
    broken.data.gather = 'x';
    const fixed = deserializeSave(JSON.stringify(broken));
    expect(fixed.state.gather).toEqual({ points: {}, honey: {} });
    expect(fixed.repairs.length).toBeGreaterThan(0);
  });
});

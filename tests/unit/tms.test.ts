import { THUNDER } from '@/config/islands/thunder';
import { GLAZE } from '@/config/islands/glaze';
import { describe, expect, it } from 'vitest';
import compat from '@/config/tms/compat.json';
import { TM_BY_DEN, TM_DEFS, tmItemId } from '@/config/tms';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { ITEM_PRICES, SHOP_BY_ID } from '@/config/shops';
import { SPROUT } from '@/config/islands/sprout';
import { STORY_PICKUPS, STORY_SCRIPTS } from '@/config/story';
import { NPC_BY_ID } from '@/config/npcs';
import { INTERIORS } from '@/config/interiors';
import { QUEST_REGISTRY } from '@/config/quests';
import { computeTmCompat, evolutionFamily, HEART_SCALE, recallableMoves, recallPayments, RECALL_PRICE } from '@/systems/tms';
import { tmCompatible } from '@/systems/items';
import { denReward, ALPHA_MATERIAL } from '@/systems/alpha';
import { dex, mon, rng } from './helpers';

describe('招式学习器表（计划文档 §6）', () => {
  it('编号 / 招式唯一，招式都存在，道具已注册', () => {
    expect(new Set(TM_DEFS.map((t) => t.no)).size).toBe(TM_DEFS.length);
    expect(new Set(TM_DEFS.map((t) => t.move)).size).toBe(TM_DEFS.length);
    for (const t of TM_DEFS) {
      expect(dex.hasMove(t.move), t.move).toBe(true);
      const item = KEY_ITEM_BY_ID.get(tmItemId(t.move));
      expect(item?.pocket).toBe('tms');
      expect(item?.move).toBe(t.move);
      expect(item?.name).toContain(dex.move(t.move).name.zh);
    }
  });

  it('compat.json 与规则一致（改了 TM 表或物种数据请运行 pnpm gen:tms）', () => {
    const table = compat as Record<string, number[]>;
    expect(Object.keys(table).sort()).toEqual(TM_DEFS.map((t) => tmItemId(t.move)).sort());
    for (const t of TM_DEFS) expect(table[tmItemId(t.move)], t.move).toEqual(computeTmCompat(dex.allSpecies(), dex.move(t.move).type, t));
  });

  it('通用招式全部可学；进化家族共享兼容', () => {
    const all = dex.allSpecies().length;
    for (const t of TM_DEFS.filter((x) => x.universal)) expect((compat as Record<string, number[]>)[tmItemId(t.move)]!.length).toBe(all);
    // 学招表带来的兼容在整个进化家族内一致
    for (const t of TM_DEFS) {
      const ids = new Set((compat as Record<string, number[]>)[tmItemId(t.move)]);
      for (const sp of dex.allSpecies()) {
        if (!sp.learnset.some((e) => e.move === t.move)) continue;
        for (const f of evolutionFamily(dex.allSpecies(), sp.id)) expect(ids.has(f.id), `${t.move} ${f.id}`).toBe(true);
      }
    }
    expect(tmCompatible(dex, mon(258, 10), 'water-pulse')).toBe(true);
    expect(tmCompatible(dex, mon(155, 10), 'water-pulse')).toBe(false);
    expect(tmCompatible(dex, mon(155, 10), 'protect')).toBe(true);
  });

  it('获取途径都能落地：商店上架 + 定价、道馆奖励、巢穴存在、野外拾取点与脚本', () => {
    const shop = SHOP_BY_ID.get('harbor-tms')!;
    const dens = new Set([SPROUT, THUNDER, GLAZE].flatMap((i) => i.alphaDens ?? []).map((d) => d.id));
    const rewards = QUEST_REGISTRY.all.flatMap((q) => q.reward?.items?.map((i) => i.id) ?? []);
    for (const t of TM_DEFS) {
      const id = tmItemId(t.move);
      const s = t.source;
      if (s.kind === 'shop') {
        expect(shop.stock.find((x) => x.item === id)?.once, id).toBe(true);
        expect(ITEM_PRICES[id]).toBe(s.price);
      } else if (s.kind === 'gym') expect(rewards).toContain(id);
      else if (s.kind === 'quest') expect(QUEST_REGISTRY.get(s.quest)?.reward?.items?.some((i) => i.id === id), id).toBe(true);
      else if (s.kind === 'den') {
        expect(dens.has(s.den), s.den).toBe(true);
        expect(TM_BY_DEN.get(s.den)?.move).toBe(t.move);
      } else {
        const pk = STORY_PICKUPS.find((p) => p.id === s.pickup);
        expect(pk?.model).toBe('tm-disc');
        expect(STORY_SCRIPTS.get(s.pickup)?.steps.some((st) => st.kind === 'item' && st.id === id)).toBe(true);
      }
    }
    expect(dens.size).toBe([...TM_BY_DEN.keys()].length);
  });

  it('巢穴首次奖励含该巢穴的学习器与心之鳞片', () => {
    const r = denReward(16, undefined, rng(1), 'tm-shadow-ball');
    expect(r.items).toMatchObject({ [ALPHA_MATERIAL]: 3, [HEART_SCALE]: 1, 'tm-shadow-ball': 1 });
  });
});

describe('想起招式', () => {
  it('只列出等级以内、未学会、数据里存在的招式；含进化前形态', () => {
    const p = mon(11, 12); // 铁甲蛹，进化前是绿毛虫
    const list = recallableMoves(dex, p);
    const known = new Set(p.moves.map((m) => m.id));
    const own = new Set(dex.species(11).learnset.map((e) => e.move));
    for (const e of list) {
      expect(e.level).toBeLessThanOrEqual(12);
      expect(known.has(e.move)).toBe(false);
      expect(dex.hasMove(e.move)).toBe(true);
      expect(e.fromPrevo).toBe(!own.has(e.move));
    }
    const prevoMoves = dex.species(10).learnset.filter((e) => e.level <= 12 && !known.has(e.move) && !own.has(e.move)).map((e) => e.move);
    for (const m of prevoMoves) expect(list.some((e) => e.move === m && e.fromPrevo)).toBe(true);
  });

  it('高于当前等级的招式不出现', () => {
    const sp = dex.species(258);
    const p = mon(258, 5);
    const maxLv = Math.max(...sp.learnset.map((e) => e.level));
    for (const e of recallableMoves(dex, p)) expect(e.level).toBeLessThanOrEqual(5);
    expect(maxLv).toBeGreaterThan(5);
  });

  it('支付方式：心之鳞片优先，其次 1000 円', () => {
    expect(recallPayments({ [HEART_SCALE]: 1 }, 5000)).toEqual(['scale', 'money']);
    expect(recallPayments({}, RECALL_PRICE)).toEqual(['money']);
    expect(recallPayments({}, RECALL_PRICE - 1)).toEqual([]);
  });

  it('想起招式的人：翠澜镇宝可梦中心 + 港湾大市场', () => {
    for (const id of ['move-reminder', 'move-reminder-harbor']) {
      expect(NPC_BY_ID.get(id)?.service).toEqual({ kind: 'recall' });
      expect(Object.values(INTERIORS).some((it) => it.rooms.some((r) => r.npcs?.some((n) => n.id === id))), id).toBe(true);
    }
    expect(KEY_ITEM_BY_ID.get(HEART_SCALE)?.pocket).toBe('treasure');
  });
});

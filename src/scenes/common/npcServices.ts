/**
 * M1-19 / M1-15 · NPC 服务：宝可梦中心回复、商店、赠礼。由 npcTalk 在对话后调用。
 *
 * 回复流程（护士乔伊）：询问 → 「请把宝可梦交给我」→ 收回跟随宝可梦、精灵球逐个放进恢复机（每个一声「嘀」）
 * → 回复音乐 → 全队回复（HP / PP / 异常）→ 鞠躬 →「期待你再次光临」。事件 center:heal（场景据此播放恢复机演出）、party:healed。
 */
import type { Game } from '@/core/Game';
import { HealMachineFx } from './HealMachineFx';
import type { Npc } from '@/actors/npc';
import type { Dex } from '@/systems/data/Dex';
import type { GameState } from '@/systems/state/GameState';
import type { NpcGift } from '@/systems/npcs';
import { addItem, addMoney, removeItem } from '@/systems/state';
import { HEART_SCALE, RECALL_PRICE, recallableMoves, recallPayments } from '@/systems/tms';
import { displayName } from '@/systems/pokemon';
import { TYPE_NAMES_ZH } from '@/ui/battle';
import { learnMoveFlow, pickPokemon } from '@/ui/menu/flows';
import { healFully, IV_GRADE_ZH, STAT_IDS, ivGrade, ivOverall, maxHp } from '@/systems/pokemon';
import { itemInfo, type ItemInfo } from '@/systems/items';
import { buy, buyPrice, isOnceItem, maxAffordable, sell, sellPrice, shopInventory } from '@/systems/shop';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { ITEM_PRICES, SHOP_BY_ID } from '@/config/shops';
import { POCKETS } from '@/systems/items';
import { choose, say, type UiRoot } from '@/ui/core';
import { ShopScreen, type ShopHost, type ShopLine } from '@/ui/shop/ShopScreen';
import { jingle, sfx } from '@/core/audio';
import type { BaseStatId } from '@/systems/data/types';
import {
  BREEDER_MAX_LEVEL,
  BREEDER_TITLE,
  BREEDER_UNLOCKS,
  DAYCARE_SLOTS,
  actXp,
  breederBadges,
  breederLevel,
  breederState,
  daycareUnlocked,
  depositDaycare,
  gainBreederXp,
  previewDaycare,
  withdrawDaycare,
  xpToNext,
} from '@/systems/breeder';
import { canCraft, craft, inputHave, type Recipe } from '@/systems/breeder/workshop';
import { RECIPES } from '@/config/workshop';
import { MINT_ITEMS } from '@/config/items';
import { monIconHtml } from '@/ui/menu/common';

export interface NpcServiceDeps {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  toast?: ((text: string) => void) | undefined;
}

export interface NpcServices {
  heal(npc: Npc): Promise<void>;
  shop(npc: Npc, shopId: string): Promise<void>;
  gift(npc: Npc, gift: NpcGift): Promise<void>;
  /** 想起招式（计划文档 §6） */
  recall(npc: Npc): Promise<void>;
  /** 培育家菜单（计划文档 §9.4，蒲婆婆） */
  breeder(npc: Npc): Promise<void>;
  /** 工坊合成（计划文档 §9.5，阿铁） */
  workshop(npc: Npc): Promise<void>;
  /** 调试：当前打开的商店界面 */
  readonly shopScreen: ShopScreen | null;
}

const pocketName = (p: string) => POCKETS.find((x) => x.id === p)?.name ?? '';

export function createNpcServices(d: NpcServiceDeps): NpcServices {
  let shopScreen: ShopScreen | null = null;
  const info = (id: string): ItemInfo => itemInfo(d.dex, id, KEY_ITEM_BY_ID);
  const speaker = (npc: Npc) => ({ speaker: npc.def.name });

  const daycare = async (npc: Npc, STAT_ZH: Record<BaseStatId, string>): Promise<void> => {
    const { state, dex, ui } = d;
    const now = d.game.clock.totalMinutes;
    const b = breederState(state);
    const opts: { label: string; value: string; sub?: string; icon?: string | undefined; disabled?: boolean }[] = b.daycare.map((s, i) => {
      const pv = previewDaycare(dex, s, now);
      return {
        label: `领回 ${displayName(dex, s.mon)}`,
        value: `w${i}`,
        icon: monIconHtml(s.mon.speciesId, s.mon.shiny) ?? undefined,
        sub: `Lv.${s.level0} → Lv.${pv.mon.level}${s.focus ? ` · ${STAT_ZH[s.focus]}努力值 +${pv.evs}` : ''} · 费用 ${pv.fee} 円`,
      };
    });
    if (b.daycare.length < DAYCARE_SLOTS) opts.push({ label: '寄放宝可梦', value: 'dep', sub: '按游戏时间获得经验；可以指定训练方向' });
    opts.push({ label: '算了', value: 'no' });
    await say(ui, b.daycare.length ? '你寄放的宝可梦在后院精神着呢。' : '要把宝可梦交给婆婆照看吗？', speaker(npc));
    const pick = await choose(ui, opts, { cancellable: true });
    if (!pick || pick === 'no') return;
    if (pick === 'dep') {
      const idx = await pickPokemon(ui, dex, state.party, (p) => (state.party.filter((x) => x !== p && x.hp > 0).length ? null : '队伍里至少要留一只'));
      if (idx === null) return;
      const focus = await choose<BaseStatId | 'none'>(
        ui,
        [{ label: '随它自由活动', value: 'none' as const }, ...STAT_IDS.map((k) => ({ label: `重点练${STAT_ZH[k]}`, value: k, sub: `每 ${6} 分钟${STAT_ZH[k]}努力值 +1` }))],
        { cancellable: true },
      );
      if (!focus) return;
      const p = state.party[idx]!;
      if (!depositDaycare(state, idx, now, focus === 'none' ? null : focus)) return say(ui, '现在不能寄放。', speaker(npc));
      d.game.events.emit('party:changed', { source: 'daycare' });
      await say(ui, [`好，${displayName(dex, p)}就交给婆婆了。`, '过些时候再来领吧，它会长进不少的。'], speaker(npc));
      return;
    }
    const i = Number(pick.slice(1));
    const slot = b.daycare[i];
    if (!slot) return;
    const pv = previewDaycare(dex, slot, now);
    if (state.party.length >= 6) return say(ui, '你的队伍已经满了，先在电脑里存一只吧。', speaker(npc));
    if (state.money < pv.fee) return say(ui, `照看费是 ${pv.fee} 円……你的钱好像不够呢。`, speaker(npc));
    const ok = await choose(ui, [
      { label: `付 ${pv.fee} 円领回`, value: true },
      { label: '再寄放一会儿', value: false },
    ], { cancellable: true });
    if (!ok) return;
    const r = withdrawDaycare(dex, state, i, now);
    if (!r) return;
    d.game.events.emit('party:changed', { source: 'daycare' });
    const lines = [`${displayName(dex, r.mon)}回来了！`];
    if (r.levels > 0) lines.push(`升了 ${r.levels} 级，现在是 Lv.${r.mon.level}。`);
    for (const m of r.learned) lines.push(`学会了「${dex.hasMove(m) ? dex.move(m).name.zh : m}」！`);
    if (r.forgot.length) lines.push(`（为此忘掉了${r.forgot.map((m) => `「${dex.hasMove(m) ? dex.move(m).name.zh : m}」`).join('')}）`);
    if (r.evs > 0) lines.push(`努力值提高了 ${r.evs} 点。`);
    lines.push(`HP ${r.mon.hp}/${maxHp(dex, r.mon)}`);
    await say(ui, lines, speaker(npc));
    gainBreederXp(state, 'daycare', actXp('daycare'));
  };

  return {
    get shopScreen() {
      return shopScreen;
    },

    async heal(npc) {
      const { state } = d;
      if (!state.party.length) {
        await say(d.ui, ['你还没有宝可梦呢。', '等你有了伙伴，随时欢迎来这里！'], speaker(npc));
        return;
      }
      await say(d.ui, '这里可以让你的宝可梦恢复体力。', speaker(npc));
      const pick = await choose(d.ui, [
        { label: '恢复宝可梦', value: 'heal' },
        { label: '不用了', value: 'no' },
      ]);
      if (pick !== 'heal') {
        await say(d.ui, '期待你再次光临！', speaker(npc));
        return;
      }
      await say(d.ui, '好的，请把宝可梦交给我。', speaker(npc));
      const count = state.party.length;
      d.game.events.emit('center:heal', { phase: 'start', count });
      const machine = HealMachineFx.current;
      if (machine) {
        // 完整演出：护士转身 → 球飞入恢复机 → 光柱与跑马灯 → 闪光 → 球飞回
        await machine.play(count, { nurse: npc, onComplete: () => state.party.forEach((p) => healFully(d.dex, p)) });
      } else {
        // 没有恢复机家具（不应发生）：退回计时流程
        for (let i = 0; i < count; i++) {
          d.game.events.emit('center:heal', { phase: 'machine', count: i + 1 });
          sfx('heal-machine');
          await wait(260);
        }
        await jingle('jingle-heal');
      }
      for (const p of state.party) healFully(d.dex, p);
      d.game.events.emit('party:healed', { source: 'pokecenter' });
      d.game.events.emit('center:heal', { phase: 'done', count });
      await say(d.ui, '让你久等了！你的宝可梦已经完全恢复了。', speaker(npc));
      void npc.playGesture('bow', 1.2);
      await say(d.ui, '期待你再次光临！', speaker(npc));
    },

    async shop(npc, shopId) {
      const shop = SHOP_BY_ID.get(shopId);
      if (!shop) {
        console.warn(`[shop] 未知商店 ${shopId}`);
        return;
      }
      const { state } = d;
      const lineOf = (id: string, price: number): ShopLine => {
        const it = info(id);
        return { id, name: it.name, desc: it.desc, price, owned: state.bag[id] ?? 0, tag: pocketName(it.pocket) };
      };
      const host: ShopHost = {
        shopName: shop.name,
        greeting: shop.greeting,
        clerk: npc.def.name,
        canSell: shop.buysBack,
        money: () => state.money,
        buyList: () => shopInventory(shop, state.flags, state.bag).map((id) => lineOf(id, buyPrice(ITEM_PRICES, shop, id) ?? 0)),
        sellList: () =>
          Object.keys(state.bag)
            .filter((id) => (state.bag[id] ?? 0) > 0)
            .map((id) => ({ id, price: sellPrice(ITEM_PRICES, id, info(id).tossable) }))
            .filter((x): x is { id: string; price: number } => x.price !== null)
            .sort((a, b) => info(a.id).pocket.localeCompare(info(b.id).pocket) || a.id.localeCompare(b.id))
            .map((x) => lineOf(x.id, x.price)),
        maxBuy: (id) => Math.min(isOnceItem(shop, id) ? 1 : 99, maxAffordable(state, buyPrice(ITEM_PRICES, shop, id) ?? 0, id)),
        buy: (id, qty) => {
          const r = buy(state, ITEM_PRICES, shop, id, qty);
          if (!r.ok) return { ok: false, message: r.reason === 'money' ? '您的钱好像不够……' : r.reason === 'bag' ? '背包里已经放不下了。' : '这个现在买不了。' };
          d.game.events.emit('shop:trade', { shop: shop.id, kind: 'buy', item: id, qty, money: state.money });
          const res: { ok: boolean; message: string; bonus?: string } = { ok: true, message: '谢谢惠顾！' };
          if (r.bonus > 0) res.bonus = `买得多，送您 ${r.bonus} 个${info(id).name}作为谢礼！`;
          return res;
        },
        sell: (id, qty) => {
          const r = sell(state, ITEM_PRICES, id, qty, info(id).tossable);
          if (!r.ok) return { ok: false, message: '这个我们不收。' };
          d.game.events.emit('shop:trade', { shop: shop.id, kind: 'sell', item: id, qty, money: state.money });
          return { ok: true, message: `交易成功，这是 ¥${r.earned}。` };
        },
      };
      shopScreen = d.ui.push(new ShopScreen(d.ui, host));
      await shopScreen.done;
      shopScreen = null;
      await say(d.ui, '欢迎下次光临！', speaker(npc));
    },

    async recall(npc) {
      const { state, dex, ui } = d;
      const bye = () => say(ui, '随时再来，呵呵。', speaker(npc));
      if (!state.party.length) {
        await say(ui, '你还没有宝可梦呢……等有了伙伴再来吧。', speaker(npc));
        return;
      }
      const pays = recallPayments(state.bag, state.money);
      if (!pays.length) {
        await say(ui, [`想起招式需要 1 片心之鳞片，或者 ${RECALL_PRICE} 円。`, '你现在好像都不够呢。'], speaker(npc));
        return;
      }
      const go = await choose(ui, [
        { label: '请帮我想起招式', value: true },
        { label: '不用了', value: false },
      ]);
      if (!go) return bye();
      await say(ui, '要让哪只宝可梦想起招式？', speaker(npc));
      const idx = await pickPokemon(ui, dex, state.party, (p) => (recallableMoves(dex, p).length ? null : '没有可以想起的招式'));
      if (idx === null) return bye();
      const p = state.party[idx]!;
      const options = recallableMoves(dex, p).map((e) => {
        const m = dex.move(e.move);
        const lv = e.level === 0 ? '进化时' : `Lv.${e.level}`;
        return {
          label: m.name.zh,
          value: e.move,
          sub: `${TYPE_NAMES_ZH[m.type] ?? m.type} · 威力 ${m.category === 'status' || !m.power ? '—' : m.power} · 命中 ${m.accuracy ?? '—'} · PP ${m.pp} · ${lv}${e.fromPrevo ? '（进化前）' : ''}`,
        };
      });
      await say(ui, `${displayName(dex, p)}想起哪个招式呢？`, speaker(npc));
      const move = await choose(ui, options, { cancellable: true, style: { left: '50%', right: 'auto', top: '12%', bottom: 'auto', transform: 'translateX(-50%)', minWidth: '520px' } });
      if (!move) return bye();
      let pay = pays[0]!;
      if (pays.length > 1) {
        const picked = await choose(ui, [
          { label: `用心之鳞片（持有 ${state.bag[HEART_SCALE] ?? 0}）`, value: 'scale' as const },
          { label: `付 ${RECALL_PRICE} 円（持有 ${state.money} 円）`, value: 'money' as const },
        ], { cancellable: true });
        if (!picked) return bye();
        pay = picked;
      }
      const learned = await learnMoveFlow(ui, dex, p, move);
      if (!learned) return bye();
      if (pay === 'scale') removeItem(state, HEART_SCALE, 1);
      else addMoney(state, -RECALL_PRICE);
      d.game.events.emit('party:changed', { source: 'recall' });
      await say(ui, [pay === 'scale' ? '心之鳞片我收下了。' : `${RECALL_PRICE} 円我收下了。`, '好好珍惜这份记忆吧。'], speaker(npc));
    },

    async breeder(npc) {
      const { state, dex, ui } = d;
      const lv0 = breederLevel(state);
      if (lv0 <= 0) return;
      const STAT_ZH: Record<BaseStatId, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
      for (;;) {
        const lv = breederLevel(state);
        const pick = await choose(
          ui,
          [
            { label: '培育家等级', value: 'level', sub: `${lv >= BREEDER_MAX_LEVEL ? BREEDER_TITLE : `${lv} 级培育家`} · 培育章 ${breederBadges(lv)} 枚` },
            { label: '个体值评估', value: 'iv', disabled: lv < 4, sub: lv < 4 ? '培育家 4 级开放' : '看看宝可梦与生俱来的资质' },
            { label: '培育屋', value: 'daycare', disabled: !daycareUnlocked(state), sub: daycareUnlocked(state) ? `寄放中 ${breederState(state).daycare.length}/${DAYCARE_SLOTS}` : '培育家 5 级开放' },
            { label: '没事了', value: 'bye' },
          ],
          { cancellable: true },
        );
        if (!pick || pick === 'bye') {
          await say(ui, '慢走，常来看看婆婆。', speaker(npc));
          return;
        }
        if (pick === 'level') {
          const nx = xpToNext(state);
          const lines = [
            lv >= BREEDER_MAX_LEVEL ? `你已经是「${BREEDER_TITLE}」了！（经验 ${breederState(state).xp}）` : `现在是 ${lv} 级培育家，离 ${lv + 1} 级还差 ${nx ? nx.need - nx.cur : 0} 点经验。`,
            `培育章 ${breederBadges(lv)} 枚（每 3 级一枚）。`,
          ];
          if (lv < BREEDER_MAX_LEVEL) lines.push(`到 ${lv + 1} 级能解锁：${BREEDER_UNLOCKS[lv + 1]}。`);
          lines.push('收获树果、做方块、喂宝可梦、用培育屋、在工坊合成，都能长经验。');
          await say(ui, lines, speaker(npc));
        } else if (pick === 'iv') {
          if (!state.party.length) continue;
          await say(ui, '让婆婆瞧瞧哪只？', speaker(npc));
          const idx = await pickPokemon(ui, dex, state.party);
          if (idx === null) continue;
          const p = state.party[idx]!;
          const best = STAT_IDS.filter((k) => p.ivs[k] === Math.max(...STAT_IDS.map((x) => p.ivs[x])));
          await say(
            ui,
            [
              `嗯……${displayName(dex, p)}整体来说，有着${ivOverall(p.ivs)}。`,
              STAT_IDS.map((k) => `${STAT_ZH[k]}：${IV_GRADE_ZH[ivGrade(p.ivs[k])]}`).join('　'),
              `其中最出色的是${best.map((k) => STAT_ZH[k]).join('、')}。`,
            ],
            speaker(npc),
          );
        } else if (pick === 'daycare') {
          await daycare(npc, STAT_ZH);
        }
      }
    },

    async workshop(npc) {
      const { state, ui } = d;
      const lv = breederLevel(state);
      if (lv <= 0) {
        await say(ui, ['工坊的手艺只教给培育家。', '去萌芽镇找蒲婆婆拜师吧，她点头了我就帮你。'], speaker(npc));
        return;
      }
      const inputText = (r: Recipe) =>
        r.inputs.map((i) => `${i.item ? info(i.item).name : (i.label ?? '任选')} ${inputHave(state, i)}/${i.qty}`).join(' + ');
      for (;;) {
        const pick = await choose(
          ui,
          RECIPES.map((r) => {
            const why = canCraft(state, r, lv);
            return {
              label: r.mint ? '性格薄荷（任选性格）' : `${info(r.out.item).name}${r.out.qty > 1 ? ` ×${r.out.qty}` : ''}`,
              value: r.id,
              disabled: why === 'level',
              sub: why === 'level' ? `培育家 ${r.level} 级解锁` : `${inputText(r)}${why === 'materials' ? ' · 素材不够' : ''}`,
            };
          }),
          { cancellable: true, style: { left: '50%', right: 'auto', top: '8%', bottom: 'auto', transform: 'translateX(-50%)', minWidth: '540px', maxHeight: '76vh', overflowY: 'auto' } },
        );
        if (!pick) {
          await say(ui, '素材攒够了再来！', speaker(npc));
          return;
        }
        const r = RECIPES.find((x) => x.id === pick)!;
        if (canCraft(state, r, lv) === 'materials') {
          await say(ui, `素材还不够：${inputText(r)}。`, speaker(npc));
          continue;
        }
        let outItem: string | undefined;
        if (r.mint) {
          outItem =
            (await choose(
              ui,
              MINT_ITEMS.map((m) => ({ label: m.name, value: m.id, sub: m.desc.replace(/^清香的薄荷叶。/, '') })),
              { cancellable: true, style: { left: '50%', right: 'auto', top: '6%', bottom: 'auto', transform: 'translateX(-50%)', minWidth: '520px', maxHeight: '80vh', overflowY: 'auto' } },
            )) ?? undefined;
          if (!outItem) continue;
        }
        const got = craft(state, r, lv, outItem);
        if (!got) continue;
        sfx('item', 0.8);
        await say(ui, ['叮叮当当……好了！', `${state.player.name}得到了${info(got.item).name}${got.qty > 1 ? ` × ${got.qty}` : ''}！`], speaker(npc));
        gainBreederXp(state, r.mint ? 'mint' : 'craft', actXp(r.mint ? 'mint' : 'craft'));
      }
    },

    async gift(npc, gift) {
      const { state } = d;
      await say(d.ui, gift.lines, speaker(npc));
      addItem(state, gift.item, gift.qty);
      state.flags[gift.flag] = true;
      d.game.events.emit('flag:set', { flag: gift.flag, value: true });
      const it = info(gift.item);
      const key = it.pocket === 'key' || it.pocket === 'tms';
      void jingle(key ? 'jingle-key-item' : 'jingle-item');
      await say(d.ui, `${state.player.name}获得了${it.name}${gift.qty > 1 ? ` × ${gift.qty}` : ''}！`);
      if (key) await say(d.ui, `${state.player.name}把${it.name}放进了背包的「${pocketName(it.pocket)}」口袋。`);
      for (const ex of gift.extra ?? []) {
        addItem(state, ex.item, ex.qty);
        await say(d.ui, `${state.player.name}获得了${info(ex.item).name}${ex.qty > 1 ? ` × ${ex.qty}` : ''}！`);
      }
      if (gift.after?.length) await say(d.ui, gift.after, speaker(npc));
    },
  };
}

/** 该 NPC 这次是否要送礼 */
export function giftDue(gift: NpcGift | undefined, flags: Readonly<Record<string, boolean>>): NpcGift | null {
  if (!gift || flags[gift.flag]) return null;
  if (gift.requires?.some((f) => !flags[f])) return null;
  return gift;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

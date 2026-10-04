/**
 * M1-18 · 背包：口袋分页（←→）、物品列表（↑↓）、底部说明。
 * 确定 → 使用 / 携带 / 丢弃；使用时选择宝可梦（无效的灰掉并注明原因），进化石 / 招式学习器走对应流程。
 */
import type { Input } from '@/core/input';
import { POCKETS, applyToPokemon, giveHeldItem, tmCompatible, itemInfo, pocketItems, tossItem, useFromBag, type ItemUseContext, type Pocket } from '@/systems/items';
import { IV_GRADE_ZH, IV_ITEMS, IV_MAX, STAT_IDS, displayName, ivGrade, ivItemStatUsable, type PokemonInstance } from '@/systems/pokemon';
import type { BaseStatId } from '@/systems/data/types';
import { BLOCK_BOX_CAPACITY, CONDITION_ZH, blockBox, blockName, blockSummary, feedBlock, takeBlock, SHEEN_MAX, conditionOf, type Condition } from '@/systems/blocks';
import { blockIconSvg } from '../../blocks/BlockMachineScreen';
import { actXp, gainBreederXp } from '@/systems/breeder';

const IV_STAT_ZH: Record<BaseStatId, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
import { choose, say } from '../../core';
import { el } from '../../core/styles';
import { evolveFlow, learnMoveFlow, pickPokemon } from '../flows';
import { keepVisible, stepIndex, itemIcon } from '../common';
import type { MenuPage, PageContext } from '../types';

export class BagPage implements MenuPage {
  readonly id = 'bag';
  readonly title = '背包';
  readonly el: HTMLDivElement;
  private tabs: HTMLDivElement;
  private items: HTMLDivElement;
  private desc: HTMLDivElement;
  pocket = 0;
  sel = 0;
  private focused = false;

  constructor(private readonly ctx: PageContext) {
    this.el = el('div', 'cl-page cl-bag');
    this.tabs = el('div', 'pockets', this.el);
    this.items = el('div', 'items', this.el);
    this.desc = el('div', 'desc', this.el);
  }

  private get pocketId(): Pocket {
    return POCKETS[Math.min(this.pocket, POCKETS.length - 1)]!.id;
  }

  /** 计划文档 §9.5：最后一页是「方块盒」（能量方块，单独存放，不在 bag 里） */
  private get isBlocks(): boolean {
    return this.pocket === POCKETS.length;
  }

  private get tabCount(): number {
    return POCKETS.length + 1;
  }

  private list(): { id: string; qty: number }[] {
    if (this.isBlocks) return blockBox(this.ctx.host.state).map((b) => ({ id: b.uid, qty: 1 }));
    const { dex, state, keyItems } = this.ctx.host;
    return pocketItems(dex, state.bag, this.pocketId, keyItems);
  }

  show(): void {
    this.render();
  }

  focus(): void {
    this.focused = true;
    this.render();
  }

  blur(): void {
    this.focused = false;
    this.render();
  }

  hints(): string {
    const k = this.ctx.keyLabel;
    return `<kbd>←→</kbd>切换口袋\u3000<kbd>↑↓</kbd>选择\u3000<kbd>${k('confirm')}</kbd>操作\u3000<kbd>${k('back')}</kbd>返回`;
  }

  handle(input: Input): 'exit' | void {
    const n = this.list().length;
    if (input.pressed('uiLeft', true)) this.setPocket(stepIndex(this.pocket, -1, this.tabCount));
    else if (input.pressed('uiRight', true)) this.setPocket(stepIndex(this.pocket, 1, this.tabCount));
    else if (input.pressed('uiUp', true)) this.select(stepIndex(this.sel, -1, n));
    else if (input.pressed('uiDown', true)) this.select(stepIndex(this.sel, 1, n));
    else if (input.pressed('confirm', true)) this.activate();
    else if (input.pressed('back', true)) return 'exit';
  }

  setPocket(i: number): void {
    this.pocket = i;
    this.sel = 0;
    this.render();
  }

  select(i: number): void {
    this.sel = i;
    this.render();
  }

  activate(): void {
    const entry = this.list()[this.sel];
    if (!entry) return;
    if (this.isBlocks) return this.blockAction(entry.id);
    const { host, ui } = this.ctx;
    const info = itemInfo(host.dex, entry.id, host.keyItems);
    this.ctx.run(async () => {
      const acts: { label: string; value: string }[] = [];
      if (info.usable) acts.push({ label: '使用', value: 'use' });
      if (info.holdable) acts.push({ label: '携带', value: 'give' });
      if (info.tossable) acts.push({ label: '丢弃', value: 'toss' });
      acts.push({ label: '取消', value: 'cancel' });
      if (acts.length === 1) {
        await say(ui, info.pocket === 'balls' ? '精灵球要在战斗中使用。' : '这个道具现在不能使用。');
        return;
      }
      const act = await choose(ui, acts, { cancellable: true, style: { right: '60px', bottom: '140px' } });
      if (act === 'use') await this.useItem(entry.id);
      else if (act === 'give') await this.giveItem(entry.id);
      else if (act === 'toss') await this.tossItem(entry.id, entry.qty);
      // 数量变化后保持选择在范围内
      this.sel = Math.min(this.sel, Math.max(0, this.list().length - 1));
    });
  }

  private async useItem(id: string): Promise<void> {
    const { host, ui } = this.ctx;
    const { dex, state, keyItems } = host;
    if (!state.party.length) return say(ui, '没有可以使用的对象。');
    const ctx = { timeOfDay: host.timeOfDay() };
    // 招式学习器：分别提示「已经学会」/「无法学习」（计划文档 §6）
    const tmMove = keyItems.get(id)?.pocket === 'tms' ? keyItems.get(id)?.move : undefined;
    const why = (p: PokemonInstance): string | null => {
      if (tmMove) {
        if (p.moves.some((m) => m.id === tmMove)) return '已经学会';
        if (!tmCompatible(dex, p, tmMove)) return '无法学习';
        return null;
      }
      return applyToPokemon(dex, id, structuredClone(p), keyItems, ctx).ok ? null : '没有效果';
    };
    const idx = await pickPokemon(ui, dex, state.party, why);
    if (idx === null) return;
    const p = state.party[idx]!;
    let useCtx: ItemUseContext = ctx;
    const iv = IV_ITEMS[id];
    if (iv) {
      // 洗练道具：需要时选能力项（显示当前个体值与评价），随机类再二次确认
      let stat: BaseStatId | undefined;
      if (iv.needsStat) {
        const opts = STAT_IDS.filter((k) => ivItemStatUsable(id, p.ivs, k)).map((k) => ({
          label: `${IV_STAT_ZH[k]}\u3000${p.ivs[k]} / ${IV_MAX}（${IV_GRADE_ZH[ivGrade(p.ivs[k])]}）`,
          value: k,
        }));
        await say(ui, iv.kind === 'cap' ? '要让哪一项个体值变为最棒？' : '要重新洗练哪一项个体值？');
        const picked = await choose<BaseStatId>(ui, opts, { cancellable: true, style: { right: '60px', bottom: '140px' } });
        if (picked === null || picked === undefined) return;
        stat = picked;
      }
      if (iv.kind === 'reroll' || iv.kind === 'focus-reroll') {
        const ok = await choose(
          ui,
          [
            { label: '确定洗练', value: true },
            { label: '算了', value: false },
          ],
          { cancellable: true, style: { right: '60px', bottom: '140px' } },
        );
        if (!ok) return;
      }
      useCtx = { ...ctx, stat };
    }
    const r = useFromBag(dex, state, id, idx, keyItems, useCtx);
    if (!r.ok) return say(ui, r.messages);
    const name = itemInfo(dex, id, keyItems).name;
    if (r.evolveTo !== undefined) {
      await say(ui, `对${displayName(dex, p)}使用了${name}。`);
      await evolveFlow(ui, dex, state, p, r.evolveTo);
      return;
    }
    if (r.learnMove) {
      await say(ui, r.messages.length ? r.messages : `启动了${name}。`);
      await learnMoveFlow(ui, dex, p, r.learnMove);
      return;
    }
    await say(ui, [`对${displayName(dex, p)}使用了${name}。`, ...r.messages]);
  }

  private async giveItem(id: string): Promise<void> {
    const { host, ui } = this.ctx;
    const { dex, state, keyItems } = host;
    if (!state.party.length) return say(ui, '没有可以携带的宝可梦。');
    const idx = await pickPokemon(ui, dex, state.party);
    if (idx === null) return;
    const p = state.party[idx]!;
    const name = itemInfo(dex, id, keyItems).name;
    if (p.heldItem) {
      const prev = itemInfo(dex, p.heldItem, keyItems).name;
      await say(ui, `${displayName(dex, p)}正携带着${prev}。`);
      const swap = await choose(ui, [
        { label: `换成${name}`, value: true },
        { label: '算了', value: false },
      ], { cancellable: true, style: { right: '60px', bottom: '170px' } });
      if (!swap) return;
      giveHeldItem(state, idx, id);
      await say(ui, `把${prev}放回了背包，让${displayName(dex, p)}携带了${name}。`);
      return;
    }
    giveHeldItem(state, idx, id);
    await say(ui, `让${displayName(dex, p)}携带了${name}。`);
  }

  private async tossItem(id: string, qty: number): Promise<void> {
    const { host, ui } = this.ctx;
    const name = itemInfo(host.dex, id, host.keyItems).name;
    const opts = [1, 5, 10].filter((n) => n < qty).map((n) => ({ label: `${n} 个`, value: n }));
    opts.push({ label: `全部（${qty} 个）`, value: qty });
    const n = qty === 1 ? 1 : await choose(ui, opts, { cancellable: true, style: { right: '60px', bottom: '140px' } });
    if (!n) return;
    const ok = await choose(ui, [
      { label: `丢弃 ${name} ×${n}`, value: true },
      { label: '取消', value: false },
    ], { cancellable: true, style: { right: '60px', bottom: '140px' } });
    if (!ok) return;
    tossItem(host.state, id, n);
    await say(ui, `丢掉了${name} ×${n}。`);
  }

  // ———————————————— 方块盒 ————————————————

  private blockAction(uid: string): void {
    const { host, ui } = this.ctx;
    const b = blockBox(host.state).find((x) => x.uid === uid);
    if (!b) return;
    this.ctx.run(async () => {
      const acts: { label: string; value: string; disabled?: boolean; sub?: string | undefined }[] = [{ label: '喂食', value: 'feed' }];
      acts.push({ label: '放置诱饵', value: 'lure', disabled: !host.placeLure, sub: host.placeLure ? '3 分钟内附近喜欢这个口味的宝可梦更容易出现' : '只能在户外放置' });
      acts.push({ label: '丢弃', value: 'toss' }, { label: '取消', value: 'cancel' });
      const act = await choose(ui, acts, { cancellable: true, style: { right: '60px', bottom: '140px' } });
      if (act === 'feed') await this.feed(uid);
      else if (act === 'lure' && host.placeLure) {
        const err = host.placeLure(uid);
        await say(ui, err ?? `把${blockName(b)}放在了地上。附近喜欢这个口味的宝可梦会被吸引过来。`);
      } else if (act === 'toss') {
        const ok = await choose(ui, [
          { label: `丢弃${blockName(b)}`, value: true },
          { label: '取消', value: false },
        ], { cancellable: true, style: { right: '60px', bottom: '140px' } });
        if (ok) {
          takeBlock(host.state, uid);
          await say(ui, `丢掉了${blockName(b)}。`);
        }
      }
      this.sel = Math.min(this.sel, Math.max(0, this.list().length - 1));
    });
  }

  private async feed(uid: string): Promise<void> {
    const { host, ui } = this.ctx;
    const { dex, state } = host;
    if (!state.party.length) return say(ui, '没有可以喂食的宝可梦。');
    const why = (p: PokemonInstance): string | null => ((p.condition?.sheen ?? 0) >= SHEEN_MAX ? '吃不下了' : null);
    const idx = await pickPokemon(ui, dex, state.party, why);
    if (idx === null) return;
    const p = state.party[idx]!;
    const b = takeBlock(state, uid);
    if (!b) return;
    const r = feedBlock(p, b, dex.nature(p.nature), displayName(dex, p));
    if (!r.ok) blockBox(state).push(b);
    else gainBreederXp(state, 'feed', actXp('feed'));
    await say(ui, r.messages);
  }

  private renderBlocks(): void {
    const { dex, state } = this.ctx.host;
    const box = blockBox(state);
    this.items.textContent = '';
    if (!box.length) el('div', 'none', this.items, '方块盒是空的。在家里的能量方块机用树果制作吧。');
    box.forEach((b, i) => {
      const row = el('div', i === this.sel ? 'it sel interactive' : 'it interactive', this.items);
      const ic = el('span', '', row);
      ic.innerHTML = blockIconSvg(b.kind, 28);
      ic.style.cssText = 'display:inline-flex;width:28px;height:28px;';
      el('span', 'nm', row, blockName(b));
      el('span', 'q', row, `顺滑 ${b.smooth}`);
      row.dataset.block = b.uid;
      row.addEventListener('click', () => {
        if (i === this.sel) this.activate();
        else this.select(i);
      });
    });
    keepVisible(this.items.children[this.sel] as HTMLElement | undefined);
    this.desc.textContent = '';
    const cur = box[this.sel];
    if (cur) {
      const big = el('span', '', this.desc);
      big.innerHTML = blockIconSvg(cur.kind, 56);
      big.style.cssText = 'float:left;margin:0 12px 0 0;';
      el('b', '', this.desc, blockName(cur));
      this.desc.append(`${blockSummary(cur)}。喂给宝可梦能提升亲密度和外观状态；也可以放在地上当诱饵，或投喂给头目让它平静下来。`);
      const lead = state.party[0];
      if (lead) {
        const c = conditionOf(structuredClone(lead));
        const parts = (Object.keys(CONDITION_ZH) as Condition[]).map((k) => `${CONDITION_ZH[k]} ${c[k]}`);
        el('div', '', this.desc, `${displayName(dex, lead)}：${parts.join(' · ')} · 光泽 ${c.sheen}/${SHEEN_MAX}`).style.cssText = 'clear:both;font-size:12px;opacity:.75;margin-top:4px;';
      }
    } else el('b', '', this.desc, `方块盒\u3000${box.length}/${BLOCK_BOX_CAPACITY}`);
  }

  render(): void {
    const { dex, keyItems, state } = this.ctx.host;
    this.el.classList.toggle('blurred', !this.focused);
    this.tabs.textContent = '';
    POCKETS.forEach((p, i) => {
      const n = pocketItems(dex, state.bag, p.id, keyItems).length;
      const s = el('span', i === this.pocket ? 'on interactive' : 'interactive', this.tabs, n ? `${p.name} ${n}` : p.name);
      s.dataset.pocket = p.id;
      s.addEventListener('click', () => this.setPocket(i));
    });
    const nb = blockBox(state).length;
    const bt = el('span', this.isBlocks ? 'on interactive' : 'interactive', this.tabs, nb ? `方块盒 ${nb}` : '方块盒');
    bt.dataset.pocket = 'blocks';
    bt.addEventListener('click', () => this.setPocket(POCKETS.length));
    if (this.isBlocks) return this.renderBlocks();
    const list = this.list();
    this.items.textContent = '';
    if (!list.length) el('div', 'none', this.items, '这个口袋里什么也没有。');
    list.forEach((it, i) => {
      const info = itemInfo(dex, it.id, keyItems);
      const row = el('div', i === this.sel ? 'it sel interactive' : 'it interactive', this.items);
      row.append(itemIcon(dex, keyItems, it.id, 28));
      el('span', 'nm', row, info.name);
      row.dataset.item = it.id;
      if (info.pocket !== 'key' && info.pocket !== 'tms') el('span', 'q', row, `×${it.qty}`);
      else el('span', 'q', row, '');
      row.addEventListener('click', () => {
        if (i === this.sel) this.activate();
        else this.select(i);
      });
    });
    keepVisible(this.items.children[this.sel] as HTMLElement | undefined);
    this.desc.textContent = '';
    const cur = list[this.sel];
    if (cur) {
      const info = itemInfo(dex, cur.id, keyItems);
      const big = itemIcon(dex, keyItems, cur.id, 56);
      big.style.cssText += 'float:left;margin:0 12px 0 0;';
      this.desc.append(big);
      el('b', '', this.desc, info.name);
      this.desc.append(info.desc || '——');
    } else {
      el('b', 'cl-money', this.desc, `持有金钱\u3000¥${state.money.toLocaleString()}`);
    }
  }
}

/**
 * M1-18 · 队伍：左侧 6 只卡片（HP、异常、携带物），右侧详情（概要 / 能力 / 招式）。
 * 确定 → 操作菜单：调换位置 / 收回携带物；调换模式下再选一只即交换。
 */
import type { Input } from '@/core/input';
import { displayName, getStats, maxHp, type PokemonInstance } from '@/systems/pokemon';
import { expProgress } from '@/systems/progression';
import { EV_MAX_PER_STAT, EV_MAX_TOTAL, STAT_IDS } from '@/systems/pokemon/stats';
import { IV_GRADE_ZH, bestIvStats, evSummary, ivGrade, ivOverall } from '@/systems/pokemon/judge';
import { itemInfo, swapParty, takeHeldItem } from '@/systems/items';
import { choose, say } from '../../core';
import { el } from '../../core/styles';
import { TYPE_NAMES_ZH } from '../../battle/messages';
import { bar, genderMark, hpBar, keepVisible, monIcon, statusTag, stepIndex, typeChip } from '../common';
import type { MenuPage, PageContext } from '../types';

const STAT_ZH: Record<string, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
const CAT_ZH: Record<string, string> = { physical: '物理', special: '特殊', status: '变化' };
const TABS = ['概要', '能力', '天赋', '招式'] as const;

export class PartyPage implements MenuPage {
  readonly id = 'party';
  readonly title = '队伍';
  readonly el: HTMLDivElement;
  private list: HTMLDivElement;
  private detail: HTMLDivElement;
  private sel = 0;
  private tab = 0;
  private swapFrom: number | null = null;
  private focused = false;

  constructor(private readonly ctx: PageContext) {
    this.el = el('div', 'cl-page cl-party');
    this.list = el('div', 'list', this.el);
    this.detail = el('div', 'cl-detail', this.el);
  }

  private get party(): PokemonInstance[] {
    return this.ctx.host.state.party;
  }

  show(): void {
    this.sel = Math.min(this.sel, Math.max(0, this.party.length - 1));
    this.render();
  }

  focus(): void {
    this.focused = true;
    this.render();
  }

  blur(): void {
    this.focused = false;
    this.swapFrom = null;
    this.render();
  }

  hints(): string {
    const k = this.ctx.keyLabel;
    if (this.swapFrom !== null) return `<kbd>${k('confirm')}</kbd>与这只交换\u3000<kbd>${k('back')}</kbd>取消交换`;
    return `<kbd>↑↓</kbd>选择\u3000<kbd>←→</kbd>切换详情页\u3000<kbd>${k('confirm')}</kbd>操作\u3000<kbd>${k('back')}</kbd>返回`;
  }

  handle(input: Input): 'exit' | void {
    const n = this.party.length;
    if (input.pressed('uiUp', true)) this.select(stepIndex(this.sel, -1, n));
    else if (input.pressed('uiDown', true)) this.select(stepIndex(this.sel, 1, n));
    else if (input.pressed('uiLeft', true)) this.setTab(stepIndex(this.tab, -1, TABS.length));
    else if (input.pressed('uiRight', true)) this.setTab(stepIndex(this.tab, 1, TABS.length));
    else if (input.pressed('confirm', true)) this.activate();
    else if (input.pressed('back', true)) {
      if (this.swapFrom !== null) {
        this.swapFrom = null;
        this.render();
      } else return 'exit';
    }
  }

  select(i: number): void {
    this.sel = i;
    this.render();
  }

  setTab(t: number): void {
    this.tab = t;
    this.render();
  }

  /** 确定：调换模式下完成交换，否则弹出操作菜单 */
  activate(): void {
    const p = this.party[this.sel];
    if (!p) return;
    if (this.swapFrom !== null) {
      swapParty(this.ctx.host.state, this.swapFrom, this.sel);
      this.swapFrom = null;
      this.render();
      return;
    }
    const { host, ui } = this.ctx;
    this.ctx.run(async () => {
      const items: { label: string; value: string; disabled?: boolean }[] = [
        { label: '调换位置', value: 'swap', disabled: this.party.length < 2 },
        { label: p.heldItem ? `收回「${itemInfo(host.dex, p.heldItem, host.keyItems).name}」` : '收回携带物', value: 'take', disabled: !p.heldItem },
        { label: '取消', value: 'cancel' },
      ];
      const act = await choose(ui, items, { cancellable: true, style: { left: '360px', right: 'auto', top: `${140 + this.sel * 70}px`, bottom: 'auto' } });
      if (act === 'swap') this.swapFrom = this.sel;
      else if (act === 'take') {
        const id = takeHeldItem(host.state, this.sel);
        if (id) await say(ui, `从${displayName(host.dex, p)}那里收回了${itemInfo(host.dex, id, host.keyItems).name}。`);
      }
    });
  }

  render(): void {
    const { dex, keyItems } = this.ctx.host;
    this.el.classList.toggle('blurred', !this.focused);
    this.list.textContent = '';
    if (!this.party.length) {
      el('div', 'empty', this.list, '还没有宝可梦。');
      this.detail.textContent = '';
      return;
    }
    this.party.forEach((p, i) => {
      const card = el('div', 'card interactive', this.list);
      card.dataset.index = String(i);
      if (i === this.sel) card.classList.add('sel');
      if (i === this.swapFrom) card.classList.add('swap');
      if (p.hp <= 0) card.classList.add('fainted');
      const icon = monIcon(dex, p.speciesId, card, { shiny: p.shiny });
      icon.classList.add('icon');
      const name = el('div', 'name', card);
      el('span', '', name, displayName(dex, p));
      el('span', 'g', name, genderMark(p));
      statusTag(p, name);
      el('span', 'lv', name, `Lv.${p.level}`);
      const info = el('div', '', card);
      hpBar(dex, p, info);
      if (p.heldItem) el('div', 'held', info, `携带：${itemInfo(dex, p.heldItem, keyItems).name}`);
      card.addEventListener('click', () => {
        if (i === this.sel) this.activate();
        else this.select(i);
      });
    });
    keepVisible(this.list.children[this.sel] as HTMLElement | undefined);
    this.renderDetail(this.party[this.sel]!);
  }

  /** 天赋页：个体值评价（雷达图金色）+ 努力值（雷达图蓝色、条形 x/252） */
  private renderTalent(d: HTMLElement, p: PokemonInstance): void {
    const wrap = el('div', 'cl-talent', d);
    wrap.appendChild(talentRadar(p.ivs, p.evs));
    const rows = el('div', 'rows', wrap);
    for (const h of ['', '个体值', '努力值', '']) el('div', 'h', rows, h);
    const ev = evSummary(p.evs);
    for (const id of STAT_IDS) {
      el('div', '', rows, STAT_ZH[id]);
      const g = ivGrade(p.ivs[id]);
      el('div', `g ${g}`, rows, `${p.ivs[id]} ${IV_GRADE_ZH[g]}`).title = `个体值 ${p.ivs[id]} / 31`;
      bar(rows, p.evs[id] / EV_MAX_PER_STAT, ev.maxed[id] ? '#3a7bd5' : '#7fb0ea');
      el('div', `ev${ev.maxed[id] ? ' max' : ''}`, rows, `${p.evs[id]}/${EV_MAX_PER_STAT}`);
    }
    const sum = el('div', 'cl-talent-sum', d);
    const best = bestIvStats(p.ivs).map((k) => STAT_ZH[k]).join('、');
    const l1 = el('div', '', sum);
    l1.append('总体评价：');
    el('b', '', l1, ivOverall(p.ivs));
    l1.append(`\u3000最出色的能力：${best}`);
    const l2 = el('div', '', sum);
    l2.append('努力值合计：');
    el('b', '', l2, `${ev.total} / ${EV_MAX_TOTAL}`);
    l2.append(ev.remaining > 0 ? `\u3000还能获得 ${ev.remaining}` : '\u3000已经达到上限');
    el('div', '', sum, '个体值：每只天生 6 项各 0–31（满值 31），决定同种宝可梦之间的天赋差异；洗练石可重新随机，王冠可直接变为 31。').style.cssText = 'color:#6a7190;font-size:12px';
    el('div', '', sum, '努力值：打倒宝可梦获得（图鉴可查各物种给的努力值），营养剂每瓶 +10；每 4 点努力值 = 满级时 +1 能力。').style.cssText = 'color:#6a7190;font-size:12px';
  }

  private renderDetail(p: PokemonInstance): void {
    const { dex, keyItems } = this.ctx.host;
    const sp = dex.species(p.speciesId);
    const d = this.detail;
    d.textContent = '';
    const top = el('div', 'top', d);
    monIcon(dex, p.speciesId, top, { size: 64, shiny: p.shiny });
    const t = el('div', '', top);
    el('div', 'nm', t, `${displayName(dex, p)} ${genderMark(p)}`);
    el('div', 'sub', t, `No.${String(sp.id).padStart(4, '0')}  ${sp.name.zh}  Lv.${p.level}${p.shiny ? '  ✦ 异色' : ''}${p.alpha ? '  头目' : ''}`);
    const types = el('div', '', t);
    for (const ty of sp.types) typeChip(ty, types);
    const tabs = el('div', 'tabs', d);
    TABS.forEach((name, i) => {
      const s = el('span', i === this.tab ? 'on interactive' : 'interactive', tabs, name);
      s.addEventListener('click', () => this.setTab(i));
    });
    if (this.tab === 0) {
      const kv = el('div', 'cl-kv', d);
      const row = (k: string, v: string, desc?: string) => {
        el('div', 'k', kv, k);
        el('div', '', kv, v);
        if (desc) {
          el('div', '', kv);
          el('div', 'desc', kv, desc);
        }
      };
      const nat = dex.nature(p.nature);
      const nplus = nat.plus && nat.minus && nat.plus !== nat.minus ? `（${STAT_ZH[nat.plus]}↑ ${STAT_ZH[nat.minus]}↓）` : '（无修正）';
      const ab = dex.ability(p.ability);
      row('HP', `${p.hp} / ${maxHp(dex, p)}`);
      row('性格', `${nat.name.zh}${nplus}`);
      row('特性', ab?.name.zh ?? p.ability, ab?.shortEffect.replace(/\s+/g, ''));
      row('携带物', p.heldItem ? itemInfo(dex, p.heldItem, keyItems).name : '无');
      row('亲密度', '♥'.repeat(Math.max(1, Math.ceil(p.friendship / 51))));
      row('初训家', p.ot ?? this.ctx.host.state.player.name);
      if (p.metAt) row('相遇', `Lv.${p.metAt.level}  ${p.metAt.zone ?? p.metAt.island}`);
      const ep = expProgress(dex, p);
      el('div', 'k', kv, '经验值');
      const ew = el('div', '', kv);
      bar(ew, ep.ratio, '#3a7bd5');
      const eDesc = el('div', 'desc', ew, p.level >= 100 ? '已达到最高等级' : `距离升级还需 ${Math.max(0, ep.needed - ep.current)}`);
      eDesc.style.marginTop = '6px';
    } else if (this.tab === 1) {
      const st = getStats(dex, p);
      const nat = dex.nature(p.nature);
      const box = el('div', 'cl-stats', d);
      const maxBar = Math.max(...Object.values(st), 1);
      for (const id of STAT_IDS) {
        const cls = nat.plus === id && nat.minus !== id ? 'up' : nat.minus === id && nat.plus !== id ? 'down' : '';
        el('div', cls, box, STAT_ZH[id]);
        el('div', 'v', box, id === 'hp' ? `${p.hp}/${st.hp}` : String(st[id]));
        bar(box, st[id] / maxBar, cls === 'up' ? '#e8484a' : cls === 'down' ? '#3a7bd5' : '#3fb88a');
      }
      el('div', 'desc', d, '红色 / 蓝色：受性格影响提高 / 降低的能力。').style.cssText = 'font-size:12px;color:#6a7190;margin-top:10px';
    } else if (this.tab === 2) {
      this.renderTalent(d, p);
    } else {
      const box = el('div', 'cl-moves', d);
      for (const m of p.moves) {
        const md = dex.move(m.id);
        const mv = el('div', 'mv', box);
        const n = el('div', 'n', mv);
        typeChip(md.type, n);
        n.append(md.name.zh);
        el('div', 'pp', mv, `PP ${m.pp}/${m.maxPp}`);
        el('div', 'meta', mv, `${TYPE_NAMES_ZH[md.type] ?? md.type} · ${CAT_ZH[md.category] ?? md.category}\u3000威力 ${md.power || '—'}\u3000命中 ${md.accuracy ?? '—'}`);
      }
    }
  }
}

/** 六边形雷达图：外圈网格、个体值（金，/31）、努力值（蓝，/252） */
function talentRadar(ivs: Record<string, number>, evs: Record<string, number>): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-96 -86 192 192');
  // 顺时针：HP（上）攻击 防御 速度 特防 特攻 ——与正作评价图一致
  const order = ['hp', 'atk', 'def', 'spe', 'spd', 'spa'] as const;
  const pt = (i: number, r: number): string => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  };
  const poly = (vals: number[], fill: string, stroke: string, op: number): void => {
    const p = document.createElementNS(NS, 'polygon');
    p.setAttribute('points', vals.map((v, i) => pt(i, v)).join(' '));
    p.setAttribute('fill', fill);
    p.setAttribute('fill-opacity', String(op));
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', '1.5');
    svg.appendChild(p);
  };
  for (const r of [56, 42, 28, 14]) poly([r, r, r, r, r, r], r === 56 ? '#f3f5fa' : 'none', '#d5dbe8', 1);
  poly(order.map((k) => 4 + (ivs[k]! / 31) * 52), '#f2b541', '#d99a1a', 0.45);
  poly(order.map((k) => (evs[k]! / 252) * 56), '#3a7bd5', '#3a7bd5', 0.35);
  order.forEach((k, i) => {
    const t = document.createElementNS(NS, 'text');
    const [x, y] = pt(i, 70).split(',');
    t.setAttribute('x', x!);
    t.setAttribute('y', String(Number(y) + 4));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '11');
    t.setAttribute('fill', '#6a7190');
    t.textContent = `${STAT_ZH[k] ?? k} ${ivs[k]}`;
    if (ivs[k] === 31) t.setAttribute('fill', '#d99a1a');
    svg.appendChild(t);
  });
  // 满值刻度：最外圈 = 个体值 31 / 努力值 252
  const rim = document.createElementNS(NS, 'text');
  rim.setAttribute('x', '4');
  rim.setAttribute('y', '-58');
  rim.setAttribute('font-size', '8');
  rim.setAttribute('fill', '#9aa2bd');
  rim.textContent = '31';
  svg.appendChild(rim);
  // 图例
  const legend: [string, string][] = [
    ['#f2b541', '个体值（满 31）'],
    ['#3a7bd5', '努力值（满 252）'],
  ];
  legend.forEach(([c, label], i) => {
    const x = -88 + i * 92;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(x));
    r.setAttribute('y', '90');
    r.setAttribute('width', '9');
    r.setAttribute('height', '9');
    r.setAttribute('rx', '2');
    r.setAttribute('fill', c);
    r.setAttribute('fill-opacity', '0.7');
    svg.appendChild(r);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', String(x + 13));
    t.setAttribute('y', '98');
    t.setAttribute('font-size', '9');
    t.setAttribute('fill', '#6a7190');
    t.textContent = label;
    svg.appendChild(t);
  });
  return svg;
}

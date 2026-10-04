/**
 * M1-18 · 图鉴：地区图鉴列表（未发现 / 见过 / 捕获），右侧条目。
 * 见过：名字、分类、属性；捕获：再加身高体重、种族值与图鉴说明。
 */
import type { Input } from '@/core/input';
import { dexCounts, dexEntries, dexNo, type DexEntry } from '@/systems/pokedex';
import { STAT_IDS } from '@/systems/pokemon/stats';
import { el } from '../../core/styles';
import { bar, keepVisible, monIcon, stepIndex, typeChip } from '../common';
import type { MenuPage, PageContext } from '../types';

const STAT_ZH: Record<string, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };

export class DexPage implements MenuPage {
  readonly id = 'dex';
  readonly title = '图鉴';
  readonly el: HTMLDivElement;
  private count: HTMLDivElement;
  private rows: HTMLDivElement;
  private entry: HTMLDivElement;
  sel = 0;
  private focused = false;

  constructor(private readonly ctx: PageContext) {
    this.el = el('div', 'cl-page cl-dex');
    const col = el('div', 'col', this.el);
    this.count = el('div', 'count', col);
    this.rows = el('div', 'rows', col);
    this.entry = el('div', 'entry', this.el);
  }

  private entries(): DexEntry[] {
    return dexEntries(this.ctx.host.state, this.ctx.host.regionalDex.species);
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
    return `<kbd>↑↓</kbd>选择\u3000<kbd>←→</kbd>翻页（10 条）\u3000<kbd>${k('back')}</kbd>返回`;
  }

  handle(input: Input): 'exit' | void {
    const n = this.entries().length;
    if (input.pressed('uiUp', true)) this.select(stepIndex(this.sel, -1, n));
    else if (input.pressed('uiDown', true)) this.select(stepIndex(this.sel, 1, n));
    else if (input.pressed('uiLeft', true)) this.select(Math.max(0, this.sel - 10));
    else if (input.pressed('uiRight', true)) this.select(Math.min(n - 1, this.sel + 10));
    else if (input.pressed('back', true)) return 'exit';
  }

  select(i: number): void {
    this.sel = i;
    this.render();
  }

  render(): void {
    const { dex, state, regionalDex } = this.ctx.host;
    this.el.classList.toggle('blurred', !this.focused);
    const c = dexCounts(state, regionalDex.species);
    this.count.textContent = '';
    el('span', '', this.count, regionalDex.name);
    el('span', '', this.count, `见过 ${c.seen}`);
    el('span', '', this.count, `捕获 ${c.caught}`);
    el('span', '', this.count, `共 ${c.total}`);
    const list = this.entries();
    this.rows.textContent = '';
    list.forEach((e, i) => {
      const row = el('div', `row interactive ${e.status}${i === this.sel ? ' sel' : ''}`, this.rows);
      row.dataset.species = String(e.speciesId);
      el('span', 'no', row, dexNo(e.no));
      monIcon(dex, e.speciesId, row, { size: 26, silhouette: e.status === 'unknown' });
      el('span', 'nm', row, e.status === 'unknown' ? '？？？' : dex.species(e.speciesId).name.zh);
      if (e.status !== 'unknown') el('span', `mark ${e.status}`, row);
      row.addEventListener('click', () => this.select(i));
    });
    keepVisible(this.rows.children[this.sel] as HTMLElement | undefined);
    this.renderEntry(list[this.sel]);
  }

  private renderEntry(e: DexEntry | undefined): void {
    const d = this.entry;
    d.textContent = '';
    if (!e) return;
    const { dex } = this.ctx.host;
    const sp = dex.species(e.speciesId);
    const hero = el('div', 'hero', d);
    monIcon(dex, sp.id, hero, { size: 88, silhouette: e.status === 'unknown' });
    const t = el('div', '', hero);
    el('div', 'genus', t, `No.${dexNo(e.no)}`);
    if (e.status === 'unknown') {
      el('div', 'nm', t, '？？？');
      el('div', 'locked', d, '还没有遇到过这只宝可梦。');
      return;
    }
    el('div', 'nm', t, sp.name.zh);
    el('div', 'genus', t, sp.genus.zh);
    const types = el('div', '', t);
    types.style.marginTop = '4px';
    for (const ty of sp.types) typeChip(ty, types);
    // 击败可获得的努力值（见过即可查看）
    const evs = STAT_IDS.filter((k) => sp.evYield[k] > 0);
    const ev = el('div', 'cl-dex-ev', d);
    ev.style.cssText = 'margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px';
    el('span', '', ev, '击败可获得努力值：').style.opacity = '0.7';
    if (!evs.length) el('span', '', ev, '无');
    for (const k of evs) {
      const c = el('span', '', ev, `${STAT_ZH[k]} +${sp.evYield[k]}`);
      c.style.cssText = 'padding:2px 9px;border-radius:999px;background:#3a7bd5;color:#fff;font-weight:700;font-size:12px';
    }
    if (e.status === 'seen') {
      el('div', 'locked', d, '捕获后可以查看详细资料。');
      return;
    }
    el('div', 'flavor', d, sp.flavor.replace(/\s+/g, ''));
    const kv = el('div', 'cl-kv', d);
    el('div', 'k', kv, '身高');
    el('div', '', kv, `${sp.heightM.toFixed(1)} m`);
    el('div', 'k', kv, '体重');
    el('div', '', kv, `${sp.weightKg.toFixed(1)} kg`);
    const st = el('div', 'cl-stats', d);
    st.style.marginTop = '12px';
    for (const id of STAT_IDS) {
      el('div', '', st, STAT_ZH[id]);
      el('div', 'v', st, String(sp.baseStats[id]));
      bar(st, sp.baseStats[id] / 160, '#3fb88a');
    }
  }
}

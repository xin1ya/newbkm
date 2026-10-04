/**
 * 区域图鉴：当前岛屿的野外区域列表（左），右侧显示区域资料——类型、等级范围、常见天气、坐标、头目巢穴，
 * 以及可出现的宝可梦：等级范围、出现方式（草丛 / 可见 / 水面 / 钓鱼）、条件（白天 / 夜晚 / 天气 / 稀有 / 成群）、
 * 出现率与努力值。没见过的宝可梦显示剪影与「？？？」；没去过的区域只显示名字与等级。
 */
import type { Input } from '@/core/input';
import { dexStatus } from '@/systems/pokedex';
import { STAT_IDS } from '@/systems/pokemon/stats';
import { el, injectUiStyles } from '../../core/styles';
import { keepVisible, monIcon, stepIndex, typeChip } from '../common';
import type { MenuPage, PageContext, ZoneDexZone } from '../types';

const STAT_ZH: Record<string, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
const KIND_ZH: Record<string, string> = { wild: '野外', sea: '海域', town: '城镇', 'dungeon-entrance': '洞窟入口' };

const CSS = `
.cl-zdex { grid-template-columns: 280px 1fr; }
.cl-zdex .col { display: flex; flex-direction: column; min-height: 0; }
.cl-zdex .count { padding: 10px 14px; font-size: 13px; color: #4a5270; border-bottom: 2px solid #d5dae6; display: flex; gap: 14px; font-weight: 700; }
.cl-zdex .rows { overflow-y: auto; padding: 6px 8px; }
.cl-zdex .row { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 6px 10px; border-radius: 10px; cursor: pointer; }
.cl-zdex .row .nm { font-weight: 800; font-size: 15px; }
.cl-zdex .row .lv { font-size: 12px; color: #6a7190; text-align: right; }
.cl-zdex .row .sub { grid-column: 1 / 3; font-size: 11px; color: #6a7190; }
.cl-zdex .row.locked .nm { color: #9aa0b3; }
.cl-zdex .row.sel { background: #e7f6ef; outline: 2px solid #3fb88a; }
.cl-zdex .entry { padding: 14px 18px; overflow-y: auto; border-left: 2px dashed #d5dae6; }
.cl-zdex .entry .zn { font-size: 22px; font-weight: 800; }
.cl-zdex .entry .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
.cl-zdex .entry .chip { padding: 2px 9px; border-radius: 999px; background: #eef1f7; font-size: 12px; font-weight: 700; color: #4a5270; }
.cl-zdex .entry .chip.alpha { background: #c0503a; color: #fff; }
.cl-zdex table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cl-zdex th { text-align: left; font-size: 11px; color: #6a7190; font-weight: 700; padding: 4px 6px; border-bottom: 2px solid #e1e5ef; }
.cl-zdex td { padding: 5px 6px; border-bottom: 1px solid #eef1f7; vertical-align: middle; }
.cl-zdex td .mn { display: flex; align-items: center; gap: 8px; font-weight: 800; }
.cl-zdex td .mn.unknown { color: #9aa0b3; }
.cl-zdex td .ev { color: #3a7bd5; font-weight: 700; white-space: nowrap; }
.cl-zdex td .mk { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 4px; }
.cl-zdex td .mk.caught { background: #e8484a; border: 1.5px solid #27304a; }
.cl-zdex td .mk.seen { border: 2px solid #9aa0b3; }
.cl-zdex .bar { display: inline-block; height: 6px; border-radius: 3px; background: #3fb88a; vertical-align: middle; margin-right: 6px; }
.cl-zdex .locked { color: #9aa0b3; margin-top: 16px; }
`;

export class ZoneDexPage implements MenuPage {
  readonly id = 'zones';
  readonly title = '区域图鉴';
  readonly el: HTMLDivElement;
  private count: HTMLDivElement;
  private rows: HTMLDivElement;
  private entry: HTMLDivElement;
  sel = 0;
  private focused = false;

  constructor(private readonly ctx: PageContext) {
    injectUiStyles(CSS);
    this.el = el('div', 'cl-page cl-zdex');
    const col = el('div', 'col', this.el);
    this.count = el('div', 'count', col);
    this.rows = el('div', 'rows', col);
    this.entry = el('div', 'entry', this.el);
  }

  private zones(): ZoneDexZone[] {
    return this.ctx.host.zoneDex?.zones ?? [];
  }

  show(): void {
    // 默认选中当前所在区域
    const here = this.ctx.host.location();
    const i = this.zones().findIndex((z) => here.endsWith(z.name));
    if (i >= 0) this.sel = i;
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
    return `<kbd>↑↓</kbd>选择区域\u3000<kbd>${k('back')}</kbd>返回`;
  }

  handle(input: Input): 'exit' | void {
    const n = this.zones().length;
    if (!n) {
      if (input.pressed('back', true)) return 'exit';
      return;
    }
    if (input.pressed('uiUp', true)) this.select(stepIndex(this.sel, -1, n));
    else if (input.pressed('uiDown', true)) this.select(stepIndex(this.sel, 1, n));
    else if (input.pressed('back', true)) return 'exit';
  }

  select(i: number): void {
    this.sel = i;
    this.render();
  }

  render(): void {
    const { state } = this.ctx.host;
    this.el.classList.toggle('blurred', !this.focused);
    const zones = this.zones();
    this.count.textContent = '';
    el('span', '', this.count, this.ctx.host.zoneDex?.island ?? '');
    el('span', '', this.count, `已到访 ${zones.filter((z) => z.visited).length} / ${zones.length}`);
    this.rows.textContent = '';
    zones.forEach((z, i) => {
      const row = el('div', `row interactive${z.visited ? '' : ' locked'}${i === this.sel ? ' sel' : ''}`, this.rows);
      el('div', 'nm', row, z.name);
      el('div', 'lv', row, z.levelRange ? `Lv.${z.levelRange[0]}–${z.levelRange[1]}` : '');
      const caught = z.species.filter((s) => dexStatus(state, s.speciesId) === 'caught').length;
      el('div', 'sub', row, z.visited ? `${KIND_ZH[z.kind] ?? z.kind} · 捕获 ${caught}/${z.species.length}` : '尚未到访');
      row.addEventListener('click', () => this.select(i));
    });
    keepVisible(this.rows.children[this.sel] as HTMLElement | undefined);
    this.renderEntry(zones[this.sel]);
  }

  private renderEntry(z: ZoneDexZone | undefined): void {
    const d = this.entry;
    d.textContent = '';
    if (!z) {
      el('div', 'locked', d, '这座岛上没有野外区域的资料。');
      return;
    }
    const { dex, state } = this.ctx.host;
    el('div', 'zn', d, z.name);
    const chips = el('div', 'chips', d);
    el('span', 'chip', chips, KIND_ZH[z.kind] ?? z.kind);
    if (z.levelRange) el('span', 'chip', chips, `等级 ${z.levelRange[0]}–${z.levelRange[1]}`);
    if (!z.visited) {
      el('div', 'locked', d, '还没有去过这里。到访后可以查看出现的宝可梦。');
      return;
    }
    for (const w of z.weather) el('span', 'chip', chips, w);
    el('span', 'chip', chips, `坐标 (${Math.round(z.center[0])}, ${Math.round(z.center[1])})`);
    el('span', 'chip', chips, `${z.species.length} 种宝可梦`);
    if (z.alpha) {
      const seen = dexStatus(state, z.alpha.speciesId) !== 'unknown';
      el('span', 'chip alpha', chips, `头目巢穴：${seen ? dex.species(z.alpha.speciesId).name.zh : '？？？'} Lv.${z.alpha.level}`);
    }
    if (!z.species.length) {
      el('div', 'locked', d, '这里没有野生宝可梦出没。');
      return;
    }
    const table = el('table', '', d);
    const hr = el('tr', '', el('thead', '', table));
    for (const h of ['宝可梦', '属性', '等级', '出现方式', '条件', '出现率', '努力值']) el('th', '', hr, h);
    const tb = el('tbody', '', table);
    const maxShare = Math.max(...z.species.map((s) => s.share), 0.01);
    for (const s of z.species) {
      const st = dexStatus(state, s.speciesId);
      const sp = dex.species(s.speciesId);
      const tr = el('tr', '', tb);
      const mn = el('div', `mn${st === 'unknown' ? ' unknown' : ''}`, el('td', '', tr));
      monIcon(dex, s.speciesId, mn, { size: 30, silhouette: st === 'unknown' });
      el('span', '', mn, st === 'unknown' ? '？？？' : sp.name.zh);
      if (st !== 'unknown') el('span', `mk ${st}`, mn);
      const tt = el('td', '', tr);
      if (st !== 'unknown') for (const t of sp.types) typeChip(t, tt);
      el('td', '', tr, `${s.levels[0]}–${s.levels[1]}`);
      el('td', '', tr, s.methods.join(' / '));
      el('td', '', tr, s.notes.join(' / ') || '—');
      const sh = el('td', '', tr);
      const bar = el('span', 'bar', sh);
      bar.style.width = `${Math.max(4, Math.round((s.share / maxShare) * 46))}px`;
      el('span', '', sh, `${Math.max(1, Math.round(s.share * 100))}%`);
      const ev = el('td', '', tr);
      if (st === 'unknown') ev.textContent = '？';
      else {
        const parts = STAT_IDS.filter((k) => sp.evYield[k] > 0).map((k) => `${STAT_ZH[k]}+${sp.evYield[k]}`);
        el('span', 'ev', ev, parts.join(' ') || '—');
      }
    }
  }
}

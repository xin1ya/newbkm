/**
 * 宝可梦寄放系统（电脑）界面：左侧队伍 6 格，右侧盒子 6×5 网格（16 个盒子翻页），下方详情。
 * 操作：方向键移动光标（盒子最左列再按 ← 回到队伍，队伍按 → 进入盒子）；Q / E 或 PageUp / PageDown 翻盒子；
 * 确认键弹出操作（存入 / 取出 / 与队伍交换 / 查看能力 / 放生）；返回键关闭。鼠标可直接点选。
 * 存入盒子的宝可梦会自动恢复（与正作一致）。
 */
import type { Input } from '@/core/input';
import { sfx } from '@/core/audio';
import type { Dex } from '@/systems/data/Dex';
import type { PokemonInstance } from '@/systems/pokemon';
import { IV_GRADE_ZH, STAT_IDS, displayName, healFully, ivGrade, ivOverall, ivTotal, maxHp } from '@/systems/pokemon';
import { BOX_COUNT, BOX_SIZE, PARTY_MAX, deposit, release, sortBox, swapWithParty, withdraw, type GameState, type StorageResult } from '@/systems/state';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';
import { ChoiceMenu, type ChoiceItem } from '../core/ChoiceMenu';
import { Dialog } from '../core/Dialog';
import { genderMark, hpBar, monIcon, typeChip } from '../menu/common';

const STAT_ZH: Record<string, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
const COLS = 6;

const CSS = `
.cl-pc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(12,20,36,.55);pointer-events:auto;z-index:40;font-family:system-ui}
.cl-pc .win{width:min(1040px,calc(100% - 32px));height:min(640px,calc(100% - 40px));display:grid;grid-template-columns:300px 1fr;grid-template-rows:auto 1fr 150px;gap:12px;padding:16px 18px}
.cl-pc .hd{grid-column:1/3;display:flex;align-items:center;gap:14px}
.cl-pc .hd .t{font:800 20px/1 system-ui;letter-spacing:.1em}
.cl-pc .hd .cnt{margin-left:auto;font-size:13px;color:#6a7190}
.cl-pc .party{display:flex;flex-direction:column;gap:6px;border:2px solid #d7dcea;border-radius:12px;padding:8px;background:#fff;overflow:hidden}
.cl-pc .party .h,.cl-pc .box .h{font:700 13px/1 system-ui;color:#6a7190;padding:2px 4px 6px;display:flex;align-items:center;gap:8px}
.cl-pc .slot{display:grid;grid-template-columns:44px 1fr;gap:2px 10px;align-items:center;padding:6px 8px;border-radius:10px;cursor:pointer;min-height:52px;border:2px solid transparent}
.cl-pc .slot .nm{font-weight:800;font-size:15px}
.cl-pc .slot .lv{font-size:12px;color:#6a7190}
.cl-pc .slot.empty{color:#b5bacb;font-size:13px;display:flex;justify-content:center;border:2px dashed #e1e5ef}
.cl-pc .sel{background:#e7f6ef;border-color:#3fb88a!important}
.cl-pc .held{outline:3px solid #f2b541;outline-offset:-3px}
.cl-pc .faint{opacity:.55}
.cl-pc .box{border:2px solid #d7dcea;border-radius:12px;padding:8px;background:linear-gradient(180deg,#f3f8ff,#e7f0fb);display:flex;flex-direction:column}
.cl-pc .box .h .pg{margin:0 auto;display:flex;align-items:center;gap:10px;font-size:15px;color:#27304a}
.cl-pc .box .h .arrow{width:28px;height:28px;border-radius:8px;border:2px solid #27304a;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:900}
.cl-pc .grid{flex:1;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(5,1fr);gap:6px}
.cl-pc .cell{border-radius:12px;background:rgba(255,255,255,.75);border:2px solid #dbe3f0;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;position:relative;font-size:11px;color:#4a5270}
.cl-pc .cell .lv{position:absolute;right:5px;bottom:3px;font-weight:700}
.cl-pc .detail{grid-column:1/3;border:2px solid #d7dcea;border-radius:12px;background:#fffdf7;padding:12px 16px;display:grid;grid-template-columns:auto 1fr 1fr;gap:6px 22px;align-items:start}
.cl-pc .detail .nm{font:800 20px/1.2 system-ui}
.cl-pc .detail .sub{font-size:13px;color:#6a7190;margin-top:4px}
.cl-pc .detail .kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px}
.cl-pc .detail .kv .k{color:#6a7190}
.cl-pc .detail .ivs{display:grid;grid-template-columns:repeat(3,auto);gap:4px 14px;font-size:13px}
.cl-pc .detail .ivs b{font-variant-numeric:tabular-nums}
.cl-pc .hint{grid-column:1/3;font-size:12px;color:#6a7190;text-align:center;margin-top:-6px}
.cl-pc .hint kbd{font:700 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px;background:#e4e8f2;margin:0 2px}
`;

type Cursor = { area: 'party' | 'box'; i: number };

export class PcScreen implements UiWidget {
  readonly modal = true;
  private root: HTMLDivElement;
  private partyEl!: HTMLDivElement;
  private gridEl!: HTMLDivElement;
  private pageEl!: HTMLSpanElement;
  private detailEl!: HTMLDivElement;
  private countEl!: HTMLDivElement;
  private cur: Cursor = { area: 'party', i: 0 };
  private page = 0;
  private busy = false;
  private closed = false;
  private resolve!: () => void;
  readonly done = new Promise<void>((r) => (this.resolve = r));
  private readonly onKey = (e: KeyboardEvent): void => {
    if (this.busy) return;
    if (e.code === 'KeyQ' || e.code === 'PageUp') this.flip(-1);
    else if (e.code === 'KeyE' || e.code === 'PageDown') this.flip(1);
  };

  constructor(
    private readonly ui: UiRoot,
    private readonly dex: Dex,
    private readonly state: GameState,
    title = '宝可梦寄放系统',
  ) {
    injectUiStyles(CSS);
    this.root = el('div', 'cl-pc interactive', ui.el);
    const win = el('div', 'win cl-card', this.root);
    const hd = el('div', 'hd', win);
    el('div', 't', hd, title);
    this.countEl = el('div', 'cnt', hd);
    // 队伍
    this.partyEl = el('div', 'party', win);
    // 盒子
    const box = el('div', 'box', win);
    const bh = el('div', 'h', box);
    const pg = el('div', 'pg', bh);
    const prev = el('div', 'arrow', pg, '‹');
    this.pageEl = el('span', '', pg);
    const next = el('div', 'arrow', pg, '›');
    prev.addEventListener('click', () => !this.busy && this.flip(-1));
    next.addEventListener('click', () => !this.busy && this.flip(1));
    this.gridEl = el('div', 'grid', box);
    this.detailEl = el('div', 'detail', win);
    el('div', 'hint', win).innerHTML =
      '<kbd>↑↓←→</kbd> 移动 · <kbd>Q</kbd>/<kbd>E</kbd> 切换盒子 · <kbd>确认</kbd> 操作 · <kbd>返回</kbd> 关闭电脑 · 存入盒子的宝可梦会恢复体力';
    window.addEventListener('keydown', this.onKey);
    this.render();
  }

  // ———————————————————— 数据 ————————————————————

  private boxIndex(i: number): number {
    return this.page * BOX_SIZE + i;
  }

  private current(): PokemonInstance | null {
    return this.cur.area === 'party' ? (this.state.party[this.cur.i] ?? null) : (this.state.box[this.boxIndex(this.cur.i)] ?? null);
  }

  private flip(d: number): void {
    this.page = (this.page + d + BOX_COUNT) % BOX_COUNT;
    sfx('cursor', 0.4);
    this.render();
  }

  // ———————————————————— 渲染 ————————————————————

  private render(): void {
    const { state, dex } = this;
    this.countEl.textContent = `队伍 ${state.party.length}/${PARTY_MAX} · 盒子 ${state.box.length}/${BOX_COUNT * BOX_SIZE}`;
    // 队伍
    this.partyEl.textContent = '';
    el('div', 'h', this.partyEl, '队伍');
    for (let i = 0; i < PARTY_MAX; i++) {
      const p = state.party[i];
      const on = this.cur.area === 'party' && this.cur.i === i;
      if (!p) {
        const e = el('div', `slot empty${on ? ' sel' : ''}`, this.partyEl, '（空）');
        e.addEventListener('click', () => this.click({ area: 'party', i }));
        continue;
      }
      const s = el('div', `slot${on ? ' sel' : ''}${p.hp <= 0 ? ' faint' : ''}`, this.partyEl);
      const ic = monIcon(dex, p.speciesId, s, { size: 44, shiny: p.shiny });
      ic.style.gridRow = '1 / 3';
      el('div', 'nm', s, `${displayName(dex, p)} ${genderMark(p)}`);
      const lv = el('div', 'lv', s);
      lv.append(`Lv.${p.level}  `);
      hpBar(dex, p, lv);
      s.addEventListener('click', () => this.click({ area: 'party', i }));
    }
    // 盒子
    this.pageEl.textContent = `盒子 ${this.page + 1} / ${BOX_COUNT}`;
    this.gridEl.textContent = '';
    for (let i = 0; i < BOX_SIZE; i++) {
      const p = state.box[this.boxIndex(i)];
      const on = this.cur.area === 'box' && this.cur.i === i;
      const c = el('div', `cell${on ? ' sel' : ''}`, this.gridEl);
      if (p) {
        monIcon(dex, p.speciesId, c, { size: 46, shiny: p.shiny });
        el('span', 'lv', c, `Lv.${p.level}`);
        c.title = displayName(dex, p);
      }
      c.addEventListener('click', () => this.click({ area: 'box', i }));
    }
    this.renderDetail();
  }

  private renderDetail(): void {
    const d = this.detailEl;
    d.textContent = '';
    const p = this.current();
    if (!p) {
      el('div', 'sub', d, this.cur.area === 'box' ? '空位。在队伍里选择宝可梦后可以「存入」到盒子。' : '空位。在盒子里选择宝可梦后可以「取出」。');
      return;
    }
    const sp = this.dex.species(p.speciesId);
    const a = el('div', '', d);
    el('div', 'nm', a, `${displayName(this.dex, p)} ${genderMark(p)}${p.shiny ? ' ✦' : ''}`);
    el('div', 'sub', a, `No.${String(sp.id).padStart(4, '0')} ${sp.name.zh} · Lv.${p.level}`);
    const types = el('div', '', a);
    types.style.marginTop = '6px';
    for (const t of sp.types) typeChip(t, types);
    const kv = el('div', 'kv', d);
    const row = (k: string, v: string): void => {
      el('span', 'k', kv, k);
      el('span', '', kv, v);
    };
    row('HP', `${p.hp} / ${maxHp(this.dex, p)}`);
    row('性格', this.dex.nature(p.nature).name.zh);
    row('特性', this.dex.ability(p.ability)?.name.zh ?? p.ability);
    row('携带', p.heldItem ? (this.dex.item(p.heldItem)?.name.zh ?? p.heldItem) : '无');
    row('初训家', p.ot ?? '—');
    const iv = el('div', '', d);
    el('div', 'sub', iv, `天赋：${ivOverall(p.ivs)}（合计 ${ivTotal(p.ivs)} / 186）`).style.marginTop = '0';
    const g = el('div', 'ivs', iv);
    g.style.marginTop = '6px';
    for (const k of STAT_IDS) {
      const s = el('span', '', g, `${STAT_ZH[k]} `);
      el('b', '', s, String(p.ivs[k]));
      s.append(` ${IV_GRADE_ZH[ivGrade(p.ivs[k])]}`);
    }
  }

  // ———————————————————— 交互 ————————————————————

  private click(c: Cursor): void {
    if (this.busy) return;
    const same = c.area === this.cur.area && c.i === this.cur.i;
    this.cur = c;
    this.render();
    if (same) void this.act();
  }

  private move(dx: number, dy: number): void {
    const c = this.cur;
    if (c.area === 'party') {
      if (dx > 0) this.cur = { area: 'box', i: Math.min(BOX_SIZE - COLS, Math.floor(c.i * 0.84) * COLS) };
      else if (dy) this.cur = { area: 'party', i: (c.i + dy + PARTY_MAX) % PARTY_MAX };
    } else {
      const col = c.i % COLS;
      const rowI = Math.floor(c.i / COLS);
      if (dx < 0 && col === 0) this.cur = { area: 'party', i: Math.min(PARTY_MAX - 1, Math.round(rowI * 1.25)) };
      else if (dx) this.cur = { area: 'box', i: rowI * COLS + Math.max(0, Math.min(COLS - 1, col + dx)) };
      else if (dy) this.cur = { area: 'box', i: (((rowI + dy + 5) % 5) * COLS) + col };
    }
    sfx('cursor', 0.3);
    this.render();
  }

  private async say(text: string | string[]): Promise<void> {
    await this.ui.push(new Dialog(this.ui, Array.isArray(text) ? text : [text])).done;
  }

  private async choose<T>(items: ChoiceItem<T>[]): Promise<T | null> {
    return this.ui.push(new ChoiceMenu(this.ui, items, { cancellable: true, style: { right: '60px', bottom: '190px', zIndex: '45' } })).done;
  }

  private async report(r: StorageResult, ok: string): Promise<boolean> {
    if (r.ok) {
      sfx('confirm', 0.5);
      if (ok) await this.say(ok);
      return true;
    }
    sfx('error', 0.5);
    await this.say(r.reason);
    return false;
  }

  private async act(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const p = this.current();
      const { state, dex } = this;
      if (!p) {
        if (this.cur.area === 'box') {
          const how = await this.choose<'dex' | 'level' | null>([
            { label: '按图鉴编号整理盒子', value: 'dex' },
            { label: '按等级整理盒子', value: 'level' },
            { label: '取消', value: null },
          ]);
          if (how) {
            sortBox(state, how);
            sfx('confirm', 0.5);
          }
        }
        return;
      }
      const name = displayName(dex, p);
      if (this.cur.area === 'party') {
        const a = await this.choose<'deposit' | 'release' | null>([
          { label: '存入盒子', value: 'deposit' },
          { label: '放生', value: 'release' },
          { label: '取消', value: null },
        ]);
        if (a === 'deposit') {
          const r = deposit(state, this.cur.i);
          if (r.ok) healFully(dex, p);
          await this.report(r, `${name}被存入了盒子。`);
          this.cur.i = Math.min(this.cur.i, Math.max(0, state.party.length - 1));
        } else if (a === 'release') await this.releaseFlow('party', this.cur.i, name);
      } else {
        const bi = this.boxIndex(this.cur.i);
        const a = await this.choose<'withdraw' | 'swap' | 'release' | null>([
          { label: '取出到队伍', value: 'withdraw', disabled: state.party.length >= PARTY_MAX },
          { label: '与队伍交换', value: 'swap' },
          { label: '放生', value: 'release' },
          { label: '取消', value: null },
        ]);
        if (a === 'withdraw') await this.report(withdraw(state, bi), `取出了${name}。`);
        else if (a === 'swap') {
          const j = await this.choose<number | null>([
            ...state.party.map((q, k) => ({ label: `${displayName(dex, q)}  Lv.${q.level}`, value: k as number | null })),
            { label: '取消', value: null },
          ]);
          if (j !== null) {
            const out = state.party[j]!;
            const r = swapWithParty(state, bi, j);
            if (r.ok) healFully(dex, out);
            await this.report(r, `${name}加入了队伍，${displayName(dex, out)}被存入了盒子。`);
          }
        } else if (a === 'release') await this.releaseFlow('box', bi, name);
      }
    } finally {
      this.busy = false;
      if (!this.closed) this.render();
    }
  }

  private async releaseFlow(where: 'party' | 'box', index: number, name: string): Promise<void> {
    const ok = await this.choose<boolean>([
      { label: `真的要放生${name}吗？`, value: false, disabled: true },
      { label: '放生', value: true },
      { label: '不要', value: false },
    ]);
    if (!ok) return;
    if (await this.report(release(this.state, where, index), '')) await this.say(`${name}回到了大自然……再见了，${name}！`);
  }

  update(_dt: number, input: Input): boolean | void {
    if (this.busy) return;
    if (input.pressed('uiLeft', true)) this.move(-1, 0);
    else if (input.pressed('uiRight', true)) this.move(1, 0);
    else if (input.pressed('uiUp', true)) this.move(0, -1);
    else if (input.pressed('uiDown', true)) this.move(0, 1);
    else if (input.pressed('confirm', true)) void this.act();
    else if (input.pressed('back', true)) {
      sfx('back', 0.5);
      this.closed = true;
      this.resolve();
      return true;
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    this.resolve();
  }
}

/** 打开电脑寄放系统，关闭后 resolve */
export async function openPc(ui: UiRoot, dex: Dex, state: GameState, title?: string): Promise<void> {
  const w = new PcScreen(ui, dex, state, title);
  ui.push(w);
  await w.done;
}

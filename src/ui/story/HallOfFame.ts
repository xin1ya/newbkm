/**
 * M3-21 · 名人堂界面：
 * - showHallOfFame：战胜冠军后的入殿演出——金色殿堂背景，队伍成员逐个亮相（头像 + 名字 + 等级 + 属性），
 *   全部亮相后显示「名人堂 · 第 N 次入殿」与训练家 / 游戏时间，确认键结束；
 * - browseHallOfFame：名人堂记录机浏览历次入殿（←/→ 翻页，取消键退出）。
 */
import type { Input } from '@/core/input';
import { sfx, jingle } from '@/core/audio';
import type { Dex } from '@/systems/data/Dex';
import type { HallOfFameEntry } from '@/systems/state/GameState';
import { formatPlayTime } from '@/systems/league';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';
import { monIcon, typeChip, warmMonIcons } from '../menu/common';

const CSS = `
.cl-hof{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;
  font-family:system-ui;color:#fff8e6;overflow:hidden;
  background:radial-gradient(ellipse at 50% 38%,rgba(255,222,140,.55),rgba(120,80,20,.0) 55%),linear-gradient(180deg,#2a1c08,#120c04 70%,#060402);
  animation:cl-hof-in .9s ease}
@keyframes cl-hof-in{from{opacity:0}to{opacity:1}}
.cl-hof .rays{position:absolute;left:50%;top:38%;width:180vmax;height:180vmax;transform:translate(-50%,-50%);pointer-events:none;opacity:.22;
  background:repeating-conic-gradient(from 0deg,rgba(255,230,160,.55) 0deg 6deg,transparent 6deg 18deg);animation:cl-hof-spin 60s linear infinite}
@keyframes cl-hof-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
.cl-hof h1{position:relative;font:900 44px/1.1 system-ui;letter-spacing:.3em;margin:0 0 6px;text-shadow:0 0 24px rgba(255,210,120,.8),0 2px 0 #7a5410}
.cl-hof .sub{position:relative;font-size:15px;letter-spacing:.2em;opacity:.8;margin-bottom:28px}
.cl-hof .team{position:relative;display:grid;grid-template-columns:repeat(3,minmax(170px,210px));gap:16px 18px}
.cl-hof .card{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:16px;
  background:linear-gradient(150deg,rgba(255,236,190,.18),rgba(120,80,20,.25));box-shadow:inset 0 0 0 1px rgba(255,220,140,.45),0 10px 30px rgba(0,0,0,.4);
  opacity:0;transform:translateY(18px) scale(.94);transition:opacity .5s,transform .5s}
.cl-hof .card.on{opacity:1;transform:none}
.cl-hof .card .nm{font:800 17px/1.2 system-ui}
.cl-hof .card .nk{font-size:12px;opacity:.75}
.cl-hof .card .lv{font:700 12px ui-monospace,monospace;opacity:.85;margin:3px 0 4px}
.cl-hof .card .shiny{color:#ffe27a;margin-left:4px}
.cl-hof .foot{position:relative;margin-top:28px;font-size:14px;letter-spacing:.08em;opacity:0;transition:opacity .8s;text-align:center;line-height:1.7}
.cl-hof .foot.on{opacity:.95}
.cl-hof .hint{position:absolute;bottom:22px;font-size:12px;opacity:.6}
.cl-hof .hint kbd{font:700 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,.18);margin:0 2px}
`;

class HallWidget implements UiWidget {
  readonly modal = true;
  private readonly root: HTMLDivElement;
  private cards: HTMLDivElement[] = [];
  private foot!: HTMLDivElement;
  private hint!: HTMLDivElement;
  private t = 0;
  private shown = 0;
  private page: number;
  private resolve!: () => void;
  readonly done = new Promise<void>((r) => (this.resolve = r));

  constructor(
    parent: HTMLElement,
    private readonly dex: Dex,
    private readonly entries: readonly HallOfFameEntry[],
    private readonly trainer: string,
    /** 演出模式：逐个亮相；浏览模式：直接全部显示，可翻页 */
    private readonly ceremony: boolean,
  ) {
    injectUiStyles(CSS);
    this.root = el('div', 'cl-hof', parent);
    el('div', 'rays', this.root);
    this.page = entries.length - 1;
    this.build();
  }

  private build(): void {
    for (const c of [...this.root.children]) if (!c.classList.contains('rays')) c.remove();
    const e = this.entries[this.page];
    el('h1', '', this.root, '名人堂');
    el('div', 'sub', this.root, e ? `第 ${e.n} 次入殿` : '还没有记录');
    const team = el('div', 'team', this.root);
    this.cards = [];
    for (const m of e?.team ?? []) {
      const sp = this.dex.species(m.speciesId);
      const card = el('div', 'card', team);
      monIcon(this.dex, m.speciesId, card, { size: 58, shiny: m.shiny });
      const info = el('div', '', card);
      const nm = el('div', 'nm', info, m.nickname ?? sp.name.zh);
      if (m.shiny) el('span', 'shiny', nm, '★');
      if (m.nickname) el('div', 'nk', info, sp.name.zh);
      el('div', 'lv', info, `Lv.${m.level}  初训家 ${m.ot}`);
      const types = el('div', '', info);
      for (const t of sp.types) typeChip(t, types);
      this.cards.push(card);
    }
    this.foot = el('div', 'foot', this.root);
    if (e) this.foot.innerHTML = `冠军 <b>${escapeHtml(this.trainer)}</b><br>第 ${e.day + 1} 天 · 游戏时间 ${formatPlayTime(e.playTime)}`;
    this.hint = el('div', 'hint', this.root);
    this.hint.innerHTML = this.ceremony ? '<kbd>确认</kbd> 继续' : `${this.entries.length > 1 ? '<kbd>←</kbd><kbd>→</kbd> 翻页  ' : ''}<kbd>取消</kbd> 返回`;
    if (this.ceremony) {
      this.shown = 0;
      this.hint.style.visibility = 'hidden';
    } else {
      for (const c of this.cards) c.classList.add('on');
      this.foot.classList.add('on');
      this.shown = this.cards.length + 1;
    }
  }

  update(dt: number, input: Input): boolean {
    this.t += dt;
    if (this.ceremony) {
      // 每 0.9 s 亮相一只；确认键可以跳过等待
      const skip = input.pressed('confirm', true);
      if (this.shown < this.cards.length && (this.t > 0.6 + this.shown * 0.9 || skip)) {
        this.cards[this.shown]!.classList.add('on');
        sfx('ball-open', 0.6);
        this.shown++;
        if (skip) this.t = 0.6 + this.shown * 0.9;
        return false;
      }
      if (this.shown === this.cards.length && (this.t > 0.6 + this.shown * 0.9 + 0.4 || skip)) {
        this.foot.classList.add('on');
        this.hint.style.visibility = 'visible';
        this.shown++;
        return false;
      }
      if (this.shown > this.cards.length && skip) {
        this.resolve();
        return true;
      }
      return false;
    }
    if (input.pressed('cancel', true) || input.pressed('confirm', true)) {
      sfx('back');
      this.resolve();
      return true;
    }
    const n = this.entries.length;
    if (n > 1 && input.pressed('uiLeft', true)) {
      this.page = (this.page + n - 1) % n;
      sfx('cursor');
      this.build();
    }
    if (n > 1 && input.pressed('uiRight', true)) {
      this.page = (this.page + 1) % n;
      sfx('cursor');
      this.build();
    }
    return false;
  }

  dispose(): void {
    this.root.remove();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** 入殿演出（战胜冠军后） */
export async function showHallOfFame(root: UiRoot, dex: Dex, entry: HallOfFameEntry, trainer: string): Promise<void> {
  await warmMonIcons(entry.team);
  void jingle('jingle-hall-of-fame');
  const w = new HallWidget(root.el, dex, [entry], trainer, true);
  root.push(w);
  await w.done;
}

/** 浏览历次入殿记录（名人堂记录机） */
export async function browseHallOfFame(root: UiRoot, dex: Dex, entries: readonly HallOfFameEntry[], trainer: string): Promise<void> {
  if (!entries.length) return;
  await warmMonIcons(entries[entries.length - 1]!.team);
  const w = new HallWidget(root.el, dex, entries, trainer, false);
  root.push(w);
  await w.done;
}

/**
 * SCN-001 · 战斗 HUD：双方信息面板（名字 / 性别 / 等级 / 状态徽章 / HP 条动画 / 我方经验条与 HP 数值）。
 * HP 条按「每秒 maxHp 的 70%」平滑过渡；颜色按比例绿 → 黄 → 红。
 */
import type { MajorStatus } from '@/systems/pokemon';
import { STATUS_NAMES } from '@/systems/battle';
import { el, injectUiStyles } from '@/ui/core';
import type { UiRoot } from '@/ui/core';

const CSS = /* css */ `
.cl-bpanel { position: absolute; width: 330px; padding: 10px 16px 12px; font-size: 17px; transition: transform .35s ease, opacity .35s; }
.cl-bpanel.hidden { opacity: 0; }
.cl-bpanel.foe { left: 28px; top: 26px; }
.cl-bpanel.foe.hidden { transform: translateX(-40px); }
.cl-bpanel.me { right: 28px; bottom: 190px; }
.cl-bpanel.me.hidden { transform: translateX(40px); }
.cl-bpanel .row { display: flex; align-items: baseline; gap: 8px; }
.cl-bpanel .nm { font-weight: 800; font-size: 20px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-bpanel .gd.m { color: #3a7bd5; } .cl-bpanel .gd.f { color: #e0507a; }
.cl-bpanel .lv { font-weight: 700; }
.cl-bpanel .st { font-size: 12px; font-weight: 800; color: #fff; padding: 1px 6px; border-radius: 6px; display: none; }
.cl-bpanel .st.on { display: inline-block; }
.cl-bpanel .st.brn { background: #e8703a; } .cl-bpanel .st.par { background: #d8b81c; } .cl-bpanel .st.psn, .cl-bpanel .st.tox { background: #9a4fb8; }
.cl-bpanel .st.slp { background: #8a8fa6; } .cl-bpanel .st.frz { background: #58b8e0; }
.cl-bpanel .hpw { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.cl-bpanel .hpw b { font-size: 12px; color: #f6c945; background: #27304a; padding: 0 5px; border-radius: 5px; }
.cl-bpanel .hp { flex: 1; height: 10px; border: 2px solid #27304a; border-radius: 6px; background: #3b4258; overflow: hidden; }
.cl-bpanel .hp { position: relative; }
.cl-bpanel .hp i { position: relative; display: block; height: 100%; width: 100%; background: #46c46e; }
.cl-bpanel .hp i.ghost { position: absolute; left: 0; top: 0; background: #fff3f0; opacity: 0.9; }
.cl-bpanel .num { text-align: right; font-weight: 700; font-size: 15px; margin-top: 2px; font-variant-numeric: tabular-nums; }
.cl-bpanel .exp { height: 5px; margin-top: 4px; background: #d8dbe6; border-radius: 3px; overflow: hidden; }
.cl-bpanel .exp i { display: block; height: 100%; width: 0; background: #4aa3e8; transition: width .6s ease; }
.cl-bpanel .balls { display: flex; gap: 4px; margin-top: 4px; }
.cl-bpanel .balls span { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #27304a; background: linear-gradient(#e8484a 50%, #fff 50%); }
.cl-bpanel .balls span.x { background: #9aa0b3; }
.cl-bpanel.shake { animation: cl-bshake .3s; }
@keyframes cl-bshake { 25% { margin-left: -6px; } 75% { margin-left: 6px; } }
.cl-bturn { position: absolute; right: 28px; top: 26px; font-size: 13px; color: #fff; text-shadow: 0 1px 2px #000; }
`;

export interface PanelData {
  name: string;
  level: number;
  gender: 'male' | 'female' | 'none';
  hp: number;
  maxHp: number;
  status: MajorStatus | null;
  alpha?: boolean;
  shiny?: boolean;
  /** 我方：经验进度 0–1 */
  exp?: number;
  /** 训练家战：队伍状态（true = 可战斗） */
  party?: boolean[];
}

export function hpColor(ratio: number): string {
  return ratio > 0.5 ? '#46c46e' : ratio > 0.2 ? '#f0b429' : '#e8484a';
}

class Panel {
  readonly el: HTMLDivElement;
  private nm: HTMLDivElement;
  private gd: HTMLSpanElement;
  private lv: HTMLSpanElement;
  private st: HTMLSpanElement;
  private bar: HTMLElement;
  private num: HTMLDivElement | null;
  private exp: HTMLElement | null;
  private balls: HTMLDivElement;
  private shownHp = 0;
  private targetHp = 0;
  private maxHp = 1;
  private resolveTween: (() => void) | null = null;
  /** 受伤残影：白条停留片刻再追上实际血量 */
  private ghost: HTMLElement;
  private ghostHp = 0;
  private ghostDelay = 0;

  constructor(parent: HTMLElement, readonly mine: boolean) {
    this.el = el('div', `cl-card cl-bpanel hidden ${mine ? 'me' : 'foe'}`, parent);
    const r = el('div', 'row', this.el);
    this.nm = el('div', 'nm', r);
    this.gd = el('span', 'gd', r);
    this.st = el('span', 'st', r);
    this.lv = el('span', 'lv', r);
    const w = el('div', 'hpw', this.el);
    el('b', '', w, 'HP');
    const hpBox = el('div', 'hp', w);
    this.ghost = el('i', 'ghost', hpBox);
    this.bar = el('i', '', hpBox);
    this.num = mine ? el('div', 'num', this.el) : null;
    this.exp = mine ? el('i', '', el('div', 'exp', this.el)) : null;
    this.balls = el('div', 'balls', this.el);
  }

  set(d: PanelData, instant: boolean): void {
    this.nm.textContent = `${d.name}${d.alpha ? ' ★' : ''}${d.shiny ? ' ✦' : ''}`;
    this.gd.textContent = d.gender === 'male' ? '♂' : d.gender === 'female' ? '♀' : '';
    this.gd.className = `gd ${d.gender === 'male' ? 'm' : d.gender === 'female' ? 'f' : ''}`;
    this.lv.textContent = `Lv.${d.level}`;
    this.setStatus(d.status);
    this.maxHp = Math.max(1, d.maxHp);
    this.targetHp = d.hp;
    if (instant) this.shownHp = d.hp;
    this.ghostHp = this.shownHp;
    if (this.exp && d.exp !== undefined) this.exp.style.width = `${Math.round(d.exp * 100)}%`;
    this.balls.replaceChildren();
    for (const ok of d.party ?? []) el('span', ok ? '' : 'x', this.balls);
    this.paint();
  }

  setStatus(s: MajorStatus | null): void {
    this.st.className = `st ${s ? `on ${s}` : ''}`;
    this.st.textContent = s ? STATUS_NAMES[s] : '';
  }

  setExp(ratio: number): void {
    if (this.exp) this.exp.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  }

  /** 设置目标 HP，返回过渡完成的 Promise */
  tweenTo(hp: number, maxHp: number): Promise<void> {
    this.maxHp = Math.max(1, maxHp);
    this.targetHp = Math.max(0, hp);
    if (hp < this.shownHp) {
      this.ghostHp = Math.max(this.ghostHp, this.shownHp);
      this.ghostDelay = 0.45;
      this.el.classList.remove('shake');
      void this.el.offsetWidth;
      this.el.classList.add('shake');
    }
    this.resolveTween?.();
    return new Promise((r) => (this.resolveTween = r));
  }

  update(dt: number): void {
    if (this.ghostHp > this.shownHp) {
      if (this.ghostDelay > 0) this.ghostDelay -= dt;
      else this.ghostHp = Math.max(this.shownHp, this.ghostHp - this.maxHp * 0.9 * dt);
      this.ghost.style.width = `${Math.max(0, Math.min(1, this.ghostHp / this.maxHp)) * 100}%`;
    } else if (this.ghostHp !== this.shownHp) {
      this.ghostHp = this.shownHp;
      this.ghost.style.width = '0%';
    }
    if (this.shownHp !== this.targetHp) {
      const step = this.maxHp * 0.7 * dt;
      const d = this.targetHp - this.shownHp;
      this.shownHp = Math.abs(d) <= step ? this.targetHp : this.shownHp + Math.sign(d) * step;
      this.paint();
    } else if (this.resolveTween) {
      const r = this.resolveTween;
      this.resolveTween = null;
      r();
    }
  }

  private paint(): void {
    const ratio = Math.max(0, Math.min(1, this.shownHp / this.maxHp));
    this.bar.style.width = `${ratio * 100}%`;
    this.bar.style.background = hpColor(ratio);
    if (this.num) this.num.textContent = `${Math.ceil(this.shownHp)} / ${this.maxHp}`;
  }

  show(v: boolean): void {
    this.el.classList.toggle('hidden', !v);
  }
}

export class BattleHud {
  readonly el: HTMLDivElement;
  readonly me: Panel;
  readonly foe: Panel;
  private turnEl: HTMLDivElement;

  constructor(root: UiRoot) {
    injectUiStyles(CSS);
    this.el = el('div', '', root.el);
    this.el.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    this.foe = new Panel(this.el, false);
    this.me = new Panel(this.el, true);
    this.turnEl = el('div', 'cl-bturn', this.el);
  }

  panel(side: 0 | 1): Panel {
    return side === 0 ? this.me : this.foe;
  }

  setTurn(turn: number, weather: string): void {
    this.turnEl.textContent = turn > 0 ? `第 ${turn} 回合${weather ? ` · ${weather}` : ''}` : '';
  }

  update(dt: number): void {
    this.me.update(dt);
    this.foe.update(dt);
  }

  dispose(): void {
    this.el.remove();
  }
}

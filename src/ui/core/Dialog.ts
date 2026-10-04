/**
 * UI-001 · 对话框：打字机效果（可加速 / 跳过）、多页、说话人名牌；参考真新镇 demo 的 ui.js。
 * 用法：await ui.say(['第一页', '第二页'], { speaker: '木兰博士' })
 */
import type { Input } from '@/core/input';
import { el } from './styles';
import type { UiRoot, UiWidget } from './UiRoot';
import { sfx, voiceLine, stopVoiceLine, preloadVoiceLine } from '@/core/audio';

export interface DialogOptions {
  speaker?: string;
  /** 每秒字数（设置里的文字速度） */
  cps?: number;
  /** 自动翻页（毫秒，0 = 需要按键） */
  autoMs?: number;
}

export class Dialog implements UiWidget {
  /** 全局默认文字速度（设置 → 文字速度，M1-18）；Infinity = 瞬间显示 */
  static defaultCps = 40;
  readonly modal = true;
  private box: HTMLDivElement;
  private textEl: HTMLDivElement;
  private nextEl: HTMLDivElement;
  private page = 0;
  private shown = 0;
  private wait = 0;
  private resolve!: () => void;
  readonly done: Promise<void>;

  constructor(
    root: UiRoot,
    private readonly pages: string[],
    private readonly opts: DialogOptions = {},
  ) {
    this.box = el('div', 'cl-card cl-dialog interactive', root.el);
    if (opts.speaker) el('div', 'speaker', this.box, opts.speaker);
    this.textEl = el('div', 'text', this.box);
    this.nextEl = el('div', 'next', this.box);
    this.nextEl.style.display = 'none';
    this.box.addEventListener('click', () => this.advance());
    this.done = new Promise((r) => (this.resolve = r));
    this.render();
    this.speak();
  }

  private get current(): string {
    return this.pages[this.page] ?? '';
  }

  private render(): void {
    const chars = [...this.current];
    this.textEl.textContent = chars.slice(0, Math.floor(this.shown)).join('');
    this.nextEl.style.display = this.shown >= chars.length ? 'block' : 'none';
  }

  /** 当前页有配音时不播打字音 */
  private voiced = false;

  /** 新页开始：播放配音并预取下一页 */
  private speak(): void {
    this.voiced = voiceLine(this.current);
    const next = this.pages[this.page + 1];
    if (next) preloadVoiceLine(next);
  }

  private finished = false;
  private advance(): void {
    const len = [...this.current].length;
    if (this.shown < len) {
      this.shown = len;
    } else {
      this.page++;
      stopVoiceLine();
      sfx('confirm', 0.5);
      this.shown = 0;
      this.wait = 0;
      if (this.page >= this.pages.length) {
        this.finished = true;
        this.resolve();
      }
    }
    if (!this.finished) {
      this.render();
      if (this.shown === 0) this.speak();
    }
  }

  update(dt: number, input: Input): boolean {
    if (this.finished) return true;
    const len = [...this.current].length;
    const fast = input.isDown('confirm', true) ? 3 : 1;
    if (this.shown < len) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(len, this.shown + dt * (this.opts.cps ?? Dialog.defaultCps) * fast);
      // 打字音：每 3 个字一声（空白不响）
      const after = Math.floor(this.shown);
      if (after !== before && Math.floor(after / 3) !== Math.floor(before / 3) && [...this.current][after - 1]?.trim() && !this.voiced) sfx('text', 0.6);
      this.render();
    } else if (this.opts.autoMs) {
      this.wait += dt * 1000;
      if (this.wait >= this.opts.autoMs) this.advance();
    }
    if (input.pressed('confirm', true) || input.pressed('back', true)) this.advance();
    return this.finished;
  }

  dispose(): void {
    if (this.voiced) stopVoiceLine();
    this.box.remove();
  }
}

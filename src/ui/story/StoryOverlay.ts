/**
 * M1-13 · 剧情演出 UI：
 * - narrate：全屏暗幕 + 中央逐行淡入的文字（开场梦境 / 心声），确认键翻页；
 * - card：章节 / 结尾卡（标题 + 副标题），定时或确认键关闭；
 * - dream 暗幕：梦境开始时由黑转深蓝雾，梦醒时白闪后淡出；
 * - flash：短白闪（揭穿伪装 / 灯塔点亮）。
 */
import type { Input } from '@/core/input';
import { sfx, voiceLine, stopVoiceLine, preloadVoiceLine } from '@/core/audio';
import { el } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 暗幕中的一页旁白（模态，确认翻页） */
class NarrateWidget implements UiWidget {
  readonly modal = true;
  private box: HTMLDivElement;
  private line: HTMLDivElement;
  private hint: HTMLDivElement;
  private idx = 0;
  private t = 0;
  private dreamVoice = false;
  private resolve!: () => void;
  readonly done = new Promise<void>((r) => (this.resolve = r));

  constructor(
    root: HTMLElement,
    private readonly lines: string[],
    voice: string | undefined,
  ) {
    this.dreamVoice = !!voice;
    this.box = el('div', 'cl-story-narrate interactive', root);
    Object.assign(this.box.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '18px',
      pointerEvents: 'auto',
      zIndex: '40',
    });
    if (voice) {
      const v = el('div', '', this.box, voice);
      Object.assign(v.style, { font: '600 14px/1 system-ui', letterSpacing: '0.4em', color: '#9fd8ff', opacity: '0.8' });
    }
    this.line = el('div', '', this.box);
    Object.assign(this.line.style, {
      maxWidth: '70vw',
      textAlign: 'center',
      font: '500 24px/1.7 "Noto Serif SC", "Songti SC", serif',
      color: '#eef6ff',
      textShadow: '0 0 18px rgba(120,200,255,0.65)',
      transition: 'opacity 450ms ease, transform 450ms ease',
      opacity: '0',
      transform: 'translateY(8px)',
    });
    this.hint = el('div', '', this.box, '▼');
    Object.assign(this.hint.style, { color: '#9fd8ff', fontSize: '14px', opacity: '0', transition: 'opacity 300ms' });
    this.box.addEventListener('click', () => this.advance());
    this.show();
  }

  private show(): void {
    this.line.style.opacity = '0';
    this.line.style.transform = 'translateY(8px)';
    this.hint.style.opacity = '0';
    this.t = 0;
    const text = this.lines[this.idx] ?? '';
    // 有「声音」名牌的旁白（开场梦境）用梦境混响
    voiceLine(text, { dream: this.dreamVoice });
    const next = this.lines[this.idx + 1];
    if (next) preloadVoiceLine(next);
    requestAnimationFrame(() => {
      this.line.textContent = text;
      this.line.style.opacity = '1';
      this.line.style.transform = 'translateY(0)';
    });
  }

  private advance(): void {
    if (this.t < 0.35) return;
    sfx('confirm', 0.4);
    stopVoiceLine();
    this.idx++;
    if (this.idx >= this.lines.length) {
      this.resolve();
      return;
    }
    this.show();
  }

  update(dt: number, input: Input): boolean {
    this.t += dt;
    if (this.t > 0.6) this.hint.style.opacity = String(0.5 + 0.5 * Math.sin(this.t * 5));
    if (input.pressed('confirm', true) || input.pressed('back', true)) this.advance();
    return this.idx >= this.lines.length;
  }

  dispose(): void {
    stopVoiceLine();
    this.box.remove();
  }
}

class CardWidget implements UiWidget {
  readonly modal = true;
  private box: HTMLDivElement;
  private t = 0;
  private finished = false;
  private resolve!: () => void;
  readonly done = new Promise<void>((r) => (this.resolve = r));

  constructor(
    root: HTMLElement,
    title: string,
    subtitle: string | undefined,
    private readonly ms: number,
  ) {
    this.box = el('div', 'cl-story-card interactive', root);
    Object.assign(this.box.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(12,40,58,0.92) 0%, rgba(4,10,20,0.97) 70%)',
      opacity: '0',
      transition: 'opacity 600ms ease',
      zIndex: '41',
      pointerEvents: 'auto',
    });
    const bar = el('div', '', this.box);
    Object.assign(bar.style, { width: '0px', height: '2px', background: 'linear-gradient(90deg, transparent, #7fe0c8, transparent)', transition: 'width 900ms ease', marginBottom: '22px' });
    const t = el('div', '', this.box, title);
    Object.assign(t.style, { font: '700 40px/1.2 "Noto Serif SC", serif', color: '#f4fbff', letterSpacing: '0.18em', textShadow: '0 0 24px rgba(127,224,200,0.55)' });
    if (subtitle) {
      const s = el('div', '', this.box, subtitle);
      Object.assign(s.style, { marginTop: '16px', font: '500 17px/1.6 system-ui', color: '#a9d9cc', letterSpacing: '0.1em', textAlign: 'center', whiteSpace: 'pre-line' });
    }
    const bar2 = el('div', '', this.box);
    Object.assign(bar2.style, { width: '0px', height: '2px', background: 'linear-gradient(90deg, transparent, #7fe0c8, transparent)', transition: 'width 900ms ease', marginTop: '22px' });
    requestAnimationFrame(() => {
      this.box.style.opacity = '1';
      bar.style.width = '420px';
      bar2.style.width = '420px';
    });
    this.box.addEventListener('click', () => this.close());
  }

  private close(): void {
    if (this.finished || this.t < 0.8) return;
    this.finished = true;
    this.box.style.opacity = '0';
    void wait(600).then(() => this.resolve());
  }

  update(dt: number, input: Input): boolean {
    this.t += dt;
    if (this.t * 1000 >= this.ms) this.close();
    if (input.pressed('confirm', true)) this.close();
    return false;
  }

  dispose(): void {
    this.box.remove();
  }
}

export class StoryOverlay {
  private veil: HTMLDivElement;
  private flashEl: HTMLDivElement;
  /** 当前是否在梦境暗幕中（e2e 检查） */
  dreaming = false;
  /** 最近显示的卡片标题 */
  lastCard: string | null = null;

  constructor(private readonly root: UiRoot) {
    this.veil = el('div', 'cl-story-veil', root.el);
    Object.assign(this.veil.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      opacity: '0',
      zIndex: '39',
      background: 'radial-gradient(ellipse at 50% 60%, #1b3a5c 0%, #0a1426 55%, #03060d 100%)',
    });
    // 梦境漂浮光点
    for (let i = 0; i < 26; i++) {
      const p = el('i', '', this.veil);
      const s = 2 + (i % 4);
      Object.assign(p.style, {
        position: 'absolute',
        left: `${(i * 37) % 100}%`,
        top: `${(i * 53) % 100}%`,
        width: `${s}px`,
        height: `${s}px`,
        borderRadius: '50%',
        background: i % 3 ? '#9fd8ff' : '#7fe0c8',
        boxShadow: '0 0 8px #9fd8ff',
        opacity: '0.7',
        animation: `cl-dream-float ${6 + (i % 5)}s ease-in-out ${-(i % 7)}s infinite alternate`,
      });
    }
    if (!document.getElementById('cl-story-style')) {
      const st = document.createElement('style');
      st.id = 'cl-story-style';
      st.textContent = '@keyframes cl-dream-float{0%{transform:translate(0,0);opacity:.25}100%{transform:translate(18px,-42px);opacity:.9}}';
      document.head.appendChild(st);
    }
    this.flashEl = el('div', '', root.el);
    Object.assign(this.flashEl.style, { position: 'absolute', inset: '0', background: '#fff', opacity: '0', pointerEvents: 'none', zIndex: '42' });
  }

  async dreamIn(ms = 1200): Promise<void> {
    this.dreaming = true;
    this.veil.style.transition = `opacity ${ms}ms ease`;
    this.veil.style.opacity = '1';
    await wait(ms);
  }

  async dreamOut(ms = 900): Promise<void> {
    await this.flash(260);
    this.veil.style.transition = `opacity ${ms}ms ease`;
    this.veil.style.opacity = '0';
    await wait(ms);
    this.dreaming = false;
  }

  async flash(ms = 300): Promise<void> {
    this.flashEl.style.transition = `opacity ${ms * 0.35}ms ease`;
    this.flashEl.style.opacity = '0.95';
    await wait(ms * 0.35);
    this.flashEl.style.transition = `opacity ${ms * 0.65}ms ease`;
    this.flashEl.style.opacity = '0';
    await wait(ms * 0.65);
  }

  async narrate(lines: string[], voice?: string): Promise<void> {
    const w = this.root.push(new NarrateWidget(this.root.el, lines, voice));
    await w.done;
  }

  async card(title: string, subtitle: string | undefined, ms = 4200): Promise<void> {
    this.lastCard = title;
    const w = this.root.push(new CardWidget(this.root.el, title, subtitle, ms));
    await w.done;
    this.root.remove(w);
  }

  dispose(): void {
    this.veil.remove();
    this.flashEl.remove();
  }
}

/**
 * M1-15 · 钓鱼界面（模态，锁定移动）。
 * - 蓄力：横向力度条（按住确认键，松开抛竿）
 * - 等待：浮漂动态提示「……」，轻啄时抖动，提示不要急
 * - 咬钩：闪烁的大「！」与按键提示
 * - 收线：竖向张力表（绿色舒适区 / 红色危险区 + 指针）+ 环形进度 + 鱼的挣扎指示（冲刺时抖动）
 * - 结果：一行说明后自动关闭
 * 界面本身不含规则：每帧把输入交给 step 回调（场景驱动 FishingSession），再按返回的视图状态绘制。
 */
import type { Input } from '@/core/input';
import { el, injectUiStyles } from '@/ui/core/styles';
import type { UiRoot, UiWidget } from '@/ui/core/UiRoot';

export interface FishingView {
  phase: 'aim' | 'flying' | 'wait' | 'bite' | 'reel' | 'done';
  rodName: string;
  power: number;
  charging: boolean;
  tension: number;
  progress: number;
  pull: number;
  surging: boolean;
  sweet: [number, number];
  /** 等待阶段是否刚有轻啄 */
  nibble: boolean;
  /** 结果文字（done 阶段） */
  result: string | null;
  /** 显示结果多久后关闭（秒） */
  closeAfter?: number;
}

export interface FishingStepInput {
  pressed: boolean;
  holding: boolean;
  cancel: boolean;
}

const CSS = /* css */ `
.cl-fish { position: absolute; left: 50%; bottom: 36px; transform: translateX(-50%); width: min(560px, calc(100% - 32px)); padding: 14px 20px 16px; display: grid; grid-template-columns: 1fr auto; gap: 6px 18px; align-items: center; }
.cl-fish .rod { font-size: 13px; color: #6a7190; letter-spacing: .1em; }
.cl-fish .hint { grid-column: 1; font-size: 19px; font-weight: 700; min-height: 30px; }
.cl-fish .hint kbd { display: inline-block; min-width: 26px; padding: 0 6px; margin: 0 3px; border: 2px solid #27304a; border-radius: 7px; font: 700 14px/22px system-ui; text-align: center; background: #fff; box-shadow: 0 2px 0 #27304a; }
.cl-fish .power { grid-column: 1; height: 16px; border: 3px solid #27304a; border-radius: 10px; overflow: hidden; background: #e8eef7; position: relative; }
.cl-fish .power i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #3fb88a, #f6c945 70%, #e8484a); width: 0; }
.cl-fish .power b { position: absolute; top: -2px; bottom: -2px; width: 3px; background: #27304a; left: 85%; opacity: .35; }
.cl-fish .gauge { grid-column: 2; grid-row: 1 / span 3; display: flex; gap: 14px; align-items: flex-end; }
.cl-fish .tension { width: 26px; height: 118px; border: 3px solid #27304a; border-radius: 12px; position: relative; overflow: hidden; background: linear-gradient(0deg, #9fd4ff 0%, #e8eef7 100%); }
.cl-fish .tension .sweet { position: absolute; left: 0; right: 0; background: rgba(63,184,138,.55); }
.cl-fish .tension .danger { position: absolute; left: 0; right: 0; top: 0; height: 12%; background: repeating-linear-gradient(45deg, #e8484a 0 6px, #ff8a7a 6px 12px); }
.cl-fish .tension .needle { position: absolute; left: -3px; right: -3px; height: 5px; background: #27304a; border-radius: 3px; transition: bottom .05s linear; }
.cl-fish .ring { width: 84px; height: 84px; position: relative; }
.cl-fish .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.cl-fish .ring .fish { position: absolute; left: 50%; top: 50%; width: 34px; height: 20px; margin: -10px 0 0 -17px; }
.cl-fish .ring .fish.surge { animation: cl-fish-shake .12s linear infinite; }
@keyframes cl-fish-shake { 0% { transform: translate(-2px, 1px) rotate(-8deg); } 50% { transform: translate(2px, -1px) rotate(8deg); } 100% { transform: translate(-2px, 1px) rotate(-8deg); } }
.cl-fish .bang { position: absolute; left: 50%; top: -86px; transform: translateX(-50%); font-size: 64px; font-weight: 900; color: #e8484a; text-shadow: 0 4px 0 #27304a, 0 0 18px rgba(255,255,255,.9); animation: cl-fish-bang .25s ease-in-out infinite alternate; pointer-events: none; }
@keyframes cl-fish-bang { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.18); } }
.cl-fish .dots span { animation: cl-fish-dot 1.2s infinite; opacity: .2; }
.cl-fish .dots span:nth-child(2) { animation-delay: .2s; } .cl-fish .dots span:nth-child(3) { animation-delay: .4s; }
@keyframes cl-fish-dot { 40% { opacity: 1; } }
.cl-fish.nibble .hint { animation: cl-fish-shake .15s linear 2; }
.cl-fish .foot { grid-column: 1; font-size: 12px; color: #6a7190; }
`;

const FISH_SVG = `<svg viewBox="0 0 34 20"><path d="M2 10 C8 1 20 1 26 10 C20 19 8 19 2 10 Z" fill="#4a90d9" stroke="#27304a" stroke-width="2"/><path d="M26 10 L33 3 L33 17 Z" fill="#4a90d9" stroke="#27304a" stroke-width="2" stroke-linejoin="round"/><circle cx="9" cy="8.5" r="1.8" fill="#27304a"/></svg>`;

export class FishingHud implements UiWidget {
  /** 非模态：钓鱼时鼠标保持锁定、镜头可以自由转动（玩家移动由场景屏蔽） */
  readonly modal = false;
  readonly box: HTMLDivElement;
  private rod: HTMLDivElement;
  private hint: HTMLDivElement;
  private powerBar: HTMLDivElement;
  private powerFill: HTMLElement;
  private gauge: HTMLDivElement;
  private sweetEl: HTMLDivElement;
  private needle: HTMLDivElement;
  private ringFg: SVGCircleElement;
  private fishIcon: HTMLDivElement;
  private bang: HTMLDivElement;
  private foot: HTMLDivElement;
  private closing = -1;
  view: FishingView | null = null;

  constructor(
    root: UiRoot,
    private readonly step: (dt: number, input: FishingStepInput) => FishingView,
    private readonly keys: { confirm: string; cancel: string },
  ) {
    injectUiStyles(CSS);
    this.box = el('div', 'cl-card cl-fish', root.el);
    this.rod = el('div', 'rod', this.box);
    this.gauge = el('div', 'gauge', this.box);
    const tension = el('div', 'tension', this.gauge);
    el('div', 'danger', tension);
    this.sweetEl = el('div', 'sweet', tension);
    this.needle = el('div', 'needle', tension);
    const ring = el('div', 'ring', this.gauge);
    ring.innerHTML = `<svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="#fffdf7" stroke="#e1e6f0" stroke-width="10"/><circle class="fg" cx="42" cy="42" r="34" fill="none" stroke="#3fb88a" stroke-width="10" stroke-linecap="round" stroke-dasharray="213.6" stroke-dashoffset="213.6"/></svg>`;
    this.ringFg = ring.querySelector('circle.fg') as SVGCircleElement;
    this.fishIcon = el('div', 'fish', ring);
    this.fishIcon.innerHTML = FISH_SVG;
    this.hint = el('div', 'hint', this.box);
    this.powerBar = el('div', 'power', this.box);
    this.powerFill = el('i', '', this.powerBar);
    el('b', '', this.powerBar);
    this.foot = el('div', 'foot', this.box);
    this.bang = el('div', 'bang', this.box, '！');
    this.bang.style.display = 'none';
    this.gauge.style.visibility = 'hidden';
  }

  private kbd(k: string): string {
    return `<kbd>${k}</kbd>`;
  }

  private render(v: FishingView): void {
    this.rod.textContent = `🎣 ${v.rodName}`;
    const K = this.kbd(this.keys.confirm);
    this.box.classList.toggle('nibble', v.nibble);
    this.bang.style.display = v.phase === 'bite' ? '' : 'none';
    this.powerBar.style.display = v.phase === 'aim' || v.phase === 'flying' ? '' : 'none';
    this.gauge.style.visibility = v.phase === 'reel' ? 'visible' : 'hidden';
    this.powerFill.style.width = `${Math.round(v.power * 100)}%`;
    switch (v.phase) {
      case 'aim':
        this.hint.innerHTML = v.charging ? `蓄力中……松开 ${K} 抛竿` : `按住 ${K} 蓄力，松开抛竿`;
        this.foot.textContent = `${this.keys.cancel} 收竿`;
        break;
      case 'flying':
        this.hint.textContent = '抛出去了！';
        this.foot.textContent = '';
        break;
      case 'wait':
        this.hint.innerHTML = v.nibble ? '有东西在碰浮漂……别急！' : '等待咬钩<span class="dots"><span>.</span><span>.</span><span>.</span></span>';
        this.foot.textContent = `浮漂猛地一沉时按 ${this.keys.confirm} 拉竿 · ${this.keys.cancel} 收竿`;
        break;
      case 'bite':
        this.hint.innerHTML = `上钩了！快按 ${K}！`;
        this.foot.textContent = '';
        break;
      case 'reel': {
        this.hint.innerHTML = v.surging ? '鱼在拼命挣扎！松一松线！' : v.tension > 0.85 ? '线快断了！' : `按住 ${K} 收线，松开放线`;
        this.foot.textContent = '让指针停在绿色区域里收线最快';
        const [a, b] = v.sweet;
        this.sweetEl.style.bottom = `${a * 100}%`;
        this.sweetEl.style.height = `${(b - a) * 100}%`;
        this.needle.style.bottom = `calc(${Math.min(1, v.tension) * 100}% - 2px)`;
        this.ringFg.style.strokeDashoffset = `${213.6 * (1 - Math.min(1, v.progress))}`;
        this.fishIcon.classList.toggle('surge', v.surging);
        break;
      }
      case 'done':
        this.hint.textContent = v.result ?? '';
        this.foot.textContent = '';
        break;
    }
  }

  update(dt: number, input: Input): boolean {
    if (this.closing >= 0) {
      this.closing -= dt;
      return this.closing <= 0;
    }
    const v = this.step(dt, {
      pressed: input.pressed('confirm', true) || input.pressed('sendOut', true),
      holding: input.isDown('confirm', true) || input.isDown('sendOut', true),
      cancel: input.pressed('back', true),
    });
    this.view = v;
    this.render(v);
    if (v.phase === 'done') this.closing = v.closeAfter ?? 1.2;
    return false;
  }

  dispose(): void {
    this.box.remove();
  }
}

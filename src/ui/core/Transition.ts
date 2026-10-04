/**
 * UI-001 · 转场：淡入淡出、战斗开场（放射状条纹旋转收拢 + 闪白）。
 */
import { el } from './styles';
import type { UiRoot } from './UiRoot';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class Transition {
  private fade: HTMLDivElement;
  private canvas: HTMLCanvasElement;

  constructor(root: UiRoot) {
    this.fade = el('div', 'cl-fade', root.el);
    this.canvas = el('canvas', 'cl-swirl', root.el);
    this.canvas.style.display = 'none';
  }

  async fadeOut(ms = 350, color = '#000'): Promise<void> {
    this.fade.style.background = color;
    this.fade.style.transition = `opacity ${ms}ms ease`;
    this.fade.style.opacity = '1';
    await wait(ms);
  }

  async fadeIn(ms = 350): Promise<void> {
    this.fade.style.transition = `opacity ${ms}ms ease`;
    this.fade.style.opacity = '0';
    await wait(ms);
  }

  /** 战斗开场：闪两下 → 条纹旋转覆盖屏幕 */
  async battleIntro(ms = 900, alpha = false): Promise<void> {
    for (let i = 0; i < 2; i++) {
      await this.fadeOut(70, '#fff');
      await this.fadeIn(90);
    }
    const c = this.canvas;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.display = 'block';
    const ctx = c.getContext('2d')!;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const frame = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        ctx.clearRect(0, 0, c.width, c.height);
        const cx = c.width / 2;
        const cy = c.height / 2;
        const R = Math.hypot(cx, cy) + 20;
        const n = 12;
        ctx.fillStyle = alpha ? '#5a0f1c' : '#141a33';
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2 + t * 2.2;
          const a1 = a0 + (Math.PI * 2 * t) / n;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, R, a0, a1);
          ctx.closePath();
          ctx.fill();
        }
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      frame();
    });
  }

  /** 关闭条纹（战斗场景已准备好） */
  async battleReveal(ms = 400): Promise<void> {
    this.canvas.style.transition = `opacity ${ms}ms`;
    this.canvas.style.opacity = '0';
    await wait(ms);
    this.canvas.style.display = 'none';
    this.canvas.style.opacity = '1';
    this.canvas.style.transition = '';
  }
}

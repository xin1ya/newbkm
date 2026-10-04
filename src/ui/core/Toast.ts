/**
 * 轻提示（非模态）：获得道具、阻挡提示、存档成功等。
 */
import { el } from './styles';
import type { UiRoot } from './UiRoot';

export class Toaster {
  private box: HTMLDivElement;
  private timer = 0;

  constructor(root: UiRoot) {
    this.box = el('div', 'cl-card cl-toast', root.el);
  }

  show(text: string, ms = 2200): void {
    this.box.textContent = text;
    this.box.classList.add('show');
    this.timer = ms / 1000;
  }

  update(dt: number): void {
    if (this.timer <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.box.classList.remove('show');
  }
}

/**
 * 加载界面（进度条 + 当前文件）。
 */
import { el } from '../core/styles';

export class LoadingScreen {
  private root: HTMLDivElement;
  private bar: HTMLElement;
  private msg: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'cl-loading', parent);
    el('div', 'title', this.root, '翠澜群岛');
    const bar = el('div', 'bar', this.root);
    this.bar = el('i', '', bar);
    this.msg = el('div', 'msg', this.root, '准备中…');
  }

  set(ratio: number, msg: string): void {
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    this.msg.textContent = msg;
  }

  async hide(): Promise<void> {
    this.root.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 500));
    this.root.remove();
  }
}

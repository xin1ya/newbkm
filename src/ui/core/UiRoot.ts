/**
 * UI-001 · UI 根：DOM 容器 + 模态组件栈。
 * - 栈顶组件每帧接收输入（键盘 / 手柄 / 鼠标点击由组件自己处理）
 * - 有模态组件时锁定 gameplay 输入（玩家不会边对话边走）
 */
import type { Input } from '@/core/input';
import { injectUiStyles, el } from './styles';

export interface UiWidget {
  /** 返回 true 表示已处理完毕，可以出栈 */
  update(dt: number, input: Input): boolean | void;
  dispose(): void;
  readonly modal: boolean;
}

export class UiRoot {
  readonly el: HTMLDivElement;
  private stack: UiWidget[] = [];
  private unlock: (() => void) | null = null;
  /** 本帧新压入的组件：跳过一帧输入，避免触发它的那次按键被它自己再次读取 */
  private fresh = new Set<UiWidget>();

  constructor(
    readonly input: Input,
    parent: HTMLElement = document.body,
  ) {
    injectUiStyles();
    this.el = el('div', 'cl-ui', parent);
  }

  push<T extends UiWidget>(w: T): T {
    this.stack.push(w);
    this.fresh.add(w);
    this.refreshLock();
    return w;
  }

  remove(w: UiWidget): void {
    const i = this.stack.indexOf(w);
    if (i >= 0) this.stack.splice(i, 1);
    w.dispose();
    this.refreshLock();
  }

  get busy(): boolean {
    return this.stack.some((w) => w.modal);
  }

  private refreshLock(): void {
    const need = this.busy;
    if (need && !this.unlock) this.unlock = this.input.lockGameplay();
    if (!need && this.unlock) {
      this.unlock();
      this.unlock = null;
    }
  }

  update(dt: number): void {
    const top = this.stack[this.stack.length - 1];
    if (top && this.fresh.has(top)) this.fresh.clear();
    else if (top && top.update(dt, this.input) === true) this.remove(top);
    // 非栈顶的非模态组件（提示、横幅）也要推进动画
    for (const w of [...this.stack]) if (w !== top && !w.modal && w.update(dt, this.input) === true) this.remove(w);
  }
}

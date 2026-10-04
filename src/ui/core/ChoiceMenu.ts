/**
 * UI-001 · 选择菜单：上下选择、确认、取消（返回 null）；支持禁用项、副标题、鼠标悬停/点击。
 */
import type { Input } from '@/core/input';
import { el } from './styles';
import type { UiRoot, UiWidget } from './UiRoot';
import { sfx } from '@/core/audio';

export interface ChoiceItem<T> {
  label: string;
  value: T;
  sub?: string | undefined;
  disabled?: boolean;
  /** 左侧图标（SVG 字符串，例如道具图标） */
  icon?: string | undefined;
}

export interface ChoiceOptions {
  /** CSS 定位（默认右下角，对话框上方） */
  style?: Partial<CSSStyleDeclaration>;
  cancellable?: boolean;
  initial?: number;
  columns?: number;
  /** 光标移动时回调（详情面板等） */
  onSelect?: (index: number) => void;
  /** 放在菜单顶部、横跨所有列的附加内容（如招式详情） */
  header?: HTMLElement;
}

export class ChoiceMenu<T> implements UiWidget {
  readonly modal = true;
  private box: HTMLDivElement;
  private rows: HTMLDivElement[] = [];
  private sel: number;
  private resolve!: (v: T | null) => void;
  readonly done: Promise<T | null>;
  private closed = false;

  constructor(
    root: UiRoot,
    private readonly items: ChoiceItem<T>[],
    private readonly opts: ChoiceOptions = {},
  ) {
    this.box = el('div', 'cl-card cl-menu interactive', root.el);
    Object.assign(this.box.style, { right: '40px', bottom: '170px' }, opts.style ?? {});
    if (opts.columns && opts.columns > 1) {
      this.box.style.display = 'grid';
      this.box.style.gridTemplateColumns = `repeat(${opts.columns}, 1fr)`;
    }
    if (opts.header) {
      opts.header.style.gridColumn = '1 / -1';
      this.box.appendChild(opts.header);
    }
    items.forEach((it, i) => {
      const row = el('div', `item${it.disabled ? ' disabled' : ''}`, this.box, it.label);
      if (it.icon) {
        const ic = document.createElement('span');
        ic.innerHTML = it.icon;
        ic.style.cssText = 'display:inline-flex;width:24px;height:24px;margin-right:8px;vertical-align:middle;';
        const svg = ic.firstElementChild as SVGElement | null;
        svg?.setAttribute('width', '24');
        svg?.setAttribute('height', '24');
        row.prepend(ic);
      }
      if (it.sub) el('span', 'sub', row, it.sub);
      row.addEventListener('mouseenter', () => this.select(i));
      row.addEventListener('click', () => {
        this.select(i);
        this.confirm();
      });
      this.rows.push(row);
    });
    this.sel = Math.min(items.length - 1, Math.max(0, opts.initial ?? items.findIndex((x) => !x.disabled)));
    this.done = new Promise((r) => (this.resolve = r));
    this.select(this.sel);
  }

  private select(i: number): void {
    this.sel = i;
    this.rows.forEach((r, k) => r.classList.toggle('sel', k === i));
    this.opts.onSelect?.(i);
  }

  private confirm(): void {
    const it = this.items[this.sel];
    if (!it || it.disabled) {
      sfx('error');
      return;
    }
    sfx('confirm');
    this.close(it.value);
  }

  private close(v: T | null): void {
    if (this.closed) return;
    this.closed = true;
    this.resolve(v);
  }

  update(_dt: number, input: Input): boolean {
    if (this.closed) return true;
    const cols = this.opts.columns ?? 1;
    const n = this.items.length;
    const move = (d: number) => {
      this.select((this.sel + d + n) % n);
      sfx('cursor');
    };
    if (input.pressed('uiDown', true)) move(cols);
    if (input.pressed('uiUp', true)) move(-cols);
    if (cols > 1 && input.pressed('uiRight', true)) move(1);
    if (cols > 1 && input.pressed('uiLeft', true)) move(-1);
    if (input.pressed('confirm', true)) this.confirm();
    else if (this.opts.cancellable !== false && input.pressed('back', true)) {
      sfx('back');
      this.close(null);
    }
    return this.closed;
  }

  dispose(): void {
    this.box.remove();
  }
}

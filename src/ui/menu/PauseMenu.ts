/**
 * M1-18 · 暂停菜单（设计 §9：菜单键 Esc / Tab / 手柄 Start）。
 * 结构：顶栏（标题、金钱、时间）+ 左侧栏（队伍 / 背包 / 图鉴 / 存档 / 设置 / 关闭）+ 内容页 + 底部按键提示。
 * 焦点两级：侧栏 ↑↓ 切换预览，确定 / → 进入内容；内容页里返回键回到侧栏；侧栏返回键或菜单键关闭。
 * 内容页发起的对话 / 选择压在 UI 栈上方，期间本组件不接收输入。
 */
import type { Input } from '@/core/input';
import { PAD_LABEL, keyLabel } from '@/systems/interaction';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';
import { MENU_CSS } from './styles';
import { formatPlayTime, stepIndex } from './common';
import type { MenuHost, MenuPage, PageContext } from './types';
import { PartyPage } from './pages/PartyPage';
import { BagPage } from './pages/BagPage';
import { DexPage } from './pages/DexPage';
import { ZoneDexPage } from './pages/ZoneDexPage';
import { SavePage } from './pages/SavePage';
import { QuestPage } from './pages/QuestPage';
import { SettingsPage } from './pages/SettingsPage';
import { sfx } from '@/core/audio';

const ICONS: Record<string, string> = { party: '◓', bag: '▣', dex: '▤', zones: '◈', quests: '❖', save: '✎', settings: '⚙', close: '✕' };

export type MenuTab = 'party' | 'bag' | 'dex' | 'zones' | 'quests' | 'save' | 'settings';

export class PauseMenu implements UiWidget {
  readonly modal = true;
  readonly pages: MenuPage[];
  private root: HTMLDivElement;
  private side: HTMLDivElement;
  private body: HTMLDivElement;
  private foot: HTMLDivElement;
  private meta: HTMLDivElement;
  private tabs: HTMLDivElement[] = [];
  /** 侧栏选中项（pages.length = 关闭） */
  tab = 0;
  /** 焦点在内容页 */
  inPage = false;
  private busy = false;
  private closed = false;
  private resolve!: () => void;
  readonly done: Promise<void>;

  constructor(
    private readonly ui: UiRoot,
    private readonly host: MenuHost,
    initial: MenuTab = 'party',
  ) {
    injectUiStyles(MENU_CSS);
    this.done = new Promise((r) => (this.resolve = r));
    const ctx: PageContext = {
      host,
      ui,
      run: (task) => this.run(task),
      keyLabel: (a) => this.keyLabel(a),
    };
    this.pages = [new PartyPage(ctx), new BagPage(ctx), new DexPage(ctx), new ZoneDexPage(ctx), new QuestPage(ctx), new SavePage(ctx), new SettingsPage(ctx)];
    this.root = el('div', 'cl-pause', ui.el);
    const panel = el('div', 'cl-card panel', this.root);
    const head = el('div', 'head', panel);
    el('div', 'title', head, '菜单');
    this.meta = el('div', 'meta', head);
    this.side = el('div', 'side', panel);
    this.body = el('div', 'body', panel);
    this.foot = el('div', 'foot', panel);
    this.pages.forEach((p, i) => {
      const t = el('div', 'tab interactive', this.side);
      t.dataset.tab = p.id;
      el('span', 'ico', t, ICONS[p.id] ?? '');
      el('span', '', t, p.title);
      t.addEventListener('click', () => this.clickTab(i));
      this.tabs.push(t);
      this.body.append(p.el);
    });
    el('div', 'spacer', this.side);
    const close = el('div', 'tab interactive', this.side);
    close.dataset.tab = 'close';
    el('span', 'ico', close, ICONS.close!);
    el('span', '', close, '关闭');
    close.addEventListener('click', () => this.close());
    this.tabs.push(close);
    // 点击遮罩空白处关闭
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root && !this.busy) this.close();
    });
    this.tab = Math.max(0, this.pages.findIndex((p) => p.id === initial));
    this.refresh();
  }

  get current(): MenuPage | null {
    return this.pages[this.tab] ?? null;
  }

  /** 切到某个页签（e2e / 快捷键） */
  open(tab: MenuTab, focus = true): void {
    this.tab = Math.max(0, this.pages.findIndex((p) => p.id === tab));
    this.inPage = false;
    this.refresh();
    if (focus) this.enterPage();
  }

  private clickTab(i: number): void {
    if (this.busy) return;
    if (this.inPage) this.current?.blur();
    this.inPage = false;
    this.tab = i;
    this.refresh();
    this.enterPage();
  }

  private enterPage(): void {
    const p = this.current;
    if (!p) return;
    this.inPage = true;
    p.focus();
    this.refresh();
  }

  private leavePage(): void {
    this.current?.blur();
    this.inPage = false;
    this.refresh();
  }

  private run(task: () => Promise<void>): void {
    if (this.busy) return;
    this.busy = true;
    void task()
      .catch((err) => console.error('[menu]', err))
      .finally(() => {
        this.busy = false;
        this.current?.render();
        this.refresh();
      });
  }

  private keyLabel(a: 'confirm' | 'back' | 'menu' | 'uiLeft' | 'uiRight'): string {
    const input = this.ui.input;
    const b = input.bindings[a];
    if (input.device === 'gamepad' && b.pad?.length) return PAD_LABEL[b.pad[0]!] ?? '?';
    // 优先显示字母键（返回键的 Esc 同时是菜单键，显示 Q 更不容易误解）
    const menuKeys = new Set(input.bindings.menu.keys);
    const k = b.keys.find((x) => x.startsWith('Key') && (a === 'menu' || !menuKeys.has(x))) ?? b.keys.find((x) => a === 'menu' || !menuKeys.has(x)) ?? b.keys[0];
    return keyLabel(k ?? '?');
  }

  private refresh(): void {
    const s = this.host.state;
    this.meta.innerHTML = '';
    el('span', '', this.meta, s.player.name);
    el('span', 'cl-money', this.meta, `¥${s.money.toLocaleString()}`);
    el('span', '', this.meta, `⏱ ${formatPlayTime(s.playTime)}`);
    el('span', '', this.meta, this.host.clock());
    this.tabs.forEach((t, i) => t.classList.toggle('sel', i === this.tab));
    this.side.classList.toggle('inactive', this.inPage);
    this.pages.forEach((p, i) => p.el.classList.toggle('show', i === this.tab));
    const cur = this.current;
    if (cur && !this.inPage) cur.show();
    const k = (a: 'confirm' | 'back' | 'menu') => this.keyLabel(a);
    this.foot.innerHTML = this.inPage && cur ? `${cur.hints()}\u3000<kbd>${k('menu')}</kbd>关闭菜单` : `<kbd>↑↓</kbd>选择\u3000<kbd>${k('confirm')}</kbd>进入\u3000<kbd>${k('back')}</kbd>/<kbd>${k('menu')}</kbd>关闭菜单`;
  }

  update(_dt: number, input: Input): boolean {
    if (this.closed) return true;
    if (this.busy) return false;
    if (input.pressed('menu', true)) {
      this.close();
      return true;
    }
    if (this.inPage) {
      const cur = this.current;
      if (cur?.handle(input) === 'exit') this.leavePage();
      else if (!this.busy) this.refresh();
      return false;
    }
    const n = this.tabs.length;
    if (input.pressed('uiUp', true)) {
      this.tab = stepIndex(this.tab, -1, n);
      sfx('cursor');
      this.refresh();
    } else if (input.pressed('uiDown', true)) {
      this.tab = stepIndex(this.tab, 1, n);
      sfx('cursor');
      this.refresh();
    } else if (input.pressed('confirm', true) || input.pressed('uiRight', true)) {
      sfx('confirm');
      if (this.tab === this.pages.length) this.close();
      else this.enterPage();
    } else if (input.pressed('back', true)) this.close();
    return this.closed;
  }

  close(): void {
    if (this.closed) return;
    sfx('menu-close');
    this.closed = true;
    this.resolve();
    // UiRoot 会在 update 返回 true 时移除；由点击触发的关闭在下一帧返回 true
  }

  dispose(): void {
    this.root.remove();
  }
}

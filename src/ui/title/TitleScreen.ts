/**
 * 标题画面：继续游戏 / 新游戏 / 读取存档（3 个存档位）。
 * 在 Game 创建之前显示（自带键盘 / 鼠标监听，不依赖 Input / UiRoot）。
 * - 继续游戏：最近一次存档的档位；
 * - 新游戏：选档位，已有存档的需二次确认覆盖；
 * - 读取存档：任选有存档的档位，也可删除（二次确认）。
 */
import { el, injectUiStyles } from '../core/styles';

export interface TitleSlotSummary {
  playerName?: string;
  playTime?: number;
  badges?: number;
  caught?: number;
  location?: string;
  partySpecies?: number[];
}

export interface TitleSlot {
  slot: string;
  label: string;
  /** null = 空档位 */
  summary: TitleSlotSummary | null;
  savedAt: string | null;
}

export type TitleResult = { mode: 'continue' | 'load' | 'new'; slot: string };

const CSS = `
.cl-title{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;font-family:system-ui;color:#f3fbfa;
  background:radial-gradient(ellipse at 50% 35%,#2f8f8a 0%,#16535e 45%,#0b2733 100%);overflow:hidden;user-select:none}
.cl-title .waves{position:absolute;left:-10%;right:-10%;bottom:-6%;height:42%;opacity:.35;
  background:repeating-radial-gradient(ellipse at 50% 120%,rgba(255,255,255,.25) 0 2px,transparent 3px 26px);animation:clt-wave 9s linear infinite}
@keyframes clt-wave{from{transform:translateY(0)}50%{transform:translateY(-14px)}to{transform:translateY(0)}}
.cl-title .inner{position:relative;display:flex;flex-direction:column;align-items:center;gap:30px;min-width:420px}
.cl-title .logo{text-align:center}
.cl-title .logo .zh{font:900 64px/1 system-ui;letter-spacing:.18em;text-shadow:0 4px 0 #0d3b44,0 10px 30px rgba(0,0,0,.45)}
.cl-title .logo .en{margin-top:10px;font:700 14px/1 system-ui;letter-spacing:.5em;opacity:.75}
.cl-title .menu{display:flex;flex-direction:column;gap:10px;width:320px}
.cl-title .it{padding:13px 20px;border-radius:12px;background:rgba(8,30,38,.55);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);
  font:700 18px/1 system-ui;letter-spacing:.12em;text-align:center;cursor:pointer;transition:transform .15s,background .15s,box-shadow .15s}
.cl-title .it small{display:block;margin-top:6px;font:500 12px/1.3 system-ui;letter-spacing:0;opacity:.7}
.cl-title .it.sel{background:rgba(255,255,255,.95);color:#12424b;transform:scale(1.04);box-shadow:0 8px 24px rgba(0,0,0,.35)}
.cl-title .it.off{opacity:.38;cursor:default}
.cl-title .slots{display:flex;flex-direction:column;gap:12px;width:min(560px,90vw)}
.cl-title .slot{display:grid;grid-template-columns:76px 1fr auto;gap:4px 14px;align-items:center;padding:14px 18px;border-radius:14px;cursor:pointer;
  background:rgba(8,30,38,.6);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);transition:transform .15s,background .15s}
.cl-title .slot.sel{background:rgba(255,255,255,.95);color:#12424b;transform:scale(1.02)}
.cl-title .slot .no{grid-row:1/3;font:800 15px/1 system-ui;letter-spacing:.08em;opacity:.8}
.cl-title .slot .nm{font:800 19px/1.2 system-ui}
.cl-title .slot .meta{font-size:13px;opacity:.75;grid-column:2/4}
.cl-title .slot .when{font-size:12px;opacity:.65;text-align:right}
.cl-title .slot.empty .nm{opacity:.5;font-weight:600}
.cl-title .hdr{font:800 22px/1 system-ui;letter-spacing:.15em}
.cl-title .hint{font-size:13px;opacity:.7}
.cl-title .hint kbd{font:700 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,.2);margin:0 2px}
.cl-title .confirm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}
.cl-title .confirm .box{min-width:360px;max-width:480px;padding:24px 26px;border-radius:16px;background:#f7fbfb;color:#12424b;display:flex;flex-direction:column;gap:16px}
.cl-title .confirm .msg{font-size:15px;line-height:1.6;white-space:pre-line}
.cl-title .confirm .btns{display:flex;gap:10px;justify-content:flex-end}
.cl-title .confirm .b{padding:9px 18px;border-radius:10px;font-weight:700;cursor:pointer;background:#e4eef0}
.cl-title .confirm .b.sel{background:#12424b;color:#fff}
.cl-title .ver{position:absolute;right:14px;bottom:10px;font-size:11px;opacity:.5}
`;

function playTime(sec = 0): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Item = { el: HTMLElement; enabled: boolean; run: () => void };

export class TitleScreen {
  private root: HTMLDivElement;
  private inner: HTMLDivElement;
  private items: Item[] = [];
  private sel = 0;
  private back: (() => void) | null = null;
  private modal: { items: Item[]; sel: number; cancel: () => void } | null = null;
  private resolve!: (r: TitleResult) => void;
  private readonly onKey = (e: KeyboardEvent): void => this.key(e);

  constructor(
    parent: HTMLElement,
    private slots: TitleSlot[],
    private readonly o: { version?: string; remove: (slot: string) => Promise<void> },
  ) {
    injectUiStyles(CSS);
    this.root = el('div', 'cl-title', parent);
    el('div', 'waves', this.root);
    this.inner = el('div', 'inner', this.root);
    if (o.version) el('div', 'ver', this.root, o.version);
    window.addEventListener('keydown', this.onKey);
  }

  /** 显示并等待玩家选择 */
  run(): Promise<TitleResult> {
    const p = new Promise<TitleResult>((r) => (this.resolve = r));
    this.main();
    return p;
  }

  private latest(): TitleSlot | null {
    return this.slots.filter((s) => s.summary).sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))[0] ?? null;
  }

  private finish(r: TitleResult): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.style.transition = 'opacity .45s';
    this.root.style.opacity = '0';
    window.setTimeout(() => this.root.remove(), 460);
    this.resolve(r);
  }

  private clear(): void {
    this.inner.textContent = '';
    this.items = [];
    this.sel = 0;
  }

  private logo(): void {
    const l = el('div', 'logo', this.inner);
    el('div', 'zh', l, '翠澜群岛');
    el('div', 'en', l, 'CUILAN ISLANDS');
  }

  private add(node: HTMLElement, enabled: boolean, run: () => void, list = this.items): void {
    const i = list.length;
    const item = { el: node, enabled, run };
    list.push(item);
    if (!enabled) node.classList.add('off');
    node.addEventListener('mouseenter', () => {
      if (!enabled) return;
      if (list === this.modal?.items) this.modal.sel = i;
      else if (!this.modal) this.sel = i;
      this.paint();
    });
    node.addEventListener('click', () => {
      if (!enabled) return;
      if (this.modal && list !== this.modal.items) return;
      run();
    });
  }

  private paint(): void {
    this.items.forEach((it, i) => it.el.classList.toggle('sel', !this.modal && i === this.sel));
    this.modal?.items.forEach((it, i) => it.el.classList.toggle('sel', i === this.modal!.sel));
  }

  private main(): void {
    this.clear();
    this.back = null;
    this.listMode = null;
    this.logo();
    const menu = el('div', 'menu', this.inner);
    const last = this.latest();
    const cont = el('div', 'it', menu, '继续游戏');
    if (last?.summary) el('small', '', cont, `${last.label} · ${last.summary.playerName ?? ''} · ${last.summary.location ?? ''} · ${playTime(last.summary.playTime)}`);
    this.add(cont, !!last, () => last && this.finish({ mode: 'continue', slot: last.slot }));
    this.add(el('div', 'it', menu, '新游戏'), true, () => this.slotList('new'));
    this.add(el('div', 'it', menu, '读取存档'), this.slots.some((s) => s.summary), () => this.slotList('load'));
    this.hint('<kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 确定');
    this.sel = last ? 0 : 1;
    this.paint();
  }

  private hint(html: string): void {
    el('div', 'hint', this.inner).innerHTML = html;
  }

  private slotList(mode: 'new' | 'load'): void {
    this.clear();
    this.back = () => this.main();
    el('div', 'hdr', this.inner, mode === 'new' ? '新游戏 · 选择存档位' : '读取存档');
    const box = el('div', 'slots', this.inner);
    for (const s of this.slots) {
      const row = el('div', `slot${s.summary ? '' : ' empty'}`, box);
      el('div', 'no', row, s.label);
      const sm = s.summary;
      el('div', 'nm', row, sm ? sm.playerName ?? '训练家' : '— 空档位 —');
      el('div', 'when', row, when(s.savedAt));
      if (sm) el('div', 'meta', row, `${sm.location ?? ''}\u3000徽章 ${sm.badges ?? 0}\u3000图鉴 ${sm.caught ?? 0}\u3000队伍 ${sm.partySpecies?.length ?? 0}\u3000游戏时间 ${playTime(sm.playTime)}`);
      const enabled = mode === 'new' || !!sm;
      this.add(row, enabled, () => {
        if (mode === 'load') return this.finish({ mode: 'load', slot: s.slot });
        if (!sm) return this.finish({ mode: 'new', slot: s.slot });
        void this.confirm(`${s.label}已有存档：\n${sm.playerName ?? ''} · ${sm.location ?? ''} · 游戏时间 ${playTime(sm.playTime)}\n\n开始新游戏会覆盖这个存档，确定吗？`, '覆盖并开始').then((ok) => {
          if (ok) this.finish({ mode: 'new', slot: s.slot });
        });
      });
    }
    this.hint(
      mode === 'load'
        ? '<kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 读取 · <kbd>Delete</kbd> 删除存档 · <kbd>Esc</kbd> 返回'
        : '<kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 确定 · <kbd>Esc</kbd> 返回',
    );
    const first = this.items.findIndex((i) => i.enabled);
    this.sel = Math.max(0, first);
    this.listMode = mode;
    this.paint();
  }

  private listMode: 'new' | 'load' | null = null;

  private async removeSelected(): Promise<void> {
    if (this.listMode !== 'load') return;
    const s = this.slots[this.sel];
    if (!s?.summary) return;
    const ok = await this.confirm(`确定要删除${s.label}（${s.summary.playerName ?? ''}）吗？\n删除后无法恢复。`, '删除');
    if (!ok) return;
    await this.o.remove(s.slot);
    this.slots = this.slots.map((x) => (x.slot === s.slot ? { ...x, summary: null, savedAt: null } : x));
    if (this.slots.some((x) => x.summary)) this.slotList('load');
    else this.main();
  }

  private confirm(msg: string, okLabel: string): Promise<boolean> {
    return new Promise((resolve) => {
      const wrap = el('div', 'confirm', this.root);
      const box = el('div', 'box', wrap);
      el('div', 'msg', box, msg);
      const btns = el('div', 'btns', box);
      const done = (v: boolean): void => {
        wrap.remove();
        this.modal = null;
        this.paint();
        resolve(v);
      };
      const items: Item[] = [];
      this.modal = { items, sel: 1, cancel: () => done(false) };
      this.add(el('div', 'b', btns, okLabel), true, () => done(true), items);
      this.add(el('div', 'b', btns, '取消'), true, () => done(false), items);
      this.paint();
    });
  }

  private key(e: KeyboardEvent): void {
    const m = this.modal;
    const list = m ? m.items : this.items;
    const move = (d: number): void => {
      const n = list.length;
      let i = m ? m.sel : this.sel;
      for (let k = 0; k < n; k++) {
        i = (i + d + n) % n;
        if (list[i]!.enabled) break;
      }
      if (m) m.sel = i;
      else this.sel = i;
      this.paint();
    };
    const prev = m ? ['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'] : ['ArrowUp', 'KeyW'];
    const next = m ? ['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'] : ['ArrowDown', 'KeyS'];
    if (prev.includes(e.code)) move(-1);
    else if (next.includes(e.code)) move(1);
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
      const it = list[m ? m.sel : this.sel];
      if (it?.enabled) it.run();
    } else if (e.code === 'Escape' || e.code === 'Backspace') {
      if (m) m.cancel();
      else this.back?.();
    } else if (e.code === 'Delete' && !m) void this.removeSelected();
    else return;
    e.preventDefault();
  }
}

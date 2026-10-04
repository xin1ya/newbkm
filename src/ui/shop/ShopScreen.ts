/**
 * M1-19 · 商店界面（模态）。
 * 流程：选择「购买 / 出售 / 离开」→ 物品列表（价格、持有数、说明）→ 数量（←→ ±1，↑↓ ±10）→ 确认 → 店员回应。
 * - 买不起 / 背包放不下的数量不可选；买 10 个以上精灵球赠送（逻辑在 systems/shop）
 * - 出售列表来自背包（重要物品、没有定价的物品不显示）
 * - 键盘 / 手柄 / 鼠标都可操作；Q / Esc 逐级返回
 * 规则全部通过 ShopHost 注入，界面只负责交互与显示。
 */
import type { Input } from '@/core/input';
import { sfx } from '@/core/audio';
import { el, injectUiStyles } from '@/ui/core/styles';
import { itemIconEl } from '@/ui/core/itemIcons';
import type { UiRoot, UiWidget } from '@/ui/core/UiRoot';

export interface ShopLine {
  id: string;
  name: string;
  desc: string;
  price: number;
  owned: number;
  /** 分类标签（精灵球 / 药品……） */
  tag: string;
}

export interface ShopHost {
  shopName: string;
  greeting: string;
  clerk: string;
  canSell: boolean;
  money(): number;
  buyList(): ShopLine[];
  sellList(): ShopLine[];
  /** 本次最多可买（钱 / 背包上限） */
  maxBuy(id: string): number;
  buy(id: string, qty: number): { ok: boolean; message: string; bonus?: string };
  sell(id: string, qty: number): { ok: boolean; message: string };
}

type Mode = 'root' | 'list' | 'qty' | 'confirm' | 'message';

const CSS = /* css */ `
.cl-shop { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(12,20,40,.35); pointer-events: auto; }
.cl-shop .win { width: min(900px, calc(100% - 32px)); height: min(560px, calc(100% - 60px)); display: grid; grid-template-columns: 1.25fr 1fr; grid-template-rows: auto 1fr auto; gap: 12px; padding: 16px 18px; }
.cl-shop .head { grid-column: 1 / span 2; display: flex; align-items: center; gap: 14px; }
.cl-shop .head .title { font-size: 24px; font-weight: 800; letter-spacing: .08em; }
.cl-shop .head .tabs { display: flex; gap: 8px; margin-left: 8px; }
.cl-shop .head .tab { padding: 4px 14px; border-radius: 10px; border: 2px solid #27304a; font-weight: 700; cursor: pointer; background: #fff; }
.cl-shop .head .tab.on { background: #3fb88a; color: #fff; }
.cl-shop .head .tab.sel { box-shadow: 0 0 0 3px #f6c945; }
.cl-shop .head .money { margin-left: auto; padding: 4px 14px; border-radius: 10px; background: #27304a; color: #f6c945; font-weight: 800; font-size: 18px; font-variant-numeric: tabular-nums; }
.cl-shop .list { overflow-y: auto; border: 2px solid #d7dcea; border-radius: 12px; padding: 6px; background: #fff; }
.cl-shop .row { display: grid; grid-template-columns: 1fr auto 70px; gap: 10px; align-items: center; padding: 8px 12px 8px 28px; border-radius: 10px; font-size: 17px; cursor: pointer; position: relative; }
.cl-shop .row.sel { background: #e7f6ef; }
.cl-shop .row.sel::before { content: ''; position: absolute; left: 10px; top: 50%; margin-top: -7px; border-left: 11px solid #27304a; border-top: 7px solid transparent; border-bottom: 7px solid transparent; }
.cl-shop .row.poor .price { color: #c0392b; }
.cl-shop .row .nm { display: inline-flex; align-items: center; gap: 8px; }
.cl-shop .row .tag { font-size: 11px; color: #6a7190; margin-left: 8px; }
.cl-shop .row .price { font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
.cl-shop .row .own { font-size: 13px; color: #6a7190; text-align: right; font-variant-numeric: tabular-nums; }
.cl-shop .row.empty { color: #9aa0b3; cursor: default; }
.cl-shop .detail { display: flex; flex-direction: column; gap: 10px; }
.cl-shop .detail .icon { width: 86px; height: 86px; border-radius: 50%; border: 3px solid #27304a; display: flex; align-items: center; justify-content: center; font-size: 40px; background: #f3f6fb; align-self: center; }
.cl-shop .detail .name { font-size: 22px; font-weight: 800; text-align: center; }
.cl-shop .detail .desc { font-size: 15px; line-height: 1.6; color: #394162; min-height: 72px; }
.cl-shop .detail .owned { font-size: 14px; color: #6a7190; }
.cl-shop .qty { border: 3px solid #27304a; border-radius: 12px; padding: 10px 14px; background: #fffdf7; display: none; }
.cl-shop .qty.show { display: block; }
.cl-shop .qty .n { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
.cl-shop .qty .n small { font-size: 14px; color: #6a7190; margin-left: 6px; }
.cl-shop .qty .sum { font-size: 17px; font-weight: 700; margin-top: 4px; }
.cl-shop .qty .keys { font-size: 12px; color: #6a7190; margin-top: 6px; }
.cl-shop .talk { grid-column: 1 / span 2; min-height: 56px; border-top: 2px dashed #d7dcea; padding-top: 10px; font-size: 18px; display: flex; gap: 12px; align-items: center; }
.cl-shop .talk .who { background: #3fb88a; color: #fff; border: 2px solid #27304a; border-radius: 10px; padding: 1px 10px; font-size: 14px; font-weight: 700; white-space: nowrap; }
.cl-shop .yn { display: inline-flex; gap: 8px; margin-left: auto; }
.cl-shop .yn span { padding: 3px 14px; border: 2px solid #27304a; border-radius: 9px; cursor: pointer; font-weight: 700; }
.cl-shop .yn span.sel { background: #27304a; color: #fff; }
`;

/** 分类标签 → 口袋（图标回退用） */
const TAG_POCKET: Record<string, string> = { 精灵球: 'balls', 药品: 'medicine', 树果: 'berries', 进化道具: 'evolution', 携带物: 'held', 招式学习器: 'tms' };

export class ShopScreen implements UiWidget {
  readonly modal = true;
  readonly el: HTMLDivElement;
  private tabs: HTMLDivElement[] = [];
  private moneyEl: HTMLDivElement;
  private listEl: HTMLDivElement;
  private icon: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private descEl: HTMLDivElement;
  private ownedEl: HTMLDivElement;
  private qtyEl: HTMLDivElement;
  private talkText: HTMLSpanElement;
  private ynEl: HTMLSpanElement;
  mode: Mode = 'root';
  tab: 'buy' | 'sell' | 'leave' = 'buy';
  private rootSel = 0;
  private lines: ShopLine[] = [];
  sel = 0;
  qty = 1;
  private yes = true;
  private messageTimer = 0;
  private afterMessage: Mode = 'list';
  private closed = false;
  private resolve!: () => void;
  readonly done: Promise<void>;
  /** 调试：最近一次店员台词 */
  talk = '';

  constructor(
    root: UiRoot,
    private readonly host: ShopHost,
  ) {
    injectUiStyles(CSS);
    this.el = el('div', 'cl-shop interactive', root.el);
    const win = el('div', 'cl-card win', this.el);
    const head = el('div', 'head', win);
    el('div', 'title', head, host.shopName);
    const tabs = el('div', 'tabs', head);
    const tabDefs: ['buy' | 'sell' | 'leave', string][] = [
      ['buy', '购买'],
      ['sell', '出售'],
      ['leave', '离开'],
    ];
    tabDefs.forEach(([id, label], i) => {
      const t = el('div', 'tab', tabs, label);
      if (id === 'sell' && !host.canSell) t.style.opacity = '.4';
      t.addEventListener('click', () => {
        this.rootSel = i;
        this.pickRoot();
      });
      this.tabs.push(t);
    });
    this.moneyEl = el('div', 'money', head);
    this.listEl = el('div', 'list', win);
    const detail = el('div', 'detail', win);
    this.icon = el('div', 'icon', detail);
    this.nameEl = el('div', 'name', detail);
    this.descEl = el('div', 'desc', detail);
    this.ownedEl = el('div', 'owned', detail);
    this.qtyEl = el('div', 'qty', detail);
    const talk = el('div', 'talk', win);
    el('span', 'who', talk, host.clerk);
    this.talkText = el('span', '', talk);
    this.ynEl = el('span', 'yn', talk);
    this.done = new Promise((r) => (this.resolve = r));
    this.say(host.greeting);
    this.refresh();
    sfx('menu-open');
  }

  private say(t: string): void {
    this.talk = t;
    this.talkText.textContent = t;
  }

  private money(n: number): string {
    return `¥ ${n.toLocaleString('zh-CN')}`;
  }

  private loadLines(): void {
    this.lines = this.tab === 'sell' ? this.host.sellList() : this.host.buyList();
    this.sel = Math.max(0, Math.min(this.sel, this.lines.length - 1));
  }

  private refresh(): void {
    this.moneyEl.textContent = this.money(this.host.money());
    const ids = ['buy', 'sell', 'leave'];
    this.tabs.forEach((t, i) => {
      t.classList.toggle('on', ids[i] === this.tab && this.mode !== 'root');
      t.classList.toggle('sel', this.mode === 'root' && i === this.rootSel);
    });
    // 列表
    this.listEl.innerHTML = '';
    if (this.mode === 'root') {
      el('div', 'row empty', this.listEl, '← → 选择，确认键进入');
    } else if (!this.lines.length) {
      el('div', 'row empty', this.listEl, this.tab === 'sell' ? '没有可以出售的东西。' : '暂时没有商品。');
    } else {
      this.lines.forEach((l, i) => {
        const poor = this.tab === 'buy' && l.price > this.host.money();
        const row = el('div', `row${i === this.sel ? ' sel' : ''}${poor ? ' poor' : ''}`, this.listEl);
        const name = el('span', 'nm', row);
        name.append(itemIconEl(l.id, 26, { pocket: TAG_POCKET[l.tag] }));
        name.append(l.name);
        el('span', 'tag', name, l.tag);
        el('span', 'price', row, this.money(l.price));
        el('span', 'own', row, `持有 ${l.owned}`);
        row.addEventListener('mouseenter', () => {
          if (this.mode === 'list') {
            this.sel = i;
            this.refreshDetail();
            this.listEl.querySelectorAll('.row').forEach((r, k) => r.classList.toggle('sel', k === i));
          }
        });
        row.addEventListener('click', () => {
          if (this.mode !== 'list') return;
          this.sel = i;
          this.pickItem();
        });
      });
      const selRow = this.listEl.children[this.sel] as HTMLElement | undefined;
      selRow?.scrollIntoView?.({ block: 'nearest' });
    }
    this.refreshDetail();
    // 数量
    const cur = this.lines[this.sel];
    this.qtyEl.classList.toggle('show', (this.mode === 'qty' || this.mode === 'confirm') && !!cur);
    if (cur && (this.mode === 'qty' || this.mode === 'confirm')) {
      this.qtyEl.innerHTML = '';
      const n = el('div', 'n', this.qtyEl, `× ${this.qty}`);
      el('small', '', n, `/ 最多 ${this.maxQty()}`);
      el('div', 'sum', this.qtyEl, `${this.tab === 'sell' ? '可得' : '合计'} ${this.money(cur.price * this.qty)}`);
      el('div', 'keys', this.qtyEl, '←→ ±1　↑↓ ±10　确认 / 返回');
    }
    this.ynEl.innerHTML = '';
    if (this.mode === 'confirm') {
      for (const [label, v] of [
        ['好的', true],
        ['算了', false],
      ] as const) {
        const b = el('span', v === this.yes ? 'sel' : '', this.ynEl, label);
        b.addEventListener('click', () => {
          this.yes = v;
          this.confirmTrade();
        });
      }
    }
  }

  private refreshDetail(): void {
    const cur = this.mode === 'root' ? null : this.lines[this.sel];
    this.icon.textContent = '';
    if (cur) this.icon.append(itemIconEl(cur.id, 60, { pocket: TAG_POCKET[cur.tag] }));
    else this.icon.textContent = '🛒';
    this.nameEl.textContent = cur?.name ?? this.host.shopName;
    this.descEl.textContent = cur?.desc ?? (this.tab === 'sell' ? '出售价格为买入价的一半。' : '');
    this.ownedEl.textContent = cur ? `背包里有 ${cur.owned} 个` : '';
  }

  private maxQty(): number {
    const cur = this.lines[this.sel];
    if (!cur) return 0;
    return this.tab === 'sell' ? Math.min(99, cur.owned) : this.host.maxBuy(cur.id);
  }

  private pickRoot(): void {
    const t = (['buy', 'sell', 'leave'] as const)[this.rootSel]!;
    if (t === 'leave') {
      this.close();
      return;
    }
    if (t === 'sell' && !this.host.canSell) {
      sfx('error');
      this.say('抱歉，我们这里只卖不收。');
      return;
    }
    sfx('confirm');
    this.tab = t;
    this.sel = 0;
    this.mode = 'list';
    this.loadLines();
    this.say(t === 'buy' ? '请慢慢挑选。' : '想卖点什么呢？');
    this.refresh();
  }

  private pickItem(): void {
    const cur = this.lines[this.sel];
    if (!cur) return;
    const max = this.maxQty();
    if (max <= 0) {
      sfx('error');
      this.say(this.tab === 'buy' ? (cur.price > this.host.money() ? '您的钱好像不够……' : '背包里已经放不下了。') : '没有可以出售的数量。');
      return;
    }
    sfx('confirm');
    this.qty = 1;
    this.mode = 'qty';
    this.say(this.tab === 'buy' ? `${cur.name}，要买几个？` : `${cur.name}，要卖几个？`);
    this.refresh();
  }

  private toConfirm(): void {
    const cur = this.lines[this.sel]!;
    sfx('confirm');
    this.mode = 'confirm';
    this.yes = true;
    const total = this.money(cur.price * this.qty);
    this.say(this.tab === 'buy' ? `${cur.name} × ${this.qty}，一共 ${total}，可以吗？` : `${cur.name} × ${this.qty}，我出 ${total} 收购，可以吗？`);
    this.refresh();
  }

  private confirmTrade(): void {
    const cur = this.lines[this.sel];
    if (!cur) return;
    if (!this.yes) {
      sfx('back');
      this.mode = 'list';
      this.say('还需要别的吗？');
      this.refresh();
      return;
    }
    const r = this.tab === 'buy' ? this.host.buy(cur.id, this.qty) : this.host.sell(cur.id, this.qty);
    if (r.ok) sfx('money');
    else sfx('error');
    const bonus = 'bonus' in r && r.bonus ? `\n${r.bonus}` : '';
    this.say(r.message + bonus);
    this.loadLines();
    this.mode = 'message';
    this.messageTimer = 1.3;
    this.afterMessage = 'list';
    this.refresh();
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    sfx('menu-close');
    this.resolve();
  }

  update(dt: number, input: Input): boolean {
    if (this.closed) return true;
    const P = (a: Parameters<Input['pressed']>[0]) => input.pressed(a, true);
    switch (this.mode) {
      case 'root': {
        if (P('uiLeft') || P('uiUp')) {
          this.rootSel = (this.rootSel + 2) % 3;
          sfx('cursor');
          this.refresh();
        } else if (P('uiRight') || P('uiDown')) {
          this.rootSel = (this.rootSel + 1) % 3;
          sfx('cursor');
          this.refresh();
        } else if (P('confirm')) this.pickRoot();
        else if (P('back')) this.close();
        break;
      }
      case 'list': {
        const n = this.lines.length;
        if (n && P('uiDown')) {
          this.sel = (this.sel + 1) % n;
          sfx('cursor');
          this.refresh();
        } else if (n && P('uiUp')) {
          this.sel = (this.sel - 1 + n) % n;
          sfx('cursor');
          this.refresh();
        } else if (P('confirm')) this.pickItem();
        else if (P('back')) {
          sfx('back');
          this.mode = 'root';
          this.rootSel = this.tab === 'sell' ? 1 : 0;
          this.say('还需要别的吗？');
          this.refresh();
        }
        break;
      }
      case 'qty': {
        const max = this.maxQty();
        let q = this.qty;
        if (P('uiRight')) q++;
        if (P('uiLeft')) q--;
        if (P('uiUp')) q += 10;
        if (P('uiDown')) q -= 10;
        // 先夹到上限 / 下限；已在边界时再按一次则循环到另一端
        if (q > max) q = this.qty === max ? 1 : max;
        if (q < 1) q = this.qty === 1 ? max : 1;
        if (q !== this.qty) {
          this.qty = q;
          sfx('cursor');
          this.refresh();
        }
        if (P('confirm')) this.toConfirm();
        else if (P('back')) {
          sfx('back');
          this.mode = 'list';
          this.say('还需要别的吗？');
          this.refresh();
        }
        break;
      }
      case 'confirm': {
        if (P('uiLeft') || P('uiRight') || P('uiUp') || P('uiDown')) {
          this.yes = !this.yes;
          sfx('cursor');
          this.refresh();
        } else if (P('confirm')) this.confirmTrade();
        else if (P('back')) {
          this.yes = false;
          this.confirmTrade();
        }
        break;
      }
      case 'message': {
        this.messageTimer -= dt;
        if (this.messageTimer <= 0 || P('confirm') || P('back')) {
          this.mode = this.afterMessage;
          if (!this.lines.length && this.tab === 'sell') this.mode = 'root';
          this.say('还需要别的吗？');
          this.refresh();
        }
        break;
      }
    }
    return this.closed;
  }

  /** 调试 / e2e：当前列表 */
  get listing(): { id: string; price: number; owned: number }[] {
    return this.lines.map((l) => ({ id: l.id, price: l.price, owned: l.owned }));
  }

  dispose(): void {
    this.el.remove();
  }
}

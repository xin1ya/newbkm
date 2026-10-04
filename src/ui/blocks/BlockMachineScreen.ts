/**
 * 计划文档 §9.5 · 能量方块机界面（自家 1F）：
 * 1. 选树果：背包里的树果网格，选 2–4 种不同的树果（↑↓←→ 移动、确认选 / 取消选、「开始制作」）；
 * 2. 转盘节奏小游戏：8 轮，指针沿转盘转动，金色目标区出现后在指针经过时按确认键（或点击 / 触屏）；
 *    完美 / 不错 / 失误，目标区每轮缩小、指针加快；碗里的树果泥随命中逐渐变顺滑；
 * 3. 结果：方块颜色、名称、5 维风味、顺滑度，放进方块盒（容量 40）。
 */
import type { Input } from '@/core/input';
import { sfx } from '@/core/audio';
import { BERRIES, FLAVORS, FLAVOR_ZH, type BerryDef } from '@/config/berries';
import {
  BLOCK_BOX_CAPACITY,
  BLOCK_COLOR,
  blockBox,
  blockName,
  canCook,
  cookBlock,
  gradeHit,
  hitWindows,
  minigameQuality,
  MINIGAME_ROUNDS,
  needleSpeed,
  newBlockUid,
  storeBlock,
  type BlockKind,
  type HitGrade,
  type PokeBlock,
} from '@/systems/blocks';
import type { Rng } from '@/systems/rng';
import { gainBreederXp } from '@/systems/breeder';
import { removeItem, type GameState } from '@/systems/state';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';
import { itemIconSvg } from '../core/itemIcons';

const CSS = `
.cl-blk{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(12,20,36,.55);pointer-events:auto;z-index:40;font-family:system-ui}
.cl-blk .win{width:min(760px,calc(100% - 24px));max-height:calc(100% - 32px);display:flex;flex-direction:column;gap:10px;padding:16px 18px;overflow:hidden}
.cl-blk .hd{display:flex;align-items:baseline;gap:12px}
.cl-blk .hd .t{font:800 20px/1 system-ui;letter-spacing:.08em}
.cl-blk .hd .s{margin-left:auto;font-size:13px;color:#6a7190}
.cl-blk .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;overflow:auto;max-height:46vh;padding:2px}
.cl-blk .b{display:grid;grid-template-columns:34px 1fr;align-items:center;gap:2px 8px;padding:6px 8px;border:2px solid #dbe3f0;border-radius:10px;background:#fff;cursor:pointer;position:relative}
.cl-blk .b .nm{font-weight:800;font-size:14px}
.cl-blk .b .q{font-size:11px;color:#6a7190}
.cl-blk .b svg{width:34px;height:34px;grid-row:1/3}
.cl-blk .b.cur{border-color:#3fb88a;background:#e7f6ef}
.cl-blk .b.on::after{content:'✓';position:absolute;right:6px;top:4px;font-weight:900;color:#fff;background:#3fb88a;border-radius:50%;width:18px;height:18px;font-size:12px;display:flex;align-items:center;justify-content:center}
.cl-blk .b.dis{opacity:.4}
.cl-blk .tray{display:flex;gap:8px;align-items:center;min-height:46px;padding:6px 10px;border-radius:12px;background:#f3eee2;border:2px dashed #d9cfb8}
.cl-blk .tray svg{width:34px;height:34px}
.cl-blk .tray .empty{color:#a59a80;font-size:13px}
.cl-blk .fl{display:flex;gap:10px;font-size:12px;color:#4a5270;margin-left:auto}
.cl-blk .fl b{font-variant-numeric:tabular-nums}
.cl-blk .go{align-self:flex-end;padding:9px 22px;border-radius:12px;border:3px solid #27304a;background:#f2c84a;font:800 15px system-ui;cursor:pointer;box-shadow:0 3px 0 #27304a}
.cl-blk .go.cur{outline:3px solid #3fb88a;outline-offset:2px}
.cl-blk .go.dis{opacity:.45;cursor:default}
.cl-blk .msg{font-size:13px;color:#b0473f;min-height:18px}
.cl-blk .hint{font-size:12px;color:#6a7190;text-align:center}
.cl-blk .hint kbd{font:700 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px;background:#e4e8f2;margin:0 2px}
.cl-blk .play{display:flex;gap:16px;align-items:center;justify-content:center}
.cl-blk canvas{width:min(380px,70vw);height:min(380px,70vw);cursor:pointer;touch-action:none}
.cl-blk .side{display:flex;flex-direction:column;gap:8px;min-width:150px}
.cl-blk .side .r{font:800 15px system-ui}
.cl-blk .side .hits{display:flex;gap:4px;flex-wrap:wrap}
.cl-blk .side .hits i{width:16px;height:16px;border-radius:50%;background:#e4e8f2;display:inline-block}
.cl-blk .side .hits i.perfect{background:#f2b632}
.cl-blk .side .hits i.good{background:#3fb88a}
.cl-blk .side .hits i.miss{background:#d55}
.cl-blk .res{display:flex;gap:20px;align-items:center;justify-content:center;padding:10px}
.cl-blk .res .info{display:flex;flex-direction:column;gap:6px}
.cl-blk .res .nm{font:800 22px system-ui}
.cl-blk .bars{display:grid;grid-template-columns:auto 160px auto;gap:4px 8px;align-items:center;font-size:13px}
.cl-blk .bars .bar{height:10px;border-radius:5px;background:#e4e8f2;overflow:hidden}
.cl-blk .bars .bar i{display:block;height:100%}
`;

const FLAVOR_COLOR: Record<string, string> = { spicy: '#e8504a', dry: '#4a8fe0', sweet: '#f39ac0', bitter: '#5cb85c', sour: '#f2d24a' };

/** 方块图标（立体小方块，按颜色；彩虹 / 金色带条纹和高光） */
export function blockIconSvg(kind: BlockKind, size = 40): string {
  const c = BLOCK_COLOR[kind];
  const top = shade(c, 1.25);
  const side = shade(c, 0.75);
  const stripes =
    kind === 'rainbow'
      ? `<path d="M8 17 L20 23 L20 35 L8 29Z" fill="#e8504a" opacity=".55"/><path d="M20 23 L32 17 L32 23 L20 29Z" fill="#4a8fe0" opacity=".55"/><path d="M20 29 L32 23 L32 29 L20 35Z" fill="#5cb85c" opacity=".55"/>`
      : kind === 'gold'
        ? `<path d="M12 12 L16 10" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="29" cy="9" r="1.6" fill="#fff"/>`
        : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}"><path d="M20 5 L33 11 L20 17 L7 11Z" fill="${top}" stroke="#27304a" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 11 L20 17 L20 35 L7 29Z" fill="${c}" stroke="#27304a" stroke-width="1.6" stroke-linejoin="round"/><path d="M33 11 L20 17 L20 35 L33 29Z" fill="${side}" stroke="#27304a" stroke-width="1.6" stroke-linejoin="round"/>${stripes}</svg>`;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, '0')}`;
}

function mix(colors: string[]): string {
  if (!colors.length) return '#c9b48a';
  let r = 0, g = 0, b = 0;
  for (const c of colors) {
    const n = parseInt(c.slice(1), 16);
    r += (n >> 16) & 255;
    g += (n >> 8) & 255;
    b += n & 255;
  }
  const k = colors.length;
  return `rgb(${Math.round(r / k)},${Math.round(g / k)},${Math.round(b / k)})`;
}

type Phase = 'pick' | 'play' | 'result';

export class BlockMachineScreen implements UiWidget {
  readonly modal = true;
  private root: HTMLDivElement;
  private win: HTMLDivElement;
  private phase: Phase = 'pick';
  private cursor = 0;
  private picked: BerryDef[] = [];
  private closed = false;
  private resolve!: (b: PokeBlock | null) => void;
  readonly done = new Promise<PokeBlock | null>((r) => (this.resolve = r));
  // 小游戏
  private canvas: HTMLCanvasElement | null = null;
  private sideEl: HTMLDivElement | null = null;
  private round = 0;
  private angle = 0;
  private target = 0;
  private hits: HitGrade[] = [];
  private flash: { text: string; color: string; t: number } | null = null;
  private pause = 0;
  private wantHit = false;
  private result: PokeBlock | null = null;

  constructor(
    ui: UiRoot,
    private readonly state: GameState,
    private readonly rng: Rng,
  ) {
    injectUiStyles(CSS);
    this.root = el('div', 'cl-blk interactive', ui.el);
    this.win = el('div', 'win cl-card', this.root);
    this.renderPick();
  }

  private owned(): BerryDef[] {
    return BERRIES.filter((b) => (this.state.bag[b.id] ?? 0) > 0);
  }

  // ———————————————— 选树果 ————————————————

  private renderPick(msg = ''): void {
    const list = this.owned();
    this.win.textContent = '';
    const hd = el('div', 'hd', this.win);
    el('div', 't', hd, '能量方块机');
    el('div', 's', hd, `方块盒 ${blockBox(this.state).length}/${BLOCK_BOX_CAPACITY}`);
    if (!list.length) {
      el('div', 'msg', this.win, '背包里没有树果。去野外摘一些，或者在田里种吧。');
    }
    const grid = el('div', 'grid', this.win);
    list.forEach((b, i) => {
      const on = this.picked.includes(b);
      const full = !on && this.picked.length >= 4;
      const c = el('div', `b${i === this.cursor ? ' cur' : ''}${on ? ' on' : ''}${full ? ' dis' : ''}`, grid);
      c.innerHTML = itemIconSvg(b.id);
      el('span', 'nm', c, b.name);
      el('span', 'q', c, `×${this.state.bag[b.id]} · ${FLAVORS.filter((f) => b.flavor[f] > 0).map((f) => FLAVOR_ZH[f]).join('')}`);
      c.addEventListener('click', () => {
        this.cursor = i;
        this.toggle(b);
      });
    });
    const tray = el('div', 'tray', this.win);
    if (!this.picked.length) el('span', 'empty', tray, '选 2–4 种不同的树果放进方块机');
    for (const b of this.picked) {
      const s = el('span', '', tray);
      s.innerHTML = itemIconSvg(b.id);
      s.title = b.name;
    }
    const fl = el('div', 'fl', tray);
    for (const f of FLAVORS) {
      const v = this.picked.reduce((a, b) => a + b.flavor[f], 0);
      const s = el('span', '', fl);
      s.innerHTML = `${FLAVOR_ZH[f]} <b style="color:${FLAVOR_COLOR[f]}">${v}</b>`;
    }
    el('div', 'msg', this.win, msg);
    const err = canCook(this.picked);
    const go = el('div', `go${this.cursor === list.length ? ' cur' : ''}${err ? ' dis' : ''}`, this.win, '开始制作 ▶');
    go.addEventListener('click', () => this.start());
    el('div', 'hint', this.win).innerHTML = '<kbd>↑↓←→</kbd> 选择 · <kbd>确认</kbd> 放入 / 取出 · 移到「开始制作」再按确认 · <kbd>返回</kbd> 离开';
  }

  private cols(): number {
    const grid = this.win.querySelector('.grid') as HTMLElement | null;
    if (!grid) return 4;
    const n = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    return Math.max(1, n);
  }

  private toggle(b: BerryDef): void {
    const i = this.picked.indexOf(b);
    if (i >= 0) this.picked.splice(i, 1);
    else if (this.picked.length < 4) this.picked.push(b);
    else return void sfx('error', 0.5);
    sfx('cursor', 0.5);
    this.renderPick();
  }

  private start(): void {
    const err = canCook(this.picked);
    if (err) {
      sfx('error', 0.5);
      return this.renderPick(err);
    }
    if (blockBox(this.state).length >= BLOCK_BOX_CAPACITY) {
      sfx('error', 0.5);
      return this.renderPick('方块盒已经满了（40 个）。先喂掉或丢掉一些吧。');
    }
    for (const b of this.picked) removeItem(this.state, b.id, 1);
    sfx('confirm', 0.7);
    this.phase = 'play';
    this.round = 0;
    this.hits = [];
    this.angle = 0;
    this.newTarget();
    this.renderPlay();
  }

  // ———————————————— 小游戏 ————————————————

  private newTarget(): void {
    // 目标出现在指针前方 120°–300° 处，留出反应时间
    this.target = this.angle + (2 * Math.PI) / 3 + this.rng.next() * Math.PI;
  }

  private renderPlay(): void {
    this.win.textContent = '';
    const hd = el('div', 'hd', this.win);
    el('div', 't', hd, '搅拌中……');
    el('div', 's', hd, this.picked.map((b) => b.name).join(' + '));
    const play = el('div', 'play', this.win);
    const cv = document.createElement('canvas');
    cv.width = 420;
    cv.height = 420;
    play.append(cv);
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.wantHit = true;
    });
    this.canvas = cv;
    this.sideEl = el('div', 'side', play);
    el('div', 'hint', this.win).innerHTML = '指针经过<b style="color:#c99512">金色区域</b>时按 <kbd>确认</kbd> / <kbd>空格</kbd> 或点击转盘 · 正中间是「完美」';
    this.renderSide();
    this.draw();
  }

  private renderSide(): void {
    if (!this.sideEl) return;
    this.sideEl.textContent = '';
    el('div', 'r', this.sideEl, `第 ${Math.min(this.round + 1, MINIGAME_ROUNDS)} / ${MINIGAME_ROUNDS} 轮`);
    const hits = el('div', 'hits', this.sideEl);
    for (let i = 0; i < MINIGAME_ROUNDS; i++) el('i', this.hits[i] ?? '', hits);
    const q = minigameQuality(this.hits);
    el('div', '', this.sideEl, `顺滑程度 ${Math.round(q * 100)}%`);
    const p = this.hits.filter((h) => h === 'perfect').length;
    const g = this.hits.filter((h) => h === 'good').length;
    el('div', 'q', this.sideEl, `完美 ${p} · 不错 ${g} · 失误 ${this.hits.length - p - g}`);
  }

  private hit(grade: HitGrade): void {
    this.hits.push(grade);
    this.flash = grade === 'perfect' ? { text: '完美！', color: '#f2b632', t: 0.7 } : grade === 'good' ? { text: '不错', color: '#3fb88a', t: 0.7 } : { text: '失误', color: '#d55', t: 0.7 };
    sfx(grade === 'miss' ? 'error' : grade === 'perfect' ? 'confirm' : 'cursor', grade === 'perfect' ? 0.8 : 0.5);
    this.round++;
    this.renderSide();
    if (this.round >= MINIGAME_ROUNDS) {
      this.pause = 0.9;
      return;
    }
    this.pause = 0.35;
    this.newTarget();
  }

  private finish(): void {
    const q = minigameQuality(this.hits);
    const block = cookBlock(this.picked, q, newBlockUid(this.rng));
    storeBlock(this.state, block);
    gainBreederXp(this.state, 'block', block.kind === 'black' ? 1 : block.kind === 'gold' ? 15 : 6);
    this.result = block;
    this.phase = 'result';
    sfx('item', 0.8);
    this.renderResult(q);
  }

  private draw(): void {
    const cv = this.canvas;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const W = cv.width;
    const cx = W / 2;
    const cy = W / 2;
    const R = W * 0.44;
    g.clearRect(0, 0, W, W);
    // 机身外圈
    g.fillStyle = '#27304a';
    g.beginPath();
    g.arc(cx, cy, R + 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e9eef6';
    g.beginPath();
    g.arc(cx, cy, R + 6, 0, Math.PI * 2);
    g.fill();
    // 刻度（树果颜色分段）
    const segs = this.picked.length ? this.picked : [];
    const n = Math.max(1, segs.length) * 6;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = segs.length ? mix([segs[i % segs.length]!.color.fruit, '#ffffff', '#ffffff', i % 2 ? '#dfe5ee' : '#ffffff']) : '#ccd';
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, a0, a1);
      g.closePath();
      g.fill();
    }
    // 目标区
    if (this.round < MINIGAME_ROUNDS && this.phase === 'play') {
      const w = hitWindows(this.round);
      const t = this.target - Math.PI / 2;
      g.fillStyle = 'rgba(255,214,90,.92)';
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, t - w.good, t + w.good);
      g.closePath();
      g.fill();
      g.fillStyle = '#f29a12';
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, t - w.perfect, t + w.perfect);
      g.closePath();
      g.fill();
      // 目标区描边，避免和刻度颜色混在一起
      g.strokeStyle = '#27304a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, t - w.good, t + w.good);
      g.closePath();
      g.stroke();
    }
    // 碗：树果泥颜色随顺滑程度从颗粒到顺滑
    const q = minigameQuality(this.hits);
    g.fillStyle = '#fffdf7';
    g.beginPath();
    g.arc(cx, cy, R * 0.52, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#27304a';
    g.lineWidth = 4;
    g.stroke();
    const paste = mix(this.picked.map((b) => b.color.fruit));
    g.fillStyle = paste;
    g.beginPath();
    g.arc(cx, cy, R * 0.44, 0, Math.PI * 2);
    g.fill();
    // 颗粒：越顺滑颗粒越少；旋转
    const lumps = Math.round(18 * (1 - q)) + 3;
    for (let i = 0; i < lumps; i++) {
      const a = (i / lumps) * Math.PI * 2 + this.angle * 0.6;
      const rr = R * (0.12 + ((i * 37) % 23) / 23 * 0.26);
      g.fillStyle = shade(this.picked[i % Math.max(1, this.picked.length)]?.color.fruit ?? '#a98', 0.75);
      g.beginPath();
      g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4 + ((i * 13) % 5), 0, Math.PI * 2);
      g.fill();
    }
    // 漩涡高光
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, R * 0.3, this.angle * 1.5, this.angle * 1.5 + Math.PI * (0.4 + q));
    g.stroke();
    // 指针
    const na = this.angle - Math.PI / 2;
    g.strokeStyle = '#27304a';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + Math.cos(na) * R * 0.55, cy + Math.sin(na) * R * 0.55);
    g.lineTo(cx + Math.cos(na) * (R + 4), cy + Math.sin(na) * (R + 4));
    g.stroke();
    g.fillStyle = '#e8504a';
    g.beginPath();
    g.arc(cx + Math.cos(na) * (R - 6), cy + Math.sin(na) * (R - 6), 9, 0, Math.PI * 2);
    g.fill();
    // 判定文字
    if (this.flash) {
      g.globalAlpha = Math.min(1, this.flash.t / 0.3);
      g.font = '900 40px system-ui';
      g.textAlign = 'center';
      g.lineWidth = 6;
      g.strokeStyle = '#fff';
      g.strokeText(this.flash.text, cx, cy - R * 0.62 - (0.7 - this.flash.t) * 30);
      g.fillStyle = this.flash.color;
      g.fillText(this.flash.text, cx, cy - R * 0.62 - (0.7 - this.flash.t) * 30);
      g.globalAlpha = 1;
    }
  }

  // ———————————————— 结果 ————————————————

  private renderResult(q: number): void {
    const b = this.result!;
    this.win.textContent = '';
    const hd = el('div', 'hd', this.win);
    el('div', 't', hd, b.kind === 'black' ? '失败了……' : '做好了！');
    el('div', 's', hd, `顺滑程度 ${Math.round(q * 100)}%`);
    const res = el('div', 'res', this.win);
    const ic = el('div', '', res);
    ic.innerHTML = blockIconSvg(b.kind, 120);
    const info = el('div', 'info', res);
    el('div', 'nm', info, blockName(b));
    const bars = el('div', 'bars', info);
    for (const f of FLAVORS) {
      el('span', '', bars, FLAVOR_ZH[f]);
      const bar = el('div', 'bar', bars);
      const i = el('i', '', bar);
      i.style.cssText = `width:${Math.min(100, b.flavor[f])}%;background:${FLAVOR_COLOR[f]}`;
      el('b', '', bars, String(b.flavor[f]));
    }
    el('div', 'q', info, `顺滑度 ${b.smooth}（越高越好入口，外观状态涨得越多）`);
    el(
      'div',
      'msg',
      this.win,
      b.kind === 'black' ? '放了相同的树果，或者味道全抵消了，做出来的是黑色方块。' : b.kind === 'gold' ? '金色方块！味道浓郁又顺滑，是极品。' : '',
    );
    el('div', 'hint', this.win).innerHTML = '方块放进了方块盒（背包 → 方块盒，可以喂食宝可梦、放置诱饵或投喂头目） · <kbd>确认</kbd> 再做一个 · <kbd>返回</kbd> 离开';
  }

  // ———————————————— 每帧 ————————————————

  update(dt: number, input: Input): boolean {
    if (this.closed) return true;
    if (this.phase === 'pick') {
      const list = this.owned();
      const n = list.length + 1;
      const cols = this.cols();
      const before = this.cursor;
      if (input.pressed('uiLeft', true)) this.cursor = (this.cursor - 1 + n) % n;
      else if (input.pressed('uiRight', true)) this.cursor = (this.cursor + 1) % n;
      else if (input.pressed('uiUp', true)) this.cursor = this.cursor === list.length ? Math.max(0, list.length - 1) : Math.max(0, this.cursor - cols);
      else if (input.pressed('uiDown', true)) this.cursor = Math.min(list.length, this.cursor + cols);
      else if (input.pressed('confirm', true)) {
        if (this.cursor === list.length) this.start();
        else if (list[this.cursor]) this.toggle(list[this.cursor]!);
      } else if (input.pressed('back', true)) return this.close(null);
      if (this.cursor !== before) {
        sfx('cursor', 0.3);
        this.renderPick();
        (this.win.querySelector('.b.cur') as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
      }
      return false;
    }
    if (this.phase === 'play') {
      if (this.flash) {
        this.flash.t -= dt;
        if (this.flash.t <= 0) this.flash = null;
      }
      if (this.pause > 0) {
        this.pause -= dt;
        if (this.pause <= 0 && this.round >= MINIGAME_ROUNDS) {
          this.finish();
          return false;
        }
      } else {
        const sp = needleSpeed(this.round, this.picked.length) * dt;
        this.angle += sp;
        const press = this.wantHit || input.pressed('confirm', true) || input.pressed('jump', true);
        this.wantHit = false;
        if (press) this.hit(gradeHit(this.angle - this.target, this.round));
        // 指针越过目标区后半圈仍未按 → 失误
        else if (this.angle - this.target > hitWindows(this.round).good + 0.25) this.hit('miss');
      }
      this.draw();
      return false;
    }
    // result
    if (input.pressed('confirm', true)) {
      this.picked = this.picked.filter((b) => (this.state.bag[b.id] ?? 0) > 0);
      this.phase = 'pick';
      this.cursor = 0;
      this.canvas = null;
      this.renderPick();
    } else if (input.pressed('back', true)) return this.close(this.result);
    return false;
  }

  private close(b: PokeBlock | null): boolean {
    this.closed = true;
    this.resolve(b);
    return true;
  }

  dispose(): void {
    this.root.remove();
  }
}

export function openBlockMachine(ui: UiRoot, state: GameState, rng: Rng): Promise<PokeBlock | null> {
  const w = ui.push(new BlockMachineScreen(ui, state, rng));
  return w.done;
}

/**
 * M3-22 城镇快速旅行 · 飞行目的地选单（B 键 / 大地图 F 键）。
 * - 上方岛屿页签（未到访的岛灰显「未到访」）；左侧该岛底图 + 飞行点标记（已登记 = 亮色宝可梦中心图标；未登记 = 灰色「？」）；
 *   右侧城镇列表；当前所在点标「当前位置」，玩家位置画箭头。
 * - 操作：↑↓ 选择城镇，←→ / Q X 切换岛屿，确认键 / 双击飞往，返回键 / B 关闭；鼠标点击标记或列表项选择。
 * 纯 DOM + canvas；底图由场景侧按需提供（其他岛的高度图懒加载）。
 */
import type { Input } from '@/core/input';
import type { IslandId } from '@/systems/state/GameState';
import type { FlyPoint } from '@/systems/travel/fastTravel';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';

export interface FlyPickerGroup {
  island: IslandId;
  name: string;
  visited: boolean;
  worldSize: [number, number];
  points: (FlyPoint & { unlocked: boolean })[];
}

export interface FlyPickerView {
  groups: FlyPickerGroup[];
  currentIsland: IslandId;
  player: { x: number; z: number; facing: number };
  /** 离玩家最近（30 m 内）的飞行点：显示「当前位置」，不可选 */
  herePoint: string | null;
  mapFor(island: IslandId): Promise<HTMLCanvasElement | null>;
}

const MAP_PX = 460;

const CSS = `
.cl-fly { position: absolute; inset: 0; pointer-events: auto; background: rgba(12,18,34,.7); display: flex; align-items: center; justify-content: center; animation: cl-fly-in .2s ease-out; }
@keyframes cl-fly-in { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }
.cl-fly .frame { width: min(860px, 95vw); background: #f4ecd6; border: 3px solid #27304a; border-radius: 18px; box-shadow: 0 5px 0 #27304a, 0 16px 40px rgba(0,0,0,.4); overflow: hidden; }
.cl-fly .head { display: flex; align-items: center; gap: 14px; padding: 12px 18px; background: #27304a; color: #fff; }
.cl-fly .head .t { font: 800 20px/1 system-ui; letter-spacing: .12em; }
.cl-fly .head .h { margin-left: auto; font: 600 12px/1.3 system-ui; opacity: .8; }
.cl-fly .tabs { display: flex; gap: 6px; padding: 10px 14px 0; }
.cl-fly .tab { padding: 7px 14px; border-radius: 10px 10px 0 0; background: #ddd0ad; color: #27304a; font: 700 14px/1 system-ui; cursor: pointer; }
.cl-fly .tab.on { background: #27304a; color: #ffe7a3; }
.cl-fly .tab.locked { opacity: .5; }
.cl-fly .body { display: grid; grid-template-columns: ${MAP_PX}px 1fr; gap: 14px; padding: 0 14px 14px; border-top: 3px solid #27304a; padding-top: 12px; }
.cl-fly .map { position: relative; width: ${MAP_PX}px; height: ${MAP_PX}px; border: 2px solid #27304a; border-radius: 10px; overflow: hidden; background: #2e68a4; }
.cl-fly .map canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.cl-fly .map .veil { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font: 700 16px/1.5 system-ui; text-align: center; background: rgba(20,30,50,.55); }
.cl-fly .mk { position: absolute; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%; border: 2px solid #27304a; background: #e84a4a; box-shadow: 0 2px 0 #27304a; cursor: pointer; display: flex; align-items: center; justify-content: center; font: 800 12px/1 system-ui; color: #fff; transition: transform .12s; }
.cl-fly .mk::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #fff; border: 2px solid #27304a; }
.cl-fly .mk.lock { background: #9a9a9a; cursor: default; }
.cl-fly .mk.lock::after { display: none; }
.cl-fly .mk.sel { transform: scale(1.45); box-shadow: 0 0 0 4px #ffe7a3, 0 2px 0 #27304a; z-index: 2; }
.cl-fly .mk .lb { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); white-space: nowrap; font: 700 11px/1 system-ui; color: #27304a; background: rgba(244,236,214,.9); padding: 2px 5px; border-radius: 5px; }
.cl-fly .me { position: absolute; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 16px solid #2a7fff; margin: -8px 0 0 -7px; filter: drop-shadow(0 0 2px #fff); z-index: 3; }
.cl-fly .list { display: flex; flex-direction: column; gap: 6px; max-height: ${MAP_PX}px; overflow-y: auto; }
.cl-fly .it { padding: 10px 12px; border-radius: 10px; background: #fffaf0; border: 2px solid #c9b88d; font: 700 15px/1.2 system-ui; color: #27304a; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.cl-fly .it .s { margin-left: auto; font: 600 12px/1 system-ui; opacity: .7; }
.cl-fly .it.sel { border-color: #27304a; background: #ffe7a3; box-shadow: 0 2px 0 #27304a; }
.cl-fly .it.lock { color: #8a8a8a; cursor: default; }
.cl-fly .note { font: 600 13px/1.5 system-ui; color: #6b5d3d; padding: 6px 2px; }
.cl-fly .foot { padding: 0 16px 14px; font: 600 13px/1.4 system-ui; color: #27304a; min-height: 18px; }
`;

export class FlyPicker implements UiWidget {
  readonly modal = true;
  readonly done: Promise<FlyPoint | null>;
  private resolve!: (p: FlyPoint | null) => void;
  private root: HTMLDivElement;
  private tabsEl: HTMLDivElement;
  private mapEl: HTMLDivElement;
  private listEl: HTMLDivElement;
  private footEl: HTMLDivElement;
  private tab: number;
  private sel: string | null = null;
  private closed = false;
  private loadToken = 0;
  private lastClick = { id: '', t: 0 };

  constructor(
    ui: UiRoot,
    readonly view: FlyPickerView,
  ) {
    injectUiStyles(CSS);
    this.done = new Promise((r) => (this.resolve = r));
    this.root = el('div', 'cl-fly', ui.el);
    const frame = el('div', 'frame', this.root);
    const head = el('div', 'head', frame);
    el('div', 't', head, '飞行 · 选择目的地');
    el('div', 'h', head, '↑↓ 选择 · ←→ 切换岛屿 · 确认飞往 · B / 返回 关闭');
    this.tabsEl = el('div', 'tabs', frame);
    const body = el('div', 'body', frame);
    this.mapEl = el('div', 'map', body);
    this.listEl = el('div', 'list', body);
    this.footEl = el('div', 'foot', frame);
    const ti = view.groups.findIndex((g) => g.island === view.currentIsland);
    this.tab = ti >= 0 ? ti : 0;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.finish(null);
    });
    this.render(true);
  }

  private get group(): FlyPickerGroup {
    return this.view.groups[this.tab]!;
  }

  private selectable(g = this.group): (FlyPoint & { unlocked: boolean })[] {
    return g.points.filter((p) => p.unlocked && p.id !== this.view.herePoint);
  }

  private render(newTab: boolean): void {
    const g = this.group;
    if (newTab) {
      const cand = this.selectable();
      this.sel = cand[0]?.id ?? null;
    }
    this.tabsEl.replaceChildren();
    this.view.groups.forEach((gg, i) => {
      const t = el('div', `tab${i === this.tab ? ' on' : ''}${gg.visited ? '' : ' locked'}`, this.tabsEl, gg.visited ? gg.name : `${gg.name}（未到访）`);
      t.addEventListener('click', () => {
        this.tab = i;
        this.render(true);
      });
    });
    this.renderList(g);
    if (newTab) void this.renderMap(g);
    else this.refreshMarkers();
    this.updateFoot();
  }

  private renderList(g: FlyPickerGroup): void {
    this.listEl.replaceChildren();
    if (!g.visited) {
      el('div', 'note', this.listEl, '还没有到访过这座岛。先冲浪 / 乘船渡海过去吧！');
      return;
    }
    for (const p of g.points) {
      const here = p.id === this.view.herePoint;
      const it = el('div', `it${p.unlocked ? '' : ' lock'}${p.id === this.sel ? ' sel' : ''}`, this.listEl);
      el('span', '', it, p.unlocked ? p.name : '？？？');
      el('span', 's', it, here ? '当前位置' : p.unlocked ? (p.id === 'player-house' ? '自己家' : '宝可梦中心') : '未到访');
      it.dataset.id = p.id;
      if (p.unlocked && !here) it.addEventListener('click', () => this.clickPoint(p.id));
    }
    if (!g.points.some((p) => p.unlocked)) el('div', 'note', this.listEl, '这座岛上还没有登记过宝可梦中心。走到宝可梦中心附近就会自动登记。');
  }

  private toMap(g: FlyPickerGroup, x: number, z: number): [number, number] {
    const [W, H] = g.worldSize;
    return [((x + W / 2) / W) * MAP_PX, ((z + H / 2) / H) * MAP_PX];
  }

  private async renderMap(g: FlyPickerGroup): Promise<void> {
    const token = ++this.loadToken;
    this.mapEl.replaceChildren();
    const veil = el('div', 'veil', this.mapEl, g.visited ? '读取地图……' : '未到访');
    if (g.visited) {
      const img = await this.view.mapFor(g.island).catch(() => null);
      if (token !== this.loadToken || this.closed) return;
      if (img) {
        const c = el('canvas', '', undefined);
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d')?.drawImage(img, 0, 0);
        this.mapEl.prepend(c);
        veil.remove();
      } else veil.textContent = g.name;
    }
    if (!g.visited) return;
    for (const p of g.points) {
      const [u, v] = this.toMap(g, p.x, p.z);
      const m = el('div', `mk${p.unlocked ? '' : ' lock'}`, this.mapEl);
      m.style.left = `${u}px`;
      m.style.top = `${v}px`;
      m.dataset.id = p.id;
      if (!p.unlocked) m.textContent = '？';
      el('div', 'lb', m, p.unlocked ? p.name : '？？？');
      if (p.unlocked && p.id !== this.view.herePoint) m.addEventListener('click', () => this.clickPoint(p.id));
    }
    if (g.island === this.view.currentIsland) {
      const [u, v] = this.toMap(g, this.view.player.x, this.view.player.z);
      const me = el('div', 'me', this.mapEl);
      me.style.left = `${u}px`;
      me.style.top = `${v}px`;
      // facing：0 = +Z（地图向下）
      me.style.transform = `rotate(${180 - (this.view.player.facing * 180) / Math.PI}deg)`;
    }
    this.refreshMarkers();
  }

  private refreshMarkers(): void {
    for (const n of this.mapEl.querySelectorAll<HTMLElement>('.mk')) n.classList.toggle('sel', n.dataset.id === this.sel);
    for (const n of this.listEl.querySelectorAll<HTMLElement>('.it')) n.classList.toggle('sel', n.dataset.id === this.sel);
    this.listEl.querySelector('.it.sel')?.scrollIntoView?.({ block: 'nearest' });
  }

  private updateFoot(): void {
    const p = this.group.points.find((q) => q.id === this.sel);
    this.footEl.textContent = p ? `飞往 ${p.islandName} · ${p.name}${p.island !== this.view.currentIsland ? '（跨岛飞行）' : ''}` : '';
  }

  private clickPoint(id: string): void {
    const now = performance.now();
    if (this.sel === id && this.lastClick.id === id && now - this.lastClick.t < 450) {
      this.confirm();
      return;
    }
    this.lastClick = { id, t: now };
    this.sel = id;
    this.refreshMarkers();
    this.updateFoot();
  }

  private moveSel(d: number): void {
    const list = this.selectable();
    if (!list.length) return;
    const i = list.findIndex((p) => p.id === this.sel);
    this.sel = list[(i + d + list.length) % list.length]!.id;
    this.refreshMarkers();
    this.updateFoot();
  }

  private confirm(): void {
    const p = this.group.points.find((q) => q.id === this.sel && q.unlocked);
    if (p) this.finish(p);
  }

  private finish(p: FlyPoint | null): void {
    if (this.closed) return;
    this.closed = true;
    this.resolve(p);
  }

  update(_dt: number, input: Input): boolean {
    if (this.closed) return true;
    const n = this.view.groups.length;
    if (input.pressed('back', true) || input.pressed('flyTravel', true) || input.pressed('menu', true)) this.finish(null);
    else if (input.pressed('confirm', true)) this.confirm();
    else if (input.pressed('uiUp', true)) this.moveSel(-1);
    else if (input.pressed('uiDown', true)) this.moveSel(1);
    else if (input.pressed('uiLeft', true) || input.pressed('gearDown', true)) {
      this.tab = (this.tab - 1 + n) % n;
      this.render(true);
    } else if (input.pressed('uiRight', true) || input.pressed('gearUp', true)) {
      this.tab = (this.tab + 1) % n;
      this.render(true);
    }
    return this.closed;
  }

  dispose(): void {
    this.closed = true;
    this.loadToken++;
    this.root.remove();
  }
}

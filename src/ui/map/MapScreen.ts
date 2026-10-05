/**
 * M1-17 · 大地图（设计 §7.3：M 键）。
 * - 底图：场景侧烘焙的岛屿地形图；未探索区域覆盖羊皮纸色迷雾（按探索格绘制并柔化边缘）。
 * - 标记：宝可梦中心 / 商店 / 道馆 / 码头 / 地标 / 洞穴 / 封锁点（只在探索过的地方显示）、区域名、
 *   玩家箭头（朝向）、追踪任务目标（迷雾中也显示；搜索范围画圆）。
 * - 操作：拖拽 / 方向键平移，滚轮 / + - 缩放（以光标为中心），C 回到自己，T 跳到任务目标，
 *   悬停标记显示名称；M / 返回 / 菜单键关闭。
 * 纯 DOM + canvas，数据由场景侧组装（MapView）。
 */
import type { Input } from '@/core/input';
import {
  clampCamera,
  facingToMapDeg,
  fitZoom,
  markerVisible,
  stepZoom,
  worldToMap,
  zoomAt,
  type FogMask,
  type MapCamera,
  type MapFrame,
  type MapMarkerKind,
  mapToWorld,
  MAX_PINS,
  PIN_KINDS,
  PIN_STYLE,
  type MapPin,
  type PinKind,
} from '@/systems/map';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';

export interface MapMarker {
  id: string;
  kind: MapMarkerKind;
  name: string;
  x: number;
  z: number;
  /** 补充说明（封锁点：需要的能力） */
  sub?: string | undefined;
  /** 封锁点已解除 */
  cleared?: boolean | undefined;
  /** 灰显（头目巢穴冷却中） */
  dim?: boolean | undefined;
}

export interface MapZoneLabel {
  id: string;
  name: string;
  kind: 'town' | 'wild' | 'sea' | 'dungeon-entrance';
  x: number;
  z: number;
  levelRange?: [number, number] | undefined;
  /** 到访过（或当前所在）：不论迷雾都显示地名 */
  known?: boolean | undefined;
}

export interface MapQuestTarget {
  title: string;
  objective: string;
  x: number;
  z: number;
  /** 搜索范围（米），0 = 精确点 */
  radius: number;
  category: 'main' | 'side' | 'hidden';
}

export interface MapView {
  islandName: string;
  image: HTMLCanvasElement;
  worldSize: [number, number];
  fog: FogMask;
  player: { x: number; z: number; facing: number } | null;
  /** 玩家不在大地图上（室内）时的说明 */
  playerNote?: string | undefined;
  currentZone: string | null;
  markers: MapMarker[];
  zones: MapZoneLabel[];
  quest: MapQuestTarget | null;
  /** 打开时居中：玩家或任务目标 */
  focus: 'player' | 'quest';
  keyLabels: { close: string; center: string; quest: string };
  /** 自定义标点（本岛）与操作；缺省 = 不支持标点（只读地图） */
  pins?: PinOps | undefined;
}

export interface PinOps {
  list(): MapPin[];
  nav(): string | null;
  add(x: number, z: number, kind: PinKind): MapPin | null;
  remove(id: string): void;
  setKind(id: string, kind: PinKind): void;
  toggleNav(id: string): void;
  /** 导航中的原有地点 id */
  navMarker(): string | null;
  toggleNavMarker(m: { id: string; name: string; x: number; z: number }): void;
}

export const MAP_ICON: Record<MapMarkerKind, { glyph: string; color: string; label: string }> = {
  pokecenter: { glyph: '✚', color: '#e8484a', label: '宝可梦中心' },
  mart: { glyph: '¥', color: '#3a7bd5', label: '商店' },
  gym: { glyph: '★', color: '#f0a020', label: '道馆' },
  door: { glyph: '⌂', color: '#7a5a3a', label: '建筑' },
  dock: { glyph: '⚓', color: '#2d6f9e', label: '码头' },
  ferry: { glyph: '⛴', color: '#2d6f9e', label: '渡船' },
  fishing: { glyph: '◠', color: '#1f8fa8', label: '钓鱼点' },
  landmark: { glyph: '◆', color: '#8a5ac8', label: '地标' },
  cave: { glyph: '◗', color: '#5a4a3a', label: '洞穴' },
  quest: { glyph: '!', color: '#f0a020', label: '任务地点' },
  blocker: { glyph: '🔒', color: '#c0504d', label: '封锁点' },
  alpha: { glyph: '♛', color: '#c0202a', label: '头目巢穴' },
  climb: { glyph: '⛰', color: '#6a7a3a', label: '攀爬点' },
  dive: { glyph: '◎', color: '#1d5f9a', label: '潜水点' },
  waterfall: { glyph: '≋', color: '#2a7ab8', label: '瀑布' },
};
const LEGEND_ORDER: MapMarkerKind[] = ['pokecenter', 'mart', 'gym', 'door', 'dock', 'ferry', 'fishing', 'landmark', 'cave', 'alpha', 'climb', 'dive', 'waterfall', 'blocker'];
export const CAT_COLOR = { main: '#ffb627', side: '#4fb3ff', hidden: '#b48cff' } as const;
const PAN_SPEED = 520; // 屏幕像素 / 秒

const CSS = `
.cl-map { position: absolute; inset: 0; pointer-events: auto; background: rgba(12,18,34,.72); display: flex; align-items: center; justify-content: center; animation: cl-map-in .2s ease-out; }
@keyframes cl-map-in { from { opacity: 0; } to { opacity: 1; } }
.cl-map .frame { position: relative; width: min(1180px, 94vw); height: min(700px, 90vh); display: grid; grid-template-columns: 1fr 250px; grid-template-rows: 50px 1fr 36px;
  background: #f4ecd6; border: 3px solid #27304a; border-radius: 18px; box-shadow: 0 5px 0 #27304a, 0 16px 40px rgba(0,0,0,.4); overflow: hidden; }
.cl-map .head { grid-column: 1 / 3; display: flex; align-items: center; gap: 16px; padding: 0 18px; background: #27304a; color: #fff; }
.cl-map .head .t { font: 800 20px/1 system-ui; letter-spacing: .12em; }
.cl-map .head .z { font: 600 14px/1 system-ui; opacity: .85; }
.cl-map .head .ex { margin-left: auto; font: 700 13px/1 system-ui; color: #ffe7a3; }
.cl-map .view { position: relative; overflow: hidden; cursor: grab; background: #d9cda9; }
.cl-map .view.drag { cursor: grabbing; }
.cl-map .world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.cl-map .world canvas { position: absolute; left: 0; top: 0; image-rendering: auto; }
.cl-map .world .fog { filter: blur(3px); }
.cl-map .layer { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.cl-map .mk { position: absolute; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: #fffdf7; border: 2px solid #27304a; box-shadow: 0 2px 0 #27304a; font: 800 13px/1 system-ui; color: var(--c); cursor: pointer; transition: transform .12s; }
.cl-map .mk:hover, .cl-map .mk.hl { transform: scale(1.25); z-index: 5; }
.cl-map .mk.blocker { background: #fff0ee; font-size: 11px; }
.cl-map .mk.climb { background: #f2f4e4; font-size: 11px; }
.cl-map .mk.dive { background: #e4f0fa; font-size: 12px; }
.cl-map .mk.waterfall { background: #e2f2fc; font-size: 12px; }
.cl-map .zn { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; pointer-events: none; font: 800 13px/1.2 system-ui; color: #3a2f22; letter-spacing: .08em;
  text-shadow: 0 0 3px #f4ecd6, 0 0 3px #f4ecd6, 0 0 6px #f4ecd6; text-align: center; }
.cl-map .zn.town { font-size: 16px; color: #27304a; }
.cl-map .zn.sea { color: #1d4f7a; font-style: italic; }
.cl-map .zn small { display: block; font: 600 10px/1.2 system-ui; opacity: .75; letter-spacing: 0; }
.cl-map .me { position: absolute; width: 0; height: 0; z-index: 6; pointer-events: none; }
.cl-map .me .arr { position: absolute; left: -11px; top: -13px; width: 22px; height: 26px; }
.cl-map .me .pulse { position: absolute; left: -16px; top: -16px; width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff; animation: cl-map-pulse 1.6s ease-out infinite; }
@keyframes cl-map-pulse { from { transform: scale(.5); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
.cl-map .qt { position: absolute; z-index: 4; pointer-events: none; }
.cl-map .qt .ring { position: absolute; border-radius: 50%; border: 2px dashed var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); transform: translate(-50%, -50%); }
.cl-map .qt .gem { position: absolute; left: -10px; top: -10px; width: 20px; height: 20px; background: var(--c); border: 3px solid #27304a; border-radius: 4px; transform: rotate(45deg);
  box-shadow: 0 0 12px var(--c); animation: cl-map-gem 1.4s ease-in-out infinite; }
@keyframes cl-map-gem { 50% { box-shadow: 0 0 22px var(--c); } }
.cl-map .mk.navm { box-shadow: 0 0 0 3px #3fe0b0, 0 0 12px #3fe0b0; z-index: 6; }
.cl-map .mk.dim { filter: grayscale(1); opacity: .55; }
.cl-map .tip { position: absolute; z-index: 10; pointer-events: none; padding: 5px 10px; border-radius: 9px; background: #27304a; color: #fff; font: 700 13px/1.35 system-ui; white-space: nowrap; transform: translate(-50%, calc(-100% - 16px)); display: none; }
.cl-map .tip small { display: block; font-weight: 500; font-size: 11px; opacity: .8; }
.cl-map .side { grid-row: 2 / 3; grid-column: 2; border-left: 2px solid #d5c9a6; padding: 14px; overflow-y: auto; background: #fbf6e8; }
.cl-map .side h4 { margin: 0 0 8px; font: 800 12px/1 system-ui; letter-spacing: .15em; color: #7a6a4a; }
.cl-map .side .qcard { padding: 10px 12px; border-radius: 10px; background: #fff; border-left: 5px solid var(--c); margin-bottom: 16px; }
.cl-map .side .qcard .qt1 { font: 800 15px/1.3 system-ui; }
.cl-map .side .qcard .qo { font: 500 13px/1.4 system-ui; color: #4a5372; margin-top: 3px; }
.cl-map .side .none { font-size: 13px; color: #9a8f74; margin-bottom: 16px; }
.cl-map .lg { display: flex; align-items: center; gap: 8px; padding: 4px 0; font: 600 13px/1 system-ui; color: #3a2f22; }
.cl-map .lg .mk { position: static; margin: 0; width: 20px; height: 20px; font-size: 11px; cursor: default; }
.cl-map .lg .n { margin-left: auto; color: #9a8f74; font-size: 12px; }
.cl-map .lg.me2 .dot { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.cl-map .foot { grid-column: 1 / 3; display: flex; align-items: center; gap: 14px; padding: 0 16px; border-top: 2px solid #d5c9a6; font: 600 12px/1 system-ui; color: #5a4e36; background: #efe5c8; }
.cl-map .foot kbd { display: inline-block; min-width: 18px; padding: 2px 5px; margin-right: 4px; border: 2px solid #5a4e36; border-radius: 5px; font: 700 11px/1 system-ui; text-align: center; background: #fffdf7; }
.cl-map .zoom { position: absolute; right: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 6px; z-index: 8; }
.cl-map .zoom span { width: 32px; height: 32px; border-radius: 9px; background: #fffdf7; border: 2px solid #27304a; box-shadow: 0 2px 0 #27304a; display: flex; align-items: center; justify-content: center; font: 900 18px/1 system-ui; cursor: pointer; user-select: none; }
.cl-map .compassrose { position: absolute; left: 14px; top: 12px; z-index: 8; width: 44px; height: 44px; pointer-events: none; }
.cl-map .scale { position: absolute; left: 14px; bottom: 14px; z-index: 8; font: 700 11px/1 system-ui; color: #3a2f22; pointer-events: none; }
.cl-map .scale .bar { height: 6px; border: 2px solid #3a2f22; border-top: 0; margin-bottom: 3px; }
.cl-map .note { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 8; padding: 4px 12px; border-radius: 9px; background: rgba(39,48,74,.85); color: #fff; font: 600 12px/1.4 system-ui; }
.cl-map .pin { position: absolute; width: 0; height: 0; z-index: 7; cursor: pointer; }
.cl-map .pin .drop { position: absolute; left: -12px; top: -30px; width: 24px; height: 30px; }
.cl-map .pin .g { position: absolute; left: -12px; top: -27px; width: 24px; text-align: center; font: 900 12px/18px system-ui; color: #fff; pointer-events: none; }
.cl-map .pin.nav .drop { filter: drop-shadow(0 0 6px var(--c)); animation: cl-pin-bob 1.2s ease-in-out infinite; }
.cl-map .pin.nav .g { animation: cl-pin-bob 1.2s ease-in-out infinite; }
@keyframes cl-pin-bob { 50% { transform: translateY(-3px); } }
.cl-map .pin .lb { position: absolute; left: 0; top: 2px; transform: translateX(-50%); white-space: nowrap; font: 700 11px/1.2 system-ui; color: #27304a; text-shadow: 0 0 3px #fff, 0 0 3px #fff; pointer-events: none; }
.cl-map .cross { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; z-index: 7; pointer-events: none; opacity: .45; }
.cl-map .pop { position: absolute; z-index: 12; transform: translate(-50%, calc(-100% - 14px)); background: #fffdf7; border: 2px solid #27304a; border-radius: 12px; box-shadow: 0 3px 0 #27304a;
  padding: 8px; display: flex; flex-direction: column; gap: 6px; font: 700 12px/1 system-ui; color: #27304a; min-width: 176px; }
.cl-map .pop .row { display: flex; gap: 5px; justify-content: center; }
.cl-map .pop .k { width: 26px; height: 26px; border-radius: 50%; border: 2px solid #27304a; display: flex; align-items: center; justify-content: center; color: #fff; font: 900 13px/1 system-ui; cursor: pointer; background: var(--c); }
.cl-map .pop .k.on { box-shadow: 0 0 0 3px #ffd34a; }
.cl-map .pop .b { padding: 6px 8px; border-radius: 8px; background: #27304a; color: #fff; text-align: center; cursor: pointer; }
.cl-map .pop .b.red { background: #c0504d; }
.cl-map .pop .b.ghost { background: #e6dfc8; color: #27304a; }
.cl-map .side .pl { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 8px; font: 600 13px/1 system-ui; cursor: pointer; }
.cl-map .side .pl:hover { background: #efe5c8; }
.cl-map .side .pl .dot { width: 18px; height: 18px; border-radius: 50%; background: var(--c); color: #fff; font: 900 11px/18px system-ui; text-align: center; border: 2px solid #27304a; }
.cl-map .side .pl .nv { margin-left: auto; font-size: 11px; color: #1f9e78; }
`;

const DROP_SVG = (c: string) =>
  `<svg class="drop" viewBox="0 0 24 30"><path d="M12 29 C9 22 2 19 2 11 A10 10 0 0 1 22 11 C22 19 15 22 12 29 Z" fill="${c}" stroke="#27304a" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const CROSS_SVG = '<svg viewBox="0 0 22 22"><path d="M11 2v7M11 13v7M2 11h7M13 11h7" stroke="#27304a" stroke-width="2.4" stroke-linecap="round"/></svg>';

const ARROW_SVG = '<svg viewBox="0 0 22 26" class="arr"><path d="M11 1 L21 24 L11 18 L1 24 Z" fill="#e8484a" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>';
const ROSE_SVG =
  '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#fffdf7" stroke="#27304a" stroke-width="2"/><path d="M22 5 L27 22 L22 20 L17 22 Z" fill="#e8484a"/><path d="M22 39 L27 22 L22 24 L17 22 Z" fill="#9aa0b3"/><text x="22" y="15" font-size="0" /></svg>';

export class MapScreen implements UiWidget {
  readonly modal = true;
  private root: HTMLDivElement;
  private viewEl: HTMLDivElement;
  private world: HTMLDivElement;
  private fogCanvas: HTMLCanvasElement;
  private layer: HTMLDivElement;
  private tip: HTMLDivElement;
  private meEl: HTMLDivElement | null = null;
  private questEl: HTMLDivElement | null = null;
  private markerEls: { el: HTMLElement; m: MapMarker }[] = [];
  private zoneEls: { el: HTMLElement; z: MapZoneLabel }[] = [];
  private scaleBar: HTMLDivElement;
  private scaleText: HTMLSpanElement;
  readonly frame: MapFrame;
  cam!: MapCamera;
  private minZoom = 0.5;
  private closed = false;
  private drag: { x: number; y: number; cu: number; cv: number } | null = null;
  private resolve!: () => void;
  readonly done: Promise<void>;
  private offs: (() => void)[] = [];
  private pinEls: { el: HTMLElement; p: MapPin }[] = [];
  private pinList: HTMLDivElement | null = null;
  private pop: HTMLDivElement | null = null;
  private popAt: { x: number; z: number; id: string | null } | null = null;
  private hoverPin: string | null = null;

  constructor(
    ui: UiRoot,
    readonly view: MapView,
  ) {
    injectUiStyles(CSS);
    this.done = new Promise((r) => (this.resolve = r));
    this.frame = { worldSize: view.worldSize, imageSize: [view.image.width, view.image.height] };
    this.root = el('div', 'cl-map', ui.el);
    const frame = el('div', 'frame', this.root);
    const head = el('div', 'head', frame);
    el('div', 't', head, `${view.islandName} · 地图`);
    el('div', 'z', head, view.currentZone ? `当前位置：${view.currentZone}` : view.playerNote ?? '');
    const explored = view.fog.cells.reduce((s, c) => s + c, 0) / Math.max(1, view.fog.cells.length);
    el('div', 'ex', head, `探索度 ${Math.round(explored * 100)}%`);

    this.viewEl = el('div', 'view', frame);
    this.world = el('div', 'world', this.viewEl);
    const base = view.image;
    const img = document.createElement('canvas');
    img.width = base.width;
    img.height = base.height;
    img.getContext('2d')!.drawImage(base, 0, 0);
    this.world.append(img);
    this.fogCanvas = this.buildFog();
    this.world.append(this.fogCanvas);
    this.layer = el('div', 'layer', this.world);
    this.tip = el('div', 'tip', this.viewEl);
    const rose = el('div', 'compassrose', this.viewEl);
    rose.innerHTML = ROSE_SVG;
    const scale = el('div', 'scale', this.viewEl);
    this.scaleBar = el('div', 'bar', scale);
    this.scaleText = el('span', '', scale);
    if (view.playerNote) el('div', 'note', this.viewEl, view.playerNote);
    const zoom = el('div', 'zoom', this.viewEl);
    const zin = el('span', 'interactive', zoom, '+');
    const zout = el('span', 'interactive', zoom, '−');
    const zme = el('span', 'interactive', zoom, '◎');
    zin.addEventListener('click', () => this.zoomBy(1));
    zout.addEventListener('click', () => this.zoomBy(-1));
    zme.addEventListener('click', () => this.centerOn('player'));
    this.buildSide(el('div', 'side', frame));
    const foot = el('div', 'foot', frame);
    const k = view.keyLabels;
    foot.innerHTML = `<span><kbd>↑↓←→</kbd>平移</span><span><kbd>+</kbd><kbd>−</kbd>缩放 / 滚轮</span><span><kbd>${k.center}</kbd>回到自己</span>${
      view.quest ? `<span><kbd>${k.quest}</kbd>任务目标</span>` : ''
    }${view.pins ? '<span><kbd>右键</kbd><kbd>P</kbd>标点</span><span><kbd>N</kbd>导航</span><span><kbd>Del</kbd>删除</span>' : ''}<span style="margin-left:auto"><kbd>${k.close}</kbd>关闭地图</span>`;
    if (view.pins) el('div', 'cross', this.viewEl).innerHTML = CROSS_SVG;

    this.buildLayer();
    const vw = this.viewEl.clientWidth || 900;
    const vh = this.viewEl.clientHeight || 600;
    this.minZoom = Math.min(1, fitZoom(this.frame, vw, vh));
    this.cam = { cu: base.width / 2, cv: base.height / 2, zoom: Math.max(this.minZoom, 1.2) };
    this.centerOn(view.focus === 'quest' && view.quest ? 'quest' : 'player');
    // 标点要在镜头初始化之后再渲染（renderPins 会调用 apply）
    this.renderPins();
    this.bindPointer();
  }

  // ———————————————— 构建 ————————————————

  /** 迷雾：每个探索格一个像素，未探索 = 羊皮纸色；CSS 放大后模糊出柔和边缘 */
  private buildFog(): HTMLCanvasElement {
    const f = this.view.fog;
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    c.className = 'fog';
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(f.w, f.h);
    for (let i = 0; i < f.cells.length; i++) {
      const o = i * 4;
      // 羊皮纸色 + 细微噪点
      const n = ((i * 2654435761) >>> 24) / 255;
      img.data[o] = 222 + n * 10;
      img.data[o + 1] = 208 + n * 8;
      img.data[o + 2] = 170 + n * 6;
      img.data[o + 3] = f.cells[i] ? 0 : 212;
    }
    ctx.putImageData(img, 0, 0);
    c.style.width = `${this.frame.imageSize[0]}px`;
    c.style.height = `${this.frame.imageSize[1]}px`;
    return c;
  }

  private buildLayer(): void {
    const v = this.view;
    const ws = v.worldSize;
    for (const z of v.zones) {
      // 区域名：到访过、或中心点附近探索过才显示
      if (!z.known && !markerVisible('landmark', v.fog, ws, z.x, z.z)) continue;
      const e = el('div', `zn ${z.kind}`, this.layer, z.name);
      if (z.levelRange && z.kind === 'wild') el('small', '', e, `Lv.${z.levelRange[0]}–${z.levelRange[1]}`);
      e.dataset.zone = z.id;
      this.zoneEls.push({ el: e, z });
    }
    for (const m of v.markers) {
      if (!markerVisible(m.kind, v.fog, ws, m.x, m.z, { cleared: m.cleared })) continue;
      const ic = MAP_ICON[m.kind];
      const e = el('div', `mk ${m.kind}${m.dim ? ' dim' : ''}`, this.layer, m.kind === 'alpha' && m.name === '？' ? '?' : ic.glyph);
      e.style.setProperty('--c', ic.color);
      e.dataset.marker = m.id;
      e.addEventListener('mouseenter', () => this.showTip(m));
      e.addEventListener('mouseleave', () => (this.tip.style.display = 'none'));
      // 原有地点也可以选中导航（未发现的头目巢穴「？」除外）
      e.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      e.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (this.view.pins && !(m.kind === 'alpha' && m.name === '？')) this.openMarkerPop(m);
      });
      this.markerEls.push({ el: e, m });
    }
    if (v.quest) {
      const q = el('div', 'qt', this.layer);
      q.style.setProperty('--c', CAT_COLOR[v.quest.category]);
      if (v.quest.radius > 0) el('div', 'ring', q);
      el('div', 'gem', q);
      q.dataset.quest = v.quest.title;
      this.questEl = q;
    }
    if (v.player) {
      this.meEl = el('div', 'me', this.layer);
      el('div', 'pulse', this.meEl);
      this.meEl.insertAdjacentHTML('beforeend', ARROW_SVG);
    }
  }

  private buildSide(side: HTMLDivElement): void {
    const v = this.view;
    el('h4', '', side, '追踪中的任务');
    if (v.quest) {
      const c = el('div', 'qcard', side);
      c.style.setProperty('--c', CAT_COLOR[v.quest.category]);
      el('div', 'qt1', c, v.quest.title);
      el('div', 'qo', c, `○ ${v.quest.objective}`);
    } else el('div', 'none', side, '没有追踪中的任务');
    if (v.pins) {
      el('h4', '', side, '我的标点');
      this.pinList = el('div', '', side);
      this.pinList.style.marginBottom = '16px';
    }
    el('h4', '', side, '图例');
    const me = el('div', 'lg me2', side);
    const dot = el('span', 'dot', me);
    dot.innerHTML = ARROW_SVG.replace('class="arr"', 'width="16" height="18"');
    el('span', '', me, '你的位置');
    for (const kind of LEGEND_ORDER) {
      const shown = this.markerEls.filter((m) => m.m.kind === kind).length;
      if (!shown && kind !== 'pokecenter') continue;
      const row = el('div', 'lg', side);
      const ic = MAP_ICON[kind];
      const m = el('span', `mk ${kind}`, row, ic.glyph);
      m.style.setProperty('--c', ic.color);
      el('span', '', row, ic.label);
      el('span', 'n', row, String(shown));
      row.addEventListener('mouseenter', () => this.markerEls.forEach((x) => x.el.classList.toggle('hl', x.m.kind === kind)));
      row.addEventListener('mouseleave', () => this.markerEls.forEach((x) => x.el.classList.remove('hl')));
    }
  }

  private showTip(m: MapMarker): void {
    const { u, v } = worldToMap(this.frame, m.x, m.z);
    const p = this.toScreen(u, v);
    this.tip.innerHTML = '';
    this.tip.append(m.name);
    if (m.sub) el('small', '', this.tip, m.sub);
    this.tip.style.left = `${p.x}px`;
    this.tip.style.top = `${p.y}px`;
    this.tip.style.display = 'block';
  }

  // ———————————————— 视图 ————————————————

  private get vw(): number {
    return this.viewEl.clientWidth || 900;
  }

  private get vh(): number {
    return this.viewEl.clientHeight || 600;
  }

  private toScreen(u: number, v: number): { x: number; y: number } {
    return { x: (u - this.cam.cu) * this.cam.zoom + this.vw / 2, y: (v - this.cam.cv) * this.cam.zoom + this.vh / 2 };
  }

  centerOn(what: 'player' | 'quest'): void {
    const t = what === 'quest' ? this.view.quest : this.view.player;
    if (t) {
      const { u, v } = worldToMap(this.frame, t.x, t.z);
      this.cam = { ...this.cam, cu: u, cv: v };
    }
    this.apply();
  }

  zoomBy(dir: 1 | -1, sx = 0, sy = 0): void {
    const z = stepZoom(this.cam.zoom, dir, this.minZoom);
    this.cam = zoomAt(this.cam, z, sx, sy);
    this.apply();
  }

  private apply(): void {
    this.cam = clampCamera(this.frame, this.cam, this.vw, this.vh);
    const { cu, cv, zoom } = this.cam;
    const tx = this.vw / 2 - cu * zoom;
    const ty = this.vh / 2 - cv * zoom;
    this.world.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${zoom})`;
    // 标记保持屏幕尺寸不变：反向缩放
    const inv = 1 / zoom;
    const place = (e: HTMLElement, x: number, z: number) => {
      const p = worldToMap(this.frame, x, z);
      e.style.left = `${p.u}px`;
      e.style.top = `${p.v}px`;
      e.style.transform = e.classList.contains('zn') ? `translate(-50%, -50%) scale(${inv})` : `scale(${inv})`;
    };
    for (const m of this.markerEls) place(m.el, m.m.x, m.m.z);
    for (const z of this.zoneEls) place(z.el, z.z.x, z.z.z);
    const v = this.view;
    if (this.meEl && v.player) {
      place(this.meEl, v.player.x, v.player.z);
      this.meEl.style.transform = `scale(${inv}) rotate(${facingToMapDeg(v.player.facing)}deg)`;
    }
    if (this.questEl && v.quest) {
      place(this.questEl, v.quest.x, v.quest.z);
      const ring = this.questEl.querySelector<HTMLElement>('.ring');
      if (ring) {
        // 搜索范围按真实尺寸（抵消反向缩放）
        const r = (v.quest.radius / v.worldSize[0]) * this.frame.imageSize[0] * zoom;
        ring.style.width = ring.style.height = `${r * 2}px`;
      }
    }
    for (const p of this.pinEls) place(p.el, p.p.x, p.p.z);
    if (this.pop && this.popAt) {
      const m = worldToMap(this.frame, this.popAt.x, this.popAt.z);
      const sp = this.toScreen(m.u, m.v);
      this.pop.style.left = `${sp.x}px`;
      this.pop.style.top = `${sp.y - (this.popAt.id ? 24 : 0)}px`;
    }
    // 比例尺：选一个接近 90 屏幕像素的整数米数
    const mPerPx = v.worldSize[0] / this.frame.imageSize[0] / zoom;
    const target = 90 * mPerPx;
    const nice = [10, 20, 25, 50, 100, 200, 250, 500].find((n) => n >= target * 0.7) ?? 500;
    this.scaleBar.style.width = `${nice / mPerPx}px`;
    this.scaleText.textContent = `${nice} m`;
    this.tip.style.display = 'none';
  }

  private bindPointer(): void {
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      if ((e.target as HTMLElement).closest('.zoom, .pin, .pop')) return;
      this.closePop();
      this.drag = { x: e.clientX, y: e.clientY, cu: this.cam.cu, cv: this.cam.cv };
      this.viewEl.classList.add('drag');
      this.viewEl.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!this.drag) return;
      this.cam = { ...this.cam, cu: this.drag.cu - (e.clientX - this.drag.x) / this.cam.zoom, cv: this.drag.cv - (e.clientY - this.drag.y) / this.cam.zoom };
      this.apply();
    };
    const onUp = () => {
      this.drag = null;
      this.viewEl.classList.remove('drag');
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = this.viewEl.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    this.viewEl.addEventListener('pointerdown', onDown);
    this.viewEl.addEventListener('pointermove', onMove);
    this.viewEl.addEventListener('pointerup', onUp);
    this.viewEl.addEventListener('pointercancel', onUp);
    this.viewEl.addEventListener('wheel', onWheel, { passive: false });
    // 右键：在光标处放置标点
    this.viewEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.view.pins) return;
      const r = this.viewEl.getBoundingClientRect();
      const u = this.cam.cu + (e.clientX - r.left - r.width / 2) / this.cam.zoom;
      const v = this.cam.cv + (e.clientY - r.top - r.height / 2) / this.cam.zoom;
      const w = mapToWorld(this.frame, u, v);
      this.openPop(w.x, w.z, null);
    });
    // 点击遮罩空白关闭
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    this.offs.push(() => {
      this.viewEl.removeEventListener('wheel', onWheel);
    });
  }

  // ———————————————— 输入 ————————————————

  update(dt: number, input: Input): boolean {
    if (this.closed) return true;
    if (input.pressed('map', true) || input.pressed('back', true) || input.pressed('menu', true)) {
      this.close();
      return true;
    }
    // 连续平移：按住方向键 / WASD / 左摇杆
    let dx = (input.isDown('uiRight', true) ? 1 : 0) - (input.isDown('uiLeft', true) ? 1 : 0);
    let dy = (input.isDown('uiDown', true) ? 1 : 0) - (input.isDown('uiUp', true) ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.cam = { ...this.cam, cu: this.cam.cu + (dx * PAN_SPEED * dt) / this.cam.zoom, cv: this.cam.cv + (dy * PAN_SPEED * dt) / this.cam.zoom };
      this.apply();
    }
    const k = (c: string) => input.pressedCode(c);
    if (k('Equal') || k('NumpadAdd') || k('PageUp') || input.pressed('run', true)) this.zoomBy(1);
    if (k('Minus') || k('NumpadSubtract') || k('PageDown') || input.pressed('camReset', true)) this.zoomBy(-1);
    if (input.pressedCode('KeyC')) this.centerOn('player');
    if (this.view.pins) {
      if (input.pressedCode('KeyP')) {
        const w = mapToWorld(this.frame, this.cam.cu, this.cam.cv);
        this.openPop(w.x, w.z, null);
      }
      const pid = this.hoverPin ?? this.popAt?.id ?? null;
      const target = pid?.startsWith('pin-') ? pid : null;
      if (input.pressedCode('KeyN') && target) {
        this.view.pins.toggleNav(target);
        this.renderPins();
      }
      if ((input.pressedCode('Delete') || input.pressedCode('KeyX')) && target) {
        this.view.pins.remove(target);
        this.hoverPin = null;
        this.closePop();
        this.renderPins();
      }
    }
    if (input.pressedCode('KeyT') && this.view.quest) this.centerOn('quest');
    return false;
  }

  // ———————————————— 自定义标点 ————————————————

  private renderPins(): void {
    const ops = this.view.pins;
    if (!ops) return;
    const navM = ops.navMarker();
    for (const x of this.markerEls) x.el.classList.toggle('navm', x.m.id === navM);
    for (const p of this.pinEls) p.el.remove();
    this.pinEls = [];
    const nav = ops.nav();
    for (const p of ops.list()) {
      const st = PIN_STYLE[p.kind];
      const e = el('div', `pin${p.id === nav ? ' nav' : ''}`, this.layer);
      e.style.setProperty('--c', st.color);
      e.innerHTML = DROP_SVG(st.color) + `<div class="g">${st.glyph}</div>`;
      if (p.label) el('div', 'lb', e, p.label);
      e.dataset.pin = p.id;
      e.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      e.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.openPop(p.x, p.z, p.id);
      });
      e.addEventListener('mouseenter', () => (this.hoverPin = p.id));
      e.addEventListener('mouseleave', () => (this.hoverPin === p.id ? (this.hoverPin = null) : null));
      this.pinEls.push({ el: e, p });
    }
    if (this.pinList) {
      this.pinList.innerHTML = '';
      const list = ops.list();
      if (!list.length) el('div', 'none', this.pinList, '右键地图（或按 P）放置标点');
      for (const p of list) {
        const st = PIN_STYLE[p.kind];
        const row = el('div', 'pl', this.pinList);
        const dot = el('span', 'dot', row, st.glyph);
        dot.style.setProperty('--c', st.color);
        el('span', '', row, p.label || `${st.name}（${Math.round(p.x)}, ${Math.round(-p.z)}）`);
        if (p.id === nav) el('span', 'nv', row, '导航中');
        row.addEventListener('click', () => {
          const m = worldToMap(this.frame, p.x, p.z);
          this.cam = { ...this.cam, cu: m.u, cv: m.v };
          this.openPop(p.x, p.z, p.id);
        });
      }
      el('div', 'n', this.pinList, `${list.length} / ${MAX_PINS}`).style.cssText = 'font-size:11px;color:#9a8f74;margin-top:4px;text-align:right';
    }
    this.apply();
  }

  /** 标点弹窗：id = null 新建（选样式），否则编辑（导航 / 改样式 / 删除） */
  private openPop(x: number, z: number, id: string | null): void {
    const ops = this.view.pins;
    if (!ops) return;
    this.closePop();
    const pin = id ? ops.list().find((p) => p.id === id) ?? null : null;
    const pop = el('div', 'pop', this.viewEl);
    pop.addEventListener('pointerdown', (e) => e.stopPropagation());
    el('div', '', pop, pin ? `${PIN_STYLE[pin.kind].name}标点` : ops.list().length >= MAX_PINS ? `标点已满（${MAX_PINS}）` : '放置标点');
    const row = el('div', 'row', pop);
    for (const k of PIN_KINDS) {
      const b = el('span', `k${pin?.kind === k ? ' on' : ''}`, row, PIN_STYLE[k].glyph);
      b.style.setProperty('--c', PIN_STYLE[k].color);
      b.title = PIN_STYLE[k].name;
      b.addEventListener('click', () => {
        if (pin) ops.setKind(pin.id, k);
        else if (!ops.add(x, z, k)) return;
        this.closePop();
        this.renderPins();
      });
    }
    if (pin) {
      const nav = ops.nav() === pin.id;
      el('div', 'b', pop, nav ? '取消导航' : '导航到这里').addEventListener('click', () => {
        ops.toggleNav(pin.id);
        this.closePop();
        this.renderPins();
      });
      el('div', 'b red', pop, '删除标点').addEventListener('click', () => {
        ops.remove(pin.id);
        this.closePop();
        this.renderPins();
      });
    } else {
      const quick = el('div', 'b', pop, '放置并导航');
      quick.addEventListener('click', () => {
        const p = ops.add(x, z, 'flag');
        if (p) ops.toggleNav(p.id);
        this.closePop();
        this.renderPins();
      });
    }
    el('div', 'b ghost', pop, '取消').addEventListener('click', () => this.closePop());
    this.pop = pop;
    this.popAt = { x, z, id };
    this.apply();
  }

  /** 原有地点弹窗：名称 + 说明 + 导航 / 取消导航 */
  private openMarkerPop(m: MapMarker): void {
    const ops = this.view.pins;
    if (!ops) return;
    this.closePop();
    this.tip.style.display = 'none';
    const pop = el('div', 'pop', this.viewEl);
    pop.addEventListener('pointerdown', (e) => e.stopPropagation());
    const ic = MAP_ICON[m.kind];
    const head = el('div', '', pop);
    head.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px';
    const dot = el('span', 'k', head, ic.glyph);
    dot.style.cssText = `--c:#fffdf7;color:${ic.color};width:22px;height:22px;cursor:default`;
    el('span', '', head, m.name);
    if (m.sub) el('div', '', pop, m.sub).style.cssText = 'font-weight:500;color:#5a6280;font-size:11px;line-height:1.4';
    const nav = ops.navMarker() === m.id;
    el('div', 'b', pop, nav ? '取消导航' : '导航到这里').addEventListener('click', () => {
      ops.toggleNavMarker(m);
      this.closePop();
      this.renderPins();
    });
    el('div', 'b ghost', pop, '取消').addEventListener('click', () => this.closePop());
    this.pop = pop;
    this.popAt = { x: m.x, z: m.z, id: m.id };
    this.apply();
  }

  private closePop(): void {
    this.pop?.remove();
    this.pop = null;
    this.popAt = null;
  }

  /** e2e：可见标记 id 与区域名 */
  get shown(): { markers: string[]; zones: string[] } {
    return { markers: this.markerEls.map((m) => m.m.id), zones: this.zoneEls.map((z) => z.z.id) };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.resolve();
  }

  dispose(): void {
    for (const f of this.offs) f();
    this.root.remove();
  }
}

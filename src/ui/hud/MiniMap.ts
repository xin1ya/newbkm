/**
 * HUD 小地图（左下角圆形）：
 * - 底图 = 大地图烘焙的地形图，叠加探索迷雾；镜头旋转模式下镜头前方朝上（设置可切换北朝上）；
 * - 标记：宝可梦中心 / 商店 / 道馆等（探索过的才显示）、追踪任务目标、自定义标点；
 *   任务目标与导航标点在范围外时钳到圆周上并显示距离；
 * - 中心是玩家箭头；圆周上有 N 方位；点击小地图打开大地图；
 * - 场景每帧调用 update；超过 0.4 s 没有更新（进入室内 / 战斗 / 场景切换）自动隐藏。
 */
import { miniProject, PIN_STYLE, type FogMask, type MapPin } from '@/systems/map';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot } from '../core/UiRoot';

export interface MiniMapMarker {
  x: number;
  z: number;
  glyph: string;
  color: string;
}

export interface MiniMapFrame {
  image: HTMLCanvasElement;
  worldSize: [number, number];
  fog: FogMask | null;
  player: { x: number; z: number; facing: number };
  /** 镜头朝向（rotate 模式用） */
  cameraYaw: number;
  rotate: boolean;
  markers: MiniMapMarker[];
  quest: { x: number; z: number; color: string } | null;
  pins: MapPin[];
  navPin: string | null;
  /** 导航中的原有地点 */
  navTarget: { x: number; z: number; name: string } | null;
  /** 当前区域名（小地图下方） */
  zone: string;
}

const SIZE = 184;
const R = SIZE / 2 - 6;
/** 小地图半径对应的世界距离（米） */
const VIEW_M = [70, 120, 200] as const;

const CSS = `
.cl-mini { position: absolute; left: 16px; bottom: 16px; width: ${SIZE}px; pointer-events: auto; user-select: none; z-index: 3; }
.cl-mini canvas { display: block; width: ${SIZE}px; height: ${SIZE}px; border-radius: 50%; cursor: pointer;
  box-shadow: 0 0 0 3px #27304a, 0 4px 0 3px #27304a, 0 8px 18px rgba(0,0,0,.35); background: #b9d6e0; }
.cl-mini .zn { margin-top: 10px; text-align: center; font: 700 12px/1.2 system-ui; color: #fff; text-shadow: 0 1px 2px #000, 0 0 4px #27304a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-mini .zm { position: absolute; right: -4px; top: -4px; width: 24px; height: 24px; border-radius: 50%; background: #fffdf7; border: 2px solid #27304a;
  font: 900 13px/20px system-ui; text-align: center; cursor: pointer; color: #27304a; }
`;

export class MiniMap {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private zoneEl: HTMLDivElement;
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogRef: FogMask | null = null;
  private lastUpdate = -1;
  private acc = 1;
  private zoomIdx = 1;
  private shown = false;
  private raf = 0;
  /** 点击小地图（打开大地图） */
  onClick: (() => void) | null = null;

  constructor(ui: UiRoot) {
    injectUiStyles(CSS);
    this.root = el('div', 'cl-mini', ui.el);
    this.root.style.display = 'none';
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = this.canvas.height = Math.round(SIZE * dpr);
    this.root.append(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    const zm = el('div', 'zm', this.root, '±');
    zm.title = '缩放小地图';
    zm.addEventListener('click', (e) => {
      e.stopPropagation();
      this.zoomIdx = (this.zoomIdx + 1) % VIEW_M.length;
      this.acc = 1;
    });
    this.zoneEl = el('div', 'zn', this.root);
    this.canvas.addEventListener('click', () => this.onClick?.());
    // 看门狗：场景停止更新后隐藏
    const tick = () => {
      if (this.shown && performance.now() - this.lastUpdate > 400) this.setShown(false);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  get viewMeters(): number {
    return VIEW_M[this.zoomIdx]!;
  }

  private setShown(v: boolean): void {
    if (v === this.shown) return;
    this.shown = v;
    this.root.style.display = v ? '' : 'none';
  }

  /** 每帧调用；frame = null 隐藏（设置关闭 / HUD 隐藏） */
  update(dt: number, frame: MiniMapFrame | null): void {
    if (!frame) {
      this.setShown(false);
      return;
    }
    this.lastUpdate = performance.now();
    this.setShown(true);
    this.acc += dt;
    if (this.acc < 1 / 24) return; // 24 Hz 足够
    this.acc = 0;
    this.draw(frame);
  }

  private ensureFog(f: FogMask | null): HTMLCanvasElement | null {
    if (!f) return null;
    if (f === this.fogRef && this.fogCanvas) return this.fogCanvas;
    this.fogRef = f;
    const c = this.fogCanvas ?? document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(f.w, f.h);
    for (let i = 0; i < f.cells.length; i++) {
      const o = i * 4;
      img.data[o] = 214;
      img.data[o + 1] = 202;
      img.data[o + 2] = 168;
      img.data[o + 3] = f.cells[i] ? 0 : 190;
    }
    ctx.putImageData(img, 0, 0);
    this.fogCanvas = c;
    return c;
  }

  private draw(f: MiniMapFrame): void {
    const ctx = this.ctx;
    const c = SIZE / 2;
    const scale = R / this.viewMeters; // 像素 / 米
    const rot = f.rotate ? f.cameraYaw : null;
    const cs = Math.cos(f.cameraYaw);
    const sn = Math.sin(f.cameraYaw);
    // 世界（相对玩家，米）→ 屏幕的线性变换（与 miniProject 一致）
    const [a, b, cc, d] = rot === null ? [1, 0, 0, 1] : [-cs, -sn, sn, -cs];
    const dpr = this.canvas.width / SIZE;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, R + 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#7fb8cf';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // 底图 + 迷雾
    ctx.setTransform(dpr * a * scale, dpr * b * scale, dpr * cc * scale, dpr * d * scale, dpr * c, dpr * c);
    const [W, H] = f.worldSize;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(f.image, -W / 2 - f.player.x, -H / 2 - f.player.z, W, H);
    const fog = this.ensureFog(f.fog);
    if (fog) ctx.drawImage(fog, -W / 2 - f.player.x, -H / 2 - f.player.z, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 内圈暗角
    const g = ctx.createRadialGradient(c, c, R * 0.7, c, c, R + 4);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,28,48,.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();

    const proj = (x: number, z: number) => miniProject(x - f.player.x, z - f.player.z, scale, R - 8, rot);
    // 普通标记（范围内才画）
    for (const m of f.markers) {
      const p = proj(m.x, m.z);
      if (p.edge) continue;
      this.badge(c + p.x, c + p.y, 8, m.color, m.glyph, '#fffdf7');
    }
    // 自定义标点
    for (const pin of f.pins) {
      const st = PIN_STYLE[pin.kind];
      const nav = pin.id === f.navPin;
      const p = proj(pin.x, pin.z);
      if (p.edge && !nav) continue;
      this.pinShape(c + p.x, c + p.y, st.color, st.glyph, nav);
      if (nav && p.edge) this.distLabel(c + p.x, c + p.y, Math.hypot(pin.x - f.player.x, pin.z - f.player.z), st.color);
    }
    // 导航中的原有地点：青绿水滴 + 距离
    if (f.navTarget) {
      const p = proj(f.navTarget.x, f.navTarget.z);
      this.pinShape(c + p.x, c + p.y, '#1fae86', '➤', true);
      if (p.edge) this.distLabel(c + p.x, c + p.y, Math.hypot(f.navTarget.x - f.player.x, f.navTarget.z - f.player.z), '#3fe0b0');
    }
    // 任务目标
    if (f.quest) {
      const p = proj(f.quest.x, f.quest.z);
      ctx.save();
      ctx.translate(c + p.x, c + p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = f.quest.color;
      ctx.strokeStyle = '#27304a';
      ctx.lineWidth = 2;
      ctx.fillRect(-5.5, -5.5, 11, 11);
      ctx.strokeRect(-5.5, -5.5, 11, 11);
      ctx.restore();
      if (p.edge) this.distLabel(c + p.x, c + p.y, Math.hypot(f.quest.x - f.player.x, f.quest.z - f.player.z), f.quest.color);
    }
    // 方位 N
    const n = miniProject(0, -1e6, 1, R - 2, rot);
    this.badge(c + n.x, c + n.y, 8, '#e8484a', 'N', '#fff', '#e8484a');
    // 玩家箭头
    const fd = miniProject(Math.sin(f.player.facing), Math.cos(f.player.facing), 1, 1e9, rot);
    const ang = Math.atan2(fd.x, -fd.y);
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fillStyle = '#e8484a';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // 视野扇形（镜头方向，北朝上模式下才需要）
    if (rot === null) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(Math.atan2(sn, -cs));
      const vg = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
      vg.addColorStop(0, 'rgba(255,255,255,.35)');
      vg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 46, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (this.zoneEl.textContent !== f.zone) this.zoneEl.textContent = f.zone;
  }

  private badge(x: number, y: number, r: number, color: string, glyph: string, fill: string, stroke = '#27304a'): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `800 ${r * 1.25}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y + 0.5);
  }

  /** 水滴形标点；导航中的标点更大并有光圈 */
  private pinShape(x: number, y: number, color: string, glyph: string, nav: boolean): void {
    const ctx = this.ctx;
    const s = nav ? 1.25 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (nav) {
      ctx.beginPath();
      ctx.arc(0, -10, 12 + Math.sin(performance.now() / 220) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `${color}44`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-3, -5, -8, -7, -8, -12);
    ctx.arc(0, -12, 8, Math.PI, 0);
    ctx.bezierCurveTo(8, -7, 3, -5, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#27304a';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '800 9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 0, -12);
    ctx.restore();
  }

  private distLabel(x: number, y: number, dist: number, color: string): void {
    const ctx = this.ctx;
    const c = SIZE / 2;
    // 标签放在圆周点朝圆心方向一点
    const lx = x + (c - x) * 0.22;
    const ly = y + (c - y) * 0.22;
    const t = dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`;
    ctx.font = '700 10px system-ui';
    const w = ctx.measureText(t).width + 8;
    ctx.fillStyle = 'rgba(39,48,74,.85)';
    ctx.beginPath();
    ctx.roundRect?.(lx - w / 2, ly - 7, w, 14, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, lx, ly + 0.5);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.root.remove();
  }
}

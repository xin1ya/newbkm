/**
 * 大地图 HUD：区域名横幅、时钟、操作提示、调试面板（F3）。
 */
import { el } from '../core/styles';
import type { UiRoot } from '../core/UiRoot';

export class Hud {
  private banner: HTMLDivElement;
  private bannerName: HTMLDivElement;
  private bannerSub: HTMLDivElement;
  private bannerTimer = 0;
  private clock: HTMLDivElement;
  private loc: HTMLDivElement;
  private hint: HTMLDivElement;
  private debug: HTMLDivElement;
  private bike: HTMLDivElement;
  private bikeKey = '';
  debugVisible = false;

  constructor(root: UiRoot) {
    this.banner = el('div', 'cl-banner', root.el);
    this.bannerName = el('div', 'name', this.banner);
    el('div', 'line', this.banner);
    this.bannerSub = el('div', 'sub', this.banner);
    this.clock = el('div', 'cl-card cl-clock', root.el, '08:00');
    // 常驻地名（左上角）
    this.loc = el('div', 'cl-card cl-loc', this.clock.parentElement ?? root.el);
    this.loc.style.cssText = 'position:absolute;left:16px;top:14px;padding:5px 12px;font:600 13px/1.2 system-ui;pointer-events:none;';
    this.hint = el('div', 'cl-hint', root.el);
    this.hint.innerHTML =
      '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动　<kbd>Shift</kbd> 跑步<br>拖拽鼠标 转动镜头　<kbd>V</kbd> 第一人称<br><kbd>Esc</kbd> 菜单　<kbd>J</kbd> 任务　<kbd>F3</kbd> 调试　<kbd>F5</kbd> 存档';
    this.debug = el('div', 'cl-debug', root.el);
    this.debug.style.display = 'none';
    // 自行车仪表（骑车时显示在底部中央）
    this.bike = el('div', 'cl-card', root.el);
    this.bike.style.cssText =
      'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:none;padding:6px 14px;font:600 13px/1.2 system-ui;pointer-events:none;align-items:center;gap:10px;';
  }

  /** 自行车仪表：档位 + 车速；null 隐藏 */
  setBike(info: { gear: number; gears: number; name: string; speed: number; top: number } | null): void {
    if (!info) {
      if (this.bikeKey) {
        this.bike.style.display = 'none';
        this.bikeKey = '';
      }
      return;
    }
    const kmh = Math.round(info.speed * 3.6);
    const key = `${info.gear}:${kmh}`;
    if (key === this.bikeKey) return;
    this.bikeKey = key;
    this.bike.style.display = 'flex';
    const pips = Array.from({ length: info.gears }, (_, i) => {
      const on = i < info.gear;
      return `<span style="display:inline-block;width:10px;height:${8 + i * 5}px;margin-right:3px;border-radius:2px;vertical-align:bottom;background:${on ? (i === 2 ? '#f0703a' : '#3fbf7f') : '#c9cfd9'};border:1.5px solid #2a3144"></span>`;
    }).join('');
    const pct = Math.min(100, Math.round((info.speed / Math.max(1, info.top * 1.25)) * 100));
    this.bike.innerHTML =
      `<span>${pips}</span><span style="min-width:84px">${info.name}</span>` +
      `<span style="display:inline-block;width:80px;height:8px;border-radius:4px;background:#dfe3ea;border:1.5px solid #2a3144;overflow:hidden"><span style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#3fbf7f,#f2c230,#f0703a)"></span></span>` +
      `<span style="min-width:62px;text-align:right;font-variant-numeric:tabular-nums">${kmh} km/h</span><span style="opacity:.6;font-size:11px">Q/X 换挡</span>`;
  }

  showZone(name: string, sub: string): void {
    this.bannerName.textContent = name;
    this.bannerSub.textContent = sub;
    this.banner.classList.add('show');
    this.bannerTimer = 3.2;
  }

  setLocation(text: string): void {
    if (this.loc.textContent !== text) this.loc.textContent = text;
  }

  setClock(text: string, weather: string): void {
    this.clock.textContent = `${text}  ${weather}`;
  }

  /** HUD 是否显示（小地图跟随） */
  visible = true;

  setVisible(v: boolean): void {
    this.visible = v;
    for (const e of [this.clock, this.hint, this.loc]) e.style.display = v ? '' : 'none';
    if (!v) this.setBike(null);
    if (!v) this.banner.classList.remove('show');
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.debug.style.display = this.debugVisible ? '' : 'none';
  }

  setDebug(text: string): void {
    if (this.debugVisible) this.debug.textContent = text;
  }

  update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
  }
}

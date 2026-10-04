/**
 * M1-16 · 任务 HUD（设计 §7.3）：
 * - 罗盘条（屏幕顶部）：方位刻度随镜头朝向滚动，追踪目标显示为菱形图标 + 距离；超出视野时贴边并显示箭头。
 * - 追踪面板（右上，时钟下方）：任务类别色标、标题、当前目标、计数进度、距离 / 提示。
 * - 世界标记：目标上方的浮空图标（设置中可关闭），近处淡出，屏幕外隐藏（罗盘负责指路）。
 * - 通知卡片（左侧）：新任务 / 目标完成 / 任务完成 + 奖励，排队依次滑入。
 * 纯 DOM：数据由场景侧的 QuestDirector 每帧推送。
 */
import * as THREE from 'three';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot } from '../core/UiRoot';

export type QuestCategoryView = 'main' | 'side' | 'hidden';

export interface TrackerView {
  category: QuestCategoryView;
  title: string;
  objective: string;
  /** 计数进度「1/3」 */
  progress?: string | undefined;
  /** 距离或位置提示（「128 m」「目标在碧潮群岛」「在搜索范围内」） */
  note?: string | undefined;
}

export interface CompassTarget {
  /** 相对镜头朝向（度，负 = 左） */
  relative: number;
  distance: string;
  /** 已进入搜索范围 / 目标区域 */
  inside: boolean;
  /** 搜索范围标记（显示为圆圈而不是菱形） */
  area: boolean;
}

export interface CompassView {
  heading: number;
  target: CompassTarget | null;
  /** 没有方向时的说明（室内、其他岛屿） */
  note?: string | undefined;
}

export interface QuestNoticeView {
  kind: 'available' | 'started' | 'objective' | 'completed';
  title: string;
  lines: string[];
  category: QuestCategoryView;
}

/** 罗盘可见范围（度）：左右各一半 */
export const COMPASS_SPAN = 180;
const COMPASS_WIDTH = 560;
const CARDINALS: [number, string][] = [
  [0, '北'],
  [45, '东北'],
  [90, '东'],
  [135, '东南'],
  [180, '南'],
  [225, '西南'],
  [270, '西'],
  [315, '西北'],
];
const NOTICE_TITLE: Record<QuestNoticeView['kind'], string> = {
  available: '可接取任务',
  started: '新任务',
  objective: '目标完成',
  completed: '任务完成',
};
const NOTICE_MS = 3600;

const CSS = `
.cl-compass { position: absolute; left: 50%; top: 12px; width: ${COMPASS_WIDTH}px; height: 38px; transform: translateX(-50%); pointer-events: none;
  transition: opacity .3s; }
.cl-compass.hidden { opacity: 0; }
.cl-compass .strip { position: absolute; inset: 0; overflow: hidden; border-radius: 19px; background: linear-gradient(90deg, rgba(20,28,48,0), rgba(20,28,48,.55) 18%, rgba(20,28,48,.55) 82%, rgba(20,28,48,0));
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); }
.cl-compass .tick { position: absolute; top: 5px; width: 2px; height: 7px; margin-left: -1px; background: rgba(255,255,255,.55); border-radius: 1px; }
.cl-compass .tick.major { height: 10px; background: rgba(255,255,255,.8); }
.cl-compass .card { position: absolute; top: 15px; transform: translateX(-50%); color: #fff; font: 700 13px/18px system-ui; text-shadow: 0 1px 2px rgba(0,0,0,.6); white-space: nowrap; }
.cl-compass .card.n { color: #ffcf4a; font-size: 15px; }
.cl-compass .card.minor { font-size: 11px; opacity: .75; }
.cl-compass .center { position: absolute; left: 50%; top: -4px; width: 0; height: 0; margin-left: -6px; border: 6px solid transparent; border-top-color: #fff; filter: drop-shadow(0 1px 1px rgba(0,0,0,.5)); }
.cl-compass .goal { position: absolute; top: 3px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; transition: opacity .2s; }
.cl-compass .goal .ico { width: 16px; height: 16px; background: #ffcf4a; border: 2px solid #27304a; transform: rotate(45deg); border-radius: 3px; box-shadow: 0 0 10px rgba(255,207,74,.8); }
.cl-compass .goal.area .ico { transform: none; border-radius: 50%; background: rgba(255,207,74,.35); border-color: #ffcf4a; }
.cl-compass .goal.inside .ico { animation: cl-goal-pulse 1.2s ease-in-out infinite; }
.cl-compass .goal .dist { margin-top: 4px; padding: 0 6px; border-radius: 8px; background: rgba(20,28,48,.75); color: #ffe7a3; font: 700 11px/16px system-ui; white-space: nowrap; }
.cl-compass .goal .arrow { position: absolute; top: 2px; color: #ffcf4a; font: 900 14px/1 system-ui; text-shadow: 0 1px 2px #000; }
.cl-compass .goal.edge-l .arrow { left: -16px; }
.cl-compass .goal.edge-r .arrow { right: -16px; }
.cl-compass .note { position: absolute; left: 50%; top: 42px; transform: translateX(-50%); padding: 2px 10px; border-radius: 9px; background: rgba(20,28,48,.7); color: #fff; font: 600 12px/18px system-ui; white-space: nowrap; }
@keyframes cl-goal-pulse { 0%,100% { box-shadow: 0 0 4px rgba(255,207,74,.6); } 50% { box-shadow: 0 0 16px rgba(255,207,74,1); } }

.cl-tracker { position: absolute; right: 16px; top: 62px; width: 290px; padding: 10px 14px 10px 16px; pointer-events: none;
  background: rgba(20,28,48,.62); color: #fff; border-radius: 12px; border-left: 5px solid var(--cat, #ffcf4a); text-shadow: 0 1px 2px rgba(0,0,0,.5); transition: opacity .3s, transform .3s; }
.cl-tracker.hidden { opacity: 0; transform: translateX(12px); }
.cl-tracker .cat { font: 700 11px/14px system-ui; letter-spacing: .15em; color: var(--cat, #ffcf4a); }
.cl-tracker .t { font: 800 16px/22px system-ui; margin: 1px 0 4px; }
.cl-tracker .o { font: 500 13px/19px system-ui; display: flex; gap: 6px; }
.cl-tracker .o::before { content: '○'; color: var(--cat, #ffcf4a); }
.cl-tracker .p { margin-left: auto; font-weight: 700; color: #ffe7a3; }
.cl-tracker .n { margin-top: 3px; font: 600 12px/16px system-ui; color: #cfe3ff; }
.cl-tracker .k { margin-top: 5px; font: 500 11px/14px system-ui; opacity: .7; }
.cl-tracker .k kbd { display: inline-block; min-width: 16px; padding: 0 4px; border: 1px solid #fff; border-radius: 4px; font: 700 10px/14px system-ui; text-align: center; }
.cl-tracker.flash { animation: cl-tracker-flash .9s ease-out; }
@keyframes cl-tracker-flash { 0% { background: rgba(255,207,74,.55); } 100% { background: rgba(20,28,48,.62); } }

.cl-wmarker { position: absolute; left: 0; top: 0; pointer-events: none; display: flex; flex-direction: column; align-items: center; transition: opacity .25s; will-change: transform, opacity; }
.cl-wmarker .gem { width: 20px; height: 20px; background: #ffcf4a; border: 3px solid #27304a; border-radius: 4px; transform: rotate(45deg); box-shadow: 0 0 14px rgba(255,207,74,.9);
  animation: cl-wm-bob 1.8s ease-in-out infinite; }
.cl-wmarker.area .gem { border-radius: 50%; transform: none; background: rgba(255,207,74,.4); border-color: #ffcf4a; }
.cl-wmarker .d { margin-top: 8px; padding: 1px 8px; border-radius: 9px; background: rgba(20,28,48,.75); color: #fff; font: 700 12px/17px system-ui; white-space: nowrap; }
@keyframes cl-wm-bob { 0%,100% { translate: 0 0; } 50% { translate: 0 -5px; } }

.cl-qnotices { position: absolute; left: 16px; top: 120px; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
/* 章节 / 结尾卡与梦境旁白是全屏演出：期间隐藏任务提示（M1-22；提示本身按计时消失，不会丢） */
.cl-ui:has(.cl-story-card, .cl-story-narrate) .cl-qnotices { opacity: 0; }
/* 御三家选择卡片居中铺开，任务追踪面板会压住右侧卡片 */
.cl-ui:has(.cl-starter-picker) .cl-tracker { opacity: 0; }
.cl-qnotices { transition: opacity .25s; }
.cl-qnotice { width: 300px; padding: 10px 14px; border-radius: 12px; background: #fffdf7; border: 3px solid #27304a; box-shadow: 0 4px 0 #27304a; color: #27304a;
  transform: translateX(-340px); transition: transform .35s cubic-bezier(.2,.9,.3,1.2), opacity .35s; }
.cl-qnotice.show { transform: none; }
.cl-qnotice.out { opacity: 0; transform: translateX(-40px); }
.cl-qnotice .h { display: flex; align-items: center; gap: 8px; font: 800 12px/16px system-ui; letter-spacing: .12em; color: var(--cat); }
.cl-qnotice .h::before { content: ''; width: 10px; height: 10px; border-radius: 3px; background: var(--cat); transform: rotate(45deg); }
.cl-qnotice .tt { font: 800 17px/24px system-ui; margin-top: 2px; }
.cl-qnotice .ln { font: 500 13px/19px system-ui; color: #4a5372; }
.cl-qnotice.completed { background: linear-gradient(135deg, #fff7d6, #fffdf7 60%); }
`;

export const CATEGORY_COLOR: Record<QuestCategoryView, string> = { main: '#ffb627', side: '#4fb3ff', hidden: '#b48cff' };
export const CATEGORY_NAME: Record<QuestCategoryView, string> = { main: '主线', side: '支线', hidden: '隐藏' };

export class QuestHud {
  readonly compass: HTMLDivElement;
  private strip: HTMLDivElement;
  private goal: HTMLDivElement;
  private goalDist: HTMLDivElement;
  private goalArrow: HTMLDivElement;
  private compassNote: HTMLDivElement;
  private ticks: { el: HTMLElement; deg: number }[] = [];
  readonly tracker: HTMLDivElement;
  private tCat: HTMLDivElement;
  private tTitle: HTMLDivElement;
  private tObj: HTMLDivElement;
  private tObjText: HTMLSpanElement;
  private tProg: HTMLSpanElement;
  private tNote: HTMLDivElement;
  private tKey: HTMLDivElement;
  readonly marker: HTMLDivElement;
  private markerDist: HTMLDivElement;
  private notices: HTMLDivElement;
  private queue: QuestNoticeView[] = [];
  private active: { el: HTMLElement; t: number }[] = [];
  private lastTrackerKey = '';
  private visible = true;
  private readonly tmp = new THREE.Vector3();
  /** 已显示过的通知（e2e / 调试） */
  readonly history: QuestNoticeView[] = [];

  constructor(root: UiRoot) {
    injectUiStyles(CSS);
    this.compass = el('div', 'cl-compass hidden', root.el);
    this.strip = el('div', 'strip', this.compass);
    // 每 15° 一个刻度，每 45° 一个方位字
    for (let d = 0; d < 360; d += 15) {
      const t = el('div', d % 45 === 0 ? 'tick major' : 'tick', this.strip);
      this.ticks.push({ el: t, deg: d });
    }
    for (const [d, name] of CARDINALS) {
      const c = el('div', d === 0 ? 'card n' : d % 90 === 0 ? 'card' : 'card minor', this.strip, name);
      this.ticks.push({ el: c, deg: d });
    }
    el('div', 'center', this.compass);
    this.goal = el('div', 'goal', this.compass);
    el('div', 'ico', this.goal);
    this.goalArrow = el('div', 'arrow', this.goal);
    this.goalDist = el('div', 'dist', this.goal);
    this.compassNote = el('div', 'note', this.compass);

    this.tracker = el('div', 'cl-tracker hidden', root.el);
    this.tCat = el('div', 'cat', this.tracker);
    this.tTitle = el('div', 't', this.tracker);
    this.tObj = el('div', 'o', this.tracker);
    this.tObjText = el('span', '', this.tObj);
    this.tProg = el('span', 'p', this.tObj);
    this.tNote = el('div', 'n', this.tracker);
    this.tKey = el('div', 'k', this.tracker);
    this.tKey.innerHTML = '<kbd>J</kbd> 任务日志';

    this.marker = el('div', 'cl-wmarker', root.el);
    el('div', 'gem', this.marker);
    this.markerDist = el('div', 'd', this.marker);
    this.marker.style.opacity = '0';

    this.notices = el('div', 'cl-qnotices', root.el);
  }

  /** 战斗 / 过场时整体隐藏（通知照常排队） */
  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) {
      this.compass.classList.add('hidden');
      this.tracker.classList.add('hidden');
      this.marker.style.opacity = '0';
    }
  }

  setKeyHint(label: string): void {
    this.tKey.innerHTML = `<kbd>${label}</kbd> 任务日志`;
  }

  // ———————————————— 追踪面板 ————————————————

  setTracker(v: TrackerView | null): void {
    if (!this.visible || !v) {
      this.tracker.classList.add('hidden');
      if (!v) this.lastTrackerKey = '';
      return;
    }
    this.tracker.classList.remove('hidden');
    this.tracker.style.setProperty('--cat', CATEGORY_COLOR[v.category]);
    this.tCat.textContent = CATEGORY_NAME[v.category];
    this.tTitle.textContent = v.title;
    this.tObjText.textContent = v.objective;
    this.tProg.textContent = v.progress ?? '';
    this.tNote.textContent = v.note ?? '';
    this.tNote.style.display = v.note ? '' : 'none';
    // 任务或目标变化时闪一下
    const key = `${v.title}|${v.objective}`;
    if (this.lastTrackerKey && key !== this.lastTrackerKey) {
      this.tracker.classList.remove('flash');
      void this.tracker.offsetWidth;
      this.tracker.classList.add('flash');
    }
    this.lastTrackerKey = key;
  }

  get trackerText(): string {
    return this.tracker.classList.contains('hidden') ? '' : (this.tracker.textContent ?? '');
  }

  // ———————————————— 罗盘 ————————————————

  setCompass(v: CompassView | null): void {
    if (!this.visible || !v) {
      this.compass.classList.add('hidden');
      return;
    }
    this.compass.classList.remove('hidden');
    const half = COMPASS_SPAN / 2;
    const px = (rel: number) => COMPASS_WIDTH / 2 + (rel / half) * (COMPASS_WIDTH / 2);
    for (const t of this.ticks) {
      const rel = wrap(t.deg - v.heading);
      const vis = Math.abs(rel) <= half + 10;
      t.el.style.display = vis ? '' : 'none';
      if (vis) t.el.style.left = `${px(rel)}px`;
    }
    const g = v.target;
    this.goal.style.display = g ? '' : 'none';
    if (g) {
      const edge = Math.abs(g.relative) > half - 6;
      const rel = Math.max(-(half - 6), Math.min(half - 6, g.relative));
      this.goal.style.left = `${px(rel)}px`;
      this.goal.classList.toggle('area', g.area);
      this.goal.classList.toggle('inside', g.inside);
      this.goal.classList.toggle('edge-l', edge && g.relative < 0);
      this.goal.classList.toggle('edge-r', edge && g.relative > 0);
      this.goalArrow.textContent = edge ? (g.relative < 0 ? '◀' : '▶') : '';
      this.goalDist.textContent = g.inside ? (g.area ? '搜索范围内' : '已到达') : g.distance;
    }
    this.compassNote.textContent = v.note ?? '';
    this.compassNote.style.display = v.note ? '' : 'none';
  }

  /** 当前罗盘目标相对角度（e2e） */
  get compassGoal(): { left: number; text: string } | null {
    if (this.compass.classList.contains('hidden') || this.goal.style.display === 'none') return null;
    return { left: parseFloat(this.goal.style.left) - COMPASS_WIDTH / 2, text: this.goalDist.textContent ?? '' };
  }

  // ———————————————— 世界标记 ————————————————

  /**
   * anchor：世界坐标（目标上方）；null 隐藏。近处（< fadeNear）淡出，屏幕外 / 身后隐藏。
   */
  setWorldMarker(anchor: THREE.Vector3 | null, camera: THREE.Camera, w: number, h: number, distance: number, text: string, area: boolean, fadeNear = 6): void {
    if (!this.visible || !anchor) {
      this.marker.style.opacity = '0';
      return;
    }
    const p = this.tmp.copy(anchor).project(camera);
    const behind = p.z > 1 || p.z < -1;
    const x = (p.x * 0.5 + 0.5) * w;
    const y = (-p.y * 0.5 + 0.5) * h;
    const off = behind || x < 20 || x > w - 20 || y < 50 || y > h - 20;
    const fade = Math.min(1, Math.max(0, (distance - fadeNear) / 6));
    this.marker.style.opacity = off ? '0' : String(fade);
    if (off) return;
    this.marker.classList.toggle('area', area);
    this.marker.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    this.markerDist.textContent = text;
  }

  get markerShown(): boolean {
    return this.marker.style.opacity !== '0';
  }

  // ———————————————— 通知 ————————————————

  notify(n: QuestNoticeView): void {
    this.queue.push(n);
  }

  update(dt: number): void {
    // 同时最多 3 张，依次滑入
    if (this.queue.length && this.active.length < 3) {
      const n = this.queue.shift()!;
      this.history.push(n);
      const card = el('div', `cl-qnotice ${n.kind}`, this.notices);
      card.style.setProperty('--cat', CATEGORY_COLOR[n.category]);
      el('div', 'h', card, NOTICE_TITLE[n.kind]);
      el('div', 'tt', card, n.title);
      for (const l of n.lines) el('div', 'ln', card, l);
      requestAnimationFrame(() => card.classList.add('show'));
      this.active.push({ el: card, t: (NOTICE_MS + n.lines.length * 600) / 1000 });
    }
    for (const a of [...this.active]) {
      a.t -= dt;
      if (a.t <= 0 && !a.el.classList.contains('out')) {
        a.el.classList.add('out');
        setTimeout(() => a.el.remove(), 400);
        this.active.splice(this.active.indexOf(a), 1);
      }
    }
  }

  dispose(): void {
    for (const e of [this.compass, this.tracker, this.marker, this.notices]) e.remove();
  }
}

function wrap(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

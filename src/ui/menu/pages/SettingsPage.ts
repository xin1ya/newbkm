/**
 * M1-18 · 设置：←→ 调整、确定切换。修改立即写入 GameState.settings 并通知宿主应用；
 * 画质档位在下次启动时生效（渲染管线按档位创建）。音量在音频系统（M1-20）接入后生效。
 */
import type { Input } from '@/core/input';
import type { Settings } from '@/systems/state/GameState';
import { el } from '../../core/styles';
import { bar, keepVisible, stepIndex } from '../common';
import type { MenuPage, PageContext } from '../types';

type Row =
  | { kind: 'section'; label: string }
  | { kind: 'enum'; id: string; label: string; options: { value: string; label: string }[]; get(s: Settings): string; set(s: Settings, v: string): void; note?: string }
  | { kind: 'range'; id: string; label: string; min: number; max: number; step: number; get(s: Settings): number; set(s: Settings, v: number): void; format(v: number): string; note?: string }
  | { kind: 'bool'; id: string; label: string; get(s: Settings): boolean; set(s: Settings, v: boolean): void; note?: string };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const vol = (key: keyof Settings['volume'], label: string): Row => ({
  kind: 'range',
  id: `volume.${key}`,
  label,
  min: 0,
  max: 1,
  step: 0.1,
  get: (s) => s.volume[key],
  set: (s, v) => (s.volume[key] = v),
  format: pct,
});

export const SETTING_ROWS: Row[] = [
  { kind: 'section', label: '游戏' },
  {
    kind: 'enum',
    id: 'textSpeed',
    label: '文字速度',
    options: [
      { value: 'slow', label: '慢' },
      { value: 'normal', label: '普通' },
      { value: 'fast', label: '快' },
      { value: 'instant', label: '瞬间' },
    ],
    get: (s) => s.textSpeed,
    set: (s, v) => (s.textSpeed = v as Settings['textSpeed']),
  },
  { kind: 'bool', id: 'showNameTags', label: '名字标签', get: (s) => s.showNameTags, set: (s, v) => (s.showNameTags = v) },
  { kind: 'bool', id: 'showFollower', label: '跟随宝可梦', get: (s) => s.showFollower, set: (s, v) => (s.showFollower = v) },
  { kind: 'bool', id: 'showWorldMarkers', label: '任务标记', get: (s) => s.showWorldMarkers, set: (s, v) => (s.showWorldMarkers = v), note: '追踪任务的浮空标记（任务日志 M1-16）' },
  { kind: 'bool', id: 'showMinimap', label: '小地图', get: (s) => s.showMinimap, set: (s, v) => (s.showMinimap = v), note: '左下角小地图；点击打开大地图，右上角 ± 缩放' },
  { kind: 'bool', id: 'minimapRotate', label: '小地图随镜头旋转', get: (s) => s.minimapRotate, set: (s, v) => (s.minimapRotate = v), note: '关闭后北方朝上' },
  {
    kind: 'enum',
    id: 'battleSpeed',
    label: '战斗速度',
    options: [
      { value: '1', label: '1×' },
      { value: '1.5', label: '1.5×' },
      { value: '2', label: '2×' },
    ],
    get: (s) => String(s.battleSpeed),
    set: (s, v) => (s.battleSpeed = Number(v) as Settings['battleSpeed']),
  },
  { kind: 'bool', id: 'battleAnims', label: '战斗动画', get: (s) => s.battleAnims, set: (s, v) => (s.battleAnims = v), note: '关闭后跳过招式演出，只保留受击与血条' },
  { kind: 'section', label: '镜头' },
  {
    kind: 'enum',
    id: 'cameraMode',
    label: '镜头模式',
    options: [
      { value: 'third', label: '第三人称' },
      { value: 'first', label: '第一人称' },
    ],
    get: (s) => s.cameraMode,
    set: (s, v) => (s.cameraMode = v as Settings['cameraMode']),
  },
  {
    kind: 'enum',
    id: 'runMode',
    label: '奔跑方式',
    options: [
      { value: 'toggle', label: '切换' },
      { value: 'hold', label: '按住' },
    ],
    get: (s) => s.runMode,
    set: (s, v) => (s.runMode = v as Settings['runMode']),
    note: '切换：按一下 Shift 开始奔跑，再按一下恢复步行；按住：按住 Shift 奔跑',
  },
  { kind: 'bool', id: 'autoSave', label: '自动存档', get: (s) => s.autoSave, set: (s, v) => (s.autoSave = v), note: '完成任务节点、战斗结束、进出建筑、剧情结束时自动写入当前存档位' },
  { kind: 'bool', id: 'mouseLock', label: '锁定鼠标', get: (s) => s.mouseLock, set: (s, v) => (s.mouseLock = v), note: '第三人称下隐藏鼠标、移动鼠标直接转动镜头；Esc 临时解锁，点击画面恢复' },
  { kind: 'range', id: 'mouseSensitivity', label: '镜头灵敏度', min: 0.3, max: 2, step: 0.1, get: (s) => s.mouseSensitivity, set: (s, v) => (s.mouseSensitivity = v), format: (v) => `${v.toFixed(1)}×` },
  { kind: 'bool', id: 'invertY', label: '上下反转', get: (s) => s.invertY, set: (s, v) => (s.invertY = v) },
  { kind: 'section', label: '画面' },
  {
    kind: 'enum',
    id: 'fpsLimit',
    label: '帧率上限',
    options: [
      { value: '30', label: '30' },
      { value: '60', label: '60' },
      { value: '120', label: '120' },
      { value: '0', label: '不限' },
    ],
    get: (s) => String(s.fpsLimit ?? 120),
    set: (s, v) => (s.fpsLimit = Number(v) as Settings['fpsLimit']),
    note: '限制每秒渲染帧数以降低显卡占用；「不限」跟随显示器刷新率',
  },
  { kind: 'bool', id: 'dynamicResolution', label: '动态分辨率', get: (s) => s.dynamicResolution ?? true, set: (s, v) => (s.dynamicResolution = v), note: '显卡吃紧时自动降低渲染分辨率（最低 70%），负载下降后恢复' },
  {
    kind: 'enum',
    id: 'quality',
    label: '画质',
    options: [
      { value: 'auto', label: '自动' },
      { value: 'low', label: '低' },
      { value: 'medium', label: '中' },
      { value: 'high', label: '高' },
    ],
    get: (s) => s.quality,
    set: (s, v) => (s.quality = v as Settings['quality']),
    note: '存档后重新进入游戏生效',
  },
  { kind: 'section', label: '声音' },
  vol('master', '主音量'),
  vol('bgm', '音乐'),
  vol('sfx', '音效'),
  vol('ambient', '环境音'),
];

export class SettingsPage implements MenuPage {
  readonly id = 'settings';
  readonly title = '设置';
  readonly el: HTMLDivElement;
  private rowsIdx: number[];
  sel = 0;
  private focused = false;

  constructor(private readonly ctx: PageContext) {
    this.el = el('div', 'cl-page cl-settings');
    this.rowsIdx = SETTING_ROWS.map((r, i) => (r.kind === 'section' ? -1 : i)).filter((i) => i >= 0);
  }

  show(): void {
    this.render();
  }

  focus(): void {
    this.focused = true;
    this.render();
  }

  blur(): void {
    this.focused = false;
    this.render();
  }

  hints(): string {
    const k = this.ctx.keyLabel;
    return `<kbd>↑↓</kbd>选择\u3000<kbd>←→</kbd>调整\u3000<kbd>${k('confirm')}</kbd>切换\u3000<kbd>${k('back')}</kbd>返回`;
  }

  handle(input: Input): 'exit' | void {
    const n = this.rowsIdx.length;
    if (input.pressed('uiUp', true)) this.select(stepIndex(this.sel, -1, n));
    else if (input.pressed('uiDown', true)) this.select(stepIndex(this.sel, 1, n));
    else if (input.pressed('uiLeft', true)) this.adjust(-1);
    else if (input.pressed('uiRight', true) || input.pressed('confirm', true)) this.adjust(1);
    else if (input.pressed('back', true)) return 'exit';
  }

  select(i: number): void {
    this.sel = i;
    this.render();
  }

  /** 调整当前行：枚举循环、数值按步长夹取、开关取反 */
  adjust(dir: 1 | -1): void {
    const row = SETTING_ROWS[this.rowsIdx[this.sel]!]!;
    const s = this.ctx.host.state.settings;
    if (row.kind === 'enum') {
      const i = row.options.findIndex((o) => o.value === row.get(s));
      row.set(s, row.options[stepIndex(i, dir, row.options.length)]!.value);
    } else if (row.kind === 'range') {
      const v = Math.round((row.get(s) + dir * row.step) / row.step) * row.step;
      row.set(s, Math.min(row.max, Math.max(row.min, Number(v.toFixed(3)))));
    } else if (row.kind === 'bool') row.set(s, !row.get(s));
    this.ctx.host.applySettings();
    this.render();
  }

  render(): void {
    const s = this.ctx.host.state.settings;
    this.el.classList.toggle('blurred', !this.focused);
    this.el.textContent = '';
    let k = 0;
    let selEl: HTMLElement | undefined;
    SETTING_ROWS.forEach((row) => {
      if (row.kind === 'section') {
        el('div', 'sec', this.el, row.label);
        return;
      }
      const idx = k++;
      const r = el('div', idx === this.sel ? 'row sel interactive' : 'row interactive', this.el);
      r.dataset.setting = row.id;
      if (idx === this.sel) selEl = r;
      el('div', '', r, row.label);
      const v = el('div', 'val', r);
      const left = el('span', 'arrow', v, '◀');
      if (row.kind === 'enum') el('span', 'cur', v, row.options.find((o) => o.value === row.get(s))?.label ?? row.get(s));
      else if (row.kind === 'range') {
        bar(v, (row.get(s) - row.min) / (row.max - row.min), '#3fb88a');
        el('span', 'cur', v, row.format(row.get(s)));
      } else el('span', 'cur', v, row.get(s) ? '开' : '关');
      const right = el('span', 'arrow', v, '▶');
      if (row.note) el('span', 'note', v, row.note);
      left.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sel = idx;
        this.adjust(-1);
      });
      right.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sel = idx;
        this.adjust(1);
      });
      r.addEventListener('click', () => {
        if (this.sel === idx) this.adjust(1);
        else this.select(idx);
      });
    });
    keepVisible(selEl);
  }
}

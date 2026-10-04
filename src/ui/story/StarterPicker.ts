/**
 * M1-13 · 御三家选择界面（v2）：没有卡片——研究所桌子与全息投影在画面左侧（镜头由 StarterTable 切换），
 * 右侧信息面板：图鉴编号、名字、分类、属性、身高体重、简介、种族值条、特性、招牌招式；
 * 底部三颗属性色指示点 + 操作提示。←/→ 或鼠标悬停 / 点击桌上的精灵球选择，确认后「就决定是你了？」二次确认。
 */
import type { Input } from '@/core/input';
import { sfx } from '@/core/audio';
import { TYPE_COLORS } from '@/core/assets';
import type { Dex } from '@/systems/data/Dex';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';
import { ChoiceMenu } from '../core/ChoiceMenu';
import { typeChip } from '../menu/common';

export interface StarterCardInfo {
  species: number;
  blurb: string;
}

/** 3D 拾取：屏幕坐标 → 物种（桌上的精灵球） */
export type StarterPickFn = (clientX: number, clientY: number) => number | null;

const STATS: [key: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', label: string][] = [
  ['hp', 'HP'],
  ['atk', '攻击'],
  ['def', '防御'],
  ['spa', '特攻'],
  ['spd', '特防'],
  ['spe', '速度'],
];

const CSS = `
.cl-sp-panel{position:absolute;right:4.5%;top:50%;transform:translateY(-50%);width:min(380px,36vw);padding:22px 24px 20px;
  border-radius:18px;background:linear-gradient(160deg,rgba(14,28,40,.88),rgba(10,18,28,.82));color:#eef6f8;
  box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 0 0 1px rgba(127,224,200,.25);font-family:system-ui;pointer-events:auto;z-index:30;
  transition:opacity .25s, transform .25s}
.cl-sp-panel.swap{opacity:.0;transform:translate(14px,-50%)}
.cl-sp-panel .accent{position:absolute;left:0;top:18px;bottom:18px;width:4px;border-radius:2px}
.cl-sp-no{font:600 13px/1 ui-monospace,monospace;letter-spacing:.12em;opacity:.65}
.cl-sp-name{font:800 34px/1.1 system-ui;margin:6px 0 2px}
.cl-sp-genus{font-size:13px;opacity:.7}
.cl-sp-row{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
.cl-sp-meta{font-size:12px;opacity:.7;margin-left:auto}
.cl-sp-blurb{font-size:14px;line-height:1.6;margin:12px 0 4px;opacity:.9;white-space:pre-line}
.cl-sp-h{font:700 12px/1 system-ui;letter-spacing:.1em;opacity:.55;margin:14px 0 8px}
.cl-sp-stat{display:grid;grid-template-columns:36px 30px 1fr;gap:8px;align-items:center;font-size:12px;margin:3px 0}
.cl-sp-stat b{font:700 12px ui-monospace,monospace;text-align:right}
.cl-sp-bar{height:7px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}
.cl-sp-bar i{display:block;height:100%;border-radius:4px;transition:width .35s ease}
.cl-sp-ab{font-size:13px}.cl-sp-ab small{display:block;opacity:.6;font-size:12px;margin-top:2px}
.cl-sp-moves{display:flex;gap:6px;flex-wrap:wrap}
.cl-sp-moves span{padding:4px 10px;border-radius:999px;font-size:12px;background:rgba(255,255,255,.1)}
.cl-sp-dock{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;
  pointer-events:auto;z-index:30;font-family:system-ui;color:#eef6f8}
.cl-sp-dots{display:flex;gap:16px}
.cl-sp-dot{width:16px;height:16px;border-radius:50%;cursor:pointer;opacity:.45;transition:transform .2s,opacity .2s,box-shadow .2s}
.cl-sp-dot.on{opacity:1;transform:scale(1.35)}
.cl-sp-hint{font-size:13px;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.45)}
.cl-sp-hint kbd{font:700 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,.18);margin:0 2px}
`;

class PickerWidget implements UiWidget {
  readonly modal = true;
  private panel: HTMLDivElement;
  private dock: HTMLDivElement;
  private dots: HTMLDivElement[] = [];
  private sel = -1;
  private resolve!: (i: number) => void;
  readonly done = new Promise<number>((r) => (this.resolve = r));
  private locked = false;
  private readonly offs: (() => void)[] = [];

  constructor(
    root: UiRoot,
    private readonly dex: Dex,
    private infos: StarterCardInfo[],
    private onSelect?: (species: number) => void,
    pickAt?: StarterPickFn,
  ) {
    injectUiStyles(CSS);
    this.panel = el('div', 'cl-sp-panel interactive', root.el);
    this.dock = el('div', 'cl-sp-dock interactive', root.el);
    const dots = el('div', 'cl-sp-dots', this.dock);
    infos.forEach((info, i) => {
      const sp = dex.species(info.species);
      const c = TYPE_COLORS[sp.types[0] ?? 'normal'] ?? '#7fe0c8';
      const d = el('div', 'cl-sp-dot', dots);
      d.style.background = c;
      d.style.boxShadow = `0 0 0 2px rgba(255,255,255,.7)`;
      d.title = sp.name.zh;
      d.addEventListener('click', () => {
        if (!this.locked) this.select(i);
      });
      this.dots.push(d);
    });
    const hint = el('div', 'cl-sp-hint', this.dock);
    hint.innerHTML = '<kbd>←</kbd><kbd>→</kbd> / 点击精灵球 选择 · <kbd>E</kbd> / 双击 确认';
    // 鼠标：悬停桌上的球即选中，点击已选中的球 = 确认
    if (pickAt) {
      const canvasTarget = (e: MouseEvent): boolean => (e.target as HTMLElement | null)?.tagName === 'CANVAS' || (e.target as HTMLElement | null) === root.el;
      const move = (e: MouseEvent): void => {
        if (this.locked || !canvasTarget(e)) return;
        const id = pickAt(e.clientX, e.clientY);
        const i = id === null ? -1 : this.infos.findIndex((x) => x.species === id);
        document.body.style.cursor = i >= 0 ? 'pointer' : '';
        if (i >= 0 && i !== this.sel) this.select(i);
      };
      const click = (e: MouseEvent): void => {
        if (this.locked || !canvasTarget(e)) return;
        const id = pickAt(e.clientX, e.clientY);
        const i = id === null ? -1 : this.infos.findIndex((x) => x.species === id);
        if (i < 0) return;
        if (i === this.sel) void this.confirm(root);
        else this.select(i);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('click', click);
      this.offs.push(() => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('click', click);
        document.body.style.cursor = '';
      });
    }
    this.names = infos.map((x) => dex.species(x.species).name.zh);
    this.select(0);
  }

  private renderPanel(i: number): void {
    const info = this.infos[i]!;
    const sp = this.dex.species(info.species);
    const color = TYPE_COLORS[sp.types[0] ?? 'normal'] ?? '#7fe0c8';
    const p = this.panel;
    p.textContent = '';
    el('div', 'accent', p).style.background = color;
    el('div', 'cl-sp-no', p, `No.${String(sp.id).padStart(3, '0')}`);
    el('div', 'cl-sp-name', p, sp.name.zh);
    el('div', 'cl-sp-genus', p, sp.genus.zh);
    const row = el('div', 'cl-sp-row', p);
    for (const t of sp.types) typeChip(t, row);
    el('span', 'cl-sp-meta', row, `${sp.heightM.toFixed(1)} m · ${sp.weightKg.toFixed(1)} kg`);
    // 简介：去掉「招式：」行（单独展示）
    const lines = info.blurb.split('\n');
    const moveLine = lines.find((l) => l.startsWith('招式'));
    el('div', 'cl-sp-blurb', p, lines.filter((l) => l !== moveLine).join('\n'));
    el('div', 'cl-sp-h', p, '种族值');
    let total = 0;
    for (const [k, label] of STATS) {
      const v = sp.baseStats[k];
      total += v;
      const r = el('div', 'cl-sp-stat', p);
      el('span', '', r, label);
      el('b', '', r, String(v));
      const bar = el('div', 'cl-sp-bar', r);
      const fill = el('i', '', bar);
      fill.style.background = v >= 80 ? '#7fe0a0' : v >= 55 ? '#e8d36a' : '#f09a6a';
      fill.style.width = '0%';
      requestAnimationFrame(() => (fill.style.width = `${Math.min(100, (v / 130) * 100)}%`));
    }
    const tr = el('div', 'cl-sp-stat', p);
    el('span', '', tr, '合计');
    el('b', '', tr, String(total));
    const ab = sp.abilities.filter((a) => !a.hidden).map((a) => this.dex.ability(a.id)).find(Boolean);
    if (ab) {
      el('div', 'cl-sp-h', p, '特性');
      const a = el('div', 'cl-sp-ab', p, ab.name.zh);
      if (ab.shortEffect) el('small', '', a, ab.shortEffect);
    }
    if (moveLine) {
      el('div', 'cl-sp-h', p, '招牌招式');
      const mv = el('div', 'cl-sp-moves', p);
      for (const m of moveLine.replace(/^招式[:：]\s*/, '').split(/\s*[·、,，]\s*/)) if (m) el('span', '', mv, m);
    }
  }

  private names: string[] = [];

  private select(i: number): void {
    if (i !== this.sel) sfx('cursor', 0.4);
    this.sel = i;
    const sp = this.infos[i]?.species;
    if (sp !== undefined) this.onSelect?.(sp);
    this.dots.forEach((d, k) => d.classList.toggle('on', k === i));
    // 面板淡出 → 换内容 → 淡入
    this.panel.classList.add('swap');
    window.setTimeout(() => {
      if (this.sel !== i) return;
      this.renderPanel(i);
      this.panel.classList.remove('swap');
    }, 120);
  }

  private async confirm(root: UiRoot): Promise<void> {
    const name = this.names[this.sel] ?? '';
    if (this.locked) return;
    this.locked = true;
    const chosen = this.sel; // 锁定确认时的选择
    sfx('confirm', 0.5);
    const m = root.push(
      new ChoiceMenu(
        root,
        [
          { label: `就决定是你了，${name}！`, value: true },
          { label: '再想想', value: false },
        ],
        { style: { right: 'auto', left: '50%', bottom: '120px', transform: 'translateX(-50%)' } },
      ),
    );
    const ok = await m.done;
    this.locked = false;
    if (ok) this.resolve(chosen);
  }

  update(_dt: number, input: Input): boolean {
    if (this.locked) return false;
    if (input.pressed('uiLeft', true)) this.select((this.sel + this.infos.length - 1) % this.infos.length);
    if (input.pressed('uiRight', true)) this.select((this.sel + 1) % this.infos.length);
    if (input.pressed('confirm', true)) void this.confirm(this.root());
    return false;
  }

  /** ChoiceMenu 需要 UiRoot；构造时保存 */
  rootRef: UiRoot | null = null;
  private root(): UiRoot {
    return this.rootRef!;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.panel.remove();
    this.dock.remove();
  }
}

/** 打开御三家选择；返回选中的 speciesId（不可取消：这是剧情必经选择） */
export async function pickStarter(
  root: UiRoot,
  dex: Dex,
  infos: StarterCardInfo[],
  onSelect?: (species: number) => void,
  pickAt?: StarterPickFn,
): Promise<number> {
  const w = new PickerWidget(root, dex, infos, onSelect, pickAt);
  w.rootRef = root;
  root.push(w);
  const i = await w.done;
  root.remove(w);
  return infos[i]!.species;
}

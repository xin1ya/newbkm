/**
 * M1-18 · 菜单通用小部件：宝可梦徽标、属性标签、HP / 经验条、异常状态标签、时间格式。
 */
import { TYPE_COLORS } from '@/core/assets';
import type { Dex } from '@/systems/data/Dex';
import type { PokemonInstance } from '@/systems/pokemon';
import { maxHp } from '@/systems/pokemon';
import { STATUS_NAMES } from '@/systems/battle';
import { TYPE_NAMES_ZH } from '../battle/messages';
import { el, injectUiStyles } from '../core/styles';
import { MENU_CSS } from './styles';
import { itemIconEl } from '../core/itemIcons';
import type { KeyItemDef } from '@/systems/items';
import { pocketOf } from '@/systems/items';

/**
 * 宝可梦头像来源：由 main 注册（离屏渲染手工 3D 模型得到的缩略图）。
 * peek 同步取缓存；request 异步渲染（没有手工模型时返回 null，保留属性色徽标）。
 */
export interface MonIconProvider {
  peek(speciesId: number, shiny: boolean): string | null;
  request(speciesId: number, shiny: boolean): Promise<string | null>;
}

let iconProvider: MonIconProvider | null = null;

export function setMonIconProvider(p: MonIconProvider | null): void {
  iconProvider = p;
}

/** 已有缓存头像时返回 <img> HTML（菜单项图标用），否则 null 并在后台开始渲染 */
export function monIconHtml(speciesId: number, shiny = false): string | null {
  const url = iconProvider?.peek(speciesId, shiny) ?? null;
  if (!url) void iconProvider?.request(speciesId, shiny);
  return url ? `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain">` : null;
}

/** 预先渲染一批头像（打开菜单前调用，减少占位闪烁） */
export function warmMonIcons(list: { speciesId: number; shiny?: boolean }[]): Promise<unknown> {
  return Promise.all(list.map((x) => iconProvider?.request(x.speciesId, !!x.shiny) ?? null));
}

/**
 * 宝可梦头像：手工模型缩略图（属性色淡底圆框）；缩略图未就绪 / 没有模型时为属性色渐变圆 + 名字首字。
 * silhouette：未遇见的图鉴条目——有缩略图时显示纯黑剪影，否则「?」。
 */
export function monIcon(dex: Dex, speciesId: number, parent: HTMLElement, opts: { size?: number; silhouette?: boolean; shiny?: boolean } = {}): HTMLDivElement {
  const sp = dex.species(speciesId);
  const c1 = TYPE_COLORS[sp.types[0] ?? 'normal'] ?? '#aaa';
  const c2 = TYPE_COLORS[sp.types[1] ?? sp.types[0] ?? 'normal'] ?? c1;
  // 徽标 / 属性标签的样式在 MENU_CSS 里：菜单之外（御三家选择、战斗等）第一次使用时也要注入，否则是方块叠字（M1-22 修复）
  injectUiStyles(MENU_CSS);
  const size = opts.size ?? 40;
  const d = el('div', 'cl-mon-icon', parent, opts.silhouette ? '?' : sp.name.zh.slice(0, 1));
  Object.assign(d.style, {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.round(size * 0.45)}px`,
    background: opts.silhouette ? '#3a4260' : `linear-gradient(135deg, ${c1}, ${c2})`,
  });
  const shiny = !!opts.shiny;
  const apply = (url: string): void => {
    d.textContent = '';
    d.classList.add('has-img');
    d.style.background = opts.silhouette ? '#3a4260' : `radial-gradient(circle at 50% 40%, #ffffff 0%, #f3f6fb 55%, ${c1}55 100%)`;
    d.style.borderColor = opts.silhouette ? '#27304a' : c1;
    const img = el('img', '', d);
    img.src = url;
    img.alt = opts.silhouette ? '？？？' : sp.name.zh;
    img.draggable = false;
    img.style.cssText = `width:100%;height:100%;object-fit:contain;${opts.silhouette ? 'filter:brightness(0) opacity(.75);' : ''}`;
    if (shiny && !opts.silhouette) {
      const star = el('span', 'shiny', d, '✦');
      star.style.cssText = `position:absolute;right:-2px;top:-4px;font-size:${Math.max(10, Math.round(size * 0.28))}px;color:#f2b541;text-shadow:0 0 3px #fff;`;
    }
  };
  const url = iconProvider?.peek(speciesId, shiny);
  if (url) apply(url);
  else
    void iconProvider?.request(speciesId, shiny).then((u) => {
      if (u && d.isConnected) apply(u);
      else if (u) requestAnimationFrame(() => d.isConnected && apply(u));
    });
  return d;
}

export function typeChip(type: string, parent: HTMLElement): HTMLSpanElement {
  injectUiStyles(MENU_CSS);
  const s = el('span', 'cl-type', parent, TYPE_NAMES_ZH[type as keyof typeof TYPE_NAMES_ZH] ?? type);
  s.style.background = TYPE_COLORS[type] ?? '#888';
  return s;
}

export function hpColor(ratio: number): string {
  return ratio > 0.5 ? '#3fb88a' : ratio > 0.2 ? '#f6c945' : '#e8484a';
}

export function bar(parent: HTMLElement, ratio: number, color: string, cls = 'cl-bar'): HTMLDivElement {
  const b = el('div', cls, parent);
  const i = el('i', '', b);
  i.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  i.style.background = color;
  return b;
}

export function hpBar(dex: Dex, p: PokemonInstance, parent: HTMLElement): HTMLDivElement {
  const max = maxHp(dex, p);
  const wrap = el('div', 'cl-hp', parent);
  el('span', 'lbl', wrap, 'HP');
  bar(wrap, p.hp / max, hpColor(p.hp / max));
  el('span', 'num', wrap, `${p.hp}/${max}`);
  return wrap;
}

export function statusTag(p: PokemonInstance, parent: HTMLElement): void {
  if (p.hp <= 0) el('span', 'cl-status fnt', parent, '濒死');
  else if (p.status) el('span', `cl-status ${p.status.kind}`, parent, STATUS_NAMES[p.status.kind]);
}

export const genderMark = (p: PokemonInstance): string => (p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '');

export function formatPlayTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** 列表选择项滚动到可见区域 */
export function keepVisible(row: HTMLElement | undefined): void {
  row?.scrollIntoView?.({ block: 'nearest' });
}

/** 上下移动选择（循环） */
export function stepIndex(i: number, delta: number, n: number): number {
  if (n <= 0) return 0;
  return (((i + delta) % n) + n) % n;
}

/** 道具图标（招式学习器按招式属性着色；未登记的按口袋回退） */
export function itemIcon(dex: Dex, keyItems: ReadonlyMap<string, KeyItemDef>, id: string, size = 28): HTMLSpanElement {
  const move = keyItems.get(id)?.move;
  const tmColor = move && dex.hasMove(move) ? TYPE_COLORS[dex.move(move).type] : undefined;
  return itemIconEl(id, size, { tmColor, pocket: pocketOf(dex, id, keyItems) });
}

/**
 * SCN-001 · 战斗菜单：指令 / 招式 / 宝可梦 / 背包 / 学习新招式。均基于 ui/core 的 ChoiceMenu，返回 null 表示取消。
 */
import type { Dex } from '@/systems/data/Dex';
import { itemIconSvg } from '../core/itemIcons';
import { monIconHtml } from '../menu/common';
import type { TypeId } from '@/systems/data/types';
import type { MoveOption } from '@/systems/battle';
import type { PokemonInstance } from '@/systems/pokemon';
import { displayName, maxHp } from '@/systems/pokemon';
import { STATUS_NAMES } from '@/systems/battle';
import { isBall } from '@/systems/capture';
import { choose, el, injectUiStyles, type UiRoot } from '@/ui/core';
import { TYPE_COLORS } from '@/core/assets';
import { TYPE_NAMES_ZH } from './messages';

export type Command = 'fight' | 'bag' | 'party' | 'run';

export function commandMenu(root: UiRoot, o: { canRun: boolean; canSwitch: boolean; canCatch: boolean; initial?: Command }): Promise<Command | null> {
  const items: { label: string; value: Command; disabled?: boolean }[] = [
    { label: '战斗', value: 'fight' },
    { label: '背包', value: 'bag' },
    { label: '宝可梦', value: 'party', disabled: !o.canSwitch },
    { label: '逃跑', value: 'run', disabled: !o.canRun },
  ];
  const initial = Math.max(0, items.findIndex((i) => i.value === o.initial));
  return choose(root, items, { columns: 2, cancellable: false, initial, style: { right: '40px', bottom: '28px', minWidth: '300px' } });
}

const REASON: Record<string, string> = { 'no-pp': 'PP 用尽', choice: '讲究锁定', taunt: '挑衅中', torment: '无理取闹' };

/** 招式对当前对手的效果提示（变化招式不提示） */
export function effectLabel(mult: number): string {
  if (mult === 0) return '✕ 没有效果';
  if (mult >= 2) return '▲ 效果绝佳';
  if (mult < 1) return '▼ 效果不好';
  return '';
}

/** 招式菜单的对战上下文（详情面板用） */
export interface MoveMenuContext {
  /** 对手当前属性（效果提示） */
  foeTypes?: readonly TypeId[];
  /** 对手名字 */
  foeName?: string;
  /** 我方当前属性（本系加成提示） */
  userTypes?: readonly TypeId[];
}

const CAT_ZH = { physical: '物理', special: '特殊', status: '变化' } as const;

const MOVE_CSS = /* css */ `
.cl-movedetail { margin: 2px 4px 8px; padding: 10px 14px 12px; border-radius: 12px; background: #f3f6fb; border: 2px solid #dfe5f0; font-size: 15px; color: #27304a; white-space: normal; }
.cl-movedetail .hd { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; }
.cl-movedetail .tag { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 13px; font-weight: 700; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.35); }
.cl-movedetail .tag.physical { background: #d9603b; } .cl-movedetail .tag.special { background: #4a6fd8; } .cl-movedetail .tag.status { background: #8a8fa3; }
.cl-movedetail .tag.contact { background: #c9a25c; }
.cl-movedetail .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0 6px; }
.cl-movedetail .stats div { background: #fff; border-radius: 8px; padding: 4px 8px; text-align: center; }
.cl-movedetail .stats b { display: block; font-size: 11px; color: #7a8299; font-weight: 600; }
.cl-movedetail .stats span { font-size: 18px; font-weight: 800; }
.cl-movedetail .stats .low { color: #d9603b; }
.cl-movedetail .eff { margin: 2px 0 6px; font-size: 14px; font-weight: 700; }
.cl-movedetail .eff .up { color: #2f9e57; } .cl-movedetail .eff .down { color: #c27a1d; } .cl-movedetail .eff .zero { color: #9aa0b3; } .cl-movedetail .eff .stab { color: #6a4fd1; margin-left: 10px; }
.cl-movedetail .badge { margin-left: auto; font-size: 13px; font-weight: 700; color: #fff; background: #2f9e57; padding: 1px 9px; border-radius: 999px; }
.cl-movedetail.new { border-color: #9fd8b2; background: #eef9f1; }
.cl-forget-hd { display: flex; flex-direction: column; gap: 0; }
.cl-movedetail .desc { line-height: 1.5; color: #48506a; min-height: 2.9em; }
`;

/** 招式说明文本整理（原始数据里有全角断行空格） */
export function cleanEffect(s: string): string {
  return s.replace(/\s*\n\s*/g, '').replace(/([。，！？、])\s+/g, '$1').replace(/\s+/g, ' ').trim();
}

/** 招式详情面板内容（纯数据，便于测试） */
export function moveDetail(dex: Dex, m: MoveOption, ctx: MoveMenuContext = {}) {
  const d = dex.move(m.id);
  const mult = ctx.foeTypes && d.category !== 'status' ? dex.effectiveness(d.type, ctx.foeTypes as TypeId[]) : null;
  return {
    name: d.name.zh,
    type: TYPE_NAMES_ZH[d.type] ?? d.type,
    typeId: d.type,
    category: d.category,
    categoryZh: CAT_ZH[d.category],
    power: d.category === 'status' || d.power <= 0 ? '—' : String(d.power),
    accuracy: d.accuracy === null ? '必中' : `${d.accuracy}`,
    pp: `${m.pp}/${m.maxPp}`,
    ppLow: m.pp <= Math.max(1, Math.floor(m.maxPp / 4)),
    priority: d.priority,
    contact: d.flags.contact,
    stab: d.category !== 'status' && !!ctx.userTypes?.includes(d.type),
    mult,
    effect: cleanEffect(d.shortEffect || ''),
  };
}

/** 把招式详情渲染进面板（战斗招式菜单与学习新招式共用） */
export function renderMoveDetail(panel: HTMLElement, x: ReturnType<typeof moveDetail>, ctx: MoveMenuContext = {}, badge?: string): void {
  panel.replaceChildren();
  const hd = el('div', 'hd', panel);
  const tt = el('span', 'tag', hd, x.type);
  tt.style.background = TYPE_COLORS[x.typeId] ?? '#888';
  el('span', `tag ${x.category}`, hd, x.categoryZh);
  if (x.contact) el('span', 'tag contact', hd, '接触');
  el('span', '', hd, x.name);
  if (badge) el('span', 'badge', hd, badge);
  const st = el('div', 'stats', panel);
  const cell = (k: string, v: string, cls = ''): void => {
    const c = el('div', '', st);
    el('b', '', c, k);
    el('span', cls, c, v);
  };
  cell('威力', x.power);
  cell('命中', x.accuracy);
  cell('PP', x.pp, x.ppLow ? 'low' : '');
  cell('优先度', x.priority > 0 ? `+${x.priority}` : String(x.priority));
  if (x.mult !== null || x.stab) {
    const ef = el('div', 'eff', panel);
    if (x.mult !== null) {
      const who = ctx.foeName ? `对${ctx.foeName}：` : '';
      if (x.mult === 0) el('span', 'zero', ef, `${who}没有效果 ×0`);
      else if (x.mult > 1) el('span', 'up', ef, `${who}效果绝佳 ×${x.mult}`);
      else if (x.mult < 1) el('span', 'down', ef, `${who}效果不好 ×${x.mult}`);
      else el('span', '', ef, `${who}普通效果 ×1`);
    }
    if (x.stab) el('span', 'stab', ef, '本系加成 ×1.5');
  }
  el('div', 'desc', panel, x.effect || '没有说明。');
}

export function moveMenu(root: UiRoot, dex: Dex, moves: MoveOption[], initial = 0, ctx: MoveMenuContext = {}): Promise<number | null> {
  injectUiStyles(MOVE_CSS);
  const items = moves.map((m) => {
    const d = dex.move(m.id);
    const eff = ctx.foeTypes && d.category !== 'status' ? effectLabel(dex.effectiveness(d.type, ctx.foeTypes as TypeId[])) : '';
    return {
      label: d.name.zh,
      value: m.index,
      disabled: m.disabled,
      sub: m.disabled && m.reason ? (REASON[m.reason] ?? '不可用') : `${TYPE_NAMES_ZH[d.type] ?? d.type}·${CAT_ZH[d.category]}  PP ${m.pp}/${m.maxPp}${eff ? `  ${eff}` : ''}`,
    };
  });
  const panel = el('div', 'cl-movedetail');
  const show = (i: number): void => {
    const m = moves[i];
    if (m) renderMoveDetail(panel, moveDetail(dex, m, ctx), ctx);
  };
  const start = moves[initial] && !moves[initial]!.disabled ? initial : Math.max(0, moves.findIndex((m) => !m.disabled));
  show(start);
  return choose(root, items, {
    columns: 2,
    cancellable: true,
    initial: start,
    header: panel,
    onSelect: show,
    style: { left: '50%', right: 'auto', bottom: '28px', transform: 'translateX(-50%)', width: '620px' },
  });
}

export function partyMenu(root: UiRoot, dex: Dex, party: PokemonInstance[], activeIndex: number, forced: boolean): Promise<number | null> {
  const items = party.map((p, i) => ({
    label: `${displayName(dex, p)}  Lv.${p.level}`,
    icon: monIconHtml(p.speciesId, p.shiny) ?? undefined,
    value: i,
    disabled: p.hp <= 0 || i === activeIndex,
    sub: `HP ${p.hp}/${maxHp(dex, p)}${p.status ? ` · ${STATUS_NAMES[p.status.kind]}` : ''}${i === activeIndex ? ' · 战斗中' : ''}`,
  }));
  return choose(root, items, { cancellable: !forced, style: { left: '50%', right: 'auto', top: '14%', bottom: 'auto', transform: 'translateX(-50%)', minWidth: '420px' } });
}

/** 背包：只列出战斗中可用的回复道具与精灵球 */
export const BATTLE_MEDICINE = ['potion', 'super-potion', 'hyper-potion', 'full-restore', 'antidote', 'paralyze-heal', 'awakening', 'burn-heal', 'ice-heal', 'full-heal', 'revive'];

export function bagMenu(root: UiRoot, dex: Dex, bag: Record<string, number>, canCatch: boolean): Promise<string | null> {
  const ids = Object.keys(bag).filter((id) => (bag[id] ?? 0) > 0 && (isBall(id) || BATTLE_MEDICINE.includes(id)));
  ids.sort((a, b) => Number(isBall(b)) - Number(isBall(a)) || a.localeCompare(b));
  if (!ids.length) return choose(root, [{ label: '（没有可以使用的道具）', value: null as string | null, disabled: true }], { cancellable: true });
  const items = ids.map((id) => ({
    label: dex.item(id)?.name.zh ?? id,
    icon: itemIconSvg(id, { pocket: isBall(id) ? 'balls' : 'medicine' }),
    value: id as string | null,
    sub: `×${bag[id]}${isBall(id) && !canCatch ? ' · 无法使用' : ''}`,
    disabled: isBall(id) && !canCatch,
  }));
  return choose(root, items, { cancellable: true, style: { right: '40px', bottom: '28px', minWidth: '300px' } });
}

/** 学习新招式：选择要忘记的招式（返回下标），null = 放弃学习。
 * 顶部固定显示新招式详情，下方显示光标所在旧招式的详情，便于逐项对比。 */
export function forgetMenu(root: UiRoot, dex: Dex, p: PokemonInstance, newMove: string): Promise<number | null> {
  injectUiStyles(MOVE_CSS);
  const ctx: MoveMenuContext = { userTypes: dex.species(p.speciesId).types as TypeId[] };
  const nd = dex.move(newMove);
  const items: { label: string; value: number | null; sub?: string }[] = p.moves.map((m, i) => {
    const d = dex.move(m.id);
    return { label: `忘记「${d.name.zh}」`, value: i, sub: `${TYPE_NAMES_ZH[d.type] ?? d.type}·${CAT_ZH[d.category]}  威力 ${d.category === 'status' || d.power <= 0 ? '—' : d.power}  PP ${m.pp}/${m.maxPp}` };
  });
  items.push({ label: `放弃学习「${nd.name.zh}」`, value: null, sub: '保留现有 4 个招式' });
  const hdr = el('div', 'cl-forget-hd');
  const fresh = el('div', 'cl-movedetail new', hdr);
  renderMoveDetail(fresh, moveDetail(dex, { index: -1, id: newMove, pp: nd.pp, maxPp: nd.pp, disabled: false }, ctx), ctx, '新招式');
  const cur = el('div', 'cl-movedetail', hdr);
  const show = (i: number): void => {
    const m = p.moves[i];
    if (!m) {
      cur.style.display = 'none';
      return;
    }
    cur.style.display = '';
    renderMoveDetail(cur, moveDetail(dex, { index: i, id: m.id, pp: m.pp, maxPp: m.maxPp, disabled: false }, ctx), ctx, '将被忘记');
    cur.querySelector<HTMLElement>('.badge')!.style.background = '#c2563b';
  };
  show(0);
  return choose(root, items, {
    cancellable: false,
    header: hdr,
    onSelect: show,
    style: { left: '50%', right: 'auto', top: '6%', bottom: 'auto', transform: 'translateX(-50%)', width: '620px' },
  });
}

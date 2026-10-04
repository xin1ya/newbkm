/**
 * M1-18 · 菜单中的多步流程：选择宝可梦、学习招式（招式已满时忘记旧招式）、道具进化。
 */
import type { Dex } from '@/systems/data/Dex';
import { monIconHtml } from './common';
import { displayName, maxHp, type PokemonInstance } from '@/systems/pokemon';
import { STATUS_NAMES } from '@/systems/battle';
import { evolve, teachMove } from '@/systems/progression';
import { markCaught, type GameState } from '@/systems/state';
import { choose, say, type UiRoot } from '../core';
import { forgetMenu } from '../battle/menus';

const PICK_STYLE = { left: '50%', right: 'auto', top: '16%', bottom: 'auto', transform: 'translateX(-50%)', minWidth: '440px' } as const;

/** 选择一只队伍中的宝可梦；disabled 返回不可选原因 */
export function pickPokemon(ui: UiRoot, dex: Dex, party: PokemonInstance[], disabled?: (p: PokemonInstance) => string | null): Promise<number | null> {
  const items = party.map((p, i) => {
    const why = disabled?.(p) ?? null;
    return {
      label: `${displayName(dex, p)}  Lv.${p.level}`,
      icon: monIconHtml(p.speciesId, p.shiny) ?? undefined,
      value: i,
      disabled: why !== null,
      sub: `HP ${p.hp}/${maxHp(dex, p)}${p.hp <= 0 ? ' · 濒死' : p.status ? ` · ${STATUS_NAMES[p.status.kind]}` : ''}${why ? ` · ${why}` : ''}`,
    };
  });
  return choose(ui, items, { cancellable: true, style: { ...PICK_STYLE } });
}

/** 学习招式；返回是否学会 */
export async function learnMoveFlow(ui: UiRoot, dex: Dex, p: PokemonInstance, move: string): Promise<boolean> {
  const name = displayName(dex, p);
  const mv = dex.move(move).name.zh;
  if (teachMove(dex, p, move)) {
    await say(ui, `${name}学会了「${mv}」！`);
    return true;
  }
  await say(ui, [`${name}想要学习新招式「${mv}」。`, `但是${name}已经学会了 4 个招式……`]);
  const yes = await choose(ui, [
    { label: '忘记一个招式', value: true },
    { label: `放弃学习「${mv}」`, value: false },
  ], { cancellable: false, style: { ...PICK_STYLE } });
  if (yes) {
    const idx = await forgetMenu(ui, dex, p, move);
    if (idx !== null) {
      const old = dex.move(p.moves[idx]!.id).name.zh;
      teachMove(dex, p, move, idx);
      await say(ui, ['1、2……噗！', `${name}忘记了「${old}」，学会了「${mv}」！`]);
      return true;
    }
  }
  await say(ui, `${name}没有学会「${mv}」。`);
  return false;
}

/** 进化演出（菜单内：对话形式）+ 图鉴登记 + 进化招式 */
export async function evolveFlow(ui: UiRoot, dex: Dex, state: GameState, p: PokemonInstance, to: number): Promise<void> {
  const before = displayName(dex, p);
  await say(ui, [`咦？${before}的样子……`]);
  const r = evolve(dex, p, to);
  markCaught(state, to);
  await say(ui, `恭喜！${before}进化成了${dex.species(to).name.zh}！`);
  for (const m of r.learned) await say(ui, `${displayName(dex, p)}学会了「${dex.move(m).name.zh}」！`);
  for (const m of r.pending) await learnMoveFlow(ui, dex, p, m);
}

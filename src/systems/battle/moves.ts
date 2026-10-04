/**
 * 招式特殊规则表：PokeAPI 的 meta 覆盖不到的部分（蓄力、锁定、可变威力、解冻等）。
 */
import type { MoveData } from '../data/types';

/** 两回合招式；值为是否处于半无敌状态 */
export const TWO_TURN_MOVES: Record<string, boolean> = {
  bounce: true,
  fly: true,
  dig: true,
  dive: true,
  'phantom-force': true,
  'shadow-force': true,
  'solar-beam': false,
  'skull-bash': false,
  'sky-attack': false,
  'razor-wind': false,
};

/** 可以命中空中目标的招式 */
export const HITS_AIRBORNE = new Set(['thunder', 'hurricane', 'gust', 'twister', 'sky-uppercut', 'smack-down']);

/** 使用后下回合无法行动 */
export const RECHARGE_MOVES = new Set(['hyper-beam', 'giga-impact', 'blast-burn', 'hydro-cannon', 'frenzy-plant', 'rock-wrecker']);

/** 连续 2–3 回合、结束后混乱 */
export const RAMPAGE_MOVES = new Set(['thrash', 'petal-dance', 'outrage']);

/** 连续 5 回合、威力翻倍 */
export const ROLLOUT_MOVES = new Set(['rollout', 'ice-ball']);

/** 使用时可解除自身冰冻 */
export const DEFROST_MOVES = new Set(['flame-wheel', 'sacred-fire', 'flare-blitz', 'scald', 'fusion-flare', 'steam-eruption', 'burn-up', 'pyro-ball']);

/** 粉末类（草属性免疫） */
export const POWDER_MOVES = new Set(['poison-powder', 'sleep-powder', 'stun-spore', 'spore', 'rage-powder', 'powder', 'cotton-spore']);

/** 自爆类（湿气阻止） */
export const EXPLOSION_MOVES = new Set(['self-destruct', 'explosion', 'misty-explosion']);

/** 束缚类（4–5 回合，每回合 1/8） */
export const BINDING_MOVES = new Set(['wrap', 'bind', 'whirlpool', 'fire-spin', 'clamp', 'sand-tomb', 'infestation']);

/** 使用后换下（U 型回转等） */
export const PIVOT_MOVES = new Set(['u-turn', 'volt-switch', 'flip-turn']);

/** 守住类 */
export const PROTECT_MOVES = new Set(['protect', 'detect']);

/** 一击必杀 */
export const OHKO_MOVES = new Set(['guillotine', 'fissure', 'horn-drill', 'sheer-cold']);

/** 声音类招式：穿透替身 */
export const SOUND_MOVES = new Set([
  'growl', 'roar', 'sing', 'supersonic', 'screech', 'snore', 'uproar', 'hyper-voice', 'bug-buzz', 'echoed-voice', 'round',
  'disarming-voice', 'alluring-voice', 'psychic-noise', 'boomburst', 'perish-song', 'noble-roar', 'parting-shot', 'confide',
  'chatter', 'relic-song', 'sparkling-aria', 'clanging-scales', 'overdrive', 'torch-song', 'metal-sound', 'grass-whistle', 'heal-bell',
]);

/** 睡眠中也能使出的招式 */
export const SLEEP_USABLE = new Set(['sleep-talk', 'snore']);

/** 挥指 / 仿效 / 梦话不会选中的招式 */
export const CALL_MOVE_BAN = new Set([
  'metronome', 'copycat', 'sleep-talk', 'mirror-move', 'struggle', 'protect', 'detect', 'focus-punch', 'counter', 'mirror-coat',
  'trick', 'after-you', 'ally-switch', 'quick-guard', 'wide-guard', 'rage-powder', 'dragon-cheer', 'future-sight', 'recharge',
]);

/** 以自身为目标的 target 值 */
const SELF_TARGETS = new Set(['user', 'users-field', 'user-and-allies', 'user-or-ally', 'ally', 'entire-field', 'all-allies']);

export function isSelfTargeting(move: MoveData): boolean {
  return SELF_TARGETS.has(move.target);
}

export function isDamaging(move: MoveData): boolean {
  return move.category !== 'status';
}

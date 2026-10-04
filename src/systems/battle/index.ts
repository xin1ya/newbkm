/**
 * systems/battle 公共入口。
 */
export { Battle } from './engine';
export type { BattleSetup, BattleRequest, MoveOption, PendingLearn } from './engine';
export * from './types';
export { calcDamage, critStage, CRIT_CHANCES, CRIT_MULTIPLIER } from './damage';
export { chooseAction, chooseReplacement, scoreMoves } from './ai';
export { ABILITIES, IMPLEMENTED_ABILITIES, getAbility } from './abilities';
export { ITEMS, IMPLEMENTED_ITEMS } from './items';
export * from './status';
export * from './status/weather';

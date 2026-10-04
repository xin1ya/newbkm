import type { MoveData, StatId, TypeId } from '../data/types';
import type { MajorStatus, PokemonInstance } from '../pokemon/Pokemon';

export type SideId = 0 | 1;
export type Weather = 'none' | 'rain' | 'sun' | 'sand' | 'hail';
export type Terrain = 'none' | 'electric' | 'grassy';
export type BattleKind = 'wild' | 'trainer';
export type AiLevel = 'random' | 'basic' | 'smart';

export type Stages = Record<StatId, number>;

export const emptyStages = (): Stages => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 });

/** 换下后清除的临时状态 */
export interface Volatiles {
  confusion: number; // 剩余回合，0 = 无
  flinch: boolean;
  attract: boolean;
  protect: boolean;
  protectStreak: number;
  focusEnergy: boolean;
  choiceLock: string | null;
  taunt: number;
  torment: boolean;
  lastMove: string | null;
  recharge: boolean;
  /** 蓄力 / 半无敌招式（弹跳、暗影潜袭）第一回合 */
  charging: string | null;
  semiInvulnerable: boolean;
  /** 连续招式锁定（大闹一番、花瓣舞、滚动） */
  locked: { move: string; turns: number; hits: number } | null;
  bound: { turns: number; move: string } | null;
  flashFire: boolean;
  stockpile: number;
  typeOverride: TypeId[] | null;
  damagedThisTurn: boolean;
  /** 本回合是否已行动（分析特性用） */
  movedThisTurn: boolean;
  /** 本回合选择的行动（突袭判定用） */
  plannedMove: string | null;
  /** 替身剩余 HP（0 = 无） */
  substitute: number;
  /** 再来一次：锁定招式与剩余回合 */
  encore: { move: string; turns: number } | null;
  /** 磨砺：剩余回合内下一次攻击必定会心 */
  laserFocus: number;
  /** 无法替换 / 逃走（挡路） */
  trapped: boolean;
  /** 能力值覆盖（力量平分） */
  statOverride: Partial<Record<'atk' | 'def' | 'spa' | 'spd', number>> | null;
}

export const emptyVolatiles = (): Volatiles => ({
  confusion: 0,
  flinch: false,
  attract: false,
  protect: false,
  protectStreak: 0,
  focusEnergy: false,
  choiceLock: null,
  taunt: 0,
  torment: false,
  lastMove: null,
  recharge: false,
  charging: null,
  semiInvulnerable: false,
  locked: null,
  bound: null,
  flashFire: false,
  stockpile: 0,
  typeOverride: null,
  damagedThisTurn: false,
  movedThisTurn: false,
  plannedMove: null,
  substitute: 0,
  encore: null,
  laserFocus: 0,
  trapped: false,
  statOverride: null,
});

export interface BattleMon {
  pokemon: PokemonInstance;
  side: SideId;
  index: number;
  stages: Stages;
  v: Volatiles;
  /** 剧毒计数（换下后重置） */
  toxicCounter: number;
  turnsActive: number;
  /** 与之交过手的对方宝可梦 uid（分经验用） */
  faced: Set<string>;
  /** 携带物已消耗 */
  itemUsed: boolean;
}

export interface SideConditions {
  reflect: number;
  lightScreen: number;
  mist: number;
  safeguard: number;
  tailwind: number;
}

export const emptySideConditions = (): SideConditions => ({ reflect: 0, lightScreen: 0, mist: 0, safeguard: 0, tailwind: 0 });

export interface TrainerInfo {
  id: string;
  name: string;
  /** 称号，如「馆主」 */
  title?: string;
  ai: AiLevel;
  /** 胜利奖金 */
  prizeMoney?: number;
  /** 可使用的回复道具 */
  items?: { id: string; qty: number }[];
}

export interface Side {
  id: SideId;
  kind: 'player' | 'wild' | 'trainer';
  trainer?: TrainerInfo;
  party: BattleMon[];
  active: number;
  conditions: SideConditions;
}

export type BattleAction =
  | { type: 'move'; moveIndex: number }
  | { type: 'switch'; partyIndex: number }
  | { type: 'item'; itemId: string; partyIndex: number }
  | { type: 'ball'; itemId: string }
  | { type: 'run' };

export type HitEffectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4;

export type BattleEvent =
  | { type: 'start'; kind: BattleKind; weather: Weather }
  | { type: 'switch-in'; side: SideId; index: number; uid: string; name: string; hp: number; maxHp: number; level: number }
  | { type: 'switch-out'; side: SideId; index: number; name: string }
  | { type: 'move'; side: SideId; name: string; move: string; moveName: string; moveType: TypeId }
  | { type: 'charge'; side: SideId; name: string; move: string }
  | { type: 'damage'; side: SideId; name: string; amount: number; hp: number; maxHp: number; source: DamageSource; effectiveness?: number; crit?: boolean; hitIndex?: number }
  | { type: 'heal'; side: SideId; name: string; amount: number; hp: number; maxHp: number; source: string }
  | { type: 'miss'; side: SideId; name: string; target: string }
  | { type: 'immune'; side: SideId; name: string; reason: 'type' | 'ability' }
  | { type: 'fail'; side: SideId; name: string; reason: string }
  | { type: 'protected'; side: SideId; name: string }
  | { type: 'hits'; count: number }
  | { type: 'status'; side: SideId; name: string; status: MajorStatus }
  | { type: 'status-already'; side: SideId; name: string; status: MajorStatus }
  | { type: 'cure'; side: SideId; name: string; status: MajorStatus | 'confusion' | 'attract' }
  | { type: 'volatile'; side: SideId; name: string; volatile: 'confusion' | 'attract' | 'flinch' | 'focus-energy' | 'taunt' | 'torment' | 'bound' | 'protect' | 'stockpile' | 'type-change' | 'recharge' }
  | { type: 'cant-move'; side: SideId; name: string; reason: 'par' | 'slp' | 'frz' | 'flinch' | 'attract' | 'recharge' | 'taunt' | 'truant' }
  | { type: 'wake'; side: SideId; name: string }
  | { type: 'thaw'; side: SideId; name: string }
  | { type: 'confusion-self-hit'; side: SideId; name: string }
  | { type: 'stage'; side: SideId; name: string; stat: StatId; delta: number; now: number; blocked?: 'max' | 'min' | 'ability' | 'mist' }
  | { type: 'weather'; weather: Weather; source: 'move' | 'ability' | 'field'; by?: string }
  | { type: 'weather-continue'; weather: Weather }
  | { type: 'weather-end'; weather: Weather }
  | { type: 'side-condition'; side: SideId; condition: keyof SideConditions; started: boolean }
  | { type: 'ability'; side: SideId; name: string; ability: string; abilityName: string }
  | { type: 'item'; side: SideId; name: string; item: string; itemName: string; consumed: boolean }
  | { type: 'faint'; side: SideId; name: string; uid: string }
  | { type: 'exp'; uid: string; name: string; amount: number }
  | { type: 'level-up'; uid: string; name: string; level: number }
  | { type: 'learn-move'; uid: string; name: string; move: string; moveName: string }
  | { type: 'learn-move-pending'; uid: string; name: string; move: string; moveName: string }
  | { type: 'run'; success: boolean }
  | { type: 'ball-throw'; ball: string; target: string }
  | { type: 'capture'; success: boolean; shakes: number; name: string }
  | { type: 'item-use'; item: string; itemName: string; target: string }
  | { type: 'trainer-switch'; side: SideId; trainer: string }
  | { type: 'message'; text: string }
  | { type: 'request-switch'; side: SideId }
  | { type: 'end'; winner: SideId | null; reason: BattleEndReason }
  | { type: 'turn'; turn: number };

export type DamageSource =
  | 'move'
  | 'confusion'
  | 'recoil'
  | 'struggle'
  | 'brn'
  | 'psn'
  | 'tox'
  | 'weather'
  | 'bind'
  | 'life-orb'
  | 'belly-drum'
  | 'ability'
  | 'crash'
  | 'substitute'
  | 'pain-split'
  | 'memento';

export type BattleEndReason = 'faint' | 'run' | 'capture' | 'forced';

export interface BattleOutcome {
  winner: SideId | null;
  reason: BattleEndReason;
  capturedUid?: string;
}

export interface MoveContext {
  move: MoveData;
  user: BattleMon;
  target: BattleMon;
  basePower: number;
  type: TypeId;
  crit: boolean;
  effectiveness: number;
  /** 力量（强行）特性触发：移除追加效果 */
  sheerForce: boolean;
}

/**
 * 特性 / 携带物钩子可调用的引擎能力（避免与 engine.ts 循环依赖）。
 */
import type { Dex } from '../data/Dex';
import type { StatId, TypeId, MoveData } from '../data/types';
import type { MajorStatus } from '../pokemon/Pokemon';
import type { Rng } from '../rng';
import type { BattleEvent, BattleMon, DamageSource, Weather, Terrain } from './types';

export interface BattleApi {
  readonly dex: Dex;
  readonly rng: Rng;
  readonly weather: Weather;
  /** 场地（电气 / 青草） */
  readonly terrain: Terrain;
  emit(e: BattleEvent): void;
  name(mon: BattleMon): string;
  maxHp(mon: BattleMon): number;
  types(mon: BattleMon): TypeId[];
  foeOf(mon: BattleMon): BattleMon;
  isActive(mon: BattleMon): boolean;
  /** 返回实际伤害 */
  damage(mon: BattleMon, amount: number, source: DamageSource): number;
  heal(mon: BattleMon, amount: number, source: string): number;
  /** 能力阶变化；byFoe=true 时受恒净之躯等保护。返回实际变化量 */
  boost(mon: BattleMon, stat: StatId, delta: number, byFoe: boolean): number;
  trySetStatus(mon: BattleMon, status: MajorStatus, source: BattleMon | null, silentFail?: boolean): boolean;
  tryConfuse(mon: BattleMon, source: BattleMon | null): boolean;
  cureStatus(mon: BattleMon): void;
  setWeather(w: Weather, source: 'move' | 'ability', by: BattleMon): boolean;
  showAbility(mon: BattleMon): void;
  showItem(mon: BattleMon, consumed: boolean): void;
}

export interface HitInfo {
  move: MoveData;
  type: TypeId;
  damage: number;
  crit: boolean;
  effectiveness: number;
}

/**
 * SYS-010 · 核心特性。
 * 07-21 §4.1 要求约 15 个核心特性；这里实现了萌芽群岛物种会出现的全部特性以及常见对战特性（共 50+），
 * 其余特性按 no-op 处理（`getAbility` 返回空钩子）。新增特性只需在 ABILITIES 中登记。
 */
import type { MoveData, StatId, TypeId } from '../../data/types';
import type { MajorStatus } from '../../pokemon/Pokemon';
import type { BattleApi, HitInfo } from '../api';
import type { BattleMon } from '../types';

export interface AbilityHooks {
  /** 出场时 */
  onSwitchIn?(b: BattleApi, mon: BattleMon): void;
  /** 离场时（自然回复） */
  onSwitchOut?(b: BattleApi, mon: BattleMon): void;
  /** 攻击方能力值倍率（攻击 / 特攻） */
  modifyAttack?(b: BattleApi, mon: BattleMon, move: MoveData, stat: 'atk' | 'spa'): number;
  /** 防御方能力值倍率 */
  modifyDefense?(b: BattleApi, mon: BattleMon, move: MoveData, stat: 'def' | 'spd'): number;
  modifySpeed?(b: BattleApi, mon: BattleMon): number;
  /** 招式威力倍率 */
  modifyBasePower?(b: BattleApi, user: BattleMon, target: BattleMon, move: MoveData, type: TypeId): number;
  /** 最终伤害倍率（攻击方） */
  modifyDamageDealt?(b: BattleApi, user: BattleMon, target: BattleMon, hit: HitInfo): number;
  /** 最终伤害倍率（防御方） */
  modifyDamageTaken?(b: BattleApi, target: BattleMon, user: BattleMon, hit: HitInfo): number;
  /** 命中率倍率 */
  modifyAccuracy?(b: BattleApi, user: BattleMon, move: MoveData): number;
  /** 被招式命中前：返回 false 表示吸收 / 免疫（需自行发事件） */
  onTryHit?(b: BattleApi, target: BattleMon, user: BattleMon, move: MoveData, type: TypeId): boolean;
  /** 被伤害招式命中后 */
  onDamagingHit?(b: BattleApi, target: BattleMon, user: BattleMon, hit: HitInfo): void;
  /** 使用者击倒对手后 */
  onFoeFainted?(b: BattleApi, user: BattleMon): void;
  /** 回合结束 */
  onResidual?(b: BattleApi, mon: BattleMon): void;
  /** 能否陷入该异常 */
  blocksStatus?(b: BattleApi, mon: BattleMon, status: MajorStatus): boolean;
  blocksConfusion?: boolean;
  blocksAttract?: boolean;
  blocksFlinch?: boolean;
  /** 对手造成的能力下降是否被阻止 */
  blocksStatDrop?(stat: StatId): boolean;
  /** 不会被击中要害 */
  critImmune?: boolean;
  /** 满 HP 时不会被一击打倒 */
  sturdy?: boolean;
  /** 招式追加效果无效（鳞粉：作为防御方） */
  ignoresSecondary?: boolean;
  /** 力量（强行）：移除追加效果，威力 ×1.3 */
  sheerForce?: boolean;
  /** 远隔：不接触 */
  noContact?: boolean;
  /** 连续招式 / 吸取的特殊处理 */
  liquidOoze?: boolean;
  /** 天气免伤 */
  weatherImmune?: (w: string) => boolean;
  /** 能从战斗中确定逃跑 */
  runAway?: boolean;
  /** 阻止自爆类招式 */
  damp?: boolean;
  /** 命中率计算时忽略对手闪避提升 */
  ignoreEvasion?: boolean;
  /** 招式的会心等级 +1 */
  critBoost?: number;
}

const pinch = (type: TypeId) => (b: BattleApi, user: BattleMon, _t: BattleMon, _m: MoveData, moveType: TypeId) =>
  moveType === type && user.pokemon.hp <= b.maxHp(user) / 3 ? 1.5 : 1;

const absorb = (type: TypeId, effect: 'heal' | 'spa' | 'spe' | 'atk' | 'flash-fire') => {
  return (b: BattleApi, target: BattleMon, _u: BattleMon, move: MoveData, moveType: TypeId): boolean => {
    if (moveType !== type || move.target === 'user') return true;
    b.showAbility(target);
    if (effect === 'heal') {
      if (b.heal(target, Math.floor(b.maxHp(target) / 4), 'ability') === 0) {
        b.emit({ type: 'immune', side: target.side, name: b.name(target), reason: 'ability' });
      }
    } else if (effect === 'flash-fire') {
      target.v.flashFire = true;
    } else {
      b.boost(target, effect, 1, false);
    }
    return false;
  };
};

const contactStatus = (status: MajorStatus, chance: number) => (b: BattleApi, target: BattleMon, user: BattleMon, hit: HitInfo) => {
  if (!makesContact(b, user, hit.move)) return;
  if (user.pokemon.hp <= 0 || !b.rng.chance(chance)) return;
  if (user.pokemon.status) return;
  b.showAbility(target);
  b.trySetStatus(user, status, target, true);
};

export function makesContact(_b: BattleApi, user: BattleMon, move: MoveData): boolean {
  if (!move.flags.contact) return false;
  return !getAbility(user.pokemon.ability).noContact && user.pokemon.heldItem !== 'protective-pads';
}

const weatherSetter = (w: 'rain' | 'sun' | 'sand' | 'hail') => (b: BattleApi, mon: BattleMon): void => {
  b.showAbility(mon);
  b.setWeather(w, 'ability', mon);
};

const speedInWeather = (w: string) => (b: BattleApi): number => (b.weather === w ? 2 : 1);

export const ABILITIES: Record<string, AbilityHooks> = {
  // —— 出场 ——
  intimidate: {
    onSwitchIn(b, mon) {
      const foe = b.foeOf(mon);
      if (!b.isActive(foe) || foe.pokemon.hp <= 0) return;
      b.showAbility(mon);
      b.boost(foe, 'atk', -1, true);
    },
  },
  drizzle: { onSwitchIn: weatherSetter('rain') },
  drought: { onSwitchIn: weatherSetter('sun') },
  'sand-stream': { onSwitchIn: weatherSetter('sand') },
  'snow-warning': { onSwitchIn: weatherSetter('hail') },
  'natural-cure': {
    onSwitchOut(_b, mon) {
      mon.pokemon.status = null;
    },
  },
  regenerator: {
    onSwitchOut(b, mon) {
      if (mon.pokemon.hp > 0) mon.pokemon.hp = Math.min(b.maxHp(mon), mon.pokemon.hp + Math.floor(b.maxHp(mon) / 3));
    },
  },
  'water-compaction': {
    onDamagingHit(b, target, _u, hit) {
      if (hit.type !== 'water' || target.pokemon.hp <= 0) return;
      b.showAbility(target);
      b.boost(target, 'def', 2, false);
    },
  },
  'rock-head': {}, // 在反伤结算中特判（engine）
  'weak-armor': {
    onDamagingHit(b, target, _u, hit) {
      if (hit.move.category !== 'physical' || target.pokemon.hp <= 0) return;
      b.showAbility(target);
      b.boost(target, 'def', -1, false);
      b.boost(target, 'spe', 2, false);
    },
  },
  unaware: {}, // 在伤害计算中特判（damage.ts）：无视对手能力阶
  'cloud-nine': {}, // 在伤害计算中特判：天气伤害修正失效
  unnerve: {}, // 紧张感：对手不能吃树果——树果系统接入后实装
  'perish-body': {}, // 灭亡之歌机制尚未实现（魔灵珊瑚不在 M1 野外出现）
  'no-guard': {}, // 在命中判定中特判：双方招式必中
  'skill-link': {}, // 在连续招式次数中特判：总是打满
  steadfast: {}, // 在畏缩时特判：速度 +1

  // —— 攻击力 / 威力 ——
  overgrow: { modifyBasePower: pinch('grass') },
  blaze: { modifyBasePower: pinch('fire') },
  torrent: { modifyBasePower: pinch('water') },
  swarm: { modifyBasePower: pinch('bug') },
  'huge-power': { modifyAttack: (_b, _m, _mv, s) => (s === 'atk' ? 2 : 1) },
  'pure-power': { modifyAttack: (_b, _m, _mv, s) => (s === 'atk' ? 2 : 1) },
  guts: { modifyAttack: (_b, mon, _mv, s) => (s === 'atk' && mon.pokemon.status ? 1.5 : 1) },
  hustle: {
    modifyAttack: (_b, _m, _mv, s) => (s === 'atk' ? 1.5 : 1),
    modifyAccuracy: (_b, _u, move) => (move.category === 'physical' ? 0.8 : 1),
  },
  technician: { modifyBasePower: (_b, _u, _t, move) => (move.power > 0 && move.power <= 60 ? 1.5 : 1) },
  'sheer-force': {
    sheerForce: true,
    modifyBasePower: (_b, _u, _t, move) => (hasSecondary(move) ? 1.3 : 1),
  },
  'flash-fire': {
    onTryHit: absorb('fire', 'flash-fire'),
    modifyBasePower: (_b, user, _t, _m, type) => (user.v.flashFire && type === 'fire' ? 1.5 : 1),
  },
  analytic: {
    modifyBasePower: (b, user) => (b.foeOf(user).v.movedThisTurn ? 1.3 : 1),
  },
  'tinted-lens': { modifyDamageDealt: (_b, _u, _t, hit) => (hit.effectiveness > 0 && hit.effectiveness < 1 ? 2 : 1) },
  adaptability: {}, // 在伤害计算中特判 STAB = 2
  'iron-fist': {},
  'long-reach': { noContact: true },

  // —— 防御 ——
  'thick-fat': { modifyDamageTaken: (_b, _t, _u, hit) => (hit.type === 'fire' || hit.type === 'ice' ? 0.5 : 1) },
  'water-absorb': { onTryHit: absorb('water', 'heal') },
  'volt-absorb': { onTryHit: absorb('electric', 'heal') },
  'lightning-rod': { onTryHit: absorb('electric', 'spa') },
  'storm-drain': { onTryHit: absorb('water', 'spa') },
  'motor-drive': { onTryHit: absorb('electric', 'spe') },
  'sap-sipper': { onTryHit: absorb('grass', 'atk') },
  levitate: {
    onTryHit(b, target, _u, move, type) {
      if (type !== 'ground' || move.category === 'status') return true;
      b.showAbility(target);
      b.emit({ type: 'immune', side: target.side, name: b.name(target), reason: 'ability' });
      return false;
    },
  },
  sturdy: { sturdy: true },
  'shell-armor': { critImmune: true },
  'battle-armor': { critImmune: true },
  'shield-dust': { ignoresSecondary: true },
  'marvel-scale': { modifyDefense: (_b, mon, _m, s) => (s === 'def' && mon.pokemon.status ? 1.5 : 1) },
  multiscale: { modifyDamageTaken: (b, t) => (t.pokemon.hp >= b.maxHp(t) ? 0.5 : 1) },

  // —— 接触反击 ——
  static: { onDamagingHit: contactStatus('par', 0.3) },
  'flame-body': { onDamagingHit: contactStatus('brn', 0.3) },
  'poison-point': { onDamagingHit: contactStatus('psn', 0.3) },
  'effect-spore': {
    onDamagingHit(b, target, user, hit) {
      if (!makesContact(b, user, hit.move) || user.pokemon.status || b.types(user).includes('grass')) return;
      const r = b.rng.next();
      if (r >= 0.3) return;
      b.showAbility(target);
      b.trySetStatus(user, r < 0.09 ? 'psn' : r < 0.19 ? 'par' : 'slp', target, true);
    },
  },
  'rough-skin': {
    onDamagingHit(b, target, user, hit) {
      if (!makesContact(b, user, hit.move) || user.pokemon.hp <= 0) return;
      b.showAbility(target);
      b.damage(user, Math.max(1, Math.floor(b.maxHp(user) / 8)), 'ability');
    },
  },
  rattled: {
    onDamagingHit(b, target, _u, hit) {
      if (['bug', 'ghost', 'dark'].includes(hit.type) && target.pokemon.hp > 0) {
        b.showAbility(target);
        b.boost(target, 'spe', 1, false);
      }
    },
  },
  'liquid-ooze': { liquidOoze: true },

  // —— 速度 ——
  'swift-swim': { modifySpeed: speedInWeather('rain') },
  chlorophyll: { modifySpeed: speedInWeather('sun') },
  'sand-rush': { modifySpeed: speedInWeather('sand') },
  'slush-rush': { modifySpeed: speedInWeather('hail') },
  'quick-feet': { modifySpeed: (_b, mon) => (mon.pokemon.status ? 1.5 : 1) },
  'speed-boost': {
    onResidual(b, mon) {
      if (mon.turnsActive > 0) {
        b.showAbility(mon);
        b.boost(mon, 'spe', 1, false);
      }
    },
  },

  // —— 回合结束 ——
  'rain-dish': {
    onResidual(b, mon) {
      if (b.weather === 'rain' && mon.pokemon.hp < b.maxHp(mon)) {
        b.showAbility(mon);
        b.heal(mon, Math.max(1, Math.floor(b.maxHp(mon) / 16)), 'ability');
      }
    },
  },
  'ice-body': {
    weatherImmune: (w) => w === 'hail',
    onResidual(b, mon) {
      if (b.weather === 'hail' && mon.pokemon.hp < b.maxHp(mon)) b.heal(mon, Math.floor(b.maxHp(mon) / 16), 'ability');
    },
  },
  'shed-skin': {
    onResidual(b, mon) {
      if (mon.pokemon.status && b.rng.chance(1 / 3)) {
        b.showAbility(mon);
        b.cureStatus(mon);
      }
    },
  },
  hydration: {
    onResidual(b, mon) {
      if (mon.pokemon.status && b.weather === 'rain') {
        b.showAbility(mon);
        b.cureStatus(mon);
      }
    },
  },
  moxie: {
    onFoeFainted(b, user) {
      b.showAbility(user);
      b.boost(user, 'atk', 1, false);
    },
  },

  // —— 能力下降保护 ——
  'clear-body': { blocksStatDrop: () => true },
  'white-smoke': { blocksStatDrop: () => true },
  'hyper-cutter': { blocksStatDrop: (s) => s === 'atk' },
  'big-pecks': { blocksStatDrop: (s) => s === 'def' },
  'keen-eye': { blocksStatDrop: (s) => s === 'acc', ignoreEvasion: true },

  // —— 命中 ——
  'compound-eyes': { modifyAccuracy: () => 1.3 },
  'tangled-feet': {}, // 在命中计算中特判（混乱时闪避 ×2）
  'super-luck': { critBoost: 1 },

  // —— 异常免疫 ——
  limber: { blocksStatus: (_b, _m, s) => s === 'par' },
  insomnia: { blocksStatus: (_b, _m, s) => s === 'slp' },
  'vital-spirit': { blocksStatus: (_b, _m, s) => s === 'slp' },
  immunity: { blocksStatus: (_b, _m, s) => s === 'psn' || s === 'tox' },
  'water-veil': { blocksStatus: (_b, _m, s) => s === 'brn' },
  'magma-armor': { blocksStatus: (_b, _m, s) => s === 'frz' },
  'leaf-guard': { blocksStatus: (b) => b.weather === 'sun' },
  'own-tempo': { blocksConfusion: true },
  oblivious: { blocksAttract: true },
  'inner-focus': { blocksFlinch: true },

  // —— 其他 ——
  'run-away': { runAway: true },
  damp: { damp: true },
  'sand-veil': { weatherImmune: (w) => w === 'sand' },
  'snow-cloak': { weatherImmune: (w) => w === 'hail' },
  overcoat: { weatherImmune: () => true },
  // 以下在萌芽群岛物种中出现，单打中无战斗效果或暂未实现（no-op）
  illuminate: {},
  stench: {}, // 在追加效果中特判 10% 畏缩
  healer: {},
  illusion: {},
  // —— 生态新物种第 1 批（含进化线）——
  'dry-skin': {
    onTryHit: absorb('water', 'heal'),
    modifyDamageTaken: (_b, _t, _u, hit) => (hit.type === 'fire' ? 1.25 : 1),
    onResidual(b, mon) {
      if (b.weather === 'rain' && mon.pokemon.hp < b.maxHp(mon)) {
        b.showAbility(mon);
        b.heal(mon, Math.max(1, Math.floor(b.maxHp(mon) / 8)), 'ability');
      }
    },
  },
  reckless: { modifyBasePower: (_b, _u, _t, move) => (move.meta.drain < 0 ? 1.2 : 1) },
  frisk: {}, // 出场察觉对手道具：对战 UI 暂无道具展示，no-op
  pickup: {}, // 野外效果：战斗后可能捡到道具（见 systems/encounters 掉落，后续接入）
  gluttony: {}, // 树果提前在 1/2 HP 食用：携带树果逻辑统一在道具系统中判定，暂 no-op
  'cursed-body': {}, // 定身法尚未实现
  defiant: {}, // 需要“被对手降低能力”钩子，暂 no-op
};

export const IMPLEMENTED_ABILITIES = new Set(Object.keys(ABILITIES));

const NOOP: AbilityHooks = {};

export function getAbility(id: string): AbilityHooks {
  return ABILITIES[id] ?? NOOP;
}

/** 招式是否带有追加效果（供强行 / 鳞粉判定） */
export function hasSecondary(move: MoveData): boolean {
  if (move.category === 'status') return false;
  const m = move.meta;
  return m.ailmentChance > 0 || m.flinchChance > 0 || (m.statChance > 0 && move.statChanges.length > 0);
}

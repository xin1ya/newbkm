/**
 * SYS-010 · 核心携带物（07-21 §4.1 要求约 10 个，这里实现 25 个），其余按 no-op。
 */
import type { MoveData, TypeId } from '../../data/types';
import type { BattleApi, HitInfo } from '../api';
import type { BattleMon } from '../types';

export interface ItemHooks {
  modifyAttack?(mon: BattleMon, stat: 'atk' | 'spa'): number;
  modifySpeed?(mon: BattleMon): number;
  modifyBasePower?(move: MoveData, type: TypeId, user?: BattleMon): number;
  modifyDamageDealt?(b: BattleApi, user: BattleMon, hit: HitInfo): number;
  /** 攻击方造成伤害后（生命宝珠反伤） */
  afterDealDamage?(b: BattleApi, user: BattleMon, hit: HitInfo): void;
  /** HP 变化后检查（树果） */
  onHpChange?(b: BattleApi, mon: BattleMon): void;
  /** 异常变化后检查（木子果） */
  onStatus?(b: BattleApi, mon: BattleMon): void;
  onResidual?(b: BattleApi, mon: BattleMon): void;
  /** 满 HP 时防止一击倒下（气势披带） */
  focusSash?: boolean;
  /** 讲究系：锁定首次使用的招式 */
  choice?: boolean;
  /** 半减树果：受到效果绝佳的该属性招式时伤害减半（damage.ts 计算，engine 结算消耗） */
  resistType?: TypeId;
}

/** 单一异常状态树果（樱子果 / 零余果 / 桃桃果 / 莓莓果 / 利木果） */
const cureBerry = (kinds: string[]): ItemHooks => ({
  onStatus(b, mon) {
    const st = mon.pokemon.status;
    if (st && kinds.includes(st.kind)) {
      b.showItem(mon, true);
      mon.itemUsed = true;
      b.cureStatus(mon);
    }
  },
});
const resistBerry = (type: TypeId): ItemHooks => ({ resistType: type });

const typeBoost = (type: TypeId): ItemHooks => ({ modifyBasePower: (_m, t) => (t === type ? 1.2 : 1) });

export const ITEMS: Record<string, ItemHooks> = {
  leftovers: {
    onResidual(b, mon) {
      if (mon.pokemon.hp < b.maxHp(mon)) {
        b.showItem(mon, false);
        b.heal(mon, Math.max(1, Math.floor(b.maxHp(mon) / 16)), 'item');
      }
    },
  },
  'black-sludge': {
    onResidual(b, mon) {
      if (b.types(mon).includes('poison')) {
        if (mon.pokemon.hp < b.maxHp(mon)) b.heal(mon, Math.max(1, Math.floor(b.maxHp(mon) / 16)), 'item');
      } else {
        b.showItem(mon, false);
        b.damage(mon, Math.max(1, Math.floor(b.maxHp(mon) / 8)), 'life-orb');
      }
    },
  },
  'choice-band': { choice: true, modifyAttack: (_m, s) => (s === 'atk' ? 1.5 : 1) },
  'choice-specs': { choice: true, modifyAttack: (_m, s) => (s === 'spa' ? 1.5 : 1) },
  'choice-scarf': { choice: true, modifySpeed: () => 1.5 },
  'life-orb': {
    modifyDamageDealt: () => 1.3,
    afterDealDamage(b, user) {
      if (user.pokemon.hp <= 0) return;
      b.showItem(user, false);
      b.damage(user, Math.max(1, Math.floor(b.maxHp(user) / 10)), 'life-orb');
    },
  },
  'expert-belt': { modifyDamageDealt: (_b, _u, hit) => (hit.effectiveness > 1 ? 1.2 : 1) },
  'focus-sash': { focusSash: true },
  'sitrus-berry': {
    onHpChange(b, mon) {
      if (mon.pokemon.hp > 0 && mon.pokemon.hp <= b.maxHp(mon) / 2) {
        b.showItem(mon, true);
        mon.itemUsed = true;
        b.heal(mon, Math.floor(b.maxHp(mon) / 4), 'item');
      }
    },
  },
  'oran-berry': {
    onHpChange(b, mon) {
      if (mon.pokemon.hp > 0 && mon.pokemon.hp <= b.maxHp(mon) / 2) {
        b.showItem(mon, true);
        mon.itemUsed = true;
        b.heal(mon, 10, 'item');
      }
    },
  },
  'lum-berry': {
    onStatus(b, mon) {
      if (mon.pokemon.status || mon.v.confusion > 0) {
        b.showItem(mon, true);
        mon.itemUsed = true;
        b.cureStatus(mon);
        if (mon.v.confusion > 0) {
          mon.v.confusion = 0;
          b.emit({ type: 'cure', side: mon.side, name: b.name(mon), status: 'confusion' });
        }
      }
    },
  },
  // 计划文档 §9.1 树果扩充
  'cheri-berry': cureBerry(['par']),
  'chesto-berry': cureBerry(['slp']),
  'pecha-berry': cureBerry(['psn', 'tox']),
  'rawst-berry': cureBerry(['brn']),
  'aspear-berry': cureBerry(['frz']),
  'leppa-berry': {
    onResidual(b, mon) {
      const slot = mon.pokemon.moves.find((m) => m.pp === 0 && m.maxPp > 0);
      if (!slot || mon.pokemon.hp <= 0) return;
      b.showItem(mon, true);
      mon.itemUsed = true;
      slot.pp = Math.min(slot.maxPp, 10);
    },
  },
  'occa-berry': resistBerry('fire'),
  'passho-berry': resistBerry('water'),
  'wacan-berry': resistBerry('electric'),
  'rindo-berry': resistBerry('grass'),
  'yache-berry': resistBerry('ice'),
  'chople-berry': resistBerry('fighting'),
  charcoal: typeBoost('fire'),
  'mystic-water': typeBoost('water'),
  // M3 自定义携带物
  'spirit-veil': typeBoost('ghost'),
  'seer-eye': typeBoost('psychic'),
  'ancient-amulet': typeBoost('water'),
  // 心之水滴：拉帝亚斯 / 拉帝欧斯携带时超能力 / 龙属性招式威力 1.2 倍
  'soul-dew': {
    modifyBasePower: (_m, t, user) =>
      user && (user.pokemon.speciesId === 380 || user.pokemon.speciesId === 381) && (t === 'psychic' || t === 'dragon') ? 1.2 : 1,
  },
  'miracle-seed': typeBoost('grass'),
  magnet: typeBoost('electric'),
  'sharp-beak': typeBoost('flying'),
  'silver-powder': typeBoost('bug'),
  'poison-barb': typeBoost('poison'),
  'silk-scarf': typeBoost('normal'),
  'black-belt': typeBoost('fighting'),
  'soft-sand': typeBoost('ground'),
  'hard-stone': typeBoost('rock'),
  'never-melt-ice': typeBoost('ice'),
  'spell-tag': typeBoost('ghost'),
  'twisted-spoon': typeBoost('psychic'),
  'dragon-fang': typeBoost('dragon'),
  'black-glasses': typeBoost('dark'),
  'metal-coat': typeBoost('steel'),
  'fairy-feather': typeBoost('fairy'),
};

export const IMPLEMENTED_ITEMS = new Set(Object.keys(ITEMS));

const NOOP: ItemHooks = {};

/** 当前生效的携带物钩子（已消耗 → no-op） */
export function getItem(mon: BattleMon): ItemHooks {
  const id = mon.pokemon.heldItem;
  if (!id || mon.itemUsed) return NOOP;
  return ITEMS[id] ?? NOOP;
}

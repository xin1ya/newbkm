/**
 * 计划文档 §9.1 · 树果（24 种）：风味 / 顺滑度（能量方块）、生长时间与产量（种植，步骤 10）、植株配色（野外树果树）。
 * 数据在 config/data/berries.json；不在 PokeAPI 道具表里的树果在这里注册为「树果」口袋物品。
 */
import type { KeyItemDef } from '@/systems/items';
import type { MajorStatus } from '@/systems/pokemon';
import type { BaseStatId, TypeId } from '@/systems/data/types';
import data from '@/config/data/berries.json';
import items from '@/config/data/items.json';

export type BerryCategory = 'heal' | 'status' | 'ev' | 'resist' | 'flavor';
export type Flavor = 'spicy' | 'dry' | 'sweet' | 'bitter' | 'sour';
export const FLAVORS: Flavor[] = ['spicy', 'dry', 'sweet', 'bitter', 'sour'];
export const FLAVOR_ZH: Record<Flavor, string> = { spicy: '辣', dry: '涩', sweet: '甜', bitter: '苦', sour: '酸' };

export interface BerryEffect {
  healHp?: number;
  healFrac?: number;
  /** 回复 PP */
  pp?: number;
  cure?: MajorStatus[];
  confusion?: boolean;
  /** 降低该项努力值 10 点 + 提升亲密度 */
  ev?: BaseStatId;
  /** 半减一次效果绝佳的该属性伤害 */
  resist?: TypeId;
}

export type BerryShape = 'round' | 'oval' | 'lum' | 'twin' | 'heart' | 'leafy' | 'root' | 'spiky' | 'bumpy';

export interface BerryDef {
  id: string;
  name: string;
  category: BerryCategory;
  effect: BerryEffect;
  flavor: Record<Flavor, number>;
  smoothness: number;
  /** 种植：种下到结果的游戏小时数 */
  growHours: number;
  /** 一次收获的产量范围 */
  yield: [number, number];
  color: { fruit: string; shade: string; leaf: string };
  shape: BerryShape;
  desc: string;
}

export const BERRIES: readonly BerryDef[] = data as unknown as BerryDef[];
export const BERRY_BY_ID: ReadonlyMap<string, BerryDef> = new Map(BERRIES.map((b) => [b.id, b]));

/** 主要风味（数值最大的一项；并列取靠前） */
export function mainFlavor(b: BerryDef): Flavor {
  return FLAVORS.reduce((best, f) => (b.flavor[f] > b.flavor[best] ? f : best), FLAVORS[0]!);
}

const IN_POKEAPI = new Set((items as { id: string }[]).map((i) => i.id));

/** 道具表里没有的树果 → 注册成「树果」口袋物品（名称 / 说明取 berries.json） */
export const BERRY_ITEMS: KeyItemDef[] = BERRIES.filter((b) => !IN_POKEAPI.has(b.id)).map((b) => ({ id: b.id, name: b.name, desc: b.desc, pocket: 'berries' }));

/** 降努力值树果：能力 → 树果 id */
export const EV_BERRIES: Readonly<Record<string, BaseStatId>> = Object.fromEntries(BERRIES.flatMap((b) => (b.effect.ev ? [[b.id, b.effect.ev]] : [])));

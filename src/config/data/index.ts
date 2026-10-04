/**
 * 生成数据入口：加载 scripts/fetch-data.ts 写出的 JSON，构造全局只读 Dex。
 */
import { Dex } from '@/systems/data/Dex';
import type { AbilityData, ItemData, MoveData, NatureData, SpeciesData, TypeChartData } from '@/systems/data/types';
import species from './species.json';
import moves from './moves.json';
import types from './types.json';
import abilities from './abilities.json';
import items from './items.json';
import natures from './natures.json';

export const dex = new Dex({
  species: species as SpeciesData[],
  moves: moves as MoveData[],
  types: types as TypeChartData,
  abilities: abilities as AbilityData[],
  items: items as ItemData[],
  natures: natures as NatureData[],
});

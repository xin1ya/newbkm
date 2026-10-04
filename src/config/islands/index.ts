import type { IslandId } from '@/systems/state/GameState';
import { SPROUT } from './sprout';
import { TIDE } from './tide';
import type { IslandConfig } from './types';

export const ISLANDS: Partial<Record<IslandId, IslandConfig>> = {
  sprout: SPROUT,
  tide: TIDE,
};

export function getIsland(id: IslandId): IslandConfig {
  const c = ISLANDS[id];
  if (!c) throw new Error(`岛屿 ${id} 尚未配置`);
  return c;
}

export * from './types';

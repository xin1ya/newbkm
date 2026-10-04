import type { IslandId } from '@/systems/state/GameState';
import { SPROUT } from './sprout';
import type { IslandConfig } from './types';

export const ISLANDS: Partial<Record<IslandId, IslandConfig>> = {
  sprout: SPROUT,
};

export function getIsland(id: IslandId): IslandConfig {
  const c = ISLANDS[id];
  if (!c) throw new Error(`岛屿 ${id} 尚未配置（当前里程碑只包含萌芽群岛）`);
  return c;
}

export * from './types';

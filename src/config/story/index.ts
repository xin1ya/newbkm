/**
 * M1-13 / M1-14 · 剧情脚本注册表（按岛屿汇总）。
 */
import type { StoryPickup, StoryScript, StoryTrigger } from '@/systems/story';
import { SPROUT_PICKUPS, SPROUT_STORY, SPROUT_TRIGGERS, STARTER_CARDS } from './sprout';
import { TIDE_STORY, TIDE_TRIGGERS } from './tide';

export { FERRY_ARRIVAL } from './tide';

export { STARTERS, STARTER_LEVEL, HERB_SPOTS } from './sprout';
export { STARTER_CARDS };

export const STORY_SCRIPTS: ReadonlyMap<string, StoryScript> = new Map([...SPROUT_STORY, ...TIDE_STORY].map((s) => [s.id, s]));
export const STORY_PICKUPS: readonly StoryPickup[] = SPROUT_PICKUPS;
export const STORY_TRIGGERS: readonly StoryTrigger[] = [...SPROUT_TRIGGERS, ...TIDE_TRIGGERS];

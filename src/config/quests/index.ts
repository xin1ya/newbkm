import { QuestRegistry, type Quest } from '@/systems/quests';
import { SPROUT_QUESTS } from './sprout';
import { TIDE_QUESTS } from './tide';
import { THUNDER_QUESTS } from './thunder';
import { GLAZE_QUESTS } from './glaze';
export { SPROUT_QUESTS } from './sprout';
export { TIDE_QUESTS } from './tide';
export { THUNDER_QUESTS } from './thunder';

export const ALL_QUESTS: Quest[] = [...SPROUT_QUESTS, ...TIDE_QUESTS, ...THUNDER_QUESTS, ...GLAZE_QUESTS];

/** 全局任务注册表（状态由 flags 推导，可随处共享） */
export const QUEST_REGISTRY = new QuestRegistry(ALL_QUESTS);

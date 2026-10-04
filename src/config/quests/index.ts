import { QuestRegistry, type Quest } from '@/systems/quests';
import { SPROUT_QUESTS } from './sprout';
export { SPROUT_QUESTS } from './sprout';

export const ALL_QUESTS: Quest[] = [...SPROUT_QUESTS];

/** 全局任务注册表（状态由 flags 推导，可随处共享） */
export const QUEST_REGISTRY = new QuestRegistry(ALL_QUESTS);

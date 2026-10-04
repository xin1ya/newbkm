import type { EncounterTable } from '@/systems/encounters';
import { SPROUT_ENCOUNTERS } from './sprout';
export { SPROUT_ENCOUNTERS } from './sprout';
import { TIDE_ENCOUNTERS } from './tide';
export { TIDE_ENCOUNTERS } from './tide';
export { GYMS } from './gyms';
export { BEHAVIOR, behaviorOf } from './behavior';
export type { SpeciesBehavior } from './behavior';

/** 所有岛的遇敌表（按表 id 索引） */
export const ENCOUNTER_TABLES: Record<string, EncounterTable> = { ...SPROUT_ENCOUNTERS, ...TIDE_ENCOUNTERS };

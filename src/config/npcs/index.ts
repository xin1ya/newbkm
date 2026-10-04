import { TRAINER_NPCS } from '@/config/trainers';
import type { NpcDef } from '@/systems/npcs';
import { SPROUT_NPCS } from './sprout';
import { TIDE_NPCS } from './tide';

export { SPROUT_NPCS } from './sprout';
export { TIDE_NPCS } from './tide';

export const ALL_NPCS: NpcDef[] = [...SPROUT_NPCS, ...TIDE_NPCS, ...TRAINER_NPCS];
export const NPC_BY_ID: ReadonlyMap<string, NpcDef> = new Map(ALL_NPCS.map((n) => [n.id, n]));

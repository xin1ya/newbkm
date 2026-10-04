import { TRAINER_NPCS } from '@/config/trainers';
import type { NpcDef } from '@/systems/npcs';
import { SPROUT_NPCS } from './sprout';

export { SPROUT_NPCS } from './sprout';

export const ALL_NPCS: NpcDef[] = [...SPROUT_NPCS, ...TRAINER_NPCS];
export const NPC_BY_ID: ReadonlyMap<string, NpcDef> = new Map(ALL_NPCS.map((n) => [n.id, n]));

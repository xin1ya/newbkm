import { TRAINER_NPCS } from '@/config/trainers';
import type { NpcDef } from '@/systems/npcs';
import { SPROUT_NPCS } from './sprout';
import { TIDE_NPCS } from './tide';
import { THUNDER_NPCS } from './thunder';
import { THUNDER_GYM_NPCS } from './thunderGyms';
import { GLAZE_GYM_NPCS } from './glazeGyms';
import { GLAZE_NPCS } from './glaze';
import { VICTORY_ROAD_NPCS } from './victoryRoad';
import { DUNGEON_NPCS } from './dungeons';
import { LEAGUE_NPCS } from './league';

export { SPROUT_NPCS } from './sprout';
export { TIDE_NPCS } from './tide';
export { THUNDER_NPCS } from './thunder';
export { GLAZE_NPCS } from './glaze';

export const ALL_NPCS: NpcDef[] = [...SPROUT_NPCS, ...TIDE_NPCS, ...THUNDER_NPCS, ...THUNDER_GYM_NPCS, ...GLAZE_NPCS, ...GLAZE_GYM_NPCS, ...VICTORY_ROAD_NPCS, ...DUNGEON_NPCS, ...LEAGUE_NPCS, ...TRAINER_NPCS];
export const NPC_BY_ID: ReadonlyMap<string, NpcDef> = new Map(ALL_NPCS.map((n) => [n.id, n]));

import type { InteractionDef } from '@/systems/interaction';
import { SPROUT_FURNITURE, SPROUT_LANDMARKS } from './sprout';
import { TIDE_FURNITURE, TIDE_LANDMARKS } from './tide';
import { THUNDER_FURNITURE, THUNDER_LANDMARKS } from './thunder';
import { DUNGEON_FURNITURE } from './dungeons';
import { GLAZE_FURNITURE, GLAZE_LANDMARKS, LEAGUE_FURNITURE, VICTORY_ROAD_FURNITURE } from './glaze';
import { SECRET_LANDMARKS } from './secret';

export { SPROUT_FURNITURE, SPROUT_LANDMARKS } from './sprout';
export { TIDE_FURNITURE, TIDE_LANDMARKS } from './tide';
export { THUNDER_FURNITURE, THUNDER_LANDMARKS } from './thunder';
export { GLAZE_FURNITURE, GLAZE_LANDMARKS } from './glaze';
export { SECRET_LANDMARKS } from './secret';

export const ALL_INTERACTIONS: InteractionDef[] = [...SPROUT_FURNITURE, ...SPROUT_LANDMARKS, ...TIDE_FURNITURE, ...TIDE_LANDMARKS, ...THUNDER_FURNITURE, ...THUNDER_LANDMARKS, ...GLAZE_FURNITURE, ...GLAZE_LANDMARKS, ...VICTORY_ROAD_FURNITURE, ...LEAGUE_FURNITURE, ...DUNGEON_FURNITURE, ...SECRET_LANDMARKS];
export const INTERACTION_BY_ID: ReadonlyMap<string, InteractionDef> = new Map(ALL_INTERACTIONS.map((d) => [d.id, d]));

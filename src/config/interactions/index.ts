import type { InteractionDef } from '@/systems/interaction';
import { SPROUT_FURNITURE, SPROUT_LANDMARKS } from './sprout';
import { TIDE_FURNITURE, TIDE_LANDMARKS } from './tide';

export { SPROUT_FURNITURE, SPROUT_LANDMARKS } from './sprout';
export { TIDE_FURNITURE, TIDE_LANDMARKS } from './tide';

export const ALL_INTERACTIONS: InteractionDef[] = [...SPROUT_FURNITURE, ...SPROUT_LANDMARKS, ...TIDE_FURNITURE, ...TIDE_LANDMARKS];
export const INTERACTION_BY_ID: ReadonlyMap<string, InteractionDef> = new Map(ALL_INTERACTIONS.map((d) => [d.id, d]));

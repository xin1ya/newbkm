import type { InteractionDef } from '@/systems/interaction';
import { SPROUT_FURNITURE, SPROUT_LANDMARKS } from './sprout';

export { SPROUT_FURNITURE, SPROUT_LANDMARKS } from './sprout';

export const ALL_INTERACTIONS: InteractionDef[] = [...SPROUT_FURNITURE, ...SPROUT_LANDMARKS];
export const INTERACTION_BY_ID: ReadonlyMap<string, InteractionDef> = new Map(ALL_INTERACTIONS.map((d) => [d.id, d]));

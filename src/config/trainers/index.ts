import type { NpcDef } from '@/systems/npcs';
import type { TrainerDef } from '@/systems/trainers';
import { SPROUT_GYM_TRAINERS, SPROUT_TRAINERS, type TrainerPlacement } from './sprout';

export const ALL_TRAINERS: TrainerPlacement[] = [...SPROUT_TRAINERS];
export const TRAINER_BY_ID: ReadonlyMap<string, TrainerDef> = new Map([...ALL_TRAINERS.map((t) => t.def), ...SPROUT_GYM_TRAINERS].map((d) => [d.id, d]));
/** 道馆训练家（室内固定站位，NPC 定义在 config/npcs） */
export const GYM_TRAINERS: readonly TrainerDef[] = SPROUT_GYM_TRAINERS;

/** 训练家对应的 NPC（合并进 ALL_NPCS）：击败后的对话走普通 NPC 对话 */
export const TRAINER_NPCS: NpcDef[] = ALL_TRAINERS.map((t) => ({
  ...t.npc,
  id: `trainer-${t.def.id}`,
  name: t.def.name,
  title: t.def.title,
  trainer: t.def.id,
  dialog: t.def.after,
}));

export type { TrainerPlacement };

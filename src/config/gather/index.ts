/** 计划文档 §9.2 · 全部岛屿的采集点（按岛屿登记；新岛屿在这里追加） */
import type { GatherPointDef } from '@/systems/gathering';
import { SPROUT_GATHER } from './sprout';

export const GATHER_POINTS: ReadonlyArray<{ island: string; def: GatherPointDef }> = [...SPROUT_GATHER.map((def) => ({ island: 'sprout', def }))];

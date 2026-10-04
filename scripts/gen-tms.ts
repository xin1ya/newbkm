/**
 * 生成 src/config/tms/compat.json：每张招式学习器的可学物种（计划文档 §6）。
 * 规则见 src/systems/tms computeTmCompat；物种数据变化（pnpm fetch-data）或 TM 表变化后重新运行。
 *   pnpm gen:tms
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TM_DEFS, tmItemId } from '../src/config/tms';
import { computeTmCompat } from '../src/systems/tms';
import type { MoveData, SpeciesData } from '../src/systems/data/types';

const root = resolve(import.meta.dirname, '..');
const species = JSON.parse(readFileSync(resolve(root, 'src/config/data/species.json'), 'utf8')) as SpeciesData[];
const moves = new Map((JSON.parse(readFileSync(resolve(root, 'src/config/data/moves.json'), 'utf8')) as MoveData[]).map((m) => [m.id, m]));
const out: Record<string, number[]> = {};
for (const t of TM_DEFS) {
  const mv = moves.get(t.move);
  if (!mv) throw new Error(`招式数据里没有 ${t.move}`);
  out[tmItemId(t.move)] = computeTmCompat(species, mv.type, t);
  console.log(`No.${String(t.no).padStart(2, '0')} ${t.move.padEnd(14)} ${out[tmItemId(t.move)]!.length} 种`);
}
writeFileSync(resolve(root, 'src/config/tms/compat.json'), JSON.stringify(out));

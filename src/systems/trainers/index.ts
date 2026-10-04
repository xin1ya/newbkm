/**
 * M1-10 · 训练家对战纯逻辑：定义、视线判定（锥形 + 遮挡回调）、接近点、奖金、击败 flag、队伍生成。
 * 训练家本体是 NPC（NpcDef.trainer 指向这里的 id），站位 / 日程沿用 NPC 系统。
 */
import type { Dex } from '../data/Dex';
import type { AiLevel, TrainerInfo } from '../battle/types';
import type { PokemonInstance } from '../pokemon/Pokemon';
import { createPokemon } from '../pokemon/Pokemon';
import type { Rng } from '../rng';
import type { Flags } from '../quests';

export interface TrainerMon {
  species: number;
  level: number;
  /** 指定招式（缺省按等级学会的最后 4 个） */
  moves?: string[];
}

export interface TrainerDef {
  id: string;
  name: string;
  /** 训练家类型（短裤小子、捕虫少年……），显示在名字前 */
  title: string;
  party: TrainerMon[];
  ai: AiLevel;
  /** 奖金基数：奖金 = 基数 × 最后一只宝可梦等级 */
  prizeBase: number;
  /** 视线距离（米）与张角（度，全角）；0 = 不会主动发现（只能对话挑战） */
  sight: { range: number; fov: number };
  /** 发现玩家后走过来说的话 */
  intro: string[];
  /** 战败时在战斗中说的话 */
  defeat: string[];
  /** 战败后再对话 */
  after: string[];
  /** 登场动作 */
  entrance?: 'wave' | 'point' | 'flex' | 'bow';
  items?: { id: string; qty: number }[];
  /** 道馆馆主：队伍 / 奖金 / 道具由对应 GymDef 按徽章数动态生成（party 可留空） */
  gym?: string;
}

export const trainerFlag = (id: string): string => `trainer-defeated:${id}`;

export function isDefeated(flags: Flags, id: string): boolean {
  return !!flags[trainerFlag(id)];
}

export function prizeMoney(def: TrainerDef): number {
  const last = def.party[def.party.length - 1];
  return def.prizeBase * (last?.level ?? 1);
}

export function trainerInfo(def: TrainerDef): TrainerInfo {
  return { id: def.id, name: def.name, title: def.title, ai: def.ai, prizeMoney: prizeMoney(def), ...(def.items ? { items: def.items } : {}) };
}

export function buildTrainerParty(dex: Dex, def: TrainerDef, rng: Rng): PokemonInstance[] {
  return def.party.map((m) => {
    const p = createPokemon(dex, m.species, m.level, rng, { ot: def.name });
    if (m.moves?.length) {
      p.moves = m.moves.slice(0, 4).map((id) => {
        const mv = dex.move(id);
        return { id, pp: mv.pp, maxPp: mv.pp };
      });
    }
    return p;
  });
}

function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export interface SightQuery {
  trainer: { x: number; z: number; yaw: number };
  player: { x: number; z: number };
  sight: { range: number; fov: number };
  /** 视线是否被挡（地形起伏、建筑）；返回 true 表示看不见 */
  blocked?: (x0: number, z0: number, x1: number, z1: number) => boolean;
}

/**
 * 视线判定：距离 ≤ range 且在朝向 ±fov/2 内，且没有遮挡。
 * 近距离（1.2 m 内）即使在侧面也会察觉（贴身走过去不会被无视）。
 */
export function canSee(q: SightQuery): boolean {
  const { trainer: t, player: p, sight } = q;
  if (sight.range <= 0) return false;
  const dx = p.x - t.x;
  const dz = p.z - t.z;
  const d = Math.hypot(dx, dz);
  if (d > sight.range) return false;
  if (d > 1.2) {
    const toward = Math.atan2(dx, dz);
    if (Math.abs(angleDelta(t.yaw, toward)) > ((sight.fov / 2) * Math.PI) / 180) return false;
  }
  return !q.blocked?.(t.x, t.z, p.x, p.z);
}

/** 训练家走到玩家面前停下的位置（沿连线，离玩家 stop 米） */
export function approachPoint(t: { x: number; z: number }, p: { x: number; z: number }, stop = 1.6): { x: number; z: number; yaw: number } {
  const dx = p.x - t.x;
  const dz = p.z - t.z;
  const d = Math.hypot(dx, dz) || 1;
  const k = Math.max(0, d - stop) / d;
  return { x: t.x + dx * k, z: t.z + dz * k, yaw: Math.atan2(dx, dz) };
}

/**
 * 地形遮挡采样：沿视线每 1 m 取地面高度，若高于两端眼高连线（1.5 m）则挡住。
 */
export function terrainBlocks(heightAt: (x: number, z: number) => number, x0: number, z0: number, x1: number, z1: number, eye = 1.5): boolean {
  const d = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.floor(d);
  const h0 = heightAt(x0, z0) + eye;
  const h1 = heightAt(x1, z1) + eye;
  for (let i = 1; i < n; i++) {
    const k = i / d;
    if (heightAt(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k) > h0 + (h1 - h0) * k) return true;
  }
  return false;
}

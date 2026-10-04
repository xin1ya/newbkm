/**
 * M1-06 · 与 NPC 对话（大地图与室内共用）。
 * 流程：NPC 停下转向玩家、玩家转向 NPC → 按优先级选对话（07-22 §3.5）→ 打字机对话框（说话人名牌）→
 * 置位该段对话的 setFlags（如接取支线）→ 发出 npc:talk 事件。
 * M1-19 / M1-15：有赠礼（首次）时先送礼，替代本次普通对话；有服务（回复 / 商店）时在对话后执行。
 */
import type * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { Npc } from '@/actors/npc';
import { selectDialog, questStatus, type QuestDialog } from '@/systems/quests';
import type { GameState } from '@/systems/state/GameState';
import { QUEST_REGISTRY } from '@/config/quests';
import { say, type UiRoot } from '@/ui/core';
import { giftDue, type NpcServices } from './npcServices';
import { storyDirector } from './StoryDirector';

export interface TalkContext {
  game: Game;
  ui: UiRoot;
  state: GameState;
  playerPosition: THREE.Vector3;
  /** 玩家转向（弧度） */
  facePlayer(yaw: number): void;
  toast?: ((text: string) => void) | undefined;
  /** 回复 / 商店 / 赠礼（没有时忽略这些字段） */
  services?: NpcServices | undefined;
}

/** 选出本次要说的对话，以及它附带的 setFlags */
export function resolveTalk(npc: Npc, state: GameState, isNight: boolean): { lines: string[]; setFlags: string[]; story: string | null } {
  const def = npc.def;
  const lines = selectDialog(def, QUEST_REGISTRY, state.flags, isNight);
  const entry: QuestDialog | undefined = (def.dialogByQuest ?? []).find((d) => d.dialog === lines);
  return { lines, setFlags: entry?.setFlags ?? [], story: entry?.story ?? null };
}

let talking = false;

export function isTalking(): boolean {
  return talking;
}

export async function talkToNpc(npc: Npc, ctx: TalkContext): Promise<void> {
  if (talking) return;
  talking = true;
  const { game, state } = ctx;
  const { lines, setFlags, story } = resolveTalk(npc, state, game.clock.timeOfDay === 'night');
  npc.beginTalk(ctx.playerPosition);
  ctx.facePlayer(Math.atan2(npc.position.x - ctx.playerPosition.x, npc.position.z - ctx.playerPosition.z));
  game.events.emit('npc:talk', { npc: npc.def.id, phase: 'start', setFlags });
  try {
    const gift = ctx.services ? giftDue(npc.def.gift, state.flags) : null;
    if (gift) {
      await ctx.services!.gift(npc, gift);
      return;
    }
    if (lines.length) await say(ctx.ui, lines, { speaker: npc.def.name });
    // M1-13：剧情脚本（选择御三家、索罗亚现身……）在对白之后执行，flag 由脚本自己置位
    if (story) await storyDirector()?.run(story);
    const started: string[] = [];
    for (const f of setFlags) {
      if (state.flags[f]) continue;
      state.flags[f] = true;
      game.events.emit('flag:set', { flag: f, value: true });
      const q = QUEST_REGISTRY.all.find((x) => x.startFlag === f);
      if (q && questStatus(q, state.flags) === 'active') started.push(q.title);
    }
    for (const t of started) ctx.toast?.(`接受了任务：${t}`);
    const svc = npc.def.service;
    if (svc && ctx.services) {
      if (svc.kind === 'heal') await ctx.services.heal(npc);
      else if (svc.kind === 'recall') await ctx.services.recall(npc);
      else if (svc.kind === 'breeder') await ctx.services.breeder(npc);
      else if (svc.kind === 'workshop') await ctx.services.workshop(npc);
      else await ctx.services.shop(npc, svc.shop);
    }
  } finally {
    npc.endTalk();
    game.events.emit('npc:talk', { npc: npc.def.id, phase: 'end', setFlags });
    talking = false;
  }
}

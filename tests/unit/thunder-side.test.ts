/** M3-26 雷鸣支线 6 条：任务 / NPC / 剧情 / 拾取物衔接 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THUNDER } from '@/config/islands/thunder';
import type { PropsFile } from '@/config/islands/types';
import { Heightfield } from '@/world/terrain/Heightfield';
import { CollisionWorld } from '@/world/collision/CollisionWorld';
import { GrayboxProps } from '@/world/props/GrayboxProps';
import { QUEST_REGISTRY } from '@/config/quests';
import { STORY_PICKUPS, STORY_SCRIPTS } from '@/config/story';
import { ALL_NPCS, NPC_BY_ID } from '@/config/npcs';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { dex } from '@/config/data';
import { flagsWritten } from '@/systems/story';

const IDS = ['side-crystal-treasure', 'side-lighthouse-ghost', 'side-thunder-observation', 'side-ice-sculpture', 'side-frozen-seed', 'side-cloud-mail'];
const storyFlags = flagsWritten([...STORY_SCRIPTS.values()].flatMap((s) => s.steps));
const dialogFlags = new Set(ALL_NPCS.flatMap((n) => (n.dialogByQuest ?? []).flatMap((d) => d.setFlags ?? [])));

describe('M3-26 雷鸣支线', () => {
  it('6 条支线齐全，每个目标 flag 都有来源，奖励存在', () => {
    for (const id of IDS) {
      const q = QUEST_REGISTRY.get(id)!;
      expect(q, id).toBeTruthy();
      expect(q.category).toBe('side');
      for (const o of q.objectives) expect(storyFlags.has(o.completeFlag) || dialogFlags.has(o.completeFlag), `${id}/${o.id}`).toBe(true);
      if (q.startFlag) expect(storyFlags.has(q.startFlag) || dialogFlags.has(q.startFlag), q.startFlag).toBe(true);
      for (const it of q.reward?.items ?? []) expect(!!dex.item(it.id) || KEY_ITEM_BY_ID.has(it.id), it.id).toBe(true);
      if (q.reward?.pokemon) expect(dex.species(q.reward.pokemon)).toBeTruthy();
    }
  });

  it('剧情脚本引用都存在（互动 / NPC / 拾取物）', () => {
    const refs = [
      ...STORY_PICKUPS.map((p) => p.script),
      ...ALL_INTERACTIONS.flatMap((d) => (d.effects ?? []).flatMap((e) => (e.kind === 'story' ? [e.script] : []))),
      ...ALL_NPCS.flatMap((n) => (n.dialogByQuest ?? []).flatMap((d) => (d.story ? [d.story] : []))),
    ];
    for (const r of refs) expect(STORY_SCRIPTS.has(r), r).toBe(true);
  });

  it('信使：三封信各由一位 NPC 收下且只收一次', () => {
    for (const [npc, flag] of [['magnolia', 'mail-magnolia'], ['inn-owner', 'mail-inn-owner'], ['dawn-miller', 'mail-dawn-miller']] as const) {
      const d = NPC_BY_ID.get(npc)!.dialogByQuest!.find((x) => x.questId === 'side-cloud-mail')!;
      expect(d.setFlags).toEqual([flag]);
      expect(d.unless).toEqual([flag]);
    }
  });

  it('雷鸣地图上的拾取物与新 NPC 站在陆地上、不被道具挡住', () => {
    const dir = join(__dirname, '../../assets');
    const buf = (p: string) => {
      const b = readFileSync(join(dir, p));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const hf = Heightfield.fromPng(THUNDER, buf(THUNDER.heightmap), THUNDER.splatmaps.map(buf));
    const col = new CollisionWorld();
    new GrayboxProps(hf, col, JSON.parse(readFileSync(join(dir, 'islands/thunder/props.json'), 'utf8')) as PropsFile);
    const pts: Array<[string, number, number]> = STORY_PICKUPS.filter((p) => p.island === 'thunder').map((p) => [p.id, p.position[0], p.position[1]]);
    for (const id of ['storm-researcher', 'snow-sculptor', 'lark-courier']) {
      const at = NPC_BY_ID.get(id)!.schedule![0]!.at as { position: [number, number] };
      pts.push([id, at.position[0], at.position[1]]);
    }
    expect(pts.length).toBe(7);
    for (const [id, x, z] of pts) {
      expect(hf.waterAt(x, z)?.depth ?? 0, id).toBeLessThanOrEqual(0);
      expect(col.query(x, z, 1.0).length, id).toBe(0);
    }
  });
});

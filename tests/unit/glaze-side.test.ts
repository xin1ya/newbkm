/** M3-27 琉璃支线 6 条：任务 / NPC / 剧情 / 拾取物 / 秘密基地布置 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLAZE } from '@/config/islands/glaze';
import type { PropsFile } from '@/config/islands/types';
import { Heightfield } from '@/world/terrain/Heightfield';
import { CollisionWorld } from '@/world/collision/CollisionWorld';
import { GrayboxProps } from '@/world/props/GrayboxProps';
import { QUEST_REGISTRY } from '@/config/quests';
import { STORY_PICKUPS, STORY_SCRIPTS } from '@/config/story';
import { ALL_NPCS } from '@/config/npcs';
import { INTERIORS } from '@/config/interiors';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { dex } from '@/config/data';
import { flagsWritten } from '@/systems/story';
import { furnitureShown } from '@/systems/interaction';

const IDS = ['side-shadow-cave', 'side-spirit-seance', 'side-sea-temple', 'side-secret-base', 'side-mirage-prophecy', 'side-lily-watervein'];
const storyFlags = flagsWritten([...STORY_SCRIPTS.values()].flatMap((s) => s.steps));
const dialogFlags = new Set(ALL_NPCS.flatMap((n) => (n.dialogByQuest ?? []).flatMap((d) => d.setFlags ?? [])));

describe('M3-27 琉璃支线', () => {
  it('6 条支线齐全（海底神殿沿用 M3-18），每个目标 flag 都有来源，奖励存在', () => {
    for (const id of IDS) {
      const q = QUEST_REGISTRY.get(id)!;
      expect(q, id).toBeTruthy();
      for (const o of q.objectives) expect(storyFlags.has(o.completeFlag) || dialogFlags.has(o.completeFlag) || o.completeFlag.startsWith('hm'), `${id}/${o.id}`).toBe(true);
      if (q.startFlag) expect(storyFlags.has(q.startFlag) || dialogFlags.has(q.startFlag), q.startFlag).toBe(true);
      for (const it of q.reward?.items ?? []) expect(!!dex.item(it.id) || KEY_ITEM_BY_ID.has(it.id), it.id).toBe(true);
    }
  });

  it('剧情战斗的物种与招式都存在', () => {
    for (const s of STORY_SCRIPTS.values())
      for (const st of s.steps)
        if (st.kind === 'battle') {
          expect(dex.species(st.species), `${s.id} ${st.species}`).toBeTruthy();
          for (const m of st.moves ?? []) expect(dex.hasMove(m), `${s.id} ${m}`).toBe(true);
        }
  });

  it('秘密基地：洞口东门要求建好；布置主题互斥，家具按 flag 显隐', () => {
    const cave = INTERIORS['shadow-cave']!;
    const door = cave.rooms.find((r) => r.id === 'mouth')!.exits.find((e) => e.id === 'base')!;
    expect(door.requires).toEqual(['secret-base-built']);
    const base = cave.rooms.find((r) => r.id === 'base')!;
    const shown = (flags: Record<string, boolean>) => base.furniture.filter((f) => furnitureShown(f, flags)).length;
    const none = shown({});
    for (const t of ['cozy', 'crystal', 'training']) expect(shown({ [`base-theme-${t}`]: true }), t).toBeGreaterThan(none + 3);
    expect(furnitureShown({ hideIf: ['a'] }, { a: true })).toBe(false);
    const decor = STORY_SCRIPTS.get('secret-base-decor')!.steps[0]!;
    if (decor.kind !== 'choice') throw new Error();
    for (const o of decor.options) expect(o.steps.some((s) => s.kind === 'fx' && s.name === 'room-refresh'), o.label).toBe(true);
  });

  it('琉璃地图上的支线拾取物都在陆地、不被道具挡住', () => {
    const dir = join(__dirname, '../../assets');
    const buf = (p: string) => {
      const b = readFileSync(join(dir, p));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const hf = Heightfield.fromPng(GLAZE, buf(GLAZE.heightmap), GLAZE.splatmaps.map(buf));
    const col = new CollisionWorld();
    new GrayboxProps(hf, col, JSON.parse(readFileSync(join(dir, 'islands/glaze/props.json'), 'utf8')) as PropsFile);
    const pts = STORY_PICKUPS.filter((p) => p.island === 'glaze' && p.model === 'sparkle' && p.id !== 'diver-compass');
    expect(pts.length).toBe(10);
    for (const p of pts) {
      expect(hf.waterAt(p.position[0], p.position[1])?.depth ?? 0, p.id).toBeLessThanOrEqual(0);
      expect(col.query(p.position[0], p.position[1], 1.0).length, p.id).toBe(0);
    }
  });
});

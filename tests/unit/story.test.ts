/**
 * M1-13 / M1-14 · 剧情脚本与任务数据校验：
 * - 主线 1–5 + 支线 4 条的每个目标 completeFlag 都有来源（触发器 / 计数 / NPC 对话 setFlags / 剧情脚本）；
 * - 支线 startFlag 由 startNpc 的对话置位；
 * - 脚本 / 拾取物 / 触发器 / NPC story 引用都存在；道具存在；
 * - 拾取物放在正确的位置（药草在湖畔陆地、钓具箱漂在海上、脚印在幻影之森、控制箱不被灯塔挡住）；
 * - 纯逻辑：pickupVisible / triggerDue / selectDialog 的 requires / unless。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPROUT } from '@/config/islands/sprout';
import type { PropsFile } from '@/config/islands/types';
import { Heightfield } from '@/world/terrain/Heightfield';
import { CollisionWorld } from '@/world/collision/CollisionWorld';
import { GrayboxProps } from '@/world/props/GrayboxProps';
import { pointInPolygon } from '@/world/island/ZoneMap';
import { ALL_NPCS } from '@/config/npcs';
import { SPROUT_QUESTS } from '@/config/quests/sprout';
import { QUEST_REGISTRY } from '@/config/quests';
import { STORY_PICKUPS, STORY_SCRIPTS, STORY_TRIGGERS, STARTERS, STARTER_CARDS, HERB_SPOTS } from '@/config/story';
import { SPROUT_FURNITURE } from '@/config/interactions/sprout';
import { FISHING_TABLES } from '@/config/fishing';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { dex } from '@/config/data';
import { flagsWritten, itemsGiven, pickupVisible, triggerDue, type StoryPickup, type StoryTrigger } from '@/systems/story';
import { questStatus, selectDialog, currentObjective, trackedMarker } from '@/systems/quests';

const dir = join(__dirname, '../../assets');
const buf = (p: string) => {
  const b = readFileSync(join(dir, p));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const hf = Heightfield.fromPng(SPROUT, buf(SPROUT.heightmap), SPROUT.splatmaps.map(buf));
const collision = new CollisionWorld();
new GrayboxProps(hf, collision, JSON.parse(readFileSync(join(dir, 'islands/sprout/props.json'), 'utf8')) as PropsFile);
const zone = (id: string) => SPROUT.zones.find((z) => z.id === id)!;

const allSteps = [...STORY_SCRIPTS.values()].flatMap((s) => s.steps);
const storyFlags = flagsWritten(allSteps);
const dialogFlags = new Set(ALL_NPCS.flatMap((n) => (n.dialogByQuest ?? []).flatMap((d) => d.setFlags ?? [])));
const QUEST_IDS = ['main-dream-prelude', 'main-get-starter', 'main-gym-verdant', 'main-harbor-ferry', 'main-cross-sea-1', 'side-zorua-forest', 'side-fisherman-lost', 'side-elder-herbs', 'side-breeder-road-1', 'side-breeder-road-2', 'side-breeder-road-3', 'side-fishing-contest', 'side-dex-first-page', 'side-trainer-road', 'side-travel-prep', 'side-lake-light', 'side-forest-whisper', 'side-partner-growth'];

describe('蒲婆婆的药草标记', () => {
  it('采集目标的标记依次指向还没采的药草，且与药草位置一致', () => {
    const q = SPROUT_QUESTS.find((x) => x.id === 'side-elder-herbs')!;
    const pts = q.objectives[0]!.marker!.points!;
    expect(pts.map((p) => [p.position[0], p.position[2]]).sort()).toEqual([...HERB_SPOTS].map((p) => [...p]).sort());
    const flags: Record<string, boolean> = { 'starter-chosen': true, 'herbs-quest-start': true };
    expect(trackedMarker(q, flags)?.position).toEqual([74, 0, 96]);
    flags['herb-3-picked'] = true;
    expect(trackedMarker(q, flags)?.position).toEqual([263, 0, -38]);
  });
});

describe('M1-13/14 任务 flag 来源', () => {
  it('18 个任务都在，原 9 个 ID 与奖励不变', () => {
    expect(SPROUT_QUESTS.map((q) => q.id)).toEqual(QUEST_IDS);
    const byId = new Map(SPROUT_QUESTS.map((q) => [q.id, q]));
    expect(byId.get('main-harbor-ferry')!.reward).toEqual({ items: [{ id: 'ferry-pass', qty: 1 }] });
    expect(byId.get('side-zorua-forest')!.reward).toEqual({ pokemon: 570, pokemonLevel: 12 });
    expect(byId.get('side-fisherman-lost')!.reward).toEqual({ items: [{ id: 'good-rod', qty: 1 }] });
    expect(byId.get('side-elder-herbs')!.reward).toEqual({ items: [{ id: 'antidote', qty: 5 }] });
    expect(byId.get('side-fishing-contest')!.reward).toEqual({ items: [{ id: 'super-rod', qty: 1 }], money: 2000 });
    // M1 只有萌芽群岛：所有标记都在 sprout
    for (const q of SPROUT_QUESTS) for (const o of q.objectives) if (o.marker) expect(o.marker.island, `${q.id}/${o.id}`).toBe('sprout');
  });

  it('每个目标的 completeFlag 都有来源', () => {
    const missing: string[] = [];
    for (const q of SPROUT_QUESTS) {
      for (const o of q.objectives) {
        const ok = !!o.trigger || !!o.counter || dialogFlags.has(o.completeFlag) || storyFlags.has(o.completeFlag) || o.completeFlag === 'badge-verdant' || /^breeder-lv\d+$/.test(o.completeFlag); // 培育家等级 flag 由 gainBreederXp 置位
        if (!ok) missing.push(`${q.id}/${o.id}:${o.completeFlag}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('支线 startFlag 由 startNpc 的「available」对话置位', () => {
    for (const q of SPROUT_QUESTS.filter((x) => x.category === 'side')) {
      const npc = ALL_NPCS.find((n) => n.id === q.startNpc)!;
      expect(npc, q.id).toBeTruthy();
      const d = npc.dialogByQuest!.find((x) => x.questId === q.id && x.when === 'available');
      expect(d?.setFlags, q.id).toContain(q.startFlag);
    }
  });

  it('引用完整：NPC story / 拾取物 / 触发器 / 家具效果的脚本都存在，道具都存在', () => {
    const refs = [
      ...ALL_NPCS.flatMap((n) => (n.dialogByQuest ?? []).map((d) => d.story).filter((x): x is string => !!x)),
      ...STORY_PICKUPS.map((p) => p.script),
      ...STORY_TRIGGERS.map((t) => t.script),
      ...SPROUT_FURNITURE.flatMap((f) => (f.effects ?? []).flatMap((e) => (e.kind === 'story' ? [e.script] : []))),
    ];
    for (const r of refs) expect(STORY_SCRIPTS.has(r), r).toBe(true);
    for (const id of itemsGiven(allSteps)) expect(!!dex.item(id) || KEY_ITEM_BY_ID.has(id), id).toBe(true);
    for (const q of SPROUT_QUESTS) for (const it of q.reward?.items ?? []) expect(!!dex.item(it.id) || KEY_ITEM_BY_ID.has(it.id), it.id).toBe(true);
    expect(STARTER_CARDS.map((c) => c.species)).toEqual([...STARTERS]);
    for (const s of STARTERS) expect(dex.species(s)).toBeTruthy();
  });

  it('钓鱼大赛的 3 种宝可梦都能用好钓竿在海里钓到（海星星限夜间）', () => {
    const sea = FISHING_TABLES.find((t) => t.water === 'sea')!;
    const good = sea.rods['good-rod']!;
    for (const sp of [129, 72, 120]) expect(good.some((e) => e.speciesId === sp), `sp ${sp}`).toBe(true);
    expect(good.find((e) => e.speciesId === 120)!.time).toBe('night');
    // 大赛需要先完成港湾失物（奖励好钓竿）
    expect(SPROUT_QUESTS.find((q) => q.id === 'side-fishing-contest')!.prerequisites).toContain('fisher-tackle-returned');
  });
});

describe('M1-13/14 剧情拾取物摆放', () => {
  const byModel = (m: StoryPickup['model']) => STORY_PICKUPS.filter((p) => p.model === m);

  it('3 株药草在翠澜湖畔的陆地上，互相分散', () => {
    expect(HERB_SPOTS).toHaveLength(3);
    const lake = SPROUT.waterBodies![0]!;
    for (const [x, z] of HERB_SPOTS) {
      expect(pointInPolygon(x, z, zone('cuilan-lakeside').polygon), `${x},${z}`).toBe(true);
      const e = ((x - lake.center[0]) / lake.radius[0]) ** 2 + ((z - lake.center[1]) / lake.radius[1]) ** 2;
      expect(e, `herb ${x},${z} 在湖里`).toBeGreaterThan(1.02);
      expect(hf.waterAt(x, z)?.depth ?? 0, `herb ${x},${z} 水深`).toBeLessThanOrEqual(0);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(HERB_SPOTS[i]![0] - HERB_SPOTS[j]![0], HERB_SPOTS[i]![1] - HERB_SPOTS[j]![1])).toBeGreaterThan(60);
    expect(byModel('herb')).toHaveLength(3);
  });

  it('钓具箱漂在港湾外海（水面上、需要水上骑乘）', () => {
    const [box] = byModel('tackle-box');
    const [x, z] = box!.position;
    expect(box!.floating).toBe(true);
    expect(hf.waterAt(x, z)?.depth ?? 0).toBeGreaterThan(1);
    expect(hf.waterAt(x, z)?.body).toBe('sea');
  });

  it('脚印在幻影之森里，最后一个指向雾中空地', () => {
    const fp = byModel('footprints');
    expect(fp.length).toBeGreaterThanOrEqual(5);
    for (const p of fp) {
      expect(pointInPolygon(p.position[0], p.position[1], zone('phantom-forest').polygon), p.id).toBe(true);
      expect(hf.waterAt(p.position[0], p.position[1])?.depth ?? 0).toBeLessThanOrEqual(0);
    }
    const last = fp[fp.length - 1]!;
    const toClearing = Math.atan2(-320 - last.position[0], -330 - last.position[1]);
    expect(Math.abs(last.yaw! - toClearing)).toBeLessThan(0.01);
    // 伪装的索罗亚站在空地上（陆地）
    const zorua = ALL_NPCS.find((n) => n.id === 'zorua-disguise')!;
    expect(zorua.showIf).toEqual(['zorua-quest-start']);
    expect(zorua.hideIf).toEqual(['zorua-quest-done']);
    expect(hf.waterAt(-320, -330)?.depth ?? 0).toBeLessThanOrEqual(0);
  });

  it('灯塔控制箱在陆地上、可以站到旁边互动', () => {
    const [lamp] = byModel('lamp');
    const [x, z] = lamp!.position;
    expect(hf.waterAt(x, z)?.depth ?? 0).toBeLessThanOrEqual(0);
    const tower = collision.query(x, z, 6).find((c) => c.tag === 'lighthouse');
    expect(tower && tower.kind === 'circle' && Math.hypot(x - tower.x, z - tower.z) > tower.r + 0.4).toBe(true);
    // 半径 range 内至少有一个不被挡住的站立点
    let reachable = false;
    for (let a = 0; a < 16 && !reachable; a++) {
      const px = x + Math.sin((a / 16) * Math.PI * 2) * (lamp!.range! - 0.4);
      const pz = z + Math.cos((a / 16) * Math.PI * 2) * (lamp!.range! - 0.4);
      const y = Math.max(hf.heightAt(px, pz), collision.walkableTopAt(px, pz, hf.heightAt(px, pz) + 1.5));
      const hit = collision.query(px, pz, 0.85).some((c) => {
        if ((c.kind === 'box' && c.walkableTop) || c.y1 < y + 0.3 || c.y0 > y + 1.6) return false;
        if (c.kind === 'circle') return Math.hypot(px - c.x, pz - c.z) < c.r + 0.35;
        const sn = Math.sin(-c.yaw);
        const cs = Math.cos(-c.yaw);
        const lx = (px - c.x) * cs - (pz - c.z) * sn;
        const lz = (px - c.x) * sn + (pz - c.z) * cs;
        return Math.abs(lx) < c.hx + 0.35 && Math.abs(lz) < c.hz + 0.35;
      });
      if (!hit && (hf.waterAt(px, pz)?.depth ?? 0) <= 0) reachable = true;
    }
    expect(reachable).toBe(true);
  });
});

describe('M1-13 纯逻辑', () => {
  const p: StoryPickup = { id: 'x', island: 'sprout', position: [0, 0], model: 'herb', label: '', script: 's', showIf: ['a'], hideIf: ['b', 'c'] };
  it('pickupVisible：showIf 全真、hideIf 全假', () => {
    expect(pickupVisible(p, {})).toBe(false);
    expect(pickupVisible(p, { a: true })).toBe(true);
    expect(pickupVisible(p, { a: true, c: true })).toBe(false);
  });

  it('triggerDue：圆形 / 矩形 / 离开区域 / doneFlag', () => {
    const circle: StoryTrigger = { id: 'c', island: 'sprout', position: [10, 10], radius: 5, script: 's', doneFlag: 'done' };
    expect(triggerDue(circle, {}, 'sprout', 12, 12)).toBe(true);
    expect(triggerDue(circle, {}, 'sprout', 20, 20)).toBe(false);
    expect(triggerDue(circle, { done: true }, 'sprout', 12, 12)).toBe(false);
    expect(triggerDue(circle, {}, 'tide', 12, 12)).toBe(false);
    const end = STORY_TRIGGERS.find((t) => t.id === 'cross-sea-end')!;
    const f = { 'sea-route-1-entered': true, 'ferry-route-opened': true };
    expect(triggerDue(end, f, 'sprout', 505, 100)).toBe(true);
    expect(triggerDue(end, f, 'sprout', 470, 100)).toBe(false);
    expect(triggerDue(end, { 'sea-route-1-entered': true }, 'sprout', 505, 100)).toBe(false);
    // 水路 1 东端矩形完全在水路 1 区域内
    const [x0, z0, x1, z1] = end.rect!;
    const xs = zone('sea-route-1').polygon.map((q) => q[0]);
    const zs = zone('sea-route-1').polygon.map((q) => q[1]);
    expect(Math.min(x0, x1)).toBeGreaterThanOrEqual(Math.min(...xs));
    expect(Math.max(x0, x1)).toBeLessThanOrEqual(Math.max(...xs));
    expect(Math.min(z0, z1)).toBeGreaterThanOrEqual(Math.min(...zs));
    expect(Math.max(z0, z1)).toBeLessThanOrEqual(Math.max(...zs));
    const back = STORY_TRIGGERS.find((t) => t.id === 'no-starter-turnback')!;
    const f2 = { 'dream-prelude-done': true };
    expect(triggerDue(back, f2, 'sprout', 0, 0, 'sprout-town')).toBe(false);
    expect(triggerDue(back, f2, 'sprout', 0, 0, 'sprout-meadow')).toBe(true);
    expect(triggerDue(back, f2, 'sprout', 0, 0, null)).toBe(true);
    expect(triggerDue(back, { ...f2, 'starter-chosen': true }, 'sprout', 0, 0, 'sprout-meadow')).toBe(false);
    expect(triggerDue(back, { ...f2, 'm0.prototype-starter': true }, 'sprout', 0, 0, 'sprout-meadow')).toBe(false);
    expect(back.repeat).toBe(true);
  });

  it('selectDialog：同一任务按 requires / unless 分阶段', () => {
    const clerk = ALL_NPCS.find((n) => n.id === 'ferry-clerk')!;
    const base = { 'game-started': true, 'dream-prelude-done': true, 'lab-visited': true, 'starter-chosen': true, 'arrived-cuilan-town': true, 'badge-verdant': true, 'hm03-surf': true, 'arrived-harbor-city': true };
    const ferry = QUEST_REGISTRY.get('main-harbor-ferry')!;
    expect(questStatus(ferry, base)).toBe('active');
    const d0 = clerk.dialogByQuest!.find((d) => d.dialog === selectDialog(clerk, QUEST_REGISTRY, base, false))!;
    expect(d0.setFlags).toEqual(['ferry-clerk-talked']);
    const d1 = selectDialog(clerk, QUEST_REGISTRY, { ...base, 'ferry-clerk-talked': true }, false);
    expect(clerk.dialogByQuest!.find((d) => d.dialog === d1)!.setFlags).toBeUndefined();
    const f2 = { ...base, 'ferry-clerk-talked': true, 'lighthouse-keeper-asked': true, 'lighthouse-relit': true };
    const d2 = clerk.dialogByQuest!.find((d) => d.dialog === selectDialog(clerk, QUEST_REGISTRY, f2, false))!;
    expect(d2.setFlags).toEqual(['ferry-route-opened']);
    expect(currentObjective(ferry, f2)?.id).toBe('report-ferry');
  });

  it('主线脚本：开场梦境置位 dream-prelude-done；御三家脚本置位 starter-chosen；跨海结尾置位 cross-sea-1-done', () => {
    expect(flagsWritten(STORY_SCRIPTS.get('dream-prelude')!.steps).has('dream-prelude-done')).toBe(true);
    expect(flagsWritten(STORY_SCRIPTS.get('starter-choice')!.steps).has('starter-chosen')).toBe(true);
    expect(flagsWritten(STORY_SCRIPTS.get('cross-sea-end')!.steps).has('cross-sea-1-done')).toBe(true);
    expect(flagsWritten(STORY_SCRIPTS.get('lighthouse-relight')!.steps).has('lighthouse-relit')).toBe(true);
    const z = STORY_SCRIPTS.get('zorua-reveal')!.steps.find((s) => s.kind === 'battle');
    expect(z && z.kind === 'battle' && z.noCapture && z.noRun && z.species === 570).toBe(true);
  });
});

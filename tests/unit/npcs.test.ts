/**
 * M1-06 · NPC 系统：配置自检（与室内固定位 / 任务交叉校验）、日程、显示条件、对话目标选择、对话优先级与 setFlags。
 */
import { describe, expect, it } from 'vitest';
import { ALL_NPCS, NPC_BY_ID } from '@/config/npcs';
import { ALL_QUESTS, QUEST_REGISTRY } from '@/config/quests';
import { INTERIORS } from '@/config/interiors';
import { ISLANDS } from '@/config/islands';
import { activeEntry, hourInRange, isNpcShown, pickInFront, placementsFor, validateNpcs, yawTo, type NpcDef } from '@/systems/npcs';
import { selectDialog } from '@/systems/quests';

function ctx() {
  const spots: { interior: string; room: string; id: string }[] = [];
  const rooms = new Set<string>();
  for (const i of Object.values(INTERIORS))
    for (const r of i.rooms) {
      rooms.add(`${i.id}#${r.id}`);
      for (const s of r.npcs ?? []) spots.push({ interior: i.id, room: r.id, id: s.id });
    }
  return {
    spots,
    rooms,
    islands: new Set(Object.keys(ISLANDS)),
    questIds: new Set(ALL_QUESTS.map((q) => q.id)),
    questStarts: ALL_QUESTS.filter((q) => q.startNpc).map((q) => ({ questId: q.id, npc: q.startNpc!, ...(q.startFlag ? { startFlag: q.startFlag } : {}) })),
  };
}

describe('M1-06 NPC 配置', () => {
  it('萌芽群岛 NPC ≥ 30 且通过交叉校验', () => {
    expect(ALL_NPCS.length).toBeGreaterThanOrEqual(30);
    expect(validateNpcs(ALL_NPCS, ctx())).toEqual([]);
  });

  it('每个室内固定位都有 NPC 定义，每个任务发布者都存在', () => {
    const c = ctx();
    for (const s of c.spots) expect(NPC_BY_ID.has(s.id), s.id).toBe(true);
    for (const q of c.questStarts) expect(NPC_BY_ID.has(q.npc), q.npc).toBe(true);
  });

  it('全天任意时刻，任何 NPC 最多出现在一个地点', () => {
    const c = ctx();
    const places = [
      ...Object.keys(ISLANDS).map((island) => ({ kind: 'island' as const, island })),
      ...[...c.rooms].map((r) => {
        const [interior, room] = r.split('#') as [string, string];
        return { kind: 'interior' as const, interior, room };
      }),
    ];
    const spotsOf = (p: (typeof places)[number]) =>
      p.kind === 'interior' ? (INTERIORS[p.interior]!.rooms.find((r) => r.id === p.room)!.npcs ?? []) : [];
    for (let h = 0; h < 24; h += 0.5) {
      const seen = new Map<string, number>();
      for (const p of places) for (const pl of placementsFor(ALL_NPCS, p, h, {}, spotsOf(p))) seen.set(pl.def.id, (seen.get(pl.def.id) ?? 0) + 1);
      for (const [id, n] of seen) expect(n, `${id} @${h}`).toBe(1);
    }
  });

  it('日程外的 NPC 仍然存在（夜间回家），至少 25 个白天在岛上或室内', () => {
    const noon = new Set<string>();
    for (const island of Object.keys(ISLANDS)) for (const p of placementsFor(ALL_NPCS, { kind: 'island', island }, 12, {})) noon.add(p.def.id);
    for (const i of Object.values(INTERIORS)) for (const r of i.rooms) for (const p of placementsFor(ALL_NPCS, { kind: 'interior', interior: i.id, room: r.id }, 12, {}, r.npcs ?? [])) noon.add(p.def.id);
    expect(noon.size).toBeGreaterThanOrEqual(25);
  });
});

describe('M1-06 日程与显示', () => {
  const base: NpcDef = { id: 't', name: '测试', appearance: { look: 'villager-m' }, dialog: ['你好'] };

  it('hourInRange 支持跨午夜', () => {
    expect(hourInRange(23, 22, 6)).toBe(true);
    expect(hourInRange(3, 22, 6)).toBe(true);
    expect(hourInRange(12, 22, 6)).toBe(false);
    expect(hourInRange(8, 7, 11)).toBe(true);
    expect(hourInRange(11, 7, 11)).toBe(false);
  });

  it('showIf / hideIf', () => {
    const d: NpcDef = { ...base, showIf: ['a'], hideIf: ['b'] };
    expect(isNpcShown(d, {})).toBe(false);
    expect(isNpcShown(d, { a: true })).toBe(true);
    expect(isNpcShown(d, { a: true, b: true })).toBe(false);
  });

  it('activeEntry 按小时选日程；placementsFor 生成岛上坐标与活动', () => {
    const d: NpcDef = {
      ...base,
      schedule: [
        { from: 7, to: 11, at: { island: 'sprout', position: [1, 2], yaw: 0.5 }, activity: { kind: 'wander', radius: 3 } },
        { from: 11, to: 7, at: { interior: 'x', room: 'r', position: [4, 5], yaw: 1 } },
      ],
    };
    expect(activeEntry(d, 8)?.from).toBe(7);
    expect(activeEntry(d, 20)?.from).toBe(11);
    const [p] = placementsFor([d], { kind: 'island', island: 'sprout' }, 9, {});
    expect(p?.position).toEqual([1, 2]);
    expect(p?.yaw).toBe(0.5);
    expect(p?.activity).toEqual({ kind: 'wander', radius: 3 });
    expect(placementsFor([d], { kind: 'island', island: 'sprout' }, 12, {})).toEqual([]);
    const inside = placementsFor([d], { kind: 'interior', interior: 'x', room: 'r' }, 12, {});
    expect(inside[0]?.position).toEqual([4, 5]);
    expect(inside[0]?.key).not.toBe(p?.key);
  });

  it('蒲婆婆：早上在镇上，其余时间在家', () => {
    const elder = NPC_BY_ID.get('elder-pu')!;
    expect(activeEntry(elder, 8)?.at).toHaveProperty('island');
    expect(activeEntry(elder, 15)?.at).toHaveProperty('interior');
  });
});

describe('M1-06 对话目标', () => {
  const items = [
    { key: 'front', x: 0, z: 1.5 },
    { key: 'back', x: 0, z: -1 },
    { key: 'side', x: 1.8, z: 0.2 },
    { key: 'far', x: 0, z: 3 },
  ];
  it('只选前方 60° 扇形、2 m 内最近的', () => {
    expect(pickInFront(0, 0, 0, items)?.key).toBe('front');
    expect(pickInFront(0, 0, Math.PI, items)?.key).toBe('back');
    expect(pickInFront(0, 0, Math.PI / 2, items)?.key).toBe('side');
    expect(pickInFront(0, 0, -Math.PI / 2, items)).toBeNull();
  });
  it('贴身（< 0.9 m）时忽略朝向', () => {
    expect(pickInFront(0, 0, 0, [{ key: 'close', x: 0, z: -0.6 }])?.key).toBe('close');
  });
  it('yawTo', () => {
    expect(yawTo(0, 0, 0, 1)).toBeCloseTo(0);
    expect(yawTo(0, 0, 1, 0)).toBeCloseTo(Math.PI / 2);
  });
});

describe('M1-06 对话优先级与接任务', () => {
  it('接任务 NPC：available 对话带 setFlags=startFlag，置位后切换为 active 对话', () => {
    const q = ALL_QUESTS.find((x) => x.startNpc && x.startFlag)!;
    const npc = NPC_BY_ID.get(q.startNpc!)!;
    const flags: Record<string, boolean> = {};
    for (const p of q.prerequisites) flags[p] = true;
    const first = selectDialog(npc, QUEST_REGISTRY, flags, false);
    const entry = npc.dialogByQuest!.find((d) => d.dialog === first);
    expect(entry?.when).toBe('available');
    expect(entry?.setFlags).toContain(q.startFlag);
    flags[q.startFlag!] = true;
    const second = selectDialog(npc, QUEST_REGISTRY, flags, false);
    expect(second).not.toBe(first);
  });
});

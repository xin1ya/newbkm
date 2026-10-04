/**
 * M1-07 · 互动提示：扇形挑选、优先级、水边探测、家具边缘点、按 flag / 昼夜选文字、配置交叉校验。
 */
import { describe, expect, it } from 'vitest';
import {
  BLOCKER_ABILITY,
  KIND_LABEL,
  closestOnRect,
  flagCond,
  keyLabel,
  pickInteraction,
  probeWaterAhead,
  resolvePages,
  type InteractCandidate,
  type InteractionDef,
} from '@/systems/interaction';
import { ALL_INTERACTIONS, INTERACTION_BY_ID } from '@/config/interactions';
import { INTERIORS } from '@/config/interiors';
import { SPROUT } from '@/config/islands/sprout';
import { ISLANDS } from '@/config/islands';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { dex } from '@/config/data';
import { blockerEdge } from '@/scenes/common/interactSources';

const c = (id: string, kind: InteractCandidate['kind'], x: number, z: number, extra: Partial<InteractCandidate> = {}): InteractCandidate => ({
  id,
  kind,
  x,
  z,
  y: 1,
  label: KIND_LABEL[kind],
  action: 'interact',
  ...extra,
});

describe('M1-07 pickInteraction', () => {
  it('只选前方 60° 扇形、各自半径内的目标', () => {
    const list = [c('front', 'examine', 0, 1.5), c('back', 'examine', 0, -1.5), c('far', 'examine', 0, 2.5)];
    expect(pickInteraction(0, 0, 0, list)?.id).toBe('front');
    expect(pickInteraction(0, 0, Math.PI, list)?.id).toBe('back');
    expect(pickInteraction(0, 0, Math.PI / 2, list)).toBeNull();
    expect(pickInteraction(0, 0, 0, [c('far', 'examine', 0, 2.5, { range: 3 })])?.id).toBe('far');
  });

  it('扇形边界：55° 可选、65° 不可选', () => {
    const at = (deg: number) => c(`a${deg}`, 'examine', Math.sin((deg * Math.PI) / 180) * 1.5, Math.cos((deg * Math.PI) / 180) * 1.5);
    expect(pickInteraction(0, 0, 0, [at(55)])).not.toBeNull();
    expect(pickInteraction(0, 0, 0, [at(65)])).toBeNull();
  });

  it('贴身 0.9 m 内不看朝向', () => {
    expect(pickInteraction(0, 0, 0, [c('close', 'examine', 0, -0.7)])?.id).toBe('close');
  });

  it('距离相近时 NPC 优先于家具、门优先于告示', () => {
    expect(pickInteraction(0, 0, 0, [c('shelf', 'examine', 0.1, 1.2), c('npc', 'talk', -0.1, 1.35)])?.id).toBe('npc');
    expect(pickInteraction(0, 0, 0, [c('sign', 'examine', 0, 1.4), c('door', 'enter', 0.2, 1.5)])?.id).toBe('door');
  });

  it('隔柜台对话：NPC 在家具正后方时与 NPC 对话；NPC 在别的方向时仍查看家具', () => {
    const table = c('table', 'examine', 0, 0.4);
    expect(pickInteraction(0, 0, 0, [table, c('prof', 'talk', 0, 2.1, { range: 2.8 })])?.id).toBe('prof');
    expect(pickInteraction(0, 0, 0, [table, c('prof', 'talk', 1.5, 1.2, { range: 2.8 })])?.id).toBe('table');
  });

  it('明显更近的家具仍然胜过远处 NPC', () => {
    expect(pickInteraction(0, 0, 0, [c('shelf', 'examine', 0, 0.6), c('npc', 'talk', 1.2, 1.5)])?.id).toBe('shelf');
  });
});

describe('M1-07 水边 / 家具 / 封锁点几何', () => {
  // x > 3 是深水
  const depth = (x: number) => (x > 3 ? 1.2 : 0);
  it('probeWaterAhead：面朝水面 2.5 m 内返回第一处水点', () => {
    const hit = probeWaterAhead(1.5, 0, Math.PI / 2, (x) => depth(x));
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeGreaterThan(3);
    expect(hit!.dist).toBeLessThanOrEqual(2.5);
  });
  it('背对水面、离水太远、已在水中时返回 null', () => {
    expect(probeWaterAhead(1.5, 0, -Math.PI / 2, (x) => depth(x))).toBeNull();
    expect(probeWaterAhead(-2, 0, Math.PI / 2, (x) => depth(x))).toBeNull();
    expect(probeWaterAhead(4, 0, Math.PI / 2, (x) => depth(x))).toBeNull();
  });
  it('closestOnRect：未旋转与旋转 90°', () => {
    const r = { x: 0, z: 0, hx: 1, hz: 0.5, yaw: 0 };
    expect(closestOnRect(3, 0, r)).toEqual({ x: 1, z: 0 });
    expect(closestOnRect(0, 3, r)).toEqual({ x: 0, z: 0.5 });
    const q = closestOnRect(3, 0, { ...r, yaw: Math.PI / 2 });
    expect(q.x).toBeCloseTo(0.5);
    expect(q.z).toBeCloseTo(0);
    expect(closestOnRect(0.2, 0.1, r)).toEqual({ x: 0.2, z: 0.1 });
  });
  it('blockerEdge：封锁圆上离玩家最近的点', () => {
    const e = blockerEdge({ id: 'b', type: 'story', requiresFlag: 'f', position: [0, 0, 0], radius: 3, hint: '' }, 10, 0);
    expect(e.x).toBeCloseTo(3);
    expect(e.z).toBeCloseTo(0);
  });
  it('keyLabel', () => {
    expect(keyLabel('KeyE')).toBe('E');
    expect(keyLabel('Space')).toBe('空格');
    expect(keyLabel('Digit1')).toBe('1');
  });
});

describe('M1-07 文字选择', () => {
  const def: InteractionDef = { id: 'x', kind: 'examine', pages: ['默认'], night: ['夜晚'], byFlag: [{ when: '!a', pages: ['没有 a'] }, { when: 'b', pages: ['有 b'] }] };
  it('flagCond', () => {
    expect(flagCond('a', { a: true })).toBe(true);
    expect(flagCond('!a', { a: true })).toBe(false);
    expect(flagCond('!a', {})).toBe(true);
  });
  it('byFlag 优先，其次夜间，最后默认', () => {
    expect(resolvePages(def, {}, false).pages).toEqual(['没有 a']);
    expect(resolvePages(def, { a: true, b: true }, false).pages).toEqual(['有 b']);
    expect(resolvePages(def, { a: true }, true).pages).toEqual(['夜晚']);
    expect(resolvePages(def, { a: true }, false)).toEqual({ pages: ['默认'], conditional: false });
  });
  it('床铺：拿到御三家前不能睡（条件文字，不执行恢复效果）', () => {
    const bed = INTERACTION_BY_ID.get('bed')!;
    expect(resolvePages(bed, {}, false).conditional).toBe(true);
    expect(resolvePages(bed, { 'starter-chosen': true }, false).conditional).toBe(false);
    expect(bed.effects?.[0]?.kind).toBe('heal-party');
  });
});

describe('M1-07 配置交叉校验', () => {
  const furnitureIds = new Set<string>();
  for (const i of Object.values(INTERIORS)) for (const r of i.rooms) for (const f of r.furniture) if (f.interact) furnitureIds.add(f.interact);
  const poiIds = new Set(Object.values(ISLANDS).flatMap((isl) => isl.pois.map((p) => p.id)));

  it('每个可互动家具都有文字', () => {
    for (const id of furnitureIds) expect(INTERACTION_BY_ID.has(id), id).toBe(true);
  });
  it('每条互动配置都对应真实的家具或 POI，且 id 不重复', () => {
    expect(new Set(ALL_INTERACTIONS.map((d) => d.id)).size).toBe(ALL_INTERACTIONS.length);
    for (const d of ALL_INTERACTIONS) expect(furnitureIds.has(d.id) || poiIds.has(d.id), d.id).toBe(true);
  });
  it('文字不为空；拾取道具存在于道具表；渡船码头有配置', () => {
    for (const d of ALL_INTERACTIONS) {
      expect(d.pages.length, d.id).toBeGreaterThan(0);
      for (const b of d.byFlag ?? []) expect(b.pages.length, d.id).toBeGreaterThan(0);
      for (const e of d.effects ?? []) if (e.kind === 'give-item') expect(!!dex.item(e.item) || KEY_ITEM_BY_ID.has(e.item), e.item).toBe(true);
    }
    expect(INTERACTION_BY_ID.get('harbor-ferry')?.kind).toBe('ferry');
  });
  it('每种封锁点都有能力名', () => {
    for (const b of SPROUT.blockers) expect(BLOCKER_ABILITY[b.type], b.type).toBeTruthy();
  });
});

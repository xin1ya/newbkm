/**
 * M1-07 · 互动候选来源（大地图 / 室内共用的部分）。
 */
import { closestOnRect, probeWaterAhead, KIND_LABEL, BLOCKER_ABILITY, type InteractionDef } from '@/systems/interaction';
import { INTERACTION_BY_ID } from '@/config/interactions';
import type { BlockerConfig, IslandConfig } from '@/config/islands';
import type { SceneNpcs } from './SceneNpcs';
import type { InteractSource, SceneInteractions } from './SceneInteractions';

const ROD_ITEMS = ['super-rod', 'good-rod', 'old-rod'];

/** NPC：对话 */
export function npcSource(npcs: SceneNpcs): InteractSource {
  return (player, out) => {
    for (const n of npcs.manager.npcs.values()) {
      if (n.talking) continue;
      const head = n.headPosition();
      out.push({
        id: `npc:${n.def.id}`,
        kind: 'talk',
        x: n.position.x,
        z: n.position.z,
        y: head.y + 0.45,
        label: KIND_LABEL.talk,
        action: 'interact',
        range: npcs.talkRange,
        run: () => npcs.talk(n, player),
      });
    }
  };
}

/** 室内家具：按占地矩形最近边缘点检测，气泡在家具中心上方 */
export function furnitureSource(
  host: SceneInteractions,
  footprints: () => ReadonlyMap<string, { x: number; z: number; hx: number; hz: number; yaw: number; h: number }>,
): InteractSource {
  return (player, out) => {
    const p = player.position;
    for (const [id, fp] of footprints()) {
      const def = INTERACTION_BY_ID.get(id);
      if (!def) continue;
      const c = closestOnRect(p.x, p.z, fp);
      out.push({
        id: `furniture:${id}`,
        kind: def.kind,
        x: c.x,
        z: c.z,
        y: fp.h + 0.5,
        anchor: { x: fp.x, y: fp.h + 0.55, z: fp.z },
        label: def.label ?? KIND_LABEL[def.kind],
        action: 'interact',
        range: def.range ?? 1.25,
        run: () => host.runDef(def),
      });
    }
  };
}

export interface OverworldSourceDeps {
  island: IslandConfig;
  ground: { heightAt(x: number, z: number): number; hf: { waterAt(x: number, z: number): { level: number } | null } };
  flag(f: string): boolean;
  bag(): Readonly<Record<string, number>>;
  doorOf(poi: IslandConfig['pois'][number]): { position: { x: number; y: number; z: number }; yaw: number } | null;
  enter(interior: string, poiId: string): Promise<void>;
  say(pages: string[]): Promise<void>;
  toast(text: string): void;
  /** M1-15 开始钓鱼 */
  fish(): Promise<void>;
  /** M1-12 上水（hit = 面前的水面点） */
  surf(hit: { x: number; z: number; level: number }): Promise<void>;
  /** 正在水上骑乘（此时只提供钓鱼） */
  surfing(): boolean;
}

/** 大地图：门、地标（告示 / 渡船）、封锁点、水边（钓鱼 / 水上骑乘） */
export function overworldSources(host: SceneInteractions, d: OverworldSourceDeps): InteractSource[] {
  const doors: InteractSource = (_player, out) => {
    for (const poi of d.island.pois) {
      if (!poi.interior) continue;
      const door = d.doorOf(poi);
      if (!door) continue;
      out.push({
        id: `door:${poi.id}`,
        kind: 'enter',
        x: door.position.x,
        z: door.position.z,
        y: door.position.y + 2.6,
        label: `${KIND_LABEL.enter} ${poi.name}`,
        action: 'interact',
        range: 1.8,
        run: () => d.enter(poi.interior!, poi.id),
      });
    }
  };
  const landmarks: InteractSource = (_player, out) => {
    for (const poi of d.island.pois) {
      const def: InteractionDef | undefined = INTERACTION_BY_ID.get(poi.id);
      if (!def || poi.interior) continue;
      const [x, , z] = poi.position;
      out.push({
        id: `poi:${poi.id}`,
        kind: def.kind,
        x,
        z,
        y: d.ground.heightAt(x, z) + 2.2,
        label: def.kind === 'ferry' ? KIND_LABEL.ferry : `${def.label ?? KIND_LABEL[def.kind]}`,
        action: 'interact',
        range: def.range ?? 2.5,
        run: () => host.runDef(def),
      });
    }
  };
  const blockers: InteractSource = (player, out) => {
    const p = player.position;
    for (const b of d.island.blockers) {
      if (d.flag(b.requiresFlag)) continue;
      const edge = blockerEdge(b, p.x, p.z);
      out.push({
        id: `blocker:${b.id}`,
        kind: 'blocked',
        x: edge.x,
        z: edge.z,
        y: d.ground.heightAt(edge.x, edge.z) + 1.8,
        label: b.type === 'story' ? '暂时无法通过' : '无法通过',
        action: null,
        range: 2.2,
        // 剧情封锁只显示说明，不显示“需要某能力”
        ability: b.type === 'story' ? undefined : (BLOCKER_ABILITY[b.type] ?? b.type),
        hint: b.hint,
      });
    }
  };
  const water: InteractSource = (player, out) => {
    const rod = ROD_ITEMS.find((r) => (d.bag()[r] ?? 0) > 0);
    const surf = d.flag('hm03-surf') && !d.surfing();
    if (!rod && !surf) return;
    const p = player.position;
    const depthAt = (x: number, z: number) => {
      const w = d.ground.hf.waterAt(x, z);
      return w ? w.level - d.ground.heightAt(x, z) : 0;
    };
    // 钓鱼：能抛竿的水面即可（3.5 m 内、水深 ≥ 0.35 m）；水上骑乘：前方 2.5 m 内要有足够深的水（≥ 0.6 m）
    const fishHit = rod ? probeWaterAhead(p.x, p.z, player.facing, depthAt, 3.5, 0.35) : null;
    const surfHit = surf ? probeWaterAhead(p.x, p.z, player.facing, depthAt, 2.5, 0.6) : null;
    const hit = fishHit ?? surfHit;
    if (!hit) return;
    const level = d.ground.hf.waterAt(hit.x, hit.z)?.level ?? p.y;
    const fish = () => d.fish();
    const ride = () => {
      const at = surfHit ?? hit;
      return d.surf({ x: at.x, z: at.z, level: d.ground.hf.waterAt(at.x, at.z)?.level ?? level });
    };
    const base = { id: 'water', x: hit.x, z: hit.z, y: level + 0.9, range: 3.6, companion: true };
    if (fishHit && surfHit) out.push({ ...base, kind: 'fish', label: KIND_LABEL.fish, action: 'sendOut', run: fish, secondary: { action: 'ride', label: KIND_LABEL.surf, kind: 'surf', run: ride } });
    else if (fishHit) out.push({ ...base, kind: 'fish', label: KIND_LABEL.fish, action: 'sendOut', run: fish });
    else out.push({ ...base, kind: 'surf', label: KIND_LABEL.surf, action: 'ride', run: ride });
  };
  return [doors, landmarks, blockers, water];
}

/** 封锁圆上离玩家最近的点 */
export function blockerEdge(b: BlockerConfig, px: number, pz: number): { x: number; z: number } {
  const [bx, , bz] = b.position;
  const r = b.radius ?? 2;
  const dx = px - bx;
  const dz = pz - bz;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return { x: bx, z: bz };
  return { x: bx + (dx / d) * r, z: bz + (dz / d) * r };
}

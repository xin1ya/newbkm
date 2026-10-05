/**
 * ACT-002 · 野生宝可梦刷新与管理（可见遇敌，设计 §5.2）。
 * - 在玩家周围 28–75 m 的环带里按区域遇敌表刷新，维持 density 数量（受画质 maxWild 上限约束）
 * - 水面刷新水栖 / surf 条目，岸边刷新 shore 物种，飞行物种悬空
 * - 群体（formation=group）在附近一起刷新
 * - 超过 95 m 或离开有效区域的个体回收
 * - AI 在 fixedUpdate 中推进；接触玩家时派发 encounter:start（带先手判定）
 * - 头目（计划文档 §3）：巢穴头目走独立槽位（不占 maxWild），玩家进入 120 m 内且巢穴可用时刷新；
 *   游荡头目由普通刷新以 0.4% 概率升级而来，同时最多 1 只，30 分钟未遭遇离开
 */
import type { Flavor } from '@/config/berries';
import * as THREE from 'three';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import {
  createWild,
  rollEncounter,
  type EncounterMethod,
  type EncounterTable,
  type FieldWeather,
  type TimeOfDay,
} from '@/systems/encounters';
import type { EventBus } from '@/core/events/EventBus';
import { behaviorOf } from '@/config/encounters/behavior';
import { makeRoaming, ROAMING_LIFETIME_S, TERRITORY, type AlphaDenDef } from '@/systems/alpha';
import type { PokemonInstance } from '@/systems/pokemon';
import type { Terrain } from '../terrain/Terrain';
import type { CollisionWorld } from '../collision/CollisionWorld';
import type { ZoneMap } from '../island/ZoneMap';
import { WildMon, type Habitat } from './WildMon';
import { CONTACT_DIST, contactInitiative, createBrain, stepBrain, type Perception } from './wildAI';

export interface SpawnContext {
  time: TimeOfDay;
  weather: FieldWeather;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerRunning: boolean;
  playerInGrass: boolean;
  /** 战斗 / 对话 / 菜单时为 false */
  active: boolean;
  /** 玩家在空中：照常刷新与游荡，但不触发接触 / 主动开战 */
  playerFlying?: boolean | undefined;
  /** 玩家处在能量方块诱饵范围内时的口味（计划文档 §9.5）：偏好物种权重 ×3、区域目标数 +2 */
  lure?: Flavor | null | undefined;
}

const SPAWN_MIN = 28;
const SPAWN_MAX = 75;
const DESPAWN = 95;
/** 远近细节切换距离（m）：近于 NEAR 恢复描边与投影，远于 FAR 关闭 */
const DETAIL_NEAR = 26;
const DETAIL_FAR = 30;
/** 巢穴头目：进入该距离刷新，超过 DEN_UNLOAD 回收 */
const DEN_LOAD = 120;
const DEN_UNLOAD = 140;
/** 接近巢穴提示距离 */
const DEN_NEAR = 30;

/** 场景层注入的头目钩子（存档 / 时钟 / 提示都在场景层） */
export interface AlphaHooks {
  /** 巢穴当前是否有头目（冷却 + 出现条件） */
  available(den: AlphaDenDef, ctx: SpawnContext): boolean;
  /** 生成巢穴头目个体 */
  make(den: AlphaDenDef): PokemonInstance;
  /** 玩家走到巢穴附近（每帧可能重复调用，由场景层去重） */
  near?(den: AlphaDenDef, present: boolean): void;
  /** 领地头目咆哮警告 */
  roar?(w: WildMon): void;
  /** 游荡头目出现 */
  roaming?(w: WildMon): void;
}

/** 性能 P1 · 野生宝可梦动画 LOD 距离（米），±3 m 滞回 */
export const ANIM_LOD1 = 30;
export const ANIM_LOD2 = 60;
export function animLodFor(cur: 0 | 1 | 2, d: number): 0 | 1 | 2 {
  const h = 3;
  const t1 = cur >= 1 ? ANIM_LOD1 - h : ANIM_LOD1 + h;
  const t2 = cur >= 2 ? ANIM_LOD2 - h : ANIM_LOD2 + h;
  return d > t2 ? 2 : d > t1 ? 1 : 0;
}

export class SpawnManager {
  readonly group = new THREE.Group();
  readonly wild = new Map<number, WildMon>();
  private timer = 0;
  private time = 0;
  maxWild = 12;
  enabled = true;
  /** 统计：累计刷新 / 回收 */
  readonly stats = { spawned: 0, despawned: 0, rejected: 0 };
  /** 头目巢穴（岛屿配置）与钩子；未设置钩子时不刷新巢穴头目 */
  dens: readonly AlphaDenDef[] = [];
  alphaHooks: AlphaHooks | null = null;
  /** denId → 实体 id */
  readonly denMons = new Map<string, number>();
  /** 当前的游荡头目实体 id */
  private roamingId: number | null = null;
  private denTimer = 0;

  /** 普通野生数量（不含巢穴头目） */
  private get commonCount(): number {
    return this.wild.size - this.denMons.size;
  }

  constructor(
    private readonly dex: Dex,
    private readonly tables: Record<string, EncounterTable>,
    private readonly terrain: Terrain,
    private readonly zones: ZoneMap,
    private readonly collision: CollisionWorld,
    private readonly events: EventBus,
    private readonly rng: Rng,
  ) {
    this.group.name = 'wild-pokemon';
  }

  private habitatOf(speciesId: number): Habitat {
    return behaviorOf(speciesId).habitat;
  }

  /** 尝试在随机位置刷新一次；返回是否成功 */
  trySpawn(ctx: SpawnContext): boolean {
    const r = this.rng;
    const ang = r.next() * Math.PI * 2;
    const dist = SPAWN_MIN + r.next() * (SPAWN_MAX - SPAWN_MIN);
    const x = ctx.playerX + Math.sin(ang) * dist;
    const z = ctx.playerZ + Math.cos(ang) * dist;
    const hf = this.terrain.hf;
    if (!hf.inBounds(x, z)) return false;
    const zone = this.zones.at(x, z);
    if (!zone?.encounterTable || zone.kind === 'town') return false;
    const table = this.tables[zone.encounterTable];
    if (!table) return false;
    // 区域内的目标数量
    let inZone = 0;
    for (const w of this.wild.values()) if (w.zoneId === zone.id && !w.denId) inZone++;
    const want = Math.min(this.maxWild, Math.round((table.density[0] + table.density[1]) / 2) + (ctx.lure ? 2 : 0));
    if (inZone >= want || this.commonCount >= this.maxWild) return false;
    const water = hf.waterAt(x, z);
    const method: EncounterMethod = water && water.depth > 0.6 ? 'surf' : 'visible';
    if (method === 'visible' && (hf.slopeAt(x, z) > 32 || this.collision.query(x, z, 1.5).length > 0)) {
      this.stats.rejected++;
      return false;
    }
    const enc = rollEncounter(table, { time: ctx.time, weather: ctx.weather, method, lure: ctx.lure }, r, this.dex);
    if (!enc) return false;
    // 游荡头目每岛同时最多 1 只
    if (enc.alpha && this.roamingId !== null && this.wild.has(this.roamingId)) return false;
    const habitat = this.habitatOf(enc.speciesId);
    if (method === 'surf' && habitat !== 'water' && habitat !== 'air') return false;
    if (method === 'visible' && habitat === 'water') return false;
    // 成群出现也不能突破同屏上限（high 档 20）：否则三角面预算会被群体刷新顶破
    const count = Math.min(enc.formation === 'group' ? Math.max(1, enc.count) : 1, this.maxWild - this.commonCount);
    for (let i = 0; i < count; i++) {
      const gx = x + (i ? (r.next() - 0.5) * 6 : 0);
      const gz = z + (i ? (r.next() - 0.5) * 6 : 0);
      const e =
        i === 0
          ? enc
          : { ...enc, alpha: false, shiny: r.chance(table.shinyChance), level: Math.max(1, enc.level - r.int(0, 1)) };
      const w = this.spawnAt(e.speciesId, gx, gz, zone.id, method === 'surf' ? 'surf' : 'visible', () => {
        const base = createWild(this.dex, e, r, { island: hf.config.id, zone: zone.id, level: e.level });
        return e.alpha ? makeRoaming(this.dex, base, zone.levelRange?.[1] ?? base.level, r) : base;
      });
      if (e.alpha) {
        // 游荡头目：主动攻击、视野更远、不睡觉
        w.brain.temperament = 'aggressive';
        w.brain.sight *= 1.5;
        w.brain.sleepsAtNight = false;
        w.bornAt = this.time;
        this.roamingId = w.id;
        this.alphaHooks?.roaming?.(w);
      }
    }
    return true;
  }

  spawnAt(
    speciesId: number,
    x: number,
    z: number,
    zoneId: string,
    method: 'visible' | 'surf',
    make: () => ReturnType<typeof createWild>,
  ): WildMon {
    const mon = make();
    const species = this.dex.species(speciesId);
    const beh = behaviorOf(speciesId);
    const brain = createBrain(x, z, beh.temperament, beh, () => this.rng.next());
    const w = new WildMon(mon, species, brain, beh.habitat, zoneId, method);
    w.root.position.set(x, this.groundY(w, x, z), z);
    this.wild.set(w.id, w);
    this.group.add(w.root);
    this.stats.spawned++;
    return w;
  }

  private groundY(w: WildMon, x: number, z: number): number {
    const hf = this.terrain.hf;
    const g = hf.heightAt(x, z);
    const water = hf.waterAt(x, z);
    if (w.habitat === 'air') return Math.max(g, water?.level ?? -Infinity) + 1.6;
    if (water && (w.habitat === 'water' || water.depth > 0.4)) return water.level - w.height * 0.35;
    const top = this.collision.walkableTopAt(x, z, g + 3);
    return Math.max(g, top);
  }

  /** 刷新巢穴头目（独立槽位） */
  private spawnDen(den: AlphaDenDef, hooks: AlphaHooks): WildMon | null {
    const [x, z] = den.position;
    const hf = this.terrain.hf;
    if (!hf.inBounds(x, z)) return null;
    const water = hf.waterAt(x, z);
    const method = water && water.depth > 0.6 ? 'surf' : 'visible';
    const w = this.spawnAt(den.speciesId, x, z, den.zone, method, () => hooks.make(den));
    w.denId = den.id;
    w.brain.temperament = 'aggressive';
    w.brain.sleepsAtNight = false;
    w.brain.territory = { ...TERRITORY, radius: den.radius, warned: false };
    this.denMons.set(den.id, w.id);
    return w;
  }

  private updateDens(ctx: SpawnContext): void {
    const hooks = this.alphaHooks;
    if (!hooks) return;
    for (const den of this.dens) {
      const id = this.denMons.get(den.id);
      const w = id !== undefined ? this.wild.get(id) : undefined;
      if (id !== undefined && !w) this.denMons.delete(den.id);
      const d = Math.hypot(ctx.playerX - den.position[0], ctx.playerZ - den.position[1]);
      if (!w) {
        if (d < DEN_LOAD && ctx.active && hooks.available(den, ctx)) this.spawnDen(den, hooks);
      } else if (!w.frozen && (d > DEN_UNLOAD || (!hooks.available(den, ctx) && w.brain.state !== 'chase'))) {
        this.remove(w.id);
      }
      if (d < DEN_NEAR) hooks.near?.(den, this.denMons.has(den.id));
    }
  }

  remove(id: number): void {
    const w = this.wild.get(id);
    if (!w) return;
    if (w.denId) this.denMons.delete(w.denId);
    if (this.roamingId === id) this.roamingId = null;
    this.group.remove(w.root);
    w.dispose();
    this.wild.delete(id);
    this.stats.despawned++;
  }

  clear(): void {
    for (const id of [...this.wild.keys()]) this.remove(id);
  }

  /** 战斗期间冻结所有个体（遭遇的那只由战斗场景接管） */
  setFrozen(frozen: boolean): void {
    for (const w of this.wild.values()) w.frozen = frozen;
  }

  fixedUpdate(dt: number, ctx: SpawnContext): void {
    if (!this.enabled) return;
    this.time += dt;
    this.timer -= dt;
    if (ctx.active && this.timer <= 0) {
      this.timer = 0.35;
      this.trySpawn(ctx);
    }
    this.denTimer -= dt;
    if (this.denTimer <= 0) {
      this.denTimer = 0.5;
      this.updateDens(ctx);
    }
    const hf = this.terrain.hf;
    const r = () => this.rng.next();
    const toRemove: number[] = [];
    for (const w of this.wild.values()) {
      const p = w.root.position;
      const dPlayer = Math.hypot(p.x - ctx.playerX, p.z - ctx.playerZ);
      // 巢穴头目由 updateDens 管理；游荡头目超时离开
      const expired = w.id === this.roamingId && !w.frozen && this.time - w.bornAt > ROAMING_LIFETIME_S;
      if ((dPlayer > DESPAWN && !w.denId) || expired) {
        toRemove.push(w.id);
        continue;
      }
      // 远近细节，带滞回避免在边界来回切换
      w.setDetail(w.near ? dPlayer <= DETAIL_FAR : dPlayer < DETAIL_NEAR);
      w.animLod = animLodFor(w.animLod, dPlayer);
      if (w.frozen || !ctx.active) {
        w.animate(dt, 0, this.time);
        continue;
      }
      const per: Perception = {
        px: ctx.playerX,
        pz: ctx.playerZ,
        playerRunning: ctx.playerRunning,
        playerInGrass: ctx.playerInGrass,
        isNight: ctx.time === 'night',
        x: p.x,
        z: p.z,
      };
      const intent = stepBrain(w.brain, per, dt, r);
      w.setEmote(intent.emote);
      if (intent.roar) this.alphaHooks?.roar?.(w);
      let speed = 0;
      if (intent.speedScale > 0) {
        speed = w.brain.speed * intent.speedScale;
        let nx = p.x + intent.mx * speed * dt;
        let nz = p.z + intent.mz * speed * dt;
        // 地形限制：陆地物种不下深水 / 不爬陡坡；水栖不上岸；飞行无限制；留在区域内
        const water = hf.waterAt(nx, nz);
        const zone = this.zones.at(nx, nz);
        const ok =
          hf.inBounds(nx, nz) &&
          zone?.id === w.zoneId &&
          (w.habitat === 'air' ||
            (w.habitat === 'water'
              ? !!water && water.depth > 0.5
              : (!water || water.depth < 0.5) && hf.slopeAt(nx, nz) < 36));
        if (ok) {
          if (w.habitat !== 'air') {
            const res = this.collision.resolve(nx, nz, w.radius, p.y, p.y + w.height);
            nx = res.x;
            nz = res.z;
          }
          p.x = nx;
          p.z = nz;
        } else {
          // 撞到边界：换个游荡目标
          w.brain.tx = w.brain.homeX;
          w.brain.tz = w.brain.homeZ;
          if (w.brain.state === 'wander') w.brain.state = 'return';
          speed = 0;
        }
      }
      const gy = this.groundY(w, p.x, p.z);
      p.y += (gy - p.y) * Math.min(1, dt * 12);
      w.animate(dt, speed, this.time);
      // 接触判定
      const contact = dPlayer < CONTACT_DIST + w.radius * 0.5 && Math.abs(p.y - ctx.playerY) < 2.5;
      if (!ctx.playerFlying && (intent.engage || contact)) {
        const initiative = contactInitiative(w.brain, ctx.playerX, ctx.playerZ, p.x, p.z);
        w.frozen = true;
        this.events.post('encounter:start', {
          wild: w.mon,
          position: { x: ctx.playerX, y: ctx.playerY, z: ctx.playerZ },
          wildPosition: { x: p.x, y: p.y, z: p.z },
          initiative,
          entityId: w.id,
          zoneId: w.zoneId,
          alpha: !!w.mon.alpha,
          method: w.method,
          denId: w.denId ?? undefined,
        });
        ctx.active = false; // 本帧只触发一次
      }
    }
    for (const id of toRemove) this.remove(id);
  }

  /** 草丛推开：返回附近野生宝可梦位置 */
  pushers(max: number, out: Array<{ x: number; y: number; z: number; r: number }>): void {
    for (const w of this.wild.values()) {
      if (out.length >= max) break;
      if (w.habitat === 'air' || w.habitat === 'water') continue;
      const p = w.root.position;
      out.push({ x: p.x, y: p.y, z: p.z, r: w.radius * 2.2 + 0.3 });
    }
  }
}

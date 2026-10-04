/**
 * 计划文档 §9.2 · 大地图野外采集运行时：
 * - 采集点模型（world/props/gatherProps，实例化）按存档 / 游戏日 / 时段 / 潮汐每秒同步显示；
 * - 互动源：靠近按 E 采集（1 秒采集动作 → 掉落物飞向玩家 → 提示获得了什么）；
 *   不能采时按 E 显示原因（摘完了 / 涨潮 / 夜熟）；矿点没有「碎岩」时显示封锁提示；
 * - 蜂蜜树：F 涂甜甜蜜，6 小时后按 E 查看会遇到被吸引来的宝可梦；
 * - 嗅觉好的跟随宝可梦每天捡到一件道具。
 */
import * as THREE from 'three';
import type { Dex } from '@/systems/data/Dex';
import type { GameState } from '@/systems/state';
import type { Rng } from '@/systems/rng';
import type { PokemonInstance } from '@/systems/pokemon';
import { createPokemon } from '@/systems/pokemon';
import { itemInfo } from '@/systems/items';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { BERRY_BY_ID } from '@/config/berries';
import { GATHER_POINTS } from '@/config/gather';
import {
  availability,
  consumeHoney,
  daysUntilReady,
  gather,
  gatherState,
  honeyStatus,
  isLowTide,
  isNight,
  KIND_ACTION,
  KIND_ZH,
  NIGHT_ONLY_BERRIES,
  rollHoney,
  ROCK_SMASH_FLAG,
  slatherHoney,
  sniffPickup,
  type GatherContext,
  type GatherPointDef,
  type ItemStack,
} from '@/systems/gathering';
import { GatherField, type GatherVisual } from '@/world/props/gatherProps';
import type { CollisionWorld } from '@/world/collision/CollisionWorld';
import type { PlayerController } from '@/actors/player';
import type { Interactable, InteractSource } from './SceneInteractions';
import { sfx } from '@/core/audio';

export interface SceneGatherDeps {
  island: string;
  parent: THREE.Object3D;
  player: PlayerController;
  collision: CollisionWorld;
  state: GameState;
  dex: Dex;
  rng: Rng;
  heightAt(x: number, z: number): number;
  /** 游戏总分钟数（clock.totalMinutes） */
  minutes(): number;
  weather(): string;
  /** 跟随中的宝可梦（收回球里 / 没有跟随时 null） */
  follower(): { speciesId: number; emote(text: string): void } | null;
  toast(text: string, ms?: number): void;
  /** 蜂蜜树吸引来的野生宝可梦 */
  encounter(wild: PokemonInstance, at: { x: number; y: number; z: number }): void;
  busy(): boolean;
}

/** 掉落物飞向玩家的小球 */
interface Fly {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  t: number;
  delay: number;
}

const FLY_TIME = 0.55;
const GATHER_TIME = 1;

export class SceneGather {
  readonly defs: GatherPointDef[];
  readonly field: GatherField;
  private syncClock = 0;
  private sniffClock = 3;
  private t = 0;
  private flies: Fly[] = [];
  private flyGeo = new THREE.IcosahedronGeometry(0.12, 0);
  /** 采集动作进行中（锁定移动） */
  busy = false;
  /** 最近一次采集结果（e2e / 调试） */
  last: { id: string; items: ItemStack[] } | null = null;

  constructor(private readonly d: SceneGatherDeps) {
    this.defs = GATHER_POINTS.filter((p) => p.island === d.island).map((p) => p.def);
    this.field = new GatherField(this.defs, {
      parent: d.parent,
      heightAt: d.heightAt,
      collision: d.collision,
      berryColor: (id) => {
        const b = BERRY_BY_ID.get(id);
        return { fruit: b?.color.fruit ?? '#e8484a', leaf: b?.color.leaf ?? '#4f9a48' };
      },
    });
    gatherState(d.state);
    this.sync();
  }

  get day(): number {
    return Math.floor(this.d.minutes() / 1440);
  }

  get hour(): number {
    return (this.d.minutes() % 1440) / 60;
  }

  private ctx(): GatherContext {
    const f = this.d.follower();
    const types = f ? this.d.dex.species(f.speciesId).types : [];
    return { day: this.day, hour: this.hour, weather: this.d.weather(), flags: this.d.state.flags, followerTypes: types };
  }

  /** 显示状态：可采 / 退潮 / 夜熟 / 涂蜜 / 夜光蘑菇 */
  visuals(): GatherVisual[] {
    const g = gatherState(this.d.state);
    const day = this.day;
    const hour = this.hour;
    const night = isNight(hour);
    const tide = isLowTide(hour);
    return this.defs.map((def) => {
      const ready = daysUntilReady(def, g.points[def.id], day) === 0;
      const v: GatherVisual = { ready };
      if (def.kind === 'shell') v.exposed = tide;
      if (def.kind === 'berryTree' && def.berry && NIGHT_ONLY_BERRIES.has(def.berry)) v.unripe = !night;
      if (def.kind === 'mushroom') v.glow = night;
      if (def.kind === 'honey') v.honeyed = g.honey[def.id] !== undefined;
      return v;
    });
  }

  sync(): void {
    this.field.sync(this.visuals());
  }

  private itemName(id: string): string {
    return itemInfo(this.d.dex, id, KEY_ITEM_BY_ID).name;
  }

  source(): InteractSource {
    return (_player, out: Interactable[]) => {
      if (this.busy) return;
      const ctx = this.ctx();
      const g = gatherState(this.d.state);
      for (const def of this.defs) {
        const [x, z] = def.position;
        const p = this.d.player.position;
        if (Math.abs(p.x - x) > 6 || Math.abs(p.z - z) > 6) continue;
        const y = this.field.promptY(def);
        const range = def.kind === 'berryTree' || def.kind === 'honey' ? 2.2 : def.kind === 'ore' ? 2.4 : 1.8;
        const base = { id: `gather:${def.id}`, x, z, y, range, priority: 1 };
        if (def.kind === 'ore' && !ctx.flags[ROCK_SMASH_FLAG]) {
          out.push({ ...base, kind: 'blocked', label: '嵌着矿石的岩石', action: null, ability: 'rock-smash', hint: '需要「碎岩」才能敲开' });
          continue;
        }
        const a = availability(def, g.points[def.id], ctx);
        const honey = def.kind === 'honey' ? honeyStatus(this.d.state, def, this.d.minutes()) : null;
        let item: Interactable;
        if (honey?.state === 'ready') {
          item = { ...base, kind: 'examine', label: '查看涂过蜜的树', action: 'interact', run: () => this.honeyEncounter(def) };
        } else if (a.ok) {
          item = { ...base, kind: 'examine', label: def.kind === 'berryTree' ? `摘${this.itemName(def.berry ?? 'oran-berry')}` : KIND_ACTION[def.kind], action: 'interact', run: () => this.doGather(def) };
        } else {
          item = { ...base, kind: 'examine', label: `查看${KIND_ZH[def.kind]}`, action: 'interact', run: () => this.d.toast(a.hint, 2600) };
        }
        if (def.kind === 'honey') {
          if (honey?.state === 'waiting') {
            const h = Math.ceil(honey.minutesLeft / 60);
            if (!a.ok) item.run = () => this.d.toast(`树干上涂着甜甜蜜，香气正慢慢散开……大约 ${h} 小时后再来看看。`, 2800);
          } else if (honey?.state === 'none' && (this.d.state.bag['honey'] ?? 0) > 0) {
            item.secondary = { action: 'sendOut', label: '涂甜甜蜜', kind: 'use', run: () => this.slather(def) };
          }
        }
        out.push(item);
      }
    };
  }

  private async doGather(def: GatherPointDef): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const pl = this.d.player;
    const [x, z] = def.position;
    pl.teleport(pl.position.x, pl.position.z, Math.atan2(x - pl.position.x, z - pl.position.z));
    pl.model.gesture(def.kind === 'berryTree' || def.kind === 'honey' ? 'reach' : 'crouch', GATHER_TIME);
    sfx(def.kind === 'ore' ? 'bump' : 'step-ground', 0.6);
    await wait(GATHER_TIME * 1000);
    const r = gather(this.d.state, def, this.ctx(), this.d.rng);
    this.busy = false;
    if (!r.ok) {
      this.d.toast(r.hint, 2400);
      return;
    }
    this.last = { id: def.id, items: r.items };
    this.spawnFlies(def, r.items);
    const list = r.items.map((it) => `${this.itemName(it.id)} ×${it.qty}`).join('、');
    const extra: string[] = [];
    if (r.assist > 0) {
      const f = this.d.follower();
      if (f) {
        f.emote('♪');
        extra.push(`${this.d.dex.species(f.speciesId).name.zh}帮忙多找到了 ${r.assist} 个！`);
      }
    }
    if (r.doubled) extra.push(isNight(this.hour) ? '夜里的蘑菇长得特别多！' : '雾气里冒出了好多蘑菇！');
    sfx('item', 0.8);
    this.d.toast(`获得了 ${list}${extra.length ? `\n${extra.join(' ')}` : ''}`, 2600);
    this.sync();
  }

  private slather(def: GatherPointDef): void {
    if (!slatherHoney(this.d.state, def, this.d.minutes())) return;
    this.d.toast('在树干上涂了甜甜蜜。香气会慢慢吸引宝可梦……大约 6 小时后再来看看吧。', 3000);
    this.sync();
  }

  private honeyEncounter(def: GatherPointDef): void {
    const roll = rollHoney(this.d.rng, this.hour);
    consumeHoney(this.d.state, def);
    this.sync();
    const wild = createPokemon(this.d.dex, roll.speciesId, roll.level, this.d.rng, { abilitySlot: 'random', metAt: { island: this.d.island, zone: def.zone, level: roll.level } });
    const [x, z] = def.position;
    this.d.toast(`${this.d.dex.species(roll.speciesId).name.zh}被甜甜蜜的香气吸引过来了！`, 1800);
    this.d.encounter(wild, { x, y: this.field.groundY(def), z });
  }

  private spawnFlies(def: GatherPointDef, items: ItemStack[]): void {
    const [x, z] = def.position;
    const top = this.field.promptY(def) - 0.6;
    let n = 0;
    for (const it of items) {
      const color = BERRY_BY_ID.get(it.id)?.color.fruit ?? FLY_COLOR[it.id] ?? '#f6e9a0';
      for (let k = 0; k < Math.min(4, it.qty); k++) {
        const m = new THREE.Mesh(this.flyGeo, new THREE.MeshBasicMaterial({ color }));
        const from = new THREE.Vector3(x + (Math.random() - 0.5) * 0.8, top + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.8);
        m.position.copy(from);
        this.d.parent.add(m);
        this.flies.push({ mesh: m, from, t: 0, delay: n++ * 0.07 });
      }
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.field.animate(this.t);
    // 掉落物：抛物线飞向玩家胸口并缩小
    const target = this.d.player.position;
    this.flies = this.flies.filter((f) => {
      if (f.delay > 0) {
        f.delay -= dt;
        return true;
      }
      f.t += dt / FLY_TIME;
      const k = Math.min(1, f.t);
      f.mesh.position.set(
        f.from.x + (target.x - f.from.x) * k,
        f.from.y + (target.y + 1.0 - f.from.y) * k + Math.sin(k * Math.PI) * 0.9,
        f.from.z + (target.z - f.from.z) * k,
      );
      f.mesh.scale.setScalar(1 - k * 0.7);
      if (k < 1) return true;
      this.d.parent.remove(f.mesh);
      (f.mesh.material as THREE.Material).dispose();
      return false;
    });
    this.syncClock -= dt;
    if (this.syncClock <= 0) {
      this.syncClock = 1;
      this.sync();
    }
    // 嗅觉好的跟随宝可梦：每个游戏日一次
    this.sniffClock -= dt;
    if (this.sniffClock <= 0 && !this.d.busy()) {
      this.sniffClock = 5;
      const f = this.d.follower();
      const id = sniffPickup(this.d.state, f?.speciesId ?? null, this.day, this.d.rng);
      if (id && f) {
        f.emote('!');
        this.d.toast(`${this.d.dex.species(f.speciesId).name.zh}好像捡到了什么……获得了 ${this.itemName(id)}！`, 2800);
      }
    }
  }

  dispose(): void {
    for (const f of this.flies) {
      this.d.parent.remove(f.mesh);
      (f.mesh.material as THREE.Material).dispose();
    }
    this.flies = [];
    this.flyGeo.dispose();
    this.field.dispose();
  }
}

const FLY_COLOR: Record<string, string> = {
  'medicinal-herb': '#6fcf8a',
  'fragrant-herb': '#c8f0d0',
  seashell: '#f7c9b0',
  pearl: '#ffffff',
  'heart-scale': '#f59ab8',
  'tiny-mushroom': '#e8484a',
  'big-mushroom': '#c96a2a',
  'glow-mushroom': '#5ad6e0',
  gravel: '#9a9488',
  'hard-ore': '#7fd0ff',
  honey: '#f2b541',
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 头目宝可梦的场景层（计划文档 §3）：把 systems/alpha 的纯逻辑接到大世界。
 *  - 给 SpawnManager 注入巢穴钩子（冷却按游戏日、出现条件、生成个体、接近 / 咆哮提示）；
 *  - 在每个巢穴放一圈石冢 + 爪痕地面（冷却中也在，玩家能找到；水上巢穴的石柱露出水面）；
 *  - 游荡头目出现时提示「附近有强大的气息……」；
 *  - 战斗结束：巢穴头目写存档记录（冷却 3 天、首次奖励），发放头目之鳞 / 金钱 / 随机道具；
 *  - 头目光晕外壳脉动。
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { EncounterStartEvent } from '@/core/events/events';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import type { GameState } from '@/systems/state';
import { addItem, addMoney } from '@/systems/state';
import type { IslandConfig } from '@/config/islands';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { TM_BY_DEN, tmItemId } from '@/config/tms';
import {
  denAlpha,
  denReward,
  denStatus,
  roamingReward,
  settleDen,
  type AlphaDenDef,
  type AlphaReward,
} from '@/systems/alpha';
import { pulseAlphaAura, toonify } from '@/render';
import { ALPHA_MATERIAL_BY_DEN } from '@/config/alpha/materials';
import { buildAlphaDen, denThemeFor, type DenBuild } from '@/world/props/alphaDens';
import type { SpawnManager } from '@/world/spawns';
import type { Heightfield } from '@/world/terrain/Heightfield';

export interface SceneAlphaDeps {
  game: Game;
  dex: Dex;
  rng: Rng;
  state: GameState;
  island: IslandConfig;
  spawns: SpawnManager;
  hf: Heightfield;
  toast(text: string, ms?: number): void;
}

export type AlphaBattleKind = 'win' | 'lose' | 'run' | 'capture';

export class SceneAlpha {
  /** 巢穴石冢 */
  readonly group = new THREE.Group();
  /** 当前战斗的头目（开战时记下，战后结算） */
  private battle: { denId: string | null; level: number; roaming: boolean } | null = null;
  /** 本次靠近已经提示过的巢穴（离开 60 m 后重置） */
  private readonly announced = new Set<string>();

  constructor(private readonly d: SceneAlphaDeps) {
    this.group.name = 'alpha-dens';
    const dens = d.island.alphaDens ?? [];
    d.spawns.dens = dens;
    d.spawns.alphaHooks = {
      available: (den, ctx) => denStatus(den, this.record(den.id), this.day, ctx.time, ctx.weather) === 'ready',
      make: (den) => denAlpha(d.dex, den, d.rng, { island: d.island.id, zone: den.zone, level: den.level }),
      near: (den, present) => this.onNear(den, present),
      roar: (w) => d.toast(`${w.species.name.zh}发出了威吓的咆哮！不要再靠近了……`, 2600),
      roaming: () => d.toast('附近有强大的气息……', 3000),
    };
    for (const den of dens) this.group.add(this.buildDen(den));
  }

  private get day(): number {
    return this.d.game.clock.day;
  }

  private record(id: string) {
    return this.d.state.alpha?.[id];
  }

  private onNear(den: AlphaDenDef, present: boolean): void {
    const s = this.d.state;
    s.alpha ??= {};
    const rec = (s.alpha[den.id] ??= {});
    if (this.announced.has(den.id)) return;
    this.announced.add(den.id);
    if (!rec.discovered) rec.discovered = true;
    if (present) this.d.toast(`这里是头目的巢穴「${den.name}」……强大的气息扑面而来！`, 3200);
    else if (den.whenText && denStatus(den, rec, this.day, 'day', 'clear') !== 'cooldown') this.d.toast(`头目巢穴「${den.name}」：${den.whenText}。`, 3000);
    else this.d.toast(`头目巢穴「${den.name}」：巢穴空着，头目还没回来。`, 2600);
  }

  /** 每帧：光晕脉动；离开巢穴足够远后重置接近提示 */
  /** 50 m 内有头目（火星粒子 / 光环需要 bloom） */
  glowNear = false;

  update(time: number, px: number, pz: number): void {
    pulseAlphaAura(time);
    for (const b of this.denBuilds) b.update(time);
    this.glowNear = false;
    for (const w of this.d.spawns.wild.values()) {
      if (!w.mon.alpha) continue;
      const p = w.root.position;
      if (Math.abs(p.x - px) < 50 && Math.abs(p.z - pz) < 50) {
        this.glowNear = true;
        break;
      }
    }
    if (!this.announced.size) return;
    for (const den of this.d.island.alphaDens ?? []) {
      if (this.announced.has(den.id) && Math.hypot(px - den.position[0], pz - den.position[1]) > 60) this.announced.delete(den.id);
    }
  }

  /** 遭遇开始（只记录头目战） */
  onBattleStart(e: EncounterStartEvent): void {
    this.battle = e.wild.alpha ? { denId: e.denId ?? null, level: e.wild.level, roaming: !e.denId } : null;
  }

  /** 战斗结束：胜利 / 捕获时结算冷却与奖励 */
  onBattleEnd(result: AlphaBattleKind): string[] {
    const b = this.battle;
    this.battle = null;
    if (!b || (result !== 'win' && result !== 'capture')) return [];
    const s = this.d.state;
    let reward: AlphaReward;
    if (b.denId) {
      s.alpha ??= {};
      const prev = s.alpha[b.denId];
      const tm = TM_BY_DEN.get(b.denId);
      reward = denReward(b.level, prev, this.d.rng, tm ? tmItemId(tm.move) : undefined, ALPHA_MATERIAL_BY_DEN.get(b.denId)?.id);
      s.alpha[b.denId] = settleDen(prev, this.day, result === 'capture');
    } else reward = roamingReward(b.level, this.d.rng);
    addMoney(s, reward.money);
    const lines: string[] = [];
    lines.push(reward.firstClear ? `首次战胜巢穴头目！获得了 ${reward.money} 円奖金。` : `从头目身上获得了 ${reward.money} 円。`);
    for (const [id, qty] of Object.entries(reward.items)) {
      addItem(s, id, qty);
      const name = KEY_ITEM_BY_ID.get(id)?.name ?? this.d.dex.item(id)?.name.zh ?? id;
      lines.push(`获得了 ${name}${qty > 1 ? ` ×${qty}` : ''}！`);
    }
    if (b.denId) lines.push('巢穴暂时空了下来……大约 3 天后会有新的头目出现。');
    return lines;
  }

  /** 巢穴场景（按主题精细建模，见 world/props/alphaDens）；水上巢穴取水面高度 */
  private readonly denBuilds: DenBuild[] = [];
  private denMat: THREE.Material | null = null;

  private buildDen(den: AlphaDenDef): THREE.Group {
    const hf = this.d.hf;
    if (!this.denMat) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
      toonify(g, 'scene');
      this.denMat = (g.children[0] as THREE.Mesh).material as THREE.Material;
    }
    const onWater = !!hf.waterAt(den.position[0], den.position[1]);
    const theme = den.theme ?? denThemeFor(this.d.dex.species(den.speciesId).types, onWater);
    const b = buildAlphaDen(den, theme, { heightAt: (x, z) => hf.heightAt(x, z), waterLevel: (x, z) => hf.waterAt(x, z)?.level ?? null }, this.denMat);
    this.denBuilds.push(b);
    return b.group;
  }

  dispose(): void {
    for (const b of this.denBuilds) b.dispose();
    this.denBuilds.length = 0;
    this.denMat?.dispose();
  }
}

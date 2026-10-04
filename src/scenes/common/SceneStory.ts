/**
 * M1-13 / M1-14 · 大地图剧情运行时：
 * - 剧情拾取物（config/story STORY_PICKUPS）：按 flag 显隐、动画、作为互动源（按 E 执行脚本）；
 * - 抵达触发（STORY_TRIGGERS）：场景空闲时每 0.2 s 检查一次；
 * - 安全位置：记录玩家最后一次在「限制区域」内（萌芽镇）的位置，供 pushBack 拉回；
 * - StoryHost：脚本战斗 / 传送 / 场景特效（灯塔光束、索罗亚烟雾、雾散）。
 */
import type * as THREE from 'three';
import type { Flags } from '@/systems/quests';
import type { IslandId } from '@/systems/state/GameState';
import type { StoryFx, StoryPickup } from '@/systems/story';
import { pickupVisible, triggerDue } from '@/systems/story';
import { STORY_PICKUPS, STORY_TRIGGERS } from '@/config/story';
import { buildStoryProp, LighthouseBeam, Puff, type StoryPropView } from '@/world/props/storyProps';
import type { PlayerController } from '@/actors/player';
import type { Interactable, InteractSource } from './SceneInteractions';
import { storyDirector, type StoryBattleResult, type StoryHost } from './StoryDirector';

/** 灯塔位置 / 高度（config/islands/towns/harbor-city.ts 的 lighthouse 道具） */
const LIGHTHOUSE = { x: 425, z: -64, height: 26 };

export interface SceneStoryDeps {
  island: string;
  parent: THREE.Object3D;
  player: PlayerController;
  flags(): Flags;
  heightAt(x: number, z: number): number;
  waterLevelAt(x: number, z: number): number | null;
  zoneAt(x: number, z: number): string | null;
  busy(): boolean;
  night(): boolean;
  battle(o: Parameters<NonNullable<StoryHost['battle']>>[0]): Promise<StoryBattleResult>;
  teleport(x: number, z: number, yaw: number): Promise<void>;
  travel(island: IslandId, x: number, z: number, yaw: number): Promise<void>;
  /** 雾散（天气转晴） */
  clearFog?(): void;
}

interface PickupView {
  def: StoryPickup;
  view: StoryPropView | null;
}

export class SceneStory implements StoryHost {
  readonly kind = 'overworld' as const;
  private pickups: PickupView[];
  private beam: LighthouseBeam;
  private puffs: Puff[] = [];
  private t = 0;
  private triggerClock = 0;
  private safe: { x: number; z: number; yaw: number } | null = null;
  /** 最近一次触发（e2e） */
  lastTrigger: string | null = null;

  constructor(private readonly d: SceneStoryDeps) {
    this.pickups = STORY_PICKUPS.filter((p) => p.island === d.island).map((def) => ({ def, view: null }));
    this.beam = new LighthouseBeam(d.heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + LIGHTHOUSE.height);
    this.beam.root.position.x = LIGHTHOUSE.x;
    this.beam.root.position.z = LIGHTHOUSE.z;
    d.parent.add(this.beam.root);
    this.sync();
  }

  /** 当前可见的拾取物 id（e2e） */
  get visible(): string[] {
    return this.pickups.filter((p) => p.view).map((p) => p.def.id);
  }

  get beamOn(): boolean {
    return this.beam.on;
  }

  private groundY(p: StoryPickup): number {
    const [x, z] = p.position;
    if (p.floating) return this.d.waterLevelAt(x, z) ?? 0;
    return this.d.heightAt(x, z);
  }

  /** 按 flag 创建 / 移除拾取物 */
  sync(): void {
    const flags = this.d.flags();
    for (const p of this.pickups) {
      const want = pickupVisible(p.def, flags);
      if (want && !p.view) {
        const v = buildStoryProp(p.def.model);
        v.root.position.set(p.def.position[0], this.groundY(p.def), p.def.position[1]);
        v.root.rotation.y = p.def.yaw ?? 0;
        v.root.name = `story:${p.def.id}`;
        this.d.parent.add(v.root);
        p.view = v;
      } else if (!want && p.view) {
        this.d.parent.remove(p.view.root);
        p.view.dispose();
        p.view = null;
      }
    }
    this.beam.on = flags['lighthouse-relit'] === true;
  }

  source(): InteractSource {
    return (_player, out: Interactable[]) => {
      if (storyDirector()?.running) return;
      for (const p of this.pickups) {
        if (!p.view) continue;
        out.push({
          id: `story:${p.def.id}`,
          kind: 'examine',
          x: p.def.position[0],
          z: p.def.position[1],
          y: p.view.root.position.y + p.view.promptY,
          label: p.def.label,
          action: 'interact',
          range: p.def.range ?? 1.6,
          priority: 2,
          run: async () => {
            await storyDirector()?.run(p.def.script);
            this.sync();
          },
        });
      }
    };
  }

  update(dt: number): void {
    this.t += dt;
    for (const p of this.pickups) p.view?.animate(this.t + p.def.position[0] * 0.1);
    this.beam.animate(this.t, this.d.night());
    this.puffs = this.puffs.filter((f) => {
      if (!f.update(dt)) return true;
      this.d.parent.remove(f.root);
      f.dispose();
      return false;
    });
    this.triggerClock -= dt;
    if (this.triggerClock > 0) return;
    this.triggerClock = 0.2;
    this.sync();
    const pos = this.d.player.position;
    const zone = this.d.zoneAt(pos.x, pos.z);
    const flags = this.d.flags();
    // 安全位置：在任何 outsideZone 触发要求的区域内时记录
    for (const t of STORY_TRIGGERS) if (t.outsideZone && zone === t.outsideZone) this.safe = { x: pos.x, z: pos.z, yaw: this.d.player.facing };
    const dir = storyDirector();
    if (!dir || dir.running || this.d.busy()) return;
    for (const t of STORY_TRIGGERS) {
      if (!triggerDue(t, flags, this.d.island, pos.x, pos.z, zone)) continue;
      // 离开限制区域的触发：从未进入过该区域（读档就在外面）时不拉回
      if (t.outsideZone && !this.safe) continue;
      this.lastTrigger = t.id;
      this.d.player.velocity.set(0, 0, 0);
      void dir.run(t.script).then(() => {
        if (!t.repeat && !flags[t.doneFlag]) flags[t.doneFlag] = true;
        this.sync();
      });
      return;
    }
  }

  // ———————————————— StoryHost ————————————————

  battle(o: Parameters<NonNullable<StoryHost['battle']>>[0]): Promise<StoryBattleResult> {
    return this.d.battle(o);
  }

  travel(island: IslandId, x: number, z: number, yaw: number): Promise<void> {
    return this.d.travel(island, x, z, yaw);
  }

  teleport(x: number, z: number, yaw: number): Promise<void> {
    return this.d.teleport(x, z, yaw);
  }

  async pushBack(): Promise<void> {
    const s = this.safe;
    if (!s) return;
    // 往回退 2 m（朝区域内），避免落在边界上立刻再次触发
    const p = this.d.player.position;
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    const x = s.x + (dx / len) * 2;
    const z = s.z + (dz / len) * 2;
    await this.d.teleport(x, z, Math.atan2(dx, dz));
  }

  async fx(name: StoryFx, ms: number): Promise<void> {
    const wait = (t: number) => new Promise<void>((r) => setTimeout(r, t));
    const dir = storyDirector();
    if (name === 'lighthouse') {
      await dir?.overlay.flash(Math.min(ms, 500));
      this.beam.on = true;
      await wait(ms);
    } else if (name === 'poof') {
      const p = this.d.player.position;
      const f = this.d.player.facing;
      const x = p.x + Math.sin(f) * 1.6;
      const z = p.z + Math.cos(f) * 1.6;
      const puff = new Puff(x, this.d.heightAt(x, z), z);
      this.d.parent.add(puff.root);
      this.puffs.push(puff);
      await dir?.overlay.flash(260);
      await wait(Math.max(0, ms - 260));
    } else if (name === 'fog-clear') {
      this.d.clearFog?.();
      await wait(ms);
    } else if (name === 'shake') {
      await wait(ms);
    }
  }

  dispose(): void {
    for (const p of this.pickups) {
      if (!p.view) continue;
      this.d.parent.remove(p.view.root);
      p.view.dispose();
    }
    this.d.parent.remove(this.beam.root);
    this.beam.dispose();
    for (const f of this.puffs) f.dispose();
  }
}

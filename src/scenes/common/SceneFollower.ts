/**
 * M1-08 · 场景内跟随宝可梦宿主（大地图与室内共用）：
 * - 队首（第一只未濒死）宝可梦变化 / 设置开关变化时重建模型
 * - 逐帧跟随；对话（心情表情 + 台词，每天一次 +1 亲密度）
 * - 战斗时把模型借给 BattleScene（跑进战斗场），战斗结束归还后瞬移回身后
 */
import type * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { Dex } from '@/systems/data/Dex';
import { displayName, maxHp } from '@/systems/pokemon';
import { followerMood, followerOf, talkFriendship, type Mood } from '@/systems/follower';
import type { GameState } from '@/systems/state';
import { KIND_LABEL } from '@/systems/interaction';
import { Follower, type FollowerGround } from '@/actors/follower/Follower';
import { createMonModel, monHeight } from '@/actors/pokemon/monModel';
import type { PlayerController } from '@/actors/player';
import { say, type UiRoot } from '@/ui/core';
import type { BattleFollower } from '@/scenes/battle/BattleScene';
import type { InteractSource } from './SceneInteractions';

export interface SceneFollowerOptions {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  parent: THREE.Object3D;
  ground: FollowerGround;
  player: PlayerController;
  zoneKind(): 'town' | 'wild' | 'sea' | 'dungeon-entrance' | 'interior' | null;
  weather(): string;
}

export class SceneFollower {
  follower: Follower | null = null;
  /** 最近一次对话的心情（e2e） */
  lastMood: Mood | null = null;
  private talking = false;
  private moodTimer = 8;

  constructor(private readonly o: SceneFollowerOptions) {}

  /** 当前应该跟随的宝可梦（设置关闭 / 全部濒死时为 null） */
  private wanted() {
    if (!this.o.state.settings.showFollower) return null;
    return followerOf(this.o.state.party);
  }

  /** 与存档同步：必要时重建（换队首 / 进化 / 开关设置） */
  refresh(warp = false): void {
    const want = this.wanted();
    const cur = this.follower;
    if (cur && (!want || want.uid !== cur.uid || want.speciesId !== cur.speciesId)) {
      if (cur.borrowed) return; // 战斗中不重建，结束后再处理
      cur.dispose();
      this.follower = null;
    }
    if (want && !this.follower) {
      const model = createMonModel(this.o.dex, want);
      const f = new Follower(want.uid, want.speciesId, model, monHeight(this.o.dex, want), this.o.ground);
      this.o.parent.add(f.root);
      f.warpBehind(this.o.player);
      this.follower = f;
    } else if (warp && this.follower) this.follower.warpBehind(this.o.player);
  }

  update(dt: number, frozen: boolean): void {
    this.refresh();
    const f = this.follower;
    if (!f) return;
    f.update(dt, this.o.player, frozen || this.talking);
    // 偶尔自发冒出心情表情（停下来时）
    if (!frozen && f.speed < 0.1) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0) {
        this.moodTimer = 14 + Math.random() * 12;
        const m = this.mood();
        if (m) f.emote.show(m.emote, 1.8);
      }
    }
  }

  warp(): void {
    this.refresh(true);
  }

  private mood(): Mood | null {
    const f = this.follower;
    const p = f ? this.o.state.party.find((x) => x.uid === f.uid) : null;
    if (!f || !p) return null;
    const dex = this.o.dex;
    const sp = dex.species(p.speciesId);
    const hpRatio = p.hp / Math.max(1, maxHp(dex, p));
    return followerMood({
      name: displayName(dex, p),
      hpRatio,
      status: p.status?.kind ?? null,
      friendship: p.friendship,
      hour: this.o.game.clock.hour,
      weather: this.o.weather(),
      zoneKind: this.o.zoneKind(),
      type: sp.types[0] ?? 'normal',
      roll: Math.random(),
    });
  }

  /** 与跟随宝可梦对话 */
  async talk(): Promise<void> {
    const f = this.follower;
    const p = f ? this.o.state.party.find((x) => x.uid === f.uid) : null;
    if (!f || !p || this.talking) return;
    this.talking = true;
    try {
      const pl = this.o.player;
      pl.velocity.set(0, 0, 0);
      pl.teleport(pl.position.x, pl.position.z, Math.atan2(f.position.x - pl.position.x, f.position.z - pl.position.z));
      f.yaw = Math.atan2(pl.position.x - f.position.x, pl.position.z - f.position.z);
      const m = this.mood();
      if (!m) return;
      this.lastMood = m;
      f.emote.show(m.emote, 2.4);
      if (m.emote === '♪' || m.emote === '♥' || m.emote === '!') f.jump();
      const day = Math.floor(this.o.game.clock.totalMinutes / 1440);
      const gained = talkFriendship(p, day, this.o.state.vars);
      await say(this.o.ui, gained && p.friendship % 10 === 0 ? [...m.lines, `${displayName(this.o.dex, p)}和你更亲近了！`] : m.lines);
    } finally {
      this.talking = false;
    }
  }

  /** 互动候选：面对跟随宝可梦按互动键 */
  source(): InteractSource {
    return (_player, out) => {
      const f = this.follower;
      if (!f || f.borrowed || f.inBall || this.talking) return;
      const head = f.headPosition();
      out.push({
        id: 'follower',
        kind: 'talk',
        x: f.position.x,
        z: f.position.z,
        y: head.y + 0.35,
        label: KIND_LABEL.talk,
        action: 'interact',
        range: 1.6 + f.height * 0.3,
        run: () => this.talk(),
      });
    };
  }

  /** 借给战斗（首发就是跟随者时） */
  lend(): BattleFollower | null {
    const f = this.follower;
    if (!f || f.inBall || !f.root.visible) return null;
    f.borrowed = true;
    f.emote.clear();
    return { root: f.root, height: f.height, uid: f.uid };
  }

  /** 战斗结束归还：回到玩家身后（队首可能已变化） */
  giveBack(): void {
    const f = this.follower;
    if (f) f.borrowed = false;
    this.refresh(true);
  }

  dispose(): void {
    this.follower?.dispose();
    this.follower = null;
  }
}

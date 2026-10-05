/**
 * M3-18 · 潜水骑乘（大地图一侧）：
 * - 解锁：琉璃支线「深叔的旧罗盘」奖励 flag hm08-dive（config/rides 的 dive）
 * - 下潜：冲浪进入潜水点（IslandConfig.diveSpots）的暗色水域，按互动键「下潜」→ 气泡转场 → 海底室内场景
 * - 上浮：海底房间里走进上浮光柱（ExitConfig.surfaceAt）→ 回到对应潜水点的海面，继续冲浪（OverworldScene.leaveInterior）
 * - 没有能力：第一次冲浪进入暗区提示一次（flag seen-dive:<id>），互动显示说明
 */
import type { GameState } from '@/systems/state/GameState';
import type { PlayerController } from '@/actors/player';
import type { DiveSpotConfig } from '@/config/islands/types';
import type { Interactable, InteractSource } from './SceneInteractions';
import { rideFor, type RideDef } from '@/systems/ride';
import { RIDES } from '@/config/rides';
import { sfx } from '@/core/audio';

export interface SceneDiveDeps {
  state: GameState;
  player: PlayerController;
  spots: readonly DiveSpotConfig[];
  toast(text: string): void;
  say(pages: string[]): Promise<void>;
  canAct(): boolean;
  /** 进入海底（由大地图实现：enterInterior） */
  enter(spot: DiveSpotConfig): Promise<void>;
}

/** 潜水点判定（纯函数，单测用） */
export function diveSpotAt(spots: readonly DiveSpotConfig[], x: number, z: number): DiveSpotConfig | null {
  let best: DiveSpotConfig | null = null;
  let bd = Infinity;
  for (const s of spots) {
    const d = Math.hypot(x - s.center[0], z - s.center[1]);
    if (d <= s.radius && d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

export class SceneDive {
  busy = false;
  private hintT = 0;

  constructor(private readonly d: SceneDiveDeps) {}

  diveRide(): RideDef | null {
    return rideFor(RIDES, 'deep', this.d.state.flags);
  }

  /** 当前所在潜水点（必须在冲浪） */
  here(): DiveSpotConfig | null {
    const p = this.d.player;
    if (p.mode !== 'surf') return null;
    return diveSpotAt(this.d.spots, p.position.x, p.position.z);
  }

  source(): InteractSource {
    return (player, out: Interactable[]) => {
      if (this.busy || player.mode !== 'surf') return;
      const spot = diveSpotAt(this.d.spots, player.position.x, player.position.z);
      if (!spot) return;
      const can = !!this.diveRide();
      out.push({
        id: `dive:${spot.id}`,
        kind: 'use',
        x: player.position.x,
        z: player.position.z,
        y: player.position.y + 2.2,
        label: can ? `下潜（${spot.name}）` : `查看深水区（${spot.name}）`,
        action: 'interact',
        range: 99,
        priority: 1,
        run: async () => {
          if (can) await this.dive(spot);
          else await this.d.say(['海水在这里一下子暗了下去，深不见底。', '水底不断有气泡冒上来……下面好像有什么东西。', '（需要「潜水」骑乘才能潜下去）']);
        },
      });
    };
  }

  /** 下潜（也供 e2e / 调试调用：必须在潜水点冲浪） */
  async dive(spot?: DiveSpotConfig): Promise<boolean> {
    const s = spot ?? this.here();
    if (!s || this.busy || !this.d.canAct()) return false;
    if (!this.diveRide()) {
      this.d.toast('需要「潜水」骑乘才能潜入深海。');
      return false;
    }
    if (this.d.player.mode !== 'surf') return false;
    this.busy = true;
    try {
      sfx('splash', 0.9);
      this.d.toast(`深吸一口气……潜入了${s.name}！`);
      await this.d.enter(s);
      return true;
    } finally {
      this.busy = false;
    }
  }

  /** 没有能力时第一次冲浪进入暗区：提示一次 */
  fixedUpdate(dt: number): void {
    this.hintT -= dt;
    if (this.hintT > 0) return;
    this.hintT = 0.5;
    const s = this.here();
    if (!s) return;
    const flag = `seen-dive:${s.id}`;
    if (this.d.state.flags[flag]) return;
    this.d.state.flags[flag] = true;
    this.d.toast(this.diveRide() ? `${s.name}：按互动键下潜。` : '海水在这里暗得发黑，水底不断冒着气泡……需要「潜水」骑乘才能下去。');
  }
}

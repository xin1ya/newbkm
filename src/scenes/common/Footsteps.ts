/**
 * M1-20 · 脚步声：按移动距离触发（走 0.72 m / 跑 0.95 m 一步），音色由脚下表面决定
 * （草丛 / 泥土 / 木板 / 浅水）。水上骑乘与跳跃时不响。
 */
import type { PlayerController } from '@/actors/player';
import { sfx, type SfxName } from '@/core/audio';

export class Footsteps {
  private acc = 0;
  /** 调试：累计步数 */
  steps = 0;

  constructor(private readonly surface: (x: number, z: number, player: PlayerController) => SfxName) {}

  fixedUpdate(player: PlayerController): void {
    if (player.mode !== 'walk' || player.hopping || !player.grounded) {
      this.acc = 0;
      return;
    }
    const d = player.movedThisStep;
    if (d <= 0.0005) return;
    this.acc += d;
    const stride = player.running ? 0.95 : 0.72;
    if (this.acc >= stride) {
      this.acc -= stride;
      this.steps++;
      const p = player.position;
      sfx(this.surface(p.x, p.z, player), player.running ? 1 : 0.75);
    }
  }
}

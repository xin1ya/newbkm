/**
 * 自行车骑乘控制（大地图）：
 * - 背包里有「自行车」时，在户外按骑乘键（C）上车 / 下车；面朝可上水的水面时 C 仍然是水上骑乘（互动优先）。
 * - 上车条件：步行、站在地面、不在水里；车速 BIKE_SPEED（11 m/s），可兔跳（空格，车头抬起 / 落地压缩），不能骑进 0.3 m 以上的水。
 * - 强制下车：进入建筑、上水骑乘、钓鱼、遇敌 / 训练家对战、剧情传送、黑屏回城。
 * - 变速：3 档（Q 降档 / X 升档 / 数字 1–3），见 systems/ride BIKE_GEARS；HUD 显示档位与车速。
 * - 模型：Bicycle（按骑手身材生成），骑手由 bikeRiderPose 做 IK（脚踩踏板、手握车把）。
 */
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state/GameState';
import type { PlayerController } from '@/actors/player';
import { Bicycle, bikeRiderPose, measureRider } from '@/actors/player/Bicycle';
import { sfx } from '@/core/audio';
import { bikeGear } from '@/systems/ride';

export const BIKE_ITEM = 'bicycle';

export interface SceneBikeDeps {
  game: Game;
  state: GameState;
  player: PlayerController;
  toast(text: string): void;
}

export class SceneBike {
  bike: Bicycle | null = null;

  constructor(private readonly d: SceneBikeDeps) {}

  get riding(): boolean {
    return this.d.player.mode === 'bike';
  }

  get owned(): boolean {
    return (this.d.state.bag[BIKE_ITEM] ?? 0) > 0;
  }

  toggle(): void {
    if (this.riding) this.dismount();
    else this.mount();
  }

  mount(): boolean {
    const p = this.d.player;
    if (this.riding) return true;
    if (!this.owned) {
      this.d.toast('没有可以骑的东西。（萌芽镇友好商店有卖自行车）');
      return false;
    }
    if (p.mode !== 'walk' || p.hopping) return false;
    if (!p.grounded || p.waterDepth > 0.1) {
      this.d.toast('这里没办法骑自行车。');
      return false;
    }
    const bike = new Bicycle(measureRider(p.model));
    bike.onTick = () => sfx('bike-tick', 0.6);
    p.root.add(bike.root);
    p.model.postPose = bikeRiderPose(bike);
    p.mode = 'bike';
    p.runLatched = false;
    this.bike = bike;
    sfx('bike-bell', 0.8);
    this.d.toast('骑上了自行车！（再按 C 下车）');
    this.d.game.events.emit('ride:change', { mode: 'bike', ride: BIKE_ITEM, speciesId: 0 });
    return true;
  }

  /** 下车；instant = 被场景强制（不提示） */
  dismount(instant = false): void {
    if (!this.riding && !this.bike) return;
    const p = this.d.player;
    this.bike?.dispose();
    this.bike = null;
    p.model.postPose = null;
    p.model.root.position.set(0, 0, 0);
    p.model.root.rotation.set(0, 0, 0);
    if (p.mode === 'bike') p.mode = 'walk';
    if (!instant) sfx('step-ground', 0.8);
    this.d.game.events.emit('ride:change', { mode: 'walk', ride: BIKE_ITEM, speciesId: 0 });
  }

  /** 渲染帧：在玩家模型动画之前调用（IK 读取本帧的车把 / 脚踏位置） */
  update(dt: number): void {
    const p = this.d.player;
    if (!this.bike) return;
    if (p.mode !== 'bike') {
      this.dismount(true);
      return;
    }
    this.bike.gearRatio = bikeGear(p.bikeGear).ratio;
    this.bike.setAir(p.airborne, p.verticalSpeed);
    this.bike.update(dt, Math.hypot(p.velocity.x, p.velocity.z), p.facing);
  }

  dispose(): void {
    this.dismount(true);
  }
}

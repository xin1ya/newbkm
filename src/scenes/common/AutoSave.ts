/**
 * 自动存档：监听关键节点，延迟片刻（等演出 / 对话收尾）后在安全时机写入当前存档位。
 * 触发：任务开始 / 目标推进 / 完成、剧情结束、战斗结束、获得徽章、进化、进出建筑、恢复队伍；另每 5 分钟一次。
 * 安全时机：设置开启、不在战斗 / 遭遇 / 训练家对战、没有剧情在跑、没有模态界面（对话 / 菜单）。
 * 不安全时每秒重试，直到安全为止；连续触发合并为一次。
 */
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state';

export interface AutoSaveDeps {
  game: Game;
  state: GameState;
  /** 场景层判断（战斗等） */
  canSave(): boolean;
  save(): Promise<boolean>;
}

/** 触发后等待的秒数（让结算对话 / 通知先弹完） */
export const AUTOSAVE_DELAY = 1.5;
/** 定时存档间隔（秒） */
export const AUTOSAVE_INTERVAL = 300;

export class AutoSave {
  private pending: number | null = null;
  private sinceLast = 0;
  private saving = false;
  private readonly unsub: (() => void)[] = [];
  /** 调试 / 测试：最近一次自动存档的原因 */
  lastReason: string | null = null;
  private reason: string | null = null;

  constructor(private readonly d: AutoSaveDeps) {
    const ev = d.game.events;
    this.unsub.push(
      ev.on('quest:update', (e) => {
        if (e.kind !== 'available') this.request(`quest:${e.kind}:${e.questId}`);
      }),
      ev.on('story:end', (e) => this.request(`story:${e.id}`)),
      ev.on('battle:end', (e) => this.request(`battle:${e.result}`)),
      ev.on('gym:badge', (e) => this.request(`badge:${e.gym}`)),
      ev.on('pokemon:evolve', () => this.request('evolve')),
      ev.on('interior:enter', (e) => this.request(`enter:${e.interior}`)),
      ev.on('interior:leave', (e) => this.request(`leave:${e.interior}`)),
      ev.on('party:healed', () => this.request('healed')),
      ev.on('game:save', (e) => {
        // 手动存档也算：重置定时器
        if (e.ok) this.sinceLast = 0;
      }),
    );
  }

  /** 请求一次自动存档（合并：取最早的到期时间） */
  request(reason: string): void {
    this.reason = reason;
    if (this.pending === null) this.pending = AUTOSAVE_DELAY;
  }

  private safe(): boolean {
    const { game, state } = this.d;
    if (!state.settings.autoSave) return false;
    if (this.saving || !this.d.canSave()) return false;
    if (game.input.gameplayLocked) return false;
    const top = game.scenes.top?.name;
    return top === 'overworld' || top === 'interior';
  }

  update(dt: number): void {
    this.sinceLast += dt;
    if (this.pending === null && this.sinceLast >= AUTOSAVE_INTERVAL) this.request('interval');
    if (this.pending === null) return;
    this.pending -= dt;
    if (this.pending > 0) return;
    if (!this.safe()) {
      this.pending = 1;
      return;
    }
    this.pending = null;
    this.saving = true;
    this.lastReason = this.reason;
    void this.d.save().finally(() => {
      this.saving = false;
      this.sinceLast = 0;
    });
  }

  dispose(): void {
    for (const u of this.unsub) u();
    this.unsub.length = 0;
  }
}

/**
 * M1-07 · 场景互动宿主（大地图与室内共用）。
 * 每帧：各来源（NPC / 门 / 家具 / 地标 / 封锁点 / 水边）提供候选 → pickInteraction 选出焦点 →
 * 提示气泡（键帽随输入设备切换）→ 按下对应动作键时执行。执行期间锁定，避免同一次按键连续触发。
 */
import * as THREE from 'three';
import { HealMachineFx } from './HealMachineFx';
import type { Game } from '@/core/Game';
import type { Action } from '@/core/input';
import { PAD_LABEL, keyLabel, pickInteraction, resolvePages, type InteractCandidate, type InteractionDef } from '@/systems/interaction';
import type { GameState } from '@/systems/state/GameState';
import { addItem } from '@/systems/state';
import { healFully } from '@/systems/pokemon';
import type { Dex } from '@/systems/data/Dex';
import { choose, say, type Transition, type UiRoot } from '@/ui/core';
import { InteractPrompt } from '@/ui/hud';
import { openPc } from '@/ui/pc/PcScreen';
import { openBlockMachine } from '@/ui/blocks/BlockMachineScreen';
import { createRng } from '@/systems/rng';
import { BREEDER_START, breederLevel } from '@/systems/breeder';
import type { PlayerController } from '@/actors/player';

import { storyDirector } from './StoryDirector';

/** 带执行函数的候选 */
export interface Interactable extends InteractCandidate {
  run?: () => Promise<void> | void;
  /** 同一目标的第二种互动（水边：钓鱼 + 水上骑乘），气泡里并列显示 */
  secondary?: { action: Action; label: string; kind: string; run: () => Promise<void> | void };
  /** 伴随型（水边）：按键与主焦点不同时并入主焦点的气泡，而不是和它抢焦点 */
  companion?: boolean;
}

export type InteractSource = (player: PlayerController, out: Interactable[]) => void;

export interface SceneInteractionsOptions {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  transition: Transition;
  toast?: ((text: string) => void) | undefined;
}

export class SceneInteractions {
  readonly prompt: InteractPrompt;
  private sources: InteractSource[] = [];
  private cands: Interactable[] = [];
  private anchor = new THREE.Vector3();
  focus: Interactable | null = null;
  private running = false;
  /** 执行结束后的冷却（秒）：关闭对话的那次按键不再触发下一次互动 */
  private cooldown = 0;

  constructor(private readonly o: SceneInteractionsOptions) {
    this.prompt = new InteractPrompt(o.ui);
  }

  addSource(src: InteractSource): void {
    this.sources.push(src);
  }

  get busy(): boolean {
    return this.running;
  }

  /** 每帧调用；enabled=false（战斗 / 转场 / UI 打开）时隐藏提示；返回是否本帧触发了互动 */
  update(dt: number, player: PlayerController, camera: THREE.Camera, enabled: boolean): boolean {
    if (this.cooldown > 0) this.cooldown -= dt;
    const prev = this.focus;
    this.focus = null;
    if (enabled && !this.running && !this.o.ui.busy) {
      this.cands.length = 0;
      for (const s of this.sources) s(player, this.cands);
      this.focus = this.pickWithCompanion(player);
    }
    if ((prev?.id ?? null) !== (this.focus?.id ?? null)) this.o.game.events.emit('interact:focus', { id: this.focus?.id ?? null, kind: this.focus?.kind ?? null });
    const f = this.focus;
    if (!f) {
      this.prompt.update(null, camera, this.o.game.width, this.o.game.height);
      return false;
    }
    const a = f.anchor ?? { x: f.x, y: f.y, z: f.z };
    this.anchor.set(a.x, a.y, a.z);
    const key = f.action ? this.keyFor(f.action) : null;
    const sec = f.secondary ? { ...this.keyFor(f.secondary.action), text: f.secondary.label } : undefined;
    this.prompt.update(
      { id: f.id, kind: f.kind, label: f.label, key: key?.label ?? null, pad: key?.pad ?? false, ability: f.ability, hint: f.hint, anchor: this.anchor, secondary: sec },
      camera,
      this.o.game.width,
      this.o.game.height,
    );
    if (this.cooldown > 0) return false;
    const input = this.o.game.input;
    if (f.action && f.run && input.pressed(f.action)) {
      void this.execute(f);
      return true;
    }
    if (f.secondary && input.pressed(f.secondary.action)) {
      const s2 = f.secondary;
      void this.execute({ ...f, id: `${f.id}:${s2.kind}`, kind: s2.kind as Interactable['kind'], run: s2.run });
      return true;
    }
    return false;
  }

  /** 选主焦点；伴随型候选（水边）的按键与主焦点不同则作为第二互动并入 */
  private pickWithCompanion(player: PlayerController): Interactable | null {
    const p = player.position;
    const main = pickInteraction(p.x, p.z, player.facing, this.cands.filter((c) => !c.companion));
    const comp = pickInteraction(p.x, p.z, player.facing, this.cands.filter((c) => c.companion));
    if (!main) return comp;
    if (!comp || main.secondary || !comp.action || !comp.run || comp.action === main.action) return main;
    return { ...main, secondary: { action: comp.action, label: comp.label, kind: comp.kind, run: comp.run } };
  }

  /** 执行互动（也供 e2e 调用） */
  async execute(f: Interactable): Promise<void> {
    if (this.running || !f.run) return;
    this.running = true;
    this.prompt.hide();
    this.o.game.events.emit('interact:use', { id: f.id, kind: f.kind });
    try {
      await f.run();
    } finally {
      this.running = false;
      this.cooldown = 0.25;
    }
  }

  /** 动作 → 当前设备上的键帽文字 */
  keyFor(action: Action): { label: string; pad: boolean } {
    const input = this.o.game.input;
    const b = input.bindings[action];
    if (input.device === 'gamepad' && b.pad?.length) return { label: PAD_LABEL[b.pad[0]!] ?? `#${b.pad[0]}`, pad: true };
    return { label: keyLabel(b.keys[0] ?? '?'), pad: false };
  }

  /** 互动定义的 showIf 判定（家具 / 地标共用） */
  visible(def: InteractionDef): boolean {
    return !def.showIf || this.o.state.flags[def.showIf] === true;
  }

  /** 家具 / 地标：按配置显示文字并执行效果 */
  async runDef(def: InteractionDef): Promise<void> {
    const { ui, state, game } = this.o;
    const { pages, conditional } = resolvePages(def, state.flags, game.clock.timeOfDay === 'night');
    const effects = conditional ? [] : (def.effects ?? []);
    if (def.kind === 'rest' && effects.length) {
      await say(ui, pages);
      const yes = await choose(ui, [
        { label: '休息', value: true },
        { label: '算了', value: false },
      ]);
      if (!yes) return;
    } else {
      await say(ui, pages);
    }
    for (const e of effects) {
      if (e.kind === 'heal-party') {
        const machine = e.machine ? HealMachineFx.current : null;
        if (machine) {
          // 研究所恢复机：玩家自己把球放进去，完整演出
          await machine.play(state.party.length, { onComplete: () => state.party.forEach((p) => healFully(this.o.dex, p)) });
          game.events.emit('party:healed', { source: def.id });
          continue;
        }
        if (e.fade) await this.o.transition.fadeOut(450);
        for (const p of state.party) healFully(this.o.dex, p);
        game.events.emit('party:healed', { source: def.id });
        if (e.fade) {
          await new Promise((r) => setTimeout(r, 350));
          await this.o.transition.fadeIn(450);
        }
      } else if (e.kind === 'give-item') {
        if (state.flags[e.flag]) continue;
        addItem(state, e.item, e.qty);
        state.flags[e.flag] = true;
        game.events.emit('flag:set', { flag: e.flag, value: true });
        await say(ui, [`找到了 ${e.itemName}${e.qty > 1 ? ` ×${e.qty}` : ''}！`, `${state.player.name}把 ${e.itemName} 放进了背包。`]);
      } else if (e.kind === 'advance-clock') {
        // 时间只往前走：目标时刻不晚于现在 → 到第二天（睡一觉，头目冷却按天推进）
        const c = game.clock;
        c.totalMinutes = (c.day + (e.toHour <= c.hour ? 1 : 0)) * 1440 + e.toHour * 60;
      } else if (e.kind === 'story') {
        await storyDirector()?.run(e.script);
      } else if (e.kind === 'pc-storage') {
        await openPc(ui, this.o.dex, state, e.title);
        game.events.emit('party:changed', { source: def.id });
      } else if (e.kind === 'block-machine') {
        // 计划文档 §9.4：培育家 2 级开放能量方块机
        if (breederLevel(state) < 2) {
          await say(ui, state.flags[BREEDER_START] ? ['方块机的旋钮拧不动……', '蒲婆婆说过，成为 2 级培育家再来用。先去收获几次树果吧。'] : ['方块机的旋钮拧不动……', '听说萌芽镇的蒲婆婆很懂培育，拿到徽章后去请教她吧。']);
          continue;
        }
        await openBlockMachine(ui, state, createRng());
      }
    }
    if (!conditional && def.after) await say(ui, def.after);
  }

  dispose(): void {
    this.prompt.dispose();
  }
}

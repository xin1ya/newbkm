/**
 * M1-13 / M1-14 · 剧情导演：逐条执行 config/story 的剧情脚本（纯数据见 systems/story）。
 * - 与场景解耦：战斗 / 传送 / 场景特效通过 StoryHost（大地图注册；室内没有战斗时相应步骤跳过并告警）。
 * - 全局单例：NPC 对话（QuestDialog.story）、互动效果（effect story）、剧情拾取物 / 抵达触发都从这里进入。
 * - 同一时间只执行一段剧情；执行期间 running = true（其他系统据此暂停自动触发）。
 */
import type { Game } from '@/core/Game';
import { sfx } from '@/core/audio';
import type { Dex } from '@/systems/data/Dex';
import { createRng, type Rng } from '@/systems/rng';
import { GIFT_SHINY_CHANCE, createPokemon } from '@/systems/pokemon';
import { addItem, markCaught, markSeen, receivePokemon, type GameState } from '@/systems/state';
import type { StoryFx, StoryScript, StoryStep } from '@/systems/story';
import type { IslandId } from '@/systems/state/GameState';
import { flagsAll } from '@/systems/story';
import { createMonModel } from '@/actors/pokemon/monModel';
import { activeStarterTable } from './StarterTable';
import { STORY_SCRIPTS, STARTER_CARDS } from '@/config/story';
import { say, choose, type UiRoot, type Transition } from '@/ui/core';
import { StoryOverlay, pickStarter, showHallOfFame, browseHallOfFame } from '@/ui/story';
import { recordHallOfFame } from '@/systems/league';

export type StoryBattleResult = 'win' | 'lose' | 'run' | 'capture';

export interface StoryHost {
  readonly kind: 'overworld' | 'interior';
  battle?(o: { species: number; level: number; moves?: string[] | undefined; noCapture?: boolean | undefined; noRun?: boolean | undefined; boss?: boolean | undefined }): Promise<StoryBattleResult>;
  teleport?(x: number, z: number, yaw: number): Promise<void>;
  /** M2-01 前往另一座岛 */
  travel?(island: IslandId, x: number, z: number, yaw: number): Promise<void>;
  /** 场景内特效（灯塔点亮、雾散、烟雾……）；没有实现时忽略 */
  fx?(name: StoryFx, ms: number): Promise<void>;
  /** 送回最后的安全位置 */
  pushBack?(): Promise<void>;
}

export interface StoryDeps {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  rng: Rng;
  transition: Transition;
  toast(text: string): void;
  /** 当前活动场景的宿主 */
  host(): StoryHost | null;
  itemName(id: string): string;
}

let current: StoryDirector | null = null;

/** 全局剧情导演（boot 前为 null） */
export function storyDirector(): StoryDirector | null {
  return current;
}

/** boot 时注册（传 null 注销） */
export function registerStoryDirector(d: StoryDirector | null): void {
  current = d;
}

export class StoryDirector {
  readonly overlay: StoryOverlay;
  running: string | null = null;
  /** 已执行完成的脚本（e2e / 调试） */
  readonly history: string[] = [];

  constructor(private readonly d: StoryDeps) {
    this.overlay = new StoryOverlay(d.ui);
  }

  has(id: string): boolean {
    return STORY_SCRIPTS.has(id);
  }

  async run(id: string): Promise<boolean> {
    const script: StoryScript | undefined = STORY_SCRIPTS.get(id);
    if (!script) {
      console.warn(`[story] 未知剧情脚本 ${id}`);
      return false;
    }
    if (this.running) return false;
    this.running = id;
    this.d.game.events.emit('story:start', { id });
    try {
      await this.steps(script.steps);
    } finally {
      this.running = null;
      this.history.push(id);
      this.d.game.events.emit('story:end', { id });
    }
    return true;
  }

  private setFlag(f: string): void {
    const { state, game } = this.d;
    if (state.flags[f]) return;
    state.flags[f] = true;
    game.events.emit('flag:set', { flag: f, value: true });
  }

  private async steps(list: readonly StoryStep[]): Promise<void> {
    for (const s of list) await this.step(s);
  }

  private async step(s: StoryStep): Promise<void> {
    const { ui, state, dex, rng, game } = this.d;
    const host = this.d.host();
    switch (s.kind) {
      case 'say':
        await say(ui, s.lines, s.speaker ? { speaker: s.speaker } : {});
        return;
      case 'narrate':
        await this.overlay.narrate(s.lines, s.voice);
        return;
      case 'flag':
        this.setFlag(s.set);
        return;
      case 'var': {
        state.vars[s.name] = (state.vars[s.name] ?? 0) + s.add;
        game.events.emit('var:change', { name: s.name, value: state.vars[s.name] ?? 0 });
        return;
      }
      case 'unflag':
        for (const f of s.clear) {
          if (!state.flags[f]) continue;
          delete state.flags[f];
          game.events.emit('flag:set', { flag: f, value: false });
        }
        return;
      case 'hall-of-fame': {
        if (s.browse) {
          if (state.hallOfFame?.length) await browseHallOfFame(ui, dex, state.hallOfFame, state.player.name);
          else await say(ui, ['名人堂记录机里还没有任何记录。']);
          return;
        }
        const entry = recordHallOfFame(state);
        await showHallOfFame(ui, dex, entry, state.player.name);
        return;
      }
      case 'item':
        addItem(state, s.id, s.qty);
        sfx('item');
        this.d.toast(`获得了 ${this.d.itemName(s.id)}${s.qty > 1 ? ` ×${s.qty}` : ''}！`);
        return;
      case 'starter': {
        const infos = STARTER_CARDS.filter((c) => s.species.includes(c.species));
        // 研究所桌上的精灵球：选中的球上方投影该宝可梦的全息模型
        const table = activeStarterTable();
        const makeHolo = (id: number) => createMonModel(dex, createPokemon(dex, id, s.level, createRng(id)), { height: 0.75 }) // 独立 rng：不影响正式领取的个体值;
        table?.beginSelection();
        let species: number;
        try {
          species = await pickStarter(ui, dex, infos, (id) => table?.select(id, makeHolo), table ? (x, y) => table.pick(x, y) : undefined);
        } finally {
          table?.endSelection();
        }
        table?.take(species);
        const mon = createPokemon(dex, species, s.level, rng, { ot: state.player.name, shiny: rng.chance(GIFT_SHINY_CHANCE) });
        receivePokemon(state, mon);
        markSeen(state, species);
        markCaught(state, species);
        for (const other of s.species) markSeen(state, other);
        this.setFlag(`starter-${species}`);
        sfx('item');
        await say(ui, [`${state.player.name}得到了${dex.species(species).name.zh}！`]);
        this.setFlag('starter-chosen');
        return;
      }
      case 'battle': {
        if (!host?.battle) {
          console.warn('[story] 当前场景不支持剧情战斗，按胜利处理');
          await this.steps(s.onWin ?? []);
          return;
        }
        if (!state.party.some((p) => p.hp > 0)) {
          await say(ui, ['宝可梦们都没有力气了……先去治疗吧。']);
          return;
        }
        const r = await host.battle({ species: s.species, level: s.level, moves: s.moves, noCapture: s.noCapture, noRun: s.noRun, boss: s.boss });
        await this.steps(r === 'win' || r === 'capture' ? (s.onWin ?? []) : (s.onLose ?? []));
        return;
      }
      case 'fx':
        await this.fx(s.name, s.ms ?? 0, host);
        return;
      case 'wait':
        await new Promise<void>((r) => setTimeout(r, s.ms));
        return;
      case 'card':
        await this.overlay.card(s.title, s.subtitle, s.ms);
        return;
      case 'teleport':
        if (host?.teleport) await host.teleport(s.x, s.z, s.yaw ?? 0);
        return;
      case 'travel':
        if (host?.travel) await host.travel(s.island, s.x, s.z, s.yaw ?? 0);
        return;
      case 'pushBack':
        if (host?.pushBack) await host.pushBack();
        return;
      case 'if':
        await this.steps(flagsAll(state.flags, s.flags) ? s.then : (s.else ?? []));
        return;
      case 'choice': {
        if (s.prompt) await say(ui, [s.prompt]);
        const i = await choose(ui, s.options.map((o, k) => ({ label: o.label, value: k })), { cancellable: false });
        await this.steps(s.options[i ?? 0]?.steps ?? []);
        return;
      }
    }
  }

  private async fx(name: StoryFx, ms: number, host: StoryHost | null): Promise<void> {
    const t = this.d.transition;
    switch (name) {
      case 'dream-in':
        await this.overlay.dreamIn(ms || 1200);
        return;
      case 'dream-out':
        await this.overlay.dreamOut(ms || 900);
        return;
      case 'flash':
        sfx('confirm', 0.6);
        await this.overlay.flash(ms || 320);
        return;
      case 'fade-out':
        await t.fadeOut(ms || 500);
        return;
      case 'fade-in':
        await t.fadeIn(ms || 500);
        return;
      default:
        if (host?.fx) await host.fx(name, ms || 900);
        else if (name === 'poof' || name === 'lighthouse') await this.overlay.flash(ms || 300);
    }
  }

  dispose(): void {
    this.overlay.dispose();
    if (current === this) registerStoryDirector(null);
  }
}

/**
 * M1-20 · 音乐 / 环境音导演。每帧（afterUpdate）读取当前场景的音频情境：
 *
 * - BGM：战斗 > 凯旋曲 > 室内 > 水上骑乘 > 区域（pickBgm），换区域时交叉淡入淡出；
 *   战斗由 battle:start / battle:victory 事件驱动，回到大地图后自动恢复。
 * - 训练家发现视线：播放「发现」短旋律（jingle-spotted），随后进入训练家战斗曲。
 * - 夜间：BGM 总线低通 + 略降音量（setNight，随时钟平滑过渡）。
 * - 环境音：每 0.5 s 在玩家周围采样海 / 湖比例、海拔、天气、时段，混出风 / 鸟 / 虫 / 浪 / 雨等层。
 * - 音量设置变化时同步；页面隐藏时挂起音频上下文。
 */
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state/GameState';
import type { FieldWeather, TimeOfDay } from '@/systems/encounters';
import { ambienceMix, pickBgm, waterProximity, type BattleKind } from '@/systems/audio/select';
import { resolveBgm } from '@/config/audio/music';
import { audio, jingle } from '@/core/audio';

export interface AudioContextInfo {
  /** 当前是否在战斗场景里 */
  inBattle: boolean;
  interiorBgm: string | null;
  indoor: 'room' | 'cave' | 'undersea' | null;
  zoneBgm: string | null;
  zoneKind: 'town' | 'wild' | 'sea' | 'dungeon-entrance' | null;
  surfing: boolean;
  time: TimeOfDay;
  weather: FieldWeather;
  player: { x: number; y: number; z: number };
  waterAt(x: number, z: number): { depth: number; body: string } | null;
}

export interface AudioDirectorDeps {
  game: Game;
  state: GameState;
  context(): AudioContextInfo | null;
}

const RING = [4, 9, 16];
const DIRS = 8;

export class AudioDirector {
  battle: BattleKind | null = null;
  victory: BattleKind | null = null;
  /** 调试：最近一次选择的 BGM / 环境音混音 */
  wanted: string | null = null;
  mix: Record<string, number> = {};
  private ambT = 0;
  private volKey = '';
  private night = -1;
  private unsub: (() => void)[] = [];
  private onVis = () => {
    const a = audio();
    if (!a) return;
    if (document.hidden) a.suspend();
    else a.resume();
  };

  constructor(private readonly d: AudioDirectorDeps) {
    const ev = d.game.events;
    this.unsub.push(
      ev.on('battle:start', (e) => {
        this.battle = e.kind;
        this.victory = null;
      }),
      ev.on('battle:victory', (e) => {
        this.victory = e.kind;
      }),
      ev.on('trainer:spotted', (e) => {
        if (e.how === 'spotted') void jingle('jingle-spotted');
      }),
    );
    document.addEventListener('visibilitychange', this.onVis);
  }

  update(dt: number): void {
    const eng = audio();
    const ctx = this.d.context();
    if (!eng || !ctx) return;
    if (!ctx.inBattle && (this.battle || this.victory)) {
      this.battle = null;
      this.victory = null;
    }
    // 音量
    const v = this.d.state.settings.volume;
    const key = `${v.master}|${v.bgm}|${v.sfx}|${v.ambient}`;
    if (key !== this.volKey) {
      this.volKey = key;
      eng.setVolumes(v);
    }
    // BGM
    const id = resolveBgm(
      pickBgm({ battle: ctx.inBattle ? this.battle : null, victory: ctx.inBattle ? this.victory : null, surfing: ctx.surfing, interiorBgm: ctx.interiorBgm, zoneBgm: ctx.zoneBgm }),
    );
    if (id !== this.wanted) {
      this.wanted = id;
      eng.playBgm(id, ctx.inBattle && this.battle && !this.victory ? 0.35 : 1.6);
    }
    // 夜间低通（室内 / 战斗不加）
    const hour = this.d.game.clock.hour;
    const nightK = ctx.indoor || ctx.inBattle ? 0 : Math.max(0, Math.min(1, Math.max((hour - 19) / 1.5, (5.5 - hour) / 1.5)));
    if (Math.abs(nightK - this.night) > 0.02) {
      this.night = nightK;
      eng.setNight(nightK);
    }
    // M3-18 海底：整体低通（战斗中恢复清晰）
    eng.setUnderwater(ctx.indoor === 'undersea' && !ctx.inBattle ? 1 : 0);
    // 环境音
    this.ambT -= dt;
    if (this.ambT > 0) return;
    this.ambT = 0.5;
    const samples: { depth: number; sea: boolean; river: boolean }[] = [];
    if (!ctx.indoor) {
      const p = ctx.player;
      for (const r of RING)
        for (let i = 0; i < DIRS; i++) {
          const a = (i / DIRS) * Math.PI * 2;
          const w = ctx.waterAt(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r);
          samples.push({ depth: w?.depth ?? 0, sea: w?.body === 'sea', river: !!w && /river|creek|stream/.test(w.body) });
        }
    }
    const wp = waterProximity(samples);
    this.mix = ambienceMix({
      indoor: ctx.indoor,
      zoneKind: ctx.zoneKind,
      zoneBgm: ctx.zoneBgm,
      time: ctx.time,
      weather: ctx.weather,
      sea: wp.sea,
      fresh: wp.fresh,
      river: wp.river,
      altitude: Math.max(0, ctx.player.y),
      surfing: ctx.surfing,
      battle: ctx.inBattle,
    });
    eng.setAmbience(this.mix as Parameters<typeof eng.setAmbience>[0]);
  }

  dispose(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    document.removeEventListener('visibilitychange', this.onVis);
  }
}

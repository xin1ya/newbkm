/**
 * M1-10 · 训练家对战导演（大地图）：
 * - 视线：每 0.12 s 检查未击败训练家（锥形视野 + 地形遮挡），发现玩家 → 头顶「!」→ 快步走到面前
 *   → 玩家被定住并转身 → 开场白 → 对战（训练家在战斗场对面登场、扔球）
 * - 对话：面对未击败训练家按互动键同样发起对战；击败后是普通 NPC 对话（after 台词）
 * - 结果：胜利置位 trainer-defeated:<id>（flag:set → 任务 defeat 触发）并走回原位；失败保持未击败
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import type { GameState } from '@/systems/state';
import { approachPoint, buildTrainerParty, canSee, isDefeated, terrainBlocks, trainerFlag, trainerInfo, type TrainerDef } from '@/systems/trainers';
import { TRAINER_BY_ID } from '@/config/trainers';
import { GYMS } from '@/config/encounters';
import { badgesOnIsland, buildGymTeam, gymTier } from '@/systems/encounters';
import type { Npc } from '@/actors/npc';
import type { PlayerController } from '@/actors/player';
import { say, type UiRoot } from '@/ui/core';
import type { BattleStartData, BattleTrainerActor } from '@/scenes/battle/BattleScene';
import type { SceneNpcs } from './SceneNpcs';

export interface TrainerBattlesOptions {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  rng: Rng;
  npcs: SceneNpcs;
  player: PlayerController;
  heightAt(x: number, z: number): number;
  /** 当前是否允许被发现（不在战斗 / 菜单 / 过门 / 对话中） */
  canSpot(): boolean;
  startBattle(data: BattleStartData): void;
  /** 胜利后训练家回原位的方式：walk（大地图，走回去）/ snap（道馆：原位不可达时直接归位） */
  returnHome?: 'walk' | 'snap';
}

const SCAN_EVERY = 0.12;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TrainerBattles {
  static current: TrainerBattles | null = null;
  /** 正在进行的训练家演出 / 对战（大地图据此锁定玩家输入） */
  active: { npc: Npc; def: TrainerDef; phase: 'spotted' | 'approach' | 'intro' | 'battle' } | null = null;
  /** 最近一次发现玩家的训练家（e2e） */
  lastSpotted: string | null = null;
  private scan = 0;
  private cooldown = 0;

  constructor(private readonly o: TrainerBattlesOptions) {
    TrainerBattles.current = this;
    o.npcs.beforeTalk = (npc) => {
      const def = npc.def.trainer ? TRAINER_BY_ID.get(npc.def.trainer) : undefined;
      if (!def || isDefeated(o.state.flags, def.id) || this.active) return false;
      void this.engage(npc, def, 'talk');
      return true;
    };
  }

  get busy(): boolean {
    return this.active !== null;
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.scan -= dt;
    if (this.scan > 0 || this.active || this.cooldown > 0 || !this.o.canSpot()) return;
    this.scan = SCAN_EVERY;
    const p = this.o.player.position;
    for (const npc of this.o.npcs.manager.npcs.values()) {
      const id = npc.def.trainer;
      if (!id || npc.talking) continue;
      const def = TRAINER_BY_ID.get(id);
      if (!def || isDefeated(this.o.state.flags, id)) continue;
      const seen = canSee({
        trainer: { x: npc.position.x, z: npc.position.z, yaw: npc.yaw },
        player: { x: p.x, z: p.z },
        sight: def.sight,
        blocked: (x0, z0, x1, z1) => terrainBlocks(this.o.heightAt, x0, z0, x1, z1),
      });
      if (seen) {
        void this.engage(npc, def, 'spotted');
        return;
      }
    }
  }

  /** 发起对战（视线发现 / 对话）；也供 e2e 调用 */
  async engage(npc: Npc, def: TrainerDef, how: 'spotted' | 'talk'): Promise<void> {
    if (this.active) return;
    const { player, state, ui, game } = this.o;
    this.active = { npc, def, phase: 'spotted' };
    this.lastSpotted = def.id;
    player.velocity.set(0, 0, 0);
    const faceEach = () => {
      const pp = player.position;
      npc.face(Math.atan2(pp.x - npc.position.x, pp.z - npc.position.z));
      player.teleport(pp.x, pp.z, Math.atan2(npc.position.x - pp.x, npc.position.z - pp.z));
    };
    game.events.emit('trainer:spotted', { trainer: def.id, how });
    try {
      // 1. 「!」+ 转身
      npc.emote.show('!', 1.1);
      npc.face(Math.atan2(player.position.x - npc.position.x, player.position.z - npc.position.z));
      await wait(how === 'spotted' ? 750 : 350);
      // 2. 走到面前
      if (how === 'spotted') {
        this.active.phase = 'approach';
        const to = approachPoint(npc.position, player.position, 1.8);
        npc.face(null);
        await Promise.race([npc.walkTo(to.x, to.z, 3.6), wait(4500)]);
      }
      faceEach();
      // 3. 开场白
      this.active.phase = 'intro';
      await say(ui, def.intro, { speaker: `${def.title} ${def.name}` });
      if (!state.party.some((m) => m.hp > 0)) {
        await say(ui, ['……你没有能战斗的宝可梦？', '先去宝可梦中心吧，我等你！'], { speaker: `${def.title} ${def.name}` });
        this.finish(npc, false);
        return;
      }
      // 4. 对战
      this.active.phase = 'battle';
      const actor: BattleTrainerActor = {
        walkTo: (x, z, speed) => npc.walkTo(x, z, speed),
        setPose: (x, z, yaw) => {
          npc.setPose(x, z, yaw);
          npc.face(yaw);
        },
        gesture: (kind) => npc.playGesture(kind, kind === 'throw' ? 0.8 : kind === 'slump' ? 1.4 : 1.1),
        root: npc.root,
        handPosition: () => npc.model.bones.armR.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.35, 0)),
      };
      const { info, party } = this.partyFor(def);
      this.o.startBattle({
        kind: 'trainer',
        trainer: info,
        party,
        foePosition: { x: npc.position.x, y: npc.position.y, z: npc.position.z },
        entityId: -1,
        defeatLines: def.defeat,
        entrance: def.entrance,
        trainerActor: actor,
      });
    } catch (err) {
      console.error('[trainer] 对战演出异常', err);
      this.finish(npc, false);
    }
  }

  /**
   * 对战队伍：普通训练家按 TrainerDef；道馆馆主按 GymDef 与本岛已有徽章数（设计 §5.4 动态等级），
   * 奖金与携带道具也取自 GymDef。
   */
  partyFor(def: TrainerDef): { info: ReturnType<typeof trainerInfo>; party: ReturnType<typeof buildTrainerParty> } {
    const gym = def.gym ? GYMS.find((g) => g.id === def.gym) : undefined;
    if (!gym) return { info: trainerInfo(def), party: buildTrainerParty(this.o.dex, def, this.o.rng) };
    const tier = gymTier(gym, badgesOnIsland(GYMS, gym.island, this.o.state.flags, gym.id));
    const party = buildGymTeam(this.o.dex, gym, tier, this.o.rng);
    for (const p of party) p.ot = def.name;
    return { info: { ...trainerInfo(def), prizeMoney: gym.prizeMoney, ...(gym.items ? { items: gym.items } : {}) }, party };
  }

  /** 战斗结束（host.afterBattle 调用） */
  onBattleEnd(result: 'win' | 'lose' | 'run' | 'capture', trainerId: string | undefined): void {
    const a = this.active;
    if (!a) return;
    const won = result === 'win' && trainerId === a.def.id;
    this.finish(a.npc, won);
  }

  private finish(npc: Npc, won: boolean): void {
    const a = this.active;
    this.active = null;
    this.cooldown = 2.5;
    npc.face(null);
    if (won && a) {
      const f = trainerFlag(a.def.id);
      this.o.state.flags[f] = true;
      this.o.game.events.emit('flag:set', { flag: f, value: true });
      if (this.o.returnHome === 'snap') {
        const h = npc.home;
        npc.setPose(h.x, h.z, h.yaw);
      } else void npc.returnHome();
    } else {
      // 失败 / 取消：训练家回到原位继续守着（黑屏后回来还会再被发现）
      const h = npc.home;
      npc.setPose(h.x, h.z, h.yaw);
    }
  }
}

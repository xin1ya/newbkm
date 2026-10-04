/**
 * 自动战斗（大地图场景层）：
 * - 进入野外区域（有遇敌表）时右侧显示卡片：区域可出现的宝可梦 + 努力值 + 已选目标 + 状态
 * - K 打开设置（AutoBattleSettings）：勾选目标（打倒 / 捕捉）、球、招式、HP / PP 阈值与道具 → 开始
 * - 自动寻敌：在当前区域内找最近的目标野生个体（排除头目、巢穴、水栖、刚逃过的个体）并跑过去接触；
 *   附近没有目标时在区域内随机巡游（草丛暗雷同样会遇敌，非目标自动逃跑）
 * - 卡住检测：2 s 内几乎没移动 → 拉黑该个体 20 s，换方向巡游
 * - 战斗中由 BattleScene 通过 BattleAutoPilot 接管指令（decideAutoAction）
 * - 停止条件：玩家按移动键 / K 停止；离开区域；首发倒下且没有能战斗的宝可梦；HP 低且回复道具用完；
 *   捕捉目标的球用完；战斗中按 Esc 接管；进入室内 / 骑乘飞行 / 冲浪
 * - 自动骑车：目标 / 巡游点较远时自动骑上自行车（有车时）
 * - 回宝可梦中心：回复道具用完 / PP 用完 / 首发倒下时，飞回最近的宝可梦中心治疗，再飞回原地继续（需要能飞行）
 * - 配置保存在 Platform.storage 偏好（cuilan.autobattle）
 */
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state/GameState';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import type { PlayerController } from '@/actors/player';
import { RUN_SPEED } from '@/actors/player/PlayerController';
import type { SpawnManager } from '@/world/spawns/SpawnManager';
import type { ZoneMap } from '@/world/island/ZoneMap';
import { pointInPolygon } from '@/world/island/ZoneMap';
import type { ZoneConfig } from '@/config/islands/types';
import type { EncounterTable } from '@/systems/encounters';
import { behaviorOf } from '@/config/encounters/behavior';
import { BERRY_BY_ID } from '@/config/berries';
import { AUTO_BALLS, AUTO_HEAL_ITEMS, AUTO_PP_ITEMS, sanitizeAutoConfig, type AutoBattleConfig, type AutoGoal } from '@/systems/autobattle';
import type { BattleAutoPilot, BattleResult } from '@/scenes/battle/BattleScene';
import type { UiRoot } from '@/ui/core/UiRoot';
import { AutoBattleCard, AutoBattleSettings, type AutoZoneSpecies } from '@/ui/hud/AutoBattlePanel';
import { displayName, maxHp } from '@/systems/pokemon';
import { sfx } from '@/core/audio';

const STORE_KEY = 'cuilan.autobattle';
const STAT_ZH: Record<string, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
const WEATHER_ZH: Record<string, string> = { clear: '晴天', rain: '雨天', fog: '雾天', snow: '雪天', storm: '暴风雨', sandstorm: '沙暴', anomaly: '异象' };
/** 寻敌半径（m） */
const SEEK_RADIUS = 70;
const STUCK_TIME = 2;
const BLACKLIST_S = 20;

export interface SceneAutoBattleDeps {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  rng: Rng;
  player: PlayerController;
  spawns: SpawnManager;
  zones: ZoneMap;
  tableOf(zone: ZoneConfig): EncounterTable | undefined;
  inBounds(x: number, z: number): boolean;
  /** 该点可以步行到达（陆地、非深水、坡度可走） */
  walkable(x: number, z: number): boolean;
  toast(text: string): void;
  /** 大地图空闲（非战斗 / 对话 / 菜单 / 过场） */
  idle(): boolean;
  /** 不能自动的状态（飞行 / 冲浪 / 室内）返回原因 */
  blocked(): string | null;
  /** 静默骑上自行车（没有车 / 不能骑返回 false） */
  mountBike(): boolean;
  /** 飞回最近的宝可梦中心治疗再飞回原地；失败返回原因 */
  healTrip(): Promise<string | null>;
}

export class SceneAutoBattle implements BattleAutoPilot {
  config: AutoBattleConfig;
  private running = false;
  private zoneId: string | null = null;
  private card: AutoBattleCard;
  private settingsOpen = false;
  private targetId: number | null = null;
  private wander: { x: number; z: number; t: number } | null = null;
  private stuck = { t: 0, x: 0, z: 0 };
  private blacklist = new Map<number, number>();
  private time = 0;
  private status = '待机';
  private why: string | null = null;
  private cardTimer = 0;
  /** 正在飞回宝可梦中心 */
  private tripping = false;
  /** 本次自动的战绩 */
  readonly tally = { battles: 0, defeated: 0, captured: 0, fled: 0 };

  constructor(private readonly d: SceneAutoBattleDeps) {
    this.config = this.load();
    this.card = new AutoBattleCard(d.ui, d.dex);
  }

  get active(): boolean {
    return this.running;
  }

  private load(): AutoBattleConfig {
    try {
      return sanitizeAutoConfig(JSON.parse(this.d.game.platform.storage.getPref(STORE_KEY) ?? 'null'));
    } catch {
      return sanitizeAutoConfig(null);
    }
  }

  private save(): void {
    try {
      this.d.game.platform.storage.setPref(STORE_KEY, JSON.stringify(this.config));
    } catch {
      /* 隐私模式等：忽略 */
    }
  }

  goalFor(speciesId: number, alpha: boolean): AutoGoal | null {
    if (alpha) return null;
    return this.config.targets[speciesId] ?? null;
  }

  // ———————————————————— 区域信息 ————————————————————

  private zone(): ZoneConfig | null {
    const p = this.d.player.position;
    const z = this.d.zones.at(p.x, p.z);
    return z && z.kind === 'wild' && this.d.tableOf(z) ? z : null;
  }

  zoneSpecies(z: ZoneConfig): AutoZoneSpecies[] {
    const table = this.d.tableOf(z);
    if (!table) return [];
    const map = new Map<number, AutoZoneSpecies & { notes: Set<string>; land: boolean }>();
    for (const e of table.entries) {
      const sp = this.d.dex.species(e.speciesId);
      const land = !e.methods || e.methods.includes('visible') || e.methods.includes('grass');
      let cur = map.get(e.speciesId);
      if (!cur) {
        const ev = Object.entries(sp.evYield)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${STAT_ZH[k] ?? k}+${v}`)
          .join(' ');
        cur = { speciesId: e.speciesId, name: sp.name.zh, levels: [e.levels[0], e.levels[1]], ev: ev || '—', note: '', waterOnly: false, notes: new Set(), land: false };
        map.set(e.speciesId, cur);
      }
      cur.levels = [Math.min(cur.levels[0], e.levels[0]), Math.max(cur.levels[1], e.levels[1])];
      if (land) cur.land = true;
      if (e.time === 'day') cur.notes.add('白天');
      if (e.time === 'night') cur.notes.add('夜晚');
      for (const w of e.weather ?? []) cur.notes.add(WEATHER_ZH[w] ?? w);
      if (e.formation === 'rare') cur.notes.add('稀有');
      if (e.formation === 'group') cur.notes.add('成群');
    }
    return [...map.values()].map((s) => ({
      speciesId: s.speciesId,
      name: s.name,
      levels: s.levels,
      ev: s.ev,
      note: [...s.notes].join(' / '),
      waterOnly: !s.land || behaviorOf(s.speciesId).habitat === 'water',
    }));
  }

  private levelText(z: ZoneConfig): string {
    return z.levelRange ? `Lv.${z.levelRange[0]}–${z.levelRange[1]}` : '';
  }

  private refreshCard(): void {
    const z = this.zone();
    if (!z || !this.d.idle()) {
      this.card.hide();
      return;
    }
    this.card.show({ zoneName: z.name, levelRange: this.levelText(z), species: this.zoneSpecies(z), config: this.config, running: this.running, status: this.status, why: this.why });
  }

  // ———————————————————— 设置面板 ————————————————————

  async openSettings(): Promise<void> {
    if (this.settingsOpen) return;
    const z = this.zone();
    if (!z) {
      this.d.toast('自动战斗只能在有野生宝可梦的野外区域使用。');
      return;
    }
    const { dex, state } = this.d;
    const lead = state.party.find((p) => p.hp > 0) ?? state.party[0];
    const itemName = (id: string) => dex.item(id)?.name.zh ?? BERRY_BY_ID.get(id)?.name ?? id;
    const opt = (ids: readonly string[]) => ids.map((id) => ({ id, name: itemName(id), qty: state.bag[id] ?? 0 }));
    this.settingsOpen = true;
    const w = this.d.ui.push(
      new AutoBattleSettings(this.d.ui, dex, {
        zoneName: z.name,
        levelRange: this.levelText(z),
        species: this.zoneSpecies(z),
        config: this.config,
        running: this.running,
        balls: opt(AUTO_BALLS).filter((b) => b.qty > 0 || b.id === 'poke-ball'),
        heal: opt(AUTO_HEAL_ITEMS),
        pp: opt(AUTO_PP_ITEMS),
        leadName: lead ? displayName(dex, lead) : '—',
        moves: (lead?.moves ?? []).map((m, index) => ({ index, name: dex.move(m.id).name.zh, pp: m.pp, maxPp: m.maxPp, damaging: this.isAttack(m.id) })),
      }),
    );
    const r = await w.done;
    this.settingsOpen = false;
    this.config = r.config;
    this.save();
    if (r.action === 'start') this.start();
    else if (r.action === 'stop') this.stop('已停止');
    this.refreshCard();
  }

  start(): void {
    const why = this.d.blocked();
    if (why) {
      this.d.toast(why);
      return;
    }
    const z = this.zone();
    if (!z) return;
    if (!Object.keys(this.config.targets).length) {
      this.d.toast('先勾选至少一个目标。');
      return;
    }
    if (!this.d.state.party.some((p) => p.hp > 0)) {
      this.d.toast('没有能战斗的宝可梦。');
      return;
    }
    this.running = true;
    this.zoneId = z.id;
    this.targetId = null;
    this.wander = null;
    this.why = null;
    this.status = '寻找目标中';
    this.stuck = { t: 0, x: this.d.player.position.x, z: this.d.player.position.z };
    Object.assign(this.tally, { battles: 0, defeated: 0, captured: 0, fled: 0 });
    sfx('confirm', 0.7);
    this.d.toast(`自动战斗开始：${this.describeTargets()}`);
    this.refreshCard();
  }

  private describeTargets(): string {
    return Object.entries(this.config.targets)
      .map(([id, g]) => `${this.d.dex.species(Number(id)).name.zh}（${g === 'capture' ? '捕捉' : '打倒'}）`)
      .join('、');
  }

  stop(reason: string): void {
    if (!this.running) return;
    this.running = false;
    this.targetId = null;
    this.wander = null;
    this.why = reason;
    this.status = '已停止';
    this.d.player.velocity.set(0, 0, 0);
    const t = this.tally;
    this.d.toast(`自动战斗停止：${reason}（战斗 ${t.battles} 场 · 打倒 ${t.defeated} · 捕捉 ${t.captured} · 逃跑 ${t.fled}）`);
    this.refreshCard();
  }

  // ———————————————————— 每步 ————————————————————

  /** K 键（打开设置；运行中按 K 也是打开设置，面板里可停止） */
  onKey(): void {
    void this.openSettings();
  }

  /**
   * 固定步：运行中时驱动玩家移动，返回 true 表示本步已接管移动（场景不再用玩家输入驱动）。
   * moving = 玩家本步按了移动键（视为接管 → 停止）。
   */
  fixedUpdate(dt: number, moving: boolean): boolean {
    this.time += dt;
    this.cardTimer -= dt;
    if (this.cardTimer <= 0) {
      this.cardTimer = 0.5;
      this.refreshCard();
    }
    if (!this.running) return false;
    if (this.tripping) return true;
    if (moving) {
      this.stop('手动移动');
      return false;
    }
    if (!this.d.idle()) return false;
    const why = this.d.blocked();
    if (why) {
      this.stop(why);
      return false;
    }
    const p = this.d.player.position;
    const z = this.d.zones.at(p.x, p.z);
    if (!z || z.id !== this.zoneId) {
      // 离开区域：往区域中心走回去（巡游越界时）
      const home = this.d.zones.get(this.zoneId ?? '');
      if (!home) {
        this.stop('离开了区域');
        return false;
      }
      const c = centroid(home);
      this.drive(dt, c.x, c.z);
      this.status = '回到区域内';
      return true;
    }
    for (const [id, until] of this.blacklist) if (until < this.time) this.blacklist.delete(id);
    const target = this.pickTarget();
    if (target) {
      this.targetId = target.id;
      this.wander = null;
      const tp = target.root.position;
      this.status = `前往 ${this.d.dex.species(target.mon.speciesId).name.zh}`;
      this.drive(dt, tp.x, tp.z, target.id);
      return true;
    }
    this.targetId = null;
    // 巡游
    if (!this.wander || this.wander.t < this.time || Math.hypot(this.wander.x - p.x, this.wander.z - p.z) < 2) this.wander = this.pickWander(z);
    this.status = '巡游寻找目标';
    if (this.wander) this.drive(dt, this.wander.x, this.wander.z);
    return true;
  }

  private drive(dt: number, tx: number, tz: number, entity?: number): void {
    const pl = this.d.player;
    const p = pl.position;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const l = Math.hypot(dx, dz);
    if (pl.mode === 'walk' && l > 14 && pl.grounded && this.d.mountBike()) this.status += '（骑车）';
    const speed = pl.mode === 'bike' ? 9 : RUN_SPEED;
    const k = l > 0.01 ? Math.min(1, l / 1.5) : 0;
    pl.moveWithVelocity(dt, (dx / (l || 1)) * speed * k, (dz / (l || 1)) * speed * k, true);
    // 卡住检测
    this.stuck.t += dt;
    if (this.stuck.t >= STUCK_TIME) {
      const moved = Math.hypot(p.x - this.stuck.x, p.z - this.stuck.z);
      if (moved < 1.2) {
        if (entity !== undefined) this.blacklist.set(entity, this.time + BLACKLIST_S);
        this.wander = this.pickWander(this.d.zones.get(this.zoneId ?? '') ?? null, true);
      }
      this.stuck = { t: 0, x: p.x, z: p.z };
    }
  }

  private pickTarget() {
    const p = this.d.player.position;
    let best = null;
    let bd = SEEK_RADIUS;
    for (const w of this.d.spawns.wild.values()) {
      if (w.frozen || w.denId || w.mon.alpha || w.habitat === 'water' || w.zoneId !== this.zoneId) continue;
      if (!this.config.targets[w.mon.speciesId] || this.blacklist.has(w.id)) continue;
      if (w.brain.state === 'flee') continue;
      const dd = Math.hypot(w.root.position.x - p.x, w.root.position.z - p.z);
      // 正在追的目标稍微优先（避免两只之间来回切换）
      const score = w.id === this.targetId ? dd * 0.7 : dd;
      if (score < bd) {
        bd = score;
        best = w;
      }
    }
    return best;
  }

  private pickWander(z: ZoneConfig | null, away = false): { x: number; z: number; t: number } | null {
    if (!z) return null;
    const p = this.d.player.position;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, y] of z.polygon) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, y);
      maxZ = Math.max(maxZ, y);
    }
    const rng = this.d.rng;
    for (let i = 0; i < 24; i++) {
      let x: number;
      let zz: number;
      if (away) {
        // 卡住：在身边 8–20 m 随机找一个方向
        const a = rng.next() * Math.PI * 2;
        const r = 8 + rng.next() * 12;
        x = p.x + Math.cos(a) * r;
        zz = p.z + Math.sin(a) * r;
      } else {
        x = minX + rng.next() * (maxX - minX);
        zz = minZ + rng.next() * (maxZ - minZ);
        if (Math.hypot(x - p.x, zz - p.z) > 90) continue;
      }
      if (!pointInPolygon(x, zz, z.polygon) || !this.d.inBounds(x, zz) || !this.d.walkable(x, zz)) continue;
      return { x, z: zz, t: this.time + 12 };
    }
    return null;
  }

  // ———————————————————— 战斗回调 ————————————————————

  /** 野生遭遇开始（场景层调用）：记录战斗数 */
  onEncounter(): void {
    if (!this.running) return;
    this.tally.battles++;
    this.status = '战斗中';
  }

  /** 战斗结束（afterBattle 里调用） */
  onBattleEnd(r: BattleResult): void {
    if (!this.running) return;
    if (r.result === 'win') this.tally.defeated++;
    else if (r.result === 'capture') this.tally.captured++;
    else if (r.result === 'run') this.tally.fled++;
    if (r.entityId >= 0 && r.result === 'run') this.blacklist.set(r.entityId, this.time + BLACKLIST_S);
    this.targetId = null;
    this.status = '寻找目标中';
    const party = this.d.state.party;
    if (r.result === 'lose') return this.stop('队伍全灭');
    if (!party.some((p) => p.hp > 0)) return this.stop('没有能战斗的宝可梦了');
    const lead = party.find((p) => p.hp > 0)!;
    const cfg = this.config;
    // 首发低血且没有回复道具 / 招式 PP 用完 / 首发倒下 → 回宝可梦中心（或停止）
    const hpRatio = lead.hp / Math.max(1, maxHp(this.d.dex, lead));
    const noHeal = hpRatio < cfg.hpPct && !cfg.healItems.some((id) => id !== 'full-heal' && (this.d.state.bag[id] ?? 0) > 0);
    const noPp = !lead.moves.some((m) => m.pp > 0 && this.isAttack(m.id)) && !cfg.ppItems.some((id) => (this.d.state.bag[id] ?? 0) > 0);
    const leadDown = (party[0]?.hp ?? 1) <= 0;
    if (cfg.centerHeal && (noHeal || noPp || leadDown)) {
      void this.goHeal(noHeal ? 'HP 低且回复道具用完' : noPp ? '攻击招式 PP 用完' : '首发倒下');
      return;
    }
    if (noHeal) return this.stop('HP 低于设定值，回复道具用完了');
    const capturing = Object.entries(cfg.targets).filter(([, g]) => g === 'capture');
    const defeating = Object.values(cfg.targets).some((g) => g === 'defeat');
    if (capturing.length && !defeating && (this.d.state.bag[cfg.ball] ?? 0) <= 0) return this.stop('设定的精灵球用完了');
    if (noPp) return this.stop('攻击招式 PP 用完了');
    this.refreshCard();
  }

  private isAttack(id: string): boolean {
    const mv = this.d.dex.move(id);
    return mv.category !== 'status' && !!mv.power;
  }

  /** 飞回宝可梦中心治疗，回来继续 */
  private async goHeal(why: string): Promise<void> {
    this.tripping = true;
    this.status = `${why}，飞回宝可梦中心`;
    this.d.player.velocity.set(0, 0, 0);
    this.refreshCard();
    // 等战斗结束的过场 / 对话收尾
    for (let i = 0; i < 100 && !this.d.idle(); i++) await new Promise((r) => setTimeout(r, 100));
    const fail = await this.d.healTrip();
    this.tripping = false;
    if (fail) return this.stop(`${why}，但${fail}`);
    this.targetId = null;
    this.wander = null;
    this.blacklist.clear();
    this.stuck = { t: 0, x: this.d.player.position.x, z: this.d.player.position.z };
    this.status = '寻找目标中';
    this.refreshCard();
  }

  dispose(): void {
    this.card.dispose();
  }
}

function centroid(z: ZoneConfig): { x: number; z: number } {
  let x = 0;
  let y = 0;
  for (const [px, pz] of z.polygon) {
    x += px;
    y += pz;
  }
  const n = Math.max(1, z.polygon.length);
  return { x: x / n, z: y / n };
}

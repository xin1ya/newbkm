/**
 * M1-15 · 钓鱼小游戏（纯逻辑状态机，设计 09-29 §3D 钓鱼：抛竿 → 咬钩提示 → 收线）。
 *
 * 阶段：
 * 1. aim     按住确认键蓄力（力度在 0–1 之间往返），松开抛竿
 * 2. flying  浮漂飞行 0.55 s；落点由场景判断是否在水里（setLanding）
 * 3. wait    等待咬钩：期间有 0–3 次「轻啄」（浮漂轻晃，此时拉竿会把鱼吓跑）
 * 4. bite    浮漂猛沉 + 「！」：在判定窗口内按确认键才能钩住
 * 5. reel    张力小游戏：按住收线（进度上升、张力上升），松开放线（张力回落）；
 *            鱼会周期性发力并突然冲刺；张力满 → 断线；长时间松线 → 鱼挣脱；进度满 → 钓上来
 * 6. done    结果：landed / escaped / snapped / missed / scared / nothing / cancel
 *
 * 所有随机都走注入的 Rng，便于单元测试复现。
 */
import type { Rng } from '../rng';
import type { EncounterEntry, RolledEncounter, TimeOfDay } from '../encounters';

export type RodId = 'old-rod' | 'good-rod' | 'super-rod';
export const ROD_ORDER: readonly RodId[] = ['super-rod', 'good-rod', 'old-rod'];

export interface RodStats {
  name: string;
  /** 咬钩判定窗口（秒） */
  window: number;
  /** 等待咬钩时间范围（秒） */
  wait: [number, number];
  /** 收线速度（进度 / 秒） */
  reelRate: number;
  /** 收线时张力上升速度 */
  tensionUp: number;
  /** 最远抛竿距离（m） */
  maxCast: number;
}

export const RODS: Record<RodId, RodStats> = {
  'old-rod': { name: '破旧钓竿', window: 0.9, wait: [2.5, 7], reelRate: 0.24, tensionUp: 0.62, maxCast: 7 },
  'good-rod': { name: '好钓竿', window: 1.05, wait: [2, 5.5], reelRate: 0.3, tensionUp: 0.55, maxCast: 9 },
  'super-rod': { name: '厉害钓竿', window: 1.2, wait: [1.5, 4.5], reelRate: 0.36, tensionUp: 0.5, maxCast: 11 },
};

export const MIN_CAST = 2.5;

/** 某片水域的钓鱼表：按钓竿区分 */
export interface FishingTable {
  id: string;
  /** 'sea' 或湖 / 河的水体 id；'*' 表示任何淡水 */
  water: string;
  /** 限定区域（可选），与水体共同匹配 */
  zone?: string;
  rods: Partial<Record<RodId, EncounterEntry[]>>;
}

/** 钓点（世界中可见的冒泡水花）：等待更短、稀有鱼更常见 */
export interface FishingSpot {
  id: string;
  name: string;
  position: [number, number];
  radius: number;
  /** 等待时间倍率（< 1 更快） */
  waitScale: number;
  /** 稀有条目权重倍率 */
  rareBoost: number;
}

/** 物种挣扎力度（0–1），缺省按等级估计 */
export type StrengthTable = Readonly<Record<number, number>>;

export function bestRod(bag: Readonly<Record<string, number>>): RodId | null {
  return ROD_ORDER.find((r) => (bag[r] ?? 0) > 0) ?? null;
}

export function findFishingTable(tables: readonly FishingTable[], water: string, zone: string | null): FishingTable | null {
  const fresh = water !== 'sea';
  return (
    tables.find((t) => t.water === water && (!t.zone || t.zone === zone)) ??
    tables.find((t) => t.water === '*' && fresh && (!t.zone || t.zone === zone)) ??
    tables.find((t) => t.water === '*' && fresh) ??
    null
  );
}

/** 从钓鱼表抽一条（考虑时间、钓点稀有加成） */
export function rollFish(table: FishingTable, rod: RodId, time: TimeOfDay, rng: Rng, spot: FishingSpot | null): RolledEncounter | null {
  const pool = (table.rods[rod] ?? []).filter((e) => !e.time || e.time === 'any' || e.time === time);
  if (!pool.length) return null;
  const weights = pool.map((e) => e.weight * (spot && e.formation === 'rare' ? spot.rareBoost : 1));
  const e = pool[rng.weighted(weights)]!;
  return { speciesId: e.speciesId, level: rng.int(e.levels[0], e.levels[1]), shiny: rng.chance(1 / 1024), alpha: false, formation: 'single', count: 1 };
}

export function fishStrength(speciesId: number, level: number, table: StrengthTable): number {
  const base = table[speciesId] ?? 0.45;
  return Math.max(0.1, Math.min(1, base + level / 80));
}

export type FishPhase = 'aim' | 'flying' | 'wait' | 'bite' | 'reel' | 'done';
export type FishResult = 'landed' | 'escaped' | 'snapped' | 'missed' | 'scared' | 'nothing' | 'shore' | 'cancel';

export type FishEvent =
  | { type: 'cast'; power: number; distance: number }
  | { type: 'splash' }
  | { type: 'nibble' }
  | { type: 'bite' }
  | { type: 'hooked'; strength: number }
  | { type: 'surge' }
  | { type: 'end'; result: FishResult };

export interface FishInput {
  /** 本帧确认键按下 */
  pressed: boolean;
  /** 确认键按住 */
  holding: boolean;
  /** 取消键 */
  cancel: boolean;
}

export interface FishingOptions {
  rod: RodId;
  spot: FishingSpot | null;
  /** 咬钩时抽鱼（返回 null = 这里什么都钓不到） */
  roll: () => RolledEncounter | null;
  strength: (enc: RolledEncounter) => number;
}

/** 张力舒适区：在此区间内收线效率更高 */
export const TENSION_SWEET: [number, number] = [0.3, 0.78];
/** 松线多久后鱼挣脱（秒） */
export const SLACK_ESCAPE = 2.4;

export class FishingSession {
  phase: FishPhase = 'aim';
  result: FishResult | null = null;
  /** 当前阶段已过时间 */
  t = 0;
  /** 蓄力 0–1 */
  power = 0;
  distance = 0;
  tension = 0;
  progress = 0;
  /** 本次钓到 / 咬钩的鱼 */
  fish: RolledEncounter | null = null;
  strength = 0;
  /** 鱼当前拉力（0–~1.8，界面显示鱼的挣扎） */
  pull = 0;
  surging = false;
  private charging = false;
  private waitFor = 0;
  private nibbleAt: number[] = [];
  private slack = 0;
  private nextSurge = 0;
  private surgeLeft = 0;
  private reelT = 0;
  readonly rod: RodStats;
  /** 浮漂所在的钓点（抛竿落点确定后由场景设置） */
  spot: FishingSpot | null;

  constructor(
    private readonly o: FishingOptions,
    private readonly rng: Rng,
  ) {
    this.rod = RODS[o.rod];
    this.spot = o.spot;
  }

  setSpot(spot: FishingSpot | null): void {
    this.spot = spot;
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  private finish(r: FishResult, out: FishEvent[]): void {
    this.phase = 'done';
    this.result = r;
    this.t = 0;
    out.push({ type: 'end', result: r });
  }

  private enter(p: FishPhase): void {
    this.phase = p;
    this.t = 0;
  }

  /** 场景判断浮漂落点后回调：是否落在够深的水里 */
  setLanding(inWater: boolean): FishEvent[] {
    const out: FishEvent[] = [];
    if (this.phase !== 'flying') return out;
    if (!inWater) {
      this.finish('shore', out);
      return out;
    }
    out.push({ type: 'splash' });
    this.enter('wait');
    const [a, b] = this.rod.wait;
    const scale = this.spot?.waitScale ?? 1;
    this.waitFor = (a + this.rng.next() * (b - a)) * scale;
    // 轻啄：0–3 次，分布在等待期间，避开最后 0.6 s
    const n = this.rng.int(0, 3);
    this.nibbleAt = Array.from({ length: n }, () => 0.5 + this.rng.next() * Math.max(0.1, this.waitFor - 1.1)).sort((x, y) => x - y);
    return out;
  }

  update(dt: number, input: FishInput): FishEvent[] {
    const out: FishEvent[] = [];
    if (this.phase === 'done') return out;
    this.t += dt;
    if (input.cancel && this.phase !== 'reel') {
      this.finish('cancel', out);
      return out;
    }
    switch (this.phase) {
      case 'aim': {
        if (input.pressed || input.holding) this.charging = true;
        if (this.charging) {
          // 1.1 s 往返一次
          const k = (this.t % 1.1) / 1.1;
          this.power = k < 0.5 ? k * 2 : 2 - k * 2;
        }
        if (this.charging && !input.holding && !input.pressed) {
          this.distance = MIN_CAST + (this.rod.maxCast - MIN_CAST) * this.power;
          out.push({ type: 'cast', power: this.power, distance: this.distance });
          this.enter('flying');
        }
        break;
      }
      case 'flying':
        // 等场景 setLanding；超时保护
        if (this.t > 2) this.finish('shore', out);
        break;
      case 'wait': {
        if (this.nibbleAt.length && this.t >= this.nibbleAt[0]!) {
          this.nibbleAt.shift();
          out.push({ type: 'nibble' });
        }
        if (input.pressed) {
          // 还没咬钩就拉竿：把鱼吓跑
          this.finish('scared', out);
          break;
        }
        if (this.t >= this.waitFor) {
          this.fish = this.o.roll();
          if (!this.fish) {
            this.finish('nothing', out);
            break;
          }
          out.push({ type: 'bite' });
          this.enter('bite');
        }
        break;
      }
      case 'bite': {
        if (input.pressed) {
          this.strength = this.o.strength(this.fish!);
          this.tension = 0.25;
          this.progress = 0.22;
          this.slack = 0;
          this.reelT = 0;
          this.nextSurge = 1.2 + this.rng.next() * 1.6;
          this.surgeLeft = 0;
          out.push({ type: 'hooked', strength: this.strength });
          this.enter('reel');
        } else if (this.t > this.rod.window) this.finish('missed', out);
        break;
      }
      case 'reel':
        this.updateReel(dt, input, out);
        break;
    }
    return out;
  }

  private updateReel(dt: number, input: FishInput, out: FishEvent[]): void {
    this.reelT += dt;
    const s = this.strength;
    // 鱼的拉力：周期挣扎 + 随机冲刺
    this.nextSurge -= dt;
    if (this.nextSurge <= 0 && this.surgeLeft <= 0) {
      this.surgeLeft = 0.45 + this.rng.next() * 0.35;
      this.nextSurge = 1.4 + this.rng.next() * 2.2 - s * 0.6;
      out.push({ type: 'surge' });
    }
    this.surging = this.surgeLeft > 0;
    if (this.surgeLeft > 0) this.surgeLeft -= dt;
    this.pull = s * (0.5 + 0.5 * Math.sin(this.reelT * (2.2 + s * 2.5))) + (this.surging ? s * 0.9 : 0);
    if (input.holding) {
      const sweet = this.tension >= TENSION_SWEET[0] && this.tension <= TENSION_SWEET[1] ? 1.35 : 1;
      this.progress += this.rod.reelRate * sweet * (1 - 0.55 * Math.min(1, this.pull)) * dt;
      this.tension += this.rod.tensionUp * (0.35 + this.pull) * dt;
      this.slack = 0;
    } else {
      this.tension -= (0.75 - 0.25 * Math.min(1, this.pull)) * dt;
      this.progress -= 0.06 * this.pull * dt;
      if (this.tension < 0.12) this.slack += dt;
    }
    this.tension = Math.max(0, this.tension);
    this.progress = Math.max(0, this.progress);
    if (this.tension >= 1) this.finish('snapped', out);
    else if (this.progress >= 1) this.finish('landed', out);
    else if (this.slack >= SLACK_ESCAPE || (this.progress <= 0 && this.reelT > 1)) this.finish('escaped', out);
  }
}

export const RESULT_TEXT: Record<FishResult, string> = {
  landed: '钓到了！',
  escaped: '鱼挣脱跑掉了……',
  snapped: '线绷得太紧，断掉了！',
  missed: '慢了一步，鱼跑掉了……',
  scared: '拉竿太早，把鱼吓跑了……',
  nothing: '好像什么都没有上钩……',
  shore: '浮漂落在岸上了，再试一次吧。',
  cancel: '收起了钓竿。',
};

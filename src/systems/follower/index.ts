/**
 * M1-08 · 跟随宝可梦纯逻辑：
 * - 面包屑轨迹：记录玩家走过的点，跟随者沿轨迹走到「身后 N 米」处（绕开障碍，不抄近路穿墙）
 * - 跟随者选择：队伍里第一只未濒死的宝可梦
 * - 心情与对话：按 HP / 状态 / 亲密度 / 时段 / 天气 / 所在区域给出表情与台词
 * - 对话加亲密度：每只每天最多一次
 */
import type { PokemonInstance } from '../pokemon/Pokemon';

export const TRAIL_SPACING = 0.3;
export const TRAIL_MAX = 160;

export class FollowerTrail {
  private pts: { x: number; z: number }[] = [];

  get length(): number {
    return this.pts.length;
  }

  reset(x: number, z: number): void {
    this.pts = [{ x, z }];
  }

  /** 玩家每帧位置；距离上一个点超过间隔才记录 */
  push(x: number, z: number): void {
    const last = this.pts[this.pts.length - 1];
    if (!last) {
      this.pts.push({ x, z });
      return;
    }
    const d = Math.hypot(x - last.x, z - last.z);
    if (d > 12) {
      // 瞬移（传送 / 进门）：轨迹重置
      this.reset(x, z);
      return;
    }
    if (d < TRAIL_SPACING) return;
    this.pts.push({ x, z });
    if (this.pts.length > TRAIL_MAX) this.pts.shift();
  }

  /** 从最新点往回数 dist 米（沿轨迹弧长）的位置；轨迹不够长时返回最旧点 */
  pointBehind(dist: number): { x: number; z: number } {
    const n = this.pts.length;
    if (!n) return { x: 0, z: 0 };
    let acc = 0;
    for (let i = n - 1; i > 0; i--) {
      const a = this.pts[i]!;
      const b = this.pts[i - 1]!;
      const seg = Math.hypot(a.x - b.x, a.z - b.z);
      if (acc + seg >= dist) {
        const k = (dist - acc) / seg;
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
      }
      acc += seg;
    }
    return { ...this.pts[0]! };
  }
}

export function followerOf(party: readonly PokemonInstance[]): PokemonInstance | null {
  return party.find((p) => p.hp > 0) ?? null;
}

export type FollowerEmote = '♪' | '!' | '?' | '…' | '♥' | 'z' | '💧';

export interface MoodContext {
  name: string;
  hpRatio: number;
  status: string | null;
  friendship: number;
  hour: number;
  weather: string;
  zoneKind: 'town' | 'wild' | 'sea' | 'dungeon-entrance' | 'interior' | null;
  /** 宝可梦的第一属性（天气偏好） */
  type: string;
  /** 用于在候选台词中挑选的随机数 [0, 1) */
  roll: number;
}

export interface Mood {
  emote: FollowerEmote;
  lines: string[];
}

/** 心情判定：优先级 状态异常 > 低 HP > 天气偏好 > 深夜 > 亲密度 > 区域 */
export function followerMood(c: MoodContext): Mood {
  const n = c.name;
  const pick = <T,>(xs: T[]): T => xs[Math.min(xs.length - 1, Math.floor(c.roll * xs.length))]!;
  if (c.status === 'psn' || c.status === 'tox') return { emote: '💧', lines: [`${n}中毒了，看起来很难受……`, '快带它去宝可梦中心吧。'] };
  if (c.status === 'brn') return { emote: '💧', lines: [`${n}身上的烧伤在隐隐作痛。`] };
  if (c.status === 'par') return { emote: '…', lines: [`${n}身体发麻，动作有点僵硬。`] };
  if (c.status === 'slp') return { emote: 'z', lines: [`${n}一边走一边打瞌睡……`] };
  if (c.status === 'frz') return { emote: '…', lines: [`${n}冻得直发抖。`] };
  if (c.hpRatio < 0.3) return { emote: '💧', lines: [`${n}看起来很累了。`, '休息一下比较好吧？'] };
  const rainy = c.weather === 'rain' || c.weather === 'storm';
  if (rainy && c.type === 'water') return { emote: '♪', lines: [`${n}在雨里开心地转圈！`] };
  if (rainy && c.type === 'fire') return { emote: '…', lines: [`${n}缩着身子躲雨，尾巴的火苗小了一圈。`] };
  if (c.weather === 'fog') return { emote: '?', lines: [`${n}盯着雾的深处，好像听到了什么……`] };
  if (c.hour >= 23 || c.hour < 5) return { emote: 'z', lines: [`${n}揉着眼睛，已经困了。`] };
  if (c.friendship >= 220) return { emote: '♥', lines: [pick([`${n}紧紧地贴着你！`, `${n}用头蹭了蹭你的手。`, `${n}看着你，眼里满是信任。`])] };
  if (c.friendship >= 150) return { emote: '♪', lines: [pick([`${n}心情很好的样子。`, `${n}哼着小曲跟在你身后。`, `${n}开心地跳了一下！`])] };
  if (c.zoneKind === 'town') return { emote: '?', lines: [pick([`${n}好奇地东张西望。`, `${n}被街上的香味吸引住了。`])] };
  if (c.zoneKind === 'wild') return { emote: '!', lines: [pick([`${n}竖起耳朵警惕着草丛。`, `${n}很有干劲！`])] };
  if (c.zoneKind === 'interior') return { emote: '…', lines: [`${n}安静地待在你身边。`] };
  return { emote: '…', lines: [`${n}看着你。`] };
}

/** 对话加亲密度：每只每天一次 +1（上限 255）；返回是否增加 */
export function talkFriendship(p: PokemonInstance, day: number, vars: Record<string, number>): boolean {
  const key = `follower-talk:${p.uid}`;
  if (vars[key] === day) return false;
  vars[key] = day;
  p.friendship = Math.min(255, p.friendship + 1);
  return true;
}

/** 跟随者移动速度：离目标越远越快（追上奔跑中的玩家），近处减速停下 */
export function followSpeed(dist: number, playerSpeed: number): number {
  if (dist < 0.15) return 0;
  const base = Math.max(1.4, playerSpeed);
  return Math.min(base * 1.6 + 2, base * (0.6 + dist * 0.5));
}

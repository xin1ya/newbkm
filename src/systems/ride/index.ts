/**
 * M1-12 · 骑乘框架（纯逻辑）。设计 §3.4：骑乘能力取代秘传技，每种能力由道馆 / 剧情解锁的 flag 开启，
 * 用专门的按键召唤。M1 实现水上骑乘（冲浪），其余能力（岩石破坏、攀岩、飞行……）在 config/rides 里登记为未开放。
 *
 * 水上骑乘规则：
 * - 上水：面朝前方 2.5 m 内水深 ≥ 0.6 m 的水面，按互动 / 骑乘键 → 跳上坐骑
 * - 水面移动：水深 ≥ SURF_MIN_DEPTH 才能继续前进；更浅的地方是岸边
 * - 下水：朝岸边前进遇到可站立的陆地时自动跳上岸（或在岸边按骑乘键）
 * - 坐骑：队伍里第一只能骑乘的水属性宝可梦（鲤鱼王这种太小的不行）；没有时使用该能力登记的租借坐骑
 */
import type { Dex } from '../data/Dex';
import type { PokemonInstance } from '../pokemon';

export type RideMedium = 'water' | 'land' | 'rock' | 'air' | 'deep';

export interface RideDef {
  id: string;
  name: string;
  medium: RideMedium;
  /** 解锁 flag（旧秘传技的道馆奖励） */
  flag: string;
  /** 是否已在当前版本实装 */
  implemented: boolean;
  /** 召唤说明（互动提示 / 菜单） */
  verb: string;
  /** 移动速度（m/s）：常速 / 加速 */
  speed: number;
  sprint: number;
  /** 可做坐骑的属性 */
  mountTypes: string[];
  /** 可做坐骑的最小身高（m） */
  minHeight: number;
  /** 不能做坐骑的物种（体型或性格不合适） */
  excluded: number[];
  /** 租借坐骑（队伍里没有合适宝可梦时） */
  fallbackSpecies: number;
  /** 解锁时说明 */
  unlockText: string;
}

export const SURF_MIN_DEPTH = 0.45;
export const SURF_ENTER_DEPTH = 0.6;
/** 坐骑吃水：玩家脚底在水面下多少 */
export const SURF_SINK = 0.18;

export function unlockedRides(rides: readonly RideDef[], flags: Readonly<Record<string, boolean>>): RideDef[] {
  return rides.filter((r) => r.implemented && flags[r.flag] === true);
}

export function rideFor(rides: readonly RideDef[], medium: RideMedium, flags: Readonly<Record<string, boolean>>): RideDef | null {
  return unlockedRides(rides, flags).find((r) => r.medium === medium) ?? null;
}

export interface MountChoice {
  speciesId: number;
  /** 队伍里的宝可梦 uid；租借坐骑为 null */
  uid: string | null;
  nickname: string;
}

/** 选坐骑：队伍中第一只满足属性、体型、未濒死的宝可梦 */
export function chooseMount(dex: Dex, party: readonly PokemonInstance[], ride: RideDef): MountChoice {
  for (const p of party) {
    if (p.hp <= 0 || ride.excluded.includes(p.speciesId)) continue;
    const sp = dex.species(p.speciesId);
    if (!sp.types.some((t) => ride.mountTypes.includes(t))) continue;
    if (sp.heightM < ride.minHeight) continue;
    return { speciesId: p.speciesId, uid: p.uid, nickname: p.nickname ?? sp.name.zh };
  }
  const f = dex.species(ride.fallbackSpecies);
  return { speciesId: ride.fallbackSpecies, uid: null, nickname: f.name.zh };
}

/** 水面上某点是否还能继续骑乘 */
export function surfable(depth: number): boolean {
  return depth >= SURF_MIN_DEPTH;
}

export type RideMode = 'walk' | 'surf' | 'bike' | 'fly' | 'climb' | 'dive';

/** 飞行骑乘：离下方地面 / 水面的最小间隙（m） */
export const FLY_CLEARANCE = 0.9;
/** 飞行骑乘：离下方地面 / 水面的最大高度（m） */
export const FLY_CEILING = 70;
/** 飞行骑乘：世界绝对高度上限（m） */
export const FLY_ABS_MAX = 260;
/** 飞行骑乘：升降速度（m/s） */
export const FLY_CLIMB = 7;
/** 飞行骑乘：离地多少米以内可以降落 */
export const FLY_LAND_ALTITUDE = 2.2;
/** 飞行坐骑显示高度（m，按骑乘体型放大，类似阿尔宙斯的大鸟） */
export const FLY_MOUNT_HEIGHT = 1.9;

/** 飞行坐骑选择：优先队伍里会飞（flyClip）且体型够大的飞行系宝可梦 */
export function chooseFlyMount(dex: Dex, party: readonly PokemonInstance[], ride: RideDef, hasFlyClip: (speciesId: number) => boolean): MountChoice {
  const ok = (p: PokemonInstance) => {
    if (p.hp <= 0 || ride.excluded.includes(p.speciesId)) return false;
    const sp = dex.species(p.speciesId);
    return (sp.types.some((t) => ride.mountTypes.includes(t)) || hasFlyClip(p.speciesId)) && sp.heightM >= ride.minHeight;
  };
  const pick = party.find((p) => ok(p) && hasFlyClip(p.speciesId)) ?? party.find(ok);
  if (pick) return { speciesId: pick.speciesId, uid: pick.uid, nickname: pick.nickname ?? dex.species(pick.speciesId).name.zh };
  const f = dex.species(ride.fallbackSpecies);
  return { speciesId: ride.fallbackSpecies, uid: null, nickname: f.name.zh };
}
/** 自行车速度（米/秒；奔跑 7.6） */
export const BIKE_SPEED = 11;

/**
 * 自行车变速（3 档）：
 * - 1 档：极速低（7 m/s）但起步快、爬坡几乎不掉速；
 * - 2 档：常规（11 m/s）；
 * - 3 档：极速（15.5 m/s），起步慢、上坡掉速明显、下坡更快。
 * slope = 沿前进方向的坡度（上坡为正，dy/dx）。
 */
export interface BikeGear {
  gear: 1 | 2 | 3;
  name: string;
  /** 平地极速 m/s */
  top: number;
  /** 加速度系数（越大起步越快） */
  accel: number;
  /** 上坡减速系数：每 1.0 坡度损失的比例 */
  climb: number;
  /** 踏频比：车轮转 1 圈曲柄转几圈的倒数（越大踏得越慢） */
  ratio: number;
}
export const BIKE_GEARS: readonly BikeGear[] = [
  { gear: 1, name: '1 档 · 爬坡', top: 7, accel: 7.5, climb: 0.45, ratio: 1.6 },
  { gear: 2, name: '2 档 · 常规', top: BIKE_SPEED, accel: 4.2, climb: 1.1, ratio: 2.4 },
  { gear: 3, name: '3 档 · 极速', top: 15.5, accel: 2.3, climb: 2.2, ratio: 3.4 },
];
export const BIKE_DEFAULT_GEAR = 2;

export function bikeGear(g: number): BikeGear {
  return BIKE_GEARS[Math.min(BIKE_GEARS.length, Math.max(1, Math.round(g))) - 1]!;
}

/** 目标速度：上坡按档位损失，下坡最多 +25%；浅水 ×0.6 */
export function bikeTargetSpeed(gear: number, slope: number, waterDepth = 0): number {
  const g = bikeGear(gear);
  const s = Math.max(-0.6, Math.min(0.8, slope));
  const k = s > 0 ? Math.max(0.3, 1 - s * g.climb) : Math.min(1.25, 1 - s * 0.6);
  return g.top * k * (waterDepth > 0.1 ? 0.6 : 1);
}

/**
 * 水上骑乘时朝前方探测：返回 'water'（继续）、'shore'（前方可登岸）、'blocked'（悬崖 / 太浅又不能站）。
 * standable = 该点是否可站立（坡度 / 台阶检查由调用方完成）。
 */
export function surfProbe(depthAhead: number, standable: boolean): 'water' | 'shore' | 'blocked' {
  if (surfable(depthAhead)) return 'water';
  return standable ? 'shore' : 'blocked';
}

/** 水面暗影遇敌：每走 1 m 的触发概率（暗影内）；外海开阔处略高 */
export function shadowEncounterChance(distance: number, openSea: boolean): number {
  const perMeter = openSea ? 0.22 : 0.16;
  return 1 - Math.pow(1 - perMeter, Math.max(0, distance));
}

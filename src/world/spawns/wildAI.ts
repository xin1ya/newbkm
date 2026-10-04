/**
 * ACT-002 · 野生宝可梦行为（纯逻辑状态机，不依赖 three，可单测）。
 * 状态：idle（发呆/张望）· wander（在出生点附近游荡）· alert（注意到玩家，停下看）·
 *       flee（胆小：逃开）· approach（好奇：慢慢靠近，保持距离）· chase（凶猛：追击，接触即战斗）·
 *       sleep（夜里睡觉，靠近也不醒，可以从背后接近）· return（离出生点太远，回去）
 * 感知：视野锥（前方 120°）× 视距；玩家奔跑时听觉范围更大；背对时只能“听到”。
 */
import type { Temperament } from '@/systems/encounters';

export type WildState = 'idle' | 'wander' | 'alert' | 'flee' | 'approach' | 'chase' | 'sleep' | 'return';

export interface WildBrain {
  state: WildState;
  timer: number;
  /** 游荡目标 */
  tx: number;
  tz: number;
  /** 当前朝向（弧度，0 = +Z） */
  yaw: number;
  homeX: number;
  homeZ: number;
  temperament: Temperament;
  sight: number;
  speed: number;
  sleepsAtNight: boolean;
  /** 发现玩家后累计的“警觉度” 0–1 */
  awareness: number;
  /**
   * 领地（巢穴头目，计划文档 §3.2）：玩家进入 warn 圈 → 咆哮警告；进入 charge 圈 → 冲锋；
   * 离开巢穴超过 leash → 返回。有领地时不睡觉、不逃跑。
   */
  territory?: { warn: number; charge: number; leash: number; radius: number; warned: boolean } | undefined;
  /** 被能量方块安抚（计划文档 §9.5）：不再追击 / 逃跑，原地吃方块、看着玩家；玩家走过去接触才开战 */
  calmed?: boolean | undefined;
}

export interface Perception {
  /** 玩家相对位置 */
  px: number;
  pz: number;
  playerRunning: boolean;
  /** 玩家在草丛中（降低被发现） */
  playerInGrass: boolean;
  isNight: boolean;
  x: number;
  z: number;
}

export interface WildIntent {
  /** 期望移动方向（单位向量）× 速度比例 0–1.6 */
  mx: number;
  mz: number;
  speedScale: number;
  /** 期望朝向 */
  faceYaw: number | null;
  /** 追到并接触玩家 */
  engage: boolean;
  /** 表情提示（头顶图标） */
  emote: '!' | '?' | 'z' | '♥' | null;
  /** 领地头目本帧发出警告咆哮（场景层提示 / 音效） */
  roar?: boolean;
}

export const WANDER_RADIUS = 14;
export const LEASH_RADIUS = 38;
export const CONTACT_DIST = 1.4;

export function createBrain(x: number, z: number, temperament: Temperament, opts: { sight: number; speed: number; sleepsAtNight: boolean }, r: () => number): WildBrain {
  return {
    state: 'idle',
    timer: 1 + r() * 3,
    tx: x,
    tz: z,
    yaw: r() * Math.PI * 2,
    homeX: x,
    homeZ: z,
    temperament,
    sight: opts.sight,
    speed: opts.speed,
    sleepsAtNight: opts.sleepsAtNight,
    awareness: 0,
  };
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 能否察觉玩家：返回 0–1 的察觉强度 */
export function perceive(b: WildBrain, p: Perception): number {
  const dx = p.px - p.x;
  const dz = p.pz - p.z;
  const d = Math.hypot(dx, dz);
  const sight = b.sight * (p.playerInGrass ? 0.55 : 1) * (p.isNight ? 0.7 : 1);
  const hearing = (p.playerRunning ? 0.6 : 0.25) * b.sight;
  const inCone = Math.abs(angleDiff(Math.atan2(dx, dz), b.yaw)) < Math.PI / 3;
  if (inCone && d < sight) return 1 - (d / sight) * 0.5;
  if (d < hearing) return 0.5 * (1 - d / hearing);
  return 0;
}

/**
 * 推进一步。r 为随机源（[0,1)）。
 */
export function stepBrain(b: WildBrain, p: Perception, dt: number, r: () => number): WildIntent {
  const out: WildIntent = { mx: 0, mz: 0, speedScale: 0, faceYaw: null, engage: false, emote: null };
  const dxp = p.px - p.x;
  const dzp = p.pz - p.z;
  const dPlayer = Math.hypot(dxp, dzp);
  const toPlayerYaw = Math.atan2(dxp, dzp);
  const homeD = Math.hypot(b.homeX - p.x, b.homeZ - p.z);
  b.timer -= dt;
  if (b.calmed) {
    // 安抚：停在原地，玩家靠近时转头看着玩家，头顶爱心
    b.state = 'idle';
    b.awareness = 0;
    if (dPlayer < 12) out.faceYaw = toPlayerYaw;
    out.emote = dPlayer < 18 ? '♥' : null;
    turnToward(b, out, dt);
    return out;
  }
  if (b.territory) {
    stepTerritorial(b, b.territory, p, dt, r, out, dPlayer, toPlayerYaw, homeD);
    turnToward(b, out, dt);
    return out;
  }

  // 睡眠：夜晚且嗜睡的个体；非常近 + 奔跑会惊醒
  if (b.sleepsAtNight && p.isNight && b.state !== 'chase' && b.state !== 'flee') {
    if (b.state !== 'sleep') {
      b.state = 'sleep';
      b.awareness = 0;
    }
    if (p.playerRunning && dPlayer < 3.5) {
      b.state = 'alert';
      b.timer = 0.8;
    } else {
      out.emote = 'z';
      return out;
    }
  } else if (b.state === 'sleep') {
    b.state = 'idle';
    b.timer = 1;
  }
  if (b.temperament === 'sleepy' && !p.isNight && b.state === 'idle' && r() < dt * 0.05) {
    b.state = 'sleep';
  }

  const sense = perceive(b, p);
  b.awareness = Math.max(0, Math.min(1, b.awareness + (sense > 0 ? sense * dt * 2.2 : -dt * 0.35)));

  // 被察觉后的反应
  const aware = b.awareness >= 0.6;
  if (aware && (b.state === 'idle' || b.state === 'wander')) {
    b.state = 'alert';
    b.timer = 0.6 + r() * 0.4;
  }

  switch (b.state) {
    case 'idle': {
      if (b.timer <= 0) {
        const a = r() * Math.PI * 2;
        const rad = 3 + r() * WANDER_RADIUS;
        b.tx = b.homeX + Math.sin(a) * rad;
        b.tz = b.homeZ + Math.cos(a) * rad;
        b.state = 'wander';
        b.timer = 6 + r() * 6;
      } else if (r() < dt * 0.4) {
        out.faceYaw = b.yaw + (r() - 0.5) * 1.5;
      }
      break;
    }
    case 'wander': {
      const dx = b.tx - p.x;
      const dz = b.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6 || b.timer <= 0) {
        b.state = 'idle';
        b.timer = 1.5 + r() * 4;
      } else {
        out.mx = dx / d;
        out.mz = dz / d;
        out.speedScale = 0.45;
      }
      break;
    }
    case 'alert': {
      out.faceYaw = toPlayerYaw;
      out.emote = b.temperament === 'curious' || b.temperament === 'calm' ? '?' : '!';
      if (b.timer <= 0) {
        if (!aware) {
          b.state = 'idle';
          b.timer = 1;
        } else if (b.temperament === 'timid') b.state = 'flee';
        else if (b.temperament === 'aggressive') b.state = 'chase';
        else if (b.temperament === 'curious') b.state = 'approach';
        else {
          // calm / sleepy：看一会儿然后继续做自己的事
          b.state = 'idle';
          b.timer = 2 + r() * 2;
          b.awareness = 0.3;
        }
        b.timer = 8;
      }
      break;
    }
    case 'flee': {
      out.mx = -dxp / (dPlayer || 1);
      out.mz = -dzp / (dPlayer || 1);
      out.speedScale = 1.5;
      out.emote = '!';
      if (dPlayer > b.sight * 2 || b.timer <= 0) {
        b.state = 'return';
        b.awareness = 0;
      }
      break;
    }
    case 'approach': {
      out.faceYaw = toPlayerYaw;
      if (dPlayer > 3.2) {
        out.mx = dxp / dPlayer;
        out.mz = dzp / dPlayer;
        out.speedScale = 0.5;
      }
      if (!aware || b.timer <= 0 || homeD > LEASH_RADIUS) {
        b.state = 'return';
      }
      break;
    }
    case 'chase': {
      out.emote = '!';
      out.mx = dxp / (dPlayer || 1);
      out.mz = dzp / (dPlayer || 1);
      out.speedScale = 1.35;
      if (dPlayer < CONTACT_DIST) out.engage = true;
      if (homeD > LEASH_RADIUS || b.timer <= 0 || dPlayer > b.sight * 2.2) {
        b.state = 'return';
        b.awareness = 0;
      }
      break;
    }
    case 'return': {
      const dx = b.homeX - p.x;
      const dz = b.homeZ - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        b.state = 'idle';
        b.timer = 2;
      } else {
        out.mx = dx / d;
        out.mz = dz / d;
        out.speedScale = 0.7;
      }
      break;
    }
    case 'sleep':
      out.emote = 'z';
      break;
  }
  turnToward(b, out, dt);
  return out;
}

function turnToward(b: WildBrain, out: WildIntent, dt: number): void {
  if (out.speedScale > 0 && out.faceYaw === null) out.faceYaw = Math.atan2(out.mx, out.mz);
  if (out.faceYaw !== null) {
    const d = angleDiff(out.faceYaw, b.yaw);
    b.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 6);
  }
}

/**
 * 领地行为：在巢穴半径内踱步；玩家（以巢穴中心计）进入警告圈 → 停下盯着玩家并咆哮一次；
 * 进入冲锋圈 → 冲锋（接触即战斗）；自己离巢超过 leash 或玩家退出警告圈外 → 回巢，警告重置。
 */
function stepTerritorial(
  b: WildBrain,
  t: NonNullable<WildBrain['territory']>,
  p: Perception,
  _dt: number,
  r: () => number,
  out: WildIntent,
  dPlayer: number,
  toPlayerYaw: number,
  homeD: number,
): void {
  const playerFromDen = Math.hypot(p.px - b.homeX, p.pz - b.homeZ);
  if (b.state === 'chase') {
    out.emote = '!';
    out.mx = (p.px - p.x) / (dPlayer || 1);
    out.mz = (p.pz - p.z) / (dPlayer || 1);
    out.speedScale = 1.45;
    if (dPlayer < CONTACT_DIST) out.engage = true;
    if (homeD > t.leash || playerFromDen > t.leash) {
      b.state = 'return';
      t.warned = false;
    }
    return;
  }
  if (b.state === 'return') {
    const dx = b.homeX - p.x;
    const dz = b.homeZ - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) {
      b.state = 'idle';
      b.timer = 2;
    } else {
      out.mx = dx / d;
      out.mz = dz / d;
      out.speedScale = 0.8;
    }
    // 回巢途中玩家闯进冲锋圈：立刻折返
    if (playerFromDen < t.charge) b.state = 'chase';
    return;
  }
  if (playerFromDen < t.charge) {
    b.state = 'chase';
    out.emote = '!';
    return;
  }
  if (playerFromDen < t.warn) {
    b.state = 'alert';
    out.faceYaw = toPlayerYaw;
    out.emote = '!';
    if (!t.warned) {
      t.warned = true;
      out.roar = true;
    }
    return;
  }
  if (b.state === 'alert') {
    b.state = 'idle';
    b.timer = 1;
  }
  if (playerFromDen > t.warn + 6) t.warned = false;
  // 巢穴内踱步
  if (b.state === 'idle') {
    if (b.timer <= 0) {
      const a = r() * Math.PI * 2;
      const rad = r() * t.radius;
      b.tx = b.homeX + Math.sin(a) * rad;
      b.tz = b.homeZ + Math.cos(a) * rad;
      b.state = 'wander';
      b.timer = 5 + r() * 4;
    }
    return;
  }
  // wander（以及其他状态的兜底）
  const dx = b.tx - p.x;
  const dz = b.tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.6 || b.timer <= 0) {
    b.state = 'idle';
    b.timer = 2 + r() * 4;
  } else {
    out.mx = dx / d;
    out.mz = dz / d;
    out.speedScale = 0.35;
  }
}

/**
 * 接触时的先手判定（设计 §5.3）：
 *  - 野生在追击中撞上玩家 → 野生先手
 *  - 玩家从背后（野生朝向 ±60° 之外）接近 → 玩家先手
 *  - 其他 → 按速度
 */
export function contactInitiative(b: WildBrain, playerX: number, playerZ: number, wildX: number, wildZ: number): 'player' | 'wild' | null {
  if (b.state === 'chase') return 'wild';
  const toPlayer = Math.atan2(playerX - wildX, playerZ - wildZ);
  if (b.state === 'sleep' || Math.abs(angleDiff(toPlayer, b.yaw)) > (Math.PI * 2) / 3) return 'player';
  return null;
}

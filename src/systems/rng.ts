/**
 * 可复现的随机数（mulberry32）。所有纯逻辑随机都通过 Rng 注入，
 * 单测可固定种子，存档可保存状态。
 */
export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number;
  /** 以概率 p（0~1）返回 true */
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** 按权重抽取下标 */
  weighted(weights: readonly number[]): number;
  /** 当前内部状态（用于存档 / 回放） */
  state(): number;
}

export function createRng(seed: number = Date.now() >>> 0): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => {
      if (!arr.length) throw new Error('Rng.pick: 空数组');
      return arr[Math.floor(next() * arr.length)] as (typeof arr)[number];
    },
    weighted: (weights) => {
      const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
      if (total <= 0) return -1;
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= Math.max(0, weights[i] ?? 0);
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    state: () => s,
  };
  return rng;
}

/** 测试用：按顺序返回给定序列（循环），便于构造确定性场景 */
export function sequenceRng(values: readonly number[]): Rng {
  let i = 0;
  const base = createRng(1);
  const next = (): number => values[i++ % values.length] ?? 0;
  return {
    ...base,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)] as (typeof arr)[number],
    weighted: (weights) => {
      const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
      let r = next() * total;
      for (let k = 0; k < weights.length; k++) {
        r -= Math.max(0, weights[k] ?? 0);
        if (r < 0) return k;
      }
      return weights.length - 1;
    },
    state: () => i,
  };
}

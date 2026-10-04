/**
 * ENG-006 · 类型安全事件总线。
 * 跨层通信（world → scenes、scenes → ui）一律通过事件，避免反向 import（§4.3）。
 */
import type { GameEvents } from './events';

type Handler<T> = (payload: T) => void;

export class EventBus<M extends object = GameEvents> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();
  private queue: Array<[keyof M, unknown]> = [];

  on<K extends keyof M>(type: K, fn: Handler<M[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => this.off(type, fn);
  }

  once<K extends keyof M>(type: K, fn: Handler<M[K]>): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof M>(type: K, fn: Handler<M[K]>): void {
    this.handlers.get(type)?.delete(fn as Handler<never>);
  }

  /** 立即同步派发 */
  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        (fn as Handler<M[K]>)(payload);
      } catch (e) {
        console.error(`[events] "${String(type)}" 处理出错`, e);
      }
    }
  }

  /** 延迟到本帧末尾（flush）派发，用于在遍历实体时安全地触发场景切换 */
  post<K extends keyof M>(type: K, payload: M[K]): void {
    this.queue.push([type, payload]);
  }

  flush(): void {
    if (this.queue.length === 0) return;
    const q = this.queue;
    this.queue = [];
    for (const [t, p] of q) this.emit(t, p as M[typeof t]);
  }

  clear(): void {
    this.handlers.clear();
    this.queue = [];
  }
}

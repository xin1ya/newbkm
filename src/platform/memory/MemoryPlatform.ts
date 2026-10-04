/**
 * 内存实现：单元测试与 Node 工具使用，不持久化。
 */
import type { Platform, SaveSlotInfo, StorageApi } from '../Platform';

export function createMemoryPlatform(files: Record<string, string | ArrayBuffer> = {}): Platform {
  const saves = new Map<string, { data: string; summary: unknown; savedAt: string }>();
  const prefs = new Map<string, string>();
  const storage: StorageApi = {
    backend: 'memory',
    read: async (slot) => saves.get(slot)?.data ?? null,
    write: async (slot, data, summary) => void saves.set(slot, { data, summary, savedAt: new Date().toISOString() }),
    remove: async (slot) => void saves.delete(slot),
    list: async (): Promise<SaveSlotInfo[]> => [...saves.entries()].map(([slot, s]) => ({ slot, summary: s.summary, savedAt: s.savedAt, bytes: s.data.length })),
    getPref: (k) => prefs.get(k) ?? null,
    setPref: (k, v) => void prefs.set(k, v),
  };
  const get = (p: string) => {
    const f = files[p];
    if (f === undefined) throw new Error(`MemoryPlatform: 缺少资源 ${p}`);
    return f;
  };
  let fullscreen = false;
  return {
    info: { kind: 'memory', version: 'test', devicePixelRatio: 1, gpuTier: 'low', touch: false },
    storage,
    assets: {
      url: (p) => `memory://${p}`,
      fetchArrayBuffer: async (p) => {
        const f = get(p);
        return typeof f === 'string' ? new TextEncoder().encode(f).buffer : f;
      },
      fetchJson: async <T>(p: string) => JSON.parse(String(get(p))) as T,
      fetchText: async (p) => String(get(p)),
    },
    window: {
      isFullscreen: () => fullscreen,
      setFullscreen: async (on) => void (fullscreen = on),
      toggleFullscreen: async () => void (fullscreen = !fullscreen),
      quit: async () => undefined,
      setTitle: () => undefined,
      onVisibilityChange: () => () => undefined,
    },
  };
}

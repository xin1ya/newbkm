/**
 * ENG-005 · Web 实现：IndexedDB 存档（localStorage 兜底）、fetch 读取资源、Fullscreen API。
 */
import type { AssetsApi, Platform, PlatformInfo, SaveSlotInfo, StorageApi, WindowApi } from '../Platform';
import { idbAll, idbDelete, idbGet, idbPut, openDb } from './idb';

const LS_PREFIX = 'cuilan:';

class LocalStorageBackend implements StorageApi {
  readonly backend = 'localstorage' as const;
  async read(slot: string) {
    return localStorage.getItem(`${LS_PREFIX}save:${slot}`);
  }
  async write(slot: string, data: string, summary?: unknown) {
    localStorage.setItem(`${LS_PREFIX}save:${slot}`, data);
    localStorage.setItem(`${LS_PREFIX}meta:${slot}`, JSON.stringify({ summary, savedAt: new Date().toISOString(), bytes: data.length }));
  }
  async remove(slot: string) {
    localStorage.removeItem(`${LS_PREFIX}save:${slot}`);
    localStorage.removeItem(`${LS_PREFIX}meta:${slot}`);
  }
  async list(): Promise<SaveSlotInfo[]> {
    const out: SaveSlotInfo[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(`${LS_PREFIX}meta:`)) continue;
      try {
        const m = JSON.parse(localStorage.getItem(k) ?? '{}');
        out.push({ slot: k.slice(`${LS_PREFIX}meta:`.length), summary: m.summary, savedAt: m.savedAt, bytes: m.bytes });
      } catch {
        /* 忽略损坏的元数据 */
      }
    }
    return out;
  }
  getPref(key: string) {
    return localStorage.getItem(`${LS_PREFIX}pref:${key}`);
  }
  setPref(key: string, value: string) {
    localStorage.setItem(`${LS_PREFIX}pref:${key}`, value);
  }
}

class IndexedDbBackend extends LocalStorageBackend {
  // @ts-expect-error 覆盖只读字面量类型
  override readonly backend = 'indexeddb' as const;
  constructor(private readonly db: IDBDatabase) {
    super();
  }
  override async read(slot: string) {
    return (await idbGet(this.db, slot))?.data ?? null;
  }
  override async write(slot: string, data: string, summary?: unknown) {
    await idbPut(this.db, { slot, data, summary, savedAt: new Date().toISOString() });
  }
  override async remove(slot: string) {
    await idbDelete(this.db, slot);
  }
  override async list(): Promise<SaveSlotInfo[]> {
    return (await idbAll(this.db)).map((r) => ({ slot: r.slot, summary: r.summary, savedAt: r.savedAt, bytes: r.data.length }));
  }
}

class WebAssets implements AssetsApi {
  constructor(private readonly base: string) {}
  url(path: string): string {
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    return this.base + path.replace(/^\/+/, '');
  }
  private async get(path: string): Promise<Response> {
    const res = await fetch(this.url(path));
    if (!res.ok) throw new Error(`资源加载失败 ${res.status}: ${path}`);
    return res;
  }
  async fetchArrayBuffer(path: string) {
    return (await this.get(path)).arrayBuffer();
  }
  async fetchJson<T>(path: string) {
    return (await this.get(path)).json() as Promise<T>;
  }
  async fetchText(path: string) {
    return (await this.get(path)).text();
  }
}

class WebWindow implements WindowApi {
  isFullscreen() {
    return document.fullscreenElement !== null;
  }
  async setFullscreen(on: boolean) {
    if (on && !this.isFullscreen()) await document.documentElement.requestFullscreen?.();
    if (!on && this.isFullscreen()) await document.exitFullscreen?.();
  }
  async toggleFullscreen() {
    await this.setFullscreen(!this.isFullscreen());
  }
  async quit() {
    // 浏览器无法可靠关闭标签页：回到页面初始状态（标题画面）
    window.location.reload();
  }
  setTitle(title: string) {
    document.title = title;
  }
  onVisibilityChange(cb: (visible: boolean) => void) {
    const h = () => cb(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }
}

function detectGpuTier(): PlatformInfo['gpuTier'] {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|software|basic render/.test(name)) return 'low';
    if (/rtx|radeon rx|geforce gtx 1[6-9]|apple m[1-9]|arc a/.test(name)) return 'high';
    return 'medium';
  } catch {
    return 'low';
  }
}

export async function createWebPlatform(): Promise<Platform> {
  let storage: StorageApi;
  try {
    storage = new IndexedDbBackend(await openDb());
  } catch (e) {
    console.warn('[platform] IndexedDB 不可用，改用 localStorage：', e);
    storage = new LocalStorageBackend();
  }
  const info: PlatformInfo = {
    kind: 'web',
    version: `${__APP_VERSION__}+${__BUILD_TIME__}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    gpuTier: detectGpuTier(),
    touch: 'ontouchstart' in window,
  };
  return { info, storage, assets: new WebAssets(import.meta.env.BASE_URL), window: new WebWindow() };
}

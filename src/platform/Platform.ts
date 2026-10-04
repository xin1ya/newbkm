/**
 * ENG-005 · 平台抽象（设计 §2.3）。
 * 业务代码只通过这里访问存档、资源、窗口；Web 实现在 web/，以后新增 tauri/ 实现同一接口即可打包桌面版。
 * 除本目录外禁止直接使用 localStorage / indexedDB / window.close（ESLint 强制）。
 */

export interface SaveSlotInfo {
  slot: string;
  /** 存档摘要 JSON（由 systems/state/save.ts 生成） */
  summary: unknown;
  savedAt: string;
  bytes: number;
}

export interface StorageApi {
  /** 读取存档槽，不存在返回 null */
  read(slot: string): Promise<string | null>;
  write(slot: string, data: string, summary?: unknown): Promise<void>;
  remove(slot: string): Promise<void>;
  list(): Promise<SaveSlotInfo[]>;
  /** 小型键值（设置、按键映射等），同步可读 */
  getPref(key: string): string | null;
  setPref(key: string, value: string): void;
  /** 当前使用的后端（调试显示） */
  readonly backend: 'indexeddb' | 'localstorage' | 'memory' | 'tauri-fs';
}

export interface AssetsApi {
  /** 相对资源路径 → 可加载的 URL（考虑 base 路径与 Tauri 协议） */
  url(path: string): string;
  fetchArrayBuffer(path: string): Promise<ArrayBuffer>;
  fetchJson<T>(path: string): Promise<T>;
  fetchText(path: string): Promise<string>;
}

export interface WindowApi {
  isFullscreen(): boolean;
  setFullscreen(on: boolean): Promise<void>;
  toggleFullscreen(): Promise<void>;
  /** 退出游戏（Web：返回标题 / 关闭标签页不可控；Tauri：关闭窗口） */
  quit(): Promise<void>;
  setTitle(title: string): void;
  /** 页面可见性变化（切到后台时暂停） */
  onVisibilityChange(cb: (visible: boolean) => void): () => void;
}

export interface PlatformInfo {
  kind: 'web' | 'tauri' | 'memory';
  /** 构建版本（package.json version + 构建时间） */
  version: string;
  devicePixelRatio: number;
  /** 粗略的设备档位判断，供画质自动选择 */
  gpuTier: 'low' | 'medium' | 'high';
  touch: boolean;
}

export interface Platform {
  readonly info: PlatformInfo;
  readonly storage: StorageApi;
  readonly assets: AssetsApi;
  readonly window: WindowApi;
}

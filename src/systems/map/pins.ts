/**
 * 地图自定义标点（纯逻辑）：大地图上放置 / 删除 / 改样式，选一个作为导航目标；
 * 小地图、指南针光柱跟随导航标点。存档 GameState.mapPins / GameState.navPin。
 */
export type PinKind = 'flag' | 'star' | 'berry' | 'ball' | 'heart' | 'warn';

export interface MapPin {
  id: string;
  island: string;
  x: number;
  z: number;
  kind: PinKind;
  /** 玩家备注（可空） */
  label: string;
}

export const PIN_STYLE: Record<PinKind, { glyph: string; color: string; name: string }> = {
  flag: { glyph: '⚑', color: '#e8484a', name: '旗帜' },
  star: { glyph: '★', color: '#f0a020', name: '星星' },
  berry: { glyph: '●', color: '#c03a7a', name: '树果' },
  ball: { glyph: '◓', color: '#3a7bd5', name: '宝可梦' },
  heart: { glyph: '♥', color: '#e86aa0', name: '爱心' },
  warn: { glyph: '!', color: '#7a4ae0', name: '注意' },
};
export const PIN_KINDS = Object.keys(PIN_STYLE) as PinKind[];
/** 每座岛最多标点数 */
export const MAX_PINS = 24;
/** 走到导航标点多近时自动结束导航（米） */
export const PIN_ARRIVE = 6;

/** 导航到地图原有地点（宝可梦中心、商店、巢穴……）时的目标 */
export interface NavTarget {
  island: string;
  /** 地点标记 id */
  id: string;
  name: string;
  x: number;
  z: number;
}

export interface PinStore {
  mapPins?: MapPin[] | undefined;
  navPin?: string | null | undefined;
  /** 与 navPin 互斥：导航到原有地点 */
  navTarget?: NavTarget | null | undefined;
}

export function pinsOn(s: PinStore, island: string): MapPin[] {
  return (s.mapPins ?? []).filter((p) => p.island === island);
}

/** 放置标点；同岛已满返回 null。新标点自动成为导航目标（可选） */
export function addPin(s: PinStore, island: string, x: number, z: number, kind: PinKind, opts: { label?: string; navigate?: boolean } = {}): MapPin | null {
  if (pinsOn(s, island).length >= MAX_PINS) return null;
  s.mapPins ??= [];
  let n = s.mapPins.length + 1;
  while (s.mapPins.some((p) => p.id === `pin-${n}`)) n++;
  const pin: MapPin = { id: `pin-${n}`, island, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, kind, label: (opts.label ?? '').slice(0, 16) };
  s.mapPins.push(pin);
  if (opts.navigate) s.navPin = pin.id;
  return pin;
}

export function removePin(s: PinStore, id: string): boolean {
  const list = s.mapPins ?? [];
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  if (s.navPin === id) s.navPin = null;
  return true;
}

export function setPinKind(s: PinStore, id: string, kind: PinKind): void {
  const p = s.mapPins?.find((x) => x.id === id);
  if (p) p.kind = kind;
}

/** 切换导航目标（再次选择同一标点 = 取消导航） */
export function toggleNav(s: PinStore, id: string | null): string | null {
  s.navPin = id && s.navPin !== id ? id : null;
  if (s.navPin) s.navTarget = null;
  return s.navPin;
}

/** 导航到原有地点（再次选择同一地点 = 取消） */
export function toggleNavTarget(s: PinStore, t: NavTarget): boolean {
  if (s.navTarget?.id === t.id && s.navTarget.island === t.island) {
    s.navTarget = null;
    return false;
  }
  s.navTarget = { ...t };
  s.navPin = null;
  return true;
}

/** 当前导航目标（自定义标点或原有地点），统一成坐标 + 名称 */
export function currentNav(s: PinStore, island: string): { kind: 'pin' | 'marker'; id: string; name: string; x: number; z: number } | null {
  const p = navPinOf(s, island);
  if (p) return { kind: 'pin', id: p.id, name: p.label || PIN_STYLE[p.kind].name, x: p.x, z: p.z };
  const t = s.navTarget;
  if (t && t.island === island) return { kind: 'marker', id: t.id, name: t.name, x: t.x, z: t.z };
  return null;
}

export function navPinOf(s: PinStore, island: string): MapPin | null {
  if (!s.navPin) return null;
  const p = s.mapPins?.find((x) => x.id === s.navPin);
  return p && p.island === island ? p : null;
}

/** 到达检查：到了就清除导航，返回是否到达 */
export function checkArrive(s: PinStore, island: string, x: number, z: number): boolean {
  const p = currentNav(s, island);
  if (!p || Math.hypot(p.x - x, p.z - z) > PIN_ARRIVE) return false;
  s.navPin = null;
  s.navTarget = null;
  return true;
}

/** 存档修复：去掉坏数据 */
export function repairPins(s: PinStore): void {
  if (!Array.isArray(s.mapPins)) {
    delete s.mapPins;
  } else {
    s.mapPins = s.mapPins.filter(
      (p) => p && typeof p.id === 'string' && typeof p.island === 'string' && Number.isFinite(p.x) && Number.isFinite(p.z) && p.kind in PIN_STYLE,
    );
    for (const p of s.mapPins) if (typeof p.label !== 'string') p.label = '';
  }
  if (s.navPin && !s.mapPins?.some((p) => p.id === s.navPin)) s.navPin = null;
  const t = s.navTarget;
  if (t && !(typeof t.id === 'string' && typeof t.island === 'string' && Number.isFinite(t.x) && Number.isFinite(t.z))) s.navTarget = null;
}

/**
 * 小地图投影：世界偏移 (dx, dz) → 小地图像素（中心为原点）。
 * rotate = 镜头朝向（弧度，世界 forward = (sin, cos)）：旋转模式下镜头前方朝上。
 * 超出半径的点钳到圆周上（edge = true）。
 */
export function miniProject(dx: number, dz: number, scale: number, radius: number, rotate: number | null): { x: number; y: number; edge: boolean } {
  let x = dx * scale;
  let y = dz * scale; // 北（-Z）朝上 → 屏幕 y = z
  if (rotate !== null) {
    // 把镜头前方 (sin r, cos r) 转到屏幕上方 (0, -1)
    const c = Math.cos(rotate);
    const s = Math.sin(rotate);
    const rx = -(x * c - y * s);
    const ry = -(x * s + y * c);
    x = rx;
    y = ry;
  }
  const d = Math.hypot(x, y);
  if (d > radius) return { x: (x / d) * radius, y: (y / d) * radius, edge: true };
  return { x, y, edge: false };
}

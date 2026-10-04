/**
 * 小地图与自定义标点的场景层：
 * - 每 1.5 s 从 IslandMap.buildView 取一次标记 / 迷雾 / 任务目标（玩家位置每帧实时）；
 * - 底图先用大地图的 512 图，空闲时再烘一张 1024 的清晰版；
 * - 导航标点：世界中显示青绿色光柱（复用任务光柱），走到 6 m 内自动结束导航；
 * - 设置「小地图」关闭、HUD 隐藏（战斗 / 剧情）时隐藏。
 */
import type * as THREE from 'three';
import type { IslandConfig } from '@/config/islands';
import type { GameState } from '@/systems/state';
import { checkArrive, currentNav, markerVisible, pinsOn, type FogMask } from '@/systems/map';
import type { Hud } from '@/ui/hud';
import { MiniMap, type MiniMapMarker } from '@/ui/hud/MiniMap';
import { CAT_COLOR, MAP_ICON } from '@/ui/map/MapScreen';
import type { UiRoot } from '@/ui/core/UiRoot';
import type { Heightfield } from '@/world/terrain/Heightfield';
import { IslandMap } from './IslandMap';
import { bakeIslandMap } from './islandMapBake';
import { QuestBeacon } from './QuestBeacon';
import { sfx } from '@/core/audio';

export interface SceneMiniMapDeps {
  ui: UiRoot;
  hud: Hud;
  state: GameState;
  island: IslandConfig;
  hf: Heightfield;
  toast(text: string): void;
}

/** 小地图上显示的地点类型（门牌太密不显示） */
const MINI_KINDS = new Set(['pokecenter', 'mart', 'gym', 'dock', 'ferry', 'fishing', 'landmark', 'cave', 'alpha', 'quest']);

export class SceneMiniMap {
  readonly widget: MiniMap;
  /** 导航标点光柱 */
  readonly beacon = new QuestBeacon('#3fe0b0');
  private image: HTMLCanvasElement;
  private fog: FogMask | null = null;
  private markers: MiniMapMarker[] = [];
  private quest: { x: number; z: number; color: string } | null = null;
  private refresh = 0;
  private hiResTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly d: SceneMiniMapDeps) {
    this.widget = new MiniMap(d.ui);
    this.widget.onClick = () => void IslandMap.current?.open();
    this.image = bakeIslandMap(d.hf, d.island);
    this.hiResTimer = setTimeout(() => {
      this.image = bakeIslandMap(d.hf, d.island, 1024);
    }, 2500);
  }

  /** 立即刷新标记（放置 / 删除标点、关闭大地图后） */
  invalidate(): void {
    this.refresh = 0;
  }

  update(dt: number, player: { x: number; z: number; facing: number }, cameraYaw: number, zone: string): void {
    const s = this.d.state;
    const island = this.d.island.id;
    // 到达导航标点
    const before = currentNav(s, island);
    if (checkArrive(s, island, player.x, player.z)) {
      sfx('confirm', 0.7);
      this.d.toast(`到达了「${before?.name ?? '标记的地点'}」。`);
    }
    const nav = currentNav(s, island);
    this.beacon.update(dt, nav ? { x: nav.x, z: nav.z, radius: 0 } : null, player, (x, z) => this.d.hf.heightAt(x, z), true);
    // 大地图 / 菜单等模态界面打开时隐藏（否则会盖在大地图上）
    const show = s.settings.showMinimap !== false && this.d.hud.visible && !IslandMap.current?.isOpen && !this.d.ui.busy;
    if (!show) {
      this.widget.update(dt, null);
      return;
    }
    this.refresh -= dt;
    if (this.refresh <= 0) {
      this.refresh = 1.5;
      this.pull();
    }
    this.widget.update(dt, {
      image: this.image,
      worldSize: this.d.island.size,
      fog: this.fog,
      player,
      cameraYaw,
      rotate: s.settings.minimapRotate !== false,
      markers: this.markers,
      quest: this.quest,
      pins: pinsOn(s, island),
      navPin: s.navPin ?? null,
      navTarget: nav && nav.kind === 'marker' ? { x: nav.x, z: nav.z, name: nav.name } : null,
      zone,
    });
  }

  private pull(): void {
    const map = IslandMap.current;
    if (!map) return;
    const v = map.buildView();
    this.fog = v.fog;
    const ws = v.worldSize;
    this.markers = v.markers
      .filter((m) => MINI_KINDS.has(m.kind) && markerVisible(m.kind, v.fog, ws, m.x, m.z, { cleared: m.cleared }))
      .map((m) => ({ x: m.x, z: m.z, glyph: m.kind === 'alpha' && m.name === '？' ? '?' : MAP_ICON[m.kind].glyph, color: m.dim ? '#9aa0b3' : MAP_ICON[m.kind].color }));
    this.quest = v.quest ? { x: v.quest.x, z: v.quest.z, color: CAT_COLOR[v.quest.category] } : null;
  }

  attach(world: THREE.Object3D): void {
    world.add(this.beacon.group);
  }

  dispose(): void {
    if (this.hiResTimer) clearTimeout(this.hiResTimer);
    this.beacon.dispose();
    this.widget.dispose();
  }
}

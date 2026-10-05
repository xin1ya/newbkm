/**
 * M1-17 · 大地图服务：从当前岛屿（地形、区域、地点、封锁点）、探索位图、玩家与追踪任务组装 MapView，
 * 打开 MapScreen。大世界（M 键）、室内（M 键，显示所在建筑门口）、任务日志「在地图上查看」共用。
 */
import type { Game } from '@/core/Game';
import { ZONE_VISITED_PREFIX } from '@/systems/state';
import type { BlockerConfig, IslandConfig, PoiKind } from '@/config/islands';
import { addPin, pinsOn, removePin, setPinKind, toggleNav, toggleNavTarget, type MapMarkerKind } from '@/systems/map';
import { currentObjective, trackedMarker, type Quest } from '@/systems/quests';
import { polygonCentroid, resolveMarker, resolveTracked } from '@/systems/quests/runtime';
import { exploredMask, type GameState } from '@/systems/state';
import { blockerOpen, keyLabel } from '@/systems/interaction';
import { denCooldownLeft } from '@/systems/alpha';
import type { UiRoot } from '@/ui/core/UiRoot';
import { MapScreen, type MapMarker, type MapQuestTarget, type MapView } from '@/ui/map/MapScreen';
import type { Heightfield } from '@/world/terrain/Heightfield';
import { bakeIslandMap } from './islandMapBake';
import type { QuestDirector } from './QuestDirector';

export interface IslandMapSource {
  island: IslandConfig;
  hf: Heightfield;
  /** 玩家在大世界的位置；室内时返回门口位置并附说明 */
  player(): { x: number; z: number; facing: number; note?: string | undefined };
  zoneAt(x: number, z: number): { name: string } | null;
}

/** 封锁点需要的能力（设计 §3.4：骑乘替代秘传） */
const BLOCKER_NEEDS: Record<BlockerConfig['type'], string> = {
  'rock-smash': '需要冲撞骑乘',
  strength: '需要怪力骑乘',
  vines: '需要居合骑乘',
  climb: '需要攀岩骑乘',
  waterfall: '需要攀瀑骑乘',
  dive: '需要潜水骑乘',
  dark: '需要闪光骑乘',
  story: '剧情推进后开放',
  surf: '需要水上骑乘',
};

const POI_KIND: Record<PoiKind, MapMarkerKind> = {
  door: 'door',
  dock: 'dock',
  gym: 'gym',
  pokecenter: 'pokecenter',
  mart: 'mart',
  landmark: 'landmark',
  quest: 'quest',
  fishing: 'fishing',
  ferry: 'ferry',
  cave: 'cave',
};

export class IslandMap {
  static current: IslandMap | null = null;
  /** 正在显示的地图（e2e） */
  screen: MapScreen | null = null;

  constructor(
    private readonly o: {
      game: Game;
      ui: UiRoot;
      state: GameState;
      source: () => IslandMapSource;
      director: () => QuestDirector | null;
    },
  ) {
    IslandMap.current = this;
  }

  get isOpen(): boolean {
    return !!this.screen;
  }

  /** 组装地图数据（纯数据，便于测试） */
  buildView(opts: { questId?: string | undefined } = {}): MapView {
    const src = this.o.source();
    const s = this.o.state;
    const cfg = src.island;
    const fog = exploredMask(s, cfg.id, { size: cfg.size });
    const p = src.player();
    const markers: MapMarker[] = [];
    for (const poi of cfg.pois) {
      if (!poi.showOnMap) continue;
      markers.push({ id: poi.id, kind: POI_KIND[poi.kind], name: poi.name, x: poi.position[0], z: poi.position[2] });
    }
    for (const b of cfg.blockers) {
      markers.push({ id: b.id, kind: 'blocker', name: '无法通行', sub: BLOCKER_NEEDS[b.type], x: b.position[0], z: b.position[2], cleared: blockerOpen(b, (f) => !!s.flags[f]) });
    }
    // M3-17 攀爬点：标在崖脚；没有「攀岩」时副标题提示需要的能力
    const canClimb = !!s.flags['hm08-rock-climb'];
    for (const w of cfg.climbWalls ?? []) {
      markers.push({ id: `climb:${w.id}`, kind: 'climb', name: `攀爬点 · ${w.name}`, sub: canClimb ? '走到崖脚的岩壁纹路前按互动键攀上' : '需要攀岩骑乘（雪原道馆）', x: w.base[0], z: w.base[1] });
    }
    // M3-18 潜水点：深水区漩涡
    const canDive = !!s.flags['hm08-dive'];
    for (const d of cfg.diveSpots ?? []) {
      markers.push({ id: `dive:${d.id}`, kind: 'dive', name: `潜水点 · ${d.name}`, sub: canDive ? '冲浪到漩涡中心按互动键下潜' : '需要潜水骑乘（琉璃镇·深叔）', x: d.center[0], z: d.center[1] });
    }
    // 头目巢穴（计划文档 §3.2）：未发现显示「？」；冷却中灰显
    const day = this.o.game.clock.day;
    for (const den of cfg.alphaDens ?? []) {
      const rec = s.alpha?.[den.id];
      const left = denCooldownLeft(rec, day);
      const sub = !rec?.discovered ? '附近似乎有强大的气息……' : left > 0 ? `冷却中：${left} 天后再次出现` : den.whenText ?? '头目正在巢穴中';
      markers.push({ id: den.id, kind: 'alpha', name: rec?.discovered ? `头目巢穴 · ${den.name}` : '？', sub, x: den.position[0], z: den.position[1], dim: left > 0 });
    }
    const zone = src.zoneAt(p.x, p.z);
    const zones = cfg.zones
      .filter((z) => z.polygon.length >= 3)
      .map((z) => {
        const c = polygonCentroid(z.polygon);
        const known = !!s.flags[`${ZONE_VISITED_PREFIX}${z.id}`] || (!p.note && zone?.name === z.name);
        return { id: z.id, name: z.name, kind: z.kind, x: c.x, z: c.z, levelRange: z.levelRange, known };
      });
    const mapKey = keyLabel(s.settings.keybindings.map?.[0] ?? 'KeyM');
    return {
      islandName: cfg.name,
      image: bakeIslandMap(src.hf, cfg),
      worldSize: cfg.size,
      fog,
      player: { x: p.x, z: p.z, facing: p.facing },
      playerNote: p.note,
      currentZone: p.note ? null : zone?.name ?? null,
      markers,
      zones,
      quest: this.questTarget(cfg, opts.questId),
      focus: opts.questId ? 'quest' : 'player',
      keyLabels: { close: mapKey, center: 'C', quest: 'T' },
      pins: {
        list: () => pinsOn(s, cfg.id),
        nav: () => s.navPin ?? null,
        add: (x, z, kind) => addPin(s, cfg.id, x, z, kind),
        remove: (id) => void removePin(s, id),
        setKind: (id, kind) => setPinKind(s, id, kind),
        toggleNav: (id) => void toggleNav(s, id),
        navMarker: () => (s.navTarget && s.navTarget.island === cfg.id ? s.navTarget.id : null),
        toggleNavMarker: (m) => void toggleNavTarget(s, { island: cfg.id, id: m.id, name: m.name, x: m.x, z: m.z }),
      },
    };
  }

  private questTarget(cfg: IslandConfig, questId: string | undefined): MapQuestTarget | null {
    const d = this.o.director();
    const s = this.o.state;
    const registry = d?.registry;
    if (!registry) return null;
    const q: Quest | null = questId ? registry.get(questId) ?? null : resolveTracked(registry, s.flags, s.settings.trackedQuest);
    if (!q) return null;
    const obj = currentObjective(q, s.flags);
    const marker = trackedMarker(q, s.flags);
    if (!obj || !marker) return null;
    const t = resolveMarker(marker, (id) => {
      const z = cfg.zones.find((zz) => zz.id === id);
      return z ? polygonCentroid(z.polygon) : null;
    });
    if (!t || t.island !== cfg.id) return null;
    return { title: q.title, objective: obj.text, x: t.x, z: t.z, radius: t.zoneId && !t.radius ? 40 : t.radius, category: q.category };
  }

  /** 打开地图；关闭后 resolve。已打开时忽略。 */
  async open(opts: { questId?: string | undefined } = {}): Promise<void> {
    if (this.screen) return;
    const view = this.buildView(opts);
    const screen = new MapScreen(this.o.ui, view);
    this.screen = screen;
    const clock = this.o.game.clock;
    const wasPaused = clock.paused;
    clock.paused = true;
    this.o.ui.push(screen);
    try {
      await screen.done;
    } finally {
      
      clock.paused = wasPaused;
      this.screen = null;
    }
  }
}

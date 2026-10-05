/**
 * M2-10/11/12/13/15 · 室内地城的场地玩法（矿洞 / 火山洞窟 / 异变遗迹）。
 *
 * - 场地能力阻挡（怪力巨石 / 碎岩落石 / 藤蔓）：可见的岩块 + 碰撞；没有能力时靠近显示「需要某能力」提示，
 *   有能力时变成「使用能力」交互，清除后记 `cleared:<id>`（与大地图阻挡同一套标记，离开再进来也保持清除）。
 * - 黑暗房间（闪光）：flag 未置位时把房间灯压到很暗，只有玩家身边一圈微光；置位后正常照明。
 * - 洞窟暗雷：按遇敌表 `grassRatePerMeter`（可被房间覆盖）累计行走距离触发野生战斗。
 * - 剧情触发区：走进范围自动执行一次剧情脚本。
 * - M3-23 碎岩：房间里的裂纹小岩，有「碎岩」可撞碎（掉道具 / 跳出野生宝可梦），离开房间后复原。
 */
import * as THREE from 'three';
import type { InteriorBlocker, RoomConfig } from '@/config/interiors';
import type { CollisionWorld } from '@/world';
import type { GameState } from '@/systems/state/GameState';
import type { Game } from '@/core/Game';
import type { UiRoot } from '@/ui/core';
import { say } from '@/ui/core';
import { createToonMaterial } from '@/render';
import { BLOCKER_ABILITY, BLOCKER_ACTION } from '@/systems/interaction';
import { ENCOUNTER_TABLES } from '@/config/encounters';
import { createWild, grassEncounterCheck, rollEncounter, type TimeOfDay } from '@/systems/encounters';
import type { PokemonInstance } from '@/systems/pokemon/Pokemon';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import { flagsAll, flagsAny } from '@/systems/story';
import { storyDirector } from '@/scenes/common/StoryDirector';
import { sfx } from '@/core/audio';
import type { Interactable } from '@/scenes/common/SceneInteractions';
import type { PlayerController } from '@/actors/player';
import { displayName } from '@/systems/pokemon/Pokemon';
import { ROCK_SMASH_FLAG, rollSmash } from '@/systems/field/rockSmash';
import { addItem } from '@/systems/state/GameState';
import { itemInfo } from '@/systems/items';
import { KEY_ITEM_BY_ID } from '@/config/items';

export interface InteriorFieldDeps {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  rng: Rng;
  world: THREE.Scene;
  collision: CollisionWorld;
  timeOfDay(): TimeOfDay;
  /** 触发野生战斗（由场景实现） */
  startWild(wild: PokemonInstance): void;
  /** 当前是否可以触发（对话 / 切房间 / 战斗中为 false） */
  canTrigger(): boolean;
  toast?: ((text: string) => void) | undefined;
}

interface BuiltBlocker {
  def: InteriorBlocker;
  group: THREE.Group;
}

const ROCK_COLOR: Record<InteriorBlocker['type'], string> = { strength: '#8a7a64', 'rock-smash': '#9a8670', vines: '#3f7a3a' };

export class InteriorField {
  private room: RoomConfig | null = null;
  private blockers: BuiltBlocker[] = [];
  private darkLight: THREE.PointLight | null = null;
  private dimmed: Array<{ light: THREE.Light; base: number }> = [];
  private walked = 0;
  private last: { x: number; z: number } | null = null;
  private graceMeters = 0;
  private running = false;
  private hintCooldown = 0;
  private smash: Array<{ i: number; x: number; z: number; group: THREE.Group }> = [];
  private smashMats: THREE.Material[] = [];
  private smashing = false;

  constructor(private readonly d: InteriorFieldDeps) {}

  private flag(f: string): boolean {
    return this.d.state.flags[f] === true;
  }

  /** 房间切换后重建（lights = 房间灯组，用于黑暗房间压暗） */
  load(room: RoomConfig, lights: THREE.Object3D): void {
    this.dispose();
    this.room = room;
    this.walked = 0;
    this.last = null;
    // 刚进房间先走 6 m 不遇敌（避免一进门就开战）
    this.graceMeters = 6;
    for (const b of room.blockers ?? []) {
      if (this.flag(`cleared:${b.id}`)) continue;
      this.blockers.push({ def: b, group: this.buildBlocker(b) });
    }
    room.smashRocks?.rocks.forEach(([x, z], i) => this.smash.push({ i, x, z, group: this.buildSmashRock(i, x, z) }));
    this.dimmed = [];
    lights.traverse((o) => {
      if ((o as THREE.Light).isLight) this.dimmed.push({ light: o as THREE.Light, base: (o as THREE.Light).intensity });
    });
    this.applyDark();
  }

  /** 当前是否处于「没照亮的黑暗房间」 */
  get isDark(): boolean {
    return !!this.room?.dark && !this.flag(this.room.dark.flag);
  }

  private applyDark(): void {
    const dark = this.isDark;
    for (const { light, base } of this.dimmed) light.intensity = dark ? base * (light instanceof THREE.AmbientLight || light instanceof THREE.HemisphereLight ? 0.08 : 0.04) : base;
    if (dark && !this.darkLight) {
      this.darkLight = new THREE.PointLight('#ffd9a0', 6, 5.5, 1.6);
      this.darkLight.name = 'dark-lantern';
      this.d.world.add(this.darkLight);
    } else if (!dark && this.darkLight) {
      this.darkLight.removeFromParent();
      this.darkLight.dispose();
      this.darkLight = null;
    }
  }

  /** 闪光照亮（剧情 / 交互调用）：置位 flag 并恢复照明 */
  async lightUp(): Promise<void> {
    const room = this.room;
    if (!room?.dark || this.flag(room.dark.flag)) return;
    const lead = this.d.state.party.find((m) => m.hp > 0);
    await say(this.d.ui, [`${lead ? displayName(this.d.dex, lead) : '宝可梦'} 使用了「闪光」！`, '洞窟一下子亮了起来！']);
    sfx('hit');
    this.d.state.flags[room.dark.flag] = true;
    this.d.game.events.emit('flag:set', { flag: room.dark.flag, value: true });
    this.applyDark();
  }

  private buildBlocker(b: InteriorBlocker): THREE.Group {
    const g = new THREE.Group();
    g.name = `blocker:${b.id}`;
    const [w, h, dd] = b.size;
    const mat = createToonMaterial({ color: b.color ?? ROCK_COLOR[b.type], kind: 'scene' });
    if (b.type === 'vines') {
      // 藤蔓墙：几股扭曲的粗藤 + 叶片
      const vm = createToonMaterial({ color: '#2f6a30', kind: 'scene' });
      for (let i = 0; i < 7; i++) {
        const x = -w / 2 + (i + 0.5) * (w / 7);
        const pts = [0, 0.33, 0.66, 1].map((t) => new THREE.Vector3(x + Math.sin(i * 1.7 + t * 5) * 0.25, t * h, Math.cos(i * 2.3 + t * 4) * 0.2));
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.12, 5), vm);
        g.add(tube);
      }
      for (let i = 0; i < 18; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 5, 4), mat);
        leaf.scale.set(1, 0.5, 0.35);
        leaf.position.set(-w / 2 + ((i * 0.37) % 1) * w, ((i * 0.61) % 1) * h, 0.15);
        g.add(leaf);
      }
    } else {
      // 巨石 / 落石堆：扁球二十面体，平直着色
      const n = b.type === 'rock-smash' ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const geo = new THREE.IcosahedronGeometry(1, 1);
        const pos = geo.getAttribute('position');
        for (let k = 0; k < pos.count; k++) {
          const j = 0.85 + (Math.sin(k * 12.9898 + i * 4.1) * 43758.5453 - Math.floor(Math.sin(k * 12.9898 + i * 4.1) * 43758.5453)) * 0.3;
          pos.setXYZ(k, pos.getX(k) * j, pos.getY(k) * j, pos.getZ(k) * j);
        }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat);
        m.material = mat;
        if (n === 1) {
          m.scale.set(w / 2, h / 2, dd / 2);
          m.position.y = h / 2;
        } else {
          const s = i === 0 ? 1 : 0.6;
          m.scale.set((w / 3) * s, (h / 2) * s, (dd / 3) * s);
          m.position.set(i === 0 ? 0 : Math.cos(i * 2.1) * w * 0.3, (h / 2) * s * 0.9, i === 0 ? 0 : Math.sin(i * 2.1) * dd * 0.3);
        }
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      }
      if (b.type === 'rock-smash') {
        // 裂纹：表面一道亮色缝，提示「可以撞碎」
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.7, 0.06), createToonMaterial({ color: '#f2d9a0', kind: 'scene', emissive: '#a07040', emissiveIntensity: 0.4 }));
        crack.position.set(0.1, h * 0.45, dd / 2.6);
        crack.rotation.z = 0.3;
        g.add(crack);
      }
    }
    g.position.set(b.position[0], 0, b.position[1]);
    g.rotation.y = b.yaw ?? 0;
    this.d.world.add(g);
    this.d.collision.add(`iblocker:${b.id}`, { kind: 'box', x: b.position[0], z: b.position[1], hx: w / 2, hz: dd / 2, yaw: b.yaw ?? 0, y0: 0, y1: h });
    return g;
  }

  /** M3-23 裂纹小岩：两三块碎岩叠成一堆，正面一道发光裂缝 */
  private buildSmashRock(i: number, x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.name = `smash-rock:${i}`;
    if (!this.smashMats.length) {
      this.smashMats.push(
        createToonMaterial({ color: '#a08c74', kind: 'scene' }),
        createToonMaterial({ color: '#7e6c58', kind: 'scene' }),
        createToonMaterial({ color: '#f2d9a0', kind: 'scene', emissive: '#a07040', emissiveIntensity: 0.45 }),
      );
    }
    const [light, dark, crackMat] = this.smashMats as [THREE.Material, THREE.Material, THREE.Material];
    const hsh = (n: number) => {
      const v = Math.sin(n * 12.9898 + i * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const pos = geo.getAttribute('position');
      for (let q = 0; q < pos.count; q++) {
        const j = 0.8 + hsh(q + k * 13) * 0.35;
        pos.setXYZ(q, pos.getX(q) * j, pos.getY(q) * j, pos.getZ(q) * j);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, k === 0 ? light : dark);
      const s = k === 0 ? 0.62 : 0.34;
      m.scale.set(s, s * 0.82, s);
      m.position.set(k === 0 ? 0 : Math.cos(k * 2.4 + i) * 0.5, s * 0.75, k === 0 ? 0 : Math.sin(k * 2.4 + i) * 0.5);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), crackMat);
    crack.position.set(0.08, 0.55, 0.55);
    crack.rotation.z = 0.35;
    const crack2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), crackMat);
    crack2.position.set(-0.1, 0.42, 0.56);
    crack2.rotation.z = -0.5;
    g.add(crack, crack2);
    g.position.set(x, 0, z);
    g.rotation.y = hsh(5) * Math.PI * 2;
    this.d.world.add(g);
    this.d.collision.add(`ismash:${i}`, { kind: 'circle', x, z, r: 0.62, y0: 0, y1: 1.1 });
    return g;
  }

  private async smashRock(rock: { i: number; x: number; z: number; group: THREE.Group }): Promise<void> {
    const room = this.room;
    if (!room?.smashRocks || this.smashing) return;
    this.smashing = true;
    try {
      const lead = this.d.state.party.find((m) => m.hp > 0);
      await say(this.d.ui, [`${lead ? displayName(this.d.dex, lead) : '宝可梦'} 使用了「碎岩」！`]);
      sfx('hit-strong');
      // 碎裂：碎块向外弹开、缩小下沉
      const parts = rock.group.children.slice();
      const dirs = parts.map((_, k) => new THREE.Vector3(Math.cos(k * 2.1), 0, Math.sin(k * 2.1)));
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / 500);
          parts.forEach((m, n) => {
            m.position.addScaledVector(dirs[n]!, 0.03);
            m.position.y = Math.max(0, m.position.y + (0.06 - k * 0.14));
            m.scale.multiplyScalar(0.965);
          });
          if (k >= 1) resolve();
          else requestAnimationFrame(step);
        };
        step();
      });
      rock.group.removeFromParent();
      rock.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.d.collision.removeGroup(`ismash:${rock.i}`);
      this.smash = this.smash.filter((r) => r !== rock);
      this.d.game.events.emit('rock:smashed', { index: rock.i });
      const table = room.encounters ? ENCOUNTER_TABLES[room.encounters.table] : undefined;
      const canFight = !!table && this.d.state.party.some((m) => m.hp > 0);
      const res = rollSmash(this.d.rng, room.smashRocks, canFight);
      if (res.kind === 'wild' && table) {
        const rolled = rollEncounter(table, { time: this.d.timeOfDay(), weather: 'clear', method: 'cave' }, this.d.rng, this.d.dex);
        if (rolled) {
          this.graceMeters = 8;
          this.d.toast?.('碎石里突然跳出了野生宝可梦！');
          this.d.startWild(createWild(this.d.dex, { ...rolled, count: 1, formation: 'single' }, this.d.rng));
          return;
        }
      }
      if (res.kind === 'item') {
        addItem(this.d.state, res.item, res.qty);
        sfx('item');
        const name = itemInfo(this.d.dex, res.item, KEY_ITEM_BY_ID).name;
        this.d.toast?.(`在碎石里找到了 ${name}${res.qty > 1 ? ` ×${res.qty}` : ''}！`);
      } else this.d.toast?.('岩石碎了……里面什么也没有。');
    } finally {
      this.smashing = false;
    }
  }

  /** 交互源：阻挡物 + 黑暗房间的「闪光」 */
  source(): (player: PlayerController, out: Interactable[]) => void {
    return (player, out) => {
      const p = player.position;
      for (const bb of this.blockers) {
        const b = bb.def;
        const reach = Math.max(b.size[0], b.size[2]) / 2 + 1.6;
        if (Math.hypot(p.x - b.position[0], p.z - b.position[1]) > reach + 1.5) continue;
        const has = this.flag(b.requiresFlag);
        out.push({
          id: `iblocker:${b.id}`,
          kind: 'blocked',
          x: b.position[0],
          z: b.position[1],
          y: b.size[1] + 0.6,
          label: has ? `${BLOCKER_ACTION[b.type] ?? '使用能力'}（${BLOCKER_ABILITY[b.type]}）` : '无法通过',
          action: has ? 'interact' : null,
          range: reach,
          ...(has ? { run: () => this.clear(bb) } : { ability: BLOCKER_ABILITY[b.type] ?? b.type, hint: b.hint }),
        });
      }
      if (this.smashing) return;
      const canSmash = this.flag(ROCK_SMASH_FLAG);
      for (const r of this.smash) {
        if (Math.hypot(p.x - r.x, p.z - r.z) > 3) continue;
        out.push({
          id: `ismash:${r.i}`,
          kind: 'blocked',
          x: r.x,
          z: r.z,
          y: 1.5,
          label: canSmash ? '撞碎岩石（碎岩）' : '裂纹岩',
          action: canSmash ? 'interact' : null,
          range: 1.9,
          ...(canSmash ? { run: () => this.smashRock(r) } : { ability: '碎岩', hint: '布满裂纹的岩石……用「碎岩」或许能撞碎，说不定里面藏着什么。' }),
        });
      }
    };
  }

  private async clear(bb: BuiltBlocker): Promise<void> {
    const b = bb.def;
    const lead = this.d.state.party.find((m) => m.hp > 0);
    await say(this.d.ui, [`${lead ? displayName(this.d.dex, lead) : '宝可梦'} 使用了「${BLOCKER_ABILITY[b.type]}」！`]);
    sfx(b.type === 'vines' ? 'hit' : b.type === 'strength' ? 'bump' : 'hit-strong');
    const t0 = performance.now();
    const start = bb.group.position.clone();
    await new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 650);
        if (b.type === 'strength') bb.group.position.set(start.x, start.y - k * 0.2, start.z - k * 2.5);
        else bb.group.position.y = -k * (b.type === 'vines' ? 3 : 2.2);
        if (k >= 1) resolve();
        else requestAnimationFrame(step);
      };
      step();
    });
    bb.group.removeFromParent();
    this.d.collision.removeGroup(`iblocker:${b.id}`);
    this.blockers = this.blockers.filter((x) => x !== bb);
    this.d.state.flags[`cleared:${b.id}`] = true;
    this.d.game.events.emit('flag:set', { flag: `cleared:${b.id}`, value: true });
    this.d.game.events.emit('blocker:cleared', { id: b.id, type: b.type });
  }

  update(dt: number, player: PlayerController): void {
    this.hintCooldown = Math.max(0, this.hintCooldown - dt);
    const p = player.position;
    if (this.darkLight) this.darkLight.position.set(p.x, p.y + 1.6, p.z);
    const room = this.room;
    if (!room || this.running || !this.d.canTrigger()) {
      this.last = { x: p.x, z: p.z };
      return;
    }
    // 剧情触发区
    for (const t of room.triggers ?? []) {
      if (this.flag(t.doneFlag) || !flagsAll(this.d.state.flags, t.showIf) || flagsAny(this.d.state.flags, t.hideIf)) continue;
      if (Math.hypot(p.x - t.position[0], p.z - t.position[1]) > t.radius) continue;
      this.running = true;
      void (async () => {
        try {
          await storyDirector()?.run(t.script);
          if (!t.repeat && !this.flag(t.doneFlag)) this.d.state.flags[t.doneFlag] = true;
        } finally {
          this.running = false;
        }
      })();
      return;
    }
    // 黑暗房间：掌握了「闪光」就自动照亮；否则定时提示
    if (this.isDark && room.dark && this.flag('field-flash')) {
      this.running = true;
      void this.lightUp().finally(() => (this.running = false));
      return;
    }
    if (this.isDark && this.hintCooldown <= 0 && room.dark) {
      this.hintCooldown = 25;
      this.d.toast?.(room.dark.hint);
    }
    // 暗雷
    const enc = room.encounters;
    if (!enc || !this.last) {
      this.last = { x: p.x, z: p.z };
      return;
    }
    const step = Math.hypot(p.x - this.last.x, p.z - this.last.z);
    this.last = { x: p.x, z: p.z };
    if (step <= 0 || step > 2) return;
    if (this.graceMeters > 0) {
      this.graceMeters -= step;
      return;
    }
    const table = ENCOUNTER_TABLES[enc.table];
    if (!table || !this.d.state.party.some((m) => m.hp > 0)) return;
    this.walked += step;
    if (this.walked < 1) return;
    const dist = this.walked;
    this.walked = 0;
    const rate = enc.ratePerMeter ?? table.grassRatePerMeter ?? 0.04;
    if (!grassEncounterCheck({ ...table, grassRatePerMeter: rate }, dist, this.d.rng)) return;
    const rolled = rollEncounter(table, { time: this.d.timeOfDay(), weather: 'clear', method: 'cave' }, this.d.rng, this.d.dex);
    if (!rolled) return;
    this.graceMeters = 8;
    const wild = createWild(this.d.dex, { ...rolled, count: 1, formation: 'single' }, this.d.rng);
    this.d.startWild(wild);
  }

  dispose(): void {
    for (const bb of this.blockers) {
      bb.group.removeFromParent();
      this.d.collision.removeGroup(`iblocker:${bb.def.id}`);
    }
    this.blockers = [];
    for (const r of this.smash) {
      r.group.removeFromParent();
      r.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.d.collision.removeGroup(`ismash:${r.i}`);
    }
    this.smash = [];
    if (this.darkLight) {
      this.darkLight.removeFromParent();
      this.darkLight.dispose();
      this.darkLight = null;
    }
    this.room = null;
  }
}

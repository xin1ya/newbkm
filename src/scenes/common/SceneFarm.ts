/**
 * 计划文档 §9.3 · 大地图种植运行时：
 * - 田地模型（world/props/FarmPlot）每 2 秒按存档结算并同步（下雨自动浇水）；
 * - 互动：靠近田地按 E ——空田：选背包里的树果种下；生长中：照料面板（浇水 / 施肥 / 除草 / 驱虫 / 查看）；
 *   结果：收获（1 秒采摘动作 → 果实飞入背包）；
 * - 跟随草 / 虫系宝可梦时，打开面板会先帮忙清掉杂草和虫子。
 */
import type * as THREE from 'three';
import type { Dex } from '@/systems/data/Dex';
import type { GameState } from '@/systems/state';
import type { Rng } from '@/systems/rng';
import { itemInfo } from '@/systems/items';
import { actXp, gainBreederXp } from '@/systems/breeder';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { BERRIES, BERRY_BY_ID } from '@/config/berries';
import { FARM_PLOTS, FIELD_ZH } from '@/config/farm';
import {
  applyMulch,
  clearPests,
  clearWeeds,
  expectedYield,
  farmState,
  fieldLockHint,
  fieldUnlocked,
  harvest,
  MULCHES,
  MULCH_ZH,
  minutesToHarvest,
  plant,
  settleFarm,
  STAGE_ZH,
  stageOf,
  water,
  WATERING_CAN,
  GOLDEN_WATERING_CAN,
  type PlotDef,
  type PlotState,
} from '@/systems/farming';
import { FarmPlots, type PlotVisual } from '@/world/props/FarmPlot';
import type { PlayerController } from '@/actors/player';
import type { Interactable, InteractSource } from './SceneInteractions';
import { choose, say, type UiRoot } from '@/ui/core';
import { itemIconSvg } from '@/ui/core/itemIcons';
import { sfx } from '@/core/audio';

export interface SceneFarmDeps {
  island: string;
  parent: THREE.Object3D;
  player: PlayerController;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  rng: Rng;
  heightAt(x: number, z: number): number;
  minutes(): number;
  weather(): string;
  follower(): { speciesId: number; emote(text: string): void } | null;
  toast(text: string, ms?: number): void;
}

const RAINY = new Set(['rain', 'storm']);
const growHoursOf = (id: string) => BERRY_BY_ID.get(id)?.growHours ?? 24;

export class SceneFarm {
  readonly defs: PlotDef[];
  readonly view: FarmPlots;
  private clock = 0;
  private t = 0;
  busy = false;

  constructor(private readonly d: SceneFarmDeps) {
    this.defs = FARM_PLOTS.filter((p) => p.island === d.island).map((p) => p.def);
    this.view = new FarmPlots(this.defs, d.parent, d.heightAt);
    farmState(d.state);
    this.settle();
  }

  private name(id: string): string {
    return itemInfo(this.d.dex, id, KEY_ITEM_BY_ID).name;
  }

  settle(): void {
    settleFarm(this.d.state, growHoursOf, this.d.minutes(), RAINY.has(this.d.weather()), this.d.rng);
    this.view.sync(this.visuals());
  }

  visuals(): PlotVisual[] {
    const f = farmState(this.d.state);
    return this.defs.map((def) => {
      const p = f.plots[def.id];
      if (!p) return { stage: null, wet: false, weeds: false, pests: false, leaf: '#4f9a48', fruit: '#e8484a' };
      const b = BERRY_BY_ID.get(p.berry);
      return { stage: stageOf(p, growHoursOf(p.berry)), wet: p.water > 0, weeds: p.weeds, pests: p.pests, leaf: b?.color.leaf ?? '#4f9a48', fruit: b?.color.fruit ?? '#e8484a' };
    });
  }

  private unlocked(def: PlotDef): boolean {
    return fieldUnlocked(def.field, this.d.state.flags);
  }

  source(): InteractSource {
    return (_player, out: Interactable[]) => {
      if (this.busy) return;
      const pp = this.d.player.position;
      const f = farmState(this.d.state);
      this.defs.forEach((def, i) => {
        const [x, z] = def.position;
        if (Math.abs(pp.x - x) > 4 || Math.abs(pp.z - z) > 4) return;
        const p = f.plots[def.id];
        const y = this.view.groundY(i) + 1.4;
        const base = { id: `farm:${def.id}`, kind: 'examine' as const, x, z, y, range: 1.9, priority: 1, action: 'interact' as const };
        if (!this.unlocked(def)) {
          out.push({ ...base, label: '查看田地', run: () => this.d.toast(fieldLockHint(def.field, this.d.state.flags), 2600) });
          return;
        }
        if (!p) out.push({ ...base, label: '种树果', run: () => this.plantFlow(def) });
        else if (stageOf(p, growHoursOf(p.berry)) === 4) out.push({ ...base, label: `收获${this.name(p.berry)}`, run: () => this.harvestFlow(def) });
        else out.push({ ...base, label: '照料田地', run: () => this.careFlow(def) });
      });
    };
  }

  private async plantFlow(def: PlotDef): Promise<void> {
    const bag = this.d.state.bag;
    const owned = BERRIES.filter((b) => (bag[b.id] ?? 0) > 0);
    if (!owned.length) {
      await say(this.d.ui, '背包里没有可以种的树果。去野外的树果树摘一些，或者到果摊买吧。');
      return;
    }
    const pick = await choose(
      this.d.ui,
      owned.map((b) => ({ label: `${b.name} ×${bag[b.id]}`, value: b.id, sub: `${b.growHours} 小时结果 · 收获 2–6 个`, icon: itemIconSvg(b.id) })),
      { cancellable: true, style: { maxHeight: '60vh', overflowY: 'auto' } },
    );
    if (!pick) return;
    if (!plant(this.d.state, def, pick, this.d.minutes())) return;
    this.d.player.model.gesture('crouch', 0.8);
    sfx('step-ground', 0.6);
    this.view.sync(this.visuals());
    this.d.toast(`在${FIELD_ZH[def.field]}种下了${this.name(pick)}。记得浇水！`, 2400);
  }

  private status(p: PlotState): string {
    const gh = growHoursOf(p.berry);
    const st = stageOf(p, gh);
    const left = minutesToHarvest(p, gh);
    const h = Math.floor(left / 60);
    const m = Math.round(left % 60);
    const lines = [
      `${this.name(p.berry)} · ${STAGE_ZH[st]}${st < 4 ? `（距结果约 ${h} 小时 ${m} 分）` : ''}`,
      `水分 ${Math.round(p.water)}% · 已浇水阶段 ${p.watered.filter(Boolean).length}/4`,
      `肥料：${p.mulch ? MULCH_ZH[p.mulch] : '无'}${p.weeds ? ' · 长了杂草' : ''}${p.pests ? ' · 有虫害' : ''}`,
      `预计收获 ${expectedYield(p)} 个`,
    ];
    return lines.join('\n');
  }

  private async careFlow(def: PlotDef): Promise<void> {
    const s = this.d.state;
    // 跟随宝可梦帮忙
    const fol = this.d.follower();
    if (fol) {
      const types = this.d.dex.species(fol.speciesId).types;
      const p0 = farmState(s).plots[def.id];
      const helped: string[] = [];
      if (p0?.weeds && types.includes('grass') && clearWeeds(s, def)) helped.push('拔掉了杂草');
      if (p0?.pests && types.includes('bug') && clearPests(s, def)) helped.push('赶走了虫子');
      if (helped.length) {
        fol.emote('♪');
        this.d.toast(`${this.d.dex.species(fol.speciesId).name.zh}${helped.join('，还')}！`, 2200);
        this.view.sync(this.visuals());
      }
    }
    for (;;) {
      const p = farmState(s).plots[def.id];
      if (!p) return;
      const gh = growHoursOf(p.berry);
      if (stageOf(p, gh) === 4) return;
      const header = document.createElement('div');
      header.style.cssText = 'white-space:pre-line;font-size:13px;line-height:1.5;opacity:.9;padding:4px 6px 8px;border-bottom:1px solid rgba(255,255,255,.15);margin-bottom:4px;';
      header.textContent = this.status(p);
      const golden = (s.bag[GOLDEN_WATERING_CAN] ?? 0) > 0;
      const hasCan = golden || (s.bag[WATERING_CAN] ?? 0) > 0;
      const mulches = MULCHES.filter((m) => (s.bag[m] ?? 0) > 0);
      type Act = 'water' | 'mulch' | 'weed' | 'pest';
      const act = await choose<Act>(
        this.d.ui,
        [
          { label: '浇水', value: 'water', disabled: !hasCan || p.water >= 99, sub: hasCan ? (p.water >= 99 ? '土还很湿' : undefined) : '需要喷壶', icon: itemIconSvg(golden ? GOLDEN_WATERING_CAN : WATERING_CAN) },
          { label: '施肥', value: 'mulch', disabled: !!p.mulch || stageOf(p, gh) !== 0 || !mulches.length, sub: p.mulch ? '已经施过肥' : stageOf(p, gh) !== 0 ? '发芽后就不能施肥了' : mulches.length ? undefined : '没有肥料' },
          { label: '除草', value: 'weed', disabled: !p.weeds },
          { label: '驱虫', value: 'pest', disabled: !p.pests },
        ],
        { cancellable: true, header, style: { minWidth: '300px' } },
      );
      if (!act) return;
      if (act === 'water' && water(s, def, gh)) {
        this.d.player.model.gesture('crouch', 0.6);
        sfx('splash', 0.4);
        this.d.toast('哗啦啦——土壤吸饱了水。', 1400);
      } else if (act === 'mulch') {
        const m = await choose(
          this.d.ui,
          mulches.map((x) => ({ label: `${MULCH_ZH[x]} ×${s.bag[x]}`, value: x, sub: KEY_ITEM_BY_ID.get(x)?.desc, icon: itemIconSvg(x) })),
          { cancellable: true },
        );
        if (m && applyMulch(s, def, m, gh)) this.d.toast(`施了${MULCH_ZH[m]}。`, 1400);
      } else if (act === 'weed' && clearWeeds(s, def)) {
        this.d.player.model.gesture('crouch', 0.8);
        this.d.toast('把杂草拔干净了。', 1400);
      } else if (act === 'pest' && clearPests(s, def)) {
        this.d.player.model.gesture('crouch', 0.8);
        this.d.toast('把叶子上的虫子赶跑了。', 1400);
      }
      this.view.sync(this.visuals());
    }
  }

  private async harvestFlow(def: PlotDef): Promise<void> {
    const p = farmState(this.d.state).plots[def.id];
    if (!p || this.busy) return;
    this.busy = true;
    this.d.player.model.gesture('crouch', 1);
    await new Promise<void>((r) => setTimeout(r, 1000));
    const r = harvest(this.d.state, def, growHoursOf(p.berry), this.d.rng);
    this.busy = false;
    this.view.sync(this.visuals());
    if (!r) return;
    gainBreederXp(this.d.state, 'harvest', actXp('harvest', r.qty + (r.bonus ? 1 : 0)));
    sfx('item', 0.8);
    this.d.toast(`收获了 ${this.name(r.berry)} ×${r.qty}！${r.bonus ? `\n变异肥起作用了，还长出了 1 个${this.name(r.bonus)}！` : ''}`, 2800);
  }

  update(dt: number): void {
    this.t += dt;
    this.view.animate(this.t);
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 2;
    this.settle();
  }

  dispose(): void {
    this.view.dispose();
  }
}

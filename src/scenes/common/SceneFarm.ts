/**
 * 计划文档 §9.3 · 大地图种植运行时：
 * - 田地模型（world/props/FarmPlot）每 2 秒按存档结算并同步（下雨自动浇水）；
 * - 互动：靠近田地按 E ——空田：选背包里的树果种下；生长中：照料面板（浇水 / 施肥 / 除草 / 驱虫 / 查看）；
 *   结果：收获（1 秒采摘动作 → 果实飞入背包）；
 * - 跟随草 / 虫系宝可梦时，打开面板会先帮忙清掉杂草和虫子。
 * - 宝可梦照料（helpers.ts）：田地旁按 F「田地管理」——派驻箱子里的宝可梦打工（在田边走动，按属性浇水 / 催生 / 除草 /
 *   驱虫 / 翻土，结果后自动收获）、自动续种开关、照料宝可梦（喂树果 / 梳毛 / 玩耍）；靠近驻场宝可梦按 E 也能照料。
 */
import type * as THREE from 'three';
import type { Dex } from '@/systems/data/Dex';
import type { GameState } from '@/systems/state';
import type { Rng } from '@/systems/rng';
import { actXp, gainBreederXp } from '@/systems/breeder';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { BERRIES, BERRY_BY_ID, EV_BERRIES, mainFlavor, FLAVOR_ZH } from '@/config/berries';
import { removeItem as removeItemSafe } from '@/systems/state';
import { applyToPokemon, canUseOn, itemInfo } from '@/systems/items';
import { displayName, maxHp, type PokemonInstance } from '@/systems/pokemon';
import { natureTaste } from '@/systems/blocks';
import { createMonModel, disposeMonModel, monHeight, setMonLoop, updateMonModel } from '@/actors/pokemon/monModel';
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
  settlePlot,
  settlePlotWithHelpers,
  fieldHelpers,
  perksOf,
  jobsOf,
  farmCare,
  assignHelper,
  recallHelper,
  helperField,
  payHelpers,
  careRecord,
  addFriendship,
  flavorEv,
  FLAVOR_STAT,
  CARE_FEED_PER_DAY,
  HELPERS_PER_FIELD,
  type FarmField,
  type AutoHarvest,
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
    const s = this.d.state;
    const now = this.d.minutes();
    const raining = RAINY.has(this.d.weather());
    const f = farmState(s);
    const care = farmCare(s);
    const reaped: AutoHarvest[] = [];
    const fields = [...new Set(this.defs.map((d) => d.field))];
    const elapsed = care.paidAt === undefined ? 0 : Math.max(0, now - care.paidAt);
    care.paidAt = now;
    for (const field of fields) {
      const helpers = this.unlockedField(field) ? fieldHelpers(s, field) : [];
      const perks = perksOf(helpers.map((h) => this.d.dex.species(h.speciesId).types));
      payHelpers(s, helpers, elapsed);
      for (const def of this.defs) {
        if (def.field !== field) continue;
        const p = f.plots[def.id];
        if (!p) continue;
        const gh = growHoursOf(p.berry);
        if (helpers.length) reaped.push(...settlePlotWithHelpers(s, def, perks, gh, now, raining, this.d.rng, !!care.replant[field]));
        else settlePlot(p, gh, now, raining, this.d.rng);
      }
    }
    if (reaped.length) this.reportHarvest(reaped);
    this.syncHelpers();
    this.view.sync(this.visuals());
  }

  private unlockedField(field: FarmField): boolean {
    return fieldUnlocked(field, this.d.state.flags);
  }

  private reportHarvest(list: AutoHarvest[]): void {
    const sum = new Map<string, number>();
    let bonus = 0;
    let replanted = 0;
    for (const h of list) {
      sum.set(h.berry, (sum.get(h.berry) ?? 0) + h.qty);
      if (h.bonus) {
        sum.set(h.bonus, (sum.get(h.bonus) ?? 0) + 1);
        bonus++;
      }
      if (h.replanted) replanted++;
    }
    const items = [...sum].filter(([, q]) => q > 0).map(([id, q]) => `${this.name(id)}×${q}`).join('、');
    const xp = [...sum.values()].reduce((a, b) => a + b, 0);
    if (xp > 0) gainBreederXp(this.d.state, 'harvest', actXp('harvest', xp));
    this.d.toast(`🌱 驻场宝可梦收获了 ${items || '树果'}${bonus ? '（含变异肥额外果实）' : ''}${replanted ? `，已续种 ${replanted} 块` : ''}`, 3200);
  }

  // ———————————————— 驻场宝可梦（田边走动的模型） ————————————————

  private helperViews = new Map<string, { uid: string; root: THREE.Group; field: FarmField; tx: number; tz: number; wait: number }>();

  private syncHelpers(): void {
    const s = this.d.state;
    const want = new Map<string, { p: PokemonInstance; field: FarmField }>();
    for (const field of new Set(this.defs.map((d) => d.field))) {
      if (!this.unlockedField(field)) continue;
      for (const p of fieldHelpers(s, field)) want.set(p.uid, { p, field });
    }
    for (const [uid, v] of this.helperViews) {
      if (want.get(uid)?.field === v.field) continue;
      v.root.removeFromParent();
      disposeMonModel(v.root);
      this.helperViews.delete(uid);
    }
    for (const [uid, { p, field }] of want) {
      if (this.helperViews.has(uid)) continue;
      const plots = this.defs.filter((d) => d.field === field);
      const at = plots[this.helperViews.size % plots.length]!.position;
      const root = createMonModel(this.d.dex, p, { height: Math.min(1.8, monHeight(this.d.dex, p)), label: displayName(this.d.dex, p) });
      root.position.set(at[0] + 1.3, this.d.heightAt(at[0] + 1.3, at[1] + 1.3), at[1] + 1.3);
      root.name = `farm-helper:${uid}`;
      this.d.parent.add(root);
      setMonLoop(root, 'idle');
      this.helperViews.set(uid, { uid, root, field, tx: root.position.x, tz: root.position.z, wait: 1 + Math.random() * 3 });
    }
  }

  private animateHelpers(dt: number): void {
    for (const v of this.helperViews.values()) {
      const r = v.root;
      updateMonModel(r, dt);
      const dx = v.tx - r.position.x;
      const dz = v.tz - r.position.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.15) {
        const step = Math.min(l, dt * 1.1);
        r.position.x += (dx / l) * step;
        r.position.z += (dz / l) * step;
        r.position.y = this.d.heightAt(r.position.x, r.position.z);
        r.rotation.y = Math.atan2(dx, dz);
        continue;
      }
      if (v.wait === -1) {
        setMonLoop(r, 'idle');
        v.wait = 3 + Math.random() * 5;
      }
      v.wait -= dt;
      if (v.wait > 0) continue;
      // 走到同一块田地里随机一块地的田埂边
      const plots = this.defs.filter((d) => d.field === v.field);
      const pl = plots[Math.floor(Math.random() * plots.length)]!;
      const side = Math.random() < 0.5 ? -1.25 : 1.25;
      v.tx = pl.position[0] + (Math.random() < 0.5 ? side : (Math.random() - 0.5) * 1.6);
      v.tz = pl.position[1] + (Math.random() < 0.5 ? side : (Math.random() - 0.5) * 1.6);
      v.wait = -1;
      setMonLoop(r, 'walk', 0.8);
    }
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
        const manage = this.unlocked(def) ? { action: 'sendOut' as const, label: '田地管理', kind: 'examine', run: () => this.manageFlow(def.field) } : undefined;
        const base = { id: `farm:${def.id}`, kind: 'examine' as const, x, z, y, range: 1.9, priority: 1, action: 'interact' as const, ...(manage ? { secondary: manage } : {}) };
        if (!this.unlocked(def)) {
          out.push({ ...base, label: '查看田地', run: () => this.d.toast(fieldLockHint(def.field, this.d.state.flags), 2600) });
          return;
        }
        if (!p) out.push({ ...base, label: '种树果', run: () => this.plantFlow(def) });
        else if (stageOf(p, growHoursOf(p.berry)) === 4) out.push({ ...base, label: `收获${this.name(p.berry)}`, run: () => this.harvestFlow(def) });
        else out.push({ ...base, label: '照料田地', run: () => this.careFlow(def) });
      });
      for (const v of this.helperViews.values()) {
        const hp = v.root.position;
        if (Math.abs(pp.x - hp.x) > 3 || Math.abs(pp.z - hp.z) > 3) continue;
        const mon = this.d.state.box.find((p) => p.uid === v.uid);
        if (!mon) continue;
        out.push({ id: `farm-helper:${v.uid}`, kind: 'examine', x: hp.x, z: hp.z, y: hp.y + 1.2, range: 1.8, priority: 2, action: 'interact', label: `照料${displayName(this.d.dex, mon)}`, run: () => this.careMon(mon) });
      }
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

  // ———————————————— 田地管理 / 照料 ————————————————

  private header(text: string): HTMLDivElement {
    const h = document.createElement('div');
    h.style.cssText = 'white-space:pre-line;font-size:13px;line-height:1.5;opacity:.9;padding:4px 6px 8px;border-bottom:1px solid rgba(255,255,255,.15);margin-bottom:4px;';
    h.textContent = text;
    return h;
  }

  private monLabel(p: PokemonInstance): string {
    return `${displayName(this.d.dex, p)} Lv.${p.level}`;
  }

  async manageFlow(field: FarmField): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (;;) {
        const s = this.d.state;
        const helpers = fieldHelpers(s, field);
        const care = farmCare(s);
        const jobs = new Set(helpers.flatMap((h) => jobsOf(this.d.dex.species(h.speciesId).types)));
        type Act = 'helpers' | 'replant' | 'care';
        const act = await choose<Act>(
          this.d.ui,
          [
            { label: `驻场宝可梦（${helpers.length}/${HELPERS_PER_FIELD}）`, value: 'helpers', sub: helpers.length ? helpers.map((h) => displayName(this.d.dex, h)).join('、') : '从箱子里派宝可梦来帮忙' },
            { label: `自动续种：${care.replant[field] ? '开' : '关'}`, value: 'replant', sub: '驻场宝可梦收获后用 1 个果实原地续种（背包有同种肥料时一并施肥）' },
            { label: '照料宝可梦', value: 'care', sub: '喂树果 / 梳毛 / 玩耍，提升亲密度' },
          ],
          { cancellable: true, header: this.header(`${FIELD_ZH[field]}\n驻场工作：${helpers.length ? [...jobs].join(' · ') : '无'}`), style: { minWidth: '340px' } },
        );
        if (!act) return;
        if (act === 'replant') {
          care.replant[field] = !care.replant[field];
          sfx('cursor', 0.5);
          this.d.toast(care.replant[field] ? '自动续种已开启（需要有驻场宝可梦）' : '自动续种已关闭', 1800);
        } else if (act === 'helpers') await this.helpersFlow(field);
        else await this.careMenu(field);
      }
    } finally {
      this.busy = false;
    }
  }

  private async helpersFlow(field: FarmField): Promise<void> {
    for (;;) {
      const s = this.d.state;
      const helpers = fieldHelpers(s, field);
      const pick = await choose<string>(
        this.d.ui,
        [
          ...helpers.map((h) => ({ label: `撤回 ${this.monLabel(h)}`, value: `del:${h.uid}`, sub: jobsOf(this.d.dex.species(h.speciesId).types).join(' · ') })),
          { label: '派驻新的宝可梦', value: 'add', disabled: helpers.length >= HELPERS_PER_FIELD || !s.box.length, sub: !s.box.length ? '箱子里没有宝可梦（只能派驻箱子里的）' : helpers.length >= HELPERS_PER_FIELD ? '这块田地已经满员' : undefined },
        ],
        { cancellable: true, header: this.header('水/冰：浇水　草：催生+除草　虫/飞行：驱虫\n地面/岩石/格斗/一般：除草+翻土（收获+1）　任何宝可梦：自动收获'), style: { minWidth: '340px' } },
      );
      if (!pick) return;
      if (pick.startsWith('del:')) {
        recallHelper(s, pick.slice(4));
        this.d.toast('撤回了驻场宝可梦（回到箱子里休息）', 1600);
      } else {
        const cands = s.box.filter((p) => helperField(s, p.uid) !== field);
        const uid = await choose<string>(
          this.d.ui,
          cands.map((p) => {
            const other = helperField(s, p.uid);
            return { label: this.monLabel(p), value: p.uid, sub: `${jobsOf(this.d.dex.species(p.speciesId).types).join(' · ')}${other ? `（现在在${FIELD_ZH[other]}）` : ''}` };
          }),
          { cancellable: true, style: { maxHeight: '60vh', overflowY: 'auto', minWidth: '320px' } },
        );
        if (uid && assignHelper(s, field, uid)) {
          const p = s.box.find((x) => x.uid === uid)!;
          sfx('confirm', 0.6);
          this.d.toast(`${displayName(this.d.dex, p)} 来${FIELD_ZH[field]}帮忙了！`, 2000);
        }
      }
      this.syncHelpers();
    }
  }

  private async careMenu(field: FarmField): Promise<void> {
    const s = this.d.state;
    const mons = [...s.party, ...fieldHelpers(s, field)];
    const uid = await choose<string>(
      this.d.ui,
      mons.map((p) => ({ label: this.monLabel(p), value: p.uid, sub: `亲密度 ${p.friendship}/255${s.party.includes(p) ? '' : ' · 驻场中'}` })),
      { cancellable: true, style: { maxHeight: '60vh', overflowY: 'auto', minWidth: '300px' } },
    );
    const p = uid ? mons.find((m) => m.uid === uid) : null;
    if (p) await this.careMon(p, true);
  }

  private today(): number {
    return Math.floor(this.d.minutes() / 1440);
  }

  async careMon(p: PokemonInstance, nested = false): Promise<void> {
    if (this.busy && !nested) return;
    const was = this.busy;
    this.busy = true;
    try {
      for (;;) {
        const s = this.d.state;
        const rec = careRecord(s, p.uid, this.today());
        const name = displayName(this.d.dex, p);
        const nat = this.d.dex.nature(p.nature);
        const taste = natureTaste(nat);
        const max = maxHp(this.d.dex, p);
        type Act = 'feed' | 'brush' | 'play';
        const act = await choose<Act>(
          this.d.ui,
          [
            { label: `喂树果（今天 ${rec.fed}/${CARE_FEED_PER_DAY}）`, value: 'feed', disabled: rec.fed >= CARE_FEED_PER_DAY || !BERRIES.some((b) => (s.bag[b.id] ?? 0) > 0), sub: taste.likes ? `喜欢${FLAVOR_ZH[taste.likes]}味${taste.dislikes ? `，讨厌${FLAVOR_ZH[taste.dislikes]}味` : ''}` : '不挑食' },
            { label: '梳毛', value: 'brush', disabled: rec.brushed, sub: rec.brushed ? '今天已经梳过了' : '亲密度 +3，治好异常状态' },
            { label: '玩耍', value: 'play', disabled: rec.played || p.hp <= 0, sub: rec.played ? '今天已经玩过了' : p.hp <= 0 ? '先让它恢复精神吧' : '亲密度 +2，回复 25% HP' },
          ],
          { cancellable: true, header: this.header(`${name} Lv.${p.level}\n亲密度 ${p.friendship}/255 · HP ${p.hp}/${max}${p.status ? ' · 异常状态' : ''}`), style: { minWidth: '320px' } },
        );
        if (!act) return;
        this.d.player.model.gesture('crouch', 0.8);
        if (act === 'brush') {
          rec.brushed = true;
          addFriendship(p, 3);
          const cured = !!p.status;
          p.status = null;
          sfx('item', 0.5);
          this.d.toast(`给${name}梳了梳毛，它舒服地眯起了眼睛♪${cured ? '\n异常状态也好了。' : ''}`, 2200);
        } else if (act === 'play') {
          rec.played = true;
          addFriendship(p, 2);
          p.hp = Math.min(max, p.hp + Math.ceil(max * 0.25));
          sfx('confirm', 0.5);
          this.d.toast(`和${name}在田埂上玩了一会儿，它精神多了！`, 2200);
        } else await this.feed(p, rec);
        this.follow(p);
      }
    } finally {
      this.busy = was;
    }
  }

  /** 照料后让对应的驻场宝可梦冒个表情 */
  private follow(p: PokemonInstance): void {
    const v = this.helperViews.get(p.uid);
    if (v) setMonLoop(v.root, 'idle');
    const fol = this.d.follower();
    if (fol && fol.speciesId === p.speciesId && this.d.state.party[0]?.uid === p.uid) fol.emote('♥');
  }

  private async feed(p: PokemonInstance, rec: { fed: number }): Promise<void> {
    const s = this.d.state;
    const owned = BERRIES.filter((b) => (s.bag[b.id] ?? 0) > 0);
    const taste = natureTaste(this.d.dex.nature(p.nature));
    const STAT: Record<string, string> = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度', hp: 'HP' };
    const id = await choose<string>(
      this.d.ui,
      owned.map((b) => {
        const fl = mainFlavor(b);
        const ev = EV_BERRIES[b.id];
        const sub = ev ? `${STAT[ev]}努力值 −10` : `${FLAVOR_ZH[fl]}味 · ${STAT[FLAVOR_STAT[fl]!]}努力值 +2${fl === taste.likes ? ' · 喜欢' : fl === taste.dislikes ? ' · 讨厌' : ''}`;
        return { label: `${b.name} ×${s.bag[b.id]}`, value: b.id, sub, icon: itemIconSvg(b.id) };
      }),
      { cancellable: true, style: { maxHeight: '60vh', overflowY: 'auto', minWidth: '320px' } },
    );
    if (!id) return;
    const b = BERRY_BY_ID.get(id);
    if (!b || !removeItemSafe(s, id)) return;
    rec.fed++;
    const name = displayName(this.d.dex, p);
    const lines: string[] = [];
    // 树果本身的效果（回复 / 治疗 / 降努力值树果）
    if (canUseOn(this.d.dex, id, p, KEY_ITEM_BY_ID)) {
      const r = applyToPokemon(this.d.dex, id, p, KEY_ITEM_BY_ID, { timeOfDay: this.d.minutes() % 1440 >= 360 && this.d.minutes() % 1440 < 1080 ? 'day' : 'night' });
      if (r.ok) lines.push(...r.messages);
    }
    if (!EV_BERRIES[id]) {
      const fl = mainFlavor(b);
      const gain = flavorEv(p, FLAVOR_STAT[fl]!);
      if (gain > 0) lines.push(`${name}的${STAT[FLAVOR_STAT[fl]!]}努力值提高了 ${gain} 点。`);
      const fr = fl === taste.likes ? 4 : fl === taste.dislikes ? 0 : 2;
      if (addFriendship(p, fr) > 0) lines.push(fl === taste.likes ? `${name}吃得很开心！这是它喜欢的味道♪` : `${name}吃掉了${b.name}。`);
      else if (fl === taste.dislikes) lines.push(`${name}皱了皱眉……好像不太喜欢${FLAVOR_ZH[fl]}味。`);
    }
    sfx('item', 0.5);
    this.d.toast(lines.join('\n') || `${name}吃掉了${b.name}。`, 2600);
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
    this.animateHelpers(dt);
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 2;
    this.settle();
  }

  dispose(): void {
    for (const v of this.helperViews.values()) {
      v.root.removeFromParent();
      disposeMonModel(v.root);
    }
    this.helperViews.clear();
    this.view.dispose();
  }
}

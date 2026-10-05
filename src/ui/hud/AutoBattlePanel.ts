/**
 * 自动战斗界面：
 * - AutoBattleCard：进入野外区域时显示在右侧的常驻小卡片（不拦截输入）——区域名、可出现的宝可梦与努力值、
 *   已勾选目标、运行状态；提示按 K 打开设置
 * - AutoBattleSettings：模态设置面板（鼠标操作）——勾选目标并选择「打倒 / 捕捉」、捕捉用球、使用招式、
 *   HP / PP 阈值（− / + 调整）、低于阈值时自动使用的道具；底部「开始自动 / 停止 / 关闭」
 * 只用按钮 / 复选框，不放文本输入框（避免 Backspace / Q 被当作返回键）。
 */
import type { Input } from '@/core/input';
import { sfx } from '@/core/audio';
import type { Dex } from '@/systems/data/Dex';
import type { AutoBattleConfig, AutoGoal } from '@/systems/autobattle';
import { el, injectUiStyles } from '../core/styles';
import type { UiRoot, UiWidget } from '../core/UiRoot';
import { monIcon } from '../menu/common';

export interface AutoZoneSpecies {
  speciesId: number;
  name: string;
  levels: [number, number];
  /** 努力值文字，如「速度 +1」 */
  ev: string;
  /** 出现条件（白天 / 夜晚 / 雨天 / 稀有…） */
  note: string;
  /** 只在水面 / 钓鱼出现（自动寻路够不到） */
  waterOnly: boolean;
}

export interface AutoOption {
  id: string;
  name: string;
  qty: number;
}

export interface AutoSettingsData {
  zoneName: string;
  levelRange: string;
  species: AutoZoneSpecies[];
  config: AutoBattleConfig;
  running: boolean;
  balls: AutoOption[];
  heal: AutoOption[];
  pp: AutoOption[];
  /** 首发宝可梦的招式 */
  leadName: string;
  /** 队伍第 1 只（代练 / 努力值计划对象）的名字与当前努力值 */
  trainee?: { name: string; evs: Record<string, number> } | undefined;
  moves: { index: number; id: string; name: string; pp: number; maxPp: number; damaging?: boolean }[];
}

export type AutoSettingsResult = { action: 'start' | 'stop' | 'close'; config: AutoBattleConfig };

const CSS = `
.cl-auto-card{position:absolute;right:16px;top:42%;width:250px;padding:10px 12px;font-family:system-ui;font-size:12px;color:#27304a;z-index:3;pointer-events:none;opacity:.94}
.cl-auto-card .t{font:800 14px/1.2 system-ui;display:flex;align-items:center;gap:6px}
.cl-auto-card .t .st{margin-left:auto;font:700 11px/1 system-ui;padding:3px 7px;border-radius:999px;background:#e4e8f2;color:#4a5270}
.cl-auto-card .t .st.on{background:#3fb88a;color:#fff}
.cl-auto-card .sub{color:#6a7190;margin:2px 0 6px}
.cl-auto-card .row{display:grid;grid-template-columns:26px 1fr auto;gap:6px;align-items:center;padding:2px 0}
.cl-auto-card .row .nm{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-auto-card .row .ev{color:#3a7bd5;font-weight:700;white-space:nowrap}
.cl-auto-card .row .tag{font-size:10px;padding:1px 5px;border-radius:5px;margin-left:4px;color:#fff}
.cl-auto-card .row .tag.defeat{background:#e0603a}.cl-auto-card .row .tag.capture{background:#3a7bd5}
.cl-auto-card .why{color:#c0503a;margin-top:4px}
.cl-auto-card .hint{color:#6a7190;margin-top:6px;font-size:11px}
.cl-auto-card kbd,.cl-auto kbd{font:700 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px;background:#e4e8f2}
.cl-auto{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(12,20,36,.55);pointer-events:auto;z-index:40;font-family:system-ui;color:#27304a}
.cl-auto .win{width:min(980px,calc(100% - 32px));max-height:calc(100% - 40px);display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:auto 1fr auto;gap:12px 16px;padding:16px 18px}
.cl-auto .hd{grid-column:1/3;display:flex;align-items:baseline;gap:12px}
.cl-auto .hd .t{font:800 20px/1 system-ui;letter-spacing:.08em}
.cl-auto .hd .sub{color:#6a7190;font-size:13px}
.cl-auto .col{border:2px solid #d7dcea;border-radius:12px;background:#fff;padding:10px;overflow:auto;min-height:0}
.cl-auto .h{font:700 13px/1 system-ui;color:#6a7190;margin:2px 0 8px}
.cl-auto .mon{display:grid;grid-template-columns:22px 40px 1fr auto;gap:8px;align-items:center;padding:5px 6px;border-radius:10px;border:2px solid transparent}
.cl-auto .mon.on{background:#eef6ff;border-color:#9cc3f0}
.cl-auto .mon .nm{font-weight:800;font-size:14px}
.cl-auto .mon .meta{font-size:11px;color:#6a7190}
.cl-auto .mon .ev{color:#3a7bd5;font-weight:700}
.cl-auto .seg{display:inline-flex;border:2px solid #27304a;border-radius:8px;overflow:hidden}
.cl-auto .seg button{border:0;background:#fff;padding:4px 9px;font:700 12px system-ui;cursor:pointer;color:#27304a}
.cl-auto .seg button.on{background:#27304a;color:#fff}
.cl-auto .seg button:disabled{opacity:.35;cursor:default}
.cl-auto input[type=checkbox]{width:18px;height:18px;cursor:pointer;accent-color:#3fb88a}
.cl-auto .grp{margin-bottom:12px}
.cl-auto .chips{display:flex;flex-wrap:wrap;gap:6px}
.cl-auto .chip{border:2px solid #d7dcea;border-radius:9px;background:#fff;padding:4px 9px;font:700 12px system-ui;cursor:pointer;color:#27304a}
.cl-auto .chip.on{border-color:#3fb88a;background:#e7f6ef}
.cl-auto .chip:disabled{opacity:.4;cursor:default}
.cl-auto .num{display:inline-flex;align-items:center;gap:8px}
.cl-auto .num button{width:28px;height:28px;border-radius:8px;border:2px solid #27304a;background:#fff;font:900 14px system-ui;cursor:pointer}
.cl-auto .num b{min-width:52px;text-align:center;font-variant-numeric:tabular-nums}
.cl-auto .ft{grid-column:1/3;display:flex;gap:10px;align-items:center}
.cl-auto .ft .note{color:#6a7190;font-size:12px;margin-right:auto}
.cl-auto .btn{border:3px solid #27304a;border-radius:10px;background:#fff;padding:8px 16px;font:800 14px system-ui;cursor:pointer;box-shadow:0 3px 0 #27304a}
.cl-auto .btn.go{background:#3fb88a;color:#fff}
.cl-auto .btn.stop{background:#e0603a;color:#fff}
.cl-auto .btn:disabled{opacity:.4;cursor:default}
`;

/** 常驻小卡片 */
export class AutoBattleCard {
  private root: HTMLDivElement;

  constructor(
    ui: UiRoot,
    private readonly dex: Dex,
  ) {
    injectUiStyles(CSS);
    this.root = el('div', 'cl-auto-card cl-card', ui.el);
    this.root.style.display = 'none';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  show(d: { zoneName: string; levelRange: string; species: AutoZoneSpecies[]; config: AutoBattleConfig; running: boolean; status: string; why: string | null; evLine?: string | null }): void {
    const r = this.root;
    r.style.display = '';
    r.textContent = '';
    const t = el('div', 't', r, `⚔ ${d.zoneName}`);
    el('span', `st${d.running ? ' on' : ''}`, t, d.running ? '自动中' : '手动');
    el('div', 'sub', r, `${d.levelRange} · ${d.status}`);
    for (const s of d.species.slice(0, 9)) {
      const row = el('div', 'row', r);
      monIcon(this.dex, s.speciesId, row, { size: 24 });
      const nm = el('div', 'nm', row, s.name);
      const goal = d.config.targets[s.speciesId];
      if (goal) el('span', `tag ${goal}`, nm, goal === 'capture' ? '捕捉' : '打倒');
      el('div', 'ev', row, s.ev);
    }
    if (d.species.length > 9) el('div', 'sub', r, `……还有 ${d.species.length - 9} 种`);
    if (d.evLine) el('div', 'sub', r, d.evLine);
    if (d.why) el('div', 'why', r, d.why);
    el('div', 'hint', r).innerHTML = d.running ? '<kbd>K</kbd> 设置 · 移动键 / <kbd>K</kbd> 停止' : '<kbd>K</kbd> 打开自动战斗设置';
  }

  dispose(): void {
    this.root.remove();
  }
}

/** 模态设置面板 */
export class AutoBattleSettings implements UiWidget {
  readonly modal = true;
  private root: HTMLDivElement;
  private cfg: AutoBattleConfig;
  private result: AutoSettingsResult | null = null;
  private resolve!: (r: AutoSettingsResult) => void;
  readonly done = new Promise<AutoSettingsResult>((r) => (this.resolve = r));

  constructor(
    ui: UiRoot,
    private readonly dex: Dex,
    private readonly data: AutoSettingsData,
  ) {
    injectUiStyles(CSS);
    this.cfg = structuredClone(data.config);
    this.root = el('div', 'cl-auto interactive', ui.el);
    this.render();
  }

  private finish(action: AutoSettingsResult['action']): void {
    if (this.result) return;
    this.result = { action, config: this.cfg };
    sfx(action === 'start' ? 'confirm' : 'back', 0.6);
  }

  private render(): void {
    const { data, cfg } = this;
    this.root.textContent = '';
    const win = el('div', 'win cl-card', this.root);
    const hd = el('div', 'hd', win);
    el('div', 't', hd, '自动战斗');
    el('div', 'sub', hd, `${data.zoneName} · ${data.levelRange} · 勾选目标后，角色会自动走向它们并战斗，直到停止或道具用完`);

    // 左：目标
    const left = el('div', 'col', win);
    el('div', 'h', left, '区域内的宝可梦（勾选 = 目标；未勾选的遭遇会自动逃跑）');
    for (const s of data.species) {
      const goal = cfg.targets[s.speciesId];
      const row = el('div', `mon${goal ? ' on' : ''}`, left);
      const cb = el('input', '', row);
      cb.type = 'checkbox';
      cb.checked = !!goal;
      cb.disabled = s.waterOnly;
      cb.addEventListener('change', () => {
        if (cb.checked) cfg.targets[s.speciesId] = 'defeat';
        else delete cfg.targets[s.speciesId];
        sfx('cursor', 0.4);
        this.render();
      });
      monIcon(this.dex, s.speciesId, row, { size: 40 });
      const info = el('div', '', row);
      el('div', 'nm', info, s.name);
      const meta = el('div', 'meta', info);
      meta.innerHTML = `Lv.${s.levels[0]}–${s.levels[1]} · <span class="ev">${s.ev}</span>${s.note ? ` · ${s.note}` : ''}${s.waterOnly ? ' · 水面/钓鱼（无法自动寻路）' : ''}`;
      const seg = el('div', 'seg', row);
      for (const g of ['defeat', 'capture'] as AutoGoal[]) {
        const b = el('button', goal === g ? 'on' : '', seg, g === 'defeat' ? '打倒' : '捕捉');
        b.disabled = !goal;
        b.addEventListener('click', () => {
          cfg.targets[s.speciesId] = g;
          sfx('cursor', 0.4);
          this.render();
        });
      }
    }
    if (!data.species.length) el('div', 'meta', left, '这个区域没有野生宝可梦。');

    // 右：策略
    const right = el('div', 'col', win);
    const g1 = el('div', 'grp', right);
    el('div', 'h', g1, `可使用的招式（${data.leadName}）`);
    const mv = el('div', 'chips', g1);
    for (const m of data.moves) {
      const off = m.damaging === false || cfg.disabledMoves.includes(m.id);
      const b = el('button', `chip${off ? '' : ' on'}`, mv, `${off ? '☐' : '☑'} ${m.name} ${m.pp}/${m.maxPp}${m.damaging === false ? '（变化招式）' : ''}`);
      b.disabled = m.damaging === false;
      b.addEventListener('click', () =>
        this.set(() => {
          const i = cfg.disabledMoves.indexOf(m.id);
          if (i >= 0) cfg.disabledMoves.splice(i, 1);
          else cfg.disabledMoves.push(m.id);
        }),
      );
    }
    el('div', 'meta', g1, '每回合在勾选的攻击招式里自动挑效果最好的；打不到对手的招式（属性免疫）自动跳过。').style.cssText = 'font-size:11px;color:#6a7190;margin-top:4px';
    el('div', 'meta', g1, '捕捉时会自动换用不会打倒对方的招式，对方进入红血后扔球。').style.cssText = 'font-size:11px;color:#6a7190;margin-top:4px';

    const g2 = el('div', 'grp', right);
    el('div', 'h', g2, '捕捉用的球');
    const bc = el('div', 'chips', g2);
    for (const b of data.balls) {
      const c = el('button', `chip${cfg.ball === b.id ? ' on' : ''}`, bc, `${b.name} ×${b.qty}`);
      c.disabled = b.qty <= 0;
      c.addEventListener('click', () => this.set(() => (cfg.ball = b.id)));
    }

    const g3 = el('div', 'grp', right);
    el('div', 'h', g3, 'HP 低于');
    this.stepper(g3, `${Math.round(cfg.hpPct * 100)}%`, (d) => (cfg.hpPct = Math.min(0.9, Math.max(0, Math.round((cfg.hpPct + d * 0.05) * 100) / 100))));
    const hc = el('div', 'chips', g3);
    hc.style.marginTop = '6px';
    for (const it of data.heal) this.itemChip(hc, it, cfg.healItems);

    const g4 = el('div', 'grp', right);
    el('div', 'h', g4, '勾选招式 PP 都低于等于');
    this.stepper(g4, `${cfg.ppMin}`, (d) => (cfg.ppMin = Math.min(10, Math.max(0, cfg.ppMin + d))));
    const pc = el('div', 'chips', g4);
    pc.style.marginTop = '6px';
    for (const it of data.pp) this.itemChip(pc, it, cfg.ppItems);

    const g5 = el('div', 'grp', right);
    const ch = el('button', `chip${cfg.centerHeal ? ' on' : ''}`, g5, `${cfg.centerHeal ? '☑' : '☐'} 道具 / PP 用完时飞回宝可梦中心治疗，再回来继续`);
    ch.addEventListener('click', () => this.set(() => (cfg.centerHeal = !cfg.centerHeal)));
    el('div', 'meta', g5, '需要能骑宝可梦飞行（翠澜徽章）；不勾选则直接停止。').style.cssText = 'font-size:11px;color:#6a7190;margin-top:4px';
    const tr = el('button', `chip${cfg.train ? ' on' : ''}`, g5, `${cfg.train ? '☑' : '☐'} 代练：首发低等级宝可梦露面后，换队伍里等级最高的同伴打倒目标`);
    tr.style.marginTop = '8px';
    tr.addEventListener('click', () => this.set(() => (cfg.train = !cfg.train)));
    el('div', 'meta', g5, '只对「打倒」目标生效；经验由首发与打手平分。首发须放在队伍第 1 位。').style.cssText = 'font-size:11px;color:#6a7190;margin-top:4px';

    // 努力值计划
    const g6 = el('div', 'grp', right);
    const plan = cfg.evPlan;
    const t6 = el('button', `chip${plan.on ? ' on' : ''}`, g6, `${plan.on ? '☑' : '☐'} 努力值计划${data.trainee ? `（${data.trainee.name}）` : ''}`);
    t6.addEventListener('click', () => this.set(() => (plan.on = !plan.on)));
    if (plan.on) {
      const ZH: Record<string, string> = { hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
      const grid = el('div', '', g6);
      grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;margin-top:6px';
      for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const) {
        const cur = data.trainee?.evs[k] ?? 0;
        el('div', 'meta', grid, `${ZH[k]} ${cur}`).style.cssText = 'font-size:12px;min-width:64px';
        const row = el('div', '', grid);
        row.style.cssText = 'display:flex;gap:4px;align-items:center';
        this.stepper(row, `→ ${plan.target[k]}`, (dd) => (plan.target[k] = Math.max(0, Math.min(252, plan.target[k] + dd * 4))));
        for (const [lab, v] of [['0', 0], ['满', 252]] as const) {
          const b = el('button', 'chip', row, lab);
          b.addEventListener('click', () => this.set(() => (plan.target[k] = v)));
        }
      }
      const sum = Object.values(plan.target).reduce((a, b) => a + b, 0);
      el('div', 'meta', g6, `目标合计 ${sum}/510${sum > 510 ? '（超过上限，超出部分无法获得）' : ''}`).style.cssText = `font-size:11px;margin-top:4px;color:${sum > 510 ? '#c0504d' : '#6a7190'}`;
      const pc2 = el('button', `chip${plan.protectCarrier ? ' on' : ''}`, g6, `${plan.protectCarrier ? '☑' : '☐'} 代练时打手不获得努力值`);
      pc2.style.marginTop = '6px';
      pc2.addEventListener('click', () => this.set(() => (plan.protectCarrier = !plan.protectCarrier)));
      el('div', 'meta', g6, '只打能提供未达标项的「打倒」目标（其余遭遇自动逃跑）；超出目标的努力值不计入；全部达标后自动停止。').style.cssText = 'font-size:11px;color:#6a7190;margin-top:4px';
    }

    // 底部
    const ft = el('div', 'ft', win);
    const n = Object.keys(cfg.targets).length;
    el('div', 'note', ft).innerHTML = `已选 ${n} 个目标 · 战斗中按 <kbd>Esc</kbd> 接管 · 大地图上按移动键停止`;
    if (data.running) {
      const st = el('button', 'btn stop', ft, '停止自动');
      st.addEventListener('click', () => this.finish('stop'));
    }
    const go = el('button', 'btn go', ft, data.running ? '应用设置' : '开始自动');
    go.disabled = n === 0;
    go.addEventListener('click', () => this.finish('start'));
    const cl = el('button', 'btn', ft, '关闭');
    cl.addEventListener('click', () => this.finish('close'));
  }

  private set(fn: () => void): void {
    fn();
    sfx('cursor', 0.4);
    this.render();
  }

  private stepper(parent: HTMLElement, value: string, step: (d: number) => void): void {
    const n = el('div', 'num', parent);
    const minus = el('button', '', n, '−');
    el('b', '', n, value);
    const plus = el('button', '', n, '+');
    minus.addEventListener('click', () => this.set(() => step(-1)));
    plus.addEventListener('click', () => this.set(() => step(1)));
  }

  private itemChip(parent: HTMLElement, it: AutoOption, list: string[]): void {
    const on = list.includes(it.id);
    const c = el('button', `chip${on ? ' on' : ''}`, parent, `${on ? '☑' : '☐'} ${it.name} ×${it.qty}`);
    c.addEventListener('click', () =>
      this.set(() => {
        const i = list.indexOf(it.id);
        if (i >= 0) list.splice(i, 1);
        else list.push(it.id);
      }),
    );
  }

  update(_dt: number, input: Input): boolean {
    if (!this.result && (input.pressed('back') || input.pressed('menu'))) this.finish('close');
    if (this.result) {
      this.resolve(this.result);
      return true;
    }
    return false;
  }

  dispose(): void {
    this.root.remove();
  }
}

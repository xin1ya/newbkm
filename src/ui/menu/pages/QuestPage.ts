/**
 * M1-16 · 任务日志（07-22 §3.4 布局与显示规则 + 设计 §7.3 追踪 / 在地图上查看）。
 * - 分页：主线 / 支线（隐藏任务归入支线，未解锁的隐藏任务不列出）。
 * - 列表：追踪中 → 进行中 → 可接取 → 已完成 → 未解锁；类别色标 + 状态标签，追踪中的任务带 ◆。
 * - 显示规则：locked 标题「???」且不显示详情；available 标注「可接取」及接取人；
 *   active 已完成目标 ✓、当前目标 ○（计数目标显示 x/y），后续目标淡显；completed 灰显、全部 ✓。
 * - 确定：追踪 / 取消追踪 / 恢复自动追踪 / 在地图上查看（大地图接入前置灰）。
 */
import type { Input } from '@/core/input';
import { questLogEntry, questStatus, type Quest, type QuestStatus } from '@/systems/quests';
import { objectiveProgress, rewardLines } from '@/systems/quests/runtime';
import { choose } from '../../core';
import { el, injectUiStyles } from '../../core/styles';
import { keepVisible, stepIndex } from '../common';
import type { MenuPage, PageContext } from '../types';

const CAT_COLOR: Record<Quest['category'], string> = { main: '#ffb627', side: '#4fb3ff', hidden: '#b48cff' };
const CAT_NAME: Record<Quest['category'], string> = { main: '主线', side: '支线', hidden: '隐藏' };
const STATUS_NAME: Record<QuestStatus, string> = { active: '进行中', available: '可接取', completed: '已完成', locked: '未解锁' };
const STATUS_ORDER: Record<QuestStatus, number> = { active: 0, available: 1, completed: 2, locked: 3 };
const TABS = [
  { id: 'main', name: '主线' },
  { id: 'side', name: '支线' },
] as const;

const CSS = `
.cl-quests { grid-template-columns: 330px 1fr; }
.cl-quests .col { display: flex; flex-direction: column; min-height: 0; border-right: 2px dashed #d5dae6; }
.cl-quests .qtabs { display: flex; gap: 4px; padding: 8px 12px 0; border-bottom: 2px solid #d5dae6; }
.cl-quests .qtabs span { padding: 6px 14px; border-radius: 10px 10px 0 0; font-size: 14px; font-weight: 700; cursor: pointer; color: #6a7190; }
.cl-quests .qtabs span.on { background: #27304a; color: #fff; }
.cl-quests .qtabs small { font-weight: 600; opacity: .75; margin-left: 4px; }
.cl-quests .rows { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.cl-quests .q { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 8px; border-radius: 10px; cursor: pointer; font-size: 15px; font-weight: 700; }
.cl-quests .q .bar { width: 5px; align-self: stretch; border-radius: 3px; background: var(--cat); }
.cl-quests .q .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-quests .q .st { font-size: 11px; padding: 1px 7px; border-radius: 8px; background: #eef1f6; color: #4a5270; }
.cl-quests .q.active .st { background: #fff1cf; color: #9a6400; }
.cl-quests .q.available .st { background: #dff0ff; color: #1f6aa8; }
.cl-quests .q.completed { color: #9aa0b3; }
.cl-quests .q.locked { color: #9aa0b3; }
.cl-quests .q.locked .bar { background: #c9cedb; }
.cl-quests .q .trk { color: #e89b00; font-size: 13px; }
.cl-quests .q.sel { background: #fff7e0; outline: 2px solid #ffb627; }
.cl-quests .none { padding: 30px 10px; text-align: center; color: #9aa0b3; font-size: 14px; }
.cl-quests .qd { padding: 16px 22px; overflow-y: auto; }
.cl-quests .qd .hd { display: flex; align-items: center; gap: 10px; }
.cl-quests .qd .tag { font-size: 12px; font-weight: 800; padding: 2px 9px; border-radius: 8px; color: #fff; background: var(--cat); }
.cl-quests .qd .isl { font-size: 12px; color: #6a7190; }
.cl-quests .qd .st2 { margin-left: auto; font-size: 12px; font-weight: 800; color: #4a5270; }
.cl-quests .qd h3 { margin: 8px 0 6px; font-size: 22px; }
.cl-quests .qd .sum { font-size: 14px; line-height: 1.7; color: #3a4262; background: #f6f7fb; border-radius: 10px; padding: 10px 12px; }
.cl-quests .qd .sec { margin: 16px 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .15em; color: #6a7190; }
.cl-quests .qd .ob { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; font-size: 15px; }
.cl-quests .qd .ob .m { width: 18px; text-align: center; font-weight: 900; }
.cl-quests .qd .ob.done { color: #8a91a8; }
.cl-quests .qd .ob.done .m { color: #3fb88a; }
.cl-quests .qd .ob.done .tx { text-decoration: line-through; text-decoration-color: rgba(138,145,168,.6); }
.cl-quests .qd .ob.current { font-weight: 800; }
.cl-quests .qd .ob.current .m { color: #e89b00; }
.cl-quests .qd .ob.future { color: #b3b8c8; }
.cl-quests .qd .ob .pg { margin-left: auto; font-size: 13px; color: #9a6400; font-variant-numeric: tabular-nums; }
.cl-quests .qd .rw { display: flex; flex-wrap: wrap; gap: 6px; }
.cl-quests .qd .rw span { padding: 4px 10px; border-radius: 9px; background: #fff7e0; border: 1px solid #f3d58a; font-size: 13px; font-weight: 700; color: #7a5200; }
.cl-quests .qd.completed .rw span { background: #f1f2f6; border-color: #dde0e8; color: #8a91a8; }
.cl-quests .qd .who { margin-top: 10px; font-size: 13px; color: #1f6aa8; font-weight: 700; }
.cl-quests .qd .trkinfo { margin-top: 14px; padding: 8px 12px; border-radius: 10px; font-size: 13px; font-weight: 700; background: #fff1cf; color: #9a6400; }
.cl-quests .qd .trkinfo.auto { background: #eef1f6; color: #4a5270; }
.cl-quests .qd .locked { margin-top: 30px; text-align: center; color: #9aa0b3; font-size: 14px; }
`;

export class QuestPage implements MenuPage {
  readonly id = 'quests';
  readonly title = '任务';
  readonly el: HTMLDivElement;
  private tabsEl: HTMLDivElement;
  private rows: HTMLDivElement;
  private detail: HTMLDivElement;
  tab = 0;
  sel = 0;
  private focused = false;

  constructor(private readonly ctx: PageContext) {
    injectUiStyles(CSS);
    this.el = el('div', 'cl-page cl-quests');
    const col = el('div', 'col', this.el);
    this.tabsEl = el('div', 'qtabs', col);
    this.rows = el('div', 'rows', col);
    this.detail = el('div', 'qd', this.el);
  }

  private get flags() {
    return this.ctx.host.state.flags;
  }

  /** 当前分页的任务（已排序） */
  list(tab = this.tab): { quest: Quest; status: QuestStatus }[] {
    const qh = this.ctx.host.quests;
    const tracked = qh.tracked()?.id;
    const want = TABS[tab]!.id;
    return qh.registry.all
      .filter((q) => (want === 'main' ? q.category === 'main' : q.category !== 'main'))
      .map((quest) => ({ quest, status: questStatus(quest, this.flags) }))
      .filter((e) => !(e.quest.category === 'hidden' && e.status === 'locked'))
      .map((e, i) => ({ ...e, i }))
      .sort((a, b) => Number(b.quest.id === tracked) - Number(a.quest.id === tracked) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.i - b.i)
      .map(({ quest, status }) => ({ quest, status }));
  }

  show(): void {
    // 打开时默认选中追踪中的任务所在分页
    const t = this.ctx.host.quests.tracked();
    if (t && !this.focused) {
      this.tab = t.category === 'main' ? 0 : 1;
      this.sel = 0;
    }
    this.render();
  }

  focus(): void {
    this.focused = true;
    this.render();
  }

  blur(): void {
    this.focused = false;
    this.render();
  }

  hints(): string {
    const k = this.ctx.keyLabel;
    return `<kbd>←→</kbd>主线 / 支线\u3000<kbd>↑↓</kbd>选择\u3000<kbd>${k('confirm')}</kbd>追踪\u3000<kbd>${k('back')}</kbd>返回`;
  }

  handle(input: Input): 'exit' | void {
    const n = this.list().length;
    if (input.pressed('uiLeft', true)) this.setTab(stepIndex(this.tab, -1, TABS.length));
    else if (input.pressed('uiRight', true)) this.setTab(stepIndex(this.tab, 1, TABS.length));
    else if (input.pressed('uiUp', true)) this.select(stepIndex(this.sel, -1, n));
    else if (input.pressed('uiDown', true)) this.select(stepIndex(this.sel, 1, n));
    else if (input.pressed('confirm', true)) this.activate();
    else if (input.pressed('back', true)) return 'exit';
  }

  setTab(t: number): void {
    this.tab = t;
    this.sel = 0;
    this.render();
  }

  select(i: number): void {
    this.sel = i;
    this.render();
  }

  activate(): void {
    const e = this.list()[this.sel];
    if (!e || e.status === 'locked') return;
    const qh = this.ctx.host.quests;
    const tracked = qh.tracked();
    const isTracked = tracked?.id === e.quest.id;
    const items: { label: string; value: string; disabled?: boolean; sub?: string }[] = [];
    if (e.status === 'active') {
      if (!isTracked || !qh.manual()) items.push({ label: isTracked ? '固定追踪这个任务' : '追踪这个任务', value: 'track' });
      if (isTracked) items.push({ label: '取消追踪', value: 'untrack' });
    }
    if (qh.manual() || !tracked) items.push({ label: '恢复自动追踪', value: 'auto', sub: '优先追踪主线' });
    items.push({ label: '在地图上查看', value: 'map', disabled: !qh.showOnMap || e.status === 'completed', ...(qh.showOnMap ? {} : { sub: '大地图开放后可用' }) });
    items.push({ label: '取消', value: 'cancel' });
    this.ctx.run(async () => {
      const act = await choose(this.ctx.ui, items, { cancellable: true, style: { right: '60px', bottom: '120px' } });
      if (act === 'track') qh.track(e.quest.id);
      else if (act === 'untrack') qh.untrack();
      else if (act === 'auto') qh.auto();
      else if (act === 'map') qh.showOnMap?.(e.quest.id);
      // 追踪变化会改变排序：保持选中同一个任务
      const idx = this.list().findIndex((x) => x.quest.id === e.quest.id);
      if (idx >= 0) this.sel = idx;
    });
  }

  render(): void {
    const qh = this.ctx.host.quests;
    this.el.classList.toggle('blurred', !this.focused);
    this.tabsEl.textContent = '';
    TABS.forEach((t, i) => {
      const all = this.list(i);
      const done = all.filter((e) => e.status === 'completed').length;
      const s = el('span', i === this.tab ? 'on interactive' : 'interactive', this.tabsEl, t.name);
      el('small', '', s, `${done}/${all.length}`);
      s.dataset.qtab = t.id;
      s.addEventListener('click', () => this.setTab(i));
    });
    const list = this.list();
    this.sel = Math.min(this.sel, Math.max(0, list.length - 1));
    const tracked = qh.tracked()?.id;
    this.rows.textContent = '';
    if (!list.length) el('div', 'none', this.rows, '还没有任务。');
    list.forEach((e, i) => {
      const row = el('div', `q interactive ${e.status}${i === this.sel ? ' sel' : ''}`, this.rows);
      row.dataset.quest = e.quest.id;
      row.style.setProperty('--cat', CAT_COLOR[e.quest.category]);
      el('span', 'bar', row);
      el('span', 'nm', row, e.status === 'locked' ? '???' : e.quest.title);
      if (e.quest.id === tracked) el('span', 'trk', row, '◆');
      el('span', 'st', row, STATUS_NAME[e.status]);
      row.addEventListener('click', () => {
        if (i === this.sel) this.activate();
        else this.select(i);
      });
    });
    keepVisible(this.rows.children[this.sel] as HTMLElement | undefined);
    this.renderDetail(list[this.sel]);
  }

  private renderDetail(e: { quest: Quest; status: QuestStatus } | undefined): void {
    const d = this.detail;
    d.textContent = '';
    d.className = 'qd';
    if (!e) return;
    const { quest: q, status } = e;
    const qh = this.ctx.host.quests;
    const entry = questLogEntry(q, this.flags);
    d.classList.add(status);
    d.style.setProperty('--cat', CAT_COLOR[q.category]);
    const hd = el('div', 'hd', d);
    el('span', 'tag', hd, CAT_NAME[q.category]);
    el('span', 'isl', hd, q.island);
    el('span', 'st2', hd, STATUS_NAME[status]);
    el('h3', '', d, entry.title);
    if (!entry.showDetails) {
      el('div', 'locked', d, '完成更多任务后解锁。');
      return;
    }
    el('div', 'sum', d, q.summary);
    if (status === 'available' && q.startNpc) {
      const who = qh.npcName(q.startNpc);
      if (who) el('div', 'who', d, `▶ 找${who}接取这个任务`);
    }
    el('div', 'sec', d, '目标');
    entry.objectives.forEach((o, i) => {
      const obj = q.objectives[i]!;
      const future = !o.done && !o.current;
      const row = el('div', `ob ${o.done ? 'done' : o.current ? 'current' : 'future'}`, d);
      el('span', 'm', row, o.done ? '✓' : o.current ? '○' : '·');
      el('span', 'tx', row, status === 'available' && i > 0 ? '……' : o.text);
      const p = objectiveProgress(obj, this.ctx.host.state.vars);
      if (p && !future) el('span', 'pg', row, `${o.done ? p.target : p.current}/${p.target}`);
    });
    const rewards = rewardLines(q);
    if (rewards.length) {
      el('div', 'sec', d, status === 'completed' ? '已获得奖励' : '奖励');
      const rw = el('div', 'rw', d);
      for (const l of rewards) el('span', '', rw, qh.rewardText(l).replace(/^(获得|习得) /, ''));
    }
    if (status === 'active') {
      const isTracked = qh.tracked()?.id === q.id;
      if (isTracked) el('div', qh.manual() ? 'trkinfo' : 'trkinfo auto', d, qh.manual() ? '◆ 追踪中：罗盘与世界标记指向当前目标' : '◆ 自动追踪中（按确定键固定追踪）');
    }
  }
}

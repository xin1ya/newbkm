/**
 * M1-18 · 存档：显示当前进度摘要，确认后写入存档位。
 */
import { BREEDER_MAX_LEVEL, BREEDER_TITLE, breederBadges, breederLevel } from '@/systems/breeder';
import type { Input } from '@/core/input';
import { dexCounts } from '@/systems/pokedex';
import { choose, say } from '../../core';
import { el } from '../../core/styles';
import { formatPlayTime, monIcon } from '../common';
import type { MenuPage, PageContext } from '../types';

export class SavePage implements MenuPage {
  readonly id = 'save';
  readonly title = '存档';
  readonly el: HTMLDivElement;
  private card: HTMLDivElement;
  private btn: HTMLDivElement;
  private focused = false;

  constructor(private readonly ctx: PageContext) {
    this.el = el('div', 'cl-page cl-save');
    this.card = el('div', 'card', this.el);
    this.btn = el('div', 'btn interactive', this.el, '写入存档');
    this.btn.addEventListener('click', () => this.activate());
  }

  show(): void {
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
    return `<kbd>${k('confirm')}</kbd>存档\u3000<kbd>${k('back')}</kbd>返回`;
  }

  handle(input: Input): 'exit' | void {
    if (input.pressed('confirm', true)) this.activate();
    else if (input.pressed('back', true)) return 'exit';
  }

  activate(): void {
    const { host, ui } = this.ctx;
    this.ctx.run(async () => {
      const act = await choose<'save' | 'title' | 'cancel'>(ui, [
        { label: '存档', value: 'save' },
        { label: '存档并返回标题画面', value: 'title' },
        { label: '取消', value: 'cancel' },
      ], { cancellable: true, style: { left: '220px', right: 'auto', bottom: '120px' } });
      if (!act || act === 'cancel') return;
      const saved = await host.save();
      if (act === 'title' && saved) {
        // 去掉开发参数（quick / new / slot / notitle）后重新载入 → 标题画面
        const q = new URLSearchParams(location.search);
        for (const k of ['quick', 'new', 'slot', 'notitle']) q.delete(k);
        const qs = q.toString();
        location.href = `${location.pathname}${qs ? `?${qs}` : ''}`;
        return;
      }
      await say(ui, saved ? `${host.state.player.name}把冒险记录写进了存档。` : '存档失败了……请稍后再试。');
    });
  }

  render(): void {
    const { host } = this.ctx;
    const s = host.state;
    this.btn.classList.toggle('sel', this.focused);
    const c = this.card;
    c.textContent = '';
    const row = (k: string, v: string | HTMLElement) => {
      el('div', 'k', c, k);
      const d = el('div', '', c);
      if (typeof v === 'string') d.textContent = v;
      else d.append(v);
    };
    const counts = dexCounts(s, host.regionalDex.species);
    row('训练家', s.player.name);
    if (host.saveSlot) row('存档位', `存档 ${host.saveSlot().replace(/\D/g, '') || '1'}${s.settings.autoSave ? '\u3000（自动存档：开）' : ''}`);
    row('所在地', host.location());
    row('游戏时间', `${formatPlayTime(s.playTime)}\u3000（游戏内 ${host.clock()}）`);
    row('徽章', `${host.badges()} 枚`);
    // 计划文档 §9.4：培育家等级与培育章（与道馆徽章分开显示）
    const blv = breederLevel(s);
    if (blv > 0) row('培育家', `${blv >= BREEDER_MAX_LEVEL ? BREEDER_TITLE : `${blv} 级`}\u3000培育章 ${breederBadges(blv)} 枚`);
    row('图鉴', `捕获 ${counts.caught} / 见过 ${counts.seen}`);
    row('金钱', `¥${s.money.toLocaleString()}`);
    const team = document.createElement('div');
    team.className = 'team';
    for (const p of s.party) monIcon(host.dex, p.speciesId, team, { size: 34, shiny: p.shiny });
    row('队伍', s.party.length ? team : '—');
    row('上次存档', s.savedAt ? new Date(s.savedAt).toLocaleString('zh-CN', { hour12: false }) : '尚未存档');
  }
}

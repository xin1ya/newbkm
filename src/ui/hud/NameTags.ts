/**
 * M1-06 · 头顶名字标签（设计 §8.5：世界空间标签，15 m 内显示、随距离淡出）。
 * DOM 叠加层：每帧把锚点投影到屏幕。样式沿用 07-22 §4.6：白字 + 半透明黑底圆角。
 */
import * as THREE from 'three';
import { el } from '../core/styles';
import type { UiRoot } from '../core/UiRoot';

export interface NameTagItem {
  key: string;
  name: string;
  title?: string | undefined;
  /** 世界坐标锚点（头顶） */
  anchor: THREE.Vector3;
  /** 与玩家的距离（米） */
  distance: number;
  /** 任务标记：'!' 可接任务、'?' 可推进任务（远处也显示） */
  mark?: '!' | '?' | null | undefined;
}

const CSS = `
.cl-nametags { position: absolute; inset: 0; overflow: hidden; }
.cl-nametag { position: absolute; left: 0; top: 0; transform-origin: 50% 100%; white-space: nowrap; text-align: center;
  padding: 2px 8px 3px; border-radius: 8px; background: rgba(12, 16, 28, 0.58); color: #fff; font-size: 12px; line-height: 1.25;
  text-shadow: 0 1px 1px rgba(0,0,0,0.5); will-change: transform, opacity; }
.cl-nametag .t { display: block; font-size: 10px; opacity: 0.78; }
.cl-nametag.mark-only { background: none; padding: 0; text-shadow: none; }
.cl-nametag .n { display: block; }
.cl-nametag.mark-only .n { display: none; }
.cl-qmark { display: block; margin: 0 auto 2px; width: 26px; height: 30px; font: 900 24px/30px system-ui, sans-serif; color: #ffd84a;
  text-shadow: 0 0 6px rgba(255, 190, 40, 0.9), 0 2px 0 #8a5a00, 0 0 1px #000; animation: cl-qbob 1.6s ease-in-out infinite; }
.cl-qmark.q { color: #ffe680; }
@keyframes cl-qbob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
`;

export class NameTags {
  private layer: HTMLDivElement;
  private tags = new Map<string, HTMLDivElement>();
  private v = new THREE.Vector3();
  visible = true;
  /** 名字是否显示（关闭时仍显示任务标记） */
  namesVisible = true;
  /** 任务标记的显示距离（米） */
  markDist = 48;

  constructor(
    root: UiRoot,
    private readonly showDist = 15,
    private readonly fullDist = 10,
  ) {
    if (!document.getElementById('cl-nametag-styles')) {
      const s = document.createElement('style');
      s.id = 'cl-nametag-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    this.layer = el('div', 'cl-nametags', root.el);
  }

  /** 每帧调用：items 为当前候选（通常是场景里全部 NPC） */
  update(items: readonly NameTagItem[], camera: THREE.Camera, width: number, height: number): void {
    const seen = new Set<string>();
    if (this.visible) {
      for (const it of items) {
        const nameOn = this.namesVisible && it.distance <= this.showDist;
        const markOn = !!it.mark && it.distance <= this.markDist;
        if (!nameOn && !markOn) continue;
        this.v.copy(it.anchor).project(camera);
        if (this.v.z < -1 || this.v.z > 1 || Math.abs(this.v.x) > 1.2 || Math.abs(this.v.y) > 1.2) continue;
        seen.add(it.key);
        let tag = this.tags.get(it.key);
        if (!tag) {
          tag = el('div', 'cl-nametag', this.layer);
          el('span', 'cl-qmark', tag);
          const n = el('span', 'n', tag, it.name);
          if (it.title) el('span', 't', n, it.title);
          tag.dataset.key = it.key;
          this.tags.set(it.key, tag);
        }
        const qm = tag.firstElementChild as HTMLElement;
        const mark = markOn ? it.mark! : '';
        if (tag.dataset.mark !== mark) {
          tag.dataset.mark = mark;
          qm.textContent = mark;
          qm.style.display = mark ? 'block' : 'none';
          qm.classList.toggle('q', mark === '?');
        }
        tag.classList.toggle('mark-only', !nameOn);
        const x = (this.v.x * 0.5 + 0.5) * width;
        const y = (-this.v.y * 0.5 + 0.5) * height;
        const fade = nameOn ? THREE.MathUtils.clamp((this.showDist - it.distance) / (this.showDist - this.fullDist), 0, 1) : THREE.MathUtils.clamp((this.markDist - it.distance) / 8, 0, 1);
        const scale = THREE.MathUtils.clamp(1.1 - it.distance * 0.02, 0.8, 1.05);
        tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
        tag.style.opacity = fade.toFixed(3);
        tag.style.zIndex = String(1000 - Math.round(it.distance * 10));
      }
    }
    for (const [k, tag] of this.tags) {
      if (seen.has(k)) continue;
      tag.remove();
      this.tags.delete(k);
    }
  }

  /** 当前显示中的标签（e2e） */
  shown(): string[] {
    return [...this.tags.values()].filter((t) => Number(t.style.opacity) > 0.05).map((t) => t.dataset.key ?? '');
  }

  clear(): void {
    for (const t of this.tags.values()) t.remove();
    this.tags.clear();
  }

  dispose(): void {
    this.clear();
    this.layer.remove();
  }
}

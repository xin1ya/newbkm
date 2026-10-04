/**
 * M1-07 · 互动提示气泡（07-22 §4.6：小圆角气泡 + 按键文字，淡入淡出；3D 中锚定在目标上方）。
 * - 普通：键帽 + 文字（如 [E] 对话、[F] 钓鱼）；键帽随当前输入设备切换键盘 / 手柄按钮名。
 * - 封锁点：锁形图标 + 所需能力 + 一行说明，没有按键。
 */
import * as THREE from 'three';
import { el } from '../core/styles';
import type { UiRoot } from '../core/UiRoot';

export interface PromptView {
  id: string;
  label: string;
  /** 键帽文字（null = 无按键） */
  key: string | null;
  /** 键帽是手柄按钮（圆形绿色） */
  pad?: boolean;
  /** 第二种互动（并列显示） */
  secondary?: { label: string; pad: boolean; text: string } | undefined;
  kind: string;
  ability?: string | undefined;
  hint?: string | undefined;
  anchor: THREE.Vector3;
}

const CSS = `
.cl-prompt { position: absolute; left: 0; top: 0; pointer-events: none; opacity: 0; transition: opacity 160ms ease-out; will-change: transform, opacity; }
.cl-prompt.show { opacity: 1; }
.cl-prompt .bubble { position: relative; display: flex; align-items: center; gap: 6px; white-space: nowrap; background: #fffdf6; color: #1d2340;
  border: 2px solid #27304a; border-radius: 12px; padding: 3px 10px 3px 4px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 0 rgba(39,48,74,0.35);
  animation: cl-prompt-bob 1.6s ease-in-out infinite; }
.cl-prompt .bubble::after { content: ''; position: absolute; left: 50%; bottom: -7px; width: 10px; height: 10px; background: #fffdf6;
  border-right: 2px solid #27304a; border-bottom: 2px solid #27304a; transform: translateX(-50%) rotate(45deg); }
.cl-prompt .key { min-width: 22px; height: 22px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;
  background: #27304a; color: #fff; font-size: 12px; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.35); }
.cl-prompt .key.pad { border-radius: 50%; background: #3fb88a; }
.cl-prompt.blocked .bubble { background: #fff3e0; padding-left: 6px; flex-direction: column; align-items: flex-start; gap: 1px; }
.cl-prompt.blocked .bubble::after { background: #fff3e0; }
.cl-prompt.blocked .head { display: flex; align-items: center; gap: 5px; }
.cl-prompt.blocked .hint { font-size: 11px; font-weight: 400; opacity: 0.8; max-width: 240px; white-space: normal; }
.cl-prompt .sep { width: 1px; height: 16px; background: rgba(39,48,74,0.25); margin: 0 3px; }
.cl-prompt svg { width: 16px; height: 16px; }
@keyframes cl-prompt-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
`;

const LOCK_SVG =
  '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="2" fill="#e8923a" stroke="#27304a" stroke-width="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#27304a" stroke-width="1.5"/></svg>';

export class InteractPrompt {
  private root: HTMLDivElement;
  private bubble: HTMLDivElement;
  private current: string | null = null;
  private v = new THREE.Vector3();

  constructor(ui: UiRoot) {
    if (!document.getElementById('cl-prompt-styles')) {
      const s = document.createElement('style');
      s.id = 'cl-prompt-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    this.root = el('div', 'cl-prompt', ui.el);
    this.bubble = el('div', 'bubble', this.root);
  }

  /** 当前显示的提示（e2e / 调试） */
  get shown(): { id: string; text: string } | null {
    return this.current && this.root.classList.contains('show') ? { id: this.current, text: this.bubble.textContent ?? '' } : null;
  }

  update(view: PromptView | null, camera: THREE.Camera, width: number, height: number): void {
    if (!view) {
      this.root.classList.remove('show');
      this.current = null;
      return;
    }
    this.v.copy(view.anchor).project(camera);
    if (this.v.z < -1 || this.v.z > 1) {
      this.root.classList.remove('show');
      return;
    }
    const sig = `${view.id}|${view.label}|${view.key}|${view.pad ? 1 : 0}|${view.secondary?.label ?? ''}${view.secondary?.text ?? ''}|${view.hint ?? ''}`;
    if (sig !== this.root.dataset.sig) {
      this.root.dataset.sig = sig;
      this.render(view);
    }
    this.current = view.id;
    const x = THREE.MathUtils.clamp((this.v.x * 0.5 + 0.5) * width, 60, width - 60);
    const y = THREE.MathUtils.clamp((-this.v.y * 0.5 + 0.5) * height, 40, height - 20);
    this.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, calc(-100% - 10px))`;
    this.root.classList.add('show');
  }

  private render(view: PromptView): void {
    this.bubble.textContent = '';
    this.root.classList.toggle('blocked', view.kind === 'blocked');
    this.root.dataset.kind = view.kind;
    if (view.kind === 'blocked') {
      const head = el('div', 'head', this.bubble);
      head.innerHTML = LOCK_SVG;
      el('span', '', head, view.ability ? `需要「${view.ability}」` : view.label);
      if (view.hint) el('div', 'hint', this.bubble, view.hint);
      return;
    }
    if (view.key) {
      const k = el('span', 'key', this.bubble, view.key);
      if (view.pad) k.classList.add('pad');
    }
    el('span', 'label', this.bubble, view.label);
    if (view.secondary) {
      el('span', 'sep', this.bubble);
      const k2 = el('span', 'key', this.bubble, view.secondary.label);
      if (view.secondary.pad) k2.classList.add('pad');
      el('span', 'label', this.bubble, view.secondary.text);
    }
  }

  hide(): void {
    this.root.classList.remove('show');
    this.current = null;
  }

  dispose(): void {
    this.root.remove();
  }
}

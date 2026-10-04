/**
 * 头顶表情气泡（! ? ♪ ♥ … z 💧）：弹出缩放 → 停留 → 淡出。跟随宝可梦、训练家发现玩家、可见遭遇共用。
 */
import type * as THREE from 'three';
import { makeLabelSprite } from '@/core/assets';

const COLORS: Record<string, string> = {
  '!': 'rgba(222,62,52,0.95)',
  '?': 'rgba(58,118,220,0.95)',
  '♪': 'rgba(60,170,90,0.95)',
  '♥': 'rgba(232,90,140,0.95)',
  '…': 'rgba(80,86,112,0.9)',
  z: 'rgba(80,80,130,0.9)',
  '💧': 'rgba(70,150,210,0.95)',
};

export class EmoteBubble {
  private sprite: THREE.Sprite | null = null;
  private t = 0;
  private hold = 0;
  kind: string | null = null;

  constructor(
    private readonly parent: THREE.Object3D,
    private height: number,
  ) {}

  setHeight(h: number): void {
    this.height = h;
    if (this.sprite) this.sprite.position.y = h;
  }

  /** seconds = Infinity 时一直显示，直到 clear() */
  show(kind: string, seconds = 1.6): void {
    this.clear();
    const s = makeLabelSprite(kind === 'z' ? 'Zz' : kind, COLORS[kind] ?? COLORS['…']);
    s.material = s.material.clone();
    s.position.y = this.height;
    s.userData.base = s.scale.clone();
    s.scale.multiplyScalar(0.01);
    s.renderOrder = 10;
    this.parent.add(s);
    this.sprite = s;
    this.kind = kind;
    this.t = 0;
    this.hold = seconds;
  }

  clear(): void {
    if (!this.sprite) return;
    this.parent.remove(this.sprite);
    this.sprite.material.dispose();
    this.sprite = null;
    this.kind = null;
  }

  update(dt: number): void {
    const s = this.sprite;
    if (!s) return;
    this.t += dt;
    const base = s.userData.base as THREE.Vector3;
    // 弹出：0.18 s 过冲缩放；之后轻微上下浮动
    const pop = this.t < 0.18 ? (this.t / 0.18) * 1.25 : this.t < 0.3 ? 1.25 - ((this.t - 0.18) / 0.12) * 0.25 : 1;
    s.scale.copy(base).multiplyScalar(1.15 * pop);
    s.position.y = this.height + Math.sin(this.t * 5) * 0.04;
    const left = this.hold - this.t;
    s.material.opacity = left < 0.25 ? Math.max(0, left / 0.25) : 1;
    if (left <= 0) this.clear();
  }
}

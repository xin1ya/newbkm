/**
 * 对话镜头（剧情引导 · 电影感）：与 NPC 对话时，镜头平滑切到玩家肩后的过肩机位，看向 NPC 面部；
 * 对话结束平滑回到跟随镜头。第一人称、战斗中不切。
 * - 机位：玩家身后 2.3 m、右肩外 0.75 m、高 1.75 m；看点 NPC 面部（头顶锚点下 0.42 m）
 * - 距离太近（< 1.2 m）时拉远一点，避免穿模
 * - 持有者为 'talk'：对话中途开始的战斗会接管镜头，对话结束不会误清
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { CameraRig } from '@/core/camera/CameraRig';

export interface TalkCameraOptions {
  game: Game;
  rig: CameraRig;
  /** NPC 头部世界坐标（找不到返回 null） */
  npcHead(id: string, out: THREE.Vector3): THREE.Vector3 | null;
  player(): THREE.Vector3;
  /** 当前能否切镜头（战斗中 / 第一人称时 false） */
  enabled(): boolean;
}

export function attachTalkCamera(o: TalkCameraOptions): () => void {
  const head = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  return o.game.events.on('npc:talk', (e) => {
    if (e.phase === 'end') {
      o.rig.clearOverride('talk', true);
      return;
    }
    if (!o.enabled() || o.rig.overridden) return;
    if (!o.npcHead(e.npc, head)) return;
    const p = o.player();
    const dx = head.x - p.x;
    const dz = head.z - p.z;
    const d = Math.max(0.01, Math.hypot(dx, dz));
    const fx = dx / d;
    const fz = dz / d;
    // 右手方向（朝向 NPC 时的右侧）
    const rx = -fz;
    const rz = fx;
    const back = d < 1.2 ? 2.8 : 2.3;
    pos.set(p.x - fx * back + rx * 0.75, p.y + 1.75, p.z - fz * back + rz * 0.75);
    look.set(head.x, head.y - 0.42, head.z).lerp(new THREE.Vector3(p.x, p.y + 1.45, p.z), 0.18);
    o.rig.setOverride(pos, look, 0.55, null, 'talk');
  });
}

/**
 * ENG-008 · 灰模占位（设计 §6.3）：统一胶囊体 + 名字标签。
 * 身高按物种数据缩放；颜色按主属性；正面有两只眼睛以便看出朝向。
 * 占位体也挂 userData.outline=true，渲染层会给它加反向外壳描边。
 */
import * as THREE from 'three';

export interface PlaceholderOptions {
  label: string;
  /** 身高（米），默认 1 */
  height?: number;
  color?: THREE.ColorRepresentation;
  /** 标签背景色 */
  labelColor?: string | undefined;
  /** 是否显示名字标签 */
  showLabel?: boolean;
}

/** 18 属性主题色（与 UI 共用） */
export const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a77a',
  fire: '#ee8130',
  water: '#6390f0',
  electric: '#f7d02c',
  grass: '#7ac74c',
  ice: '#96d9d6',
  fighting: '#c22e28',
  poison: '#a33ea1',
  ground: '#e2bf65',
  flying: '#a98ff3',
  psychic: '#f95587',
  bug: '#a6b91a',
  rock: '#b6a136',
  ghost: '#735797',
  dragon: '#6f35fc',
  dark: '#705746',
  steel: '#b7b7ce',
  fairy: '#d685ad',
};

const labelCache = new Map<string, THREE.SpriteMaterial>();

export function makeLabelSprite(text: string, bg = 'rgba(20,28,48,0.78)', fg = '#ffffff'): THREE.Sprite {
  const key = `${text}|${bg}|${fg}`;
  let mat = labelCache.get(key);
  if (!mat) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = '600 36px system-ui, "Microsoft YaHei", sans-serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 36;
    c.width = w;
    c.height = 56;
    ctx.font = font;
    ctx.fillStyle = bg;
    const r = 26;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, 56, r);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 30);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true });
    labelCache.set(key, mat);
  }
  const s = new THREE.Sprite(mat);
  const img = mat.map!.image as HTMLCanvasElement;
  const h = 0.32;
  s.scale.set((h * img.width) / img.height, h, 1);
  s.renderOrder = 10;
  s.name = 'label';
  return s;
}

const eyeGeo = new THREE.SphereGeometry(1, 10, 8);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b1e2b });
const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

export function createPlaceholder(o: PlaceholderOptions): THREE.Group {
  const h = THREE.MathUtils.clamp(o.height ?? 1, 0.35, 3.5);
  const radius = THREE.MathUtils.clamp(h * 0.32, 0.16, 0.9);
  const group = new THREE.Group();
  group.name = `placeholder:${o.label}`;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.01, h - radius * 2), 6, 16),
    new THREE.MeshToonMaterial({ color: new THREE.Color(o.color ?? 0xb0b6c3) }),
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.outline = true;
  body.name = 'body';
  group.add(body);
  // 眼睛（+Z 为正面）
  const eyeR = radius * 0.16;
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.setScalar(eyeR);
    eye.position.set(sx * radius * 0.38, h * 0.68, radius * 0.9);
    const shine = new THREE.Mesh(eyeGeo, shineMat);
    shine.scale.setScalar(0.35);
    shine.position.set(0.3, 0.35, 0.7);
    eye.add(shine);
    group.add(eye);
  }
  if (o.showLabel !== false) {
    const label = makeLabelSprite(o.label, o.labelColor);
    label.position.y = h + 0.35;
    group.add(label);
  }
  group.userData.height = h;
  group.userData.radius = radius;
  return group;
}

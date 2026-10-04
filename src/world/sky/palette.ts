/**
 * REN-004 · 昼夜色板：按小时插值的关键帧（精致卡通风：黎明粉橙、正午通透蓝、黄昏金紫、夜晚靛蓝不死黑）。
 */
import * as THREE from 'three';

export interface SkyKey {
  hour: number;
  zenith: string;
  horizon: string;
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  /** 星星可见度 0–1 */
  stars: number;
  /** 夜晚程度 0–1（灯光、窗户） */
  night: number;
}

export const SKY_KEYS: SkyKey[] = [
  { hour: 0, zenith: '#0d1640', horizon: '#26336b', sun: '#8fa6ff', sunIntensity: 0.35, hemiSky: '#4a5a9a', hemiGround: '#1d2440', hemiIntensity: 0.9, fog: '#1f2a58', stars: 1, night: 1 },
  { hour: 4.8, zenith: '#131d4d', horizon: '#35407a', sun: '#8fa6ff', sunIntensity: 0.3, hemiSky: '#505f9e', hemiGround: '#20284a', hemiIntensity: 0.9, fog: '#28336a', stars: 0.9, night: 1 },
  { hour: 6, zenith: '#5a79c9', horizon: '#ffb48a', sun: '#ffb070', sunIntensity: 1.2, hemiSky: '#b7b6e6', hemiGround: '#6b5e6e', hemiIntensity: 0.9, fog: '#f2b99c', stars: 0.2, night: 0.5 },
  { hour: 7.5, zenith: '#6fb3f2', horizon: '#ffe0c0', sun: '#ffe2b8', sunIntensity: 2.2, hemiSky: '#cfe6ff', hemiGround: '#7b8a62', hemiIntensity: 1.0, fog: '#d8e7f2', stars: 0, night: 0 },
  { hour: 12, zenith: '#4aa3f0', horizon: '#c6ecff', sun: '#fff8ea', sunIntensity: 2.8, hemiSky: '#d4ecff', hemiGround: '#869a66', hemiIntensity: 1.05, fog: '#cfe9fb', stars: 0, night: 0 },
  { hour: 16, zenith: '#58a8ec', horizon: '#d8ecf5', sun: '#fff0d6', sunIntensity: 2.5, hemiSky: '#d6e8fa', hemiGround: '#8b9564', hemiIntensity: 1.0, fog: '#d8e9f0', stars: 0, night: 0 },
  { hour: 18, zenith: '#6a74c4', horizon: '#ffa35c', sun: '#ff9a4d', sunIntensity: 1.6, hemiSky: '#e6b8c6', hemiGround: '#6e5a5a', hemiIntensity: 0.95, fog: '#f0a47a', stars: 0.05, night: 0.35 },
  { hour: 19.3, zenith: '#2b2f73', horizon: '#b0608a', sun: '#c07ab8', sunIntensity: 0.6, hemiSky: '#8a74b0', hemiGround: '#3a3050', hemiIntensity: 0.9, fog: '#6a4f82', stars: 0.5, night: 0.85 },
  { hour: 21, zenith: '#0f1845', horizon: '#2a3872', sun: '#8fa6ff', sunIntensity: 0.35, hemiSky: '#4a5a9a', hemiGround: '#1d2440', hemiIntensity: 0.9, fog: '#212c5c', stars: 1, night: 1 },
  { hour: 24, zenith: '#0d1640', horizon: '#26336b', sun: '#8fa6ff', sunIntensity: 0.35, hemiSky: '#4a5a9a', hemiGround: '#1d2440', hemiIntensity: 0.9, fog: '#1f2a58', stars: 1, night: 1 },
];

export interface SkyState {
  zenith: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fog: THREE.Color;
  stars: number;
  night: number;
}

export const createSkyState = (): SkyState => ({
  zenith: new THREE.Color(),
  horizon: new THREE.Color(),
  sun: new THREE.Color(),
  sunIntensity: 1,
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  hemiIntensity: 1,
  fog: new THREE.Color(),
  stars: 0,
  night: 0,
});

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const lerpColor = (out: THREE.Color, a: string, b: string, t: number) => out.copy(tmpA.set(a)).lerp(tmpB.set(b), t);

export function sampleSky(hour: number, out: SkyState = createSkyState()): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1]!.hour <= h) i++;
  const a = SKY_KEYS[i]!;
  const b = SKY_KEYS[i + 1]!;
  const t = THREE.MathUtils.smoothstep(h, a.hour, b.hour);
  lerpColor(out.zenith, a.zenith, b.zenith, t);
  lerpColor(out.horizon, a.horizon, b.horizon, t);
  lerpColor(out.sun, a.sun, b.sun, t);
  lerpColor(out.hemiSky, a.hemiSky, b.hemiSky, t);
  lerpColor(out.hemiGround, a.hemiGround, b.hemiGround, t);
  lerpColor(out.fog, a.fog, b.fog, t);
  out.sunIntensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t);
  out.hemiIntensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t);
  out.stars = THREE.MathUtils.lerp(a.stars, b.stars, t);
  out.night = THREE.MathUtils.lerp(a.night, b.night, t);
  return out;
}

/**
 * 太阳方向（指向太阳）。6 点东方升起、12 点最高（仰角 62°）、18 点西方落下；夜里返回月亮方向。
 * isMoon = true 表示主光源是月光。
 */
export function sunDirection(hour: number, out = new THREE.Vector3()): { dir: THREE.Vector3; isMoon: boolean; elevation: number } {
  const h = ((hour % 24) + 24) % 24;
  const dayT = (h - 6) / 12; // 0 日出 1 日落
  const isMoon = dayT < 0 || dayT > 1;
  const t = isMoon ? (((h + 6) % 24) / 12) : dayT; // 月亮 18→6
  const ang = t * Math.PI;
  const maxElev = isMoon ? 0.85 : 1.08;
  const elev = Math.sin(ang) * maxElev;
  // 东(+X) → 西(-X)，略偏南（+Z）使北向的镜头也能看到明暗
  out.set(Math.cos(ang), Math.max(0.12, Math.sin(elev)), 0.35).normalize();
  return { dir: out, isMoon, elevation: elev };
}

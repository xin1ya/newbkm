/**
 * REN-004 · 天空与昼夜总控：
 *  - 天空穹顶 / 云 / 日月 / 星空
 *  - 主光源（太阳或月亮，带阴影，阴影相机跟随玩家并按纹素对齐防闪烁）+ 半球环境光
 *  - 雾（颜色跟随地平线；雾天、雨天加浓）
 *  - 天气视觉（阴云压暗、雨雪粒子、闪电）
 * 输出 SkyOutputs，供水面、灯光、后处理闪白使用。
 */
import * as THREE from 'three';
import type { QualitySettings } from '@/render';
import { SkyDome } from './SkyDome';
import { Clouds } from './Clouds';
import { WeatherFx } from './WeatherFx';
import { createSkyState, sampleSky, sunDirection, type SkyState } from './palette';
import type { WeatherVisual } from './Weather';

export interface SkyOutputs {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  ambient: THREE.Color;
  night: number;
  flash: number;
  state: SkyState;
}

export class Sky {
  readonly group = new THREE.Group();
  readonly dome = new SkyDome();
  readonly clouds = new Clouds();
  readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1);
  readonly fog = new THREE.Fog(0xcfe9fb, 120, 900);
  readonly weatherFx: WeatherFx;
  private state = createSkyState();
  private readonly outputs: SkyOutputs;
  private quality: QualitySettings;
  private time = 0;
  private rnd = Math.random;
  private moonDir = new THREE.Vector3();
  private wind2 = new THREE.Vector2();

  constructor(q: QualitySettings) {
    this.quality = q;
    this.group.name = 'sky';
    this.group.add(this.dome.mesh, this.clouds.mesh, this.sun, this.sun.target, this.hemi);
    this.weatherFx = new WeatherFx(q.weatherParticles);
    this.weatherFx.boltsEnabled = q.weatherParticles >= 4000;
    this.group.add(this.weatherFx.group);
    this.applyQuality(q);
    this.outputs = { sunDir: new THREE.Vector3(), sunColor: new THREE.Color(), ambient: new THREE.Color(), night: 0, flash: 0, state: this.state };
  }

  applyQuality(q: QualitySettings): void {
    this.quality = q;
    const s = this.sun;
    s.castShadow = q.shadowMapSize > 0;
    if (s.castShadow) {
      s.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      s.shadow.map?.dispose();
      s.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      const r = q.shadowRadius;
      const cam = s.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = 400;
      cam.updateProjectionMatrix();
      s.shadow.bias = -0.0006;
      s.shadow.normalBias = 0.04;
      s.shadow.radius = 2;
    }
  }

  /**
   * @param hour 0–24
   * @param focus 玩家位置（阴影相机中心）
   * @param camPos 相机位置（粒子围绕相机）
   */
  update(dt: number, hour: number, focus: THREE.Vector3, camPos: THREE.Vector3, weather: WeatherVisual, windDir: THREE.Vector2): SkyOutputs {
    this.time += dt;
    const st = sampleSky(hour, this.state);
    const cover = weather.cloud;
    // 阴云：降低直射、提高环境光占比、天空去饱和
    const gray = new THREE.Color(0x9aa3ad);
    st.zenith.lerp(gray.clone().multiplyScalar(0.7 + (1 - st.night) * 0.3), cover * 0.55);
    st.horizon.lerp(gray, cover * 0.5);
    st.fog.lerp(gray.clone().multiplyScalar(0.55 + (1 - st.night) * 0.45), Math.max(cover * 0.5, weather.fog * 0.7));
    // M3-06 压暗：常夜雾 / 暴雪让白天也昏沉（偏冷紫）
    const dark = weather.dark ?? 0;
    if (dark > 0) {
      const dusk = new THREE.Color(0x2a2c3e);
      st.zenith.lerp(dusk, dark * 0.8);
      st.horizon.lerp(dusk, dark * 0.6);
      st.fog.lerp(new THREE.Color(0x4a4d63), dark * 0.7);
      st.sunIntensity *= 1 - dark * 0.75;
      st.hemiIntensity *= 1 - dark * 0.5;
    }
    const { dir, isMoon } = sunDirection(hour);
    const u = this.dome.uniforms;
    u.uZenith.value.copy(st.zenith);
    u.uHorizon.value.copy(st.horizon);
    // 日月在天空中的真实方向（夜晚太阳在地平线下）
    const h = ((hour % 24) + 24) % 24;
    const ang = ((h - 6) / 12) * Math.PI;
    u.uSunDir.value.set(Math.cos(ang), Math.sin(ang) * 0.9, 0.35).normalize();
    this.moonDir.copy(u.uSunDir.value).multiplyScalar(-1);
    u.uMoonDir.value.copy(this.moonDir);
    u.uSunColor.value.copy(st.sun);
    u.uStars.value = st.stars;
    u.uTime.value = this.time;
    u.uCloudCover.value = cover;

    // 光照
    const flash = this.weatherFx.flash;
    const direct = st.sunIntensity * (1 - cover * 0.7) + flash * 3;
    this.sun.color.copy(st.sun).lerp(new THREE.Color(0xdfe8ff), flash);
    this.sun.intensity = direct;
    this.hemi.color.copy(st.hemiSky);
    this.hemi.groundColor.copy(st.hemiGround);
    this.hemi.intensity = st.hemiIntensity * (1 + cover * 0.25) + flash * 0.8;
    // 阴影相机跟随，按纹素对齐
    const r = this.quality.shadowRadius || 40;
    const texel = (2 * r) / Math.max(512, this.quality.shadowMapSize || 1024);
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + dir.x * 150, focus.y + dir.y * 150, fz + dir.z * 150);
    this.sun.shadow.intensity = isMoon ? 0.55 : 1 - cover * 0.5;

    // 雾
    this.fog.color.copy(st.fog);
    const far = this.quality.farPlane;
    const fogK = Math.max(weather.fog, cover * 0.3);
    this.fog.near = THREE.MathUtils.lerp(far * 0.18, 12, fogK);
    this.fog.far = THREE.MathUtils.lerp(far * 0.95, 120, fogK);

    // 云与天气粒子
    this.wind2.copy(windDir).multiplyScalar(weather.wind);
    const cloudTint = st.sun.clone().lerp(new THREE.Color(0xffffff), 0.5).multiplyScalar(0.55 + (1 - st.night) * 0.45);
    this.clouds.update(dt, camPos, windDir.x * weather.wind, windDir.y * weather.wind, cover, cloudTint);
    this.weatherFx.update(dt, this.time, camPos, weather.rain, weather.snow, this.wind2, weather.lightning, this.rnd);

    const o = this.outputs;
    o.sunDir.copy(dir);
    o.sunColor.copy(this.sun.color).multiplyScalar(direct / 2.5);
    o.ambient.copy(st.hemiSky).multiplyScalar(st.hemiIntensity * 0.75);
    o.night = st.night;
    o.flash = flash;
    return o;
  }

  dispose(): void {
    this.dome.dispose();
    this.clouds.dispose();
    this.weatherFx.dispose();
    this.sun.shadow.map?.dispose();
  }
}

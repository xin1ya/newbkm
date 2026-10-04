/**
 * 天气粒子：雨丝（线段，GPU 端按时间下落并围绕相机循环平铺，CPU 零更新）、雪花（点）、闪电（全屏闪白 + 雷光）。
 */
import * as THREE from 'three';
import { seeded } from '../util/hash';

const BOX = 36;

function precipitation(count: number, snow: boolean): THREE.LineSegments | THREE.Points {
  const rnd = seeded(snow ? 5 : 3);
  const verts = snow ? count : count * 2;
  const offset = new Float32Array(verts * 3);
  const tip = new Float32Array(verts);
  for (let i = 0; i < count; i++) {
    const x = rnd() * BOX;
    const y = rnd() * BOX;
    const z = rnd() * BOX;
    if (snow) {
      offset.set([x, y, z], i * 3);
    } else {
      offset.set([x, y, z, x, y, z], i * 6);
      tip[i * 2 + 1] = 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(offset, 3));
  g.setAttribute('aTip', new THREE.BufferAttribute(tip, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = new THREE.ShaderMaterial({
    name: snow ? 'snow' : 'rain',
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uAmount: { value: 0 },
      uWind: { value: new THREE.Vector2(0.5, 0.2) },
      uColor: { value: new THREE.Color(snow ? 0xffffff : 0xbfd4ea) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCam; uniform float uAmount; uniform vec2 uWind;
      attribute float aTip; varying float vA;
      void main() {
        float speed = ${snow ? '1.6' : '17.0'};
        vec3 p = position;
        p.y = mod(p.y - uTime * speed, ${BOX.toFixed(1)});
        p.xz += uWind * (${BOX.toFixed(1)} - p.y) * ${snow ? '0.25' : '0.08'};
        ${snow ? 'p.x += sin(uTime * 1.3 + position.z) * 0.6; p.z += cos(uTime * 1.1 + position.x) * 0.6;' : ''}
        vec3 w;
        w.xz = uCam.xz + mod(p.xz - uCam.xz, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
        w.y = uCam.y - ${(BOX / 2 - 6).toFixed(1)} + p.y;
        ${snow ? '' : 'w.y += aTip * 0.9; w.xz += aTip * uWind * 0.07;'}
        // 数量控制：丢弃一部分粒子
        float keep = step(fract(position.x * 12.9898 + position.z * 78.233), uAmount);
        vA = keep * smoothstep(0.0, 4.0, p.y) * smoothstep(${BOX.toFixed(1)}, ${(BOX - 6).toFixed(1)}, p.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        ${snow ? 'gl_PointSize = keep * 3.0 * (30.0 / max(1.0, length(w - uCam)));' : ''}
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main() {
        if (vA <= 0.01) discard;
        ${snow ? 'vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard;' : ''}
        gl_FragColor = vec4(uColor, vA * ${snow ? '0.9' : '0.45'});
      }`,
  });
  const obj = snow ? new THREE.Points(g, mat) : new THREE.LineSegments(g, mat);
  obj.frustumCulled = false;
  obj.renderOrder = 5;
  return obj;
}

export class WeatherFx {
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments | THREE.Points;
  private snow: THREE.Points | THREE.LineSegments;
  private lightningTimer = 4;
  /** 当前闪电强度（0–1），由 Sky 叠加到光照与后处理闪白 */
  flash = 0;

  constructor(particles: number) {
    this.rain = precipitation(particles, false);
    this.snow = precipitation(Math.floor(particles / 2), true);
    this.group.add(this.rain, this.snow);
    this.group.name = 'weather-fx';
  }

  update(dt: number, time: number, cam: THREE.Vector3, rain: number, snow: number, wind: THREE.Vector2, lightning: number, rnd: () => number): void {
    for (const [o, amt] of [
      [this.rain, rain],
      [this.snow, snow],
    ] as const) {
      const u = (o.material as THREE.ShaderMaterial).uniforms;
      u.uTime!.value = time;
      (u.uCam!.value as THREE.Vector3).copy(cam);
      u.uAmount!.value = amt;
      (u.uWind!.value as THREE.Vector2).copy(wind);
      o.visible = amt > 0.01;
    }
    // 闪电：随机间隔 4–14 秒，双闪
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (lightning > 0.5) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.flash = 1;
        this.lightningTimer = rnd() < 0.3 ? 0.18 : 4 + rnd() * 10;
      }
    }
  }

  dispose(): void {
    for (const o of [this.rain, this.snow]) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  }
}

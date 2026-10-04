/**
 * REN-004 · 天空穹顶：3 段量化渐变（卡通天空）、硬边日轮 + 光晕、月牙、程序化星空（闪烁）、地平线雾带。
 */
import * as THREE from 'three';

export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunColor: { value: new THREE.Color() },
    uStars: { value: 0 },
    uTime: { value: 0 },
    uCloudCover: { value: 0 },
  };

  constructor() {
    const mat = new THREE.ShaderMaterial({
      name: 'sky-dome',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
          gl_Position = p.xyww; // 永远在最远处
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uSunColor;
        uniform float uStars; uniform float uTime; uniform float uCloudCover;
        varying vec3 vDir;
        float sHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          // 3 段量化 + 细窄过渡
          float t = smoothstep(0.0, 0.5, h);
          float band = t < 0.18 ? 0.0 : (t < 0.55 ? 0.5 : 1.0);
          float soft = mix(t, band, 0.55);
          vec3 col = mix(uHorizon, uZenith, soft);
          // 地平线下：略暗的海雾色
          col = mix(col, uHorizon * 0.92, smoothstep(0.0, -0.08, d.y));
          // 太阳：硬边日轮 + 两圈光晕
          float sd = dot(d, normalize(uSunDir));
          float sunUp = smoothstep(-0.1, 0.05, uSunDir.y);
          col += uSunColor * (step(0.9993, sd) * 1.6 + smoothstep(0.985, 0.9993, sd) * 0.25 + smoothstep(0.9, 1.0, sd) * 0.18) * sunUp * (1.0 - uCloudCover * 0.8);
          // 月亮：月牙（两个圆相减）
          vec3 md = normalize(uMoonDir);
          float m1 = step(0.9994, dot(d, md));
          vec3 off = normalize(md + vec3(0.02, 0.01, 0.0));
          float m2 = step(0.9994, dot(d, off));
          col += vec3(1.0, 0.97, 0.86) * max(0.0, m1 - m2) * smoothstep(-0.05, 0.1, md.y) * 1.3;
          col += vec3(0.5, 0.55, 0.8) * smoothstep(0.97, 1.0, dot(d, md)) * 0.12 * uStars;
          // 星空
          if (uStars > 0.01 && d.y > 0.0) {
            vec3 g = floor(d * 180.0);
            float s = sHash(g);
            float star = step(0.9965, s);
            float tw = 0.6 + 0.4 * sin(uTime * (2.0 + s * 5.0) + s * 40.0);
            col += vec3(0.95, 0.95, 1.0) * star * tw * uStars * smoothstep(0.0, 0.25, d.y) * (1.0 - uCloudCover);
          }
          // 阴云压暗
          col = mix(col, vec3(dot(col, vec3(0.33))) * 0.85, uCloudCover * 0.6);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

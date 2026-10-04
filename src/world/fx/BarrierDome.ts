/**
 * M2-14 · 剧情封锁的可见特效：
 * - barrier：异变遗迹入口的紫色结界穹顶（菲涅尔边缘发光 + 流动的六边形网格 + 底部光环），打开时收缩消散；
 * - heat：火山口的热浪帘（半透明橙色、向上流动的扭曲条纹），热源解除后淡出。
 * 只用于提示「这里被封住了」，碰撞仍由 BlockerConfig 负责。
 */
import * as THREE from 'three';

export type BarrierKind = 'barrier' | 'heat';

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
varying float vY;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG_BARRIER = /* glsl */ `
uniform float uTime;
uniform float uFade;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
varying float vY;
float hexLine(vec2 p) {
  p = abs(fract(p) - 0.5);
  return smoothstep(0.42, 0.5, max(p.x * 1.1547 + p.y * 0.5, p.y));
}
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  vec2 g = vec2(vUv.x * 48.0, vUv.y * 18.0 - uTime * 0.35);
  float hex = hexLine(g + vec2(0.5 * floor(g.y), 0.0));
  float band = smoothstep(0.0, 0.08, fract(vUv.y * 3.0 - uTime * 0.25)) * (1.0 - smoothstep(0.08, 0.2, fract(vUv.y * 3.0 - uTime * 0.25)));
  float a = (0.12 + fres * 0.75 + hex * 0.22 + band * 0.25) * uFade;
  vec3 col = uColor * (0.8 + fres * 1.6 + hex * 0.6) + vec3(band * 0.4);
  gl_FragColor = vec4(col, a);
}
`;

const FRAG_HEAT = /* glsl */ `
uniform float uTime;
uniform float uFade;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
varying float vY;
void main() {
  float wave = sin(vUv.x * 60.0 + sin(vUv.y * 9.0 - uTime * 2.4) * 2.0) * 0.5 + 0.5;
  float rise = fract(vUv.y * 2.0 - uTime * 0.6);
  float fadeTop = 1.0 - smoothstep(0.35, 1.0, vUv.y);
  float a = (0.10 + wave * 0.12 + (1.0 - rise) * 0.08) * fadeTop * uFade;
  gl_FragColor = vec4(uColor * (1.0 + wave * 0.5), a);
}
`;

export class BarrierDome {
  readonly group = new THREE.Group();
  private readonly mat: THREE.ShaderMaterial;
  private ring: THREE.Mesh | null = null;
  private fadeOut = -1;
  done = false;

  constructor(
    readonly kind: BarrierKind,
    position: THREE.Vector3,
    radius: number,
  ) {
    const color = new THREE.Color(kind === 'barrier' ? '#a46aff' : '#ff8a3c');
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: kind === 'barrier' ? FRAG_BARRIER : FRAG_HEAT,
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uColor: { value: color } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: kind === 'barrier' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const geo =
      kind === 'barrier'
        ? new THREE.SphereGeometry(radius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)
        : new THREE.CylinderGeometry(radius, radius * 1.1, 9, 40, 1, true).translate(0, 4.5, 0);
    const shell = new THREE.Mesh(geo, this.mat);
    shell.renderOrder = 5;
    shell.frustumCulled = false;
    this.group.add(shell);
    if (kind === 'barrier') {
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      this.ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.96, radius * 1.04, 64).rotateX(-Math.PI / 2), ringMat);
      this.ring.position.y = 0.15;
      this.group.add(this.ring);
      const light = new THREE.PointLight(color, 3, radius * 2.5, 1.6);
      light.position.y = radius * 0.5;
      this.group.add(light);
    }
    this.group.position.copy(position);
    this.group.name = `barrier:${kind}`;
  }

  /** 开始消散（结界打开 / 热浪解除） */
  dissolve(): void {
    if (this.fadeOut < 0) this.fadeOut = 0;
  }

  update(dt: number, time: number): void {
    this.mat.uniforms.uTime!.value = time;
    if (this.ring) (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time * 2.2) * 0.15;
    if (this.fadeOut >= 0 && !this.done) {
      this.fadeOut += dt;
      const k = Math.min(1, this.fadeOut / 1.6);
      this.mat.uniforms.uFade!.value = 1 - k;
      if (this.kind === 'barrier') this.group.scale.setScalar(1 + k * 0.25);
      if (this.ring) (this.ring.material as THREE.MeshBasicMaterial).opacity *= 1 - k;
      if (k >= 1) {
        this.done = true;
        this.group.visible = false;
      }
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
      if ((o as THREE.PointLight).isPointLight) (o as THREE.PointLight).dispose();
    });
  }
}

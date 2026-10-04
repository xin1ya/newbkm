/**
 * REN-002 · 场景描边：后处理边缘检测（深度 + 法线）。
 * 法线不单独渲染（省一整遍 draw call），而是从深度缓冲重建视空间位置，再用邻域差分求法线：
 *  - 深度边缘：邻域线性深度差 / 中心深度 > 阈值（相对值，远近一致）
 *  - 法线边缘：中心法线与邻域法线夹角大于阈值（折痕、建筑棱角、地形陡坎）
 * 边缘随距离淡出，天空（depth=1）不描边；线宽随渲染分辨率缩放。
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { toonGlobals } from '../toon/ToonMaterial';

const shader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 1000 },
    uProjInv: { value: new THREE.Matrix4() },
    uStrength: { value: 0.7 },
    uDepthThreshold: { value: 0.012 },
    uNormalThreshold: { value: 0.45 },
    uEdgeColor: { value: new THREE.Color('#27304a') },
    uFade: { value: new THREE.Vector2(40, 140) },
    uThickness: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uNear;
    uniform float uFar;
    uniform mat4 uProjInv;
    uniform float uStrength;
    uniform float uDepthThreshold;
    uniform float uNormalThreshold;
    uniform vec3 uEdgeColor;
    uniform vec2 uFade;
    uniform float uThickness;
    varying vec2 vUv;

    float rawDepth(vec2 uv) { return texture2D(tDepth, uv).x; }
    vec3 viewPos(vec2 uv) {
      float d = rawDepth(uv);
      vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      vec4 v = uProjInv * clip;
      return v.xyz / v.w;
    }
    vec3 viewNormal(vec2 uv, vec2 px) {
      vec3 c = viewPos(uv);
      vec3 r = viewPos(uv + vec2(px.x, 0.0));
      vec3 l = viewPos(uv - vec2(px.x, 0.0));
      vec3 t = viewPos(uv + vec2(0.0, px.y));
      vec3 b = viewPos(uv - vec2(0.0, px.y));
      // 取变化较小的一侧，避免在深度断层处产生错误法线
      vec3 dx = abs(r.z - c.z) < abs(c.z - l.z) ? r - c : c - l;
      vec3 dy = abs(t.z - c.z) < abs(c.z - b.z) ? t - c : c - b;
      return normalize(cross(dx, dy));
    }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float dc = rawDepth(vUv);
      if (dc >= 0.99999) { gl_FragColor = vec4(col.rgb, 1.0); return; }
      // 「不描边」标记（草 / 花写 alpha 0.5）：中心或任一邻居带标记就不描边——既去掉草叶之间的杂线，也去掉草丛压在地面上的轮廓
      float mark = col.a;
      vec2 px = uThickness / uResolution;
      vec3 pc = viewPos(vUv);
      float zc = -pc.z;
      vec3 nc = viewNormal(vUv, 1.0 / uResolution);
      float depthEdge = 0.0;
      float normalEdge = 0.0;
      vec2 offs[4];
      offs[0] = vec2(px.x, 0.0); offs[1] = vec2(-px.x, 0.0); offs[2] = vec2(0.0, px.y); offs[3] = vec2(0.0, -px.y);
      for (int i = 0; i < 4; i++) {
        vec2 uv = vUv + offs[i];
        mark = min(mark, texture2D(tDiffuse, uv).a);
        float d = rawDepth(uv);
        float z = d >= 0.99999 ? uFar : -viewPos(uv).z;
        // 只在“近处像素”一侧描边（z 更大 = 邻居更远），线条落在前景物体上
        depthEdge = max(depthEdge, (z - zc) / zc);
        if (d < 0.99999) {
          vec3 n = viewNormal(uv, 1.0 / uResolution);
          normalEdge = max(normalEdge, 1.0 - dot(nc, n));
        }
      }
      float e = max(
        smoothstep(uDepthThreshold, uDepthThreshold * 2.5, depthEdge),
        smoothstep(uNormalThreshold, uNormalThreshold + 0.25, normalEdge) * 0.85
      );
      float fade = 1.0 - smoothstep(uFade.x, uFade.y, zc);
      e *= fade * uStrength * step(0.75, mark);
      gl_FragColor = vec4(mix(col.rgb, col.rgb * uEdgeColor * 1.6, e), 1.0);
    }
  `,
};

export class EdgeDetectPass extends Pass {
  readonly material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  depthTexture: THREE.DepthTexture | null = null;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    super();
    this.material = new THREE.ShaderMaterial({
      name: 'edge-detect',
      uniforms: THREE.UniformsUtils.clone(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
    this.applyStyle();
  }

  applyStyle(): void {
    const o = toonGlobals.style.outline;
    const u = this.material.uniforms;
    u.uStrength!.value = o.edgeStrength;
    u.uDepthThreshold!.value = o.edgeDepthThreshold;
    u.uNormalThreshold!.value = o.edgeNormalThreshold;
    (u.uEdgeColor!.value as THREE.Color).set(o.edgeColor);
    (u.uFade!.value as THREE.Vector2).set(o.edgeFadeStart, o.edgeFadeEnd);
  }

  override setSize(width: number, height: number): void {
    (this.material.uniforms.uResolution!.value as THREE.Vector2).set(width, height);
    // 高分辨率下线宽跟着放大，保证 1080p 与 4K 观感一致
    this.material.uniforms.uThickness!.value = Math.max(1, Math.round(height / 900));
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.material.uniforms;
    u.tDiffuse!.value = readBuffer.texture;
    u.tDepth!.value = this.depthTexture ?? readBuffer.depthTexture;
    u.uNear!.value = this.camera.near;
    u.uFar!.value = this.camera.far;
    (u.uProjInv!.value as THREE.Matrix4).copy(this.camera.projectionMatrixInverse);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}

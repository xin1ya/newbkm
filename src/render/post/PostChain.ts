/**
 * REN-003 · 后处理链：
 *   RenderPass（带深度纹理，可选 MSAA）
 *   → EdgeDetectPass（场景描边，REN-002）
 *   → UnrealBloomPass（1/4 分辨率，按需开启，只让高亮部分发光：灯笼、火焰、闪光特效）
 *   → OutputPass（色调映射 + sRGB）
 *   → 饱和度微调 + FXAA（无 MSAA 时）
 * 画质切换时重建 pass 列表；低画质直接走 renderer.render（最省）。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { EdgeDetectPass } from '../outline/EdgeDetectPass';
import { setHullOutlinesEnabled } from '../outline/InvertedHull';
import { toonGlobals } from '../toon/ToonMaterial';
import type { QualitySettings } from '../quality';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.08 },
    uVignette: { value: 0.18 },
    uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSaturation; uniform float uVignette; uniform vec4 uFlash; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.85, length(d) * 1.2);
      c.rgb = mix(c.rgb, uFlash.rgb, uFlash.a);
      gl_FragColor = c;
    }`,
};

export class PostChain {
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  edgePass: EdgeDetectPass | null = null;
  bloomPass: UnrealBloomPass | null = null;
  private gradePass: ShaderPass | null = null;
  private fxaaPass: ShaderPass | null = null;
  private quality: QualitySettings | null = null;
  private width = 1;
  private height = 1;
  /**
   * 性能 P1 · Bloom 按需：只有夜晚 / 有发光物 / 战斗特效时开启（场景每帧调用 requestBloom），
   * 无请求 1.5 s 后关闭 pass；开关时强度淡入淡出，避免突变。
   */
  private bloomHold = 0;
  private bloomFade = 0;
  requestBloom(seconds = 0.5): void {
    this.bloomHold = Math.max(this.bloomHold, seconds);
  }
  /** 是否让 bloom 永远开启（风格样张 / 战斗场景） */
  bloomAlways = false;
  /** 全屏闪白（战斗开场、闪电）：rgb + 强度 */
  readonly flash = new THREE.Vector4(1, 1, 1, 0);

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = toonGlobals.style.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  setView(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.scene = scene;
    this.camera = camera;
    if (this.renderPass) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
    }
    if (this.edgePass) (this.edgePass as unknown as { camera: THREE.PerspectiveCamera }).camera = camera;
  }

  get usesComposer(): boolean {
    return this.composer !== null;
  }

  applyQuality(q: QualitySettings): void {
    this.quality = q;
    setHullOutlinesEnabled(q.hullOutline);
    this.disposeComposer();
    const useComposer = q.edgeDetect || q.bloom || q.msaa > 0 || q.tier !== 'low';
    if (!useComposer) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: q.msaa,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType),
    });
    rt.depthTexture!.format = THREE.DepthFormat;
    const composer = new EffectComposer(this.renderer, rt);
    // 两个缓冲各自独立的深度纹理：EffectComposer 克隆 rt 时两者共享同一张 DepthTexture，
    // 描边 pass 读 readBuffer 深度、写 writeBuffer 时会形成反馈环（GL_INVALID_OPERATION，整帧变黑）
    const depth2 = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
    depth2.format = THREE.DepthFormat;
    composer.renderTarget2.depthTexture = depth2;
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);
    if (q.edgeDetect) {
      this.edgePass = new EdgeDetectPass(this.camera);
      composer.addPass(this.edgePass);
    }
    if (q.bloom) {
      const b = toonGlobals.style.bloom;
      // 性能 P1：宽高各 1/4（原来 1/2）。bloom 本身是低频模糊，看不出差别。
      // UnrealBloomPass.setSize 内部会再除以 2，所以这里把传入尺寸先减半
      const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 4, size.y / 4), b.strength, b.radius, b.threshold);
      const baseSetSize = bloom.setSize.bind(bloom);
      bloom.setSize = (w: number, h: number) => baseSetSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
      this.bloomPass = bloom;
      composer.addPass(this.bloomPass);
    }
    composer.addPass(new OutputPass());
    this.gradePass = new ShaderPass(GradeShader);
    this.gradePass.uniforms.uSaturation!.value = toonGlobals.style.saturation;
    this.gradePass.uniforms.uFlash!.value = this.flash;
    composer.addPass(this.gradePass);
    if (q.msaa === 0) {
      this.fxaaPass = new ShaderPass(FXAAShader);
      composer.addPass(this.fxaaPass);
    }
    this.composer = composer;
    this.setSize(this.width, this.height);
  }

  /** 画风参数变化（样张调参） */
  applyStyle(): void {
    const s = toonGlobals.style;
    this.renderer.toneMappingExposure = s.exposure;
    this.edgePass?.applyStyle();
    if (this.bloomPass) {
      this.bloomPass.strength = s.bloom.strength * this.bloomFade;
      this.bloomPass.radius = s.bloom.radius;
      this.bloomPass.threshold = s.bloom.threshold;
    }
    if (this.gradePass) this.gradePass.uniforms.uSaturation!.value = s.saturation;
  }

  setSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    if (!this.composer) return;
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    if (this.fxaaPass) (this.fxaaPass.uniforms.resolution!.value as THREE.Vector2).set(1 / (w * pr), 1 / (h * pr));
    if (this.bloomPass) this.bloomPass.resolution.set((w * pr) / 4, (h * pr) / 4);
  }

  render(dt: number): void {
    if (this.bloomPass) {
      this.bloomHold -= dt;
      const want = this.bloomAlways || this.bloomHold > -1.5;
      this.bloomFade = THREE.MathUtils.clamp(this.bloomFade + (want ? dt : -dt) * 2, 0, 1);
      this.bloomPass.enabled = this.bloomFade > 0;
      this.bloomPass.strength = toonGlobals.style.bloom.strength * this.bloomFade;
    }
    if (this.composer) {
      this.composer.render(dt);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
  }

  get currentQuality(): QualitySettings | null {
    return this.quality;
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    for (const p of this.composer.passes) p.dispose?.();
    this.composer.renderTarget1.depthTexture?.dispose();
    this.composer.renderTarget2.depthTexture?.dispose();
    this.composer.dispose();
    this.composer = null;
    this.renderPass = null;
    this.edgePass = null;
    this.bloomPass = null;
    this.gradePass = null;
    this.fxaaPass = null;
  }

  dispose(): void {
    this.disposeComposer();
  }
}

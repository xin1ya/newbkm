/**
 * 环境生物（纯装饰，不参与碰撞 / 遇敌）：围绕玩家按生态、时段、天气生成与回收。
 *  - 蝴蝶      白天、无雨，草原 / 村镇 / 湖畔，在离地 0.4–2 m 处飘飞，偶尔落在花上
 *  - 萤火虫    夜晚，幻影之森 / 湖畔 / 河谷（草原少量），加法混合发光点，呼吸闪烁
 *  - 鸟群      白天，高空盘旋；海滩 / 海崖 / 港湾换成白色海鸥（更大、滑翔多）
 *  - 蜻蜓      白天，淡水边，悬停—急冲
 *  - 跃鱼      淡水湖 / 河，每隔几秒一条鱼跃出水面划出抛物线
 *  - 落叶      森林 / 村镇树下飘落（村镇是樱花瓣），随风漂移
 *  - 薄雾      幻影之森常驻、湖面 / 河面夜间与雨后，贴地漂移的软雾团
 *  - 光柱      晴天白天的林间丁达尔光柱（沿太阳方向，从林冠缝隙落下）
 *  - 飘尘      阳光里缓慢浮动的花粉 / 尘埃
 * 每类一个 InstancedMesh / Points（共 9 个 draw call），对象池固定。
 */
import * as THREE from 'three';
import { SURFACE_CHANNELS } from '@/config/islands/types';
import type { Heightfield } from '../terrain/Heightfield';
import type { Biome, EcologyMap } from './biome';

export interface AmbientEnv {
  /** 0 = 白天，1 = 深夜 */
  night: number;
  /** 0–1 雨量 */
  rain: number;
  /** 环境光亮度（0–1），用于给不受光照的小生物调暗 */
  light: number;
  windX: number;
  windZ: number;
  wind: number;
  /** 指向太阳的单位向量（光柱方向） */
  sunDir?: THREE.Vector3 | undefined;
}

interface Agent {
  alive: boolean;
  p: THREE.Vector3;
  v: THREE.Vector3;
  /** 目标点 / 盘旋中心 */
  t: THREE.Vector3;
  phase: number;
  life: number;
  timer: number;
  scale: number;
}

const SAND = SURFACE_CHANNELS.indexOf('sand');

const newAgent = (): Agent => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: new THREE.Vector3(), phase: 0, life: 0, timer: 0, scale: 1 });

const BUTTERFLY_COLORS = ['#fff3a0', '#ffffff', '#ffb36b', '#9fd0ff', '#ffa3c8'].map((c) => new THREE.Color(c));

const FLUTTER_BIOMES: ReadonlySet<Biome> = new Set(['meadow', 'village', 'wetland', 'riverine', 'cliff']);
const FIREFLY_BIOMES: Partial<Record<Biome, number>> = { mistwood: 1, wetland: 1, riverine: 0.8, meadow: 0.35, village: 0.15 };
const SEA_BIRD_BIOMES: ReadonlySet<Biome> = new Set(['beach', 'cliff', 'harbor']);
const LEAF_BIOMES: Partial<Record<Biome, number>> = { mistwood: 1, meadow: 0.45, village: 0.8, wetland: 0.4, riverine: 0.4 };

function wingGeometry(): THREE.BufferGeometry {
  // 两片三角翅（中线为铰链），+X / -X 两侧；扇动通过实例矩阵 X 轴缩放表现
  const g = new THREE.BufferGeometry();
  const v = [0, 0, 0.06, 1, 0, 0.1, 0.8, 0, -0.08, 0, 0, -0.06, -1, 0, 0.1, -0.8, 0, -0.08];
  const idx = [0, 1, 2, 0, 2, 3, 0, 5, 4, 0, 3, 5];
  // 双面：再加一份反向索引
  const back = [];
  for (let i = 0; i < idx.length; i += 3) back.push(idx[i]!, idx[i + 2]!, idx[i + 1]!);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([...idx, ...back]);
  g.computeVertexNormals();
  return g;
}

function birdGeometry(): THREE.BufferGeometry {
  // 海鸥 / 小鸟剪影：身体 + 两段式翅膀（扇动用 Y 缩放把翅尖上下拉）
  const g = new THREE.BufferGeometry();
  const v = [
    // 身体（菱形）
    0, 0, 0.5, 0.08, 0, 0, 0, 0, -0.45, -0.08, 0, 0,
    // 右翼
    0.06, 0, 0.12, 0.6, 0.12, 0.05, 1.1, 0.35, -0.12, 0.06, 0, -0.12,
    // 左翼
    -0.06, 0, 0.12, -0.6, 0.12, 0.05, -1.1, 0.35, -0.12, -0.06, 0, -0.12,
  ];
  const idx = [0, 1, 2, 0, 2, 3, 4, 5, 7, 5, 6, 7, 8, 11, 9, 9, 11, 10];
  const back = [];
  for (let i = 0; i < idx.length; i += 3) back.push(idx[i]!, idx[i + 2]!, idx[i + 1]!);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([...idx, ...back]);
  g.computeVertexNormals();
  return g;
}

function dragonflyGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.012, 0.018, 0.32, 4, 1).rotateX(Math.PI / 2);
  const wings = new THREE.PlaneGeometry(0.42, 0.06).rotateX(-Math.PI / 2);
  const w2 = new THREE.PlaneGeometry(0.38, 0.05).rotateX(-Math.PI / 2).translate(0, 0, -0.05);
  const parts = [body, wings, w2].map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (const p of parts) pos.push(...(p.getAttribute('position').array as Float32Array));
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

function fishGeometry(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.12, 6, 4).scale(0.45, 0.7, 1.6);
  const tail = new THREE.ConeGeometry(0.1, 0.16, 3, 1).rotateX(-Math.PI / 2).scale(0.3, 1, 1).translate(0, 0, -0.24);
  const parts = [body, tail].map((g) => g.toNonIndexed());
  const out = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (const p of parts) pos.push(...(p.getAttribute('position').array as Float32Array));
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

function leafGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.07, 0.045, 0, 0, 0, 0, -0.07, -0.045, 0, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

/** 萤火虫 / 飘尘：加法混合的软圆点，按相位呼吸闪烁 */
function fireflyMaterial(color = new THREE.Vector3(0.82, 1.0, 0.45), size = 300): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uScale: { value: size }, uColor: { value: color } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime; uniform float uScale;
      varying float vGlow;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float b = sin(uTime * (1.3 + fract(aPhase * 7.1) * 1.4) + aPhase * 6.283);
        vGlow = smoothstep(-0.2, 1.0, b);
        gl_PointSize = uScale * (0.06 + 0.05 * vGlow) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform vec3 uColor;
      varying float vGlow;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        a = a * a * (0.25 + 0.75 * vGlow) * uAlpha;
        gl_FragColor = vec4(uColor * (0.6 + a), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * 体积感贴片：instanced 平面在顶点着色器里做公告板。
 *  - mist：面向相机的软圆雾团（贴地漂移），近相机淡出避免“糊脸”
 *  - shaft：绕自身轴（太阳方向）旋转面向相机的长条光柱，两端渐隐，加法混合
 */
function billboardMaterial(mode: 'mist' | 'shaft'): THREE.ShaderMaterial {
  const axial = mode === 'shaft';
  return new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vDepth; varying float vSeed;
      void main() {
        vUv = uv;
        vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sx = length(instanceMatrix[0].xyz);
        float sy = length(instanceMatrix[1].xyz);
        vSeed = fract(c.x * 0.137 + c.z * 0.071);
        ${
          axial
            ? `vec3 axis = normalize(mat3(instanceMatrix) * vec3(0.0, 1.0, 0.0));
        vec3 side = normalize(cross(axis, normalize(cameraPosition - c.xyz)));
        vec3 wp = c.xyz + side * position.x * sx + axis * position.y * sy;`
            : `vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 wp = c.xyz + right * position.x * sx + up * position.y * sy;`
        }
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform vec3 uColor; uniform float uTime;
      varying vec2 vUv; varying float vDepth; varying float vSeed;
      void main() {
        ${
          axial
            ? `float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float a = across * across * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        a *= 0.7 + 0.3 * sin(uTime * 0.4 + vSeed * 30.0);`
            : `float d = length(vUv - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 1.8);
        a *= 0.75 + 0.25 * sin(uTime * 0.3 + vSeed * 40.0 + vUv.x * 3.0);`
        }
        a *= uAlpha * smoothstep(1.5, 6.0, vDepth);
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: axial ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

const MIST: Partial<Record<Biome, { day: number; night: number }>> = {
  mistwood: { day: 0.34, night: 0.5 },
  wetland: { day: 0.06, night: 0.32 },
  riverine: { day: 0.04, night: 0.22 },
  meadow: { day: 0, night: 0.1 },
};
const MOTES: Partial<Record<Biome, number>> = { mistwood: 1, meadow: 0.45, village: 0.3, wetland: 0.4, riverine: 0.3 };

export class AmbientLife {
  readonly group = new THREE.Group();
  private readonly butterflies = Array.from({ length: 22 }, newAgent);
  private readonly fireflies = Array.from({ length: 70 }, newAgent);
  private readonly birds = Array.from({ length: 14 }, newAgent);
  private readonly dragonflies = Array.from({ length: 8 }, newAgent);
  private readonly fish = Array.from({ length: 3 }, newAgent);
  private readonly leaves = Array.from({ length: 48 }, newAgent);
  private readonly mists = Array.from({ length: 26 }, newAgent);
  private readonly shafts = Array.from({ length: 10 }, newAgent);
  private readonly motes = Array.from({ length: 80 }, newAgent);
  private readonly mistMesh: THREE.InstancedMesh;
  private readonly shaftMesh: THREE.InstancedMesh;
  private readonly mistMat = billboardMaterial('mist');
  private readonly shaftMat = billboardMaterial('shaft');
  private readonly motePoints: THREE.Points;
  private readonly moteMat = fireflyMaterial(new THREE.Vector3(1, 0.95, 0.75), 160);

  private readonly butterflyMesh: THREE.InstancedMesh;
  private readonly birdMesh: THREE.InstancedMesh;
  private readonly dragonflyMesh: THREE.InstancedMesh;
  private readonly fishMesh: THREE.InstancedMesh;
  private readonly leafMesh: THREE.InstancedMesh;
  private readonly fireflyPoints: THREE.Points;
  private readonly fireflyMat: THREE.ShaderMaterial;
  private readonly mats: THREE.MeshBasicMaterial[] = [];

  private biome: Biome = 'meadow';
  private biomeTimer = 0;
  private seaBirds = false;
  private flock = { cx: 0, cz: 0, r: 30, h: 22, a: 0, speed: 0.12 };
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly col = new THREE.Color();
  private readonly sandBuf = new Float32Array(8);
  private rnd = Math.random;

  constructor(
    private readonly hf: Heightfield,
    private readonly eco: EcologyMap,
  ) {
    this.group.name = 'ambient-life';
    const mk = (geo: THREE.BufferGeometry, n: number, color: THREE.ColorRepresentation, name: string): THREE.InstancedMesh => {
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      this.mats.push(mat);
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.name = name;
      im.frustumCulled = false;
      im.count = 0;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // 不参与描边（EdgeDetect 用 alpha 标记）与阴影
      im.userData.outline = false;
      this.group.add(im);
      return im;
    };
    this.butterflyMesh = mk(wingGeometry(), this.butterflies.length, 0xffffff, 'butterflies');
    this.butterflyMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.birdMesh = mk(birdGeometry(), this.birds.length, 0xffffff, 'birds');
    this.birdMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.dragonflyMesh = mk(dragonflyGeometry(), this.dragonflies.length, '#4fb3c9', 'dragonflies');
    this.fishMesh = mk(fishGeometry(), this.fish.length, '#c9d6dc', 'fish');
    this.leafMesh = mk(leafGeometry(), this.leaves.length, 0xffffff, 'leaves');
    this.leafMesh.setColorAt(0, new THREE.Color(1, 1, 1));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.fireflies.length * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(Float32Array.from(this.fireflies, () => Math.random()), 1));
    this.fireflyMat = fireflyMaterial();
    this.fireflyPoints = new THREE.Points(geo, this.fireflyMat);
    this.fireflyPoints.frustumCulled = false;
    this.fireflyPoints.name = 'fireflies';
    this.group.add(this.fireflyPoints);

    const quad = new THREE.PlaneGeometry(1, 1);
    const mkFx = (mat: THREE.ShaderMaterial, n: number, name: string): THREE.InstancedMesh => {
      const im = new THREE.InstancedMesh(quad, mat, n);
      im.name = name;
      im.count = 0;
      im.frustumCulled = false;
      im.renderOrder = 5;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.userData.outline = false;
      this.group.add(im);
      return im;
    };
    this.mistMesh = mkFx(this.mistMat, this.mists.length, 'mist');
    this.shaftMesh = mkFx(this.shaftMat, this.shafts.length, 'light-shafts');
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.motes.length * 3), 3).setUsage(THREE.DynamicDrawUsage));
    mg.setAttribute('aPhase', new THREE.BufferAttribute(Float32Array.from(this.motes, () => Math.random()), 1));
    this.motePoints = new THREE.Points(mg, this.moteMat);
    this.motePoints.frustumCulled = false;
    this.motePoints.name = 'motes';
    this.group.add(this.motePoints);
  }

  /** 测试用：替换随机源 */
  setRandom(r: () => number): void {
    this.rnd = r;
  }

  /** 当前（玩家所在）生态，给音频 / 调试面板用 */
  get currentBiome(): Biome {
    return this.biome;
  }

  /** 活跃个体数（调试 / 单元测试） */
  counts(): Record<'butterflies' | 'fireflies' | 'birds' | 'dragonflies' | 'fish' | 'leaves', number> {
    const c = (a: Agent[]) => a.reduce((n, x) => n + (x.alive ? 1 : 0), 0);
    return { butterflies: c(this.butterflies), fireflies: c(this.fireflies), birds: c(this.birds), dragonflies: c(this.dragonflies), fish: c(this.fish), leaves: c(this.leaves) };
  }

  private biomeAt(x: number, z: number): Biome {
    if (!this.hf.inBounds(x, z)) return 'beach';
    this.hf.surfaceAt(x, z, this.sandBuf);
    return this.eco.biomeAt(x, z, this.sandBuf[SAND]!);
  }

  /** 在玩家周围 r0–r1 的环上随机取一个陆地点 */
  private ringPoint(px: number, pz: number, r0: number, r1: number, out: THREE.Vector3): boolean {
    const a = this.rnd() * Math.PI * 2;
    const r = r0 + this.rnd() * (r1 - r0);
    out.set(px + Math.cos(a) * r, 0, pz + Math.sin(a) * r);
    if (!this.hf.inBounds(out.x, out.z)) return false;
    out.y = this.hf.heightAt(out.x, out.z);
    return true;
  }

  update(dt: number, time: number, player: THREE.Vector3, env: AmbientEnv): void {
    const px = player.x;
    const pz = player.z;
    this.biomeTimer -= dt;
    if (this.biomeTimer <= 0) {
      this.biomeTimer = 0.75;
      this.biome = this.biomeAt(px, pz);
      this.seaBirds = SEA_BIRD_BIOMES.has(this.biome);
    }
    const day = 1 - env.night;
    const dryDay = day * (1 - env.rain);
    const light = 0.35 + env.light * 0.65;
    for (const m of this.mats) m.color.setScalar(1).multiplyScalar(light);
    this.mats[2]!.color.set('#4fb3c9').multiplyScalar(light);
    this.mats[3]!.color.set('#c9d6dc').multiplyScalar(light);

    this.updateButterflies(dt, time, px, pz, FLUTTER_BIOMES.has(this.biome) && dryDay > 0.5 ? (this.biome === 'cliff' ? 6 : this.butterflies.length) : 0);
    this.updateFireflies(dt, time, px, pz, env.night > 0.55 && env.rain < 0.4 ? Math.round(this.fireflies.length * (FIREFLY_BIOMES[this.biome] ?? 0)) : 0, env);
    this.updateBirds(dt, time, px, pz, dryDay > 0.4 ? (this.seaBirds ? 9 : 7) : 0);
    this.updateDragonflies(dt, time, px, pz, dryDay > 0.5 && (this.biome === 'wetland' || this.biome === 'riverine') ? this.dragonflies.length : 0);
    this.updateFish(dt, px, pz, day > 0.2 && (this.biome === 'wetland' || this.biome === 'riverine'));
    this.updateLeaves(dt, time, px, pz, Math.round(this.leaves.length * (LEAF_BIOMES[this.biome] ?? 0) * (0.6 + env.wind * 0.6)), env);
    this.updateMist(dt, time, px, pz, env, light);
    this.updateShafts(dt, time, px, pz, env);
    this.updateMotes(dt, time, px, pz, env);
  }

  // ———————————————————— 贴地薄雾 ————————————————————
  private updateMist(dt: number, time: number, px: number, pz: number, env: AmbientEnv, light: number): void {
    const cfg = MIST[this.biome];
    // 雨后 / 雨中到处起一点雾
    const density = Math.min(0.6, (cfg ? cfg.day + (cfg.night - cfg.day) * env.night : 0) + env.rain * 0.12);
    const want = Math.round(this.mists.length * Math.min(1, density * 2.2));
    const lakeOnly = this.biome === 'wetland' || this.biome === 'riverine';
    let alive = 0;
    for (const m of this.mists) if (m.alive) alive++;
    const im = this.mistMesh;
    let n = 0;
    for (const m of this.mists) {
      if (!m.alive) {
        if (alive >= want || this.rnd() > dt * 6 || !this.ringPoint(px, pz, 6, 38, m.p)) continue;
        const w = this.hf.waterAt(m.p.x, m.p.z);
        if (w?.body === 'sea') continue;
        // 湖畔 / 河谷的雾只贴着水面
        if (lakeOnly && !w) continue;
        m.alive = true;
        alive++;
        m.p.y = (w ? w.level : m.p.y) + 0.5 + this.rnd() * 0.9;
        m.scale = 6 + this.rnd() * 6;
        m.life = 0;
        m.timer = 18 + this.rnd() * 20;
        m.phase = this.rnd() * 10;
      }
      m.life += dt;
      m.p.x += env.windX * (0.25 + env.wind * 0.3) * dt;
      m.p.z += env.windZ * (0.25 + env.wind * 0.3) * dt;
      const dx = m.p.x - px;
      const dz = m.p.z - pz;
      // 生命周期两端渐变（缩放代替 alpha，避免逐实例透明度）
      const fadeIn = Math.min(1, m.life / 4);
      const fadeOut = Math.min(1, (m.timer - m.life) / 4);
      if (fadeOut <= 0 || dx * dx + dz * dz > 50 * 50) {
        m.alive = false;
        continue;
      }
      const k = Math.max(0.01, Math.min(fadeIn, fadeOut)) * (0.92 + Math.sin(time * 0.2 + m.phase) * 0.08);
      this.m.compose(m.p, this.q.identity(), this.s.set(m.scale * k, m.scale * 0.42 * k, 1));
      im.setMatrixAt(n++, this.m);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    const u = this.mistMat.uniforms;
    u.uAlpha!.value += (Math.min(0.55, density * 1.1) - (u.uAlpha!.value as number)) * Math.min(1, dt * 0.5);
    (u.uColor!.value as THREE.Color).setRGB(0.86, 0.9, 0.93).multiplyScalar(0.25 + light * 0.75);
    if (this.biome === 'mistwood') (u.uColor!.value as THREE.Color).lerp(new THREE.Color(0.72, 0.68, 0.9).multiplyScalar(0.25 + light * 0.75), 0.35);
    u.uTime!.value = time;
    im.visible = n > 0;
  }

  // ———————————————————— 林间光柱（丁达尔效应） ————————————————————
  private updateShafts(dt: number, time: number, px: number, pz: number, env: AmbientEnv): void {
    const sun = env.sunDir;
    const on = !!sun && sun.y > 0.18 && env.night < 0.3 && env.rain < 0.3 && (this.biome === 'mistwood' || this.biome === 'meadow');
    const want = on ? (this.biome === 'mistwood' ? this.shafts.length : 3) : 0;
    let alive = 0;
    for (const sh of this.shafts) if (sh.alive) alive++;
    const im = this.shaftMesh;
    let n = 0;
    for (const sh of this.shafts) {
      if (!sh.alive) {
        if (alive >= want || this.rnd() > dt * 2 || !this.ringPoint(px, pz, 5, 26, sh.p)) continue;
        if (this.hf.waterAt(sh.p.x, sh.p.z)) continue;
        this.hf.surfaceAt(sh.p.x, sh.p.z, this.sandBuf);
        // 光柱只从林冠缝隙落下：要求有森林地表
        if ((this.sandBuf[1] ?? 0) < 0.3) continue;
        sh.alive = true;
        alive++;
        sh.scale = 1 + this.rnd() * 1.6;
        sh.life = 0;
        sh.timer = 14 + this.rnd() * 16;
        sh.phase = this.rnd() * 10;
      }
      sh.life += dt;
      const dx = sh.p.x - px;
      const dz = sh.p.z - pz;
      if (sh.life > sh.timer || dx * dx + dz * dz > 40 * 40 || (!on && this.rnd() < dt)) {
        sh.alive = false;
        continue;
      }
      const len = 16;
      const d = sun ?? this.tmp.set(0, 1, 0);
      this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.tmp.copy(d).normalize());
      const k = Math.min(1, sh.life / 3, (sh.timer - sh.life) / 3);
      const c = new THREE.Vector3(sh.p.x, sh.p.y, sh.p.z).addScaledVector(this.tmp, len * 0.5);
      this.m.compose(c, this.q, this.s.set(sh.scale * Math.max(0.01, k), len, 1));
      im.setMatrixAt(n++, this.m);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    const u = this.shaftMat.uniforms;
    const target = on ? (this.biome === 'mistwood' ? 0.16 : 0.07) * Math.min(1, (sun!.y - 0.18) * 4) : 0;
    u.uAlpha!.value += (target - (u.uAlpha!.value as number)) * Math.min(1, dt * 0.6);
    (u.uColor!.value as THREE.Color).setRGB(1, 0.92, 0.7);
    u.uTime!.value = time;
    im.visible = n > 0 && (u.uAlpha!.value as number) > 0.003;
  }

  // ———————————————————— 阳光里的飘尘 / 花粉 ————————————————————
  private updateMotes(dt: number, time: number, px: number, pz: number, env: AmbientEnv): void {
    const pos = this.motePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const day = env.night < 0.35 && env.rain < 0.3;
    const want = day ? Math.round(this.motes.length * (MOTES[this.biome] ?? 0)) : 0;
    let alive = 0;
    for (const m of this.motes) if (m.alive) alive++;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i]!;
      if (!m.alive) {
        if (alive < want && this.rnd() < dt * 10 && this.ringPoint(px, pz, 1.5, 14, m.t)) {
          m.alive = true;
          alive++;
          m.t.y += 0.4 + this.rnd() * 3;
          m.phase = this.rnd() * 100;
          m.life = 0;
        } else {
          pos.setXYZ(i, 0, -9999, 0);
          continue;
        }
      }
      m.life += dt;
      const t = time * 0.25 + m.phase;
      m.t.x += env.windX * env.wind * 0.25 * dt;
      m.t.z += env.windZ * env.wind * 0.25 * dt;
      m.p.set(m.t.x + Math.sin(t * 1.3) * 0.5, m.t.y + Math.sin(t * 0.9) * 0.35, m.t.z + Math.cos(t * 1.1) * 0.5);
      const dx = m.p.x - px;
      const dz = m.p.z - pz;
      if (dx * dx + dz * dz > 20 * 20 || m.life > 25 || (alive > want && this.rnd() < dt)) {
        m.alive = false;
        alive--;
        pos.setXYZ(i, 0, -9999, 0);
        continue;
      }
      pos.setXYZ(i, m.p.x, m.p.y, m.p.z);
    }
    pos.needsUpdate = true;
    this.moteMat.uniforms.uTime!.value = time;
    const a = this.moteMat.uniforms.uAlpha!;
    a.value += ((want > 0 ? 0.55 : 0) - (a.value as number)) * Math.min(1, dt * 0.7);
    this.motePoints.visible = (a.value as number) > 0.01;
  }

  // ———————————————————— 蝴蝶 ————————————————————
  private updateButterflies(dt: number, time: number, px: number, pz: number, want: number): void {
    let alive = 0;
    for (const b of this.butterflies) if (b.alive) alive++;
    const im = this.butterflyMesh;
    let n = 0;
    for (let i = 0; i < this.butterflies.length; i++) {
      const b = this.butterflies[i]!;
      if (!b.alive) {
        if (alive < want && this.rnd() < dt * 3 && this.ringPoint(px, pz, 6, 26, b.p)) {
          b.alive = true;
          alive++;
          b.p.y += 0.8 + this.rnd();
          b.t.copy(b.p);
          b.v.set(0, 0, 0);
          b.phase = this.rnd() * 10;
          b.timer = 0;
          b.scale = 0.09 + this.rnd() * 0.05;
          b.life = 0;
        } else continue;
      }
      b.life += dt;
      b.timer -= dt;
      // 换目标：附近的一个低空点；有时落地停歇
      if (b.timer <= 0) {
        b.timer = 1.5 + this.rnd() * 3;
        const g = this.hf.inBounds(b.p.x, b.p.z) ? this.hf.heightAt(b.p.x, b.p.z) : b.p.y;
        const rest = this.rnd() < 0.2;
        b.t.set(b.p.x + (this.rnd() - 0.5) * 6, g + (rest ? 0.25 : 0.5 + this.rnd() * 1.6), b.p.z + (this.rnd() - 0.5) * 6);
      }
      const resting = b.p.distanceTo(b.t) < 0.15 && b.t.y - (this.hf.inBounds(b.t.x, b.t.z) ? this.hf.heightAt(b.t.x, b.t.z) : 0) < 0.35;
      this.tmp.copy(b.t).sub(b.p);
      b.v.addScaledVector(this.tmp, dt * 2.2).multiplyScalar(1 - dt * 1.8);
      // 蝴蝶特有的上下颠簸
      b.v.y += Math.sin(time * 9 + b.phase) * dt * 2.2;
      b.p.addScaledVector(b.v, dt);
      const dx = b.p.x - px;
      const dz = b.p.z - pz;
      if (dx * dx + dz * dz > 40 * 40 || (want === 0 && b.life > 0.5 && this.rnd() < dt)) {
        b.alive = false;
        continue;
      }
      const flap = resting ? 0.25 + Math.abs(Math.sin(time * 1.5 + b.phase)) * 0.2 : 0.15 + Math.abs(Math.cos(time * 16 + b.phase)) * 0.85;
      this.e.set(0, Math.atan2(b.v.x, b.v.z), 0);
      this.q.setFromEuler(this.e);
      this.m.compose(b.p, this.q, this.s.set(b.scale * flap, b.scale, b.scale));
      im.setMatrixAt(n, this.m);
      im.setColorAt(n, BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]!);
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ———————————————————— 萤火虫 ————————————————————
  private updateFireflies(dt: number, time: number, px: number, pz: number, want: number, env: AmbientEnv): void {
    const pos = this.fireflyPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    let alive = 0;
    for (const f of this.fireflies) if (f.alive) alive++;
    for (let i = 0; i < this.fireflies.length; i++) {
      const f = this.fireflies[i]!;
      if (!f.alive) {
        if (alive < want && this.rnd() < dt * 8 && this.ringPoint(px, pz, 3, 30, f.p)) {
          if (this.hf.waterAt(f.p.x, f.p.z)?.body === 'sea') continue;
          f.alive = true;
          alive++;
          f.t.copy(f.p);
          f.p.y += 0.3 + this.rnd() * 2.2;
          f.phase = this.rnd() * 100;
        } else {
          pos.setXYZ(i, 0, -9999, 0);
          continue;
        }
      }
      // 缓慢的三维正弦漂移，绕出生点
      const t = time * 0.35 + f.phase;
      f.p.x = f.t.x + Math.sin(t * 1.1) * 1.6 + Math.sin(t * 2.3) * 0.4;
      f.p.z = f.t.z + Math.cos(t * 0.9) * 1.6 + Math.cos(t * 1.7) * 0.4;
      f.p.y = f.t.y + 0.5 + Math.sin(t * 0.7) * 0.8 + 0.8 + Math.sin(t * 3.1) * 0.15 + env.wind * 0.1;
      const dx = f.p.x - px;
      const dz = f.p.z - pz;
      if (dx * dx + dz * dz > 42 * 42 || (alive > want && this.rnd() < dt * 0.5)) {
        f.alive = false;
        alive--;
        pos.setXYZ(i, 0, -9999, 0);
        continue;
      }
      pos.setXYZ(i, f.p.x, f.p.y, f.p.z);
    }
    pos.needsUpdate = true;
    this.fireflyMat.uniforms.uTime!.value = time;
    const target = want > 0 ? Math.min(1, (env.night - 0.55) / 0.25) : 0;
    const a = this.fireflyMat.uniforms.uAlpha!;
    a.value += (target - (a.value as number)) * Math.min(1, dt * 0.8);
    this.fireflyPoints.visible = (a.value as number) > 0.01;
  }

  // ———————————————————— 鸟群 / 海鸥 ————————————————————
  private updateBirds(dt: number, time: number, px: number, pz: number, want: number): void {
    const F = this.flock;
    // 鸟群中心慢慢追随玩家（滞后很多，像是在远处盘旋）
    const dist = Math.hypot(F.cx - px, F.cz - pz);
    if (dist > 90) {
      F.cx = px + (this.rnd() - 0.5) * 60;
      F.cz = pz + (this.rnd() - 0.5) * 60;
    } else {
      F.cx += (px - F.cx) * dt * 0.03;
      F.cz += (pz - F.cz) * dt * 0.03;
    }
    F.r = this.seaBirds ? 26 : 34;
    F.speed = this.seaBirds ? 0.09 : 0.16;
    F.a += dt * F.speed;
    const ground = this.hf.inBounds(F.cx, F.cz) ? Math.max(this.hf.config.seaLevel, this.hf.heightAt(F.cx, F.cz)) : this.hf.config.seaLevel;
    F.h = ground + (this.seaBirds ? 14 : 24);
    const im = this.birdMesh;
    const col = this.seaBirds ? new THREE.Color('#f4f6f8') : new THREE.Color('#3d3a40');
    let n = 0;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i]!;
      if (i >= want) {
        b.alive = false;
        continue;
      }
      if (!b.alive) {
        b.alive = true;
        b.phase = this.rnd() * Math.PI * 2;
        b.scale = (this.seaBirds ? 0.55 : 0.32) * (0.85 + this.rnd() * 0.3);
        b.t.set((this.rnd() - 0.5) * 8, (this.rnd() - 0.5) * 3, (this.rnd() - 0.5) * 8);
      }
      // 每只鸟沿盘旋圆有自己的偏移，海鸥各自独立绕圈
      const a = F.a * (this.seaBirds ? 0.7 + (i % 3) * 0.25 : 1) + (this.seaBirds ? b.phase : i * 0.11);
      const rr = F.r + b.t.x;
      b.p.set(F.cx + Math.cos(a) * rr + b.t.z * 0.3, F.h + b.t.y + Math.sin(time * 0.5 + b.phase) * 1.2, F.cz + Math.sin(a) * rr);
      const yaw = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI;
      // 扇翅：小鸟连续快速扇动，海鸥长时间滑翔
      const glide = this.seaBirds ? Math.max(0, Math.sin(time * 0.6 + b.phase)) : 0;
      const flap = Math.sin(time * (this.seaBirds ? 5 : 11) + b.phase) * (1 - glide);
      this.e.set(0, yaw, (this.seaBirds ? 0.3 : 0.15) * Math.sign(F.speed));
      this.q.setFromEuler(this.e);
      this.m.compose(b.p, this.q, this.s.set(b.scale, b.scale * (0.2 + flap * 1.6), b.scale));
      im.setMatrixAt(n, this.m);
      im.setColorAt(n, col);
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ———————————————————— 蜻蜓 ————————————————————
  private updateDragonflies(dt: number, time: number, px: number, pz: number, want: number): void {
    const im = this.dragonflyMesh;
    let alive = 0;
    for (const d of this.dragonflies) if (d.alive) alive++;
    let n = 0;
    for (const d of this.dragonflies) {
      if (!d.alive) {
        if (alive < want && this.rnd() < dt * 2 && this.ringPoint(px, pz, 4, 22, d.p)) {
          // 只在淡水边出现
          const near = [1.5, 3].some((r) => [0, 1, 2, 3].some((k) => {
            const w = this.hf.waterAt(d.p.x + Math.cos(k * 1.57) * r, d.p.z + Math.sin(k * 1.57) * r);
            return !!w && w.body !== 'sea';
          }));
          if (!near) continue;
          d.alive = true;
          alive++;
          d.p.y += 0.6 + this.rnd() * 0.8;
          d.t.copy(d.p);
          d.timer = 0;
          d.life = 0;
          d.phase = this.rnd() * 10;
        } else continue;
      }
      d.life += dt;
      d.timer -= dt;
      if (d.timer <= 0) {
        // 悬停一会儿，然后急冲到附近另一点
        d.timer = 0.6 + this.rnd() * 1.8;
        const g = this.hf.inBounds(d.p.x, d.p.z) ? this.hf.heightAt(d.p.x, d.p.z) : d.p.y;
        const w = this.hf.waterAt(d.p.x, d.p.z);
        d.t.set(d.p.x + (this.rnd() - 0.5) * 5, Math.max(g, w?.level ?? g) + 0.4 + this.rnd() * 0.9, d.p.z + (this.rnd() - 0.5) * 5);
      }
      d.p.lerp(d.t, 1 - Math.exp(-dt * 7));
      d.p.y += Math.sin(time * 6 + d.phase) * 0.004;
      const dx = d.p.x - px;
      const dz = d.p.z - pz;
      if (dx * dx + dz * dz > 34 * 34 || (want === 0 && d.life > 0.5)) {
        d.alive = false;
        continue;
      }
      this.tmp.copy(d.t).sub(d.p);
      this.e.set(0, Math.atan2(this.tmp.x, this.tmp.z), 0);
      this.q.setFromEuler(this.e);
      const buzz = 0.8 + Math.abs(Math.sin(time * 60 + d.phase)) * 0.2;
      this.m.compose(d.p, this.q, this.s.set(buzz, 1, 1));
      im.setMatrixAt(n++, this.m);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  }

  // ———————————————————— 跃鱼 ————————————————————
  private updateFish(dt: number, px: number, pz: number, active: boolean): void {
    const im = this.fishMesh;
    let n = 0;
    for (const f of this.fish) {
      if (!f.alive) {
        if (!active || this.rnd() > dt * 0.35) continue;
        if (!this.ringPoint(px, pz, 6, 28, f.p)) continue;
        const w = this.hf.waterAt(f.p.x, f.p.z);
        if (!w || w.body === 'sea' || w.depth < 0.8) continue;
        f.alive = true;
        f.p.y = w.level - 0.1;
        f.t.y = w.level;
        f.life = 0;
        const a = this.rnd() * Math.PI * 2;
        f.v.set(Math.cos(a) * 1.4, 3.2 + this.rnd() * 1.2, Math.sin(a) * 1.4);
        f.scale = 0.8 + this.rnd() * 0.6;
      }
      f.life += dt;
      f.v.y -= 9.8 * dt;
      f.p.addScaledVector(f.v, dt);
      if (f.p.y < f.t.y - 0.3 && f.v.y < 0) {
        f.alive = false;
        continue;
      }
      // 身体沿速度方向（抛物线切线）
      this.tmp.copy(f.v).normalize();
      this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.tmp);
      this.m.compose(f.p, this.q, this.s.setScalar(f.scale));
      im.setMatrixAt(n++, this.m);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  }

  // ———————————————————— 落叶 / 花瓣 ————————————————————
  private updateLeaves(dt: number, time: number, px: number, pz: number, want: number, env: AmbientEnv): void {
    const im = this.leafMesh;
    const petals = this.biome === 'village';
    let alive = 0;
    for (const l of this.leaves) if (l.alive) alive++;
    let n = 0;
    for (let i = 0; i < this.leaves.length; i++) {
      const l = this.leaves[i]!;
      if (!l.alive) {
        if (alive < want && this.rnd() < dt * 4 && this.ringPoint(px, pz, 2, 18, l.p)) {
          if (this.hf.waterAt(l.p.x, l.p.z)) continue;
          l.alive = true;
          alive++;
          l.t.y = l.p.y; // 地面高度
          l.p.y += 3.5 + this.rnd() * 3.5;
          l.phase = this.rnd() * 10;
          l.scale = 0.8 + this.rnd() * 0.6;
          l.life = 0;
          const c = petals ? new THREE.Color().setHSL(0.93 + this.rnd() * 0.04, 0.8, 0.85) : new THREE.Color().setHSL(0.06 + this.rnd() * 0.1, 0.65, 0.42 + this.rnd() * 0.15);
          l.v.set(c.r, c.g, c.b); // 记住颜色，紧凑写入时按槽位重设
        } else continue;
      }
      l.life += dt;
      const fall = 0.55 + Math.sin(time * 2 + l.phase) * 0.25;
      l.p.y -= fall * dt;
      l.p.x += (env.windX * env.wind * 1.2 + Math.sin(time * 1.3 + l.phase) * 0.6) * dt;
      l.p.z += (env.windZ * env.wind * 1.2 + Math.cos(time * 1.1 + l.phase) * 0.6) * dt;
      // 落地后躺几秒再消失
      if (l.p.y <= l.t.y + 0.02) {
        l.p.y = l.t.y + 0.02;
        l.timer += dt;
        if (l.timer > 3) {
          l.alive = false;
          l.timer = 0;
          continue;
        }
      }
      const grounded = l.p.y <= l.t.y + 0.03;
      this.e.set(grounded ? 0 : Math.sin(time * 3 + l.phase) * 1.1, l.phase + time * (grounded ? 0 : 1.5), grounded ? 0 : Math.cos(time * 2.5 + l.phase) * 0.9);
      this.q.setFromEuler(this.e);
      this.m.compose(l.p, this.q, this.s.setScalar(l.scale * (petals ? 0.8 : 1.4)));
      im.setMatrixAt(n, this.m);
      im.setColorAt(n, this.col.setRGB(l.v.x, l.v.y, l.v.z));
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const o of [this.butterflyMesh, this.birdMesh, this.dragonflyMesh, this.fishMesh, this.leafMesh]) {
      o.geometry.dispose();
      o.dispose();
    }
    for (const m of this.mats) m.dispose();
    this.fireflyPoints.geometry.dispose();
    this.fireflyMat.dispose();
    this.mistMesh.geometry.dispose();
    this.mistMesh.dispose();
    this.shaftMesh.dispose();
    this.mistMat.dispose();
    this.shaftMat.dispose();
    this.motePoints.geometry.dispose();
    this.moteMat.dispose();
  }
}

/**
 * M3-19 · 大地图瀑布的场景表现（世界层）。逻辑见 scenes/common/SceneWaterfall.ts，地形见 scripts/lib/falls.ts。
 *
 * 每座瀑布：
 * - 瀑口：泉池到石台边缘的一段流水（条纹滚动）+ 缺口两侧的岩块；
 * - 水幕：从瀑口斜挂到瀑潭的两层水幕（错速向下滚动，上窄下宽、略向外鼓），水幕两侧再挂两条细流；
 * - 瀑潭：白色浪花圈（脉动）+ 多层水雾（缓缓上升、淡出循环）+ 飞溅水珠（Points，抛物线循环）；
 * - 台顶：瀑顶石匣（古代石匣 + 刻纹盖板 + 石堆路标），带碰撞。
 * 只做显示（水面判定在 Heightfield.waterAt，石台崖壁就是地形）。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';
import type { PoiConfig, WaterfallConfig } from '@/config/islands/types';
import type { CollisionWorld } from '@/world/collision/CollisionWorld';

type HeightFn = (x: number, z: number) => number;

interface Flow {
  tex: THREE.Texture;
  speed: number;
}
interface Mist {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  phase: number;
  base: THREE.Vector3;
  rise: number;
}
interface Spray {
  points: THREE.Points;
  seeds: Float32Array;
  origin: THREE.Vector3;
  dir: THREE.Vector2;
}

let stripeTex: THREE.DataTexture | null = null;
let puffTex: THREE.DataTexture | null = null;

/** 竖向水流条纹（亮暗相间 + 噪点），供水幕 / 瀑口流水滚动 */
function stripeTexture(): THREE.DataTexture {
  if (stripeTex) return stripeTex;
  const W = 64;
  const H = 128;
  const data = new Uint8Array(W * H * 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = Array.from({ length: W }, () => 0.55 + rnd() * 0.45);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const streak = cols[x]! * (0.75 + 0.25 * Math.sin((y / H) * Math.PI * 6 + x * 0.7));
      const foam = rnd() < 0.04 ? 1 : 0;
      const v = Math.min(1, streak + foam * 0.5);
      const k = (y * W + x) * 4;
      data[k] = 255;
      data[k + 1] = 255;
      data[k + 2] = 255;
      data[k + 3] = Math.round(v * 255);
    }
  stripeTex = new THREE.DataTexture(data, W, H);
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.magFilter = THREE.LinearFilter;
  stripeTex.minFilter = THREE.LinearFilter;
  stripeTex.needsUpdate = true;
  return stripeTex;
}

/** 柔和的圆形雾团 */
function puffTexture(): THREE.DataTexture {
  if (puffTex) return puffTex;
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5) / (S / 2);
      const a = Math.max(0, 1 - d) ** 1.8;
      const k = (y * S + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(a * 255);
    }
  puffTex = new THREE.DataTexture(data, S, S);
  puffTex.magFilter = THREE.LinearFilter;
  puffTex.minFilter = THREE.LinearFilter;
  puffTex.needsUpdate = true;
  return puffTex;
}

export class Waterfalls {
  readonly group = new THREE.Group();
  private flows: Flow[] = [];
  private mists: Mist[] = [];
  private foams: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  private sprays: Spray[] = [];
  private mats: THREE.Material[] = [];
  private texes: THREE.Texture[] = [];
  private time = 0;

  constructor(
    falls: readonly WaterfallConfig[],
    private readonly heightAt: HeightFn,
    private readonly caches: readonly PoiConfig[] = [],
    private readonly collision: CollisionWorld | null = null,
  ) {
    this.group.name = 'waterfalls';
    for (const f of falls) this.group.add(this.buildFall(f));
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const f of this.flows) f.tex.offset.y = (f.tex.offset.y + f.speed * dt) % 1;
    for (const m of this.mists) {
      const k = (t * 0.22 + m.phase) % 1;
      m.mesh.position.set(m.base.x, m.base.y + k * m.rise, m.base.z);
      const s = 2.2 + k * 3.2;
      m.mesh.scale.set(s, s, s);
      m.mat.opacity = 0.42 * Math.sin(k * Math.PI);
    }
    for (const f of this.foams) {
      const s = 1 + Math.sin(t * 3.1 + f.phase) * 0.06;
      f.mesh.scale.set(s, 1, s);
      f.mesh.rotation.y += dt * 0.25;
    }
    for (const sp of this.sprays) {
      const pos = sp.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const n = pos.count;
      for (let i = 0; i < n; i++) {
        const seed = sp.seeds[i]!;
        const k = (t * (0.8 + (seed % 0.37)) + seed) % 1;
        const ang = seed * 37.0;
        const spread = 0.6 + (seed * 7.3) % 1.4;
        const r = spread * k * 2.2;
        const dx = Math.cos(ang) * r + sp.dir.x * k * 1.5;
        const dz = Math.sin(ang) * r + sp.dir.y * k * 1.5;
        const y = 4.2 * k - 6.5 * k * k;
        pos.setXYZ(i, sp.origin.x + dx, sp.origin.y + Math.max(-0.2, y), sp.origin.z + dz);
      }
      pos.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    for (const m of this.mats) m.dispose();
    for (const t of this.texes) t.dispose();
    this.mats = [];
    this.texes = [];
    for (const c of this.caches) this.collision?.removeGroup(`waterfall-cache:${c.id}`);
  }

  private toon(color: string, extra: NonNullable<Parameters<typeof createToonMaterial>[0]> = {}): THREE.MeshToonMaterial {
    const m = createToonMaterial({ kind: 'scene', color, ...extra });
    this.mats.push(m);
    return m;
  }

  private flowMat(color: string, opacity: number, repeatX: number, repeatY: number, speed: number): THREE.MeshBasicMaterial {
    const tex = stripeTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(repeatX, repeatY);
    this.texes.push(tex);
    this.flows.push({ tex, speed });
    const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.mats.push(m);
    return m;
  }

  private buildFall(f: WaterfallConfig): THREE.Group {
    const g = new THREE.Group();
    g.name = `waterfall:${f.id}`;
    const [cx, cz] = f.mesa.center;
    const dl = Math.hypot(f.base[0] - cx, f.base[1] - cz) || 1;
    const dx = (f.base[0] - cx) / dl;
    const dz = (f.base[1] - cz) / dl;
    // 局部坐标：原点 = 瀑口，+Z = 向瀑潭（外），+X = 横向
    const yaw = Math.atan2(dx, dz);
    const local = new THREE.Group();
    local.position.set(f.lip[0], 0, f.lip[1]);
    local.rotation.y = yaw;
    g.add(local);
    const drop = f.topLevel - f.baseLevel;
    const w = f.width;

    // —— 水幕：从瀑口（台面边缘）斜挂到崖脚，上窄下宽、向外鼓 ——
    const sheetGeo = (width: number, out0: number, out1: number, bulge: number): THREE.BufferGeometry => {
      const segY = 16;
      const segX = 6;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= segY; j++) {
        const v = j / segY; // 0 = 顶
        const y = f.topLevel + 0.05 - drop * v;
        const z = out0 + (out1 - out0) * v + Math.sin(v * Math.PI) * bulge + (v < 0.12 ? (0.12 - v) * 3 : 0) * 0.5;
        const ww = width * (1 + v * 0.35);
        for (let i = 0; i <= segX; i++) {
          const u = i / segX;
          pos.push((u - 0.5) * ww, y, z + Math.cos((u - 0.5) * Math.PI) * 0.25);
          uv.push(u, 1 - v * (drop / 6));
        }
      }
      for (let j = 0; j < segY; j++)
        for (let i = 0; i < segX; i++) {
          const a = j * (segX + 1) + i;
          idx.push(a, a + segX + 1, a + 1, a + 1, a + segX + 1, a + segX + 2);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };
    const back = new THREE.Mesh(sheetGeo(w, 0.3, 3.2, 0.6), this.flowMat('#7fc8ee', 0.85, Math.max(1, w / 1.4), 1, 1.1));
    back.renderOrder = 3;
    local.add(back);
    const front = new THREE.Mesh(sheetGeo(w * 0.92, 0.55, 3.5, 0.75), this.flowMat('#e8f8ff', 0.55, Math.max(1, w / 1.1), 1.4, 1.7));
    front.renderOrder = 4;
    local.add(front);
    for (const side of [-1, 1]) {
      const thin = new THREE.Mesh(sheetGeo(0.7, 0.25, 3.0, 0.4), this.flowMat('#cdeefe', 0.6, 1, 1, 1.4));
      thin.position.x = side * (w / 2 + 0.9);
      thin.renderOrder = 3;
      local.add(thin);
    }
    // —— 瀑口：泉池到台缘的流水 ——
    const poolEdge = Math.hypot(f.pool.center[0] - f.lip[0], f.pool.center[1] - f.lip[1]) - f.pool.radius * 0.9;
    if (poolEdge > 0.2) {
      const chute = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, poolEdge + 0.6, 4, 4).rotateX(-Math.PI / 2), this.flowMat('#9fdaf5', 0.8, Math.max(1, w / 1.5), 1, 0.9));
      chute.position.set(0, f.topLevel + 0.03, -poolEdge / 2 + 0.25);
      chute.renderOrder = 3;
      local.add(chute);
    }
    // 缺口两侧的岩块
    const rockMat = this.toon('#6a645c');
    const rockMat2 = this.toon('#57514a');
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const s = 0.6 + ((i * 37) % 7) * 0.12;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 3 ? rockMat : rockMat2);
      r.position.set(side * (w / 2 + 0.6 + (i % 3) * 0.5), f.topLevel + 0.1 + (i % 2) * 0.2, -0.6 + Math.floor(i / 2) * 0.35);
      r.rotation.set(i, i * 1.7, 0);
      r.castShadow = true;
      local.add(r);
    }

    // —— 瀑潭：浪花圈 + 水雾 + 飞溅 ——
    const foot = new THREE.Vector3(f.lip[0] + dx * 3.2, f.baseLevel + 0.05, f.lip[1] + dz * 3.2);
    const foamMat = this.flowMat('#ffffff', 0.7, 3, 1, 0.35);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6 + i * 0.9, 1.4 + i * 1.1, 28, 1).rotateX(-Math.PI / 2), foamMat);
      ring.position.copy(foot).setY(f.baseLevel + 0.06 + i * 0.01);
      ring.renderOrder = 5;
      g.add(ring);
      this.foams.push({ mesh: ring, phase: i * 1.7 });
    }
    const puff = puffTexture();
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: puff, color: '#f4fbff', transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
      this.mats.push(mat);
      const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      sprite.onBeforeRender = (_r, _s, cam) => sprite.quaternion.copy(cam.quaternion);
      const a = (i / 7) * Math.PI * 2;
      const base = foot.clone().add(new THREE.Vector3(Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4));
      sprite.renderOrder = 6;
      g.add(sprite);
      this.mists.push({ mesh: sprite, mat, phase: i / 7, base, rise: 3 + (i % 3) });
    }
    const n = 90;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const pm = new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, transparent: true, opacity: 0.85, depthWrite: false });
    this.mats.push(pm);
    const pts = new THREE.Points(geo, pm);
    pts.frustumCulled = false;
    g.add(pts);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = (i * 0.618034) % 1;
    this.sprays.push({ points: pts, seeds, origin: foot.clone(), dir: new THREE.Vector2(dx, dz) });

    // —— 瀑顶石匣 ——
    for (const c of this.caches.filter((q) => q.id.startsWith(f.id))) {
      const [x, , z] = c.position;
      const y = this.heightAt(x, z);
      const box = new THREE.Group();
      box.position.set(x, y, z);
      box.rotation.y = yaw + 0.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), this.toon('#7a7468'));
      body.position.y = 0.3;
      body.castShadow = true;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.85), this.toon('#8a8478'));
      lid.position.y = 0.68;
      const glyph = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 20).rotateX(Math.PI / 2), this.toon('#5fc8ff', { emissive: '#2a8ac8', emissiveIntensity: 0.6 }));
      glyph.position.y = 0.77;
      box.add(body, lid, glyph);
      // 石堆路标
      for (let i = 0; i < 4; i++) {
        const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 - i * 0.06, 0), rockMat);
        st.position.set(1.3, 0.25 + i * 0.4, -0.4);
        st.rotation.set(i, i * 2, 0);
        box.add(st);
      }
      g.add(box);
      this.collision?.add(`waterfall-cache:${c.id}`, { kind: 'circle', x, z, r: 0.75, y0: y - 1, y1: y + 0.9 });
    }
    return g;
  }
}

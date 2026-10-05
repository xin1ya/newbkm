/**
 * ACT-001 / ART-001 · 程序化训练家模型（手工模型到位前的样张角色）。
 * 约 1.6 m：帽子、头发、脸、外套、背包、手臂、腿、鞋；Toon 材质 + 反向外壳描边。
 * 骨骼用 Object3D 层级模拟（hip / spine / head / arm.L / arm.R / leg.L / leg.R），
 * 与 docs/art/model-spec.md 的骨骼命名一致，方便以后替换为 glb 时复用动画逻辑。
 */
import * as THREE from 'three';
import { addHullOutlines, createToonMaterial } from '@/render';
import type { TrainerExtraPalette, TrainerPalette, TrainerStyle } from '@/systems/npcs/types';

export type { TrainerExtraPalette, TrainerPalette, TrainerStyle };


export const DEFAULT_TRAINER: TrainerPalette = {
  skin: '#ffd9bd',
  hair: '#3b2b2a',
  cap: '#e8484a',
  capBrim: '#ffffff',
  jacket: '#3d8fd9',
  shirt: '#fbf6ee',
  pants: '#2f3a5a',
  shoes: '#e8484a',
  bag: '#f2b541',
};


export const PLAYER_STYLE: TrainerStyle = {
  hat: 'cap',
  hair: 'short',
  bag: true,
  coat: 'short',
  apron: false,
  cane: false,
  beard: false,
  glasses: false,
  scale: 1,
  stoop: 0,
};


export class TrainerModel {
  readonly root = new THREE.Group();
  readonly bones: Record<'hip' | 'spine' | 'head' | 'armL' | 'armR' | 'legL' | 'legR', THREE.Group>;
  private phase = 0;
  private blend = 0;

  readonly style: TrainerStyle;

  constructor(pal: TrainerPalette = DEFAULT_TRAINER, styleIn: Partial<TrainerStyle> = {}, extra: TrainerExtraPalette = {}) {
    const style = (this.style = { ...PLAYER_STYLE, ...styleIn });
    const mat = (c: string, rim = true) => createToonMaterial({ color: c, kind: 'character', rim, specular: rim });
    const M = {
      skin: mat(pal.skin),
      hair: mat(pal.hair),
      cap: mat(pal.cap),
      brim: mat(pal.capBrim),
      jacket: mat(pal.jacket),
      shirt: mat(pal.shirt),
      pants: mat(pal.pants),
      shoes: mat(pal.shoes),
      bag: mat(pal.bag),
      accent: mat(extra.accent ?? pal.capBrim),
      wood: mat('#8a5a36', false),
      glass: new THREE.MeshBasicMaterial({ color: 0x2a2a33 }),
      eye: new THREE.MeshBasicMaterial({ color: 0x1d1f2e }),
      white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, outline = true) => {
      const x = new THREE.Mesh(g, m);
      x.castShadow = true;
      x.userData.outline = outline;
      return x;
    };
    const group = (name: string) => {
      const g = new THREE.Group();
      g.name = name;
      return g;
    };
    const hip = group('hip');
    hip.position.y = 0.82;
    const spine = group('spine');
    spine.position.y = 0.05;
    hip.add(spine);
    // 躯干：外套 + 内衬
    const torso = mesh(new THREE.CapsuleGeometry(0.21, 0.32, 6, 14).scale(1, 1, 0.78), M.jacket);
    torso.position.y = 0.28;
    spine.add(torso);
    const shirt = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.05), M.shirt, false);
    shirt.position.set(0, 0.3, 0.155);
    spine.add(shirt);
    // 背包
    if (style.bag) {
      const bag = mesh(new THREE.BoxGeometry(0.34, 0.36, 0.16, 2, 2, 2), M.bag);
      bag.position.set(0, 0.3, -0.21);
      spine.add(bag);
      for (const sx of [-1, 1]) {
        const strap = mesh(new THREE.BoxGeometry(0.05, 0.42, 0.04), M.bag, false);
        strap.position.set(sx * 0.12, 0.33, 0.16);
        spine.add(strap);
      }
    }
    // 长外套 / 白大褂 / 连衣裙：从腰部垂到膝下的锥形下摆（挂在 hip 上，不随腿摆动）
    if (style.coat !== 'short') {
      const dress = style.coat === 'dress';
      const skirt = mesh(new THREE.CylinderGeometry(0.2, dress ? 0.3 : 0.26, dress ? 0.5 : 0.56, 18, 1, true).scale(1, 1, 0.8), dress ? M.pants : M.jacket);
      (skirt.material as THREE.Material).side = THREE.DoubleSide;
      skirt.position.y = dress ? -0.2 : -0.24;
      hip.add(skirt);
      if (!dress) {
        // 白大褂前襟开口：两条深色衣缝
        for (const sx of [-1, 1]) {
          const seam = mesh(new THREE.BoxGeometry(0.012, 0.5, 0.012), M.shirt, false);
          seam.position.set(sx * 0.035, -0.22, 0.215);
          hip.add(seam);
        }
      }
    }
    if (style.apron) {
      const apron = mesh(new THREE.BoxGeometry(0.3, 0.52, 0.02), M.accent, false);
      apron.position.set(0, 0.12, 0.17);
      spine.add(apron);
      const lower = mesh(new THREE.BoxGeometry(0.32, 0.3, 0.02), M.accent, false);
      lower.position.set(0, -0.14, 0.2);
      hip.add(lower);
    }
    // 头
    const head = group('head');
    head.position.y = 0.68;
    spine.add(head);
    const face = mesh(new THREE.SphereGeometry(0.2, 20, 16), M.skin);
    face.scale.set(1, 1.02, 0.96);
    face.position.y = 0.12;
    head.add(face);
    this.buildHair(head, style, M.hair, mesh);
    this.buildHat(head, style, M, mesh);
    if (style.beard) {
      const beard = mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), M.hair);
      beard.scale.set(1.1, 1.15, 0.8);
      beard.position.set(0, 0.06, 0.08);
      head.add(beard);
    }
    if (style.glasses) {
      for (const sx of [-1, 1]) {
        const rim = mesh(new THREE.TorusGeometry(0.038, 0.007, 6, 16), M.glass, false);
        rim.position.set(sx * 0.07, 0.115, 0.2);
        head.add(rim);
      }
      const bridge = mesh(new THREE.BoxGeometry(0.06, 0.008, 0.008), M.glass, false);
      bridge.position.set(0, 0.12, 0.205);
      head.add(bridge);
    }
    for (const sx of [-1, 1]) {
      const eye = mesh(new THREE.CapsuleGeometry(0.022, 0.035, 4, 8), M.eye, false);
      eye.position.set(sx * 0.07, 0.11, 0.185);
      head.add(eye);
      const hl = mesh(new THREE.SphereGeometry(0.009, 6, 4), M.white, false);
      hl.position.set(sx * 0.07 + 0.008, 0.13, 0.205);
      head.add(hl);
    }
    // 手臂
    const arm = (side: 1 | -1) => {
      const a = group(side < 0 ? 'arm.L' : 'arm.R');
      a.position.set(side * 0.26, 0.46, 0);
      const upper = mesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 10), M.jacket);
      upper.position.y = -0.14;
      a.add(upper);
      const hand = mesh(new THREE.SphereGeometry(0.058, 10, 8), style.gloves ? M.accent : M.skin);
      hand.position.y = -0.33;
      a.add(hand);
      if (style.gloves) {
        const cuff = mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.05, 12), M.accent);
        cuff.position.y = -0.27;
        a.add(cuff);
      }
      a.rotation.z = side * 0.12;
      spine.add(a);
      return a;
    };
    const armL = arm(-1);
    const armR = arm(1);
    // 腿
    const leg = (side: 1 | -1) => {
      const l = group(side < 0 ? 'leg.L' : 'leg.R');
      l.position.set(side * 0.1, 0, 0);
      const thigh = mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 10), M.pants);
      thigh.position.y = -0.32;
      l.add(thigh);
      const shoe = mesh(new THREE.CapsuleGeometry(0.075, 0.1, 4, 10).rotateX(Math.PI / 2), M.shoes);
      shoe.position.set(0, -0.76, 0.04);
      l.add(shoe);
      hip.add(l);
      return l;
    };
    const legL = leg(-1);
    const legR = leg(1);
    if (style.cane) {
      const cane = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.86, 8), M.wood);
      cane.position.set(0, -0.6, 0.1);
      armR.add(cane);
      const handle = mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 12, Math.PI), M.wood);
      handle.position.set(0.05, -0.17, 0.1);
      armR.add(handle);
    }
    this.buildExtras(spine, armR, style, M, mesh);
    spine.rotation.x = style.stoop;
    this.root.scale.setScalar(style.scale);
    this.root.add(hip);
    this.root.name = 'trainer';
    this.bones = { hip, spine, head, armL, armR, legL, legR };
    addHullOutlines(this.root);
  }

  /** M3-29：披风 / 围巾 / 肩甲 / 胸前徽记 / 手持道具 */
  private buildExtras(
    spine: THREE.Group,
    armR: THREE.Group,
    style: TrainerStyle,
    M: Record<'jacket' | 'cap' | 'accent' | 'hair' | 'wood' | 'eye' | 'white', THREE.Material>,
    mesh: (g: THREE.BufferGeometry, m: THREE.Material, o?: boolean) => THREE.Mesh,
  ): void {
    const cape = style.cape ?? 'none';
    if (cape !== 'none') {
      const len = cape === 'long' ? 1.12 : 0.5;
      // 只覆盖背面半圈（three 圆柱 θ=0 在 +z，背面是 π/2..3π/2）
      const g = new THREE.CylinderGeometry(0.235, cape === 'long' ? 0.36 : 0.29, len, 18, 1, true, Math.PI * 0.42, Math.PI * 1.16).scale(1, 1, 0.82);
      const m = (M.cap as THREE.Material).clone();
      m.side = THREE.DoubleSide;
      const c = mesh(g, m);
      c.position.set(0, 0.52 - len / 2, -0.02);
      c.rotation.x = cape === 'long' ? -0.06 : -0.1;
      spine.add(c);
      // 领口：accent 色立领 + 两枚扣子
      const collar = mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.1, 18, 1, true, Math.PI * 0.3, Math.PI * 1.4), m);
      collar.position.y = 0.56;
      spine.add(collar);
      for (const sx of [-1, 1]) {
        const clasp = mesh(new THREE.SphereGeometry(0.028, 10, 8), M.accent, false);
        clasp.position.set(sx * 0.13, 0.5, 0.14);
        spine.add(clasp);
      }
    }
    if (style.scarf) {
      const ring = mesh(new THREE.TorusGeometry(0.125, 0.05, 8, 20).rotateX(Math.PI / 2), M.accent);
      ring.position.y = 0.56;
      spine.add(ring);
      const tail = mesh(new THREE.BoxGeometry(0.09, 0.3, 0.035), M.accent);
      tail.position.set(0.09, 0.42, 0.14);
      tail.rotation.set(0.15, 0, 0.12);
      spine.add(tail);
    }
    if (style.shoulders) {
      for (const sx of [-1, 1]) {
        const pad = mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.accent);
        pad.scale.set(1.15, 0.7, 1);
        pad.position.set(sx * 0.25, 0.5, 0);
        pad.rotation.z = -sx * 0.35;
        spine.add(pad);
      }
    }
    const emblem = style.emblem ?? 'none';
    if (emblem !== 'none') {
      const e = this.buildEmblem(emblem, M.accent, M.eye, mesh);
      e.position.set(0, 0.36, 0.188);
      spine.add(e);
    }
    const prop = style.prop ?? 'none';
    if (prop !== 'none') {
      const p = new THREE.Group();
      p.position.set(0, -0.34, 0.04);
      armR.add(p);
      if (prop === 'staff') {
        const rod = mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.3, 8), M.wood);
        rod.position.y = -0.1;
        p.add(rod);
        const top = mesh(new THREE.OctahedronGeometry(0.07), M.accent);
        top.position.y = 0.6;
        p.add(top);
        const ring = mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), M.accent, false);
        ring.position.y = 0.6;
        p.add(ring);
      } else if (prop === 'fan') {
        const fan = mesh(new THREE.CircleGeometry(0.18, 14, 0, Math.PI), (() => { const m = (M.accent as THREE.Material).clone(); m.side = THREE.DoubleSide; return m; })());
        fan.position.set(0, 0.02, 0.06);
        fan.rotation.set(0, 0, -0.3);
        p.add(fan);
        for (let i = 0; i <= 6; i++) {
          const rib = mesh(new THREE.BoxGeometry(0.006, 0.18, 0.006), M.wood, false);
          const a = -0.3 + Math.PI / 2 - (i / 6) * Math.PI;
          rib.position.set(0, 0.02, 0.062);
          rib.rotation.z = a - Math.PI / 2;
          rib.translateY(0.09);
          p.add(rib);
        }
      } else if (prop === 'lantern') {
        const handle = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), M.wood, false);
        handle.position.y = -0.06;
        p.add(handle);
        const body = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 8), new THREE.MeshBasicMaterial({ color: 0xa8f0ff, transparent: true, opacity: 0.85 }), false);
        body.position.y = -0.21;
        p.add(body);
        for (const y of [-0.13, -0.29]) {
          const cap = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 8), M.jacket);
          cap.position.y = y;
          p.add(cap);
        }
      } else {
        const orb = mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd8b8ff, transparent: true, opacity: 0.75 }), false);
        orb.position.set(0, 0.02, 0.1);
        p.add(orb);
      }
    }
  }

  private buildEmblem(kind: NonNullable<TrainerStyle['emblem']>, m: THREE.Material, dark: THREE.Material, mesh: (g: THREE.BufferGeometry, m: THREE.Material, o?: boolean) => THREE.Mesh): THREE.Group {
    const g = new THREE.Group();
    const poly = (pts: [number, number][]) => {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      return mesh(new THREE.ShapeGeometry(sh), m, false);
    };
    switch (kind) {
      case 'bolt':
        g.add(poly([[0.02, 0.07], [-0.035, -0.005], [0.0, -0.005], [-0.02, -0.07], [0.04, 0.012], [0.005, 0.012]]));
        break;
      case 'sun': {
        g.add(mesh(new THREE.CircleGeometry(0.035, 16), m, false));
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = poly([[-0.01, 0.045], [0.01, 0.045], [0, 0.07]]);
          r.rotation.z = a;
          g.add(r);
        }
        break;
      }
      case 'snow':
        for (let i = 0; i < 3; i++) {
          const b = mesh(new THREE.PlaneGeometry(0.014, 0.13), m, false);
          b.rotation.z = (i * Math.PI) / 3;
          g.add(b);
        }
        break;
      case 'wing':
        for (const sx of [-1, 1]) {
          const w = poly([[0, 0], [0.075, 0.035], [0.065, 0.005], [0.07, -0.015], [0.04, -0.02], [0.02, -0.03]]);
          w.scale.x = sx;
          g.add(w);
        }
        break;
      case 'eye': {
        const e = mesh(new THREE.CircleGeometry(0.06, 20), m, false);
        e.scale.y = 0.5;
        g.add(e);
        const pupil = mesh(new THREE.CircleGeometry(0.018, 12), dark, false);
        pupil.position.z = 0.002;
        g.add(pupil);
        break;
      }
      case 'wisp': {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0.07);
        sh.quadraticCurveTo(0.05, 0.0, 0.03, -0.04);
        sh.absarc(0, -0.035, 0.035, 0, Math.PI, true);
        sh.quadraticCurveTo(-0.04, 0.02, 0, 0.07);
        g.add(mesh(new THREE.ShapeGeometry(sh), m, false));
        break;
      }
      case 'wave':
        for (let i = 0; i < 2; i++) {
          const t = mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 14, Math.PI), m, false);
          t.position.set(-0.03 + i * 0.06, 0, 0);
          t.rotation.z = i ? Math.PI : 0;
          g.add(t);
        }
        break;
      case 'moon': {
        const sh = new THREE.Shape();
        sh.absarc(0, 0, 0.06, Math.PI * 0.35, Math.PI * 1.65, false);
        sh.absarc(0.03, 0, 0.05, Math.PI * 1.55, Math.PI * 0.45, true);
        g.add(mesh(new THREE.ShapeGeometry(sh), m, false));
        break;
      }
      case 'diamond':
        g.add(poly([[0, 0.075], [0.045, 0], [0, -0.075], [-0.045, 0]]));
        break;
    }
    return g;
  }

  private buildHair(head: THREE.Group, style: TrainerStyle, m: THREE.Material, mesh: (g: THREE.BufferGeometry, m: THREE.Material, o?: boolean) => THREE.Mesh): void {
    if (style.hair === 'bald') {
      // 两侧少量白发
      for (const sx of [-1, 1]) {
        const tuft = mesh(new THREE.SphereGeometry(0.07, 10, 8), m);
        tuft.scale.set(0.6, 1, 1.2);
        tuft.position.set(sx * 0.18, 0.1, -0.04);
        head.add(tuft);
      }
      return;
    }
    const cap = mesh(new THREE.SphereGeometry(0.212, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), m);
    cap.position.set(0, 0.13, -0.015);
    cap.rotation.x = -0.25;
    head.add(cap);
    if (style.hair === 'long') {
      const back = mesh(new THREE.CapsuleGeometry(0.17, 0.22, 4, 14).scale(1.05, 1, 0.55), m);
      back.position.set(0, -0.02, -0.11);
      head.add(back);
    } else if (style.hair === 'bun') {
      const bun = mesh(new THREE.SphereGeometry(0.085, 12, 10), m);
      bun.position.set(0, 0.3, -0.12);
      head.add(bun);
    } else if (style.hair === 'pony') {
      const tail = mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 10), m);
      tail.position.set(0, 0.08, -0.22);
      tail.rotation.x = 0.35;
      head.add(tail);
    } else if (style.hair === 'spiky') {
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        const spike = mesh(new THREE.ConeGeometry(0.05, 0.13, 6), m);
        spike.position.set(Math.sin(a) * 0.14, 0.3, Math.cos(a) * 0.05 - 0.02);
        spike.rotation.set(-0.3, 0, -a * 0.6);
        head.add(spike);
      }
    }
  }

  private buildHat(
    head: THREE.Group,
    style: TrainerStyle,
    M: Record<'cap' | 'brim' | 'accent', THREE.Material>,
    mesh: (g: THREE.BufferGeometry, m: THREE.Material, o?: boolean) => THREE.Mesh,
  ): void {
    switch (style.hat) {
      case 'none':
        return;
      case 'cap': {
        const cap = mesh(new THREE.SphereGeometry(0.218, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), M.cap);
        cap.position.y = 0.15;
        head.add(cap);
        const brim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), M.brim);
        brim.scale.set(1, 1, 0.9);
        brim.position.set(0, 0.2, 0.1);
        brim.rotation.x = 0.12;
        head.add(brim);
        const badge = mesh(new THREE.CircleGeometry(0.045, 16), M.brim, false);
        badge.position.set(0, 0.28, 0.19);
        badge.rotation.x = -0.6;
        head.add(badge);
        return;
      }
      case 'nurse': {
        const hat = mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.1, 16), M.cap);
        hat.position.set(0, 0.34, 0.02);
        hat.rotation.x = -0.2;
        head.add(hat);
        const cross = mesh(new THREE.BoxGeometry(0.05, 0.015, 0.012), M.accent, false);
        cross.position.set(0, 0.35, 0.17);
        head.add(cross);
        const cross2 = mesh(new THREE.BoxGeometry(0.015, 0.05, 0.012), M.accent, false);
        cross2.position.set(0, 0.35, 0.17);
        head.add(cross2);
        return;
      }
      case 'bucket': {
        const top = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.14, 18), M.cap);
        top.position.y = 0.3;
        head.add(top);
        const brim = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), M.brim);
        brim.position.y = 0.24;
        head.add(brim);
        return;
      }
      case 'sailor': {
        const top = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 18), M.cap);
        top.position.y = 0.3;
        head.add(top);
        const band = mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.03, 18), M.accent);
        band.position.y = 0.27;
        head.add(band);
        return;
      }
      case 'beanie': {
        const top = mesh(new THREE.SphereGeometry(0.224, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M.cap);
        top.position.y = 0.14;
        top.scale.y = 1.12;
        head.add(top);
        const band = mesh(new THREE.CylinderGeometry(0.226, 0.226, 0.07, 20), M.brim);
        band.position.y = 0.16;
        head.add(band);
        const pom = mesh(new THREE.SphereGeometry(0.065, 12, 10), M.accent);
        pom.position.y = 0.41;
        head.add(pom);
        return;
      }
      case 'goggles': {
        const strap = mesh(new THREE.TorusGeometry(0.212, 0.018, 6, 24).rotateX(Math.PI / 2), M.cap);
        strap.position.y = 0.24;
        strap.rotation.x = -0.25;
        head.add(strap);
        for (const sx of [-1, 1]) {
          const lens = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateX(Math.PI / 2), M.brim);
          lens.position.set(sx * 0.065, 0.28, 0.165);
          lens.rotation.x = -0.45;
          head.add(lens);
          const glass = mesh(new THREE.CircleGeometry(0.037, 14), M.accent, false);
          glass.position.set(sx * 0.065, 0.29, 0.19);
          glass.rotation.x = -0.45;
          head.add(glass);
        }
        return;
      }
      case 'hood':
      case 'veil': {
        const veil = style.hat === 'veil';
        const hood = mesh(new THREE.SphereGeometry(0.255, 22, 14, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.72), veil ? M.accent : M.cap);
        (hood.material as THREE.Material).side = THREE.DoubleSide;
        hood.position.set(0, 0.13, -0.02);
        head.add(hood);
        const drape = mesh(new THREE.CylinderGeometry(0.2, veil ? 0.3 : 0.26, veil ? 0.5 : 0.22, 18, 1, true, Math.PI * 0.45, Math.PI * 1.1), veil ? M.accent : M.cap);
        (drape.material as THREE.Material).side = THREE.DoubleSide;
        drape.position.set(0, veil ? -0.22 : -0.08, -0.02);
        head.add(drape);
        if (veil) {
          const gem = mesh(new THREE.OctahedronGeometry(0.03), M.brim);
          gem.position.set(0, 0.29, 0.2);
          head.add(gem);
        }
        return;
      }
      case 'circlet': {
        const ring = mesh(new THREE.TorusGeometry(0.21, 0.014, 6, 28).rotateX(Math.PI / 2), M.accent);
        ring.position.set(0, 0.22, -0.01);
        ring.rotation.x = -0.18;
        head.add(ring);
        const gem = mesh(new THREE.OctahedronGeometry(0.035), M.brim);
        gem.scale.y = 1.4;
        gem.position.set(0, 0.27, 0.2);
        head.add(gem);
        return;
      }
      case 'feather': {
        const band = mesh(new THREE.TorusGeometry(0.212, 0.02, 6, 24).rotateX(Math.PI / 2), M.cap);
        band.position.y = 0.2;
        band.rotation.x = -0.15;
        head.add(band);
        for (let i = 0; i < 2; i++) {
          const f = mesh(new THREE.SphereGeometry(0.05, 10, 8), i ? M.accent : M.brim);
          f.scale.set(0.45, 2.6, 0.2);
          f.position.set(0.2, 0.32 + i * 0.03, -0.06 - i * 0.05);
          f.rotation.set(-0.5 - i * 0.25, 0, -0.35);
          head.add(f);
        }
        return;
      }
      case 'sunhat': {
        const crown = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 20), M.cap);
        crown.position.y = 0.31;
        head.add(crown);
        const brim = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.018, 28), M.brim);
        brim.position.y = 0.25;
        brim.rotation.x = 0.08;
        head.add(brim);
        const ribbon = mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.035, 20), M.accent);
        ribbon.position.y = 0.27;
        head.add(ribbon);
        return;
      }
      case 'bandana': {
        const b = mesh(new THREE.SphereGeometry(0.222, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.38), M.cap);
        b.position.y = 0.14;
        head.add(b);
        const knot = mesh(new THREE.ConeGeometry(0.04, 0.12, 6), M.cap);
        knot.position.set(0.05, 0.2, -0.21);
        knot.rotation.x = 2.2;
        head.add(knot);
        return;
      }
    }
  }

  /** speed：米/秒；run：是否奔跑 */
  animate(dt: number, speed: number, time: number): void {
    const target = Math.min(1, speed / 3);
    this.blend += (target - this.blend) * Math.min(1, dt * 10);
    const run = speed > 5.5 ? 1 : 0;
    this.phase += dt * (speed > 0.1 ? 2.2 + speed * 1.25 : 0);
    const s = Math.sin(this.phase);
    const b = this.bones;
    const amp = this.blend * (0.55 + run * 0.35);
    b.legL.rotation.x = s * amp;
    b.legR.rotation.x = -s * amp;
    b.armL.rotation.x = -s * amp * 0.9;
    b.armR.rotation.x = s * amp * 0.9;
    b.hip.position.y = 0.82 + Math.abs(Math.cos(this.phase)) * 0.045 * this.blend - 0.02 * this.blend;
    b.spine.rotation.x = this.style.stoop + 0.06 * this.blend + run * 0.14;
    // 待机：呼吸 + 轻微摆头
    const idle = 1 - this.blend;
    b.spine.scale.y = 1 + Math.sin(time * 2.2) * 0.012 * idle;
    b.head.rotation.y = Math.sin(time * 0.5) * 0.12 * idle;
    b.armL.rotation.z = -0.12 - Math.sin(time * 2.2) * 0.02 * idle;
    b.armR.rotation.z = 0.12 + Math.sin(time * 2.2) * 0.02 * idle;
  }

  /** 投掷动作（0–1 进度） */
  throwPose(t: number): void {
    const k = Math.sin(Math.min(1, t) * Math.PI);
    this.bones.armR.rotation.x = -2.6 * k + (t > 0.5 ? 1.2 * (t - 0.5) : 0);
    this.bones.spine.rotation.y = -0.4 * k;
  }
}

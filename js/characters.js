'use strict';
// Personagens: modelos (protagonista + zumbis), poses de animação e folhas de sprite em 8 direções.
const CHR = (() => {
  const H = VX.hash;
  const TAU = Math.PI * 2;
  const FW = 92, FH = 96, OX = 46, OY = 74, SCALE = 1.3;

  // Ordem das direções = yaw da câmera em passos de 45°: 0 S, 1 SE, 2 E, 3 NE, 4 N, 5 NO, 6 O, 7 SO
  const DIR_NAMES = ['S', 'SE', 'L', 'NE', 'N', 'NO', 'O', 'SO'];

  const ANIMS = {
    idle:     { n: 4, fps: 3, loop: true, label: 'Parado' },
    walk:     { n: 8, fps: 10, loop: true, label: 'Andando' },
    run:      { n: 8, fps: 14, loop: true, label: 'Correndo' },
    crouch:   { n: 4, fps: 3, loop: true, label: 'Agachado' },
    sneak:    { n: 8, fps: 8, loop: true, label: 'Andando agachado' },
    attack:   { n: 6, fps: 16, loop: false, label: 'Golpe' },
    punch:    { n: 4, fps: 14, loop: false, label: 'Soco / estocada' },
    shoot:    { n: 4, fps: 14, loop: false, label: 'Tiro' },
    interact: { n: 4, fps: 7, loop: true, label: 'Vasculhando' },
    hurt:     { n: 2, fps: 8, loop: false, label: 'Dano' },
    death:    { n: 6, fps: 9, loop: false, label: 'Morte' },
  };
  const PLAYER_ANIMS = Object.keys(ANIMS);
  const ZOMBIE_ANIMS = ['idle', 'walk', 'run', 'attack', 'hurt', 'death'];

  // ---------- especificações visuais ----------
  const SPECS = {
    player: {
      skin: '#f2c49c', hair: ['#d4561e', '#f08038', '#9a3412'], head: 'visor', ponytail: true,
      shirt: '#22212a', lines: '#a3242a', coat: '#e8e6e0', belt: '#7a4a28', gloves: '#3d6e9e',
      pants: '#26252d', stripe: '#8e1f22', boots: '#1b1a20', sleeves: 'long', neck: '#1c1b22',
    },
    z_civil: { zombie: true, skin: '#8fa27e', hair: ['#3a2a1e', '#4e3a2a', '#2a1e16'], head: 'zombie', shirt: '#46668a', torn: true, pants: '#394660', boots: '#4a3626', sleeves: 'short' },
    z_xadrez: { zombie: true, skin: '#9aa486', hair: ['#5a4a3a', '#6e5c48', '#3e3228'], head: 'zombie', shirt: '#8a3a30', plaid: true, torn: true, pants: '#2e2e32', boots: '#2a2420', sleeves: 'long' },
    z_regata: { zombie: true, skin: '#88a07c', hair: ['#1e1a18', '#2e2824', '#141210'], head: 'zombie', shirt: '#cfc6ac', torn: true, pants: '#5a4a32', boots: '#3a2a1c', sleeves: 'none' },
    z_cientista: { zombie: true, skin: '#b0a88c', hair: ['#1e1c1c', '#2c2a2a', '#121010'], head: 'gasmask', coat: '#d8d4c0', shirt: '#2c3036', pants: '#2a2c2e', gloves: '#1e1f22', boots: '#4a3424', sleeves: 'long', belt: '#5a4430' },
    z_corredor: { zombie: true, skin: '#a6b096', hair: ['#2a2420', '#3a322c', '#1a1614'], head: 'zombie', shirt: '#3a3a46', hood: true, torn: true, pants: '#24242a', boots: '#e0e0e0', sleeves: 'long' },
  };
  const ZOMBIE_TYPES = ['z_civil', 'z_xadrez', 'z_regata', 'z_cientista', 'z_corredor'];

  function tex(base, i, amt) {
    const r = H(i.x, i.y, i.z);
    const k = amt || 0.08;
    if (r > 0.86) return VX.shade(base, 1 + k);
    if (r < 0.12) return VX.shade(base, 1 - k);
    return base;
  }

  function build(specKey, itemId) {
    const S = SPECS[specKey];
    const m = new VX.Model();
    m.part('hips', null, [0, 12, 0]);
    m.part('thighL', 'hips', [-1.5, 0, 0]); m.part('shinL', 'thighL', [0, -6, 0]);
    m.part('thighR', 'hips', [1.5, 0, 0]); m.part('shinR', 'thighR', [0, -6, 0]);
    m.part('tails', 'hips', [0, 0, 0]);
    m.part('torso', 'hips', [0, 0, 0]);
    m.part('head', 'torso', [0, 10, 0]);
    m.part('tailA', 'head', [0, 7.5, -3.6]); m.part('tailB', 'tailA', [0, -5, 0]);
    m.part('armL', 'torso', [-5, 9.5, 0]); m.part('armR', 'torso', [5, 9.5, 0]);
    m.part('item', 'armR', [0, -10, 0.3]);

    const skin = S.skin, hairC = S.hair;
    const hairTex = (i) => { const r = H(i.x + 3, i.y, i.z); return r > 0.78 ? hairC[1] : r < 0.2 ? hairC[2] : hairC[0]; };
    const blood = '#6e1414';
    const torn = (i, base) => {
      if (!S.torn) return null;
      const r = H(i.x * 1.3, i.y * 0.7, i.z + 9);
      if (r > 0.93) return blood;
      if (r < 0.07) return skin;
      return null;
    };

    // pernas
    for (const [n, sgn] of [['L', -1], ['R', 1]]) {
      const pants = (i) => {
        if (S.stripe && i.front && i.x * sgn > 0.5) return S.stripe;
        return torn(i) || tex(S.pants, i, 0.1);
      };
      const boot = (i) => (i.top && !i.front ? VX.shade(S.boots, 1.5) : tex(S.boots, i, 0.12));
      m.box('thigh' + n, -1.5, -6, -1.5, 3, 6, 3, (i) => (i.top && !i.left && !i.right && !i.front && !i.back ? null : pants(i)));
      m.box('shin' + n, -1.5, -6, -1.5, 3, 6, 3, (i) => (i.iy <= 2 ? boot(i) : pants(i)));
      m.box('shin' + n, -1.5, -6, 1.5, 3, 2, 1, (i) => boot(i));
    }

    // tronco
    m.box('torso', -3, 0, -2, 6, 10, 4, (i) => {
      if (S.belt && i.iy < 2) return tex(S.belt, i, 0.12);
      if (S.lines && i.front && Math.abs(Math.abs(i.x) - 1.5) < 0.1 && i.iy >= 2 && i.iy <= 8) return S.lines;
      if (S.lines && i.front && i.iy === 6 && Math.abs(i.x) < 1) return S.lines;
      if (S.plaid && ((Math.floor(i.x + 10) + Math.floor(i.y)) % 3 === 0)) return VX.shade(S.shirt, 0.7);
      if (S.sleeves === 'none' && (i.left || i.right) && i.iy > 7) return skin;
      return torn(i) || tex(S.shirt, i, 0.1);
    });
    if (S.neck) m.box('head', -1, 0, -1, 2, 1, 2, S.neck);
    else m.box('head', -1, 0, -1, 2, 1, 2, skin);
    if (S.hood) m.box('torso', -3, 8, -3, 6, 3, 2, (i) => tex(VX.shade(S.shirt, 0.9), i));

    if (S.coat) {
      const coat = (i) => tex(S.coat, i, 0.07);
      m.box('torso', -4, 0, -3, 8, 10, 6, (i) => {
        if (i.front) { if (Math.abs(i.x) < 2) return null; if (S.belt && i.iy < 2) return null; }
        if (i.bottom && !i.left && !i.right && !i.front && !i.back) return null;
        if (i.top && Math.abs(i.x) < 2 && i.z > -1.5) return null;
        if (i.front && Math.abs(i.x) < 3) return VX.shade(S.coat, 0.86);
        if (i.front && i.iy === 4 && Math.abs(i.x) > 3) return VX.shade(S.coat, 0.8);
        return coat(i);
      });
      if (S.belt) {
        m.box('torso', -4, 0, 2, 8, 2, 1, (i) => (Math.abs(i.x) < 0.6 && i.iy === 1 ? '#c9a24a' : tex(S.belt, i, 0.12)));
        if (specKey === 'player') {
          m.box('torso', -3.5, -1.5, 3, 2, 3, 1, (i) => tex('#6a3e22', i, 0.12));
          m.box('torso', 1.5, -1.5, 3, 2, 3, 1, (i) => tex('#6a3e22', i, 0.12));
        }
      }
      m.box('tails', -4, -6, -3, 8, 6, 6, (i) => {
        if (i.front && Math.abs(i.x) < 3) return null;
        if ((i.top || i.bottom) && !i.left && !i.right && !i.front && !i.back) return null;
        return coat(i);
      });
    }

    // braços
    const sleeve = S.coat || S.shirt;
    for (const n of ['L', 'R']) {
      m.box('arm' + n, -1, -11, -1, 2, 11, 2, (i) => {
        if (i.iy <= 2) return S.gloves ? tex(S.gloves, i, 0.15) : VX.shade(skin, 0.92);
        if (S.sleeves === 'none') return tex(skin, i);
        if (S.sleeves === 'short' && i.iy < 7) return torn(i) || tex(skin, i);
        if (i.iy === 3 && S.coat) return VX.shade(sleeve, 0.82);
        return torn(i) || tex(sleeve, i, 0.07);
      });
    }

    // cabeça
    if (S.head === 'visor') {
      const frame = '#1c2a24';
      m.box('head', -3, 1, -3, 6, 7, 6, (i) => {
        const { ix, iy, iz } = i;
        if (i.bottom && !i.front && !i.left && !i.right && !i.back) return null;
        if (i.top || i.back) return hairTex(i);
        if (i.front) {
          if (iy === 3 || iy === 4) return ix === 0 || ix === 5 ? frame : iy === 4 && (ix === 1 || ix === 2) ? '#a6f7cf' : '#3fd08a';
          if (iy === 6) return hairTex(i);
          if (iy === 5) return ix <= 1 ? hairTex(i) : skin;
          if (iy === 1 && ix === 3) return '#c4706a';
          if (iy === 0) return VX.shade(skin, 0.93);
          return skin;
        }
        if (iy >= 5) return hairTex(i);
        if (iy >= 3) return iz >= 3 ? frame : hairTex(i);
        return iz <= 2 ? hairTex(i) : skin;
      });
      m.box('head', -3, 8, -3, 6, 1, 6, hairTex);
      m.box('head', -3, 2, -4, 6, 7, 1, hairTex);
      m.box('head', -3, 7, 3, 5, 1, 1, hairTex);
      m.box('head', -3.5, 3, 2, 1, 5, 2, hairTex);
      m.box('head', 2.5, 5, -3, 1, 3, 5, hairTex);
    } else if (S.head === 'gasmask') {
      m.box('head', -3, 1, -3, 6, 7, 6, (i) => {
        const { ix, iy, iz } = i;
        if (i.bottom && !i.front && !i.left && !i.right && !i.back) return null;
        if (i.top) return hairTex(i);
        if (i.back) return iy >= 2 ? hairTex(i) : '#1e2022';
        if (i.front) {
          if (iy === 6) return hairTex(i);
          if (iy === 5) return skin;
          if (iy === 3 || iy === 4) {
            if (ix === 1 || ix === 4) return iy === 4 ? '#8fdada' : '#3d8a8c';
            return ix === 0 || ix === 5 ? '#24272a' : '#33373a';
          }
          return tex('#2e3234', i);
        }
        if (iy >= 5) return hairTex(i);
        if (iy >= 3) return '#1e2022';
        return iz >= 3 ? '#2e3234' : skin;
      });
      m.box('head', -3, 8, -3, 6, 1, 6, (i) => (H(i.x, i.y, i.z) > 0.5 ? hairTex(i) : null));
      m.box('head', -1.5, 1, 3, 3, 3, 2, (i) => (i.front && i.ix === 1 && i.iy === 1 ? '#15171a' : tex('#3a3f44', i)));
    } else {
      // zumbi
      m.box('head', -3, 1, -3, 6, 7, 6, (i) => {
        const { ix, iy } = i;
        const patch = H(i.x + 5, i.y, i.z) ;
        if (i.bottom && !i.front && !i.left && !i.right && !i.back) return null;
        if (S.hood && (i.back || i.top || ((i.left || i.right) && i.iz < 4))) return tex(VX.shade(S.shirt, 0.9), i);
        if (i.top) return patch > 0.35 ? hairTex(i) : VX.shade(skin, 0.85);
        if (i.back) return iy >= 3 && patch > 0.25 ? hairTex(i) : tex(skin, i);
        if (i.front) {
          if (iy === 6) return patch > 0.4 ? hairTex(i) : skin;
          if (iy === 4 && (ix === 1 || ix === 4)) return '#ff3a2a';
          if (iy === 5 && ix > 0 && ix < 5) return VX.shade(skin, 0.75);
          if (iy === 1 && (ix === 2 || ix === 3)) return '#2a0d0d';
          if (iy === 0 && ix === 2) return '#7a1010';
          if (iy === 2 && ix === 2) return VX.shade(skin, 0.8);
          return tex(skin, i, 0.1);
        }
        if (iy >= 5) return patch > 0.3 ? hairTex(i) : skin;
        return tex(skin, i, 0.1);
      });
    }

    if (S.ponytail) {
      m.box('tailA', -1.5, -5, -1.5, 3, 6, 3, (i) => (i.iy === 5 ? '#3a1f3a' : hairTex(i)));
      m.box('tailB', -1, -6, -1, 2, 6, 2, (i) => (i.iy <= 1 ? '#5a1d58' : i.iy === 2 ? '#7a2a6e' : i.iy === 3 ? '#a8402e' : hairTex(i)));
    }

    if (itemId && ITEM_MODELS.build[itemId]) ITEM_MODELS.build[itemId](m, 'item');
    return m;
  }

  // ---------- poses ----------
  function pose(anim, f, o) {
    const A = ANIMS[anim];
    const p = (f / A.n) * TAU, s = Math.sin(p), c = Math.cos(p), as = Math.abs(s);
    const P = {
      root: {}, hips: {}, torso: {}, head: {}, armL: { rz: -0.07 }, armR: { rz: 0.07 },
      thighL: {}, thighR: {}, shinL: {}, shinR: {}, tails: {}, tailA: { rx: 0.55 }, tailB: { rx: -0.4 }, item: {},
    };
    const Z = o.zombie;
    const kind = o.item ? ITEMS[o.item].kind : null;
    const long = kind === 'melee' && o.item !== 'faca';
    P.item.rx = long ? -2.45 : 1.35;
    if (!o.item) P.item.hide = true;
    const holding = !!o.item;

    switch (anim) {
      case 'idle':
        P.torso.rx = 0.03 * s; P.head.rx = 0.04 * s;
        P.armL.rz = -0.07 - 0.04 * s; P.armR.rz = 0.07 + 0.04 * s;
        P.hips.dy = f % 2 ? -0.45 : 0;
        P.tailA.rz = 0.08 * s;
        if (Z) {
          P.torso.rz = 0.08 * s; P.torso.rx = 0.12; P.head.rz = 0.25 + 0.08 * s; P.head.rx = 0.15;
          P.armL.rx = -0.55 + 0.1 * s; P.armR.rx = -0.4 - 0.1 * s;
        }
        if (holding && long) P.armR.rx = -0.15;
        break;
      case 'walk':
        if (Z) {
          P.thighL.rx = -0.38 * s; P.thighR.rx = 0.3 * s;
          P.shinL.rx = 0.5 * Math.max(0, c); P.shinR.rx = 0.45 * Math.max(0, -c);
          P.armL.rx = -1.3 + 0.12 * s; P.armR.rx = -1.2 - 0.12 * s; P.armL.ry = 0.12; P.armR.ry = -0.12;
          P.torso.rx = 0.16; P.torso.rz = 0.07 * s; P.head.rz = 0.26 + 0.06 * s; P.head.rx = 0.18;
          P.hips.dy = -0.8 * as;
        } else {
          P.thighL.rx = -0.5 * s; P.thighR.rx = 0.5 * s;
          P.shinL.rx = 0.8 * Math.max(0, c); P.shinR.rx = 0.8 * Math.max(0, -c);
          P.armL.rx = 0.45 * s; P.armR.rx = holding ? -0.15 - 0.2 * s : -0.45 * s;
          P.torso.ry = 0.08 * s; P.hips.dy = -1.3 * as;
          P.tailA.rx = 0.62 + 0.12 * as; P.tailA.rz = 0.15 * s; P.tails.rx = 0.06 * as;
        }
        break;
      case 'run':
        P.thighL.rx = -0.85 * s; P.thighR.rx = 0.85 * s;
        P.shinL.rx = 0.3 + 1.2 * Math.max(0, c); P.shinR.rx = 0.3 + 1.2 * Math.max(0, -c);
        P.armL.rx = 0.9 * s; P.armR.rx = holding ? -0.5 - 0.3 * s : -0.9 * s;
        P.armL.rz = -0.15; P.armR.rz = 0.15;
        P.torso.rx = Z ? 0.35 : 0.26; P.torso.ry = 0.12 * s; P.head.rx = -0.2;
        if (Z) P.head.rz = 0.2;
        P.hips.dy = -1.5 * as + 0.5;
        P.tails.rx = 0.35 + 0.12 * Math.abs(c);
        P.tailA.rx = 1.0 + 0.15 * c; P.tailA.rz = 0.2 * s; P.tailB.rx = -0.2;
        break;
      case 'crouch':
      case 'sneak': {
        const m = anim === 'sneak' ? 1 : 0;
        P.thighL.rx = -1.1 - 0.3 * s * m; P.thighR.rx = -0.85 + 0.3 * s * m;
        P.shinL.rx = 1.55 + 0.35 * Math.max(0, c) * m; P.shinR.rx = 1.35 + 0.35 * Math.max(0, -c) * m;
        P.hips.dy = -3.5 - 0.4 * as * m; P.hips.dz = -0.8;
        P.torso.rx = 0.35 + 0.03 * (m ? 0 : s); P.head.rx = -0.3;
        P.armL.rx = -0.35 + 0.2 * s * m; P.armR.rx = holding ? -0.6 : -0.35 - 0.2 * s * m;
        P.tails.rx = 0.5; P.tailA.rx = 0.8; P.tailA.rz = 0.1 * s;
        break;
      }
      case 'attack': {
        if (Z) return pose('punch', Math.min(3, Math.floor(f * 4 / 6)), o);
        const K = [
          { ty: 0.4, ax: -1.3, ay: 0.7 }, { ty: 0.7, ax: -1.45, ay: 1.1 }, { ty: 0.2, ax: -1.55, ay: 0.3 },
          { ty: -0.4, ax: -1.5, ay: -0.45 }, { ty: -0.7, ax: -1.2, ay: -0.75 }, { ty: -0.3, ax: -0.7, ay: -0.2 },
        ][f];
        P.torso.ry = K.ty; P.head.ry = -K.ty * 0.6;
        P.armR.rx = K.ax; P.armR.ry = K.ay; P.armR.rz = 0;
        P.item.rx = 1.35;
        P.armL.rx = 0.35; P.armL.rz = -0.3;
        P.thighL.rx = -0.35; P.thighR.rx = 0.3; P.shinR.rx = 0.25; P.hips.dy = -0.8;
        P.tailA.rz = -K.ty * 0.4; P.tails.ry = K.ty * 0.5;
        break;
      }
      case 'punch': {
        if (Z) {
          const K = [{ ax: -2.3, t: -0.1, dz: 0 }, { ax: -1.25, t: 0.35, dz: 1 }, { ax: -0.95, t: 0.45, dz: 1.3 }, { ax: -1.3, t: 0.2, dz: 0.5 }][f];
          P.armL.rx = K.ax; P.armR.rx = K.ax - 0.1; P.armL.ry = 0.15; P.armR.ry = -0.15;
          P.torso.rx = K.t; P.hips.dz = K.dz; P.head.rz = 0.2;
          P.thighL.rx = -0.4; P.thighR.rx = 0.35; P.shinR.rx = 0.2; P.hips.dy = -0.8;
          break;
        }
        const K = [{ ax: 0.45, ty: 0.3 }, { ax: -1.55, ty: -0.35 }, { ax: -1.5, ty: -0.3 }, { ax: -0.6, ty: -0.1 }][f];
        P.armR.rx = K.ax; P.armR.ry = -0.1; P.torso.ry = K.ty; P.head.ry = -K.ty * 0.6;
        P.armL.rx = -0.85; P.armL.ry = 0.3;
        P.item.rx = 1.5;
        P.thighL.rx = -0.35; P.thighR.rx = 0.3; P.shinR.rx = 0.25; P.hips.dy = -0.8;
        break;
      }
      case 'shoot': {
        const r = [0, -0.28, -0.12, 0][f];
        P.armR.rx = -1.52 + r; P.armR.ry = -0.14; P.armR.rz = 0;
        P.armL.rx = -1.45 + r; P.armL.ry = 0.38; P.armL.rz = 0;
        P.item.rx = 1.52; P.torso.rx = r * 0.2; P.head.rx = -0.05;
        P.thighL.rx = -0.25; P.thighR.rx = 0.25;
        break;
      }
      case 'interact':
        P.thighL.rx = -0.6; P.thighR.rx = -0.5; P.shinL.rx = 0.9; P.shinR.rx = 0.8; P.hips.dy = -1.6;
        P.torso.rx = 0.55; P.head.rx = -0.1;
        P.armL.rx = -1.0 + 0.3 * s; P.armR.rx = -1.0 - 0.3 * s;
        P.tails.rx = 0.3; P.tailA.rx = 0.9;
        break;
      case 'hurt': {
        const k = f === 0 ? 1 : 0.5;
        P.torso.rx = -0.25 * k; P.head.rx = 0.3 * k; P.hips.dz = -0.6 * k;
        P.armL.rx = 0.3 * k; P.armL.rz = -0.5 * k; P.armR.rz = 0.5 * k; P.armR.rx = 0.2 * k;
        if (Z) { P.head.rz = 0.3; }
        P.tailA.rx = 0.2;
        break;
      }
      case 'death': {
        const a = [0.15, 0.4, 0.8, 1.2, 1.45, 1.55][f];
        const dir = Z ? 1 : -1;
        P.root.fall = a * dir; P.root.lift = 3 * (a / 1.55);
        P.thighL.rx = -0.3 * Math.min(1, f / 2); P.shinL.rx = 0.6 * Math.min(1, f / 2) * (f < 4 ? 1 : 0.4);
        P.thighR.rx = -0.1; P.shinR.rx = 0.3 * (f < 4 ? 1 : 0.2);
        P.armL.rz = -0.3 - 0.4 * (a / 1.55); P.armR.rz = 0.3 + 0.5 * (a / 1.55);
        P.armL.rx = dir * -0.6 * (a / 1.55); P.armR.rx = dir * -0.4 * (a / 1.55);
        P.head.rx = dir * 0.2; P.tailA.rx = 1.5; P.tailB.rx = 0;
        break;
      }
    }
    return P;
  }

  // ---------- folhas de sprite ----------
  const models = {}, sheets = {};
  function model(specKey, item) {
    const k = specKey + '|' + (item || '');
    return models[k] || (models[k] = build(specKey, item));
  }
  function sheetKey(specKey, item, anim) { return specKey + '|' + (item || '') + '|' + anim; }
  function sheet(specKey, item, anim) {
    const key = sheetKey(specKey, item, anim);
    if (sheets[key]) return sheets[key];
    const A = ANIMS[anim];
    const m = model(specKey, item);
    const W = FW * A.n, Hh = FH * 8;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Hh;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(W, Hh);
    const U = new Uint32Array(id.data.buffer);
    const fb = new Uint32Array(FW * FH);
    const zombie = !!SPECS[specKey].zombie;
    for (let d = 0; d < 8; d++) for (let f = 0; f < A.n; f++) {
      VX.render(m, pose(anim, f, { zombie, item }), { W: FW, H: FH, ox: OX, oy: OY, scale: SCALE, yaw: d * Math.PI / 4, ss: 4, out: fb });
      for (let y = 0; y < FH; y++) U.set(fb.subarray(y * FW, (y + 1) * FW), (d * FH + y) * W + f * FW);
    }
    ctx.putImageData(id, 0, 0);
    return (sheets[key] = { canvas: cv, n: A.n, fps: A.fps, loop: A.loop });
  }

  // direção (0..7) a partir de um vetor no mundo
  function dirFromVec(wx, wy) {
    const a = Math.atan2(wx - wy, wx + wy);
    return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  }
  function vecFromDir(d) {
    // inverso: yaw a -> (sx, sz) = (sin a, cos a) com sx = wx - wy, sz = wx + wy
    const a = d * Math.PI / 4, sx = Math.sin(a), sz = Math.cos(a);
    const wx = (sx + sz) / 2, wy = (sz - sx) / 2, l = Math.hypot(wx, wy);
    return [wx / l, wy / l];
  }

  function draw(ctx, specKey, item, anim, frame, dir, x, y, alpha) {
    const sh = sheet(specKey, item, anim);
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(sh.canvas, (frame % sh.n) * FW, dir * FH, FW, FH, Math.round(x) - OX, Math.round(y) - OY, FW, FH);
    ctx.globalAlpha = 1;
  }

  return { FW, FH, OX, OY, ANIMS, PLAYER_ANIMS, ZOMBIE_ANIMS, ZOMBIE_TYPES, SPECS, DIR_NAMES, sheet, model, pose, dirFromVec, vecFromDir, draw };
})();

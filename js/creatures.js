'use strict';
// Criaturas: protagonista, infectados pelo micélio alienígena e raças alienígenas.
// Corpos são formas SDF (orgânicas) em escala real: 30 voxels = 1 m, 24 voxels por tile.
// Poses usam cinemática direta nas pernas e cinemática inversa (2 ossos) nos braços.
const CR = (() => {
  const SC = Math.SQRT2;
  const FW = 150, FH = 160, OX = 75, OY = 124;
  const DIRS = ['S', 'SE', 'L', 'NE', 'N', 'NO', 'O', 'SO'];
  const TAU = Math.PI * 2;
  const SD = VX.SD, H = VX.hash, M = VX.M;

  const ANIMS = {
    idle:     { n: 4, fps: 3, loop: true, label: 'Parado' },
    walk:     { n: 8, fps: 10, loop: true, label: 'Andando' },
    run:      { n: 8, fps: 14, loop: true, label: 'Correndo' },
    crouch:   { n: 4, fps: 3, loop: true, label: 'Agachado' },
    sneak:    { n: 8, fps: 8, loop: true, label: 'Andando agachado' },
    attack:   { n: 6, fps: 16, loop: false, label: 'Ataque' },
    punch:    { n: 4, fps: 14, loop: false, label: 'Soco / estocada' },
    shoot:    { n: 3, fps: 20, loop: false, label: 'Tiro' },
    aimwalk:  { n: 8, fps: 10, loop: true, label: 'Andando mirando' },
    reload:   { n: 4, fps: 5, loop: false, label: 'Recarregando' },
    throw:    { n: 5, fps: 14, loop: false, label: 'Arremesso' },
    interact: { n: 4, fps: 7, loop: true, label: 'Vasculhando' },
    cast:     { n: 4, fps: 8, loop: true, label: 'Grito / feitiço' },
    hurt:     { n: 2, fps: 8, loop: false, label: 'Dano' },
    death:    { n: 6, fps: 9, loop: false, label: 'Morte' },
  };

  // ---------- paleta e texturas ----------
  const tex = (base, i, amt, f) => { const n = VX.vnoise(i.x * (f || 0.9), i.y * (f || 0.9), i.z * (f || 0.9)); return VX.shade(base, 1 + (n - 0.5) * 2 * (amt || 0.07)); };
  const fabric = (base, i) => { const n = VX.vnoise(i.x * 0.7, i.y * 0.35, i.z * 0.7); return VX.shade(base, 0.9 + n * 0.2); };

  // ---------- especificações humanoides ----------
  const FUNGUS_A = { cap: '#6b3f8e', rim: '#c062d0', spot: '#7ff7e5', gill: '#2a1838', stalk: '#d4cab4' };
  const FUNGUS_B = { cap: '#1e6b6e', rim: '#4fd0c0', spot: '#e7ff6a', gill: '#132a2c', stalk: '#c8c2a8' };
  const SPECS = {
    player: {
      label: 'Dra. Helena Rocha', fem: 1, sh: 0.94, chest: 0.95, belly: 0.86, hipW: 1.02, arm: 0.88, leg: 0.93,
      skin: '#ecbf9c', hair: { style: 'ponytail', c: ['#d4561e', '#f08a3c', '#9a3412'], tip: '#6a2266' },
      face: 'visor', top: { c: '#1e1d24', type: 'suit', lines: '#b0262c' }, belt: '#7a4a28', pouches: 1,
      coat: '#ebe9e3', gloves: '#3d6e9e', pants: { c: '#201f27', stripe: '#9a2026' }, boots: '#19181e',
    },
    inf_civil: {
      label: 'Infectado', sh: 1.02, chest: 1, belly: 1.05, hipW: 1, arm: 1, leg: 1,
      skin: '#a7a596', infected: FUNGUS_A, fungus: 5, seed: 11, eyes: '#ff4adf',
      hair: { style: 'short', c: ['#3a2a1e', '#5a4430', '#24180f'] },
      top: { c: '#46668a', type: 'tshirt', torn: 1 }, pants: { c: '#394660' }, boots: '#4a3626',
    },
    inf_civil2: {
      label: 'Infectada', fem: 1, sh: 0.92, chest: 0.95, belly: 0.9, hipW: 1.04, arm: 0.88, leg: 0.95,
      skin: '#b0a99a', infected: FUNGUS_B, fungus: 5, seed: 23, eyes: '#6af7ff',
      hair: { style: 'long', c: ['#1e1a18', '#3a322c', '#100c0a'] },
      top: { c: '#8a3a30', type: 'plaid', torn: 1 }, pants: { c: '#2e2e34' }, boots: '#2a2420',
    },
    inf_policial: {
      label: 'Policial Infectado', sh: 1.06, chest: 1.05, belly: 1.05, hipW: 1, arm: 1.05, leg: 1,
      skin: '#a39f90', infected: FUNGUS_A, fungus: 4, seed: 37, eyes: '#ff4adf',
      hair: { style: 'short', c: ['#1e1a18', '#2e2824', '#141210'] }, cap: '#1d2a44',
      top: { c: '#2a3c5c', type: 'uniform', torn: 1 }, vest: '#1a1f28', belt: '#141414', pants: { c: '#1f2a40' }, boots: '#111114',
    },
    inf_cientista: {
      label: 'Cientista Infectado', sh: 1, chest: 1, belly: 1, hipW: 1, arm: 0.95, leg: 1,
      skin: '#b8ae98', infected: FUNGUS_B, fungus: 4, seed: 41, eyes: '#6af7ff', face: 'gasmask',
      hair: { style: 'short', c: ['#1e1c1c', '#2c2a2a', '#121010'] },
      top: { c: '#2c3036', type: 'tshirt' }, coat: '#d8d4c0', coatTorn: 1, belt: '#5a4430', gloves: '#1e1f22', pants: { c: '#2a2c2e' }, boots: '#4a3424',
    },
    inf_corredor: {
      label: 'Espreitador', sh: 0.95, chest: 0.88, belly: 0.8, hipW: 0.95, arm: 0.85, leg: 0.92,
      skin: '#b9b8ac', infected: FUNGUS_A, fungus: 6, seed: 53, plates: 1, eyes: '#ff4adf',
      hair: { style: 'none', c: ['#2a2420', '#3a322c', '#1a1614'] }, hood: '#34343e',
      top: { c: '#34343e', type: 'hoodie', torn: 1 }, pants: { c: '#24242a' }, boots: '#d8d8d8',
    },
    inf_inchado: {
      label: 'Inchado', sh: 1.15, chest: 1.35, belly: 1.9, hipW: 1.25, arm: 1.25, leg: 1.2,
      skin: '#b4ad8e', infected: FUNGUS_B, fungus: 3, sacs: 9, seed: 61, eyes: '#e7ff6a',
      hair: { style: 'none', c: ['#2a2420', '#3a322c', '#1a1614'] },
      top: { c: '#d8d0b8', type: 'tank', torn: 1 }, pants: { c: '#4a4232' }, boots: '#2a2018',
    },
    inf_gritador: {
      label: 'Gritador', fem: 1, sh: 0.9, chest: 0.8, belly: 0.72, hipW: 0.95, arm: 0.78, leg: 0.88, armLen: 1.12,
      skin: '#c4bcb0', infected: FUNGUS_A, fungus: 3, frill: 1, seed: 71, eyes: '#ff4adf', mouth: 'split',
      hair: { style: 'long', c: ['#d8d0c4', '#f0e8dc', '#a89c8c'] },
      top: { c: '#e2dccc', type: 'gown', torn: 1 }, pants: { c: '#e2dccc' }, boots: '#b8b0a4',
    },
    inf_brutamonte: {
      label: 'Brutamonte', k: 1.22, sh: 1.3, chest: 1.35, belly: 1.2, hipW: 1.15, arm: 1.6, leg: 1.3, armLen: 1.08,
      skin: '#9c9a8a', infected: FUNGUS_B, fungus: 9, plates: 1, seed: 83, eyes: '#e7ff6a',
      hair: { style: 'none', c: ['#2a2420', '#3a322c', '#1a1614'] },
      top: { c: '#5a4a3a', type: 'tank', torn: 1 }, pants: { c: '#3a4448' }, boots: '#2a2420',
    },
    al_arauto: {
      label: 'Arauto', alien: 1, k: 1.38, sh: 0.82, chest: 0.78, belly: 0.66, hipW: 0.8, arm: 0.7, leg: 0.72, armLen: 1.3,
      skin: '#2a2035', chitin: 1, eyes: '#6af7ff', head: 'arauto',
      hair: { style: 'none', c: ['#000', '#000', '#000'] },
      top: { c: '#2a2035', type: 'skin' }, coat: '#3a1f4a', coatTorn: 2, pants: { c: '#2a2035' }, boots: '#1e1626', gloves: '#1e1626',
    },
  };

  // ---------- construção do humanoide ----------
  function buildHuman(key, itemId) {
    const S = SPECS[key];
    const k = S.k || 1, al = S.armLen || 1;
    const m = new VX.Model();
    const P = (v) => v.map((a) => a * k);
    const hw = S.hipW || 1;
    m.part('hips', null, P([0, 27, 0]));
    m.part('thighL', 'hips', P([-2.3 * hw, -0.5, 0])); m.part('shinL', 'thighL', P([0, -12.2, 0]));
    m.part('thighR', 'hips', P([2.3 * hw, -0.5, 0])); m.part('shinR', 'thighR', P([0, -12.2, 0]));
    m.part('tails', 'hips', P([0, 0.5, 0]));
    m.part('torso', 'hips', [0, 0, 0]);
    m.part('head', 'torso', P([0, 18, 0]));
    m.part('tailA', 'head', P([0, 6.9, -3.7])); m.part('tailB', 'tailA', P([0, -5.4, -1.6]));
    m.part('uarmL', 'torso', P([-5.3 * S.sh, 15, 0])); m.part('farmL', 'uarmL', P([0, -9.6 * al, 0]));
    m.part('uarmR', 'torso', P([5.3 * S.sh, 15, 0])); m.part('farmR', 'uarmR', P([0, -9.6 * al, 0]));
    m.part('item', 'farmR', P([0, -10.2 * al, 0.4]));
    m.part('glow', 'head', [0, 0, 0]);
    m.rig = { k, sh: [5.3 * S.sh * k, 15 * k, 0], L1: 9.6 * al * k, L2: 10.2 * al * k };

    const add = (part, b, f, col) => {
      const info = { x: 0, y: 0, z: 0, n: null };
      const cf = typeof col === 'function' ? col : () => col;
      m.sdf(part, b.map((v) => v * k), (x, y, z) => f(x / k, y / k, z / k) * k, (i) => { info.x = i.x / k; info.y = i.y / k; info.z = i.z / k; info.n = i.n; return cf(info); });
    };
    const inf = S.infected;
    const skinMat = S.chitin ? M.GLOSS : M.SKIN;
    // pele: humana ou infectada (veias, hematomas, nódulos que brilham)
    const skin = (i) => {
      if (S.chitin) {
        const n = VX.fbm(i.x * 0.35, i.y * 0.35, i.z * 0.35);
        if (n > 0.66 && H(i.x, i.y, i.z) > 0.55) return { c: S.eyes, m: M.EMIT };
        return { c: n > 0.55 ? '#3e2f52' : n < 0.35 ? '#1a1322' : S.skin, m: M.GLOSS };
      }
      if (!inf) return { c: tex(S.skin, i, 0.035), m: skinMat };
      const n = VX.fbm(i.x * 0.3 + 7, i.y * 0.3, i.z * 0.3);
      const v = Math.abs(VX.vnoise(i.x * 0.45, i.y * 0.45 + 3, i.z * 0.45) - 0.5);
      if (v < 0.025) return H(i.x, i.y, i.z) > 0.8 ? { c: inf.spot, m: M.EMIT } : { c: '#3b2340', m: 0 };
      if (n > 0.64) return { c: '#7c6a82', m: skinMat };
      if (n < 0.3) return { c: VX.mix(S.skin, '#5d6b48', 0.35), m: skinMat };
      return { c: tex(S.skin, i, 0.05), m: skinMat };
    };
    const hairC = (i) => { const n = VX.vnoise(i.x * 1.8, i.y * 0.35, i.z * 1.8); return n > 0.68 ? S.hair.c[1] : n < 0.3 ? S.hair.c[2] : S.hair.c[0]; };
    const tornHole = (i) => S.top.torn && VX.fbm(i.x * 0.5 + 11, i.y * 0.5, i.z * 0.5) > 0.66;
    const stain = (i, base) => (inf && VX.fbm(i.x * 0.4, i.y * 0.4 + 5, i.z * 0.4) > 0.62 ? VX.mix(base, '#3a2a33', 0.55) : base);

    // ---- pélvis e quadril
    add('hips', [-6, -5, -4.5, 6, 2, 4.5], SD.smooth(1.2, SD.ell(0, -0.6, 0, 4.4 * hw, 3.3, 3.0), SD.ell(0, -1.6, -0.9, 4.2 * hw, 2.8, 2.9)), (i) => {
      if (S.belt && i.y > -0.2) return { c: tex(S.belt, i, 0.1), m: M.GLOSS };
      return fabric(stain(i, S.pants.c), i);
    });
    if (S.pouches) for (const sx of [-1, 1]) add('hips', [sx * 2.6 - 1.6, -2.4, 1.2, sx * 2.6 + 1.6, 1, 4.5], SD.rbox(sx * 2.7, -0.6, 2.9, 1.1, 1.3, 0.9, 0.4), (i) => tex('#6a3e22', i, 0.1));

    // ---- tronco
    const ch = S.chest, bl = S.belly, sh = S.sh;
    const torsoF = SD.smooth(2.2,
      SD.ell(0, 4.6, 0.2, 4.0 * bl, 4.2, 2.8 * bl),
      SD.ell(0, 3.6, 0.8 * bl, 3.6 * bl, 3.4, 2.6 * bl),
      SD.ell(0, 11.3, 0.1, 5.0 * ch * Math.min(1.1, sh), 4.9, 3.1 * ch),
      SD.cap([-4.6 * sh, 14.3, 0], [4.6 * sh, 14.3, 0], 1.9 * Math.min(1.3, ch), 1.9 * Math.min(1.3, ch)),
      SD.cap([0, 14, 0], [0, 18.6, 0.2], 1.55, 1.4),
      ...(S.fem ? [SD.ell(-1.9, 10.4, 2.3 * ch, 1.8, 1.7, 1.4), SD.ell(1.9, 10.4, 2.3 * ch, 1.8, 1.7, 1.4)] : []));
    const tw = 7.5 * Math.max(ch, bl, sh);
    add('torso', [-tw, -1.2, -6 * Math.max(ch, bl), tw, 19.5, 6.5 * Math.max(ch, bl)], torsoF, (i) => {
      const T = S.top;
      if (S.belt && i.y < 1.7 && i.y > 0) return { c: Math.abs(i.x) < 0.7 && i.z > 1.5 ? '#c9a24a' : tex(S.belt, i, 0.1), m: M.GLOSS };
      if (i.y > 16.3 && T.type !== 'suit' && T.type !== 'hoodie') return skin(i);
      if (T.type === 'skin') return skin(i);
      if (T.type === 'tank' && (i.y > 13.5 && Math.abs(i.x) > 2.4)) return skin(i);
      if (tornHole(i)) return skin(i);
      let c = T.c;
      if (T.type === 'suit') {
        if (i.z > 1.2 && Math.abs(Math.abs(i.x) - 1.7) < 0.42 && i.y > 1.8 && i.y < 15.5) return { c: T.lines, m: M.GLOSS };
        if (i.z > 1.2 && Math.abs(i.y - 8.4) < 0.4 && Math.abs(i.x) < 1.7) return { c: T.lines, m: M.GLOSS };
        return { c: tex(c, i, 0.08), m: M.GLOSS };
      }
      if (T.type === 'plaid') c = (Math.floor(i.x * 0.7 + 20) + Math.floor(i.y * 0.7)) % 2 ? VX.shade(c, 0.72) : c;
      if (T.type === 'uniform') {
        if (i.z > 1.5 && Math.abs(i.x - 2.4) < 0.9 && Math.abs(i.y - 12.4) < 0.6) return { c: '#d8b848', m: M.METAL };
        if (i.z > 1.6 && Math.abs(i.x) < 0.3) return VX.shade(c, 0.7);
      }
      if (T.type === 'gown' && VX.vnoise(i.x * 0.6, i.y * 0.2, i.z * 0.6) > 0.7) c = VX.shade(c, 0.85);
      return fabric(stain(i, c), i);
    });
    if (S.vest) add('torso', [-6.5, 3, -4.5, 6.5, 16, 4.5], SD.sub(SD.rbox(0, 9.6, 0.1, 5.3, 5.6, 3.4, 1.6), SD.ell(0, 16.6, 0.4, 2.4, 2.2, 4)), (i) => (i.z > 2.4 && i.y > 4 && i.y < 8 && Math.abs(Math.abs(i.x) - 2.4) < 1.1 ? '#0f1218' : tex(S.vest, i, 0.08)));

    // ---- jaleco / manto (tronco + abas)
    if (S.coat) {
      const coatTex = (i) => {
        const n = VX.vnoise(i.x * 0.5, i.y * 0.25, i.z * 0.5);
        let c = VX.shade(S.coat, 0.9 + n * 0.16);
        if (inf || S.coatTorn) c = stain(i, c);
        return c;
      };
      add('torso', [-tw - 1, -1, -6.5, tw + 1, 17.6, 7], (x, y, z) => Math.max(torsoF(x, y, z) - 0.85, y - 16.8, -y - 0.5), (i) => {
        const open = 1.15 + Math.max(0, i.y - 8) * 0.2;
        if (i.z > 1 && Math.abs(i.x) < open) return null;
        if (S.belt && i.y < 1.7 && i.z > 1) return null;
        if (i.n[1] < -0.85) return null;
        if (S.coatTorn === 2 && VX.fbm(i.x * 0.6, i.y * 0.6, i.z * 0.6) > 0.68) return null;
        if (i.z > 1 && Math.abs(i.x) < open + 1.1) return VX.shade(coatTex(i), 0.86);
        return coatTex(i);
      });
      const skirt = (x, y, z) => {
        const t = Math.max(0, -y);
        const rx = 4.9 * Math.max(hw, bl * 0.9) + t * 0.08, rz = 3.5 * Math.max(1, bl * 0.9) + t * 0.06;
        const d2 = (Math.hypot(x / rx, z / rz) - 1) * Math.min(rx, rz);
        return Math.max(d2, y - 0.5, -14.5 - y);
      };
      add('tails', [-8, -15, -6, 8, 1, 6], skirt, (i) => {
        if (i.z > 0 && Math.abs(i.x) < 1.6 + Math.max(0, -i.y) * 0.08) return null;
        if (i.y < -13.6 && Math.hypot(i.x / 5, i.z / 3.6) < 0.82) return null;
        if (i.y > -0.2 && Math.hypot(i.x / 5, i.z / 3.6) < 0.82) return null;
        if (S.coatTorn && i.y < -9 && VX.fbm(i.x * 0.7, i.y * 0.3, i.z * 0.7) > (S.coatTorn === 2 ? 0.5 : 0.62)) return null;
        if (i.z > 0 && Math.abs(i.y + 6.5) < 0.35 && Math.abs(i.x) > 2.2) return VX.shade(S.coat, 0.72);
        return coatTex(i);
      });
    }

    // ---- braços
    const sleeve = S.coat || S.top.c;
    const armPaint = (seg) => (i) => {
      const sleeveLen = S.top.type === 'tank' || S.top.type === 'skin' ? 99 : S.top.type === 'tshirt' || S.top.type === 'gown' ? -4.5 : -99;
      if (seg === 'f' && i.y < -7.9) return S.gloves ? { c: tex(S.gloves, i, 0.12), m: M.GLOSS } : skin(i);
      const y = seg === 'u' ? i.y : i.y - 9.6;
      if (S.coat && !S.coatTorn) { if (seg === 'f' && i.y < -7.2) return VX.shade(S.coat, 0.8); return VX.shade(S.coat, 0.92 + VX.vnoise(i.x * 0.6, i.y * 0.3, i.z * 0.6) * 0.14); }
      if (S.coat && S.coatTorn) { if (y > -15 && VX.fbm(i.x, i.y * 0.4, i.z) < 0.64) return stain(i, sleeve); return skin(i); }
      if (y > sleeveLen && !(tornHole(i))) return fabric(stain(i, S.top.c), i);
      return skin(i);
    };
    const ar = S.arm;
    for (const s of ['L', 'R']) {
      add('uarm' + s, [-3.5, -10.5 * al, -3, 3.5, 2.5, 3], SD.smooth(1, SD.cap([0, 0, 0], [0, -9.6 * al, 0], 1.75 * ar, 1.35 * ar), SD.ell(0, -1.2, 0, 2.05 * Math.min(ar, 1.4), 2.5, 2.0 * Math.min(ar, 1.4))), armPaint('u'));
      add('farm' + s, [-3, -12.5 * al, -2.5, 3, 1.5, 2.8], SD.smooth(0.8, SD.cap([0, 0, 0], [0, -8.3 * al, 0], 1.35 * ar, 1.0 * ar), SD.ell(0, -9.8 * al, 0.25, 1.05 * Math.min(ar, 1.3), 1.85, 0.8 * Math.min(ar, 1.3)), SD.ell(0, -2.6 * al, -0.2, 1.4 * ar, 2.6, 1.3 * ar)), armPaint('f'));
      if (S.alien) add('farm' + s, [-2, -16 * al, -1, 2, -9 * al, 3], SD.union(SD.cap([-0.6, -10.6 * al, 0.3], [-0.9, -14.6 * al, 1.6], 0.35, 0.12), SD.cap([0.6, -10.6 * al, 0.3], [0.9, -14.6 * al, 1.6], 0.35, 0.12)), { c: '#14101a', m: M.GLOSS });
    }

    // ---- pernas
    const lg = S.leg;
    const legPaint = (seg, sx) => (i) => {
      if (seg === 's' && i.y < -9.4) return { c: tex(S.boots, i, 0.1), m: M.GLOSS };
      if (S.pants.stripe && i.z > 0.9 && i.x * sx > 0.5) return { c: S.pants.stripe, m: M.GLOSS };
      if (S.top.type === 'skin') return skin(i);
      if (S.top.torn && VX.fbm(i.x * 0.5 + 3, i.y * 0.5, i.z * 0.5) > 0.7) return skin(i);
      return fabric(stain(i, S.pants.c), i);
    };
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      add('thigh' + s, [-4, -13, -3.5, 4, 2, 3.5], SD.cap([0, 0, 0], [0, -12.2, 0], 2.45 * lg, 1.75 * lg), legPaint('t', sx));
      add('shin' + s, [-3, -15, -3, 3, 1, 5], SD.smooth(0.9, SD.cap([0, 0, 0], [0, -11.6, 0], 1.7 * lg, 1.15 * lg), SD.ell(0, -4, -0.5, 1.7 * lg, 3.6, 1.7 * lg), SD.rbox(0, -13.2, 1.3, 1.3 * Math.min(lg, 1.2), 1.1, 2.7, 0.8)), legPaint('s', sx));
    }

    // ---- cabeça
    const hs = S.head === 'arauto' ? 1 : 1;
    if (S.head === 'arauto') {
      const skull = SD.smooth(1.4, SD.ell(0, 3.4, 0.6, 2.6, 3.4, 3.0), SD.along(SD.ell(0, 0, 0, 2.4, 5.6, 2.2), [0, 5.6, -2.2], [0, 0.55, -0.85]));
      add('head', [-4, -1, -9, 4, 12, 5], skull, (i) => {
        if (i.z > 2.2 && i.y > 3.6 && i.y < 5.4 && (Math.abs(Math.abs(i.x) - 0.9) < 0.45 || Math.abs(Math.abs(i.x) - 2) < 0.4)) return { c: S.eyes, m: M.EMIT };
        if (i.z > 2.6 && i.y < 2 && Math.abs(i.x) < 1) return '#0a0610';
        return skin(i);
      });
      for (let t = 0; t < 4; t++) add('head', [-3, -6, -1, 3, 2, 5], SD.cap([(t - 1.5) * 0.9, 1.2, 2.4], [(t - 1.5) * 1.4, -4.5 + (t % 2), 3.6], 0.45, 0.15), { c: '#3e2f52', m: M.GLOSS });
    } else {
      const headF = SD.smooth(1.1, SD.ell(0, 4.2, -0.2, 3.15 * hs, 3.85, 3.55), SD.ell(0, 2.4, 0.9, 2.45, 2.1, 2.5), SD.ell(0, 3.6, 3.35, 0.55, 0.85, 0.7), SD.ell(-3.05, 3.8, -0.3, 0.55, 1.0, 0.7), SD.ell(3.05, 3.8, -0.3, 0.55, 1.0, 0.7));
      add('head', [-4.5, -0.5, -4.8, 4.5, 9, 5], headF, (i) => {
        const front = i.z > 1.6 && Math.abs(i.x) < 2.7;
        if (front && Math.abs(i.y - 4.35) < 0.45 && Math.abs(Math.abs(i.x) - 1.25) < 0.55) return S.eyes ? { c: S.eyes, m: M.EMIT } : '#2a1c1a';
        if (front && Math.abs(i.y - 5.15) < 0.3 && Math.abs(Math.abs(i.x) - 1.3) < 0.75) return S.hair.c[2];
        if (front && Math.abs(i.y - 1.85) < 0.4 && Math.abs(i.x) < (S.mouth === 'split' ? 1.5 : 0.9)) return S.mouth === 'split' || inf ? '#1a0610' : '#b8605a';
        if (S.mouth === 'split' && i.z > 1 && i.y < 2.2 && Math.abs(i.x) < 0.4) return { c: inf.spot, m: M.EMIT };
        return skin(i);
      });
      // cabelo
      const st = S.hair.style;
      if (st !== 'none') {
        const region = (x, y, z) => (z > 1.2 ? 5.75 - y : z > -0.8 ? 4.4 - y : (st === 'long' ? -3 : 1.4) - y);
        add('head', [-4.5, -4, -5.5, 4.5, 9.5, 5], SD.inter(SD.ell(0, 4.6, -0.45, 3.55, 4.25, 4.0), region), (i) => hairC(i));
        if (st === 'long') add('head', [-4.5, -6, -5.5, 4.5, 4, 1], SD.smooth(1, SD.cap([-2.4, 3, -1.8], [-2.8, -4, -1.5], 1.3, 0.9), SD.cap([2.4, 3, -1.8], [2.8, -4, -1.5], 1.3, 0.9), SD.cap([0, 3, -3], [0, -4.5, -2.4], 2.2, 1.6)), (i) => hairC(i));
        if (st === 'ponytail') {
          add('head', [-4, 4.5, 1, 2.5, 8, 4.5], SD.ell(-1.1, 6.3, 3.0, 2.5, 1.15, 1.0), (i) => hairC(i));
          add('head', [-4.5, 2, 0, -1.5, 7.5, 4.2], SD.cap([-2.9, 6.6, 2.6], [-3.3, 3.2, 2.4], 0.75, 0.55), (i) => hairC(i));
          add('tailA', [-2.5, -6.5, -3.8, 2.5, 1.5, 1.6], SD.cap([0, 0, 0], [0, -5.4, -1.6], 1.6, 1.3), (i) => (i.y > -0.6 ? '#3a1f3a' : hairC(i)));
          add('tailB', [-2, -7, -2, 2, 1, 2], SD.cap([0, 0, 0], [0, -6.2, 0.2], 1.45, 0.5), (i) => (i.y < -4.6 ? S.hair.tip : i.y < -3.6 ? VX.mix(S.hair.c[0], S.hair.tip, 0.5) : hairC(i)));
        }
      }
      if (S.face === 'visor') {
        const shell = SD.ell(0, 4.2, -0.2, 3.5, 4.2, 3.95);
        add('head', [-4.5, 3, -2, 4.5, 6, 5], (x, y, z) => Math.max(Math.abs(shell(x, y, z)) - 0.38, Math.abs(y - 4.4) - 0.85, -z + 0.2), (i) => {
          if (i.z > 1.6 && Math.abs(i.y - 4.4) < 0.55) return { c: i.x < -0.5 && i.y > 4.4 ? '#b8ffe0' : '#38c884', m: M.GLASS };
          return { c: '#162420', m: M.GLOSS };
        });
      }
      if (S.face === 'gasmask') {
        const shell = SD.ell(0, 3.4, 0.4, 3.4, 3.6, 3.6);
        add('head', [-4.5, -0.5, -1, 4.5, 6.2, 5], (x, y, z) => Math.max(Math.abs(shell(x, y, z)) - 0.4, y - 5.6, -z + 0.4), (i) => tex('#2e3234', i, 0.08));
        for (const sx of [-1.3, 1.3]) add('head', [sx - 1.2, 3.2, 2, sx + 1.2, 5.6, 4.6], SD.cap([sx, 4.4, 2.8], [sx, 4.4, 3.8], 1.0, 1.0), { c: '#58b4bc', m: M.GLASS });
        add('head', [-1.8, -0.2, 3, 1.8, 3.4, 7], SD.cap([0, 1.5, 3.4], [0, 1.2, 6], 1.35, 1.35), (i) => (i.z > 5.6 ? '#15171a' : '#3a3f44'));
      }
      if (S.cap) {
        add('head', [-4.5, 5.5, -5, 4.5, 9.8, 6.5], SD.smooth(0.5, SD.inter(SD.ell(0, 5.8, -0.4, 3.7, 3.6, 4.1), (x, y) => 6.2 - y), SD.rbox(0, 6.4, 3.9, 2.7, 0.25, 1.7, 0.2)), (i) => (Math.abs(i.y - 7.2) < 0.4 ? '#141820' : tex(S.cap, i, 0.06)));
      }
      if (S.hood) add('head', [-5, 0, -6, 5, 9.8, 4], SD.inter(SD.sub(SD.ell(0, 4.6, -0.6, 4.1, 4.8, 4.5), SD.ell(0, 4, 0.8, 3.4, 4.4, 4.1)), (x, y, z) => z - 3), (i) => fabric(S.hood, i));
      if (S.frill) {
        for (let a = 0; a < 7; a++) {
          const ang = -1.4 + a * 0.47, dx = Math.sin(ang), dy = Math.cos(ang);
          add('head', [-8, -1, -6, 8, 13, 2], SD.along(SD.ell(0, 3, 0, 1.6, 3.6, 0.45), [dx * 2.4, 4.5 + dy * 2.4, -2.4], [dx, dy, -0.3]), (i) => (H(i.x, i.y, i.z) > 0.82 ? { c: inf.spot, m: M.EMIT } : VX.mix(inf.cap, inf.rim, Math.max(0, Math.min(1, (Math.hypot(i.x, i.y - 4.5) - 3) / 4)))));
        }
      }
    }

    // ---- fungos
    if (inf) addFungus(m, add, S, k);

    // ---- item na mão
    if (itemId && ITEM_MODELS.has(itemId)) ITEM_MODELS.build[itemId](m, 'item');
    return m;
  }

  const ANCHORS = {
    head: [[0, 8.4, -0.8, 0, 1, -0.2], [-1.8, 7.6, -2.6, -0.4, 0.7, -0.6], [2.2, 7.4, -2, 0.6, 0.7, -0.4], [0, 6, -3.8, 0, 0.3, -1], [2.9, 5.8, 0.4, 1, 0.4, 0]],
    torso: [[4.4, 15.4, 0.4, 0.5, 1, 0.1], [-4.2, 15, -0.6, -0.5, 1, -0.2], [1.8, 12.6, -3.2, 0.2, 0.2, -1], [-2.2, 9.2, -3, -0.3, 0, -1], [2.8, 5.6, -2.6, 0.4, -0.1, -1], [2.2, 11.6, 2.9, 0.4, 0.2, 1], [-3.4, 4.6, 2.2, -0.6, 0, 0.8]],
    uarmL: [[-1.2, -2.6, -1, -1, 0.3, -0.4]], uarmR: [[1.2, -3, -0.8, 1, 0.3, -0.4]],
    thighR: [[1.6, -4, 0.6, 1, 0, 0.4]], farmL: [[-0.9, -3, 0.4, -1, 0, 0.3]],
  };
  function addFungus(m, add, S, k) {
    const R = VX.hash;
    const F = S.infected;
    const list = [];
    for (const part of Object.keys(ANCHORS)) for (const a of ANCHORS[part]) list.push([part, a]);
    const n = Math.min(list.length, S.fungus || 4);
    const chosen = [];
    for (let t = 0; chosen.length < n && t < 60; t++) {
      const q = list[Math.floor(R(S.seed, t, 3) * list.length)];
      if (!chosen.includes(q)) chosen.push(q);
    }
    if (!chosen.some((c) => c[0] === 'head')) chosen.push(list[0]);
    chosen.forEach(([part, a], idx) => {
      const o = [a[0], a[1], a[2]], dir = [a[3], a[4], a[5]];
      const big = R(S.seed, idx, 9);
      const hgt = 1.4 + big * 2.6, rr = 1.4 + big * 2.2;
      const kind = S.plates && part === 'torso' && idx % 2 ? 'plate' : R(S.seed, idx, 5) < 0.3 ? 'puff' : 'cap';
      if (kind === 'cap') {
        const fn = SD.smooth(0.4, SD.cap([0, 0, 0], [0, hgt, 0], 0.75, 0.55), SD.ell(0, hgt + 0.3, 0, rr, 0.55 + rr * 0.32, rr));
        const u = VX.norm(dir);
        add(part, [o[0] - 7, o[1] - 7, o[2] - 7, o[0] + 7, o[1] + 7, o[2] + 7], SD.along(fn, o, dir), (i) => {
          const ly = (i.x - o[0]) * u[0] + (i.y - o[1]) * u[1] + (i.z - o[2]) * u[2];
          if (ly < hgt - 0.1) return Math.hypot(i.x - o[0] - u[0] * ly, i.y - o[1] - u[1] * ly, i.z - o[2] - u[2] * ly) > 1.1 ? F.gill : F.stalk;
          if (H(i.x * 2, i.y * 2, i.z * 2) > 0.86) return { c: F.spot, m: M.EMIT };
          const rad = Math.hypot(i.x - o[0] - u[0] * ly, i.y - o[1] - u[1] * ly, i.z - o[2] - u[2] * ly) / rr;
          return { c: VX.mix(F.cap, F.rim, Math.min(1, rad)), m: M.GLOSS };
        });
      } else if (kind === 'puff') {
        for (let q = 0; q < 4; q++) {
          const c = [o[0] + (R(idx, q, 1) - 0.5) * 2.4, o[1] + (R(idx, q, 2) - 0.5) * 2.4, o[2] + (R(idx, q, 3) - 0.5) * 2.4];
          const r = 0.7 + R(idx, q, 4) * 0.9;
          add(part, [c[0] - 2.5, c[1] - 2.5, c[2] - 2.5, c[0] + 2.5, c[1] + 2.5, c[2] + 2.5], SD.sphere(c[0] + dir[0], c[1] + dir[1], c[2] + dir[2], r), (i) => (H(i.x, i.y, i.z) > 0.55 ? { c: F.spot, m: M.EMIT } : { c: F.rim, m: M.GLOSS }));
        }
      } else {
        add(part, [o[0] - 7, o[1] - 7, o[2] - 7, o[0] + 7, o[1] + 7, o[2] + 7], SD.along(SD.ell(0, 0.6, 0, rr * 1.3, 0.55, rr), o, dir), (i) => (H(i.x, i.y, i.z) > 0.9 ? { c: F.spot, m: M.EMIT } : { c: VX.mix(F.cap, '#2a1838', 0.3), m: M.GLOSS }));
      }
    });
    if (S.sacs) for (let q = 0; q < S.sacs; q++) {
      const ang = R(q, 1, S.seed) * TAU, y = 4 + R(q, 2, S.seed) * 10;
      const bl = S.belly;
      const c = [Math.cos(ang) * 4.2 * bl, y, Math.sin(ang) * 2.9 * bl];
      const r = 1.2 + R(q, 3, S.seed) * 1.4;
      add('torso', [c[0] - 3, c[1] - 3, c[2] - 3, c[0] + 3, c[1] + 3, c[2] + 3], SD.sphere(c[0], c[1], c[2], r), (i) => (VX.vnoise(i.x * 2, i.y * 2, i.z * 2) > 0.62 ? { c: '#5a6b2a', m: M.GLOSS } : { c: F.spot, m: M.EMIT }));
    }
  }

  function scaler(m, G) {
    const info = { x: 0, y: 0, z: 0, n: null };
    return (part, b, f, col) => {
      const cf = typeof col === 'function' ? col : () => col;
      m.sdf(part, b.map((v) => v * G), (x, y, z) => f(x / G, y / G, z / G) * G, (i) => { info.x = i.x / G; info.y = i.y / G; info.z = i.z / G; info.n = i.n; return cf(info); });
    };
  }

  // ---------- rastejador (hexápode) ----------
  function buildCrawler() {
    const m = new VX.Model();
    const G = 1.35, S = scaler(m, G), P = (v) => v.map((q) => q * G);
    m.part('body', null, P([0, 8, 0]));
    m.part('abd', 'body', P([0, 1, -4]));
    m.part('head', 'body', P([0, 0.5, 9]));
    m.part('mandL', 'head', P([-1.2, -0.6, 3.4])); m.part('mandR', 'head', P([1.2, -0.6, 3.4]));
    const chit = (i) => { const n = VX.fbm(i.x * 0.35, i.y * 0.35, i.z * 0.35); return { c: n > 0.6 ? '#4a3a62' : n < 0.35 ? '#17121f' : '#2a2133', m: M.GLOSS }; };
    S('body', [-6, -4, -1, 6, 5, 11], SD.ell(0, 0.3, 4.5, 4.6, 3.2, 5.6), chit);
    S('abd', [-7, -5, -16, 7, 7, 2], SD.smooth(1.5, SD.ell(0, 0.8, -6.5, 5.6, 4.4, 7.4), SD.ell(0, 0, -12, 3.2, 2.6, 3)), (i) => (Math.abs(((i.z % 3) + 3) % 3 - 1.5) < 0.35 && i.y > 1.5 ? { c: '#c062d0', m: M.EMIT } : chit(i)));
    S('head', [-4, -3, -1, 4, 4, 6], SD.ell(0, 0, 2, 3, 2.4, 3.2), (i) => (i.z > 3.4 && i.y > 0.2 && H(i.x * 3, i.y * 3, i.z) > 0.5 ? { c: '#6af7ff', m: M.EMIT } : chit(i)));
    for (const [p, s] of [['mandL', -1], ['mandR', 1]]) S(p, [-3, -2, -1, 3, 1, 5], SD.cap([0, 0, 0], [s * 1.2, -0.6, 3.8], 0.6, 0.15), { c: '#d8cfc0', m: M.GLOSS });
    const zs = [7.5, 4.5, 1.5];
    for (let li = 0; li < 6; li++) {
      const s = li < 3 ? -1 : 1, r = li % 3;
      const u = 'leg' + li + 'u', l = 'leg' + li + 'l';
      m.part(u, 'body', P([s * 3.8, 0.5, zs[r]]));
      m.part(l, u, P([s * 6.4, 3.4, 0]));
      S(u, [-8, -2, -2, 8, 5, 2], SD.cap([0, 0, 0], [s * 6.4, 3.4, 0], 1.0, 0.8), chit);
      S(l, [-6, -12, -2, 6, 1, 2], SD.cap([0, 0, 0], [s * 3.2, -11.4, 0.2], 0.85, 0.25), (i) => (i.y < -9 ? { c: '#d8cfc0', m: M.GLOSS } : chit(i)));
    }
    m.rig = { k: G };
    return m;
  }

  // ---------- vigia (massa flutuante de olhos) ----------
  function buildWatcher() {
    const m = new VX.Model();
    const G = 1.5, S = scaler(m, G), P = (v) => v.map((q) => q * G);
    m.part('core', null, P([0, 38, 0]));
    m.part('halo', 'core', P([0, 0, 0]));
    const flesh = (i) => { const n = VX.fbm(i.x * 0.3, i.y * 0.3, i.z * 0.3); return { c: n > 0.62 ? '#7a3a5a' : n < 0.3 ? '#2a1424' : '#4e2440', m: M.GLOSS }; };
    S('core', [-10, -10, -10, 10, 10, 10], SD.smooth(2.5, SD.sphere(0, 0, 0.6, 7.2), SD.ell(0, 1, -3.6, 8, 7.4, 5.2), SD.ell(-4, -3, -1, 3.5, 3, 3), SD.ell(4.2, 2.6, -2, 3.3, 3.4, 3)), (i) => {
      const r = Math.hypot(i.x, i.y);
      if (i.z > 4.8 && r < 5.4) {
        if (r < 1.6 && Math.abs(i.x) < 0.8) return '#050208';
        if (r < 3.4) return { c: VX.mix('#ffb03a', '#ff3a6a', r / 3.4), m: M.EMIT };
        return { c: VX.vnoise(i.x * 2, i.y * 2, 0) > 0.6 ? '#b85a5a' : '#e8ded4', m: M.GLOSS };
      }
      return flesh(i);
    });
    const eyes = [[-5.5, 4, 2.5], [5.2, -3, 3], [-2.5, -5.6, 3.6], [3, 5.6, 2.4], [-6.4, -1.2, -1], [6.8, 1, -0.5]];
    for (const e of eyes) S('core', [e[0] - 3, e[1] - 3, e[2] - 3, e[0] + 3, e[1] + 3, e[2] + 3], SD.sphere(e[0], e[1], e[2], 1.6), (i) => {
      const d = [i.x - e[0], i.y - e[1], i.z - e[2]], l = Math.hypot(...d) || 1;
      const out = (d[0] * e[0] + d[1] * e[1] + d[2] * (e[2] + 4)) / (l * Math.hypot(e[0], e[1], e[2] + 4));
      return out > 0.8 ? { c: '#6af7ff', m: M.EMIT } : { c: '#e8ded4', m: M.GLOSS };
    });
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * TAU;
      S('halo', [-14, -14, -6, 14, 14, 2], SD.along(SD.cap([0, 0, 0], [0, 4.5, 0], 0.7, 0.1), [Math.cos(ang) * 8, Math.sin(ang) * 8, -2], [Math.cos(ang), Math.sin(ang), 0]), { c: '#ff6adf', m: M.EMIT });
    }
    for (let t = 0; t < 6; t++) {
      const ang = (t / 6) * TAU;
      const base = [Math.cos(ang) * 4, -5, Math.sin(ang) * 3.4 - 1];
      let parent = 'core';
      for (let s = 0; s < 3; s++) {
        const nm = 'ten' + t + s;
        m.part(nm, parent, P(s === 0 ? base : [0, -7, 0]));
        const r0 = 1.3 - s * 0.35, r1 = r0 - 0.35;
        S(nm, [-3, -9, -3, 3, 1, 3], SD.cap([0, 0, 0], [0, -7, 0], r0, Math.max(0.2, r1)), (i) => (s === 2 && i.y < -5 ? { c: '#ff6adf', m: M.EMIT } : flesh(i)));
        parent = nm;
      }
    }
    m.rig = { k: G };
    return m;
  }

  // ---------- tipos ----------
  const HUMAN_ANIMS = ['idle', 'walk', 'run', 'crouch', 'sneak', 'attack', 'punch', 'shoot', 'aimwalk', 'reload', 'throw', 'interact', 'hurt', 'death'];
  const ENEMY_ANIMS = ['idle', 'walk', 'run', 'attack', 'cast', 'hurt', 'death'];
  const TYPES = {
    player: { kind: 'human', spec: 'player', anims: HUMAN_ANIMS },
    inf_civil: { kind: 'human', spec: 'inf_civil', enemy: 1, anims: ENEMY_ANIMS },
    inf_civil2: { kind: 'human', spec: 'inf_civil2', enemy: 1, anims: ENEMY_ANIMS },
    inf_policial: { kind: 'human', spec: 'inf_policial', enemy: 1, anims: ENEMY_ANIMS },
    inf_cientista: { kind: 'human', spec: 'inf_cientista', enemy: 1, anims: ENEMY_ANIMS },
    inf_corredor: { kind: 'human', spec: 'inf_corredor', enemy: 1, anims: ENEMY_ANIMS },
    inf_inchado: { kind: 'human', spec: 'inf_inchado', enemy: 1, anims: ENEMY_ANIMS },
    inf_gritador: { kind: 'human', spec: 'inf_gritador', enemy: 1, anims: ENEMY_ANIMS },
    inf_brutamonte: { kind: 'human', spec: 'inf_brutamonte', enemy: 1, anims: ENEMY_ANIMS },
    al_arauto: { kind: 'human', spec: 'al_arauto', enemy: 1, alien: 1, anims: ENEMY_ANIMS },
    al_rastejador: { kind: 'crawler', enemy: 1, alien: 1, anims: ['idle', 'walk', 'run', 'attack', 'hurt', 'death'] },
    al_vigia: { kind: 'floater', enemy: 1, alien: 1, anims: ['idle', 'walk', 'attack', 'cast', 'hurt', 'death'] },
  };

  // ---------- poses ----------
  const ITEM_CLASS = (id) => (id ? ITEMS[id].kind : null);
  function basis(d, up) {
    const z = VX.norm(d);
    let u = up || [0, 1, 0];
    if (Math.abs(z[0] * u[0] + z[1] * u[1] + z[2] * u[2]) > 0.95) u = [0, 0, 1];
    const x = VX.norm([u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  }
  // IK de dois ossos no espaço do tronco
  function ik(rig, side, T, pole) {
    const s = side === 'L' ? -1 : 1;
    const S = [rig.sh[0] * s, rig.sh[1], rig.sh[2]];
    const L1 = rig.L1, L2 = rig.L2;
    let d = [T[0] - S[0], T[1] - S[1], T[2] - S[2]];
    let dist = Math.hypot(d[0], d[1], d[2]);
    const mx = L1 + L2 - 0.05, mn = Math.abs(L1 - L2) + 0.05;
    const dl = Math.max(mn, Math.min(mx, dist));
    const n = dist > 1e-6 ? [d[0] / dist, d[1] / dist, d[2] / dist] : [0, -1, 0];
    const a = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const pv = pole || [s * 4, -8, -6];
    let p = [pv[0], pv[1], pv[2]];
    const pd = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
    p = VX.norm([p[0] - n[0] * pd, p[1] - n[1] * pd, p[2] - n[2] * pd]);
    const E = [S[0] + n[0] * a + p[0] * h, S[1] + n[1] * a + p[1] * h, S[2] + n[2] * a + p[2] * h];
    const Tc = [S[0] + n[0] * dl, S[1] + n[1] * dl, S[2] + n[2] * dl];
    const u = VX.norm([E[0] - S[0], E[1] - S[1], E[2] - S[2]]);
    const f = VX.norm([Tc[0] - E[0], Tc[1] - E[1], Tc[2] - E[2]]);
    const fd = f[0] * u[0] + f[1] * u[1] + f[2] * u[2];
    let w = [f[0] - u[0] * fd, f[1] - u[1] * fd, f[2] - u[2] * fd];
    if (Math.hypot(w[0], w[1], w[2]) < 1e-4) w = [0, 0, 1];
    w = VX.norm(w);
    const y = [-u[0], -u[1], -u[2]], z = w;
    const x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
    const R1 = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
    const th = Math.acos(Math.max(-1, Math.min(1, fd)));
    return { R1, fr: -th };
  }
  function resolve(P, rig) {
    if (!P.ik) return P;
    for (const s of ['L', 'R']) {
      const t = P.ik[s];
      if (!t) continue;
      const k = rig.k;
      const r = ik(rig, s, [t[0] * k, t[1] * k, t[2] * k], P.ik['pole' + s]);
      P['uarm' + s] = { R: r.R1 };
      P['farm' + s] = { rx: r.fr };
      if (s === 'R' && P.ik.dir) {
        const Rf = VX.mul(r.R1, VX.rot(r.fr, 0, 0));
        P.item = Object.assign(P.item || {}, { R: VX.mul(VX.transpose(Rf), basis(P.ik.dir, P.ik.up)) });
      }
    }
    return P;
  }
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const add3 = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

  function humanPose(type, anim, f, item) {
    const T = TYPES[type], S = SPECS[T.spec], k = S.k || 1;
    const A = ANIMS[anim];
    const p = (f / A.n) * TAU, s = Math.sin(p), c = Math.cos(p), as = Math.abs(s);
    const P = { root: {}, hips: {}, torso: {}, head: {}, uarmL: { rz: -0.08 }, uarmR: { rz: 0.08 }, farmL: { rx: -0.25 }, farmR: { rx: -0.25 }, thighL: {}, thighR: {}, shinL: {}, shinR: {}, tails: {}, tailA: { rx: 0.22 }, tailB: { rx: -0.2 }, item: {}, glow: { hide: true } };
    const Z = T.enemy && !S.alien, AL = S.alien;
    const cls = ITEM_CLASS(item);
    if (!item) P.item.hide = true;
    const legsWalk = (amp, knee, bob) => {
      P.thighL.rx = -amp * s; P.thighR.rx = amp * s;
      P.shinL.rx = knee * Math.max(0, c) + 0.05; P.shinR.rx = knee * Math.max(0, -c) + 0.05;
      P.hips.dy = -bob * as * k;
    };
    const armsSwing = (amp, bend) => {
      P.uarmL.rx = amp * s; P.farmL.rx = -bend - 0.18 * Math.max(0, -s);
      P.uarmR.rx = -amp * s; P.farmR.rx = -bend - 0.18 * Math.max(0, s);
    };
    // pose dos braços conforme o item (fora de ataques)
    const carry = (bob) => {
      bob = bob || 0;
      if (cls === 'melee2') { const R = [3.6, 9.5 + bob, 4.5]; const d = [0.25, 0.82, -0.52]; P.ik = { R, L: add3(R, d, -2.6), dir: d, up: [0, 0, 1] }; }
      else if (cls === 'pistol') { P.uarmR.rx = -0.1 + (P.uarmR.rx || 0) * 0.3; P.farmR.rx = -0.55; P.item.rx = -0.25; }
      else if (cls === 'rifle') { const R = [3.2, 9 + bob, 4.8]; const d = VX.norm([-0.3, -0.32, 1]); P.ik = { R, L: add3(R, d, ITEMS[item].grip2 || 8), dir: d }; }
      else if (cls === 'melee1' || cls === 'throw') { P.farmR.rx = -0.5; P.item.rx = cls === 'throw' ? 0 : -0.35; }
    };
    const aimPose = (rec) => {
      if (cls === 'rifle') { const d = VX.norm([-0.08, 0.02 + rec * 0.12, 1]); const R = add3([2.6, 13.6, 5.2], [0, 0.4, -1.2], rec); P.ik = { R, L: add3(R, d, ITEMS[item].grip2 || 8), dir: d }; P.head.rx = 0.05; }
      else { const d = VX.norm([0, rec * 0.3, 1]); const R = add3([1.2, 14.2, 15.5], [0, 0.8, -1.8], rec); P.ik = { R, L: add3(R, [-0.9, -0.4, -1.3], 1), dir: d, poleL: [-4, -6, -4] }; }
      P.torso.ry = -0.06;
    };

    if (T.kind === 'human' && Z) P.head.rz = 0.22;
    switch (anim) {
      case 'idle':
        P.torso.rx = 0.02 * s; P.head.rx = 0.03 * s; P.tailA.rz = 0.07 * s;
        if (Z) {
          P.torso.rx = 0.14 + 0.03 * s; P.torso.rz = 0.06 * s; P.head.rz = 0.28 + 0.08 * s; P.head.rx = 0.2;
          P.ik = { R: [3.6, 9 + s, 10], L: [-3.4, 8.4 - s, 9.5] };
        } else if (AL) {
          P.torso.rx = 0.08; P.head.rx = 0.25 + 0.05 * s; P.uarmL.rz = -0.2; P.uarmR.rz = 0.2; P.farmL.rx = -0.5 - 0.1 * s; P.farmR.rx = -0.5 + 0.1 * s;
        } else if (!item && type === 'player') {
          P.ik = { L: [-5.4 * S.sh, 2.6, 1.4], poleL: [-8, -2, -3] };
          P.uarmR.rz = 0.1 + 0.03 * s; P.farmR.rx = -0.2;
        } else carry(s * 0.3);
        break;
      case 'walk':
      case 'aimwalk':
        if (Z) {
          legsWalk(0.36, 0.5, 0.8);
          P.ik = { R: [3.2 + 0.6 * s, 14.5 + 0.8 * s, 13], L: [-3.2, 13.8 - 0.8 * s, 12.5] };
          P.torso.rx = 0.18; P.torso.rz = 0.06 * s; P.head.rz = 0.25 + 0.06 * s; P.head.rx = 0.18;
          if (type === 'inf_inchado' || type === 'inf_brutamonte') { P.ik = null; armsSwing(0.25, 0.4); P.uarmL.rz = -0.35; P.uarmR.rz = 0.35; }
        } else if (AL) {
          legsWalk(0.42, 0.9, 1.0); P.torso.rx = 0.1; P.head.rx = 0.2; armsSwing(0.22, 0.3); P.uarmL.rz = -0.15; P.uarmR.rz = 0.15;
        } else {
          legsWalk(0.48, 0.75, 1.1);
          armsSwing(0.38, 0.25);
          P.torso.ry = 0.07 * s; P.torso.rx = 0.04; P.head.ry = -0.05 * s;
          P.tails.rx = 0.05 * as; P.tailA.rx = 0.3 + 0.1 * as; P.tailA.rz = 0.12 * s;
          if (anim === 'aimwalk') aimPose(0); else if (item) carry(as * 0.4);
        }
        break;
      case 'run':
        P.thighL.rx = -0.85 * s; P.thighR.rx = 0.85 * s;
        P.shinL.rx = 0.35 + 1.25 * Math.max(0, c); P.shinR.rx = 0.35 + 1.25 * Math.max(0, -c);
        P.hips.dy = (-1.4 * as + 0.6) * k;
        P.uarmL.rx = 0.75 * s; P.uarmR.rx = -0.75 * s; P.farmL.rx = -1.35; P.farmR.rx = -1.35;
        P.torso.rx = Z ? 0.45 : 0.22; P.torso.ry = 0.1 * s; P.head.rx = Z ? -0.3 : -0.15;
        P.tails.rx = 0.42 + 0.1 * Math.abs(c); P.tailA.rx = 0.75 + 0.15 * c; P.tailA.rz = 0.2 * s; P.tailB.rx = -0.15;
        if (Z) { P.uarmL.rx = 0.9 * s + 0.3; P.uarmR.rx = -0.9 * s + 0.3; P.farmL.rx = -0.6; P.farmR.rx = -0.6; }
        else if (item && cls !== 'melee1' && cls !== 'throw') carry(as);
        break;
      case 'crouch':
      case 'sneak': {
        const mv = anim === 'sneak' ? 1 : 0;
        P.thighL.rx = -1.15 - 0.3 * s * mv; P.thighR.rx = -0.9 + 0.3 * s * mv;
        P.shinL.rx = 1.6 + 0.35 * Math.max(0, c) * mv; P.shinR.rx = 1.4 + 0.35 * Math.max(0, -c) * mv;
        P.hips.dy = (-4.2 - 0.4 * as * mv) * k; P.hips.dz = -0.8 * k;
        P.torso.rx = 0.38 + 0.02 * s * (1 - mv); P.head.rx = -0.3;
        P.uarmL.rx = -0.35 + 0.2 * s * mv; P.uarmR.rx = -0.35 - 0.2 * s * mv; P.farmL.rx = -0.7; P.farmR.rx = -0.7;
        P.tails.rx = 0.55; P.tailA.rx = 0.85; P.tailA.rz = 0.1 * s;
        if (item) carry(0);
        break;
      }
      case 'attack': {
        if (Z || AL) {
          const K = [
            { R: [5, 22, 4], L: [-5, 21.5, 4], t: -0.12, dz: 0 }, { R: [5.5, 23, 6], L: [-5.5, 22.5, 6], t: -0.05, dz: 0.4 },
            { R: [3, 14, 15], L: [-3, 14, 15], t: 0.4, dz: 1.5 }, { R: [2, 9, 14], L: [-2, 9.5, 14], t: 0.5, dz: 1.8 },
            { R: [3, 11, 12], L: [-3, 11, 12], t: 0.35, dz: 1.2 }, { R: [3.4, 13, 12], L: [-3.4, 12.5, 11.5], t: 0.2, dz: 0.4 },
          ][f];
          P.ik = { R: K.R, L: K.L }; P.torso.rx = K.t; P.hips.dz = K.dz * k; P.head.rx = 0.1;
          P.thighL.rx = -0.45; P.thighR.rx = 0.35; P.shinR.rx = 0.25; P.hips.dy = -0.8 * k;
          break;
        }
        if (cls === 'melee2') {
          const K = [
            { R: [6.5, 15, 1.5], d: [0.55, 0.55, -0.62], t: 0.45 }, { R: [7, 16.5, -0.5], d: [0.45, 0.62, -0.64], t: 0.65 },
            { R: [5.5, 13.5, 8], d: [0.85, 0.1, 0.5], t: 0.25 }, { R: [0.8, 12.5, 12], d: [0.05, 0, 1], t: -0.25 },
            { R: [-5.5, 12.5, 8.5], d: [-0.85, 0.05, 0.5], t: -0.6 }, { R: [-3.5, 10.5, 6], d: [-0.5, 0.35, 0.75], t: -0.35 },
          ][f];
          const d = VX.norm(K.d);
          P.ik = { R: K.R, L: add3(K.R, d, -2.6), dir: d, up: [0, 1, 0] };
          P.torso.ry = K.t; P.head.ry = -K.t * 0.6;
        } else {
          const K = [
            { R: [6, 17.5, -1], d: [0.2, 0.9, -0.35] }, { R: [6.5, 20.5, 1.5], d: [0.1, 0.85, 0.5] }, { R: [4.5, 16, 9.5], d: [0, 0.3, 0.95] },
            { R: [1.5, 10, 13], d: [-0.15, -0.5, 0.85] }, { R: [-1.5, 5.5, 10], d: [-0.2, -0.85, 0.4] }, { R: [2.5, 7, 6], d: [0, -0.4, 0.9] },
          ][f];
          P.ik = { R: K.R, dir: VX.norm(K.d), up: [0, 0, 1] };
          P.uarmL.rx = -0.5; P.farmL.rx = -1.2; P.torso.ry = [0.3, 0.4, 0.1, -0.25, -0.35, -0.1][f];
        }
        P.thighL.rx = -0.35; P.thighR.rx = 0.3; P.shinR.rx = 0.25; P.hips.dy = -0.8 * k;
        P.tailA.rz = -(P.torso.ry || 0) * 0.4; P.tails.ry = (P.torso.ry || 0) * 0.5;
        break;
      }
      case 'punch': {
        const R = [[4.5, 13.5, 2], [1.5, 14.5, 16.5], [2, 14, 14], [4, 12.5, 4]][f];
        P.ik = { R, L: [-1.8, 15.5, 8], dir: [0, 0.1, 1], up: [0, 1, 0] };
        P.torso.ry = [0.3, -0.35, -0.3, -0.1][f];
        P.thighL.rx = -0.35; P.thighR.rx = 0.3; P.shinR.rx = 0.25; P.hips.dy = -0.8 * k;
        break;
      }
      case 'shoot':
        aimPose([0, 1, 0.45][f]);
        P.thighL.rx = -0.22; P.thighR.rx = 0.22;
        break;
      case 'reload': {
        const R = cls === 'rifle' ? [3.2, 10, 5] : [3, 11, 9];
        const d = cls === 'rifle' ? VX.norm([-0.25, 0.1, 1]) : VX.norm([-0.3, 0.4, 1]);
        const mag = cls === 'rifle' ? add3(add3(R, d, 3.5), [0, -3, 0], 1) : add3(R, [0, -3, -0.5], 1);
        const L = [lerp3([-3, 8, 6], mag, 0.4), mag, mag, lerp3(mag, add3(R, d, ITEMS[item] && ITEMS[item].grip2 || 4), 0.8)][f];
        P.ik = { R, L, dir: d }; P.head.rx = 0.35;
        break;
      }
      case 'throw': {
        const K = [{ R: [6, 19, -5], d: [0, 1, -0.3] }, { R: [6.5, 21, -3], d: [0, 1, 0.1] }, { R: [4, 18, 8], d: [0, 0.6, 0.8] }, { R: [1.5, 14, 14], d: [0, 0, 1] }, { R: [-1, 9, 9], d: [0, -0.6, 0.8] }][f];
        P.ik = { R: K.R, L: [-3, 16 - f, 12], dir: VX.norm(K.d) };
        P.torso.ry = [0.5, 0.6, 0.1, -0.4, -0.5][f];
        if (f >= 3) P.item.hide = true;
        P.thighL.rx = -0.4; P.thighR.rx = 0.35;
        break;
      }
      case 'interact':
        P.thighL.rx = -0.6; P.thighR.rx = -0.5; P.shinL.rx = 0.95; P.shinR.rx = 0.85; P.hips.dy = -1.8 * k;
        P.torso.rx = 0.55; P.head.rx = -0.05;
        P.ik = { R: [2.5, 3.5 + s, 11], L: [-2.5, 3.5 - s, 11] };
        P.tails.rx = 0.3; P.tailA.rx = 0.9;
        break;
      case 'cast': {
        const a = [0.6, 1, 0.9, 1][f];
        P.ik = { R: [8 * a, 18 + 3 * a, 6], L: [-8 * a, 18 + 3 * a, 6] };
        P.head.rx = AL ? 0.1 : -0.45 * a; P.torso.rx = AL ? 0.15 : -0.15 * a;
        P.glow.hide = false;
        break;
      }
      case 'hurt': {
        const q = f === 0 ? 1 : 0.5;
        P.torso.rx = -0.25 * q; P.head.rx = 0.3 * q; P.hips.dz = -0.6 * q * k;
        P.uarmL.rx = 0.3 * q; P.uarmL.rz = -0.5 * q; P.uarmR.rz = 0.5 * q; P.uarmR.rx = 0.2 * q;
        P.tailA.rx = 0.2;
        if (item) carry(0);
        break;
      }
      case 'death': {
        const a = [0.15, 0.4, 0.8, 1.2, 1.45, 1.55][f];
        const dir = type === 'player' ? -1 : 1;
        const t = a / 1.55;
        P.root.fall = a * dir; P.root.lift = 3.6 * k * t; P.root.slide = -dir * 24 * k * t;
        P.thighL.rx = -0.3 * Math.min(1, f / 2); P.shinL.rx = 0.6 * Math.min(1, f / 2) * (f < 4 ? 1 : 0.4);
        P.thighR.rx = -0.1; P.shinR.rx = 0.3 * (f < 4 ? 1 : 0.2);
        P.uarmL.rz = -0.3 - 0.9 * t; P.uarmR.rz = 0.3 + 1.0 * t;
        P.uarmL.rx = dir * -0.5 * t; P.uarmR.rx = dir * -0.3 * t; P.farmL.rx = -0.4; P.farmR.rx = -0.6;
        P.head.rx = dir * 0.25; P.tailA.rx = 1.5; P.tailB.rx = 0; P.tails.rx = dir * -0.3 * t;
        P.item.hide = true;
        break;
      }
    }
    return P;
  }

  function crawlerPose(anim, f) {
    const A = ANIMS[anim];
    const p = (f / A.n) * TAU;
    const P = { root: {}, body: {}, abd: {}, head: {}, mandL: { ry: -0.2 }, mandR: { ry: 0.2 } };
    const fast = anim === 'run' ? 1.4 : 1;
    for (let li = 0; li < 6; li++) {
      const s = li < 3 ? -1 : 1, r = li % 3;
      const grp = [0, 4, 2].includes(li) ? 0 : Math.PI;
      const base = [0.55, 0, -0.5][r] * (s < 0 ? 1 : -1);
      const u = { ry: base, rz: 0 }, l = { rz: 0 };
      if (anim === 'walk' || anim === 'run') {
        const ph = p + grp;
        u.ry = base + 0.45 * fast * Math.sin(ph) * (s < 0 ? 1 : -1);
        const lift = 0.4 * Math.max(0, Math.cos(ph));
        u.rz = lift * (s < 0 ? -1 : 1);
      } else if (anim === 'idle') u.rz = 0.05 * Math.sin(p + li) * (s < 0 ? -1 : 1);
      P['leg' + li + 'u'] = u; P['leg' + li + 'l'] = l;
    }
    P.body.dy = anim === 'walk' || anim === 'run' ? Math.abs(Math.sin(p * 2)) * 0.6 : 0.2 * Math.sin(p);
    P.abd.ry = 0.08 * Math.sin(p); P.abd.rx = 0.05 * Math.sin(p * 2);
    P.mandL.ry = -0.2 - 0.2 * Math.max(0, Math.sin(p * 2)); P.mandR.ry = -P.mandL.ry;
    if (anim === 'attack') {
      const a = [0.2, 0.5, 0.35, -0.1, 0][Math.min(4, f)] ;
      P.root.pitch = -a; P.body.dz = [0, -1, 3, 5, 1][Math.min(4, f)];
      for (const li of [0, 3]) P['leg' + li + 'u'].rz = (li < 3 ? -1 : 1) * a * 1.6;
      P.mandL.ry = -0.6 + a; P.mandR.ry = 0.6 - a;
    }
    if (anim === 'hurt') { P.root.pitch = 0.15; P.body.dz = -1.5; }
    if (anim === 'death') {
      const t = Math.min(1, f / 4);
      P.root.roll = t * Math.PI; P.root.lift = 19 * t;
      for (let li = 0; li < 6; li++) { const s = li < 3 ? -1 : 1; P['leg' + li + 'u'].rz = s * -0.9 * t; P['leg' + li + 'l'].rz = s * 1.0 * t; }
    }
    return P;
  }

  function watcherPose(anim, f) {
    const A = ANIMS[anim];
    const p = (f / A.n) * TAU;
    const P = { root: {}, core: { dy: 1.6 * Math.sin(p) }, halo: { hide: true } };
    for (let t = 0; t < 6; t++) for (let s = 0; s < 3; s++) P['ten' + t + s] = { rx: 0.22 * Math.sin(p + t * 1.1 + s * 0.7), rz: 0.18 * Math.cos(p * 1 + t * 1.7 + s) };
    P.core.rz = 0.05 * Math.sin(p);
    if (anim === 'attack' || anim === 'cast') {
      P.core.rx = 0.3; P.halo.hide = !(f % 2 === 1 || anim === 'cast');
      P.halo.rz = f * 0.2;
      for (let t = 0; t < 6; t++) P['ten' + t + '0'].rx = -0.7;
    }
    if (anim === 'hurt') P.core.dz = -2;
    if (anim === 'death') {
      const t = Math.min(1, f / 5);
      P.core.dy = -50 * t * t; P.root.roll = 0.9 * t;
      for (let q = 0; q < 6; q++) for (let s = 0; s < 3; s++) P['ten' + q + s] = { rx: 0.9 * t, rz: 0.4 * t * (q % 2 ? 1 : -1) };
    }
    return P;
  }

  function pose(type, anim, f, item) {
    const T = TYPES[type];
    if (T.kind === 'crawler') return crawlerPose(anim, f);
    if (T.kind === 'floater') return watcherPose(anim, f);
    return humanPose(type, anim, f, item);
  }

  // ---------- modelos ----------
  const models = {};
  function model(type, item) {
    const T = TYPES[type];
    const it = T.kind === 'human' && item && ITEM_MODELS.has(item) ? item : null;
    const key = type + '|' + (it || '');
    if (models[key]) return models[key];
    let m;
    if (T.kind === 'crawler') m = buildCrawler();
    else if (T.kind === 'floater') m = buildWatcher();
    else m = buildHuman(T.spec, it);
    return (models[key] = m);
  }
  function heldModel(item) { return item && ITEM_MODELS.has(item) && ['melee1', 'melee2', 'pistol', 'rifle', 'throw'].includes(ITEMS[item].kind) ? item : null; }

  // ---------- cache de quadros com orçamento de tempo ----------
  const atlas = new VX.Atlas(2048);
  const frames = new Map();
  const tmp = new Uint32Array(FW * FH);
  let budget = 1e9;
  const queue = [];
  function key(type, item, anim, dir, f) { return type + '|' + (item || '') + '|' + anim + '|' + dir + '|' + f; }
  function renderOne(type, item, anim, dir, f) {
    const m = model(type, item);
    const P = resolve(pose(type, anim, f, item), m.rig);
    VX.render(m, P, { W: FW, H: FH, ox: OX + 0.5, oy: OY + 0.5, scale: SC, yaw: (dir * Math.PI) / 4, ss: 3, dither: 0.55, out: tmp });
    return atlas.put(tmp, FW, FH);
  }
  function frame(type, item, anim, dir, f, force) {
    item = heldModel(item);
    const kk = key(type, item, anim, dir, f);
    let fr = frames.get(kk);
    if (fr) return fr;
    if (!force && budget <= 0) { if (queue.length < 400) queue.push([type, item, anim, dir, f]); return null; }
    const t0 = performance.now();
    fr = renderOne(type, item, anim, dir, f);
    frames.set(kk, fr);
    budget -= performance.now() - t0;
    return fr;
  }
  function has(type, item, anim, dir, f) { return frames.has(key(type, heldModel(item), anim, dir, f)); }
  function setBudget(ms) { budget = ms; }
  function work(ms) {
    const end = performance.now() + ms;
    while (queue.length && performance.now() < end) {
      const q = queue.shift();
      if (!has(...q)) frame(q[0], q[1], q[2], q[3], q[4], true);
    }
  }
  function prefetch(type, item, anims) {
    for (const a of anims || TYPES[type].anims) for (let d = 0; d < 8; d++) for (let f = 0; f < ANIMS[a].n; f++) if (!has(type, item, a, d, f)) queue.push([type, heldModel(item), a, d, f]);
  }
  function pending() { return queue.length; }

  // desenha o quadro mais próximo disponível
  function draw(ctx, type, item, anim, f, dir, x, y, alpha) {
    const T = TYPES[type];
    if (!T.anims.includes(anim)) anim = anim === 'run' ? 'walk' : 'idle';
    const A = ANIMS[anim];
    f = Math.max(0, Math.min(A.n - 1, f));
    let fr = frame(type, item, anim, dir, f);
    if (!fr) {
      for (let q = 0; q < A.n && !fr; q++) fr = frames.get(key(type, heldModel(item), anim, dir, q));
      if (!fr) fr = frames.get(key(type, heldModel(item), 'idle', dir, 0)) || frames.get(key(type, null, 'idle', dir, 0)) || frame(type, null, 'idle', dir, 0, true);
    }
    if (!fr || !fr.w) return;
    if (alpha != null && alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(fr.cv, fr.sx, fr.sy, fr.w, fr.h, Math.round(x) - OX + fr.dx, Math.round(y) - OY + fr.dy, fr.w, fr.h);
    ctx.globalAlpha = 1;
  }

  // retrato para o bestiário
  const portraits = {};
  function portrait(type) {
    if (portraits[type]) return portraits[type];
    const m = model(type, null);
    const P = resolve(pose(type, TYPES[type].kind === 'human' ? 'idle' : 'idle', 0, null), m.rig);
    const cv = VX.renderFit(m, P, { W: 132, H: 168, yaw: 0.35, dither: 0.6 });
    return (portraits[type] = cv);
  }

  function dirFromVec(wx, wy) {
    const a = Math.atan2(wx - wy, wx + wy);
    return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  }
  function vecFromDir(d) {
    const a = (d * Math.PI) / 4, sx = Math.sin(a), sz = Math.cos(a);
    const wx = (sx + sz) / 2, wy = (sz - sx) / 2, l = Math.hypot(wx, wy);
    return [wx / l, wy / l];
  }

  return { FW, FH, OX, OY, SC, DIRS, ANIMS, TYPES, SPECS, model, pose, resolve, frame, draw, prefetch, work, setBudget, pending, portrait, dirFromVec, vecFromDir, heldModel, atlas };
})();

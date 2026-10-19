'use strict';
// Mundo: tiles isométricos, paredes, objetos (voxel), geração do mapa, colisão, visão e caminhos.
const WORLD = (() => {
  const TW = 32, TH = 16, WALL_H = 46;
  const N = 72;
  const H = VX.hash;

  function iso(x, y) { return [(x - y) * (TW / 2), (x + y) * (TH / 2)]; }
  function unIso(sx, sy) { const a = sx / (TW / 2), b = sy / (TH / 2); return [(a + b) / 2, (b - a) / 2]; }

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- chão ----------
  const F = { GRASS: 0, DIRT: 1, ASPHALT: 2, ROAD_X: 3, ROAD_Y: 4, SIDEWALK: 5, WOOD: 6, TILE: 7, LAB: 8, CONCRETE: 9, MIL: 10, CARPET: 11 };
  const pack = (c) => (255 << 24) | ((c[2] | 0) << 16) | ((c[1] | 0) << 8) | (c[0] | 0);
  function floorColor(type, u, v, ti, tj, vr, px, py) {
    const n = H(px + vr * 40, py, ti * 3 + tj);
    const hx = VX.hex;
    switch (type) {
      case F.GRASS: {
        const base = [hx('#4f6b34'), hx('#58763a'), hx('#4a6331'), hx('#5c7a3c')][vr % 4];
        if (n > 0.93) return hx('#7c9a4c');
        if (n < 0.07) return hx('#3c5228');
        if (vr === 3 && n > 0.86) return hx('#c9b04a');
        return base;
      }
      case F.DIRT: return n > 0.85 ? hx('#8a6e4a') : n < 0.15 ? hx('#5e4a32') : hx('#75603f');
      case F.ASPHALT: case F.ROAD_X: case F.ROAD_Y: {
        if (type === F.ROAD_X && Math.abs(v - 0.5) < 0.05 && u > 0.15 && u < 0.6) return hx('#c9a63a');
        if (type === F.ROAD_Y && Math.abs(u - 0.5) < 0.05 && v > 0.15 && v < 0.6) return hx('#c9a63a');
        if (n > 0.9) return hx('#4c4c52');
        if (n < 0.05) return hx('#2a2a2e');
        return hx('#3a3a40');
      }
      case F.SIDEWALK: {
        if (u < 0.06 || v < 0.06) return hx('#7c7a76');
        return n > 0.9 ? hx('#a4a29c') : hx('#96948e');
      }
      case F.WOOD: {
        const plank = Math.floor(u * 4);
        if ((u * 4) % 1 < 0.12) return hx('#5a3a22');
        const c = [hx('#8a5c36'), hx('#93633a'), hx('#7f5532'), hx('#8f6038')][(plank + vr) % 4];
        return n > 0.92 ? VX.shade(c, 0.85) : c;
      }
      case F.TILE: {
        const ch = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
        if ((u * 2) % 1 < 0.06 || (v * 2) % 1 < 0.06) return hx('#6d6a64');
        return ch ? hx('#d8d2c4') : hx('#8c3a34');
      }
      case F.LAB: {
        if ((u * 2) % 1 < 0.06 || (v * 2) % 1 < 0.06) return hx('#a8b4b8');
        return n > 0.9 ? hx('#e4ecee') : hx('#d4dde0');
      }
      case F.CONCRETE: return n > 0.88 ? hx('#8a8a84') : n < 0.08 ? hx('#62625e') : hx('#7a7a74');
      case F.MIL: {
        if (u < 0.05 || v < 0.05) return hx('#4a4c40');
        return n > 0.88 ? hx('#7a7c66') : hx('#6c6e5a');
      }
      case F.CARPET: return n > 0.8 ? hx('#5a3a5a') : hx('#4c3050');
    }
    return [255, 0, 255];
  }
  const floorSprites = {};
  function floorSprite(type, vr) {
    const key = type * 8 + vr;
    if (floorSprites[key]) return floorSprites[key];
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(TW, TH); const U = new Uint32Array(id.data.buffer);
    for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
      const rx = px + 0.5 - 16, ry = py + 0.5;
      if (Math.abs(rx) / 16 + Math.abs(ry - 8) / 8 > 1.0001) continue;
      const u = (rx / 16 + ry / 8) / 2, v = (ry / 8 - rx / 16) / 2;
      U[py * TW + px] = pack(floorColor(type, Math.min(0.999, Math.max(0, u)), Math.min(0.999, Math.max(0, v)), 0, 0, vr, px, py));
    }
    ctx.putImageData(id, 0, 0);
    return (floorSprites[key] = cv);
  }

  // ---------- paredes ----------
  const STYLES = [
    { name: 'casa', base: '#c9b28a', pat: 'siding' },
    { name: 'tijolo', base: '#9a5a44', pat: 'brick' },
    { name: 'mercado', base: '#8fa3ad', pat: 'panel', stripe: '#c0392b' },
    { name: 'farmacia', base: '#e2e4dc', pat: 'panel', stripe: '#2f9e5a' },
    { name: 'delegacia', base: '#6f8aa8', pat: 'brick', stripe: '#24344a' },
    { name: 'lab', base: '#dfe6ea', pat: 'panel', stripe: '#2a9d9a' },
    { name: 'armazem', base: '#7f8580', pat: 'corr' },
    { name: 'militar', base: '#6b7050', pat: 'block' },
  ];
  const W_NONE = 0, W_WALL = 1, W_WIN = 2, W_DOOR = 3;
  const wallSprites = {};
  // kind: 1 parede, 2 janela, 3 porta fechada, 4 porta aberta, 5 porta quebrada
  function wallSprite(style, side, kind) {
    const key = style + ':' + side + ':' + kind;
    if (wallSprites[key]) return wallSprites[key];
    const S = STYLES[style];
    const Wd = 17, Hd = WALL_H + 12;
    const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(Wd, Hd); const U = new Uint32Array(id.data.buffer);
    const light = side === 'N' ? 0.95 : 0.76;
    const base = VX.hex(S.base);
    const set = (x, y, c) => { if (x >= 0 && x < Wd && y >= 0 && y < Hd) U[y * Wd + x] = pack(c); };
    for (let k = 0; k <= 16; k++) {
      const x = side === 'N' ? k : 16 - k;
      const by = WALL_H + 2 + Math.floor(k / 2);
      const u = k / 16;
      for (let h = 0; h < WALL_H; h++) {
        const y = by - h;
        let c = base;
        const n = H(k, h, style);
        if (S.pat === 'siding') { if (h % 4 === 0) c = VX.shade(base, 0.82); }
        else if (S.pat === 'brick') { const row = Math.floor(h / 3); if (h % 3 === 0 || (k + (row % 2) * 2) % 5 === 0) c = VX.shade(base, 0.75); }
        else if (S.pat === 'panel') { if (k % 8 === 0) c = VX.shade(base, 0.85); }
        else if (S.pat === 'corr') { if (k % 2 === 0) c = VX.shade(base, 0.86); }
        else if (S.pat === 'block') { if (h % 6 === 0 || (k + Math.floor(h / 6) * 4) % 8 === 0) c = VX.shade(base, 0.8); }
        if (S.stripe && h >= 30 && h < 33) c = VX.hex(S.stripe);
        if (h < 3) c = VX.shade(base, 0.6);
        if (n > 0.95) c = VX.shade(c, 0.9);
        let edge = k === 0 || k === 16;
        // aberturas
        if (kind === 2 && u > 0.22 && u < 0.82 && h >= 16 && h < 36) {
          const fr = u < 0.28 || u > 0.76 || h < 18 || h >= 34 || Math.abs(u - 0.52) < 0.04;
          c = fr ? VX.hex('#e8e4da') : (h > 26 && u < 0.5 ? VX.hex('#a8d0e0') : VX.hex('#5f8aa0'));
          if (!fr && H(k, h, 7) > 0.97) c = VX.hex('#d8f0ff');
        }
        if (kind >= 3 && u > 0.18 && u < 0.86 && h < 34) {
          const fr = u < 0.24 || u > 0.8 || h >= 32;
          if (fr) c = VX.hex('#5a3a22');
          else if (kind === 3) {
            c = (k % 4 === 0) ? VX.hex('#6e4426') : VX.hex('#83542e');
            if (Math.abs(u - 0.7) < 0.04 && h > 14 && h < 17) c = VX.hex('#e0c060');
          } else if (kind === 5) {
            if (h < 6 && H(k, h, 3) > 0.5) c = VX.hex('#83542e'); else continue;
          } else continue;
        }
        set(x, y, VX.shade(c, light * (edge ? 0.85 : 1)));
      }
      // tampo
      set(x, by - WALL_H, VX.shade(base, 1.15));
      set(x, by - WALL_H - 1, VX.shade(base, 1.05));
    }
    ctx.putImageData(id, 0, 0);
    return (wallSprites[key] = cv);
  }

  // ---------- objetos (voxel) ----------
  const wood = (i) => (H(i.x, i.y, i.z) > 0.8 ? '#a06c3a' : H(i.x, i.y, i.z) < 0.15 ? '#7a4e28' : '#8f5f32');
  const PROPS = {
    caixa: { name: 'Caixa de madeira', loot: 'caixa', solid: 1, build(m) { m.box('r', -6, 0, -6, 12, 11, 12, (i) => (i.iy % 4 === 0 || i.ix === 0 || i.ix === 11 || i.iz === 0 || i.iz === 11 ? '#6e4424' : wood(i))); } },
    militar: { name: 'Caixa militar', loot: 'militar', solid: 1, build(m) { m.box('r', -7, 0, -5, 14, 8, 10, (i) => (i.top && Math.abs(i.x) < 2 && Math.abs(i.z) < 3 ? '#c9b04a' : i.iy === 7 ? '#3e4626' : (H(i.x, i.y, i.z) > 0.85 ? '#56603a' : '#4d5634'))); m.box('r', -7.5, 2, -5.5, 15, 1, 11, (i) => (i.left || i.right || i.front || i.back ? '#2e3220' : null)); } },
    barril: { name: 'Barril', solid: 1, build(m, v) { const c = ['#a83232', '#2f5f9e', '#c9a12a', '#7a5a32', '#4a7a3a'][v % 5]; m.cyl('r', 'y', 0, 0, 5.5, 0, 14, (i) => (i.k === 3 || i.k === 10 ? VX.shade(c, 0.7) : i.cap1 ? VX.shade(c, 0.85) : H(i.x, i.y, i.z) > 0.9 ? '#7a4a2a' : c)); } },
    lixeira: { name: 'Lixeira', loot: 'lixeira', solid: 1, build(m) { m.cyl('r', 'y', 0, 0, 4.5, 0, 11, (i) => (i.k % 3 === 0 ? '#5c6268' : '#737a80')); m.cyl('r', 'y', 0, 0, 5, 11, 1, '#4f555a'); m.box('r', -1, 12, -0.5, 2, 1, 1, '#2e3236'); } },
    geladeira: { name: 'Geladeira', loot: 'geladeira', solid: 1, build(m) { m.box('r', -5, 0, -4, 10, 24, 8, (i) => (i.front && i.iy === 15 ? '#9aa0a4' : i.front && i.ix === 8 && (i.iy > 17 && i.iy < 22 || i.iy > 8 && i.iy < 13) ? '#5a6064' : tex('#e6e8e4', i))); } },
    prateleira: { name: 'Prateleira', loot: 'prateleira', solid: 1, build(m, v) { shelf(m, ['#c0392b', '#e8b030', '#3a7ac0', '#5aa04a', '#e8e0d0']); } },
    farmacia: { name: 'Estante de remédios', loot: 'farmacia', solid: 1, build(m) { shelf(m, ['#ffffff', '#e05050', '#4a9a6a', '#f0f0f0', '#e08a30'], '#e8ecee'); } },
    armario: { name: 'Armário de cozinha', loot: 'armario', solid: 1, build(m) { m.box('r', -7, 0, -5, 14, 9, 10, (i) => (i.top ? '#d8d4cc' : i.front && (i.ix === 7) ? '#5a3a22' : i.front && i.iy === 5 && (i.ix === 4 || i.ix === 10) ? '#c0c0c0' : wood(i))); } },
    mesa: { name: 'Escrivaninha', loot: 'mesa', solid: 1, build(m) { m.box('r', -7, 7, -5, 14, 2, 10, wood); for (const [x, z] of [[-7, -5], [6, -5], [-7, 4], [6, 4]]) m.box('r', x, 0, z, 1, 7, 1, '#5a3a22'); m.box('r', -3, 9, -3, 6, 5, 1, (i) => (i.front && i.ix > 0 && i.ix < 5 && i.iy > 0 ? '#3a6a8a' : '#2a2c30')); m.box('r', 1, 7, -4, 5, 4, 1, '#6a4a2a'); } },
    lab: { name: 'Bancada de laboratório', loot: 'lab', solid: 1, build(m) { m.box('r', -7, 0, -5, 14, 9, 10, (i) => (i.top ? '#2a3034' : tex('#e8ecee', i))); const cols = ['#3fd08a', '#3ab0e0', '#e05a8a', '#e0c040']; for (let k = 0; k < 4; k++) m.cyl('r', 'y', -5 + k * 3.3, -1 + (k % 2) * 2, 1.1, 9, 3 + (k % 2), (i) => (i.k === 0 || i.cap1 ? '#d8eef4' : cols[k])); } },
    policia: { name: 'Armário de armas', loot: 'policia', solid: 1, build(m) { m.box('r', -6, 0, -3, 12, 22, 6, (i) => (i.front && i.ix === 6 ? '#2a3440' : i.front && i.iy > 17 && i.iy < 20 && i.ix % 2 ? '#2a3440' : tex('#5a6f88', i))); } },
    guardaroupa: { name: 'Guarda-roupa', loot: 'guardaroupa', solid: 1, build(m) { m.box('r', -7, 0, -3.5, 14, 22, 7, (i) => (i.front && i.ix === 7 ? '#4a2e18' : i.front && i.iy === 11 && (i.ix === 6 || i.ix === 8) ? '#d0b060' : wood(i))); } },
    bancada: { name: 'Bancada de ferramentas', loot: 'bancada', solid: 1, build(m) { m.box('r', -7, 7, -5, 14, 2, 10, '#6e5030'); for (const [x, z] of [[-7, -5], [6, -5], [-7, 4], [6, 4]]) m.box('r', x, 0, z, 1, 7, 1, '#4a4a4a'); m.box('r', -6, 9, -4, 4, 2, 3, '#b83a2a'); m.box('r', 1, 9, -2, 5, 1, 1, '#9aa0a6'); m.box('r', -6, 0, -4, 12, 1, 8, '#3a3a3e'); } },
    cama: { name: 'Cama', solid: 1, build(m, v) { const c = ['#3a5a8a', '#8a3a4a', '#4a7a5a'][v % 3]; m.box('r', -6, 0, -7, 12, 5, 14, (i) => (i.iz > 10 ? '#e8e4dc' : i.top || i.iy > 2 ? c : '#5a3a22')); m.box('r', -6, 0, -8, 12, 9, 1, '#5a3a22'); } },
    sofa: { name: 'Sofá', solid: 1, build(m) { m.box('r', -7, 0, -4, 14, 5, 8, '#5a6a3a'); m.box('r', -7, 5, -4, 14, 5, 3, '#4e5c32'); m.box('r', -7, 5, -1, 2, 2, 5, '#4e5c32'); m.box('r', 5, 5, -1, 2, 2, 5, '#4e5c32'); } },
    arvore: { name: 'Árvore', solid: 1, tall: 1, build(m, v) {
      m.cyl('r', 'y', 0, 0, 1.8, 0, 14, (i) => (H(i.x, i.y, i.z) > 0.7 ? '#4a3220' : '#5e4028'));
      if (v % 3 === 2) { for (let k = 0; k < 4; k++) m.ellipsoid('r', 0, 12 + k * 6, 0, 8 - k * 1.8, 4, 8 - k * 1.8, (i) => (H(i.x, i.y, i.z) > 0.75 ? '#2e5a34' : H(i.x, i.y, i.z) < 0.2 ? '#1e3e24' : '#264c2c')); }
      else { const g = v % 3 ? ['#5a7a2e', '#4a6a26', '#6e8e36'] : ['#3e6a2e', '#335a26', '#4e7e36']; m.ellipsoid('r', 0, 20, 0, 9, 8, 9, (i) => { const r = H(i.x, i.y, i.z); return r > 0.75 ? g[2] : r < 0.25 ? g[1] : g[0]; }); m.ellipsoid('r', 3, 25, -2, 5, 4, 5, (i) => (H(i.x, i.y, i.z) > 0.5 ? (v % 3 ? '#6e8e36' : '#4e7e36') : null)); }
    } },
    arbusto: { name: 'Arbusto', solid: 0, build(m) { m.ellipsoid('r', 0, 3, 0, 6, 4, 6, (i) => (H(i.x, i.y, i.z) > 0.7 ? '#5f8a3a' : '#4a7030')); } },
    sacos: { name: 'Sacos de areia', solid: 1, build(m) { for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) m.ellipsoid('r', -5 + k * 5 + (r % 2) * 2.5 - 1.25, 1.5 + r * 3, 0, 3, 1.8, 4, (i) => (H(i.x, i.y, i.z) > 0.8 ? '#a8946a' : '#958258')); } },
    poste: { name: 'Poste', solid: 1, light: 1, build(m) { m.cyl('r', 'y', 0, 0, 1, 0, 34, '#4a4e54'); m.box('r', -1, 33, 0, 2, 1, 7, '#4a4e54'); m.box('r', -2, 31, 5, 4, 2, 3, (i) => (i.bottom ? '#fff2b0' : '#3a3e44')); } },
    barreira: { name: 'Barreira', solid: 1, build(m) { m.box('r', -7, 0, -3, 14, 3, 6, '#9a9890'); m.box('r', -7, 3, -2, 14, 5, 4, (i) => (i.iy === 3 && i.front ? '#c9a03a' : '#a8a69e')); } },
    bolsa: { name: 'Itens no chão', solid: 0, build(m) { m.ellipsoid('r', 0, 2.5, 0, 3.5, 3, 3, '#6a5a3a'); m.box('r', -1, 5, -1, 2, 1, 2, '#4a3e28'); } },
    barricada: { name: 'Barricada', solid: 1, hp: 120, build(m) {
      for (let k = 0; k < 5; k++) m.box('r', -8, k * 3.2, -1, 16, 2, 2, (i) => (H(i.x, i.y, i.z) > 0.8 ? '#a06c3a' : '#8a5a30'));
      m.box('r', -6, 0, 1, 2, 16, 1, '#6a4424'); m.box('r', 4, 0, 1, 2, 16, 1, '#6a4424');
      m.box('r', -1, 0, -2, 2, 16, 1, '#6a4424');
    } },
    carro: { name: 'Carro abandonado', loot: 'carro', solid: 1, big: 1, build(m, v) {
      const C = [['#8a2a2a', '#6a1e1e'], ['#d8d8d4', '#a8a8a4'], ['#2e3440', '#1e2228'], ['#e8e8ec', '#1e2a4a'], ['#c9a03a', '#8a6a20'], ['#3a5a3a', '#2a4028']][v % 6];
      const police = v % 6 === 3;
      m.box('r', -15, 3, -7, 30, 7, 14, (i) => { if (police && i.iy > 2 && (i.left || i.right || i.front || i.back) && Math.abs(i.x) < 6) return C[1]; if (i.iy === 3) return VX.shade(C[0], 0.75); if ((i.left) && i.iy > 2 && Math.abs(i.z) < 5) return '#e8e0b0'; if (i.right && i.iy > 3 && Math.abs(i.z) > 4) return '#c03030'; return H(i.x, i.y, i.z) > 0.93 ? '#6a4a30' : C[0]; });
      m.box('r', -7, 10, -6, 15, 6, 12, (i) => (i.top ? (police ? (Math.abs(i.z) < 1.5 ? (i.x < 0.5 ? '#3050e0' : '#e03030') : C[0]) : C[0]) : (i.iy > 0 && i.iy < 5 && !(i.ix === 0 || i.ix === 14) ? '#2a3a4a' : C[1])));
      for (const [x, z] of [[-9, -7.5], [9, -7.5], [-9, 6.5], [9, 6.5]]) m.cyl('r', 'z', x, 3, 3, z, 1, (i) => (Math.abs(i.u) < 1.2 && Math.abs(i.v) < 1.2 ? '#8a8a8a' : '#1a1a1c'));
    } },
  };
  function tex(base, i) { const r = H(i.x, i.y, i.z); return r > 0.9 ? VX.shade(base, 1.06) : r < 0.1 ? VX.shade(base, 0.92) : base; }
  function shelf(m, cols, frame) {
    frame = frame || '#7a8088';
    m.box('r', -7, 0, -3, 14, 18, 6, (i) => (i.front && !i.left && !i.right && i.iy % 6 !== 0 && !i.top ? null : tex(frame, i)));
    m.box('r', -6, 1, -2, 12, 16, 1, VX.shade(frame, 0.7));
    for (let s = 0; s < 3; s++) for (let k = 0; k < 5; k++) if (H(k, s, 1) > 0.2) {
      const c = cols[(k + s * 2) % cols.length];
      m.box('r', -6 + k * 2.4, 1 + s * 6, -1, 2, 3 + (k % 2), 3, c);
    }
  }
  const propSprites = {};
  function propSprite(type, variant, rot) {
    const key = type + ':' + (variant || 0) + ':' + (rot || 0);
    if (propSprites[key]) return propSprites[key];
    const m = new VX.Model(); m.part('r', null, [0, 0, 0]);
    PROPS[type].build(m, variant || 0);
    const cv = VX.renderFit(m, {}, { scale: Math.SQRT2, yaw: -Math.PI / 4 + (rot ? Math.PI / 2 : 0), pad: 1, edge: 3 });
    return (propSprites[key] = cv);
  }

  // ---------- estado do mapa ----------
  class Map {
    constructor(seed) {
      this.N = N;
      this.seed = seed;
      this.floor = new Uint8Array(N * N);
      this.fvar = new Uint8Array(N * N);
      this.wallN = new Uint8Array(N * N); this.wallW = new Uint8Array(N * N);
      this.styleN = new Uint8Array(N * N); this.styleW = new Uint8Array(N * N);
      this.doorN = new Uint8Array(N * N); this.doorW = new Uint8Array(N * N); // 0 fechada, 1 aberta, 2 quebrada
      this.doorHpN = new Float32Array(N * N); this.doorHpW = new Float32Array(N * N);
      this.bld = new Int16Array(N * N).fill(-1);
      this.propAt = new Int32Array(N * N).fill(-1);
      this.props = [];
      this.buildings = [];
      this.lights = [];
      this.spawn = [36, 36];
      generate(this, rng(seed));
    }
    idx(i, j) { return j * N + i; }
    inb(i, j) { return i >= 0 && j >= 0 && i < N && j < N; }
    prop(i, j) { if (!this.inb(i, j)) return null; const k = this.propAt[j * N + i]; return k >= 0 ? this.props[k] : null; }
    solid(i, j) { if (!this.inb(i, j)) return true; const p = this.prop(i, j); return !!(p && p.solid && !p.dead); }
    // bloqueio de aresta: lado 'N' do tile (i,j) ou 'W'
    edgeBlocked(i, j, side, forSight) {
      if (!this.inb(i, j)) return false;
      const k = j * N + i;
      const w = side === 'N' ? this.wallN[k] : this.wallW[k];
      if (w === W_NONE) return false;
      if (w === W_WIN) return !forSight;
      if (w === W_DOOR) return (side === 'N' ? this.doorN[k] : this.doorW[k]) === 0;
      return true;
    }
    addProp(type, i, j, opt) {
      opt = opt || {};
      const def = PROPS[type];
      const p = { type, i, j, v: opt.v || 0, rot: opt.rot || 0, solid: def.solid, loot: def.loot, items: null, name: def.name, hp: def.hp || 0, big: def.big };
      p.x = i + 0.5; p.y = j + 0.5;
      p.tiles = [[i, j]];
      if (def.big) { const t2 = p.rot ? [i, j + 1] : [i + 1, j]; p.tiles.push(t2); p.x = p.rot ? i + 0.5 : i + 1; p.y = p.rot ? j + 1 : j + 0.5; }
      for (const [a, b] of p.tiles) { if (!this.inb(a, b) || this.propAt[b * N + a] >= 0) return null; }
      p.id = this.props.length;
      this.props.push(p);
      for (const [a, b] of p.tiles) this.propAt[b * N + a] = p.id;
      if (def.light) this.lights.push(p);
      return p;
    }
    removeProp(p) {
      for (const [a, b] of p.tiles) if (this.propAt[b * N + a] === p.id) this.propAt[b * N + a] = -1;
      p.dead = true;
    }
    // pode passar de (i,j) para (i+di, j+dj)? retorna custo ou -1
    stepCost(i, j, di, dj, breaker) {
      const ti = i + di, tj = j + dj;
      if (!this.inb(ti, tj)) return -1;
      const orth = (a, b, da, db) => {
        let c = 1;
        const na = a + da, nb = b + db;
        let side, ei, ej;
        if (da === 1) { side = 'W'; ei = na; ej = b; } else if (da === -1) { side = 'W'; ei = a; ej = b; }
        else if (db === 1) { side = 'N'; ei = a; ej = nb; } else { side = 'N'; ei = a; ej = b; }
        if (this.edgeBlocked(ei, ej, side)) {
          const k = ej * N + ei;
          const isDoor = (side === 'N' ? this.wallN[k] : this.wallW[k]) === W_DOOR;
          if (breaker && isDoor) c += 10; else return -1;
        }
        const p = this.prop(na, nb);
        if (p && p.solid && !p.dead) { if (breaker && p.type === 'barricada') c += 10; else return -1; }
        return c;
      };
      if (di === 0 || dj === 0) return orth(i, j, di, dj);
      const a = orth(i, j, di, 0), b = orth(i, j, 0, dj);
      if (a !== 1 || b !== 1) return -1;
      const c1 = orth(i + di, j, 0, dj), c2 = orth(i, j + dj, di, 0);
      if (c1 !== 1 || c2 !== 1) return -1;
      return 1.414;
    }
    // A* em tiles; devolve lista de [x,y]
    path(sx, sy, tx, ty, breaker, maxNodes) {
      const si = Math.floor(sx), sj = Math.floor(sy), ti = Math.floor(tx), tj = Math.floor(ty);
      if (!this.inb(ti, tj)) return null;
      const key = (i, j) => j * N + i;
      const g = new Map_(), came = new Map_();
      const open = [[0, si, sj]];
      g.set(key(si, sj), 0);
      let n = 0;
      const hfn = (i, j) => Math.hypot(i - ti, j - tj);
      while (open.length && n++ < (maxNodes || 1800)) {
        let bi = 0; for (let q = 1; q < open.length; q++) if (open[q][0] < open[bi][0]) bi = q;
        const [, ci, cj] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
        if (ci === ti && cj === tj) {
          const out = []; let k = key(ci, cj);
          while (k !== key(si, sj)) { out.push([(k % N) + 0.5, Math.floor(k / N) + 0.5]); k = came.get(k); }
          return out.reverse();
        }
        const gc = g.get(key(ci, cj));
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const c = this.stepCost(ci, cj, di, dj, breaker);
          if (c < 0) continue;
          const ni = ci + di, nj = cj + dj, nk = key(ni, nj), ng = gc + c;
          if (g.has(nk) && g.get(nk) <= ng) continue;
          g.set(nk, ng); came.set(nk, key(ci, cj));
          open.push([ng + hfn(ni, nj), ni, nj]);
        }
      }
      return null;
    }
    // linha de visão / tiro entre dois pontos
    los(ax, ay, bx, by, forSight) {
      const d = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(d * 5));
      let pi = Math.floor(ax), pj = Math.floor(ay);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const ci = Math.floor(ax + (bx - ax) * t), cj = Math.floor(ay + (by - ay) * t);
        if (ci !== pi) { if (this.edgeBlocked(Math.max(pi, ci), pj, 'W', forSight)) return false; }
        if (cj !== pj) { if (this.edgeBlocked(ci, Math.max(pj, cj), 'N', forSight)) return false; }
        pi = ci; pj = cj;
      }
      return true;
    }
    // empurra um círculo para fora de paredes e objetos sólidos
    collide(e, r) {
      for (let it = 0; it < 2; it++) {
        const i0 = Math.floor(e.x) - 1, j0 = Math.floor(e.y) - 1;
        for (let j = j0; j <= j0 + 2; j++) for (let i = i0; i <= i0 + 2; i++) {
          if (this.edgeBlocked(i, j, 'N')) pushSeg(e, i, j, i + 1, j, r);
          if (this.edgeBlocked(i, j, 'W')) pushSeg(e, i, j, i, j + 1, r);
          if (this.solid(i, j)) pushBox(e, i + 0.1, j + 0.1, i + 0.9, j + 0.9, r);
        }
      }
      e.x = Math.max(0.3, Math.min(N - 0.3, e.x)); e.y = Math.max(0.3, Math.min(N - 0.3, e.y));
    }
  }
  const Map_ = globalThis.Map;

  function pushSeg(e, x1, y1, x2, y2, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((e.x - x1) * dx + (e.y - y1) * dy) / (dx * dx + dy * dy)));
    const cx = x1 + dx * t, cy = y1 + dy * t;
    let ox = e.x - cx, oy = e.y - cy;
    const d = Math.hypot(ox, oy);
    if (d >= r) return;
    if (d < 1e-6) { ox = dy; oy = -dx; } else { ox /= d; oy /= d; }
    e.x = cx + ox * r; e.y = cy + oy * r;
  }
  function pushBox(e, x0, y0, x1, y1, r) {
    const cx = Math.max(x0, Math.min(x1, e.x)), cy = Math.max(y0, Math.min(y1, e.y));
    let ox = e.x - cx, oy = e.y - cy;
    const d = Math.hypot(ox, oy);
    if (d >= r) return;
    if (d < 1e-6) {
      const l = e.x - x0, rr = x1 - e.x, t = e.y - y0, b = y1 - e.y, mn = Math.min(l, rr, t, b);
      if (mn === l) e.x = x0 - r; else if (mn === rr) e.x = x1 + r; else if (mn === t) e.y = y0 - r; else e.y = y1 + r;
      return;
    }
    e.x = cx + (ox / d) * r; e.y = cy + (oy / d) * r;
  }

  // ---------- geração ----------
  const ROADS = [22, 23, 24, 46, 47, 48];
  const BLOCKS = [[1, 20], [26, 44], [50, 70]];
  const BTYPES = {
    lab:       { style: 5, floor: F.LAB, furn: ['lab', 'lab', 'farmacia', 'geladeira', 'mesa', 'policia', 'prateleira'] },
    casa:      { style: 0, floor: F.WOOD, furn: ['armario', 'geladeira', 'cama', 'guardaroupa', 'sofa', 'mesa'] },
    casa2:     { style: 1, floor: F.CARPET, furn: ['armario', 'geladeira', 'cama', 'guardaroupa', 'sofa', 'mesa'] },
    mercado:   { style: 2, floor: F.TILE, furn: ['prateleira', 'prateleira', 'prateleira', 'geladeira', 'caixa'] },
    farmacia:  { style: 3, floor: F.LAB, furn: ['farmacia', 'farmacia', 'farmacia', 'mesa', 'geladeira'] },
    delegacia: { style: 4, floor: F.CONCRETE, furn: ['policia', 'policia', 'mesa', 'mesa', 'caixa'] },
    armazem:   { style: 6, floor: F.CONCRETE, furn: ['caixa', 'caixa', 'bancada', 'bancada', 'barril', 'militar'] },
    posto:     { style: 7, floor: F.MIL, furn: ['militar', 'militar', 'policia', 'mesa'] },
  };
  const NAMES = { lab: 'Laboratório', casa: 'Casa', casa2: 'Casa', mercado: 'Mercado', farmacia: 'Farmácia', delegacia: 'Delegacia', armazem: 'Armazém', posto: 'Posto Militar' };

  function generate(M, R) {
    const set = (i, j, f) => { if (M.inb(i, j)) M.floor[j * N + i] = f; };
    for (let k = 0; k < N * N; k++) { M.floor[k] = F.GRASS; M.fvar[k] = Math.floor(R() * 4); }
    // trilhas de terra
    for (let k = 0; k < 6; k++) { let x = R() * N, y = R() * N, a = R() * 6; for (let s = 0; s < 40; s++) { set(Math.floor(x), Math.floor(y), F.DIRT); x += Math.cos(a); y += Math.sin(a); a += (R() - 0.5) * 0.6; } }
    // ruas
    for (let a = 0; a < N; a++) for (const r of ROADS) {
      const center = r === 23 || r === 47;
      set(r, a, center ? F.ROAD_Y : F.ASPHALT);
      set(a, r, center ? F.ROAD_X : F.ASPHALT);
    }
    for (const r of ROADS) for (const q of ROADS) set(r, q, F.ASPHALT);
    for (let a = 0; a < N; a++) for (const s of [21, 25, 45, 49]) {
      if (!ROADS.includes(a)) { set(s, a, F.SIDEWALK); set(a, s, F.SIDEWALK); }
    }
    // quarteirões
    const plan = {
      '1,1': ['lab', 'casa'], '0,1': ['mercado', 'casa2'], '2,1': ['farmacia', 'casa'], '1,0': ['delegacia', 'casa2'],
      '1,2': ['armazem', 'casa'], '0,0': ['casa'], '2,2': ['casa2', 'armazem'], '0,2': ['casa'], '2,0': ['posto'],
    };
    for (let bx = 0; bx < 3; bx++) for (let by = 0; by < 3; by++) {
      const [x0, x1] = BLOCKS[bx], [y0, y1] = BLOCKS[by];
      const types = plan[bx + ',' + by] || [];
      const placed = [];
      for (const t of types) {
        for (let tries = 0; tries < 60; tries++) {
          const big = t === 'lab' || t === 'mercado' || t === 'armazem' || t === 'delegacia';
          const w = big ? 9 + Math.floor(R() * 4) : 6 + Math.floor(R() * 3);
          const h = big ? 8 + Math.floor(R() * 3) : 6 + Math.floor(R() * 3);
          const x = x0 + 1 + Math.floor(R() * Math.max(1, x1 - x0 - w - 2));
          const y = y0 + 1 + Math.floor(R() * Math.max(1, y1 - y0 - h - 2));
          if (x + w > x1 || y + h > y1) continue;
          if (placed.some((p) => x < p[0] + p[2] + 2 && x + w + 2 > p[0] && y < p[1] + p[3] + 2 && y + h + 2 > p[1])) continue;
          placed.push([x, y, w, h]);
          building(M, R, t, x, y, w, h);
          break;
        }
      }
    }
    // posto militar: sacos de areia em volta
    const posto = M.buildings.find((b) => b.type === 'posto');
    if (posto) {
      for (let i = posto.x - 3; i <= posto.x + posto.w + 2; i++) for (let j = posto.y - 3; j <= posto.y + posto.h + 2; j++) {
        if (!M.inb(i, j) || M.bld[j * N + i] >= 0) continue;
        set(i, j, F.MIL);
        const ring = i === posto.x - 3 || i === posto.x + posto.w + 2 || j === posto.y - 3 || j === posto.y + posto.h + 2;
        if (ring && !(Math.abs(j - (posto.y + posto.h / 2)) < 1.5) && !(Math.abs(i - (posto.x + posto.w / 2)) < 1.5)) M.addProp('sacos', i, j);
        else if (!ring && R() < 0.12) M.addProp(R() < 0.6 ? 'militar' : 'barril', i, j, { v: 4 });
      }
    }
    // carros nas ruas
    for (let k = 0; k < 18; k++) {
      const vertical = R() < 0.5;
      const lane = ROADS[Math.floor(R() * ROADS.length)];
      const a = 2 + Math.floor(R() * (N - 4));
      if (ROADS.includes(a) || ROADS.includes(a + 1)) continue;
      if (vertical) M.addProp('carro', lane, a, { v: Math.floor(R() * 6), rot: 1 });
      else M.addProp('carro', a, lane, { v: Math.floor(R() * 6) });
    }
    // calçadas: postes e lixeiras
    for (let a = 2; a < N - 2; a++) for (const s of [21, 25, 45, 49]) {
      if (ROADS.includes(a)) continue;
      if (a % 9 === 0) { M.addProp('poste', s, a); M.addProp('poste', a, s); }
      else if (R() < 0.05) M.addProp(R() < 0.8 ? 'lixeira' : 'barril', s, a, { v: 3 });
      else if (R() < 0.05) M.addProp('lixeira', a, s);
    }
    // natureza
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (M.floor[k] !== F.GRASS && M.floor[k] !== F.DIRT) continue;
      if (M.propAt[k] >= 0 || nearBuilding(M, i, j, 2)) continue;
      const edge = Math.min(i, j, N - 1 - i, N - 1 - j);
      const corner = (i < 21 || i > 49) && (j < 21 || j > 49);
      const dens = edge < 3 ? 0.6 : corner ? 0.2 : 0.05;
      const r = R();
      if (r < dens) M.addProp('arvore', i, j, { v: Math.floor(R() * 6) });
      else if (r < dens + 0.03) M.addProp('arbusto', i, j);
      else if (r < dens + 0.035) M.addProp('caixa', i, j);
    }
    const lab = M.buildings.find((b) => b.type === 'lab');
    if (lab) M.spawn = [lab.x + lab.w / 2, lab.y + lab.h / 2];
  }

  function nearBuilding(M, i, j, r) {
    for (let b = j - r; b <= j + r; b++) for (let a = i - r; a <= i + r; a++) if (M.inb(a, b) && M.bld[b * N + a] >= 0) return true;
    return false;
  }

  function building(M, R, type, x, y, w, h) {
    const T = BTYPES[type];
    const id = M.buildings.length;
    const B = { id, type, name: NAMES[type], x, y, w, h, style: T.style };
    M.buildings.push(B);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { M.floor[j * N + i] = T.floor; M.bld[j * N + i] = id; }
    const setN = (i, j, k) => { if (!M.inb(i, j)) return; M.wallN[j * N + i] = k; M.styleN[j * N + i] = T.style; M.doorHpN[j * N + i] = 80; };
    const setW = (i, j, k) => { if (!M.inb(i, j)) return; M.wallW[j * N + i] = k; M.styleW[j * N + i] = T.style; M.doorHpW[j * N + i] = 80; };
    for (let i = x; i < x + w; i++) { setN(i, y, W_WALL); setN(i, y + h, W_WALL); }
    for (let j = y; j < y + h; j++) { setW(x, j, W_WALL); setW(x + w, j, W_WALL); }
    const clear = new Set();
    const keep = (i, j) => { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) clear.add((j + b) * N + i + a); };
    // porta da frente: lado mais perto de uma rua
    const cx = x + w / 2, cy = y + h / 2;
    const dist = (v) => Math.min(...[23, 47].map((r) => Math.abs(r - v)));
    const sides = [
      { s: 'S', d: Math.min(...[23, 47].filter((r) => r > cy).map((r) => r - (y + h)), 99) },
      { s: 'N', d: Math.min(...[23, 47].filter((r) => r < cy).map((r) => y - r), 99) },
      { s: 'E', d: Math.min(...[23, 47].filter((r) => r > cx).map((r) => r - (x + w)), 99) },
      { s: 'W', d: Math.min(...[23, 47].filter((r) => r < cx).map((r) => x - r), 99) },
    ].sort((a, b) => a.d - b.d);
    void dist;
    const door = (side) => {
      const open = R() < 0.3 ? 1 : 0;
      if (side === 'S' || side === 'N') {
        const i = x + 1 + Math.floor(R() * (w - 2)), j = side === 'S' ? y + h : y;
        setN(i, j, W_DOOR); M.doorN[j * N + i] = open; keep(i, j); keep(i, j - 1);
      } else {
        const j = y + 1 + Math.floor(R() * (h - 2)), i = side === 'E' ? x + w : x;
        setW(i, j, W_DOOR); M.doorW[j * N + i] = open; keep(i, j); keep(i - 1, j);
      }
    };
    door(sides[0].s);
    if (R() < 0.6) door(sides[2].s);
    // divisórias internas
    if (w >= 9) {
      const sx = x + 3 + Math.floor(R() * (w - 6));
      const gap = y + 1 + Math.floor(R() * (h - 2));
      for (let j = y; j < y + h; j++) if (j !== gap) setW(sx, j, W_WALL);
      keep(sx, gap); keep(sx - 1, gap);
      if (h >= 8) {
        const sy = y + 3 + Math.floor(R() * (h - 6));
        const g2 = sx + 1 + Math.floor(R() * Math.max(1, x + w - sx - 2));
        for (let i = sx; i < x + w; i++) if (i !== g2) setN(i, sy, W_WALL);
        keep(g2, sy); keep(g2, sy - 1);
      }
    } else if (h >= 8) {
      const sy = y + 3 + Math.floor(R() * (h - 6));
      const gap = x + 1 + Math.floor(R() * (w - 2));
      for (let i = x; i < x + w; i++) if (i !== gap) setN(i, sy, W_WALL);
      keep(gap, sy); keep(gap, sy - 1);
    }
    // janelas
    for (let i = x; i < x + w; i++) for (const j of [y, y + h]) if (M.wallN[j * N + i] === W_WALL && R() < 0.3 && !clear.has(j * N + i)) setN(i, j, W_WIN);
    for (let j = y; j < y + h; j++) for (const i of [x, x + w]) if (M.wallW[j * N + i] === W_WALL && R() < 0.3 && !clear.has(j * N + i)) setW(i, j, W_WIN);
    // móveis encostados nas paredes
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const k = j * N + i;
      if (clear.has(k)) continue;
      const nearWall = M.wallN[k] || M.wallW[k] || (j + 1 < N && M.wallN[k + N]) || (i + 1 < N && M.wallW[k + 1]);
      if (!nearWall) continue;
      if (R() < (type === 'mercado' || type === 'armazem' ? 0.45 : 0.3)) {
        const f = T.furn[Math.floor(R() * T.furn.length)];
        M.addProp(f, i, j, { v: Math.floor(R() * 5) });
      }
    }
    // mercado: gôndolas no meio
    if (type === 'mercado') for (let j = y + 2; j < y + h - 2; j += 3) for (let i = x + 2; i < x + w - 2; i++) if (!clear.has(j * N + i) && R() < 0.6) M.addProp('prateleira', i, j);
    return B;
  }

  return { TW, TH, WALL_H, N, F, W_NONE, W_WALL, W_WIN, W_DOOR, PROPS, STYLES, iso, unIso, rng, Map, floorSprite, wallSprite, propSprite };
})();

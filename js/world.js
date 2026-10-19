'use strict';
// Mundo: pisos, paredes voxel, geração da cidade densa (ruas, calçadas, lotes, casas com cômodos,
// comércio, hospital, delegacia, galpões, laboratório, parque, área militar, periferia com mata),
// colisão, linha de visão e caminhos (A* com heap).
const WORLD = (() => {
  const TW = 48, TH = 24, VPT = 24, WALL_H = 72, SC = Math.SQRT2;
  const H = VX.hash, N3 = VX.vnoise, M = VX.M;
  const MARGIN = 14, BLOCK = 40, COR = 14, NB = 4;
  const N = 2 * MARGIN + NB * BLOCK + (NB + 1) * COR;
  const CORS = []; for (let k = 0; k <= NB; k++) CORS.push(MARGIN + k * (BLOCK + COR));

  function iso(x, y) { return [(x - y) * (TW / 2), (x + y) * (TH / 2)]; }
  function unIso(sx, sy) { const a = sx / (TW / 2), b = sy / (TH / 2); return [(a + b) / 2, (b - a) / 2]; }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- pisos ----------
  const F = {};
  ['GRAMA', 'GRAMA_ALTA', 'TERRA', 'CASCALHO', 'ASFALTO', 'LINHA_X', 'LINHA_Y', 'BORDA_X', 'BORDA_Y', 'ZEBRA_X', 'ZEBRA_Y', 'CALCADA', 'MADEIRA', 'MADEIRA_ESC', 'COZINHA', 'AZULEJO', 'CARPETE', 'CARPETE_AZ', 'CARPETE_VI', 'LAB', 'CONCRETO', 'HOSPITAL', 'VAGA', 'MICELIO', 'CRATERA', 'LOJA', 'PARQUE', 'MILITAR'].forEach((k, i) => (F[k] = i));
  const hx = VX.hex;
  function floorColor(t, u, v, vr, px, py) {
    const n = H(px + vr * 53, py, t * 7 + vr), sn = N3(px * 0.18 + vr * 9, py * 0.36, vr);
    const sh = (c, k) => VX.shade(c, k);
    switch (t) {
      case F.GRAMA: case F.PARQUE: case F.GRAMA_ALTA: {
        const base = t === F.GRAMA_ALTA ? '#3e5a2a' : t === F.PARQUE ? (Math.floor((u + v) * 3) % 2 ? '#5e8a3e' : '#56803a') : ['#4f6e34', '#56763a', '#4a6631', '#5a7a3c'][vr % 4];
        let c = sh(base, 0.88 + sn * 0.24);
        if (n > 0.95) c = hx('#86a854'); else if (n < 0.05) c = hx('#34481f');
        if (vr === 3 && n > 0.985) c = hx(['#e8d84a', '#e8e8f0', '#d86a8a'][Math.floor(n * 1000) % 3]);
        return c;
      }
      case F.TERRA: return sh(n > 0.9 ? '#8a6e4a' : '#75603f', 0.88 + sn * 0.24);
      case F.CASCALHO: return sh(n > 0.7 ? '#9a968c' : n < 0.3 ? '#6a665e' : '#827e74', 0.92 + sn * 0.14);
      case F.ASFALTO: case F.LINHA_X: case F.LINHA_Y: case F.BORDA_X: case F.BORDA_Y: case F.ZEBRA_X: case F.ZEBRA_Y: case F.VAGA: {
        if (t === F.LINHA_X && v < 0.07 && u > 0.1 && u < 0.62) return hx('#d8b43a');
        if (t === F.LINHA_Y && u < 0.07 && v > 0.1 && v < 0.62) return hx('#d8b43a');
        if (t === F.BORDA_X && v > 0.88 && v < 0.95) return hx('#d8d8d0');
        if (t === F.BORDA_Y && u > 0.88 && u < 0.95) return hx('#d8d8d0');
        if (t === F.ZEBRA_X && Math.floor(u * 4) % 2 === 0 && v > 0.08 && v < 0.92) return sh('#e2e2da', 0.92 + sn * 0.1);
        if (t === F.ZEBRA_Y && Math.floor(v * 4) % 2 === 0 && u > 0.08 && u < 0.92) return sh('#e2e2da', 0.92 + sn * 0.1);
        if (t === F.VAGA && u < 0.05) return hx('#d8d8d0');
        const crack = Math.abs(N3(px * 0.12 + vr * 3, py * 0.24, 2) - 0.5) < 0.012;
        if (crack) return hx('#1e1e22');
        return sh(n > 0.92 ? '#4a4a52' : n < 0.06 ? '#2a2a2e' : '#38383e', 0.9 + sn * 0.16);
      }
      case F.CALCADA: {
        if (u < 0.04 || v < 0.04 || Math.abs(u - 0.5) < 0.02 || Math.abs(v - 0.5) < 0.02) return hx('#76746e');
        return sh(n > 0.93 ? '#aaa8a0' : '#98968e', 0.94 + sn * 0.1);
      }
      case F.MADEIRA: case F.MADEIRA_ESC: {
        const base = t === F.MADEIRA ? ['#9a6a3e', '#8f6038', '#a07040', '#946640'] : ['#5e3a22', '#563420', '#664028', '#5a3822'];
        const plank = Math.floor(u * 4);
        if ((u * 4) % 1 < 0.08) return hx(t === F.MADEIRA ? '#5a3a22' : '#2e1c10');
        const off = (plank % 2) * 0.5;
        if (Math.abs(((v + off) % 1) - 0.02) < 0.02) return hx(t === F.MADEIRA ? '#6a4628' : '#3a2414');
        const grain = N3(u * 40 + plank * 7, v * 6, vr);
        return sh(base[(plank + vr) % 4], 0.86 + grain * 0.24);
      }
      case F.COZINHA: { if ((u * 3) % 1 < 0.05 || (v * 3) % 1 < 0.05) return hx('#6d6a64'); return (Math.floor(u * 3) + Math.floor(v * 3)) % 2 ? sh('#e2dccc', 0.96 + sn * 0.06) : sh('#3a3a40', 0.96 + sn * 0.08); }
      case F.AZULEJO: { if ((u * 6) % 1 < 0.1 || (v * 6) % 1 < 0.1) return hx('#a8b4b8'); return sh('#e8eef0', 0.96 + sn * 0.06); }
      case F.LOJA: { if ((u * 2) % 1 < 0.03 || (v * 2) % 1 < 0.03) return hx('#a89c84'); return sh('#d8ccb0', 0.95 + sn * 0.08); }
      case F.CARPETE: case F.CARPETE_AZ: case F.CARPETE_VI: { const b = t === F.CARPETE ? '#7a6a5a' : t === F.CARPETE_AZ ? '#3e5270' : '#6a2e3e'; return sh(b, 0.9 + n * 0.12 + sn * 0.06); }
      case F.LAB: { if ((u * 2) % 1 < 0.035 || (v * 2) % 1 < 0.035) return hx('#a8b4b8'); return sh('#dce4e6', 0.96 + sn * 0.06); }
      case F.HOSPITAL: { if ((u * 2) % 1 < 0.03 || (v * 2) % 1 < 0.03) return hx('#88a49c'); return sh('#b8ccc4', 0.95 + sn * 0.08); }
      case F.CONCRETO: case F.MILITAR: { const b = t === F.MILITAR ? '#6c6e5a' : '#7c7c76'; if (u < 0.025 || v < 0.025) return hx('#5a5a56'); const st = N3(px * 0.08 + vr * 5, py * 0.16, 7); return sh(b, 0.88 + sn * 0.12 - (st > 0.72 ? 0.12 : 0)); }
      case F.MICELIO: {
        const vein = Math.abs(N3(px * 0.15 + vr * 7, py * 0.3, 3) - 0.5);
        if (vein < 0.018) return hx(n > 0.5 ? '#7ff7e5' : '#d06aff');
        if (vein < 0.05) return hx('#6b3f8e');
        return sh(sn > 0.6 ? '#3a2448' : '#2a1a36', 0.9 + n * 0.15);
      }
      case F.CRATERA: { const c = N3(px * 0.1, py * 0.2, vr); return sh(c > 0.6 ? '#2a2420' : '#1a1614', 0.9 + n * 0.2); }
    }
    return [255, 0, 255];
  }
  const pack = (c) => (255 << 24) | ((Math.max(0, Math.min(255, c[2])) | 0) << 16) | ((Math.max(0, Math.min(255, c[1])) | 0) << 8) | (Math.max(0, Math.min(255, c[0])) | 0);
  const floorSprites = {};
  function floorSprite(t, vr) {
    const key = t * 8 + vr;
    if (floorSprites[key]) return floorSprites[key];
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(TW, TH); const U = new Uint32Array(id.data.buffer);
    for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
      const rx = px + 0.5 - TW / 2, ry = py + 0.5;
      if (Math.abs(rx) / (TW / 2) + Math.abs(ry - TH / 2) / (TH / 2) > 1.0001) continue;
      const u = (rx / (TW / 2) + ry / (TH / 2)) / 2, v = (ry / (TH / 2) - rx / (TW / 2)) / 2;
      U[py * TW + px] = pack(floorColor(t, Math.min(0.999, Math.max(0, u)), Math.min(0.999, Math.max(0, v)), vr, px, py));
    }
    ctx.putImageData(id, 0, 0);
    return (floorSprites[key] = cv);
  }

  // ---------- estilos de parede ----------
  const W = { NONE: 0, WALL: 1, WINDOW: 2, DOOR: 3, DOORWAY: 4, STORE: 5, GARAGE: 6 };
  const brick = (base, mortar) => (u, y) => { const row = Math.floor(y / 3.2); const off = (row % 2) * 4; return (y % 3.2) < 0.7 || ((u + off) % 8) < 0.7 ? mortar : VX.shade(base, 0.9 + H(Math.floor((u + off) / 8), row, 3) * 0.2); };
  const siding = (base) => (u, y) => ((y % 4.8) < 0.8 ? VX.shade(base, 0.78) : VX.shade(base, 0.96 + N3(u * 0.3, y * 0.2, 1) * 0.08));
  const plaster = (base, base2) => (u, y) => (y < 4 ? VX.shade(base2 || '#e8e4dc', 0.85) : Math.abs(y - 30) < 0.8 ? VX.shade(base, 0.85) : VX.shade(base, 0.95 + N3(u * 0.2, y * 0.2, 2) * 0.08));
  const tiles = (base, line, sz) => (u, y) => ((u % sz) < 0.6 || (y % sz) < 0.6 ? line : VX.shade(base, 0.97 + H(Math.floor(u / sz), Math.floor(y / sz), 5) * 0.06));
  const panel = (base) => (u, y) => ((u % 12) < 0.7 || (y % 24) < 0.7 ? VX.shade(base, 0.75) : VX.shade(base, 0.95 + N3(u * 0.1, y * 0.1, 3) * 0.1));
  const corr = (base) => (u, y) => { const n = VX.fbm(u * 0.08, y * 0.06, 4); const r = n > 0.64; return r ? VX.mix('#7a3e1e', '#a0582a', H(u, y, 1)) : VX.shade(base, (u % 3) < 1.5 ? 0.82 : 1.02); };
  const planks = (base) => (u, y) => ((u % 6) < 0.8 ? VX.shade(base, 0.55) : VX.shade(base, 0.85 + N3(u * 0.4, y * 0.05, 6) * 0.3));
  const STYLES = [
    { id: 'tijolo', face: brick('#9a4a36', '#c8b8a0') },
    { id: 'tijolo_cinza', face: brick('#8a8480', '#bab4ac') },
    { id: 'siding_azul', face: siding('#7a98b0') },
    { id: 'siding_creme', face: siding('#d8ccaa') },
    { id: 'siding_verde', face: siding('#8aa088') },
    { id: 'siding_amarelo', face: siding('#d8b868') },
    { id: 'reboco_rosa', face: plaster('#d8a8a0', '#b88880') },
    { id: 'concreto', face: panel('#9a9890') },
    { id: 'metal', face: corr('#8a9298') },
    { id: 'metal_azul', face: corr('#4a6a8a') },
    { id: 'azulejo_ext', face: tiles('#e4e8ea', '#b8c0c4', 6) },
    { id: 'madeira_ext', face: planks('#7a5232') },
    // interiores (índice 12+)
    { id: 'int_creme', face: plaster('#e8dcc0') },
    { id: 'int_verde', face: plaster('#a8c0a0') },
    { id: 'int_azul', face: plaster('#a8bcd0') },
    { id: 'int_rosa', face: plaster('#e0b8b0') },
    { id: 'int_branco', face: plaster('#eceae4', '#c8c4bc') },
    { id: 'int_azulejo', face: tiles('#f0f2f2', '#b8c4c8', 4) },
    { id: 'int_cozinha', face: (u, y) => (y < 36 && y > 24 ? tiles('#e8e0c8', '#a89c84', 4)(u, y) : plaster('#f0e8d0')(u, y)) },
    { id: 'int_madeira', face: (u, y) => (y < 28 ? planks('#7a5232')(u, y) : plaster('#e8dcc0')(u, y)) },
    { id: 'int_papel', face: (u, y) => (y < 4 ? '#6a4a30' : (Math.floor(u / 3) % 3 === 0 ? '#8a6a8a' : '#c8b0c0')) },
    { id: 'int_lab', face: (u, y) => (Math.abs(y - 26) < 1.2 ? '#2a9d9a' : panel('#e4ecee')(u, y)) },
    { id: 'int_hospital', face: (u, y) => (y < 30 ? VX.shade('#9ac0b4', 0.96 + N3(u * 0.2, y * 0.2, 1) * 0.06) : plaster('#eef2f0')(u, y)) },
    { id: 'int_concreto', face: panel('#a8a6a0') },
    // cercas (índice 24+)
    { id: 'cerca_arame', fence: 1, see: 1, h: 44 },
    { id: 'cerca_madeira', fence: 1, h: 40 },
    { id: 'muro', fence: 1, see: 1, h: 30, face: panel('#a8a49c') },
  ];
  const S = {}; STYLES.forEach((s, i) => (S[s.id] = i));
  const DOORS = [
    { c: '#7a4a28', panel: 1 }, { c: '#e8e6e0', panel: 1 }, { c: '#8a5a34', glass: 1 }, { c: '#7a8088', metal: 1 }, { c: '#b83a2a', panel: 1 }, { c: '#4a7a4a', panel: 1 },
  ];

  // modelo voxel de um segmento de parede (lado N; o lado W é o mesmo modelo girado)
  function buildWall(m, styleIdx, kind, state, dstyle, interior, cut) {
    const st = STYLES[styleIdx];
    const Hh = cut ? 12 : (st.h || WALL_H);
    const face = st.face || ((u, y) => '#8a8a8a');
    const R = 'r';
    const capC = '#38363a';
    if (st.fence) {
      if (st.id === 'cerca_arame') {
        for (const x of [0.5]) m.sdf(R, [-1.5, 0, -1.5, 2.5, Hh + 1, 1.5], VX.SD.cylY(x, 0, 0.9, 0, Hh), { c: '#8a9096', m: M.METAL });
        m.sdf(R, [0, Hh - 2, -1, 24, Hh + 1, 1], VX.SD.cap([0, Hh - 0.5, 0], [24, Hh - 0.5, 0], 0.6, 0.6), { c: '#8a9096', m: M.METAL });
        if (kind === W.DOOR && state === 1) return;
        for (let u = 0; u < 24; u++) for (let y = 0; y < Hh - 1; y++) {
          const a = ((u + y) % 6 + 6) % 6, b = ((u - y) % 6 + 6) % 6;
          if (a < 1 || b < 1) m.add(R, u + 0.5, y + 0.5, 0, H(u, y, 1) > 0.97 ? '#7a5a3a' : '#b8bdc2', [0, 0, 1], M.METAL);
        }
        return;
      }
      if (st.id === 'cerca_madeira') {
        if (kind === W.DOOR && state === 1) { m.box(R, 0, 0, -1, 2, Hh, 2, '#6a4424'); return; }
        for (let u = 0; u < 24; u += 4) m.box(R, u + 0.4, 0, -0.8, 3.2, Hh - (u % 8 ? 0 : 2), 1.6, (i) => VX.shade('#8a6a44', 0.85 + N3(i.x * 0.4, i.y * 0.1, 2) * 0.3));
        m.box(R, 0, Hh * 0.3, -1.6, 24, 2, 0.8, '#6a4a2c'); m.box(R, 0, Hh * 0.75, -1.6, 24, 2, 0.8, '#6a4a2c');
        return;
      }
    }
    const t0 = st.fence ? -2 : -2.5, t1 = st.fence ? 2 : 2.5;
    // aberturas
    let hole = null;
    if (kind === W.WINDOW) hole = [4, 20, 26, 56];
    else if (kind === W.DOOR || kind === W.DOORWAY) hole = [3, 21, 0, 62];
    else if (kind === W.STORE) hole = [1, 23, 6, 64];
    else if (kind === W.GARAGE) hole = [1, 23, 0, 58];
    const inHole = (u, y) => hole && u > hole[0] && u < hole[1] && y > hole[2] && y < hole[3];
    for (let iu = 0; iu < 24; iu++) for (let iy = 0; iy < Hh; iy++) {
      const u = iu + 0.5, y = iy + 0.5;
      if (inHole(u, y)) {
        // laterais da abertura (espessura)
        continue;
      }
      const top = iy === Hh - 1;
      const holeEdge = hole && ((Math.abs(u - hole[0]) < 1 || Math.abs(u - hole[1]) < 1) && y > hole[2] && y < hole[3] || (Math.abs(y - hole[3]) < 1 || (hole[2] > 0 && Math.abs(y - hole[2]) < 1)) && u > hole[0] && u < hole[1]);
      for (let iz = 0; iz < t1 - t0; iz++) {
        const z = t0 + iz + 0.5;
        const front = iz === t1 - t0 - 1, back = iz === 0;
        const endL = iu === 0, endR = iu === 23;
        const nearHole = hole && ((u > hole[0] - 1 && u < hole[0] + 0.01 || u < hole[1] + 1 && u > hole[1] - 0.01) && y > hole[2] && y < hole[3] || (y > hole[3] - 0.01 && y < hole[3] + 1 || hole[2] > 0 && y < hole[2] + 0.01 && y > hole[2] - 1) && u > hole[0] && u < hole[1]);
        if (!(front || back || top || endL || endR || nearHole)) continue;
        let c, n;
        if (top) { c = capC; n = [0, 1, 0]; }
        else if (front) { c = face(u, y, interior); n = [0, 0, 1]; if (holeEdge) c = kind === W.STORE ? '#3a3e44' : '#ece8e0'; }
        else if (back) { c = face(u, y, interior); n = [0, 0, -1]; }
        else if (nearHole) { c = '#ece8e0'; n = [0, 0, 1]; }
        else { c = VX.shade(face(u, y, interior), 0.85); n = [endL ? -1 : 1, 0, 0]; }
        m.add(R, u, y, z, c, n, 0);
      }
    }
    if (cut) return;
    if (kind === W.WINDOW) {
      const broken = state === 1;
      for (let u = 4; u < 20; u++) for (let y = 26; y < 56; y++) {
        const uu = u + 0.5, yy = y + 0.5;
        const fr = Math.abs(uu - 12) < 0.6 || Math.abs(yy - 41) < 0.6;
        if (fr) { m.add(R, uu, yy, 0, '#ece8e0', [0, 0, 1], 0); continue; }
        if (broken && H(u, y, 9) > 0.25 && Math.abs(yy - 26) > 3) continue;
        const refl = (uu + yy * 0.6) % 14 < 2.2;
        m.add(R, uu, yy, 0, refl ? '#d8f0ff' : interior ? '#6a8aa0' : '#4a6a84', [0, 0, 1], M.GLASS);
      }
      m.box(R, 3, 24.5, 0, 18, 1.5, 4, '#e8e4dc');
      if (interior) { for (const s of [0, 1]) m.box(R, s ? 16 : 4, 30, 2.6, 4, 27, 1.2, (i) => VX.shade(['#b04a4a', '#4a7ab0', '#c8a040', '#6a9a5a'][styleIdx % 4], 0.85 + ((i.x | 0) % 2) * 0.15)); }
    }
    if (kind === W.STORE) {
      const broken = state === 1;
      for (let u = 1; u < 23; u++) for (let y = 6; y < 64; y++) {
        const uu = u + 0.5, yy = y + 0.5;
        if (Math.abs(uu - 12) < 0.7) { m.add(R, uu, yy, 0, '#3a3e44', [0, 0, 1], M.METAL); continue; }
        if (broken && H(u, y, 4) > 0.2 && yy > 9) continue;
        m.add(R, uu, yy, 0, (uu + yy * 0.6) % 16 < 2.5 ? '#e0f4ff' : '#5a7a90', [0, 0, 1], M.GLASS);
      }
    }
    if (kind === W.GARAGE && state === 0) m.box(R, 1, 0, -0.5, 22, 58, 1, (i) => ({ c: (i.y | 0) % 4 === 0 ? '#6a7076' : '#a0a6ac', m: M.METAL }));
    if (kind === W.DOOR) {
      const D = DOORS[dstyle % DOORS.length];
      const leaf = (i) => {
        if (D.glass && i.y > 20 && i.y < 56 && (Math.abs(i.x - 12) < 6 || Math.abs(i.z - 10) < 7)) return { c: '#6a8aa0', m: M.GLASS };
        if (D.panel && (((i.y > 34 && i.y < 56) || (i.y > 8 && i.y < 30)) && ((i.x > 6 && i.x < 18) || (i.z > 4 && i.z < 16))) && H(i.x, i.y, 1) > 0.0) return VX.shade(D.c, 0.85);
        return D.metal ? { c: D.c, m: M.METAL } : VX.shade(D.c, 0.92 + N3(i.x * 0.3, i.y * 0.08, i.z * 0.3) * 0.16);
      };
      if (state === 0) { m.box(R, 3, 0, -1, 18, 62, 2, leaf); m.sdf(R, [15, 28, 0, 19, 33, 4], VX.SD.sphere(17.5, 30.5, 1.8, 1), { c: '#d8b848', m: M.METAL }); }
      else if (state === 1) m.box(R, 3, 0, 1, 2, 62, 18, (i) => leaf({ x: 12, y: i.y, z: i.z }));
      else { m.box(R, 4, 0, 3, 14, 2, 10, leaf); m.box(R, 3, 0, -1, 2, 20, 2, leaf); }
    }
  }
  // tamanho fixo e origem para sprites de parede (garante emenda perfeita entre tiles)
  const WF = { W: 104, H: 150, ox: 52, oy: 122 };
  const wallSprites = new Map();
  let wallBudget = 1e9;
  function wallSprite(styleIdx, side, kind, state, dstyle, interior, cut) {
    const key = [styleIdx, side, kind, state, dstyle, interior ? 1 : 0, cut ? 1 : 0].join(':');
    let s = wallSprites.get(key);
    if (s) return s;
    if (wallBudget <= 0) return null;
    const t0 = performance.now();
    const m = new VX.Model(); m.part('r', null, [0, 0, 0]);
    buildWall(m, styleIdx, kind, state, dstyle, interior, cut);
    const yaw = side === 'N' ? -Math.PI / 4 : Math.PI / 4;
    const out = VX.render(m, {}, { W: WF.W, H: WF.H, ox: WF.ox, oy: WF.oy, scale: SC, yaw, ss: 3, outline: false, dither: 0.35, ao: 0.4, inner: false });
    const bb = VX.bbox(out, WF.W, WF.H) || { x0: 0, y0: 0, x1: 0, y1: 0 };
    const cv = VX.toCanvas(out, WF.W, WF.H, bb);
    cv.ox = WF.ox - bb.x0; cv.oy = WF.oy - bb.y0;
    wallSprites.set(key, cv);
    wallBudget -= performance.now() - t0;
    return cv;
  }

  // ---------- mapa ----------
  class CityMap {
    constructor(seed) {
      this.N = N; this.seed = seed;
      const A = N * N;
      this.floor = new Uint8Array(A); this.fvar = new Uint8Array(A);
      for (const s of ['N', 'W']) {
        this['w' + s] = new Uint8Array(A);       // tipo
        this['ws' + s] = new Uint8Array(A);      // estilo da face visível
        this['wst' + s] = new Uint8Array(A);     // estado (porta: 0 fechada, 1 aberta, 2 quebrada; janela: 1 quebrada)
        this['wd' + s] = new Uint8Array(A);      // estilo da porta
        this['wb' + s] = new Int16Array(A).fill(-1); // prédio dono
        this['whp' + s] = new Float32Array(A);
      }
      this.bld = new Int16Array(A).fill(-1);
      this.room = new Int16Array(A).fill(-1);
      this.propAt = new Int32Array(A).fill(-1);
      this.props = []; this.buildings = []; this.rooms = []; this.decals = []; this.nests = []; this.spawnPts = [];
      this.spawn = [N / 2, N / 2];
      this.R = rng(seed);
      generate(this);
    }
    inb(i, j) { return i >= 0 && j >= 0 && i < N && j < N; }
    k(i, j) { return j * N + i; }
    prop(i, j) { if (!this.inb(i, j)) return null; const q = this.propAt[j * N + i]; return q >= 0 ? this.props[q] : null; }
    solid(i, j) { if (!this.inb(i, j)) return true; const p = this.prop(i, j); return !!(p && p.solid && !p.dead); }
    // aresta bloqueada? side 'N' = borda norte do tile (i,j); 'W' = borda oeste
    edge(i, j, side, mode) {
      if (!this.inb(i, j)) return false;
      const k = j * N + i;
      const kind = this['w' + side][k];
      if (!kind) return false;
      const st = this['wst' + side][k];
      if (kind === W.DOORWAY) return false;
      if (kind === W.DOOR) return st === 0;
      if (mode === 'sight') {
        if (kind === W.WINDOW || kind === W.STORE) return false;
        if (kind === W.WALL && STYLES[this['ws' + side][k]].see) return false;
        return true;
      }
      if (mode === 'shot') {
        if (kind === W.WINDOW || kind === W.STORE) return false;
        if (kind === W.WALL && STYLES[this['ws' + side][k]].see) return STYLES[this['ws' + side][k]].id === 'muro';
        return true;
      }
      if ((kind === W.STORE || kind === W.WINDOW) && st === 1) return false;
      return true;
    }
    addProp(type, i, j, o) {
      o = o || {};
      const d = PROPS.D[type];
      if (!d) return null;
      const rot = o.rot || 0;
      const [fw, fh] = PROPS.footprint(type, rot);
      for (let b = j; b < j + fh; b++) for (let a = i; a < i + fw; a++) if (!this.inb(a, b) || this.propAt[b * N + a] >= 0) return null;
      const p = { id: this.props.length, type, i, j, rot, fw, fh, v: o.v || 0, solid: d.solid, loot: o.loot !== undefined ? o.loot : d.loot, items: null, hp: d.hp || 0, maxhp: d.hp || 0, name: d.name, light: d.light || null, x: i + fw / 2, y: j + fh / 2, bld: o.bld != null ? o.bld : -1, lore: d.lore };
      this.props.push(p);
      for (let b = j; b < j + fh; b++) for (let a = i; a < i + fw; a++) this.propAt[b * N + a] = p.id;
      if (d.nest) this.nests.push(p);
      return p;
    }
    removeProp(p) {
      for (let b = p.j; b < p.j + p.fh; b++) for (let a = p.i; a < p.i + p.fw; a++) if (this.propAt[b * N + a] === p.id) this.propAt[b * N + a] = -1;
      p.dead = true;
    }
    // custo de passo para A*; breaker: zumbis arrombam portas e barricadas
    stepCost(i, j, di, dj, breaker) {
      const ti = i + di, tj = j + dj;
      if (!this.inb(ti, tj)) return -1;
      const orth = (a, b, da, db) => {
        let c = 1;
        let side, ei, ej;
        if (da === 1) { side = 'W'; ei = a + 1; ej = b; } else if (da === -1) { side = 'W'; ei = a; ej = b; }
        else if (db === 1) { side = 'N'; ei = a; ej = b + 1; } else { side = 'N'; ei = a; ej = b; }
        if (this.edge(ei, ej, side, 'move')) {
          if (breaker && this['w' + side][ej * N + ei] === W.DOOR) c += 12; else return -1;
        }
        const p = this.prop(a + da, b + db);
        if (p && p.solid && !p.dead) { if (breaker && PROPS.D[p.type].built) c += 12; else return -1; }
        return c;
      };
      if (di === 0 || dj === 0) return orth(i, j, di, dj);
      if (orth(i, j, di, 0) !== 1 || orth(i, j, 0, dj) !== 1 || orth(i + di, j, 0, dj) !== 1 || orth(i, j + dj, di, 0) !== 1) return -1;
      return 1.414;
    }
    path(sx, sy, tx, ty, breaker, maxNodes) {
      const si = Math.floor(sx), sj = Math.floor(sy), ti = Math.floor(tx), tj = Math.floor(ty);
      if (!this.inb(ti, tj) || !this.inb(si, sj)) return null;
      const start = sj * N + si, goal = tj * N + ti;
      const g = new globalThis.Map(), came = new globalThis.Map();
      const heap = []; // [f, k]
      const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
      g.set(start, 0); push(0, start);
      let n = 0, best = start, bestH = 1e9;
      while (heap.length && n++ < (maxNodes || 2500)) {
        const [, cur] = pop();
        if (cur === goal) { best = goal; break; }
        const ci = cur % N, cj = (cur / N) | 0, gc = g.get(cur);
        const h0 = Math.hypot(ci - ti, cj - tj);
        if (h0 < bestH) { bestH = h0; best = cur; }
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const c = this.stepCost(ci, cj, di, dj, breaker);
          if (c < 0) continue;
          const nk = (cj + dj) * N + ci + di, ng = gc + c;
          const old = g.get(nk);
          if (old !== undefined && old <= ng) continue;
          g.set(nk, ng); came.set(nk, cur);
          push(ng + Math.hypot(ci + di - ti, cj + dj - tj) * 1.05, nk);
        }
      }
      if (best === start) return [];
      const out = []; let k = best;
      while (k !== start && k !== undefined) { out.push([(k % N) + 0.5, ((k / N) | 0) + 0.5]); k = came.get(k); }
      return out.reverse();
    }
    los(ax, ay, bx, by, mode) {
      const d = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(d * 4));
      let pi = Math.floor(ax), pj = Math.floor(ay);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const ci = Math.floor(ax + (bx - ax) * t), cj = Math.floor(ay + (by - ay) * t);
        if (ci !== pi && this.edge(Math.max(pi, ci), pj, 'W', mode || 'sight')) return false;
        if (cj !== pj && this.edge(ci, Math.max(pj, cj), 'N', mode || 'sight')) return false;
        if (mode === 'shot' && (ci !== pi || cj !== pj)) { const p = this.prop(ci, cj); if (p && p.solid && !p.dead && PROPS.D[p.type].tall) return false; }
        pi = ci; pj = cj;
      }
      return true;
    }
    collide(e, r) {
      for (let it = 0; it < 2; it++) {
        const i0 = Math.floor(e.x) - 1, j0 = Math.floor(e.y) - 1;
        for (let j = j0; j <= j0 + 2; j++) for (let i = i0; i <= i0 + 2; i++) {
          if (this.edge(i, j, 'N', 'move')) pushSeg(e, i, j, i + 1, j, r);
          if (this.edge(i, j, 'W', 'move')) pushSeg(e, i, j, i, j + 1, r);
          if (this.solid(i, j)) pushBox(e, i + 0.06, j + 0.06, i + 0.94, j + 0.94, r);
        }
      }
      e.x = Math.max(1, Math.min(N - 1, e.x)); e.y = Math.max(1, Math.min(N - 1, e.y));
    }
    walkable(i, j) { return this.inb(i, j) && !this.solid(i, j); }
  }
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
  function generate(M) {
    const R = M.R;
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const pickR = (arr) => arr[Math.floor(R() * arr.length)];
    const setF = (i, j, f) => { if (M.inb(i, j)) M.floor[j * N + i] = f; };
    for (let k = 0; k < N * N; k++) { M.floor[k] = F.GRAMA; M.fvar[k] = Math.floor(R() * 4); }

    // ruas (corredores verticais e horizontais)
    const roadKind = (o) => (o === 0 || o === 1 || o === 2 || o === 11 || o === 12 || o === 13 ? 'calcada' : 'rua');
    for (let a = 0; a < N; a++) for (const c of CORS) for (let o = 0; o < COR; o++) {
      const isRoad = roadKind(o) === 'rua';
      // vertical: x = c+o
      const fV = !isRoad ? F.CALCADA : o === 7 ? F.LINHA_Y : o === 3 ? F.ASFALTO : o === 10 ? F.BORDA_Y : F.ASFALTO;
      const fH = !isRoad ? F.CALCADA : o === 7 ? F.LINHA_X : o === 10 ? F.BORDA_X : F.ASFALTO;
      if (a >= CORS[0] && a < CORS[NB] + COR) { setF(c + o, a, fV); setF(a, c + o, fH); }
    }
    // cruzamentos e faixas de pedestre
    for (const cx of CORS) for (const cy of CORS) {
      for (let a = 0; a < COR; a++) for (let b = 0; b < COR; b++) {
        const ra = roadKind(a) === 'rua', rb2 = roadKind(b) === 'rua';
        setF(cx + a, cy + b, ra || rb2 ? F.ASFALTO : F.CALCADA);
      }
      for (let a = 3; a <= 10; a++) {
        for (const off of [-3, -2]) { setF(cx + a, cy + off, F.ZEBRA_Y); setF(cx + a, cy + COR - 1 - off, F.ZEBRA_Y); setF(cx + off, cy + a, F.ZEBRA_X); setF(cx + COR - 1 - off, cy + a, F.ZEBRA_X); }
      }
    }
    // periferia: mata, trilhas
    const inCity = (i, j) => i >= CORS[0] && j >= CORS[0] && i < CORS[NB] + COR && j < CORS[NB] + COR;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (!inCity(i, j)) setF(i, j, N3(i * 0.08, j * 0.08, 9) > 0.55 ? F.GRAMA_ALTA : F.GRAMA);
    for (let t = 0; t < 4; t++) { let x = R() < 0.5 ? 2 : N - 3, y = ri(10, N - 10), a = x < N / 2 ? 0 : Math.PI; for (let s = 0; s < 40; s++) { for (let w = 0; w < 2; w++) if (!inCity(Math.floor(x), Math.floor(y + w))) setF(Math.floor(x), Math.floor(y + w), F.TERRA); x += Math.cos(a); y += Math.sin(a); a += (R() - 0.5) * 0.5; } }

    const blockRect = (bx, by) => [CORS[bx] + COR, CORS[by] + COR, BLOCK, BLOCK];
    const plan = {
      '0,0': 'residencial', '1,0': 'civico', '2,0': 'industrial', '3,0': 'residencial',
      '0,1': 'comercial', '1,1': 'lab', '2,1': 'residencial', '3,1': 'parque',
      '0,2': 'residencial', '1,2': 'comercial2', '2,2': 'militar', '3,2': 'residencial',
      '0,3': 'parque', '1,3': 'residencial', '2,3': 'industrial', '3,3': 'residencial',
    };
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
      const [x0, y0] = blockRect(bx, by);
      const kind = plan[bx + ',' + by];
      if (kind === 'residencial') residential(M, R, x0, y0);
      else if (kind === 'comercial') commercial(M, R, x0, y0);
      else if (kind === 'comercial2') commercial2(M, R, x0, y0);
      else if (kind === 'civico') civic(M, R, x0, y0);
      else if (kind === 'industrial') industrial(M, R, x0, y0);
      else if (kind === 'parque') park(M, R, x0, y0);
      else if (kind === 'militar') military(M, R, x0, y0);
      else if (kind === 'lab') labCompound(M, R, x0, y0);
    }
    streets(M, R);
    outskirts(M, R);
    nestsAndFungus(M, R);
    finalizeWalls(M);
  }

  // ----- prédios -----
  const ROOMFLOOR = { sala: F.MADEIRA, quarto: F.CARPETE, cozinha: F.COZINHA, banheiro: F.AZULEJO, escritorio: F.CARPETE_AZ, loja: F.LOJA, estoque: F.CONCRETO, lab: F.LAB, contencao: F.LAB, servidores: F.CONCRETO, enfermaria: F.HOSPITAL, recepcao: F.HOSPITAL, arsenal: F.CONCRETO, galpao: F.CONCRETO, oficina: F.CONCRETO, farmacia: F.LAB, lanchonete: F.COZINHA, corredor: F.MADEIRA_ESC };
  const ROOMSTYLE = { sala: ['int_creme', 'int_verde', 'int_azul', 'int_papel', 'int_madeira'], quarto: ['int_rosa', 'int_azul', 'int_creme', 'int_papel'], cozinha: ['int_cozinha'], banheiro: ['int_azulejo'], escritorio: ['int_branco', 'int_madeira'], loja: ['int_branco'], estoque: ['int_concreto'], lab: ['int_lab'], contencao: ['int_lab'], servidores: ['int_concreto'], enfermaria: ['int_hospital'], recepcao: ['int_hospital'], arsenal: ['int_concreto'], galpao: ['int_concreto'], oficina: ['int_concreto'], farmacia: ['int_branco'], lanchonete: ['int_creme'], corredor: ['int_creme'] };
  const FURN = {
    sala: [['sofa', 1], ['poltrona', 0.7], ['tv_rack', 0.9], ['estante', 0.6], ['planta', 0.8], ['luminaria', 0.6]],
    quarto: [['cama_casal', 0.6, 'bed'], ['cama_solteiro', 0.5, 'bed'], ['guarda_roupa', 0.9], ['comoda', 0.7], ['criado', 0.8], ['planta', 0.3], ['escrivaninha', 0.25]],
    cozinha: [['geladeira', 1], ['fogao', 1], ['pia_cozinha', 1], ['balcao', 1], ['balcao', 0.8], ['balcao', 0.5], ['mesa_jantar', 0.6, 'center']],
    banheiro: [['vaso', 1], ['pia_banheiro', 1], ['chuveiro', 0.7], ['banheira', 0.3], ['maquina_lavar', 0.4]],
    escritorio: [['escrivaninha', 1], ['escrivaninha', 0.7], ['arquivo', 0.9], ['estante', 0.5], ['planta', 0.5], ['arquivo', 0.4]],
    loja: [['freezer', 0.9], ['freezer', 0.6], ['caixa_registradora', 1], ['prateleira_mercado', 1, 'aisles']],
    farmacia: [['estante_farmacia', 1], ['estante_farmacia', 1], ['estante_farmacia', 0.8], ['balcao_loja', 1], ['estante_farmacia', 0.6]],
    lanchonete: [['balcao_loja', 1], ['fogao', 1], ['geladeira', 1], ['freezer', 0.7], ['mesa_lanchonete', 1, 'scatter'], ['mesa_lanchonete', 1, 'scatter'], ['mesa_lanchonete', 0.8, 'scatter'], ['mesa_lanchonete', 0.6, 'scatter']],
    estoque: [['caixa_papelao', 1], ['caixa', 0.8], ['palete', 0.8], ['prateleira_mercado', 0.6], ['caixa_papelao', 0.8], ['armario_metal', 0.6]],
    lab: [['bancada_lab', 1], ['bancada_lab', 0.9], ['armario_lab', 1], ['escrivaninha', 0.7, null, 2], ['tanque', 0.6], ['servidor', 0.4], ['armario_lab', 0.5]],
    contencao: [['tanque', 1], ['tanque', 1], ['tanque', 0.8], ['bancada_lab', 0.7], ['armario_lab', 0.5]],
    servidores: [['servidor', 1], ['servidor', 1], ['servidor', 0.9], ['servidor', 0.8], ['escrivaninha', 0.6, null, 2]],
    enfermaria: [['maca', 1, 'beds'], ['armario_metal', 0.8, null, 0, 'hospital'], ['estante_farmacia', 0.6], ['planta', 0.3]],
    recepcao: [['balcao_loja', 1], ['cadeiras_espera', 1], ['cadeiras_espera', 0.8], ['planta', 0.7], ['arquivo', 0.5]],
    arsenal: [['armario_armas', 1], ['armario_armas', 0.9], ['caixa_militar', 0.6], ['arquivo', 0.5]],
    galpao: [['prateleira_industrial', 1, 'racks'], ['palete', 0.8, 'scatter'], ['caixa', 0.8, 'scatter'], ['barril', 0.8, 'scatter'], ['caixa_papelao', 0.8, 'scatter'], ['pneus', 0.5, 'scatter']],
    oficina: [['bancada_ferramentas', 1], ['bancada_ferramentas', 0.6], ['armario_metal', 0.8], ['pneus', 0.8], ['barril', 0.7], ['carro', 0.7, 'center']],
    corredor: [['planta', 0.4]],
  };
  const BTYPES = {
    casa: { ext: ['siding_azul', 'siding_creme', 'siding_verde', 'siding_amarelo', 'tijolo', 'reboco_rosa'], roof: 'gable', maxRoom: 26, minRoom: 4 },
    mercado: { ext: ['concreto', 'tijolo_cinza'], roof: 'flat', store: 1, main: 'loja', back: ['estoque', 'escritorio', 'banheiro'] },
    farmacia: { ext: ['azulejo_ext', 'concreto'], roof: 'flat', store: 1, main: 'farmacia', back: ['estoque', 'banheiro'] },
    lanchonete: { ext: ['reboco_rosa', 'tijolo'], roof: 'flat', store: 1, main: 'lanchonete', back: ['cozinha', 'banheiro'] },
    escritorios: { ext: ['concreto', 'tijolo_cinza'], roof: 'flat', maxRoom: 36, minRoom: 5, rooms: ['escritorio', 'escritorio', 'banheiro', 'recepcao'] },
    delegacia: { ext: ['tijolo_cinza', 'concreto'], roof: 'flat', maxRoom: 48, minRoom: 5, rooms: ['recepcao', 'escritorio', 'arsenal', 'escritorio', 'banheiro', 'escritorio'] },
    hospital: { ext: ['azulejo_ext'], roof: 'flat', maxRoom: 50, minRoom: 5, rooms: ['recepcao', 'enfermaria', 'enfermaria', 'enfermaria', 'escritorio', 'banheiro', 'farmacia', 'enfermaria'] },
    armazem: { ext: ['metal', 'metal_azul'], roof: 'flat', maxRoom: 9999, rooms: ['galpao'], office: 1 },
    oficina: { ext: ['metal', 'tijolo'], roof: 'flat', maxRoom: 9999, rooms: ['oficina'], garage: 1 },
    lab: { ext: ['azulejo_ext'], roof: 'flat', maxRoom: 54, minRoom: 5, rooms: ['lab', 'escritorio', 'contencao', 'lab', 'servidores', 'banheiro', 'lab', 'escritorio'] },
    apartamentos: { ext: ['tijolo', 'concreto'], roof: 'flat', maxRoom: 22, minRoom: 4, rooms: ['sala', 'quarto', 'cozinha', 'banheiro', 'quarto', 'sala', 'cozinha', 'quarto'] },
    posto: { ext: ['concreto'], roof: 'flat', maxRoom: 9999, rooms: ['arsenal'] },
  };

  function building(M, R, type, x, y, w, h, front, opts) {
    opts = opts || {};
    const T = BTYPES[type];
    const id = M.buildings.length;
    const ext = S[T.ext[Math.floor(R() * T.ext.length)]];
    const B = { id, type, x, y, w, h, front, ext, roof: T.roof, roofC: Math.floor(R() * 4), rooms: [] };
    M.buildings.push(B);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { M.bld[j * N + i] = id; M.floor[j * N + i] = F.MADEIRA; if (M.propAt[j * N + i] >= 0) { const p = M.prop(i, j); if (p) M.removeProp(p); } }
    const setN = (i, j, kind) => { if (!M.inb(i, j)) return; const k = j * N + i; M.wN[k] = kind; M.wbN[k] = id; M.whpN[k] = 90; };
    const setW = (i, j, kind) => { if (!M.inb(i, j)) return; const k = j * N + i; M.wW[k] = kind; M.wbW[k] = id; M.whpW[k] = 90; };
    for (let i = x; i < x + w; i++) { setN(i, y, W.WALL); setN(i, y + h, W.WALL); }
    for (let j = y; j < y + h; j++) { setW(x, j, W.WALL); setW(x + w, j, W.WALL); }
    // cômodos
    const rooms = [];
    const doors = [];
    const addDoor = (side, i, j, kind, ds) => { if (side === 'N') { setN(i, j, kind); M.wstN[j * N + i] = kind === W.DOOR ? (R() < 0.55 ? 1 : 0) : 0; M.wdN[j * N + i] = ds; } else { setW(i, j, kind); M.wstW[j * N + i] = kind === W.DOOR ? (R() < 0.55 ? 1 : 0) : 0; M.wdW[j * N + i] = ds; } doors.push([side, i, j]); };
    const intDoorStyle = Math.floor(R() * 2);
    function split(r, depth) {
      const maxA = T.maxRoom || 30, mn = T.minRoom || 4;
      if (r.w * r.h <= maxA || (r.w < mn * 2 && r.h < mn * 2) || depth > 6) { rooms.push(r); return; }
      let vert = r.w > r.h * 1.2 ? true : r.h > r.w * 1.2 ? false : R() < 0.5;
      if (vert && r.w < mn * 2) vert = false; if (!vert && r.h < mn * 2) vert = true;
      if (vert) {
        const s = r.x + mn + Math.floor(R() * (r.w - 2 * mn + 1));
        for (let j = r.y; j < r.y + r.h; j++) setW(s, j, W.WALL);
        addDoor('W', s, r.y + 1 + Math.floor(R() * Math.max(1, r.h - 2)), R() < 0.75 ? W.DOOR : W.DOORWAY, intDoorStyle);
        split({ x: r.x, y: r.y, w: s - r.x, h: r.h }, depth + 1); split({ x: s, y: r.y, w: r.x + r.w - s, h: r.h }, depth + 1);
      } else {
        const s = r.y + mn + Math.floor(R() * (r.h - 2 * mn + 1));
        for (let i = r.x; i < r.x + r.w; i++) setN(i, s, W.WALL);
        addDoor('N', r.x + 1 + Math.floor(R() * Math.max(1, r.w - 2)), s, R() < 0.75 ? W.DOOR : W.DOORWAY, intDoorStyle);
        split({ x: r.x, y: r.y, w: r.w, h: s - r.y }, depth + 1); split({ x: r.x, y: s, w: r.w, h: r.y + r.h - s }, depth + 1);
      }
    }
    const frontVert = front === 'N' || front === 'S';
    if (T.store) {
      // salão da frente + fundos
      const depthMain = Math.max(6, Math.floor((frontVert ? h : w) * 0.66));
      let main, back;
      if (front === 'N') { main = { x, y, w, h: depthMain }; back = { x, y: y + depthMain, w, h: h - depthMain }; for (let i = x; i < x + w; i++) setN(i, y + depthMain, W.WALL); addDoor('N', x + 1 + Math.floor(R() * (w - 2)), y + depthMain, W.DOOR, 3); }
      else if (front === 'S') { back = { x, y, w, h: h - depthMain }; main = { x, y: y + h - depthMain, w, h: depthMain }; for (let i = x; i < x + w; i++) setN(i, main.y, W.WALL); addDoor('N', x + 1 + Math.floor(R() * (w - 2)), main.y, W.DOOR, 3); }
      else if (front === 'W') { main = { x, y, w: depthMain, h }; back = { x: x + depthMain, y, w: w - depthMain, h }; for (let j = y; j < y + h; j++) setW(x + depthMain, j, W.WALL); addDoor('W', x + depthMain, y + 1 + Math.floor(R() * (h - 2)), W.DOOR, 3); }
      else { back = { x, y, w: w - depthMain, h }; main = { x: x + w - depthMain, y, w: depthMain, h }; for (let j = y; j < y + h; j++) setW(main.x, j, W.WALL); addDoor('W', main.x, y + 1 + Math.floor(R() * (h - 2)), W.DOOR, 3); }
      main.type = T.main; rooms.push(main);
      const sub = [];
      const pushR = (r) => sub.push(r);
      // divide fundos em 2-3
      const bv = back.w >= back.h;
      const cuts = Math.min(T.back.length, Math.max(1, Math.floor((bv ? back.w : back.h) / 5)));
      let acc = bv ? back.x : back.y;
      for (let c = 0; c < cuts; c++) {
        const end = c === cuts - 1 ? (bv ? back.x + back.w : back.y + back.h) : acc + Math.floor((bv ? back.w : back.h) / cuts);
        const r = bv ? { x: acc, y: back.y, w: end - acc, h: back.h } : { x: back.x, y: acc, w: back.w, h: end - acc };
        if (c > 0) { if (bv) { for (let j = back.y; j < back.y + back.h; j++) setW(acc, j, W.WALL); addDoor('W', acc, back.y + Math.floor(back.h / 2), W.DOOR, intDoorStyle); } else { for (let i = back.x; i < back.x + back.w; i++) setN(i, acc, W.WALL); addDoor('N', back.x + Math.floor(back.w / 2), acc, W.DOOR, intDoorStyle); } }
        r.type = T.back[c]; pushR(r); acc = end;
      }
      // portas de comunicação extras do salão com cada sala de fundo
      sub.forEach((r) => rooms.push(r));
    } else if (T.office) {
      const ow = Math.min(7, Math.floor(w / 3));
      for (let j = y; j < y + h; j++) setW(x + w - ow, j, W.WALL);
      const oh = Math.min(6, Math.floor(h / 2));
      for (let i = x + w - ow; i < x + w; i++) setN(i, y + oh, W.WALL);
      addDoor('W', x + w - ow, y + 2, W.DOOR, 3);
      rooms.push({ x, y, w: w - ow, h, type: 'galpao' }, { x: x + w - ow, y, w: ow, h: oh, type: 'escritorio' }, { x: x + w - ow, y: y + oh, w: ow, h: h - oh, type: 'estoque' });
      addDoor('N', x + w - ow + 2, y + oh, W.DOOR, 3);
    } else split({ x, y, w, h }, 0);
    // tipos de cômodo
    if (type === 'casa' || type === 'apartamentos') {
      rooms.sort((a, b) => a.w * a.h - b.w * b.h);
      const nr = rooms.length;
      rooms.forEach((r, k) => { r.type = k === 0 && nr > 2 ? 'banheiro' : 'quarto'; });
      const big = rooms.slice().sort((a, b) => b.w * b.h - a.w * a.h);
      if (big[0]) big[0].type = 'sala';
      const kitchen = big.find((r) => r.type === 'quarto' && r.w * r.h >= 16);
      if (kitchen) kitchen.type = 'cozinha';
      if (type === 'apartamentos') rooms.forEach((r, k) => { if (r.type === 'quarto' && k % 3 === 1) r.type = pickR2(R, ['sala', 'cozinha', 'quarto']); });
    } else if (!T.store && !T.office) {
      const list = T.rooms;
      rooms.forEach((r, k) => { r.type = r.type || list[k % list.length]; });
      if (type === 'lab') { const big = rooms.slice().sort((a, b) => b.w * b.h - a.w * a.h); big[0].type = 'lab'; }
    }
    // registra cômodos
    for (const r of rooms) {
      r.id = M.rooms.length; r.bld = id;
      M.rooms.push(r); B.rooms.push(r);
      const style = S[pickR2(R, ROOMSTYLE[r.type] || ['int_creme'])];
      r.style = style;
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { M.room[j * N + i] = r.id; M.floor[j * N + i] = ROOMFLOOR[r.type] != null ? ROOMFLOOR[r.type] : F.MADEIRA; }
      if (r.type === 'quarto' && R() < 0.5) for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) M.floor[j * N + i] = R() < 0 ? 0 : (r.id % 3 === 0 ? F.CARPETE_VI : r.id % 3 === 1 ? F.MADEIRA : F.CARPETE_AZ);
    }
    // porta da frente
    const ds = opts.doorStyle != null ? opts.doorStyle : T.store ? 2 : Math.floor(R() * 6);
    const frontRoom = (pos) => M.rooms[M.room[pos]];
    let fdi, fdj;
    if (front === 'N' || front === 'S') {
      const j = front === 'N' ? y : y + h;
      const inner = front === 'N' ? y : y + h - 1;
      let best = x + Math.floor(w / 2);
      const cand = []; for (let i = x + 1; i < x + w - 1; i++) { const r = frontRoom(inner * N + i); if (r && (r.type === 'sala' || r.type === 'loja' || r.type === 'recepcao' || r.type === T.main || r.type === 'galpao' || r.type === 'oficina' || r.type === 'lab' || r.type === 'arsenal')) cand.push(i); }
      if (cand.length) best = cand[Math.floor(cand.length / 2)];
      fdi = best; fdj = j;
      addDoor('N', best, j, T.garage ? W.GARAGE : W.DOOR, ds);
      if (T.garage) addDoor('N', best + 2 < x + w - 1 ? best + 2 : best - 2, j, W.DOOR, 3);
      if (T.store) for (let i = x + 1; i < x + w - 1; i++) if (Math.abs(i - best) > 1 && M.wN[j * N + i] === W.WALL && frontRoom(inner * N + i) && frontRoom(inner * N + i).type === T.main) M.wN[j * N + i] = W.STORE;
    } else {
      const i = front === 'W' ? x : x + w;
      const inner = front === 'W' ? x : x + w - 1;
      let best = y + Math.floor(h / 2);
      const cand = []; for (let j = y + 1; j < y + h - 1; j++) { const r = frontRoom(j * N + inner); if (r && (r.type === 'sala' || r.type === 'loja' || r.type === 'recepcao' || r.type === T.main || r.type === 'galpao' || r.type === 'oficina' || r.type === 'lab' || r.type === 'arsenal')) cand.push(j); }
      if (cand.length) best = cand[Math.floor(cand.length / 2)];
      fdi = i; fdj = best;
      addDoor('W', i, best, T.garage ? W.GARAGE : W.DOOR, ds);
      if (T.garage) addDoor('W', i, best + 2 < y + h - 1 ? best + 2 : best - 2, W.DOOR, 3);
      if (T.store) for (let j = y + 1; j < y + h - 1; j++) if (Math.abs(j - best) > 1 && M.wW[j * N + i] === W.WALL && frontRoom(j * N + inner) && frontRoom(j * N + inner).type === T.main) M.wW[j * N + i] = W.STORE;
    }
    B.door = [fdi, fdj, front];
    // porta dos fundos
    if (R() < 0.6 || type === 'hospital' || type === 'delegacia') {
      const back = { N: 'S', S: 'N', W: 'E', E: 'W' }[front];
      if (back === 'N' || back === 'S') { const j = back === 'N' ? y : y + h; addDoor('N', x + 1 + Math.floor(R() * (w - 2)), j, W.DOOR, ds); }
      else { const i = back === 'W' ? x : x + w; addDoor('W', i, y + 1 + Math.floor(R() * (h - 2)), W.DOOR, ds); }
    }
    // janelas
    const nearDoor = (side, i, j) => doors.some(([s, a, b]) => s === side && Math.abs(a - i) + Math.abs(b - j) <= 1);
    const winP = type === 'armazem' || type === 'oficina' ? 0.12 : 0.42;
    for (let i = x + 1; i < x + w - 1; i++) for (const j of [y, y + h]) if (M.wN[j * N + i] === W.WALL && !nearDoor('N', i, j) && R() < winP) M.wN[j * N + i] = W.WINDOW;
    for (let j = y + 1; j < y + h - 1; j++) for (const i of [x, x + w]) if (M.wW[j * N + i] === W.WALL && !nearDoor('W', i, j) && R() < winP) M.wW[j * N + i] = W.WINDOW;
    // estado inicial: algumas janelas quebradas, portas externas fechadas
    for (const [s, i, j] of doors) { const k = j * N + i; if (M['w' + s][k] === W.DOOR && M.bld[k] !== M.bld[s === 'N' ? k - N : k - 1]) M['wst' + s][k] = R() < 0.25 ? 1 : 0; }
    // mobília
    const reserved = new Set();
    for (const [s, i, j] of doors) { const k = j * N + i; reserved.add(k); reserved.add(s === 'N' ? k - N : k - 1); for (const d of [1, -1]) { if (s === 'N') { reserved.add(k + d); reserved.add(k - N + d); } else { reserved.add(k + d * N); reserved.add(k - 1 + d * N); } } }
    for (const r of rooms) furnish(M, R, r, reserved, id);
    return B;
  }
  function pickR2(R, arr) { return arr[Math.floor(R() * arr.length)]; }

  function furnish(M, R, r, reserved, bid) {
    const list = FURN[r.type] || [];
    const free = (i, j, fw, fh) => {
      for (let b = j; b < j + fh; b++) for (let a = i; a < i + fw; a++) {
        if (a < r.x || b < r.y || a >= r.x + r.w || b >= r.y + r.h) return false;
        const k = b * N + a; if (reserved.has(k) || M.propAt[k] >= 0) return false;
      }
      return true;
    };
    const place = (type, i, j, rot, v, loot) => { const p = M.addProp(type, i, j, { rot, v, bld: bid, loot: loot !== undefined ? loot : undefined }); return p; };
    for (const [type, prob, mode, vfix, lootK] of list) {
      if (R() > prob) continue;
      const v = vfix != null ? vfix : Math.floor(R() * 8);
      const loot = lootK || undefined;
      if (mode === 'center') {
        const [fw, fh] = PROPS.footprint(type, 0);
        const i = r.x + Math.floor((r.w - fw) / 2), j = r.y + Math.floor((r.h - fh) / 2);
        if (r.w >= fw + 2 && r.h >= fh + 2 && free(i, j, fw, fh)) place(type, i, j, 0, v, loot);
        continue;
      }
      if (mode === 'aisles' || mode === 'racks' || mode === 'beds') {
        const [fw, fh] = PROPS.footprint(type, 0);
        const stepJ = mode === 'beds' ? 0 : fh + 2;
        if (mode === 'beds') {
          for (let i = r.x + 1; i + fw <= r.x + r.w - 1; i += fw + 1) { if (free(i, r.y, fw, PROPS.footprint(type, 0)[1])) place(type, i, r.y, 0, v); }
        } else for (let j = r.y + 2; j + fh <= r.y + r.h - 2; j += stepJ) for (let i = r.x + 2; i + fw <= r.x + r.w - 2; i += fw) if (free(i, j, fw, fh)) place(type, i, j, j % 2 ? 0 : 2, v + i);
        continue;
      }
      if (mode === 'scatter') {
        for (let t = 0; t < 6; t++) { const i = r.x + 1 + Math.floor(R() * Math.max(1, r.w - 2)), j = r.y + 1 + Math.floor(R() * Math.max(1, r.h - 2)); if (free(i, j, 1, 1) && free(i - 1, j - 1, 3, 3)) { place(type, i, j, Math.floor(R() * 4), v); break; } }
        continue;
      }
      // encostado numa parede, de frente para o cômodo
      const order = [0, 1, 2, 3].sort(() => R() - 0.5);
      let done = false;
      for (const wall of order) {
        if (done) break;
        const rot = [0, 1, 2, 3][wall]; // 0: parede N (frente p/ sul), 1: parede O, 2: parede S, 3: parede L
        const [fw, fh] = PROPS.footprint(type, rot);
        const cands = [];
        if (wall === 0) for (let i = r.x; i + fw <= r.x + r.w; i++) cands.push([i, r.y]);
        if (wall === 2) for (let i = r.x; i + fw <= r.x + r.w; i++) cands.push([i, r.y + r.h - fh]);
        if (wall === 1) for (let j = r.y; j + fh <= r.y + r.h; j++) cands.push([r.x, j]);
        if (wall === 3) for (let j = r.y; j + fh <= r.y + r.h; j++) cands.push([r.x + r.w - fw, j]);
        for (let t = cands.length - 1; t > 0; t--) { const q = Math.floor(R() * (t + 1)); [cands[t], cands[q]] = [cands[q], cands[t]]; }
        for (const [i, j] of cands) if (free(i, j, fw, fh)) { place(type, i, j, rot, v, loot); done = true; break; }
      }
    }
    // tapete
    if ((r.type === 'sala' || r.type === 'quarto' || r.type === 'escritorio') && r.w >= 5 && r.h >= 5 && R() < 0.75) {
      const rw = Math.min(4, r.w - 2), rh = Math.min(3, r.h - 2);
      M.decals.push({ k: 'tapete', x: r.x + Math.floor((r.w - rw) / 2), y: r.y + Math.floor((r.h - rh) / 2), w: rw, h: rh, v: Math.floor(R() * 6) });
    }
  }

  // ----- quarteirões -----
  function lotsRow(R, x0, w, minW, maxW) {
    const out = []; let x = x0;
    while (x < x0 + w) { let lw = minW + Math.floor(R() * (maxW - minW + 1)); if (x0 + w - (x + lw) < minW) lw = x0 + w - x; out.push([x, lw]); x += lw; }
    return out;
  }
  function fenceN(M, i, j, st) { if (M.inb(i, j) && !M.wN[j * N + i]) { M.wN[j * N + i] = W.WALL; M.wsN[j * N + i] = st; M.wbN[j * N + i] = -1; } }
  function fenceW(M, i, j, st) { if (M.inb(i, j) && !M.wW[j * N + i]) { M.wW[j * N + i] = W.WALL; M.wsW[j * N + i] = st; M.wbW[j * N + i] = -1; } }
  function gate(M, side, i, j) { const k = j * N + i; M['w' + side][k] = W.DOOR; M['wst' + side][k] = 1; M['wd' + side][k] = 0; }

  function residential(M, R, x0, y0) {
    for (const row of [0, 1]) {
      const ly = y0 + row * 20, front = row === 0 ? 'N' : 'S';
      for (const [lx, lw] of lotsRow(R, x0, BLOCK, 10, 13)) {
        const fenceSt = R() < 0.5 ? S.cerca_madeira : S.cerca_arame;
        // cerca do lote (laterais e fundos)
        if (front === 'N') { for (let j = ly + 2; j < ly + 20; j++) { fenceW(M, lx, j, fenceSt); fenceW(M, lx + lw, j, fenceSt); } for (let i = lx; i < lx + lw; i++) fenceN(M, i, ly + 20, fenceSt); }
        else { for (let j = ly; j < ly + 18; j++) { fenceW(M, lx, j, fenceSt); fenceW(M, lx + lw, j, fenceSt); } for (let i = lx; i < lx + lw; i++) fenceN(M, i, ly, fenceSt); }
        if (R() < 0.12) { // terreno baldio
          for (let t = 0; t < 6; t++) M.addProp(R() < 0.5 ? 'arvore' : 'arbusto', lx + 1 + Math.floor(R() * (lw - 2)), ly + 2 + Math.floor(R() * 16), { v: Math.floor(R() * 3) });
          for (let j = ly; j < ly + 20; j++) for (let i = lx; i < lx + lw; i++) if (R() < 0.6) M.floor[j * N + i] = F.GRAMA_ALTA;
          continue;
        }
        const hw = Math.max(7, lw - 2 - Math.floor(R() * 2)), hh = 10 + Math.floor(R() * 3);
        const hx = lx + 1 + Math.floor(R() * (lw - hw - 1));
        const hy = front === 'N' ? ly + 3 : ly + 20 - 3 - hh;
        // entrada de carro e calçada até a porta
        building(M, R, 'casa', hx, hy, hw, hh, front);
        const B = M.buildings[M.buildings.length - 1];
        const di = B.door[0];
        const path0 = front === 'N' ? [ly, hy] : [hy + hh, ly + 20];
        for (let j = path0[0]; j < path0[1]; j++) M.floor[j * N + di] = F.CALCADA;
        // carro na garagem descoberta
        const side = hx - lx >= 3 ? lx + 1 : hx + hw + 1 <= lx + lw - 2 ? hx + hw : -1;
        if (side >= 0 && R() < 0.5) {
          const cy = front === 'N' ? ly : ly + 20 - 6;
          for (let j = cy; j < cy + 6; j++) for (let i = side; i < side + 2; i++) if (M.bld[j * N + i] < 0) M.floor[j * N + i] = F.CONCRETO;
          if (R() < 0.7) M.addProp('carro', side, cy + (front === 'N' ? 0 : 1), { v: Math.floor(R() * 8), rot: front === 'N' ? 0 : 2 });
        }
        // quintal
        const by0 = front === 'N' ? hy + hh + 1 : ly + 1, by1 = front === 'N' ? ly + 19 : hy - 1;
        for (let t = 0; t < 3; t++) {
          const i = lx + 1 + Math.floor(R() * (lw - 2)), j = by0 + Math.floor(R() * Math.max(1, by1 - by0));
          M.addProp(pickR2(R, ['arvore', 'arbusto', 'lixeira', 'palete', 'pneus', 'caixa_papelao', 'sacos_lixo', 'arbusto']), i, j, { v: Math.floor(R() * 4) });
        }
        M.addProp('ar_cond', hx + hw, hy + 2 + Math.floor(R() * (hh - 4)), { rot: 1 });
        // jardim da frente
        if (R() < 0.6) M.addProp(R() < 0.6 ? 'arbusto' : 'arvore', lx + 1, front === 'N' ? ly + 1 : ly + 18, { v: Math.floor(R() * 3) });
        if (R() < 0.5) M.addProp('lixeira', di + 1, front === 'N' ? ly : ly + 19, {});
        M.spawnPts.push([hx + hw / 2, hy + hh / 2]);
      }
    }
  }
  function commercial(M, R, x0, y0) {
    // frente norte: mercado + farmácia; frente sul: lanchonete + escritórios; estacionamento no meio
    building(M, R, 'mercado', x0 + 1, y0, 22, 14, 'N');
    building(M, R, 'farmacia', x0 + 25, y0, 14, 12, 'N');
    building(M, R, 'lanchonete', x0 + 1, y0 + 28, 14, 12, 'S');
    building(M, R, 'escritorios', x0 + 18, y0 + 26, 21, 14, 'S');
    parking(M, R, x0 + 1, y0 + 16, 38, 9);
    for (const [i, j] of [[x0 + 24, y0 + 13], [x0 + 15, y0 + 26]]) M.addProp('cacamba', i, j, { v: Math.floor(R() * 3) });
    for (let t = 0; t < 8; t++) M.addProp(pickR2(R, ['sacos_lixo', 'caixa_papelao', 'palete', 'lixeira']), x0 + 2 + Math.floor(R() * 36), y0 + 14 + Math.floor(R() * 2), { v: Math.floor(R() * 4) });
  }
  function commercial2(M, R, x0, y0) {
    building(M, R, 'lanchonete', x0 + 1, y0, 12, 12, 'N');
    building(M, R, 'escritorios', x0 + 15, y0, 24, 14, 'N');
    building(M, R, 'mercado', x0 + 1, y0 + 26, 22, 14, 'S');
    building(M, R, 'farmacia', x0 + 25, y0 + 28, 14, 12, 'S');
    parking(M, R, x0 + 1, y0 + 15, 38, 9);
    for (const [i, j] of [[x0 + 13, y0 + 13], [x0 + 24, y0 + 25]]) M.addProp('cacamba', i, j, { v: Math.floor(R() * 3) });
    for (let t = 0; t < 10; t++) M.addProp(pickR2(R, ['sacos_lixo', 'caixa_papelao', 'palete', 'lixeira', 'barril']), x0 + 2 + Math.floor(R() * 36), y0 + 24 + Math.floor(R() * 2), { v: Math.floor(R() * 4) });
  }
  function parking(M, R, x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (M.bld[j * N + i] < 0) M.floor[j * N + i] = (i - x) % 3 === 0 && (j - y < 5 || j - y > h - 6) ? F.VAGA : F.ASFALTO;
    for (let i = x + 1; i + 2 < x + w; i += 3) {
      if (R() < 0.45) M.addProp(R() < 0.85 ? 'carro' : 'van', i, y, { v: Math.floor(R() * 8), rot: R() < 0.5 ? 0 : 2 });
    }
  }
  function civic(M, R, x0, y0) {
    building(M, R, 'delegacia', x0 + 1, y0, 20, 15, 'N');
    building(M, R, 'hospital', x0 + 1, y0 + 20, 38, 20, 'S');
    parking(M, R, x0 + 23, y0 + 1, 16, 15);
    M.addProp('carro', x0 + 23, y0 + 2, { v: 3 }); M.addProp('carro', x0 + 26, y0 + 2, { v: 3, rot: 2 });
    M.addProp('van', x0 + 35, y0 + 8, { v: 1 });
    for (let i = x0 + 1; i < x0 + 39; i += 4) if (R() < 0.5) M.addProp(pickR2(R, ['banco', 'planta', 'lixeira', 'arbusto']), i, y0 + 17, { v: 1 });
  }
  function industrial(M, R, x0, y0) {
    building(M, R, 'armazem', x0 + 1, y0 + 1, 26, 18, 'S');
    building(M, R, 'oficina', x0 + 28, y0 + 24, 11, 14, 'S');
    // pátio cercado com contêineres
    for (let j = y0 + 22; j < y0 + 40; j++) for (let i = x0; i < x0 + 26; i++) M.floor[j * N + i] = F.CASCALHO;
    for (let i = x0; i < x0 + 26; i++) { fenceN(M, i, y0 + 22, S.cerca_arame); }
    for (let j = y0 + 22; j < y0 + 40; j++) { fenceW(M, x0, j, S.cerca_arame); fenceW(M, x0 + 26, j, S.cerca_arame); }
    gate(M, 'W', x0 + 26, y0 + 30); gate(M, 'W', x0 + 26, y0 + 31);
    M.addProp('conteiner', x0 + 2, y0 + 24, { v: 0 }); M.addProp('conteiner', x0 + 6, y0 + 24, { v: 1 });
    M.addProp('conteiner', x0 + 14, y0 + 30, { v: 2, rot: 1 });
    for (let t = 0; t < 14; t++) M.addProp(pickR2(R, ['barril', 'barril', 'palete', 'pneus', 'caixa', 'caixa_papelao']), x0 + 10 + Math.floor(R() * 14), y0 + 23 + Math.floor(R() * 6), { v: Math.floor(R() * 5) });
    M.addProp('van', x0 + 30, y0 + 15, { v: 2 });
  }
  function park(M, R, x0, y0) {
    for (let j = y0; j < y0 + BLOCK; j++) for (let i = x0; i < x0 + BLOCK; i++) M.floor[j * N + i] = F.PARQUE;
    for (let a = 0; a < BLOCK; a++) for (const w of [0, 1]) { M.floor[(y0 + 19 + w) * N + x0 + a] = F.CALCADA; M.floor[(y0 + a) * N + x0 + 19 + w] = F.CALCADA; }
    for (let a = 0; a < BLOCK; a++) { const d = Math.floor(a * 0.9); if (d < BLOCK) M.floor[(y0 + a) * N + x0 + d] = F.TERRA; }
    for (let t = 0; t < 70; t++) {
      const i = x0 + 1 + Math.floor(R() * 38), j = y0 + 1 + Math.floor(R() * 38);
      if (M.floor[j * N + i] !== F.PARQUE) continue;
      M.addProp(R() < 0.65 ? 'arvore' : 'arbusto', i, j, { v: Math.floor(R() * 3) });
    }
    for (let a = 3; a < BLOCK - 3; a += 6) { M.addProp('banco', x0 + a, y0 + 17, {}); M.addProp('poste', x0 + a + 3, y0 + 18, {}); M.addProp('banco', x0 + 21, y0 + a, { rot: 1 }); }
    M.addProp('lixeira', x0 + 18, y0 + 21, {}); M.addProp('lixeira', x0 + 21, y0 + 18, {});
  }
  function military(M, R, x0, y0) {
    building(M, R, 'apartamentos', x0 + 18, y0 + 18, 21, 21, 'S');
    building(M, R, 'posto', x0 + 2, y0 + 2, 8, 6, 'S');
    for (let j = y0; j < y0 + 16; j++) for (let i = x0; i < x0 + 40; i++) if (M.bld[j * N + i] < 0) M.floor[j * N + i] = F.MILITAR;
    for (let i = x0; i < x0 + 40; i += 2) if (i < x0 + 17 || i > x0 + 21) M.addProp('sacos_areia', i, y0 + 15, {});
    M.addProp('tenda', x0 + 13, y0 + 2, {}); M.addProp('tenda', x0 + 18, y0 + 2, {}); M.addProp('tenda', x0 + 23, y0 + 2, {});
    for (let t = 0; t < 12; t++) M.addProp(pickR2(R, ['caixa_militar', 'caixa_militar', 'barril', 'sacos_areia']), x0 + 2 + Math.floor(R() * 36), y0 + 8 + Math.floor(R() * 6), { v: 3 });
    M.addProp('van', x0 + 30, y0 + 6, { v: 3, rot: 1 });
    for (let t = 0; t < 10; t++) M.addProp(pickR2(R, ['arvore', 'arbusto', 'lixeira', 'banco']), x0 + 1 + Math.floor(R() * 15), y0 + 18 + Math.floor(R() * 20), { v: Math.floor(R() * 3) });
  }
  function labCompound(M, R, x0, y0) {
    const B = building(M, R, 'lab', x0 + 3, y0 + 2, 34, 16, 'N');
    // cerca do complexo
    for (let i = x0; i < x0 + 40; i++) { fenceN(M, i, y0 + 40, S.cerca_arame); }
    for (let j = y0 + 18; j < y0 + 40; j++) { fenceW(M, x0, j, S.cerca_arame); fenceW(M, x0 + 40, j, S.cerca_arame); }
    gate(M, 'N', x0 + 19, y0 + 40); gate(M, 'N', x0 + 20, y0 + 40);
    // pátio da cratera
    const cx = x0 + 20, cy = y0 + 29;
    for (let j = y0 + 19; j < y0 + 40; j++) for (let i = x0 + 1; i < x0 + 40; i++) {
      const d = Math.hypot(i + 0.5 - cx, (j + 0.5 - cy) * 1.1);
      M.floor[j * N + i] = d < 5 ? F.CRATERA : d < 9 + N3(i * 0.3, j * 0.3, 1) * 3 ? F.MICELIO : d < 12 ? F.TERRA : F.CONCRETO;
    }
    M.fragment = M.addProp('fragmento', cx - 2, cy - 2, {});
    for (const [i, j] of [[x0 + 3, y0 + 21], [x0 + 32, y0 + 21], [x0 + 3, y0 + 33]]) M.addProp('tenda', i, j, {});
    for (let t = 0; t < 10; t++) { const a = t * 0.63, r = 7 + (t % 3); M.addProp(t % 2 ? 'barreira' : 'caixa_militar', Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r * 0.9), { v: 1 }); }
    for (let t = 0; t < 6; t++) M.addProp('pilar_fungico', Math.floor(cx + (R() - 0.5) * 12), Math.floor(cy + (R() - 0.5) * 10), { v: t });
    M.addProp('van', x0 + 30, y0 + 30, { v: 0 });
    M.addProp('van', x0 + 34, y0 + 30, { v: 1 });
    // ponto de partida: maior sala de laboratório
    const r = B.rooms.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
    let sp = [r.x + r.w / 2, r.y + r.h / 2];
    for (let t = 0; t < 40; t++) { const i = r.x + 1 + Math.floor(R() * (r.w - 2)), j = r.y + 1 + Math.floor(R() * (r.h - 2)); if (!M.prop(i, j)) { sp = [i + 0.5, j + 0.5]; break; } }
    M.spawn = sp;
  }
  function streets(M, R) {
    for (const c of CORS) {
      for (let a = CORS[0]; a < CORS[NB] + COR; a++) {
        const inter = CORS.some((q) => a >= q - 4 && a < q + COR + 4);
        // postes, árvores e mobiliário nas calçadas (fileira junto ao meio-fio)
        for (const [o, rot] of [[2, 1], [11, 3]]) {
          if (inter) continue;
          const vx = c + o, hy = c + o;
          const pickS = () => { const r = R(); return r < 0.1 ? 'lixeira' : r < 0.14 ? 'hidrante' : r < 0.18 ? 'placa' : r < 0.24 ? 'banco' : r < 0.3 ? 'sacos_lixo' : null; };
          if (a % 12 === 0) { M.addProp('poste', vx, a, { rot }); M.addProp('poste', a, hy, { rot: rot === 1 ? 0 : 2 }); }
          else if (a % 8 === 4) { if (R() < 0.7) M.addProp('arvore', vx, a, { v: Math.floor(R() * 3) }); if (R() < 0.7) M.addProp('arvore', a, hy, { v: Math.floor(R() * 3) }); }
          else { let t = pickS(); if (t && t !== 'banco') M.addProp(t, vx, a, { v: Math.floor(R() * 3) }); t = pickS(); if (t && t !== 'banco') M.addProp(t, a, hy, { v: Math.floor(R() * 3) }); }
        }
        // carros estacionados junto ao meio-fio
        if (!inter && a % 7 === 0 && R() < 0.42) M.addProp(R() < 0.88 ? 'carro' : 'van', c + 3, a, { v: Math.floor(R() * 8), rot: 0 });
        if (!inter && a % 7 === 3 && R() < 0.42) M.addProp(R() < 0.88 ? 'carro' : 'van', c + 9, a, { v: Math.floor(R() * 8), rot: 2 });
        if (!inter && a % 7 === 1 && R() < 0.42) M.addProp(R() < 0.88 ? 'carro' : 'van', a, c + 3, { v: Math.floor(R() * 8), rot: 1 });
        if (!inter && a % 7 === 5 && R() < 0.42) M.addProp(R() < 0.88 ? 'carro' : 'van', a, c + 9, { v: Math.floor(R() * 8), rot: 3 });
        // carros abandonados no meio da pista
        if (!inter && R() < 0.012) M.addProp('carro', c + 5, a, { v: R() < 0.4 ? 5 : Math.floor(R() * 8), rot: R() < 0.5 ? 0 : 2 });
        if (!inter && R() < 0.012) M.addProp('carro', a, c + 5, { v: R() < 0.4 ? 5 : Math.floor(R() * 8), rot: R() < 0.5 ? 1 : 3 });
        // detritos
        if (R() < 0.05) M.decals.push({ k: pickR2(R, ['papel', 'papel', 'garrafa', 'lata', 'mancha', 'bueiro', 'folhas']), x: c + 3 + Math.floor(R() * 8), y: a, v: Math.floor(R() * 4) });
        if (R() < 0.05) M.decals.push({ k: pickR2(R, ['papel', 'garrafa', 'lata', 'mancha', 'folhas']), x: a, y: c + 3 + Math.floor(R() * 8), v: Math.floor(R() * 4) });
      }
    }
    // bloqueios policiais em cruzamentos
    for (const [cx, cy] of [[CORS[1], CORS[1]], [CORS[2], CORS[2]], [CORS[1], CORS[2]]]) {
      for (let a = 4; a <= 9; a += 2) M.addProp('barreira', cx + a, cy - 1, { v: 0 });
      M.addProp('carro', cx + 2, cy - 7, { v: 3 });
      M.addProp('cone', cx + 11, cy - 1, {}); M.addProp('cone', cx + 3, cy - 1, {});
    }
  }
  function outskirts(M, R) {
    const inCity = (i, j) => i >= CORS[0] - 1 && j >= CORS[0] - 1 && i <= CORS[NB] + COR && j <= CORS[NB] + COR;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (inCity(i, j) || M.propAt[j * N + i] >= 0) continue;
      const edge = Math.min(i, j, N - 1 - i, N - 1 - j);
      const dens = edge < 4 ? 0.75 : 0.16 + N3(i * 0.06, j * 0.06, 4) * 0.2;
      const r = R();
      if (M.floor[j * N + i] === F.TERRA) continue;
      if (r < dens) M.addProp('arvore', i, j, { v: R() < 0.3 ? 1 : R() < 0.15 ? 3 : Math.floor(R() * 3) });
      else if (r < dens + 0.05) M.addProp('arbusto', i, j, { v: Math.floor(R() * 3) });
      else if (r < dens + 0.052) M.addProp(pickR2(R, ['pneus', 'barril', 'caixa', 'carro']), i, j, { v: 5, rot: Math.floor(R() * 4) });
    }
  }
  function nestsAndFungus(M, R) {
    const spots = [];
    // periferia
    for (let t = 0; t < 5; t++) spots.push([R() < 0.5 ? 4 + Math.floor(R() * 8) : N - 12 + Math.floor(R() * 8), 10 + Math.floor(R() * (N - 20))]);
    for (let t = 0; t < 4; t++) spots.push([10 + Math.floor(R() * (N - 20)), R() < 0.5 ? 5 + Math.floor(R() * 7) : N - 12 + Math.floor(R() * 7)]);
    // dentro de prédios
    const bl = M.buildings.filter((b) => b.type !== 'lab');
    for (let t = 0; t < 9 && bl.length; t++) { const b = bl.splice(Math.floor(R() * bl.length), 1)[0]; const r = b.rooms.slice().sort((a, c) => c.w * c.h - a.w * a.h)[0]; spots.push([r.x + Math.floor(r.w / 2) - 1, r.y + Math.floor(r.h / 2) - 1, b.id]); }
    for (const [x, y] of spots) {
      for (let a = -1; a <= 2; a++) for (let b = -1; b <= 2; b++) { const p = M.prop(x + a, y + b); if (p && !p.nest && p.type !== 'fragmento') M.removeProp(p); }
      const p = M.addProp('ninho', x, y, { v: Math.floor(R() * 4) });
      if (!p) continue;
      const rad = 4 + R() * 3;
      for (let b = -8; b <= 8; b++) for (let a = -8; a <= 8; a++) {
        const i = x + 1 + a, j = y + 1 + b;
        if (!M.inb(i, j)) continue;
        const d = Math.hypot(a, b) + N3(i * 0.4, j * 0.4, 5) * 2.5;
        if (d < rad) M.floor[j * N + i] = F.MICELIO;
        else if (d < rad + 2 && R() < 0.06 && !M.prop(i, j)) M.addProp(R() < 0.6 ? 'cogumelos' : R() < 0.6 ? 'casulo' : 'pilar_fungico', i, j, { v: Math.floor(R() * 4), bld: M.bld[j * N + i] });
        else if (d < rad && R() < 0.05 && !M.prop(i, j)) M.addProp('cogumelos', i, j, { v: Math.floor(R() * 4) });
      }
    }
    // manchas espalhadas
    for (let t = 0; t < 110; t++) {
      const i = 4 + Math.floor(R() * (N - 8)), j = 4 + Math.floor(R() * (N - 8));
      const r = 1 + R() * 2.2;
      for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) if (Math.hypot(a, b) < r && M.inb(i + a, j + b) && M.floor[(j + b) * N + i + a] !== F.CRATERA) M.floor[(j + b) * N + i + a] = F.MICELIO;
      if (R() < 0.6 && !M.prop(i, j)) M.addProp('cogumelos', i, j, { v: Math.floor(R() * 4) });
      if (R() < 0.25 && !M.prop(i + 1, j)) M.addProp('casulo', i + 1, j, {});
    }
  }
  // define o estilo visível de cada parede (interior do cômodo ou fachada)
  function finalizeWalls(M) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      for (const s of ['N', 'W']) {
        const kind = M['w' + s][k];
        if (!kind) continue;
        const b = M['wb' + s][k];
        if (b < 0) continue;
        const r = M.room[k];
        if (r >= 0 && M.bld[k] === b) M['ws' + s][k] = M.rooms[r].style;
        else if (M.bld[k] >= 0 && r >= 0) M['ws' + s][k] = M.rooms[r].style;
        else M['ws' + s][k] = M.buildings[b].ext;
      }
    }
  }

  return { TW, TH, VPT, WALL_H, SC, N, F, W, S, STYLES, DOORS, iso, unIso, rng, Map: CityMap, floorSprite, wallSprite, WF, setWallBudget: (ms) => (wallBudget = ms), CORS, COR };
})();

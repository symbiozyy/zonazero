'use strict';
// Objetos do mundo em escala real (24 voxels por tile, 30 voxels = 1 m), inspirados nas folhas de referência:
// móveis de casa, loja, hospital, laboratório, mobiliário urbano, veículos e crescimento fúngico alienígena.
// Convenção do modelo: centro da pegada na origem, chão em y = 0, frente voltada para +z.
const PROPS = (() => {
  const SD = VX.SD, H = VX.hash, M = VX.M, N3 = VX.vnoise;
  const T = 24;
  // ---------- texturas ----------
  const paint = (base, amt) => (i) => VX.shade(base, 1 + (N3(i.x * 0.35, i.y * 0.35, i.z * 0.35) - 0.5) * 2 * (amt || 0.06));
  const gloss = (base, amt) => (i) => ({ c: VX.shade(base, 1 + (N3(i.x * 0.3, i.y * 0.3, i.z * 0.3) - 0.5) * 2 * (amt || 0.04)), m: M.GLOSS });
  const metal = (base) => (i) => ({ c: VX.shade(base, 0.94 + N3(i.x * 0.5, i.y * 0.5, i.z * 0.5) * 0.12), m: M.METAL });
  const woodG = (base, axis) => (i) => {
    const a = axis === 'z' ? i.z : axis === 'y' ? i.y : i.x;
    const b = axis === 'z' ? i.x + i.y : axis === 'y' ? i.x + i.z : i.y + i.z;
    const g = N3(a * 0.12, b * 1.6, 0.5);
    return VX.shade(base, 0.86 + g * 0.26);
  };
  const fabric = (base) => (i) => VX.shade(base, 0.9 + N3(i.x * 0.8, i.y * 0.8, i.z * 0.8) * 0.18);
  const rust = (base) => (i) => { const n = VX.fbm(i.x * 0.15, i.y * 0.15, i.z * 0.15); return n > 0.62 ? VX.mix('#7a3e1e', '#a0582a', H(i.x, i.y, i.z)) : { c: VX.shade(base, 0.9 + n * 0.2), m: M.METAL }; };
  const glass = (base) => (i) => ({ c: (i.x + i.y * 0.7) % 9 < 1.2 ? VX.mix(base, '#ffffff', 0.55) : base, m: M.GLASS });

  // ---------- helpers ----------
  const R = 'r';
  const rb = (m, cx, cy, cz, hx, hy, hz, r, col) => m.sdf(R, [cx - hx - 1, cy - hy - 1, cz - hz - 1, cx + hx + 1, cy + hy + 1, cz + hz + 1], SD.rbox(cx, cy, cz, hx, hy, hz, r), col);
  const bx = (m, x0, y0, z0, w, h, d, col) => m.box(R, x0, y0, z0, w, h, d, col);
  const cyl = (m, cx, cz, r, y0, y1, col) => m.sdf(R, [cx - r - 1, y0 - 1, cz - r - 1, cx + r + 1, y1 + 1, cz + r + 1], SD.cylY(cx, cz, r, y0, y1), col);
  const capsule = (m, a, b, r1, r2, col) => {
    const lo = [Math.min(a[0], b[0]) - Math.max(r1, r2) - 1, Math.min(a[1], b[1]) - Math.max(r1, r2) - 1, Math.min(a[2], b[2]) - Math.max(r1, r2) - 1];
    const hi = [Math.max(a[0], b[0]) + Math.max(r1, r2) + 1, Math.max(a[1], b[1]) + Math.max(r1, r2) + 1, Math.max(a[2], b[2]) + Math.max(r1, r2) + 1];
    m.sdf(R, [...lo, ...hi], SD.cap(a, b, r1, r2), col);
  };
  const ell = (m, cx, cy, cz, rx, ry, rz, col) => m.sdf(R, [cx - rx - 1, cy - ry - 1, cz - rz - 1, cx + rx + 1, cy + ry + 1, cz + rz + 1], SD.ell(cx, cy, cz, rx, ry, rz), col);
  const pick = (arr, v) => arr[((v % arr.length) + arr.length) % arr.length];

  // ---------- definições ----------
  // w,h = pegada em tiles (rot 0); solid; loot; light: {r, c, y, emit}; tall: some atrás quando cobre a jogadora
  const D = {};
  const def = (id, o, build) => { D[id] = Object.assign({ w: 1, h: 1, solid: 1 }, o, { build }); };

  // ===== cozinha =====
  def('geladeira', { name: 'Geladeira', loot: 'geladeira', tall: 1 }, (m, v) => {
    const c = pick(['#ecebe6', '#d8dadc', '#3a3c40'], v);
    rb(m, 0, 27, -0.5, 10, 27, 9.5, 1.6, (i) => {
      if (i.z > 8.4 && Math.abs(i.y - 36) < 0.5) return '#7a7c80';
      if (i.z > 8.4 && Math.abs(i.x - 7.5) < 0.8 && ((i.y > 38 && i.y < 50) || (i.y > 18 && i.y < 32))) return { c: '#b8bcc0', m: M.METAL };
      if (i.z > 8.4 && H(Math.floor(i.x / 2), Math.floor(i.y / 2), 7) > 0.93 && i.y > 20 && i.x < 5) return pick(['#e05050', '#50a0e0', '#e0c040', '#60c060'], Math.floor(i.x + i.y));
      return gloss(c, 0.02)(i);
    });
  });
  def('fogao', { name: 'Fogão', loot: 'cozinha' }, (m) => {
    rb(m, 0, 13, 0, 10.5, 13, 10, 0.8, (i) => {
      if (i.z > 9 && i.y > 5 && i.y < 19 && Math.abs(i.x) < 8) return { c: i.y > 17 ? '#c0c4c8' : '#1a1c22', m: M.GLASS };
      return gloss('#e8e8e4')(i);
    });
    bx(m, -10, 26, -10, 21, 1, 20, (i) => { const bu = [[-5, -5], [5, -5], [-5, 5], [5, 5]].some(([a, b]) => Math.abs(Math.hypot(i.x - a, i.z - b) - 3) < 0.7); return bu ? { c: '#5a5e64', m: M.METAL } : { c: '#18181c', m: M.GLOSS }; });
    bx(m, -10, 26, -10, 21, 7, 2, (i) => (i.front && i.iy === 3 && i.ix % 4 === 2 ? '#c8c8c8' : '#d8d8d4'));
  });
  const counterTop = (m, sink) => {
    rb(m, 0, 12, -1, 11.5, 12, 10, 0.5, (i) => (i.z > 8.4 && (Math.abs(i.x) < 0.6) ? '#4a3220' : i.z > 8.4 && Math.abs(i.y - 19) < 0.6 && Math.abs(Math.abs(i.x) - 3) < 1.2 ? { c: '#c0c4c8', m: M.METAL } : woodG('#8a5a34', 'y')(i)));
    rb(m, 0, 25, 0, 12, 1.4, 11.5, 0.4, (i) => {
      if (sink && Math.abs(i.x) < 7 && i.z > -7 && i.z < 6 && i.y > 25.5) return { c: '#6a7076', m: M.METAL };
      const vn = Math.abs(N3(i.x * 0.3, i.z * 0.3, 1) - 0.5) < 0.03;
      return { c: vn ? '#a8a49c' : '#dcd8d0', m: M.GLOSS };
    });
    if (sink) { capsule(m, [0, 26, -9], [0, 33, -9], 0.8, 0.8, { c: '#c0c4c8', m: M.METAL }); capsule(m, [0, 33, -9], [0, 32, -4], 0.7, 0.6, { c: '#c0c4c8', m: M.METAL }); }
  };
  def('balcao', { name: 'Balcão', loot: 'cozinha' }, (m) => counterTop(m, false));
  def('pia_cozinha', { name: 'Pia da cozinha', loot: 'cozinha' }, (m) => counterTop(m, true));
  def('mesa_jantar', { name: 'Mesa de jantar', w: 2, h: 2 }, (m, v) => {
    const w = pick(['#8a5a34', '#5e3a22', '#a0703e'], v);
    rb(m, 0, 23, 0, 17, 1.2, 13, 0.6, woodG(w, 'x'));
    for (const [x, z] of [[-15, -11], [15, -11], [-15, 11], [15, 11]]) bx(m, x - 1, 0, z - 1, 2, 22, 2, woodG(w, 'y'));
    for (const [x, z, rz] of [[-7, 17, 0], [7, 17, 0], [-7, -17, 1], [7, -17, 1]]) {
      rb(m, x, 14, z, 4.5, 0.8, 4.5, 0.4, woodG(w, 'x'));
      for (const [a, b] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) bx(m, x + a - 0.5, 0, z + b - 0.5, 1, 14, 1, w);
      const bz = rz ? z - 4 : z + 4;
      rb(m, x, 22, bz, 4.5, 8, 0.6, 0.3, woodG(w, 'y'));
    }
    cyl(m, -6, 2, 3, 24, 25, '#f0f0ea'); cyl(m, 6, -2, 3, 24, 25, '#f0f0ea'); cyl(m, 0, 0, 1.6, 24, 30, { c: '#7cc4f0', m: M.GLASS });
  });
  // ===== sala =====
  const SOFAC = ['#5a6a3a', '#6e4a32', '#34506e', '#6a2a34', '#8a7a5a'];
  def('sofa', { name: 'Sofá', w: 3, h: 1 }, (m, v) => {
    const c = pick(SOFAC, v);
    rb(m, 0, 8, 1, 34, 8, 10, 2.5, fabric(c));
    rb(m, 0, 19, -7.5, 34, 10, 3.5, 2.5, fabric(VX.shade(c, 0.9)));
    for (const s of [-1, 1]) rb(m, s * 32, 14, 1, 3, 6, 10, 2.5, fabric(VX.shade(c, 0.88)));
    for (const x of [-19, 0, 19]) rb(m, x, 16.5, 1.5, 9, 1.4, 8.5, 1.2, fabric(VX.shade(c, 1.06)));
    rb(m, -22, 22, -3, 5, 4, 1.6, 1.5, fabric(pick(['#d8c8a0', '#a8c0d0', '#d0a0a0'], v)));
  });
  def('poltrona', { name: 'Poltrona' }, (m, v) => {
    const c = pick(SOFAC, v + 2);
    rb(m, 0, 8, 1, 10.5, 8, 10, 2.5, fabric(c)); rb(m, 0, 19, -7.5, 10.5, 10, 3.5, 2.5, fabric(VX.shade(c, 0.9)));
    for (const s of [-1, 1]) rb(m, s * 9.5, 14, 1, 2.5, 6, 10, 2, fabric(VX.shade(c, 0.88)));
  });
  def('tv_rack', { name: 'Rack com TV', w: 2, h: 1 }, (m) => {
    rb(m, 0, 8, -3, 22, 8, 8, 0.6, (i) => (i.z > 4.4 && Math.abs(i.x) < 0.6 ? '#3a2416' : woodG('#5e3a22', 'x')(i)));
    rb(m, 0, 30, -7, 17, 11, 1, 0.4, (i) => (i.z > -6.4 && Math.abs(i.x) < 16 && Math.abs(i.y - 30) < 10 ? { c: i.x < -8 && i.y > 34 ? '#4a5a70' : '#14161c', m: M.GLASS } : { c: '#0c0c10', m: M.GLOSS }));
    bx(m, -3, 16, -9, 6, 3, 4, '#101014');
    bx(m, 10, 16, -4, 7, 4, 5, { c: '#2a2a30', m: M.GLOSS });
  });
  def('estante', { name: 'Estante de livros', loot: 'estante', w: 2, h: 1, tall: 1 }, (m, v) => {
    const w = pick(['#6e4426', '#4a2e1a', '#8a5a34'], v);
    bx(m, -22, 0, -10, 44, 62, 2, woodG(w, 'y'));
    for (const x of [-22, 20]) bx(m, x, 0, -10, 2, 62, 18, woodG(w, 'y'));
    for (const y of [0, 15, 30, 45, 60]) bx(m, -22, y, -10, 44, 2, 18, woodG(w, 'x'));
    for (let sh = 0; sh < 4; sh++) {
      let x = -20;
      while (x < 18) {
        const bw = 1.5 + Math.floor(H(x, sh, v) * 2.5), bh = 9 + Math.floor(H(x, sh, 3) * 4);
        if (H(x, sh, 9) > 0.15) bx(m, x, sh * 15 + 2, -7, bw, bh, 13, pick(['#8a2a2a', '#2a4a7a', '#3a6a3a', '#c9a24a', '#5a3a6a', '#d8d0c0', '#1e1e24'], Math.floor(H(x, sh, 5) * 7)));
        x += bw;
      }
    }
  });
  def('planta', { name: 'Planta', solid: 0 }, (m, v) => {
    cyl(m, 0, 0, 5, 0, 10, (i) => (i.y > 8.5 ? '#3a2a1e' : paint('#b0603a', 0.08)(i)));
    if (v % 2) for (let k = 0; k < 9; k++) { const a = k * 2.4, r = 2 + (k % 3) * 2; ell(m, Math.cos(a) * r, 18 + (k % 4) * 5, Math.sin(a) * r, 4.5, 3.2, 4.5, (i) => (N3(i.x, i.y, i.z) > 0.55 ? '#4f8a3a' : '#3a6e2a')); }
    else { capsule(m, [0, 9, 0], [0, 26, 0], 1, 0.8, '#5a3a20'); ell(m, 0, 31, 0, 8, 7, 8, (i) => (N3(i.x * 0.7, i.y * 0.7, i.z * 0.7) > 0.55 ? '#5a9a42' : '#3a6e2a')); }
  });
  def('luminaria', { name: 'Luminária', solid: 0, light: { r: 4, c: [255, 200, 130], y: 50 } }, (m) => {
    cyl(m, 0, 0, 4, 0, 1.2, { c: '#2a2a2e', m: M.METAL });
    capsule(m, [0, 1, 0], [0, 46, 0], 0.6, 0.6, { c: '#2a2a2e', m: M.METAL });
    m.sdf(R, [-8, 40, -8, 8, 56, 8], (x, y, z) => Math.max(Math.hypot(x, z) - (6.5 - (y - 42) * 0.25), Math.abs(y - 48) - 6), { c: '#f0d898', m: M.EMIT });
  });
  def('tapete_dummy', { name: 'Tapete', solid: 0 }, () => {});
  // ===== quarto =====
  const BLANK = ['#4a7a4a', '#a83a3a', '#3a5a8a', '#c87a2a', '#6a4a8a'];
  const bed = (m, v, wid) => {
    const hw = wid * 12 - 2;
    rb(m, 0, 6, 1, hw, 6, 34, 1, woodG('#6e4426', 'z'));
    rb(m, 0, 14, 1, hw - 0.5, 3, 33, 2, '#f2f0ea');
    rb(m, 0, 16.5, 7, hw + 0.5, 2, 26, 2, (i) => (Math.abs(i.y - 18) < 1 && N3(i.x * 0.5, 0, i.z * 0.5) > 0.6 ? VX.shade(pick(BLANK, v), 0.85) : fabric(pick(BLANK, v))(i)));
    for (const x of wid > 1 ? [-11, 11] : [0]) rb(m, x, 18, -27, 8.5, 2.5, 5, 2.5, '#f8f6f0');
    rb(m, 0, 16, -34.5, hw + 1, 16, 1.5, 1, woodG('#5e3a22', 'x'));
    rb(m, 0, 8, 35, hw + 1, 8, 1.2, 0.8, woodG('#5e3a22', 'x'));
  };
  def('cama_casal', { name: 'Cama de casal', w: 2, h: 3 }, (m, v) => bed(m, v, 2));
  def('cama_solteiro', { name: 'Cama de solteiro', w: 1, h: 3 }, (m, v) => bed(m, v + 2, 1.3));
  def('guarda_roupa', { name: 'Guarda-roupa', loot: 'quarto', w: 2, h: 1, tall: 1 }, (m, v) => {
    const w = pick(['#6e4426', '#e0dcd2', '#4a2e1a'], v);
    rb(m, 0, 32, -1, 22, 32, 9, 0.6, (i) => {
      if (i.z > 7.4 && (Math.abs(i.x) < 0.5 || Math.abs(Math.abs(i.x) - 11) < 0.4)) return VX.shade(w, 0.6);
      if (i.z > 7.4 && Math.abs(Math.abs(i.x) - 1.8) < 0.6 && Math.abs(i.y - 34) < 3) return { c: '#c9a24a', m: M.METAL };
      return woodG(w, 'y')(i);
    });
  });
  def('comoda', { name: 'Cômoda', loot: 'quarto' }, (m, v) => {
    const w = pick(['#8a5a34', '#5e3a22', '#e0dcd2'], v);
    rb(m, 0, 15, -1, 11, 15, 9, 0.5, (i) => (i.z > 7.4 && (i.y % 9) < 0.8 ? VX.shade(w, 0.6) : i.z > 7.4 && Math.abs(i.x) < 1.5 && (i.y % 9) > 4 && (i.y % 9) < 5.5 ? { c: '#c9a24a', m: M.METAL } : woodG(w, 'x')(i)));
    cyl(m, -5, -3, 2.5, 30, 34, '#7a4a8a'); bx(m, 3, 30, -5, 5, 1.5, 4, '#e8e2c8');
  });
  def('criado', { name: 'Criado-mudo', loot: 'quarto', light: { r: 3, c: [255, 210, 150], y: 30 } }, (m) => {
    rb(m, 0, 9, -3, 8, 9, 7, 0.5, (i) => (i.z > 3.4 && Math.abs(i.y - 12) < 0.6 ? '#3a2416' : woodG('#6e4426', 'x')(i)));
    cyl(m, -2, -5, 2.4, 18, 19.5, '#c9a24a'); capsule(m, [-2, 19, -5], [-2, 25, -5], 0.5, 0.5, '#c9a24a');
    m.sdf(R, [-8, 23, -11, 4, 32, 1], (x, y, z) => Math.max(Math.hypot(x + 2, z + 5) - (4.6 - (y - 24) * 0.25), Math.abs(y - 27.5) - 3.5), { c: '#f4dc9c', m: M.EMIT });
  });
  // ===== banheiro =====
  const cer = (i) => ({ c: VX.shade('#f2f2ee', 0.97 + N3(i.x, i.y, i.z) * 0.05), m: M.GLOSS });
  def('vaso', { name: 'Vaso sanitário' }, (m) => {
    rb(m, 0, 20, -8.5, 7, 7, 2.5, 1.5, cer);
    m.sdf(R, [-7, 0, -8, 7, 14, 9], SD.smooth(2, SD.ell(0, 10, 1.5, 5.5, 3.5, 7), SD.rbox(0, 5, -1, 3.5, 5, 4, 1.5)), (i) => (i.y > 12.6 && Math.hypot(i.x / 4, (i.z - 1.5) / 5.5) < 1 ? { c: '#a8c8d8', m: M.GLASS } : cer(i)));
  });
  def('pia_banheiro', { name: 'Pia do banheiro', loot: 'farmacia' }, (m) => {
    rb(m, 0, 11, -2, 10, 11, 8, 0.6, (i) => (i.z > 5.4 && Math.abs(i.x) < 0.5 ? '#9a9a9a' : paint('#e8e4dc', 0.03)(i)));
    rb(m, 0, 23, -1, 10.5, 1.5, 9, 1, (i) => (i.y > 23.6 && Math.hypot(i.x / 6, (i.z + 1) / 5) < 1 ? { c: '#d0e0e8', m: M.GLASS } : cer(i)));
    rb(m, 0, 40, -10, 8, 9, 0.6, 0.3, (i) => (i.z > -9.8 && Math.abs(i.x) < 7.2 && Math.abs(i.y - 40) < 8 ? { c: i.x + i.y * 0.5 < 18 ? '#9ab8c8' : '#d8eef6', m: M.GLASS } : '#c0c0c0'));
  });
  def('chuveiro', { name: 'Box do chuveiro' }, (m) => {
    rb(m, 0, 1.5, 0, 11, 1.5, 11, 0.5, cer);
    for (const s of [-1, 1]) bx(m, s * 11 - 0.5, 3, -11, 1, 52, 22, (i) => ({ c: i.y > 52 ? '#c0c4c8' : '#bfe0ec', m: M.GLASS }));
    bx(m, -11, 3, 10.5, 22, 52, 1, (i) => ({ c: i.y > 52 || Math.abs(i.x) < 0.6 ? '#c0c4c8' : (i.x + i.y) % 11 < 1 ? '#ffffff' : '#bfe0ec', m: M.GLASS }));
    capsule(m, [0, 3, -10], [0, 60, -10], 0.6, 0.6, { c: '#c0c4c8', m: M.METAL }); ell(m, 0, 60, -7, 2.5, 0.8, 2.5, { c: '#c0c4c8', m: M.METAL });
  });
  def('banheira', { name: 'Banheira', w: 1, h: 2 }, (m) => {
    m.sdf(R, [-12, 0, -24, 12, 18, 24], SD.sub(SD.rbox(0, 8.5, 0, 11, 8.5, 22.5, 4), SD.rbox(0, 14, 0, 8.5, 6, 20, 4)), cer);
    bx(m, -8, 12, -19, 16, 1, 38, { c: '#8ac4dc', m: M.GLASS });
  });
  def('maquina_lavar', { name: 'Máquina de lavar' }, (m) => {
    rb(m, 0, 15, -1, 10, 15, 9.5, 1, (i) => {
      const r = Math.hypot(i.x, i.y - 13);
      if (i.z > 7.6 && r < 6) return { c: r < 4.8 ? '#2a3a4a' : '#c0c4c8', m: r < 4.8 ? M.GLASS : M.METAL };
      if (i.z > 7.6 && i.y > 25 && Math.abs(i.x - 5) < 2) return '#3a3a44';
      return gloss('#ecece8', 0.02)(i);
    });
  });
  // ===== escritório =====
  def('escrivaninha', { name: 'Escrivaninha', loot: 'escritorio', w: 2, h: 1 }, (m, v) => {
    const w = pick(['#8a5a34', '#6e4426', '#9a6a3e'], v);
    rb(m, 0, 22, -1, 22, 1.2, 10, 0.5, woodG(w, 'x'));
    rb(m, 15, 11, -1, 6.5, 11, 9, 0.5, (i) => (i.z > 7.4 && (i.y % 7) < 0.7 ? '#3a2416' : woodG(w, 'y')(i)));
    for (const z of [-9, 7]) bx(m, -21, 0, z, 2, 21, 2, '#4a3020');
    if (v % 3 === 2) {
      rb(m, -3, 32, -3, 7.5, 7, 7, 1.5, (i) => (i.z > 3.6 && Math.abs(i.x + 3) < 5.4 && Math.abs(i.y - 33) < 4.6 ? { c: '#1c2a24', m: M.GLASS } : { c: '#d8ccb0', m: M.GLOSS }));
    } else {
      rb(m, -3, 33, -5, 9, 6, 0.8, 0.3, (i) => (i.z > -4.5 && Math.abs(i.x + 3) < 8 && Math.abs(i.y - 33) < 5 ? { c: '#162a3a', m: M.GLASS } : { c: '#18181c', m: M.GLOSS }));
      bx(m, -4, 23, -6, 2, 4, 2, '#18181c');
    }
    rb(m, -3, 23.6, 5, 6, 0.4, 2, 0.2, '#2a2a30'); rb(m, 6, 23.6, 5, 1, 0.4, 1.4, 0.3, '#2a2a30');
    bx(m, 9, 23, -6, 6, 1, 8, (i) => (H(i.x, i.z, 1) > 0.5 ? '#f2f0ea' : '#e0dcd0'));
    cyl(m, -15, 2, 1.6, 23, 27, '#c03a2a');
  });
  def('arquivo', { name: 'Arquivo', loot: 'escritorio' }, (m) => {
    rb(m, 0, 20, -1, 8, 20, 9, 0.5, (i) => (i.z > 7.4 && (i.y % 10) < 0.7 ? '#3a3e44' : i.z > 7.4 && Math.abs(i.x) < 2 && (i.y % 10) > 6 && (i.y % 10) < 7 ? { c: '#c0c4c8', m: M.METAL } : metal('#7a8088')(i)));
  });
  def('armario_armas', { name: 'Armário de armas', loot: 'policia', w: 2, h: 1, tall: 1 }, (m) => {
    rb(m, 0, 30, -1, 22, 30, 9, 0.5, (i) => {
      if (i.z > 7.4 && (Math.abs(i.x) < 0.5 || Math.abs(Math.abs(i.x) - 11) < 0.4)) return '#1e2420';
      if (i.z > 7.4 && i.y > 48 && i.y < 54 && Math.floor(i.x) % 2 === 0) return '#1e2420';
      return metal('#3e4a3e')(i);
    });
  });
  def('armario_metal', { name: 'Armário de metal', loot: 'oficina', tall: 1 }, (m, v) => {
    const c = pick(['#4a5a6e', '#6a7078', '#3e4a3e'], v);
    rb(m, 0, 30, -1, 10, 30, 9, 0.5, (i) => (i.z > 7.4 && Math.abs(i.x) < 0.4 ? '#22262a' : i.z > 7.4 && i.y > 48 && i.y < 54 && Math.floor(i.x) % 2 === 0 ? '#22262a' : metal(c)(i)));
  });
  def('servidor', { name: 'Servidor', tall: 1, light: { r: 2, c: [80, 255, 160], y: 30 } }, (m) => {
    rb(m, 0, 30, -1, 10, 30, 9.5, 0.4, (i) => {
      if (i.z > 8 && Math.floor(i.y) % 6 === 2 && i.x > -8 && i.x < 6) return H(i.x, i.y, 2) > 0.6 ? { c: H(i.x, i.y, 4) > 0.5 ? '#5aff9a' : '#5ad8ff', m: M.EMIT } : '#0c0c10';
      return { c: '#16181c', m: M.GLOSS };
    });
  });
  // ===== loja / mercado / farmácia =====
  const goods = (m, x0, x1, y, z0, z1, pal, v) => {
    for (let x = x0; x < x1 - 2;) {
      const w = 2 + Math.floor(H(x, y, v) * 3), h = 4 + Math.floor(H(x, y, 2) * 6);
      const c = pick(pal, Math.floor(H(x, y, 7 + v) * pal.length * 3));
      if (H(x, y, 11) > 0.12) {
        if (H(x, y, 13) > 0.6) cyl(m, x + w / 2, (z0 + z1) / 2, w / 2, y, y + h, { c, m: M.GLOSS });
        else bx(m, x, y, z0, w, h, z1 - z0, (i) => (i.front && Math.abs(i.y - y - h * 0.6) < 0.8 ? '#f2f0ea' : c));
      }
      x += w + 0.5;
    }
  };
  def('prateleira_mercado', { name: 'Prateleira', loot: 'mercado', w: 2, h: 1, tall: 1 }, (m, v) => {
    bx(m, -23, 0, -1, 46, 50, 2, metal('#a8adb4'));
    for (const y of [2, 14, 26, 38]) for (const s of [-1, 1]) { bx(m, -23, y, s > 0 ? 1 : -10, 46, 1.2, 9, metal('#8a9098')); goods(m, -22, 22, y + 1.2, s > 0 ? 2 : -9, s > 0 ? 9 : -2, ['#c0392b', '#e8b030', '#3a7ac0', '#5aa04a', '#e8e0d0', '#e07a20', '#8a4ac0'], v + y + s); }
    bx(m, -23, 50, -9, 46, 4, 18, (i) => (i.front ? '#c03030' : '#a8adb4'));
  });
  def('freezer', { name: 'Freezer de bebidas', loot: 'freezer', w: 2, h: 1, tall: 1, light: { r: 3, c: [160, 210, 255], y: 30 } }, (m, v) => {
    rb(m, 0, 30, -1, 22, 30, 9.5, 0.6, (i) => {
      if (i.z > 7.8 && i.y > 4 && i.y < 56 && Math.abs(i.x) < 21 && Math.abs(Math.abs(i.x) - 0) > 0.7) return { c: '#a8d8f0', m: M.GLASS };
      if (i.y > 56) return { c: '#2a6ad8', m: M.GLOSS };
      return gloss('#e8e8e4')(i);
    });
    for (const y of [6, 18, 30, 42]) goods(m, -20, 20, y, 0, 6, ['#c4282c', '#2a8a3a', '#e8a020', '#f0f0f0', '#3a6ad8'], v + y);
  });
  def('caixa_registradora', { name: 'Caixa registradora', w: 2, h: 1 }, (m) => {
    rb(m, 0, 13, 0, 22, 13, 10, 0.6, (i) => (i.y > 25 && i.x < 6 ? '#1a1a1e' : paint('#c8c4bc', 0.04)(i)));
    rb(m, 13, 30, -2, 6, 4, 5, 1, (i) => (i.z > 2.4 && i.y > 30 ? { c: '#2a4a3a', m: M.GLASS } : '#5a5e66'));
  });
  def('estante_farmacia', { name: 'Estante de remédios', loot: 'farmacia', w: 2, h: 1, tall: 1 }, (m, v) => {
    bx(m, -23, 0, -10, 46, 56, 2, '#e8ecee');
    for (const x of [-23, 21]) bx(m, x, 0, -10, 2, 56, 18, '#e8ecee');
    for (const y of [0, 14, 28, 42, 54]) bx(m, -23, y, -10, 46, 2, 18, '#dfe4e6');
    for (let sh = 0; sh < 4; sh++) goods(m, -21, 21, sh * 14 + 2, -7, 3, ['#ffffff', '#e05050', '#4a9a6a', '#f0f0f0', '#e08a30', '#3a7ac0'], v + sh * 3);
    bx(m, -23, 48, 7, 46, 6, 1, (i) => (Math.abs(i.x) < 3 && Math.abs(i.y - 51) < 2.4 && (Math.abs(i.x) < 0.9 || Math.abs(i.y - 51) < 0.9) ? { c: '#3ad06a', m: M.EMIT } : '#ffffff'));
  });
  def('balcao_loja', { name: 'Balcão', w: 2, h: 1 }, (m) => {
    rb(m, 0, 14, 0, 22, 14, 10, 0.6, (i) => (i.y > 26.5 ? { c: '#3a3a40', m: M.GLOSS } : woodG('#8a5a34', 'x')(i)));
  });
  def('mesa_lanchonete', { name: 'Mesa', solid: 1 }, (m, v) => {
    cyl(m, 0, 0, 9, 22, 23.5, { c: pick(['#c03a2a', '#e8e4dc', '#3a7ac0'], v), m: M.GLOSS });
    capsule(m, [0, 0, 0], [0, 22, 0], 1, 1, { c: '#a0a4a8', m: M.METAL }); cyl(m, 0, 0, 5, 0, 1, { c: '#a0a4a8', m: M.METAL });
  });
  // ===== hospital / laboratório =====
  def('maca', { name: 'Maca', w: 1, h: 3 }, (m, v) => {
    rb(m, 0, 18, 0, 10, 1.5, 32, 0.6, { c: '#b8bcc0', m: M.METAL });
    rb(m, 0, 21.5, 0, 9.5, 2.2, 31, 1.5, '#f2f2ee');
    rb(m, 0, 23.5, 6, 10, 1.5, 22, 1.5, fabric(pick(['#7ab0d0', '#9ac8a0'], v)));
    rb(m, 0, 25, -25, 6, 2, 4.5, 2, '#ffffff');
    for (const [x, z] of [[-8, -29], [8, -29], [-8, 29], [8, 29]]) { capsule(m, [x, 2.5, z], [x, 17, z], 0.6, 0.6, { c: '#a0a4a8', m: M.METAL }); ell(m, x, 1.6, z, 1.4, 1.6, 1.4, '#1a1a1e'); }
    rb(m, 0, 28, -32, 10, 10, 0.8, 0.4, { c: '#c0c4c8', m: M.METAL });
  });
  def('cadeiras_espera', { name: 'Cadeiras', w: 2, h: 1 }, (m, v) => {
    for (const x of [-15, 0, 15]) { rb(m, x, 13, 1, 6.5, 1.2, 6, 1, { c: pick(['#3a6ab0', '#c04a3a', '#e0a020'], v), m: M.GLOSS }); rb(m, x, 22, -5.5, 6.5, 8, 0.9, 1, { c: pick(['#3a6ab0', '#c04a3a', '#e0a020'], v), m: M.GLOSS }); }
    bx(m, -22, 10, -3, 44, 1.5, 3, { c: '#8a9098', m: M.METAL });
    for (const x of [-20, 19]) bx(m, x, 0, -2, 1.5, 11, 1.5, { c: '#8a9098', m: M.METAL });
  });
  def('bancada_lab', { name: 'Bancada de laboratório', loot: 'lab', w: 2, h: 1, light: { r: 2.5, c: [120, 255, 200], y: 30 } }, (m, v) => {
    rb(m, 0, 12, -1, 22, 12, 9.5, 0.5, (i) => (i.z > 7.8 && Math.abs(i.x % 11) < 0.5 ? '#9aa0a4' : paint('#eef0ee', 0.03)(i)));
    rb(m, 0, 24.6, 0, 23, 0.9, 11, 0.3, { c: '#1e2226', m: M.GLOSS });
    const cols = ['#3fd08a', '#3ab0e0', '#e05a8a', '#e0c040', '#c062d0'];
    for (let k = 0; k < 5; k++) {
      const x = -17 + k * 6, z = -3 + (k % 2) * 4, h = 6 + (k % 3) * 3;
      cyl(m, x, z, 2, 25.5, 25.5 + h, (i) => (i.y < 25.5 + h * 0.6 ? { c: cols[(k + v) % 5], m: M.EMIT } : { c: '#d8eef4', m: M.GLASS }));
    }
    bx(m, 12, 25.5, -6, 6, 2, 6, '#2a2c30'); capsule(m, [15, 27, -3], [14, 37, -3], 1.2, 1.2, '#e8e8e4'); capsule(m, [14, 37, -3], [14, 33, 2], 1, 0.6, '#2a2c30');
  });
  def('armario_lab', { name: 'Armário do laboratório', loot: 'lab', tall: 1 }, (m) => {
    rb(m, 0, 30, -1, 10, 30, 9, 0.5, (i) => (i.z > 7.4 && i.y > 20 && Math.abs(i.x) < 8 ? { c: '#b8d8e0', m: M.GLASS } : paint('#eef0ee', 0.03)(i)));
    for (const y of [24, 36, 48]) goods(m, -8, 8, y, -6, 4, ['#ffffff', '#3fd08a', '#e05a8a', '#3ab0e0'], y);
  });
  def('tanque', { name: 'Tanque de contenção', lore: 'tanque', tall: 1, light: { r: 5, c: [90, 255, 170], y: 30 } }, (m) => {
    cyl(m, 0, 0, 10, 0, 8, metal('#5a6066'));
    cyl(m, 0, 0, 9, 8, 58, (i) => (Math.hypot(i.x, i.z) > 8.4 ? { c: (Math.atan2(i.z, i.x) * 6) % 1 < 0.15 ? '#ffffff' : '#7ef0c0', m: M.GLASS } : { c: '#4aff9a', m: M.EMIT }));
    cyl(m, 0, 0, 10, 58, 64, metal('#5a6066'));
    m.sdf(R, [-6, 12, -6, 6, 52, 6], SD.smooth(2, SD.ell(0, 38, 0, 3.6, 7, 3), SD.cap([0, 30, 0], [-3, 16, 1], 1.2, 0.6), SD.cap([0, 30, 0], [3, 15, -1], 1.2, 0.6), SD.ell(0, 46, 1, 3, 4, 3.4)), (i) => ({ c: i.z > 2 && i.y > 45 && Math.abs(Math.abs(i.x) - 1.2) < 0.6 ? '#ff4adf' : '#1a2a20', m: M.MATTE }));
    capsule(m, [9, 60, 0], [14, 60, 0], 1.2, 1.2, metal('#5a6066')); capsule(m, [14, 60, 0], [14, 0, 0], 1.2, 1.2, metal('#5a6066'));
  });
  // ===== oficina / galpão =====
  def('bancada_ferramentas', { name: 'Bancada de ferramentas', loot: 'oficina', w: 2, h: 1 }, (m) => {
    rb(m, 0, 22, 0, 22, 1.5, 10, 0.4, woodG('#7a5a36', 'x'));
    for (const [x, z] of [[-20, -8], [20, -8], [-20, 8], [20, 8]]) bx(m, x - 1, 0, z - 1, 2, 21, 2, metal('#4a4e54'));
    bx(m, -21, 6, -9, 42, 1, 18, metal('#4a4e54'));
    bx(m, -22, 24, -11, 44, 30, 1.5, (i) => (Math.floor(i.x) % 3 === 0 && Math.floor(i.y) % 3 === 0 ? '#3a2a1a' : '#a88a5a'));
    capsule(m, [-14, 30, -9], [-14, 44, -9], 0.6, 0.6, { c: '#c0392b', m: M.GLOSS }); capsule(m, [-8, 32, -9], [-5, 46, -9], 0.8, 0.5, '#2a2a2e');
    bx(m, 4, 36, -9.5, 10, 6, 1, { c: '#c0c4c8', m: M.METAL }); bx(m, 12, 23.5, -4, 6, 5, 6, metal('#3a5a8a'));
  });
  def('prateleira_industrial', { name: 'Porta-paletes', loot: 'caixa', w: 4, h: 1, tall: 1 }, (m, v) => {
    for (const x of [-47, -1, 45]) for (const z of [-11, 9]) bx(m, x, 0, z, 2, 70, 2, { c: '#2a5aa8', m: M.GLOSS });
    for (const y of [22, 46, 69]) for (const z of [-11, 9]) bx(m, -47, y - 3, z, 94, 3, 2, { c: '#e07a20', m: M.GLOSS });
    for (const y of [0, 24, 48]) for (let k = 0; k < 4; k++) {
      const x = -44 + k * 22.5;
      if (H(k, y, v) < 0.2) continue;
      bx(m, x, y, -10, 20, 2, 20, woodG('#b0905a', 'x'));
      const bh = 10 + Math.floor(H(k, y, 3) * 9);
      rb(m, x + 10, y + 2 + bh / 2, 0, 9, bh / 2, 9, 0.6, (i) => (Math.abs(i.y - (y + 2 + bh * 0.6)) < 0.8 ? '#a8885a' : paint(pick(['#c09a64', '#b08a58', '#d0aa74'], k + y), 0.05)(i)));
    }
  });
  const crate = (m, s) => rb(m, 0, 10 * s, 0, 10 * s, 10 * s, 10 * s, 0.4, (i) => (Math.abs(i.x) > 8.6 * s || Math.abs(i.z) > 8.6 * s && Math.abs(i.y - 10 * s) > 8.6 * s || Math.abs(i.y - 10 * s) > 8.6 * s || Math.abs(Math.abs(i.x) - Math.abs(i.y - 10 * s)) < 0.8 ? woodG('#7a5232', 'y')(i) : woodG('#a8784a', 'x')(i)));
  def('caixa', { name: 'Caixote', loot: 'caixa' }, (m) => crate(m, 1));
  def('caixa_papelao', { name: 'Caixas de papelão', loot: 'caixa', solid: 1 }, (m, v) => {
    rb(m, -3, 7, 1, 8, 7, 8, 0.4, (i) => (Math.abs(i.x + 3) < 0.6 && i.y > 13 ? '#c8b070' : paint('#b8905a', 0.05)(i)));
    if (v % 2) rb(m, -1, 18, 0, 6, 4, 6, 0.4, (i) => (Math.abs(i.y - 21.5) < 0.5 ? '#c8b070' : paint('#c8a06a', 0.05)(i)));
    rb(m, 7, 4, -5, 4, 4, 5, 0.3, paint('#a8804a', 0.05));
  });
  def('palete', { name: 'Paletes', solid: 0 }, (m, v) => {
    const n = 1 + (v % 3);
    for (let k = 0; k < n; k++) for (let s = -1; s <= 1; s++) { bx(m, -11, k * 4.4, s * 9 - 1.5, 22, 1.6, 3, woodG('#c0a070', 'x')); }
    for (let k = 0; k < n; k++) for (let s = 0; s < 5; s++) bx(m, -11 + s * 4.9, k * 4.4 + 1.6, -11, 3, 1.2, 22, woodG('#b89868', 'z'));
  });
  def('barril', { name: 'Barril', solid: 1 }, (m, v) => {
    const c = pick(['#7a5a32', '#2f5f9e', '#c9a12a', '#3a5a3a', '#a83232'], v);
    cyl(m, 0, 0, 8, 0, 26, (i) => (Math.abs(i.y - 8) < 0.8 || Math.abs(i.y - 18) < 0.8 ? VX.shade(c, 0.65) : i.y > 25.2 ? VX.shade(c, 0.8) : v % 5 === 0 ? rust(c)(i) : v % 5 === 2 && Math.abs(i.y - 13) < 3 && i.z > 5 ? (Math.floor(i.x + i.y) % 4 < 2 ? '#1a1a1a' : '#e0c030') : v % 5 === 4 && Math.abs(i.y - 13) < 2.5 && i.z > 5 ? '#f2f2f2' : { c: VX.shade(c, 0.95 + N3(i.x, i.y * 0.2, i.z) * 0.1), m: M.METAL }));
  });
  def('pneus', { name: 'Pneus', solid: 1 }, (m, v) => {
    const n = 2 + (v % 3);
    for (let k = 0; k < n; k++) m.sdf(R, [-11, k * 5.2 - 1, -11, 11, k * 5.2 + 6, 11], (x, y, z) => { const q = Math.hypot(x + (k % 2) * 0.8, z) - 7.2; return Math.hypot(q, y - k * 5.2 - 2.6) - 2.8; }, (i) => (N3(Math.atan2(i.z, i.x) * 6, i.y, 1) > 0.6 ? '#2a2a2e' : '#1a1a1e'));
  });
  def('sacos_areia', { name: 'Sacos de areia', w: 2, h: 1 }, (m) => {
    for (let r = 0; r < 4; r++) for (let k = 0; k < (r % 2 ? 4 : 5); k++) ell(m, -20 + k * 10 + (r % 2) * 5, 2.8 + r * 5, (r % 2) * 1 - 1, 5.6, 3, 8, (i) => (N3(i.x * 0.8, i.y * 0.8, i.z * 0.8) > 0.6 ? '#b8a478' : '#a8946a'));
  });
  def('caixa_militar', { name: 'Caixa militar', loot: 'militar' }, (m) => {
    rb(m, 0, 7, 0, 11, 7, 7.5, 0.6, (i) => (i.y > 12.5 && Math.abs(i.x) < 6 ? '#3e4626' : i.z > 6.4 && Math.abs(i.y - 7) < 2 && Math.abs(i.x) < 6 ? '#d8c890' : paint('#4d5634', 0.06)(i)));
    for (const s of [-1, 1]) bx(m, s * 11 - 1, 8, -2, 2, 2, 4, { c: '#2a2e1e', m: M.METAL });
  });
  // ===== rua =====
  def('lixeira', { name: 'Lixeira', loot: 'lixo' }, (m, v) => {
    cyl(m, 0, 0, 7, 0, 22, (i) => (Math.floor(i.y) % 4 === 0 ? { c: '#4f555a', m: M.METAL } : metal('#737a80')(i)));
    if (v % 2) cyl(m, 0, 0, 7.6, 22, 24, { c: '#4f555a', m: M.METAL });
    else { ell(m, 2, 23, 1, 5, 3, 5, '#1a1a1e'); ell(m, 9, 2, 5, 4, 2.5, 3.5, '#d8d0c0'); }
  });
  def('cacamba', { name: 'Caçamba', loot: 'lixo', w: 3, h: 2 }, (m, v) => {
    const c = pick(['#2e6a3e', '#2a4a7a', '#7a2a24'], v);
    m.sdf(R, [-34, 3, -22, 34, 38, 22], (x, y, z) => SD.rbox(0, 20, 0, 32 - (38 - y) * 0.06, 16, 20 - (38 - y) * 0.08, 1)(x, y, z), (i) => (Math.abs(i.x % 12) < 0.8 ? VX.shade(c, 0.7) : rust(c)(i)));
    bx(m, -32, 36, -20, 64, 1.5, 22, (i) => (v % 2 ? '#1a1a1e' : VX.shade(c, 0.85)));
    for (const [x, z] of [[-26, -14], [26, -14], [-26, 14], [26, 14]]) ell(m, x, 2.2, z, 2, 2.2, 2, '#1a1a1e');
    if (v % 2) { ell(m, -10, 39, 6, 7, 4, 6, '#1a1a1e'); ell(m, 8, 38, 10, 6, 3.5, 5, '#22222a'); }
  });
  def('sacos_lixo', { name: 'Sacos de lixo', solid: 0 }, (m, v) => {
    for (let k = 0; k < 2 + (v % 2); k++) { const x = [-4, 5, 0][k], z = [2, -1, -6][k]; ell(m, x, 6, z, 6, 6.5, 5.5, (i) => ({ c: N3(i.x, i.y, i.z) > 0.6 ? '#2e2e3a' : '#1c1c26', m: M.GLOSS })); capsule(m, [x, 12, z], [x + 1, 15, z], 1, 0.4, '#1c1c26'); }
  });
  def('poste', { name: 'Poste de luz', light: { r: 9, c: [255, 214, 150], y: 92, dx: 0, dz: 16 }, tall: 1 }, (m) => {
    cyl(m, 0, 0, 2.6, 0, 6, { c: '#3a3e44', m: M.METAL });
    capsule(m, [0, 5, 0], [0, 92, 0], 1.3, 1.0, { c: '#3a3e44', m: M.METAL });
    m.sdf(R, [-3, 86, -3, 3, 104, 20], (x, y, z) => { const q = Math.hypot(y - 92, z - 8) - 8; return Math.max(Math.hypot(q, x) - 1, -(y - 92)); }, { c: '#3a3e44', m: M.METAL });
    rb(m, 0, 97, 16, 3, 1.8, 4.5, 1.2, (i) => (i.y < 95.8 ? { c: '#fff2c0', m: M.EMIT } : { c: '#3a3e44', m: M.METAL }));
  });
  def('placa', { name: 'Placa', solid: 1 }, (m, v) => {
    capsule(m, [0, 0, 0], [0, 58, 0], 0.7, 0.7, { c: '#9aa0a6', m: M.METAL });
    if (v % 2) m.sdf(R, [-9, 50, -1, 9, 70, 2], (x, y, z) => Math.max(Math.max(Math.abs(x), Math.abs(y - 60), (Math.abs(x) + Math.abs(y - 60)) * 0.7071) - 8, Math.abs(z - 0.6) - 0.5), (i) => (Math.abs(i.y - 60) < 1.6 && Math.abs(i.x) < 5.5 && i.z > 0.6 ? '#ffffff' : { c: '#c42a22', m: M.GLOSS }));
    else m.sdf(R, [-9, 50, -1, 9, 70, 2], (x, y, z) => Math.max(Math.hypot(x, y - 60) - 8, Math.abs(z - 0.6) - 0.5), (i) => { const r = Math.hypot(i.x, i.y - 60); return r > 6.4 ? { c: '#c42a22', m: M.GLOSS } : Math.abs(i.x + (i.y - 60)) < 1.4 ? { c: '#c42a22', m: M.GLOSS } : { c: '#2a5ac0', m: M.GLOSS }; });
  });
  def('hidrante', { name: 'Hidrante' }, (m) => {
    cyl(m, 0, 0, 3.5, 0, 16, { c: '#c42a22', m: M.GLOSS }); ell(m, 0, 16, 0, 3.6, 2.6, 3.6, { c: '#c42a22', m: M.GLOSS });
    capsule(m, [-5.5, 11, 0], [5.5, 11, 0], 1.6, 1.6, { c: '#e8c040', m: M.GLOSS }); cyl(m, 0, 0, 5, 0, 1.2, { c: '#8a1a14', m: M.GLOSS });
  });
  def('banco', { name: 'Banco', w: 2, h: 1 }, (m) => {
    for (const z of [-3, 1, 5]) rb(m, 0, 14, z, 21, 0.8, 1.5, 0.4, woodG('#8a5a34', 'x'));
    for (const y of [20, 25]) rb(m, 0, y, -7.5, 21, 1.5, 0.8, 0.4, woodG('#8a5a34', 'x'));
    for (const x of [-17, 17]) { bx(m, x - 1, 0, 3, 2, 14, 2, { c: '#2a2e32', m: M.METAL }); bx(m, x - 1, 0, -8, 2, 28, 2, { c: '#2a2e32', m: M.METAL }); }
  });
  def('barreira', { name: 'Barreira', w: 2, h: 1 }, (m, v) => {
    const a = v % 2 ? '#e8c020' : '#e86a20';
    for (const y of [16, 26]) rb(m, 0, y, 0, 22, 3.5, 1.2, 0.5, (i) => (Math.floor((i.x + i.y) / 5) % 2 ? { c: a, m: M.GLOSS } : '#1e1e22'));
    for (const x of [-18, 18]) { capsule(m, [x, 0, -6], [x, 30, 0], 0.9, 0.9, '#d8d8d8'); capsule(m, [x, 0, 6], [x, 30, 0], 0.9, 0.9, '#d8d8d8'); ell(m, x, 32, 0, 2.2, 2.2, 2.2, { c: '#ffa020', m: M.EMIT }); }
  });
  def('cone', { name: 'Cone', solid: 0 }, (m) => {
    bx(m, -6, 0, -6, 12, 1.5, 12, '#1e1e22');
    m.sdf(R, [-5, 1, -5, 5, 22, 5], (x, y, z) => Math.max(Math.hypot(x, z) - (4.8 - (y - 1) * 0.2), Math.abs(y - 11) - 10), (i) => (Math.abs(i.y - 12) < 2.2 ? '#f2f2f2' : { c: '#f06a20', m: M.GLOSS }));
  });
  def('ar_cond', { name: 'Ar-condicionado', solid: 1 }, (m) => {
    rb(m, 0, 12, 0, 11, 12, 9, 0.8, (i) => { const r = Math.hypot(i.x - 2, i.y - 12); if (i.z > 7.6 && r < 8) return r < 1.5 ? '#3a3a3e' : (Math.floor(Math.atan2(i.y - 12, i.x - 2) * 3) % 2 ? '#5a5e64' : '#2a2c30'); return metal('#c8cac8')(i); });
  });
  def('conteiner', { name: 'Contêiner', w: 3, h: 8, tall: 1 }, (m, v) => {
    const c = pick(['#a8442a', '#2a5a8a', '#3a6a3a', '#c09030'], v);
    rb(m, 0, 32, 0, 35, 32, 95, 0.6, (i) => (Math.abs(i.x) > 34 || Math.abs(i.z) > 94 ? (Math.floor(i.z / 3) % 2 || Math.floor(i.x / 3) % 2 ? VX.shade(c, 0.78) : c) : i.y > 63 ? VX.shade(c, 0.9) : rust(c)(i)));
  });
  def('tenda', { name: 'Tenda militar', w: 3, h: 3, tall: 1 }, (m) => {
    m.sdf(R, [-36, 0, -36, 36, 48, 36], (x, y, z) => Math.max(Math.abs(x) * 0.55 + y - 46, Math.abs(z) - 34, -y, -(Math.abs(x) * 0.55 + y - 44)), (i) => (i.z > 33 && Math.abs(i.x) < 6 && i.y < 30 ? '#1a1e14' : paint('#5a6440', 0.06)(i)));
  });
  def('carro', { name: 'Carro abandonado', loot: 'carro', w: 2, h: 5, tall: 1 }, (m, v) => buildCar(m, v, 1));
  def('van', { name: 'Van', loot: 'carro', w: 2, h: 6, tall: 1 }, (m, v) => buildVan(m, v));
  // ===== árvores =====
  def('arvore', { name: 'Árvore', tall: 1 }, (m, v) => {
    const k = v % 4;
    const bark = (i) => (N3(i.x * 0.6, i.y * 0.15, i.z * 0.6) > 0.55 ? '#5e4028' : '#4a3220');
    if (k === 1) {
      capsule(m, [0, 0, 0], [0, 30, 0], 3.2, 2.2, bark);
      for (let t = 0; t < 5; t++) m.sdf(R, [-30, 20, -30, 30, 110, 30], (x, y, z) => Math.max(Math.hypot(x, z) - (24 - t * 4.2) * (1 - (y - (26 + t * 14)) / 22), y - (48 + t * 14), (26 + t * 14) - y), (i) => { const n = N3(i.x * 0.4, i.y * 0.4, i.z * 0.4); return n > 0.62 ? '#3e7a44' : n < 0.3 ? '#1e3e24' : '#2a5a32'; });
      return;
    }
    if (k === 3) {
      capsule(m, [0, 0, 0], [1, 40, 0], 3, 1.8, '#5a5650');
      capsule(m, [1, 30, 0], [-12, 50, 4], 1.4, 0.6, '#5a5650'); capsule(m, [0, 36, 0], [10, 54, -4], 1.2, 0.5, '#5a5650');
      for (const [x, y, z] of [[2, 18, 3], [-2, 30, 2.8], [1, 42, -2]]) m.sdf(R, [x - 8, y - 2, z - 8, x + 8, y + 3, z + 8], SD.ell(x + 3, y, z + 2, 6, 1.4, 4), (i) => (H(i.x, i.y, i.z) > 0.88 ? { c: '#7ff7e5', m: M.EMIT } : { c: '#6b3f8e', m: M.GLOSS }));
      return;
    }
    capsule(m, [0, 0, 0], [0, 38, 0], 3.4, 2.4, bark);
    capsule(m, [0, 28, 0], [-9, 44, 3], 1.8, 1, bark); capsule(m, [0, 30, 0], [8, 46, -4], 1.8, 1, bark);
    const g = k === 2 ? ['#7a8a2e', '#5a6a22', '#9aaa3e'] : ['#4f8a3a', '#3a6a2a', '#6ea84a'];
    const blobs = [[0, 54, 0, 20], [-12, 46, 6, 13], [12, 47, -4, 13], [4, 62, 6, 12], [-6, 60, -8, 12], [10, 52, 10, 11]];
    for (const [x, y, z, r] of blobs) ell(m, x, y, z, r, r * 0.8, r, (i) => { const n = N3(i.x * 0.35, i.y * 0.35, i.z * 0.35) + (H(i.x, i.y, i.z) - 0.5) * 0.25; return n > 0.62 ? g[2] : n < 0.36 ? g[1] : g[0]; });
  });
  def('arbusto', { name: 'Arbusto', solid: 0 }, (m, v) => {
    for (let k = 0; k < 4; k++) ell(m, Math.cos(k * 1.7) * 4, 6 + (k % 2) * 3, Math.sin(k * 1.7) * 4, 7, 6, 7, (i) => { const n = N3(i.x * 0.5, i.y * 0.5, i.z * 0.5); return n > 0.6 ? (v % 3 === 1 && H(i.x, i.y, i.z) > 0.9 ? '#e05a8a' : '#5f8a3a') : '#3e6a2a'; });
  });
  def('cerca_viva', { name: 'Cerca viva' }, (m) => {
    rb(m, 0, 14, 0, 12, 14, 9, 4, (i) => { const n = N3(i.x * 0.5, i.y * 0.5, i.z * 0.5) + (H(i.x, i.y, i.z) - 0.5) * 0.3; return n > 0.6 ? '#4f8a3a' : n < 0.35 ? '#2a5222' : '#3e6e2e'; });
  });
  // ===== fungo / alienígena =====
  const FUN = { cap: '#6b3f8e', rim: '#c062d0', spot: '#7ff7e5', gill: '#2a1838', stalk: '#d4cab4' };
  const mush = (m, x, z, h, r, pal) => {
    capsule(m, [x, 0, z], [x + h * 0.08, h, z], r * 0.28, r * 0.2, pal.stalk);
    m.sdf(R, [x - r - 1, h - r * 0.5 - 1, z - r - 1, x + r + 1, h + r * 0.6 + 1, z + r + 1], SD.sub(SD.ell(x, h, z, r, r * 0.5, r), SD.ell(x, h - r * 0.32, z, r * 0.92, r * 0.32, r * 0.92)), (i) => (i.y < h - r * 0.05 ? pal.gill : H(i.x * 2, i.y * 2, i.z * 2) > 0.84 ? { c: pal.spot, m: M.EMIT } : { c: VX.mix(pal.cap, pal.rim, Math.min(1, Math.hypot(i.x - x, i.z - z) / r)), m: M.GLOSS }));
  };
  def('cogumelos', { name: 'Cogumelos luminosos', solid: 0, light: { r: 3, c: [120, 255, 230], y: 10, glow: 1 } }, (m, v) => {
    const pal = v % 2 ? FUN : { cap: '#1e6b6e', rim: '#4fd0c0', spot: '#e7ff6a', gill: '#132a2c', stalk: '#c8c2a8' };
    for (let k = 0; k < 5; k++) mush(m, Math.cos(k * 2.3 + v) * (3 + k * 1.8), Math.sin(k * 2.3 + v) * (3 + k * 1.6), 4 + ((k * 7 + v) % 5) * 2.4, 2.6 + ((k + v) % 3) * 1.4, pal);
  });
  def('casulo', { name: 'Casulo', loot: 'casulo', tall: 1, light: { r: 2.5, c: [200, 90, 255], y: 30, glow: 1 } }, (m) => {
    m.sdf(R, [-10, 0, -10, 10, 60, 10], SD.smooth(3, SD.ell(0, 30, 0, 8, 28, 7), SD.ell(0, 3, 0, 9, 4, 8)), (i) => {
      const v = Math.abs(N3(i.x * 0.4, i.y * 0.15, i.z * 0.4) - 0.5);
      if (v < 0.03) return { c: '#d06aff', m: M.EMIT };
      if (i.z > 5 && Math.abs(i.y - 46) < 4 && Math.abs(i.x) < 3.5) return VX.mix('#e8dcd0', '#a89080', N3(i.x, i.y, i.z));
      return { c: VX.mix('#d8ccd8', '#8a6a9a', N3(i.x * 0.2, i.y * 0.2, i.z * 0.2)), m: M.GLOSS };
    });
  });
  def('pilar_fungico', { name: 'Pilar fúngico', tall: 1, light: { r: 3, c: [200, 90, 255], y: 40, glow: 1 } }, (m, v) => {
    m.sdf(R, [-10, 0, -10, 10, 80, 10], (x, y, z) => { const tw = y * 0.08 + v; return Math.hypot(x - Math.sin(tw) * 3, z - Math.cos(tw) * 3) - (5 - y * 0.035); }, (i) => (Math.abs(N3(i.x * 0.3, i.y * 0.1, i.z * 0.3) - 0.5) < 0.04 ? { c: '#7ff7e5', m: M.EMIT } : { c: VX.mix('#3a1f4a', '#6b3f8e', N3(i.x * 0.2, i.y * 0.1, i.z * 0.2)), m: M.GLOSS }));
    for (let k = 0; k < 4; k++) { const y = 20 + k * 14, a = k * 2.1 + v; m.sdf(R, [-14, y - 3, -14, 14, y + 3, 14], SD.ell(Math.cos(a) * 6, y, Math.sin(a) * 6, 6, 1.4, 5), (i) => (H(i.x, i.y, i.z) > 0.85 ? { c: '#7ff7e5', m: M.EMIT } : { c: '#c062d0', m: M.GLOSS })); }
  });
  def('ninho', { name: 'Ninho de micélio', w: 2, h: 2, hp: 420, nest: 1, tall: 1, light: { r: 7, c: [210, 80, 255], y: 20, glow: 1 } }, (m, v) => {
    const pods = [[0, 14, 0, 14, 16, 13], [-14, 9, 8, 9, 10, 9], [13, 8, -9, 9, 9, 8], [10, 7, 13, 7, 7, 7], [-12, 6, -12, 7, 6, 7]];
    for (const [x, y, z, rx, ry, rz] of pods) ell(m, x, y, z, rx, ry, rz, (i) => {
      const n = N3(i.x * 0.25, i.y * 0.25, i.z * 0.25);
      if (Math.abs(N3(i.x * 0.5, i.y * 0.5 + v, i.z * 0.5) - 0.5) < 0.05) return { c: '#ff6adf', m: M.EMIT };
      if (n > 0.66) return { c: '#ffd0ff', m: M.EMIT };
      return { c: VX.mix('#3a1240', '#8a3a9a', n), m: M.GLOSS };
    });
    for (let k = 0; k < 9; k++) { const a = k * 0.7 + v, r = 20 + (k % 3) * 4; capsule(m, [Math.cos(a) * 8, 3, Math.sin(a) * 8], [Math.cos(a) * r, 0.8, Math.sin(a) * r], 2.2, 0.6, { c: '#5a2a6e', m: M.GLOSS }); }
    for (let k = 0; k < 4; k++) mush(m, Math.cos(k * 1.6) * 18, Math.sin(k * 1.6) * 18, 6 + k * 2, 3 + k % 2 * 2, FUN);
  });
  def('fragmento', { name: 'O Fragmento', w: 4, h: 4, hp: 2400, boss: 1, tall: 1, light: { r: 14, c: [120, 240, 255], y: 60, glow: 1 } }, (m) => {
    const shard = (a, b, r) => SD.cap(a, b, r, r * 0.12);
    const f = SD.smooth(3, shard([0, 0, 0], [6, 120, -8], 18), shard([-12, 0, 8], [-26, 70, 18], 10), shard([14, 0, 10], [30, 56, 22], 9), shard([4, 0, -16], [10, 60, -34], 8));
    m.sdf(R, [-46, 0, -46, 46, 125, 46], (x, y, z) => Math.max(f(x, y, z), -y), (i) => {
      const v = Math.abs(VX.fbm(i.x * 0.08, i.y * 0.05, i.z * 0.08) - 0.5);
      if (v < 0.02) return { c: H(i.x, i.y, i.z) > 0.5 ? '#6af7ff' : '#ff6adf', m: M.EMIT };
      return { c: VX.mix('#0c0a14', '#2a2440', N3(i.x * 0.15, i.y * 0.15, i.z * 0.15)), m: M.GLOSS };
    });
  });
  def('bolsa_chao', { name: 'Itens no chão', solid: 0, noShadow: 1 }, (m) => {
    ell(m, 0, 4, 0, 6, 4.5, 5, (i) => (N3(i.x, i.y, i.z) > 0.6 ? '#5a6436' : '#4a5430'));
    rb(m, 0, 8, 0, 3, 1, 2, 0.5, '#3a3e26');
    rb(m, 7, 2, 4, 3, 2, 4, 0.5, '#c8b8a0');
  });
  // ===== construções da jogadora =====
  def('barricada', { name: 'Barricada', hp: 160, built: 1 }, (m) => {
    for (let k = 0; k < 5; k++) rb(m, 0, 5 + k * 9, (k % 2) * 2 - 1, 12 + (k % 2), 3, 1.5, 0.6, woodG(k % 2 ? '#9a6a3a' : '#8a5a30', 'x'));
    for (const x of [-8, 8]) bx(m, x - 1.5, 0, 1.5, 3, 46, 2.5, woodG('#6a4424', 'y'));
    m.sdf(R, [-12, 0, -4, 12, 46, 0], SD.cap([-10, 4, -2.5], [10, 40, -2.5], 1.4, 1.4), woodG('#7a5030', 'x'));
  });
  def('parede_tabuas', { name: 'Parede de tábuas', hp: 300, built: 1, tall: 1 }, (m) => {
    for (let k = 0; k < 9; k++) rb(m, 0, 3.5 + k * 7, 0, 12, 3.2, 2, 0.5, woodG(k % 2 ? '#9a6a3a' : '#8a5a30', 'x'));
    for (const x of [-10, 10]) bx(m, x - 1.5, 0, 2, 3, 66, 2, woodG('#6a4424', 'y'));
  });
  def('fogueira', { name: 'Fogueira', solid: 1, built: 1, fire: 1, light: { r: 9, c: [255, 150, 70], y: 8, flicker: 1 } }, (m) => {
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; ell(m, Math.cos(a) * 9, 2, Math.sin(a) * 9, 2.6, 2, 2.6, '#6a6a68'); }
    for (let k = 0; k < 4; k++) { const a = k * 1.6; capsule(m, [Math.cos(a) * 7, 1, Math.sin(a) * 7], [0, 7, 0], 1.4, 1, woodG('#5a3a1e', 'x')); }
    ell(m, 0, 3, 0, 4, 2, 4, { c: '#ff9a3a', m: M.EMIT });
  });

  // ---------- veículos ----------
  function wheel(m, x, z) {
    m.sdf(R, [x - 5, 0, z - 9, x + 5, 18, z + 9], (px, py, pz) => Math.max(Math.hypot(py - 8.5, pz - z) - 8.5, Math.abs(px - x) - 3.2), (i) => {
      const r = Math.hypot(i.y - 8.5, i.z - z);
      return r < 4.6 ? { c: '#a8acb0', m: M.METAL } : r < 5.4 ? '#2a2a2e' : '#141416';
    });
  }
  const CARC = [['#8a2424', 0], ['#b8bcc0', 1], ['#1e2228', 0], ['#e8e8ec', 2], ['#e8b820', 3], ['#5a4a3a', 4], ['#2a4a8a', 0], ['#2e4a36', 0]];
  function buildCar(m, v) {
    const [col, kind] = CARC[v % CARC.length];
    const wreck = kind === 4, police = kind === 2, taxi = kind === 3;
    const body = (i) => {
      if (wreck) { const n = VX.fbm(i.x * 0.1, i.y * 0.1, i.z * 0.1); if (n > 0.6) return VX.mix('#3a2a20', '#7a4a2a', H(i.x, i.y, i.z)); if (n < 0.35) return '#1e1a18'; }
      if (police && Math.abs(i.z) < 20 && i.y > 10 && i.y < 26 && Math.abs(i.x) > 24) return { c: '#1a1e2a', m: M.GLOSS };
      if (Math.abs(i.z - 22) < 0.5 || Math.abs(i.z + 12) < 0.5) return VX.shade(col, 0.6);
      if (Math.abs(i.y - 20) < 0.5) return VX.shade(col, 0.8);
      return { c: VX.shade(col, 0.96 + N3(i.x * 0.1, i.y * 0.1, i.z * 0.1) * 0.08), m: M.GLOSS };
    };
    m.sdf(R, [-28, 3, -66, 28, 30, 66], SD.rbox(0, 16, 0, 26, 10.5, 62, 6), (i) => {
      if (i.z > 59 && i.y > 14 && i.y < 21 && Math.abs(i.x) > 13) return { c: wreck ? '#2a2a2a' : '#f2f0dc', m: M.GLASS };
      if (i.z < -59 && i.y > 15 && i.y < 21 && Math.abs(i.x) > 14) return { c: '#c41a1a', m: M.GLASS };
      if (i.z > 60 && i.y > 8 && i.y < 12) return { c: '#2a2a2e', m: M.METAL };
      if (i.z < -60 && i.y > 8 && i.y < 12) return { c: '#2a2a2e', m: M.METAL };
      if (taxi && Math.abs(i.y - 18) < 1 && Math.abs(i.x) > 24) return '#1a1a1a';
      return body(i);
    });
    const cab = (x, y, z) => SD.rbox(0, 32, -4 + (y - 32) * 0.15 * 0, 22 - (y - 26) * 0.35, 6.5, 30 - (y - 26) * 0.9, 4)(x, y, z);
    m.sdf(R, [-26, 24, -40, 26, 41, 34], (x, y, z) => Math.max(cab(x, y, z), 25 - y), (i) => {
      if (i.y > 38.4) return police ? (Math.abs(i.z + 4) < 3 ? { c: i.x < 0 ? '#2a4aff' : '#ff2a2a', m: M.EMIT } : body(i)) : taxi && Math.abs(i.z + 4) < 3 && Math.abs(i.x) < 6 ? { c: '#fff2a0', m: M.EMIT } : body(i);
      if (Math.abs(i.z + 4) < 0.8 || Math.abs(i.z - 9) < 0.6) return body(i);
      return { c: wreck ? (H(i.x, i.y, i.z) > 0.5 ? '#0c0c0e' : '#3a3e42') : (i.x + i.y * 0.6 + i.z * 0.3) % 14 < 2 ? '#c8d8e8' : '#2c3e4e', m: M.GLASS };
    });
    if (police) m.sdf(R, [-10, 40, -8, 10, 44, 0], SD.rbox(0, 41.5, -4, 9, 1.5, 2.5, 0.8), (i) => ({ c: i.x < 0 ? '#3a5aff' : '#ff3a3a', m: M.EMIT }));
    if (taxi) rb(m, 0, 41.5, -4, 6, 2, 2.5, 0.8, (i) => (i.z > 0 ? '#1a1a1a' : { c: '#fff2a0', m: M.EMIT }));
    for (const s of [-1, 1]) rb(m, s * 27, 28, 18, 2, 1.6, 2.4, 0.8, body);
    for (const [x, z] of [[-24, 40], [24, 40], [-24, -40], [24, -40]]) wheel(m, x, z);
  }
  const VANC = [['#e8e8e4', 0], ['#f2f2f0', 1], ['#7a5a32', 2], ['#5a6068', 3]];
  function buildVan(m, v) {
    const [col, kind] = VANC[v % VANC.length];
    const amb = kind === 1, pick_ = kind === 3;
    const body = (i) => {
      if (amb && Math.abs(i.y - 22) < 2.5 && Math.abs(i.x) > 25) return { c: '#c41a1a', m: M.GLOSS };
      if (amb && Math.abs(i.x) > 25 && Math.abs(i.z + 20) < 7 && Math.abs(i.y - 34) < 7 && (Math.abs(i.z + 20) < 2 || Math.abs(i.y - 34) < 2)) return '#c41a1a';
      if (kind === 2 && Math.abs(i.x) > 25 && i.y > 26 && i.y < 40 && Math.abs(i.z + 20) < 30) return Math.abs(i.y - 33) < 3 ? '#f2e0b0' : VX.shade(col, 0.85);
      return { c: VX.shade(col, 0.96 + N3(i.x * 0.1, i.y * 0.1, i.z * 0.1) * 0.08), m: M.GLOSS };
    };
    if (pick_) {
      m.sdf(R, [-29, 3, -74, 29, 30, 74], SD.rbox(0, 16, 0, 27, 11, 70, 5), (i) => (i.z > 67 && i.y > 14 && i.y < 21 && Math.abs(i.x) > 14 ? { c: '#f2f0dc', m: M.GLASS } : body(i)));
      m.sdf(R, [-27, 25, 0, 27, 50, 52], SD.rbox(0, 37, 26, 25, 12, 22, 4), (i) => (i.y > 47 ? body(i) : Math.abs(i.z - 26) < 0.6 ? body(i) : { c: (i.x + i.y) % 14 < 2 ? '#c8d8e8' : '#2c3e4e', m: M.GLASS }));
      m.sdf(R, [-27, 26, -72, 27, 40, 0], SD.sub(SD.rbox(0, 32, -36, 25.5, 6, 34, 1), SD.rbox(0, 36, -36, 23, 6, 32, 1)), body);
    } else {
      m.sdf(R, [-30, 3, -78, 30, 66, 78], SD.rbox(0, 34, -6, 28, 30, 70, 6), (i) => {
        if (i.z > 50 && i.y > 38 && Math.abs(i.x) < 26) return { c: (i.x + i.y) % 14 < 2 ? '#c8d8e8' : '#2c3e4e', m: M.GLASS };
        if (i.z < -73 && i.y > 30 && i.y < 56 && Math.abs(i.x) > 2) return { c: '#2c3e4e', m: M.GLASS };
        return body(i);
      });
      m.sdf(R, [-29, 3, 40, 29, 36, 76], SD.rbox(0, 17, 58, 27, 12, 16, 6), (i) => (i.z > 70 && i.y > 14 && i.y < 21 && Math.abs(i.x) > 14 ? { c: '#f2f0dc', m: M.GLASS } : body(i)));
      if (amb) rb(m, 0, 66.5, 46, 14, 2, 3, 1, (i) => ({ c: i.x < 0 ? '#ff2a2a' : '#3a5aff', m: M.EMIT }));
    }
    for (const [x, z] of [[-25, 50], [25, 50], [-25, -48], [25, -48]]) wheel(m, x, z);
  }

  // ---------- sprites ----------
  const sprites = new Map();
  let budget = 1e9;
  function sprite(type, v, rot, force) {
    const key = type + ':' + (v || 0) + ':' + (rot || 0);
    let s = sprites.get(key);
    if (s) return s;
    if (!force && budget <= 0) return null;
    const t0 = performance.now();
    const m = new VX.Model(); m.part(R, null, [0, 0, 0]);
    D[type].build(m, v || 0);
    const cv = VX.renderFit(m, {}, { scale: Math.SQRT2, yaw: -Math.PI / 4 + (rot || 0) * Math.PI / 2, ss: 3, dither: 0.5, shadow: D[type].noShadow ? 0 : 80, edge: 3 });
    sprites.set(key, cv);
    budget -= performance.now() - t0;
    return cv;
  }
  function setBudget(ms) { budget = ms; }
  function footprint(type, rot) { const d = D[type]; return rot % 2 ? [d.h, d.w] : [d.w, d.h]; }
  return { D, sprite, setBudget, footprint, ready: (t, v, r) => sprites.has(t + ':' + (v || 0) + ':' + (r || 0)) };
})();

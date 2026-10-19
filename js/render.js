'use strict';
// Desenho do mundo: pisos em blocos pré-renderizados, ordenação isométrica por dependência,
// paredes com corte ao entrar em prédios, telhados rasterizados, sombras, luz colorida, névoa de visão.
const RENDER = (() => {
  const { TW, TH, N, iso } = WORLD;
  const ZPX = WORLD.VPT * WORLD.SC * VX.CE; // pixels de tela por tile de altura
  let canvas, ctx, light, lctx, fogC, fctx;
  const V = { w: 320, h: 200, zoom: 2, dpr: 1, ox: 0, oy: 0, cam: { x: 0, y: 0 } };

  function init(cv) {
    canvas = cv; ctx = cv.getContext('2d', { alpha: false });
    light = document.createElement('canvas'); lctx = light.getContext('2d');
    fogC = document.createElement('canvas'); fctx = fogC.getContext('2d');
    resize();
  }
  // zoom inteiro em pixels do aparelho: arte nítida em qualquer tela
  function resize(zoomCss) {
    V.dpr = window.devicePixelRatio || 1;
    if (zoomCss) V.zoomCss = zoomCss;
    const want = V.zoomCss || (window.innerWidth < 700 ? 1.5 : window.innerWidth < 1500 ? 2 : 2.5);
    V.zoom = Math.max(1, Math.round(want * V.dpr));
    V.w = Math.ceil((window.innerWidth * V.dpr) / V.zoom); V.h = Math.ceil((window.innerHeight * V.dpr) / V.zoom);
    canvas.width = V.w; canvas.height = V.h;
    canvas.style.width = (V.w * V.zoom) / V.dpr + 'px'; canvas.style.height = (V.h * V.zoom) / V.dpr + 'px';
    light.width = V.w; light.height = V.h; fogC.width = V.w; fogC.height = V.h;
    ctx.imageSmoothingEnabled = false;
  }
  function zoomBy(d) {
    const steps = [1, 1.5, 2, 2.5, 3, 4];
    const cur = V.zoomCss || (V.zoom / V.dpr);
    let i = steps.findIndex((s) => s >= cur - 0.01); if (i < 0) i = steps.length - 1;
    i = Math.max(0, Math.min(steps.length - 1, i + d));
    resize(steps[i]);
  }

  // ---------- decalques ----------
  const RUGS = [['#8a2a2a', '#d8a040', '#5a1a1a'], ['#2a4a7a', '#d8d0b0', '#1a2a4a'], ['#4a6a3a', '#e0d0a0', '#2a3a20'], ['#7a5a8a', '#e8c8d8', '#4a3a5a'], ['#a86a2a', '#f0e0b0', '#6a3a1a'], ['#3a8a8a', '#f0f0e0', '#1a4a4a']];
  function drawRug(c, d, ox, oy) {
    const pal = RUGS[d.v % RUGS.length];
    const [sx0] = iso(d.x, d.y + d.h), [sx1] = iso(d.x + d.w, d.y);
    const [, sy0] = iso(d.x, d.y), [, sy1] = iso(d.x + d.w, d.y + d.h);
    const img = c.getImageData(Math.floor(sx0 - ox), Math.floor(sy0 - oy), Math.ceil(sx1 - sx0), Math.ceil(sy1 - sy0));
    const U = new Uint32Array(img.data.buffer);
    for (let py = 0; py < img.height; py++) for (let px = 0; px < img.width; px++) {
      const [wx, wy] = WORLD.unIso(px + 0.5 + Math.floor(sx0 - ox) + ox, py + 0.5 + Math.floor(sy0 - oy) + oy);
      const u = (wx - d.x) / d.w, v = (wy - d.y) / d.h;
      if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
      const bu = Math.min(u, 1 - u) * d.w, bv = Math.min(v, 1 - v) * d.h, b = Math.min(bu, bv);
      let col;
      if (b < 0.12) col = pal[2]; else if (b < 0.3) col = pal[1]; else if (b < 0.36) col = pal[2];
      else { const m = (Math.floor(u * d.w * 4) + Math.floor(v * d.h * 4)) % 4; col = m === 0 ? pal[1] : Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.18 ? pal[1] : pal[0]; }
      const cc = VX.hex(col), n = VX.hash(px, py, 3) * 0.12 + 0.94;
      U[py * img.width + px] = (255 << 24) | ((cc[2] * n) << 16) | ((cc[1] * n) << 8) | (cc[0] * n);
    }
    c.putImageData(img, Math.floor(sx0 - ox), Math.floor(sy0 - oy));
  }
  function drawSmallDecal(c, d, x, y) {
    const r = (a) => VX.hash(d.x, d.y, a);
    x = Math.round(x + (r(1) - 0.5) * 20); y = Math.round(y + 12 + (r(2) - 0.5) * 8);
    switch (d.k) {
      case 'papel': c.fillStyle = '#e8e4d8'; c.fillRect(x, y, 5, 3); c.fillStyle = '#b8b4a8'; c.fillRect(x + 1, y + 1, 3, 1); c.fillStyle = '#d8d4c8'; c.fillRect(x + 7, y + 2, 4, 2); break;
      case 'garrafa': c.fillStyle = r(3) > 0.5 ? '#3a7a4a' : '#6a3a1a'; c.fillRect(x, y, 5, 2); c.fillRect(x + 5, y, 2, 1); break;
      case 'lata': c.fillStyle = '#c4282c'; c.fillRect(x, y, 3, 2); c.fillStyle = '#c0c4c8'; c.fillRect(x + 3, y, 1, 2); break;
      case 'mancha': c.fillStyle = 'rgba(10,8,12,0.35)'; for (let k = 0; k < 7; k++) c.fillRect(x - 6 + k * 2, y - 2 + ((k * 3) % 4), 6, 3); break;
      case 'folhas': for (let k = 0; k < 8; k++) { c.fillStyle = ['#a8682a', '#c8902a', '#7a4a1a'][k % 3]; c.fillRect(x + Math.floor(r(k + 10) * 18) - 9, y + Math.floor(r(k + 30) * 8) - 4, 2, 1); } break;
      case 'bueiro': c.fillStyle = '#2a2a2e'; for (let k = -2; k <= 2; k++) c.fillRect(x - 8 + Math.abs(k), y + k, 16 - 2 * Math.abs(k), 1); c.fillStyle = '#4a4a50'; for (let k = -6; k <= 6; k += 3) c.fillRect(x + k, y - 1, 1, 3); break;
    }
  }

  // ---------- pisos em blocos ----------
  const CH = 16;
  const chunks = new Map();
  let chunkMap = null;
  function chunkKey(cx, cy) { return cx + ',' + cy; }
  function invalidate(i, j) { chunks.delete(chunkKey(Math.floor(i / CH), Math.floor(j / CH))); }
  function bakeChunk(M, cx, cy) {
    const cv = document.createElement('canvas');
    cv.width = (2 * CH) * (TW / 2) + TW; cv.height = (2 * CH) * (TH / 2) + TH;
    const c = cv.getContext('2d');
    const i0 = cx * CH, j0 = cy * CH;
    const ox = (i0 - j0 - CH) * (TW / 2), oy = (i0 + j0) * (TH / 2);
    for (let j = j0; j < j0 + CH; j++) for (let i = i0; i < i0 + CH; i++) {
      if (i >= N || j >= N) continue;
      const k = j * N + i;
      c.drawImage(WORLD.floorSprite(M.floor[k], M.fvar[k]), (i - j) * (TW / 2) - TW / 2 - ox, (i + j) * (TH / 2) - oy);
    }
    for (const d of M.decals) {
      if (d.k === 'tapete') { if (d.x + d.w >= i0 && d.x <= i0 + CH && d.y + d.h >= j0 && d.y <= j0 + CH) drawRug(c, d, ox, oy); }
      else if (d.x >= i0 && d.x < i0 + CH && d.y >= j0 && d.y < j0 + CH) { const [sx, sy] = iso(d.x, d.y); drawSmallDecal(c, d, sx - ox, sy - oy); }
    }
    return { cv, ox, oy };
  }

  // ---------- telhados ----------
  const roofs = new Map();
  const ROOFC = [['#8a3a2a', '#6e2a1e'], ['#5a3e2a', '#46301e'], ['#4a5260', '#363c48'], ['#3e5a3a', '#2e442a']];
  function roofSprite(M, B) {
    if (roofs.has(B.id)) return roofs.get(B.id);
    const Hh = WORLD.WALL_H / WORLD.VPT;
    const x0 = B.x - 0.25, x1 = B.x + B.w + 0.25, y0 = B.y - 0.25, y1 = B.y + B.h + 0.25;
    const prims = [];
    const ext = WORLD.STYLES[B.ext].face || (() => '#888');
    const extC = (p) => ext(((p[0] + p[1]) * 24) % 240, p[2] * 24);
    if (B.roof === 'gable') {
      const pal = ROOFC[B.roofC % ROOFC.length];
      const alongX = B.w >= B.h;
      const span = alongX ? (y1 - y0) / 2 : (x1 - x0) / 2;
      const rise = Math.min(2.4, span * 0.55), top = Hh + rise, cy = (y0 + y1) / 2, cxm = (x0 + x1) / 2;
      const shingle = (s) => (p) => { const along = alongX ? p[0] : p[1], up = alongX ? Math.abs(p[1] - cy) : Math.abs(p[0] - cxm); const row = Math.floor(up * 5); const off = (row % 2) * 0.1; const seam = (up * 5) % 1 < 0.14 || ((along + off) * 5) % 1 < 0.06; return VX.shade(seam ? pal[1] : pal[0], (0.92 + VX.hash(Math.floor((along + off) * 5), row, B.id) * 0.14) * s); };
      if (alongX) {
        prims.push({ v: [[x0, y0, Hh], [x1, y0, Hh], [x1, cy, top], [x0, cy, top]], col: shingle(1) });
        prims.push({ v: [[x0, cy, top], [x1, cy, top], [x1, y1, Hh], [x0, y1, Hh]], col: shingle(1) });
        prims.push({ v: [[x0 + 0.25, y0 + 0.25, Hh], [x0 + 0.25, cy, top - 0.1], [x0 + 0.25, y1 - 0.25, Hh]], col: extC });
        prims.push({ v: [[x1 - 0.25, y0 + 0.25, Hh], [x1 - 0.25, cy, top - 0.1], [x1 - 0.25, y1 - 0.25, Hh]], col: extC });
      } else {
        prims.push({ v: [[x0, y0, Hh], [cxm, y0, top], [cxm, y1, top], [x0, y1, Hh]], col: shingle(1) });
        prims.push({ v: [[cxm, y0, top], [x1, y0, Hh], [x1, y1, Hh], [cxm, y1, top]], col: shingle(1) });
        prims.push({ v: [[x0 + 0.25, y0 + 0.25, Hh], [cxm, y0 + 0.25, top - 0.1], [x1 - 0.25, y0 + 0.25, Hh]], col: extC });
        prims.push({ v: [[x0 + 0.25, y1 - 0.25, Hh], [cxm, y1 - 0.25, top - 0.1], [x1 - 0.25, y1 - 0.25, Hh]], col: extC });
      }
    } else {
      const z = Hh + 0.05, pz = Hh + 0.32;
      const tar = (p) => { const n = VX.vnoise(p[0] * 3, p[1] * 3, B.id); return VX.shade(n > 0.6 ? '#5a5a58' : '#484846', 0.9 + VX.hash(Math.floor(p[0] * 8), Math.floor(p[1] * 8), 1) * 0.12); };
      const rim = () => '#8a8882';
      prims.push({ v: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], col: tar });
      prims.push({ v: [[x0, y1, z], [x1, y1, z], [x1, y1, pz], [x0, y1, pz]], col: rim });
      prims.push({ v: [[x1, y0, z], [x1, y1, z], [x1, y1, pz], [x1, y0, pz]], col: rim });
      prims.push({ v: [[x0, y0, pz], [x1, y0, pz], [x1, y0 + 0.3, pz], [x0, y0 + 0.3, pz]], col: rim });
      prims.push({ v: [[x0, y0, pz], [x0 + 0.3, y0, pz], [x0 + 0.3, y1, pz], [x0, y1, pz]], col: rim });
      prims.push({ v: [[x0, y1 - 0.3, pz], [x1, y1 - 0.3, pz], [x1, y1, pz], [x0, y1, pz]], col: rim });
      prims.push({ v: [[x1 - 0.3, y0, pz], [x1, y0, pz], [x1, y1, pz], [x1 - 0.3, y1, pz]], col: rim });
      // caixas de ar-condicionado e respiros
      const R = WORLD.rng(B.id * 31 + 7);
      for (let t = 0; t < Math.max(1, Math.floor(B.w * B.h / 70)); t++) {
        const bx = B.x + 1.5 + R() * (B.w - 4), by = B.y + 1.5 + R() * (B.h - 4), s = 0.9 + R() * 0.7, hz = 0.55;
        const box = [[bx, by], [bx + s, by], [bx + s, by + s], [bx, by + s]];
        prims.push({ v: box.map(([a, b]) => [a, b, z + hz]), col: () => '#a8aaa8' });
        prims.push({ v: [[bx, by + s, z], [bx + s, by + s, z], [bx + s, by + s, z + hz], [bx, by + s, z + hz]], col: () => '#8a8c8a' });
        prims.push({ v: [[bx + s, by, z], [bx + s, by + s, z], [bx + s, by + s, z + hz], [bx + s, by, z + hz]], col: () => '#6a6c6a' });
      }
    }
    // rasterização
    const proj = (p) => [(p[0] - p[1]) * (TW / 2), (p[0] + p[1]) * (TH / 2) - p[2] * ZPX];
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (const pr of prims) {
      pr.s = pr.v.map(proj);
      pr.bb = [Math.min(...pr.s.map((q) => q[0])), Math.min(...pr.s.map((q) => q[1])), Math.max(...pr.s.map((q) => q[0])), Math.max(...pr.s.map((q) => q[1]))];
      for (const [a, b] of pr.s) { mnx = Math.min(mnx, a); mxx = Math.max(mxx, a); mny = Math.min(mny, b); mxy = Math.max(mxy, b); }
      const a = pr.v[0], b = pr.v[1], c = pr.v[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = VX.norm([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
      if (n[0] + n[1] + n[2] * 0.8 < 0) n = [-n[0], -n[1], -n[2]];
      pr.n = n; pr.c = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
      // luz vinda de cima-esquerda (em coordenadas de mundo)
      pr.lum = 0.62 + 0.42 * Math.max(0, n[2] * 0.75 - n[1] * 0.35 + n[0] * 0.25);
    }
    const ox = Math.floor(mnx) - 2, oy = Math.floor(mny) - 2;
    const Wd = Math.ceil(mxx - ox) + 3, Hd = Math.ceil(mxy - oy) + 3;
    const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd;
    const c2 = cv.getContext('2d');
    const img = c2.createImageData(Wd, Hd), U = new Uint32Array(img.data.buffer);
    const owner = new Int16Array(Wd * Hd).fill(-1);
    const d = [1, 1, (TW / 2) / ZPX * (TH / TW) * 2];
    const dd = VX.norm(d);
    const inside = (s, x, y) => { let sign = 0; for (let q = 0; q < s.length; q++) { const a = s[q], b = s[(q + 1) % s.length]; const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (Math.abs(cr) < 1e-9) continue; const sg = cr > 0 ? 1 : -1; if (!sign) sign = sg; else if (sg !== sign) return false; } return true; };
    for (let py = 0; py < Hd; py++) for (let px = 0; px < Wd; px++) {
      const sx = px + ox + 0.5, sy = py + oy + 0.5;
      let best = -1e9, bi = -1, bp = null;
      for (let q = 0; q < prims.length; q++) {
        const pr = prims[q];
        if (sx < pr.bb[0] || sx > pr.bb[2] || sy < pr.bb[1] || sy > pr.bb[3] || !inside(pr.s, sx, sy)) continue;
        const x0 = (sx / (TW / 2) + sy / (TH / 2)) / 2, y0 = (sy / (TH / 2) - sx / (TW / 2)) / 2;
        const nd = pr.n[0] * dd[0] + pr.n[1] * dd[1] + pr.n[2] * dd[2];
        if (Math.abs(nd) < 1e-6) continue;
        const t = (pr.c - pr.n[0] * x0 - pr.n[1] * y0) / nd;
        if (t > best) { best = t; bi = q; bp = [x0 + dd[0] * t, y0 + dd[1] * t, dd[2] * t]; }
      }
      if (bi < 0) continue;
      const pr = prims[bi];
      const col = VX.hex(pr.col(bp));
      const l = pr.lum * (0.97 + VX.hash(px, py, 2) * 0.05);
      U[py * Wd + px] = (255 << 24) | (Math.min(255, col[2] * l) << 16) | (Math.min(255, col[1] * l) << 8) | Math.min(255, col[0] * l);
      owner[py * Wd + px] = bi;
    }
    // contornos
    const out = new Uint32Array(U);
    for (let py = 0; py < Hd; py++) for (let px = 0; px < Wd; px++) {
      const o = py * Wd + px;
      if (owner[o] < 0) {
        if ((px > 0 && owner[o - 1] >= 0) || (px < Wd - 1 && owner[o + 1] >= 0) || (py > 0 && owner[o - Wd] >= 0) || (py < Hd - 1 && owner[o + Wd] >= 0)) out[o] = (255 << 24) | (22 << 16) | (14 << 8) | 16;
        continue;
      }
      if ((px > 0 && owner[o - 1] >= 0 && owner[o - 1] !== owner[o]) || (py > 0 && owner[o - Wd] >= 0 && owner[o - Wd] !== owner[o])) { const c = U[o]; out[o] = (255 << 24) | ((((c >> 16) & 255) * 0.6) << 16) | ((((c >> 8) & 255) * 0.6) << 8) | ((c & 255) * 0.6); }
    }
    U.set(out);
    c2.putImageData(img, 0, 0);
    const r = { cv, ox, oy };
    roofs.set(B.id, r);
    return r;
  }

  // ---------- ordenação por dependência ----------
  function sortDrawables(items) {
    items.sort((a, b) => a.l - b.l);
    const n = items.length;
    for (let i = 0; i < n; i++) { items[i].pred = null; items[i].mark = 0; items[i].idx = i; }
    for (let i = 0; i < n; i++) {
      const a = items[i];
      for (let j = i + 1; j < n; j++) {
        const b = items[j];
        if (b.l >= a.r) break;
        if (b.t >= a.b || a.t >= b.b) continue;
        let aFirst;
        if (a.kind === 'roof' || b.kind === 'roof') {
          const roof = a.kind === 'roof' ? a : b, o = roof === a ? b : a;
          const inside = o.bld === roof.bld || (o.cx > roof.x0 && o.cx < roof.x1 && o.cy > roof.y0 && o.cy < roof.y1);
          const oFirst = inside || o.x1 <= roof.x0 + 0.05 || o.y1 <= roof.y0 + 0.05;
          aFirst = roof === a ? !oFirst : oFirst;
        } else if (a.x1 <= b.x0 + 0.002 || a.y1 <= b.y0 + 0.002) aFirst = true;
        else if (b.x1 <= a.x0 + 0.002 || b.y1 <= a.y0 + 0.002) aFirst = false;
        else aFirst = a.cx + a.cy < b.cx + b.cy;
        if (aFirst) (b.pred || (b.pred = [])).push(a); else (a.pred || (a.pred = [])).push(b);
      }
    }
    const out = [];
    const visit = (x) => {
      if (x.mark) return; x.mark = 1;
      if (x.pred) for (const p of x.pred) visit(p);
      out.push(x);
    };
    // ordem estável: por profundidade aproximada
    const order = items.slice().sort((a, b) => a.cx + a.cy - b.cx - b.cy);
    for (const x of order) visit(x);
    return out;
  }

  // ---------- quadro ----------
  const shadowSpr = (() => { const c = document.createElement('canvas'); c.width = 22; c.height = 10; const x = c.getContext('2d'); x.fillStyle = 'rgba(10,8,14,0.28)'; for (let j = 0; j < 10; j++) for (let i = 0; i < 22; i++) if (((i - 10.5) / 11) ** 2 + ((j - 4.5) / 5) ** 2 <= 1) x.fillRect(i, j, 1, 1); return c; })();
  const fogTile = (() => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; const x = c.getContext('2d'); x.fillStyle = '#000'; for (let py = 0; py < TH; py++) { const w = Math.round((1 - Math.abs(py + 0.5 - TH / 2) / (TH / 2)) * (TW / 2)); x.fillRect(TW / 2 - w, py, w * 2, 1); } return c; })();

  function frame(S) {
    const M = S.map, p = S.player;
    const [psx, psy] = iso(p.x, p.y);
    V.cam.x += (psx - V.cam.x) * 0.16; V.cam.y += (psy - 30 - V.cam.y) * 0.16;
    let shx = 0, shy = 0;
    if (S.shake > 0) { shx = (Math.random() - 0.5) * 5 * S.shake * 4; shy = (Math.random() - 0.5) * 5 * S.shake * 4; }
    V.ox = Math.round(V.w / 2 - V.cam.x + shx); V.oy = Math.round(V.h / 2 - V.cam.y + shy);
    const ox = V.ox, oy = V.oy;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0c0e0c'; ctx.fillRect(0, 0, V.w, V.h);

    // faixa de tiles visíveis
    const corner = (sx, sy) => WORLD.unIso(sx - ox, sy - oy);
    const cs = [corner(0, -40), corner(V.w, -40), corner(0, V.h + 160), corner(V.w, V.h + 160)];
    const iMin = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[0]))) - 2), iMax = Math.min(N - 1, Math.ceil(Math.max(...cs.map((c) => c[0]))) + 2);
    const jMin = Math.max(0, Math.floor(Math.min(...cs.map((c) => c[1]))) - 2), jMax = Math.min(N - 1, Math.ceil(Math.max(...cs.map((c) => c[1]))) + 2);
    const onScreen = (sx, sy, pad) => sx > -pad && sx < V.w + pad && sy > -pad && sy < V.h + pad * 2;

    // pisos
    if (chunkMap !== M) { chunks.clear(); roofs.clear(); chunkMap = M; }
    const cxs = Math.floor(iMin / CH), cxe = Math.floor(iMax / CH), cys = Math.floor(jMin / CH), cye = Math.floor(jMax / CH);
    let baked = 0;
    for (let cy = cys; cy <= cye; cy++) for (let cx = cxs; cx <= cxe; cx++) {
      const key = chunkKey(cx, cy);
      let ch = chunks.get(key);
      if (!ch) { if (baked > 1 && S.budgetLeft() <= 0) continue; ch = bakeChunk(M, cx, cy); chunks.set(key, ch); baked++; if (chunks.size > 60) chunks.delete(chunks.keys().next().value); }
      else { chunks.delete(key); chunks.set(key, ch); }
      const x = ch.ox + ox, y = ch.oy + oy;
      if (x > V.w || y > V.h || x + ch.cv.width < 0 || y + ch.cv.height < 0) continue;
      ctx.drawImage(ch.cv, x, y);
    }
    // manchas dinâmicas (sangue, queimado)
    for (const d of S.decals) {
      const [sx, sy] = iso(d.x, d.y);
      const x = sx + ox, y = sy + oy;
      if (!onScreen(x, y, 20)) continue;
      ctx.fillStyle = d.c;
      const r = Math.max(1, Math.round(d.r * 9));
      for (let k = 0; k < 4; k++) { const a = VX.hash(d.x * 9, d.y * 9, k) * 6.28, rr = r * (0.4 + VX.hash(d.y, d.x, k) * 0.6); ctx.fillRect(Math.round(x + Math.cos(a) * rr * 0.6 - rr / 2), Math.round(y + Math.sin(a) * rr * 0.3 - rr / 4), Math.round(rr), Math.max(1, Math.round(rr / 2))); }
    }
    // sombras dos prédios
    const sun = S.sun;
    if (sun > 0.02) {
      ctx.fillStyle = 'rgba(8,8,20,' + (0.26 * sun) + ')';
      for (const B of M.buildings) {
        if (B.x > iMax + 4 || B.x + B.w < iMin - 6 || B.y > jMax + 4 || B.y + B.h < jMin - 6) continue;
        const h = (WORLD.WALL_H / WORLD.VPT) * (B.roof === 'gable' ? 1.25 : 1.05);
        const dx = 0.075 * h, dy = -0.83 * h;
        const pts = [[B.x, B.y], [B.x + B.w, B.y], [B.x + B.w, B.y + B.h], [B.x, B.y + B.h]];
        const all = pts.concat(pts.map(([a, b]) => [a + dx, b + dy])).map(([a, b]) => { const [sx, sy] = iso(a, b); return [sx + ox, sy + oy]; });
        const hull = convexHull(all);
        ctx.beginPath(); hull.forEach(([a, b], q) => (q ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill();
      }
    }
    if (S.groundFx) S.groundFx(ctx, ox, oy);
    // névoa de visão só no chão; objetos fora da vista são escurecidos individualmente
    const vis = S.vis;
    if (vis) {
      ctx.globalAlpha = S.fogAlpha;
      for (let j = jMin; j <= jMax; j++) for (let i = iMin; i <= iMax; i++) {
        if (vis[j * N + i]) continue;
        const sx = (i - j) * (TW / 2) + ox, sy = (i + j) * (TH / 2) + oy;
        if (sx < -TW || sx > V.w + TW || sy < -TH || sy > V.h + TH) continue;
        ctx.drawImage(fogTile, sx - TW / 2, sy);
      }
      ctx.globalAlpha = 1;
    }
    const seenT = (i, j) => !vis || (i >= 0 && j >= 0 && i < N && j < N && vis[j * N + i]);

    // coleta de desenháveis
    const items = [];
    const pb = M.bld[Math.floor(p.y) * N + Math.floor(p.x)];
    const pr = { l: psx + ox - 18, r: psx + ox + 18, t: psy + oy - 80, b: psy + oy + 4 };
    const hitsPlayer = (l, t, r, b) => !(r < pr.l || l > pr.r || b < pr.t || t > pr.b);
    for (let j = jMin; j <= jMax; j++) for (let i = iMin; i <= iMax; i++) {
      const k = j * N + i;
      const sx = (i - j) * (TW / 2) + ox, sy = (i + j) * (TH / 2) + oy;
      if (!onScreen(sx, sy, 140)) continue;
      for (const s of ['N', 'W']) {
        const kind = M['w' + s][k];
        if (!kind) continue;
        const bid = M['wb' + s][k];
        const cut = pb >= 0 && bid === pb && (s === 'N' ? j > p.y - 0.1 : i > p.x - 0.1) && !S.noCut;
        const style = M['ws' + s][k];
        const interior = style >= 12 && style < 24;
        const ax = s === 'N' ? i : i, ay = s === 'N' ? j : j + 1;
        const [axs, ays] = iso(ax, ay);
        items.push({ kind: 'wall', k, s, i, j, cut, style, interior, wk: kind, bld: bid, ax: axs + ox, ay: ays + oy,
          x0: s === 'N' ? i : i - 0.01, x1: s === 'N' ? i + 1 : i + 0.01, y0: s === 'N' ? j - 0.01 : j, y1: s === 'N' ? j + 0.01 : j + 1,
          cx: s === 'N' ? i + 0.5 : i, cy: s === 'N' ? j : j + 0.5,
          l: sx - (s === 'N' ? 4 : 28), r: sx + (s === 'N' ? 28 : 4), t: sy - (cut ? 18 : 92), b: sy + 26 });
      }
    }
    const seen = new Set();
    for (let j = jMin; j <= jMax; j++) for (let i = iMin; i <= iMax; i++) {
      const q = M.propAt[j * N + i];
      if (q < 0 || seen.has(q)) continue;
      seen.add(q);
      const P = M.props[q];
      if (P.dead) continue;
      const [sx, sy] = iso(P.x, P.y);
      const X = sx + ox, Y = sy + oy;
      if (!onScreen(X, Y, 200)) continue;
      const big = Math.max(P.fw, P.fh) * 26 + 40;
      items.push({ kind: 'prop', P, X, Y, bld: P.bld, x0: P.i + 0.04, x1: P.i + P.fw - 0.04, y0: P.j + 0.04, y1: P.j + P.fh - 0.04, cx: P.x, cy: P.y, l: X - big, r: X + big, t: Y - 130, b: Y + big * 0.5 });
    }
    for (const e of S.ents) {
      const [sx, sy] = iso(e.x, e.y);
      const X = sx + ox, Y = sy + oy;
      if (!onScreen(X, Y, 120)) continue;
      items.push({ kind: 'ent', e, X, Y, bld: -2, x0: e.x, x1: e.x + 0.001, y0: e.y, y1: e.y + 0.001, cx: e.x, cy: e.y, l: X - 50, r: X + 50, t: Y - 100, b: Y + 24 });
    }
    for (const B of M.buildings) {
      if (B.id === pb && !S.noCut) continue;
      if (B.x > iMax + 3 || B.x + B.w < iMin - 3 || B.y > jMax + 3 || B.y + B.h < jMin - 3) continue;
      items.push({ kind: 'roof', B, bld: B.id, x0: B.x, x1: B.x + B.w, y0: B.y, y1: B.y + B.h, cx: B.x + B.w / 2, cy: B.y + B.h / 2, ...roofRect(B, ox, oy) });
    }

    const sorted = sortDrawables(items);
    let playerDrawn = false;
    for (const it of sorted) {
      if (it.kind === 'ent') { it.e.draw(ctx, it.X, it.Y); if (it.e === p) playerDrawn = true; continue; }
      let alpha = 1;
      if (playerDrawn && hitsPlayer(it.l, it.t, it.r, it.b) && !(it.kind === 'wall' && it.cut)) alpha = it.kind === 'roof' ? 0.25 : 0.38;
      if (it.kind === 'wall') {
        const st = M['wst' + it.s][it.k], ds = M['wd' + it.s][it.k];
        let spr = WORLD.wallSprite(it.style, it.s, it.wk, st, ds, it.interior, it.cut);
        if (!spr) continue;
        if (!seenT(it.i, it.j) && !(it.s === 'N' ? seenT(it.i, it.j - 1) : seenT(it.i - 1, it.j))) spr = darkOf(spr);
        if (alpha < 1 && it.cut) alpha = 1;
        ctx.globalAlpha = alpha;
        ctx.drawImage(spr, it.ax - spr.ox, it.ay - spr.oy);
        ctx.globalAlpha = 1;
      } else if (it.kind === 'prop') {
        const P = it.P;
        let spr = PROPS.sprite(P.type, P.v, P.rot);
        if (!spr) continue;
        let anySeen = false;
        for (let b = P.j; b < P.j + P.fh && !anySeen; b++) for (let a = P.i; a < P.i + P.fw; a++) if (seenT(a, b)) { anySeen = true; break; }
        if (!anySeen && !(PROPS.D[P.type].light && PROPS.D[P.type].light.glow)) spr = darkOf(spr);
        const tall = PROPS.D[P.type].tall;
        ctx.globalAlpha = tall ? alpha : Math.max(alpha, 0.7);
        if (P.hitFlash > 0) ctx.filter = 'brightness(2)';
        ctx.drawImage(spr, Math.round(it.X - spr.ox), Math.round(it.Y - spr.oy));
        if (P.hitFlash > 0) ctx.filter = 'none';
        ctx.globalAlpha = 1;
        if (P.maxhp && P.hp < P.maxhp && P.hp > 0) bar(it.X - 14, it.Y - 70, 28, P.hp / P.maxhp, PROPS.D[P.type].nest || PROPS.D[P.type].boss ? '#d06aff' : '#d0a040');
      } else if (it.kind === 'roof') {
        const r = roofSprite(M, it.B);
        ctx.globalAlpha = alpha;
        ctx.drawImage(r.cv, r.ox + ox, r.oy + oy);
        ctx.globalAlpha = 1;
      }
    }
    if (S.overFx) S.overFx(ctx, ox, oy);
    lighting(S, ox, oy, iMin, iMax, jMin, jMax);
  }
  function darkOf(spr) {
    if (spr.dark) return spr.dark;
    const c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height;
    const x = c.getContext('2d'); x.drawImage(spr, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(6,6,14,0.58)'; x.fillRect(0, 0, c.width, c.height);
    c.ox = spr.ox; c.oy = spr.oy; spr.dark = c;
    return c;
  }
  function roofRect(B, ox, oy) {
    const pts = [[B.x - 0.3, B.y - 0.3], [B.x + B.w + 0.3, B.y - 0.3], [B.x + B.w + 0.3, B.y + B.h + 0.3], [B.x - 0.3, B.y + B.h + 0.3]].map(([a, b]) => iso(a, b));
    const zt = (WORLD.WALL_H / WORLD.VPT + 2.5) * ZPX;
    return { l: Math.min(...pts.map((q) => q[0])) + ox, r: Math.max(...pts.map((q) => q[0])) + ox, t: Math.min(...pts.map((q) => q[1])) + oy - zt, b: Math.max(...pts.map((q) => q[1])) + oy - ZPX * 2.5 };
  }
  function convexHull(P) {
    P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function bar(x, y, w, v, c) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, w + 2, 4);
    ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w * Math.max(0, v)), 2);
  }

  // ---------- luz ----------
  const gradCache = new Map();
  function glowSprite(r, g, b, rad) {
    const key = r + ',' + g + ',' + b + ',' + rad;
    let c = gradCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = rad * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(rad, rad, 0, rad, rad, rad);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, rad * 2, rad * 2);
    if (gradCache.size > 200) gradCache.clear();
    gradCache.set(key, c);
    return c;
  }
  function lighting(S, ox, oy, iMin, iMax, jMin, jMax) {
    const M = S.map;
    const amb = S.ambient;
    if (amb[0] < 250 || amb[1] < 250 || amb[2] < 250 || S.lights.length) {
      lctx.globalCompositeOperation = 'source-over';
      lctx.fillStyle = `rgb(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0})`;
      lctx.fillRect(0, 0, V.w, V.h);
      lctx.globalCompositeOperation = 'lighter';
      for (const L of S.lights) {
        const [sx, sy] = iso(L.x, L.y);
        const x = sx + ox, y = sy + oy - (L.h || 0);
        const rad = Math.round(L.r * TW * 0.5);
        if (x < -rad || x > V.w + rad || y < -rad || y > V.h + rad) continue;
        const k = L.i == null ? 1 : L.i;
        lctx.globalAlpha = Math.min(1, k);
        lctx.drawImage(glowSprite(L.c[0], L.c[1], L.c[2], Math.max(8, rad)), x - rad, y - rad * 0.55, rad * 2, rad * 1.1);
      }
      lctx.globalAlpha = 1;
      if (S.cone) {
        const c = S.cone;
        const [sx, sy] = iso(c.x, c.y);
        const x = sx + ox, y = sy + oy - 40;
        const g = lctx.createRadialGradient(x, y, 6, x, y, c.len);
        g.addColorStop(0, 'rgba(255,248,220,0.95)'); g.addColorStop(0.6, 'rgba(255,240,200,0.5)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        lctx.fillStyle = g;
        lctx.beginPath(); lctx.moveTo(x, y); lctx.arc(x, y, c.len, c.ang - c.w, c.ang + c.w); lctx.closePath(); lctx.fill();
      }
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(light, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    // brilhos (emissivos) por cima
    if (S.glows.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const G of S.glows) {
        const [sx, sy] = iso(G.x, G.y);
        const x = sx + ox, y = sy + oy - (G.h || 0);
        const rad = Math.round(G.r);
        if (x < -rad || x > V.w + rad || y < -rad || y > V.h + rad) continue;
        ctx.globalAlpha = Math.min(1, G.a);
        ctx.drawImage(glowSprite(G.c[0], G.c[1], G.c[2], Math.max(4, rad)), x - rad, y - rad);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (S.post) S.post(ctx, V);
  }

  return { V, init, resize, zoomBy, frame, invalidate, roofSprite, glowSprite, ctx: () => ctx };
})();

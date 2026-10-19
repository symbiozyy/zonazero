'use strict';
// Motor voxel -> pixel art.
// Modelos são feitos de "partes" (ossos) com voxels de superfície. Cada parte gira em torno
// do seu pivô; o renderizador projeta tudo numa câmera isométrica (30° de elevação = 2:1),
// faz z-buffer com supersampling, reduz para pixels, sombreia em faixas e desenha contorno.
const VX = (() => {
  const ELEV = Math.PI / 6;
  const CE = Math.cos(ELEV), SE = Math.sin(ELEV);
  const LIGHT = norm([-0.55, 0.8, 0.5]);
  const OUTLINE = [22, 16, 24];

  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function hex(c) {
    if (Array.isArray(c)) return c;
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) { a = hex(a); b = hex(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function shade(c, k) { c = hex(c); return [c[0] * k, c[1] * k, c[2] * k]; }
  // ruído determinístico 0..1 para texturas
  function hash(x, y, z) {
    let h = (Math.floor(x * 7 + 1000) * 374761393 + Math.floor(y * 7 + 1000) * 668265263 + Math.floor(z * 7 + 1000) * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // R = Ry * Rz * Rx (linha a linha, 9 números)
  function rot(rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    return mul([cy, 0, sy, 0, 1, 0, -sy, 0, cy], mul([cz, -sz, 0, sz, cz, 0, 0, 0, 1], [1, 0, 0, 0, cx, -sx, 0, sx, cx]));
  }
  function mul(A, B) {
    const C = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return C;
  }
  function ap(M, x, y, z) { return [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z]; }

  class Model {
    constructor() { this.parts = []; this.map = {}; }
    part(name, parent, pivot) {
      if (this.map[name]) return this.map[name];
      const p = { name, parent: parent || null, pivot: pivot || [0, 0, 0], vox: [] };
      this.parts.push(p); this.map[name] = p; return p;
    }
    add(name, x, y, z, color, n) {
      const c = hex(color);
      this.map[name].vox.push(x, y, z, n[0], n[1], n[2], c[0], c[1], c[2]);
    }
    // Caixa oca. col(info) devolve cor ou null (pula o voxel).
    box(name, x0, y0, z0, w, h, d, col) {
      for (let ix = 0; ix < w; ix++) for (let iy = 0; iy < h; iy++) for (let iz = 0; iz < d; iz++) {
        const L = ix === 0, R = ix === w - 1, B = iy === 0, T = iy === h - 1, K = iz === 0, F = iz === d - 1;
        if (!(L || R || B || T || K || F)) continue;
        const info = { ix, iy, iz, w, h, d, left: L, right: R, bottom: B, top: T, back: K, front: F, x: x0 + ix + 0.5, y: y0 + iy + 0.5, z: z0 + iz + 0.5 };
        const c = typeof col === 'function' ? col(info) : col;
        if (!c) continue;
        const n = norm([(R ? 1 : 0) - (L ? 1 : 0), (T ? 1 : 0) - (B ? 1 : 0), (F ? 1 : 0) - (K ? 1 : 0)]);
        this.add(name, info.x, info.y, info.z, c, n);
      }
    }
    // Elipsoide (centro, raios). col(info) com info.nx.. normal e posição.
    ellipsoid(name, cx, cy, cz, rx, ry, rz, col) {
      const inside = (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
          for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
            const px = x + 0.5, py = y + 0.5, pz = z + 0.5;
            if (!inside(px, py, pz)) continue;
            if (inside(px + 1, py, pz) && inside(px - 1, py, pz) && inside(px, py + 1, pz) && inside(px, py - 1, pz) && inside(px, py, pz + 1) && inside(px, py, pz - 1)) continue;
            const n = norm([(px - cx) / (rx * rx), (py - cy) / (ry * ry), (pz - cz) / (rz * rz)]);
            const c = typeof col === 'function' ? col({ x: px, y: py, z: pz, n }) : col;
            if (c) this.add(name, px, py, pz, c, n);
          }
    }
    // Cilindro: eixo 'x' | 'y' | 'z', centro da base (a,b) no plano perpendicular, de s0 a s0+len.
    cyl(name, axis, a, b, r, s0, len, col) {
      const ri = Math.ceil(r);
      for (let i = -ri; i < ri; i++) for (let j = -ri; j < ri; j++) {
        const u = i + 0.5, v = j + 0.5;
        if (u * u + v * v > r * r) continue;
        const edge = (u + 1) ** 2 + v * v > r * r || (u - 1) ** 2 + v * v > r * r || u * u + (v + 1) ** 2 > r * r || u * u + (v - 1) ** 2 > r * r;
        for (let k = 0; k < len; k++) {
          const cap0 = k === 0, cap1 = k === len - 1;
          if (!edge && !cap0 && !cap1) continue;
          const s = s0 + k + 0.5;
          let n = [u / r * (edge ? 1 : 0.2), v / r * (edge ? 1 : 0.2)];
          let ns = cap1 ? 1 : cap0 ? -1 : 0;
          let p, nn;
          if (axis === 'y') { p = [a + u, s, b + v]; nn = [n[0], ns, n[1]]; }
          else if (axis === 'x') { p = [s, a + u, b + v]; nn = [ns, n[0], n[1]]; }
          else { p = [a + u, b + v, s]; nn = [n[0], n[1], ns]; }
          const c = typeof col === 'function' ? col({ x: p[0], y: p[1], z: p[2], k, len, edge, cap0, cap1, u, v }) : col;
          if (c) this.add(name, p[0], p[1], p[2], c, norm(nn));
        }
      }
    }
  }

  // buffers reaproveitados
  let BUF = { size: 0 };
  function buffers(n) {
    if (BUF.size < n) BUF = { size: n, depth: new Float32Array(n), col: new Uint32Array(n) };
    return BUF;
  }

  // Transforma todas as partes e chama fn(x,y,z, nx,ny,nz, r,g,b) em espaço de câmera (antes da elevação).
  function walk(model, pose, yaw, fn) {
    pose = pose || {};
    const T = {};
    const root = pose.root || {};
    const G = mul(rot(0, yaw || 0, 0), rot(root.fall || 0, 0, root.roll || 0));
    const gd = [root.dx || 0, root.dy || 0, root.dz || 0];
    for (const p of model.parts) {
      const pp = pose[p.name] || {};
      const R = rot(pp.rx || 0, pp.ry || 0, pp.rz || 0);
      const px = p.pivot[0] + (pp.dx || 0), py = p.pivot[1] + (pp.dy || 0), pz = p.pivot[2] + (pp.dz || 0);
      let M, t;
      if (!p.parent) { M = R; t = [px + gd[0], py + gd[1], pz + gd[2]]; }
      else {
        const P = T[p.parent];
        M = mul(P.M, R);
        const o = ap(P.M, px, py, pz);
        t = [P.t[0] + o[0], P.t[1] + o[1], P.t[2] + o[2]];
      }
      const hidden = pp.hide || (p.parent && T[p.parent].hidden);
      T[p.name] = { M, t, hidden };
      if (hidden || !p.vox.length) continue;
      const W = mul(G, M), tw = ap(G, t[0], t[1], t[2]);
      tw[1] += root.lift || 0;
      const v = p.vox;
      for (let i = 0; i < v.length; i += 9) {
        const x = v[i], y = v[i + 1], z = v[i + 2];
        fn(W[0] * x + W[1] * y + W[2] * z + tw[0], W[3] * x + W[4] * y + W[5] * z + tw[1], W[6] * x + W[7] * y + W[8] * z + tw[2],
          W[0] * v[i + 3] + W[1] * v[i + 4] + W[2] * v[i + 5], W[3] * v[i + 3] + W[4] * v[i + 4] + W[5] * v[i + 5], W[6] * v[i + 3] + W[7] * v[i + 4] + W[8] * v[i + 5],
          v[i + 6], v[i + 7], v[i + 8]);
      }
    }
  }

  function bounds(model, pose, yaw) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    walk(model, pose, yaw, (x, y, z) => {
      const sx = x, sy = -y * CE + z * SE;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    });
    return { x0: x0 - 0.7, x1: x1 + 0.7, y0: y0 - 0.7, y1: y1 + 0.7 };
  }

  // Renderiza em out (Uint32Array W*H). opt: W,H,ox,oy,scale,yaw,ss,outline(bool),flat
  function render(model, pose, opt) {
    const W = opt.W, H = opt.H, ss = opt.ss || 4, scale = opt.scale || 1;
    const SW = W * ss, SH = H * ss;
    const b = buffers(SW * SH);
    const depth = b.depth, col = b.col;
    depth.fill(-1e9, 0, SW * SH); col.fill(0, 0, SW * SH);
    const k = scale * ss, ox = opt.ox * ss, oy = opt.oy * ss;
    const hr = k * 0.62;
    const L0 = LIGHT[0], L1 = LIGHT[1], L2 = LIGHT[2];
    const tint = opt.tint;
    walk(model, pose, opt.yaw, (x, y, z, nx, ny, nz, r, g, bl) => {
      const px = ox + x * k, py = oy + (-y * CE + z * SE) * k;
      const dz = z * CE + y * SE;
      let s = 0.6 + 0.55 * Math.max(0, nx * L0 + ny * L1 + nz * L2);
      s = Math.round(s / 0.13) * 0.13;
      let R = r * s, Gc = g * s, B = bl * s;
      if (tint) { R = R * (1 - tint[3]) + tint[0] * tint[3]; Gc = Gc * (1 - tint[3]) + tint[1] * tint[3]; B = B * (1 - tint[3]) + tint[2] * tint[3]; }
      const c = (255 << 24) | (Math.min(255, B | 0) << 16) | (Math.min(255, Gc | 0) << 8) | Math.min(255, R | 0);
      let ax = Math.max(0, Math.floor(px - hr)), bx = Math.min(SW - 1, Math.floor(px + hr));
      let ay = Math.max(0, Math.floor(py - hr)), by = Math.min(SH - 1, Math.floor(py + hr));
      for (let yy = ay; yy <= by; yy++) {
        let idx = yy * SW + ax;
        for (let xx = ax; xx <= bx; xx++, idx++) {
          if (dz > depth[idx]) { depth[idx] = dz; col[idx] = c; }
        }
      }
    });
    // reduzir: cor mais frequente do bloco
    const out = opt.out || new Uint32Array(W * H);
    const od = new Float32Array(W * H);
    const minCover = Math.ceil(ss * ss * 0.4);
    const cs = new Uint32Array(ss * ss), cn = new Uint8Array(ss * ss);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let m = 0, cover = 0, best = -1e9;
      for (let j = 0; j < ss; j++) {
        let idx = (y * ss + j) * SW + x * ss;
        for (let i = 0; i < ss; i++, idx++) {
          const c = col[idx];
          if (!c) continue;
          cover++;
          if (depth[idx] > best) best = depth[idx];
          let f = -1;
          for (let q = 0; q < m; q++) if (cs[q] === c) { f = q; break; }
          if (f < 0) { cs[m] = c; cn[m] = 1; m++; } else cn[f]++;
        }
      }
      const o = y * W + x;
      if (cover >= minCover) {
        let bi = 0; for (let q = 1; q < m; q++) if (cn[q] > cn[bi]) bi = q;
        out[o] = cs[bi]; od[o] = best;
      } else { out[o] = 0; od[o] = -1e9; }
    }
    // linhas internas: escurece pixel que está atrás de um vizinho bem mais próximo
    if (opt.inner !== false) {
      const edge = opt.edge || 2.6;
      const dark = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = y * W + x; if (!out[o]) continue;
        const d = od[o];
        if ((x > 0 && out[o - 1] && od[o - 1] > d + edge) || (x < W - 1 && out[o + 1] && od[o + 1] > d + edge) ||
          (y > 0 && out[o - W] && od[o - W] > d + edge) || (y < H - 1 && out[o + W] && od[o + W] > d + edge)) dark[o] = 1;
      }
      for (let o = 0; o < W * H; o++) if (dark[o]) {
        const c = out[o];
        out[o] = (255 << 24) | ((((c >> 16) & 255) * 0.62) << 16) | ((((c >> 8) & 255) * 0.62) << 8) | ((c & 255) * 0.62);
      }
    }
    if (opt.outline !== false) {
      const oc = (255 << 24) | (OUTLINE[2] << 16) | (OUTLINE[1] << 8) | OUTLINE[0];
      const add = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = y * W + x; if (out[o]) continue;
        if ((x > 0 && out[o - 1]) || (x < W - 1 && out[o + 1]) || (y > 0 && out[o - W]) || (y < H - 1 && out[o + W])) add.push(o);
      }
      for (const o of add) out[o] = oc;
    }
    return out;
  }

  // Renderiza numa canvas própria, enquadrando automaticamente.
  function renderFit(model, pose, opt) {
    const yaw = opt.yaw || 0, pad = opt.pad == null ? 1 : opt.pad;
    const bb = bounds(model, pose, yaw);
    let scale = opt.scale;
    if (!scale) scale = Math.min((opt.W - 2 * pad - 2) / (bb.x1 - bb.x0), (opt.H - 2 * pad - 2) / (bb.y1 - bb.y0));
    const W = opt.W || Math.ceil((bb.x1 - bb.x0) * scale) + 2 * pad + 2;
    const H = opt.H || Math.ceil((bb.y1 - bb.y0) * scale) + 2 * pad + 2;
    const ox = (W - (bb.x1 - bb.x0) * scale) / 2 - bb.x0 * scale;
    const oy = opt.H ? (H - (bb.y1 - bb.y0) * scale) / 2 - bb.y0 * scale : pad + 1 - bb.y0 * scale;
    const out = render(model, pose, { W, H, ox, oy, scale, yaw, ss: opt.ss || 4, edge: opt.edge });
    const cv = toCanvas(out, W, H);
    cv.ox = ox; cv.oy = oy; cv.scale = scale;
    return cv;
  }

  function toCanvas(buf, W, H) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(W, H);
    new Uint32Array(id.data.buffer).set(buf);
    ctx.putImageData(id, 0, 0);
    return cv;
  }

  return { Model, render, renderFit, toCanvas, bounds, hex, mix, shade, hash, rot, ELEV, CE, SE };
})();

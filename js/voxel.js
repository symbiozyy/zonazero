'use strict';
// Motor voxel -> pixel art (v2).
// Modelos são partes (ossos) com voxels de superfície gerados por formas SDF (orgânicas) ou caixas.
// Render: projeção isométrica 2:1, z-buffer com supersampling, materiais (fosco, brilho, emissivo, pele, vidro),
// rampa de cor com tons frios na sombra e quentes na luz, pontilhado Bayer, oclusão de ambiente
// em espaço de tela, linhas internas e contorno colorido.
const VX = (() => {
  const ELEV = Math.PI / 6;
  const CE = Math.cos(ELEV), SE = Math.sin(ELEV);
  const LIGHT = norm([-0.5, 0.78, 0.42]);
  const VIEW = [0, SE, CE];
  const M = { MATTE: 0, GLOSS: 1, EMIT: 2, GLASS: 3, SKIN: 4, METAL: 5 };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);

  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
  const len2 = (x, y) => Math.sqrt(x * x + y * y);
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  const hexCache = {};
  function hex(c) {
    if (Array.isArray(c)) return c;
    if (hexCache[c]) return hexCache[c];
    const n = parseInt(c.slice(1), 16);
    return (hexCache[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  function mix(a, b, t) { a = hex(a); b = hex(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function shade(c, k) { c = hex(c); return [c[0] * k, c[1] * k, c[2] * k]; }
  function hash(x, y, z) {
    let h = (Math.floor(x * 7 + 1000) * 374761393 + Math.floor(y * 7 + 1000) * 668265263 + Math.floor(z * 7 + 1000) * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  // ruído suave (valor) 3D
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const s = (t) => t * t * (3 - 2 * t);
    const u = s(xf), v = s(yf), w = s(zf);
    const h = (a, b, c) => hash((xi + a) / 7, (yi + b) / 7, (zi + c) / 7);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
  }
  function fbm(x, y, z) { return vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15; }

  function rot(rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    return mul([cy, 0, sy, 0, 1, 0, -sy, 0, cy], mul([cz, -sz, 0, sz, cz, 0, 0, 0, 1], [1, 0, 0, 0, cx, -sx, 0, sx, cx]));
  }
  function mul(A, B) {
    const C = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return C;
  }
  function ap(Mx, x, y, z) { return [Mx[0] * x + Mx[1] * y + Mx[2] * z, Mx[3] * x + Mx[4] * y + Mx[5] * z, Mx[6] * x + Mx[7] * y + Mx[8] * z]; }
  function transpose(A) { return [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]]; }
  // extrai ângulos de R = Ry(b) Rz(c) Rx(a)
  function euler(R) {
    const c = Math.asin(Math.max(-1, Math.min(1, R[3])));
    const a = Math.atan2(-R[5], R[4]);
    const b = Math.atan2(-R[6], R[0]);
    return { rx: a, ry: b, rz: c };
  }

  // ---------- SDF ----------
  const SD = {
    sphere: (cx, cy, cz, r) => (x, y, z) => len3(x - cx, y - cy, z - cz) - r,
    ell: (cx, cy, cz, rx, ry, rz) => (x, y, z) => {
      const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
      const k0 = len3(px, py, pz), k1 = len3(px / rx, py / ry, pz / rz);
      return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    },
    cap: (a, b, r1, r2) => {
      const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], bb = bx * bx + by * by + bz * bz;
      return (x, y, z) => {
        const px = x - a[0], py = y - a[1], pz = z - a[2];
        const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / bb));
        return len3(px - bx * t, py - by * t, pz - bz * t) - (r1 + (r2 - r1) * t);
      };
    },
    rbox: (cx, cy, cz, hx, hy, hz, r) => (x, y, z) => {
      const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
      return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
    },
    cylY: (cx, cz, r, y0, y1) => (x, y, z) => {
      const d = len2(x - cx, z - cz) - r, h = Math.max(y0 - y, y - y1);
      return Math.min(Math.max(d, h), 0) + len2(Math.max(d, 0), Math.max(h, 0));
    },
    union: (...fs) => (x, y, z) => { let d = 1e9; for (const f of fs) { const v = f(x, y, z); if (v < d) d = v; } return d; },
    smooth: (k, ...fs) => (x, y, z) => {
      let d = fs[0](x, y, z);
      for (let i = 1; i < fs.length; i++) { const b = fs[i](x, y, z), h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - d)) / k)); d = b + (d - b) * h - k * h * (1 - h); }
      return d;
    },
    sub: (a, b) => (x, y, z) => Math.max(a(x, y, z), -b(x, y, z)),
    inter: (a, b) => (x, y, z) => Math.max(a(x, y, z), b(x, y, z)),
    // aplica fn no referencial onde o eixo y aponta para dir, com origem o
    along: (fn, o, dir) => {
      const u = norm(dir);
      const t = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let ax = norm([t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]]);
      const az = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
      return (x, y, z) => {
        const px = x - o[0], py = y - o[1], pz = z - o[2];
        return fn(px * ax[0] + py * ax[1] + pz * ax[2], px * u[0] + py * u[1] + pz * u[2], px * az[0] + py * az[1] + pz * az[2]);
      };
    },
  };

  function parseCol(c) {
    if (!c) return null;
    if (typeof c === 'string') return [hex(c), 0];
    if (Array.isArray(c)) return [c, 0];
    return [hex(c.c), c.m || 0];
  }

  // limiar de superfície: engrossa levemente formas finas (lâminas, hastes) para não sumirem entre amostras
  const ISO = 0.22;
  class Model {
    constructor() { this.parts = []; this.map = {}; }
    part(name, parent, pivot) {
      if (this.map[name]) return this.map[name];
      const p = { name, parent: parent || null, pivot: pivot || [0, 0, 0], vox: [] };
      this.parts.push(p); this.map[name] = p; return p;
    }
    add(name, x, y, z, color, n, mat) {
      const c = hex(color);
      this.map[name].vox.push(x, y, z, n[0], n[1], n[2], clamp255(c[0]), clamp255(c[1]), clamp255(c[2]), mat || 0);
    }
    box(name, x0, y0, z0, w, h, d, col) {
      for (let ix = 0; ix < w; ix++) for (let iy = 0; iy < h; iy++) for (let iz = 0; iz < d; iz++) {
        const L = ix === 0, R = ix === w - 1, B = iy === 0, T = iy === h - 1, K = iz === 0, F = iz === d - 1;
        if (!(L || R || B || T || K || F)) continue;
        const info = { ix, iy, iz, w, h, d, left: L, right: R, bottom: B, top: T, back: K, front: F, x: x0 + ix + 0.5, y: y0 + iy + 0.5, z: z0 + iz + 0.5 };
        const pc = parseCol(typeof col === 'function' ? col(info) : col);
        if (!pc) continue;
        const n = norm([(R ? 1 : 0) - (L ? 1 : 0), (T ? 1 : 0) - (B ? 1 : 0), (F ? 1 : 0) - (K ? 1 : 0)]);
        this.add(name, info.x, info.y, info.z, pc[0], n, pc[1]);
      }
    }
    // voxeliza uma SDF dentro de b = [x0,y0,z0,x1,y1,z1]; col(info) -> cor | {c,m} | null
    sdf(name, b, f, col) {
      const x0 = Math.floor(b[0]) - 1, y0 = Math.floor(b[1]) - 1, z0 = Math.floor(b[2]) - 1;
      const nx = Math.ceil(b[3]) - x0 + 2, ny = Math.ceil(b[4]) - y0 + 2, nz = Math.ceil(b[5]) - z0 + 2;
      const D = new Float32Array(nx * ny * nz);
      const at = (i, j, k) => (k * ny + j) * nx + i;
      // passo grosso: blocos 4x4x4 longe da superfície são preenchidos sem avaliar cada célula
      const B4 = 4;
      for (let K = 0; K < nz; K += B4) for (let J = 0; J < ny; J += B4) for (let I = 0; I < nx; I += B4) {
        const ce = f(x0 + I + B4 / 2, y0 + J + B4 / 2, z0 + K + B4 / 2);
        const uniform = Math.abs(ce) > 6;
        for (let k = K; k < Math.min(nz, K + B4); k++) for (let j = J; j < Math.min(ny, J + B4); j++) for (let i = I; i < Math.min(nx, I + B4); i++) {
          const edge = i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1;
          D[at(i, j, k)] = edge ? 1 : uniform ? ce : f(x0 + i + 0.5, y0 + j + 0.5, z0 + k + 0.5);
        }
      }
      const info = { x: 0, y: 0, z: 0, n: null, d: 0 };
      for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const d = D[at(i, j, k)];
        if (d > ISO) continue;
        if (D[at(i + 1, j, k)] <= ISO && D[at(i - 1, j, k)] <= ISO && D[at(i, j + 1, k)] <= ISO && D[at(i, j - 1, k)] <= ISO && D[at(i, j, k + 1)] <= ISO && D[at(i, j, k - 1)] <= ISO) continue;
        let n = [D[at(i + 1, j, k)] - D[at(i - 1, j, k)], D[at(i, j + 1, k)] - D[at(i, j - 1, k)], D[at(i, j, k + 1)] - D[at(i, j, k - 1)]];
        if (!n[0] && !n[1] && !n[2]) n = [0, 1, 0];
        n = norm(n);
        info.x = x0 + i + 0.5; info.y = y0 + j + 0.5; info.z = z0 + k + 0.5; info.n = n; info.d = d;
        const pc = parseCol(typeof col === 'function' ? col(info) : col);
        if (!pc) continue;
        this.add(name, info.x, info.y, info.z, pc[0], n, pc[1]);
      }
    }
    count() { return this.parts.reduce((s, p) => s + p.vox.length / 10, 0); }
  }

  let BUF = { size: 0 };
  function buffers(n) {
    if (BUF.size < n) BUF = { size: n, depth: new Float32Array(n), col: new Uint32Array(n), lit: new Float32Array(n), mat: new Uint8Array(n) };
    return BUF;
  }

  // percorre voxels transformados (espaço de câmera antes da elevação)
  function walk(model, pose, yaw, fn) {
    pose = pose || {};
    const T = {};
    const root = pose.root || {};
    const G = mul(rot(0, yaw || 0, 0), mul(rot(root.fall || 0, 0, root.roll || 0), rot(root.pitch || 0, 0, 0)));
    const gd = [root.dx || 0, root.dy || 0, root.dz || 0];
    const sc = root.scale || 1;
    const slide = ap(rot(0, yaw || 0, 0), 0, 0, root.slide || 0);
    for (const p of model.parts) {
      const pp = pose[p.name] || {};
      const R = pp.R || rot(pp.rx || 0, pp.ry || 0, pp.rz || 0);
      const px = p.pivot[0] + (pp.dx || 0), py = p.pivot[1] + (pp.dy || 0), pz = p.pivot[2] + (pp.dz || 0);
      let Mx, t;
      if (!p.parent) { Mx = R; t = [px + gd[0], py + gd[1], pz + gd[2]]; }
      else {
        const P = T[p.parent];
        Mx = mul(P.M, R);
        const o = ap(P.M, px, py, pz);
        t = [P.t[0] + o[0], P.t[1] + o[1], P.t[2] + o[2]];
      }
      const hidden = pp.hide || (p.parent && T[p.parent].hidden);
      T[p.name] = { M: Mx, t, hidden };
      if (hidden || !p.vox.length) continue;
      const W = mul(G, Mx), tw = ap(G, t[0], t[1], t[2]);
      tw[0] += slide[0]; tw[1] += (root.lift || 0) + slide[1]; tw[2] += slide[2];
      const s = (pp.scale || 1) * sc;
      const v = p.vox;
      for (let i = 0; i < v.length; i += 10) {
        const x = v[i] * s, y = v[i + 1] * s, z = v[i + 2] * s;
        fn(W[0] * x + W[1] * y + W[2] * z + tw[0] * sc, W[3] * x + W[4] * y + W[5] * z + tw[1] * sc, W[6] * x + W[7] * y + W[8] * z + tw[2] * sc,
          W[0] * v[i + 3] + W[1] * v[i + 4] + W[2] * v[i + 5], W[3] * v[i + 3] + W[4] * v[i + 4] + W[5] * v[i + 5], W[6] * v[i + 3] + W[7] * v[i + 4] + W[8] * v[i + 5],
          v[i + 6], v[i + 7], v[i + 8], v[i + 9]);
      }
    }
  }

  function bounds(model, pose, yaw) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    walk(model, pose, yaw, (x, y, z) => {
      const sx = x, sy = -y * CE + z * SE;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    });
    return { x0: x0 - 0.8, x1: x1 + 0.8, y0: y0 - 0.8, y1: y1 + 0.8 };
  }

  function ramp(r, g, b, l) {
    if (l <= 1) {
      const c = 1 - l;
      return [r * l - 10 * c * l, g * l - 4 * c * l, b * l + 22 * c * l + 6 * c];
    }
    const h = Math.min(0.6, l - 1);
    return [r + (255 - r) * h * 0.62 + 6 * h, g + (238 - g) * h * 0.55, b + (205 - b) * h * 0.42];
  }

  // Render principal. opt: W,H,ox,oy,scale,yaw,ss,outline,inner,ao,dither,step,out
  function render(model, pose, opt) {
    const W = opt.W, H = opt.H, ss = opt.ss || 3, scale = opt.scale || 1;
    const SW = W * ss, SH = H * ss;
    const bf = buffers(SW * SH);
    const depth = bf.depth, col = bf.col, lit = bf.lit, mat = bf.mat;
    depth.fill(-1e9, 0, SW * SH); col.fill(0, 0, SW * SH);
    const k = scale * ss, ox = opt.ox * ss, oy = opt.oy * ss;
    const hr = k * 0.6;
    const L0 = LIGHT[0], L1 = LIGHT[1], L2 = LIGHT[2];
    walk(model, pose, opt.yaw, (x, y, z, nx, ny, nz, r, g, bl, m) => {
      const px = ox + x * k, py = oy + (-y * CE + z * SE) * k;
      const dz = z * CE + y * SE;
      const dif = Math.max(0, nx * L0 + ny * L1 + nz * L2);
      let l;
      if (m === 2) l = 1;
      else if (m === 4) l = 0.5 + 0.16 * ny + 0.5 * dif;
      else {
        l = 0.4 + 0.16 * ny + 0.64 * dif;
        if (m === 1 || m === 3 || m === 5) {
          const d2 = 2 * (nx * L0 + ny * L1 + nz * L2);
          const rx = d2 * nx - L0, ry = d2 * ny - L1, rz = d2 * nz - L2;
          const sp = Math.max(0, rx * VIEW[0] + ry * VIEW[1] + rz * VIEW[2]);
          l += Math.pow(sp, m === 5 ? 6 : 14) * (m === 5 ? 0.55 : 0.75);
          if (m === 5) l = 0.3 + l * 0.85;
        }
      }
      const c = (255 << 24) | (bl << 16) | (g << 8) | r;
      const ax = Math.max(0, Math.floor(px - hr)), bx = Math.min(SW - 1, Math.floor(px + hr));
      const ay = Math.max(0, Math.floor(py - hr)), by = Math.min(SH - 1, Math.floor(py + hr));
      for (let yy = ay; yy <= by; yy++) {
        let idx = yy * SW + ax;
        for (let xx = ax; xx <= bx; xx++, idx++) {
          if (dz > depth[idx]) { depth[idx] = dz; col[idx] = c; lit[idx] = l; mat[idx] = m; }
        }
      }
    });
    // sombra projetada no chão (direção oposta à luz)
    let shadowMask = null;
    if (opt.shadow) {
      shadowMask = new Uint8Array(W * H);
      const sx0 = -L0 / L1, sz0 = -L2 / L1;
      const hs = scale * 0.75;
      walk(model, pose, opt.yaw, (x, y, z) => {
        if (y < 0.5) return;
        const gx = x + sx0 * y, gz = z + sz0 * y;
        const px = opt.ox + gx * scale, py = opt.oy + gz * SE * scale;
        const ax = Math.max(0, Math.floor(px - hs)), bx = Math.min(W - 1, Math.floor(px + hs));
        const ay = Math.max(0, Math.floor(py - hs * 0.6)), by = Math.min(H - 1, Math.floor(py + hs * 0.6));
        for (let yy = ay; yy <= by; yy++) for (let xx = ax; xx <= bx; xx++) shadowMask[yy * W + xx] = 1;
      });
    }
    // redução por cor dominante
    const N = W * H;
    const oc = new Uint32Array(N), od = new Float32Array(N), ol = new Float32Array(N), om = new Uint8Array(N);
    const minCover = Math.ceil(ss * ss * 0.42);
    const cs = new Uint32Array(ss * ss), cn = new Uint8Array(ss * ss), cl = new Float32Array(ss * ss), cm = new Uint8Array(ss * ss);
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
          if (f < 0) { cs[m] = c; cn[m] = 1; cl[m] = lit[idx]; cm[m] = mat[idx]; m++; } else { cn[f]++; cl[f] += lit[idx]; }
        }
      }
      const o = y * W + x;
      if (cover >= minCover) {
        let bi = 0; for (let q = 1; q < m; q++) if (cn[q] > cn[bi]) bi = q;
        oc[o] = cs[bi]; ol[o] = cl[bi] / cn[bi]; om[o] = cm[bi]; od[o] = best;
      } else od[o] = -1e9;
    }
    // oclusão de ambiente em tela + linhas internas
    const ao = opt.ao == null ? 0.55 : opt.ao, edge = opt.edge || 2.4, inner = opt.inner !== false;
    if (ao > 0 || inner) {
      const R2 = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
      const tmp = new Float32Array(ol);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = y * W + x; if (!oc[o] || om[o] === 2) continue;
        const d = od[o];
        let occ = 0, ed = false;
        for (let q = 0; q < R2.length; q++) {
          const xx = x + R2[q][0], yy = y + R2[q][1];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const dn = od[yy * W + xx];
          if (dn < -1e8) continue;
          const diff = dn - d;
          if (diff > 0.6) occ += Math.min(1, (diff - 0.6) / 3);
          if (q >= 8 && diff > edge) ed = true;
        }
        let l = ol[o] * (1 - ao * Math.min(1, occ / 5));
        if (inner && ed) l *= 0.74;
        tmp[o] = l;
      }
      ol.set(tmp);
    }
    // cor final com rampa + pontilhado
    const out = opt.out || new Uint32Array(N);
    const step = opt.step || 0.12, dith = opt.dither == null ? 0.7 : opt.dither;
    const fin = new Uint32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = y * W + x, c = oc[o];
      if (!c) { fin[o] = 0; continue; }
      const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      let rr, gg, bb;
      if (om[o] === 2) { rr = r; gg = g; bb = b; }
      else {
        const l = Math.max(0.12, Math.floor(ol[o] / step + 0.5 + dith * BAYER[(y & 3) * 4 + (x & 3)]) * step);
        [rr, gg, bb] = ramp(r, g, b, l);
      }
      fin[o] = (255 << 24) | (clamp255(bb) << 16) | (clamp255(gg) << 8) | clamp255(rr);
    }
    // contorno colorido (escurece a cor vizinha)
    if (opt.outline !== false) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = y * W + x;
        if (fin[o]) { out[o] = fin[o]; continue; }
        let nb = 0;
        if (x > 0 && fin[o - 1]) nb = fin[o - 1]; else if (x < W - 1 && fin[o + 1]) nb = fin[o + 1];
        else if (y > 0 && fin[o - W]) nb = fin[o - W]; else if (y < H - 1 && fin[o + W]) nb = fin[o + W];
        if (nb) {
          const r = nb & 255, g = (nb >> 8) & 255, b = (nb >> 16) & 255;
          out[o] = (255 << 24) | (clamp255(b * 0.22 + 22) << 16) | (clamp255(g * 0.2 + 12) << 8) | clamp255(r * 0.24 + 14);
        } else out[o] = 0;
      }
    } else out.set(fin);
    if (shadowMask) {
      const sc = ((opt.shadow & 255) << 24) | (22 << 16) | (10 << 8) | 14;
      for (let o = 0; o < N; o++) if (!out[o] && shadowMask[o]) out[o] = sc;
    }
    return out;
  }

  function bbox(buf, W, H) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  function toCanvas(buf, W, H, bb) {
    bb = bb || { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
    const w = bb.x1 - bb.x0 + 1, h = bb.y1 - bb.y0 + 1;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const id = ctx.createImageData(w, h);
    const U = new Uint32Array(id.data.buffer);
    for (let y = 0; y < h; y++) U.set(buf.subarray((y + bb.y0) * W + bb.x0, (y + bb.y0) * W + bb.x0 + w), y * w);
    ctx.putImageData(id, 0, 0);
    return cv;
  }

  // Render enquadrado e recortado; cv.ox/cv.oy = pixel da origem do modelo dentro da canvas
  function renderFit(model, pose, opt) {
    const yaw = opt.yaw || 0, pad = 2;
    const bb = bounds(model, pose, yaw);
    let scale = opt.scale;
    if (!scale) scale = Math.min((opt.W - 2 * pad - 2) / (bb.x1 - bb.x0), (opt.H - 2 * pad - 2) / (bb.y1 - bb.y0));
    const W = opt.W || Math.ceil((bb.x1 - bb.x0) * scale) + 2 * pad + 2;
    const H = opt.H || Math.ceil((bb.y1 - bb.y0) * scale) + 2 * pad + 2;
    const ox = Math.round((W - (bb.x1 - bb.x0) * scale) / 2 - bb.x0 * scale) + 0.5;
    const oy = Math.round(opt.H ? (H - (bb.y1 - bb.y0) * scale) / 2 - bb.y0 * scale : pad + 1 - bb.y0 * scale) + 0.5;
    const out = render(model, pose, Object.assign({}, opt, { W, H, ox, oy, scale, yaw }));
    const b2 = opt.crop === false ? null : bbox(out, W, H);
    const cv = toCanvas(out, W, H, b2);
    cv.ox = ox - (b2 ? b2.x0 : 0); cv.oy = oy - (b2 ? b2.y0 : 0); cv.scale = scale;
    return cv;
  }

  // Atlas com prateleiras para quadros recortados
  class Atlas {
    constructor(size) { this.size = size || 2048; this.pages = []; this.newPage(); }
    newPage() {
      const cv = document.createElement('canvas'); cv.width = cv.height = this.size;
      this.pages.push({ cv, ctx: cv.getContext('2d'), x: 0, y: 0, sh: 0 });
    }
    put(buf, W, H) {
      const bb = bbox(buf, W, H);
      if (!bb) return { w: 0, h: 0 };
      const w = bb.x1 - bb.x0 + 1, h = bb.y1 - bb.y0 + 1;
      let pg = this.pages[this.pages.length - 1];
      if (pg.x + w > this.size) { pg.x = 0; pg.y += pg.sh + 1; pg.sh = 0; }
      if (pg.y + h > this.size) { this.newPage(); pg = this.pages[this.pages.length - 1]; }
      const id = pg.ctx.createImageData(w, h);
      const U = new Uint32Array(id.data.buffer);
      for (let y = 0; y < h; y++) U.set(buf.subarray((y + bb.y0) * W + bb.x0, (y + bb.y0) * W + bb.x0 + w), y * w);
      pg.ctx.putImageData(id, pg.x, pg.y);
      const fr = { cv: pg.cv, sx: pg.x, sy: pg.y, w, h, dx: bb.x0, dy: bb.y0 };
      pg.x += w + 1; pg.sh = Math.max(pg.sh, h);
      return fr;
    }
  }

  return { Model, SD, M, render, renderFit, toCanvas, bounds, bbox, Atlas, hex, mix, shade, hash, vnoise, fbm, rot, mul, ap, transpose, euler, norm, ELEV, CE, SE };
})();

'use strict';
// Jogabilidade: jogadora, infecção e sanidade, inimigos e IA, armas, explosões, fogo, ninhos,
// Floração (horda com névoa de esporos), dia/noite, chuva, visão, luzes, salvar/carregar.
const GAME = (() => {
  const N = WORLD.N;
  const iso = WORLD.iso;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const G = {
    state: 'loading', map: null, p: null, enemies: [], fx: [], decals: [], clouds: [], fires: [], projs: [],
    time: 7.5, day: 1, kills: 0, nestsDead: 0, nestsTotal: 0, codex: {}, lore: { diario: 0, tomo: 0 }, readLogs: [],
    keys: {}, mouse: { sx: 0, sy: 0, inside: false, down: false, right: false, clicked: false },
    touch: { x: 0, y: 0, active: false, run: false, fire: false },
    bloom: { t: 330, active: 0, warned: false }, rain: 0, shake: 0, flash: 0,
    uiOpen: false, paused: false, vis: null, visT: 0, spawnT: 5, pathBudget: 0, msgT: 0, saveT: 60,
    lightProps: [],
  };
  const now = () => performance.now();

  // ---------- inimigos ----------
  const EN = {
    inf_civil:      { hp: 80, walk: 0.85, run: 1.35, dmg: 9, cont: 6, sight: 10, w: 22 },
    inf_civil2:     { hp: 75, walk: 0.9, run: 1.4, dmg: 8, cont: 6, sight: 10, w: 14 },
    inf_policial:   { hp: 120, walk: 0.85, run: 1.3, dmg: 10, cont: 6, sight: 11, armor: 0.15, w: 6 },
    inf_cientista:  { hp: 90, walk: 0.8, run: 1.25, dmg: 9, cont: 9, sight: 9, puff: 1, w: 6 },
    inf_corredor:   { hp: 60, walk: 1.4, run: 4.4, dmg: 7, cont: 5, sight: 13, w: 5 },
    inf_inchado:    { hp: 150, walk: 0.6, run: 0.9, dmg: 24, cont: 30, sight: 8, bloat: 1, w: 3 },
    inf_gritador:   { hp: 70, walk: 1.0, run: 1.6, dmg: 7, cont: 5, sight: 14, scream: 1, w: 2 },
    inf_brutamonte: { hp: 480, walk: 0.95, run: 1.2, dmg: 30, cont: 8, sight: 12, charge: 1, w: 1 },
    al_arauto:      { hp: 280, walk: 1.2, run: 1.6, dmg: 16, cont: 10, sight: 15, ranged: 1, sanity: 2.5, alien: 1, w: 0 },
    al_rastejador:  { hp: 48, walk: 1.6, run: 4.8, dmg: 8, cont: 4, sight: 12, leap: 1, alien: 1, w: 0 },
    al_vigia:       { hp: 200, walk: 1.2, run: 1.7, dmg: 6, cont: 0, sight: 14, beam: 1, sanity: 4, alien: 1, w: 0 },
  };
  const INF_POOL = Object.keys(EN).filter((k) => EN[k].w > 0);
  const INF_W = INF_POOL.reduce((s, k) => s + EN[k].w, 0);
  function rollInfected(rnd) { let r = rnd * INF_W; for (const k of INF_POOL) if ((r -= EN[k].w) <= 0) return k; return 'inf_civil'; }
  function rollAlien(rnd) { return rnd < 0.5 ? 'al_rastejador' : rnd < 0.78 ? 'al_arauto' : 'al_vigia'; }

  // ---------- inventário ----------
  function makeC(n, name) { return { name, slots: new Array(n).fill(null) }; }
  function addItem(c, id, qty, limit, extra) {
    const def = ITEMS[id];
    const n = limit == null ? c.slots.length : Math.min(limit, c.slots.length);
    for (let i = 0; i < n && qty > 0; i++) {
      const s = c.slots[i];
      if (s && s.id === id && s.qty < def.stack) { const k = Math.min(qty, def.stack - s.qty); s.qty += k; qty -= k; }
    }
    for (let i = 0; i < n && qty > 0; i++) {
      if (!c.slots[i]) { const k = Math.min(qty, def.stack); c.slots[i] = Object.assign({ id, qty: k }, extra || {}); if (def.mag && c.slots[i].mag == null) c.slots[i].mag = 0; qty -= k; }
    }
    return qty;
  }
  function count(c, id) { return c.slots.reduce((s, x) => s + (x && x.id === id ? x.qty : 0), 0); }
  function remove(c, id, qty) {
    for (let i = c.slots.length - 1; i >= 0 && qty > 0; i--) {
      const s = c.slots[i];
      if (s && s.id === id) { const k = Math.min(qty, s.qty); s.qty -= k; qty -= k; if (!s.qty) c.slots[i] = null; }
    }
  }
  function weight(c) { return c.slots.reduce((s, x) => s + (x ? ITEMS[x.id].w * x.qty : 0), 0); }
  const maxCarry = 26;
  function invSize(p) { return 16 + (p.equip.back ? ITEMS[p.equip.back.id].slots : 0); }
  function heldSlot(p) { return p.inv.slots[p.hot]; }
  function held(p) { const s = heldSlot(p); if (!s) return null; const k = ITEMS[s.id].kind; return ['melee1', 'melee2', 'pistol', 'rifle', 'throw', 'place'].includes(k) ? s.id : null; }
  function armor(p) { let a = 0; for (const k of ['head', 'body']) if (p.equip[k]) a += ITEMS[p.equip[k].id].armor || 0; return Math.min(0.6, a); }
  function masked(p) { return p.equip.face && p.filter > 0; }

  function newPlayer() {
    const p = {
      x: G.map.spawn[0], y: G.map.spawn[1], dir: 0, anim: 'idle', at: 0, lock: null,
      hp: 100, hunger: 82, thirst: 78, stamina: 100, contam: 6, sanity: 100, bleed: false,
      crouch: false, aim: false, running: false, flash: false, filter: 0, fireCd: 0, hitFlash: 0, invuln: 0, dead: false,
      inv: makeC(26, 'Bolsos'), equip: { head: null, face: null, body: null, back: null }, hot: 0, forbidden: 0, coughT: 25, whisperT: 10, hallT: 20,
    };
    addItem(p.inv, 'pe_de_cabra', 1); addItem(p.inv, 'pistola', 1, null, { mag: 8 }); addItem(p.inv, 'm9', 18);
    addItem(p.inv, 'agua', 1); addItem(p.inv, 'feijao', 1); addItem(p.inv, 'bandagem', 2); addItem(p.inv, 'antifungico', 1);
    addItem(p.inv, 'lanterna', 1); addItem(p.inv, 'tabuas', 2); addItem(p.inv, 'pregos', 8); addItem(p.inv, 'diario', 1);
    return p;
  }

  // ---------- utilidades ----------
  function say(text, kind) { if (typeof UI !== 'undefined') UI.toast(text, kind); }
  function noise(x, y, r) {
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < r) { e.state = 'chase'; e.lx = x + (Math.random() - 0.5) * 1.5; e.ly = y + (Math.random() - 0.5) * 1.5; e.seenT = Math.max(e.seenT, 5); e.path = null; e.pathT = 0; }
    }
  }
  function freeSpot(x, y, rmin, rmax, outdoors) {
    const M = G.map;
    for (let t = 0; t < 50; t++) {
      const a = Math.random() * Math.PI * 2, r = rmin + Math.random() * (rmax - rmin);
      const i = Math.floor(x + Math.cos(a) * r), j = Math.floor(y + Math.sin(a) * r);
      if (!M.inb(i, j) || M.solid(i, j)) continue;
      if (outdoors && M.bld[j * N + i] >= 0) continue;
      return [i + 0.5, j + 0.5];
    }
    return null;
  }
  function darkness() {
    const h = G.time % 24;
    if (h >= 7 && h < 17.5) return 0;
    if (h >= 17.5 && h < 20) return (h - 17.5) / 2.5;
    if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
    return 1;
  }

  // ---------- inimigos ----------
  function spawnEnemy(type, x, y, opt) {
    opt = opt || {};
    const d = EN[type];
    const e = {
      type, x, y, dir: Math.floor(Math.random() * 8), anim: 'idle', at: Math.random() * 3, lock: null,
      hp: d.hp * (opt.hpMul || 1), maxhp: d.hp, state: opt.chase ? 'chase' : 'wander', lx: opt.chase ? G.p.x : x, ly: opt.chase ? G.p.y : y, seenT: opt.chase ? 10 : 0,
      path: null, pathT: 0, atkCd: 0, spCd: 2 + Math.random() * 4, hitFlash: 0, dead: false, deadT: 0, kx: 0, ky: 0, groanT: 3 + Math.random() * 12,
      wanderT: 0, tx: x, ty: y, percT: Math.random() * 0.3, lod: 0, sees: false, vx: 0, vy: 0, charge: 0, glow: !!d.alien,
    };
    e.draw = (ctx, X, Y) => drawEnemy(e, ctx, X, Y);
    G.enemies.push(e);
    return e;
  }
  function hurtEnemy(e, dmg, nx, ny, kb, kind) {
    if (e.dead) return;
    const d = EN[e.type];
    if (kind === 'fire') dmg *= 2;
    if (d.alien) dmg *= 1 + G.p.forbidden * 0.08;
    if (d.armor && kind !== 'fire' && kind !== 'blast') dmg *= 1 - d.armor;
    e.hp -= dmg; e.hitFlash = 0.12;
    e.kx += nx * kb * 5; e.ky += ny * kb * 5;
    e.state = 'chase'; e.lx = G.p.x; e.ly = G.p.y; e.seenT = 8;
    bleed(e.x, e.y, kind === 'fire' ? 2 : 5, d.alien ? 'alien' : 'inf');
    if (Math.random() < 0.5 || dmg > 30) G.fx.push({ k: 'num', x: e.x, y: e.y, v: Math.round(dmg), t: 0.8, c: kind === 'fire' ? '#ffb040' : '#ffe080' });
    if (e.hp <= 0) killEnemy(e, kind);
    else if (!e.lock || (e.lock.anim !== 'attack' && e.lock.anim !== 'cast')) { if (dmg > 6) e.lock = { anim: 'hurt', t: 0, dur: 0.22 }; }
    if (kind !== 'fire') SFX.play(d.alien ? 'chitter' : 'squish', 60);
  }
  function killEnemy(e, kind) {
    const d = EN[e.type];
    e.dead = true; e.deadT = 0; e.lock = null; e.anim = 'death'; e.at = 0;
    G.kills++;
    discover(e.type);
    G.decals.push({ x: e.x, y: e.y, r: 1.2, c: d.alien ? 'rgba(30,110,100,0.55)' : 'rgba(60,20,40,0.55)', t: 0 });
    if (d.bloat) { sporeCloud(e.x, e.y, 3, 7); explode(e.x, e.y, 2.6, 26, { spores: 1, owner: e }); SFX.play('pop'); e.gone = true; }
    else if (d.puff) sporeCloud(e.x, e.y, 2, 4);
    if (Math.random() < (d.alien ? 0.35 : 0.16)) dropItems(e.x, e.y, rollLoot(d.alien ? 'ninho' : pick(['lixo', 'caixa', 'escritorio', 'quarto']), Math.random).slice(0, 1));
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function bleed(x, y, n, kind) {
    const [sx, sy] = iso(x, y);
    const cols = kind === 'alien' ? ['#2ab0a0', '#1a6a64', '#7ff7e5'] : kind === 'inf' ? ['#5a1a2a', '#3a1020', '#c062d0'] : ['#9a1a1a', '#5a0a0a', '#9a1a1a'];
    for (let k = 0; k < n; k++) G.fx.push({ k: 'p', x: sx, y: sy - 40, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50, g: 200, t: 0.5 + Math.random() * 0.3, c: cols[k % 3], s: 2, glow: k % 3 === 2 && kind !== 'p' });
    if (G.decals.length < 400) G.decals.push({ x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.5, r: 0.4 + Math.random() * 0.5, c: kind === 'alien' ? 'rgba(30,120,110,0.5)' : kind === 'inf' ? 'rgba(70,20,40,0.5)' : 'rgba(110,10,14,0.55)', t: 0 });
    if (G.decals.length > 380) G.decals.splice(0, 20);
  }
  function discover(type) {
    if (G.codex[type]) return;
    G.codex[type] = 1;
    const b = LORE.bestiario[type];
    if (b) say('Nova entrada no Códex: ' + b.n + ' (J)', 'lore');
  }

  // ---------- combate da jogadora ----------
  function aimVec(p) {
    if (!isTouch && G.mouse.inside) {
      const [wx, wy] = mouseWorld();
      const dx = wx - p.x, dy = wy - p.y, l = Math.hypot(dx, dy);
      if (l > 0.25) return [dx / l, dy / l, l];
    }
    if (isTouch) { const t = nearestTarget(p, 9); if (t) { const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy); return [dx / l, dy / l, l]; } }
    const v = CR.vecFromDir(p.dir); return [v[0], v[1], 6];
  }
  function nearestTarget(p, r) {
    const [fx, fy] = CR.vecFromDir(p.dir);
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > r || (dx * fx + dy * fy) / d < 0.5 || !G.map.los(p.x, p.y, e.x, e.y, 'shot')) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function mouseWorld() { const V = RENDER.V; return WORLD.unIso(G.mouse.sx - V.ox, G.mouse.sy - V.oy + 30); }

  function tryAttack(fresh) {
    const p = G.p;
    if (p.dead || G.uiOpen) return;
    const id = held(p), def = id ? ITEMS[id] : null;
    const kind = def ? def.kind : 'none';
    if (kind === 'place') { if (fresh) place(); return; }
    if (p.lock && p.lock.anim !== 'shoot') return;
    const [ax, ay, dist] = aimVec(p);
    if (kind === 'pistol' || kind === 'rifle') {
      if (p.fireCd > 0) return;
      if (!def.auto && !fresh) return;
      const s = heldSlot(p);
      p.dir = CR.dirFromVec(ax, ay);
      if (s.mag <= 0) { if (fresh) { SFX.play('click'); reload(); } return; }
      s.mag--;
      p.fireCd = def.rof;
      p.lock = { anim: 'shoot', t: 0, dur: Math.min(0.2, def.rof + 0.05), soft: 1 };
      if (def.flame) flame(p, ax, ay, def); else shoot(p, ax, ay, def);
      return;
    }
    if (p.lock) return;
    if (kind === 'throw') {
      if (!fresh) return;
      p.dir = CR.dirFromVec(ax, ay);
      const tx = p.x + ax * Math.min(9, dist), ty = p.y + ay * Math.min(9, dist);
      p.lock = { anim: 'throw', t: 0, dur: 0.36, hitAt: 0.2, hit: false, onHit: () => throwItem(p, id, tx, ty) };
      return;
    }
    if (p.stamina < 5) { if (fresh) say('Sem fôlego!', 'warn'); return; }
    p.dir = CR.dirFromVec(ax, ay);
    const stab = !id || id === 'faca';
    const anim = stab ? 'punch' : 'attack';
    const speed = def ? def.speed : 1.3;
    const dur = (anim === 'attack' ? 0.46 : 0.32) / speed;
    p.stamina -= def ? (kind === 'melee2' ? 9 : 6) : 4;
    p.lock = { anim, t: 0, dur, hitAt: dur * (anim === 'attack' ? 0.5 : 0.35), hit: false, ax, ay };
    SFX.play('swing');
  }
  function meleeHit(p, ax, ay) {
    const id = held(p), def = id ? ITEMS[id] : null;
    const dmg = def ? def.dmg : 8, range = def ? def.range : 1.1, kb = def && def.knock ? def.knock : 0.3;
    const wide = def && def.kind === 'melee2';
    let hits = 0;
    const targets = G.enemies.filter((e) => !e.dead).map((e) => [e, Math.hypot(e.x - p.x, e.y - p.y)]).sort((a, b) => a[1] - b[1]);
    for (const [e, d] of targets) {
      if (d > range + 0.3) break;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (d > 0.35 && (dx * ax + dy * ay) / d < (wide ? 0.15 : 0.45)) continue;
      if (!G.map.los(p.x, p.y, e.x, e.y, 'shot')) continue;
      hurtEnemy(e, dmg * (0.85 + Math.random() * 0.3), dx / (d || 1), dy / (d || 1), kb, 'melee');
      if (++hits >= (wide ? 3 : 1)) break;
    }
    if (hits) { SFX.play('hit'); G.shake = Math.max(G.shake, 0.1); noise(p.x, p.y, 4); }
    // objetos à frente (ninhos, barricadas, barris, janelas)
    const fx = p.x + ax * 0.95, fy = p.y + ay * 0.95;
    const pr = G.map.prop(Math.floor(fx), Math.floor(fy));
    if (pr && !pr.dead && pr.maxhp) { damageProp(pr, dmg, 'melee'); if (!hits) SFX.play('bang'); }
    else if (!hits) smashWindowNear(p, ax, ay);
  }
  function smashWindowNear(p, ax, ay) {
    const M = G.map;
    const x = p.x + ax * 0.7, y = p.y + ay * 0.7;
    const i = Math.floor(p.x), j = Math.floor(p.y), ti = Math.floor(x), tj = Math.floor(y);
    const tryE = (s, a, b) => { const k = b * N + a; const kind = M['w' + s][k]; if ((kind === WORLD.W.WINDOW || kind === WORLD.W.STORE) && M['wst' + s][k] === 0) { M['wst' + s][k] = 1; SFX.play('glass'); noise(p.x, p.y, 8); return true; } return false; };
    if (ti !== i) tryE('W', Math.max(i, ti), j);
    if (tj !== j) tryE('N', i, Math.max(j, tj));
  }
  function damageProp(pr, dmg, kind) {
    const D = PROPS.D[pr.type];
    if (D.boss && G.nestsTotal - G.nestsDead > 3) { if (Math.random() < 0.3) say('O Fragmento repele o ataque. Destrua mais ninhos.', 'warn'); return; }
    if (D.nest && kind === 'fire') dmg *= 2;
    pr.hp -= dmg; pr.hitFlash = 0.1; G.propsFlash.add(pr);
    if (D.nest || D.boss) { const [sx, sy] = iso(pr.x, pr.y); for (let k = 0; k < 3; k++) G.fx.push({ k: 'p', x: sx, y: sy - 20, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 40, g: 160, t: 0.6, c: '#d06aff', s: 2, glow: 1 }); }
    if (pr.hp <= 0 && !pr.dead) destroyProp(pr);
  }
  function destroyProp(pr) {
    const M = G.map, D = PROPS.D[pr.type];
    M.removeProp(pr);
    if (D.nest) {
      G.nestsDead++;
      SFX.play('nest');
      sporeCloud(pr.x, pr.y, 3.5, 6);
      dropItems(pr.x, pr.y, rollLoot('ninho', Math.random).concat([{ id: 'nucleo', qty: 1 + Math.floor(Math.random() * 2) }]));
      const left = G.nestsTotal - G.nestsDead;
      say(left > 3 ? `Ninho destruído! Restam ${left}.` : left > 0 ? `Ninho destruído! O Fragmento enfraqueceu (${left} restantes).` : 'Todos os ninhos foram destruídos!', 'good');
      if (left === 3) { UI.banner('O FRAGMENTO ESTÁ VULNERÁVEL'); discover('fragmento'); }
      G.shake = 0.3;
    } else if (D.boss) {
      explode(pr.x, pr.y, 6, 0, { big: 1 });
      SFX.play('win');
      setTimeout(() => UI.showEnd(true), 2500);
    } else if (pr.type === 'barril') explode(pr.x, pr.y, 3, 90, { fire: 1 });
    else if (D.built) { dropItems(pr.x, pr.y, [{ id: 'tabuas', qty: 1 }]); say('Uma construção foi destruída.', 'warn'); }
    for (let b = pr.j; b < pr.j + pr.fh; b++) for (let a = pr.i; a < pr.i + pr.fw; a++) RENDER.invalidate(a, b);
  }
  // disparo com marcha de raio: atravessa janelas (quebrando o vidro), para em paredes
  function shoot(p, ax, ay, def) {
    const pellets = def.pellets || 1;
    const spread = def.spread * (p.aim ? 0.45 : 1) * (p.crouch ? 0.8 : 1) * (p.running ? 1.8 : 1);
    SFX.play(def.pellets ? 'shotgun' : def.dmg > 100 ? 'sniper' : def.kind === 'rifle' ? 'rifle' : 'shot');
    G.flash = 0.06; G.shake = Math.max(G.shake, def.pellets ? 0.22 : 0.1); noise(p.x, p.y, def.noise);
    const M = G.map;
    const mx = p.x + ax * 0.45, my = p.y + ay * 0.45;
    G.fx.push({ k: 'muzzle', x: mx, y: my, t: 0.05 });
    const [sx, sy] = iso(p.x, p.y);
    G.fx.push({ k: 'p', x: sx + 4, y: sy - 46, vx: 40 * (Math.random() - 0.3), vy: -50, g: 300, t: 0.5, c: '#d8b048', s: 1 });
    for (let q = 0; q < pellets; q++) {
      const a = Math.atan2(ay, ax) + (Math.random() - 0.5) * 2 * spread;
      const dx = Math.cos(a), dy = Math.sin(a);
      let x = mx, y = my, pierce = def.pierce || 1, hitAny = false;
      let pi = Math.floor(x), pj = Math.floor(y);
      const hitSet = new Set();
      for (let t = 0; t < def.range; t += 0.12) {
        const nx = mx + dx * t, ny = my + dy * t;
        const ci = Math.floor(nx), cj = Math.floor(ny);
        let blocked = false;
        const edgeCheck = (s, a2, b2) => {
          if (M.edge(a2, b2, s, 'shot')) return true;
          const k = b2 * N + a2, kind = M['w' + s][k];
          if ((kind === WORLD.W.WINDOW || kind === WORLD.W.STORE) && M['wst' + s][k] === 0 && Math.random() < 0.7) { M['wst' + s][k] = 1; SFX.play('glass', 80); }
          return false;
        };
        if (ci !== pi && edgeCheck('W', Math.max(pi, ci), pj)) blocked = true;
        if (!blocked && cj !== pj && edgeCheck('N', ci, Math.max(pj, cj))) blocked = true;
        if (blocked) { x = nx; y = ny; sparks(nx, ny); break; }
        pi = ci; pj = cj; x = nx; y = ny;
        const pr = M.prop(ci, cj);
        if (pr && !pr.dead && pr.solid && PROPS.D[pr.type].tall) { if (pr.maxhp) damageProp(pr, def.dmg, 'bullet'); else sparks(nx, ny); break; }
        if (pr && pr.type === 'barril' && pr.v % 5 === 4 && !pr.dead) { pr.maxhp = pr.maxhp || 25; pr.hp = (pr.hp || 25) - def.dmg; if (pr.hp <= 0) destroyProp(pr); break; }
        let hit = null;
        for (const e of G.enemies) if (!e.dead && !hitSet.has(e) && Math.abs(e.x - nx) < 0.5 && Math.abs(e.y - ny) < 0.5 && Math.hypot(e.x - nx, e.y - ny) < (e.type === 'inf_brutamonte' ? 0.55 : 0.42)) { hit = e; break; }
        if (hit) {
          hitSet.add(hit); hitAny = true;
          const falloff = def.pellets ? Math.max(0.35, 1 - t / def.range) : 1;
          hurtEnemy(hit, def.dmg * falloff * (0.9 + Math.random() * 0.2), dx, dy, (def.knock || 0.15), 'bullet');
          if (--pierce <= 0) break;
        }
      }
      G.fx.push({ k: 'tracer', x0: mx, y0: my, x1: x, y1: y, t: 0.07 });
      void hitAny;
    }
  }
  function sparks(x, y) {
    const [sx, sy] = iso(x, y);
    for (let k = 0; k < 4; k++) G.fx.push({ k: 'p', x: sx, y: sy - 30, vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 40, g: 250, t: 0.25, c: '#ffd070', s: 1, glow: 1 });
  }
  function flame(p, ax, ay, def) {
    SFX.play('flame', 120);
    noise(p.x, p.y, def.noise);
    const [sx, sy] = iso(p.x + ax * 0.6, p.y + ay * 0.6);
    for (let k = 0; k < 3; k++) {
      const a = Math.atan2(ay, ax) + (Math.random() - 0.5) * 0.4, sp = 5 + Math.random() * 2;
      G.fx.push({ k: 'flame', wx: p.x + ax * 0.6, wy: p.y + ay * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.5 + Math.random() * 0.25, t0: 0.75 });
    }
    void sx; void sy;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > def.range || (dx * ax + dy * ay) / (d || 1) < 0.82) continue;
      if (!G.map.los(p.x, p.y, e.x, e.y, 'shot')) continue;
      hurtEnemy(e, def.dmg, dx / d, dy / d, 0.05, 'fire');
      e.burn = 3;
    }
    const tx = p.x + ax * 3.5, ty = p.y + ay * 3.5;
    if (Math.random() < 0.08) addFire(tx, ty, 0.9, 4);
    for (let t = 1; t <= 5; t++) {
      const pr = G.map.prop(Math.floor(p.x + ax * t), Math.floor(p.y + ay * t));
      if (pr && !pr.dead && (pr.maxhp || ['cogumelos', 'casulo', 'pilar_fungico'].includes(pr.type))) { if (pr.maxhp) damageProp(pr, def.dmg * 1.5, 'fire'); else destroyProp(pr); break; }
    }
  }
  function throwItem(p, id, tx, ty) {
    if (count(p.inv, id) <= 0) return;
    remove(p.inv, id, 1);
    const d = Math.hypot(tx - p.x, ty - p.y), T = 0.35 + d * 0.06;
    G.projs.push({ k: id, x: p.x, y: p.y, z: 1.4, vx: (tx - p.x) / T, vy: (ty - p.y) / T, vz: 4.5, t: 0, fuse: id === 'granada' ? 2.2 : 0, landed: false });
    SFX.play('swing');
    UI.refresh();
  }
  function explode(x, y, r, dmg, o) {
    o = o || {};
    G.fx.push({ k: 'expl', x, y, t: 0.6, t0: 0.6, r, spores: o.spores });
    G.shake = Math.max(G.shake, o.big ? 0.8 : 0.45); G.flash = 0.12;
    SFX.play(o.spores ? 'pop' : 'boom');
    noise(x, y, 30);
    if (!o.spores) G.decals.push({ x, y, r: r * 0.7, c: 'rgba(18,14,12,0.6)', t: 0 });
    for (const e of G.enemies) {
      if (e.dead || e === o.owner) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > r || !G.map.los(x, y, e.x, e.y, 'shot')) continue;
      const f = 1 - d / r;
      hurtEnemy(e, dmg * (0.4 + 0.6 * f), (e.x - x) / (d || 1), (e.y - y) / (d || 1), 1.6 * f, 'blast');
    }
    const p = G.p, dp = Math.hypot(p.x - x, p.y - y);
    if (dp < r && G.map.los(x, y, p.x, p.y, 'shot')) {
      hurtPlayer(dmg * 0.6 * (1 - dp / r), o.spores ? 18 : 0, true);
      if (o.spores && !masked(p)) p.contam += 14;
    }
    const M = G.map;
    for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
      if (!M.inb(i, j) || Math.hypot(i + 0.5 - x, j + 0.5 - y) > r) continue;
      const pr = M.prop(i, j);
      if (pr && !pr.dead && pr.maxhp && !o.spores) damageProp(pr, dmg * 0.8, 'blast');
      else if (pr && !pr.dead && !o.spores && ['cogumelos', 'casulo', 'pilar_fungico'].includes(pr.type)) destroyProp(pr);
      if (o.spores) continue;
      for (const s of ['N', 'W']) {
        const k = j * N + i, kind = M['w' + s][k];
        if ((kind === WORLD.W.WINDOW || kind === WORLD.W.STORE) && M['wst' + s][k] === 0) M['wst' + s][k] = 1;
        if (kind === WORLD.W.DOOR && M['wst' + s][k] !== 2 && Math.hypot(i + 0.5 - x, j + 0.5 - y) < r * 0.7) M['wst' + s][k] = 2;
      }
      if (M.floor[j * N + i] === WORLD.F.MICELIO && !o.spores) { M.floor[j * N + i] = WORLD.F.CRATERA; RENDER.invalidate(i, j); }
    }
    if (o.fire) addFire(x, y, r * 0.75, 7);
  }
  function addFire(x, y, r, dur) {
    G.fires.push({ x, y, r, t: dur, tick: 0 });
    const M = G.map;
    for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
      if (!M.inb(i, j) || Math.hypot(i + 0.5 - x, j + 0.5 - y) > r) continue;
      if (M.floor[j * N + i] === WORLD.F.MICELIO) { M.floor[j * N + i] = WORLD.F.CRATERA; RENDER.invalidate(i, j); }
    }
  }
  function sporeCloud(x, y, r, dur) { G.clouds.push({ x, y, r, t: dur, t0: dur }); }

  function hurtPlayer(dmg, cont, blast) {
    const p = G.p;
    if (p.dead || p.invuln > 0) return;
    dmg *= 1 - armor(p);
    p.hp -= dmg; p.hitFlash = 0.15; G.shake = Math.max(G.shake, 0.18);
    SFX.play('hurt', 120);
    bleed(p.x, p.y, 4, 'p');
    if (cont) p.contam = Math.min(100, p.contam + cont * (masked(p) ? 0.5 : 1));
    if (!blast && Math.random() < 0.25 && !p.bleed) { p.bleed = true; say('Você está sangrando! Use uma bandagem.', 'bad'); }
    if (!p.lock && dmg > 3) p.lock = { anim: 'hurt', t: 0, dur: 0.2 };
    if (p.hp <= 0) die('Você foi morta pelos hospedeiros.');
  }
  function die(reason) {
    const p = G.p;
    if (p.dead) return;
    p.hp = 0; p.dead = true; p.lock = null; p.anim = 'death'; p.at = 0;
    G.deathReason = reason;
    setTimeout(() => UI.showEnd(false), 1800);
  }

  // ---------- chão e containers ----------
  function dropItems(x, y, items) {
    if (!items || !items.length) return;
    const M = G.map;
    let pile = null;
    for (let r = 0; r <= 2 && !pile; r++) for (let dj = -r; dj <= r && !pile; dj++) for (let di = -r; di <= r && !pile; di++) {
      const i = Math.floor(x) + di, j = Math.floor(y) + dj;
      if (!M.inb(i, j)) continue;
      const pr = M.prop(i, j);
      if (pr && pr.type === 'bolsa_chao' && !pr.dead) pile = pr;
      else if (!pr) { pile = M.addProp('bolsa_chao', i, j, {}); if (pile) { pile.items = makeC(16, 'Chão'); pile.name = 'Itens no chão'; } }
    }
    if (!pile) return;
    for (const it of items) addItem(pile.items, it.id, it.qty, null, it.mag != null ? { mag: it.mag } : null);
  }
  function openContainer(pr) {
    if (!pr.items) {
      const r = WORLD.rng(pr.id * 7919 + G.map.seed);
      pr.items = makeC(12, pr.name);
      for (const it of rollLoot(pr.loot, r)) addItem(pr.items, it.id, it.qty, null, ITEMS[it.id].mag ? { mag: Math.floor(r() * ITEMS[it.id].mag) } : null);
    }
    UI.openLoot(pr);
  }
  function nearestInteract() {
    const p = G.p, M = G.map;
    const [fx, fy] = CR.vecFromDir(p.dir);
    let best = null, bd = 1e9;
    const consider = (o, x, y, label, rr) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d > (rr || 1.5)) return;
      const score = d - 0.4 * ((x - p.x) * fx + (y - p.y) * fy) / (d || 1);
      if (score < bd) { bd = score; best = { o, label }; }
    };
    const i0 = Math.floor(p.x), j0 = Math.floor(p.y);
    for (let j = j0 - 3; j <= j0 + 3; j++) for (let i = i0 - 3; i <= i0 + 3; i++) {
      if (!M.inb(i, j)) continue;
      const k = j * N + i;
      const pr = M.prop(i, j);
      if (pr && !pr.dead && pr.i === i && pr.j === j) {
        const reach = Math.max(pr.fw, pr.fh) / 2 + 1.0;
        const cx = Math.max(pr.i, Math.min(pr.i + pr.fw, p.x)), cy = Math.max(pr.j, Math.min(pr.j + pr.fh, p.y));
        if (pr.type === 'escrivaninha' && pr.v % 3 === 2 && !pr.read) consider(pr, cx, cy, 'Usar computador', 1.3);
        else if (pr.loot || pr.type === 'bolsa_chao') { const empty = pr.items && pr.items.slots.every((s) => !s); consider(pr, cx, cy, (pr.items ? 'Abrir ' : 'Vasculhar ') + pr.name + (empty ? ' (vazio)' : ''), 1.3); }
        else if (pr.lore) consider(pr, cx, cy, 'Examinar ' + pr.name, 1.4);
        void reach;
      }
      for (const s of ['N', 'W']) {
        const kind = M['w' + s][k];
        if (kind === WORLD.W.DOOR) { const st = M['wst' + s][k]; consider({ door: s, i, j }, s === 'N' ? i + 0.5 : i, s === 'N' ? j : j + 0.5, st === 2 ? 'Porta arrombada' : st ? 'Fechar porta' : 'Abrir porta'); }
        if (kind === WORLD.W.WINDOW && M['wst' + s][k] === 0) consider({ win: s, i, j }, s === 'N' ? i + 0.5 : i, s === 'N' ? j : j + 0.5, 'Quebrar janela', 1.1);
      }
    }
    return best;
  }
  function interact() {
    const p = G.p;
    if (p.dead || (p.lock && p.lock.anim !== 'interact')) return;
    if (G.uiOpen && UI.lootOpen()) { UI.closeAll(); return; }
    const t = nearestInteract();
    if (!t) return;
    const o = t.o, M = G.map;
    if (o.door) {
      const k = o.j * N + o.i, arr = M['wst' + o.door];
      if (arr[k] === 2) { say('A porta foi arrombada.'); return; }
      arr[k] = arr[k] ? 0 : 1;
      SFX.play('door'); noise(p.x, p.y, 3);
      M.collide(p, 0.26);
      return;
    }
    if (o.win) { M['wst' + o.win][o.j * N + o.i] = 1; SFX.play('glass'); noise(p.x, p.y, 9); p.lock = { anim: 'punch', t: 0, dur: 0.3 }; return; }
    p.dir = CR.dirFromVec(o.x - p.x, o.y - p.y);
    if (o.type === 'escrivaninha' && o.v % 3 === 2 && !o.read) { o.read = 1; UI.showText('Terminal', LORE.terminais[o.id % LORE.terminais.length]); return; }
    if (o.lore === 'tanque') { UI.showText('Tanque de contenção', 'Dentro do líquido verde, algo com quatro olhos flutua imóvel. A etiqueta diz: “Espécime A-2 — não reanimar”.'); discover('al_arauto'); return; }
    if (o.items) { openContainer(o); return; }
    p.lock = { anim: 'interact', t: 0, dur: 0.85, onDone: () => openContainer(o) };
  }
  function placeTarget() {
    const p = G.p;
    let i, j;
    if (!isTouch && G.mouse.inside) { const [wx, wy] = mouseWorld(); if (Math.hypot(wx - p.x, wy - p.y) < 2.6) { i = Math.floor(wx); j = Math.floor(wy); } }
    if (i == null) { const [fx, fy] = CR.vecFromDir(p.dir); i = Math.floor(p.x + fx * 1.1); j = Math.floor(p.y + fy * 1.1); }
    const M = G.map;
    const ok = M.inb(i, j) && !M.prop(i, j) && !(Math.floor(p.x) === i && Math.floor(p.y) === j) && !G.enemies.some((e) => !e.dead && Math.floor(e.x) === i && Math.floor(e.y) === j);
    return { i, j, ok };
  }
  function place() {
    const p = G.p, id = held(p);
    if (!id || ITEMS[id].kind !== 'place') return;
    const t = placeTarget();
    if (!t.ok) { say('Não dá para construir aí.', 'warn'); return; }
    const [fx, fy] = CR.vecFromDir(p.dir);
    const rot = Math.abs(fx) > Math.abs(fy) ? 1 : 0;
    const pr = G.map.addProp(ITEMS[id].prop, t.i, t.j, { rot });
    if (!pr) return;
    remove(p.inv, id, 1);
    G.placed.push({ type: pr.type, i: pr.i, j: pr.j, rot });
    SFX.play('build'); noise(p.x, p.y, 6);
    p.lock = { anim: 'punch', t: 0, dur: 0.3 };
    if (pr.type === 'fogueira') pr.light = PROPS.D.fogueira.light;
    UI.refresh();
  }
  function reload() {
    const p = G.p, s = heldSlot(p);
    if (!s || p.lock) return;
    const def = ITEMS[s.id];
    if (!def.mag || s.mag >= def.mag) return;
    if (count(p.inv, def.ammo) <= 0) { say('Sem ' + ITEMS[def.ammo].name + '.', 'warn'); return; }
    SFX.play('reload');
    p.lock = { anim: 'reload', t: 0, dur: def.reload, onDone: () => { const need = def.mag - s.mag, have = count(p.inv, def.ammo), k = Math.min(need, have); remove(p.inv, def.ammo, k); s.mag += k; UI.refresh(); } };
  }
  function useItem(c, idx) {
    const p = G.p, s = c.slots[idx];
    if (!s) return;
    const def = ITEMS[s.id];
    if (def.kind === 'food') {
      p.hunger = Math.max(0, Math.min(100, p.hunger + (def.hunger || 0))); p.thirst = Math.max(0, Math.min(100, p.thirst + (def.thirst || 0)));
      if (def.sanity) p.sanity = Math.min(100, p.sanity + def.sanity);
      SFX.play('eat'); say('Consumiu ' + def.name + '.');
      if (def.empty) addItem(c, def.empty, 1);
    } else if (def.kind === 'med') {
      if (def.heal) p.hp = Math.min(100, p.hp + def.heal);
      if (def.bleed) p.bleed = false;
      if (def.cure) p.contam = Math.max(0, p.contam - def.cure);
      if (def.sanity) p.sanity = Math.max(0, Math.min(100, p.sanity + def.sanity));
      SFX.play('pickup'); say('Usou ' + def.name + '.');
    } else if (s.id === 'filtro') {
      if (!p.equip.face) { say('Equipe uma máscara de gás primeiro.', 'warn'); return; }
      p.filter += 90; SFX.play('reload'); say('Filtro encaixado (+90 s).');
    } else if (def.kind === 'lore') { readLore(s.id); return; }
    else if (def.kind === 'wear') { UI.equipWear(c, idx); return; }
    else return;
    s.qty--; if (!s.qty) c.slots[idx] = null;
    UI.refresh();
  }
  function readLore(id) {
    const p = G.p;
    if (id === 'diario') {
      const n = G.lore.diario;
      const e = LORE.diarios[Math.min(n, LORE.diarios.length - 1)];
      if (n < LORE.diarios.length) { G.lore.diario++; G.readLogs.push(e.t); }
      UI.showText(e.t, e.b + (n + 1 < LORE.diarios.length ? '\n\n(Encontre mais diários para continuar a história.)' : ''));
    } else if (id === 'tomo') {
      const n = G.lore.tomo;
      const t = LORE.tomos[n % LORE.tomos.length];
      G.lore.tomo++; p.forbidden++; p.sanity = Math.max(0, p.sanity - 20);
      SFX.play('whisper');
      UI.showText('Tomo do Vazio', t + `\n\nConhecimento proibido: +${p.forbidden * 8}% de dano contra alienígenas. Sanidade −20.`);
      remove(p.inv, 'tomo', 1);
      UI.refresh();
    }
  }
  function craft(r) {
    const p = G.p;
    for (const [id, q] of Object.entries(r.need)) if (count(p.inv, id) < q) return false;
    for (const [id, q] of Object.entries(r.need)) remove(p.inv, id, q);
    const left = addItem(p.inv, r.out, r.qty, invSize(p));
    if (left) dropItems(p.x, p.y, [{ id: r.out, qty: left }]);
    SFX.play('build'); say('Criou ' + ITEMS[r.out].name + '.');
    return true;
  }

  // ---------- atualização da jogadora ----------
  function setAnim(e, a) { if (e.anim !== a) { e.anim = a; e.at = 0; } }
  function updatePlayer(dt) {
    const p = G.p, M = G.map;
    p.invuln = Math.max(0, p.invuln - dt); p.hitFlash = Math.max(0, p.hitFlash - dt); p.fireCd = Math.max(0, p.fireCd - dt);
    if (p.dead) { p.at += dt; return; }
    const outdoors = M.bld[Math.floor(p.y) * N + Math.floor(p.x)] < 0;
    const dk = darkness();
    // necessidades
    p.hunger = Math.max(0, p.hunger - dt * 0.055);
    p.thirst = Math.max(0, p.thirst - dt * 0.08);
    if (p.hunger <= 0 || p.thirst <= 0) p.hp -= dt * 0.5;
    else if (p.hunger > 50 && p.thirst > 50 && !p.bleed && p.contam < 60) p.hp = Math.min(100, p.hp + dt * 0.22);
    if (p.bleed) p.hp -= dt * 0.7;
    // contaminação
    const onMyc = M.floor[Math.floor(p.y) * N + Math.floor(p.x)] === WORLD.F.MICELIO;
    let cRate = 0;
    if (onMyc) cRate += 0.12;
    for (const c of G.clouds) if (Math.hypot(c.x - p.x, c.y - p.y) < c.r) cRate += 4;
    if (G.bloom.active > 0) cRate += outdoors ? 0.55 : 0.12;
    if (masked(p)) { p.filter = Math.max(0, p.filter - dt * (cRate > 0 ? 1 : 0.15)); cRate *= 0.08; if (p.filter <= 0 && count(p.inv, 'filtro') > 0) { remove(p.inv, 'filtro', 1); p.filter = 90; say('Filtro trocado automaticamente.'); UI.refresh(); } }
    p.contam = Math.min(100, p.contam + cRate * dt);
    if (p.contam > 80) p.hp -= dt * 0.35 * (p.contam - 80) / 20;
    if (p.contam >= 100) { die('O micélio tomou conta. Você floresceu.'); return; }
    if (p.contam > 40) { p.coughT -= dt; if (p.coughT <= 0) { p.coughT = 18 + Math.random() * 15; SFX.play('cough'); noise(p.x, p.y, 7); say('Você tossiu esporos.', 'warn'); } }
    // sanidade
    let sRate = dk > 0.6 ? -0.18 : 0.12;
    const lit = p.flash || nearLight(p.x, p.y);
    if (lit) sRate = Math.max(sRate, dk > 0.6 ? 0.05 : 0.2);
    for (const e of G.enemies) if (!e.dead && EN[e.type].sanity && e.sees && Math.hypot(e.x - p.x, e.y - p.y) < 14) sRate -= EN[e.type].sanity * (e.type === 'al_vigia' ? 0.5 : 1);
    for (const n of M.nests) if (!n.dead && Math.hypot(n.x - p.x, n.y - p.y) < 6) sRate -= 0.5;
    p.sanity = Math.max(0, Math.min(100, p.sanity + sRate * dt));
    if (p.sanity <= 0) p.hp -= dt * 0.4;
    if (p.sanity < 45) { p.whisperT -= dt; if (p.whisperT <= 0) { p.whisperT = 6 + Math.random() * 10; SFX.play('whisper'); } }
    if (p.sanity < 25) { p.hallT -= dt; if (p.hallT <= 0) { p.hallT = 10 + Math.random() * 15; hallucinate(); } }
    if (p.hp < 30 || p.sanity < 20) { G.heartT = (G.heartT || 0) - dt; if (G.heartT <= 0) { G.heartT = 1.1; SFX.play('heart'); } }
    if (p.hp <= 0) { die(p.sanity <= 0 ? 'Sua mente se partiu.' : 'Você não resistiu aos ferimentos.'); return; }

    // movimento
    let sx = 0, sy = 0;
    const K = G.keys;
    if (!G.uiOpen || UI.lootOpen()) {
      if (K.KeyW || K.ArrowUp) sy -= 1; if (K.KeyS || K.ArrowDown) sy += 1;
      if (K.KeyA || K.ArrowLeft) sx -= 1; if (K.KeyD || K.ArrowRight) sx += 1;
      if (G.touch.active) { sx = G.touch.x; sy = G.touch.y; }
    }
    let wx = (sx + sy) / Math.SQRT2, wy = (sy - sx) / Math.SQRT2;
    const l = Math.hypot(wx, wy);
    const moving = l > 0.15;
    if (moving) { wx /= Math.max(1, l); wy /= Math.max(1, l); }
    const id = held(p), cls = id ? ITEMS[id].kind : null;
    p.aim = !isTouch && G.mouse.right && (cls === 'pistol' || cls === 'rifle') && !G.uiOpen;
    const wantRun = (K.ShiftLeft || K.ShiftRight || G.touch.run) && !p.crouch && !p.aim;
    p.running = moving && wantRun && p.stamina > 1;
    if (p.running) p.stamina = Math.max(0, p.stamina - dt * 15);
    else p.stamina = Math.min(100, p.stamina + dt * (p.crouch ? 18 : moving ? 10 : 15));

    if (p.lock) {
      const L = p.lock;
      L.t += dt;
      setAnim(p, L.anim);
      if (L.hitAt != null && !L.hit && L.t >= L.hitAt) { L.hit = true; if (L.onHit) L.onHit(); else meleeHit(p, L.ax, L.ay); }
      if (L.t >= L.dur) { p.lock = null; if (L.onDone) L.onDone(); }
      if (L.anim === 'interact' && moving) p.lock = null;
    }
    const softLock = p.lock && p.lock.soft;
    if (!p.lock || softLock) {
      if (moving) {
        let sp = p.running ? 4.6 : p.crouch ? 1.3 : p.aim ? 1.6 : 2.6;
        if (weight(p.inv) > maxCarry) sp *= 0.7;
        if (onMyc) sp *= 0.85;
        p.x += wx * sp * dt * Math.min(1, l); p.y += wy * sp * dt * Math.min(1, l);
        M.collide(p, 0.26);
        if (!p.aim && !softLock) p.dir = CR.dirFromVec(wx, wy);
        if (!softLock) setAnim(p, p.aim ? 'aimwalk' : p.running ? 'run' : p.crouch ? 'sneak' : 'walk');
        p.at += dt * (p.running ? 1 : 0.9);
        G.stepT = (G.stepT || 0) - dt;
        if (G.stepT <= 0) { G.stepT = 0.5; noise(p.x, p.y, p.running ? 6 : p.crouch ? 0.8 : 2.4); }
      } else if (!softLock) { setAnim(p, p.aim ? 'shoot' : p.crouch ? 'crouch' : 'idle'); p.at += dt; if (p.aim) p.at = 0; }
      if (p.aim) { const [ax, ay] = aimVec(p); p.dir = CR.dirFromVec(ax, ay); }
    }
    // disparo contínuo
    const fireHeld = (G.mouse.down && G.mouse.inside) || G.touch.fire;
    if (fireHeld && !G.uiOpen) tryAttack(G.mouse.clicked || G.touch.fresh);
    G.mouse.clicked = false; G.touch.fresh = false;
    if (UI.lootOpen()) { const o = UI.lootTarget(); if (o && Math.hypot(o.x - p.x, o.y - p.y) > 2.6 + Math.max(o.fw, o.fh) / 2) UI.closeAll(); }
  }
  function nearLight(x, y) {
    for (const f of G.fires) if (Math.hypot(f.x - x, f.y - y) < 4) return true;
    if (darkness() > 0.5) for (const L of G.activeLights || []) if (Math.hypot(L.x - x, L.y - y) < L.r * 0.5) return true;
    return false;
  }
  function hallucinate() {
    const p = G.p;
    const s = freeSpot(p.x, p.y, 5, 9);
    if (!s) return;
    const e = spawnEnemy(Math.random() < 0.5 ? 'al_arauto' : 'inf_brutamonte', s[0], s[1], { chase: true });
    e.fake = 6; e.hp = 1;
    SFX.play('whisper');
  }

  // ---------- IA ----------
  function updateEnemy(e, dt) {
    const p = G.p, M = G.map, d = EN[e.type];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.dead) { e.deadT += dt; e.at += dt; return; }
    if (e.fake != null) { e.fake -= dt; const dd = Math.hypot(p.x - e.x, p.y - e.y); if (e.fake <= 0 || dd < 1.4) { e.dead = true; e.gone = true; return; } }
    if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.4; hurtEnemy(e, 4, 0, 0, 0, 'fire'); const [sx, sy] = iso(e.x, e.y); G.fx.push({ k: 'p', x: sx, y: sy - 30, vx: (Math.random() - 0.5) * 20, vy: -60, g: -20, t: 0.5, c: '#ffa030', s: 2, glow: 1 }); } if (e.dead) return; }
    if (e.kx || e.ky) { e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt); if (Math.abs(e.kx) + Math.abs(e.ky) < 0.05) e.kx = e.ky = 0; M.collide(e, 0.28); }
    e.atkCd -= dt; e.spCd -= dt; e.groanT -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy);
    if (e.groanT <= 0) { e.groanT = 6 + Math.random() * 12; if (dist < 12) SFX.play(d.alien ? (e.type === 'al_vigia' ? 'hum' : 'chitter') : 'groan', 400); }
    // percepção (escalonada)
    e.percT -= dt;
    if (e.percT <= 0) {
      e.percT = 0.25;
      e.sees = false;
      if (!p.dead) {
        const dk = darkness();
        let range = d.sight * (1 - dk * 0.35) * (p.crouch ? 0.55 : 1) * (p.flash && dk > 0.5 ? 1.5 : 1) * (G.bloom.active > 0 ? 1.3 : 1);
        const [fx, fy] = CR.vecFromDir(e.dir);
        const facing = dist < 0.01 ? 1 : (dx * fx + dy * fy) / dist;
        if (dist < 1.6 || (dist < range && facing > -0.25 && M.los(e.x, e.y, p.x, p.y, 'sight'))) {
          e.sees = true;
          if (e.state !== 'chase' && Math.random() < 0.5) SFX.play(d.alien ? 'chitter' : 'groan', 300);
          e.state = 'chase'; e.lx = p.x; e.ly = p.y; e.seenT = 6;
        }
      }
    }
    // ações travadas (ataque, grito, investida)
    if (e.lock) {
      const L = e.lock;
      L.t += dt; setAnim(e, L.anim); e.at = L.t;
      if (L.hitAt != null && !L.hit && L.t >= L.hitAt) { L.hit = true; if (L.fn) L.fn(); }
      if (L.t >= L.dur) e.lock = null;
      return;
    }
    if (e.charge > 0) {
      e.charge -= dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      const ox = e.x, oy = e.y; M.collide(e, 0.34);
      setAnim(e, 'run'); e.at += dt * 1.4;
      if (Math.hypot(e.x - ox, e.y - oy) > 0.05) { e.charge = 0; e.lock = { anim: 'hurt', t: 0, dur: 0.9 }; G.shake = 0.2; SFX.play('bang'); }
      if (dist < 1.1 && !p.dead) { e.charge = 0; hurtPlayer(d.dmg, d.cont); p.x += e.vx * 0.25; p.y += e.vy * 0.25; M.collide(p, 0.26); G.shake = 0.4; }
      return;
    }
    let tx = null, ty = null, sp = 0;
    if (e.state === 'chase') {
      e.seenT -= dt;
      // especiais
      if (e.sees && !p.dead) {
        if (d.scream && e.spCd <= 0 && dist < 14) { e.spCd = 24; e.dir = CR.dirFromVec(dx, dy); e.lock = { anim: 'cast', t: 0, dur: 1.5, hitAt: 0.3, fn: () => scream(e) }; return; }
        if (d.charge && e.spCd <= 0 && dist < 9 && dist > 2.5) { e.spCd = 6; const l2 = dist || 1; e.vx = (dx / l2) * 5.2; e.vy = (dy / l2) * 5.2; e.charge = 1.6; e.dir = CR.dirFromVec(dx, dy); SFX.play('groan'); return; }
        if (d.ranged && e.spCd <= 0 && dist < 10 && dist > 2.2) { e.spCd = 2.8; e.dir = CR.dirFromVec(dx, dy); e.lock = { anim: 'cast', t: 0, dur: 0.8, hitAt: 0.45, fn: () => spit(e) }; return; }
        if (d.beam && e.spCd <= 0 && dist < 11) { e.spCd = 3.2; e.dir = CR.dirFromVec(dx, dy); e.lock = { anim: 'cast', t: 0, dur: 1.0, hitAt: 0.6, fn: () => beam(e) }; return; }
        if (d.leap && e.spCd <= 0 && dist < 3.2 && dist > 1.2) { e.spCd = 2.5; e.kx = (dx / dist) * 9; e.ky = (dy / dist) * 9; e.dir = CR.dirFromVec(dx, dy); e.lock = { anim: 'attack', t: 0, dur: 0.45, hitAt: 0.25, fn: () => { if (Math.hypot(p.x - e.x, p.y - e.y) < 1.2) hurtPlayer(d.dmg, d.cont); } }; return; }
        if (d.bloat && dist < 1.5) { e.lock = { anim: 'cast', t: 0, dur: 0.6, hitAt: 0.55, fn: () => { killEnemy(e, 'blast'); } }; return; }
      }
      if (!p.dead && dist < (d.ranged ? 1.2 : 1.05) && e.atkCd <= 0 && M.los(e.x, e.y, p.x, p.y, 'move')) {
        e.dir = CR.dirFromVec(dx, dy);
        e.atkCd = 1.1 + Math.random() * 0.4;
        e.lock = { anim: 'attack', t: 0, dur: 0.62, hitAt: 0.34, fn: () => { if (Math.hypot(p.x - e.x, p.y - e.y) < 1.3) hurtPlayer(d.dmg * (0.85 + Math.random() * 0.3), d.cont); } };
        return;
      }
      sp = (e.sees || e.seenT > 0 ? d.run : d.walk);
      if (d.ranged && e.sees && dist < 5) sp = -d.walk;
      if (e.sees && dist < 14 && M.los(e.x, e.y, p.x, p.y, 'move')) { tx = p.x; ty = p.y; e.path = null; }
      else {
        e.pathT -= dt;
        if ((!e.path || e.pathT <= 0) && G.pathBudget > 0) { G.pathBudget--; e.path = M.path(e.x, e.y, e.lx, e.ly, true, 1600) || []; e.pathT = 1.2 + Math.random() * 0.8; }
        if (e.path) {
          while (e.path.length && Math.hypot(e.path[0][0] - e.x, e.path[0][1] - e.y) < 0.35) e.path.shift();
          if (e.path.length) {
            const [nx, ny] = e.path[0];
            const ob = obstacleBetween(e.x, e.y, nx, ny);
            if (ob) { e.dir = CR.dirFromVec(nx - e.x, ny - e.y); e.lock = { anim: 'attack', t: 0, dur: 0.75, hitAt: 0.4, fn: () => hitObstacle(e, ob) }; return; }
            tx = nx; ty = ny;
          } else if (Math.hypot(e.lx - e.x, e.ly - e.y) > 0.5) { tx = e.lx; ty = e.ly; }
          else if (e.seenT <= 0) { e.state = 'wander'; e.wanderT = 0; }
        }
      }
    } else {
      e.wanderT -= dt;
      if (e.wanderT <= 0) {
        e.wanderT = 3 + Math.random() * 7;
        if (Math.random() < 0.45) { e.tx = e.x; e.ty = e.y; }
        else { const s = freeSpot(e.x, e.y, 1, 5); if (s && M.los(e.x, e.y, s[0], s[1], 'move')) { e.tx = s[0]; e.ty = s[1]; } }
      }
      if (Math.hypot(e.tx - e.x, e.ty - e.y) > 0.3) { tx = e.tx; ty = e.ty; sp = d.walk * 0.55; }
    }
    if (tx != null) {
      const vx = tx - e.x, vy = ty - e.y, vl = Math.hypot(vx, vy) || 1;
      e.x += (vx / vl) * sp * dt; e.y += (vy / vl) * sp * dt;
      e.dir = CR.dirFromVec(sp < 0 ? -vx : vx, sp < 0 ? -vy : vy);
      if (sp < 0) e.dir = CR.dirFromVec(dx, dy);
      setAnim(e, Math.abs(sp) > 2 ? 'run' : 'walk');
      e.at += dt * (Math.abs(sp) > 2 ? 1 : 0.55 + Math.abs(sp) * 0.4);
    } else { setAnim(e, 'idle'); e.at += dt; }
    M.collide(e, e.type === 'inf_brutamonte' ? 0.36 : 0.28);
  }
  function scream(e) {
    SFX.play('scream'); G.shake = 0.25;
    say('Um Gritador chamou a horda!', 'bad');
    noise(e.x, e.y, 32);
    for (let k = 0; k < 5; k++) { const s = freeSpot(G.p.x, G.p.y, 12, 18, true); if (s) spawnEnemy(rollInfected(Math.random()), s[0], s[1], { chase: true }); }
  }
  function spit(e) {
    const p = G.p, dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
    SFX.play('spit');
    G.projs.push({ k: 'bolt', x: e.x + dx / l * 0.6, y: e.y + dy / l * 0.6, z: 1.6, vx: dx / l * 8, vy: dy / l * 8, vz: 0, t: 0, owner: e });
  }
  function beam(e) {
    const p = G.p;
    if (!G.map.los(e.x, e.y, p.x, p.y, 'sight') || Math.hypot(p.x - e.x, p.y - e.y) > 12) return;
    G.fx.push({ k: 'beam', x0: e.x, y0: e.y, x1: p.x, y1: p.y, t: 0.35 });
    SFX.play('hum');
    hurtPlayer(6, 0, true);
    p.sanity = Math.max(0, p.sanity - 12);
  }
  function obstacleBetween(x, y, nx, ny) {
    const M = G.map;
    const i = Math.floor(x), j = Math.floor(y), ni = Math.floor(nx), nj = Math.floor(ny);
    if (i === ni && j === nj) return null;
    const pr = M.prop(ni, nj);
    if (pr && !pr.dead && PROPS.D[pr.type].built && Math.hypot(nx - x, ny - y) < 1.4) return { prop: pr };
    if (Math.abs(ni - i) + Math.abs(nj - j) !== 1) return null;
    let side, ei, ej;
    if (ni > i) { side = 'W'; ei = ni; ej = j; } else if (ni < i) { side = 'W'; ei = i; ej = j; } else if (nj > j) { side = 'N'; ei = i; ej = nj; } else { side = 'N'; ei = i; ej = j; }
    if (M.edge(ei, ej, side, 'move') && M['w' + side][ej * N + ei] === WORLD.W.DOOR) {
      const ex = side === 'N' ? ei + 0.5 : ei, ey = side === 'N' ? ej : ej + 0.5;
      if (Math.hypot(ex - x, ey - y) < 0.8) return { door: side, i: ei, j: ej };
    }
    return null;
  }
  function hitObstacle(e, ob) {
    const M = G.map;
    SFX.play('bang', 120); noise(e.x, e.y, 5);
    if (ob.prop) { damageProp(ob.prop, EN[e.type].dmg * 1.2, 'melee'); }
    else {
      const k = ob.j * N + ob.i;
      M['whp' + ob.door][k] -= EN[e.type].dmg;
      if (M['whp' + ob.door][k] <= 0) { M['wst' + ob.door][k] = 2; if (Math.hypot(G.p.x - e.x, G.p.y - e.y) < 20) say('Uma porta foi arrombada!', 'bad'); }
    }
  }
  function separate() {
    const es = G.enemies, p = G.p;
    for (let a = 0; a < es.length; a++) {
      const A = es[a]; if (A.dead || A.lod) continue;
      for (let b = a + 1; b < es.length; b++) {
        const B = es[b]; if (B.dead || B.lod) continue;
        const dx = B.x - A.x, dy = B.y - A.y;
        if (dx > 0.6 || dx < -0.6 || dy > 0.6 || dy < -0.6) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.3 && d2 > 1e-6) { const dd = Math.sqrt(d2), k = (0.55 - dd) / 2 / dd; A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k; }
      }
      const dx = p.x - A.x, dy = p.y - A.y, d2 = dx * dx + dy * dy;
      if (!p.dead && d2 < 0.3 && d2 > 1e-6) { const dd = Math.sqrt(d2), k = (0.55 - dd) / dd; A.x -= dx * k; A.y -= dy * k; }
    }
  }

  // ---------- mundo ----------
  function updateWorld(dt) {
    const p = G.p, M = G.map;
    const prevDay = Math.floor(G.time / 24);
    G.time += dt / 60;
    if (Math.floor(G.time / 24) !== prevDay) { G.day++; G.rain = Math.random() < 0.4 ? 1 : 0; say(`Dia ${G.day}. Os ninhos estão mais ativos.`, 'warn'); }
    if (Math.random() < dt / 400) G.rain = G.rain ? 0 : (Math.random() < 0.35 ? 1 : 0);
    // Floração
    const B = G.bloom;
    if (B.active > 0) { B.active -= dt; if (B.active <= 0) say('A Floração passou. Por enquanto.', 'good'); }
    else {
      B.t -= dt;
      if (B.t < 15 && !B.warned) { B.warned = true; UI.banner('A FLORAÇÃO ESTÁ COMEÇANDO'); SFX.play('bloom'); say('Procure abrigo ou coloque a máscara!', 'bad'); }
      if (B.t <= 0) {
        B.active = 70; B.warned = false; B.t = 300 + Math.random() * 160;
        const n = 14 + G.day * 4;
        const a0 = Math.random() * Math.PI * 2;
        for (let k = 0; k < n; k++) { const s = freeSpot(p.x + Math.cos(a0) * 24, p.y + Math.sin(a0) * 24, 0, 8, true); if (s) spawnEnemy(k % 6 === 5 ? rollAlien(Math.random()) : rollInfected(Math.random()), s[0], s[1], { chase: true }); }
        for (let k = 0; k < 6; k++) { const s = freeSpot(p.x, p.y, 4, 14, true); if (s) sporeCloud(s[0], s[1], 2.5, 20); }
      }
    }
    // ninhos geram hospedeiros
    const night = darkness() > 0.6;
    for (const nest of M.nests) {
      if (nest.dead) continue;
      const dd = Math.hypot(nest.x - p.x, nest.y - p.y);
      if (dd > 38) continue;
      nest.spawnT = (nest.spawnT == null ? 10 + Math.random() * 20 : nest.spawnT) - dt;
      if (nest.spawnT <= 0) {
        nest.spawnT = (night ? 22 : 34) + Math.random() * 18 - G.day * 2;
        const local = G.enemies.filter((e) => !e.dead && Math.hypot(e.x - nest.x, e.y - nest.y) < 8).length;
        if (local < 7 && dd > 6) {
          const s = freeSpot(nest.x, nest.y, 1.5, 3);
          if (s) { spawnEnemy(night && Math.random() < 0.35 ? rollAlien(Math.random()) : rollInfected(Math.random()), s[0], s[1], { chase: dd < 14 }); }
        }
      }
    }
    // população
    G.spawnT -= dt;
    const alive = G.enemies.filter((e) => !e.dead).length;
    const target = Math.min(240, 150 + G.day * 12 + (night ? 30 : 0));
    if (G.spawnT <= 0 && alive < target) {
      G.spawnT = 1.5;
      const s = freeSpot(p.x, p.y, 26, 44);
      if (s) {
        if (night && Math.random() < 0.25) { const t = rollAlien(Math.random()); const n = t === 'al_rastejador' ? 3 : 1; for (let k = 0; k < n; k++) spawnEnemy(t, s[0] + k * 0.3, s[1]); }
        else spawnEnemy(rollInfected(Math.random()), s[0], s[1]);
      }
    }
    G.enemies = G.enemies.filter((e) => !(e.dead && (e.gone || e.deadT > 70)) && !(Math.hypot(e.x - p.x, e.y - p.y) > 75 && !e.dead && Math.random() < dt * 0.2));
    // projéteis
    for (const q of G.projs) {
      q.t += dt;
      if (q.k === 'bolt') {
        const ox = q.x, oy = q.y;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (!M.los(ox, oy, q.x, q.y, 'shot') || q.t > 2) { q.done = true; sporeCloud(q.x, q.y, 1, 2); continue; }
        if (Math.hypot(p.x - q.x, p.y - q.y) < 0.5 && !p.dead) { hurtPlayer(EN.al_arauto.dmg * 0.6, 12); q.done = true; sporeCloud(q.x, q.y, 1.2, 3); }
        continue;
      }
      if (!q.landed) {
        const ox = q.x, oy = q.y;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 14 * dt;
        if (!M.los(ox, oy, q.x, q.y, 'shot')) { q.x = ox; q.y = oy; q.vx *= -0.3; q.vy *= -0.3; }
        if (q.z <= 0) {
          q.z = 0; q.landed = true;
          if (q.k === 'molotov') { q.done = true; SFX.play('glass'); explode(q.x, q.y, ITEMS.molotov.fire, 25, { fire: 1 }); }
        }
      } else if (q.k === 'granada') {
        q.fuse -= dt;
        if (q.fuse <= 0) { q.done = true; explode(q.x, q.y, ITEMS.granada.blast, ITEMS.granada.dmg, { fire: 0 }); }
      }
      if (q.k === 'granada' && !q.landed) q.fuse -= dt;
    }
    G.projs = G.projs.filter((q) => !q.done);
    // fogo
    for (const f of G.fires) {
      f.t -= dt; f.tick -= dt;
      if (Math.random() < dt * 20 * f.r) G.fx.push({ k: 'flame', wx: f.x + (Math.random() - 0.5) * f.r * 1.6, wy: f.y + (Math.random() - 0.5) * f.r * 1.6, vx: 0, vy: 0, t: 0.6, t0: 0.6, rise: 1 });
      if (f.tick <= 0) {
        f.tick = 0.35;
        for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - f.x, e.y - f.y) < f.r) { hurtEnemy(e, 5, 0, 0, 0, 'fire'); e.burn = 2; }
        if (Math.hypot(p.x - f.x, p.y - f.y) < f.r) hurtPlayer(4, 0, true);
        for (let j = Math.floor(f.y - f.r); j <= Math.floor(f.y + f.r); j++) for (let i = Math.floor(f.x - f.r); i <= Math.floor(f.x + f.r); i++) {
          const pr = M.prop(i, j);
          if (pr && !pr.dead && pr.maxhp) damageProp(pr, 8, 'fire');
          else if (pr && !pr.dead && ['cogumelos', 'casulo', 'pilar_fungico'].includes(pr.type)) destroyProp(pr);
        }
      }
    }
    G.fires = G.fires.filter((f) => f.t > 0);
    for (const c of G.clouds) { c.t -= dt; if (Math.random() < dt * 8 * c.r) { const [sx, sy] = iso(c.x + (Math.random() - 0.5) * c.r * 2, c.y + (Math.random() - 0.5) * c.r * 2); G.fx.push({ k: 'p', x: sx, y: sy - 10, vx: (Math.random() - 0.5) * 8, vy: -12, g: 0, t: 1.4, c: Math.random() < 0.5 ? '#d06aff' : '#7ff7e5', s: 1, glow: 1 }); } }
    G.clouds = G.clouds.filter((c) => c.t > 0);
    for (const f of G.fx) {
      f.t -= dt;
      if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; }
      else if (f.k === 'flame') { f.wx += f.vx * dt; f.wy += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; }
    }
    G.fx = G.fx.filter((f) => f.t > 0);
    for (const pr of G.propsFlash) { pr.hitFlash = Math.max(0, pr.hitFlash - dt); if (!pr.hitFlash) G.propsFlash.delete(pr); }
    for (const d of G.decals) d.t += dt;
    G.flash = Math.max(0, G.flash - dt); G.shake = Math.max(0, G.shake - dt);
    // partículas ambientes (esporos no ar, chuva)
    const amb = (G.bloom.active > 0 ? 40 : 4) + (M.floor[Math.floor(p.y) * N + Math.floor(p.x)] === WORLD.F.MICELIO ? 10 : 0);
    if (Math.random() < dt * amb) { const V = RENDER.V; G.fx.push({ k: 'mote', sx: Math.random() * V.w, sy: Math.random() * V.h, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 6, t: 3, t0: 3, c: Math.random() < 0.6 ? '#d06aff' : '#7ff7e5' }); }
    // salvamento automático
    G.saveT -= dt;
    if (G.saveT <= 0) { G.saveT = 60; save(); }
  }

  // ---------- visão ----------
  function computeVis() {
    const M = G.map, p = G.p;
    if (!G.vis) { G.vis = new Uint8Array(N * N); G.visList = []; }
    for (const k of G.visList) G.vis[k] = 0;
    G.visList.length = 0;
    const mark = (i, j) => { const k = j * N + i; if (!G.vis[k]) { G.vis[k] = 1; G.visList.push(k); } };
    const R = 24, rays = 420;
    for (let r = 0; r < rays; r++) {
      const a = (r / rays) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
      let pi = Math.floor(p.x), pj = Math.floor(p.y);
      mark(pi, pj);
      for (let t = 0.2; t < R; t += 0.3) {
        const x = p.x + dx * t, y = p.y + dy * t;
        const ci = Math.floor(x), cj = Math.floor(y);
        if (!M.inb(ci, cj)) break;
        if (ci !== pi && M.edge(Math.max(pi, ci), pj, 'W', 'sight')) break;
        if (cj !== pj && M.edge(ci, Math.max(pj, cj), 'N', 'sight')) break;
        mark(ci, cj); pi = ci; pj = cj;
      }
    }
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (M.inb(Math.floor(p.x) + a, Math.floor(p.y) + b)) mark(Math.floor(p.x) + a, Math.floor(p.y) + b);
  }

  // ---------- desenho das entidades ----------
  function frameOf(e, A) {
    let f = Math.floor(e.at * A.fps);
    f = A.loop ? f % A.n : Math.min(A.n - 1, f);
    if (e.lock) f = Math.min(A.n - 1, Math.floor((e.lock.t / e.lock.dur) * A.n));
    return f;
  }
  function drawEnemy(e, ctx, X, Y) {
    const p = G.p;
    const k = Math.floor(e.y) * N + Math.floor(e.x);
    const seen = G.vis && G.vis[k];
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    if (!seen && dist > 2.5 && !e.dead) return;
    if (!seen && e.dead) return;
    if (seen && dist < 16 && !e.fake) discover(e.type);
    const T = CR.TYPES[e.type];
    let anim = e.anim;
    if (!T.anims.includes(anim)) anim = anim === 'run' ? 'walk' : anim === 'cast' ? 'attack' : 'idle';
    const A = CR.ANIMS[anim];
    const alpha = e.fake != null ? 0.55 + Math.sin(performance.now() / 90) * 0.2 : e.dead && e.deadT > 60 ? Math.max(0, (70 - e.deadT) / 10) : 1;
    if (e.hitFlash > 0) ctx.filter = 'brightness(2.4) saturate(0.4)';
    else if (e.burn > 0) ctx.filter = 'sepia(0.6) brightness(1.3)';
    CR.draw(ctx, e.type, null, anim, frameOf(e, A), e.dir, X, Y, alpha);
    if (e.hitFlash > 0 || e.burn > 0) ctx.filter = 'none';
  }
  function drawPlayer(ctx, X, Y) {
    const p = G.p;
    const id = held(p);
    const A = CR.ANIMS[p.anim];
    if (p.hitFlash > 0) ctx.filter = 'brightness(2) saturate(0.5)';
    CR.draw(ctx, 'player', id, p.anim, frameOf(p, A), p.dir, X, Y);
    if (p.hitFlash > 0) ctx.filter = 'none';
  }

  // ---------- estado de render ----------
  function ambientColor() {
    const h = G.time % 24;
    const key = [[0, [52, 58, 100]], [4.5, [52, 58, 100]], [5.5, [100, 90, 140]], [6.5, [230, 175, 165]], [7.5, [255, 250, 240]], [16.5, [255, 248, 236]], [17.8, [255, 196, 140]], [19, [160, 110, 140]], [20.2, [58, 62, 106]], [24, [52, 58, 100]]];
    let a = key[0], b = key[key.length - 1];
    for (let q = 0; q < key.length - 1; q++) if (h >= key[q][0] && h < key[q + 1][0]) { a = key[q]; b = key[q + 1]; break; }
    const t = (h - a[0]) / (b[0] - a[0] || 1);
    let c = [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t];
    if (G.rain) c = c.map((v, i) => v * [0.82, 0.86, 0.92][i]);
    if (G.bloom.active > 0) { const k = Math.min(1, G.bloom.active / 5, (70 - G.bloom.active) / 5); c = [c[0] * (1 - 0.3 * k), c[1] * (1 - 0.45 * k), c[2] * (1 - 0.1 * k)]; }
    return c;
  }
  function renderState() {
    const p = G.p, M = G.map;
    const dk = darkness();
    const lights = [], glows = [];
    const act = [];
    for (const pr of G.lightProps) {
      if (pr.dead) continue;
      if (Math.abs(pr.x - p.x) > 34 || Math.abs(pr.y - p.y) > 34) continue;
      const L = pr.light, hsh = VX.hash(pr.id, 3, 7);
      if (L.glow) { glows.push({ x: pr.x, y: pr.y, h: 14, r: 18 + L.r * 3, c: L.c, a: 0.25 + dk * 0.35 }); if (dk > 0.2) lights.push({ x: pr.x, y: pr.y, r: L.r, c: L.c, i: 0.6 * dk + 0.2 }); continue; }
      if (pr.type === 'poste' || pr.type === 'luminaria' || pr.type === 'criado') {
        if (dk < 0.3) continue;
        if (pr.type === 'poste' && hsh < 0.18) continue;
        if (pr.type !== 'poste' && hsh > 0.45) continue;
        let i = dk;
        if (hsh > 0.9) i *= 0.4 + 0.6 * (Math.sin(performance.now() / 70 + pr.id) > 0.3 ? 1 : 0.2);
        let lx = pr.x, ly = pr.y;
        if (pr.type === 'poste') { const off = [[0, 0.6], [0.6, 0], [0, -0.6], [-0.6, 0]][pr.rot]; lx += off[0]; ly += off[1]; }
        lights.push({ x: lx, y: ly, r: L.r, c: L.c, i }); act.push({ x: lx, y: ly, r: L.r });
        glows.push({ x: lx, y: ly, h: pr.type === 'poste' ? 120 : 40, r: 10, c: L.c, a: 0.5 * dk });
        continue;
      }
      if (pr.type === 'fogueira') { const fl = 0.85 + Math.random() * 0.15; lights.push({ x: pr.x, y: pr.y, r: L.r * fl, c: L.c, i: 0.7 + dk * 0.5 }); act.push({ x: pr.x, y: pr.y, r: L.r }); glows.push({ x: pr.x, y: pr.y, h: 8, r: 14, c: [255, 150, 60], a: 0.7 }); if (Math.random() < 0.4) G.fx.push({ k: 'flame', wx: pr.x + (Math.random() - 0.5) * 0.4, wy: pr.y + (Math.random() - 0.5) * 0.4, vx: 0, vy: 0, t: 0.5, t0: 0.5, rise: 1 }); continue; }
      if (hsh < 0.6 && dk > 0.2) lights.push({ x: pr.x, y: pr.y, r: L.r, c: L.c, i: 0.5 * dk + 0.1 });
    }
    G.activeLights = act;
    for (const f of G.fires) { lights.push({ x: f.x, y: f.y, r: 3 + f.r * 2.5, c: [255, 150, 60], i: 0.9 }); glows.push({ x: f.x, y: f.y, h: 10, r: 10 + f.r * 8, c: [255, 140, 50], a: 0.5 }); }
    for (const fx of G.fx) {
      if (fx.k === 'expl') { const t = fx.t / fx.t0; lights.push({ x: fx.x, y: fx.y, r: fx.r * 4 * t, c: fx.spores ? [200, 90, 255] : [255, 180, 90], i: 1.2 * t }); }
      if (fx.k === 'muzzle') { lights.push({ x: fx.x, y: fx.y, r: 4, c: [255, 210, 120], i: 1 }); glows.push({ x: fx.x, y: fx.y, h: 46, r: 9, c: [255, 220, 140], a: 1 }); }
    }
    for (const e of G.enemies) {
      if (e.dead || Math.abs(e.x - p.x) > 30 || Math.abs(e.y - p.y) > 30) continue;
      if (!G.vis || !G.vis[Math.floor(e.y) * N + Math.floor(e.x)]) continue;
      if (EN[e.type].alien || dk > 0.4) {
        const c = e.type === 'al_vigia' ? [255, 90, 120] : EN[e.type].alien ? [110, 240, 255] : (e.type.includes('2') || e.type === 'inf_cientista' || e.type === 'inf_inchado' || e.type === 'inf_brutamonte') ? [120, 250, 230] : [220, 100, 255];
        glows.push({ x: e.x, y: e.y, h: e.type === 'al_vigia' ? 70 : 52, r: 6 + (EN[e.type].alien ? 6 : 0), c, a: 0.25 + dk * 0.4 });
        if (dk > 0.4) lights.push({ x: e.x, y: e.y, r: 1.4, c, i: 0.35 });
      }
    }
    for (const q of G.projs) if (q.k === 'bolt') glows.push({ x: q.x, y: q.y, h: 40, r: 10, c: [140, 255, 200], a: 0.9 });
    if (dk > 0.15 && !p.dead) lights.push({ x: p.x, y: p.y, r: 2.2, c: [120, 120, 150], i: 0.5 * dk });
    let cone = null;
    if (p.flash && !p.dead && count(p.inv, 'lanterna') > 0) {
      const [ax, ay] = aimVec(p);
      const sdx = (ax - ay) * (WORLD.TW / 2), sdy = (ax + ay) * (WORLD.TH / 2), sl = Math.hypot(sdx, sdy);
      cone = { x: p.x, y: p.y, ang: Math.atan2(sdy / sl, sdx / sl), w: 0.42, len: 230 };
      lights.push({ x: p.x + ax * 5, y: p.y + ay * 5, r: 4, c: [255, 245, 220], i: 0.6 * dk });
    }
    if (G.flash > 0) lights.push({ x: p.x, y: p.y, r: 8, c: [255, 220, 160], i: 1 });
    const ents = [{ x: p.x, y: p.y, draw: drawPlayer }];
    for (const e of G.enemies) if (Math.abs(e.x - p.x) < 34 && Math.abs(e.y - p.y) < 34) ents.push(e);
    return {
      map: M, player: ents[0], ents, decals: G.decals, shake: G.shake,
      sun: 1 - dk, ambient: ambientColor(), lights, glows, cone, vis: G.vis,
      fogAlpha: 0.42 + dk * 0.25, budgetLeft: () => G.frameBudget - (now() - G.frameStart),
      groundFx: drawGroundFx, overFx: drawOverFx, post: drawPost, noCut: false,
    };
  }

  // efeitos no chão (marcador de construção, fogo base, nuvens baixas)
  function drawGroundFx(ctx, ox, oy) {
    const p = G.p;
    const id = held(p);
    if (id && ITEMS[id].kind === 'place' && !p.dead) {
      const t = placeTarget();
      const [sx, sy] = iso(t.i, t.j);
      ctx.strokeStyle = t.ok ? 'rgba(120,255,160,0.9)' : 'rgba(255,90,90,0.9)';
      ctx.beginPath(); ctx.moveTo(sx + ox + 0.5, sy + oy + 0.5); ctx.lineTo(sx + ox + 24.5, sy + oy + 12.5); ctx.lineTo(sx + ox + 0.5, sy + oy + 24.5); ctx.lineTo(sx + ox - 23.5, sy + oy + 12.5); ctx.closePath(); ctx.stroke();
    }
    for (const f of G.fires) {
      const [sx, sy] = iso(f.x, f.y);
      ctx.fillStyle = 'rgba(30,14,8,0.35)';
      ctx.beginPath(); ctx.ellipse(sx + ox, sy + oy, f.r * 24, f.r * 12, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  const explFrames = [];
  function explSprite(k) {
    if (explFrames[k]) return explFrames[k];
    const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'); const img = x.createImageData(S, S); const U = new Uint32Array(img.data.buffer);
    const t = k / 7;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const dx = (px - S / 2) / (S / 2), dy = (py - S / 2) / (S / 2) * 1.4;
      const r = Math.hypot(dx, dy) + (VX.vnoise(px * 0.15, py * 0.15, k * 0.7) - 0.5) * 0.5;
      const R = 0.35 + t * 0.6;
      if (r > R) continue;
      const q = r / R;
      let col;
      if (t > 0.55 && VX.vnoise(px * 0.2, py * 0.2, k) > 0.45 - t * 0.2) col = q > 0.6 ? [70, 66, 64] : [100, 96, 92];
      else col = q < 0.3 - t * 0.2 ? [255, 250, 200] : q < 0.6 ? [255, 190, 70] : q < 0.85 ? [230, 100, 30] : [120, 50, 30];
      const a = t > 0.75 ? Math.round(255 * (1 - (t - 0.75) * 3)) : 255;
      U[py * S + px] = (Math.max(0, a) << 24) | (col[2] << 16) | (col[1] << 8) | col[0];
    }
    x.putImageData(img, 0, 0);
    return (explFrames[k] = c);
  }
  function drawOverFx(ctx, ox, oy) {
    const p = G.p;
    // nuvens de esporos
    for (const c of G.clouds) {
      const [sx, sy] = iso(c.x, c.y);
      const a = Math.min(1, c.t / 2) * Math.min(1, (c.t0 - c.t) / 0.5);
      ctx.globalAlpha = 0.35 * a;
      const g = RENDER.glowSprite(170, 80, 220, 48);
      ctx.drawImage(g, sx + ox - c.r * 26, sy + oy - c.r * 16 - 10, c.r * 52, c.r * 30);
      ctx.globalAlpha = 1;
    }
    // projéteis
    for (const q of G.projs) {
      const [sx, sy] = iso(q.x, q.y);
      if (q.k === 'bolt') { ctx.fillStyle = '#9dffd0'; ctx.fillRect(Math.round(sx + ox) - 2, Math.round(sy + oy - 46) - 2, 4, 4); continue; }
      const y = sy + oy - q.z * 30;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(sx + ox) - 2, Math.round(sy + oy) - 1, 4, 2);
      ctx.fillStyle = q.k === 'molotov' ? '#3f8a4a' : '#55642f'; ctx.fillRect(Math.round(sx + ox) - 2, Math.round(y) - 2, 4, 4);
      if (q.k === 'molotov') { ctx.fillStyle = '#ffb43a'; ctx.fillRect(Math.round(sx + ox) - 1, Math.round(y) - 4, 2, 2); }
      if (q.k === 'granada' && q.landed && Math.floor(q.fuse * 6) % 2) { ctx.fillStyle = '#ff4030'; ctx.fillRect(Math.round(sx + ox) - 1, Math.round(y) - 3, 2, 1); }
    }
    for (const f of G.fx) {
      if (f.k === 'p') {
        ctx.fillStyle = f.c;
        if (f.glow) ctx.globalCompositeOperation = 'lighter';
        ctx.fillRect(Math.round(f.x + ox), Math.round(f.y + oy), f.s || 2, f.s || 2);
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.k === 'tracer') {
        const [a, b] = iso(f.x0, f.y0), [c, d] = iso(f.x1, f.y1);
        ctx.strokeStyle = 'rgba(255,230,140,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a + ox, b + oy - 46); ctx.lineTo(c + ox, d + oy - 42); ctx.stroke();
      } else if (f.k === 'beam') {
        const [a, b] = iso(f.x0, f.y0), [c, d] = iso(f.x1, f.y1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,80,160,${f.t * 2.5})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a + ox, b + oy - 70); ctx.lineTo(c + ox, d + oy - 40); ctx.stroke();
        ctx.lineWidth = 1; ctx.globalCompositeOperation = 'source-over';
      } else if (f.k === 'num') {
        const [a, b] = iso(f.x, f.y);
        ctx.font = '8px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(f.v, Math.round(a + ox) + 1, Math.round(b + oy - 70 - (0.8 - f.t) * 24) + 1);
        ctx.fillStyle = f.c; ctx.fillText(f.v, Math.round(a + ox), Math.round(b + oy - 70 - (0.8 - f.t) * 24));
      } else if (f.k === 'expl') {
        const [a, b] = iso(f.x, f.y);
        const k = Math.min(7, Math.floor((1 - f.t / f.t0) * 8));
        const s = explSprite(k), sz = f.r * 30;
        if (f.spores) ctx.filter = 'hue-rotate(220deg) saturate(1.5)';
        ctx.drawImage(s, Math.round(a + ox - sz), Math.round(b + oy - sz * 1.1), Math.round(sz * 2), Math.round(sz * 2));
        ctx.filter = 'none';
      } else if (f.k === 'flame') {
        const [a, b] = iso(f.wx, f.wy);
        const t = f.t / f.t0, rise = f.rise ? (1 - t) * 26 : 0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = t > 0.6 ? '#fff0a0' : t > 0.3 ? '#ff9a30' : '#a83a18';
        const s = Math.max(1, Math.round(4 * t + 1));
        ctx.fillRect(Math.round(a + ox - s / 2), Math.round(b + oy - 8 - rise - (1 - t) * 10), s, s);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // mira laser ao mirar
    if (p.aim && !p.dead) {
      const [ax, ay, dl] = aimVec(p);
      const [a, b] = iso(p.x + ax * 0.5, p.y + ay * 0.5), [c, d] = iso(p.x + ax * Math.min(dl, 16), p.y + ay * Math.min(dl, 16));
      ctx.strokeStyle = 'rgba(255,40,40,0.5)'; ctx.beginPath(); ctx.moveTo(a + ox, b + oy - 46); ctx.lineTo(c + ox, d + oy - 40); ctx.stroke();
    }
  }
  function drawPost(ctx, V) {
    const p = G.p;
    // partículas de esporos no ar e chuva (espaço de tela)
    ctx.globalCompositeOperation = 'lighter';
    for (const f of G.fx) if (f.k === 'mote') { f.sx += f.vx / 60; f.sy += f.vy / 60; ctx.fillStyle = f.c; ctx.globalAlpha = Math.min(1, f.t / f.t0 * 2) * 0.7; ctx.fillRect(Math.round(f.sx), Math.round(f.sy), 1, 1); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (G.rain) {
      ctx.strokeStyle = 'rgba(170,190,220,0.35)';
      ctx.beginPath();
      const t = performance.now() / 1000;
      for (let k = 0; k < 160; k++) { const x = ((VX.hash(k, 1, 2) * V.w + t * 40) % V.w), y = ((VX.hash(k, 2, 3) * V.h + t * 520) % V.h); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 7); }
      ctx.stroke();
    }
    if (G.bloom.active > 0) { const k = Math.min(1, G.bloom.active / 5, (70 - G.bloom.active) / 5); ctx.fillStyle = `rgba(120,40,160,${0.16 * k})`; ctx.fillRect(0, 0, V.w, V.h); }
    // vinheta, contaminação e sanidade
    const vg = ctx.createRadialGradient(V.w / 2, V.h / 2, V.h * 0.3, V.w / 2, V.h / 2, V.h * 0.85);
    const ins = Math.max(0, (50 - p.sanity) / 50), con = Math.max(0, (p.contam - 50) / 50), low = Math.max(0, (35 - p.hp) / 35);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(${Math.round(60 * low + 40 * ins)},${Math.round(30 * con)},${Math.round(40 * ins)},${0.45 + 0.35 * Math.max(ins, con, low)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, V.w, V.h);
    if (ins > 0.4 && Math.random() < ins * 0.04) { ctx.fillStyle = `rgba(200,60,255,${ins * 0.12})`; ctx.fillRect(0, 0, V.w, V.h); }
    if (p.hitFlash > 0) { ctx.fillStyle = `rgba(160,0,0,${p.hitFlash})`; ctx.fillRect(0, 0, V.w, V.h); }
    // mira do mouse
    if (!isTouch && G.mouse.inside && !G.uiOpen && !p.dead) {
      const mx = Math.round(G.mouse.sx), my = Math.round(G.mouse.sy);
      ctx.fillStyle = 'rgba(235,240,230,0.9)';
      ctx.fillRect(mx - 5, my, 3, 1); ctx.fillRect(mx + 3, my, 3, 1); ctx.fillRect(mx, my - 5, 1, 3); ctx.fillRect(mx, my + 3, 1, 3);
    }
  }

  // ---------- laço ----------
  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    G.frameStart = now();
    G.frameBudget = G.state === 'play' ? 9 : 14;
    CR.setBudget(5); PROPS.setBudget(4); WORLD.setWallBudget(4);
    if (G.state === 'play' && !G.paused) {
      G.pathBudget = 6;
      updatePlayer(dt);
      const p = G.p;
      for (const e of G.enemies) {
        const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
        e.lod = d > 70 ? 1 : 0;
        if (e.lod) { e.lodT = (e.lodT || 0) + dt; if (e.lodT < 0.5) continue; updateEnemy(e, e.lodT); e.lodT = 0; }
        else updateEnemy(e, dt);
      }
      separate();
      updateWorld(dt);
      G.visT -= dt;
      if (G.visT <= 0) { G.visT = 0.1; computeVis(); }
    }
    if (G.state === 'play' || G.state === 'dead' || G.state === 'end') {
      RENDER.frame(renderState());
      UI.hud(dt);
      SFX.setAmbience(0.5 + darkness() * 0.5, G.rain);
      const left = G.frameBudget - (now() - G.frameStart);
      if (left > 1) CR.work(Math.min(4, left));
    }
    requestAnimationFrame(frame);
  }

  function newGame(seed, saved, prebuilt) {
    G.map = prebuilt || new WORLD.Map(seed != null ? seed : (Math.random() * 1e9) | 0);
    G.baseProps = G.map.props.length; G.propsFlash = new Set();
    G.p = newPlayer();
    G.enemies = []; G.fx = []; G.decals = []; G.clouds = []; G.fires = []; G.projs = []; G.placed = [];
    G.kills = 0; G.time = 7.5; G.day = 1; G.bloom = { t: 330, active: 0, warned: false }; G.rain = 0; G.vis = null;
    G.codex = {}; G.lore = { diario: 0, tomo: 0 }; G.readLogs = []; G.nestsDead = 0; G.nestsTotal = G.map.nests.length;
    G.lightProps = G.map.props.filter((pr) => pr.light);
    if (saved) applySave(saved);
    const p = G.p;
    for (let k = 0; k < 190; k++) {
      const s = freeSpot(p.x, p.y, 16, 140);
      if (!s) continue;
      if (Math.random() < 0.06) { const t = rollAlien(Math.random()); spawnEnemy(t, s[0], s[1]); if (t === 'al_rastejador') { spawnEnemy(t, s[0] + 0.4, s[1]); spawnEnemy(t, s[0], s[1] + 0.4); } }
      else spawnEnemy(rollInfected(Math.random()), s[0], s[1]);
    }
    RENDER.V.cam.x = iso(p.x, p.y)[0]; RENDER.V.cam.y = iso(p.x, p.y)[1] - 30;
    G.state = 'play'; G.uiOpen = false; G.paused = false;
    computeVis();
    CR.prefetch('player', held(p), ['idle', 'walk', 'run']);
    for (const t of Object.keys(EN)) CR.prefetch(t, null, ['walk', 'idle']);
    UI.refresh();
    if (!saved) { say('Você acorda no Instituto Hélio. Algo caiu do céu.', ''); setTimeout(() => say('Leia o Diário de Pesquisa (inventário) para entender o que aconteceu.', 'lore'), 3500); }
  }

  // ---------- salvar ----------
  const SAVE_KEY = 'zonazero_save_v2';
  function save() {
    if (G.state !== 'play' || !G.p || G.p.dead) return;
    const M = G.map;
    const data = {
      seed: M.seed, time: G.time, day: G.day, kills: G.kills, codex: G.codex, lore: G.lore, readLogs: G.readLogs,
      p: { x: G.p.x, y: G.p.y, hp: G.p.hp, hunger: G.p.hunger, thirst: G.p.thirst, contam: G.p.contam, sanity: G.p.sanity, filter: G.p.filter, forbidden: G.p.forbidden, inv: G.p.inv.slots, equip: G.p.equip, hot: G.p.hot },
      dead: M.props.filter((q) => q.dead && q.id < G.baseProps).map((q) => q.id),
      opened: M.props.filter((q) => q.items && q.id < G.baseProps).map((q) => [q.id, q.items.slots]),
      placed: G.placed,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* armazenamento indisponível */ }
  }
  function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ok */ } }
  function applySave(s) {
    const M = G.map, p = G.p;
    G.baseProps = M.props.length;
    Object.assign(p, { x: s.p.x, y: s.p.y, hp: s.p.hp, hunger: s.p.hunger, thirst: s.p.thirst, contam: s.p.contam, sanity: s.p.sanity, filter: s.p.filter, forbidden: s.p.forbidden || 0, hot: s.p.hot });
    p.inv.slots = s.p.inv; p.equip = s.p.equip;
    G.time = s.time; G.day = s.day; G.kills = s.kills; G.codex = s.codex || {}; G.lore = s.lore || { diario: 0, tomo: 0 }; G.readLogs = s.readLogs || [];
    for (const id of s.dead || []) { const q = M.props[id]; if (q && !q.dead) { M.removeProp(q); if (PROPS.D[q.type].nest) G.nestsDead++; } }
    for (const [id, slots] of s.opened || []) { const q = M.props[id]; if (q) q.items = { name: q.name, slots }; }
    for (const pl of s.placed || []) { const q = M.addProp(pl.type, pl.i, pl.j, { rot: pl.rot }); if (q) G.placed.push(pl); }
  }

  // ---------- entrada ----------
  function bindInput(canvas) {
    window.addEventListener('keydown', (e) => {
      if (G.state !== 'play') return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      G.keys[e.code] = true;
      const c = e.code;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (e.repeat) return;
      if (c === 'Tab' || c === 'KeyI') UI.toggleInv();
      else if (c === 'Escape') { if (G.uiOpen || UI.anyModal()) UI.closeAll(); else UI.togglePause(); }
      else if (c === 'KeyE') interact();
      else if (c === 'Space') tryAttack(true);
      else if (c === 'KeyC' || c === 'ControlLeft') G.p.crouch = !G.p.crouch;
      else if (c === 'KeyF') { if (count(G.p.inv, 'lanterna')) { G.p.flash = !G.p.flash; SFX.play('click'); } else say('Você não tem lanterna.', 'warn'); }
      else if (c === 'KeyR') reload();
      else if (c === 'KeyB') place();
      else if (c === 'KeyJ') UI.openCodex();
      else if (c === 'KeyM') UI.toggleMap();
      else if (c === 'KeyV') UI.openViewer();
      else if (/^Digit[1-6]$/.test(c)) { G.p.hot = +c.slice(5) - 1; UI.refresh(); }
    });
    window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    window.addEventListener('blur', () => { G.keys = {}; G.mouse.down = false; G.mouse.right = false; });
    const pos = (e) => { const V = RENDER.V; G.mouse.sx = (e.clientX * V.dpr) / V.zoom; G.mouse.sy = (e.clientY * V.dpr) / V.zoom; G.mouse.inside = true; };
    canvas.addEventListener('pointermove', pos);
    canvas.addEventListener('pointerleave', () => { G.mouse.inside = false; });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || G.state !== 'play') return;
      SFX.init(); pos(e);
      if (G.uiOpen && !UI.lootOpen()) return;
      if (e.button === 0) { G.mouse.down = true; G.mouse.clicked = true; }
      else if (e.button === 2) { G.mouse.right = true; const id = held(G.p); if (id && ITEMS[id].kind === 'place') place(); }
    });
    window.addEventListener('pointerup', (e) => { if (e.button === 0) G.mouse.down = false; if (e.button === 2) G.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); RENDER.zoomBy(e.deltaY > 0 ? -1 : 1); }, { passive: false });
    window.addEventListener('resize', () => RENDER.resize());
  }

  function init() {
    const cv = document.getElementById('game');
    RENDER.init(cv);
    bindInput(cv);
    requestAnimationFrame(frame);
  }

  // pré-gera sprites para o início não engasgar
  async function preload(onProgress) {
    const jobs = [];
    jobs.push(() => { G.preMap = new WORLD.Map((Math.random() * 1e9) | 0); });
    for (const id of Object.keys(ITEMS)) jobs.push(() => ITEM_MODELS.icon(id));
    for (const a of ['idle', 'walk', 'run']) jobs.push(() => { CR.prefetch('player', 'pe_de_cabra', [a]); CR.work(1e9); });
    let i = 0;
    const total = () => jobs.length + 40;
    for (; i < jobs.length; i++) { jobs[i](); onProgress((i + 1) / total()); await new Promise((r) => setTimeout(r, 0)); }
    // objetos e paredes ao redor do ponto de partida
    const M = G.preMap, [sx, sy] = M.spawn;
    const near = M.props.filter((pr) => Math.abs(pr.x - sx) < 26 && Math.abs(pr.y - sy) < 26);
    const keys = new Set();
    for (const pr of near) keys.add(pr.type + ':' + pr.v + ':' + pr.rot);
    const arr = [...keys];
    for (let q = 0; q < arr.length; q++) {
      const [t, v, r] = arr[q].split(':');
      PROPS.sprite(t, +v, +r, true);
      if (q % 6 === 5) { onProgress((jobs.length + 40 * q / arr.length) / total()); await new Promise((r2) => setTimeout(r2, 0)); }
    }
    for (const B of M.buildings) if (Math.abs(B.x - sx) < 40 && Math.abs(B.y - sy) < 40) RENDER.roofSprite(M, B);
    onProgress(1);
  }

  return {
    G, EN, init, preload, newGame, isTouch, tryAttack, interact, place, reload, useItem, craft, addItem, remove, count, weight, invSize, held, heldSlot, makeC, dropItems, say, maxCarry, readLore,
    setTouch(x, y, active) { G.touch.x = x; G.touch.y = y; G.touch.active = active; },
    nearestInteract, darkness, save, loadSave, clearSave, masked, spawnEnemy, explode, destroyProp,
    startWith(saved) { const m = G.preMap; G.preMap = null; if (saved) newGame(saved.seed, saved, m && m.seed === saved.seed ? m : null); else newGame(null, null, m); },
  };
})();

'use strict';
// Loop principal: entrada, jogadora, zumbis, combate, hordas, tempo, iluminação e desenho.
const SFX = (() => {
  let ac = null, master = null;
  function init() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); } catch (e) { ac = null; }
  }
  function noise(dur, f0, f1, vol, type) {
    if (!ac) return;
    const t = ac.currentTime, n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const flt = ac.createBiquadFilter(); flt.type = type || 'lowpass'; flt.frequency.setValueAtTime(f0, t); flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master); src.start();
  }
  function tone(dur, f0, f1, vol, type) {
    if (!ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(t + dur);
  }
  const P = {
    swing: () => noise(0.15, 2500, 600, 0.25, 'bandpass'),
    hit: () => { noise(0.12, 600, 120, 0.6); tone(0.1, 160, 60, 0.3, 'square'); },
    shot: () => { noise(0.35, 4000, 200, 0.9); tone(0.15, 220, 50, 0.5, 'square'); },
    click: () => tone(0.05, 900, 700, 0.15, 'square'),
    groan: () => tone(0.6 + Math.random() * 0.4, 110 + Math.random() * 40, 70, 0.12, 'sawtooth'),
    hurt: () => { tone(0.2, 420, 180, 0.3, 'triangle'); noise(0.1, 800, 200, 0.3); },
    door: () => { tone(0.18, 140, 90, 0.25, 'square'); noise(0.1, 900, 300, 0.2); },
    pickup: () => tone(0.08, 600, 1200, 0.15, 'triangle'),
    eat: () => { noise(0.08, 1500, 500, 0.2); setTimeout(() => noise(0.08, 1500, 500, 0.2), 120); },
    build: () => { tone(0.06, 300, 200, 0.4, 'square'); setTimeout(() => tone(0.06, 300, 200, 0.4, 'square'), 140); },
    horde: () => { for (let k = 0; k < 3; k++) setTimeout(() => tone(0.5, 520, 380, 0.25, 'sawtooth'), k * 600); },
    bang: () => { noise(0.15, 400, 80, 0.5); tone(0.12, 90, 50, 0.4, 'square'); },
  };
  return { init, play: (n) => { try { P[n] && P[n](); } catch (e) { /* som é opcional */ } } };
})();

const GAME = (() => {
  const { TW, TH, WALL_H, N } = WORLD;
  const iso = WORLD.iso;
  const G = {
    state: 'loading', zoom: 3, vw: 320, vh: 200, cam: { x: 0, y: 0 },
    keys: {}, mouse: { sx: 0, sy: 0, inside: false }, touch: { x: 0, y: 0, active: false },
    time: 8, day: 1, hordeT: 240, hordeWarn: false, spawnT: 0,
    zombies: [], fx: [], decals: [], noises: [], flash: 0, shake: 0,
    paused: false, uiOpen: false, kills: 0, msg: [],
  };
  let canvas, ctx, light, lctx, shadowSpr;
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // ---------- inventário ----------
  function makeContainer(n, name) { return { name, slots: new Array(n).fill(null) }; }
  function addItem(c, id, qty, limit) {
    const def = ITEMS[id];
    const n = limit == null ? c.slots.length : limit;
    for (let i = 0; i < n && qty > 0; i++) {
      const s = c.slots[i];
      if (s && s.id === id && s.qty < def.stack) { const k = Math.min(qty, def.stack - s.qty); s.qty += k; qty -= k; }
    }
    for (let i = 0; i < n && qty > 0; i++) {
      if (!c.slots[i]) { const k = Math.min(qty, def.stack); c.slots[i] = { id, qty: k }; qty -= k; }
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

  // ---------- jogadora ----------
  function newPlayer() {
    const p = {
      x: G.map.spawn[0], y: G.map.spawn[1], dir: 0, anim: 'idle', at: 0, frame: 0,
      hp: 100, hunger: 85, thirst: 80, stamina: 100, bleed: false, crouch: false, running: false,
      lock: null, inv: makeContainer(24, 'Mochila'), equip: { head: null, body: null, back: null },
      hot: 0, flash: false, hitFlash: 0, dead: false, deadT: 0, invuln: 0,
    };
    addItem(p.inv, 'taco', 1); addItem(p.inv, 'agua', 1); addItem(p.inv, 'feijao', 1); addItem(p.inv, 'bandagem', 2); addItem(p.inv, 'lanterna', 1);
    addItem(p.inv, 'tabuas', 2); addItem(p.inv, 'pregos', 8);
    return p;
  }
  function invSize(p) { return 16 + (p.equip.back ? ITEMS[p.equip.back.id].slots : 0); }
  function held(p) {
    const s = p.inv.slots[p.hot];
    if (!s) return null;
    const k = ITEMS[s.id].kind;
    return k === 'melee' || k === 'gun' || k === 'place' ? s.id : null;
  }
  function heldModel(p) { const h = held(p); return h && ITEMS[h].model ? h : null; }
  function armor(p) { let a = 0; for (const k of ['head', 'body']) if (p.equip[k]) a += ITEMS[p.equip[k].id].armor; return Math.min(0.6, a); }
  const maxCarry = 22;

  // ---------- zumbis ----------
  function spawnZombie(x, y, opt) {
    opt = opt || {};
    const runner = opt.runner != null ? opt.runner : Math.random() < 0.08 + G.day * 0.02;
    const types = CHR.ZOMBIE_TYPES;
    const type = runner ? 'z_corredor' : types[Math.floor(Math.random() * (types.length - 1))];
    const z = {
      x, y, dir: Math.floor(Math.random() * 8), type, runner, anim: 'idle', at: Math.random() * 3, frame: 0,
      hp: runner ? 55 : 80 + Math.random() * 30, state: opt.chase ? 'chase' : 'wander', tx: x, ty: y, path: null, pathT: 0,
      lastX: opt.chase ? G.p.x : x, lastY: opt.chase ? G.p.y : y, seenT: opt.chase ? 8 : 0, lock: null, atkCd: 0, hitFlash: 0,
      dead: false, deadT: 0, kx: 0, ky: 0, groanT: 3 + Math.random() * 10, wanderT: 0, speed: runner ? 2.7 : 0.75 + Math.random() * 0.3,
    };
    G.zombies.push(z);
    return z;
  }
  function freeSpot(x, y, rmin, rmax) {
    for (let t = 0; t < 40; t++) {
      const a = Math.random() * Math.PI * 2, r = rmin + Math.random() * (rmax - rmin);
      const i = Math.floor(x + Math.cos(a) * r), j = Math.floor(y + Math.sin(a) * r);
      if (!G.map.inb(i, j) || G.map.solid(i, j)) continue;
      return [i + 0.5, j + 0.5];
    }
    return null;
  }

  // ---------- mensagens ----------
  function say(text, kind) { G.msg.push({ text, kind: kind || '', t: 4 }); UI.toast(text, kind); }
  function noise(x, y, r) {
    for (const z of G.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < r) { z.state = 'chase'; z.lastX = x + (Math.random() - 0.5); z.lastY = y + (Math.random() - 0.5); z.seenT = Math.max(z.seenT, 4); z.path = null; z.pathT = 0; }
    }
  }

  // ---------- ações da jogadora ----------
  function aimVec(p) {
    if (!isTouch && G.mouse.inside) {
      const [wx, wy] = mouseWorld();
      const dx = wx - p.x, dy = wy - p.y, l = Math.hypot(dx, dy);
      if (l > 0.2) return [dx / l, dy / l];
    }
    return CHR.vecFromDir(p.dir);
  }
  function mouseWorld() {
    const sx = G.mouse.sx - G.ox, sy = G.mouse.sy - G.oy;
    return WORLD.unIso(sx, sy);
  }
  function attack() {
    const p = G.p;
    if (p.dead || p.lock || G.uiOpen) return;
    const h = held(p);
    const def = h ? ITEMS[h] : null;
    const [ax, ay] = aimVec(p);
    p.dir = CHR.dirFromVec(ax, ay);
    if (def && def.kind === 'place') { place(); return; }
    if (def && def.kind === 'gun') {
      if (count(p.inv, def.ammo) <= 0) { SFX.play('click'); say('Sem munição 9mm.', 'warn'); p.lock = { anim: 'shoot', t: 0, dur: 0.25 }; return; }
      remove(p.inv, def.ammo, 1);
      p.lock = { anim: 'shoot', t: 0, dur: 0.32 };
      shoot(p, ax, ay, def);
      return;
    }
    if (p.stamina < 6) { say('Sem fôlego!', 'warn'); return; }
    const knife = h === 'faca';
    const anim = !h || knife ? 'punch' : 'attack';
    const speed = def ? def.speed : 1.3;
    const dur = (anim === 'attack' ? 0.42 : 0.3) / speed;
    p.stamina -= def ? 7 : 4;
    p.lock = { anim, t: 0, dur, hitAt: dur * (anim === 'attack' ? 0.5 : 0.35), hit: false, ax, ay };
    SFX.play('swing');
  }
  function meleeHit(p, ax, ay) {
    const h = held(p), def = h ? ITEMS[h] : null;
    const dmg = def ? def.dmg : 9, range = def ? def.range : 0.95;
    let hits = 0;
    for (const z of G.zombies) {
      if (z.dead) continue;
      const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy);
      if (d > range + 0.2) continue;
      if (d > 0.3 && (dx * ax + dy * ay) / d < 0.42) continue;
      if (!G.map.los(p.x, p.y, z.x, z.y)) continue;
      hurtZombie(z, dmg * (0.85 + Math.random() * 0.3), dx / (d || 1), dy / (d || 1), h === 'machado' || h === 'taco' ? 0.5 : 0.3);
      if (++hits >= (h === 'machado' || h === 'taco' ? 2 : 1)) break;
    }
    if (hits) { SFX.play('hit'); G.shake = 0.12; noise(p.x, p.y, 3); }
    else {
      // acerta barricada à frente
      const i = Math.floor(p.x + ax * 0.9), j = Math.floor(p.y + ay * 0.9), pr = G.map.prop(i, j);
      if (pr && pr.type === 'barricada' && !pr.dead) {
        pr.hp -= dmg; SFX.play('bang');
        if (pr.hp <= 0) { G.map.removeProp(pr); dropItems(i + 0.5, j + 0.5, [{ id: 'tabuas', qty: 1 }]); say('Barricada desmontada.'); }
      }
    }
  }
  function shoot(p, ax, ay, def) {
    SFX.play('shot'); G.flash = 0.08; G.shake = 0.18; noise(p.x, p.y, 18);
    let ex = p.x, ey = p.y, hit = null;
    for (let t = 0.3; t < def.range; t += 0.1) {
      const x = p.x + ax * t, y = p.y + ay * t;
      if (!G.map.los(ex, ey, x, y)) break;
      ex = x; ey = y;
      for (const z of G.zombies) if (!z.dead && Math.hypot(z.x - x, z.y - y) < 0.38) { hit = z; break; }
      if (hit) break;
    }
    G.fx.push({ k: 'tracer', x0: p.x + ax * 0.4, y0: p.y + ay * 0.4, x1: ex, y1: ey, t: 0.08 });
    if (hit) hurtZombie(hit, def.dmg * (0.9 + Math.random() * 0.3), ax, ay, 0.4);
  }
  function hurtZombie(z, dmg, nx, ny, kb) {
    z.hp -= dmg; z.hitFlash = 0.12; z.kx += nx * kb * 6; z.ky += ny * kb * 6;
    z.state = 'chase'; z.lastX = G.p.x; z.lastY = G.p.y; z.seenT = 6;
    blood(z.x, z.y, 6);
    G.fx.push({ k: 'num', x: z.x, y: z.y, v: Math.round(dmg), t: 0.7 });
    if (z.hp <= 0) {
      z.dead = true; z.deadT = 0; z.lock = null; z.anim = 'death'; z.at = 0;
      G.kills++;
      G.decals.push({ x: z.x, y: z.y, r: 1, t: 0 });
      if (Math.random() < 0.2) dropItems(z.x, z.y, rollLoot(['lixeira', 'caixa', 'mesa'][Math.floor(Math.random() * 3)], Math.random).slice(0, 1));
    } else if (!z.lock || z.lock.anim !== 'attack') { z.lock = { anim: 'hurt', t: 0, dur: 0.25 }; }
  }
  function blood(x, y, n) {
    const [sx, sy] = iso(x, y);
    for (let k = 0; k < n; k++) G.fx.push({ k: 'p', x: sx, y: sy - 18, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 40, t: 0.5 + Math.random() * 0.3, c: Math.random() < 0.5 ? '#8a1414' : '#5a0a0a' });
    if (G.decals.length < 250) G.decals.push({ x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.4, r: 0.4 + Math.random() * 0.4, t: 0 });
  }
  function hurtPlayer(dmg) {
    const p = G.p;
    if (p.dead || p.invuln > 0) return;
    dmg *= 1 - armor(p);
    p.hp -= dmg; p.hitFlash = 0.15; G.shake = 0.2;
    SFX.play('hurt');
    blood(p.x, p.y, 4);
    if (Math.random() < 0.3 && !p.bleed) { p.bleed = true; say('Você está sangrando! Use uma bandagem.', 'bad'); }
    if (!p.lock) p.lock = { anim: 'hurt', t: 0, dur: 0.22 };
    if (p.hp <= 0) die();
  }
  function die() {
    const p = G.p;
    p.hp = 0; p.dead = true; p.lock = null; p.anim = 'death'; p.at = 0;
    setTimeout(() => UI.showDeath(), 1600);
  }

  // ---------- itens no chão / containers ----------
  function dropItems(x, y, items) {
    if (!items.length) return;
    const M = G.map;
    let pile = null;
    for (let r = 0; r <= 2 && !pile; r++) for (let dj = -r; dj <= r && !pile; dj++) for (let di = -r; di <= r && !pile; di++) {
      const i = Math.floor(x) + di, j = Math.floor(y) + dj;
      if (!M.inb(i, j)) continue;
      const pr = M.prop(i, j);
      if (pr && pr.type === 'bolsa' && !pr.dead) pile = pr;
      else if (!pr && M.bld[j * N + i] === M.bld[Math.floor(y) * N + Math.floor(x)]) { pile = M.addProp('bolsa', i, j); if (pile) pile.items = makeContainer(16, 'Chão'); }
    }
    if (!pile) return;
    for (const it of items) addItem(pile.items, it.id, it.qty);
  }
  function openContainer(pr) {
    if (!pr.items) {
      const r = WORLD.rng(pr.id * 7919 + G.map.seed);
      pr.items = makeContainer(12, pr.name);
      for (const it of rollLoot(pr.loot, r)) addItem(pr.items, it.id, it.qty);
    }
    UI.openLoot(pr);
  }

  // o que dá para usar com E
  function nearestInteract() {
    const p = G.p, M = G.map;
    const [fx, fy] = CHR.vecFromDir(p.dir);
    let best = null, bd = 1e9;
    const consider = (o, x, y, label) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d > 1.45) return;
      const score = d - 0.35 * ((x - p.x) * fx + (y - p.y) * fy) / (d || 1);
      if (score < bd) { bd = score; best = { o, label }; }
    };
    const i0 = Math.floor(p.x), j0 = Math.floor(p.y);
    for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
      if (!M.inb(i, j)) continue;
      const k = j * N + i;
      const pr = M.prop(i, j);
      if (pr && !pr.dead && (pr.loot || pr.type === 'bolsa') && pr.i === i && pr.j === j) {
        const empty = pr.items && pr.items.slots.every((s) => !s);
        consider(pr, pr.x, pr.y, (pr.items ? 'Abrir ' : 'Vasculhar ') + pr.name + (empty ? ' (vazio)' : ''));
      }
      if (M.wallN[k] === WORLD.W_DOOR) consider({ door: 'N', i, j }, i + 0.5, j, M.doorN[k] === 2 ? 'Porta quebrada' : M.doorN[k] ? 'Fechar porta' : 'Abrir porta');
      if (M.wallW[k] === WORLD.W_DOOR) consider({ door: 'W', i, j }, i, j + 0.5, M.doorW[k] === 2 ? 'Porta quebrada' : M.doorW[k] ? 'Fechar porta' : 'Abrir porta');
    }
    return best;
  }
  function interact() {
    const p = G.p;
    if (p.dead || p.lock) return;
    if (G.uiOpen && UI.lootOpen()) { UI.closeAll(); return; }
    const t = nearestInteract();
    if (!t) return;
    const o = t.o, M = G.map;
    if (o.door) {
      const k = o.j * N + o.i, arr = o.door === 'N' ? M.doorN : M.doorW;
      if (arr[k] === 2) { say('A porta foi arrombada.'); return; }
      arr[k] = arr[k] ? 0 : 1;
      SFX.play('door'); noise(p.x, p.y, 2.5);
      M.collide(p, 0.22);
      return;
    }
    p.dir = CHR.dirFromVec(o.x - p.x, o.y - p.y);
    if (o.items) { openContainer(o); return; }
    p.lock = { anim: 'interact', t: 0, dur: 0.9, onDone: () => openContainer(o) };
  }
  function placeTarget() {
    const p = G.p;
    let i, j;
    if (!isTouch && G.mouse.inside) {
      const [wx, wy] = mouseWorld();
      if (Math.hypot(wx - p.x, wy - p.y) < 2.4) { i = Math.floor(wx); j = Math.floor(wy); }
    }
    if (i == null) { const [fx, fy] = CHR.vecFromDir(p.dir); i = Math.floor(p.x + fx * 1.0); j = Math.floor(p.y + fy * 1.0); }
    const M = G.map;
    const ok = M.inb(i, j) && !M.prop(i, j) && !(Math.floor(p.x) === i && Math.floor(p.y) === j) && !G.zombies.some((z) => !z.dead && Math.floor(z.x) === i && Math.floor(z.y) === j);
    return { i, j, ok };
  }
  function place() {
    const p = G.p;
    if (held(p) !== 'barricada') return;
    const t = placeTarget();
    if (!t.ok) { say('Não dá para construir aí.', 'warn'); return; }
    const pr = G.map.addProp('barricada', t.i, t.j);
    if (!pr) return;
    remove(p.inv, 'barricada', 1);
    SFX.play('build'); noise(p.x, p.y, 5);
    p.lock = { anim: 'punch', t: 0, dur: 0.3 };
    UI.refresh();
  }
  function useItem(c, idx) {
    const p = G.p, s = c.slots[idx];
    if (!s) return;
    const def = ITEMS[s.id];
    if (def.kind === 'food') {
      p.hunger = Math.min(100, p.hunger + (def.hunger || 0)); p.thirst = Math.max(0, Math.min(100, p.thirst + (def.thirst || 0)));
      SFX.play('eat'); say('Consumiu ' + def.name + '.');
    } else if (def.kind === 'med') {
      p.hp = Math.min(100, p.hp + def.heal); if (def.bleed) p.bleed = false;
      SFX.play('pickup'); say('Usou ' + def.name + '.');
    } else if (def.kind === 'wear') { UI.equipWear(c, idx); return; }
    else return;
    s.qty--; if (!s.qty) c.slots[idx] = null;
    UI.refresh();
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

  // ---------- atualização ----------
  function setAnim(e, a) { if (e.anim !== a) { e.anim = a; e.at = 0; } }

  function updatePlayer(dt) {
    const p = G.p, M = G.map;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.dead) { p.at += dt; return; }
    // necessidades
    p.hunger = Math.max(0, p.hunger - dt * 0.07);
    p.thirst = Math.max(0, p.thirst - dt * 0.1);
    if (p.hunger <= 0 || p.thirst <= 0) p.hp -= dt * 0.6;
    else if (p.hunger > 60 && p.thirst > 60 && !p.bleed) p.hp = Math.min(100, p.hp + dt * 0.25);
    if (p.bleed) p.hp -= dt * 0.8;
    if (p.hp <= 0) { die(); return; }

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
    const wantRun = (K.ShiftLeft || K.ShiftRight || G.touch.run) && !p.crouch;
    p.running = moving && wantRun && p.stamina > 1;
    if (p.running) p.stamina = Math.max(0, p.stamina - dt * 14);
    else p.stamina = Math.min(100, p.stamina + dt * (p.crouch ? 16 : moving ? 9 : 14));

    if (p.lock) {
      const L = p.lock;
      L.t += dt;
      setAnim(p, L.anim);
      p.at = L.t;
      if (L.hitAt != null && !L.hit && L.t >= L.hitAt) { L.hit = true; meleeHit(p, L.ax, L.ay); }
      if (L.t >= L.dur) { p.lock = null; if (L.onDone) L.onDone(); }
      if (L.anim === 'interact' && moving) p.lock = null;
    }
    if (!p.lock) {
      if (moving) {
        let sp = p.running ? 3.6 : p.crouch ? 1.05 : 2.0;
        if (weight(p.inv) > maxCarry) sp *= 0.7;
        const speedL = Math.min(1, l);
        p.x += wx * sp * dt * speedL; p.y += wy * sp * dt * speedL;
        M.collide(p, 0.22);
        p.dir = CHR.dirFromVec(wx, wy);
        setAnim(p, p.running ? 'run' : p.crouch ? 'sneak' : 'walk');
        p.at += dt * (p.running ? 1 : p.crouch ? 1 : 0.85 + 0.15 * speedL);
        G.stepNoise = (G.stepNoise || 0) - dt;
        if (G.stepNoise <= 0) { G.stepNoise = 0.5; noise(p.x, p.y, p.running ? 4.5 : p.crouch ? 0.6 : 1.8); }
      } else {
        setAnim(p, p.crouch ? 'crouch' : 'idle');
        p.at += dt;
      }
    }
    // fecha saque se afastou
    if (UI.lootOpen()) { const o = UI.lootTarget(); if (o && Math.hypot(o.x - p.x, o.y - p.y) > 2.2) UI.closeAll(); }
  }

  function updateZombie(z, dt) {
    const p = G.p, M = G.map;
    z.hitFlash = Math.max(0, z.hitFlash - dt);
    if (z.dead) { z.deadT += dt; z.at += dt; return; }
    // empurrão
    if (z.kx || z.ky) { z.x += z.kx * dt; z.y += z.ky * dt; z.kx *= Math.pow(0.0005, dt); z.ky *= Math.pow(0.0005, dt); if (Math.abs(z.kx) + Math.abs(z.ky) < 0.05) z.kx = z.ky = 0; }
    z.atkCd -= dt;
    z.groanT -= dt;
    const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy);
    if (z.groanT <= 0) { z.groanT = 6 + Math.random() * 12; if (d < 10) SFX.play('groan'); }
    // percepção
    if (!p.dead) {
      const night = darkness() > 0.4;
      let range = (night ? 5.5 : 9) * (p.crouch ? 0.55 : 1);
      if (p.flash && night) range = 9;
      const [fx, fy] = CHR.vecFromDir(z.dir);
      const facing = d < 0.01 ? 1 : (dx * fx + dy * fy) / d;
      if (d < 1.4 || (d < range && facing > -0.2 && M.los(z.x, z.y, p.x, p.y, true))) {
        if (z.state !== 'chase' && Math.random() < 0.5) SFX.play('groan');
        z.state = 'chase'; z.lastX = p.x; z.lastY = p.y; z.seenT = 5; z.sees = true;
      } else z.sees = false;
    } else z.sees = false;

    if (z.lock) {
      const L = z.lock;
      L.t += dt; setAnim(z, L.anim); z.at = L.t;
      if (L.hitAt != null && !L.hit && L.t >= L.hitAt) {
        L.hit = true;
        if (L.target) hitObstacle(z, L.target);
        else if (Math.hypot(p.x - z.x, p.y - z.y) < 1.0 && !p.dead) hurtPlayer(z.runner ? 7 : 10 + Math.random() * 4);
      }
      if (L.t >= L.dur) z.lock = null;
      M.collide(z, 0.22);
      return;
    }

    let tx = null, ty = null, sp = 0;
    if (z.state === 'chase') {
      z.seenT -= dt;
      if (!p.dead && z.sees && d < 0.85 && z.atkCd <= 0) {
        z.dir = CHR.dirFromVec(dx, dy);
        z.lock = { anim: 'attack', t: 0, dur: 0.6, hitAt: 0.32 };
        z.atkCd = 1.0 + Math.random() * 0.4;
        return;
      }
      sp = z.speed * (z.sees ? 1 : 0.9);
      if (z.sees && d < 12 && M.los(z.x, z.y, p.x, p.y)) { tx = p.x; ty = p.y; z.path = null; }
      else {
        z.pathT -= dt;
        if (!z.path || z.pathT <= 0) { z.path = M.path(z.x, z.y, z.lastX, z.lastY, true, 900) || []; z.pathT = 1.0 + Math.random() * 0.5; }
        while (z.path.length && Math.hypot(z.path[0][0] - z.x, z.path[0][1] - z.y) < 0.3) z.path.shift();
        if (z.path.length) {
          const [nx, ny] = z.path[0];
          const ob = obstacleBetween(z.x, z.y, nx, ny);
          if (ob) { z.dir = CHR.dirFromVec(nx - z.x, ny - z.y); z.lock = { anim: 'attack', t: 0, dur: 0.7, hitAt: 0.35, target: ob }; return; }
          tx = nx; ty = ny;
        } else if (Math.hypot(z.lastX - z.x, z.lastY - z.y) > 0.4) { tx = z.lastX; ty = z.lastY; }
        else if (z.seenT <= 0) { z.state = 'wander'; z.wanderT = 0; }
      }
    } else {
      z.wanderT -= dt;
      if (z.wanderT <= 0) {
        z.wanderT = 3 + Math.random() * 6;
        if (Math.random() < 0.5) { z.tx = z.x; z.ty = z.y; }
        else { const s = freeSpot(z.x, z.y, 1, 4); if (s) { z.tx = s[0]; z.ty = s[1]; } }
      }
      if (Math.hypot(z.tx - z.x, z.ty - z.y) > 0.3) { tx = z.tx; ty = z.ty; sp = z.runner ? 0.6 : 0.4; }
    }
    if (tx != null) {
      const vx = tx - z.x, vy = ty - z.y, vl = Math.hypot(vx, vy) || 1;
      z.x += (vx / vl) * sp * dt; z.y += (vy / vl) * sp * dt;
      z.dir = CHR.dirFromVec(vx, vy);
      setAnim(z, z.runner && z.state === 'chase' ? 'run' : 'walk');
      z.at += dt * (sp > 1.5 ? 1 : 0.5 + sp * 0.5);
    } else { setAnim(z, 'idle'); z.at += dt; }
    M.collide(z, 0.22);
  }
  function obstacleBetween(x, y, nx, ny) {
    const M = G.map;
    const i = Math.floor(x), j = Math.floor(y), ni = Math.floor(nx), nj = Math.floor(ny);
    if (i === ni && j === nj) return null;
    const pr = M.prop(ni, nj);
    if (pr && pr.type === 'barricada' && !pr.dead && Math.hypot(nx - x, ny - y) < 1.3) return { prop: pr };
    if (Math.abs(ni - i) + Math.abs(nj - j) !== 1) return null;
    let side, ei, ej;
    if (ni > i) { side = 'W'; ei = ni; ej = j; } else if (ni < i) { side = 'W'; ei = i; ej = j; }
    else if (nj > j) { side = 'N'; ei = i; ej = nj; } else { side = 'N'; ei = i; ej = j; }
    if (M.edgeBlocked(ei, ej, side) && (side === 'N' ? M.wallN : M.wallW)[ej * N + ei] === WORLD.W_DOOR) {
      const ex = side === 'N' ? ei + 0.5 : ei, ey = side === 'N' ? ej : ej + 0.5;
      if (Math.hypot(ex - x, ey - y) < 0.7) return { door: side, i: ei, j: ej };
    }
    return null;
  }
  function hitObstacle(z, ob) {
    const M = G.map;
    SFX.play('bang'); noise(z.x, z.y, 4);
    if (ob.prop) {
      ob.prop.hp -= 12;
      if (ob.prop.hp <= 0 && !ob.prop.dead) { M.removeProp(ob.prop); say('Uma barricada foi destruída!', 'bad'); }
    } else {
      const k = ob.j * N + ob.i;
      const hp = ob.door === 'N' ? M.doorHpN : M.doorHpW;
      hp[k] -= 10;
      if (hp[k] <= 0) { (ob.door === 'N' ? M.doorN : M.doorW)[k] = 2; say('Uma porta foi arrombada!', 'bad'); }
    }
  }

  function separate() {
    const zs = G.zombies;
    for (let a = 0; a < zs.length; a++) {
      const A = zs[a]; if (A.dead) continue;
      for (let b = a + 1; b < zs.length; b++) {
        const B = zs[b]; if (B.dead) continue;
        const dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.2 && d2 > 1e-6) { const d = Math.sqrt(d2), k = (0.45 - d) / 2 / d; A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k; }
      }
      const p = G.p, dx = p.x - A.x, dy = p.y - A.y, d2 = dx * dx + dy * dy;
      if (!p.dead && d2 < 0.2 && d2 > 1e-6) { const d = Math.sqrt(d2), k = (0.45 - d) / d; A.x -= dx * k; A.y -= dy * k; }
    }
  }

  function darkness() {
    const h = G.time % 24;
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 20.5) return ((h - 18) / 2.5) * 0.86;
    if (h >= 5 && h < 7) return (1 - (h - 5) / 2) * 0.86;
    return 0.86;
  }

  function updateWorld(dt) {
    const prevH = G.time;
    G.time += dt / 60;
    if (Math.floor(prevH / 24) !== Math.floor(G.time / 24)) { G.day++; say('Dia ' + G.day + '. Os mortos estão mais agitados.', 'warn'); }
    // hordas (inspiradas em Left 4 Dead)
    G.hordeT -= dt;
    if (G.hordeT < 8 && !G.hordeWarn) { G.hordeWarn = true; SFX.play('horde'); UI.banner('UMA HORDA ESTÁ VINDO!'); }
    if (G.hordeT <= 0) {
      G.hordeWarn = false;
      G.hordeT = 200 + Math.random() * 120;
      const n = 12 + G.day * 3;
      const a = Math.random() * Math.PI * 2;
      for (let k = 0; k < n; k++) {
        const s = freeSpot(G.p.x + Math.cos(a) * 22, G.p.y + Math.sin(a) * 22, 0, 5);
        if (s) spawnZombie(s[0], s[1], { chase: true, runner: Math.random() < 0.25 });
      }
    }
    // reposição lenta
    G.spawnT -= dt;
    const alive = G.zombies.filter((z) => !z.dead).length;
    const target = Math.min(120, 50 + G.day * 6 + (darkness() > 0.5 ? 15 : 0));
    if (G.spawnT <= 0 && alive < target) {
      G.spawnT = 2.5;
      const s = freeSpot(G.p.x, G.p.y, 18, 30);
      if (s) spawnZombie(s[0], s[1]);
    }
    // remove cadáveres antigos
    G.zombies = G.zombies.filter((z) => !(z.dead && z.deadT > 90));
    // efeitos
    for (const f of G.fx) { f.t -= dt; if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 160 * dt; } if (f.k === 'num') f.y -= 0; }
    G.fx = G.fx.filter((f) => f.t > 0);
    G.flash = Math.max(0, G.flash - dt); G.shake = Math.max(0, G.shake - dt);
  }

  // ---------- desenho ----------
  function resize() {
    G.zoom = Math.max(2, Math.min(5, G.zoom));
    const w = window.innerWidth, h = window.innerHeight;
    G.vw = Math.ceil(w / G.zoom); G.vh = Math.ceil(h / G.zoom);
    canvas.width = G.vw; canvas.height = G.vh;
    canvas.style.width = G.vw * G.zoom + 'px'; canvas.style.height = G.vh * G.zoom + 'px';
    light.width = G.vw; light.height = G.vh;
    ctx.imageSmoothingEnabled = false;
  }

  function makeShadow() {
    const c = document.createElement('canvas'); c.width = 18; c.height = 8;
    const x = c.getContext('2d'); x.fillStyle = 'rgba(10,8,14,0.35)';
    for (let j = 0; j < 8; j++) for (let i = 0; i < 18; i++) if (((i - 8.5) / 9) ** 2 + ((j - 3.5) / 4) ** 2 <= 1) x.fillRect(i, j, 1, 1);
    return c;
  }

  const buckets = [];
  function draw() {
    const M = G.map, p = G.p;
    const [psx, psy] = iso(p.x, p.y);
    G.cam.x += (psx - G.cam.x) * 0.18; G.cam.y += (psy - 16 - G.cam.y) * 0.18;
    let shx = 0, shy = 0;
    if (G.shake > 0) { shx = (Math.random() - 0.5) * 4; shy = (Math.random() - 0.5) * 4; }
    G.ox = Math.round(G.vw / 2 - G.cam.x + shx); G.oy = Math.round(G.vh / 2 - G.cam.y + shy);
    const ox = G.ox, oy = G.oy;
    ctx.fillStyle = '#141318'; ctx.fillRect(0, 0, G.vw, G.vh);

    // chão
    const visible = (sx, sy, pad) => sx > -pad && sx < G.vw + pad && sy > -pad && sy < G.vh + pad + 40;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const sx = (i - j) * 16 + ox, sy = (i + j) * 8 + oy;
      if (!visible(sx, sy, 40)) continue;
      const k = j * N + i;
      ctx.drawImage(WORLD.floorSprite(M.floor[k], M.fvar[k]), sx - 16, sy);
    }
    // manchas de sangue
    ctx.fillStyle = 'rgba(90,10,12,0.55)';
    for (const d of G.decals) {
      const [sx, sy] = iso(d.x, d.y);
      const r = Math.max(1, Math.round(d.r * 6));
      ctx.fillRect(Math.round(sx + ox - r), Math.round(sy + oy - r / 2), r * 2, r);
    }

    // marcador de construção
    if (held(p) === 'barricada' && !p.dead) {
      const t = placeTarget();
      const [sx, sy] = iso(t.i, t.j);
      ctx.strokeStyle = t.ok ? 'rgba(120,255,160,0.9)' : 'rgba(255,90,90,0.9)';
      ctx.beginPath(); ctx.moveTo(sx + ox + 0.5, sy + oy + 0.5); ctx.lineTo(sx + ox + 16.5, sy + oy + 8.5); ctx.lineTo(sx + ox + 0.5, sy + oy + 16.5); ctx.lineTo(sx + ox - 15.5, sy + oy + 8.5); ctx.closePath(); ctx.stroke();
    }

    // diagonais em ordem: paredes -> objetos -> criaturas
    for (let d = 0; d < 2 * N; d++) { if (!buckets[d]) buckets[d] = { e: [] }; buckets[d].e.length = 0; }
    const ents = [p, ...G.zombies];
    for (const e of ents) { const d = Math.floor(e.x) + Math.floor(e.y); if (buckets[d]) buckets[d].e.push(e); }
    const pd = Math.floor(p.x) + Math.floor(p.y);
    const pb = M.bld[Math.floor(p.y) * N + Math.floor(p.x)];
    const near = (sx, sy) => Math.abs(sx - (psx + ox)) < 34 && sy > psy + oy - 34 && sy < psy + oy + 60;

    for (let d = 0; d < 2 * N - 1; d++) {
      const iMin = Math.max(0, d - N + 1), iMax = Math.min(N - 1, d);
      // paredes
      for (let i = iMin; i <= iMax; i++) {
        const j = d - i, k = j * N + i;
        const sx = (i - j) * 16 + ox, sy = (i + j) * 8 + oy;
        if (!visible(sx, sy, 64)) continue;
        const wn = M.wallN[k], ww = M.wallW[k];
        if (!wn && !ww) continue;
        const fade = d > pd && near(sx, sy + 8) ? 0.3 : 1;
        ctx.globalAlpha = fade;
        // corte estilo Project Zomboid: paredes à frente dentro do prédio atual ficam baixas
        const cutN = d > pd && pb >= 0 && (M.bld[k] === pb || (j > 0 && M.bld[k - N] === pb));
        const cutW = d > pd && pb >= 0 && (M.bld[k] === pb || (i > 0 && M.bld[k - 1] === pb));
        if (wn) wallDraw(WORLD.wallSprite(M.styleN[k], 'N', wallKind(wn, M.doorN[k])), sx, sy - WALL_H - 2, cutN);
        if (ww) wallDraw(WORLD.wallSprite(M.styleW[k], 'W', wallKind(ww, M.doorW[k])), sx - 16, sy - WALL_H - 2, cutW);
        ctx.globalAlpha = 1;
      }
      // objetos
      for (let i = iMin; i <= iMax; i++) {
        const j = d - i;
        const pr = M.prop(i, j);
        if (!pr || pr.dead) continue;
        const last = pr.tiles[pr.tiles.length - 1];
        if (last[0] !== i || last[1] !== j) continue;
        const [sx0, sy0] = iso(pr.x, pr.y);
        const sx = sx0 + ox, sy = sy0 + oy;
        if (!visible(sx, sy, 80)) continue;
        const spr = WORLD.propSprite(pr.type, pr.v, pr.rot);
        const tall = spr.height > 30;
        ctx.globalAlpha = tall && d > pd && near(sx, sy - 10) ? 0.4 : 1;
        ctx.drawImage(spr, Math.round(sx - spr.ox), Math.round(sy - spr.oy));
        ctx.globalAlpha = 1;
        if (pr.type === 'barricada' && pr.hp < 120) bar(sx - 8, sy - 30, 16, pr.hp / 120, '#d0a040');
      }
      // criaturas
      const be = buckets[d].e;
      if (be.length > 1) be.sort((a, b) => (a.dead ? -1 : 0) - (b.dead ? -1 : 0) || a.x + a.y - b.x - b.y);
      for (const e of be) drawEntity(e, ox, oy);
    }

    // efeitos
    for (const f of G.fx) {
      if (f.k === 'p') { ctx.fillStyle = f.c; ctx.fillRect(Math.round(f.x + ox), Math.round(f.y + oy), 2, 2); }
      else if (f.k === 'tracer') {
        const [a, b] = iso(f.x0, f.y0), [c, e] = iso(f.x1, f.y1);
        ctx.strokeStyle = 'rgba(255,230,140,0.9)'; ctx.beginPath(); ctx.moveTo(a + ox, b + oy - 22); ctx.lineTo(c + ox, e + oy - 18); ctx.stroke();
      } else if (f.k === 'num') {
        const [a, b] = iso(f.x, f.y);
        ctx.font = '8px monospace'; ctx.fillStyle = '#ffe080'; ctx.textAlign = 'center';
        ctx.fillText(f.v, Math.round(a + ox), Math.round(b + oy - 44 - (0.7 - f.t) * 20));
      }
    }

    drawLight(ox, oy, psx, psy);

    // mira
    if (!isTouch && G.mouse.inside && !G.uiOpen && !p.dead) {
      const mx = Math.round(G.mouse.sx), my = Math.round(G.mouse.sy);
      ctx.fillStyle = 'rgba(230,240,230,0.85)';
      ctx.fillRect(mx - 4, my, 3, 1); ctx.fillRect(mx + 2, my, 3, 1); ctx.fillRect(mx, my - 4, 1, 3); ctx.fillRect(mx, my + 2, 1, 3);
    }
  }
  function wallDraw(spr, x, y, cut) {
    if (!cut) { ctx.drawImage(spr, x, y); return; }
    const top = WALL_H - 10;
    ctx.drawImage(spr, 0, top, spr.width, spr.height - top, x, y + top, spr.width, spr.height - top);
  }
  function wallKind(w, door) { if (w === WORLD.W_WIN) return 2; if (w === WORLD.W_DOOR) return door === 0 ? 3 : door === 1 ? 4 : 5; return 1; }
  function bar(x, y, w, v, c) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, w + 2, 4);
    ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w * Math.max(0, v)), 2);
  }
  function drawEntity(e, ox, oy) {
    const [sx0, sy0] = iso(e.x, e.y);
    const sx = sx0 + ox, sy = sy0 + oy;
    if (sx < -60 || sx > G.vw + 60 || sy < -20 || sy > G.vh + 80) return;
    if (!e.dead) ctx.drawImage(shadowSpr, Math.round(sx - 9), Math.round(sy - 4));
    const spec = e === G.p ? 'player' : e.type;
    const item = e === G.p ? heldModel(e) : null;
    const A = CHR.ANIMS[e.anim];
    let frame = Math.floor(e.at * A.fps);
    frame = A.loop ? frame % A.n : Math.min(A.n - 1, frame);
    if (e.lock) frame = Math.min(A.n - 1, Math.floor((e.lock.t / e.lock.dur) * A.n));
    const flash = e.hitFlash > 0;
    if (flash) ctx.filter = 'brightness(2.2) saturate(0.4)';
    const alpha = e.dead && e.deadT > 80 ? Math.max(0, (90 - e.deadT) / 10) : 1;
    CHR.draw(ctx, spec, item, e.anim, frame, e.dir, sx, sy, alpha);
    if (flash) ctx.filter = 'none';
  }

  function drawLight(ox, oy, psx, psy) {
    const dk = darkness();
    const h = G.time % 24;
    if (h >= 17 && h < 20) { ctx.fillStyle = 'rgba(255,120,40,' + (0.12 * Math.sin(((h - 17) / 3) * Math.PI)) + ')'; ctx.fillRect(0, 0, G.vw, G.vh); }
    if (dk < 0.02 && G.flash <= 0) return;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, G.vw, G.vh);
    lctx.fillStyle = 'rgba(6,8,22,' + dk + ')';
    lctx.fillRect(0, 0, G.vw, G.vh);
    lctx.globalCompositeOperation = 'destination-out';
    const px = psx + ox, py = psy + oy - 14;
    const glow = (x, y, r, a) => {
      const g = lctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    glow(px, py, 46, 0.75);
    const p = G.p;
    if (p.flash && count(p.inv, 'lanterna') > 0 && !p.dead) {
      const [ax, ay] = aimVec(p);
      const sdx = (ax - ay) * 16, sdy = (ax + ay) * 8, sl = Math.hypot(sdx, sdy);
      const ang = Math.atan2(sdy / sl, sdx / sl);
      const R = 170;
      const g = lctx.createRadialGradient(px, py, 8, px, py, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.moveTo(px, py); lctx.arc(px, py, R, ang - 0.42, ang + 0.42); lctx.closePath(); lctx.fill();
    }
    for (const l of G.map.lights) {
      const [lx, ly] = iso(l.x, l.y);
      const x = lx + ox, y = ly + oy;
      if (x < -100 || x > G.vw + 100 || y < -100 || y > G.vh + 100) continue;
      glow(x + 8, y + 6, 70, 0.85);
    }
    if (G.flash > 0) glow(px, py, 110, 0.9);
    ctx.drawImage(light, 0, 0);
  }

  // ---------- laço ----------
  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (G.state === 'play' && !G.paused) {
      updatePlayer(dt);
      for (const z of G.zombies) updateZombie(z, dt);
      separate();
      updateWorld(dt);
    }
    if (G.state === 'play' || G.state === 'dead') {
      draw();
      UI.hud(dt);
    }
    requestAnimationFrame(frame);
  }

  function newGame() {
    G.map = new WORLD.Map((Math.random() * 1e9) | 0);
    G.p = newPlayer();
    G.zombies = []; G.fx = []; G.decals = []; G.kills = 0; G.time = 8; G.day = 1; G.hordeT = 240; G.hordeWarn = false;
    const [sx, sy] = iso(G.p.x, G.p.y); G.cam.x = sx; G.cam.y = sy;
    for (let k = 0; k < 55; k++) { const s = freeSpot(G.p.x, G.p.y, 12, 40); if (s) spawnZombie(s[0], s[1]); }
    G.state = 'play'; G.uiOpen = false;
    UI.refresh();
    say('Você acorda no laboratório. Encontre suprimentos e sobreviva.');
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      if (G.state !== 'play') return;
      G.keys[e.code] = true;
      const c = e.code;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (e.repeat) return;
      if (c === 'Tab' || c === 'KeyI') UI.toggleInv();
      else if (c === 'Escape') { if (G.uiOpen) UI.closeAll(); else UI.togglePause(); }
      else if (c === 'KeyE') interact();
      else if (c === 'Space') attack();
      else if (c === 'KeyC' || c === 'ControlLeft') { G.p.crouch = !G.p.crouch; }
      else if (c === 'KeyF') { if (count(G.p.inv, 'lanterna')) { G.p.flash = !G.p.flash; SFX.play('click'); } else say('Você não tem lanterna.', 'warn'); }
      else if (c === 'KeyR') place();
      else if (c === 'KeyV') UI.openViewer();
      else if (/^Digit[1-6]$/.test(c)) { G.p.hot = +c.slice(5) - 1; UI.refresh(); }
    });
    window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    window.addEventListener('blur', () => { G.keys = {}; });
    canvas.addEventListener('pointermove', (e) => { G.mouse.sx = e.clientX / G.zoom; G.mouse.sy = e.clientY / G.zoom; G.mouse.inside = true; });
    canvas.addEventListener('pointerleave', () => { G.mouse.inside = false; });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || G.state !== 'play') return;
      SFX.init();
      G.mouse.sx = e.clientX / G.zoom; G.mouse.sy = e.clientY / G.zoom; G.mouse.inside = true;
      if (G.uiOpen && !UI.lootOpen()) return;
      if (e.button === 0) attack(); else if (e.button === 2) place();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); G.zoom += e.deltaY > 0 ? -1 : 1; resize(); }, { passive: false });
    window.addEventListener('resize', resize);
  }

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    light = document.createElement('canvas'); lctx = light.getContext('2d');
    shadowSpr = makeShadow();
    G.zoom = window.innerWidth < 700 ? 2 : 3;
    resize();
    bindInput();
    requestAnimationFrame(frame);
  }

  // pré-gera sprites com barra de progresso
  async function preload(onProgress) {
    const jobs = [];
    for (const a of CHR.PLAYER_ANIMS) jobs.push(() => CHR.sheet('player', null, a));
    for (const a of ['idle', 'walk', 'run', 'attack']) jobs.push(() => CHR.sheet('player', 'taco', a));
    for (const t of CHR.ZOMBIE_TYPES) for (const a of CHR.ZOMBIE_ANIMS) jobs.push(() => CHR.sheet(t, null, a));
    for (const id of Object.keys(ITEMS)) jobs.push(() => ITEM_MODELS.icon(id));
    for (const t of Object.keys(WORLD.PROPS)) for (let v = 0; v < (t === 'carro' ? 6 : t === 'arvore' ? 6 : t === 'barril' ? 5 : 1); v++) jobs.push(() => { WORLD.propSprite(t, v, 0); if (t === 'carro') WORLD.propSprite(t, v, 1); });
    for (let i = 0; i < jobs.length; i++) {
      jobs[i]();
      onProgress((i + 1) / jobs.length);
      if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
    }
  }

  return {
    G, init, preload, newGame, isTouch, attack, interact, place, useItem, craft, addItem, remove, count, weight, invSize, held, makeContainer, dropItems, say, maxCarry,
    setTouch(x, y, active) { G.touch.x = x; G.touch.y = y; G.touch.active = active; },
    nearestInteract,
  };
})();

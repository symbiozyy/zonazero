'use strict';
// Interface: HUD, inventário, saque, criação, códex (cartas de horror), mapa, textos, visualizador, telas, toque.
const UI = (() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const G = () => GAME.G;
  let invOpen = false, loot = null, selected = null, hudT = 0, miniBase = null, miniFor = null;

  // ---------- slots ----------
  const EQ = [['head', 'Cabeça'], ['face', 'Rosto'], ['body', 'Corpo'], ['back', 'Costas']];
  function get(ref) {
    const p = G().p;
    if (ref.where === 'inv') return p.inv.slots[ref.idx];
    if (ref.where === 'loot') return loot && loot.items.slots[ref.idx];
    if (ref.where === 'equip') return p.equip[ref.slot];
    return null;
  }
  function set(ref, v) {
    const p = G().p;
    if (ref.where === 'inv') p.inv.slots[ref.idx] = v;
    else if (ref.where === 'loot') loot.items.slots[ref.idx] = v;
    else if (ref.where === 'equip') p.equip[ref.slot] = v;
  }
  function accepts(ref, it) {
    if (!it) return true;
    if (ref.where === 'equip') return ITEMS[it.id].slot === ref.slot;
    if (ref.where === 'inv') return ref.idx < GAME.invSize(G().p);
    return true;
  }
  const backpackBusy = () => G().p.inv.slots.some((s, i) => s && i >= 16);
  function move(src, dst) {
    if (src.where === dst.where && src.idx === dst.idx && src.slot === dst.slot) return;
    const a = get(src), b = get(dst);
    if (!a) return;
    if (src.where === 'equip' && src.slot === 'back' && backpackBusy() && !(b && b.id === 'mochila')) { GAME.say('Esvazie os bolsos extras da mochila primeiro.', 'warn'); return; }
    if (!accepts(dst, a) || !accepts(src, b)) { if (dst.where === 'equip') GAME.say('Esse item não vai nesse lugar.', 'warn'); return; }
    if (b && b.id === a.id && ITEMS[a.id].stack > 1) { const k = Math.min(a.qty, ITEMS[a.id].stack - b.qty); b.qty += k; a.qty -= k; if (!a.qty) set(src, null); }
    else { set(dst, a); set(src, b); }
    SFX.play('pickup');
    selected = dst;
    afterLootChange(); refresh();
  }
  function quickMove(ref) {
    const it = get(ref); if (!it) return;
    const p = G().p;
    if (ref.where === 'loot') {
      const left = GAME.addItem(p.inv, it.id, it.qty, GAME.invSize(p), it.mag != null ? { mag: it.mag } : null);
      if (left === it.qty) { GAME.say('Inventário cheio.', 'warn'); return; }
      if (left) it.qty = left; else set(ref, null);
      SFX.play('pickup');
    } else if (ref.where === 'inv' && loot) {
      const left = GAME.addItem(loot.items, it.id, it.qty, null, it.mag != null ? { mag: it.mag } : null);
      if (left) it.qty = left; else set(ref, null);
    } else if (ref.where === 'equip') {
      if (ref.slot === 'back' && backpackBusy()) { GAME.say('Esvazie os bolsos extras da mochila primeiro.', 'warn'); return; }
      if (!GAME.addItem(p.inv, it.id, it.qty, 16)) set(ref, null);
    } else if (ref.where === 'inv' && ITEMS[it.id].kind === 'wear') { equipWear(p.inv, ref.idx); return; }
    afterLootChange(); refresh();
  }
  function equipWear(c, idx) {
    const it = c.slots[idx]; if (!it) return;
    move({ where: c === G().p.inv ? 'inv' : 'loot', idx }, { where: 'equip', slot: ITEMS[it.id].slot });
    if (it.id === 'mascara' && G().p.filter <= 0) GAME.say('Máscara colocada. Use um Filtro para ativar a proteção.', 'warn');
  }
  function dropRef(ref) {
    const it = get(ref); if (!it) return;
    if (ref.where === 'equip' && ref.slot === 'back' && backpackBusy()) { GAME.say('Esvazie os bolsos extras da mochila primeiro.', 'warn'); return; }
    set(ref, null);
    const p = G().p;
    GAME.dropItems(p.x, p.y, [it]);
    selected = null; refresh();
  }
  function afterLootChange() { if (loot && loot.type === 'bolsa_chao' && loot.items.slots.every((s) => !s)) { G().map.removeProp(loot); closeLoot(); } }

  function slotEl(ref, it, extra) {
    const s = el('div', 'slot' + (extra || ''));
    s.dataset.ref = JSON.stringify(ref);
    if (it) {
      const img = el('img'); img.src = ITEM_MODELS.icon(it.id).url; img.alt = ITEMS[it.id].name; img.draggable = false;
      s.appendChild(img);
      if (it.qty > 1) s.appendChild(el('span', 'qty', it.qty));
      if (ITEMS[it.id].mag) s.appendChild(el('span', 'mag', it.mag + '/' + ITEMS[it.id].mag));
      s.title = ITEMS[it.id].name;
    }
    if (selected && JSON.stringify(selected) === s.dataset.ref) s.classList.add('sel');
    return s;
  }
  function refresh() {
    if (!G().p) return;
    renderHotbar();
    if (!invOpen) return;
    const p = G().p;
    const grid = $('#bag-grid'); grid.innerHTML = '';
    const n = GAME.invSize(p);
    for (let i = 0; i < n; i++) { const s = slotEl({ where: 'inv', idx: i }, p.inv.slots[i], i < 6 ? ' hot' : ''); if (i < 6) s.appendChild(el('span', 'key', i + 1)); grid.appendChild(s); }
    const w = GAME.weight(p.inv);
    $('#bag-weight').textContent = `Peso ${w.toFixed(1)} / ${GAME.maxCarry} kg`;
    $('#bag-weight').classList.toggle('over', w > GAME.maxCarry);
    const eq = $('#equip'); eq.innerHTML = '';
    for (const [slot, label] of EQ) { const d = el('div'); d.appendChild(el('span', '', label)); d.appendChild(slotEl({ where: 'equip', slot }, p.equip[slot], ' eq')); eq.appendChild(d); }
    $('#filter-info').textContent = p.equip.face ? (p.filter > 0 ? `Filtro: ${Math.ceil(p.filter)} s` : 'Máscara sem filtro') : '';
    const lp = $('#loot-panel');
    lp.hidden = !loot;
    if (loot) {
      $('#loot-title').textContent = loot.name;
      const lg = $('#loot-grid'); lg.innerHTML = '';
      loot.items.slots.forEach((it, i) => lg.appendChild(slotEl({ where: 'loot', idx: i }, it)));
      $('#loot-empty').hidden = loot.items.slots.some((s) => s);
    }
    renderDetails(); renderCraft();
  }
  function renderDetails() {
    const box = $('#details'); box.innerHTML = '';
    const it = selected && get(selected);
    if (!it) { box.appendChild(el('p', 'hint', 'Toque num item para ver detalhes. Arraste para mover. Shift + clique transfere direto. Clique duplo usa.')); return; }
    const d = ITEMS[it.id];
    const head = el('div', 'd-head');
    const img = el('img'); img.src = ITEM_MODELS.icon(it.id).url; img.alt = '';
    head.appendChild(img);
    const tx = el('div', 'd-text');
    tx.appendChild(el('h3', '', d.name + (it.qty > 1 ? ' ×' + it.qty : '')));
    const stats = [];
    if (d.dmg) stats.push('Dano ' + d.dmg + (d.pellets ? '×' + d.pellets : ''));
    if (d.mag) stats.push(`Pente ${it.mag}/${d.mag} · Reserva ${GAME.count(G().p.inv, d.ammo)}`);
    stats.push('Peso ' + d.w);
    tx.appendChild(el('p', '', d.desc + ' <span class="muted">' + stats.join(' · ') + '</span>'));
    head.appendChild(tx);
    box.appendChild(head);
    const acts = el('div', 'd-acts');
    const btn = (label, fn) => { const b = el('button', 'btn small', label); b.type = 'button'; b.onclick = fn; acts.appendChild(b); };
    const ref = selected;
    const cont = () => (ref.where === 'inv' ? G().p.inv : loot.items);
    if (ref.where === 'loot') btn('Pegar', () => quickMove(ref));
    if (ref.where === 'inv' || ref.where === 'loot') {
      if (d.kind === 'food' || d.kind === 'med') btn(d.kind === 'food' ? 'Consumir' : 'Usar', () => GAME.useItem(cont(), ref.idx));
      if (it.id === 'filtro') btn('Encaixar na máscara', () => GAME.useItem(cont(), ref.idx));
      if (d.kind === 'lore') btn('Ler', () => GAME.useItem(cont(), ref.idx));
      if (d.kind === 'wear') btn('Vestir', () => equipWear(cont(), ref.idx));
      if (ref.where === 'inv' && ['melee1', 'melee2', 'pistol', 'rifle', 'throw', 'place'].includes(d.kind) && ref.idx !== G().p.hot) btn('Segurar', () => { const p = G().p; if (ref.idx < 6) p.hot = ref.idx; else move(ref, { where: 'inv', idx: p.hot }); refresh(); });
    }
    if (ref.where === 'equip') btn('Tirar', () => quickMove(ref));
    if (ref.where !== 'loot') btn('Largar no chão', () => dropRef(ref));
    box.appendChild(acts);
  }
  function renderCraft() {
    const box = $('#craft-list'); box.innerHTML = '';
    const p = G().p;
    for (const r of RECIPES) {
      const ok = Object.entries(r.need).every(([id, q]) => GAME.count(p.inv, id) >= q);
      const row = el('div', 'recipe' + (ok ? '' : ' off'));
      const img = el('img'); img.src = ITEM_MODELS.icon(r.out).url; img.alt = '';
      row.appendChild(img);
      const need = Object.entries(r.need).map(([id, q]) => `<span class="${GAME.count(p.inv, id) >= q ? '' : 'miss'}">${q}× ${ITEMS[id].name}</span>`).join(' + ');
      row.appendChild(el('div', 'r-text', `<b>${ITEMS[r.out].name}</b><small>${need}</small>`));
      const b = el('button', 'btn small', 'Criar'); b.type = 'button'; b.disabled = !ok;
      b.onclick = () => { if (GAME.craft(r)) refresh(); };
      row.appendChild(b);
      box.appendChild(row);
    }
  }
  function renderHotbar() {
    const p = G().p, hb = $('#hotbar'); hb.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const s = slotEl({ where: 'inv', idx: i }, p.inv.slots[i], ' hot' + (i === p.hot ? ' active' : ''));
      s.appendChild(el('span', 'key', i + 1));
      s.onclick = () => { p.hot = i; refresh(); };
      hb.appendChild(s);
    }
  }
  function bindDrag() {
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
      const s = e.target.closest('#inv .slot');
      if (!s) return;
      const ref = JSON.parse(s.dataset.ref);
      if (e.shiftKey) { quickMove(ref); return; }
      drag = { ref, x: e.clientX, y: e.clientY, ghost: null };
    });
    document.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6 && get(drag.ref)) { drag.ghost = el('img', 'ghost'); drag.ghost.src = ITEM_MODELS.icon(get(drag.ref).id).url; document.body.appendChild(drag.ghost); }
      if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
    });
    document.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.ghost) {
        d.ghost.remove();
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const s = t && t.closest('#inv .slot');
        if (s) move(d.ref, JSON.parse(s.dataset.ref));
        else if (!t || !t.closest('#inv .panel')) dropRef(d.ref);
      } else {
        const same = selected && JSON.stringify(selected) === JSON.stringify(d.ref);
        if (same && e.detail >= 2) { const it = get(d.ref); if (it && (['food', 'med', 'lore'].includes(ITEMS[it.id].kind) || it.id === 'filtro') && d.ref.where !== 'equip') GAME.useItem(d.ref.where === 'inv' ? G().p.inv : loot.items, d.ref.idx); else quickMove(d.ref); }
        selected = get(d.ref) ? d.ref : null;
        refresh();
      }
    });
  }

  // ---------- painéis ----------
  function toggleInv(force) {
    invOpen = force != null ? force : !invOpen;
    $('#inv').hidden = !invOpen;
    if (!invOpen) { closeLoot(); selected = null; }
    G().uiOpen = invOpen;
    refresh();
  }
  function openLoot(pr) { loot = pr; selected = null; toggleInv(true); }
  function closeLoot() { loot = null; if (invOpen) refresh(); }
  function anyModal() { return ['#viewer', '#codex', '#text', '#bigmap', '#pause'].some((s) => !$(s).hidden); }
  function closeAll() {
    for (const s of ['#viewer', '#codex', '#text', '#bigmap', '#pause']) $(s).hidden = true;
    G().paused = false; toggleInv(false);
  }
  function togglePause() { const pz = $('#pause'); pz.hidden = !pz.hidden; G().paused = !pz.hidden; if (!pz.hidden) GAME.save(); }
  function showText(title, body) { $('#text-title').textContent = title; $('#text-body').textContent = body; $('#text').hidden = false; G().paused = true; }

  function toast(text, kind) {
    const box = $('#log');
    const t = el('div', 'toast ' + (kind || ''), text);
    box.appendChild(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4500);
    setTimeout(() => t.remove(), 5400);
  }
  function banner(text) { const b = $('#banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

  // ---------- HUD ----------
  function hud(dt) {
    hudT -= dt;
    const g = G(), p = g.p;
    if (!p || hudT > 0) return;
    hudT = 0.1;
    const setBar = (id, v, lowBad) => { const b = $('#' + id); b.style.setProperty('--v', Math.max(0, Math.min(100, v)) + '%'); b.classList.toggle('low', lowBad ? v < 25 : v > 70); };
    setBar('b-hp', p.hp, 1); setBar('b-food', p.hunger, 1); setBar('b-water', p.thirst, 1); setBar('b-stam', p.stamina, 1);
    setBar('b-cont', p.contam, 0); setBar('b-san', p.sanity, 1);
    const st = [];
    if (p.bleed) st.push('<span class="bad">Sangrando</span>');
    if (p.crouch) st.push('Agachada');
    if (p.flash) st.push('Lanterna');
    if (p.equip.face) st.push(p.filter > 0 ? `Máscara ${Math.ceil(p.filter)}s` : '<span class="warn">Máscara sem filtro</span>');
    if (GAME.weight(p.inv) > GAME.maxCarry) st.push('<span class="warn">Sobrecarga</span>');
    if (p.contam > 60) st.push('<span class="bad">Colonização avançada</span>');
    if (p.sanity < 30) st.push('<span class="lore">Alucinando</span>');
    if (p.forbidden) st.push(`<span class="lore">Conhecimento ${p.forbidden}</span>`);
    $('#status').innerHTML = st.join(' · ');
    const h = Math.floor(g.time % 24), m = Math.floor((g.time % 1) * 60);
    $('#clock').textContent = `Dia ${g.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${g.rain ? ' · chuva' : ''}`;
    $('#kills').textContent = `${g.kills} abatidos`;
    $('#nests').textContent = `Ninhos ${g.nestsDead}/${g.nestsTotal}`;
    $('#horde').textContent = g.bloom.active > 0 ? `Floração: ${Math.ceil(g.bloom.active)} s` : g.bloom.t < 60 ? `Floração em ${Math.ceil(g.bloom.t)} s` : '';
    const slot = GAME.heldSlot(p), def = slot && ITEMS[slot.id];
    const am = $('#ammo');
    if (def && def.mag) { am.hidden = false; am.innerHTML = `<b>${slot.mag}</b>/${def.mag} <small>${GAME.count(p.inv, def.ammo)} · ${ITEMS[def.ammo].name}</small>`; am.classList.toggle('empty', slot.mag === 0); }
    else if (def && def.kind === 'throw') { am.hidden = false; am.innerHTML = `<b>${GAME.count(p.inv, slot.id)}</b> <small>${def.name}</small>`; am.classList.remove('empty'); }
    else am.hidden = true;
    const it = !p.dead && !g.uiOpen ? GAME.nearestInteract() : null;
    const pr = $('#prompt');
    const hk = GAME.held(p);
    if (it) pr.innerHTML = (GAME.isTouch ? '' : '<kbd>E</kbd> ') + it.label;
    else if (hk && ITEMS[hk].kind === 'place') pr.innerHTML = (GAME.isTouch ? 'Toque em Atacar' : '<kbd>Botão direito</kbd> ou <kbd>B</kbd>') + ' para construir';
    else pr.innerHTML = '';
    pr.hidden = !pr.innerHTML;
    drawMini();
    if (!$('#bigmap').hidden) drawBigMap();
  }
  const MAPC = { 0: '#3e5a2c', 1: '#2e4422', 2: '#5e4a32', 3: '#6a665e', 11: '#6a6862', 21: '#4e4e4e', 22: '#3a1f4a', 23: '#1a1614', 26: '#4e7a36', 27: '#5c5e4c' };
  function mapBase() {
    const M = G().map, N = M.N;
    if (miniFor === M) return miniBase;
    miniFor = M;
    const cv = document.createElement('canvas'); cv.width = N * 2; cv.height = N;
    const b = cv.getContext('2d');
    const img = b.createImageData(N * 2, N), U = new Uint32Array(img.data.buffer);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      let c = MAPC[M.floor[k]] || (M.floor[k] >= 4 && M.floor[k] <= 10 ? '#2c2c32' : '#8a7a6a');
      if (M.bld[k] >= 0) c = '#b8ae98';
      if (M.wN[k] || M.wW[k]) c = M.bld[k] >= 0 || M.wbN[k] >= 0 ? '#e8e2cc' : c;
      const pr = M.prop(i, j); if (pr && pr.type === 'arvore') c = '#1e3418';
      const cc = VX.hex(c);
      const x = i - j + N - 1, y = Math.floor((i + j) / 2);
      for (let q = 0; q < 2; q++) U[y * N * 2 + x + q] = (255 << 24) | (cc[2] << 16) | (cc[1] << 8) | cc[0];
    }
    b.putImageData(img, 0, 0);
    miniBase = cv;
    return cv;
  }
  function markers(c, ox, oy, s, full) {
    const g = G(), M = g.map, N = M.N, p = g.p;
    const P = (x, y) => [Math.round((x - y + N) * s + ox), Math.round(((x + y) / 2) * s + oy)];
    for (const n of M.nests) { if (n.dead) continue; if (!full && Math.hypot(n.x - p.x, n.y - p.y) > 60) continue; const [x, y] = P(n.x, n.y); c.fillStyle = '#d06aff'; c.fillRect(x - 2, y - 2, 4, 4); }
    if (M.fragment && !M.fragment.dead) { const [x, y] = P(M.fragment.x, M.fragment.y); c.fillStyle = '#6af7ff'; c.fillRect(x - 3, y - 3, 6, 6); }
    c.fillStyle = '#ff4a3a';
    for (const e of g.enemies) { if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > (full ? 30 : 26) || !(g.vis && g.vis[Math.floor(e.y) * N + Math.floor(e.x)])) continue; const [x, y] = P(e.x, e.y); c.fillRect(x - 1, y, 2, 1); }
    const [x, y] = P(p.x, p.y); c.fillStyle = '#ffffff'; c.fillRect(x - 2, y - 2, 4, 4);
  }
  function drawMini() {
    const g = G(), M = g.map, N = M.N, p = g.p;
    const cv = $('#mini'), c = cv.getContext('2d');
    const base = mapBase();
    c.fillStyle = '#0b0d0a'; c.fillRect(0, 0, cv.width, cv.height);
    const s = 1.5;
    const px = (p.x - p.y + N) * s, py = ((p.x + p.y) / 2) * s;
    const ox = Math.round(cv.width / 2 - px), oy = Math.round(cv.height / 2 - py);
    c.imageSmoothingEnabled = false;
    c.drawImage(base, ox, oy, base.width * s, base.height * s);
    markers(c, ox, oy, s, false);
  }
  function drawBigMap() {
    const cv = $('#bigmap-cv'), c = cv.getContext('2d');
    const base = mapBase();
    const s = Math.min(cv.width / base.width, cv.height / base.height);
    const ox = Math.round((cv.width - base.width * s) / 2), oy = Math.round((cv.height - base.height * s) / 2);
    c.fillStyle = '#0b0d0a'; c.fillRect(0, 0, cv.width, cv.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(base, ox, oy, base.width * s, base.height * s);
    markers(c, ox, oy, s, true);
  }
  function toggleMap() { const b = $('#bigmap'); b.hidden = !b.hidden; if (!b.hidden) drawBigMap(); }

  // ---------- códex com cartas de horror (retícula + neon) ----------
  const cardCache = {};
  function card(type) {
    if (cardCache[type]) return cardCache[type];
    const src = type === 'ninho' || type === 'fragmento' ? PROPS.sprite(type, 0, 0, true) : CR.portrait(type);
    const W = 132, H = 168;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#060606'; c.fillRect(0, 0, W, H);
    const s = Math.min((W - 16) / src.width, (H - 16) / src.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(src, (W - src.width * s) / 2, (H - src.height * s) / 2 + 6, src.width * s, src.height * s);
    const img = c.getImageData(0, 0, W, H), d = img.data;
    const accent = { inf: [216, 70, 255], al: [70, 255, 230] }[type.startsWith('al_') ? 'al' : 'inf'];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, r = d[o], g = d[o + 1], b = d[o + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      if (mx - mn > 110 && mx > 160) { d[o] = accent[0]; d[o + 1] = accent[1]; d[o + 2] = accent[2]; continue; }
      const cell = ((x % 3) + (y % 3) * 3) / 9;
      const v = lum * 1.9 > cell + 0.08 ? 236 : 8;
      d[o] = d[o + 1] = d[o + 2] = v;
    }
    c.putImageData(img, 0, 0);
    c.strokeStyle = '#e8e8e0'; c.lineWidth = 2; c.strokeRect(3, 3, W - 6, H - 6);
    for (let k = 0; k < 4; k++) { c.fillStyle = `rgba(${accent.join(',')},0.6)`; const y = Math.floor(VX.hash(k, type.length, 2) * H); c.fillRect(6, y, W - 12, 1); }
    cardCache[type] = cv.toDataURL();
    return cardCache[type];
  }
  function openCodex() {
    const g = G();
    const grid = $('#codex-grid'); grid.innerHTML = '';
    for (const [type, b] of Object.entries(LORE.bestiario)) {
      const known = g.codex[type];
      const f = el('figure', 'hcard' + (known ? '' : ' unknown'));
      if (known) { const img = el('img'); img.src = card(type); img.alt = b.n; f.appendChild(img); }
      else f.appendChild(el('div', 'unk', '?'));
      f.appendChild(el('figcaption', '', known ? `<b>${b.n}</b><small>${b.a}</small><span>${b.d}</span>` : '<b>Desconhecido</b><small>Encontre esta criatura para registrá-la.</small>'));
      grid.appendChild(f);
    }
    const lore = $('#codex-lore'); lore.innerHTML = '';
    const items = g.readLogs.length ? g.readLogs.map((t) => `<li>${t}</li>`).join('') : '<li class="muted">Nenhum diário lido ainda.</li>';
    lore.innerHTML = `<h3>Diários lidos</h3><ul>${items}</ul><h3>Objetivo</h3><p>${g.nestsTotal - g.nestsDead > 3 ? `Destrua os ninhos de micélio (${g.nestsDead}/${g.nestsTotal}). Com no máximo 3 restantes, o Fragmento fica vulnerável.` : 'O Fragmento está vulnerável. Vá ao pátio do Instituto Hélio e destrua-o.'}</p>`;
    $('#codex').hidden = false; g.paused = true;
  }

  // ---------- telas ----------
  function showEnd(win) {
    const g = G();
    g.state = 'end';
    GAME.clearSave();
    $('#end-title').innerHTML = win ? 'O FRAGMENTO <span>CAIU</span>' : 'VOCÊ <span>MORREU</span>';
    $('#end-stats').textContent = (win ? 'A rede do micélio entrou em colapso. A cidade ainda tem uma chance. ' : (g.deathReason || '') + ' ') + `Dia ${g.day}, ${g.kills} criaturas abatidas, ${g.nestsDead} ninhos destruídos.`;
    $('#end').hidden = false;
  }
  function start(saved) {
    SFX.init();
    for (const s of ['#title', '#end']) $(s).hidden = true;
    $('#hud').hidden = false;
    $('#touch').hidden = !GAME.isTouch;
    miniFor = null;
    GAME.startWith(saved);
  }
  function spinPreview(cv, type, getItem) {
    const c = cv.getContext('2d');
    let t = 0;
    const tick = () => {
      t += 1 / 60;
      if (cv.offsetParent !== null) {
        c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = false;
        const dir = Math.floor(t / 1.4) % 8, f = Math.floor(t * 10) % 8;
        c.save(); c.scale(cv.width / 100, cv.width / 100);
        CR.draw(c, type, getItem ? getItem() : null, 'walk', f, dir, 50, 92);
        c.restore();
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------- visualizador ----------
  const vstate = { type: 'player', item: null, anim: 'walk', t: 0 };
  function openViewer() { $('#viewer').hidden = false; if (G().state === 'play') G().paused = true; buildViewer(); }
  function buildViewer() {
    const chips = (box, list, key) => {
      box.innerHTML = '';
      for (const [v, label] of list) {
        const b = el('button', 'chip' + (vstate[key] === v ? ' on' : ''), label); b.type = 'button';
        b.onclick = () => { vstate[key] = v; if (key === 'type') { if (v !== 'player') vstate.item = null; if (!CR.TYPES[v].anims.includes(vstate.anim)) vstate.anim = 'walk'; } buildViewer(); };
        box.appendChild(b);
      }
    };
    const names = { player: 'Protagonista', ...Object.fromEntries(Object.entries(LORE.bestiario).filter(([k]) => CR.TYPES[k]).map(([k, b]) => [k, b.n])) };
    chips($('#v-spec'), Object.keys(CR.TYPES).map((k) => [k, names[k] || k]), 'type');
    chips($('#v-anim'), CR.TYPES[vstate.type].anims.map((a) => [a, CR.ANIMS[a].label]), 'anim');
    $('#v-item-row').hidden = vstate.type !== 'player';
    chips($('#v-item'), [[null, 'Mãos livres'], ['faca', 'Faca'], ['facao', 'Facão'], ['taco', 'Taco'], ['marreta', 'Marreta'], ['katana', 'Katana'], ['pistola', 'Pistola'], ['escopeta', 'Escopeta'], ['fuzil', 'Fuzil'], ['precisao', 'Precisão'], ['lanca', 'Lança-chamas'], ['granada', 'Granada']], 'item');
    const grid = $('#v-grid'); grid.innerHTML = '';
    for (let d = 0; d < 8; d++) {
      const fig = el('figure', 'vcell');
      const cv = el('canvas'); cv.width = 150; cv.height = 160; cv.dataset.dir = d;
      fig.appendChild(cv); fig.appendChild(el('figcaption', '', CR.DIRS[d]));
      grid.appendChild(fig);
    }
    CR.prefetch(vstate.type, vstate.item, [vstate.anim]);
    const A = CR.ANIMS[vstate.anim];
    $('#v-info').textContent = `${A.n} quadros × 8 direções · ${A.fps} fps · gerados a partir de modelos voxel em escala real`;
  }
  function viewerTick() {
    if (!$('#viewer').hidden) {
      CR.work(8);
      vstate.t += 1 / 60;
      const A = CR.ANIMS[vstate.anim];
      const f = A.loop ? Math.floor(vstate.t * A.fps) % A.n : Math.min(A.n - 1, Math.floor((vstate.t * A.fps) % (A.n + 6)));
      for (const cv of document.querySelectorAll('#v-grid canvas')) {
        const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, cv.width, cv.height);
        CR.draw(c, vstate.type, vstate.item, vstate.anim, f, +cv.dataset.dir, 75, 124);
      }
    }
    requestAnimationFrame(viewerTick);
  }

  // ---------- toque ----------
  function bindTouch() {
    const stick = $('#stick'), knob = $('#knob');
    let id = null, cx = 0, cy = 0;
    const mv = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy), R = 44;
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      GAME.setTouch(dx / R, dy / R, true);
    };
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mv(e); });
    stick.addEventListener('pointermove', mv);
    const up = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; GAME.setTouch(0, 0, false); };
    stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
    const tap = (sel, fn) => $(sel).addEventListener('pointerdown', (e) => { e.preventDefault(); SFX.init(); fn(); });
    const atk = $('#t-atk');
    atk.addEventListener('pointerdown', (e) => { e.preventDefault(); SFX.init(); G().touch.fire = true; G().touch.fresh = true; });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) atk.addEventListener(ev, () => { G().touch.fire = false; });
    tap('#t-use', () => GAME.interact());
    tap('#t-run', () => { G().touch.run = !G().touch.run; $('#t-run').classList.toggle('on', G().touch.run); });
    tap('#t-crouch', () => { G().p.crouch = !G().p.crouch; $('#t-crouch').classList.toggle('on', G().p.crouch); });
    tap('#t-bag', () => toggleInv());
    tap('#t-reload', () => GAME.reload());
    tap('#t-light', () => { const p = G().p; if (GAME.count(p.inv, 'lanterna')) p.flash = !p.flash; $('#t-light').classList.toggle('on', p.flash); });
    tap('#t-map', () => toggleMap());
  }

  function init() {
    bindDrag(); bindTouch();
    $('#btn-start').onclick = () => start(null);
    $('#btn-continue').onclick = () => start(GAME.loadSave());
    $('#btn-retry').onclick = () => { $('#end').hidden = true; $('#title').hidden = false; refreshTitle(); };
    $('#btn-sprites').onclick = openViewer;
    $('#btn-resume').onclick = togglePause;
    $('#btn-save').onclick = () => { GAME.save(); toast('Jogo salvo neste navegador.', 'good'); };
    $('#btn-pause-sprites').onclick = () => { $('#pause').hidden = true; openViewer(); };
    $('#btn-pause-codex').onclick = () => { $('#pause').hidden = true; openCodex(); };
    $('#inv-close').onclick = () => toggleInv(false);
    $('#viewer-close').onclick = () => { $('#viewer').hidden = true; G().paused = false; };
    $('#codex-close').onclick = () => { $('#codex').hidden = true; G().paused = false; };
    $('#text-close').onclick = () => { $('#text').hidden = true; G().paused = false; };
    $('#bigmap-close').onclick = () => { $('#bigmap').hidden = true; };
    $('#loot-all').onclick = () => { if (!loot) return; for (let i = 0; i < loot.items.slots.length; i++) if (loot && loot.items.slots[i]) quickMove({ where: 'loot', idx: i }); };
    $('#menu-btn').onclick = () => togglePause();
    $('#codex-btn').onclick = () => openCodex();
    spinPreview($('#title-preview'), 'player');
    spinPreview($('#inv-preview'), 'player', () => (G().p ? GAME.held(G().p) : null));
    viewerTick();
    refreshTitle();
  }
  function refreshTitle() { $('#btn-continue').hidden = !GAME.loadSave(); }

  return { init, refresh, toggleInv, openLoot, closeAll, anyModal, togglePause, toast, banner, hud, showEnd, showText, openViewer, openCodex, toggleMap, equipWear,
    lootOpen: () => !!loot, lootTarget: () => loot };
})();

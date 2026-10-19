'use strict';
// Interface: HUD, inventório, saque, criação, visualizador de sprites, telas e controles de toque.
const UI = (() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const G = () => GAME.G;
  let invOpen = false, loot = null, selected = null, hudT = 0, miniBase = null, miniFor = null;

  // ---------- slots ----------
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
  function backpackBusy() { const p = G().p; return p.inv.slots.some((s, i) => s && i >= 16); }
  function move(src, dst) {
    if (src.where === dst.where && src.idx === dst.idx && src.slot === dst.slot) return;
    const a = get(src), b = get(dst);
    if (!a) return;
    if (src.where === 'equip' && src.slot === 'back' && backpackBusy() && !(b && b.id === 'mochila')) { GAME.say('Esvazie os bolsos extras da mochila primeiro.', 'warn'); return; }
    if (!accepts(dst, a) || !accepts(src, b)) { if (dst.where === 'equip') GAME.say('Esse item não vai nesse lugar.', 'warn'); return; }
    if (b && b.id === a.id && ITEMS[a.id].stack > 1) {
      const k = Math.min(a.qty, ITEMS[a.id].stack - b.qty);
      b.qty += k; a.qty -= k; if (!a.qty) set(src, null);
    } else { set(dst, a); set(src, b); }
    SFX.play('pickup');
    selected = dst;
    afterLootChange();
    refresh();
  }
  function quickMove(ref) {
    const it = get(ref); if (!it) return;
    const p = G().p;
    if (ref.where === 'loot') {
      const left = GAME.addItem(p.inv, it.id, it.qty, GAME.invSize(p));
      if (left === it.qty) { GAME.say('Inventário cheio.', 'warn'); return; }
      if (left) it.qty = left; else set(ref, null);
      SFX.play('pickup');
    } else if (ref.where === 'inv' && loot) {
      const left = GAME.addItem(loot.items, it.id, it.qty);
      if (left) it.qty = left; else set(ref, null);
    } else if (ref.where === 'equip') {
      if (ref.slot === 'back' && backpackBusy()) { GAME.say('Esvazie os bolsos extras da mochila primeiro.', 'warn'); return; }
      const left = GAME.addItem(p.inv, it.id, it.qty, 16);
      if (!left) set(ref, null);
    } else if (ref.where === 'inv' && ITEMS[it.id].kind === 'wear') { equipWear(p.inv, ref.idx); return; }
    afterLootChange();
    refresh();
  }
  function equipWear(c, idx) {
    const it = c.slots[idx]; if (!it) return;
    const slot = ITEMS[it.id].slot;
    move({ where: c === G().p.inv ? 'inv' : 'loot', idx }, { where: 'equip', slot });
  }
  function dropRef(ref) {
    const it = get(ref); if (!it) return;
    if (ref.where === 'equip' && ref.slot === 'back' && backpackBusy()) { GAME.say('Esvazie os bolsos extras da mochila primeiro.', 'warn'); return; }
    set(ref, null);
    const p = G().p;
    GAME.dropItems(p.x, p.y, [it]);
    selected = null;
    refresh();
  }
  function afterLootChange() {
    if (loot && loot.type === 'bolsa' && loot.items.slots.every((s) => !s)) {
      G().map.removeProp(loot);
      closeLoot();
    }
  }

  // ---------- render de slots ----------
  function slotEl(ref, it, extra) {
    const s = el('div', 'slot' + (extra || ''));
    s.dataset.ref = JSON.stringify(ref);
    if (it) {
      const img = el('img'); img.src = ITEM_MODELS.icon(it.id).url; img.alt = ITEMS[it.id].name; img.draggable = false;
      s.appendChild(img);
      if (it.qty > 1) s.appendChild(el('span', 'qty', it.qty));
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
    for (let i = 0; i < n; i++) {
      const s = slotEl({ where: 'inv', idx: i }, p.inv.slots[i], i < 6 ? ' hot' : '');
      if (i < 6) s.appendChild(el('span', 'key', i + 1));
      grid.appendChild(s);
    }
    const w = GAME.weight(p.inv);
    $('#bag-weight').textContent = 'Peso ' + w.toFixed(1) + ' / ' + GAME.maxCarry;
    $('#bag-weight').classList.toggle('over', w > GAME.maxCarry);
    for (const slot of ['head', 'body', 'back']) {
      const box = $('#eq-' + slot); box.innerHTML = '';
      box.appendChild(slotEl({ where: 'equip', slot }, p.equip[slot], ' eq'));
    }
    const lp = $('#loot-panel');
    lp.hidden = !loot;
    if (loot) {
      $('#loot-title').textContent = loot.name;
      const lg = $('#loot-grid'); lg.innerHTML = '';
      loot.items.slots.forEach((it, i) => lg.appendChild(slotEl({ where: 'loot', idx: i }, it)));
      $('#loot-empty').hidden = loot.items.slots.some((s) => s);
    }
    renderDetails();
    renderCraft();
  }
  function renderDetails() {
    const box = $('#details'); box.innerHTML = '';
    const it = selected && get(selected);
    if (!it) { box.appendChild(el('p', 'hint', 'Toque num item para ver detalhes. Arraste para mover. Shift + clique transfere direto.')); return; }
    const d = ITEMS[it.id];
    const head = el('div', 'd-head');
    const img = el('img'); img.src = ITEM_MODELS.icon(it.id).url; img.alt = '';
    head.appendChild(img);
    const tx = el('div', 'd-text');
    tx.appendChild(el('h3', '', d.name + (it.qty > 1 ? ' ×' + it.qty : '')));
    const stats = [];
    if (d.dmg) stats.push('Dano ' + d.dmg);
    if (d.kind === 'gun') stats.push('Munição: ' + GAME.count(G().p.inv, d.ammo));
    stats.push('Peso ' + d.w);
    tx.appendChild(el('p', '', d.desc + ' <span class="muted">' + stats.join(' · ') + '</span>'));
    head.appendChild(tx);
    box.appendChild(head);
    const acts = el('div', 'd-acts');
    const btn = (label, fn) => { const b = el('button', 'btn small', label); b.type = 'button'; b.onclick = fn; acts.appendChild(b); };
    const ref = selected;
    if (ref.where === 'loot') btn('Pegar', () => quickMove(ref));
    if (ref.where === 'inv' || ref.where === 'loot') {
      if (d.kind === 'food' || d.kind === 'med') btn(d.kind === 'food' ? 'Consumir' : 'Usar', () => GAME.useItem(ref.where === 'inv' ? G().p.inv : loot.items, ref.idx));
      if (d.kind === 'wear') btn('Vestir', () => equipWear(ref.where === 'inv' ? G().p.inv : loot.items, ref.idx));
      if (ref.where === 'inv' && ['melee', 'gun', 'place'].includes(d.kind) && ref.idx !== G().p.hot) btn('Segurar', () => { const p = G().p; if (ref.idx < 6) p.hot = ref.idx; else move(ref, { where: 'inv', idx: p.hot }); refresh(); });
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

  // arrastar e soltar (mouse e toque)
  function bindDrag() {
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
      const s = e.target.closest('#inv .slot');
      if (!s) return;
      const ref = JSON.parse(s.dataset.ref);
      if (e.shiftKey) { quickMove(ref); return; }
      drag = { ref, x: e.clientX, y: e.clientY, ghost: null, el: s };
    });
    document.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6 && get(drag.ref)) {
        drag.ghost = el('img', 'ghost'); drag.ghost.src = ITEM_MODELS.icon(get(drag.ref).id).url; document.body.appendChild(drag.ghost);
      }
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
        if (same && e.detail >= 2) quickMove(d.ref);
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
  function closeAll() { $('#viewer').hidden = true; $('#pause').hidden = true; G().paused = false; toggleInv(false); }
  function togglePause() { const pz = $('#pause'); pz.hidden = !pz.hidden; G().paused = !pz.hidden; }

  function toast(text, kind) {
    const box = $('#log');
    const t = el('div', 'toast ' + (kind || ''), text);
    box.appendChild(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 5000);
  }
  function banner(text) {
    const b = $('#banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }

  // ---------- HUD ----------
  function hud(dt) {
    hudT -= dt;
    const g = G(), p = g.p;
    if (!p || hudT > 0) return;
    hudT = 0.1;
    const setBar = (id, v) => { const b = $('#' + id); b.style.setProperty('--v', Math.max(0, v) + '%'); b.classList.toggle('low', v < 25); };
    setBar('b-hp', p.hp); setBar('b-food', p.hunger); setBar('b-water', p.thirst); setBar('b-stam', p.stamina);
    const st = [];
    if (p.bleed) st.push('<span class="bad">Sangrando</span>');
    if (p.crouch) st.push('Agachada');
    if (p.flash) st.push('Lanterna');
    if (GAME.weight(p.inv) > GAME.maxCarry) st.push('<span class="warn">Sobrecarga</span>');
    if (p.hunger < 20) st.push('<span class="warn">Faminta</span>');
    if (p.thirst < 20) st.push('<span class="warn">Com sede</span>');
    $('#status').innerHTML = st.join(' · ');
    const h = Math.floor(g.time % 24), m = Math.floor((g.time % 1) * 60);
    $('#clock').textContent = 'Dia ' + g.day + ' · ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    $('#kills').textContent = g.kills + ' abatidos';
    $('#horde').textContent = g.hordeT < 60 ? 'Horda em ' + Math.ceil(g.hordeT) + 's' : '';
    const it = !p.dead && !g.uiOpen ? GAME.nearestInteract() : null;
    const pr = $('#prompt');
    const hk = GAME.held(p);
    if (it) pr.innerHTML = (GAME.isTouch ? '' : '<kbd>E</kbd> ') + it.label;
    else if (hk === 'barricada') pr.innerHTML = (GAME.isTouch ? 'Toque em Atacar' : '<kbd>Botão direito</kbd>') + ' para construir';
    else pr.innerHTML = '';
    pr.hidden = !pr.innerHTML;
    drawMini();
  }
  function drawMini() {
    const g = G(), M = g.map, N = M.N;
    const cv = $('#mini'), c = cv.getContext('2d');
    if (miniFor !== M) {
      miniFor = M;
      miniBase = document.createElement('canvas'); miniBase.width = N * 2; miniBase.height = N;
      const b = miniBase.getContext('2d');
      const col = { 0: '#3e5a2c', 1: '#5e4a32', 2: '#2c2c32', 3: '#2c2c32', 4: '#2c2c32', 5: '#6a6862', 6: '#8a5c36', 7: '#a89c8c', 8: '#c4ccd0', 9: '#6a6a64', 10: '#5c5e4c', 11: '#5c3a5c' };
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i;
        let cc = col[M.floor[k]];
        if (M.wallN[k] || M.wallW[k]) cc = '#e8e2cc';
        const pr = M.prop(i, j); if (pr && pr.type === 'arvore') cc = '#22381c';
        b.fillStyle = cc; b.fillRect(i - j + N - 1, Math.floor((i + j) / 2), 2, 1);
      }
    }
    c.clearRect(0, 0, cv.width, cv.height);
    const p = g.p;
    const px = p.x - p.y + N, py = (p.x + p.y) / 2;
    const ox = Math.round(cv.width / 2 - px), oy = Math.round(cv.height / 2 - py);
    c.drawImage(miniBase, ox, oy);
    c.fillStyle = '#ff4a3a';
    for (const z of g.zombies) {
      if (z.dead || Math.hypot(z.x - p.x, z.y - p.y) > 22) continue;
      c.fillRect(Math.round(z.x - z.y + N + ox - 1), Math.round((z.x + z.y) / 2 + oy), 2, 1);
    }
    c.fillStyle = '#ffffff'; c.fillRect(Math.round(px + ox - 1), Math.round(py + oy - 1), 3, 3);
  }

  // ---------- telas ----------
  function showDeath() {
    const g = G();
    g.state = 'dead';
    $('#death-stats').textContent = `Sobreviveu até o dia ${g.day} às ${String(Math.floor(g.time % 24)).padStart(2, '0')}h e abateu ${g.kills} zumbi${g.kills === 1 ? '' : 's'}.`;
    $('#death').hidden = false;
  }
  function start() {
    SFX.init();
    $('#title').hidden = true; $('#death').hidden = true;
    $('#hud').hidden = false;
    $('#touch').hidden = !GAME.isTouch;
    GAME.newGame();
    miniFor = null;
  }

  // prévia girando na tela inicial e no inventário
  function spinPreview(cv, spec, getItem) {
    const c = cv.getContext('2d');
    let t = 0;
    const tick = () => {
      t += 1 / 60;
      if (cv.offsetParent !== null) {
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        const dir = Math.floor(t / 1.2) % 8;
        const sh = CHR.sheet(spec, getItem ? getItem() : null, 'walk');
        const f = Math.floor(t * 10) % sh.n;
        c.drawImage(sh.canvas, f * CHR.FW + 18, dir * CHR.FH + 12, 56, 68, 0, 0, cv.width, cv.width * 68 / 56);
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------- visualizador de sprites ----------
  const vstate = { spec: 'player', item: null, anim: 'walk', t: 0 };
  function openViewer() {
    $('#viewer').hidden = false;
    G().paused = G().state === 'play';
    buildViewer();
  }
  function buildViewer() {
    const chips = (box, list, key) => {
      box.innerHTML = '';
      for (const [v, label] of list) {
        const b = el('button', 'chip' + (vstate[key] === v ? ' on' : ''), label); b.type = 'button';
        b.onclick = () => { vstate[key] = v; if (key === 'spec' && v !== 'player') vstate.item = null; if (key === 'spec' && v !== 'player' && !CHR.ZOMBIE_ANIMS.includes(vstate.anim)) vstate.anim = 'walk'; buildViewer(); };
        box.appendChild(b);
      }
    };
    chips($('#v-spec'), [['player', 'Protagonista'], ['z_civil', 'Zumbi civil'], ['z_xadrez', 'Zumbi xadrez'], ['z_regata', 'Zumbi regata'], ['z_cientista', 'Cientista infectado'], ['z_corredor', 'Corredor']], 'spec');
    const anims = (vstate.spec === 'player' ? CHR.PLAYER_ANIMS : CHR.ZOMBIE_ANIMS).map((a) => [a, CHR.ANIMS[a].label]);
    chips($('#v-anim'), anims, 'anim');
    const items = [[null, 'Mãos livres'], ['taco', 'Taco'], ['cano', 'Cano'], ['machado', 'Machado'], ['faca', 'Faca'], ['pistola', 'Pistola']];
    $('#v-item-row').hidden = vstate.spec !== 'player';
    chips($('#v-item'), items, 'item');
    const grid = $('#v-grid'); grid.innerHTML = '';
    for (let d = 0; d < 8; d++) {
      const fig = el('figure', 'vcell');
      const cv = el('canvas'); cv.width = CHR.FW * 2; cv.height = CHR.FH * 2; cv.dataset.dir = d;
      fig.appendChild(cv); fig.appendChild(el('figcaption', '', CHR.DIR_NAMES[d]));
      grid.appendChild(fig);
    }
    const sh = CHR.sheet(vstate.spec, vstate.item, vstate.anim);
    $('#v-info').textContent = `${sh.n} quadros × 8 direções · ${CHR.FW}×${CHR.FH} px por quadro · ${sh.fps} fps`;
    const dl = $('#v-download');
    dl.hidden = window.top !== window;
    dl.onclick = () => { const a = document.createElement('a'); a.href = sh.canvas.toDataURL('image/png'); a.download = `${vstate.spec}_${vstate.item || 'mao'}_${vstate.anim}.png`; a.click(); };
  }
  function viewerTick() {
    if (!$('#viewer').hidden) {
      vstate.t += 1 / 60;
      const sh = CHR.sheet(vstate.spec, vstate.item, vstate.anim);
      const f = sh.loop ? Math.floor(vstate.t * sh.fps) % sh.n : Math.min(sh.n - 1, Math.floor((vstate.t * sh.fps) % (sh.n + 6)));
      for (const cv of document.querySelectorAll('#v-grid canvas')) {
        const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, cv.width, cv.height);
        c.drawImage(sh.canvas, f * CHR.FW, +cv.dataset.dir * CHR.FH, CHR.FW, CHR.FH, 0, 0, cv.width, cv.height);
      }
    }
    requestAnimationFrame(viewerTick);
  }

  // ---------- toque ----------
  function bindTouch() {
    const stick = $('#stick'), knob = $('#knob');
    let id = null, cx = 0, cy = 0;
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mv(e); });
    const mv = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy), R = 44;
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      GAME.setTouch(dx / R, dy / R, true);
    };
    stick.addEventListener('pointermove', mv);
    const up = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; GAME.setTouch(0, 0, false); };
    stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
    const tap = (sel, fn) => $(sel).addEventListener('pointerdown', (e) => { e.preventDefault(); SFX.init(); fn(); });
    tap('#t-atk', () => GAME.attack());
    tap('#t-use', () => GAME.interact());
    tap('#t-run', () => { G().touch.run = !G().touch.run; $('#t-run').classList.toggle('on', G().touch.run); });
    tap('#t-crouch', () => { G().p.crouch = !G().p.crouch; $('#t-crouch').classList.toggle('on', G().p.crouch); });
    tap('#t-bag', () => toggleInv());
    tap('#t-light', () => { const p = G().p; if (GAME.count(p.inv, 'lanterna')) p.flash = !p.flash; $('#t-light').classList.toggle('on', p.flash); });
  }

  function init() {
    bindDrag();
    bindTouch();
    $('#btn-start').onclick = start;
    $('#btn-retry').onclick = start;
    $('#btn-sprites').onclick = openViewer;
    $('#btn-resume').onclick = togglePause;
    $('#btn-pause-sprites').onclick = () => { $('#pause').hidden = true; openViewer(); };
    $('#inv-close').onclick = () => toggleInv(false);
    $('#viewer-close').onclick = () => { $('#viewer').hidden = true; G().paused = false; };
    $('#loot-all').onclick = () => {
      if (!loot) return;
      for (let i = 0; i < loot.items.slots.length; i++) if (loot.items.slots[i]) quickMove({ where: 'loot', idx: i });
    };
    $('#menu-btn').onclick = () => togglePause();
    spinPreview($('#title-preview'), 'player');
    spinPreview($('#inv-preview'), 'player', () => (G().p ? (GAME.held(G().p) && ITEMS[GAME.held(G().p)].model ? GAME.held(G().p) : null) : null));
    viewerTick();
  }

  return { init, refresh, toggleInv, openLoot, closeAll, togglePause, toast, banner, hud, showDeath, openViewer, equipWear,
    lootOpen: () => !!loot, lootTarget: () => loot };
})();

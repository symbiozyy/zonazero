'use strict';
// Itens: definições, modelos voxel (ícones + item na mão) e tabelas de saque.
const ITEMS = {
  taco:       { name: 'Taco de Beisebol', kind: 'melee', dmg: 30, range: 1.35, speed: 1.0, w: 1.5, stack: 1, model: 'taco', desc: 'Pesado e confiável. Empurra os zumbis para trás.' },
  cano:       { name: 'Cano de Ferro', kind: 'melee', dmg: 26, range: 1.3, speed: 1.05, w: 2, stack: 1, model: 'cano', desc: 'Encontrado em obras e garagens.' },
  machado:    { name: 'Machado', kind: 'melee', dmg: 48, range: 1.35, speed: 0.8, w: 2.5, stack: 1, model: 'machado', desc: 'Lento, mas resolve com um golpe só.' },
  faca:       { name: 'Faca de Cozinha', kind: 'melee', dmg: 18, range: 1.05, speed: 1.45, w: 0.4, stack: 1, model: 'faca', desc: 'Rápida e silenciosa.' },
  pistola:    { name: 'Pistola 9mm', kind: 'gun', dmg: 70, range: 13, speed: 1.0, w: 1, stack: 1, ammo: 'municao', model: 'pistola', desc: 'Usa Munição 9mm. O barulho atrai zumbis de longe.' },
  municao:    { name: 'Munição 9mm', kind: 'ammo', w: 0.02, stack: 60, desc: 'Caixa de cartuchos.' },
  lanterna:   { name: 'Lanterna', kind: 'tool', w: 0.4, stack: 1, desc: 'Tecla F liga e desliga quando está na mochila.' },
  feijao:     { name: 'Feijão Enlatado', kind: 'food', hunger: 35, w: 0.5, stack: 5, desc: 'Fome +35' },
  salgadinho: { name: 'Salgadinho', kind: 'food', hunger: 14, thirst: -4, w: 0.15, stack: 5, desc: 'Fome +14, Sede -4' },
  refri:      { name: 'Refrigerante', kind: 'food', thirst: 28, hunger: 4, w: 0.4, stack: 5, desc: 'Sede +28, Fome +4' },
  agua:       { name: 'Garrafa de Água', kind: 'food', thirst: 45, w: 0.6, stack: 5, desc: 'Sede +45' },
  bandagem:   { name: 'Bandagem', kind: 'med', heal: 12, bleed: true, w: 0.1, stack: 10, desc: 'Vida +12 e estanca sangramento.' },
  analgesico: { name: 'Analgésicos', kind: 'med', heal: 8, w: 0.1, stack: 10, desc: 'Vida +8' },
  kit:        { name: 'Kit Médico', kind: 'med', heal: 55, bleed: true, w: 0.8, stack: 3, desc: 'Vida +55 e estanca sangramento.' },
  pano:       { name: 'Pano', kind: 'material', w: 0.1, stack: 10, desc: 'Vira bandagem na aba Criar.' },
  tabuas:     { name: 'Tábuas', kind: 'material', w: 1, stack: 10, desc: 'Material para barricadas.' },
  pregos:     { name: 'Pregos', kind: 'material', w: 0.05, stack: 50, desc: 'Material para barricadas.' },
  barricada:  { name: 'Barricada', kind: 'place', w: 2, stack: 5, desc: 'Selecione na barra e clique com o botão direito (ou R) para construir.' },
  capacete:   { name: 'Capacete Militar', kind: 'wear', slot: 'head', armor: 0.25, w: 1, stack: 1, desc: 'Reduz 25% do dano recebido.' },
  colete:     { name: 'Colete Tático', kind: 'wear', slot: 'body', armor: 0.3, w: 2.5, stack: 1, desc: 'Reduz 30% do dano recebido.' },
  mochila:    { name: 'Mochila', kind: 'wear', slot: 'back', slots: 8, w: 0.8, stack: 1, desc: '+8 espaços no inventário.' },
};

const RECIPES = [
  { out: 'bandagem', qty: 1, need: { pano: 1 } },
  { out: 'barricada', qty: 1, need: { tabuas: 2, pregos: 4 } },
  { out: 'kit', qty: 1, need: { bandagem: 2, analgesico: 1 } },
];

const LOOT = {
  geladeira: [['feijao', 3], ['refri', 4], ['agua', 4], ['salgadinho', 2]],
  armario:   [['feijao', 4], ['salgadinho', 3], ['agua', 2], ['pano', 3], ['faca', 1], ['lanterna', 1]],
  prateleira:[['feijao', 4], ['salgadinho', 4], ['refri', 3], ['agua', 3], ['pano', 1]],
  farmacia:  [['bandagem', 5], ['analgesico', 5], ['kit', 1], ['pano', 2], ['agua', 1]],
  lab:       [['bandagem', 3], ['analgesico', 3], ['kit', 1], ['pano', 3], ['lanterna', 1], ['agua', 2]],
  bancada:   [['tabuas', 4], ['pregos', 4], ['cano', 2], ['machado', 1], ['pano', 2], ['lanterna', 1]],
  caixa:     [['tabuas', 4], ['pregos', 3], ['cano', 1], ['taco', 1], ['feijao', 2], ['pano', 2]],
  lixeira:   [['pano', 3], ['salgadinho', 2], ['pregos', 1], ['refri', 1]],
  policia:   [['pistola', 2], ['municao', 4], ['colete', 1], ['capacete', 1], ['bandagem', 2], ['lanterna', 2], ['taco', 1]],
  militar:   [['municao', 5], ['pistola', 1], ['capacete', 2], ['colete', 2], ['kit', 1], ['feijao', 2]],
  carro:     [['taco', 1], ['agua', 2], ['pano', 2], ['tabuas', 1], ['mochila', 1], ['refri', 1]],
  mesa:      [['analgesico', 2], ['lanterna', 1], ['municao', 1], ['salgadinho', 2], ['refri', 1]],
  guardaroupa: [['pano', 4], ['mochila', 1], ['bandagem', 1]],
};

function rollLoot(table, rng) {
  const t = LOOT[table] || LOOT.caixa;
  const n = Math.floor(rng() * 3.2) + (rng() < 0.15 ? 1 : 0);
  const res = [];
  const total = t.reduce((s, e) => s + e[1], 0);
  for (let i = 0; i < n; i++) {
    let r = rng() * total;
    for (const [id, w] of t) {
      if ((r -= w) <= 0) {
        const def = ITEMS[id];
        let q = 1;
        if (id === 'municao') q = 6 + Math.floor(rng() * 14);
        else if (id === 'pregos') q = 4 + Math.floor(rng() * 8);
        else if (id === 'tabuas') q = 1 + Math.floor(rng() * 3);
        else if (def.stack > 1 && rng() < 0.3) q = 2;
        res.push({ id, qty: q });
        break;
      }
    }
  }
  return res;
}

// ---------- modelos voxel dos itens ----------
// Convenção: pegada na origem, item cresce em +z, "cima" é +y.
const ITEM_MODELS = (() => {
  const H = VX.hash;
  const wood = (i) => (H(i.x, i.y, i.z) > 0.7 ? '#a8743c' : '#c08a4a');
  const metal = (i) => (H(i.x, i.y, i.z) > 0.75 ? '#9aa3ab' : '#7d868e');
  const B = {
    taco(m, p) {
      m.box(p, -1, -1, -2, 2, 2, 6, '#2b2730');
      m.box(p, -1, -1, 4, 2, 2, 5, wood);
      m.box(p, -1.5, -1.5, 9, 3, 3, 6, wood);
    },
    cano(m, p) {
      m.box(p, -1, -1, -2, 2, 2, 16, metal);
      m.box(p, -1.5, -1.5, 12, 3, 3, 2, '#5d646b');
    },
    machado(m, p) {
      m.box(p, -1, -1, -2, 2, 2, 15, wood);
      m.box(p, -1, -1, 9, 2, 5, 3, '#6a7178');
      m.box(p, -1, 4, 8, 2, 2, 5, (i) => (i.iz === 0 || i.iz === 4 ? '#d8dde2' : '#b8c0c8'));
      m.box(p, -1, -3, 10, 2, 2, 2, '#4a5056');
    },
    faca(m, p) {
      m.box(p, -0.5, -1, -1, 1, 2, 3, '#24222a');
      m.box(p, -0.5, -1, 2, 1, 2, 6, (i) => (i.iy === 1 ? '#e8ecf0' : '#b9c2ca'));
      m.box(p, -0.5, -1, 8, 1, 1, 1, '#b9c2ca');
    },
    pistola(m, p) {
      m.box(p, -1, -1, -1, 2, 2, 7, '#3a3d44');
      m.box(p, -1, 1, -1, 2, 1, 7, '#2a2c32');
      m.box(p, -1, -4, -1, 2, 3, 2, '#25262c');
    },
    lanterna(m, p) {
      m.cyl(p, 'z', 0, 0, 1.6, -1, 7, '#30333a');
      m.cyl(p, 'z', 0, 0, 2.4, 6, 2, (i) => (i.cap1 ? '#fff4b0' : '#50545c'));
    },
    feijao(m, p) {
      m.cyl(p, 'y', 0, 0, 3.2, 0, 7, (i) => (i.cap1 || i.cap0 ? '#b8bec4' : i.k > 1 && i.k < 5 ? (i.u < 0 ? '#c0502e' : '#e2b04a') : '#9aa0a6'));
    },
    salgadinho(m, p) {
      m.box(p, -3, 0, -1, 6, 8, 2, (i) => (i.iy === 7 || i.iy === 0 ? '#c03030' : i.iy > 2 && i.iy < 6 && i.front ? '#f2d14a' : '#e8a020'));
    },
    refri(m, p) {
      m.cyl(p, 'y', 0, 0, 2.2, 0, 6, (i) => (i.cap1 ? '#c8ccd0' : i.k === 3 ? '#f0f0f0' : '#c4282c'));
    },
    agua(m, p) {
      m.cyl(p, 'y', 0, 0, 2.2, 0, 8, (i) => (i.k > 2 && i.k < 5 ? '#e8eef4' : '#6ab4e8'));
      m.cyl(p, 'y', 0, 0, 1.2, 8, 2, '#2a64c8');
    },
    bandagem(m, p) {
      m.cyl(p, 'x', 0, 0, 3, -2, 5, (i) => (i.cap0 || i.cap1 ? (Math.abs(i.u) < 1 && Math.abs(i.v) < 1 ? '#a89070' : '#e6dcc4') : '#efe6d0'));
    },
    analgesico(m, p) {
      m.cyl(p, 'y', 0, 0, 2.2, 0, 5, (i) => (i.k === 2 ? '#ffffff' : '#e07a20'));
      m.cyl(p, 'y', 0, 0, 2.2, 5, 2, '#f4f4f4');
    },
    kit(m, p) {
      m.box(p, -4, 0, -3, 8, 6, 6, (i) => {
        const cx = Math.abs(i.x), cz = Math.abs(i.z);
        if (i.top && ((cx < 1 && cz < 2.5) || (cz < 1 && cx < 2.5))) return '#ffffff';
        if (i.front && ((Math.abs(i.x) < 1 && i.iy > 0 && i.iy < 5) || (i.iy === 2 || i.iy === 3) && Math.abs(i.x) < 2.5)) return '#ffffff';
        return '#c62a2a';
      });
      m.box(p, -1.5, 6, -0.5, 3, 1, 1, '#3a2a2a');
    },
    municao(m, p) {
      m.box(p, -3, 0, -2, 6, 4, 4, (i) => (i.top ? '#5a6a3a' : i.iy === 1 && i.front ? '#d4a838' : '#4a5a30'));
      for (let k = -2; k <= 1; k++) m.box(p, k, 4, -1, 1, 2, 1, (i) => (i.top ? '#b87a30' : '#d8b048'));
    },
    pano(m, p) {
      m.box(p, -3.5, 0, -3, 7, 2, 6, (i) => (H(i.x, i.y, i.z) > 0.6 ? '#c9c2b4' : '#ded8cc'));
    },
    tabuas(m, p) {
      for (let k = 0; k < 3; k++) m.box(p, -7 + k, k * 2, -2 + (k % 2), 13, 2, 3, (i) => (i.iz === 1 && i.ix % 5 === 2 ? '#8a5a2c' : wood(i)));
    },
    pregos(m, p) {
      m.box(p, -3, 0, -2, 6, 3, 4, (i) => (i.top ? '#8f969d' : '#7a6248'));
      for (let k = 0; k < 4; k++) m.box(p, -2 + k * 1.2, 3, -1 + (k % 2), 1, 2, 1, '#c0c6cc');
    },
    barricada(m, p) {
      for (let k = 0; k < 4; k++) m.box(p, -6, k * 3, -1, 12, 2, 2, wood);
      m.box(p, -5, 0, 1, 2, 12, 1, '#8a5a2c');
      m.box(p, 3, 0, 1, 2, 12, 1, '#8a5a2c');
    },
    capacete(m, p) {
      m.ellipsoid(p, 0, 0, 0, 5, 4.5, 5.5, (i) => (i.y < 0.3 ? null : H(i.x, i.y, i.z) > 0.8 ? '#4c5a34' : '#5f6e40'));
      m.box(p, -5, 0, -5.5, 10, 1, 11, (i) => (Math.hypot(i.x / 5.4, i.z / 6) > 0.86 && Math.hypot(i.x / 5.4, i.z / 6) < 1.05 ? '#4a5630' : null));
    },
    colete(m, p) {
      m.box(p, -5, 0, -2, 10, 11, 4, (i) => {
        if (i.top && Math.abs(i.x) < 2.6) return null;
        if (i.front && i.iy > 2 && i.iy < 6 && Math.abs(Math.abs(i.x) - 2.5) < 1.2) return '#2c3020';
        return H(i.x, i.y, i.z) > 0.8 ? '#363c28' : '#454c32';
      });
    },
    mochila(m, p) {
      m.box(p, -4, 0, -2, 8, 11, 5, (i) => (i.top && i.iz < 3 ? '#5a6436' : H(i.x, i.y, i.z) > 0.85 ? '#4f5830' : '#66713e'));
      m.box(p, -3, 1, 3, 6, 5, 1, '#59633a');
      m.box(p, -1, 5, 4, 2, 1, 1, '#2e3020');
    },
  };
  const cache = {};
  function model(id) {
    if (cache[id]) return cache[id];
    const m = new VX.Model();
    m.part('root', null, [0, 0, 0]);
    (B[id] || B.pano)(m, 'root');
    return (cache[id] = m);
  }
  const icons = {};
  function icon(id) {
    if (icons[id]) return icons[id];
    const cv = VX.renderFit(model(id), {}, { W: 24, H: 24, yaw: -Math.PI / 4 + (['taco', 'cano', 'machado', 'faca', 'pistola', 'lanterna'].includes(id) ? Math.PI / 2 : 0), pad: 1 });
    icons[id] = { canvas: cv, url: cv.toDataURL() };
    return icons[id];
  }
  return { build: B, model, icon };
})();

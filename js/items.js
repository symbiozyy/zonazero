'use strict';
// Itens: definições, modelos voxel (ícone, item na mão e no chão), receitas e tabelas de saque.
// Escala: 30 voxels = 1 metro. Convenção do modelo: empunhadura na origem, item aponta para +z, cima = +y.
const ITEMS = {
  // corpo a corpo (uma mão)
  faca:        { name: 'Faca de Combate', kind: 'melee1', dmg: 22, range: 1.35, speed: 1.5, w: 0.3, stack: 1, desc: 'Rápida e silenciosa. Boa para quem prefere não chamar atenção.' },
  facao:       { name: 'Facão', kind: 'melee1', dmg: 34, range: 1.6, speed: 1.15, w: 0.8, stack: 1, desc: 'Corta galhos, cogumelos e o que mais aparecer.' },
  cano:        { name: 'Cano de Ferro', kind: 'melee1', dmg: 27, range: 1.7, speed: 1.0, w: 1.6, stack: 1, knock: 0.5, desc: 'Pesado e enferrujado.' },
  pe_de_cabra: { name: 'Pé de Cabra', kind: 'melee1', dmg: 30, range: 1.6, speed: 1.05, w: 1.4, stack: 1, knock: 0.5, desc: 'Ferramenta clássica de sobrevivência.' },
  // corpo a corpo (duas mãos)
  taco:        { name: 'Taco de Beisebol', kind: 'melee2', dmg: 38, range: 1.9, speed: 0.95, w: 1.1, stack: 1, knock: 0.8, desc: 'Arco amplo; acerta até três inimigos.' },
  marreta:     { name: 'Marreta', kind: 'melee2', dmg: 64, range: 1.9, speed: 0.6, w: 4, stack: 1, knock: 1.3, desc: 'Lenta. Esmaga carapaças alienígenas.' },
  machado:     { name: 'Machado de Incêndio', kind: 'melee2', dmg: 56, range: 1.9, speed: 0.72, w: 2.6, stack: 1, knock: 0.7, desc: 'Arromba portas e derruba ninhos.' },
  katana:      { name: 'Katana', kind: 'melee2', dmg: 50, range: 2.0, speed: 1.15, w: 1.2, stack: 1, knock: 0.4, desc: 'Lâmina de colecionador. Afiadíssima.' },
  // armas de fogo
  pistola:     { name: 'Pistola 9mm', kind: 'pistol', dmg: 34, mag: 12, ammo: 'm9', rof: 0.2, spread: 0.035, noise: 22, range: 18, reload: 1.1, w: 0.9, stack: 1, desc: 'Confiável. Munição 9mm.' },
  revolver:    { name: 'Revólver .38', kind: 'pistol', dmg: 72, mag: 6, ammo: 'm38', rof: 0.45, spread: 0.02, noise: 26, range: 20, reload: 1.8, w: 1.1, stack: 1, desc: 'Seis tiros que resolvem.' },
  smg:         { name: 'Submetralhadora', kind: 'rifle', auto: 1, dmg: 21, mag: 30, ammo: 'm9', rof: 0.075, spread: 0.08, noise: 24, range: 16, reload: 1.6, w: 2.6, stack: 1, grip2: 7, desc: 'Automática. Gasta 9mm muito rápido.' },
  escopeta:    { name: 'Escopeta de Repetição', kind: 'rifle', dmg: 17, pellets: 8, mag: 6, ammo: 'c12', rof: 0.85, spread: 0.17, noise: 30, range: 10, reload: 2.2, w: 3.4, stack: 1, grip2: 11, knock: 0.9, desc: 'Devastadora de perto. Cartuchos calibre 12.' },
  fuzil:       { name: 'Fuzil de Assalto', kind: 'rifle', auto: 1, dmg: 40, mag: 30, ammo: 'm556', rof: 0.1, spread: 0.045, noise: 32, range: 24, reload: 1.9, w: 3.6, stack: 1, grip2: 10, desc: 'Automático. Munição 5.56.' },
  precisao:    { name: 'Rifle de Precisão', kind: 'rifle', dmg: 160, pierce: 3, mag: 5, ammo: 'm308', rof: 1.25, spread: 0.004, noise: 40, range: 34, reload: 2.6, w: 5, stack: 1, grip2: 12, desc: 'Atravessa até três alvos. Munição .308.' },
  lanca:       { name: 'Lança-chamas', kind: 'rifle', flame: 1, auto: 1, dmg: 7, mag: 60, ammo: 'combustivel', rof: 0.06, range: 5.5, noise: 10, reload: 2.4, w: 6, stack: 1, grip2: 9, desc: 'Fogo é a única coisa que o micélio teme. Usa combustível.' },
  // arremessáveis
  granada:     { name: 'Granada', kind: 'throw', blast: 3.4, dmg: 150, w: 0.4, stack: 5, desc: 'Explode 2 segundos depois de arremessada.' },
  molotov:     { name: 'Coquetel Molotov', kind: 'throw', fire: 2.4, w: 0.6, stack: 5, desc: 'Cria uma área de fogo. Fungos queimam em dobro.' },
  // munição
  m9:          { name: 'Munição 9mm', kind: 'ammo', w: 0.01, stack: 90, desc: 'Pistola e submetralhadora.' },
  m38:         { name: 'Munição .38', kind: 'ammo', w: 0.012, stack: 48, desc: 'Revólver.' },
  c12:         { name: 'Cartuchos Calibre 12', kind: 'ammo', w: 0.04, stack: 32, desc: 'Escopeta.' },
  m556:        { name: 'Munição 5.56', kind: 'ammo', w: 0.012, stack: 90, desc: 'Fuzil de assalto.' },
  m308:        { name: 'Munição .308', kind: 'ammo', w: 0.025, stack: 30, desc: 'Rifle de precisão.' },
  combustivel: { name: 'Combustível', kind: 'ammo', w: 0.02, stack: 120, desc: 'Lança-chamas e coquetéis molotov.' },
  // comida e remédio
  feijao:      { name: 'Feijão Enlatado', kind: 'food', hunger: 35, w: 0.5, stack: 5, desc: 'Fome +35' },
  salgadinho:  { name: 'Salgadinho', kind: 'food', hunger: 14, thirst: -4, w: 0.15, stack: 5, desc: 'Fome +14 · Sede −4' },
  chocolate:   { name: 'Barra de Chocolate', kind: 'food', hunger: 12, sanity: 6, w: 0.1, stack: 8, desc: 'Fome +12 · Sanidade +6' },
  refri:       { name: 'Refrigerante', kind: 'food', thirst: 28, hunger: 4, w: 0.4, stack: 5, desc: 'Sede +28 · Fome +4' },
  agua:        { name: 'Garrafa de Água', kind: 'food', thirst: 45, w: 0.6, stack: 5, empty: 'garrafa', desc: 'Sede +45' },
  bandagem:    { name: 'Bandagem', kind: 'med', heal: 12, bleed: true, w: 0.1, stack: 10, desc: 'Vida +12 e estanca sangramento.' },
  analgesico:  { name: 'Analgésicos', kind: 'med', heal: 8, w: 0.1, stack: 10, desc: 'Vida +8' },
  kit:         { name: 'Kit de Primeiros Socorros', kind: 'med', heal: 55, bleed: true, w: 0.8, stack: 3, desc: 'Vida +55 e estanca sangramento.' },
  antifungico: { name: 'Antifúngico', kind: 'med', cure: 35, w: 0.1, stack: 10, desc: 'Contaminação −35' },
  soro:        { name: 'Soro Experimental', kind: 'med', cure: 100, heal: 20, sanity: -10, w: 0.2, stack: 3, desc: 'Zera a contaminação. Efeitos colaterais desconhecidos.' },
  calmante:    { name: 'Calmantes', kind: 'med', sanity: 35, w: 0.1, stack: 10, desc: 'Sanidade +35' },
  // materiais
  pano:        { name: 'Pano', kind: 'material', w: 0.1, stack: 10, desc: 'Bandagens, filtros e molotovs.' },
  tabuas:      { name: 'Tábuas', kind: 'material', w: 1, stack: 12, desc: 'Barricadas, paredes e fogueiras.' },
  pregos:      { name: 'Pregos', kind: 'material', w: 0.01, stack: 60, desc: 'Construção.' },
  fita:        { name: 'Fita Silver Tape', kind: 'material', w: 0.2, stack: 5, desc: 'Conserta quase tudo.' },
  garrafa:     { name: 'Garrafa Vazia', kind: 'material', w: 0.2, stack: 5, desc: 'Base do coquetel molotov.' },
  carvao:      { name: 'Carvão Ativado', kind: 'material', w: 0.2, stack: 10, desc: 'Vira filtro de máscara.' },
  polvora:     { name: 'Pólvora', kind: 'material', w: 0.1, stack: 20, desc: 'Explosivos caseiros.' },
  nucleo:      { name: 'Núcleo de Micélio', kind: 'material', w: 0.5, stack: 10, glow: 1, desc: 'Pulsa com luz própria. Pesquisadores pagariam caro.' },
  // equipamento
  capacete:    { name: 'Capacete Militar', kind: 'wear', slot: 'head', armor: 0.2, w: 1.2, stack: 1, desc: 'Dano recebido −20%.' },
  mascara:     { name: 'Máscara de Gás', kind: 'wear', slot: 'face', w: 0.8, stack: 1, desc: 'Bloqueia esporos enquanto tiver filtro.' },
  filtro:      { name: 'Filtro de Máscara', kind: 'tool', w: 0.2, stack: 6, desc: 'Encaixe na máscara para 90 s de proteção.' },
  colete:      { name: 'Colete Tático', kind: 'wear', slot: 'body', armor: 0.3, w: 2.5, stack: 1, desc: 'Dano recebido −30%.' },
  mochila:     { name: 'Mochila de Trilha', kind: 'wear', slot: 'back', slots: 10, w: 0.9, stack: 1, desc: '+10 espaços no inventário.' },
  lanterna:    { name: 'Lanterna', kind: 'tool', w: 0.4, stack: 1, desc: 'Tecla F liga e desliga.' },
  // construção
  barricada:   { name: 'Barricada', kind: 'place', prop: 'barricada', w: 2, stack: 5, desc: 'Bloqueia passagem. Botão direito ou B para construir.' },
  parede:      { name: 'Parede de Tábuas', kind: 'place', prop: 'parede_tabuas', w: 3, stack: 5, desc: 'Parede resistente. Botão direito ou B para construir.' },
  fogueira:    { name: 'Fogueira', kind: 'place', prop: 'fogueira', w: 2, stack: 3, desc: 'Luz e calor. Sanidade se recupera perto do fogo.' },
  // conhecimento
  diario:      { name: 'Diário de Pesquisa', kind: 'lore', w: 0.3, stack: 1, desc: 'Anotações do laboratório. Use para ler.' },
  tomo:        { name: 'Tomo do Vazio', kind: 'lore', tome: 1, w: 0.8, stack: 1, glow: 1, desc: 'Um livro que não foi escrito por mãos humanas. Ler custa sanidade.' },
};

const RECIPES = [
  { out: 'bandagem', qty: 1, need: { pano: 1 } },
  { out: 'filtro', qty: 1, need: { pano: 1, carvao: 1 } },
  { out: 'molotov', qty: 1, need: { garrafa: 1, combustivel: 10, pano: 1 } },
  { out: 'granada', qty: 1, need: { polvora: 4, pregos: 6, fita: 1 } },
  { out: 'kit', qty: 1, need: { bandagem: 2, analgesico: 1 } },
  { out: 'barricada', qty: 1, need: { tabuas: 2, pregos: 4 } },
  { out: 'parede', qty: 1, need: { tabuas: 4, pregos: 8 } },
  { out: 'fogueira', qty: 1, need: { tabuas: 3 } },
  { out: 'soro', qty: 1, need: { nucleo: 2, antifungico: 2 } },
];

const LOOT = {
  geladeira:  [['feijao', 3], ['refri', 4], ['agua', 4], ['chocolate', 2]],
  cozinha:    [['feijao', 4], ['salgadinho', 3], ['agua', 2], ['pano', 2], ['faca', 1], ['garrafa', 2], ['chocolate', 1]],
  mercado:    [['feijao', 4], ['salgadinho', 4], ['refri', 3], ['agua', 3], ['chocolate', 3], ['fita', 1]],
  freezer:    [['refri', 5], ['agua', 5]],
  farmacia:   [['bandagem', 5], ['analgesico', 5], ['kit', 1], ['antifungico', 3], ['calmante', 3], ['carvao', 2]],
  lab:        [['bandagem', 2], ['antifungico', 4], ['calmante', 2], ['carvao', 3], ['diario', 2], ['soro', 0.4], ['mascara', 0.6], ['filtro', 2], ['lanterna', 1]],
  oficina:    [['tabuas', 4], ['pregos', 4], ['cano', 1.5], ['pe_de_cabra', 1], ['marreta', 0.6], ['machado', 0.5], ['fita', 2], ['combustivel', 2], ['polvora', 1]],
  caixa:      [['tabuas', 4], ['pregos', 3], ['cano', 1], ['taco', 0.8], ['feijao', 2], ['pano', 2], ['fita', 1]],
  lixo:       [['pano', 3], ['salgadinho', 1], ['pregos', 1], ['garrafa', 3], ['refri', 0.5]],
  policia:    [['pistola', 2], ['revolver', 1], ['m9', 4], ['m38', 2], ['c12', 2], ['escopeta', 0.7], ['colete', 1], ['capacete', 0.6], ['bandagem', 2], ['lanterna', 2]],
  militar:    [['m556', 4], ['fuzil', 0.7], ['smg', 0.6], ['precisao', 0.3], ['m308', 1], ['granada', 2], ['capacete', 1.5], ['colete', 1.2], ['mascara', 1], ['filtro', 2], ['kit', 1], ['feijao', 2]],
  carro:      [['taco', 0.8], ['agua', 2], ['pano', 2], ['combustivel', 2], ['mochila', 0.6], ['refri', 1], ['pistola', 0.3], ['lanterna', 1]],
  escritorio: [['analgesico', 2], ['lanterna', 1], ['m9', 1], ['salgadinho', 2], ['refri', 1], ['diario', 0.6], ['calmante', 1], ['fita', 1]],
  quarto:     [['pano', 4], ['mochila', 0.8], ['bandagem', 1], ['calmante', 1], ['revolver', 0.3], ['m38', 0.6], ['chocolate', 1], ['tomo', 0.15]],
  estante:    [['diario', 0.5], ['tomo', 0.4], ['chocolate', 0.5], ['pano', 1]],
  casulo:     [['mochila', 0.5], ['pistola', 0.6], ['m9', 1], ['kit', 0.7], ['antifungico', 1], ['lanterna', 0.6], ['tomo', 0.3]],
  ninho:      [['nucleo', 3], ['tomo', 0.5]],
  hospital:   [['kit', 2], ['bandagem', 4], ['antifungico', 3], ['calmante', 2], ['analgesico', 3], ['soro', 0.3], ['mascara', 0.4]],
};

function rollLoot(table, rng) {
  const t = LOOT[table] || LOOT.caixa;
  const n = Math.floor(rng() * 3.4) + (rng() < 0.2 ? 1 : 0);
  const res = [];
  const total = t.reduce((s, e) => s + e[1], 0);
  for (let i = 0; i < n; i++) {
    let r = rng() * total;
    for (const [id, w] of t) {
      if ((r -= w) <= 0) {
        const def = ITEMS[id];
        let q = 1;
        if (def.kind === 'ammo') q = Math.ceil(def.stack * (0.12 + rng() * 0.25));
        else if (id === 'pregos') q = 5 + Math.floor(rng() * 10);
        else if (id === 'tabuas') q = 1 + Math.floor(rng() * 3);
        else if (def.stack > 1 && rng() < 0.3) q = 2;
        res.push({ id, qty: q });
        break;
      }
    }
  }
  return res;
}

// ---------- modelos voxel ----------
const ITEM_MODELS = (() => {
  const H = VX.hash, SD = VX.SD, GM = 5, GL = 1, EM = 2, GA = 3;
  const gun = (i) => ({ c: H(i.x, i.y, i.z) > 0.85 ? '#43454e' : '#2c2d34', m: GM });
  const gunDark = { c: '#1f2026', m: GM };
  const wood = (i) => { const g = VX.vnoise(i.x * 0.3, i.y * 2.5, i.z * 0.3); return g > 0.6 ? '#9a5a30' : g < 0.35 ? '#6e3a1e' : '#844a26'; };
  const steel = (i) => ({ c: H(i.x, i.y, i.z) > 0.8 ? '#c9d0d8' : '#9aa3ad', m: GM });
  const B = {
    faca(m, p) {
      m.box(p, -0.5, -0.8, -1, 1, 1.6, 4, '#22201e');
      m.box(p, -1, -1, 3, 2, 2, 1, gunDark);
      m.sdf(p, [-0.6, -0.8, 3.5, 0.6, 1.2, 11], SD.inter(SD.rbox(0, 0.2, 7, 0.35, 0.9, 3.6, 0.2), (x, y, z) => y - 1.1 + (z - 7) * 0.12), (i) => ({ c: i.y > 0.7 ? '#eef2f6' : '#aab4be', m: GM }));
    },
    facao(m, p) {
      m.box(p, -0.5, -0.8, -1, 1, 1.6, 4, '#3a2a1e');
      m.sdf(p, [-0.6, -1.2, 3, 0.6, 1.6, 16.5], SD.rbox(0, 0.1, 9.6, 0.3, 1.2 + 0, 6.6, 0.4), (i) => ({ c: i.y > 0.8 ? '#e8edf2' : '#8f99a3', m: GM }));
    },
    cano(m, p) {
      m.sdf(p, [-1.2, -1.2, -3, 1.2, 1.2, 22], SD.cap([0, 0, -2.5], [0, 0, 21], 0.85, 0.85), (i) => (VX.vnoise(i.x, i.y, i.z * 0.6) > 0.62 ? '#8a5a3a' : { c: '#7b8288', m: GM }));
      
      m.box(p, -1.2, -1.2, 19.5, 2.4, 2.4, 2, { c: '#5d646b', m: GM });
    },
    pe_de_cabra(m, p) {
      m.sdf(p, [-1, -1, -2, 1, 1, 18], SD.cap([0, 0, -1.5], [0, 0, 17], 0.7, 0.7), { c: '#b8322a', m: GL });
      m.sdf(p, [-1, -1, 16, 1, 4, 20], SD.cap([0, 0, 17], [0, 2.5, 19], 0.65, 0.5), { c: '#b8322a', m: GL });
      m.sdf(p, [-1, -3, -4, 1, 1, -1], SD.cap([0, 0, -1.5], [0, -2.2, -3.2], 0.6, 0.4), { c: '#8a8f96', m: GM });
    },
    taco(m, p) {
      m.sdf(p, [-2, -2, -3, 2, 2, 24], SD.cap([0, 0, -2.5], [0, 0, 22], 0.7, 1.55), (i) => (i.z < 5 ? '#232026' : { c: wood(i), m: GL }));
      m.sdf(p, [-1, -1, -3.5, 1, 1, -2], SD.sphere(0, 0, -2.8, 0.95), '#232026');
    },
    marreta(m, p) {
      m.sdf(p, [-1, -1, -3, 1, 1, 23], SD.cap([0, 0, -2.5], [0, 0, 22], 0.7, 0.8), (i) => ({ c: wood(i), m: GL }));
      m.sdf(p, [-4, -2.5, 19, 4, 2.5, 25], SD.rbox(0, 0, 22, 3.8, 1.9, 1.9, 0.4), (i) => ({ c: H(i.x, i.y, i.z) > 0.8 ? '#5a5e66' : '#43474e', m: GM }));
    },
    machado(m, p) {
      m.sdf(p, [-1, -1, -3, 1, 1, 23], SD.cap([0, 0, -2.5], [0, 0, 22], 0.7, 0.75), (i) => (i.z < 4 ? '#2a2620' : { c: '#c43a2c', m: GL }));
      m.sdf(p, [-0.7, -1, 18, 0.7, 7, 25], SD.union(SD.rbox(0, 2.2, 21.5, 0.5, 2.8, 2.2, 0.3), SD.rbox(0, 5.4, 21.5, 0.4, 0.8, 3.2, 0.2)), (i) => ({ c: i.y > 5 ? '#e4e9ee' : '#c43a2c', m: i.y > 5 ? GM : GL }));
      m.sdf(p, [-0.6, -4, 20, 0.6, 0, 23], SD.cap([0, -0.5, 21.5], [0, -3.2, 21.5], 0.6, 0.2), { c: '#c43a2c', m: GL });
    },
    katana(m, p) {
      m.sdf(p, [-0.8, -0.8, -5, 0.8, 0.8, 3], SD.cap([0, 0, -4.5], [0, 0, 2.5], 0.7, 0.7), (i) => (Math.floor(i.z * 1.5) % 2 ? '#1c1c22' : '#e8e2d0'));
      m.box(p, -1.5, -1.5, 2.5, 3, 3, 0.8, { c: '#c9a24a', m: GM });
      m.sdf(p, [-0.5, -1, 3, 0.5, 2.4, 26], (x, y, z) => { const c = 0.0035 * (z - 3) * (z - 3); return Math.max(Math.abs(x) - 0.3, Math.abs(y - c - 0.1) - 0.75, 3.3 - z, z - 25.5 + (y - c) * 0.8); }, (i) => ({ c: i.y - 0.0035 * (i.z - 3) ** 2 > 0.4 ? '#f2f6fa' : '#b8c2cc', m: GM }));
    },
    pistola(m, p) {
      m.box(p, -0.8, 0.2, -1.5, 1.6, 2, 8, gun);
      m.box(p, -0.85, 1.6, -1.5, 1.7, 0.6, 8, (i) => ({ c: i.ix === 1 || (i.iz % 2) ? '#3a3c44' : '#24252b', m: GM }));
      m.sdf(p, [-0.9, -4.5, -2.5, 0.9, 0.6, 1.5], SD.rbox(0, -1.8, -0.6, 0.75, 2.4, 1.0, 0.3), (i) => (H(i.x, i.y, i.z) > 0.6 ? '#1b1c20' : '#26272d'));
      m.box(p, -0.4, -0.6, 0.5, 0.8, 0.8, 1.6, gunDark);
    },
    revolver(m, p) {
      m.sdf(p, [-1.6, -1.5, -0.5, 1.6, 2, 3], SD.cap([0, 0.3, 0], [0, 0.3, 2.6], 1.35, 1.35), { c: '#7d848c', m: GM });
      m.sdf(p, [-0.8, -0.5, 2, 0.8, 1.3, 9.5], SD.cap([0, 0.6, 2.5], [0, 0.6, 9], 0.6, 0.6), { c: '#8f969e', m: GM });
      m.box(p, -0.7, 1, -1.5, 1.4, 1, 3, { c: '#6a7178', m: GM });
      m.sdf(p, [-0.9, -4.5, -3.5, 0.9, 0.6, 0.5], SD.rbox(0, -2, -1.6, 0.75, 2.4, 0.95, 0.4), (i) => ({ c: wood(i), m: GL }));
    },
    smg(m, p) {
      m.box(p, -1, -0.4, -3, 2, 3, 10, gun);
      m.box(p, -0.5, 0.6, 7, 1, 1, 4, gunDark);
      m.box(p, -0.7, -5, 0.8, 1.4, 4.6, 1.6, gunDark);
      m.box(p, -0.8, -3.8, -2.6, 1.6, 3.4, 1.6, (i) => (H(i.x, i.y, i.z) > 0.7 ? '#2a2b31' : '#1d1e23'));
      m.box(p, -0.3, 0.2, -9, 0.6, 0.6, 6, gunDark);
      m.box(p, -0.3, -1.6, -9, 0.6, 2, 0.6, gunDark);
    },
    escopeta(m, p) {
      m.sdf(p, [-1.2, -4, -12, 1.2, 1.6, -0.5], SD.smooth(1, SD.rbox(0, -0.4, -4, 0.9, 1.1, 3.6, 0.5), SD.rbox(0, -1.8, -9, 0.95, 2.0, 2.6, 0.6)), (i) => ({ c: wood(i), m: GL }));
      m.box(p, -1, -0.8, -1, 2, 2.6, 7, gun);
      m.sdf(p, [-0.8, 0, 5, 0.8, 1.6, 22], SD.cap([0, 0.9, 5], [0, 0.9, 21.5], 0.55, 0.55), { c: '#2b2c33', m: GM });
      m.sdf(p, [-0.8, -1, 5, 0.8, 0.6, 18], SD.cap([0, -0.2, 5], [0, -0.2, 17], 0.5, 0.5), gunDark);
      m.sdf(p, [-1.2, -1.4, 8, 1.2, 0.9, 15], SD.rbox(0, -0.2, 11.5, 1.0, 1.0, 2.8, 0.5), (i) => ({ c: wood(i), m: GL }));
    },
    fuzil(m, p) {
      m.sdf(p, [-1, -3.5, -11, 1, 1.6, -1], SD.smooth(1, SD.rbox(0, -0.2, -3.5, 0.8, 1.2, 2.8, 0.4), SD.rbox(0, -1.4, -8.5, 0.85, 1.9, 2.6, 0.5)), (i) => ({ c: wood(i), m: GL }));
      m.box(p, -1, -0.8, -1, 2, 2.6, 8, gun);
      m.sdf(p, [-1, -7, 2, 1, 0, 7.5], SD.cap([0, -0.6, 4], [0, -6, 6.3], 0.85, 0.8), gunDark);
      m.box(p, -0.6, -2.8, -0.2, 1.2, 2.4, 1.4, gunDark);
      m.sdf(p, [-1.2, -1, 7, 1.2, 1.4, 14], SD.rbox(0, 0.3, 10.5, 1.0, 0.9, 3.2, 0.4), (i) => ({ c: wood(i), m: GL }));
      m.sdf(p, [-0.6, 0, 13, 0.6, 1.4, 21], SD.cap([0, 0.7, 13], [0, 0.7, 20.5], 0.4, 0.4), gunDark);
      m.box(p, -0.3, 1.6, 15.5, 0.6, 1, 0.6, gunDark);
    },
    precisao(m, p) {
      const tan = (i) => (H(i.x, i.y, i.z) > 0.8 ? '#a89160' : '#8f7a4c');
      m.sdf(p, [-1.1, -3.6, -13, 1.1, 1.6, 0], SD.smooth(1.2, SD.rbox(0, -0.3, -4, 0.9, 1.3, 3.8, 0.5), SD.rbox(0, -1.4, -10, 0.95, 2.1, 2.8, 0.6)), tan);
      m.box(p, -1, -0.8, -1, 2, 2.4, 10, tan);
      m.sdf(p, [-0.6, 0.2, 8, 0.6, 1.6, 26], SD.cap([0, 0.8, 8], [0, 0.8, 25.5], 0.5, 0.45), gunDark);
      m.sdf(p, [-1.2, 1.4, -2, 1.2, 4.2, 10], SD.cap([0, 2.8, -1.2], [0, 2.8, 8.8], 1.05, 1.2), (i) => ({ c: i.z > 8.4 ? '#5fb6d8' : '#1e2024', m: i.z > 8.4 ? GA : GM }));
      m.box(p, -0.5, 1.4, 1.5, 1, 0.8, 0.8, gunDark);
      m.box(p, -0.5, 1.4, 5.5, 1, 0.8, 0.8, gunDark);
      m.box(p, -0.6, -2.4, 0.5, 1.2, 1.8, 2, gunDark);
    },
    lanca(m, p) {
      m.box(p, -1.2, -1, -6, 2.4, 3, 10, (i) => ({ c: H(i.x, i.y, i.z) > 0.8 ? '#5a6436' : '#4a5330', m: GL }));
      m.sdf(p, [-1.6, -4.5, -3, 1.6, -0.5, 4], SD.cap([0, -2.6, -2.2], [0, -2.6, 3.2], 1.5, 1.5), { c: '#b8322a', m: GL });
      m.sdf(p, [-0.8, -0.2, 3, 0.8, 1.6, 17], SD.cap([0, 0.7, 3.5], [0, 0.7, 16], 0.55, 0.75), { c: '#7d8288', m: GM });
      m.sdf(p, [-1.2, -0.6, 15, 1.2, 2, 18], SD.cylY(0, 17, 1.1, -0.4, 1.8), { c: '#3a3c42', m: GM });
      m.box(p, -0.4, -0.4, 16.5, 0.8, 0.6, 1, { c: '#6af0ff', m: EM });
    },
    granada(m, p) {
      m.sdf(p, [-2, -2, -2, 2, 2.4, 2], SD.ell(0, 0, 0, 1.4, 1.7, 1.4), (i) => ({ c: Math.abs(i.y % 1) < 0.25 ? '#3e4a24' : '#55642f', m: GL }));
      m.box(p, -0.5, 1.4, -0.5, 1, 1.2, 1, { c: '#8a9096', m: GM });
      m.sdf(p, [-1.8, 0.8, -0.3, 0, 2.6, 0.3], SD.cap([-0.4, 2.3, 0], [-1.4, 1.2, 0], 0.25, 0.25), { c: '#c9d0d6', m: GM });
    },
    molotov(m, p) {
      m.sdf(p, [-2, -1, -2, 2, 7.5, 2], SD.smooth(0.8, SD.cylY(0, 0, 1.6, -0.5, 3.8), SD.cap([0, 3.6, 0], [0, 6.2, 0], 0.9, 0.55)), { c: '#3f8a4a', m: GA });
      m.sdf(p, [-1, 6, -1, 1.6, 9, 1], SD.cap([0, 6.4, 0], [0.8, 8.4, 0.2], 0.55, 0.4), '#e2d8c0');
      m.box(p, 0.3, 8.3, -0.2, 0.8, 0.8, 0.6, { c: '#ffb43a', m: EM });
    },
    lanterna(m, p) {
      m.sdf(p, [-1.5, -1.5, -1, 1.5, 1.5, 9], SD.smooth(0.6, SD.cap([0, 0, -0.5], [0, 0, 5], 0.9, 0.9), SD.cap([0, 0, 5.5], [0, 0, 8], 1.4, 1.5)), { c: '#2f3238', m: GM });
      m.box(p, -1, -1, 8.4, 2, 2, 0.6, { c: '#fff4c0', m: EM });
    },
    // ícones / objetos
    feijao(m, p) { m.sdf(p, [-3, 0, -3, 3, 6.5, 3], SD.cylY(0, 0, 2.4, 0, 5.6), (i) => (i.y > 5.3 || i.y < 0.4 ? { c: '#b8bec4', m: GM } : i.y > 1.2 && i.y < 4.6 ? (i.x < -0.5 ? '#c0502e' : i.z > 1.6 && Math.abs(i.x) < 1 ? '#f6e8c0' : '#e2b04a') : { c: '#9aa0a6', m: GM })); },
    salgadinho(m, p) { m.sdf(p, [-3.5, 0, -1.5, 3.5, 9, 1.5], SD.rbox(0, 4.4, 0, 3, 4.2, 0.9, 0.7), (i) => (i.y > 7.6 || i.y < 0.9 ? '#c03030' : i.z > 0.5 && i.y > 3 && i.y < 6 && Math.abs(i.x) < 1.6 ? '#f2d14a' : { c: '#e88a20', m: GL })); },
    chocolate(m, p) { m.box(p, -3.5, 0, -1.5, 7, 1.4, 3, (i) => (i.top && Math.abs(i.x) < 2.5 ? '#f4f4f4' : '#c4202c')); },
    refri(m, p) { m.sdf(p, [-2, 0, -2, 2, 5.5, 2], SD.cylY(0, 0, 1.6, 0, 4.6), (i) => (i.y > 4.3 ? { c: '#c8ccd0', m: GM } : i.y > 1.8 && i.y < 2.8 ? '#f0f0f0' : { c: '#c4282c', m: GL })); },
    agua(m, p) { m.sdf(p, [-2, 0, -2, 2, 9, 2], SD.smooth(0.6, SD.cylY(0, 0, 1.5, 0, 5.5), SD.cap([0, 5.5, 0], [0, 7.4, 0], 1.2, 0.6)), (i) => (i.y > 7.1 ? '#2a64c8' : i.y > 2 && i.y < 3.8 ? '#e8eef4' : { c: '#7cc4f0', m: GA })); },
    bandagem(m, p) { m.sdf(p, [-3, -3, -3, 3, 3, 3], SD.cylY(0, 0, 2.4, -1.6, 1.6), (i) => (Math.hypot(i.x, i.z) < 0.9 ? '#a89070' : '#efe6d0')); },
    analgesico(m, p) { m.sdf(p, [-2, 0, -2, 2, 6, 2], SD.cylY(0, 0, 1.5, 0, 4), (i) => (i.y > 1.4 && i.y < 2.6 ? '#ffffff' : { c: '#e07a20', m: GA })); m.sdf(p, [-2, 3.5, -2, 2, 6, 2], SD.cylY(0, 0, 1.6, 4, 5.3), '#f4f4f4'); },
    antifungico(m, p) { m.box(p, -3, 0, -2, 6, 3, 4, (i) => (i.top && Math.abs(i.z) < 1 ? '#2fb8a8' : i.front && i.iy === 1 ? '#2fb8a8' : '#f2f4f0')); },
    soro(m, p) { m.sdf(p, [-1.5, 0, -1.5, 1.5, 8, 1.5], SD.cylY(0, 0, 1.1, 0, 6.5), (i) => (i.y > 5.6 ? '#d8dde2' : { c: '#7dff9a', m: EM })); m.box(p, -0.3, 6.5, -0.3, 0.6, 2, 0.6, { c: '#c9d0d6', m: GM }); },
    calmante(m, p) { m.sdf(p, [-2, 0, -2, 2, 6, 2], SD.cylY(0, 0, 1.5, 0, 4), (i) => (i.y > 1.4 && i.y < 2.6 ? '#ffffff' : { c: '#7a5cc8', m: GA })); m.sdf(p, [-2, 3.5, -2, 2, 6, 2], SD.cylY(0, 0, 1.6, 4, 5.3), '#f4f4f4'); },
    kit(m, p) {
      m.sdf(p, [-5, 0, -3.5, 5, 6, 3.5], SD.rbox(0, 2.6, 0, 4.4, 2.6, 2.9, 0.8), (i) => {
        const ax = Math.abs(i.x), az = Math.abs(i.z);
        if (i.y > 4.6 && ((ax < 0.8 && az < 2) || (az < 0.8 && ax < 2))) return '#ffffff';
        if (i.z > 2.4 && ((ax < 0.8 && i.y > 1 && i.y < 4.4) || (Math.abs(i.y - 2.7) < 0.8 && ax < 2))) return '#ffffff';
        return { c: '#c62a2a', m: GL };
      });
      m.box(p, -1.5, 5, -0.5, 3, 1.2, 1, '#3a2a2a');
    },
    pano(m, p) { m.sdf(p, [-4, 0, -3.5, 4, 2.5, 3.5], SD.rbox(0, 0.9, 0, 3.4, 0.8, 3, 0.6), (i) => (VX.vnoise(i.x, i.y, i.z) > 0.55 ? '#c9c2b4' : '#ded8cc')); },
    tabuas(m, p) { for (let k = 0; k < 3; k++) m.box(p, -9 + k, k * 1.6, -2 + (k % 2), 17, 1.5, 3.5, (i) => (i.iz === 1 && i.ix % 6 === 3 ? '#6a3e1e' : { c: wood(i), m: 0 })); },
    pregos(m, p) { m.box(p, -2.5, 0, -1.8, 5, 3, 3.6, (i) => (i.top ? '#8f969d' : '#7a6248')); for (let k = 0; k < 4; k++) m.box(p, -2 + k * 1.2, 3, -1 + (k % 2), 0.6, 2, 0.6, { c: '#c0c6cc', m: GM }); },
    fita(m, p) { m.sdf(p, [-4, -1, -4, 4, 2, 4], SD.sub(SD.cylY(0, 0, 3.2, 0, 1.6), SD.cylY(0, 0, 1.6, -1, 3)), { c: '#a8adb4', m: GM }); },
    garrafa(m, p) { m.sdf(p, [-2, -1, -2, 2, 8, 2], SD.smooth(0.8, SD.cylY(0, 0, 1.6, -0.5, 3.8), SD.cap([0, 3.6, 0], [0, 6.6, 0], 0.9, 0.55)), { c: '#4a9a6a', m: GA }); },
    carvao(m, p) { m.sdf(p, [-3.5, 0, -2.5, 3.5, 7, 2.5], SD.rbox(0, 3, 0, 3, 3, 2, 0.8), (i) => (i.z > 1.5 && Math.abs(i.y - 3.4) < 1.2 ? '#f2f2f2' : '#3a3a3e')); },
    polvora(m, p) { m.sdf(p, [-3, 0, -3, 3, 6, 3], SD.cylY(0, 0, 2.4, 0, 5), (i) => (i.y > 4.6 ? '#2a2a2a' : i.y > 1.5 && i.y < 3.5 ? '#e0c040' : '#3a3a3e')); },
    nucleo(m, p) { m.sdf(p, [-3.5, -3.5, -3.5, 3.5, 3.5, 3.5], SD.ell(0, 0, 0, 2.8, 3.1, 2.8), (i) => (VX.vnoise(i.x * 0.9, i.y * 0.9, i.z * 0.9) > 0.55 ? { c: '#9df7e6', m: EM } : { c: '#5a2a6e', m: GL })); },
    m9(m, p) { ammoBox(m, p, '#c8a040', '#3a3a40'); },
    m38(m, p) { ammoBox(m, p, '#c8a040', '#6a2a2a'); },
    c12(m, p) { m.box(p, -3.5, 0, -2.5, 7, 4, 5, (i) => (i.top ? '#8a1a1a' : '#a82424')); for (let k = 0; k < 3; k++) m.sdf(p, [-3 + k * 2, 3.5, -1, -1 + k * 2, 7, 1], SD.cylY(-2 + k * 2, 0, 0.8, 4, 6.5), (i) => (i.y < 4.8 ? { c: '#c9a24a', m: GM } : '#c62a2a')); },
    m556(m, p) { ammoBox(m, p, '#c8a040', '#55602f'); },
    m308(m, p) { ammoBox(m, p, '#d8b048', '#2e3a4a'); },
    combustivel(m, p) {
      m.sdf(p, [-4, 0, -2.5, 4, 10, 2.5], SD.rbox(0, 4.4, 0, 3.6, 4.4, 2.1, 0.7), (i) => (Math.abs(i.z) > 1.6 && Math.abs(i.y - 4.4) < 2.4 && Math.abs(i.x) < 2.4 ? '#9a1e1a' : { c: '#c42a22', m: GL }));
      m.box(p, -2.5, 8.5, -0.5, 4, 1.5, 1, '#9a1e1a'); m.box(p, 2, 8.5, -0.6, 1.2, 2.2, 1.2, '#2a2a2a');
    },
    capacete(m, p) { m.sdf(p, [-5.5, -1, -6, 5.5, 6, 6], SD.sub(SD.ell(0, 0.4, 0, 4.8, 4.6, 5.2), SD.rbox(0, -3, 0, 7, 3.2, 7, 0)), (i) => (VX.vnoise(i.x, i.y, i.z) > 0.65 ? '#4c5a34' : '#5f6e40')); m.sdf(p, [-5.5, -0.5, -6, 5.5, 1, 6], SD.sub(SD.ell(0, 0.3, 0, 5.4, 0.6, 5.8), SD.ell(0, 0.3, 0, 4.4, 2, 4.8)), '#3e4a28'); },
    mascara(m, p) {
      m.sdf(p, [-4, -1, -2, 4, 7, 4.5], SD.sub(SD.ell(0, 3, 0.8, 3.4, 3.8, 2.8), SD.ell(0, 3, -1, 3.4, 4.2, 2.8)), (i) => '#2e3234');
      for (const sx of [-1.4, 1.4]) m.sdf(p, [sx - 1.2, 3.2, 2, sx + 1.2, 5.6, 4.2], SD.cap([sx, 4.4, 2.6], [sx, 4.4, 3.7], 1.05, 1.05), { c: '#5fb6c0', m: GA });
      m.sdf(p, [-1.6, -0.5, 3, 1.6, 2.6, 7], SD.cap([0, 1, 3.2], [0, 0.8, 6.2], 1.3, 1.3), (i) => (i.z > 5.8 ? '#15171a' : '#3a3f44'));
    },
    filtro(m, p) { m.sdf(p, [-2.5, 0, -2.5, 2.5, 4, 2.5], SD.cylY(0, 0, 2, 0, 3.4), (i) => (i.y > 3 ? '#15171a' : i.y < 1 ? '#3a3f44' : '#c9a040')); },
    colete(m, p) {
      m.sdf(p, [-6, 0, -3, 6, 13, 3.5], SD.sub(SD.rbox(0, 6.5, 0, 5.4, 6.2, 2.4, 1.2), SD.ell(0, 13, 0.5, 2.6, 2.8, 4)), (i) => (i.z > 1.8 && i.y > 3 && i.y < 7 && Math.abs(Math.abs(i.x) - 2.6) < 1.3 ? '#2c3020' : VX.vnoise(i.x, i.y, i.z) > 0.7 ? '#363c28' : '#454c32'));
    },
    mochila(m, p) {
      m.sdf(p, [-5, 0, -3, 5, 13, 4], SD.rbox(0, 6.5, 0, 4.4, 6.2, 2.6, 1.6), (i) => (VX.vnoise(i.x, i.y, i.z) > 0.7 ? '#4f5830' : '#66713e'));
      m.sdf(p, [-4, 1, 1.5, 4, 7, 4.5], SD.rbox(0, 4, 2.6, 3.2, 2.6, 1.2, 0.8), '#59633a');
      m.box(p, -1, 6.4, 3.6, 2, 0.6, 0.6, '#2e3020');
    },
    barricada(m, p) { for (let k = 0; k < 4; k++) m.box(p, -9, k * 3, -1, 18, 2, 2, wood); m.box(p, -7, 0, 1, 2, 13, 1, '#6a3e1e'); m.box(p, 5, 0, 1, 2, 13, 1, '#6a3e1e'); },
    parede(m, p) { for (let k = 0; k < 6; k++) m.box(p, -9, k * 2.1, -1, 18, 2, 2, wood); },
    fogueira(m, p) { for (let k = 0; k < 4; k++) m.sdf(p, [-7, 0, -7, 7, 4, 7], SD.cap([Math.cos(k * 1.6) * 5, 0.8, Math.sin(k * 1.6) * 5], [0, 3.2, 0], 0.9, 0.7), wood); },
    diario(m, p) { m.box(p, -3.5, 0, -4.5, 7, 1.6, 9, (i) => (i.top ? (Math.abs(i.x) < 2.4 && Math.abs(i.z + 1) < 1.2 ? '#e8e2c8' : '#3a5a7a') : i.iz > 0 && i.ix < 6 && i.iy < 1 ? '#f2ecd8' : '#2e4a66')); },
    tomo(m, p) {
      m.box(p, -4, 0, -5, 8, 2.4, 10, (i) => (i.top ? (VX.vnoise(i.x * 0.8, 0, i.z * 0.8) > 0.6 ? '#3c6a2a' : '#2a4a20') : i.iy > 0 && i.iy < 2 && !i.left ? '#d8cfb0' : '#3a2a1e'));
      m.sdf(p, [-2.5, 2, -2.5, 2.5, 4, 2.5], SD.ell(0, 2.4, 0, 2, 0.9, 2), (i) => (Math.hypot(i.x, i.z) < 0.7 ? '#120a10' : Math.hypot(i.x, i.z) < 1.4 ? { c: '#ff6a2a', m: EM } : '#e0d6c0'));
      m.sdf(p, [-6, 0, -6, -2, 3, 6], SD.cap([-4.5, 1.6, -4], [-3.6, 2.6, 4], 0.5, 0.3), { c: '#8af06a', m: EM });
    },
  };
  function ammoBox(m, p, brass, box) {
    m.box(p, -3, 0, -2, 6, 3.4, 4, (i) => (i.top ? VX.shade(box, 0.85) : i.front && i.iy === 1 ? '#d4c098' : box));
    for (let k = 0; k < 4; k++) m.sdf(p, [-3 + k * 1.5, 3, -1, -1 + k * 1.5, 6.5, 1], SD.cap([-2.2 + k * 1.5, 3.4, 0], [-2.2 + k * 1.5, 5.6, 0], 0.55, 0.42), (i) => ({ c: i.y > 5 ? '#b87a30' : brass, m: GM }));
  }
  const cache = {};
  function model(id) {
    if (cache[id]) return cache[id];
    const m = new VX.Model();
    m.part('root', null, [0, 0, 0]);
    (B[id] || B.pano)(m, 'root');
    return (cache[id] = m);
  }
  const LONG = ['taco', 'marreta', 'machado', 'katana', 'cano', 'pe_de_cabra', 'facao', 'faca', 'pistola', 'revolver', 'smg', 'escopeta', 'fuzil', 'precisao', 'lanca', 'lanterna'];
  const icons = {};
  function icon(id) {
    if (icons[id]) return icons[id];
    const cv = VX.renderFit(model(id), {}, { W: 40, H: 40, yaw: LONG.includes(id) ? Math.PI / 2 : -Math.PI / 4 - 0.25, dither: 0.4, crop: false });
    icons[id] = { canvas: cv, url: cv.toDataURL() };
    return icons[id];
  }
  return { build: B, model, icon, has: (id) => !!B[id] };
})();

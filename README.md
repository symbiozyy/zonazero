# Zona Zero

Jogo isométrico de sobrevivência e horror cósmico em HTML5 Canvas, sem dependências.
Inspiração: Project Zomboid, Unturned, Left 4 Dead e Minecraft.

Um fragmento caiu do céu sobre o Instituto Hélio e trouxe o **Micélio-Ω**, um fungo de outro mundo.
As pessoas viraram hospedeiros, os ninhos se espalharam pela cidade e criaturas começaram a sair do clarão.
Sobreviva à contaminação, mantenha a sanidade, destrua os ninhos e acabe com o Fragmento.

Jogar: abra `index.html` no navegador ou acesse o GitHub Pages do repositório.

## Como funciona a arte
Tudo é gerado por código, sem imagens prontas: cada personagem, móvel, carro e parede é um modelo voxel
em escala real (30 voxels = 1 metro, 24 voxels por tile de 0,8 m) feito de formas orgânicas (SDF).
O motor projeta o modelo em isométrico 2:1, sombreia com rampa de cor (tons frios na sombra, quentes na luz),
pontilhado, oclusão de ambiente, contorno colorido e sombra projetada no chão. Por isso todas as criaturas
têm 8 direções e qualquer animação nova sai automaticamente.

## Arquivos
- `js/voxel.js` – motor voxel → pixel art (SDF, materiais fosco/brilho/metal/vidro/pele/emissivo, atlas de quadros).
- `js/creatures.js` – protagonista, 8 tipos de infectados, 3 raças alienígenas; esqueletos, poses e IK de braços.
- `js/items.js` – armas, munições, comida, remédios, equipamentos, livros; modelos voxel, receitas e saque.
- `js/props.js` – ~70 objetos: cozinha, quarto, banheiro, escritório, mercado, farmácia, hospital, laboratório, galpão, rua, carros, vans, árvores, fungos, ninhos, o Fragmento.
- `js/world.js` – pisos, paredes 3D (janelas, portas, vitrines, cercas), geração da cidade 4×4 quarteirões, colisão, visão, A*.
- `js/render.js` – pisos em blocos, ordenação isométrica por dependência, telhados, cortes de parede, sombras, luz colorida, névoa de visão.
- `js/game.js` – jogabilidade: contaminação, sanidade, armas, explosões, fogo, IA, ninhos, Floração, dia/noite, chuva, salvar.
- `js/ui.js` – HUD, inventário, saque, criação, códex com cartas de horror, mapa, textos, visualizador de sprites, controles de toque.
- `js/lore.js` – diários, terminais, tomos e bestiário.
- `js/audio.js` – sons sintetizados e ambiente.
- `assets/sprites/*.png` – folhas exportadas (linhas = 8 direções S, SE, L, NE, N, NO, O, SO; colunas = quadros; 150×160 px por quadro, pés em (75,124)).

## Onde mexer
- Nova criatura humanoide: adicione um `SPECS` e um `TYPES` em `creatures.js` e os atributos em `EN` (`game.js`).
- Nova animação: entrada em `ANIMS` + `case` em `humanPose()`.
- Novo item: `ITEMS` + modelo em `ITEM_MODELS.build` + entrada em `LOOT` (`items.js`).
- Novo móvel/objeto: `def(...)` em `props.js`; para aparecer nos cômodos, inclua em `FURN` (`world.js`).
- Novo tipo de prédio: `BTYPES` em `world.js`.

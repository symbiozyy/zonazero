# Zona Zero

Protótipo de sobrevivência isométrica (Project Zomboid + Unturned + Left 4 Dead + Minecraft) em HTML5 Canvas, sem dependências.

Abra `index.html` no navegador (ou sirva a pasta com `python3 -m http.server`).

## Arquivos
- `js/voxel.js` – motor voxel → pixel art (z-buffer, sombreamento em faixas, contorno). Todos os sprites saem daqui.
- `js/characters.js` – protagonista e 5 tipos de zumbi, esqueleto de partes, poses de cada animação e folhas em 8 direções.
- `js/items.js` – itens, modelos voxel dos itens (ícones e item na mão), receitas e tabelas de saque.
- `js/world.js` – tiles, paredes, objetos, geração da cidade, colisão, linha de visão e A*.
- `js/game.js` – loop, jogadora, combate, IA dos zumbis, hordas, dia/noite, iluminação, som.
- `js/ui.js` – HUD, inventário (arrastar e soltar), saque, criação, visualizador de sprites, controles de toque.
- `assets/sprites/*.png` – folhas exportadas (linhas = 8 direções S, SE, L, NE, N, NO, O, SO; colunas = quadros; 92×96 px por quadro, pés em (46,74)).

## Onde mexer
- Nova animação: adicione em `ANIMS` e um `case` em `pose()` (`characters.js`).
- Novo item: `ITEMS` + modelo em `ITEM_MODELS.build` + entrada em `LOOT` (`items.js`).
- Novo móvel/objeto: `PROPS` em `world.js` (com `loot` vira container).
- Trocar por arte desenhada à mão: substitua `CHR.sheet()` para carregar PNGs com o mesmo layout.

# Importador Sofascore → GiriaGames → Sortitoutsi

Extensão Manifest V3 para Chrome/Edge.

## Instalação

1. Abra `edge://extensions` ou `chrome://extensions`.
2. Active **Modo de programador**.
3. Escolha **Carregar sem compactação**.
4. Seleccione esta pasta: `browser-extension/sofascore-player-importer`.

## Utilização

1. Abra `admin/criar-jogadores.html` numa aba.
2. Abra o perfil do jogador no Sofascore noutra aba.
3. Clique no ícone da extensão e escolha **Importar jogador actual**.
4. A extensão preenche o “Preenchimento Rápido”, abre a pesquisa no Sortitoutsi e, ao encontrar o resultado, descarrega a imagem, fecha o perfil temporário, volta ao Sofascore e actualiza o formulário.

Antes de usar a extensão, abra um terminal nesta pasta e execute:

```powershell
node face-download-server.cjs
```

Deixe esse terminal aberto. O auxiliar guarda as imagens em `assets/faces/face_ID.png`.

A extensão precisa de acesso às páginas do Sofascore, do Sortitoutsi e ao endereço local onde o painel de administração está a correr.
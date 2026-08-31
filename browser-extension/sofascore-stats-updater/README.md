# GiriaGames - Atualizador de Estatísticas Sofascore (25/26)

Extensão Manifest V3 para Chrome/Edge para atualizar **apenas o campo "ESTATÍSTICAS (OPCIONAL)"** no modal de edição de jogadores em `admin/editar-jogadores.html`.

## Como Funciona

1. **Abrir a Edição do Jogador**: No painel admin (`admin/editar-jogadores.html`), abra o modal de edição de um jogador.
2. **Iniciar a Atualização**:
   - Clique no botão **`⚡ Importar Sofascore 25/26`** diretamente na caixa do formulário (ao lado de *Estatísticas (Opcional)*); **OU**
   - Clique no ícone da extensão no navegador e selecione **"Atualizar Estatísticas Sofascore"**.
3. **Automação Sofascore**:
   - A extensão lê o nome do jogador no modal.
   - Pesquisa no Google (`<nome> sofascore`) e aceda ao perfil no Sofascore.
   - Entra na aba **"Época"**.
   - Procura uma das **18 ligas permitidas** no 1.º dropdown.
   - Seleciona a época **`25/26`** no 2.º dropdown.
   - Copia o bloco **"Média de Pontuações Sofascore"**.
   - Fecha a aba e cola automaticamente as estatísticas no campo **`Estatísticas (Opcional)`**.
   - Recalcula o Overall e Coeficientes do jogador no GiriaGames.
4. **Proteção por Liga**: Se a liga do jogador para a época 25/26 não estiver na lista das 18 ligas permitidas, a extensão exibe um aviso de erro e **não altera** o formulário.

## Ligas Permitidas (25/26)

1. Liga Profesional de Fútbol
2. Trendyol Süper Lig
3. LaLiga
4. Premier League
5. Ekstraklasa
6. Serie A
7. Ukrainian Premier League
8. 2. Bundesliga
9. Bundesliga
10. Russian Premier League
11. Mozzart Bet Prva Liga
12. Mozzart Bet Superliga
13. Liga Portugal Betclic
14. Ligue 1
15. Saudi Pro League
16. Liga MX, Apertura
17. Cambodian Premier League
18. WWIN Liga BiH
19. HNL

## Instalação

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative o **Modo do programador**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta: `browser-extension/sofascore-stats-updater`.

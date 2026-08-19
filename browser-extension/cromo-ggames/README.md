# Extensão Chrome - Cromo-ggames

Extensão para automatizar a verificação e atualização de **Posição** e **Equipa** de jogadores entre o **SofaScore** e o painel de administração **GiriaGames**.

## Como Funciona

1. **Clique no Ícone**: No painel admin (`admin/gerenciar-caderneta-casta.html`), clique no ícone do SofaScore ao lado do nome do jogador.
2. **Auto-Navegação Google**: A extensão abre uma pesquisa no Google e clica automaticamente no **1.º resultado do SofaScore**.
3. **Extração SofaScore**: A extensão lê a **Equipa** e **Posição** reais do jogador na página do SofaScore.
4. **Compara & Atualiza**:
   - A extensão fecha automaticamente a aba do SofaScore e regressa à sua página admin.
   - Se houver alguma diferença na **Posição** ou **Equipa**, a extensão abre a janela de edição do jogador (`#player-modal`) e preenche automaticamente os novos dados em destaque verde.
   - Se não houver diferenças, avisa que os dados já estão validados.

## Como Instalar a Extensão no Google Chrome

1. Abra o Google Chrome e aceda a `chrome://extensions/`.
2. Ative o **Modo do programador** (canto superior direito).
3. Clique em **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta do projeto: `browser-extension/cromo-ggames`.

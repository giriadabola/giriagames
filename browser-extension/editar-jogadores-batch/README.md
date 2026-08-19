# Extensão Chrome - GiriaGames Batch Importador de Temporadas

Extensão dedicada para a página **`admin/editar-jogadores.html`**, concebida para criar e atualizar automaticamente uma nova temporada para todos os jogadores da coleção que ainda não tenham essa época criada.

## Como Funciona

1. **Aceder à Página**: Aceda ao painel de administração em `admin/editar-jogadores.html`.
2. **Abrir a Extensão**: Clique no ícone da extensão **GiriaGames - Batch Importador de Temporadas**.
3. **Selecionar a Época**: No popup da extensão, selecione a temporada desejada no menu pendente (o menu mostra quantos jogadores estão em falta para essa época).
4. **Iniciar o Processo**: Clique em **Avançar & Iniciar Batch**.
5. **Automação**:
   - A extensão identifica todos os jogadores sem essa temporada.
   - Abre a modal de edição de cada jogador para a temporada selecionada.
   - Procura a equipa e posição reais no Sofascore via Google Search.
   - Valida se a equipa existe na base de dados (nos campos `nome` e `nome_en`).
   - Copia os dados existentes do jogador mantendo o campo **"Coeficientes / estatísticas" limpo/vazio**.
   - Guarda os dados no Firestore e avança automaticamente para o próximo jogador da lista.
6. **Paragem de Segurança**: Se alguma equipa não existir na base de dados, **o processo para imediatamente** e avisa o utilizador para criar a equipa.

## Como Instalar a Extensão no Google Chrome

1. Abra o Google Chrome e aceda a `chrome://extensions/`.
2. Ative o **Modo do programador** (canto superior direito).
3. Clique em **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta dedicada: `browser-extension/editar-jogadores-batch`.

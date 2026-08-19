# ⚽ 22bet Table Copier & Odds Exporter

Extensão para navegadores baseados em Chromium (Google Chrome, Microsoft Edge, Brave, Opera) projetada para extrair e copiar facilmente tabelas de odds e mercados de apostas do **22bet4me.com** para o Excel, Google Sheets, Texto Formatado ou JSON.

---

## 🚀 Como Instalar no Navegador (Chrome / Edge / Brave)

1. Abre o teu navegador e acede a `chrome://extensions` (ou `edge://extensions` no Edge).
2. No canto superior direito, **ativa o "Modo do programador"** (Developer Mode).
3. Clica no botão **"Carregar sem compactação"** (Load unpacked).
4. Seleciona a seguinte pasta no teu computador:
   ```text
   c:\Documentos\GitHub\GiriaGames\browser-extension\22bet-table-copier
   ```
5. A extensão ficará ativa imediatamente!

---

## ✨ Funcionalidades Principais

1. **Desbloqueio de Seleção:**
   - Desativa automaticamente restrições de copiar ou selecionar texto aplicadas pelo site.

2. **Botões Injetados em cada Mercado:**
   - Em cada tabela de mercado na página (ex: *Ambas as equipas para marcarem*, *Próximo golo*), surgem dois botões elegantes:
     - `📋 Copiar`: Copia a tabela em formato texto bem alinhado.
     - `📊 Excel`: Copia em formato TSV separado por tabulação (ideal para colar no Excel/Sheets).

3. **Painel Flutuante na Página:**
   - No canto inferior direito da página surge a barra `[ 22Bet Copier | 📋 Copiar Tudo | 📊 Excel ]` para extrair todos os mercados do jogo atual de uma só vez.

4. **Menu Popup:**
   - Clica no ícone da extensão na barra de ferramentas do navegador para extrair dados em Texto, Excel ou JSON.

---

## 📊 Formato de Saída (Exemplo Excel / Sheets)

Ao colar no Excel ou Google Sheets, os dados ficam estruturados automaticamente em colunas:

| Jogo | Mercado | Seleção / Palpite | Odd |
| :--- | :--- | :--- | :--- |
| Urartu vs Syunik | Ambas as equipas para marcarem | Sim | 1.71 |
| Urartu vs Syunik | Ambas as equipas para marcarem | Não | 1.983 |
| Urartu vs Syunik | Próximo golo | Equipa 1 para marcarem o próximo golo 1 | 1.363 |

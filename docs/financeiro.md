# Sistema financeiro — integração e publicação

## Moedas e regras preservadas

- **gCoins**: carteira `users/{uid}[época].GCoins`; mercado, Manager, empréstimos e amortizações.
- **mini-gCoins**: carteira `users/{uid}[época]['mini-gcoins']`; WhoWins, Investimentos e prémios Endless. As saquetas usam a moeda configurada no servidor.
- Sem carteira mini canónica, a leitura inicial soma apenas `whowinsgCoins` e `investimentosgCoins` dessa época. Depois de uma operação segura, a carteira canónica prevalece. Nunca se soma novamente o histórico de ganhos ao saldo disponível.
- A conversão é explícita: montante mini dividido pela taxa configurada, menos a comissão da Banca. Jogador e Banca têm de receber valores inteiros; resultados fraccionários são recusados.
- A Banca grava o saldo em `paineis/Banca[época].valor`, com leitura compatível dos campos antigos. Ajustes são deltas auditados, não substituições do saldo por somas parciais do histórico.
- Dívidas transitam entre épocas e são amortizadas pela mais antiga. Os juros continuam a ser um montante fixo, não uma percentagem. Não foi inventado um limite de liquidez para empréstimos.
- Compras iniciais no mercado debitam gCoins sem inventar uma receita para a Banca. Devolver um jogador ao mercado não dá reembolso. Vendas à Banca e entre jogadores usam os descontos/comissões configurados.
- Os Investimentos continuam gratuitos: Arena 4 dá +4/-3 por vitória/derrota; Arena 5 dá +7/-4; empate dá zero, sempre em mini-gCoins. O servidor valida os resultados directamente no FootyStats e recusa respostas ambíguas ou indisponíveis.

## Endless

As opções de fundação são sorteadas uma vez no servidor e persistidas; a página envia apenas índices. A fundação continua gratuita e a liga mantém vinte clubes, substituindo bots quando necessário. As equipas e os estádios fictícios usam os nomes já existentes no jogo. Nomes de pessoas usam o fornecedor já previsto pela página, com fallback genérico.

Evolução mensal, renovação estrutural, mudança de táctica e melhorias já não permitem ao navegador escrever atributos, resultados ou saldos. Foram mantidos os intervalos aleatórios, as penalizações de reestruturação e os requisitos configurados. A simulação semanal mantém o algoritmo anterior, mas confirma resultados, pontos, reinício mensal e marcador da semana numa transacção; uma repetição não volta a distribuir pontos.

Os pontos de performance não são uma terceira carteira de gCoins. O disponível é `floor(pontos / 2) - pontosGastosNestaTemporada`. Melhorias gastam esse disponível; o prémio resgata apenas o restante em mini-gCoins e impede gastar novamente depois do resgate.

**Contradição de lore por confirmar:** o código configura por defeito 28 jornadas, dando no máximo 84 pontos / 42 de performance, mas a loja exige pelo menos 45 por melhoria (`max(45, floor(disponível × 2/3))`). Estes valores foram preservados, não corrigidos por suposição. Confirmar no manual se há outro custo, outro número de jornadas ou uma fonte adicional de performance. O manual e a configuração efectivos estão no Firestore e não foram lidos nem alterados em produção nesta intervenção.

## Segurança e compatibilidade

Débitos, créditos, propriedade, cromos e movimentos participam em transacções. As operações têm recibos persistentes ligados ao utilizador e conteúdo do pedido. Repetir uma resposta perdida não repete cobranças. Propostas entre jogadores têm consentimento privado no servidor; a caixa de entrada não é fonte de autoridade.

Todos os movimentos novos identificam explicitamente a moeda. A reconciliação de gCoins exclui mini-gCoins, incluindo estados legados. Correcções administrativas aplicam apenas a diferença; duplicados legados substituídos são arquivados em `movementAudit` antes da remoção. Não foi executada reconciliação ou limpeza de dados reais.

Administradores continuam a ter as permissões de gestão existentes. Leituras autenticadas de utilizadores/movimentos foram mantidas para rankings e histórico público. Isso não é uma migração de privacidade. A validação integral de prazos/estrutura de todos os prognósticos e o redesenho de trocas de cromos não fazem parte desta migração financeira.

## Antes de publicar

1. Executar `npm test` em `functions` e em `testes/firestore-rules` (este último requer Java 21, dependências das duas pastas e usa só projectos `demo-*`).
2. Confirmar a contradição do Endless acima e comparar as regras com o manual efectivo. Verificar os documentos de estádios/formações, permissões, taxas, preços e épocas numa conta de teste.
3. Confirmar que `paineis/configuracoes_gerais.temporadaAtual` coincide com a época mais recente de `settings/temporadas.temporadas`; regras de registo/tutorial ainda usam esse escalar.
4. Rever saldos, movimentos e atributos legados: bloquear escritas futuras não valida dados que antes eram alteráveis pelo cliente. Não transferir automaticamente o antigo cofre do Endless nem recalcular carteiras sem auditoria e aprovação.
5. Investimentos antigos precisam de nova selecção para iniciar intervalos de confiança no servidor; os saldos existentes são preservados, mas datas/históricos antigos não concedem prémios retroactivos automaticamente. Propostas de venda antigas devem ser reenviadas para criar consentimento seguro.
6. Verificar os fluxos nas páginas com contas de teste e preparar uma publicação coordenada das Functions, cliente e regras. Não publicar apenas as regras antes dos novos endpoints e páginas: os clientes antigos escrevem em campos agora protegidos.

Não houve publicação, modificação de produção ou migração automática de dados nesta intervenção.

## Verificação local de 26 de Setembro de 2026

- 26 testes de lógica: aprovados.
- 44 testes de regras e transacções no emulador: aprovados, sem testes ignorados.
- 23 endpoints/tarefas do servidor carregados com sucesso; 16 scripts de páginas verificados sintacticamente.
- Não foi feita uma sessão funcional autenticada nas páginas nem validação do fornecedor FootyStats em produção. A aprovação dos testes não resolve a contradição de custos do Endless descrita acima.

# Estoque: movimentação que salva sozinha e telas sem F5

## Movimentação (entrada e saída)

A janela "Movimentação" não tem mais botão Salvar. Quando a pessoa informa a quantidade (e o dia, que já vem preenchido), o lançamento é gravado sozinho pouco depois de ela parar de digitar (1,2 s), e a linha de estado diz o que aconteceu: "Salvando…", "Salvo. Pode corrigir os campos ou desfazer." ou "Salvo no celular. Será enviado quando houver internet." Ao sair do app no meio do preenchimento, salva na hora.

- **Corrigir**: mudar tipo, quantidade, dia ou descrição depois do primeiro salvamento altera a mesma movimentação (PATCH /api/estoque/{id}/movimentacao/{movId}); o saldo recebe só a diferença. Não cria outra.
- **Desfazer**: apaga a movimentação recém-gravada (DELETE na mesma rota) e devolve o saldo. "Lançar outra" limpa o formulário mantendo a janela aberta.
- **Concluir** fecha a janela; o que estiver preenchido e ainda não gravado é salvo antes.
- Saídas geradas pelo trato dos lotes não passam por essas rotas (409): continuam sendo alteradas pelo lote.
- A resposta das rotas traz o insumo já com o consumo dos lotes (dias até acabar), então a ficha e a lista mostram o saldo novo sem recarregar.
- **Sem internet** (ou a rede falhou): a movimentação fica no aparelho (`pending_estoque-mov` no localStorage), o saldo mostrado já reflete e a linha aparece como "a enviar". Quando a internet volta, a tela envia sozinha (também pelo botão "Enviar registros"). Corrigir uma movimentação que já está no servidor precisa de internet.

As regras (validação, sinal da quantidade, diferença entre duas versões, aplicação das pendentes no saldo) estão em src/lib/stockMovements.ts, puras e testadas em tests/estoque-movimentacao.cjs junto com as rotas. O comportamento da tela está em tests/estoque-autosave.cjs (Playwright, com as rotas simuladas).

## Telas que só mostravam o registro depois do F5

Nas telas Estoque (cadastrar produto), Vacinação e Tratamentos, o que era salvo sem internet não aparecia na lista nem depois de recarregar: a lista exigia a marca `_type: 'create'` que o salvamento não gravava. Agora a marca é gravada, a lista aceita registros antigos sem ela e é atualizada na hora depois de salvar. No Financeiro, os lançamentos feitos sem internet agora entram na lista e nos totais do período (marcados como "a enviar"), podem ser excluídos da fila e a tela não fica em "Carregando..." quando a rede falha. Produtos cadastrados sem internet aparecem como "Aguardando envio" e não aceitam movimentação até serem enviados.

Nas demais telas (animais, reprodução, leite, lotes, usuários, propriedades, ofertas) a lista já era atualizada depois de salvar, editar ou excluir.

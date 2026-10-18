# Relatório de vendas do fornecedor e resumo mensal/anual do Painel

## Vendas por oferta (painel do fornecedor, seção "Vendas no mês")

O que entra no relatório é o **contato** do produtor com uma oferta e o que ele virou:

- Quando o produtor toca em "Chamar no WhatsApp" numa oferta, além de somar na contagem de chamadas, abre-se um contato (`offer_contacts`, status `contato`) da propriedade com aquela oferta. Cliques repetidos da mesma propriedade na mesma oferta não abrem outro contato enquanto o anterior estiver sem resposta.
- Em **Contatos a confirmar**, o fornecedor diz o que aconteceu: "Virou venda" (com valor, quantidade e dia, todos opcionais menos o dia) ou "Não fechou" (`perdido`). Só a venda confirmada conta como venda convertida.
- **Registrar venda**: venda fechada fora do app (balcão, telefone) ligada a uma oferta, para um cliente do app ou para um nome avulso. Entra como contato e venda (`source: manual`). Pode ser excluída; uma venda que veio de contato pode ser desfeita (volta a contato).
- Período: este mês, mês passado, este ano ou datas livres. A venda conta pelo dia em que fechou; contatos e perdidos pelo dia do contato.
- O relatório mostra contatos, vendas, conversão (vendas ÷ contatos) e valor; o **ranking das ofertas que mais venderam** (vendas, depois valor, depois contatos); mês a mês quando o período tem mais de um mês; e, à parte, os pedidos de orçamento marcados como atendidos no período (venda fora das ofertas, com o preço respondido).
- O cartão "Vendas no mês" no topo do painel mostra as vendas do mês e fica em destaque quando há contato esperando resposta.

Rotas: `GET /api/fornecedor/vendas?from&to`, `POST /api/fornecedor/vendas` (venda à mão), `PATCH/DELETE /api/fornecedor/vendas/{id}`; o clique continua em `POST /api/ofertas/{id}/whatsapp`. Regras puras em src/lib/offerSales.ts (tests/vendas-ofertas.cjs cobre regras, rotas e o clique); tela em src/app/fornecedor/VendasTab.tsx (tests/fornecedor-vendas-ui.cjs). Migration 9_w_vendas_ofertas cria a tabela.

## Painel: visão mensal e visão anual

Na tela inicial da propriedade, a seção **Resumo do período** tem o botão "Visão mensal" / "Visão anual":

- Mensal: leite produzido no mês (e o valor estimado pelo preço do litro, quando cadastrado), receitas, despesas, saldo e nascimentos.
- Anual: os mesmos totais do ano e uma tabela mês a mês (até o mês atual), com total no rodapé.
- Cada número só aparece para quem tem acesso ao módulo (leite, financeiro, reprodução); o leite também depende do segmento da propriedade. As duas visões vêm prontas do servidor e a troca é imediata, sem nova busca.

Regras puras em src/lib/periodSummary.ts (tests/painel-periodo.cjs); busca no banco em src/lib/periodSummaryData.ts; tela em src/components/PeriodSummary.tsx.

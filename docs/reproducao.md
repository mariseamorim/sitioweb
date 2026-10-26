# Reprodução: cobertura e inseminação

Registro por fêmea, como nos apps de mercado (Rebanho Fácil, Controle IATF): poucos campos por vaca e o que se repete no dia de inseminação fica preenchido de uma fêmea para a outra.

## Registro rápido

Em Reprodução > + Registrar: fêmea, como foi (Inseminação, IATF, Monta natural ou Repasse), touro, data e status. "Mais detalhes" (recolhido) tem partida do sêmen e inseminador (só na inseminação), registro do touro, data do cio e observações.

"Salvar e repetir para outra fêmea" salva e mantém data, tipo, touro, partida e inseminador; limpa fêmea, cio e observações. Um aviso diz quantas coberturas foram salvas e o que ficou preenchido. Sem internet, cada cobertura entra na fila do aparelho e sobe em "Sincronizar".

Na ficha, uma cobertura em andamento mostra os dias de gestação, quanto falta para o parto (ou o atraso) e uma barra. É conta sobre a data da cobertura e o parto previsto, sem campo novo.

O que ficou de fora do protótipo "Cadastro de inseminação", de propósito: hora, raça do touro, empresa fornecedora, função do responsável, protocolo hormonal e as caixas de cio natural, anestro e problema uterino. Quem precisa escreve em observações. O diagnóstico de gestação é o painel "Confirmar prenhez" e o status.

## Regras

- Tipo opcional. Partida do sêmen e inseminador são descartados na monta natural e no repasse, mesmo que venham no pedido.
- Parto previsto: cobertura + 280 dias, para Coberta e Prenha. Vazia e Perdida ficam sem previsão.
- A lista de fêmeas segue `canBreed`: bovina a partir de 2 anos, ou 13 meses na recria.
- A mesma regra vale no lote de recria (tela Recria e engorda), que usa o mesmo formulário de tipo.

## Código

- `src/lib/coverage.ts`: tipos, repetir, gestação e `parseCoverageDetails` (o que o servidor aceita).
- `src/app/api/reproducao/route.ts` e `[id]/route.ts`.
- `src/app/reproducao/page.tsx`; o lote de recria em `src/app/engorda/LotDetail.tsx`.

```powershell
node tests/cobertura.cjs
```

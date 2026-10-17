# Administrador: propriedades por proprietário

O administrador vê todas as propriedades agrupadas por proprietário em dois lugares: no Painel, quando ainda não abriu nenhuma propriedade, e na tela Propriedades. O produtor continua vendo as suas propriedades como antes.

## Regra de agrupamento

- Agrupa pelo CPF/CNPJ (só os números, então "123.456.789-00" e "12345678900" são o mesmo dono).
- Sem documento, agrupa pelo nome do proprietário, ignorando maiúsculas, acentos e espaços repetidos.
- Sem nome nem documento, a propriedade vai para "Sem proprietário informado", por último, com o botão Completar para preencher o cadastro.
- O nome do grupo é o primeiro nome de proprietário informado; sem nome, o documento formatado.
- Grupos em ordem alfabética; propriedades em ordem alfabética dentro do grupo.

## O que cada propriedade mostra

Cidade, animais vivos, pessoas com acesso, segmentos (leite, cria, recria, engorda) e o último lançamento. O último lançamento é a data mais recente entre leite, financeiro, reprodução, alteração de animal e lote. Sem nada lançado há 30 dias, ou nunca, a propriedade aparece como parada, em vermelho.

## Filtros e busca

Todas, várias propriedades, sem lançamento há 30 dias, sem proprietário e inativas (só aparece se houver alguma). A busca procura em proprietário, CPF/CNPJ com ou sem pontuação, nome da propriedade e cidade, sem diferenciar acentos. Os números do topo (paradas e sem proprietário) aplicam o filtro ao toque.

## Código

- `src/lib/ownerGroups.ts`: regra pura de agrupamento, filtros, totais e texto do último lançamento.
- `src/lib/adminFarms.ts`: resumo de todas as propriedades com uma consulta agrupada por tabela.
- `src/app/api/admin/propriedades/route.ts`: a lista para a tela Propriedades (só administrador).
- `src/components/OwnerGroups.tsx`: a lista agrupada, usada no Painel (`FarmPicker`) e em Propriedades.

```powershell
node tests/owner-groups.cjs
```

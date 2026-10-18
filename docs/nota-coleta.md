# Nota do laticínio com mais de um nome

O mesmo tanque pode gerar mais de uma nota no laticínio: dois produtores cadastrados (dois códigos), cada um recebendo uma parte do leite. A divisão muda a cada coleta. O produtor continua anotando o total do dia; no dia da coleta diz quanto vai para cada nome.

## Para o produtor (Anota Aí Leite e versão completa)

- **Nomes** (aba do Anota Aí Leite): cadastro de quem divide o leite do local, com nome como está na folha, código de produtor no laticínio e sequência na folha. Laticínio, rota e tanque não são preenchidos pelo produtor. Cadastrar e alterar nomes precisa de internet. Tirar um nome o deixa fora das próximas coletas; as divisões feitas ficam no histórico.
- **Anotar**: com nomes cadastrados, aparece "Coleta hoje? Dividir a nota" abaixo do leite do dia, com os litros desde a coleta anterior (dia seguinte a ela até o dia; sem coleta anterior, só o dia). O total pode ser corrigido. Sugestões: como da última coleta (mesma proporção), igual para todos, tudo num nome. Com dois nomes, digitar um lado completa o outro. A soma precisa bater com o total para salvar. Funciona sem internet: a divisão entra na fila do aparelho e é enviada depois, como as anotações.
- **Histórico**: "Por nome da nota" com o total de cada nome no período e a porcentagem, e a marca "coleta" nos dias com divisão.

Na versão completa os nomes ficam na propriedade e a divisão usa o total do dia da Produção de leite.

## Folha do carreteiro pela foto (OCR)

A aba Conferir virou **Folha**. O produtor tira a foto da folha preenchida pelo carreteiro, ou escolhe uma foto da galeria, e o app lê, no próprio aparelho, o dia, os litros de cada nome, o total, a temperatura, o nº da amostra e a régua. Cada número aparece para conferir (com a confiança da leitura nos litros por nome) antes de salvar. Também dá para digitar a folha. A foto reduzida (JPEG de até 600 KB) fica guardada junto da coleta, como prova, e abre em "Foto".

- Leitor: Tesseract.js com o idioma português. O worker e os núcleos (12 MB) são copiados do node_modules para public/ocr no postinstall (scripts/copy-ocr.mjs) e não ficam no git; o idioma por.traineddata.gz (1 MB) fica. O service worker guarda esses arquivos por um ano depois da primeira leitura, que precisa de internet; depois lê sem sinal.
- O impresso (cabeçalho, códigos, nomes) lê bem; os números escritos à mão são sugestão. A regra está em src/lib/folhaOcr.ts (pura, testada em tests/folha-ocr.cjs) e aceita trocas comuns do OCR (O por 0, l por 1).
- Os litros por nome lidos da folha viram a divisão daquela coleta (milk_splits), e o total vai para a folha (milk_sheets, com temperatura, amostra, régua e foto: migration 9_v_folha_foto). A comparação com o anotado continua a mesma (diferença acima de 5% em vermelho).
- Na aba Nomes, "Fotografar a folha do laticínio" lê as linhas dos produtores e cadastra os nomes com código e sequência de uma vez.
- Histórico, em "Por nome da nota", lista coleta a coleta o que foi para cada nome e o que a folha disse.

## Fora desta entrega

Coleta do carreteiro com régua, temperatura e amostra pelo app do motorista; folha do mês em PDF. O motorista não tem nomes nem divisão.

## Banco

Migration `9_t_nomes_da_nota`: tabelas `milk_payees` (nome ligado ao local ou à propriedade) e `milk_splits` (litros de um nome num dia de coleta, único por nome e dia).

```powershell
npx prisma migrate deploy
npx prisma generate
```

## Código

- `src/lib/lite.ts`: tipos e regras puras (dias de coleta, litros desde a última coleta, sugestão, total por nome).
- `src/lib/liteStore.ts`: fila `lite_splits_queue_v1`, aplicada à cópia do aparelho e enviada em `PUT /api/lite/divisao`.
- `src/lib/payees.ts`: escopo dos nomes (propriedade ou locais do produtor) e carga para a tela.
- `src/app/api/lite/nomes` (GET, POST, PATCH) e `src/app/api/lite/divisao` (PUT). `GET /api/lite` devolve `payees` e `splits`.
- `src/app/lite/page.tsx`: componentes `SplitCard` e `Nomes`, total por nome no `History`.

```powershell
node tests/lite-nota.cjs
```

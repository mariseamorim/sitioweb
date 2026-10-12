# Regras de animais e produção de leite

## Animais

- Fêmea bovina com menos de 30 meses: Bezerra; Adicionar cria fica desabilitado.
- A partir de 30 meses completos: Vaca; permite cadastrar ou vincular crias.
- Macho bovino com menos de 36 meses: Bezerro; não exibe Adicionar cria.
- A partir de 36 meses, macho não castrado: Touro.
- Macho castrado: Boi de engorda.
- Ao escolher Compra, uma vaca precisa ter pelo menos 36 meses. Bezerras compradas continuam permitidas.
- Classificação acompanha a idade nas consultas, inclusive no cache offline, sem precisar editar o animal a cada aniversário.
- Datas são comparadas por calendário, considerando o dia de negócio em America/Sao_Paulo. Os limites de 30 e 36 meses incluem o próprio aniversário.

Cadastro e edição incluem origem e castração. A API valida as mesmas regras da tela; associar uma cria a uma mãe jovem, macho ou de outra propriedade é rejeitado. Animais antigos classificados como Boi recebem a marcação de castração na migration.

## Leite

- Preço padrão por litro na tela Produção de Leite, compartilhado com o preço da propriedade usado no Anota Aí Leite.
- Cada novo lançamento armazena seu preço, que pode ser alterado no formulário. Mudanças no padrão não recalculam lançamentos anteriores.
- Abra um dia ou uma vaca e use Editar para alterar data, litros, preço, observações e, nos totais, vacas ordenhadas.
- Edição exige internet e respeita as permissões e a propriedade do lançamento.
- Registros offline guardam também o preço e mantêm esse valor ao sincronizar.
- Registros antigos sem preço permanecem sem preço. A estimativa do período inclui apenas registros com preço informado.

## Banco e testes

Aplique a migration `8_animal_rules_milk_price` antes de executar a nova versão:

```powershell
npx prisma migrate deploy
npx prisma generate
```

O build de produção da Vercel já aplica migrations pelo script existente. As migrations anteriores pendentes também precisam ser aplicadas.

```powershell
node tests/animal-milk-rules.cjs
node tests/animal-milk-ui.cjs
```

Os testes usam dados simulados e não alteram o banco. O teste de interface requer Edge e servidor local na porta 3458, ou `TEST_BASE_URL` indicando o servidor de teste.

# Recria por animal

Pedido do testador: "recria tem o mesmo campo de engorda, não é possível cadastrar individual". Os apps de mercado (Rebanho Fácil, Ideagri) tratam a recria do pequeno rebanho por animal: desmama, pesagem individual e categoria, sem obrigar a criar lote. O lote continua para quem engorda em grupo.

## O que mudou

- **Entrar na recria.** Na ficha do bezerro, em Animais, o botão "Entrar na recria (desmama)" pede data da desmama, peso na desmama e peso-alvo (para a primeira cobertura, na novilha, ou para a engorda, no macho). Também em Recria e engorda > "Acompanhar um animal". Não pede nome de lote.
- **Aba Recria.** Mostra os animais acompanhados um a um (idade, dias na recria, último peso, ganho por dia, previsão de chegar ao alvo) e, abaixo, os lotes de recria. O número da aba soma os dois.
- **Ficha da recria.** Pesar, histórico de pesagens (as do lote aparecem marcadas e só saem pela tela do lote), peso-alvo, cobertura da novilha (mesmo formulário do lote, com os tipos IA, IATF, monta e repasse) e "Sair da recria" (vendido, foi para a engorda ou virou matriz). Quem saiu fica em "Saíram da recria" e pode voltar.
- **Campos diferentes da engorda.** A recria tem desmama e alvo de cobertura; produtos de cocho, trato e previsão de abate ficam só no lote.

## Regras

- Entra: bovino vivo que ainda não é vaca nem touro pela idade (bezerro, bezerra, boi jovem), fora de lote e fora da recria. A classificação acompanha a idade (`animalCategory`).
- Desmama entre o nascimento e hoje; pesos até 2000 kg. O peso na desmama vira a primeira pesagem do animal.
- As contas só usam pesagens a partir da desmama. Ganho por dia e previsão do alvo seguem `animalGain` e `projectTarget`, as mesmas da tela de lotes.
- Novilha na recria (lote ou um a um) pode ser coberta a partir de 13 meses (`canBreed` com `inRearingLot`).

## Sem internet

A lista da recria fica guardada no aparelho (`recria_cache_<fazenda>`). Desmama, pesagem e saída entram na fila `pending_recria` e aparecem na lista já aplicadas, com a marca "na fila". A fila sobe quando a tela Recria e engorda ou Animais abre com sinal, ou em "Sincronizar". Um item recusado pelo servidor (regra, 400) sai da fila para não travar os outros. Peso-alvo, apagar pesagem e cobertura pela ficha precisam de sinal; a cobertura sem sinal é pela tela Reprodução.

## Código

- `src/lib/rearing.ts`: quem entra, entrada, contas, fila (rota de cada item) e `applyPending`.
- `src/lib/rearingQueue.ts`: lista guardada, fila e `syncRearing`.
- `src/app/api/recria/route.ts` (lista), `src/app/api/animals/[id]/recria/route.ts` (entrar, alvo, sair) e `src/app/api/animals/[id]/pesagens/route.ts` (pesagem fora de lote).
- `src/app/engorda/RearingAnimals.tsx` (seção, ficha, acompanhar), `src/components/RearingEntryForm.tsx` (usado também na ficha do animal).
- Migration `9_y_recria_por_animal`: `rearingStart`, `rearingEnd`, `rearingTarget` em `animals`.

```powershell
node tests/recria.cjs
```

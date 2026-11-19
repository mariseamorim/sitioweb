import { useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { isoDay, todayISO } from '@/lib/format'
import { listReproductions, undoDiagnosis, updateStatus, type Reproduction } from '@/repos/reproductions'
import { useSyncState } from '@/sync'
import { Empty, Muted, useBottomInset } from '@/ui'
import { colors, font, radius, space } from '@/theme'
import { useT } from '@/lib/i18n'

type Answer = 'Prenha' | 'Vazia'
/** Antes disso o toque ou o ultrassom ainda não confirmam a gestação */
const MIN_DAYS = 28
const DAY = 24 * 60 * 60 * 1000
const daysSince = (date: string) => Math.max(0, Math.round((Date.parse(todayISO()) - Date.parse(isoDay(date))) / DAY))

// Diagnóstico de gestação em lote (como src/app/reproducao/diagnostico/page.tsx do site): as coberturas sem resposta,
// com dois botões grandes por animal. Grava no aparelho na hora e envia pela fila, então funciona sem internet.
export default function DiagnosticoEmLote() {
  const farmId = useFarmId()
  const { canEdit, user } = useSession()
  const sync = useSyncState()
  const bottom = useBottomInset()
  const t = useT()
  // O que foi respondido nesta visita continua na lista (com "desfazer"); guarda o parto previsto de antes
  const [answered, setAnswered] = useState<Record<string, { answer: Answer; expected: string | null }>>({})
  const rows = useLive(
    () => listReproductions(farmId).filter(r => r.status === 'Coberta' || !!answered[r.id]).sort((a, b) => isoDay(a.coverageDate).localeCompare(isoDay(b.coverageDate))),
    [farmId, answered],
  )

  function answer(r: Reproduction, value: Answer) {
    setAnswered(current => ({ ...current, [r.id]: { answer: value, expected: r.expectedBirthDate } }))
    updateStatus(farmId, r.id, value, '', r.observations)
  }

  function undo(r: Reproduction) {
    const previous = answered[r.id]
    setAnswered(current => { const next = { ...current }; delete next[r.id]; return next })
    undoDiagnosis(farmId, r.id, previous?.expected ?? null)
  }

  const done = Object.keys(answered).length
  const pregnant = Object.values(answered).filter(a => a.answer === 'Prenha').length

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={r => r.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 32 + bottom }}
        ListHeaderComponent={(
          <View style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
              <Muted style={{ flex: 1 }}>{user?.farmName} · {t('coberturas sem diagnóstico de gestação')}</Muted>
              {rows.length > 0 ? (
                <View style={{ backgroundColor: colors.text, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }} accessibilityLabel={t('{done} de {total} diagnosticadas', { done, total: rows.length })}>
                  <Text style={{ color: colors.white, fontWeight: '700', fontSize: font.sm }}>{done}/{rows.length}</Text>
                </View>
              ) : null}
            </View>
            {done > 0 ? <Text style={{ color: colors.text, fontSize: font.sm, marginTop: space.xs }}>{pregnant} {t(pregnant === 1 ? 'prenha' : 'prenhas')} · {done - pregnant} {t(done - pregnant === 1 ? 'vazia' : 'vazias')}</Text> : null}
          </View>
        )}
        renderItem={({ item: r }) => {
          const given = answered[r.id]?.answer
          const days = daysSince(r.coverageDate)
          const tone = given === 'Prenha' ? { borderColor: colors.green, backgroundColor: colors.greenSoft } : given === 'Vazia' ? { borderColor: colors.red, backgroundColor: colors.redSoft } : { borderColor: colors.border, backgroundColor: colors.white }
          return (
            <View style={[{ borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md }, tone]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }} numberOfLines={2}>
                    {r.femaleName ?? t('Animal removido')} <Text style={{ fontWeight: '400', color: colors.muted }}>({r.femaleCustomCode || r.femaleCode})</Text>
                  </Text>
                  <Text style={{ fontSize: font.sm, color: colors.muted }}>
                    {t(r.method === 'ia' ? (days === 1 ? 'Inseminada há {n} dia' : 'Inseminada há {n} dias') : (days === 1 ? 'Coberta há {n} dia' : 'Coberta há {n} dias'), { n: days })}{r.maleName ? ` · ${r.maleName}` : ''}{!given && days < MIN_DAYS ? ` · ${t('cedo para diagnosticar')}` : ''}
                  </Text>
                  {given ? <Text style={{ fontSize: font.sm, fontWeight: '700', marginTop: 2, color: given === 'Prenha' ? colors.green : colors.red }}>{given === 'Prenha' ? `✓ ${t('Prenha')}` : `✓ ${t('Vazia · liberada para nova cobertura')}`}</Text> : null}
                </View>
                {given && canEdit ? (
                  <Pressable onPress={() => undo(r)} hitSlop={8} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}>
                    <Text style={{ color: colors.text, fontWeight: '600', textDecorationLine: 'underline' }}>{t('desfazer')}</Text>
                  </Pressable>
                ) : null}
              </View>
              {!given && canEdit ? (
                <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
                  <BigButton label={`✓ ${t('Prenha')}`} color={colors.green} onPress={() => answer(r, 'Prenha')} />
                  <BigButton label={`✕ ${t('Vazia')}`} color={colors.red} onPress={() => answer(r, 'Vazia')} />
                </View>
              ) : null}
            </View>
          )
        }}
        ListEmptyComponent={<Empty title={t(sync.syncing ? 'Baixando os dados da propriedade…' : 'Nenhuma cobertura aguardando diagnóstico')} text={sync.syncing ? undefined : t('As coberturas anotadas em Reprodução aparecem aqui até receberem o diagnóstico.')} />}
      />
    </View>
  )
}

function BigButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: radius.md, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
      <Text style={{ color: colors.white, fontWeight: '700', fontSize: font.md }}>{label}</Text>
    </Pressable>
  )
}

import { Stack } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { NetworkError } from '@/api/client'
import { useFarmId, useSession } from '@/auth/session'
import { brNumber } from '@/lib/format'
import { MAX_STAGES, planDays, type LotPlan } from '@/lib/lotPlans'
import { decimal, parseKg, toField } from '@/lib/lots'
import { deletePlan, savePlan, usePlans } from '@/repos/lotPlans'
import { Badge, Button, Card, Chips, Empty, Field, IconCircle, Muted, Notice, Screen } from '@/ui'
import { Section, TextButton, kg } from '@/ui/lots'
import { colors, font, radius, space } from '@/theme'
import { useT } from '@/lib/i18n'

/** Planos de recria/engorda (porte de src/app/engorda/Plans.tsx do site). Ver funciona sem internet; salvar precisa de conexão. */
export default function Planos() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const t = useT()
  const { plans, offline, error: loadError, loaded, setPlans } = usePlans(farmId)
  // null = fechado; 'novo' = plano novo; plano = editar
  const [editing, setEditing] = useState<LotPlan | 'novo' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fail = (e: unknown) => setError(e instanceof NetworkError ? t('Sem internet: para salvar o plano, conecte o celular à internet.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))

  const remove = (plan: LotPlan) => {
    Alert.alert(t('Excluir o plano {name}?', { name: plan.name }), t('Os lotes que usam este plano ficam sem plano. As pesagens e despesas continuam.'), [
      { text: t('Cancelar'), style: 'cancel' },
      {
        text: t('Excluir'), style: 'destructive', onPress: async () => {
          setError('')
          setBusy(true)
          try { setPlans(await deletePlan(farmId, plan.id)) } catch (e) { fail(e) } finally { setBusy(false) }
        },
      },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Planos') }} />
      <Muted style={{ marginBottom: space.sm }}>{t('O plano diz quanto o lote deve ganhar por dia em cada etapa e a meta de peso. No desempenho do lote, o app compara o peso real com o esperado.')}</Muted>
      {offline ? <Notice text="Sem internet: mostrando a última cópia dos planos guardada no celular. Para criar ou alterar um plano, conecte-se." /> : null}
      {loadError ? <Notice tone="red" text={loadError} /> : null}
      {error ? <Notice tone="red" text={error} /> : null}

      {editing ? (
        <PlanForm plan={editing === 'novo' ? null : editing} offline={offline} onCancel={() => setEditing(null)}
          onSave={async input => {
            setError('')
            try {
              setPlans(await savePlan(farmId, input, editing === 'novo' ? undefined : editing.id))
              setEditing(null)
            } catch (e) { fail(e) }
          }} />
      ) : canEdit ? <Button label="Novo plano" onPress={() => { setError(''); setEditing('novo') }} style={{ marginBottom: space.md }} /> : null}

      {!loaded && plans.length === 0 ? <Muted>{t('Carregando...')}</Muted> : plans.length === 0 ? (
        <Empty title="Nenhum plano ainda" text="Crie um plano com as etapas (cria, recria, engorda), o ganho por dia esperado em cada uma e a meta de peso. Depois escolha o plano no lote." />
      ) : plans.map(p => {
        const days = planDays(p)
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <IconCircle icon="trending-up-outline" tone={p.active ? 'green' : 'muted'} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }}>{p.name}</Text>
                {p.description ? <Muted>{p.description}</Muted> : null}
              </View>
              <Badge label={p.active ? 'Ativo' : 'Inativo'} tone={p.active ? 'green' : 'muted'} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 4, marginTop: space.sm }}>
              <Text style={{ color: colors.text }}>{t('Duração')}: <Text style={{ fontWeight: '700' }}>{days > 0 ? t('{n} dias', { n: days }) : '—'}</Text></Text>
              <Text style={{ color: colors.text }}>{t('Meta de peso')}: <Text style={{ fontWeight: '700' }}>{p.targetWeight ? kg(p.targetWeight) : '—'}</Text></Text>
            </View>
            {p.stages.length > 0 ? (
              <View style={{ marginTop: space.sm }}>
                {p.stages.map((s, i) => (
                  <Muted key={i}>
                    {i + 1}. {s.name || t('Etapa {n}', { n: i + 1 })}
                    {s.gmd !== null ? ` · ${brNumber(s.gmd, 3)} ${t('kg/dia')}` : ''}
                    {s.days !== null ? ` · ${t('{n} dias', { n: s.days })}` : ''}
                    {s.weight !== null ? ` · ${kg(s.weight)}` : ''}
                  </Muted>
                ))}
              </View>
            ) : null}
            {canEdit ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space.lg, marginTop: space.sm }}>
                <TextButton label="Editar" disabled={busy} onPress={() => { setError(''); setEditing(p) }} />
                <TextButton label="Excluir" tone="red" disabled={busy} onPress={() => remove(p)} />
              </View>
            ) : null}
          </Card>
        )
      })}
    </Screen>
  )
}

// ── Formulário do plano ─────────────────────────────────────────────────

interface StageForm { name: string; gmd: string; days: string; weight: string }
const EMPTY_STAGE: StageForm = { name: '', gmd: '', days: '', weight: '' }
type PlanSave = Parameters<typeof savePlan>[1]

function PlanForm({ plan, offline, onCancel, onSave }: { plan: LotPlan | null; offline: boolean; onCancel: () => void; onSave: (input: PlanSave) => Promise<void> }) {
  const t = useT()
  const [name, setName] = useState(plan?.name ?? '')
  const [active, setActive] = useState<'sim' | 'nao'>(plan?.active === false ? 'nao' : 'sim')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [targetWeight, setTargetWeight] = useState(toField(plan?.targetWeight))
  // Sempre as 5 etapas; as vazias não são gravadas
  const [stages, setStages] = useState<StageForm[]>(() => Array.from({ length: MAX_STAGES }, (_, i) => {
    const s = plan?.stages[i]
    return s ? { name: s.name, gmd: toField(s.gmd), days: s.days ? String(s.days) : '', weight: toField(s.weight) } : EMPTY_STAGE
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const setStage = (i: number, patch: Partial<StageForm>) => setStages(list => list.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const totalDays = stages.reduce((sum, s) => sum + (Number(s.days) || 0), 0)

  async function save() {
    if (!name.trim()) return setError(t('Dê um nome ao plano'))
    const target = targetWeight.trim() ? parseKg(targetWeight) : null
    if (targetWeight.trim() && (target === null || target > 2000)) return setError(t('Meta de peso inválida'))
    const filled = stages.filter(s => s.name.trim() || s.gmd || s.days || s.weight)
    const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null)
    setError('')
    setSaving(true)
    try {
      await onSave({
        name: name.trim(), description, active: active === 'sim', targetWeight: target,
        stages: filled.map(s => ({ name: s.name.trim(), gmd: num(s.gmd), days: s.days ? Number(s.days) : null, weight: num(s.weight) })),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title={plan ? 'Editar plano' : 'Novo plano'}>
      <View style={{ backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: space.md, marginBottom: space.md }}>
        {offline ? <Notice text="Sem internet: salvar o plano precisa de conexão." /> : null}
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Engorda a pasto com suplemento" />
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted }}>{t('Situação')}</Text>
        <Chips value={active} onChange={setActive} options={[{ value: 'sim', label: 'Ativo' }, { value: 'nao', label: 'Inativo' }]} />
        <Field label="Descrição" value={description} onChangeText={setDescription} multiline />

        <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: space.sm }}>{t('Informe o ganho médio diário (GMD) em cada etapa')}</Text>
        {stages.map((s, i) => (
          <View key={i} style={{ backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: space.sm, marginBottom: space.sm }}>
            <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.muted, marginBottom: 4 }}>{t('Etapa {n}', { n: i + 1 })}</Text>
            <Field label="Etapa" value={s.name} onChangeText={v => setStage(i, { name: v })} placeholder="cria, recria, engorda…" />
            {/* Com letra grande, os três campos descem para a linha de baixo em vez de espremer */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm }}>
              <Field label="GMD (kg/dia)" value={s.gmd} onChangeText={v => setStage(i, { gmd: decimal(v) })} keyboardType="decimal-pad" placeholder="Ex.: 0,8" style={{ flexGrow: 1, flexBasis: 110 }} />
              <Field label="Tempo (dias)" value={s.days} onChangeText={v => setStage(i, { days: v.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="Ex.: 90" style={{ flexGrow: 1, flexBasis: 110 }} />
              <Field label="Peso (kg)" value={s.weight} onChangeText={v => setStage(i, { weight: decimal(v) })} keyboardType="decimal-pad" placeholder="Ex.: 380" style={{ flexGrow: 1, flexBasis: 110 }} />
            </View>
          </View>
        ))}
        <Muted style={{ marginBottom: space.md }}>{t('Preencha só as etapas que usar. Duração do plano: {n} dias.', { n: totalDays })}</Muted>

        <Field label="Meta de peso final (kg)" value={targetWeight} onChangeText={v => setTargetWeight(decimal(v))} keyboardType="decimal-pad" placeholder="Ex.: 540" />
        {error ? <Notice tone="red" text={error} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button label="Cancelar" variant="secondary" onPress={onCancel} style={{ flexGrow: 1, flexBasis: 120 }} />
          <Button label={saving ? 'Salvando...' : 'Salvar plano'} onPress={() => void save()} loading={saving} style={{ flexGrow: 1, flexBasis: 120 }} />
        </View>
      </View>
    </Section>
  )
}

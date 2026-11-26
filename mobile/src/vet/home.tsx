// Painel do veterinário (tela Início): a saudação, os números do dia que levam ao assunto (manejos, urgentes, prenhes,
// partos), os atalhos de trabalho, as visitas de hoje, o que está atrasado e as propriedades atendidas.
// Os números vêm do painel (GET /api/veterinario) e da agenda (GET /api/veterinario/agenda); sem internet, a última cópia.
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { todayISO } from '@/lib/format'
import { ddmm } from '@/lib/agenda'
import { useLocale, useT } from '@/lib/i18n'
import { ActionCard, Badge, Card, Muted, Notice, Tile, TileGrid } from '@/ui'
import { colors, font, space } from '@/theme'
import { FarmKindBadge, useOpenFarm, useVetPanel } from '@/vet/panel'
import { agendaSiteHref, useVetAgenda } from '@/vet/agenda'

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora do celular */
export function greetingFor(hour: number) {
  return hour < 12 ? 'Bom dia, {name}' : hour < 18 ? 'Boa tarde, {name}' : 'Boa noite, {name}'
}

/** Nome da saudação: o primeiro nome, com o "Dr." ou "Dra." quando o cadastro começa assim ("Dra. Ana Souza" → "Dra. Ana") */
export function greetingName(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (/^dr(a)?\.?$/i.test(parts[0]) && parts[1]) return `${parts[0]} ${parts[1]}`
  return parts[0]
}

const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, minHeight: 56, paddingVertical: space.sm }
const divider = { borderBottomWidth: 1, borderBottomColor: colors.border }

export function VetHome() {
  const { user } = useSession()
  const router = useRouter()
  const t = useT()
  const locale = useLocale()
  const { panel, offline } = useVetPanel()
  const agenda = useVetAgenda()
  const [error, setError] = useState('')
  const { open, busy } = useOpenFarm(setError)
  const today = todayISO()

  const items = agenda.items ?? []
  const todayItems = items.filter(i => i.date === today)
  const late = items.filter(i => i.late)
  const visitsToday = todayItems.filter(i => i.kind === 'visita').sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const clients = panel?.clients ?? []
  const sum = (pick: (c: (typeof clients)[number]) => number) => clients.reduce((s, c) => s + pick(c), 0)
  const rates = clients.filter(c => c.pregnancyRate !== null).map(c => c.pregnancyRate as number)
  const conception = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  const farmsToday = new Set(todayItems.map(i => i.farmId).filter(Boolean)).size
  const lateByFarm = (farmId: string) => late.filter(i => i.farmId === farmId).length
  const farms = [...clients].sort((a, b) => lateByFarm(b.farmId) - lateByFarm(a.farmId) || a.name.localeCompare(b.name))

  const date = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const dateText = date.charAt(0).toUpperCase() + date.slice(1)
  const goAgenda = (periodo: 'hoje' | 'semana' | 'atrasadas', tipo?: string) => router.push({ pathname: '/minha-agenda', params: { periodo, tipo: tipo ?? '', toque: String(Date.now()) } })
  const openFarmAnimals = async (farmId: string) => {
    if (await open(farmId)) router.push({ pathname: '/(tabs)/animais', params: { propriedade: farmId, filtro: 'todos', toque: String(Date.now()) } })
  }
  const shortcut = user?.farmName ? t('em {farm}', { farm: user.farmName }) : undefined

  return (
    <>
      <View style={{ marginBottom: space.md }}>
        <Text style={{ fontSize: font.xl, fontWeight: '700', color: colors.text }}>{t(greetingFor(new Date().getHours()), { name: greetingName(user?.name) })}</Text>
        <Muted>{dateText} · {t(clients.length === 1 ? '1 propriedade atendida' : '{n} propriedades atendidas', { n: clients.length })}</Muted>
      </View>
      {offline ? <Notice text={t('Sem internet: mostrando os números da última vez que o painel carregou.')} /> : null}
      {error ? <Notice tone="red" text={error} /> : null}

      <TileGrid>
        <Tile accent="blue" icon="clipboard-outline" label={t('Manejos do dia')} value={String(todayItems.length)}
          detail={farmsToday ? t(farmsToday === 1 ? 'em 1 propriedade' : 'em {n} propriedades', { n: farmsToday }) : t('Nada para hoje')} onPress={() => goAgenda('hoje')} />
        <Tile accent="red" icon="alert-circle-outline" label={t('Urgentes')} value={String(late.length)}
          detail={late.length ? t('passaram da data') : t('Nada atrasado')} onPress={() => goAgenda('atrasadas')} />
        <Tile accent="green" icon="heart-outline" label={t('Prenhes')} value={String(sum(c => c.pregnant ?? 0))}
          detail={conception === null ? undefined : t('concepção média {p}%', { p: conception })} onPress={() => router.push({ pathname: '/(tabs)/animais', params: { propriedade: 'todas', filtro: 'prenhes', toque: String(Date.now()) } })} />
        <Tile accent="teal" icon="calendar-outline" label={t('Partos em 30 dias')} value={String(sum(c => c.birthsSoon))}
          detail={t('Ver na agenda')} onPress={() => goAgenda('semana', 'parto')} />
      </TileGrid>

      <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: space.sm }}>{t('O que você quer fazer?')}</Text>
      <TileGrid>
        <ActionCard accent="teal" icon="checkmark-done-outline" title={t('Diagnóstico em lote')} detail={shortcut} onPress={() => router.push('/reproducao/diagnostico')} />
        <ActionCard accent="green" icon="heart-outline" title={t('Cobertura')} detail={shortcut} onPress={() => router.push({ pathname: '/reproducao/[id]', params: { id: 'nova' } })} />
        <ActionCard accent="blue" icon="medkit-outline" title={t('Vacinar')} detail={shortcut} onPress={() => router.push('/(tabs)/vacinas')} />
        <ActionCard accent="amber" icon="calendar-outline" title={t('Marcar visita')} detail={t('na agenda')} onPress={() => router.push({ pathname: '/consultoria', params: { nova: '1' } })} />
      </TileGrid>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }}>{t('Visitas de hoje')}</Text>
          <Pressable onPress={() => goAgenda('hoje')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} hitSlop={8}>
            <Text style={{ color: colors.green, fontWeight: '700' }}>{t('Agenda')} ›</Text>
          </Pressable>
        </View>
        {!visitsToday.length ? <Muted>{t('Nenhuma visita marcada para hoje.')}</Muted> : visitsToday.map((v, i) => (
          <Pressable key={v.key} onPress={() => goAgenda('hoje')} accessibilityRole="button" style={[row, i < visitsToday.length - 1 ? divider : null]}>
            <Text style={{ width: 52, fontSize: font.md, fontWeight: '800', color: colors.amber, fontVariant: ['tabular-nums'] }}>{v.time || '—'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{v.farmName ?? ''}</Text>
              {v.detail ? <Muted>{t(v.detail, v.detailVars)}</Muted> : null}
            </View>
          </Pressable>
        ))}
      </Card>

      {late.length ? (
        <Card style={{ borderColor: colors.red, borderWidth: 2 }}>
          <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.red }}>{t('Urgentes')}</Text>
          {late.slice(0, 4).map((item, i) => (
            <Pressable key={item.key} disabled={!!busy || !item.farmId} onPress={() => item.farmId && void open(item.farmId, agendaSiteHref(item.kind))} accessibilityRole="button"
              style={[row, i < Math.min(late.length, 4) - 1 ? divider : null, { opacity: busy === item.farmId ? 0.5 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{t(item.label, item.vars)}</Text>
                <Muted>{[item.farmName, t('era {date}', { date: ddmm(item.date) })].filter(Boolean).join(' · ')}</Muted>
              </View>
              <Text style={{ color: colors.muted, fontSize: font.lg }}>›</Text>
            </Pressable>
          ))}
          {late.length > 4 ? (
            <Pressable onPress={() => goAgenda('atrasadas')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.red, fontWeight: '700' }}>{t('Ver todas as atrasadas ({n})', { n: late.length })}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }}>{t('Propriedades')}</Text>
          <Pressable onPress={() => router.push('/consultoria')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} hitSlop={8}>
            <Text style={{ color: colors.green, fontWeight: '700' }}>{t('Consultoria')} ›</Text>
          </Pressable>
        </View>
        {!farms.length ? <Muted>{t('Nenhuma propriedade ainda. Envie o seu código ao produtor em Consultoria.')}</Muted> : farms.map((c, i) => {
          const n = lateByFarm(c.farmId)
          return (
            <Pressable key={c.id} disabled={!!busy} onPress={() => void openFarmAnimals(c.farmId)} accessibilityRole="button"
              style={[row, i < farms.length - 1 ? divider : null, { opacity: busy === c.farmId ? 0.5 : 1 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }} numberOfLines={2}>{c.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                  <FarmKindBadge segments={c.segments} />
                  <Muted>{t(c.animals === 1 ? '{n} animal' : '{n} animais', { n: c.animals })} · {t((c.pregnant ?? 0) === 1 ? '{n} prenhe' : '{n} prenhes', { n: c.pregnant ?? 0 })}</Muted>
                </View>
              </View>
              {n ? <Badge label={String(n)} tone="red" /> : null}
              {user?.farmId === c.farmId ? <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm }}>{t('Aberta')}</Text> : null}
            </Pressable>
          )
        })}
      </Card>
    </>
  )
}

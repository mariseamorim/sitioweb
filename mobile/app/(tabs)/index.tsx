import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { all } from '@/db'
import { addDays, brDate, brMoney, brNumber, todayISO } from '@/lib/format'
import { dueSoon, listVaccinations } from '@/repos/vaccinations'
import { listTransactions, totals } from '@/repos/transactions'
import { isLow, listSupplies } from '@/repos/supplies'
import { useSyncState } from '@/sync'
import { Button, Card, Muted, Notice, Row, Screen, Stat, Title } from '@/ui'
import { colors, space } from '@/theme'
import { useLocale, useT } from '@/lib/i18n'
import { VetToday } from '@/vet/panel'

export default function Painel() {
  const { user, canAccess } = useSession()
  const farmId = useFarmId()
  const router = useRouter()
  const sync = useSyncState()
  const t = useT()
  const locale = useLocale()
  const today = todayISO()
  const monthStart = today.slice(0, 8) + '01'

  const data = useLive(() => {
    const animals = all<{ n: number }>("SELECT count(*) AS n FROM animals WHERE farmId = ? AND status IN ('Vivo', 'Doente')", [farmId])[0]?.n ?? 0
    const milkToday = all<{ total: number | null }>('SELECT sum(quantity) AS total FROM milk WHERE farmId = ? AND substr(date, 1, 10) = ?', [farmId, today])[0]?.total ?? 0
    const milkWeek = all<{ total: number | null }>('SELECT sum(quantity) AS total FROM milk WHERE farmId = ? AND substr(date, 1, 10) >= ?', [farmId, addDays(today, -6)])[0]?.total ?? 0
    const vacc = canAccess('vacinacao') ? listVaccinations(farmId).filter(v => dueSoon(v, today)) : []
    const fin = canAccess('financeiro') ? totals(listTransactions(farmId, monthStart, today)) : null
    const low = canAccess('estoque') ? listSupplies(farmId).filter(isLow) : []
    return { animals, milkToday, milkWeek, vacc, fin, low }
  }, [farmId, today])

  return (
    <Screen>
      <Title sub={user?.farmName ?? ''}>{t('Olá, {name}', { name: user?.name?.split(' ')[0] ?? '' })}</Title>
      {!sync.online ? <Notice text={t('Sem internet. O que você anotar fica guardado no aparelho e é enviado quando a conexão voltar.')} /> : null}
      {sync.pending > 0 ? <Notice tone="blue" text={t(sync.pending === 1 ? '{n} registro para enviar ao servidor.' : '{n} registros para enviar ao servidor.', { n: sync.pending })} /> : null}
      {sync.failed > 0 ? <Notice tone="red" text={t(sync.failed === 1 ? '{n} envio foi recusado pelo servidor. Veja em Mais › Sincronização.' : '{n} envios foram recusados pelo servidor. Veja em Mais › Sincronização.', { n: sync.failed })} /> : null}
      {sync.unauthorized ? <Notice tone="red" text={t('A sessão expirou. Saia e entre de novo em Mais › Sair da conta.')} /> : null}
      {/* Veterinário: tarefas das propriedades que atende e a agenda, antes dos números da propriedade aberta */}
      {user?.vet ? <VetToday /> : null}

      <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.md }}>
        <Stat label={t('animais no rebanho')} value={String(data.animals)} />
        <Stat label={t('litros hoje')} value={brNumber(data.milkToday)} tone="green" />
      </View>
      <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.md }}>
        <Stat label={t('litros em 7 dias')} value={brNumber(data.milkWeek)} />
        <Stat label={t('vacinas para aplicar')} value={String(data.vacc.length)} tone={data.vacc.length ? 'amber' : undefined} />
      </View>

      {canAccess('leite') ? <Button label={t('Anotar o leite de hoje')} onPress={() => router.push('/leite/novo')} style={{ marginBottom: space.md }} /> : null}

      {data.vacc.length ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text, marginBottom: space.xs }}>{t('Vacinas vencidas ou para os próximos 7 dias')}</Text>
          {data.vacc.slice(0, 5).map(v => (
            <Row key={v.id} title={`${v.vaccineName} · ${v.animalName ?? t('animal')}`} detail={`${t('Agendada para')} ${brDate(v.scheduledDate)}`} onPress={() => router.push(`/vacinas/${v.id}`)} />
          ))}
          {data.vacc.length > 5 ? <Muted style={{ marginTop: space.sm }}>{t('e mais {n}', { n: data.vacc.length - 5 })}</Muted> : null}
        </Card>
      ) : null}

      {data.fin ? (
        <Card onPress={() => router.push('/financeiro')}>
          <Text style={{ fontWeight: '700', color: colors.text, marginBottom: space.xs }}>{t('Dinheiro no mês')}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Muted>{t('Entradas')} {brMoney(data.fin.income)}</Muted>
            <Muted>{t('Saídas')} {brMoney(data.fin.expense)}</Muted>
          </View>
          <Text style={{ fontWeight: '700', fontSize: 20, color: data.fin.balance >= 0 ? colors.green : colors.red, marginTop: space.xs }}>{t('Saldo')} {brMoney(data.fin.balance)}</Text>
        </Card>
      ) : null}

      {data.low.length ? (
        <Card onPress={() => router.push('/estoque')}>
          <Text style={{ fontWeight: '700', color: colors.text, marginBottom: space.xs }}>{t('Estoque abaixo do mínimo')}</Text>
          {data.low.slice(0, 5).map(s => <Row key={s.id} title={s.name} detail={`${brNumber(s.currentQuantity, 0)} ${s.unit} · ${t('mínimo')} ${brNumber(s.minimumQuantity, 0)}`} />)}
        </Card>
      ) : null}

      <Muted style={{ marginTop: space.md }}>{sync.lastSyncAt ? `${t('Última sincronização:')} ${new Date(sync.lastSyncAt).toLocaleString(locale)}` : t('Ainda não sincronizado com o servidor.')}</Muted>
    </Screen>
  )
}

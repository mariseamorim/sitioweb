import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { all } from '@/db'
import { brDate, brMoney, brNumber, todayISO } from '@/lib/format'
import { groupByDay, listMilk } from '@/repos/milk'
import { dueSoon, listVaccinations } from '@/repos/vaccinations'
import { listTransactions, totals } from '@/repos/transactions'
import { isLow, listSupplies } from '@/repos/supplies'
import { useSyncState } from '@/sync'
import { ActionCard, Card, Muted, Notice, Row, Screen, Tile, TileGrid, Title } from '@/ui'
import { colors, font, space } from '@/theme'
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
    // Rebanho por espécie (Vaca, Bezerra, Touro...), as maiores primeiro
    const herd = all<{ species: string; n: number }>("SELECT species, count(*) AS n FROM animals WHERE farmId = ? AND status IN ('Vivo', 'Doente') GROUP BY species ORDER BY n DESC", [farmId])
    const animals = herd.reduce((sum, h) => sum + h.n, 0)
    const milkDays = canAccess('leite') ? groupByDay(listMilk(farmId, monthStart, today)) : []
    const milk = { total: milkDays.reduce((s, d) => s + d.total, 0), value: milkDays.reduce((s, d) => s + d.value, 0) }
    const vacc = canAccess('vacinacao') ? listVaccinations(farmId).filter(v => dueSoon(v, today)) : []
    const fin = canAccess('financeiro') ? totals(listTransactions(farmId, monthStart, today)) : null
    const low = canAccess('estoque') ? listSupplies(farmId).filter(isLow) : []
    return { herd, animals, milk, vacc, fin, low }
  }, [farmId, today])
  const month = new Date(`${today}T12:00:00`).toLocaleDateString(locale, { month: 'long' })
  const monthName = month.charAt(0).toUpperCase() + month.slice(1)

  return (
    <Screen>
      <Title sub={user?.farmName ?? ''}>{t('Olá, {name}', { name: user?.name?.split(' ')[0] ?? '' })}</Title>
      {!sync.online ? <Notice text={t('Sem internet. O que você anotar fica guardado no aparelho e é enviado quando a conexão voltar.')} /> : null}
      {sync.pending > 0 ? <Notice tone="blue" text={t(sync.pending === 1 ? '{n} registro para enviar ao servidor.' : '{n} registros para enviar ao servidor.', { n: sync.pending })} /> : null}
      {sync.failed > 0 ? <Notice tone="red" text={t(sync.failed === 1 ? '{n} envio foi recusado pelo servidor. Veja em Mais › Sincronização.' : '{n} envios foram recusados pelo servidor. Veja em Mais › Sincronização.', { n: sync.failed })} /> : null}
      {sync.unauthorized ? <Notice tone="red" text={t('A sessão expirou. Saia e entre de novo em Mais › Sair da conta.')} /> : null}
      {/* Veterinário: tarefas das propriedades que atende e a agenda, antes dos números da propriedade aberta */}
      {user?.vet ? <VetToday /> : null}

      <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: space.sm }}>{t('O que você quer fazer?')}</Text>
      <TileGrid>
        {canAccess('leite') ? <ActionCard accent="blue" icon="water-outline" title={t('Anotar leite')} detail={t('Total ou por vaca')} onPress={() => router.push('/leite/novo')} /> : null}
        {canAccess('animais') ? <ActionCard accent="green" icon="paw-outline" title={t('Cuidar do rebanho')} detail={t('Consultar e cadastrar')} onPress={() => router.push('/(tabs)/animais')} /> : null}
        {canAccess('financeiro') ? <ActionCard accent="amber" icon="cash-outline" title={t('Anotar dinheiro')} detail={t('Entradas e saídas')} onPress={() => router.push('/financeiro/novo')} /> : null}
        {canAccess('estoque') ? <ActionCard accent="teal" icon="cube-outline" title={t('Conferir estoque')} detail={t('Ração e insumos')} onPress={() => router.push('/estoque')} /> : null}
      </TileGrid>

      {data.milk.total > 0 || data.fin ? <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: space.sm }}>{t('Resumo do mês')}</Text> : null}
      <TileGrid>
        {canAccess('leite') ? <Tile accent="plain" color={colors.blue} label={t('Leite produzido')} value={`${brNumber(data.milk.total)} L`} detail={data.milk.value ? `≈ ${brMoney(data.milk.value)}` : monthName} /> : null}
        {data.fin ? <Tile accent="plain" color={data.fin.balance >= 0 ? colors.green : colors.red} label={t('Saldo do mês')} value={brMoney(data.fin.balance)} detail={monthName} /> : null}
        {data.fin ? <Tile accent="plain" color={colors.green} label={t('Receitas')} value={brMoney(data.fin.income)} detail={t('Entradas')} /> : null}
        {data.fin ? <Tile accent="plain" color={colors.red} label={t('Despesas')} value={brMoney(data.fin.expense)} detail={t('Saídas')} /> : null}
      </TileGrid>

      {canAccess('animais') ? (
        <Card onPress={() => router.push('/(tabs)/animais')} style={{ borderColor: colors.green, borderWidth: 2 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.greenDark }}>{t(data.animals === 1 ? '{n} animal' : '{n} animais', { n: data.animals })}</Text>
          {data.herd.length ? <Muted>{data.herd.slice(0, 4).map(h => `${h.n} ${t(h.species)}`).join(' · ')}</Muted> : null}
          {data.vacc.length ? <Text style={{ color: colors.amber, fontWeight: '600', marginTop: space.xs }}>{t(data.vacc.length === 1 ? '{n} vacina para aplicar' : '{n} vacinas para aplicar', { n: data.vacc.length })}</Text> : null}
        </Card>
      ) : null}

      {data.vacc.length ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text, marginBottom: space.xs }}>{t('Vacinas vencidas ou para os próximos 7 dias')}</Text>
          {data.vacc.slice(0, 5).map(v => (
            <Row key={v.id} title={`${v.vaccineName} · ${v.animalName ?? t('animal')}`} detail={`${t('Agendada para')} ${brDate(v.scheduledDate)}`} onPress={() => router.push(`/vacinas/${v.id}`)} />
          ))}
          {data.vacc.length > 5 ? <Muted style={{ marginTop: space.sm }}>{t('e mais {n}', { n: data.vacc.length - 5 })}</Muted> : null}
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

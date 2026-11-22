import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { parseNumber, todayISO } from '@/lib/format'
import { useLive } from '@/db/events'
import { animalOptions } from '@/repos/animals'
import { listLots } from '@/repos/lots'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, saveTransaction } from '@/repos/transactions'
import { listSupplies } from '@/repos/supplies'
import { Button, Card, Chips, DateField, Field, Notice, Screen, SelectField } from '@/ui'
import { colors, space } from '@/theme'
import { useT } from '@/lib/i18n'

export default function FinanceiroNovo() {
  const farmId = useFarmId()
  const t = useT()
  const { canEdit } = useSession()
  const router = useRouter()
  const [type, setType] = useState<'Receita' | 'Despesa'>('Despesa')
  const [category, setCategory] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [animalId, setAnimalId] = useState<string | null>(null)
  const [paid, setPaid] = useState<'sim' | 'nao'>('nao')
  const [lotId, setLotId] = useState<string | null>(null)
  // Despesa de ração, remédio ou vacina: pode dar entrada no estoque junto
  const { canAccess } = useSession()
  const canStock = canAccess('estoque')
  const [toStock, setToStock] = useState<'sim' | 'nao'>('nao')
  const [supplyId, setSupplyId] = useState<string | null>(null)
  const [stockQty, setStockQty] = useState('')
  const stockItems = useLive(() => (canStock ? listSupplies(farmId) : []), [farmId, canStock])
  const [error, setError] = useState('')
  const categories = type === 'Receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  // Lotes abertos de recria/engorda: a despesa ligada ao lote entra no desempenho dele
  const lotOptions = useLive(() => listLots(farmId).filter(l => !l.endDate).map(l => ({ value: l.id, label: l.name })), [farmId])

  function save() {
    const a = parseNumber(amount)
    if (!category) { setError('Escolha a categoria'); return }
    if (a === null || !Number.isFinite(a) || a <= 0) { setError('Informe o valor'); return }
    const qty = parseNumber(stockQty)
    const wantsStock = type === 'Despesa' && canStock && toStock === 'sim'
    if (wantsStock && (!supplyId || !qty || qty <= 0)) { setError('Escolha o item do estoque e a quantidade'); return }
    saveTransaction(farmId, { type, category, date, amount: a, description, animalId, paid: paid === 'sim', lotId: type === 'Despesa' ? lotId : null, stock: wantsStock && supplyId && qty ? { supplyId, quantity: qty } : null })
    router.back()
  }

  return (
    <Screen>
      <Chips options={[{ value: 'Despesa', label: 'Saída (gasto)' }, { value: 'Receita', label: 'Entrada (recebido)' }]} value={type} onChange={(t) => { setType(t); setCategory(null) }} />
      <View style={{ height: space.sm }} />
      <SelectField label="Categoria" value={category} options={categories.map(c => ({ value: c, label: c }))} onChange={setCategory} />
      <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex.: 1250,00" autoFocus />
      <DateField label="Data" value={date} onChange={setDate} />
      <Chips options={[{ value: 'sim', label: type === 'Receita' ? 'Já recebido' : 'Já pago' }, { value: 'nao', label: type === 'Receita' ? 'A receber' : 'A pagar' }]} value={paid} onChange={setPaid} />
      <View style={{ height: space.sm }} />
      {type === 'Receita' ? <SelectField label="Animal vendido (opcional)" value={animalId} options={animalOptions(farmId)} onChange={setAnimalId} searchable allowEmpty /> : null}
      {type === 'Despesa' && lotOptions.length > 0 ? <SelectField label="Lote (opcional)" value={lotId} options={lotOptions} onChange={setLotId} allowEmpty /> : null}
      <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} multiline />
      {type === 'Despesa' && canStock && stockItems.length ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text, marginBottom: space.xs }}>{t('Dar entrada no estoque?')}</Text>
          <Chips options={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim, somar ao estoque' }]} value={toStock} onChange={setToStock} />
          {toStock === 'sim' ? (
            <>
              <SelectField label="Item do estoque" value={supplyId} options={stockItems.map(s => ({ value: s.id, label: s.name }))} onChange={setSupplyId} searchable placeholder="Escolher o item" />
              <Field label={`${t('Quantidade')}${supplyId ? ` (${t(stockItems.find(s => s.id === supplyId)?.unit ?? '')})` : ''}`} value={stockQty} onChangeText={setStockQty} keyboardType="decimal-pad" />
            </>
          ) : null}
        </Card>
      ) : null}
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
    </Screen>
  )
}

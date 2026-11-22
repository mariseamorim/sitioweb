import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { parseNumber, todayISO } from '@/lib/format'
import { useLive } from '@/db/events'
import { animalOptions } from '@/repos/animals'
import { listLots } from '@/repos/lots'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, saveTransaction } from '@/repos/transactions'
import { Button, Chips, DateField, Field, Notice, Screen, SelectField } from '@/ui'
import { space } from '@/theme'

export default function FinanceiroNovo() {
  const farmId = useFarmId()
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
  const [error, setError] = useState('')
  const categories = type === 'Receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  // Lotes abertos de recria/engorda: a despesa ligada ao lote entra no desempenho dele
  const lotOptions = useLive(() => listLots(farmId).filter(l => !l.endDate).map(l => ({ value: l.id, label: l.name })), [farmId])

  function save() {
    const a = parseNumber(amount)
    if (!category) { setError('Escolha a categoria'); return }
    if (a === null || !Number.isFinite(a) || a <= 0) { setError('Informe o valor'); return }
    saveTransaction(farmId, { type, category, date, amount: a, description, animalId, paid: paid === 'sim', lotId: type === 'Despesa' ? lotId : null })
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
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
    </Screen>
  )
}

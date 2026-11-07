import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { parseNumber, todayISO } from '@/lib/format'
import { animalOptions } from '@/repos/animals'
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
  const [error, setError] = useState('')
  const categories = type === 'Receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function save() {
    const a = parseNumber(amount)
    if (!category) { setError('Escolha a categoria'); return }
    if (a === null || !Number.isFinite(a) || a <= 0) { setError('Informe o valor'); return }
    saveTransaction(farmId, { type, category, date, amount: a, description, animalId })
    router.back()
  }

  return (
    <Screen>
      <Chips options={[{ value: 'Despesa', label: 'Saída (gasto)' }, { value: 'Receita', label: 'Entrada (recebido)' }]} value={type} onChange={(t) => { setType(t); setCategory(null) }} />
      <View style={{ height: space.sm }} />
      <SelectField label="Categoria" value={category} options={categories.map(c => ({ value: c, label: c }))} onChange={setCategory} />
      <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex.: 1250,00" autoFocus />
      <DateField label="Data" value={date} onChange={setDate} />
      {type === 'Receita' ? <SelectField label="Animal vendido (opcional)" value={animalId} options={animalOptions(farmId)} onChange={setAnimalId} searchable allowEmpty /> : null}
      <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
    </Screen>
  )
}

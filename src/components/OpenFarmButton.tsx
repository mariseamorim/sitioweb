'use client'

import { useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { switchFarm } from '@/lib/farmSwitch'
import { useT } from '@/lib/i18n'

/** Abre outra propriedade do produtor (com a mesma proteção do seletor do topo) */
export function OpenFarmButton({ farmId, className = '' }: { farmId: string; className?: string }) {
  const { notify } = useDialog()
  const t = useT()
  const [busy, setBusy] = useState(false)

  async function open() {
    setBusy(true)
    const error = await switchFarm(farmId)
    setBusy(false)
    if (error) await notify('Não foi possível abrir', error)
  }

  return (
    <button type="button" onClick={() => void open()} disabled={busy} className={className}>
      {t(busy ? 'Abrindo...' : 'Abrir')}
    </button>
  )
}

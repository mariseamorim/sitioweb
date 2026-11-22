'use client'

// Agenda da propriedade: o que fazer em cada dia (vacinas, partos, secagem, pré-parto, diagnóstico, retorno ao cio,
// fim da carência) e as visitas do veterinário. A regra está em src/lib/agenda.ts.
import { useRouter } from 'next/navigation'
import { AgendaView } from '@/components/AgendaView'
import { useUser } from '@/contexts/UserContext'
import { useT } from '@/lib/i18n'

export default function AgendaPage() {
  const router = useRouter()
  const { user, canAccess } = useUser()
  const t = useT()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">{t('Agenda')}</h1>
        <p className="text-gray-500">{t('O que fazer em cada dia na propriedade. Toque num dia para ver só ele.')}</p>
      </div>
      <AgendaView endpoint="/api/agenda" title={<span />} onOpen={(_, href) => router.push(href)} canApplyVaccine={canEdit && canAccess('vacinacao')} />
    </div>
  )
}

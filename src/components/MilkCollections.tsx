'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { fmtNumber } from '@/lib/reports'
import { useLocale, useT } from '@/lib/i18n'

interface Collection { date: string; liters: number; pointId: string; pointName: string; driverName: string }
interface Link { pointId: string; pointName: string; driverName: string }


// Coletas que os motoristas anotaram nos sítios ligados a esta propriedade (versão completa)
export function MilkCollections({ from, to, canEdit }: { from: string; to: string; canEdit: boolean }) {
  const { confirm } = useDialog()
  const t = useT()
  const locale = useLocale()
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' })
  const [collections, setCollections] = useState<Collection[]>([])
  const [links, setLinks] = useState<Link[]>([])

  const load = useCallback(() => {
    fetch(`/api/coletas?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { collections: [], links: [] }))
      .then((d) => { setCollections(d.collections ?? []); setLinks(d.links ?? []) })
      .catch(() => {})
  }, [from, to])

  useEffect(load, [load])

  async function unlink(link: Link) {
    const ok = await confirm({
      title: t('Desligar {name}?', { name: link.pointName }),
      message: t('As coletas de {driver} nesse local deixam de aparecer aqui. Use se não for o seu sítio.', { driver: link.driverName }),
      confirmLabel: t('Desligar'),
      danger: true,
    })
    if (!ok) return
    await fetch(`/api/coletas?pointId=${encodeURIComponent(link.pointId)}`, { method: 'DELETE' })
    load()
  }

  if (links.length === 0) return null
  const total = collections.reduce((s, c) => s + c.liters, 0)

  return (
    <section className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{t('Coletado pelo motorista')}</h2>
        <span className="text-lg font-bold text-blue-700">{fmtNumber(total)} L</span>
      </div>
      <p className="text-sm text-gray-500">{t('No período escolhido, anotado pelo motorista do leite.')}</p>

      {collections.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{t('Nenhuma coleta no período.')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {collections.map((c) => (
            <li key={`${c.pointId}|${c.date}`} className="flex justify-between py-2 text-sm">
              <span className="text-gray-700">{fmtDay(c.date)} · {c.driverName}</span>
              <span className="font-semibold text-gray-900">{fmtNumber(c.liters)} L</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-500">
        {links.map((l) => (
          <p key={l.pointId} className="flex flex-wrap items-center gap-2">
            {t('Ligado a {driver} ({point})', { driver: l.driverName, point: l.pointName })}
            {canEdit && <button type="button" onClick={() => unlink(l)} className="font-semibold text-red-600 underline">{t('Não é meu sítio')}</button>}
          </p>
        ))}
      </div>
    </section>
  )
}

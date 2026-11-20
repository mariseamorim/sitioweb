'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useT } from '@/lib/i18n'

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function MilkDemo() {
  const t = useT()
  const locale = useLocale()
  const [liters, setLiters] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const [error, setError] = useState('')
  const total = 245 + (saved ?? 0)

  return <section id="experimentar" className="landing-section landing-container demo-grid" aria-labelledby="demo-title">
    <div>
      <p className="landing-eyebrow">{t('Experimente sem cadastro')}</p>
      <h2 id="demo-title">{t('Sua primeira anotação.')}<br /><em>{t('Em poucos toques.')}</em></h2>
      <p className="section-description mt-6">{t('Digite uma quantidade de leite, salve e veja o total e o valor estimado. No seu dia a dia, você também pode consultar o histórico e conferir a folha do motorista.')}</p>
      <p className="mt-4 text-sm text-green-900">{t('Esta é uma demonstração com dados fictícios. Nada é enviado ou guardado ao sair da página.')}</p>
    </div>
    <div className="contact-card">
      <p className="landing-eyebrow">{t('Sítio de exemplo')}</p>
      <h3>{t('Anotar o leite de hoje')}</h3>
      <form onSubmit={event => {
        event.preventDefault()
        const amount = Number(liters.trim().replace(',', '.'))
        if (!liters.trim() || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
          setError(t('Informe uma quantidade maior que zero e até 100.000 litros.'))
          return
        }
        setSaved(amount)
        setError('')
      }} className="contact-form">
        <label htmlFor="demo-liters">{t('Quantos litros você tirou hoje?')}</label>
        <input id="demo-liters" inputMode="decimal" placeholder={t('Ex.: 85,5')} value={liters} onChange={event => setLiters(event.target.value)} aria-describedby={error ? 'demo-error' : undefined} aria-invalid={!!error} required />
        {error && <p id="demo-error" role="alert" className="contact-error">{error}</p>}
        <button type="submit" className="landing-button button-dark">{t(saved === null ? 'Salvar anotação de exemplo' : 'Atualizar anotação de exemplo')}</button>
      </form>
      <div role="status" aria-live="polite" className="demo-summary">
        {saved !== null && <p className="font-semibold text-green-800">{t('Anotação salva nesta demonstração: {n} litros.', { n: saved.toLocaleString(locale) })}</p>}
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between gap-4"><dt>{t('Ontem (exemplo)')}</dt><dd>125 L</dd></div>
          <div className="flex justify-between gap-4"><dt>{t('Anteontem (exemplo)')}</dt><dd>120 L</dd></div>
          <div className="flex justify-between gap-4 font-bold"><dt>{t('Total dos dias')}</dt><dd>{total.toLocaleString(locale)} L</dd></div>
          <div className="flex justify-between gap-4 font-bold"><dt>{t('Valor estimado')}</dt><dd>{money(total * 2.5)}</dd></div>
        </dl>
        <p className="mt-3 text-sm">{t('Preço fictício: R$ 2,50 por litro. Na sua conta, você informa o seu preço.')}</p>
      </div>
      {saved !== null && <div className="mt-5"><p>{t('Quer começar com os dados do seu sítio?')}</p><Link href="/lite/cadastro" className="landing-button button-dark">{t('Criar minha conta grátis')}</Link><button type="button" className="contact-secondary block" onClick={() => { setLiters(''); setSaved(null); setError('') }}>{t('Recomeçar demonstração')}</button></div>}
    </div>
  </section>
}

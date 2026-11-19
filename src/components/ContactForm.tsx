'use client'

import { useRef, useState, type FormEvent } from 'react'
import { maskPhone } from '@/lib/masks'
import { useT } from '@/lib/i18n'

export function ContactForm() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const form = event.currentTarget
    pending.current = true
    setSending(true)
    setError('')
    try {
      const fields = Object.fromEntries(new FormData(form))
      const response = await fetch('/api/contato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields), signal: AbortSignal.timeout(30000),
      })
      const result = await response.json()
      if (!response.ok) { setError(t(result.error || 'Não foi possível enviar. Tente novamente em alguns minutos.')); return }
      setSent(true)
      form.reset()
    } catch {
      setError(t('Não foi possível confirmar o envio. Confira sua conexão e tente novamente em alguns minutos.'))
    } finally {
      pending.current = false
      setSending(false)
    }
  }

  return <div className="contact-card">
    <h3>{t('Vamos conversar?')}</h3>
    <p>{t('Peça uma demonstração ou envie sua dúvida. Preencha o formulário e responderemos pelo contato informado.')}</p>
    {!open && <button type="button" className="landing-button button-dark" aria-expanded={false} aria-controls="contact-form" onClick={() => setOpen(true)}>{t('Fale conosco ou agende uma demonstração')}</button>}
    {open && (sent ? <div className="contact-success" role="status"><h4>{t('Mensagem enviada!')}</h4><p>{t('Obrigado pelo contato. Vamos responder por e-mail para conversar e combinar sua demonstração.')}</p><button type="button" className="contact-secondary" onClick={() => setSent(false)}>{t('Enviar outra mensagem')}</button></div> : <form id="contact-form" className="contact-form" onSubmit={submit}>
      <p className="contact-hint">{t('Os campos com * são obrigatórios.')}</p>
      <fieldset disabled={sending}>
        <label htmlFor="contact-name">{t('Seu nome')} *</label><input id="contact-name" name="name" autoComplete="name" required maxLength={100} />
        <label htmlFor="contact-email">{t('Seu e-mail')} *</label><input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <label htmlFor="contact-phone">{t('Telefone / WhatsApp (opcional)')}</label><input id="contact-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="(35) 99999-0000" onInput={(e) => { e.currentTarget.value = maskPhone(e.currentTarget.value) }} />
        <label htmlFor="contact-farm">{t('Nome da propriedade (opcional)')}</label><input id="contact-farm" name="farm" maxLength={150} />
        <label htmlFor="contact-purpose">{t('Como podemos ajudar?')} *</label><select id="contact-purpose" name="purpose" defaultValue="demo" required><option value="demo">{t('Quero agendar uma demonstração')}</option><option value="question">{t('Quero tirar uma dúvida')}</option></select>
        <label htmlFor="contact-message">{t('Sua mensagem')} *</label><textarea id="contact-message" name="message" required minLength={10} maxLength={3000} rows={4} placeholder={t('Conte o que precisa. Para uma demonstração, informe os melhores dias e horários.')} />
        <div className="contact-trap" aria-hidden="true"><label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></div>
        <p className="contact-hint">{t('Usaremos seus dados para responder a esta solicitação.')}</p>
        <button type="submit" className="landing-button button-dark">{t(sending ? 'Enviando…' : 'Enviar mensagem')}</button>
      </fieldset>
      {error && <p className="contact-error" role="alert">{error}</p>}
    </form>)}
  </div>
}

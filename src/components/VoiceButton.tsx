'use client'

import { useEffect, useRef, useState } from 'react'
import { downloadOfflineVoice, listenForNumber, offlineVoiceReady, VoiceError, VOICE_MODEL_SIZE_MB, type VoiceErrorKind } from '@/lib/voice'
import { parseSpokenLiters } from '@/lib/voiceNumber'

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

const ERRORS: Record<VoiceErrorKind, string> = {
  'sem-sinal': 'Sem internet para a voz. Baixe a voz no celular (logo abaixo) ou digite o número.',
  'sem-permissao': 'Permita o uso do microfone para falar o número.',
  'nao-ouvi': 'Não ouvi nada. Toque no microfone e fale o número.',
  'sem-suporte': 'Este navegador não reconhece voz. Digite o número.',
  falhou: 'A voz não funcionou agora. Digite o número.',
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21m-3 0h6" />
    </svg>
  )
}

// Botão de microfone: a pessoa fala o número e ele vai para o campo (o salvar sozinho grava)
export function VoiceButton({ onNumber, label, size = 'lg' }: {
  onNumber: (value: number) => void
  label: string
  size?: 'lg' | 'sm'
}) {
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  async function handleClick() {
    if (listening) { abortRef.current?.abort(); return }
    const controller = new AbortController()
    abortRef.current = controller
    setListening(true)
    setMessage({ text: offlineVoiceReady() && !navigator.onLine ? 'Preparando a voz... fale o número.' : 'Pode falar o número.', ok: true })
    try {
      const { texts } = await listenForNumber(controller.signal)
      const value = texts.map(parseSpokenLiters).find((v) => v !== null && v >= 0)
      if (value === undefined || value === null) {
        setMessage({ text: `Não entendi "${texts[0] ?? ''}". Fale só o número, por exemplo "quarenta e sete".`, ok: false })
      } else {
        onNumber(value)
        setMessage({ text: `Ouvi: ${fmt(value)} litros. Confira o número.`, ok: true })
      }
    } catch (e) {
      setMessage({ text: ERRORS[e instanceof VoiceError ? e.kind : 'falhou'], ok: false })
    } finally {
      setListening(false)
      abortRef.current = null
    }
  }

  const big = size === 'lg'
  return (
    <div className={big ? 'mt-3 flex flex-col items-center' : 'flex flex-col items-end'}>
      <button type="button" onClick={handleClick} aria-label={listening ? 'Parar de ouvir' : `Falar ${label}`} aria-pressed={listening}
        className={`flex items-center justify-center gap-2 rounded-full font-semibold focus-visible:outline-2 focus-visible:outline-green-700 ${
          listening ? 'bg-red-600 text-white animate-pulse' : 'border-2 border-green-700 text-green-800 hover:bg-green-50'
        } ${big ? 'h-12 px-5 text-base' : 'h-11 w-11'}`}>
        <MicIcon className={big ? 'h-6 w-6' : 'h-5 w-5'} />
        {big && (listening ? 'Ouvindo... toque para parar' : 'Falar o número')}
      </button>
      {message && (
        <p role="status" className={`mt-2 text-sm ${big ? 'text-center' : 'max-w-56 text-right'} ${message.ok ? 'text-green-800' : 'text-amber-800'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}

// Baixar a voz para funcionar sem internet (uma vez só; fica no celular)
export function OfflineVoiceSetup({ online }: { online: boolean }) {
  const [ready, setReady] = useState<boolean | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // Lido depois de montar: o HTML do servidor não conhece o celular
    void Promise.resolve().then(() => setReady(offlineVoiceReady()))
  }, [])

  async function download() {
    setError('')
    setProgress(0)
    try {
      await downloadOfflineVoice(setProgress)
      setReady(true)
    } catch {
      setError('Não foi possível baixar a voz. Tente de novo com uma internet melhor.')
    } finally {
      setProgress(null)
    }
  }

  if (ready === null) return null
  if (ready) return <p className="mt-3 text-center text-xs text-gray-500">Voz sem internet: pronta neste celular.</p>
  if (progress !== null) {
    return (
      <div className="mt-3" role="status">
        <p className="text-center text-sm text-gray-700">Baixando a voz... {Math.round(progress * 100)}%</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full bg-green-600 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="mt-1 text-center text-xs text-gray-500">Não feche o app até terminar.</p>
      </div>
    )
  }
  if (!online) return null
  return (
    <div className="mt-3 text-center">
      <button type="button" onClick={download} className="text-sm font-semibold text-green-700 underline">
        Usar a voz sem internet: baixar ({VOICE_MODEL_SIZE_MB} MB)
      </button>
      <p className="text-xs text-gray-500">Baixa uma vez só. Melhor no Wi-Fi.</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

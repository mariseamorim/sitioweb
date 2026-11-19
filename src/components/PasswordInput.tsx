'use client'
import { useState, type InputHTMLAttributes } from 'react'
import { useT } from '@/lib/i18n'

/** Campo de senha com o olho para mostrar ou esconder o que foi digitado. Aceita as mesmas props de um <input>. */
export function PasswordInput({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const t = useT()
  const [show, setShow] = useState(false)
  return (
    <span className="relative block">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={t(show ? 'Esconder senha' : 'Mostrar senha')}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-green-700"
      >
        {show ? (
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 8.5 4.5 9.5 7a13 13 0 01-3.2 4.3M6.2 6.2C4.3 7.5 3 9.6 2.5 12c1 2.5 4.5 7 9.5 7 1.6 0 3-.4 4.3-1.1" /></svg>
        ) : (
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </span>
  )
}

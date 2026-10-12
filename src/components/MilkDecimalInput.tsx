'use client'

import { type InputHTMLAttributes } from 'react'

export function maskMilkDecimal(value: string, decimals: number) {
  const clean = value.replace(/[^\d.,]/g, '').replace(/\./g, ',')
  const [integer, ...fraction] = clean.split(',')
  return (integer.replace(/^0+(?=\d)/, '') || (fraction.length ? '0' : '')) +
    (fraction.length ? `,${fraction.join('').slice(0, decimals)}` : '')
}

/** Preço com duas casas; litros com uma casa decimal, como no Anota Aí Leite. */
export function MilkDecimalInput({ decimals = 1, onChange, onBlur, ...props }: InputHTMLAttributes<HTMLInputElement> & { decimals?: number }) {
  return <input {...props} type="text" inputMode="decimal" onChange={e => {
    e.target.value = maskMilkDecimal(e.target.value, decimals)
    onChange?.(e)
  }} onBlur={e => {
    const masked = maskMilkDecimal(e.target.value, decimals)
    if (masked) {
      const [integer, fraction = ''] = masked.split(',')
      e.target.value = `${integer},${fraction.padEnd(decimals === 2 ? 2 : 1, '0')}`
      onChange?.(e)
    }
    onBlur?.(e)
  }} />
}

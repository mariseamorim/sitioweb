'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { SetaDireitaIcon, FecharIcon, MenuIcon } from '@/components/ModuleIcons'
const links = [['#recursos', 'O que oferece'], ['#ofertas', 'Fornecedores'], ['#como-funciona', 'Como funciona'], ['#contato', 'Fale conosco']] as const
export function LandingHeader() {
  const [open, setOpen] = useState(false)
  const header = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const onClick = (event: MouseEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false) }
    const media = window.matchMedia('(min-width: 1024px)')
    const onResize = () => { if (media.matches) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    media.addEventListener('change', onResize)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); media.removeEventListener('change', onResize) }
  }, [open])
  return <header ref={header} className="landing-header-band"><div className="landing-header landing-container">
    <Link href="/inicio" className="landing-brand" aria-label="Anota Aí Agro início"><Image src="/anota-ai-agro-logo-light.png" width={136} height={39} sizes="(max-width: 767px) 116px, 136px" priority alt="Anota Aí Agro" className="landing-brand-logo" /></Link>
    <nav className="desktop-navigation" aria-label="Navegação principal">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
    <Link className="header-login" href="/login">Entrar<span className="login-desktop-label"> no sistema</span><SetaDireitaIcon className="h-4 w-4" /></Link>
    <button ref={trigger} className="mobile-menu-button" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={open ? 'landing-mobile-menu' : undefined} aria-label={open ? 'Fechar menu' : 'Abrir menu'}>{open ? <FecharIcon /> : <MenuIcon />}</button>
    {open && <nav id="landing-mobile-menu" className="mobile-navigation" aria-label="Navegação no celular">{links.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}<Link href="/cadastro" onClick={() => setOpen(false)}>Criar minha conta</Link></nav>}
  </div></header>
}

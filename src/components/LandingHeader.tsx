'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { SetaDireitaIcon, FecharIcon, MenuIcon } from '@/components/ModuleIcons'
const links = [['#recursos', 'Recursos'], ['#ofertas', 'Fornecedores'], ['#como-funciona', 'Como funciona']] as const
export function LandingHeader() {
  const [open, setOpen] = useState(false)
  return <header className="landing-header landing-container">
    <Link href="/inicio" className="landing-brand" aria-label="Anota Aí Agro início"><Image src="/anota-ai-agro-logo.png" width={1632} height={473} alt="Anota Aí Agro" className="landing-brand-logo" /></Link>
    <nav className="desktop-navigation" aria-label="Navegação principal">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
    <Link className="header-login" href="/login">Entrar <SetaDireitaIcon /></Link>
    <button className="mobile-menu-button" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="landing-mobile-menu" aria-label={open ? 'Fechar menu' : 'Abrir menu'}>{open ? <FecharIcon /> : <MenuIcon />}</button>
    {open && <nav id="landing-mobile-menu" className="mobile-navigation" aria-label="Navegação no celular">{links.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}<Link href="/cadastro" onClick={() => setOpen(false)}>Criar conta</Link></nav>}
  </header>
}

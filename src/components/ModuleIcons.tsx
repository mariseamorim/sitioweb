// Ícones de traço dos módulos, usados na Navbar e na landing page
type IconProps = { className?: string }

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, viewBox: '0 0 24 24' }

export function PainelIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function PropriedadeIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
    </svg>
  )
}

export function AnimalIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="14" width="14" height="7" rx="3" />
      <circle cx="9" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
      <path d="M7 14V9.5C7 6.5 9 5 12 5c3 0 5 1.5 5 4.5V14" />
      <path d="M8 6.5C6.5 4 5 3 3.5 3c-1.5 0-1 2 0 3" />
      <path d="M16 6.5c1.5-2.5 3-3.5 4.5-3.5 1.5 0 1 2 0 3" />
      <path d="M7 10C4 9 2 10.5 2 11c0 .5 2 1 5-1" />
      <path d="M17 10c3-1 5 .5 5 1 0 .5-2 1-5-1" />
      <circle cx="9.5" cy="10" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LeiteIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8l1 5H7L8 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8l-2 12h14L17 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 13c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" />
    </svg>
  )
}

export function TratamentoIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
    </svg>
  )
}

export function VacinaIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 3.5l5 5m-2-2l-9.5 9.5-4-4 9.5-9.5zM4.5 17l-1.5 3.5 3.5-1.5M10 8l1.5 1.5M8 10l1.5 1.5" />
    </svg>
  )
}

export function ReproducaoIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}

export function FinanceiroIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export function EstoqueIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

export function UsuariosIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 8v6M16 11h6" />
    </svg>
  )
}

export function RelatorioIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-2" />
    </svg>
  )
}

// ── Ícones de interface (mesmo traço dos módulos) ──────────────────────

export function SemSinalIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 017 0M5 13a10 10 0 015.2-2.8M19 13a10 10 0 00-3.3-2.2M2 9.5a15 15 0 014.7-3M22 9.5A15 15 0 0011 5.1" />
      <circle cx="12" cy="20" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SincronizarIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11a8 8 0 00-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0014.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
    </svg>
  )
}

export function AlertaIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Balança: pesagens de recria e engorda */
export function BalancaIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M8 10a4 4 0 018 0" />
      <path d="M12 10l1.5-2" />
    </svg>
  )
}

export function CheckIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function FecharIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function MenuIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CadeadoIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

/** Espiga, usada para ração e grãos */
export function GraoIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V9" />
      <path d="M12 9c0-2.5 1.5-4.5 3.5-5.5.3 2.5-.9 4.7-3.5 5.5zM12 9c0-2.5-1.5-4.5-3.5-5.5-.3 2.5.9 4.7 3.5 5.5z" />
      <path d="M12 14c.5-2.2 2.3-3.8 4.6-4-.2 2.3-2 4-4.6 4zM12 14c-.5-2.2-2.3-3.8-4.6-4 .2 2.3 2 4 4.6 4z" />
      <path d="M12 19c.5-2.2 2.3-3.8 4.6-4-.2 2.3-2 4-4.6 4zM12 19c-.5-2.2-2.3-3.8-4.6-4 .2 2.3 2 4 4.6 4z" />
    </svg>
  )
}

export function FolhaIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19c0-8 5-14 15-15-.5 10-6.5 15-14 15z" />
      <path d="M5 19c3-4 6-7 10-9.5" />
    </svg>
  )
}

export function SetaDireitaIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function SetaBaixoIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  )
}

export function SinoIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1112 0c0 7 3 8.5 3 8.5H3S6 15 6 8z" />
      <path d="M10 20a2 2 0 004 0" />
    </svg>
  )
}

export function EtiquetaIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z" />
      <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LojaIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10v10h16V10" />
      <path d="M3 4h18l-1.5 6H4.5L3 4z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

export function AjudaIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg className={className} {...base} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" />
      <path d="M12 17h.01" />
    </svg>
  )
}

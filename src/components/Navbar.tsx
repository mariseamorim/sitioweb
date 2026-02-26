'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const allLinks = [
  {
    href: '/',
    label: 'Painel',
    shortLabel: 'Painel',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/fazendas',
    label: 'Propriedades',
    shortLabel: 'Props.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
      </svg>
    ),
  },
  {
    href: '/animais',
    label: 'Animais',
    shortLabel: 'Animais',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 2 5 5 5 8c0 2 1 3.5 2.5 4.5L6 21h12l-1.5-8.5C18 11.5 19 10 19 8c0-3-3-6-7-6z" />
        <circle cx="9" cy="8" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="15" cy="8" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/milk-production',
    label: 'Produção de Leite',
    shortLabel: 'Leite',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8l1 5H7L8 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8l-2 12h14L17 8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 13c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" />
      </svg>
    ),
  },
  {
    href: '/veterinary-treatment',
    label: 'Tratamentos Vet.',
    shortLabel: 'Vet.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    href: '/vacinacao',
    label: 'Vacinação',
    shortLabel: 'Vacinas',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 3.5l5 5m-2-2l-9.5 9.5-4-4 9.5-9.5zM4.5 17l-1.5 3.5 3.5-1.5M10 8l1.5 1.5M8 10l1.5 1.5" />
      </svg>
    ),
  },
  {
    href: '/reproducao',
    label: 'Reprodução',
    shortLabel: 'Reprod.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    href: '/financeiro',
    label: 'Financeiro',
    shortLabel: 'Financ.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/estoque',
    label: 'Estoque',
    shortLabel: 'Estoque',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/usuarios',
    label: 'Usuários',
    shortLabel: 'Usuários',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 8v6M16 11h6" />
      </svg>
    ),
  },
];

const mainTabHrefs = ['/', '/animais', '/milk-production', '/veterinary-treatment'];
const drawerHrefs = ['/vacinacao', '/reproducao', '/financeiro', '/estoque', '/fazendas', '/usuarios'];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (pathname === '/login' || pathname === '/cadastro') return null;

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const mainTabs = allLinks.filter(l => mainTabHrefs.includes(l.href));
  const drawerItems = allLinks
    .filter(l => drawerHrefs.includes(l.href))
    .sort((a, b) => drawerHrefs.indexOf(a.href) - drawerHrefs.indexOf(b.href));

  const isDrawerRouteActive = drawerHrefs.some(h => isActive(h));

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              <img
                src="/logo.svg"
                alt="SítioWeb"
                className="h-10 sm:h-12 md:h-10 lg:h-12 w-auto object-contain"
              />
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-stretch h-full gap-0.5">
              {allLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center px-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                    isActive(link.href)
                      ? 'border-green-600 text-green-700 bg-green-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="ml-2 self-center px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors shrink-0"
              >
                Sair
              </button>
            </div>

            {/* Logout icon — mobile only */}
            <button
              onClick={handleLogout}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Sair"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Bottom tab bar — mobile only ── */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200"
        style={{
          boxShadow: '0 -2px 16px rgba(0,0,0,0.07)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex">
          {mainTabs.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex-1 flex flex-col items-center pt-2 pb-1.5 gap-0.5 transition-colors"
              >
                <span
                  className={`block h-0.5 w-8 rounded-full -mt-2 mb-1.5 transition-colors ${
                    active ? 'bg-green-500' : 'bg-transparent'
                  }`}
                />
                <span className={active ? 'text-green-600' : 'text-gray-400'}>
                  {link.icon}
                </span>
                <span
                  className={`text-[10px] font-semibold leading-tight tracking-wide ${
                    active ? 'text-green-700' : 'text-gray-400'
                  }`}
                >
                  {link.shortLabel}
                </span>
              </Link>
            );
          })}

          {/* "Mais" tab */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center pt-2 pb-1.5 gap-0.5 transition-colors"
          >
            <span
              className={`block h-0.5 w-8 rounded-full -mt-2 mb-1.5 transition-colors ${
                isDrawerRouteActive ? 'bg-green-500' : 'bg-transparent'
              }`}
            />
            <span className={isDrawerRouteActive ? 'text-green-600' : 'text-gray-400'}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="5" r="1.5" />
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="19" cy="5" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
                <circle cx="5" cy="19" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
                <circle cx="19" cy="19" r="1.5" />
              </svg>
            </span>
            <span
              className={`text-[10px] font-semibold leading-tight tracking-wide ${
                isDrawerRouteActive ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              Mais
            </span>
          </button>
        </div>
      </div>

      {/* ── Drawer — mobile only ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="fixed bottom-0 inset-x-0 bg-white rounded-t-2xl p-4"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Mais opções</h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {drawerItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                    isActive(item.href) ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={isActive(item.href) ? 'text-green-600' : 'text-gray-500'}>
                    {item.icon}
                  </span>
                  <span
                    className={`text-xs font-medium text-center ${
                      isActive(item.href) ? 'text-green-700' : 'text-gray-600'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

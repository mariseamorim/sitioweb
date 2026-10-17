'use client';

import Image from 'next/image';
import { InstallAppButton } from '@/components/InstallAppButton';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { PainelIcon, PropriedadeIcon, AnimalIcon, LeiteIcon, TratamentoIcon, VacinaIcon, ReproducaoIcon, FinanceiroIcon, EstoqueIcon, UsuariosIcon, RelatorioIcon, MenuIcon, FecharIcon, EtiquetaIcon, LojaIcon, SetaDireitaIcon, BalancaIcon, AjudaIcon } from '@/components/ModuleIcons';import { SyncStatus } from '@/components/SyncStatus';
import { TaskBell } from '@/components/TaskBell';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { useDialog } from '@/components/DialogProvider';
import { countAllPendingOnDevice } from '@/lib/offlineStorage';

type NavLink = { href: string; label: string; module: string | null; adminOnly?: boolean; Icon: (p: { className?: string }) => React.ReactNode };

// Telas que só aparecem para quem faz aquele trabalho. Sem segmento informado, aparece tudo.
const SEGMENT_PAGES: Record<string, string[]> = { '/milk-production': ['leite'], '/lite': ['leite'], '/engorda': ['recria', 'engorda'] };

const groups: { label: string; links: NavLink[] }[] = [
  { label: 'Visão geral', links: [
    { href: '/', label: 'Painel', module: null, Icon: PainelIcon },
    { href: '/fazendas', label: 'Propriedades', module: 'fazendas', Icon: PropriedadeIcon },
  ] },
  { label: 'Rebanho e produção', links: [
    { href: '/animais', label: 'Animais', module: 'animais', Icon: AnimalIcon },
    { href: '/engorda', label: 'Recria e engorda', module: 'animais', Icon: BalancaIcon },
    { href: '/milk-production', label: 'Produção de leite', module: 'leite', Icon: LeiteIcon },
    { href: '/veterinary-treatment', label: 'Tratamentos', module: 'veterinario', Icon: TratamentoIcon },
    { href: '/vacinacao', label: 'Vacinação', module: 'vacinacao', Icon: VacinaIcon },
    { href: '/reproducao', label: 'Reprodução', module: 'reproducao', Icon: ReproducaoIcon },
  ] },
  { label: 'Gestão', links: [
    { href: '/financeiro', label: 'Financeiro', module: 'financeiro', Icon: FinanceiroIcon },
    { href: '/estoque', label: 'Estoque', module: 'estoque', Icon: EstoqueIcon },
    { href: '/relatorios', label: 'Relatórios', module: null, Icon: RelatorioIcon },
    { href: '/usuarios', label: 'Usuários', module: 'usuarios', Icon: UsuariosIcon },
  ] },
  { label: 'Fornecedores', links: [
    { href: '/ofertas', label: 'Ofertas', module: null, Icon: EtiquetaIcon },
    { href: '/admin/fornecedores', label: 'Aprovar fornecedores', module: null, adminOnly: true, Icon: LojaIcon },
    { href: '/admin/organizacoes', label: 'Aprovar laticínios e associações', module: null, adminOnly: true, Icon: UsuariosIcon },
  ] },
  { label: 'Ajuda', links: [
    { href: '/ajuda', label: 'Ajuda e suporte', module: null, Icon: AjudaIcon },
  ] },
];

// Fornecedor, laticínio e associação têm uma interface própria, sem os módulos da propriedade
const PANEL_ROLES: Record<string, { href: string; label: string; subtitle: string; Icon: NavLink['Icon'] }> = {
  fornecedor: { href: '/fornecedor', label: 'Fornecedor', subtitle: 'Painel do fornecedor', Icon: LojaIcon },
  laticinio: { href: '/laticinio', label: 'Laticínio', subtitle: 'Painel do laticínio', Icon: EstoqueIcon },
  associacao: { href: '/associacao', label: 'Associação', subtitle: 'Painel da associação', Icon: UsuariosIcon },
};

export function Navbar({ desktopOpen, onToggleDesktop }: { desktopOpen: boolean; onToggleDesktop: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccess, user } = useUser();
  const { notify } = useDialog();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const drawerOpen = openPath === pathname;
  const drawer = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelRole = user?.role ? PANEL_ROLES[user.role] : undefined;
  const isVendor = !!panelRole;
  const homeHref = panelRole?.href ?? '/';
  const vendorGroups: { label: string; links: NavLink[] }[] = panelRole
    ? [{ label: panelRole.label, links: [{ href: panelRole.href, label: 'Meu painel', module: null, Icon: panelRole.Icon }] }, { label: 'Ajuda', links: [{ href: '/ajuda', label: 'Ajuda e suporte', module: null, Icon: AjudaIcon }] }]
    : [];
  const segments = user?.farmSegments ?? [];
  const fitsSegment = (href: string) => !segments.length || !SEGMENT_PAGES[href] || SEGMENT_PAGES[href].some(s => segments.includes(s));
  // Celular: atalhos do dia a dia no rodapé, como num app; o resto fica em "Mais"
  const bottomTabs = panelRole
    ? [{ href: panelRole.href, label: 'Painel', Icon: panelRole.Icon }]
    : [
        { href: '/', label: 'Painel', module: null, Icon: PainelIcon },
        { href: '/lite', label: 'Anotar', module: 'leite', Icon: LeiteIcon },
        { href: '/animais', label: 'Animais', module: 'animais', Icon: AnimalIcon },
        { href: '/vacinacao', label: 'Vacinas', module: 'vacinacao', Icon: VacinaIcon },
      ].filter((tab) => (!tab.module || canAccess(tab.module)) && fitsSegment(tab.href));
  const isTabActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
  const visibleGroups = (isVendor ? vendorGroups : groups).map(group => ({ ...group, links: group.links.filter(link => (!link.module || canAccess(link.module)) && (!link.adminOnly || user?.role === 'admin') && fitsSegment(link.href)) })).filter(group => group.links.length);
  const activeLink = visibleGroups.flatMap(group => group.links).find(link => link.href === '/' ? pathname === '/' : pathname === link.href || pathname.startsWith(link.href + '/'));
  const role = user?.role === 'admin' ? 'Administrador' : user?.role === 'editor' ? 'Editor' : panelRole ? panelRole.label : 'Leitor';

  useEffect(() => {
    if (!drawerOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPath(null);
      if (event.key !== 'Tab') return;
      const items = drawer.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const media = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (media.matches) setOpenPath(null); };
    document.addEventListener('keydown', onKey);
    media.addEventListener('change', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onResize);
      previousFocus?.focus();
    };
  }, [drawerOpen]);

  async function handleLogout() {
    // Sair apaga os dados do aparelho: com anotações ainda não enviadas, elas se perderiam
    const pending = countAllPendingOnDevice();
    if (pending > 0) {
      await notify(
        `Há ${pending} registro${pending > 1 ? 's' : ''} ainda não enviado${pending > 1 ? 's' : ''}`,
        'Conecte-se à internet e espere o envio terminar antes de sair, senão esses registros se perdem.',
      );
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) void caches.keys().then(names => Promise.all(names.map(name => caches.delete(name))));
    await fetch('/api/auth/logout', { method: 'POST' });
    setOpenPath(null);
    router.push('/login');
  }

  const logo = <Image src="/anota-ai-agro-logo.png" width={132} height={38} sizes="132px" alt="Anota Aí Agro" priority className="h-auto w-32" style={{ width: 128, height: 'auto' }} />;
  const navigation = <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-3">
    {visibleGroups.map(group => <div key={group.label} className="mb-4 last:mb-0">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</p>
      <ul className="space-y-1">{group.links.map(({ href, label, Icon }) => {
        const active = activeLink?.href === href;
        return <li key={href}><Link href={href} onClick={() => setOpenPath(null)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${active ? 'bg-green-100 text-green-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
          <span aria-hidden="true" className={active ? 'text-green-700' : 'text-gray-400'}><Icon className="h-5 w-5" /></span><span>{label}</span>{active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-green-700" />}
        </Link></li>;
      })}</ul>
    </div>)}
  </nav>;
  const account = <div className="shrink-0 border-t border-gray-100 p-4">
    <Link href="/perfil" onClick={() => setOpenPath(null)} className="mb-3 block rounded-lg px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">Meu cadastro</Link>
    {user && <div className="mb-3 flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800">{user.name.slice(0, 1).toUpperCase()}</span>
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-500">{role}</p></div>
    </div>}
    <InstallAppButton className="mb-2" />
    <button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-green-700">
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" /></svg>Sair da conta
    </button>
  </div>;

  return <>
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:p-3 focus:text-green-900">Ir para o conteúdo</a>
    <aside id="menu-computador" className={`fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 bg-white ${desktopOpen ? 'lg:flex' : ''}`}>
      <Link href="/" aria-label="Anota Aí Agro, painel" className="flex h-16 shrink-0 items-center justify-center border-b border-gray-100">{logo}</Link>
      {navigation}{account}
    </aside>
    <header className={`sticky top-0 z-30 border-b border-gray-200 bg-white ${desktopOpen ? 'lg:ml-64' : ''}`}>
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onToggleDesktop} aria-label={desktopOpen ? 'Recolher menu' : 'Abrir menu lateral'} aria-expanded={desktopOpen} aria-controls="menu-computador" className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 lg:flex"><MenuIcon className="h-5 w-5" /></button>
          <button ref={trigger} type="button" onClick={() => setOpenPath(pathname)} aria-label="Abrir menu" aria-expanded={drawerOpen} aria-controls={drawerOpen ? 'menu-lateral' : undefined} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 lg:hidden"><MenuIcon className="h-5 w-5" /></button>
          {/* Fora do painel, um "voltar" visível: o menu ☰ não é óbvio para quem não é de tecnologia */}
          {pathname !== homeHref && (
            <Link href={homeHref} aria-label="Voltar ao painel" className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <SetaDireitaIcon className="h-4 w-4 rotate-180" /><span className="hidden sm:inline">Painel</span>
            </Link>
          )}
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{activeLink?.label || 'Anota Aí Agro'}</p>{panelRole ? <p className="truncate text-xs text-gray-500">{panelRole.subtitle}</p> : <FarmSwitcher fallback="Gestão da propriedade" />}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2"><div className="hidden sm:block"><SyncStatus /></div>{user?.farmId && <TaskBell />}</div>
      </div>
      <div className="px-4 pb-2 empty:hidden sm:hidden"><SyncStatus /></div>
    </header>
    <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${bottomTabs.length + 1}, minmax(0, 1fr))` }}>
        {bottomTabs.map(({ href, label, Icon }) => {
          const active = isTabActive(href);
          return <li key={href}><Link href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? 'text-green-800' : 'text-gray-500'}`}>
            <span aria-hidden="true" className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? 'bg-green-100' : ''}`}><Icon className="h-6 w-6" /></span>{label}
          </Link></li>;
        })}
        <li><button type="button" onClick={() => setOpenPath(pathname)} aria-label="Mais opções do menu" className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-gray-500">
          <span aria-hidden="true" className="flex h-8 w-12 items-center justify-center rounded-full"><MenuIcon className="h-6 w-6" /></span>Mais
        </button></li>
      </ul>
    </nav>
    {drawerOpen && <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-gray-950/45" aria-hidden="true" onClick={() => setOpenPath(null)} />
      <div ref={drawer} id="menu-lateral" role="dialog" aria-modal="true" aria-label="Menu de navegação" className="relative flex h-full h-dvh w-[min(288px,calc(100vw-32px))] flex-col bg-white shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4"><Link href="/" onClick={() => setOpenPath(null)} aria-label="Anota Aí Agro, painel">{logo}</Link><button type="button" onClick={() => setOpenPath(null)} aria-label="Fechar menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"><FecharIcon className="h-5 w-5" /></button></div>
        {navigation}{account}
      </div>
    </div>}
  </>;
}

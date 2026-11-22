'use client';

import Image from 'next/image';
import { InstallAppButton } from '@/components/InstallAppButton';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { GraficoIcon, PainelIcon, PropriedadeIcon, AnimalIcon, LeiteIcon, TratamentoIcon, VacinaIcon, ReproducaoIcon, FinanceiroIcon, EstoqueIcon, UsuariosIcon, RelatorioIcon, MenuIcon, FecharIcon, EtiquetaIcon, LojaIcon, SetaDireitaIcon, BalancaIcon, AjudaIcon, CadeadoIcon } from '@/components/ModuleIcons';import { SyncStatus } from '@/components/SyncStatus';
import { TaskBell } from '@/components/TaskBell';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { useDialog } from '@/components/DialogProvider';
import { countAllPendingOnDevice } from '@/lib/offlineStorage';
import { logoutKeepingDevice } from '@/lib/offlineUnlock';
import { forgetWarmedPages, warmOfflinePages } from '@/components/PwaRegistration';
import { useT } from '@/lib/i18n';
import { LanguagePicker } from '@/components/LanguagePicker';

type NavLink = { href: string; label: string; module: string | null; adminOnly?: boolean; /** 'only': só para o veterinário consultor; 'hide': some para ele */ vet?: 'only' | 'hide'; Icon: (p: { className?: string }) => React.ReactNode };

// Telas que só aparecem para quem faz aquele trabalho. Sem segmento informado, aparece tudo.
const SEGMENT_PAGES: Record<string, string[]> = { '/milk-production': ['leite'], '/lite': ['leite'], '/engorda': ['recria', 'engorda'] };

// Menu em grupos que abrem e fecham (como um sistema de gestão): o primeiro grupo fica sempre aberto, sem título;
// os outros mostram só o título com ícone e abrem ao tocar. O grupo da tela aberta já vem aberto.
type NavGroup = { label: string; Icon?: NavLink['Icon']; links: NavLink[] };
const groups: NavGroup[] = [
  { label: 'Início', links: [
    { href: '/consultoria', label: 'Consultoria', module: null, vet: 'only', Icon: UsuariosIcon },
    { href: '/', label: 'Painel', module: null, vet: 'hide', Icon: PainelIcon },
    { href: '/dashboard', label: 'Dashboard', module: null, Icon: GraficoIcon },
  ] },
  { label: 'Rebanho', Icon: AnimalIcon, links: [
    { href: '/animais', label: 'Animais', module: 'animais', Icon: AnimalIcon },
    { href: '/engorda', label: 'Recria e engorda', module: 'animais', Icon: BalancaIcon },
    { href: '/reproducao', label: 'Reprodução', module: 'reproducao', Icon: ReproducaoIcon },
  ] },
  { label: 'Manejo', Icon: TratamentoIcon, links: [
    { href: '/milk-production', label: 'Produção de leite', module: 'leite', vet: 'hide', Icon: LeiteIcon },
    { href: '/vacinacao', label: 'Vacinação', module: 'vacinacao', Icon: VacinaIcon },
    { href: '/veterinary-treatment', label: 'Tratamentos', module: 'veterinario', Icon: TratamentoIcon },
  ] },
  { label: 'Gestão', Icon: FinanceiroIcon, links: [
    { href: '/financeiro', label: 'Financeiro', module: 'financeiro', Icon: FinanceiroIcon },
    { href: '/estoque', label: 'Estoque', module: 'estoque', Icon: EstoqueIcon },
    { href: '/relatorios', label: 'Relatórios', module: null, Icon: RelatorioIcon },
    { href: '/ofertas', label: 'Ofertas', module: null, Icon: EtiquetaIcon },
  ] },
  { label: 'Propriedade', Icon: PropriedadeIcon, links: [
    { href: '/fazendas', label: 'Propriedades', module: 'fazendas', Icon: PropriedadeIcon },
    { href: '/usuarios', label: 'Usuários', module: 'usuarios', Icon: UsuariosIcon },
    { href: '/meu-veterinario', label: 'Meu veterinário', module: 'reproducao', vet: 'hide', Icon: TratamentoIcon },
  ] },
  // Só o administrador: aprovações e as contas de todos os perfis (dados e senha)
  { label: 'Administração', Icon: CadeadoIcon, links: [
    { href: '/admin/usuarios', label: 'Contas e senhas', module: null, adminOnly: true, Icon: CadeadoIcon },
    { href: '/admin/fornecedores', label: 'Aprovar fornecedores', module: null, adminOnly: true, Icon: LojaIcon },
    { href: '/admin/organizacoes', label: 'Aprovar laticínios e associações', module: null, adminOnly: true, Icon: UsuariosIcon },
  ] },
  { label: 'Ajuda', Icon: AjudaIcon, links: [
    { href: '/ajuda', label: 'Ajuda e suporte', module: null, Icon: AjudaIcon },
    { href: '/manual', label: 'Manual do usuário', module: null, Icon: RelatorioIcon },
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
  const t = useT();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const drawerOpen = openPath === pathname;
  const drawer = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelRole = user?.role ? PANEL_ROLES[user.role] : undefined;
  const isVendor = !!panelRole;
  const homeHref = panelRole?.href ?? '/';
  const vendorGroups: NavGroup[] = panelRole
    ? [{ label: panelRole.label, links: [{ href: panelRole.href, label: 'Meu painel', module: null, Icon: panelRole.Icon }, { href: '/dashboard', label: 'Dashboard', module: null, Icon: GraficoIcon }] }, { label: 'Ajuda', links: [{ href: '/ajuda', label: 'Ajuda e suporte', module: null, Icon: AjudaIcon }, { href: '/manual', label: 'Manual do usuário', module: null, Icon: RelatorioIcon }] }]
    : [];
  const segments = user?.farmSegments ?? [];
  const fitsSegment = (href: string) => !segments.length || !SEGMENT_PAGES[href] || SEGMENT_PAGES[href].some(s => segments.includes(s));
  // Celular: atalhos do dia a dia no rodapé, como num app; o resto fica em "Mais"
  // Fornecedor, laticínio e associação: o cadastro (nome, telefone, senha, empresa) e a ajuda ficam à mão
  const bottomTabs = panelRole
    ? [{ href: panelRole.href, label: 'Painel', Icon: panelRole.Icon }, { href: '/perfil', label: 'Cadastro', Icon: UsuariosIcon }, { href: '/ajuda', label: 'Ajuda', Icon: AjudaIcon }]
    : [
        user?.vet ? { href: '/consultoria', label: 'Consultoria', module: null, Icon: UsuariosIcon } : { href: '/', label: 'Painel', module: null, Icon: PainelIcon },
        { href: '/lite', label: 'Anotar', module: 'leite', Icon: LeiteIcon },
        { href: '/animais', label: 'Animais', module: 'animais', Icon: AnimalIcon },
        { href: '/vacinacao', label: 'Vacinas', module: 'vacinacao', Icon: VacinaIcon },
      ].filter((tab) => (!tab.module || canAccess(tab.module)) && fitsSegment(tab.href) && !(user?.vet && tab.href === '/lite'));
  const isTabActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
  const visibleGroups = (isVendor ? vendorGroups : groups).map(group => ({ ...group, links: group.links.filter(link => (!link.module || canAccess(link.module)) && (!link.adminOnly || user?.role === 'admin') && (!link.vet || (link.vet === 'only') === !!user?.vet) && fitsSegment(link.href)) })).filter(group => group.links.length);
  const activeLink = visibleGroups.flatMap(group => group.links).find(link => link.href === '/' ? pathname === '/' : pathname === link.href || pathname.startsWith(link.href + '/'));
  const role = user?.role === 'admin' ? 'Administrador' : user?.vet ? 'Veterinário' : user?.role === 'editor' ? 'Editor' : panelRole ? panelRole.label : 'Leitor';

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
        pending > 1 ? t('Há {n} registros ainda não enviados', { n: pending }) : t('Há 1 registro ainda não enviado'),
        t('Conecte-se à internet e espere o envio terminar antes de sair, senão esses registros se perdem.'),
      );
      return;
    }
    // Sai, mas deixa os dados e a credencial no aparelho (entrar sem internet)
    logoutKeepingDevice();
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    // As telas guardadas eram desta pessoa: refaz as essenciais já sem sessão
    forgetWarmedPages();
    void warmOfflinePages(true);
    setOpenPath(null);
    router.push('/login');
  }

  const logo = <Image src="/anota-ai-agro-logo.png" width={132} height={38} sizes="132px" alt="Anota Aí Agro" priority className="h-auto w-32" style={{ width: 128, height: 'auto' }} />;
  const navigation = <nav aria-label={t('Menu principal')} className="flex-1 overflow-y-auto px-3 py-3">
    {visibleGroups.map((group, index) => {
      const linkItem = ({ href, label, Icon }: NavLink, nested: boolean) => {
        const active = activeLink?.href === href;
        return <li key={href}><Link href={href} onClick={() => setOpenPath(null)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl py-2 pr-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${nested ? 'pl-9' : 'pl-3'} ${active ? 'bg-green-100 text-green-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
          <span aria-hidden="true" className={active ? 'text-green-700' : 'text-gray-400'}><Icon className={nested ? 'h-4 w-4' : 'h-5 w-5'} /></span><span>{t(label)}</span>{active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-green-700" />}
        </Link></li>;
      };
      // Primeiro grupo (Início) e grupos sem ícone (fornecedor, laticínio, associação): sempre abertos
      if (index === 0 || !group.Icon) return <div key={group.label} className="mb-3 last:mb-0">
        {index > 0 && <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t(group.label)}</p>}
        <ul className="space-y-1">{group.links.map(link => linkItem(link, false))}</ul>
      </div>;
      // Grupo com um item só: o item direto, sem abrir e fechar
      if (group.links.length === 1) return <ul key={group.label} className="mb-1 space-y-1">{linkItem(group.links[0], false)}</ul>;
      const hasActive = group.links.some(link => link.href === activeLink?.href);
      const open = toggled[group.label] ?? hasActive;
      const GroupIcon = group.Icon;
      const id = `menu-${group.label}`;
      return <div key={group.label} className="mb-1">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setToggled(prev => ({ ...prev, [group.label]: !open }))}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${hasActive ? 'text-green-900' : 'text-gray-700 hover:bg-gray-100'}`}>
          <span aria-hidden="true" className={hasActive ? 'text-green-700' : 'text-gray-400'}><GroupIcon className="h-5 w-5" /></span>
          <span>{t(group.label)}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="currentColor"><path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" /></svg>
        </button>
        {open && <ul id={id} className="mt-1 space-y-1">{group.links.map(link => linkItem(link, true))}</ul>}
      </div>;
    })}
  </nav>;
  const account = <div className="shrink-0 border-t border-gray-100 p-4">
    <Link href="/perfil" onClick={() => setOpenPath(null)} className="mb-3 block rounded-lg px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">{t('Meu cadastro')}</Link>
    {user && <div className="mb-3 flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800">{user.name.slice(0, 1).toUpperCase()}</span>
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-500">{t(role)}</p></div>
    </div>}
    <LanguagePicker className="mb-3" />
    <InstallAppButton className="mb-2" />
    <button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-green-700">
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" /></svg>{t('Sair da conta')}
    </button>
  </div>;

  return <>
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:p-3 focus:text-green-900">{t('Ir para o conteúdo')}</a>
    <aside id="menu-computador" className={`fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 bg-white ${desktopOpen ? 'lg:flex' : ''}`}>
      <Link href="/" aria-label="Anota Aí Agro, painel" className="flex h-16 shrink-0 items-center justify-center border-b border-gray-100">{logo}</Link>
      {navigation}{account}
    </aside>
    {/* Menu recolhido: todas as telas do menu em ícones numa faixa estreita, separadas por grupo; o nome aparece ao passar o mouse */}
    {!desktopOpen && (
      <nav aria-label={t('Menu principal')} className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center gap-1 overflow-y-auto border-r border-gray-200 bg-white py-3 lg:flex">
        <button type="button" onClick={onToggleDesktop} aria-label={t('Abrir menu lateral')} aria-expanded={false} aria-controls="menu-computador" title={t('Abrir menu lateral')} className="mb-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"><MenuIcon className="h-5 w-5" /></button>
        {visibleGroups.map((group, index) => (
          <div key={group.label} className={`flex w-full flex-col items-center gap-1 ${index > 0 ? 'mt-1 border-t border-gray-100 pt-2' : ''}`} role="group" aria-label={t(group.label)}>
            {group.links.map(({ href, label, Icon }) => {
              const active = activeLink?.href === href;
              return <Link key={href} href={href} aria-label={t(label)} title={t(label)} aria-current={active ? 'page' : undefined}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${active ? 'bg-green-100 text-green-800' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}><Icon className="h-5 w-5" /></Link>;
            })}
          </div>
        ))}
      </nav>
    )}
    <header className={`sticky top-0 z-30 border-b border-gray-200 bg-white ${desktopOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onToggleDesktop} aria-label={t(desktopOpen ? 'Recolher menu' : 'Abrir menu lateral')} aria-expanded={desktopOpen} aria-controls="menu-computador" className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 ${desktopOpen ? 'lg:flex' : ''}`}><MenuIcon className="h-5 w-5" /></button>
          <button ref={trigger} type="button" onClick={() => setOpenPath(pathname)} aria-label={t('Abrir menu')} aria-expanded={drawerOpen} aria-controls={drawerOpen ? 'menu-lateral' : undefined} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 lg:hidden"><MenuIcon className="h-5 w-5" /></button>
          {/* Fora do painel, um "voltar" visível: o menu ☰ não é óbvio para quem não é de tecnologia */}
          {pathname !== homeHref && (
            <Link href={homeHref} aria-label={t('Voltar ao painel')} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <SetaDireitaIcon className="h-4 w-4 rotate-180" /><span className="hidden sm:inline">{t('Painel')}</span>
            </Link>
          )}
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{activeLink ? t(activeLink.label) : 'Anota Aí Agro'}</p>{panelRole ? <p className="truncate text-xs text-gray-500">{t(panelRole.subtitle)}</p> : <FarmSwitcher fallback={t('Gestão da propriedade')} />}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2"><div className="hidden sm:block"><SyncStatus /></div>{user?.farmId && <TaskBell />}</div>
      </div>
      <div className="px-4 pb-2 empty:hidden sm:hidden"><SyncStatus /></div>
    </header>
    <nav aria-label={t('Atalhos')} className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${bottomTabs.length + 1}, minmax(0, 1fr))` }}>
        {bottomTabs.map(({ href, label, Icon }) => {
          const active = isTabActive(href);
          return <li key={href}><Link href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? 'text-green-800' : 'text-gray-500'}`}>
            <span aria-hidden="true" className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? 'bg-green-100' : ''}`}><Icon className="h-6 w-6" /></span>{t(label)}
          </Link></li>;
        })}
        <li><button type="button" onClick={() => setOpenPath(pathname)} aria-label={t('Mais opções do menu')} className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-gray-500">
          <span aria-hidden="true" className="flex h-8 w-12 items-center justify-center rounded-full"><MenuIcon className="h-6 w-6" /></span>{t('Mais')}
        </button></li>
      </ul>
    </nav>
    {drawerOpen && <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-gray-950/45" aria-hidden="true" onClick={() => setOpenPath(null)} />
      <div ref={drawer} id="menu-lateral" role="dialog" aria-modal="true" aria-label={t('Menu de navegação')} className="relative flex h-full h-dvh w-[min(288px,calc(100vw-32px))] flex-col bg-white shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4"><Link href="/" onClick={() => setOpenPath(null)} aria-label="Anota Aí Agro, painel">{logo}</Link><button type="button" onClick={() => setOpenPath(null)} aria-label={t('Fechar menu')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"><FecharIcon className="h-5 w-5" /></button></div>
        {navigation}{account}
      </div>
    </div>}
  </>;
}

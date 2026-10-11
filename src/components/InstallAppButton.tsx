'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// O Chrome só oferece "Instalar" escondido no menu ⋮; no iPhone não há botão nenhum.
// Este botão deixa a instalação à vista e explica o caminho quando o navegador não instala sozinho.
export function InstallAppButton({ className = '' }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [state, setState] = useState<'oculto' | 'pronto' | 'ios' | 'ajuda'>('oculto');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); setState('pronto'); };
    const onInstalled = () => { setPrompt(null); setState('oculto'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // Sem o aviso do navegador (iPhone, ou app já instalado neste aparelho), mostra o passo a passo
    const timer = setTimeout(() => setState((s) => (s === 'oculto' ? (ios ? 'ios' : 'ajuda') : s)), 1500);
    return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (state === 'oculto') return null;

  async function handleClick() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setState('oculto');
      setPrompt(null);
      return;
    }
    setShowHelp((v) => !v);
  }

  return (
    <div className={className}>
      <button type="button" onClick={handleClick} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-green-700 px-4 text-sm font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-700">
        <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" /></svg>
        Instalar o app no celular
      </button>
      {showHelp && (
        <p className="mt-2 rounded-xl bg-green-50 p-3 text-left text-sm text-green-900">
          {state === 'ios'
            ? <>No Safari, toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima) e depois em <strong>Adicionar à Tela de Início</strong>.</>
            : <>No Chrome, toque nos <strong>três pontinhos ⋮</strong> no canto de cima e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>. Se aparecer <strong>Abrir no app</strong>, ele já está instalado: procure o ícone do Anota Aí Agro na tela do celular.</>}
        </p>
      )}
    </div>
  );
}

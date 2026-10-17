'use client';

import { useEffect, useState } from 'react';
import { GoogleLoginButton, GOOGLE_ERRORS } from '@/components/GoogleLoginButton'
import { safeNext } from '@/lib/google-navigation'
import Image from 'next/image'
import Link from 'next/link';
import { BackLink } from '@/components/BackLink'
import { forgetWarmedPages, warmOfflinePages } from '@/components/PwaRegistration'
import { readCachedUser, writeCachedUser, type UserData } from '@/contexts/UserContext'
import { canUnlockOffline, offlineCredentialFor, saveOfflineCredential, unlockOffline } from '@/lib/offlineUnlock'
import { homeForRole } from '@/lib/organizations'

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Sem internet a senha não pode ser conferida; quem já entrou neste aparelho pode seguir com o que está guardado
  const [offline, setOffline] = useState(false);
  const [cached, setCached] = useState<UserData | null>(null);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('googleError')
    if (code) setError(GOOGLE_ERRORS[code] || GOOGLE_ERRORS.failed)
    const update = () => { setOffline(!navigator.onLine); setCached(readCachedUser()) }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  function continueOffline() {
    // Recarrega inteiro: sem internet, é o service worker que entrega a tela guardada
    window.location.href = homeForRole(cached?.role)
  }

  // Sem internet: confere a senha com o que ficou guardado da última entrada neste aparelho
  async function enterOffline() {
    const user = await unlockOffline(login, password).catch(() => null);
    if (user) {
      writeCachedUser(user);
      window.location.href = homeForRole(user.role);
      return true;
    }
    setOffline(true);
    setCached(readCachedUser());
    setError(offlineCredentialFor(login)
      ? 'Senha incorreta.'
      : 'Sem internet. Para entrar sem sinal, entre uma vez com internet neste aparelho com este telefone ou e-mail.');
    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!navigator.onLine) { await enterOffline(); return; }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        return;
      }

      // As telas guardadas eram de quem entrou antes: refaz para esta pessoa
      forgetWarmedPages();
      await warmOfflinePages(true);
      // Guarda a senha como hash para poder entrar sem internet da próxima vez
      try {
        const me = await fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null));
        if (me) await saveOfflineCredential(me as UserData, password);
      } catch {}
      // Volta para onde a pessoa estava (ex.: link de convite de fornecedor)
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = safeNext(next);
    } catch {
      // Servidor fora de alcance: tenta sem internet
      if (await enterOffline()) return;
      if (navigator.onLine) setError('Não foi possível falar com o servidor. Tente de novo em instantes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm mx-auto">
        <BackLink href="/inicio" label="Voltar ao início" className="mb-2 -ml-2" />
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Image
                src="/anota-ai-agro-logo.png" width={1632} height={473}
                alt="Anota Aí Agro"
                className="h-auto w-56 max-w-full object-contain"
              />
            </div>
            <p className="text-gray-500 text-sm mt-1">Faça login para continuar</p>
          </div>

          {offline && (
            <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Você está sem internet</p>
              <p className="mt-1">{canUnlockOffline() ? 'Se você já entrou uma vez com internet neste aparelho, pode entrar agora com o mesmo telefone ou e-mail e senha.' : 'Para entrar é preciso sinal. Depois de entrar uma vez, o app abre sem internet.'}</p>
              {cached && (
                <button type="button" onClick={continueOffline} className="mt-3 w-full rounded-lg bg-green-700 py-2.5 font-semibold text-white hover:bg-green-600">
                  Continuar sem internet como {cached.name}
                </button>
              )}
            </div>
          )}
          <div className="mb-4"><GoogleLoginButton /></div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="login">Telefone ou e-mail</label>
              <input
                id="login"
                type="text"
                inputMode="email"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="(35) 99999-0000 ou seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || (offline && !canUnlockOffline())}
              className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white font-medium py-2 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? 'Entrando...' : offline ? (canUnlockOffline() ? 'Entrar sem internet' : 'Sem internet para entrar') : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Não tem uma conta?{' '}
            <Link href="/criar-conta" className="text-green-700 font-medium hover:underline">
              Criar conta
            </Link>
          </p>
          <p className="text-center text-sm text-gray-500 mt-3">
            Não consegue entrar? <Link href="/ajuda" className="text-green-700 font-medium hover:underline">Peça ajuda</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

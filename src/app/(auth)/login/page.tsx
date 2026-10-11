'use client';

import { useEffect, useState } from 'react';
import { GoogleLoginButton, GOOGLE_ERRORS } from '@/components/GoogleLoginButton'
import { safeNext } from '@/lib/google-navigation'
import Image from 'next/image'
import Link from 'next/link';
import { BackLink } from '@/components/BackLink'

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('googleError')
    if (code) setError(GOOGLE_ERRORS[code] || GOOGLE_ERRORS.failed)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        return;
      }

      // Volta para onde a pessoa estava (ex.: link de convite de fornecedor)
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = safeNext(next);
    } catch {
      setError('Erro de conexão. Tente novamente.');
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

          <div className="mb-4"><GoogleLoginButton /></div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="seu@email.com"
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
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white font-medium py-2 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Não tem uma conta?{' '}
            <Link href="/criar-conta" className="text-green-700 font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

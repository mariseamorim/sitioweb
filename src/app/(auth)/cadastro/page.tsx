'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 1 | 2;

const FARM_EMPTY = { name: '', propertyType: 'Fazenda', documentType: 'CNPJ', documentNumber: '', owner: '', phone: '', email: '', city: '', state: '' };
const USER_EMPTY = { name: '', email: '', password: '', confirm: '' };

export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const [farm, setFarm] = useState(FARM_EMPTY);
  const [user, setUser] = useState(USER_EMPTY);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (user.password !== user.confirm) {
      setError('As senhas não coincidem');
      return;
    }
    if (user.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farm, user: { name: user.name, email: user.email, password: user.password } }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        return;
      }

      router.push('/');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-green-700">SitíoWeb
              
            </h1>
            <p className="text-gray-500 text-sm mt-1">Criar nova conta</p>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center mb-8">
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
              <span className={`text-sm font-medium ${step === 1 ? 'text-green-700' : 'text-gray-400'}`}>Fazenda</span>
            </div>
            <div className="flex-1 h-px bg-gray-200 mx-2" />
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
              <span className={`text-sm font-medium ${step === 2 ? 'text-green-700' : 'text-gray-400'}`}>Usuário</span>
            </div>
          </div>

          {/* Step 1: Farm */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="flex flex-col gap-3">

              {/* Tipo de propriedade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Propriedade *</label>
                <div className="flex gap-2">
                  {['Fazenda', 'Sítio'].map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFarm({ ...farm, propertyType: tipo })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        farm.propertyType === tipo
                          ? 'bg-green-700 border-green-700 text-white'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da propriedade *</label>
                <input
                  value={farm.name}
                  onChange={(e) => setFarm({ ...farm, name: e.target.value })}
                  required
                  autoFocus
                  placeholder={farm.propertyType === 'Sítio' ? 'Ex: Sítio Primavera' : 'Ex: Fazenda São João'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proprietário</label>
                <input
                  value={farm.owner}
                  onChange={(e) => setFarm({ ...farm, owner: e.target.value })}
                  placeholder="Nome do proprietário"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={farm.documentType}
                    onChange={(e) => setFarm({ ...farm, documentType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    <option value="CNPJ">CNPJ</option>
                    <option value="CPF">CPF</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Documento (CPF/CNPJ)</label>
                  <input
                    value={farm.documentNumber}
                    onChange={(e) => setFarm({ ...farm, documentNumber: e.target.value })}
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input
                    value={farm.city}
                    onChange={(e) => setFarm({ ...farm, city: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input
                    value={farm.state}
                    onChange={(e) => setFarm({ ...farm, state: e.target.value })}
                    placeholder="SP"
                    maxLength={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    value={farm.phone}
                    onChange={(e) => setFarm({ ...farm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={farm.email}
                    onChange={(e) => setFarm({ ...farm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-2 rounded-lg text-sm transition-colors mt-2"
              >
                Próximo
              </button>
            </form>
          )}

          {/* Step 2: User */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome *</label>
                <input
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  required
                  autoFocus
                  placeholder="Nome completo"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                <input
                  type="email"
                  value={user.email}
                  onChange={(e) => setUser({ ...user, email: e.target.value })}
                  required
                  placeholder="seu@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                <input
                  type="password"
                  value={user.password}
                  onChange={(e) => setUser({ ...user, password: e.target.value })}
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha *</label>
                <input
                  type="password"
                  value={user.confirm}
                  onChange={(e) => setUser({ ...user, confirm: e.target.value })}
                  required
                  placeholder="Repita a senha"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                >
                  {loading ? 'Criando...' : 'Criar conta'}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-green-700 font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

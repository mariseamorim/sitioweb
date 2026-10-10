import { SemSinalIcon } from '@/components/ModuleIcons'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
        <SemSinalIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">Você está offline</h1>
        <p className="text-sm text-gray-600 mt-2">
          Esta página não está disponível sem conexão. Volte online para continuar.
        </p>
      </div>
    </div>
  );
}

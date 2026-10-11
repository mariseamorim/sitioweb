import { SemSinalIcon } from '@/components/ModuleIcons'

// Aberta pelo service worker quando uma tela não está guardada no aparelho e não há internet
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
        <SemSinalIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <h1 className="text-xl font-bold text-gray-900">Você está sem internet</h1>
        <p className="text-sm text-gray-600 mt-2">
          Esta tela ainda não foi guardada no aparelho. Volte para uma tela já aberta antes ou anote o leite, que funciona sem internet.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {/* <a> de propósito: sem internet, a página precisa recarregar inteira para o service worker entregar a cópia guardada */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="w-full rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-600">Ir para o painel</a>
          <a href="/lite" className="w-full rounded-xl border-2 border-green-700 py-2.5 font-semibold text-green-800 hover:bg-green-50">Anotar o leite</a>
        </div>
      </div>
    </div>
  );
}

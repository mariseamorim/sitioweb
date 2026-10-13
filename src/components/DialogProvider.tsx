'use client'

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

interface DialogState extends ConfirmOptions {
  kind: 'confirm' | 'alert'
}

interface DialogContextType {
  /** Pergunta ao usuário. Resolve true se ele confirmar. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Mostra um aviso com um único botão "Entendi". */
  notify: (title: string, message?: string) => Promise<void>
}

const DialogContext = createContext<DialogContextType>({
  confirm: async () => false,
  notify: async () => {},
})

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const resolver = useRef<(value: boolean) => void>(() => {})

  const open = useCallback((state: DialogState) => {
    setDialog(state)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => open({ ...options, kind: 'confirm' }), [open])
  const notify = useCallback(async (title: string, message?: string) => {
    await open({ title, message, kind: 'alert' })
  }, [open])

  function close(result: boolean) {
    setDialog(null)
    resolver.current(result)
  }

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dialog-title" className="text-lg font-bold text-gray-900">{dialog.title}</h2>
            {dialog.message && <p className="mt-2 text-base text-gray-600 leading-relaxed">{dialog.message}</p>}
            <div className="mt-6 flex gap-2">
              {dialog.kind === 'confirm' && (
                <button
                  onClick={() => close(false)}
                  className="flex-1 border border-gray-200 text-gray-700 text-base font-medium py-3 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
              <button
                autoFocus
                onClick={() => close(true)}
                className={`flex-1 text-white text-base font-semibold py-3 rounded-lg ${
                  dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-green-700 hover:bg-green-600'
                }`}
              >
                {dialog.kind === 'alert' ? 'Entendi' : dialog.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  return useContext(DialogContext)
}

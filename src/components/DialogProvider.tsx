'use client'

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import { AppModal, modalButton } from '@/components/AppModal'
import { AlertaIcon, LixeiraIcon } from '@/components/ModuleIcons'

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
  const t = useT()
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
        // Confirmação no tamanho pequeno do modal padrão: vermelho com lixeira para excluir, verde para o resto
        <div className="relative z-[60]">
          <AppModal size="sm" role="alertdialog" title={t(dialog.title)} tone={dialog.danger ? 'red' : dialog.kind === 'alert' ? 'blue' : 'green'}
            icon={dialog.danger ? <LixeiraIcon className="h-5 w-5" /> : <AlertaIcon className="h-5 w-5" />}
            onClose={() => close(false)}
            footer={<>
              {/* Excluir: o foco começa em Cancelar, para um Enter sem querer não apagar nada */}
              {dialog.kind === 'confirm' && <button type="button" autoFocus={!!dialog.danger} onClick={() => close(false)} className={modalButton.ghost}>{t('Cancelar')}</button>}
              <button type="button" autoFocus={!dialog.danger} onClick={() => close(true)} className={dialog.danger ? modalButton.danger : modalButton.primary}>
                {dialog.kind === 'alert' ? t('Entendi') : t(dialog.confirmLabel ?? 'Confirmar')}
              </button>
            </>}>
            {dialog.message && <p className="text-base leading-relaxed text-gray-600">{t(dialog.message)}</p>}
          </AppModal>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  return useContext(DialogContext)
}

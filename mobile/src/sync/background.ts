// Envio da fila com o app fechado ou em segundo plano. O Android (WorkManager) chama a tarefa quando há internet e
// bateria, no máximo a cada 15 minutos e sem hora certa. Só envia o que está pendente; baixar as listas fica para
// quando o app abrir. Este arquivo é importado no topo de app/_layout.tsx: a tarefa precisa estar definida na carga
// do JavaScript, porque em segundo plano nenhuma tela é montada.
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { AppState } from 'react-native'
import { setAuth } from '@/api/client'
import { readStoredSession } from '@/auth/stored'
import { pendingCount } from './local'
import { pushInBackground } from './index'

const TASK = 'anotaai-enviar-fila'
const INTERVAL_MINUTES = 15

TaskManager.defineTask(TASK, async () => {
  try {
    // Com o app aberto na tela, a sincronização normal (sync/index.ts) já cuida do envio
    if (AppState.currentState === 'active') return BackgroundTask.BackgroundTaskResult.Success
    const session = await readStoredSession()
    if (!session || pendingCount(session.farmId).pending === 0) return BackgroundTask.BackgroundTaskResult.Success
    setAuth({ token: session.token, farmId: session.farmId })
    const sent = await pushInBackground(session.farmId)
    return sent ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

/** Liga o envio em segundo plano (ao entrar numa propriedade). Aparelho que não permite: segue só com o app aberto. */
export async function enableBackgroundSync() {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: INTERVAL_MINUTES })
  } catch {
    // Sem o serviço de tarefas: nada a fazer
  }
}

/** Desliga ao sair da conta. */
export async function disableBackgroundSync() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK)
  } catch {
    // Já estava desligado
  }
}

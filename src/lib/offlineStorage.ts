/**
 * Utility para gerenciar offline storage de forma reutilizável
 * Padrão: PENDING_<MODULE>_KEY para armazenar registros pendentes
 */

export interface OfflineRecord {
  [key: string]: any;
}

// Helper para verificar se localStorage está disponível
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    if (typeof window === 'undefined') return false;
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getPendingRecords(module: string): OfflineRecord[] {
  if (!isLocalStorageAvailable()) return [];
  const key = `pending_${module}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function addPendingRecord(module: string, record: OfflineRecord): number {
  if (!isLocalStorageAvailable()) return 0;
  const key = `pending_${module}`;
  try {
    const records = getPendingRecords(module);
    records.push({ ...record, _pendingId: Date.now() + Math.random() });
    localStorage.setItem(key, JSON.stringify(records));
    return records.length;
  } catch (err) {
    console.error('Failed to add pending record:', err);
    return 0;
  }
}

export function clearPendingRecords(module: string): void {
  if (!isLocalStorageAvailable()) return;
  const key = `pending_${module}`;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Failed to clear pending records:', err);
  }
}

export function removePendingRecord(module: string, pendingId: string | number): void {
  if (!isLocalStorageAvailable()) return;
  const key = `pending_${module}`;
  try {
    const records = getPendingRecords(module);
    const filtered = records.filter(r => r._pendingId !== pendingId);
    if (filtered.length > 0) {
      localStorage.setItem(key, JSON.stringify(filtered));
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.error('Failed to remove pending record:', err);
  }
}

export async function syncPendingRecords(
  module: string,
  endpoint: string,
  onBeforeSync?: (record: OfflineRecord) => OfflineRecord
): Promise<{ success: number; failed: number }> {
  const records = getPendingRecords(module);
  let success = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const pendingId = record._pendingId;
      const recordToSync = { ...record };
      delete recordToSync._pendingId;

      const dataToSync = onBeforeSync ? onBeforeSync(recordToSync) : recordToSync;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSync),
      });

      if (response.ok) {
        removePendingRecord(module, pendingId);
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Tudo o que está salvo no aparelho e ainda não foi enviado:
 * filas do app completo (pending_*) e do Anota Aí Leite (locais e anotações).
 */
export function countAllPendingOnDevice(): number {
  if (!isLocalStorageAvailable()) return 0
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const raw = localStorage.getItem(key) || ''
      if (key.startsWith('pending_')) {
        const list = JSON.parse(raw || '[]')
        if (Array.isArray(list)) total += list.length
      } else if (key === 'lite_queue_v1' || key === 'lite_points_queue_v1') {
        total += Object.keys(JSON.parse(raw || '{}')).length
      }
    }
  } catch {
    // Dado corrompido no aparelho: não bloqueia a contagem do resto
  }
  return total
}

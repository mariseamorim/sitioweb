/**
 * Utility para gerenciar offline storage de forma reutilizável
 * Padrão: PENDING_<MODULE>_KEY para armazenar registros pendentes
 */

export interface OfflineRecord {
  [key: string]: any;
}

export function getPendingRecords(module: string): OfflineRecord[] {
  const key = `pending_${module}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function addPendingRecord(module: string, record: OfflineRecord): number {
  const key = `pending_${module}`;
  const records = getPendingRecords(module);
  records.push({ ...record, _pendingId: Date.now() + Math.random() });
  localStorage.setItem(key, JSON.stringify(records));
  return records.length;
}

export function clearPendingRecords(module: string): void {
  const key = `pending_${module}`;
  localStorage.removeItem(key);
}

export function removePendingRecord(module: string, pendingId: string | number): void {
  const key = `pending_${module}`;
  const records = getPendingRecords(module);
  const filtered = records.filter(r => r._pendingId !== pendingId);
  if (filtered.length > 0) {
    localStorage.setItem(key, JSON.stringify(filtered));
  } else {
    localStorage.removeItem(key);
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

import { db } from '../db/db';
import { applyRemoteOperations, getDevice } from './orderService';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
let active: Promise<void> | undefined;
export async function syncWorkspace(workspaceId: string) {
  if (!navigator.onLine || active) return active;
  active = (async () => {
    await db.syncState.put({ workspaceId, cursor: (await db.syncState.get(workspaceId))?.cursor || 0, status: 'syncing', updatedAt: new Date().toISOString() });
    try {
      const device = await getDevice(); const pending = await db.outbox.where('status').anyOf('pending', 'error').toArray();
      if (pending.length) {
        const response = await fetch(`${API}/sync/push`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Device-Id': device.deviceId }, body: JSON.stringify({ workspaceId, operations: pending.map(x => x.operation) }) });
        if (!response.ok) throw new Error(await response.text()); const { acknowledged } = await response.json() as { acknowledged: string[] };
        await db.transaction('rw', db.outbox, async () => { for (const operationId of acknowledged) await db.outbox.update(operationId, { status: 'synced' }); });
      }
      const state = await db.syncState.get(workspaceId); const pull = await fetch(`${API}/sync/pull`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Device-Id': device.deviceId }, body: JSON.stringify({ workspaceId, cursor: state?.cursor || 0 }) });
      if (!pull.ok) throw new Error(await pull.text()); const payload = await pull.json() as { operations: Parameters<typeof applyRemoteOperations>[0]; cursor: number };
      await applyRemoteOperations(payload.operations); await db.syncState.put({ workspaceId, cursor: payload.cursor, status: 'synced', updatedAt: new Date().toISOString() });
    } catch (error) { await db.syncState.put({ workspaceId, cursor: (await db.syncState.get(workspaceId))?.cursor || 0, status: 'error', lastError: error instanceof Error ? error.message : 'Sync failed', updatedAt: new Date().toISOString() }); }
    finally { active = undefined; }
  })(); return active;
}
export function enableAutoSync(workspaceId: string) { const run = () => void syncWorkspace(workspaceId); window.addEventListener('online', run); run(); const timer = window.setInterval(run, 45_000); return () => { window.removeEventListener('online', run); clearInterval(timer); }; }

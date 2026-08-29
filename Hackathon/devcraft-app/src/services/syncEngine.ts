// src/services/syncEngine.ts
import { db } from '../db/db';
import type { Operation, Order } from '../types/order';
import { v4 as uuidv4 } from 'uuid';

const syncChannel = new BroadcastChannel('devcraft_sync_bus');

export async function applyRemoteOperations(remoteOps: Operation[]): Promise<void> {
  if (!remoteOps || remoteOps.length === 0) return;

  const sortedOps = [...remoteOps].sort((a, b) => {
    if (a.lamport_clock !== b.lamport_clock) {
      return a.lamport_clock - b.lamport_clock;
    }
    return a.client_id.localeCompare(b.client_id);
  });

  await db.transaction('rw', [db.orders, db.op_log, db.conflicts], async () => {
    for (const op of sortedOps) {
      const existingOp = await db.op_log.get(op.op_id);
      if (existingOp) continue;

      await db.op_log.add(op);

      const localOrder = await db.orders.get(op.order_id);

      if (!localOrder) {
        if (op.field === 'FULL_RECORD' && op.value) {
          await db.orders.put(op.value as Order);
        }
        continue;
      }

      if (op.field === 'FULL_RECORD') {
        const incoming = op.value as Order;

        if (localOrder.updated_at !== incoming.updated_at && localOrder.version === incoming.version) {
          await db.conflicts.add({
            id: uuidv4(),
            order_id: op.order_id,
            field: 'full_order_concurrent_edit',
            local_value: localOrder,
            remote_value: incoming,
            resolved: false,
            created_at: new Date().toISOString()
          });
        }

        const winner = incoming.updated_at >= localOrder.updated_at ? incoming : localOrder;
        await db.orders.put(winner);
      }
    }
  });
}

export function broadcastLocalMutation(op: Operation) {
  syncChannel.postMessage({ type: 'MUTATION', op });
}

export function initializeLiveSync() {
  syncChannel.onmessage = async (event) => {
    if (event.data?.type === 'MUTATION' && event.data.op) {
      await applyRemoteOperations([event.data.op]);
    }
  };
}

export async function exportLocalOperations(): Promise<Operation[]> {
  return await db.op_log.toArray();
}
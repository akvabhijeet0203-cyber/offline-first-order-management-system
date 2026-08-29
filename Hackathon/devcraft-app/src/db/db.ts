import Dexie, { type Table } from 'dexie';
import type { Conflict, DeviceState, Operation, Order, OutboxEntry, SyncState } from '../types/domain';

export class LocalOrderDatabase extends Dexie {
  orders!: Table<Order, string>;
  operations!: Table<Operation, string>;
  outbox!: Table<OutboxEntry, string>;
  syncState!: Table<SyncState, string>;
  conflicts!: Table<Conflict, string>;
  deviceState!: Table<DeviceState, string>;

  constructor() {
    super('OfflineOrderDesk');
    this.version(1).stores({
      orders: 'id, workspaceId, customer, dueDate, status, deleted, updatedAt',
      operations: 'operationId, workspaceId, orderId, deviceId, lamportClock, createdAt',
      outbox: 'operationId, status', syncState: 'workspaceId, status',
      conflicts: 'id, workspaceId, orderId, resolved', deviceState: 'key'
    });
  }
}
export const db = new LocalOrderDatabase();

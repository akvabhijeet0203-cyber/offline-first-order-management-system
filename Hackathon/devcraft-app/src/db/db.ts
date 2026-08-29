// src/db/db.ts
import Dexie, { type Table } from 'dexie';
import type { Order, Operation, ConflictRecord } from '../types/order';

export class OrderDatabase extends Dexie {
  declare orders: Table<Order, string>;
  declare op_log: Table<Operation, string>;
  declare conflicts: Table<ConflictRecord, string>;

  constructor() {
    super('DevCraftOrderDB');
    this.version(1).stores({
      orders: 'id, customer, due_date, status, is_paid, updated_at',
      op_log: 'op_id, order_id, client_id, lamport_clock, timestamp',
      conflicts: 'id, order_id, resolved'
    });
  }
}

export const db = new OrderDatabase();
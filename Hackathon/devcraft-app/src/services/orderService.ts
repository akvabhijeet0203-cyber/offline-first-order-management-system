// src/services/orderService.ts
import { db } from '../db/db';
import type { Order, Operation } from '../types/order';
import { v4 as uuidv4 } from 'uuid';

export const getClientId = (): string => {
  let id = localStorage.getItem('devcraft_client_id');
  if (!id) {
    id = 'client_' + uuidv4().slice(0, 8);
    localStorage.setItem('devcraft_client_id', id);
  }
  return id;
};

export const getLamportClock = (): number => {
  const c = parseInt(localStorage.getItem('devcraft_lamport') || '0', 10);
  const next = c + 1;
  localStorage.setItem('devcraft_lamport', next.toString());
  return next;
};

export async function createOrUpdateOrder(orderData: Partial<Order> & { id: string }): Promise<void> {
  const now = new Date().toISOString();
  const clientId = getClientId();
  const clock = getLamportClock();

  await db.transaction('rw', [db.orders, db.op_log], async () => {
    const existing = await db.orders.get(orderData.id);
    const updated: Order = {
      id: orderData.id,
      customer: orderData.customer ?? existing?.customer ?? null,
      items: orderData.items ?? existing?.items ?? [],
      due_date: orderData.due_date ?? existing?.due_date ?? null,
      amount: orderData.amount ?? existing?.amount ?? null,
      references_prior_order: orderData.references_prior_order ?? existing?.references_prior_order ?? false,
      confidence: orderData.confidence ?? existing?.confidence ?? 1.0,
      needs_clarification: orderData.needs_clarification ?? existing?.needs_clarification ?? false,
      is_paid: orderData.is_paid ?? existing?.is_paid ?? false,
      status: orderData.status ?? existing?.status ?? 'pending',
      created_at: existing?.created_at ?? now,
      updated_at: now,
      version: (existing?.version ?? 0) + 1,
      deleted: orderData.deleted ?? existing?.deleted ?? false
    };

    await db.orders.put(updated);

    const op: Operation = {
      op_id: uuidv4(),
      order_id: orderData.id,
      client_id: clientId,
      lamport_clock: clock,
      field: 'FULL_RECORD',
      value: updated,
      timestamp: now
    };
    await db.op_log.add(op);
  });
}

export async function softDeleteOrder(id: string): Promise<void> {
  await createOrUpdateOrder({ id, deleted: true });
}

export async function ingestParsedMessage(parsedJson: any) {
  const newOrder: Order = {
    id: uuidv4(),
    customer: parsedJson.customer || null,
    items: parsedJson.items || [],
    due_date: parsedJson.due_date || null,
    amount: parsedJson.amount || null,
    references_prior_order: parsedJson.references_prior_order || false,
    confidence: parsedJson.confidence || 1.0,
    needs_clarification: parsedJson.needs_clarification || false,
    is_paid: false,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    deleted: false
  };
  await createOrUpdateOrder(newOrder);
}
import { v4 as uuid } from 'uuid';
import { db } from '../db/db';
import { mergeOrder } from './merge';
import type { DeviceState, Operation, Order, OrderItem } from '../types/domain';

export async function getDevice(): Promise<DeviceState> {
  const existing = await db.deviceState.get('current');
  if (existing) return existing;
  const device = { key: 'current' as const, deviceId: crypto.randomUUID(), deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile device' : 'Desktop browser', platform: navigator.platform || 'Web', clock: 0 };
  await db.deviceState.put(device); return device;
}
export async function createOrder(workspaceId: string, userId: string, values: { customer?: string; description?: string; quantity?: number; amount?: number; dueDate?: string }): Promise<Order> {
  const now = new Date().toISOString(), id = uuid(), item: OrderItem = { id: uuid(), description: values.description || 'New order', quantity: values.quantity || 1, attributes: {} };
  const order: Order = { id, workspaceId, customer: values.customer || null, items: [item], dueDate: values.dueDate || null, amount: values.amount ?? null, isPaid: false, status: 'pending', deleted: false, createdAt: now, updatedAt: now, fieldStamps: {}, itemTombstones: {} };
  await db.orders.put(order);
  await mutate(workspaceId, userId, id, '__create', order);
  for (const [path, value] of Object.entries({ customer: order.customer, items: order.items, dueDate: order.dueDate, amount: order.amount, isPaid: order.isPaid, status: order.status })) await mutate(workspaceId, userId, id, path, value);
  return (await db.orders.get(id))!;
}
export async function mutate(workspaceId: string, userId: string, orderId: string, path: string, value: unknown, kind: Operation['kind'] = 'set') {
  const device = await getDevice(), clock = device.clock + 1, now = new Date().toISOString();
  const operation: Operation = { operationId: uuid(), workspaceId, deviceId: device.deviceId, userId, orderId, kind, path, value, lamportClock: clock, createdAt: now };
  await db.transaction('rw', db.orders, db.operations, db.outbox, db.deviceState, async () => {
    const current = await db.orders.get(orderId); if (!current) throw new Error('Order not found locally');
    const result = mergeOrder(current, operation); await db.orders.put(result.order); await db.operations.put(operation); await db.outbox.put({ operationId: operation.operationId, operation, status: 'pending', attempts: 0 }); await db.deviceState.update('current', { clock }); if (result.conflict) await db.conflicts.put(result.conflict);
  });
  return operation;
}
export async function applyRemoteOperations(operations: Operation[]) {
  await db.transaction('rw', db.orders, db.operations, db.conflicts, db.deviceState, async () => {
    const device = await getDevice(); let maxClock = device.clock;
    for (const op of [...operations].sort((a, b) => a.lamportClock - b.lamportClock || a.deviceId.localeCompare(b.deviceId) || a.operationId.localeCompare(b.operationId))) {
      if (await db.operations.get(op.operationId)) continue;
      const current = await db.orders.get(op.orderId);
      if (!current && op.path === '__create' && op.value && typeof op.value === 'object') await db.orders.put(op.value as Order);
      else if (current) { const result = mergeOrder(current, op); await db.orders.put(result.order); if (result.conflict) await db.conflicts.put(result.conflict); }
      await db.operations.put(op); maxClock = Math.max(maxClock, op.lamportClock);
    }
    await db.deviceState.update('current', { clock: maxClock + 1 });
  });
}

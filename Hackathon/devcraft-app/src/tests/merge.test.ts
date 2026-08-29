import { describe, expect, it } from 'vitest';
import { mergeOrder } from '../services/merge';
import type { Operation, Order } from '../types/domain';
const base = (): Order => ({ id: 'o', workspaceId: 'w', customer: null, items: [{ id: 'i', description: 'kurta', quantity: 2, attributes: {} }], dueDate: null, amount: 1200, isPaid: false, status: 'pending', deleted: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', fieldStamps: {}, itemTombstones: {} });
const op = (deviceId: string, clock: number, path: string, value: unknown, kind: Operation['kind'] = 'set'): Operation => ({ operationId: `${deviceId}${clock}`.padEnd(36, '0'), workspaceId: 'w', deviceId, userId: 'u', orderId: 'o', kind, path, value, lamportClock: clock, createdAt: '2026-01-02T00:00:00.000Z' });
describe('conflict convergence', () => {
  it('keeps disjoint fields', () => { let state = mergeOrder(base(), op('a', 1, 'dueDate', '2026-09-08')).order; state = mergeOrder(state, op('b', 1, 'amount', 1500)).order; expect(state).toMatchObject({ dueDate: '2026-09-08', amount: 1500 }); });
  it('converges same-field edits in reverse order', () => { const a = op('a', 3, 'amount', 1300), b = op('b', 3, 'amount', 1500); const left = mergeOrder(mergeOrder(base(), a).order, b).order; const right = mergeOrder(mergeOrder(base(), b).order, a).order; expect(left.amount).toBe(right.amount); });
  it('tombstones deleted items and records concurrent updates', () => { const removed = mergeOrder(base(), op('a', 2, 'items.i', null, 'delete_item')).order; const result = mergeOrder(removed, op('b', 3, 'items.i.quantity', 4)); expect(result.order.items).toHaveLength(0); expect(result.conflict).toBeTruthy(); });
});

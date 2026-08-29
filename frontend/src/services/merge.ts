import { v4 as uuid } from 'uuid';
import type { Conflict, Operation, Order, Stamp } from '../types/domain';

export const stampOf = (op: Operation): Stamp => ({ clock: op.lamportClock, deviceId: op.deviceId, operationId: op.operationId });
export const compareStamp = (a: Stamp, b: Stamp) => a.clock - b.clock || a.deviceId.localeCompare(b.deviceId) || a.operationId.localeCompare(b.operationId);
function makeConflict(order: Order, winner: Operation, loser: Operation): Conflict { return { id: uuid(), workspaceId: order.workspaceId, orderId: order.id, path: loser.path, winner, loser, createdAt: new Date().toISOString(), resolved: false }; }
function setPath(target: Record<string, unknown>, path: string, value: unknown) { const parts = path.split('.'); let point = target; for (const part of parts.slice(0, -1)) point = (point[part] as Record<string, unknown>) || (point[part] = {} as never); point[parts.at(-1)!] = value; }
function currentValue(target: Record<string, unknown>, path: string): unknown { return path.split('.').reduce<unknown>((v, p) => v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined, target); }

export function mergeOrder(order: Order, incoming: Operation): { order: Order; conflict?: Conflict } {
  const next = structuredClone(order), stamp = stampOf(incoming), itemId = incoming.path.match(/^items\.([^.]*)/)?.[1];
  if (incoming.path === '__create') return { order: next };
  if (next.deleted && incoming.kind !== 'delete_order') return { order: next, conflict: makeConflict(next, { ...incoming, value: 'order tombstone' }, incoming) };
  if (incoming.kind === 'delete_order') { const old = next.fieldStamps.__deleted; if (!old || compareStamp(stamp, old) > 0) { next.deleted = true; next.fieldStamps.__deleted = stamp; } return { order: next }; }
  if (itemId && next.itemTombstones[itemId]) return { order: next, conflict: makeConflict(next, { ...incoming, value: 'item tombstone' }, incoming) };
  if (incoming.kind === 'delete_item' && itemId) { const old = next.itemTombstones[itemId]; if (!old || compareStamp(stamp, old) > 0) { next.items = next.items.filter(i => i.id !== itemId); next.itemTombstones[itemId] = stamp; } return { order: next }; }
  const old = next.fieldStamps[incoming.path];
  if (!old || compareStamp(stamp, old) > 0) { const conflict = old ? makeConflict(next, incoming, { ...incoming, operationId: old.operationId, deviceId: old.deviceId, lamportClock: old.clock, value: currentValue(order as unknown as Record<string, unknown>, incoming.path) }) : undefined; setPath(next as unknown as Record<string, unknown>, incoming.path, incoming.value); next.fieldStamps[incoming.path] = stamp; next.updatedAt = incoming.createdAt; return { order: next, conflict }; }
  return { order: next, conflict: makeConflict(next, { ...incoming, operationId: old.operationId, deviceId: old.deviceId, lamportClock: old.clock, value: currentValue(order as unknown as Record<string, unknown>, incoming.path) }, incoming) };
}

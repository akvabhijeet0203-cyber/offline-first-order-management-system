export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type OperationKind = 'set' | 'delete_order' | 'delete_item';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';
export interface OrderItem { id: string; description: string; quantity: number; attributes: Record<string, string | number | boolean>; }
export interface Stamp { clock: number; deviceId: string; operationId: string; }
export interface Order { id: string; workspaceId: string; customer: string | null; items: OrderItem[]; dueDate: string | null; amount: number | null; isPaid: boolean; status: OrderStatus; deleted: boolean; createdAt: string; updatedAt: string; fieldStamps: Record<string, Stamp>; itemTombstones: Record<string, Stamp>; }
export interface Operation { operationId: string; workspaceId: string; deviceId: string; userId: string; orderId: string; kind: OperationKind; path: string; value: unknown; lamportClock: number; createdAt: string; }
export interface OutboxEntry { operationId: string; operation: Operation; status: SyncStatus; attempts: number; lastError?: string; }
export interface SyncState { workspaceId: string; cursor: number; status: SyncStatus; lastError?: string; updatedAt: string; }
export interface Conflict { id: string; workspaceId: string; orderId: string; path: string; winner: Operation; loser: Operation; createdAt: string; resolved: boolean; }
export interface DeviceState { key: 'current'; deviceId: string; deviceName: string; platform: string; clock: number; }
export interface ParsedOrder { customer: string | null; items: OrderItem[]; dueDate: string | null; amount: number | null; referencesPriorOrder: boolean; confidence: number; needsClarification: boolean; }

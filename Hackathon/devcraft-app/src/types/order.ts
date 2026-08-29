// src/types/order.ts
export interface OrderItem {
  description: string;
  quantity: number;
  attributes: Record<string, string | number>;
}

export interface Order {
  id: string;
  customer: string | null;
  items: OrderItem[];
  due_date: string | null;
  amount: number | null;
  references_prior_order: boolean;
  confidence: number;
  needs_clarification: boolean;
  is_paid: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  version: number;
  deleted?: boolean;
}

export interface Operation {
  op_id: string;
  order_id: string;
  client_id: string;
  lamport_clock: number;
  field: keyof Order | 'FULL_RECORD';
  value: any;
  timestamp: string;
}

export interface ConflictRecord {
  id: string;
  order_id: string;
  field: string;
  local_value: any;
  remote_value: any;
  resolved: boolean;
  created_at: string;
}
import { v4 as uuid } from 'uuid';
import type { ParsedOrder } from '../types/domain';
export function parseLocally(message: string): ParsedOrder {
  const text = message.trim(), lower = text.toLowerCase(); const quantity = Number(lower.match(/\b(\d+)\b/)?.[1] || 1);
  const amount = Number(lower.match(/(?:₹|rs\.?|rupees?)\s*(\d+)/i)?.[1]) || null;
  const name = text.match(/(?:for|ke liye)\s+([A-Za-z]+)/i)?.[1] || null;
  const dueDate = lower.includes('parso') ? new Date(Date.now() + 172800000).toISOString().slice(0, 10) : lower.includes('kal') ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) : null;
  return { customer: name, items: text ? [{ id: uuid(), description: text.replace(/\b\d+\b/g, '').trim() || 'Order', quantity, attributes: {} }] : [], dueDate, amount, needsClarification: !text };
}
export async function parseOrder(message: string): Promise<ParsedOrder> {
  if (!navigator.onLine) return parseLocally(message);
  try { const response = await fetch('/api/parse-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }); if (response.ok) return await response.json() as ParsedOrder; } catch { /* local parser is intentionally independent */ }
  return parseLocally(message);
}

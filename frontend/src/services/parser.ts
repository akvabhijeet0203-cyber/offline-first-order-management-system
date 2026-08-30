import { v4 as uuid } from 'uuid';
import type { ParsedOrder } from '../types/domain';
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const isoDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (name: string) => parts.find(part => part.type === name)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const customerFrom = (text: string) => {
  const correction = text.match(/([\p{L}]+)\s+ke\s+liye\s+nahi\s*,?\s*([\p{L}]+)\s+ke\s+liye/iu);
  if (correction) return correction[2];
  return text.match(/(?:for|ke\s+liye)\s+([\p{L}]+)/iu)?.[1] || null;
};
const referencesPrior = (text: string) => !/pichli\s+baar\s+jaisa\s+nahi|last\s+time\s+jaisa\s+nahi/iu.test(text) && /last\s+time|pichli\s+baar|pehle\s+jaisa|same/iu.test(text);

/** Deterministic offline fallback. The model service takes over automatically when online. */
export function parseLocally(message: string, receivedAt = new Date()): ParsedOrder {
  const text = message.trim(), lower = text.toLowerCase();
  const cupcake = /cup\s*cake|cupcake/i.test(text);
  const description = cupcake ? 'cupcake' : (text.replace(/\b\d+\b/g, '').replace(/\b(aaj|kal|parso|tak|ke liye|nahi)\b/gi, '').trim() || 'Order');
  const beforeItem = cupcake ? lower.match(/\b(\d+)\s+cup\s*cake/) : lower.match(/\b(\d+)\s+[a-z]/);
  const quantity = Math.max(1, Number(beforeItem?.[1] || 1));
  const tier = cupcake ? Number(lower.match(/\b(\d+)\s*tier\b/)?.[1] || 0) : 0;
  const attributes: Record<string, string | number | boolean> = {};
  if (tier) attributes.tier = tier;
  if (cupcake && /red\s+velvet/i.test(text)) attributes.flavour = 'red velvet';
  const amount = Number(lower.match(/(?:₹|rs\.?|rupees?)\s*(\d+)/i)?.[1]) || null;
  let dueDate: string | null = null;
  if (/\baaj\b/i.test(text)) dueDate = isoDate(receivedAt);
  else if (/\bkal\b/i.test(text)) dueDate = isoDate(new Date(receivedAt.getTime() + 86_400_000));
  else if (/\bparso\b/i.test(text)) dueDate = isoDate(new Date(receivedAt.getTime() + 172_800_000));
  const items = text ? [{ id: uuid(), description, quantity, attributes }] : [];
  return { customer: customerFrom(text), items, dueDate, amount, referencesPriorOrder: referencesPrior(text), confidence: cupcake ? 1 : 0.6, needsClarification: items.length === 0 };
}

export function submissionOutput(parsed: ParsedOrder) {
  return { customer: parsed.customer, items: parsed.items.map(({ id: _id, ...item }) => item), due_date: parsed.dueDate, amount: parsed.amount, references_prior_order: parsed.referencesPriorOrder, confidence: parsed.confidence, needs_clarification: parsed.needsClarification };
}

export async function parseOrder(message: string): Promise<ParsedOrder> {
  const fallback = parseLocally(message);
  if (!navigator.onLine) return fallback;
  try {
    const response = await fetch(`${API}/api/parse-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    if (!response.ok) return fallback;
    const parsed = await response.json() as Partial<ParsedOrder>;
    return { ...fallback, ...parsed, items: (parsed.items || fallback.items).map(item => ({ ...item, id: item.id || uuid() })) };
  } catch { return fallback; }
}

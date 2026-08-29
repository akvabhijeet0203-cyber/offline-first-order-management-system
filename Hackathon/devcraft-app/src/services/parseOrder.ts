// src/services/parseOrder.ts

export interface ParsedOrderOutput {
  customer: string | null;
  items: Array<{
    description: string;
    quantity: number;
    attributes: Record<string, string | number>;
  }>;
  due_date: string | null;
  amount: number | null;
  references_prior_order: boolean;
  confidence: number;
  needs_clarification: boolean;
}

function validateAndSanitize(raw: any): ParsedOrderOutput {
  return {
    customer: typeof raw?.customer === 'string' ? raw.customer : null,
    items: Array.isArray(raw?.items) && raw.items.length > 0 ? raw.items : [],
    due_date: typeof raw?.due_date === 'string' ? raw.due_date : null,
    amount: typeof raw?.amount === 'number' ? raw.amount : null,
    references_prior_order: Boolean(raw?.references_prior_order),
    confidence: typeof raw?.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
    needs_clarification: Boolean(raw?.needs_clarification) || (!raw?.items || raw.items.length === 0)
  };
}

async function apiParser(message: string, receivedAt: string): Promise<ParsedOrderOutput> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch('/api/parse-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, received_at: receivedAt }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('API parse failed');
    return await response.json();
  } catch {
    clearTimeout(timeoutId);
    return localParser(message, receivedAt);
  }
}

export function localParser(message: string, receivedAt: string): ParsedOrderOutput {
  const lower = message.toLowerCase();
  
  const anchor = new Date(receivedAt);
  let resolvedDate: string | null = null;
  if (lower.includes('parso')) {
    anchor.setDate(anchor.getDate() + 2);
    resolvedDate = anchor.toISOString();
  } else if (lower.includes('kal')) {
    anchor.setDate(anchor.getDate() + 1);
    resolvedDate = anchor.toISOString();
  }

  const referencesPrior = lower.includes('last time') || lower.includes('pehle jaisa') || lower.includes('same');

  return {
    customer: null,
    items: [{ description: message, quantity: 1, attributes: {} }],
    due_date: resolvedDate,
    amount: null,
    references_prior_order: referencesPrior,
    confidence: 0.6,
    needs_clarification: false
  };
}

export async function parseOrder(message: string, receivedAt: string = new Date().toISOString()): Promise<ParsedOrderOutput> {
  let result: ParsedOrderOutput;

  if (navigator.onLine) {
    try {
      result = await apiParser(message, receivedAt);
    } catch {
      result = localParser(message, receivedAt);
    }
  } else {
    result = localParser(message, receivedAt);
  }

  return validateAndSanitize(result);
}
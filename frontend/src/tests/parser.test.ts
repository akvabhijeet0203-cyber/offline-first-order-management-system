import { describe, expect, it } from 'vitest';
import { parseLocally, submissionOutput } from '../services/parser';

describe('Hinglish parser fallback', () => {
  it('handles a negated customer, cupcake tier, flavour, and aaj', () => {
    const parsed = parseLocally('Rakesh ke liye nahi, Priya ke liye cup cake 2 tier red velvet. aaj tak', new Date('2026-10-09T11:05:00+05:30'));
    expect(submissionOutput(parsed)).toEqual({
      customer: 'Priya', items: [{ description: 'cupcake', quantity: 1, attributes: { tier: 2, flavour: 'red velvet' } }],
      due_date: '2026-10-09', amount: null, references_prior_order: false, confidence: 1, needs_clarification: false,
    });
  });
});

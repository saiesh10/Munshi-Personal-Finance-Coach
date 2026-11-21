/**
 * @file app/api/parse/route.js
 * Parses SMS messages or CSV bank statements into standard Transactions.
 */

import { z } from 'zod';
import { parseJsonBody, errorResponse, jsonResponse } from '@/lib/api-helper';
import { parseInputText } from '@/lib/engine/parser';
import { parseCsv } from '@/lib/engine/csv';
import { parseUnreadableSmsLines } from '@/lib/engine/ai';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

const ParseSchema = z.object({
  text: z.string().optional(),
  csv: z.string().optional()
});

export async function POST(req) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return errorResponse(parsedBody.error, parsedBody.status);
  }

  const validation = ParseSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0]?.message || 'Invalid request body', 400);
  }

  const { text, csv } = validation.data;
  if (!text && !csv) {
    return errorResponse('Either text or csv field must be provided', 400);
  }

  try {
    const allTransactions = [];
    const allUnparsed = [];
    const seenIds = new Set();

    if (csv && csv.trim()) {
      const csvResult = parseCsv(csv);
      for (const t of csvResult.transactions) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          allTransactions.push(t);
        }
      }
      allUnparsed.push(...csvResult.unparsed);
    }

    if (text && text.trim()) {
      const textResult = await parseInputText(text, parseUnreadableSmsLines);
      for (const t of textResult.transactions) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          allTransactions.push(t);
        }
      }
      allUnparsed.push(...textResult.unparsed);
    }

    return jsonResponse({
      transactions: allTransactions,
      unparsed: allUnparsed
    });
  } catch (err) {
    return errorResponse('Failed to parse input: ' + err.message, 500);
  }
}

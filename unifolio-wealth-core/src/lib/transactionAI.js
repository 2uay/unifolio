// Rule-based natural language parser for transaction corrections.
// No external API — all parsing is local regex + keyword matching.

const INSTITUTION_MAP = {
  'wealthsimple': 'wealthsimple', 'ws': 'wealthsimple', 'ws tfsa': 'wealthsimple',
  'questrade': 'questrade', 'qt': 'questrade',
  'interactive brokers': 'interactive-brokers', 'ibkr': 'interactive-brokers',
  'ib': 'interactive-brokers', 'td': 'td', 'td direct': 'td',
  'rbc': 'rbc', 'royal bank': 'rbc',
  'schwab': 'schwab', 'charles schwab': 'schwab',
  'chase': 'chase', 'robinhood': 'robinhood',
  'fidelity': 'fidelity', 'vanguard': 'vanguard',
};

const ACCOUNT_TYPE_MAP = {
  'tfsa': 'TFSA', 'rrsp': 'RRSP', 'fhsa': 'FHSA', 'resp': 'RESP',
  'cash': 'Cash', 'margin': 'Margin', 'ira': 'IRA', 'roth': 'Roth IRA',
  '401k': '401(k)',
};

const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function normalizeInstitution(text) {
  const lower = text.toLowerCase().trim();
  return INSTITUTION_MAP[lower] || lower;
}

function parseDate(text) {
  if (!text) return null;
  // ISO format: 2024-03-15
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2,'0')}-${isoMatch[3].padStart(2,'0')}`;

  // "Mar 3" / "March 3" / "Mar 3 2024"
  const monthDay = text.match(/([a-zA-Z]+)\s+(\d{1,2})(?:\s+(\d{4}))?/);
  if (monthDay) {
    const month = MONTH_MAP[monthDay[1].toLowerCase()];
    if (month !== undefined) {
      const year = monthDay[3] || new Date().getFullYear();
      const day = parseInt(monthDay[2]);
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // "3/15" / "3/15/2024"
  const slashDate = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (slashDate) {
    const year = slashDate[3] || new Date().getFullYear();
    return `${year}-${String(parseInt(slashDate[1])).padStart(2,'0')}-${String(parseInt(slashDate[2])).padStart(2,'0')}`;
  }

  return null;
}

function extractTicker(text, knownTickers = []) {
  // Try known tickers first
  const upper = text.toUpperCase();
  for (const t of knownTickers) {
    if (upper.includes(t.toUpperCase())) return t.toUpperCase();
  }
  // Fall back to any 1-5 char uppercase word that looks like a ticker
  const caps = text.match(/\b([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\b/g);
  if (caps) {
    // Filter out common non-ticker words
    const NON_TICKERS = new Set(['FROM', 'TO', 'IN', 'OUT', 'ON', 'THE', 'AND', 'FOR', 'ADD', 'MARK', 'AS', 'MY', 'OF', 'AT', 'BY']);
    const candidates = caps.filter(c => !NON_TICKERS.has(c));
    if (candidates.length) return candidates[0];
  }
  return null;
}

function extractDateFromText(text) {
  // Try ISO pattern
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return parseDate(iso[1]);
  // Try "on <date>" pattern
  const onDate = text.match(/\bon\s+([A-Za-z]+\s+\d{1,2}(?:\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{2}-\d{2})/i);
  if (onDate) return parseDate(onDate[1]);
  // Try standalone month day
  const standalone = text.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?/);
  if (standalone && MONTH_MAP[standalone[1].toLowerCase()] !== undefined) {
    return parseDate(`${standalone[1]} ${standalone[2]}${standalone[3] ? ' ' + standalone[3] : ''}`);
  }
  return null;
}

/**
 * Parse natural language input into structured transaction patches.
 * Returns { action, patches, explanation, confidence } or null if not understood.
 */
export function parseTransactionInput(text, { accounts = [], transactions = [], knownTickers = [] } = {}) {
  const lower = text.toLowerCase();
  const patches = [];
  let explanation = '';
  let action = null;

  // ── Transfer-in / transfer-out pattern ────────────────────────────────────
  // "transferred VFV from WS to IBKR on Mar 3, add the transfer-in"
  // "add transfer in for AAPL from WS TFSA to Questrade"
  const transferMatch = lower.match(
    /(?:transferred?|transfer)\s+|add\s+(?:a\s+)?(?:transfer[\s-](?:in|out))/i
  );

  if (transferMatch || /transfer[\s-](?:in|out)/i.test(lower)) {
    const ticker = extractTicker(text, knownTickers);
    const date = extractDateFromText(text);
    const isIn = /transfer[\s-]in/i.test(lower) || /\bto\b.+\b(ibkr|questrade|wealthsimple|td|rbc|schwab|chase|fidelity)\b/i.test(lower);
    const isOut = /transfer[\s-]out/i.test(lower);

    // Extract institutions
    const fromMatch = text.match(/from\s+([^,.\n]+?)(?:\s+to\s+|\s+on\s+|$)/i);
    const toMatch = text.match(/to\s+([^,.\n]+?)(?:\s+on\s+|,|\.|$)/i);
    const fromInst = fromMatch ? normalizeInstitution(fromMatch[1].trim()) : null;
    const toInst   = toMatch   ? normalizeInstitution(toMatch[1].trim())   : null;

    // Find matching transfer-out transaction for context
    let matchedOut = null;
    if (ticker && (isIn || !isOut)) {
      matchedOut = transactions.find(tx =>
        (tx.ticker || '').toUpperCase() === (ticker || '').toUpperCase() &&
        (tx.type === 'transfer_out' || tx.type === 'position_transfer') &&
        (!date || tx.date === date)
      );
    }

    const qty = matchedOut ? (matchedOut.qty ?? matchedOut.quantity ?? 0) : null;
    const price = matchedOut ? matchedOut.price : null;
    const targetAccount = accounts.find(a => {
      const instName = (a.institution_name || a.institution_id || '').toLowerCase();
      return toInst && (instName.includes(toInst) || toInst.includes(instName.split(' ')[0]));
    });

    if (ticker || date) {
      const txType = isOut ? 'transfer_out' : 'transfer_in';
      patches.push({
        action: 'create',
        type: txType,
        ticker,
        date: date || matchedOut?.date || new Date().toISOString().slice(0, 10),
        qty: qty ?? 0,
        price: price ?? 0,
        total: qty && price ? qty * price : 0,
        currency: matchedOut?.currency || 'USD',
        account_id: targetAccount?.id || null,
        source_account_id: fromInst,
        destination_account_id: toInst,
        notes: `AI-assisted: ${txType} added from context`,
      });

      const parts = [];
      if (ticker) parts.push(`ticker **${ticker}**`);
      if (date) parts.push(`date **${date}**`);
      if (fromInst) parts.push(`from **${fromInst}**`);
      if (toInst) parts.push(`to **${toInst}**`);
      if (qty) parts.push(`qty **${qty}**`);
      explanation = `Create a **${txType}** transaction${parts.length ? ' with ' + parts.join(', ') : ''}.`;
      if (matchedOut) explanation += ` (Matched existing transfer-out on ${matchedOut.date}.)`;
      action = 'create';
    }
  }

  // ── Missing buy/sell pattern ───────────────────────────────────────────────
  // "missing AAPL buy on Jan 5 2024", "add a buy for VTI on March 3"
  else if (/(?:missing|add)\s+(?:a\s+)?(?:buy|sell)/i.test(lower)) {
    const ticker = extractTicker(text, knownTickers);
    const date = extractDateFromText(text);
    const isBuy = /buy/i.test(lower);
    const txType = isBuy ? 'buy' : 'sell';

    const qtyMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:shares?|units?|lots?)?/);
    const priceMatch = text.match(/(?:at|@|price)\s*\$?(\d+(?:\.\d+)?)/i);
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

    patches.push({
      action: 'create',
      type: txType,
      ticker,
      date: date || new Date().toISOString().slice(0, 10),
      qty,
      price,
      total: qty * price,
      currency: 'USD',
      notes: `AI-assisted: ${txType} added from context`,
    });

    explanation = `Create a **${txType}** for **${ticker || 'unknown ticker'}**${date ? ` on **${date}**` : ''}${qty ? ` qty **${qty}**` : ''}${price ? ` at **$${price}**` : ''}.`;
    action = 'create';
  }

  // ── Edit transfer context ─────────────────────────────────────────────────
  // "fix transfer for VFV — source is WS TFSA, destination is IBKR"
  else if (/(?:fix|edit|update|correct)\s+(?:the\s+)?transfer/i.test(lower)) {
    const ticker = extractTicker(text, knownTickers);
    const date = extractDateFromText(text);
    const fromMatch = text.match(/source\s+is\s+([^,.\n]+)/i) || text.match(/from\s+([^,.\n]+?)(?:\s*[,.]|$)/i);
    const toMatch   = text.match(/destination\s+is\s+([^,.\n]+)/i) || text.match(/to\s+([^,.\n]+?)(?:\s*[,.]|$)/i);

    const txToEdit = transactions.find(tx =>
      (tx.ticker || '').toUpperCase() === (ticker || '').toUpperCase() &&
      ['transfer', 'transfer_in', 'transfer_out', 'position_transfer'].includes(tx.type) &&
      (!date || tx.date === date)
    );

    if (txToEdit) {
      patches.push({
        action: 'edit',
        id: txToEdit.id,
        source_account_id: fromMatch ? normalizeInstitution(fromMatch[1].trim()) : undefined,
        destination_account_id: toMatch ? normalizeInstitution(toMatch[1].trim()) : undefined,
      });
      explanation = `Update transfer context for **${ticker || txToEdit.ticker}** (${txToEdit.type}) on ${txToEdit.date}.`;
      action = 'edit';
    } else {
      explanation = `Could not find a matching transfer transaction for **${ticker || 'unknown'}**${date ? ` on **${date}**` : ''}.`;
    }
  }

  if (!patches.length && !explanation) {
    return {
      action: null,
      patches: [],
      explanation: "I couldn't understand that. Try: *\"transferred VFV from WS to IBKR on Mar 3, add the transfer-in\"* or *\"add missing buy for AAPL on Jan 5 2024 qty 10 at $185\"*.",
      confidence: 0,
    };
  }

  return { action, patches, explanation, confidence: patches.length ? 0.85 : 0.3 };
}

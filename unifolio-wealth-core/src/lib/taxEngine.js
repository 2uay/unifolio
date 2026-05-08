// ============================================================
// Unifolio Tax Engine
// Computes capital gains, dividend income, ACB, superficial
// losses, and FX adjustments from realized positions + transactions.
// Focused on Canadian tax context (T5008, ACB, superficial loss rule).
// ============================================================

function getYear(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).getFullYear();
}

function daysBetween(d1, d2) {
  return Math.abs(new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24);
}

const REGISTERED_ACCOUNT_TYPES = ['TFSA', 'RRSP', 'FHSA', 'LIRA'];

// ─── CAPITAL GAINS ────────────────────────────────────────────

export function calcCapitalGainsByYear(realizedPositions, accounts) {
  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.id] = a; });

  const byYear = {};

  (realizedPositions || []).forEach(pos => {
    const year = getYear(pos.close_date);
    if (!year) return;

    const acc = accountMap[pos.account_id];
    const accountType = acc?.account_type ?? acc?.type ?? '';
    const isRegistered = REGISTERED_ACCOUNT_TYPES.includes(accountType);

    if (!byYear[year]) byYear[year] = { year, gains: [], losses: [], dividends: [], taxableGain: 0, sheltered: 0 };

    const gl = pos.realized_gain_loss_amount ?? (pos.total_sale_value - pos.total_cost_basis);
    const entry = {
      id: pos.id,
      ticker: pos.ticker,
      name: pos.name,
      quantity: pos.quantity,
      openDate: pos.open_date,
      closeDate: pos.close_date,
      costBasis: pos.total_cost_basis ?? 0,
      proceeds: pos.total_sale_value ?? 0,
      realizedGL: gl ?? 0,
      currency: pos.currency ?? 'USD',
      accountType,
      isRegistered,
      holdingDays: pos.holding_period_days ?? (pos.open_date && pos.close_date ? daysBetween(pos.open_date, pos.close_date) : null),
      superficialLoss: false,
    };

    if (isRegistered) {
      byYear[year].sheltered += Math.abs(gl ?? 0);
    } else {
      if ((gl ?? 0) >= 0) {
        byYear[year].gains.push(entry);
        byYear[year].taxableGain += gl ?? 0;
      } else {
        byYear[year].losses.push(entry);
        byYear[year].taxableGain += gl ?? 0;
      }
    }
  });

  return byYear;
}

// ─── DIVIDEND INCOME ──────────────────────────────────────────

export function calcDividendsByYear(transactions, accounts) {
  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.id] = a; });

  const byYear = {};

  (transactions || []).filter(t => t.transaction_type === 'Dividend' || t.transaction_type === 'Interest').forEach(t => {
    const year = getYear(t.date);
    if (!year) return;

    const acc = accountMap[t.account_id];
    const accountType = acc?.account_type ?? '';
    const isRegistered = REGISTERED_ACCOUNT_TYPES.includes(accountType);

    if (!byYear[year]) byYear[year] = { year, entries: [], total: 0, taxable: 0, sheltered: 0 };

    const amount = t.total_amount ?? 0;
    byYear[year].entries.push({
      date: t.date,
      ticker: t.ticker || '',
      type: t.transaction_type,
      amount,
      currency: t.currency ?? 'USD',
      accountType,
      isRegistered,
      notes: t.notes ?? '',
    });
    byYear[year].total += amount;
    if (isRegistered) byYear[year].sheltered += amount;
    else byYear[year].taxable += amount;
  });

  return byYear;
}

// ─── SUPERFICIAL LOSS DETECTION ───────────────────────────────

export function detectSuperficialLosses(realizedPositions, transactions) {
  const warnings = [];

  const sellTxns = (transactions || []).filter(t => t.transaction_type === 'Sell' && t.ticker);
  const buyTxns = (transactions || []).filter(t => t.transaction_type === 'Buy' && t.ticker);

  // Also use realized positions as sell events
  const sellEvents = [
    ...sellTxns.map(t => ({ ticker: t.ticker?.toUpperCase(), date: t.date, type: 'transaction' })),
    ...(realizedPositions || []).filter(r => (r.realized_gain_loss_amount ?? 0) < 0).map(r => ({ ticker: r.ticker?.toUpperCase(), date: r.close_date, type: 'realized', gl: r.realized_gain_loss_amount })),
  ];

  sellEvents.forEach(sell => {
    if (!sell.date || !sell.ticker) return;

    // Check if there was a buy of the same ticker within 30 days before or after
    const nearbyBuys = buyTxns.filter(buy =>
      buy.ticker?.toUpperCase() === sell.ticker &&
      daysBetween(sell.date, buy.date) <= 30
    );

    if (nearbyBuys.length > 0) {
      // Check if the sell was a loss
      const realizedLoss = realizedPositions?.find(r =>
        r.ticker?.toUpperCase() === sell.ticker &&
        r.close_date === sell.date &&
        (r.realized_gain_loss_amount ?? 0) < 0
      );

      if (realizedLoss) {
        warnings.push({
          ticker: sell.ticker,
          sellDate: sell.date,
          lossAmount: realizedLoss.realized_gain_loss_amount,
          nearbyBuys: nearbyBuys.map(b => ({ date: b.date, quantity: b.quantity, price: b.price })),
          message: `Sold ${sell.ticker} at a loss on ${sell.date}. Repurchased within 30 days — this may be a superficial loss under Canadian tax rules (ACB adjusted, loss deferred).`,
        });
      }
    }
  });

  return warnings;
}

// ─── ACB PER TICKER ───────────────────────────────────────────

export function calcACBByTicker(holdings, transactions) {
  const acbMap = {};

  // Seed from purchase_history in holdings
  (holdings || []).forEach(h => {
    const ticker = h.ticker?.toUpperCase();
    if (!ticker) return;
    if (!acbMap[ticker]) acbMap[ticker] = { ticker, lots: [], totalShares: 0, totalCost: 0, acb: 0 };

    (h.purchase_history || []).forEach(lot => {
      const qty = lot.qty ?? lot.quantity ?? 0;
      const price = lot.price ?? 0;
      acbMap[ticker].lots.push({ date: lot.date, qty, price, totalCost: qty * price });
      acbMap[ticker].totalShares += qty;
      acbMap[ticker].totalCost += qty * price;
    });
  });

  // Layer in buy transactions not covered by purchase_history
  (transactions || []).filter(t => t.transaction_type === 'Buy' && t.ticker).forEach(t => {
    const ticker = t.ticker.toUpperCase();
    if (!acbMap[ticker]) acbMap[ticker] = { ticker, lots: [], totalShares: 0, totalCost: 0, acb: 0 };
    // Only add if this transaction isn't already reflected in purchase_history (simple heuristic: check quantity)
    const qty = t.quantity ?? 0;
    const cost = t.total_amount ?? (qty * (t.price ?? 0));
    // Add only if not already counted (simplified — a real implementation would reconcile by date)
    if (!acbMap[ticker].lots.find(l => l.date === t.date && Math.abs(l.qty - qty) < 0.01)) {
      acbMap[ticker].lots.push({ date: t.date, qty, price: t.price ?? 0, totalCost: cost });
      acbMap[ticker].totalShares += qty;
      acbMap[ticker].totalCost += cost;
    }
  });

  // Compute ACB per share
  Object.values(acbMap).forEach(entry => {
    entry.acb = entry.totalShares > 0 ? entry.totalCost / entry.totalShares : 0;
    entry.lots = entry.lots.sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  return acbMap;
}

// ─── ANNUAL SUMMARY ───────────────────────────────────────────

export function calcTaxSummary(realizedPositions, transactions, accounts) {
  const gainsByYear = calcCapitalGainsByYear(realizedPositions, accounts);
  const dividendsByYear = calcDividendsByYear(transactions, accounts);
  const superficialWarnings = detectSuperficialLosses(realizedPositions, transactions);

  // Get union of all years
  const years = [...new Set([...Object.keys(gainsByYear), ...Object.keys(dividendsByYear)])].map(Number).sort((a, b) => b - a);

  return years.map(year => {
    const gains = gainsByYear[year] || { gains: [], losses: [], taxableGain: 0, sheltered: 0 };
    const divs = dividendsByYear[year] || { entries: [], taxable: 0, sheltered: 0 };
    const netTaxableGain = gains.taxableGain;
    const taxableInclusion = netTaxableGain > 0 ? netTaxableGain * 0.5 : 0; // Canada: 50% inclusion rate

    return {
      year,
      netTaxableGain,
      taxableInclusion,
      taxableGains: gains.gains,
      taxableLosses: gains.losses,
      shelteredAmount: gains.sheltered,
      dividendIncome: divs.taxable,
      dividendSheltered: divs.sheltered,
      dividendEntries: divs.entries,
      superficialWarnings: superficialWarnings.filter(w => getYear(w.sellDate) === year),
    };
  });
}

// ─── CSV EXPORT ───────────────────────────────────────────────

export function exportT5008CSV(realizedPositions, accounts) {
  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.id] = a; });

  const lines = [
    'Box 20 (Proceeds),Box 21 (Cost),Box 30 (Gain/Loss),Security,Quantity,Currency,Account Type,Settlement Date',
    ...(realizedPositions || []).map(pos => {
      const acc = accountMap[pos.account_id];
      const accountType = acc?.account_type ?? '';
      return [
        pos.total_sale_value ?? '',
        pos.total_cost_basis ?? '',
        pos.realized_gain_loss_amount ?? '',
        pos.ticker ?? '',
        pos.quantity ?? '',
        pos.currency ?? '',
        accountType,
        pos.close_date ?? '',
      ].join(',');
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unifolio-t5008-${new Date().getFullYear()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

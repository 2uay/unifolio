// ============================================================
// Unifolio Export Engine
// All data export functions — CSV, JSON backup
// ============================================================

function escapeCSV(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCSV(headers, rows) {
  const lines = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ];
  return lines.join('\n');
}

function triggerDownload(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── HOLDINGS CSV ─────────────────────────────────────────────

export function exportHoldingsCSV(enrichedHoldings, accounts, institutions) {
  const headers = [
    'Ticker', 'Name', 'Asset Class', 'Quantity', 'Avg Price', 'Current Price',
    'Market Value', 'Cost Basis', 'Unrealized Gain', 'Unrealized %',
    'Daily P&L', 'Realized Gain', '% Portfolio', 'Currency',
    'Account', 'Account Type', 'Institution', 'Sector', 'Country', 'Exchange',
  ];

  const rows = (enrichedHoldings || []).map(h => {
    const acc = (accounts || []).find(a => (a.id === h.account_id || a.id === h.accountId));
    const inst = (institutions || []).find(i => i.id === acc?.institution_id);
    const qty = h.position ?? h.quantity ?? 0;
    const lp = h.lastPrice ?? h.current_price ?? 0;
    const avg = h.average_price ?? h.avgPrice ?? 0;
    const mv = lp * qty;
    const cb = avg * qty;
    const unreal = mv - cb;
    const unrealPct = cb > 0 ? (unreal / cb * 100).toFixed(2) : '';
    const pctPf = h._portfolioWeight != null ? (h._portfolioWeight * 100).toFixed(2) : '';

    return [
      h.ticker, h.name, h.asset_class ?? h.assetClass ?? '', qty, avg.toFixed(4), lp.toFixed(4),
      mv.toFixed(2), cb.toFixed(2), unreal.toFixed(2), unrealPct ? unrealPct + '%' : '',
      (h.dailyPnl ?? 0).toFixed(2), (h.realized_gain_loss_amount ?? 0).toFixed(2),
      pctPf ? pctPf + '%' : '', h.currency ?? '',
      acc?.account_name ?? acc?.name ?? '', acc?.account_type ?? '',
      inst?.name ?? '', h.sector ?? '', h.country ?? '', h.exchange ?? '',
    ];
  });

  const csv = buildCSV(headers, rows);
  triggerDownload(csv, `unifolio-holdings-${today()}.csv`);
}

// ─── TRANSACTIONS CSV ─────────────────────────────────────────

export function exportTransactionsCSV(transactions, accounts) {
  const headers = [
    'Date', 'Type', 'Ticker', 'Asset Name', 'Quantity', 'Price',
    'Gross Amount', 'Fees', 'Net Amount', 'Currency',
    'Account', 'Account Type', 'Notes',
  ];

  const rows = (transactions || []).map(t => {
    const acc = (accounts || []).find(a => a.id === t.account_id);
    return [
      t.date, t.transaction_type ?? t.type ?? '', t.ticker ?? '', t.asset_name ?? t.name ?? '',
      t.quantity ?? '', t.price ?? '',
      t.total_amount ?? t.gross_amount ?? '', t.fees ?? '',
      t.net_amount ?? t.total_amount ?? '', t.currency ?? '',
      acc?.account_name ?? acc?.name ?? '', acc?.account_type ?? '',
      t.notes ?? '',
    ];
  });

  const csv = buildCSV(headers, rows);
  triggerDownload(csv, `unifolio-transactions-${today()}.csv`);
}

// ─── REALIZED GAINS CSV ───────────────────────────────────────

export function exportRealizedGainsCSV(realizedPositions) {
  const headers = [
    'Ticker', 'Asset Name', 'Open Date', 'Close Date', 'Quantity',
    'Avg Cost', 'Close Price', 'Cost Basis', 'Proceeds',
    'Realized Gain/Loss', 'Realized %', 'Currency', 'Account',
  ];

  const rows = (realizedPositions || []).map(r => {
    const cb = (r.avg_cost ?? r.avgCost ?? 0) * (r.quantity ?? 1);
    const proceeds = (r.close_price ?? r.closePrice ?? 0) * (r.quantity ?? 1);
    const gl = proceeds - cb;
    const glPct = cb > 0 ? (gl / cb * 100).toFixed(2) + '%' : '';
    return [
      r.ticker, r.name ?? '', r.open_date ?? r.openDate ?? '',
      r.close_date ?? r.closeDate ?? '', r.quantity ?? '',
      r.avg_cost ?? r.avgCost ?? '', r.close_price ?? r.closePrice ?? '',
      cb.toFixed(2), proceeds.toFixed(2), gl.toFixed(2), glPct,
      r.currency ?? '', r.account ?? '',
    ];
  });

  const csv = buildCSV(headers, rows);
  triggerDownload(csv, `unifolio-realized-gains-${today()}.csv`);
}

// ─── FULL JSON BACKUP ─────────────────────────────────────────

export function exportFullBackupJSON(data = {}) {
  const backup = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0',
    source: 'Unifolio',
    description: 'Full portfolio backup — accounts, holdings, transactions, watchlist, settings.',
    ...data,
  };
  const json = JSON.stringify(backup, null, 2);
  triggerDownload(json, `unifolio-backup-${today()}.json`, 'application/json');
}

// ─── FILTERED VIEW CSV (from Holdings page) ───────────────────

export function exportFilteredHoldingsCSV(displayHoldings, convert, displayCurrency) {
  const headers = [
    'Ticker', 'Name', 'Quantity', 'Price', 'Market Value',
    'Unrealized Gain', 'Unrealized %', 'Daily P&L', 'Realized Gain',
    '% Portfolio', 'Currency', 'Account', 'Sector', 'Country',
  ];

  const rows = (displayHoldings || []).map(h => {
    const qty = h.position ?? h.quantity ?? 0;
    const lp = h.lastPrice ?? 0;
    const mv = lp * qty;
    const unreal = h.unrealized_gain_loss_amount ?? h.unrealizedAmt ?? (mv - (h.average_price ?? h.avgPrice ?? 0) * qty);
    const unrealPct = h.unrealized_gain_loss_percent ?? h.unrealizedPct ?? 0;
    const pctPf = h._portfolioWeight != null ? (h._portfolioWeight * 100).toFixed(2) + '%' : '';
    return [
      h.ticker, h.name ?? '', qty, lp.toFixed(4), mv.toFixed(2),
      unreal.toFixed(2), unrealPct.toFixed(2) + '%',
      (h.dailyPnl ?? 0).toFixed(2), (h.realized_gain_loss_amount ?? 0).toFixed(2),
      pctPf, h.currency ?? '', h._accountLabel ?? h.account ?? '',
      h.sector ?? '', h.country ?? '',
    ];
  });

  const csv = buildCSV(headers, rows);
  triggerDownload(csv, `unifolio-holdings-view-${today()}.csv`);
}

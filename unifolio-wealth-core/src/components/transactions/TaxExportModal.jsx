import React, { useState, useMemo } from 'react';
import { X, FileText, Download, FileSpreadsheet, Calendar, ChevronDown, Check, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { transactions, accounts, institutions, getInstitutionForAccount, getAccount, DATA_IS_SAMPLE } from '@/lib/mockData';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { useCurrency } from '@/lib/CurrencyContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

// ─── helpers ─────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

const DATE_RANGE_OPTIONS = [
  { id: 'ytd',      label: 'Year-to-Date',   getRange: () => ({ start: `${CURRENT_YEAR}-01-01`, end: new Date().toISOString().slice(0, 10) }) },
  { id: 'current',  label: `${CURRENT_YEAR} (Full Year)`,  getRange: () => ({ start: `${CURRENT_YEAR}-01-01`, end: `${CURRENT_YEAR}-12-31` }) },
  { id: 'previous', label: `${CURRENT_YEAR - 1} (Previous Year)`, getRange: () => ({ start: `${CURRENT_YEAR - 1}-01-01`, end: `${CURRENT_YEAR - 1}-12-31` }) },
  { id: 'custom',   label: 'Custom Range',   getRange: null },
];

const connectedInsts = institutions.filter(i => (i.connection_status ?? i.status) === 'connected');

function buildAccountOptions() {
  const groups = [
    { id: '__all__', label: 'All Accounts' },
    ...connectedInsts.map(i => ({ id: 'inst_' + i.id, label: `All ${i.name}` })),
    ...[...new Set(accounts.map(a => a.account_type))].map(t => ({ id: 'type_' + t, label: `All ${t}` })),
  ];
  const individuals = accounts.map(acc => {
    const inst = connectedInsts.find(i => i.id === acc.institution_id);
    return inst ? { id: acc.id, label: `${inst.name.split(' ')[0]} ${acc.account_type}` } : null;
  }).filter(Boolean);
  return { groups, individuals };
}

function resolveAccountIds(selectedAccounts) {
  if (selectedAccounts.includes('__all__')) return accounts.map(a => a.id);
  return accounts.filter(acc => {
    if (selectedAccounts.includes(acc.id)) return true;
    if (selectedAccounts.includes('inst_' + acc.institution_id)) return true;
    if (selectedAccounts.includes('type_' + acc.account_type)) return true;
    return false;
  }).map(a => a.id);
}

function filterTransactions(dateRange, customStart, customEnd, accountIds) {
  const range = dateRange.id === 'custom'
    ? { start: customStart, end: customEnd }
    : dateRange.getRange();

  return transactions.filter(t => {
    const inDate = (!range.start || t.date >= range.start) && (!range.end || t.date <= range.end);
    const inAccount = accountIds.includes(t.account_id);
    return inDate && inAccount;
  });
}

function buildRows(txns) {
  const FX_CAD_USD = 0.7246;
  return txns.map(t => {
    const acc = getAccount(t.account_id);
    const inst = getInstitutionForAccount(t.account_id);
    const feeAmt = t.fees ?? 0;
    const gross = t.total_amount ?? 0;
    const net = gross - feeAmt;
    const cur = t.currency || 'USD';
    const fxRate = cur === 'CAD' ? 1 / FX_CAD_USD : FX_CAD_USD;
    const cadEq = cur === 'CAD' ? gross : gross / FX_CAD_USD;
    const usdEq = cur === 'USD' ? gross : gross * FX_CAD_USD;
    const type = t.transaction_type ?? '';
    const isSell = type.toLowerCase() === 'sell';
    const realizedGL = isSell ? gross - (t.cost_basis ?? 0) : null;

    return {
      date: t.date,
      settlement_date: '—',
      institution: inst?.name ?? '—',
      account: acc?.account_name ?? acc?.account_type ?? '—',
      account_type: acc?.account_type ?? '—',
      type,
      ticker: t.ticker || '—',
      asset_name: t.asset_name || '—',
      asset_class: t.asset_class || '—',
      quantity: t.quantity ?? 0,
      price: t.price ?? 0,
      gross_amount: gross,
      fees: feeAmt,
      net_amount: net,
      currency: cur,
      exchange_rate: cur === 'CAD' ? FX_CAD_USD : (1 / FX_CAD_USD).toFixed(4),
      cad_equivalent: cadEq,
      usd_equivalent: usdEq,
      cost_basis: t.cost_basis ?? '—',
      proceeds: isSell ? gross : '—',
      realized_gl: realizedGL,
      realized_gl_pct: '—',
      dividend_amount: type.toLowerCase() === 'dividend' ? gross : '—',
      interest_amount: type.toLowerCase() === 'interest' ? gross : '—',
      notes: t.notes || '',
      data_source: 'Unifolio',
      sample_data: DATA_IS_SAMPLE ? 'Yes' : 'No',
    };
  });
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function TaxSummary({ txns, accountIds, dateRange, customStart, customEnd }) {
  const rows = useMemo(() => buildRows(txns), [txns]);
  const totalProceeds    = rows.filter(r => r.type.toLowerCase() === 'sell').reduce((s, r) => s + r.gross_amount, 0);
  const totalCostBasis   = rows.filter(r => r.type.toLowerCase() === 'sell').reduce((s, r) => s + (typeof r.cost_basis === 'number' ? r.cost_basis : 0), 0);
  const totalDividends   = rows.filter(r => r.type.toLowerCase() === 'dividend').reduce((s, r) => s + r.gross_amount, 0);
  const totalInterest    = rows.filter(r => r.type.toLowerCase() === 'interest').reduce((s, r) => s + r.gross_amount, 0);
  const totalFees        = rows.reduce((s, r) => s + r.fees, 0);
  const netGL            = totalProceeds - totalCostBasis;
  const includedAccNames = accounts.filter(a => accountIds.includes(a.id)).map(a => a.account_type);
  const label = dateRange.id === 'custom' ? `${customStart} → ${customEnd}` : dateRange.label;

  if (rows.length === 0) return (
    <div className="rounded-lg bg-secondary/40 border border-border p-4 text-center text-xs text-muted-foreground">
      No transactions found for this selection.
    </div>
  );

  const stats = [
    { label: 'Transactions',      value: rows.length,            mono: false },
    { label: 'Total Proceeds',    value: formatCurrency(totalProceeds) },
    { label: 'Net Realized G/L',  value: formatCurrency(netGL), colored: true, v: netGL },
    { label: 'Total Dividends',   value: formatCurrency(totalDividends) },
    { label: 'Total Interest',    value: formatCurrency(totalInterest) },
    { label: 'Total Fees',        value: formatCurrency(totalFees) },
  ];

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Summary Preview</p>
        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{label}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.label} className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={cn('text-sm font-mono font-semibold',
              s.colored ? (s.v >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-foreground'
            )}>
              {s.mono === false ? s.value : s.value}
            </p>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1">
        <span className="font-medium">Accounts:</span>
        {includedAccNames.map((n, i) => (
          <span key={i} className="px-1.5 py-0.5 bg-secondary rounded text-foreground/70">{n}</span>
        ))}
      </div>
      {DATA_IS_SAMPLE && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          Using sample data — connect real accounts for accurate tax exports.
        </div>
      )}
    </div>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────

function exportCSV(txns, dateLabel, userEmail) {
  const rows = buildRows(txns);
  if (rows.length === 0) return;

  const headers = [
    'Date','Settlement Date','Institution','Account','Account Type','Type','Ticker','Asset Name',
    'Asset Class','Quantity','Price','Gross Amount','Fees','Net Amount','Currency','Exchange Rate (to CAD)',
    'CAD Equivalent','USD Equivalent','Cost Basis','Proceeds','Realized G/L','Realized G/L %',
    'Dividend Amount','Interest Amount','Notes','Data Source','Sample Data',
  ];

  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    `# Unifolio Tax Export — ${dateLabel}`,
    userEmail ? `# User: ${userEmail}` : '',
    `# Generated: ${new Date().toLocaleString()}`,
    '',
    headers.map(escape).join(','),
    ...rows.map(r => [
      r.date, r.settlement_date, r.institution, r.account, r.account_type, r.type,
      r.ticker, r.asset_name, r.asset_class, r.quantity, r.price,
      r.gross_amount, r.fees, r.net_amount, r.currency, r.exchange_rate,
      r.cad_equivalent.toFixed(2), r.usd_equivalent.toFixed(2),
      r.cost_basis, r.proceeds, r.realized_gl ?? '', r.realized_gl_pct,
      r.dividend_amount, r.interest_amount, r.notes, r.data_source, r.sample_data,
    ].map(escape).join(',')),
    '',
    `# Disclaimer: This report is for informational purposes only and should be reviewed with a qualified tax professional.`,
  ].filter(l => l !== null);

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unifolio-tax-export-${dateLabel.replace(/\s/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(txns, dateLabel, userEmail, displayCurrency) {
  const rows = buildRows(txns);
  const now = new Date().toLocaleString();

  const totalProceeds  = rows.filter(r => r.type.toLowerCase() === 'sell').reduce((s, r) => s + r.gross_amount, 0);
  const totalDividends = rows.filter(r => r.type.toLowerCase() === 'dividend').reduce((s, r) => s + r.gross_amount, 0);
  const totalInterest  = rows.filter(r => r.type.toLowerCase() === 'interest').reduce((s, r) => s + r.gross_amount, 0);
  const totalFees      = rows.reduce((s, r) => s + r.fees, 0);

  const fmt = (v) => typeof v === 'number' ? `$${v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(v ?? '—');

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.date}</td><td>${r.institution}</td><td>${r.account_type}</td>
      <td><strong>${r.type}</strong></td><td class="mono">${r.ticker}</td>
      <td class="num">${r.quantity > 0 ? r.quantity : '—'}</td>
      <td class="num">${r.price > 0 ? fmt(r.price) : '—'}</td>
      <td class="num">${fmt(r.gross_amount)}</td>
      <td class="num">${r.fees > 0 ? fmt(r.fees) : '—'}</td>
      <td class="num">${r.currency}</td>
      <td class="num">${fmt(r.cad_equivalent)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Unifolio Tax Report — ${dateLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; padding: 32px; }
  h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .meta-item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
  .meta-item .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .meta-item .val { font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 2px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  .sum-item .slabel { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .sum-item .sval { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #f1f5f9; }
  th { padding: 7px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-family: monospace; }
  .mono { font-family: monospace; font-weight: 600; }
  .disclaimer { margin-top: 28px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 9.5px; color: #92400e; line-height: 1.5; }
  .sample-badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 4px; padding: 2px 6px; font-size: 9px; font-weight: 600; margin-left: 8px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>Unifolio <span style="font-weight:300;color:#64748b">Tax Report</span>${DATA_IS_SAMPLE ? '<span class="sample-badge">SAMPLE DATA</span>' : ''}</h1>
  <p class="subtitle">${dateLabel} · Generated ${now}${userEmail ? ' · ' + userEmail : ''}</p>

  <div class="meta">
    <div class="meta-item"><div class="label">Period</div><div class="val">${dateLabel}</div></div>
    <div class="meta-item"><div class="label">Display Currency</div><div class="val">${displayCurrency}</div></div>
    <div class="meta-item"><div class="label">Transactions</div><div class="val">${rows.length}</div></div>
  </div>

  <h2>Tax Summary</h2>
  <div class="summary">
    <div class="sum-item"><div class="slabel">Total Proceeds</div><div class="sval">${fmt(totalProceeds)}</div></div>
    <div class="sum-item"><div class="slabel">Total Dividends</div><div class="sval">${fmt(totalDividends)}</div></div>
    <div class="sum-item"><div class="slabel">Total Interest</div><div class="sval">${fmt(totalInterest)}</div></div>
    <div class="sum-item"><div class="slabel">Total Fees</div><div class="sval">${fmt(totalFees)}</div></div>
  </div>

  <h2>Transaction Detail</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Institution</th><th>Acct Type</th><th>Type</th><th>Ticker</th>
        <th class="num">Qty</th><th class="num">Price</th><th class="num">Gross</th>
        <th class="num">Fees</th><th class="num">Currency</th><th class="num">CAD Equiv.</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="disclaimer">
    ⚠️ <strong>Disclaimer:</strong> This report is for informational purposes only and should be reviewed with a qualified tax professional. Unifolio does not provide tax advice. Exchange rates are indicative only.
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to open the PDF print preview.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function TaxExportModal({ onClose }) {
  const { displayCurrency } = useCurrency();
  const { user } = useAuth();

  const [dateRangeId, setDateRangeId] = useState('ytd');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState(['__all__']);
  const [accountDropOpen, setAccountDropOpen] = useState(false);

  const dateRange = DATE_RANGE_OPTIONS.find(d => d.id === dateRangeId);
  const { groups, individuals } = buildAccountOptions();
  const accountIds = resolveAccountIds(selectedAccounts);

  const filteredTxns = useMemo(() =>
    filterTransactions(dateRange, customStart, customEnd, accountIds),
    [dateRange, customStart, customEnd, accountIds]
  );

  const toggleAccount = (val) => {
    if (val === '__all__') { setSelectedAccounts(['__all__']); return; }
    if (val === '__clear__') { setSelectedAccounts([]); return; }
    setSelectedAccounts(prev => {
      const next = prev.filter(x => x !== '__all__');
      if (next.includes(val)) {
        const r = next.filter(x => x !== val);
        return r.length === 0 ? ['__all__'] : r;
      }
      return [...next, val];
    });
  };

  const acctLabel = selectedAccounts.includes('__all__') ? 'All Accounts'
    : selectedAccounts.length === 0 ? 'None selected'
    : selectedAccounts.length === 1 ? (groups.find(g => g.id === selectedAccounts[0])?.label ?? individuals.find(a => a.id === selectedAccounts[0])?.label ?? '1 selected')
    : `${selectedAccounts.length} selected`;

  const dateLabel = dateRange.id === 'custom'
    ? (customStart && customEnd ? `${customStart} to ${customEnd}` : 'Custom Range')
    : dateRange.label;

  const canExport = filteredTxns.length > 0 && accountIds.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Export for Taxes</h2>
              <p className="text-[10px] text-muted-foreground">Generate a tax-ready transaction report</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DATE_RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDateRangeId(opt.id)}
                  className={cn(
                    'text-xs px-3 py-2 rounded-lg border text-left transition-colors',
                    dateRangeId === opt.id
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {dateRangeId === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Start Date</label>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">End Date</label>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:border-primary/50" />
                </div>
              </div>
            )}
          </div>

          {/* Account Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accounts</label>
            <div className="relative">
              <button
                onClick={() => setAccountDropOpen(o => !o)}
                className={cn(
                  'w-full flex items-center justify-between text-xs px-3 py-2.5 rounded-lg border transition-colors',
                  accountDropOpen || !selectedAccounts.includes('__all__')
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-secondary text-foreground hover:border-border/80'
                )}
              >
                <span>{acctLabel}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', accountDropOpen && 'rotate-180')} />
              </button>

              {accountDropOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                    <button onClick={() => toggleAccount('__all__')} className="text-[11px] text-primary hover:underline">All</button>
                    <button onClick={() => toggleAccount('__clear__')} className="text-[11px] text-muted-foreground hover:text-foreground">Clear</button>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    <p className="px-3 pt-1.5 pb-0.5 text-[9px] uppercase tracking-widest text-muted-foreground/50">Groups</p>
                    {groups.map(g => (
                      <button key={g.id} onClick={() => toggleAccount(g.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left">
                        <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                          selectedAccounts.includes(g.id) ? 'bg-primary border-primary' : 'border-border')}>
                          {selectedAccounts.includes(g.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className={selectedAccounts.includes(g.id) ? 'text-foreground font-medium' : 'text-muted-foreground'}>{g.label}</span>
                      </button>
                    ))}
                    <p className="px-3 pt-2.5 pb-0.5 text-[9px] uppercase tracking-widest text-muted-foreground/50">Individual</p>
                    {individuals.map(a => (
                      <button key={a.id} onClick={() => toggleAccount(a.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-left">
                        <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                          selectedAccounts.includes(a.id) ? 'bg-primary border-primary' : 'border-border')}>
                          {selectedAccounts.includes(a.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className={selectedAccounts.includes(a.id) ? 'text-foreground font-medium' : 'text-muted-foreground'}>{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Preview */}
          <TaxSummary
            txns={filteredTxns}
            accountIds={accountIds}
            dateRange={dateRange}
            customStart={customStart}
            customEnd={customEnd}
          />

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70 rounded-lg bg-secondary/30 px-3 py-2.5">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>This report is for informational purposes only and should be reviewed with a qualified tax professional.</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-secondary/20 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="mr-auto">Cancel</Button>

          {!canExport && (
            <span className="text-xs text-muted-foreground">
              {accountIds.length === 0 ? 'No accounts selected' : 'No transactions in range'}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={!canExport}
            onClick={() => exportCSV(filteredTxns, dateLabel, user?.email)}
            className="gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV
          </Button>
          <Button
            size="sm"
            disabled={!canExport}
            onClick={() => exportPDF(filteredTxns, dateLabel, user?.email, displayCurrency)}
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
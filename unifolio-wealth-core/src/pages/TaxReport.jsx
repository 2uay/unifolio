import React, { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, Download,
  DollarSign, Receipt, FileText, ChevronDown, ChevronUp,
  Shield, Info,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import PlainEnglish from '@/components/shared/PlainEnglish';
import PageBenefitsDialog from '@/components/shared/PageBenefitsDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calcTaxSummary, calcACBByTicker, exportT5008CSV } from '@/lib/taxEngine';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';

const TAX_REPORT_BENEFITS = {
  title: 'Tax Report — what it does for you',
  benefits: [
    'Know exactly what taxable gain you owe before April, instead of guessing from a stack of broker PDFs.',
    'Catch superficial losses before you file — CRA would otherwise quietly add them to your ACB and you\'d never see the disallowed deduction.',
    'Export T5008-formatted CSV lines you can hand to an accountant or paste into the CRA form.',
    'See ACB per ticker across every account, so you stop overpaying tax on shares you actually bought at a higher price.',
  ],
  howToUse: [
    'Open the page after every tax year ends (or any time you want a year-to-date estimate).',
    'Reconcile the All-Time Net Gain card against the totals on your broker\'s T5008 — they should match within rounding.',
    'Check the Superficial Losses count. If it\'s >0, scroll into that year\'s section and read each warning.',
    'Click "T5008 CSV" to download the line items, then hand to your accountant or import into your tax software.',
  ],
  whatItsFor: 'Translating your trading history into the exact numbers the CRA expects on Schedule 3 (capital gains) and the dividend lines of your T1 return.',
  whoItsFor: 'Anyone with non-registered (taxable) trades during the year. If your only account is a TFSA and you never trade in non-registered accounts, you can mostly ignore this page — the TFSA/RRSP Sheltered card will just show you what you\'re saving.',
};

const CURRENT_YEAR = new Date().getFullYear();

function InfoBadge({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
      <Info className="h-3.5 w-3.5 mt-0.5 text-blue-400 flex-shrink-0" />
      <p className="text-[11px] text-blue-400">{children}</p>
    </div>
  );
}

function StatCard({ label, value, sub, plainEnglish, color, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      {plainEnglish && <PlainEnglish>{plainEnglish}</PlainEnglish>}
    </div>
  );
}

function YearSection({ data, privacyMode, realizedPositions, accounts }) {
  const [showGains, setShowGains] = useState(false);
  const [showDivs, setShowDivs] = useState(false);
  const PM = '••••••';

  const glColor = data.netTaxableGain >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-foreground">{data.year}</span>
          {data.year === CURRENT_YEAR && (
            <span className="rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary">Current Year</span>
          )}
        </div>
        <div className="flex flex-wrap gap-4 flex-1">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Capital G/L</p>
            <p className={cn('text-sm font-bold font-mono', glColor)}>
              {privacyMode ? PM : (data.netTaxableGain >= 0 ? '+' : '') + formatCurrency(data.netTaxableGain)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxable Inclusion (50%)</p>
            <p className="text-sm font-bold font-mono text-foreground">
              {privacyMode ? PM : formatCurrency(data.taxableInclusion)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dividend Income</p>
            <p className="text-sm font-bold font-mono text-blue-400">
              {privacyMode ? PM : formatCurrency(data.dividendIncome)}
            </p>
          </div>
          {data.shelteredAmount > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sheltered (TFSA/RRSP)</p>
              <p className="text-sm font-bold font-mono text-emerald-500">
                {privacyMode ? PM : formatCurrency(data.shelteredAmount)}
              </p>
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={() => exportT5008CSV(realizedPositions, accounts)}>
          <Download className="h-3 w-3" /> T5008 CSV
        </Button>
      </div>

      <div className="divide-y divide-border/20">
        {/* Capital Gains/Losses */}
        {(data.taxableGains.length > 0 || data.taxableLosses.length > 0) && (
          <div>
            <button
              type="button"
              className="flex w-full items-start justify-between px-5 py-3 hover:bg-secondary/20 transition-colors text-left"
              onClick={() => setShowGains(v => !v)}
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground">
                  Capital Gains &amp; Losses ({data.taxableGains.length + data.taxableLosses.length} positions)
                </span>
                <PlainEnglish>
                  Every share you actually sold this year. Profit lines you owe tax on; loss lines lower that tax bill.
                </PlainEnglish>
              </div>
              {showGains ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />}
            </button>
            {showGains && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-secondary/20 border-b border-border/20">
                      {['Ticker', 'Opened', 'Closed', 'Days', 'Cost Basis', 'Proceeds', 'Gain / Loss', 'Account'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.taxableGains, ...data.taxableLosses].sort((a, b) => new Date(b.closeDate) - new Date(a.closeDate)).map((pos, i) => (
                      <tr key={i} className="border-b border-border/10 hover:bg-secondary/10">
                        <td className="px-4 py-2 font-mono font-semibold">{pos.ticker}</td>
                        <td className="px-4 py-2 text-muted-foreground">{pos.openDate}</td>
                        <td className="px-4 py-2 text-muted-foreground">{pos.closeDate}</td>
                        <td className="px-4 py-2 text-muted-foreground">{pos.holdingDays ?? '—'}</td>
                        <td className="px-4 py-2 font-mono">{privacyMode ? PM : formatCurrency(pos.costBasis)}</td>
                        <td className="px-4 py-2 font-mono">{privacyMode ? PM : formatCurrency(pos.proceeds)}</td>
                        <td className="px-4 py-2">
                          <span className={cn('font-mono font-bold', pos.realizedGL >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {privacyMode ? PM : (pos.realizedGL >= 0 ? '+' : '') + formatCurrency(pos.realizedGL)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{pos.accountType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Dividends */}
        {data.dividendEntries.length > 0 && (
          <div>
            <button
              type="button"
              className="flex w-full items-start justify-between px-5 py-3 hover:bg-secondary/20 transition-colors text-left"
              onClick={() => setShowDivs(v => !v)}
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground">
                  Dividends &amp; Interest ({data.dividendEntries.length} entries)
                </span>
                <PlainEnglish>
                  Cash payouts you collected just for owning the shares. Canadian dividends get a tax credit; US dividends get a 15&ndash;25% withholding hit.
                </PlainEnglish>
              </div>
              {showDivs ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />}
            </button>
            {showDivs && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-secondary/20 border-b border-border/20">
                      {['Date', 'Type', 'Ticker', 'Amount', 'Currency', 'Account', 'Notes'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.dividendEntries.sort((a, b) => new Date(b.date) - new Date(a.date)).map((d, i) => (
                      <tr key={i} className="border-b border-border/10 hover:bg-secondary/10">
                        <td className="px-4 py-2 text-muted-foreground">{d.date}</td>
                        <td className="px-4 py-2 text-blue-400">{d.type}</td>
                        <td className="px-4 py-2 font-mono">{d.ticker || '—'}</td>
                        <td className="px-4 py-2 font-mono font-semibold">{privacyMode ? PM : formatCurrency(d.amount)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{d.currency}</td>
                        <td className="px-4 py-2 text-muted-foreground">{d.accountType}</td>
                        <td className="px-4 py-2 text-muted-foreground truncate max-w-[160px]">{d.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Superficial Loss Warnings */}
        {data.superficialWarnings.length > 0 && (
          <div className="px-5 py-3 bg-amber-500/5">
            {data.superficialWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-400">{w.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ACBTable({ privacyMode, holdings, transactions }) {
  const [open, setOpen] = useState(false);
  const PM = '••••••';
  const acbData = useMemo(() => Object.values(calcACBByTicker(holdings, transactions)).filter(e => e.totalShares > 0 && e.acb > 0), [holdings, transactions]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-start gap-2.5 px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Receipt className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">Adjusted Cost Base (ACB) by Ticker</span>
          <PlainEnglish>
            What the CRA says you really paid for each stock you own, averaged across every purchase. Use this number, not the broker&rsquo;s, when you sell.
          </PlainEnglish>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-border/30">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-secondary/20 border-b border-border/20">
                  {['Ticker', 'Total Shares', 'Total Cost', 'ACB / Share', 'Purchase Lots'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acbData.map(entry => (
                  <tr key={entry.ticker} className="border-b border-border/10 hover:bg-secondary/10">
                    <td className="px-4 py-2 font-mono font-semibold">{entry.ticker}</td>
                    <td className="px-4 py-2 font-mono">{entry.totalShares.toFixed(4)}</td>
                    <td className="px-4 py-2 font-mono">{privacyMode ? PM : formatCurrency(entry.totalCost)}</td>
                    <td className="px-4 py-2 font-mono font-semibold">{privacyMode ? PM : formatCurrency(entry.acb)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{entry.lots.length} lots</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaxReport() {
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const { accounts, transactions, holdings, realizedPositions, isEmptyPortfolio } = usePortfolioData();
  const PM = '••••••';

  const taxSummary = useMemo(() => calcTaxSummary(realizedPositions, transactions, accounts), [realizedPositions, transactions, accounts]);
  const currentYear = taxSummary.find(d => d.year === CURRENT_YEAR);

  const totalNetGL = taxSummary.reduce((s, d) => s + d.netTaxableGain, 0);
  const totalDivs = taxSummary.reduce((s, d) => s + d.dividendIncome, 0);
  const totalSheltered = taxSummary.reduce((s, d) => s + d.shelteredAmount, 0);
  const allWarnings = taxSummary.flatMap(d => d.superficialWarnings);

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Tax Report"
          description="Capital gains, dividend income, ACB tracking, and superficial loss detection."
          actions={<PageBenefitsDialog {...TAX_REPORT_BENEFITS} />}
        />
        <EmptyPortfolioState />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tax Report"
        description="Capital gains, dividend income, ACB tracking, and superficial loss detection."
        actions={<PageBenefitsDialog {...TAX_REPORT_BENEFITS} />}
      />

      <PlainEnglish>
        Everything you need to do your Canadian taxes on this year&rsquo;s trading — the gain you owe tax on, the dividends you collected, and the loss-rebuy mistakes the CRA penalizes.
      </PlainEnglish>

      <InfoBadge>
        This report is for informational purposes only and is based on your portfolio data. Consult a tax professional for filing. Canadian tax rules are applied (50% capital gains inclusion, ACB, superficial loss rule).
      </InfoBadge>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="All-Time Net Gain"
          value={privacyMode ? PM : (totalNetGL >= 0 ? '+' : '') + formatCurrency(totalNetGL)}
          sub={`${(totalNetGL * 0.5).toFixed(2)} taxable inclusion`}
          plainEnglish="The CRA only taxes half of your capital gains — that's the number on the second line."
          color={totalNetGL >= 0 ? 'text-emerald-400' : 'text-red-400'}
          icon={TrendingUp}
        />
        <StatCard
          label="Dividend Income"
          value={privacyMode ? PM : formatCurrency(totalDivs)}
          sub="Across all taxable accounts"
          plainEnglish="Cash you received from owning shares this year. Counts as income on your return."
          color="text-blue-400"
          icon={DollarSign}
        />
        <StatCard
          label="TFSA/RRSP Sheltered"
          value={privacyMode ? PM : formatCurrency(totalSheltered)}
          sub="No tax reporting required"
          plainEnglish="Gains and dividends inside your registered accounts. You owe zero tax on these — don&rsquo;t even mention them on your return."
          color="text-emerald-500"
          icon={Shield}
        />
        <StatCard
          label="Superficial Losses"
          value={allWarnings.length}
          sub={allWarnings.length > 0 ? 'Potential disallowed losses' : 'None detected'}
          plainEnglish="If you sell at a loss and rebuy the same stock within 30 days, the CRA cancels the deduction. We flag those here so you don&rsquo;t accidentally claim a loss they&rsquo;ll reject."
          color={allWarnings.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}
          icon={AlertTriangle}
        />
      </div>

      {/* ACB Section */}
      <ACBTable privacyMode={privacyMode} holdings={holdings} transactions={transactions} />

      {/* Per-year sections */}
      {taxSummary.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card/50 px-6 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No realized positions found.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Import transactions or sell positions to generate a tax report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {taxSummary.map(data => (
            <YearSection key={data.year} data={data} privacyMode={privacyMode} realizedPositions={realizedPositions} accounts={accounts} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Unifolio Tax Optimizer
// Recommends actions: asset location, loss harvesting,
// contribution sequencing. Pure functions over the same
// holdings / transactions / accounts shape used elsewhere.
// Canadian tax rules. See docs/TAX_OPTIMIZATION.md for the
// rule book and worked examples.
// ============================================================

import { safeNumber } from './safeNum.js';
import { getETFGroup } from './etfEquivalenceMap.js';

// ─── ACCOUNT TYPE TAXONOMY ────────────────────────────────────

const REGISTERED_GROWTH_ACCOUNTS = new Set(['TFSA', 'FHSA']);
const REGISTERED_DEFERRED_ACCOUNTS = new Set(['RRSP', 'LIRA', 'RESP', 'RDSP']);
const TAXABLE_ACCOUNTS = new Set(['Margin', 'Cash', 'Non-Registered', 'Corporate', 'Joint']);

function accountClass(accountType) {
  if (!accountType) return 'unknown';
  if (REGISTERED_GROWTH_ACCOUNTS.has(accountType)) return 'tfsa_like';
  if (REGISTERED_DEFERRED_ACCOUNTS.has(accountType)) return 'rrsp_like';
  if (TAXABLE_ACCOUNTS.has(accountType)) return 'taxable';
  return 'unknown';
}

// ─── INCOME PROFILE FOR A HOLDING ─────────────────────────────
// Returns: { dividendCurrency: 'USD'|'CAD'|'OTHER', estimatedYield, isFixedIncome, isGrowth }

function classifyHoldingIncome(holding, transactions = []) {
  const ticker = String(holding.ticker || '').toUpperCase();
  const accountId = holding.account_id || holding.accountId;

  // Sum dividend & interest payments received in the last ~365 days for this
  // ticker + account. Use the native-currency amount tagged on the transaction,
  // not the engine's USD-base aggregate, because we need to know which
  // *currency* the dividend was paid in to apply the treaty / withholding rule.
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const divs = transactions.filter(t => {
    const tType = String(t.transaction_type || t.type || '').toLowerCase();
    if (tType !== 'dividend' && tType !== 'interest') return false;
    const tTicker = String(t.ticker || '').toUpperCase();
    if (tTicker !== ticker) return false;
    const tAcct = t.account_id || t.accountId;
    if (accountId && tAcct && tAcct !== accountId) return false;
    const tDate = t.date ? new Date(t.date).getTime() : 0;
    return tDate >= oneYearAgo;
  });

  const annualDividend = divs.reduce((sum, t) => sum + Math.abs(safeNumber(t.total_amount ?? t.total)), 0);
  const hasInterest = divs.some(t => String(t.transaction_type || t.type || '').toLowerCase() === 'interest');

  // Dominant dividend currency. Default to listing currency.
  const currencyCounts = {};
  divs.forEach(t => {
    const c = String(t.currency || holding.listing_currency || holding.currency || 'USD').toUpperCase();
    currencyCounts[c] = (currencyCounts[c] || 0) + Math.abs(safeNumber(t.total_amount ?? t.total));
  });
  const dividendCurrency = Object.keys(currencyCounts).length > 0
    ? Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0][0]
    : String(holding.listing_currency || holding.currency || 'USD').toUpperCase();

  // Market value in native currency for the yield calc
  const qty = safeNumber(holding.quantity ?? holding.position);
  const price = safeNumber(holding.current_price ?? holding.lastPrice);
  const marketValueNative = qty * price;
  const estimatedYield = marketValueNative > 0 ? annualDividend / marketValueNative : 0;

  const assetClass = String(holding.asset_class || '').toLowerCase();
  const isFixedIncome = hasInterest
    || assetClass.includes('bond')
    || assetClass.includes('fixed')
    || /^(BND|AGG|VAB|XBB|ZAG|VSB|XSB|ZST|TIP|VTIP|TLT)/i.test(ticker);

  return {
    dividendCurrency,
    annualDividend,
    annualDividendBase: safeNumber(holding.dividends_base) || annualDividend,
    estimatedYield,
    marketValueNative,
    isFixedIncome,
    isGrowth: estimatedYield < 0.005,
  };
}

// ─── ASSET LOCATION OPPORTUNITIES ─────────────────────────────
// Core Canadian rules applied:
//   • US-source dividends in TFSA/FHSA → 15% withholding lost (no treaty
//     relief for TFSA; RRSP has it).
//   • Interest-bearing assets in non-registered → fully taxed at marginal
//     rate; shelter in TFSA/RRSP first.
//   • Canadian eligible dividends in non-registered → eligible for the
//     dividend tax credit; if held in TFSA/RRSP that credit is wasted.
//   • Pure growth (low/no dividend) → TFSA preferred (gains tax-free).
//
// Returns the top recommendations sorted by estimated annual savings.

export function calcAssetLocationOpportunities({
  holdings,
  accounts,
  transactions,
  marginalTaxRate = 0.30, // 30% default if user hasn't set it
}) {
  if (!Array.isArray(holdings) || holdings.length === 0) return [];
  if (!Array.isArray(accounts) || accounts.length === 0) return [];

  const accountMap = {};
  accounts.forEach(a => { accountMap[a.id] = a; });

  // What account *classes* does the user actually have? We can only
  // recommend moves into account types they already own.
  const ownedClasses = new Set(
    accounts
      .filter(a => a.included_in_portfolio !== false)
      .map(a => accountClass(a.account_type ?? a.type ?? ''))
      .filter(c => c !== 'unknown'),
  );
  const hasRRSP = ownedClasses.has('rrsp_like');
  const hasTFSA = ownedClasses.has('tfsa_like');
  const hasTaxable = ownedClasses.has('taxable');

  const recommendations = [];

  holdings
    .filter(h => safeNumber(h.quantity ?? h.position) > 0)
    .forEach(holding => {
      const acct = accountMap[holding.account_id ?? holding.accountId];
      if (!acct) return;
      const currentType = acct.account_type ?? acct.type ?? '';
      const currentClass = accountClass(currentType);
      if (currentClass === 'unknown') return;

      const income = classifyHoldingIncome(holding, transactions);
      const ticker = String(holding.ticker || '').toUpperCase();

      // RULE 1: US-dividend payer in TFSA/FHSA → 15% withholding wedge
      if (
        currentClass === 'tfsa_like'
        && income.dividendCurrency === 'USD'
        && income.annualDividend > 0
        && hasRRSP
      ) {
        const annualSavings = income.annualDividend * 0.15;
        if (annualSavings >= 5) {
          recommendations.push({
            id: `loc-tfsa-us-${holding.id || ticker}`,
            kind: 'asset_location',
            severity: 'high',
            ticker,
            holdingId: holding.id,
            name: holding.name || holding.asset_name || ticker,
            fromAccount: acct.account_name || currentType,
            fromAccountId: acct.id,
            toAccountType: 'RRSP',
            estimatedAnnualSavings: annualSavings,
            estimatedAnnualSavingsCurrency: income.dividendCurrency,
            rationale: `US dividend payments ($${income.annualDividend.toFixed(0)}/yr) lose 15% to non-recoverable withholding tax in a TFSA. The Canada-US tax treaty waives this withholding inside an RRSP.`,
            action: `Move ${ticker} from ${acct.account_name || currentType} → RRSP at next opportunity (e.g. on rebalance, contribution, or in-kind transfer).`,
            caveat: 'Selling and rebuying triggers capital gains if held in non-registered. In-kind transfer from TFSA to RRSP uses contribution room.',
          });
        }
      }

      // RULE 2: Interest-bearing asset in taxable → shelter it
      if (
        currentClass === 'taxable'
        && income.isFixedIncome
        && income.annualDividend > 0
        && (hasTFSA || hasRRSP)
      ) {
        const annualSavings = income.annualDividend * marginalTaxRate;
        if (annualSavings >= 5) {
          recommendations.push({
            id: `loc-tax-interest-${holding.id || ticker}`,
            kind: 'asset_location',
            severity: 'high',
            ticker,
            holdingId: holding.id,
            name: holding.name || holding.asset_name || ticker,
            fromAccount: acct.account_name || currentType,
            fromAccountId: acct.id,
            toAccountType: hasTFSA ? 'TFSA' : 'RRSP',
            estimatedAnnualSavings: annualSavings,
            estimatedAnnualSavingsCurrency: income.dividendCurrency,
            rationale: `Interest income ($${income.annualDividend.toFixed(0)}/yr) is fully taxed at your marginal rate (${(marginalTaxRate * 100).toFixed(0)}%) when held in a non-registered account. Sheltering it eliminates the tax.`,
            action: `Hold fixed-income (bonds, GICs, HISA ETFs) inside ${hasTFSA ? 'TFSA' : 'RRSP'} first; keep growth equities in non-registered to use the lower capital-gains rate.`,
            caveat: 'TFSA contribution room is needed. RRSP contribution gets a deduction at your marginal rate.',
          });
        }
      }

      // RULE 3: Canadian eligible dividend in TFSA → dividend tax credit
      // is wasted. Move to non-reg.
      if (
        currentClass === 'tfsa_like'
        && income.dividendCurrency === 'CAD'
        && income.annualDividend > 0
        && hasTaxable
        && !income.isFixedIncome
      ) {
        // Eligible Canadian dividends in non-reg are taxed at ~6–12% combined
        // federal+provincial at middle brackets after the gross-up + credit.
        // Conservatively show as "small benefit" vs. waste-credit framing.
        // We don't recommend pulling growth equities out of TFSA, so this
        // rule is mainly informational unless the holding is also clearly
        // dividend-focused (yield > 3%).
        if (income.estimatedYield >= 0.03) {
          const inferredCreditWaste = income.annualDividend * 0.18; // gross-up credit ≈ 18% of dividend
          if (inferredCreditWaste >= 25) {
            recommendations.push({
              id: `loc-tfsa-cad-${holding.id || ticker}`,
              kind: 'asset_location',
              severity: 'medium',
              ticker,
              holdingId: holding.id,
              name: holding.name || holding.asset_name || ticker,
              fromAccount: acct.account_name || currentType,
              fromAccountId: acct.id,
              toAccountType: 'Non-Registered',
              estimatedAnnualSavings: inferredCreditWaste,
              estimatedAnnualSavingsCurrency: 'CAD',
              rationale: `Canadian eligible dividends qualify for the dividend tax credit in non-registered accounts, which can make their effective rate near-zero or even negative at lower brackets. Holding them in a TFSA wastes that credit.`,
              action: `Prefer Canadian dividend stocks in non-registered; keep TFSA room for higher-growth US equities.`,
              caveat: 'Only switch if you have spare non-reg capacity and a long horizon. TFSA growth-tax-free still beats this for most users at high marginal rates.',
            });
          }
        }
      }
    });

  return recommendations.sort((a, b) => b.estimatedAnnualSavings - a.estimatedAnnualSavings);
}

// ─── LOSS HARVESTING OPPORTUNITIES ────────────────────────────
// For each holding that is currently at an unrealized loss in a non-registered
// account, propose: harvest the loss + buy a "similar but not identical"
// replacement to maintain market exposure without triggering the CRA's
// superficial-loss rule (30 days, identical property).

// Replacement candidates: ETFs in a *different* canonical group that still
// give meaningful exposure to a similar asset class. The CRA does not give
// crystal-clear guidance on "substantially identical" for ETFs tracking
// different indexes, but the practitioner consensus is that an S&P 500 fund
// (VFV) and a Total US Market fund (VUN) are NOT identical because they
// track different indexes — so swapping them is generally safe.

const REPLACEMENT_BY_GROUP = {
  'S&P 500': ['VUN', 'VUN.TO', 'XUU', 'XUU.TO', 'VFV.TO'],
  'NASDAQ 100': ['VGT', 'XLK', 'VUG', 'SCHG'],
  'Total US Market': ['VFV', 'VFV.TO', 'XUS', 'XUS.TO', 'VOO', 'ZSP', 'ZSP.TO'],
  'TSX Composite': ['XIU', 'XIU.TO', 'HXT', 'HXT.TO'],
  'S&P/TSX 60': ['XIC.TO', 'VCN.TO', 'ZCN.TO'],
  'Global Equity': ['VT', 'ACWI', 'XAW.TO', 'XEF.TO'],
  'Developed Markets': ['VT', 'ACWI', 'XEQT.TO'],
  'Emerging Markets': ['VT', 'XEQT.TO', 'VEQT.TO'],
  'Aggregate Bonds': ['VAB.TO', 'XBB.TO', 'ZAG.TO'],
  'Dividend Income': ['VDY.TO', 'XEI.TO', 'CDZ.TO'],
};

function findReplacementCandidates(ticker) {
  const group = getETFGroup(ticker);
  if (!group) return [];
  const upTicker = String(ticker).toUpperCase();
  // First try: alternate funds in a *different* canonical group that are still
  // in the same broad space. Falls through to "different group, similar
  // theme" lookup table.
  const replacements = REPLACEMENT_BY_GROUP[group.canonical] || [];
  return replacements.filter(t => t.toUpperCase() !== upTicker).slice(0, 3);
}

export function calcLossHarvestOpportunities({
  holdings,
  accounts,
  transactions,
  marginalTaxRate = 0.30,
}) {
  if (!Array.isArray(holdings) || holdings.length === 0) return [];

  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.id] = a; });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentBuysByTicker = {};
  (transactions || [])
    .filter(t => {
      const ty = String(t.transaction_type || t.type || '').toLowerCase();
      return ty === 'buy';
    })
    .forEach(t => {
      const tickr = String(t.ticker || '').toUpperCase();
      const dt = t.date ? new Date(t.date).getTime() : 0;
      if (!tickr || dt < thirtyDaysAgo) return;
      if (!recentBuysByTicker[tickr]) recentBuysByTicker[tickr] = [];
      recentBuysByTicker[tickr].push(t);
    });

  const out = [];

  holdings
    .filter(h => safeNumber(h.quantity ?? h.position) > 0)
    .forEach(h => {
      const acct = accountMap[h.account_id ?? h.accountId];
      if (!acct) return;
      const currentClass = accountClass(acct.account_type ?? acct.type ?? '');
      // Loss harvesting only helps in TAXABLE accounts (registered accounts
      // don't give a tax-deductible loss).
      if (currentClass !== 'taxable') return;

      const unrealized = safeNumber(h.unrealized_gain_loss_amount ?? h.unrealizedAmt);
      if (unrealized >= -50) return; // ignore tiny / positive
      const ticker = String(h.ticker || '').toUpperCase();
      const recentBuy = recentBuysByTicker[ticker];
      const wouldTriggerSuperficial = Boolean(recentBuy && recentBuy.length > 0);

      // 50% inclusion → tax savings ≈ |loss| * 0.5 * marginalRate
      const taxSavings = Math.abs(unrealized) * 0.5 * marginalTaxRate;
      if (taxSavings < 10) return;

      const replacements = findReplacementCandidates(ticker);

      out.push({
        id: `harvest-${h.id || ticker}`,
        kind: 'loss_harvest',
        severity: Math.abs(unrealized) > 1000 ? 'high' : 'medium',
        ticker,
        holdingId: h.id,
        name: h.name || h.asset_name || ticker,
        fromAccount: acct.account_name || acct.account_type,
        fromAccountId: acct.id,
        unrealizedLoss: unrealized,
        estimatedTaxSavings: taxSavings,
        estimatedAnnualSavings: taxSavings, // unified field for headline
        estimatedAnnualSavingsCurrency: String(h.listing_currency || h.currency || 'CAD').toUpperCase(),
        replacementCandidates: replacements,
        wouldTriggerSuperficial,
        rationale: `Realizing this $${Math.abs(unrealized).toFixed(0)} loss now lets you offset capital gains (or carry the loss back 3 years / forward indefinitely). At your ${(marginalTaxRate * 100).toFixed(0)}% marginal rate with the 50% inclusion, that's ~$${taxSavings.toFixed(0)} of tax saved.`,
        action: replacements.length > 0
          ? `Sell ${ticker}, immediately buy ${replacements.slice(0, 2).join(' or ')} to keep similar market exposure. These track different indexes, so they don't trigger the CRA's 30-day superficial-loss rule.`
          : `Sell ${ticker} to realize the loss. Wait 30 days before rebuying the same security, or buy a correlated-but-not-identical alternative.`,
        caveat: wouldTriggerSuperficial
          ? `You bought ${ticker} within the last 30 days. Selling now may trigger the superficial-loss rule — the loss would be denied and added to the ACB of the remaining shares.`
          : `Make sure the replacement is not "identical property" under CRA — different indexes are generally safe; different share classes of the same fund are not.`,
      });
    });

  return out.sort((a, b) => b.estimatedTaxSavings - a.estimatedTaxSavings);
}

// ─── CONTRIBUTION SEQUENCER ───────────────────────────────────
// Given a marginal tax rate, recommend the order in which to contribute
// to FHSA / TFSA / RRSP. Pure rule of thumb — does not have access to
// the user's CRA contribution room (not surfaced anywhere in the app yet).

export function calcContributionSequence({ marginalTaxRate = 0.30, accounts, profile = {} }) {
  const ownedTypes = new Set(
    (accounts || [])
      .filter(a => a.included_in_portfolio !== false)
      .map(a => a.account_type ?? a.type ?? ''),
  );
  const hasFHSA = ownedTypes.has('FHSA');
  const hasTFSA = ownedTypes.has('TFSA');
  const hasRRSP = ownedTypes.has('RRSP');

  const sequence = [];

  // 1. FHSA — deduction + tax-free growth + tax-free withdrawal for a home.
  // Best account that exists, if the user has it and a home-buying horizon.
  if (hasFHSA) {
    sequence.push({
      account: 'FHSA',
      priority: 1,
      annualCap: 8000,
      lifetimeCap: 40000,
      rationale: 'The FHSA is the only Canadian account with all three benefits: tax deduction on contribution, tax-free growth, and tax-free withdrawal (for a qualifying home purchase). If you might buy a home in the next 15 years, fill this first.',
      estimatedAnnualTaxBenefit: 8000 * marginalTaxRate,
    });
  }

  // 2. RRSP — deduction now, tax later. Best at high marginal rate that's
  // expected to fall in retirement.
  if (hasRRSP && marginalTaxRate >= 0.32) {
    sequence.push({
      account: 'RRSP',
      priority: hasFHSA ? 2 : 1,
      annualCap: null,
      rationale: `At your ${(marginalTaxRate * 100).toFixed(0)}% marginal rate, every $1,000 of RRSP contribution returns ~$${(1000 * marginalTaxRate).toFixed(0)} in tax refund. Use that refund to top up a TFSA for compounding leverage.`,
      estimatedAnnualTaxBenefit: 'Marginal rate × contribution amount',
    });
  }

  // 3. TFSA — preferred for lower brackets and for growth assets.
  if (hasTFSA) {
    sequence.push({
      account: 'TFSA',
      priority: sequence.length + 1,
      annualCap: 7000,
      rationale: marginalTaxRate < 0.32
        ? 'At lower marginal rates, the TFSA generally beats the RRSP — no deduction lost, growth is tax-free, withdrawals are tax-free. Fill it before RRSP.'
        : 'After RRSP and FHSA, fill TFSA — gains are tax-free for life and withdrawals never count against any government benefit clawback.',
      estimatedAnnualTaxBenefit: 'Depends on returns; long-horizon equity beats RRSP at any rate',
    });
  }

  // 4. RRSP at lower rate (after TFSA full)
  if (hasRRSP && marginalTaxRate < 0.32 && sequence.findIndex(s => s.account === 'RRSP') === -1) {
    sequence.push({
      account: 'RRSP',
      priority: sequence.length + 1,
      rationale: `At ${(marginalTaxRate * 100).toFixed(0)}% marginal rate, the RRSP deduction is less valuable than tax-free TFSA growth. Use RRSP for surplus after TFSA is full.`,
      estimatedAnnualTaxBenefit: 'Marginal rate × contribution amount',
    });
  }

  return sequence;
}

// ─── HEADLINE TOTAL ───────────────────────────────────────────

export function calcTotalProjectedSavings(opportunities = []) {
  return opportunities.reduce((sum, opp) => sum + safeNumber(opp.estimatedAnnualSavings), 0);
}

// ─── ENTRY POINT ──────────────────────────────────────────────
// Single call from the UI: returns everything the Tax Optimizer page needs.

/**
 * @param {object} input
 * @param {Array} input.holdings
 * @param {Array} input.accounts
 * @param {Array} input.transactions
 * @param {{ marginal_tax_rate?: number, province?: string }} [input.profile]
 */
export function buildTaxOptimization({ holdings, accounts, transactions, profile = {} }) {
  const rate = /** @type {{ marginal_tax_rate?: number }} */ (profile).marginal_tax_rate;
  const marginalTaxRate = typeof rate === 'number' ? rate / 100 : 0.30;

  const assetLocation = calcAssetLocationOpportunities({ holdings, accounts, transactions, marginalTaxRate });
  const lossHarvest = calcLossHarvestOpportunities({ holdings, accounts, transactions, marginalTaxRate });
  const contributionSequence = calcContributionSequence({ marginalTaxRate, accounts, profile });

  const totalProjectedSavings = calcTotalProjectedSavings([...assetLocation, ...lossHarvest]);

  return {
    marginalTaxRate,
    assetLocation,
    lossHarvest,
    contributionSequence,
    totalProjectedSavings,
    opportunityCount: assetLocation.length + lossHarvest.length,
  };
}

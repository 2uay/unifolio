// ============================================================
// Unifolio Tax Optimizer
// Recommends actions: asset location, loss harvesting,
// contribution sequencing. Pure functions over the same
// holdings / transactions / accounts shape used elsewhere.
// Canadian tax rules. See docs/TAX_OPTIMIZATION.md for the
// rule book and worked examples.
// ============================================================

import { safeNumber } from './safeNum.js';
import { getETFGroup, ETF_GROUPS } from './etfEquivalenceMap.js';
import { getEtfBasket, isKnownEtf } from './etfManifest.js';

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

// ============================================================
// SUPERFICIAL LOSS HARVESTER
// Dedicated planner. Richer than calcLossHarvestOpportunities:
//   • Computes underlying overlap between sold ETF and each candidate
//     using top-10 basket data → flags substantially-identical risk.
//   • Cross-account 30-day buy detection (spans every account the user
//     owns, not just the one holding the loss).
//   • YTD realized-gain awareness: shows how much of the harvested loss
//     offsets gains *this year* vs. becomes carryforward (worth less).
//   • Year-end urgency tier + settlement-aware "sell by" date.
//   • Markdown export for the year-end harvest list.
// ============================================================

// ─── UNDERLYING OVERLAP ───────────────────────────────────────
// Estimates the % of two ETFs' top-10 baskets that overlap by weight.
// Returns null if either ticker isn't a known ETF. Range: 0–1.
// Used to flag "same index" replacements (overlap > 0.85 = unsafe to swap
// as a loss harvest pair under CRA's "identical property" test).

export function calcUnderlyingOverlap(tickerA, tickerB) {
  const basketA = getEtfBasket(tickerA);
  const basketB = getEtfBasket(tickerB);
  if (!basketA || !basketB) return null;

  const weightsA = new Map(basketA.top10.map(({ symbol, weight }) => [String(symbol).toUpperCase(), weight / 100]));
  const weightsB = new Map(basketB.top10.map(({ symbol, weight }) => [String(symbol).toUpperCase(), weight / 100]));

  let sharedWeight = 0;
  weightsA.forEach((wA, sym) => {
    const wB = weightsB.get(sym) || 0;
    sharedWeight += Math.min(wA, wB);
  });

  // Normalize against the smaller basket's total weight to keep values in
  // [0, 1] even when basket sizes differ. A 100% match on the smaller basket
  // reads as 1.0 even if the larger basket has more diverse exposure.
  const totalA = [...weightsA.values()].reduce((s, w) => s + w, 0);
  const totalB = [...weightsB.values()].reduce((s, w) => s + w, 0);
  const denominator = Math.min(totalA, totalB);
  if (denominator <= 0) return 0;

  return sharedWeight / denominator;
}

// Returns canonical-group equivalence for two tickers (CRA "identical
// property" proxy). Two ETFs in the same ETF_GROUPS entry track the same
// underlying index → treated as identical for superficial-loss purposes.

function sameCanonicalGroup(tickerA, tickerB) {
  const groupA = getETFGroup(tickerA);
  const groupB = getETFGroup(tickerB);
  if (!groupA || !groupB) return false;
  return groupA.canonical === groupB.canonical;
}

// ─── RANKED REPLACEMENT CANDIDATES ────────────────────────────
// For a given sold ticker, returns up to N ranked replacement options.
// Each candidate carries a safety rating so the UI can color-code them.
//
//   safetyRating: 'safe' | 'caution' | 'unsafe'
//     'safe'    → different canonical group AND overlap < 0.70 (or unknown
//                 overlap with different group). Recommended.
//     'caution' → different canonical group BUT overlap 0.70–0.85. Likely
//                 fine but worth a visible note.
//     'unsafe'  → same canonical group OR overlap ≥ 0.85. Risk of CRA
//                 deeming the swap "identical property" → loss denied.

// Pool of candidate replacements per canonical group. We deliberately list
// funds in *different* canonical groups but adjacent asset classes — those
// are the safe-harbor swaps. The first group of an entry is the user's
// likely current exposure; we suggest the other groups as alternates.
const REPLACEMENT_POOL = {
  'S&P 500': [
    { ticker: 'VUN', name: 'Vanguard US Total Market (CAD)', altGroup: 'Total US Market' },
    { ticker: 'VUN.TO', name: 'Vanguard US Total Market (CAD)', altGroup: 'Total US Market' },
    { ticker: 'VTI', name: 'Vanguard US Total Market (USD)', altGroup: 'Total US Market' },
    { ticker: 'ITOT', name: 'iShares Core S&P Total US (USD)', altGroup: 'Total US Market' },
  ],
  'Total US Market': [
    { ticker: 'VFV', name: 'Vanguard S&P 500 (CAD)', altGroup: 'S&P 500' },
    { ticker: 'XUS', name: 'iShares Core S&P 500 (CAD)', altGroup: 'S&P 500' },
    { ticker: 'ZSP.TO', name: 'BMO S&P 500 (CAD)', altGroup: 'S&P 500' },
    { ticker: 'VOO', name: 'Vanguard S&P 500 (USD)', altGroup: 'S&P 500' },
  ],
  'NASDAQ 100': [
    { ticker: 'VGT', name: 'Vanguard Information Technology', altGroup: 'US growth-tilted' },
    { ticker: 'XLK', name: 'Technology Select Sector SPDR', altGroup: 'US growth-tilted' },
    { ticker: 'SCHG', name: 'Schwab US Large-Cap Growth', altGroup: 'US growth-tilted' },
  ],
  'TSX Composite': [
    { ticker: 'XIU.TO', name: 'iShares S&P/TSX 60', altGroup: 'S&P/TSX 60' },
    { ticker: 'HXT.TO', name: 'Horizons S&P/TSX 60 (swap)', altGroup: 'S&P/TSX 60' },
  ],
  'S&P/TSX 60': [
    { ticker: 'XIC.TO', name: 'iShares Core S&P/TSX Capped Composite', altGroup: 'TSX Composite' },
    { ticker: 'VCN.TO', name: 'Vanguard FTSE Canada All Cap', altGroup: 'TSX Composite' },
  ],
  'Global Equity': [
    { ticker: 'XAW.TO', name: 'iShares Core MSCI All Country World ex-Canada', altGroup: 'Developed Markets' },
    { ticker: 'VT', name: 'Vanguard Total World Stock (USD)', altGroup: 'Developed Markets' },
  ],
  'Developed Markets': [
    { ticker: 'XEQT.TO', name: 'iShares All-Equity Portfolio', altGroup: 'Global Equity' },
    { ticker: 'VEQT.TO', name: 'Vanguard All-Equity Portfolio', altGroup: 'Global Equity' },
  ],
  'Emerging Markets': [
    { ticker: 'XEC.TO', name: 'iShares Core MSCI Emerging Markets', altGroup: 'Emerging Markets' }, // same group flagged
    { ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets (USD)', altGroup: 'Emerging Markets' },
    { ticker: 'XAW.TO', name: 'iShares Core MSCI All Country World ex-Canada', altGroup: 'Global Equity' },
  ],
  'Aggregate Bonds': [
    { ticker: 'XBB.TO', name: 'iShares Core Canadian Universe Bond', altGroup: 'Aggregate Bonds' }, // same group flagged
    { ticker: 'ZAG.TO', name: 'BMO Aggregate Bond', altGroup: 'Aggregate Bonds' }, // same group flagged
    { ticker: 'VSB.TO', name: 'Vanguard Canadian Short-Term Bond', altGroup: 'Short-Term Bonds' },
  ],
  'Dividend Income': [
    { ticker: 'VDY.TO', name: 'Vanguard FTSE Canadian High Dividend Yield', altGroup: 'Dividend Income' }, // same group flagged
    { ticker: 'XEI.TO', name: 'iShares S&P/TSX Composite High Dividend', altGroup: 'Dividend Income' }, // same group flagged
    { ticker: 'XIC.TO', name: 'iShares Core S&P/TSX Capped Composite', altGroup: 'TSX Composite' },
  ],
};

export function rankReplacementCandidates(soldTicker, maxResults = 4) {
  const group = getETFGroup(soldTicker);
  if (!group) return [];
  const upSold = String(soldTicker).toUpperCase();
  const pool = REPLACEMENT_POOL[group.canonical] || [];

  const ranked = pool
    .filter(c => c.ticker.toUpperCase() !== upSold)
    .map(c => {
      const overlap = calcUnderlyingOverlap(soldTicker, c.ticker);
      const sameGroup = sameCanonicalGroup(soldTicker, c.ticker);
      let safetyRating = 'safe';
      let note = '';
      if (sameGroup) {
        safetyRating = 'unsafe';
        note = `Same canonical index (${group.canonical}). CRA may treat as identical property — swap would deny the loss.`;
      } else if (overlap !== null && overlap >= 0.85) {
        safetyRating = 'unsafe';
        note = `${Math.round(overlap * 100)}% underlying overlap. Practitioner caution: this is in "substantially identical" territory.`;
      } else if (overlap !== null && overlap >= 0.70) {
        safetyRating = 'caution';
        note = `${Math.round(overlap * 100)}% underlying overlap. Different index, but high correlation. Usually acceptable; keep a paper trail of the index difference.`;
      } else if (overlap !== null) {
        note = `${Math.round(overlap * 100)}% underlying overlap. Different index, different basket — safe-harbor swap.`;
      } else {
        note = `Different index. Overlap not measured (one ticker not in our manifest).`;
      }
      return { ...c, overlapPct: overlap, sameGroup, safetyRating, note };
    })
    .sort((a, b) => {
      const rank = { safe: 0, caution: 1, unsafe: 2 };
      if (rank[a.safetyRating] !== rank[b.safetyRating]) return rank[a.safetyRating] - rank[b.safetyRating];
      const oA = a.overlapPct ?? 0;
      const oB = b.overlapPct ?? 0;
      return oA - oB; // lower overlap first within same safety tier
    });

  return ranked.slice(0, maxResults);
}

// ─── YTD REALIZED GAINS (NON-REG ONLY) ────────────────────────
// Year-to-date realized capital gains from non-registered accounts only —
// registered-account gains are sheltered and don't matter for harvesting.

export function calcRealizedGainsYTD(realizedPositions, accounts, asOf = new Date()) {
  const taxYearStart = new Date(asOf.getFullYear(), 0, 1).getTime();
  const taxYearEnd = new Date(asOf.getFullYear(), 11, 31, 23, 59, 59).getTime();
  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.id] = a; });

  let gains = 0;
  let losses = 0;

  (realizedPositions || []).forEach(pos => {
    const close = pos.close_date ? new Date(pos.close_date).getTime() : 0;
    if (close < taxYearStart || close > taxYearEnd) return;
    const acct = accountMap[pos.account_id ?? pos.accountId];
    const klass = accountClass(acct?.account_type ?? acct?.type ?? '');
    if (klass !== 'taxable') return;
    const gl = safeNumber(pos.realized_gain_loss_amount ?? (safeNumber(pos.total_sale_value) - safeNumber(pos.total_cost_basis)));
    if (gl >= 0) gains += gl; else losses += gl;
  });

  return {
    taxYear: asOf.getFullYear(),
    realizedGains: gains,
    realizedLosses: losses,
    netRealized: gains + losses,
  };
}

// ─── TAX-YEAR URGENCY ─────────────────────────────────────────
// Returns countdown + settlement-aware "sell by" date + a tier the UI can
// use to color the headline (planning → soon → urgent → last-call).

export function calcTaxYearProgress(asOf = new Date()) {
  const year = asOf.getFullYear();
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  // Canadian + US equities are T+1 settlement since May 2024. To have the
  // trade SETTLE in the calendar year, the order must be placed by Dec 30
  // (or last business day before Dec 31). For pre-T+1 markets, fall back to
  // Dec 27. We use Dec 28 as a conservative middle ground.
  const sellBy = new Date(year, 11, 28, 16, 0, 0);
  const msUntilYearEnd = yearEnd.getTime() - asOf.getTime();
  const msUntilSellBy = sellBy.getTime() - asOf.getTime();
  const daysUntilYearEnd = Math.max(0, Math.ceil(msUntilYearEnd / (1000 * 60 * 60 * 24)));
  const daysUntilSellBy = Math.max(0, Math.ceil(msUntilSellBy / (1000 * 60 * 60 * 24)));

  let urgencyTier = 'planning';
  if (daysUntilSellBy <= 0) urgencyTier = 'expired';
  else if (daysUntilSellBy <= 3) urgencyTier = 'last-call';
  else if (daysUntilSellBy <= 14) urgencyTier = 'urgent';
  else if (daysUntilSellBy <= 60) urgencyTier = 'soon';

  return {
    asOfDate: asOf.toISOString().slice(0, 10),
    taxYear: year,
    yearEndDate: yearEnd.toISOString().slice(0, 10),
    sellByDate: sellBy.toISOString().slice(0, 10),
    daysUntilYearEnd,
    daysUntilSellBy,
    urgencyTier,
  };
}

// ─── CROSS-ACCOUNT + CROSS-SPOUSE SUPERFICIAL BUY CHECK ──────────────
// CRA's 30-day window applies across ALL accounts the user controls AND
// the accounts of any "affiliated person" — most commonly a spouse or
// common-law partner (ITA section 251.1). Sprint 3 added the household
// graph; when the user has linked their spouse via /profile, we extend
// the recent-buy index with the spouse's transactions and tag each row
// with `ownerKind: 'self' | 'spouse'` so the UI can explain WHY a loss
// would be denied.

function buildRecentBuyIndex(transactions, asOf = new Date(), { ownerKind = 'self' } = {}) {
  const thirtyDaysAgo = asOf.getTime() - 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAhead = asOf.getTime() + 30 * 24 * 60 * 60 * 1000;
  const idx = {};
  (transactions || [])
    .filter(t => {
      const ty = String(t.transaction_type || t.type || '').toLowerCase();
      return ty === 'buy';
    })
    .forEach(t => {
      const tickr = String(t.ticker || '').toUpperCase();
      const rawDate = t.date ?? t.trade_date;
      const dt = rawDate ? new Date(rawDate).getTime() : 0;
      if (!tickr || dt < thirtyDaysAgo || dt > thirtyDaysAhead) return;
      if (!idx[tickr]) idx[tickr] = [];
      idx[tickr].push({
        date: rawDate,
        account_id: t.account_id ?? t.accountId ?? null,
        quantity: safeNumber(t.quantity),
        price: safeNumber(t.price),
        ownerKind,
      });
    });
  Object.values(idx).forEach(arr => arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  return idx;
}

// Merges two recent-buy indexes preserving sort order (most recent first).
function mergeRecentBuyIndexes(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([ticker, rows]) => {
    out[ticker] = [...(out[ticker] || []), ...rows]
      .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
  });
  return out;
}

// ─── BUILD HARVEST PLAN ───────────────────────────────────────
// The richer entry-point used by the dedicated /harvest page.

/**
 * @param {object} [input]
 * @param {Array} [input.holdings]
 * @param {Array} [input.accounts]
 * @param {Array} [input.transactions]
 * @param {Array} [input.realizedPositions]
 * @param {{ marginal_tax_rate?: number, province?: string }} [input.profile]
 * @param {Date} [input.asOf]
 */
export function buildHarvestPlan(input = {}) {
  const { holdings, accounts, transactions, realizedPositions, profile = {}, asOf, spouseTransactions = null } = input;
  const now = asOf instanceof Date ? asOf : new Date();
  const rate = /** @type {{ marginal_tax_rate?: number }} */ (profile).marginal_tax_rate;
  const marginalTaxRate = typeof rate === 'number' ? rate / 100 : 0.30;

  const progress = calcTaxYearProgress(now);
  const ytd = calcRealizedGainsYTD(realizedPositions, accounts, now);
  const accountMap = {};
  (accounts || []).forEach(a => { accountMap[a.id] = a; });
  // Cross-account index — every Buy of every ticker the user has made in any
  // account in the last 30 days. This is what the CRA superficial-loss rule
  // actually catches (it doesn't care which account did the buy).
  let recentBuyIndex = buildRecentBuyIndex(transactions, now, { ownerKind: 'self' });
  // Cross-spouse extension: when the user has linked their spouse via
  // /profile, spouseTransactions is the list of recent Buy/Sell rows from
  // the get_household_recent_transactions RPC. Tagging the merged rows as
  // ownerKind='spouse' lets the UI explain WHY a loss is blocked.
  const hasSpouseLink = Array.isArray(spouseTransactions);
  if (hasSpouseLink && spouseTransactions.length > 0) {
    const spouseIndex = buildRecentBuyIndex(spouseTransactions, now, { ownerKind: 'spouse' });
    recentBuyIndex = mergeRecentBuyIndexes(recentBuyIndex, spouseIndex);
  }

  // Build per-opportunity entries.
  const opportunities = [];
  (holdings || [])
    .filter(h => safeNumber(h.quantity ?? h.position) > 0)
    .forEach(h => {
      const acct = accountMap[h.account_id ?? h.accountId];
      if (!acct) return;
      if (accountClass(acct.account_type ?? acct.type ?? '') !== 'taxable') return;
      const unrealized = safeNumber(h.unrealized_gain_loss_amount ?? h.unrealizedAmt);
      if (unrealized >= -50) return;

      const ticker = String(h.ticker || '').toUpperCase();
      const recentBuys = recentBuyIndex[ticker] || [];
      const wouldTriggerSuperficial = recentBuys.length > 0;
      const lastBuy = recentBuys[0] || null;
      const blockedBySpouse = !!lastBuy && lastBuy.ownerKind === 'spouse';
      const spouseRecentBuyCount = recentBuys.filter(b => b.ownerKind === 'spouse').length;
      const lastBuyAccount = lastBuy
        ? (blockedBySpouse
            ? "spouse's account"
            : (accountMap[lastBuy.account_id]?.account_name || accountMap[lastBuy.account_id]?.account_type || lastBuy.account_id))
        : null;

      // Days held — use the holding's earliest purchase_history entry if
      // present; fall back to "unknown".
      const lots = Array.isArray(h.purchase_history) ? h.purchase_history : [];
      const earliestLotDate = lots
        .map(l => l.date ? new Date(l.date).getTime() : null)
        .filter(Boolean)
        .sort((a, b) => a - b)[0];
      const daysHeld = earliestLotDate ? Math.floor((now.getTime() - earliestLotDate) / (1000 * 60 * 60 * 24)) : null;

      const grossLoss = Math.abs(unrealized);
      const grossTaxSavings = grossLoss * 0.5 * marginalTaxRate;
      const replacements = isKnownEtf(ticker) ? rankReplacementCandidates(ticker) : [];

      opportunities.push({
        id: `harvest-${h.id || ticker}`,
        ticker,
        holdingId: h.id,
        name: h.name || h.asset_name || ticker,
        fromAccount: acct.account_name || acct.account_type,
        fromAccountId: acct.id,
        currency: String(h.listing_currency || h.currency || 'CAD').toUpperCase(),
        marketValue: safeNumber(h.market_value ?? h.marketValue),
        unrealizedLoss: unrealized,
        grossLoss,
        daysHeld,
        wouldTriggerSuperficial,
        blockedBySpouse,
        spouseRecentBuyCount,
        lastBuyDate: lastBuy?.date ?? null,
        lastBuyAccount,
        recentBuyCount: recentBuys.length,
        replacements,
        replacementsAvailable: replacements.length > 0,
        grossTaxSavings,
        severity: grossLoss > 2000 ? 'high' : grossLoss > 500 ? 'medium' : 'low',
      });
    });

  opportunities.sort((a, b) => b.grossTaxSavings - a.grossTaxSavings);

  // Walk the sorted opportunities and allocate offsets against YTD gains
  // first; remainder is carryforward (worth less because deferred and
  // contingent on having future gains).
  const carryforwardDiscount = 0.60;
  let remainingGainsToOffset = ytd.realizedGains;
  let immediateTaxSavings = 0;
  let carryforwardCreated = 0;
  const annotated = opportunities.map(opp => {
    if (opp.wouldTriggerSuperficial) {
      return { ...opp, offsetUsed: 0, carryforwardAmount: 0, projectedTaxSavings: 0 };
    }
    const lossUsed = Math.min(opp.grossLoss, remainingGainsToOffset);
    const remainder = opp.grossLoss - lossUsed;
    remainingGainsToOffset -= lossUsed;
    const immediate = lossUsed * 0.5 * marginalTaxRate;
    const carryforward = remainder * 0.5 * marginalTaxRate * carryforwardDiscount;
    immediateTaxSavings += immediate;
    carryforwardCreated += remainder;
    return {
      ...opp,
      offsetUsed: lossUsed,
      carryforwardAmount: remainder,
      projectedTaxSavings: immediate + carryforward,
      immediateTaxSavings: immediate,
      carryforwardValue: carryforward,
    };
  });

  const totalHarvestableLoss = annotated
    .filter(o => !o.wouldTriggerSuperficial)
    .reduce((s, o) => s + o.grossLoss, 0);
  const totalProjectedSavings = annotated.reduce((s, o) => s + (o.projectedTaxSavings || 0), 0);

  return {
    ...progress,
    marginalTaxRate,
    ytdRealizedGains: ytd.realizedGains,
    ytdRealizedLosses: ytd.realizedLosses,
    ytdNetRealized: ytd.netRealized,
    totalHarvestableLoss,
    immediateTaxSavings,
    carryforwardLossesCreated: carryforwardCreated,
    carryforwardValueDiscounted: totalProjectedSavings - immediateTaxSavings,
    totalProjectedSavings,
    blockedBySuperficialCount: annotated.filter(o => o.wouldTriggerSuperficial).length,
    blockedBySpouseCount: annotated.filter(o => o.blockedBySpouse).length,
    spouseLinkActive: hasSpouseLink,
    opportunities: annotated,
  };
}

// ─── MARKDOWN EXPORT ──────────────────────────────────────────
// Produces the printable / shareable "Year-End Harvest List" the user can
// save as a PDF or paste into their broker's notes.

/**
 * @param {ReturnType<typeof buildHarvestPlan> | null} plan
 * @param {{ fullName?: string, province?: string }} [meta]
 */
export function buildHarvestPlanMarkdown(plan, meta = {}) {
  if (!plan) return '';
  const { fullName, province } = meta;
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-CA');
  const lines = [];
  lines.push(`# Year-End Tax-Loss Harvest Plan — ${plan.taxYear}`);
  lines.push('');
  if (fullName) lines.push(`**Prepared for:** ${fullName}${province ? ` (${province})` : ''}`);
  lines.push(`**As of:** ${plan.asOfDate}`);
  lines.push(`**Sell-by date for ${plan.taxYear} tax year:** ${plan.sellByDate} (T+1 settlement; ${plan.daysUntilSellBy} days remaining)`);
  lines.push(`**Marginal tax rate used:** ${(plan.marginalTaxRate * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Harvestable unrealized losses:** ${fmt(plan.totalHarvestableLoss)}`);
  lines.push(`- **YTD realized gains (non-registered):** ${fmt(plan.ytdRealizedGains)}`);
  lines.push(`- **Immediate tax saved (offsets YTD gains):** ${fmt(plan.immediateTaxSavings)}`);
  lines.push(`- **Carryforward loss created:** ${fmt(plan.carryforwardLossesCreated)} (present value ~${fmt(plan.carryforwardValueDiscounted)})`);
  lines.push(`- **Total projected tax savings:** ${fmt(plan.totalProjectedSavings)}`);
  if (plan.blockedBySuperficialCount > 0) {
    const spouseBit = plan.blockedBySpouseCount > 0 ? ` (${plan.blockedBySpouseCount} by spouse's purchases)` : '';
    lines.push(`- **Blocked by superficial-loss rule:** ${plan.blockedBySuperficialCount} position(s)${spouseBit} — see notes below`);
  }
  lines.push('');
  lines.push('## Recommended Trades');
  lines.push('');
  plan.opportunities.forEach((opp, i) => {
    if (opp.wouldTriggerSuperficial) {
      const blockLabel = opp.blockedBySpouse ? 'BLOCKED (Spousal Superficial Loss)' : 'BLOCKED (Superficial Loss Risk)';
      lines.push(`### ${i + 1}. ⚠️  ${opp.ticker} — ${blockLabel}`);
      lines.push('');
      lines.push(`- Unrealized loss: ${fmt(opp.grossLoss)} in ${opp.fromAccount}`);
      lines.push(`- Last Buy of ${opp.ticker}: ${opp.lastBuyDate} in ${opp.lastBuyAccount}`);
      if (opp.blockedBySpouse) {
        lines.push(`- CRA treats spouses as "affiliated persons" — a buy by your spouse within 30 days of your sale at a loss denies the loss for you.`);
        lines.push(`- **Action:** wait until 30 days after your spouse's last buy (${opp.lastBuyDate}), OR coordinate so neither of you holds the security for 30 days.`);
      } else {
        lines.push(`- Selling now would deny the loss; ACB of remaining shares is adjusted upward instead.`);
        lines.push(`- **Action:** wait until 30 days after ${opp.lastBuyDate} before selling, OR sell only some lots while leaving 0 shares in any account for 30+ days.`);
      }
      lines.push('');
      return;
    }
    lines.push(`### ${i + 1}. ${opp.ticker} — Sell for ${fmt(opp.grossLoss)} loss`);
    lines.push('');
    lines.push(`- **Account:** ${opp.fromAccount}`);
    lines.push(`- **Current market value:** ${fmt(opp.marketValue)} (${opp.currency})`);
    if (opp.daysHeld != null) lines.push(`- **Days held:** ${opp.daysHeld}`);
    lines.push(`- **Tax savings this year:** ${fmt(opp.immediateTaxSavings)} (offsets ${fmt(opp.offsetUsed)} of YTD gains)`);
    if (opp.carryforwardAmount > 0) {
      lines.push(`- **Carryforward created:** ${fmt(opp.carryforwardAmount)} (present value ~${fmt(opp.carryforwardValue)})`);
    }
    if (opp.replacements.length > 0) {
      lines.push(`- **Replacement candidates** (keeps similar market exposure without superficial-loss risk):`);
      opp.replacements.forEach(r => {
        const overlap = r.overlapPct != null ? `${Math.round(r.overlapPct * 100)}% overlap` : 'overlap unknown';
        const flag = r.safetyRating === 'safe' ? '✅' : r.safetyRating === 'caution' ? '⚠️' : '❌';
        lines.push(`  - ${flag}  **${r.ticker}** — ${r.name}. ${overlap}. ${r.note}`);
      });
    } else {
      lines.push(`- **Replacement:** No ETF replacement available for this security. Wait 30 days before rebuying, or pick a different security in the same asset class.`);
    }
    lines.push('');
  });
  lines.push('---');
  lines.push('');
  lines.push('_Generated by Unifolio Tax Optimizer. For informational purposes only — not tax advice._');
  if (plan.spouseLinkActive) {
    lines.push('_Spousal accounts ARE checked in this plan via the household link in /profile._');
  } else {
    lines.push('_Spousal accounts are NOT checked in this plan — link your spouse in /profile to enable cross-spouse superficial-loss detection._');
  }
  return lines.join('\n');
}

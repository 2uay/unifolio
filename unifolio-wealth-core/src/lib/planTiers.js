// ============================================================
// Unifolio Plan Tiers — canonical source of truth
// Used by: Plans.jsx (pricing page), Checkout.jsx (checkout
// flow), Accounts.jsx (cap utilization warning),
// AuthContext.jsx (plan-aware gating).
// ============================================================

// Per-extra-brokerage-account add-on. Users on a tier with
// addOnAllowed: true can pay this to exceed accountCap.
export const ACCOUNT_ADD_ON = {
  USD: 2, // $2/mo per extra account
  CAD: 3,
};

// Tier ordering matters — pages render in this order.
export const PLAN_TIERS = [
  {
    id: 'free',
    title: 'Free',
    badge: null,
    tagline: 'Start tracking your portfolio with zero friction.',
    accountCap: 2,
    apiAccess: false,
    addOnAllowed: false,
    founderAccess: false,
    behavioralInsights: false,
    lossHarvest: false,
    prices: {
      USD: { monthly: 0, annual: 0 },
      CAD: { monthly: 0, annual: 0 },
    },
    features: [
      { label: 'Up to 2 brokerage accounts',  included: true  },
      { label: 'Holdings & P&L tracking',     included: true  },
      { label: 'Watchlist (10 tickers)',      included: true  },
      { label: 'Sample data mode',            included: true  },
      { label: 'API linkage (Plaid)',         included: false },
      { label: 'IBKR / CSV import',           included: false },
      { label: 'Tax report export',           included: false },
      { label: 'Tax Optimizer',               included: false },
      { label: 'Insights & ETF X-Ray',        included: false },
      { label: 'Behavioral insights',         included: false },
    ],
  },
  {
    id: 'pro',
    title: 'Pro',
    badge: 'Most Popular',
    tagline: 'For active investors with multiple accounts.',
    accountCap: 3,
    apiAccess: true,
    addOnAllowed: true,
    founderAccess: false,
    behavioralInsights: false,
    lossHarvest: false,
    prices: {
      USD: { monthly: 7, annual: 6 },
      CAD: { monthly: 10, annual: 8 },
    },
    features: [
      { label: 'Up to 3 brokerage accounts',  included: true  },
      { label: 'API linkage (Plaid)',         included: true  },
      { label: 'IBKR / CSV import',           included: true  },
      { label: 'Tax report + T5008 export',   included: true  },
      { label: 'Tax Optimizer',               included: true  },
      { label: 'Insights & ETF X-Ray',        included: true  },
      { label: 'Unlimited watchlist',         included: true  },
      { label: 'Real-time price feed',        included: true  },
      { label: 'Loss Harvest Center',         included: false },
      { label: 'Behavioral insights',         included: false },
      { label: 'AI investment analyst',       included: false },
      { label: 'Direct access to founder',    included: false },
    ],
  },
  {
    id: 'pro_plus',
    title: 'Pro+',
    badge: null,
    tagline: 'Power users who want deeper analytics.',
    accountCap: 8,
    apiAccess: true,
    addOnAllowed: true,
    founderAccess: false,
    behavioralInsights: true,
    lossHarvest: true,
    prices: {
      USD: { monthly: 18, annual: 16 },
      CAD: { monthly: 25, annual: 22 },
    },
    features: [
      { label: 'Up to 8 brokerage accounts',     included: true  },
      { label: 'Everything in Pro',              included: true  },
      { label: 'Loss Harvest Center',            included: true  },
      { label: 'Year-end harvest plan export',   included: true  },
      { label: 'Behavioral insights',            included: true  },
      { label: 'AI investment analyst',          included: true  },
      { label: 'Custom themes (48+)',            included: true  },
      { label: 'Direct access to founder',       included: false },
    ],
  },
  {
    id: 'pro_max',
    title: 'Pro Max',
    badge: 'For Power Users',
    tagline: 'Serious investors and family offices.',
    accountCap: 20,
    apiAccess: true,
    addOnAllowed: true,
    founderAccess: true,
    behavioralInsights: true,
    lossHarvest: true,
    prices: {
      USD: { monthly: 35, annual: 30 },
      CAD: { monthly: 48, annual: 42 },
    },
    features: [
      { label: 'Up to 20 brokerage accounts',     included: true  },
      { label: 'Everything in Pro+',              included: true  },
      { label: 'Direct access to founder',        included: true  },
      { label: 'Priority support (4-hour SLA)',   included: true  },
      { label: 'Early access to all features',    included: true  },
      { label: 'Custom data exports',             included: true  },
      { label: 'Multi-user (spouse + advisor)',   included: true  },
    ],
  },
  {
    id: 'lifetime',
    title: 'Lifetime',
    badge: 'Best Value',
    tagline: 'Pay once. Own Pro Max forever.',
    accountCap: 20,
    apiAccess: true,
    addOnAllowed: true,
    founderAccess: true,
    behavioralInsights: true,
    lossHarvest: true,
    // Lifetime = 2 × (annual Pro Max × 12) × 0.8 (20% loyalty discount):
    //   USD: 2 × ($30 × 12) × 0.8 = $576
    //   CAD: 2 × ($42 × 12) × 0.8 = $806
    prices: {
      USD: { monthly: 0, annual: 0, lifetime: 576 },
      CAD: { monthly: 0, annual: 0, lifetime: 806 },
    },
    features: [
      { label: 'Everything in Pro Max',         included: true },
      { label: 'All future features, forever',  included: true },
      { label: 'No recurring charges',          included: true },
      { label: 'Founding-member badge',         included: true },
      { label: 'Private Discord channel',       included: true },
      { label: 'Direct line to founder',        included: true },
      { label: 'Vote on the roadmap',           included: true },
      { label: 'API access (priority queue)',   included: true },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────

export function getTier(planId) {
  return PLAN_TIERS.find(t => t.id === planId) || PLAN_TIERS[0];
}

function priceForBilling(tier, billing, currency) {
  if (billing === 'lifetime') return tier.prices[currency].lifetime ?? 0;
  return billing === 'annual' ? tier.prices[currency].annual : tier.prices[currency].monthly;
}

/**
 * Returns the price breakdown for a given plan + billing + currency + extras.
 * - `base`     = the tier's per-month price (or one-time lifetime price)
 * - `addOn`    = extra-accounts surcharge per month
 * - `total`    = base + addOn (per month, or one-time lifetime)
 * - `isLifetime` = true when billing is the lifetime one-time charge
 *
 * @param {{ planId?: string, billing?: string, currency?: string, extraAccounts?: number }} [opts]
 */
export function calcMonthlyPricing({ planId, billing = 'annual', currency = 'USD', extraAccounts = 0 } = {}) {
  const tier = getTier(planId);
  const cur = tier.prices[currency] ? currency : 'USD';
  if (planId === 'lifetime') {
    const oneTime = tier.prices[cur].lifetime ?? 0;
    return { base: oneTime, addOn: 0, total: oneTime, isLifetime: true, currency: cur };
  }
  const base = priceForBilling(tier, billing, cur);
  const addOnUnit = tier.addOnAllowed ? (ACCOUNT_ADD_ON[cur] ?? 0) : 0;
  const addOn = Math.max(0, extraAccounts) * addOnUnit;
  return { base, addOn, total: base + addOn, isLifetime: false, currency: cur };
}

/**
 * Returns the annual total a user pays at a given setup.
 * For monthly billing: 12 × monthly. For annual billing: 12 × per-month-when-annual.
 * For lifetime: the one-time charge.
 *
 * @param {{ planId?: string, billing?: string, currency?: string, extraAccounts?: number }} [opts]
 */
export function calcAnnualPricing({ planId, billing = 'annual', currency = 'USD', extraAccounts = 0 } = {}) {
  const monthly = calcMonthlyPricing({ planId, billing, currency, extraAccounts });
  if (monthly.isLifetime) return monthly;
  return {
    base: monthly.base * 12,
    addOn: monthly.addOn * 12,
    total: monthly.total * 12,
    isLifetime: false,
    currency: monthly.currency,
  };
}

/**
 * How many extra brokerage accounts the user holds above their plan cap.
 * Returns 0 for plans that don't allow add-ons (Free) — over-cap users on Free
 * are blocked at the UI level rather than charged.
 */
export function extraAccountCount({ planId, totalAccounts = 0 }) {
  const tier = getTier(planId);
  if (!tier.addOnAllowed) return 0;
  return Math.max(0, totalAccounts - tier.accountCap);
}

/**
 * Returns true when the user is over their plan's accountCap on a plan that
 * does NOT allow add-ons (i.e. Free). The Accounts page surfaces a CTA to
 * upgrade in this state.
 */
export function isOverCapHardBlock({ planId, totalAccounts = 0 }) {
  const tier = getTier(planId);
  if (tier.addOnAllowed) return false;
  return totalAccounts > tier.accountCap;
}

/**
 * Annual savings percent vs. monthly billing. Used in the billing toggle.
 * Returns 0 for free/lifetime tiers.
 */
export function annualSavingsPct({ planId, currency = 'USD' }) {
  const tier = getTier(planId);
  const cur = tier.prices[currency] ? currency : 'USD';
  const monthly = tier.prices[cur].monthly;
  const annual = tier.prices[cur].annual;
  if (!monthly || !annual) return 0;
  return Math.round((1 - annual / monthly) * 100);
}

/**
 * Returns the tier ids in display order. Convenience for pages that iterate.
 */
export const TIER_IDS = PLAN_TIERS.map(t => t.id);

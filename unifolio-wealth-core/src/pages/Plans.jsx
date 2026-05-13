import React, { useState } from 'react';
import { Check, X, Gem, Sparkles, Crown, Zap, ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';
import { useCurrency } from '@/lib/CurrencyContext';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import SpinningLogo from '@/components/shared/SpinningLogo';

// Lifetime price = 2 years of annual billing at a 20% discount.
//   lifetime = 2 × (annual × 12) × 0.8
// USD: 2 × ($18 × 12) × 0.8 = $345.60 ≈ $346
// CAD: 2 × ($25 × 12) × 0.8 = $480
const PRICES = {
  USD: { monthly: 20,  annual: 18,  lifetime: 346 },
  CAD: { monthly: 28,  annual: 25,  lifetime: 480 },
};

const PLAN_FEATURES = {
  starter: [
    { label: '1 brokerage account',         included: true  },
    { label: 'Holdings & P&L tracking',     included: true  },
    { label: 'Watchlist (up to 10 tickers)', included: true },
    { label: 'Sample data mode',             included: true  },
    { label: 'IBKR / CSV import',            included: false },
    { label: 'Real-time price feed',         included: false },
    { label: 'Tax report export',            included: false },
    { label: 'Insights & AI analysis',       included: false },
    { label: '48+ custom themes',            included: false },
    { label: 'Priority support',             included: false },
  ],
  pro: [
    { label: 'Unlimited brokerage accounts', included: true },
    { label: 'Holdings & P&L tracking',      included: true },
    { label: 'Unlimited watchlist',           included: true },
    { label: 'IBKR / CSV import',             included: true },
    { label: 'Real-time price feed',          included: true },
    { label: 'Tax report export',             included: true },
    { label: 'Insights & AI analysis',        included: true },
    { label: '48+ custom themes',             included: true },
    { label: 'Priority support',              included: true },
    { label: 'Early feature access',          included: true },
  ],
  lifetime: [
    { label: 'Everything in Pro',             included: true },
    { label: 'All future features, forever',  included: true },
    { label: 'No recurring charges',          included: true },
    { label: 'Dedicated support channel',     included: true },
    { label: 'Private beta access',           included: true },
    { label: 'Founding member badge',         included: true },
    { label: 'Changelog early access',        included: true },
    { label: 'Feature request priority',      included: true },
    { label: 'Full data export tools',        included: true },
    { label: 'API access (coming soon)',       included: true },
  ],
};

const WHY_ITEMS = [
  {
    icon: Zap,
    title: 'Real-time prices',
    body: 'Live quotes via Finnhub across all your holdings and watchlist — no stale data.',
  },
  {
    icon: ArrowRight,
    title: 'One-click IBKR import',
    body: 'Upload your Flex Query or activity CSV and see your full portfolio in seconds.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Privacy mode, local-first data, and zero analytics on your trades.',
  },
  {
    icon: Sparkles,
    title: 'Constantly improving',
    body: 'New features ship every week. Pro and Lifetime users get them first.',
  },
];

const APP_URL = 'https://unifolio.ca';

function PlanCard({ title, badge, badgeColor, price, priceSub, description, features, cta, ctaStyle, ctaHref, icon: Icon, highlighted }) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl backdrop-blur-xl transition-all duration-300',
        highlighted
          ? 'border-2 border-primary/50 bg-gradient-to-b from-card/95 to-card/70 shadow-[0_0_60px_hsl(var(--primary)/0.25),0_20px_50px_-20px_hsl(var(--primary)/0.4)] scale-[1.03] hover:scale-[1.05] hover:shadow-[0_0_80px_hsl(var(--primary)/0.35),0_25px_60px_-20px_hsl(var(--primary)/0.5)]'
          : 'border border-border/50 bg-card/80 hover:border-primary/30 hover:shadow-[0_0_40px_hsl(var(--primary)/0.12)] hover:bg-card/90'
      )}
    >
      {/* Gradient ring on hover for non-highlighted cards */}
      {!highlighted && (
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/0 via-primary/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}

      {badge && (
        <div className={cn(
          'absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10px] font-bold tracking-[0.08em] uppercase border z-10 backdrop-blur-md shadow-lg',
          badgeColor,
        )}>
          {badge}
        </div>
      )}

      <div className="relative p-7 pb-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            highlighted ? 'bg-primary/15' : 'bg-secondary/60',
          )}>
            <Icon className={cn('w-3.5 h-3.5', highlighted ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <span className="text-sm font-bold text-foreground tracking-[0.06em] uppercase">{title}</span>
        </div>

        {/* Price */}
        <div>
          <div className="flex items-end gap-1.5">
            <span className={cn(
              'text-5xl font-bold tracking-tight leading-none',
              highlighted
                ? 'bg-gradient-to-br from-foreground to-primary bg-clip-text text-transparent'
                : 'text-foreground'
            )}>
              {price}
            </span>
            {priceSub && <span className="text-sm text-muted-foreground mb-1.5">{priceSub}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed min-h-[2.5em]">{description}</p>
        </div>

        {/* CTA */}
        <a
          href={ctaHref || APP_URL}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 text-center block',
            ctaStyle,
          )}
        >
          {cta}
        </a>
      </div>

      {/* Divider */}
      <div className="mx-7 border-t border-border/40" />

      {/* Features */}
      <ul className="relative p-7 pt-5 flex flex-col gap-2.5 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            {f.included ? (
              <div className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                highlighted ? 'bg-primary/20' : 'bg-emerald-500/15'
              )}>
                <Check className={cn('w-2.5 h-2.5', highlighted ? 'text-primary' : 'text-emerald-400')} strokeWidth={3} />
              </div>
            ) : (
              <X className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            )}
            <span className={f.included ? 'text-foreground' : 'text-muted-foreground/45 line-through decoration-muted-foreground/20'}>{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const isOnProDomain = typeof window !== 'undefined' &&
  (window.location.hostname === 'unifolio.pro' || window.location.hostname === 'www.unifolio.pro');

export default function Plans() {
  const [billing, setBilling] = useState('annual');
  const { chartColors } = useTheme();
  const { displayCurrency } = useCurrency();

  const currency = PRICES[displayCurrency] ? displayCurrency : 'USD';
  const { monthly: MONTHLY_PRICE, annual: ANNUAL_PRICE, lifetime: LIFETIME_PRICE } = PRICES[currency];
  const currSymbol = currency === 'CAD' ? 'CA$' : '$';
  const annualSavingsPct = Math.round((1 - ANNUAL_PRICE / MONTHLY_PRICE) * 100);

  const plans = [
    {
      id: 'starter',
      title: 'Starter',
      badge: null,
      badgeColor: '',
      icon: Gem,
      highlighted: false,
      price: 'Free',
      priceSub: null,
      description: 'Get started free — no card required.',
      features: PLAN_FEATURES.starter,
      cta: 'Open unifolio.ca',
      ctaHref: APP_URL,
      ctaStyle: 'border border-border text-foreground hover:bg-secondary/80 backdrop-blur-sm',
    },
    {
      id: 'pro',
      title: 'Pro',
      badge: 'Most Popular',
      badgeColor: 'bg-primary text-primary-foreground border-primary/40',
      icon: Sparkles,
      highlighted: true,
      price: billing === 'annual'
        ? `${currSymbol}${ANNUAL_PRICE}`
        : `${currSymbol}${MONTHLY_PRICE}`,
      priceSub: billing === 'annual' ? '/mo, billed annually' : '/month',
      description: billing === 'annual'
        ? `${currSymbol}${ANNUAL_PRICE * 12}/yr — save ${annualSavingsPct}% vs monthly.`
        : `Switch to annual to save ${annualSavingsPct}%.`,
      features: PLAN_FEATURES.pro,
      cta: 'Start 7-Day Free Trial',
      ctaHref: `${APP_URL}/?plan=pro`,
      ctaStyle: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_32px_hsl(var(--primary)/0.40)]',
    },
    {
      id: 'lifetime',
      title: 'Lifetime',
      badge: 'Best Value',
      badgeColor: 'bg-amber-500 text-amber-950 border-amber-400/40',
      icon: Crown,
      highlighted: false,
      price: `${currSymbol}${LIFETIME_PRICE}`,
      priceSub: 'one-time',
      description: 'Pay once. Own Unifolio Pro forever.',
      features: PLAN_FEATURES.lifetime,
      cta: 'Buy Lifetime Access',
      ctaHref: `${APP_URL}/?plan=lifetime`,
      ctaStyle: 'bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Lush snowglobe — render the decorative background wheel + extra
          ribbon background ALWAYS (both standalone on unifolio.pro and inside
          AppLayout). The wave background underneath is already at snowglobe
          density via AppLayout's `density='snowglobe'` for /plans, so on top
          of that we layer LoginBackgroundWheel for the slow-rotating dot ring
          and (when standalone) a second ribbon background for extra depth. */}
      <LoginBackgroundWheel />
      {isOnProDomain && (
        <ThemedWaveBackground variant="ribbon" className="z-0" />
      )}

      {/* Decorative gradient washes — soft glow corners that pop with the
          active theme. Clipped tightly via parent overflow:hidden so the
          radial origins never leak past the viewport edges. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--accent, var(--primary))) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[60vw] h-[30vw] max-w-[800px] max-h-[400px] rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(ellipse, hsl(var(--primary)) 0%, transparent 70%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 py-10 md:py-16 max-w-5xl mx-auto">
        {/* Sign-in link when standalone on unifolio.pro */}
        {isOnProDomain && (
          <div className="flex justify-end mb-4">
            <a
              href={APP_URL}
              className="text-sm text-muted-foreground hover:text-foreground border border-border/40 hover:border-primary/40 bg-card/60 backdrop-blur-md px-4 py-1.5 rounded-xl transition-all"
            >
              Sign In →
            </a>
          </div>
        )}

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-7">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
              <div className="relative">
                <SpinningLogo size={88} />
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold mb-5 tracking-[0.08em] uppercase backdrop-blur-md">
            <Gem className="w-3 h-3" />
            unifolio.pro
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
            Plans & Pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            Everything you need to manage, track, and understand your investments in one place.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex flex-col items-center gap-3 mb-12">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card/60 border border-border/40 backdrop-blur-md">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                billing === 'monthly'
                  ? 'bg-secondary text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2',
                billing === 'annual'
                  ? 'bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.4)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Annual
              <span className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                billing === 'annual' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/15 text-primary'
              )}>
                -{annualSavingsPct}%
              </span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Prices shown in {currency} · Change in{' '}
            <a href="/settings" className="text-primary hover:underline">Settings</a>
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-20 pt-4">
          {plans.map(plan => (
            <PlanCard key={plan.id} {...plan} />
          ))}
        </div>

        {/* Why Unifolio Pro */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] uppercase text-primary mb-2">
              <Sparkles className="w-3 h-3" />
              Why Pro
            </div>
            <h2 className="text-2xl font-bold text-foreground">Built for serious investors</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WHY_ITEMS.map((item, i) => (
              <div
                key={i}
                className="group flex gap-4 p-5 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md hover:border-primary/30 hover:bg-card/80 hover:shadow-[0_0_30px_hsl(var(--primary)/0.10)] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="border-t border-border/30 pt-14 mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] uppercase text-primary mb-2">
              FAQ
            </div>
            <h2 className="text-2xl font-bold text-foreground">Common questions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              { q: 'Can I cancel anytime?', a: 'Yes. Monthly plans cancel immediately. Annual plans are refundable within 14 days of renewal.' },
              { q: 'Is my financial data safe?', a: 'Your holdings stay in your own Supabase instance. We never store raw broker files or sell data.' },
              { q: "What's the difference between unifolio.ca and unifolio.pro?", a: 'unifolio.ca is free with limited accounts. unifolio.pro requires a Pro or Lifetime plan and unlocks everything.' },
              { q: 'Does Lifetime include future features?', a: 'Yes — every feature that ships to Pro is included in Lifetime, forever, at no extra cost.' },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
                <p className="text-sm font-bold text-foreground mb-1.5">{item.q}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-3">
            Questions? Reach out at{' '}
            <a href="mailto:dev@unifolio.ca" className="text-primary font-semibold hover:underline">dev@unifolio.ca</a>
          </p>
          <p className="text-xs text-muted-foreground/50">
            Stripe-secured checkout · Taxes may apply · No card required for Starter
          </p>
        </div>
      </div>
    </div>
  );
}

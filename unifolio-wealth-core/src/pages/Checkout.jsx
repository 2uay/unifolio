import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, Sparkles, Crown, Gem, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import SpinningLogo from '@/components/shared/SpinningLogo';
import { useCurrency } from '@/lib/CurrencyContext';

// Mirror of PRICES on Plans.jsx — kept local to avoid a circular import.
const PRICES = {
  USD: { monthly: 20, annual: 18, lifetime: 346, sym: '$' },
  CAD: { monthly: 28, annual: 25, lifetime: 480, sym: 'CA$' },
};

const PLAN_META = {
  starter: { title: 'Starter', icon: Gem, color: 'text-muted-foreground' },
  pro:     { title: 'Pro',     icon: Sparkles, color: 'text-primary' },
  lifetime:{ title: 'Lifetime',icon: Crown, color: 'text-amber-400' },
};

function getQuery(name) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function Checkout() {
  const { displayCurrency } = useCurrency();
  const planId = getQuery('plan') || 'pro';
  const billing = getQuery('billing') || 'annual';
  const currencyParam = (getQuery('currency') || displayCurrency || 'USD').toUpperCase();
  const currency = PRICES[currencyParam] ? currencyParam : 'USD';

  const meta = PLAN_META[planId] || PLAN_META.pro;
  const Icon = meta.icon;
  const { sym, monthly, annual, lifetime } = PRICES[currency];

  const priceLabel = useMemo(() => {
    if (planId === 'starter') return 'Free';
    if (planId === 'lifetime') return `${sym}${lifetime} one-time`;
    if (billing === 'annual') return `${sym}${annual}/mo billed annually (${sym}${annual * 12}/yr)`;
    return `${sym}${monthly}/month`;
  }, [planId, billing, sym, monthly, annual, lifetime]);

  // Stripe is not wired yet. Until it is, route each plan to its real-world
  // next step: a mailto for Lifetime / Pro early access, or back to the app
  // for Starter. When Stripe is added, replace these CTAs with sessionRedirect.
  const flow = useMemo(() => {
    if (planId === 'starter') {
      return {
        header: 'Starter is free — no checkout needed.',
        body: 'You can start using Unifolio right now with no card. Click below to open the app and sign in or create a free account.',
        cta: 'Open Unifolio',
        ctaHref: 'https://unifolio.ca',
        ctaIcon: ExternalLink,
        secondary: null,
      };
    }
    if (planId === 'lifetime') {
      return {
        header: 'Lifetime checkout',
        body: `Lifetime is currently sold via direct email. Send us a quick note at support@unifolio.ca and we will reply within 24 hours with a Stripe payment link, your founding-member badge details, and access to the private Discord channel.`,
        cta: 'Email support@unifolio.ca',
        ctaHref: `mailto:support@unifolio.ca?subject=${encodeURIComponent('Lifetime purchase request')}&body=${encodeURIComponent(`Hi — I would like to purchase the Unifolio Lifetime plan (${currency} ${lifetime}). Please send me a payment link.\n\nMy name:\nMy timezone:`)}`,
        ctaIcon: Mail,
        secondary: { label: 'Read what Lifetime includes', href: '/plans' },
      };
    }
    // Pro
    return {
      header: 'Start your 7-day free trial',
      body: `Your card will not be charged for 7 days. After the trial, billing begins at ${priceLabel}. Cancel anytime from your profile — monthly cancels immediately, annual is refundable within 14 days of renewal.\n\nStripe checkout is being wired up — for now, email support@unifolio.ca to request early Pro access and we will activate your account manually within 24 hours.`,
      cta: 'Email support@unifolio.ca',
      ctaHref: `mailto:support@unifolio.ca?subject=${encodeURIComponent(`Pro ${billing} trial request`)}&body=${encodeURIComponent(`Hi — I would like to start a Pro trial (${billing} billing, ${currency} ${billing === 'annual' ? annual + '/mo' : monthly + '/mo'}). Please activate my account.\n\nAccount email:\nMy name:`)}`,
      ctaIcon: Mail,
      secondary: { label: 'Compare all plans', href: '/plans' },
    };
  }, [planId, currency, billing, lifetime, annual, monthly, priceLabel]);

  const FlowIcon = flow.ctaIcon;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginBackgroundWheel />
      <ThemedWaveBackground variant="ribbon" className="z-0" />

      <div className="relative z-10 px-4 pt-20 pb-16 max-w-2xl mx-auto">
        <Link to="/plans" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3 h-3" /> Back to plans
        </Link>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <SpinningLogo size={64} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 backdrop-blur-md mb-4">
            <Lock className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted-foreground">Secure Checkout</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{flow.header}</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl bg-secondary flex items-center justify-center')}>
              <Icon className={cn('w-5 h-5', meta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">{meta.title} plan</p>
              <p className="text-base font-bold text-foreground">{priceLabel}</p>
            </div>
          </div>

          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{flow.body}</p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <a
              href={flow.ctaHref}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
            >
              <FlowIcon className="w-4 h-4" />
              {flow.cta}
            </a>
            {flow.secondary && (
              <Link
                to={flow.secondary.href}
                className="flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-secondary/80 transition-colors"
              >
                {flow.secondary.label}
              </Link>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-6 leading-relaxed">
          Stripe-secured checkout coming soon. Until then, all paid plans are activated manually within 24 hours by emailing support@unifolio.ca. We never store payment details on our own servers.
        </p>
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Sparkles, Crown, Gem, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import SpinningLogo from '@/components/shared/SpinningLogo';
import { useCurrency } from '@/lib/CurrencyContext';
import { getTier, calcMonthlyPricing, calcAnnualPricing, ACCOUNT_ADD_ON } from '@/lib/planTiers';

// Backward-compat: older marketing links use `starter`.
const LEGACY_PLAN_ALIASES = { starter: 'free' };

const PLAN_META = {
  free:     { icon: Gem,      color: 'text-muted-foreground' },
  pro:      { icon: Sparkles, color: 'text-primary' },
  pro_plus: { icon: Sparkles, color: 'text-primary' },
  pro_max:  { icon: Crown,    color: 'text-violet-400' },
  lifetime: { icon: Crown,    color: 'text-amber-400' },
};

function getQuery(name) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function Checkout() {
  const { displayCurrency } = useCurrency();
  const rawPlanId = getQuery('plan') || 'pro';
  const planId = LEGACY_PLAN_ALIASES[rawPlanId] || rawPlanId;
  const billing = getQuery('billing') || (planId === 'lifetime' ? 'lifetime' : 'annual');
  const currencyParam = (getQuery('currency') || displayCurrency || 'USD').toUpperCase();
  const tier = getTier(planId);
  const currency = tier.prices[currencyParam] ? currencyParam : 'USD';
  const sym = currency === 'CAD' ? 'CA$' : '$';
  const extraAccounts = Math.max(0, Math.min(50, Number(getQuery('extra')) || 0));

  const meta = PLAN_META[planId] || PLAN_META.pro;
  const Icon = meta.icon;

  const monthlyPricing = calcMonthlyPricing({ planId, billing, currency, extraAccounts });
  const annualPricing = calcAnnualPricing({ planId, billing, currency, extraAccounts });

  const priceLabel = useMemo(() => {
    if (planId === 'free') return 'Free';
    if (planId === 'lifetime') return `${sym}${monthlyPricing.total} one-time`;
    const billedSuffix = billing === 'annual' ? 'billed annually' : 'billed monthly';
    return `${sym}${monthlyPricing.total}/mo (${sym}${annualPricing.total}/yr ${billedSuffix})`;
  }, [planId, billing, sym, monthlyPricing.total, annualPricing.total]);

  const extraLine = useMemo(() => {
    if (!tier.addOnAllowed || extraAccounts === 0) return null;
    return `Includes ${extraAccounts} extra account${extraAccounts === 1 ? '' : 's'} above the ${tier.accountCap}-account cap at ${sym}${ACCOUNT_ADD_ON[currency]}/mo each.`;
  }, [tier.addOnAllowed, tier.accountCap, extraAccounts, sym, currency]);

  // Stripe is not wired yet. Until it is, route each plan to its real-world
  // next step: a mailto for paid tiers, or back to the app for Free.
  // When Stripe is added, swap these CTAs for `stripe.redirectToCheckout`.
  const flow = useMemo(() => {
    if (planId === 'free') {
      return {
        header: 'Free is free — no checkout needed.',
        body: 'You can start using Unifolio right now with no card. Click below to open the app and sign in or create a free account.',
        cta: 'Open Unifolio',
        ctaHref: 'https://unifolio.ca',
        ctaIcon: ExternalLink,
        secondary: null,
      };
    }
    const planTitle = tier.title;
    const subject = `${planTitle}${billing !== 'lifetime' ? ` (${billing})` : ''} activation request`;
    const bodyLines = [
      `Hi — I'd like to activate the Unifolio ${planTitle} plan.`,
      '',
      `Billing: ${billing}`,
      `Currency: ${currency}`,
      `Price: ${sym}${monthlyPricing.total}/mo` + (planId !== 'lifetime' ? ` (${sym}${annualPricing.total}/yr)` : ' one-time'),
    ];
    if (extraAccounts > 0) bodyLines.push(`Extra accounts above cap: ${extraAccounts}`);
    bodyLines.push('', 'Account email:', 'My name:');
    const mailto = `mailto:support@unifolio.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

    if (planId === 'lifetime') {
      return {
        header: `Request Lifetime access`,
        body: `Lifetime is currently sold via direct email so we can verify the founding-member spot count and set up your private Discord channel manually. Send the email below and we'll reply within 24 hours with a payment link.`,
        cta: 'Email support@unifolio.ca',
        ctaHref: mailto,
        ctaIcon: Mail,
        secondary: { label: 'Read what Lifetime includes', href: '/plans' },
      };
    }
    if (planId === 'pro_max') {
      return {
        header: `Request Pro Max access`,
        body: `Pro Max includes a 15-minute onboarding call with the founder. Email below and we'll set up your account + the call within 24 hours. Charged ${priceLabel}; cancel anytime from your profile.`,
        cta: 'Email support@unifolio.ca',
        ctaHref: mailto,
        ctaIcon: Mail,
        secondary: { label: 'Compare all plans', href: '/plans' },
      };
    }
    // pro and pro_plus
    return {
      header: `Request ${planTitle} access`,
      body: `Stripe checkout is in the works. Until then, email support@unifolio.ca and we'll activate your ${planTitle} account within 24 hours.\n\nBilling starts at ${priceLabel}. Monthly cancels immediately, annual is refundable within 14 days of renewal.`,
      cta: 'Email support@unifolio.ca',
      ctaHref: mailto,
      ctaIcon: Mail,
      secondary: { label: 'Compare all plans', href: '/plans' },
    };
  }, [planId, tier.title, billing, currency, sym, monthlyPricing.total, annualPricing.total, extraAccounts, priceLabel]);

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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 backdrop-blur-md mb-4">
            <Mail className="w-3 h-3 text-amber-400" />
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-amber-400">Manual Activation</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{flow.header}</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl bg-secondary flex items-center justify-center')}>
              <Icon className={cn('w-5 h-5', meta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">{tier.title} plan</p>
              <p className="text-base font-bold text-foreground">{priceLabel}</p>
            </div>
          </div>

          {extraLine && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] text-foreground/85 leading-relaxed">
              {extraLine}
            </div>
          )}

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
          Stripe checkout is being wired up. Until then, all paid plans are activated manually within 24 hours by emailing support@unifolio.ca. We never store payment details on our own servers.
        </p>
      </div>
    </div>
  );
}

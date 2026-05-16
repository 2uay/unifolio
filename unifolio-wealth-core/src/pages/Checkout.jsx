// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Building2, Bitcoin, Mail, Sparkles, Crown, Gem,
  Loader2, ExternalLink, CheckCircle2, AlertTriangle, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import SpinningLogo from '@/components/shared/SpinningLogo';
import { useCurrency } from '@/lib/CurrencyContext';
import { useAuth } from '@/lib/AuthContext';
import {
  getTier, calcMonthlyPricing, calcAnnualPricing, ACCOUNT_ADD_ON,
} from '@/lib/planTiers';
import {
  createStripeCheckoutSession, createInteracOrder, createCryptoCharge,
} from '@/lib/billingClient';

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

const PAYMENT_METHODS = [
  {
    id: 'card',
    label: 'Card / Apple Pay / Google Pay',
    sub: 'Visa, Mastercard, Amex. Apple/Google Pay on supported devices.',
    icon: CreditCard,
    handler: 'stripe',
  },
  {
    id: 'acss_debit',
    label: 'Canadian bank account (Pre-Authorized Debit)',
    sub: 'Pay directly from any Canadian chequing account. CAD only.',
    icon: Building2,
    handler: 'stripe',
    requiresCAD: true,
  },
  {
    id: 'interac',
    label: 'Interac e-Transfer',
    sub: 'Send from your Canadian bank. Plan activates within 24 hours of receipt.',
    icon: Mail,
    handler: 'interac',
    requiresCAD: true,
  },
  {
    id: 'crypto',
    label: 'Cryptocurrency',
    sub: 'BTC, ETH, USDC, DAI, LTC. Hosted by Coinbase Commerce. Charged in USD.',
    icon: Bitcoin,
    handler: 'crypto',
  },
];

export default function Checkout() {
  const { displayCurrency } = useCurrency();
  const { isAuthenticated } = useAuth();
  const rawPlanId = getQuery('plan') || 'pro';
  const planId = LEGACY_PLAN_ALIASES[rawPlanId] || rawPlanId;
  const billing = getQuery('billing') || (planId === 'lifetime' ? 'lifetime' : 'annual');
  const currencyParam = (getQuery('currency') || displayCurrency || 'USD').toUpperCase();
  const tier = getTier(planId);
  const currency = tier.prices?.[currencyParam] ? currencyParam : 'USD';
  const sym = currency === 'CAD' ? 'CA$' : '$';
  const extraAccounts = Math.max(0, Math.min(50, Number(getQuery('extra')) || 0));
  const cancelled = getQuery('cancelled') === '1';

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

  const [selectedMethod, setSelectedMethod] = useState('card');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [interacResult, setInteracResult] = useState(null);

  // Reset selection if the user lands on this page with currency=USD
  // pre-selected but they pick a CAD-only method, etc. Defensive sync.
  useEffect(() => {
    const method = PAYMENT_METHODS.find(m => m.id === selectedMethod);
    if (method?.requiresCAD && currency !== 'CAD') setSelectedMethod('card');
  }, [currency, selectedMethod]);

  // Free → no checkout
  if (planId === 'free') {
    return (
      <FreeView />
    );
  }

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    const method = PAYMENT_METHODS.find(m => m.id === selectedMethod);
    const payload = { planId, billing, currency, extraAccounts };
    try {
      if (method.handler === 'stripe') {
        const { url } = await createStripeCheckoutSession({
          ...payload,
          preferredPaymentMethod: method.id, // hint only; Stripe Checkout shows whichever methods you have enabled
        });
        if (!url) throw new Error('Stripe did not return a checkout URL');
        window.location.assign(url);
      } else if (method.handler === 'crypto') {
        const { hostedUrl } = await createCryptoCharge(payload);
        if (!hostedUrl) throw new Error('Coinbase Commerce did not return a hosted URL');
        window.location.assign(hostedUrl);
      } else if (method.handler === 'interac') {
        const result = await createInteracOrder({ ...payload, currency: 'CAD' });
        setInteracResult(result);
      }
    } catch (err) {
      // configured=false → payment provider env vars not set on this
      // deployment. We show a clear actionable error rather than a
      // generic "checkout failed" toast.
      const cfgMsg = err.configured === false
        ? `${method.label} isn't enabled on this deployment yet. Try a different payment method, or email support@unifolio.ca and we'll activate manually.`
        : err.message || 'Checkout failed. Please try again or contact support@unifolio.ca.';
      setErrorMessage(cfgMsg);
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Checkout</h1>
          <p className="text-sm text-muted-foreground">Pay how you like — we support 4 methods, 2 currencies.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/50">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Icon className={cn('w-5 h-5', meta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">{tier.title} plan</p>
              <p className="text-base font-bold text-foreground">{priceLabel}</p>
            </div>
            <Link to="/plans" className="text-xs text-muted-foreground hover:text-foreground shrink-0">Change</Link>
          </div>

          {extraLine && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] text-foreground/85 leading-relaxed">
              {extraLine}
            </div>
          )}

          {cancelled && !interacResult && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/85">
                You cancelled the previous payment. No charge was made — pick a method below to try again.
              </p>
            </div>
          )}

          {!isAuthenticated && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-xs text-foreground/85">
              You need to be signed in to check out. <Link to="/" className="text-primary hover:underline">Sign in</Link> and come back.
            </div>
          )}

          {interacResult ? (
            <InteracInstructions result={interacResult} sym="CA$" onChangeMethod={() => setInteracResult(null)} />
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Payment method</p>
                {PAYMENT_METHODS.map(m => {
                  const disabled = m.requiresCAD && currency !== 'CAD';
                  const isSelected = selectedMethod === m.id;
                  const MethodIcon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedMethod(m.id)}
                      className={cn(
                        'w-full text-left rounded-xl border px-4 py-3 transition-all flex items-start gap-3',
                        isSelected ? 'border-primary bg-primary/5 shadow-[0_0_18px_hsl(var(--primary)/0.15)]'
                          : 'border-border hover:border-border/80 hover:bg-secondary/50',
                        disabled && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                      )}>
                        <MethodIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {m.sub}
                          {disabled && ' Switch your currency to CAD to enable this method.'}
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />}
                    </button>
                  );
                })}
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-rose-400/40 bg-rose-400/5 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/85">{errorMessage}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isAuthenticated || submitting}
                className={cn(
                  'w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_24px_hsl(var(--primary)/0.35)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
                )}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Preparing checkout…</>
                ) : selectedMethod === 'interac' ? (
                  <>Get e-Transfer instructions</>
                ) : (
                  <>Continue to {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.handler === 'crypto' ? 'Coinbase' : 'Stripe'}<ExternalLink className="w-3.5 h-3.5" /></>
                )}
              </button>

              <p className="text-center text-[10px] text-muted-foreground/60 leading-relaxed pt-2">
                Card and bank payments are processed by Stripe. Crypto via Coinbase Commerce. Interac is handled directly by your bank. We never see or store payment credentials.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InteracInstructions({ result, onChangeMethod }) {
  const [copied, setCopied] = useState(null);
  const copy = (label, value) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/5 px-3 py-2 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/85">
          Order created. Send the e-Transfer below and we'll activate within 24 hours of clearing.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
        <DetailRow label="Order" value={result.orderShortId} onCopy={() => copy('order', result.orderShortId)} copied={copied === 'order'} />
        <DetailRow label="Send to" value={result.receivingEmail} onCopy={() => copy('email', result.receivingEmail)} copied={copied === 'email'} />
        <DetailRow label="Amount" value={`CA$${(result.amount).toFixed(2)}`} onCopy={() => copy('amount', result.amount.toFixed(2))} copied={copied === 'amount'} mono />
        <DetailRow label="Security question" value={result.securityQuestion} onCopy={() => copy('question', result.securityQuestion)} copied={copied === 'question'} />
        <DetailRow label="Security answer" value={result.securityAnswer} onCopy={() => copy('answer', result.securityAnswer)} copied={copied === 'answer'} mono highlight />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How to send</p>
        <ol className="space-y-1.5 text-xs text-foreground/85 list-decimal pl-5">
          {result.instructions.map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      </div>

      <button
        type="button"
        onClick={onChangeMethod}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        ← Pick a different payment method
      </button>
    </div>
  );
}

function DetailRow({ label, value, onCopy, copied, mono, highlight }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{label}</p>
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('text-sm truncate', mono && 'font-mono', highlight && 'text-primary font-semibold')}>{value}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title={`Copy ${label}`}
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function FreeView() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginBackgroundWheel />
      <ThemedWaveBackground variant="ribbon" className="z-0" />
      <div className="relative z-10 px-4 pt-20 pb-16 max-w-2xl mx-auto">
        <Link to="/plans" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3 h-3" /> Back to plans
        </Link>
        <div className="text-center mb-6">
          <SpinningLogo size={64} />
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mt-5 mb-2">Free is free — no checkout needed.</h1>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8">
          <p className="text-sm text-foreground/85 leading-relaxed mb-4">
            You can start using Unifolio right now with no card. Open the app and sign in or create a free account.
          </p>
          <a href="/" className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
            Open Unifolio <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

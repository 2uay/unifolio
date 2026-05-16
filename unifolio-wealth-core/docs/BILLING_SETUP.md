# Billing Setup — Stripe, Interac, Coinbase Commerce

How to take live payments on Unifolio. The frontend Checkout flow is already
shipped and lets users pick a payment method; this doc covers the environment
variables and provider configuration you need to actually receive money.

The whole stack is dependency-free on the server side — no `stripe` npm
package, no `coinbase-commerce` SDK. Every provider call is a direct
`fetch` with the secret key as a Bearer header, and webhook signatures are
verified with Node's built-in `crypto`. Keeps the serverless cold-start
fast and the supply-chain attack surface tiny.

---

## Stripe (cards, Apple/Google Pay, ACSS Debit for CAD)

**Why:** standard, lowest-friction. Cards are universal. ACSS Debit is
Stripe's official Canadian bank-debit payment method — settled in 5
business days, ~$0.50 flat fee vs. card's ~2.9% + $0.30.

### 1. Create a Stripe account

Sign up at https://dashboard.stripe.com/register. Complete the Canadian
business verification (HST/GST number optional, sole prop is fine).

### 2. Enable payment methods

In the Stripe Dashboard → Settings → Payment methods, enable:

- **Cards** (always on)
- **Apple Pay** (auto-domain-verified by Stripe for Stripe-hosted Checkout)
- **Google Pay** (auto)
- **Pre-authorized debit in Canada (acss_debit)** — toggle on, accept the
  Stripe terms. This unlocks the "Canadian bank account" method in our
  Checkout UI when the user is paying in CAD.

### 3. Set environment variables

In your Vercel project (or wherever the serverless functions run), add:

```
STRIPE_SECRET_KEY        = sk_live_...   (or sk_test_... for sandbox)
STRIPE_WEBHOOK_SECRET    = whsec_...     (created in step 4)
SUPABASE_URL             = https://<project>.supabase.co
SUPABASE_SERVICE_KEY     = eyJ...        (service_role key from Supabase)
```

The `SUPABASE_SERVICE_KEY` is needed because the webhook bypasses RLS to
update `user_profiles.plan` on behalf of the user.

### 4. Configure the webhook

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **URL**: `https://unifolio.ca/api/billing/webhook`
- **Events to send**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the signing secret (starts with `whsec_`) into `STRIPE_WEBHOOK_SECRET`.

### 5. Test it end-to-end

1. Stripe Dashboard → toggle to "Test mode"
2. Use test card `4242 4242 4242 4242` (any future expiry, any CVC)
3. Hit /checkout → Card → Continue to Stripe
4. After paying, you should land on /checkout/success with the plan
   polling indicator turning green within ~5 seconds.

If polling exhausts without an upgrade, check:

- Webhook delivery in the Stripe Dashboard (Logs → Webhook attempts)
- Vercel function logs for `api/billing/webhook.js`
- The `billing_orders` table — there should be a `paid` row matching the
  Stripe session ID

---

## Interac e-Transfer (Canadian bank → email, manual reconciliation)

**Why:** every Canadian bank account supports it for free. Some users
prefer it over giving card details. We can't programmatically confirm
inbound e-Transfers without paying for an enterprise EFT processor
(Helcim, Plooto, Rotessa), so we do it manually for now.

### Setup

```
INTERAC_ETRANSFER_EMAIL = billing@unifolio.ca
```

That's it on the env side. You also need to:

1. Set up the recipient email at your bank (RBC/TD/BMO/Scotia/CIBC all
   support Interac auto-deposit on business chequing accounts).
2. Enable **auto-deposit** at the bank so transfers clear without
   needing to manually answer the security question.

### Operations (manual until automated)

When a user completes the Interac flow, we create a `billing_orders` row
with `billing_method='interac_etransfer'` and `status='pending'`. The
user gets a unique security answer to type into their bank.

Daily ops checklist (5 min):

1. Check your bank for inbound e-Transfers.
2. For each one, note the security answer the user supplied.
3. In Supabase Dashboard → Table editor → `billing_orders`, find the row
   where `external_id` matches that security answer.
4. Update the row: `status='paid'`, then update `user_profiles` with
   the new `plan` value from `billing_orders.plan_id`.

When volume gets >5/day, automate step 4 with a small admin tool or a
Supabase Edge Function triggered by your bank's notification email.

---

## Coinbase Commerce (BTC, ETH, USDC, DAI, LTC, BCH, DOGE)

**Why:** privacy-preferring users like it. Useful for non-Canadian
customers who want to avoid the FX hit of paying USD prices with a CAD
card.

### Setup

1. Sign up at https://commerce.coinbase.com (note: Coinbase Commerce
   has tightened merchant onboarding since 2024 — non-USDC payouts may
   require additional verification. If onboarding is blocked, swap to
   **BTCPay Server** (self-hosted) — same hosted-checkout UX, swap the
   API URL in `api/billing/crypto-checkout.js`).
2. Generate an API key under Settings → Security.
3. Configure a webhook: Settings → Webhook subscriptions →
   `https://unifolio.ca/api/billing/webhook-crypto` → copy the shared
   secret.

```
COINBASE_COMMERCE_API_KEY         = your-api-key
COINBASE_COMMERCE_WEBHOOK_SECRET  = your-shared-secret
```

### Subscription caveat

Coinbase Commerce only supports one-time charges. For recurring crypto
billing we issue a fresh charge each period (annual or monthly) and email
the user a renewal link. That cron job isn't shipped yet — out of scope
for the initial billing rollout. If a user pays crypto on `pro`, they
get one billing period of access, then the plan auto-downgrades to `free`
when the period expires (the downgrade job is also a TODO; for now you'd
do it manually from Supabase).

---

## Currency support

| Currency | Card | ACSS Debit | Interac | Crypto |
|----------|------|------------|---------|--------|
| USD      | ✅    | ❌          | ❌       | ✅      |
| CAD      | ✅    | ✅          | ✅       | (auto-converted in USD) |

Users select their currency via the global currency switcher (top right of
the app). The Checkout UI grays out CAD-only methods (`acss_debit`,
`interac`) when the selected currency is USD.

---

## Refunds

- **Stripe**: Dashboard → Payments → refund the charge. The
  `customer.subscription.deleted` webhook fires automatically and our
  handler downgrades the user's plan to `free`.
- **Interac**: Send the e-Transfer back manually from your bank. Then
  update `billing_orders.status='refunded'` and downgrade the user's
  plan in `user_profiles`.
- **Crypto**: Refund the original wallet from your Coinbase Commerce
  dashboard. Then update `billing_orders.status='refunded'` and
  downgrade the user manually (no auto-downgrade webhook for refunds).

---

## Security checklist before going live

- [ ] All four env vars set in Vercel production environment (not just
      preview)
- [ ] Stripe webhook is configured for the live URL, not localhost
- [ ] Stripe is toggled to "Live mode" before flipping
      `STRIPE_SECRET_KEY` to the `sk_live_...` value
- [ ] `SUPABASE_SERVICE_KEY` is the service_role key, NOT the anon key
      (anon won't let the webhook bypass RLS)
- [ ] Test a full $1 charge end-to-end before announcing to users
- [ ] Add a `billing@unifolio.ca` forwarding rule so Interac
      notifications hit your phone

# Unifolio — Expenditure Ledger

Running list of every dollar spent on Unifolio. Update each row when you confirm an amount or add a charge. Items marked `?` are uncertain — replace with the actual figure when you check the receipt.

All figures in **CAD** unless otherwise noted. Convert USD charges at the rate on the date of the charge.

---

## Summary (as of 2026-05-13)

| Bucket | Monthly recurring (est.) | One-time to date | Annual run-rate (est.) |
|---|---|---|---|
| Software / subscriptions | ~$200 | — | ~$2,400 |
| Domains | — (annualized below) | $40 | ~$40 |
| Email | ~$30 | — | ~$360 |
| Legal / setup | — | $200 | — |
| **Total** | **~$230 / month** | **$240** | **~$2,800 / year** |

---

## Recurring monthly subscriptions

| Start date | Vendor | Plan | Amount (CAD) | Notes |
|---|---|---|---|---|
| ~2026-04 | base44 | Standard | $50 / month | Confirm exact start date and plan tier |
| ~2026-04 | Anthropic | Claude Max 5x | ~$100 / month `?` | Confirm exact plan + USD→CAD on first charge |
| ~2026-04 | OpenAI | ChatGPT Plus | $20 USD / month (~$27 CAD) | Confirm whether billed in USD |
| ~2026-04 | Email provider | Workspace plan | ~$30 / month `?` | Confirm provider (Google Workspace? Fastmail? Zoho?) and exact tier |

---

## Annual / domain renewals

| Renewal date | Vendor | Item | Amount (CAD) | Notes |
|---|---|---|---|---|
| Annually | IONOS / registrar | unifolio.pro domain | $20 / year `?` | Confirm registrar and renewal date |
| Annually | IONOS / registrar | unifolio.ca domain | $20 / year `?` | Confirm registrar and renewal date |

---

## One-time charges

| Date | Vendor | Item | Amount (CAD) | Notes |
|---|---|---|---|---|
| 2026-05-11 | Federal/Provincial registry | Corporation incorporation | $200 `?` | Confirm filing fee — federal incorporation is ~$200, provincial varies |

---

## Items to confirm next time you log in

- [ ] Exact base44 start date and plan tier
- [ ] Claude Max plan tier (5x vs 20x — pricing differs significantly) and USD billing rate
- [ ] ChatGPT Plus billing currency
- [ ] Email provider name + plan
- [ ] Domain registrar(s) and renewal dates for `unifolio.pro` and `unifolio.ca`
- [ ] Province of incorporation (federal $200 vs Ontario $300 vs other)
- [ ] Whether you've enrolled in any other paid services (Vercel Pro? Supabase Pro? Finnhub paid tier? Plaid sandbox vs production?)

---

## How to use this doc

1. **When a charge hits your card**, add a row to the matching table above. Keep the date column accurate — it's how you'll later reconstruct burn rate.
2. **Monthly review** (last Sunday of the month): read the Summary. If monthly recurring exceeds $300/month before you have any paying users, pause non-essential subs.
3. **Quarterly review**: total all rows in the past 90 days, divide by 3, and compare to the current month — any sub doubled? Any one-time spikes?
4. **Tax time** (year-end): every row here is a deductible business expense. Export to PDF and hand to your accountant with receipts.

---

## Future expected costs (when you scale)

These aren't billed yet — listed so you can plan.

| Trigger | Vendor | Plan | Estimate |
|---|---|---|---|
| First paying user | Vercel | Pro | $20 USD / mo |
| 100+ accounts | Supabase | Pro | $25 USD / mo + per-row |
| Plaid auto-sync launch | Plaid | Production | $0.25 USD / linked account / mo |
| Live quotes scale | Finnhub | Standard | $50 USD / mo |
| First $10K MRR | Lawyer (initial consult) | One-time | $1,000–$2,000 CAD |
| First $5K MRR | Cyber-liability insurance | Annual | $1,200–$2,400 CAD / year |
| First hire | Customer success contractor | Part-time | $1,500 CAD / mo |

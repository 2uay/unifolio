import { createClient } from '@supabase/supabase-js';
import { verifyCoinbaseSignature, readRawBody, TIERS } from './_helpers.js';

export const config = { api: { bodyParser: false } };

// POST /api/billing/webhook-crypto
// Coinbase Commerce webhook. Activates a user's plan on `charge:confirmed`
// (final, on-chain settlement) and logs failures otherwise.
//
// Note: Coinbase Commerce shut down new merchant signups in late 2024 for
// non-USDC payouts, but the webhook contract still works for USDC-only
// flows and the API is otherwise stable. If Coinbase Commerce becomes
// unviable, swap this endpoint for BTCPay Server (self-hosted, identical
// hosted-checkout UX) without changing the front-end.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const SECRET = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!SECRET) return res.status(503).json({ error: 'Coinbase webhook secret not configured' });

  const rawBody = await readRawBody(req);
  try {
    verifyCoinbaseSignature(rawBody, req.headers['x-cc-webhook-signature'], SECRET);
  } catch (err) {
    console.warn('[crypto/webhook] signature verification failed:', err?.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const charge = event?.event?.data;
  if (!charge) return res.status(200).json({ received: true });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  try {
    const type = event.event?.type;
    if (type === 'charge:confirmed') {
      const meta = charge.metadata || {};
      const userId = meta.user_id;
      const planId = meta.plan_id;
      if (!userId || !TIERS[planId]) {
        console.warn('[crypto/webhook] confirmed charge missing user/plan', { id: charge.id });
        return res.status(200).json({ received: true });
      }
      const extraAccounts = Math.max(0, parseInt(meta.extra_accounts || '0', 10));
      await supabase.from('user_profiles').upsert({
        user_id: userId,
        plan: planId,
        extra_accounts_paid: extraAccounts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      await supabase.from('billing_orders').update({
        status: 'paid',
        metadata: { ...meta, confirmed_at: new Date().toISOString() },
      }).eq('id', charge.id);
    } else if (type === 'charge:failed' || type === 'charge:delayed') {
      await supabase.from('billing_orders').update({ status: type.split(':')[1] }).eq('id', charge.id);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[crypto/webhook] handler failed:', err?.message);
    return res.status(500).json({ error: 'Handler error' });
  }
}

// Tiny client-side audit-log writer. Fire-and-forget — never blocks UI.
// Wraps the /api/audit/write endpoint with the current Supabase session JWT.
// Failures are logged but never thrown (audit writes are best-effort).

import { supabase } from '@/lib/supabaseClient';

export async function writeAudit(eventType, metadata = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return; // not signed in — nothing to log against
    // Fire-and-forget: don't await UI on this
    void fetch('/api/audit/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ event_type: eventType, metadata }),
    }).catch((err) => {
      console.warn('[auditLog] write failed:', err?.message || err);
    });
  } catch (err) {
    console.warn('[auditLog] session lookup failed:', err?.message || err);
  }
}

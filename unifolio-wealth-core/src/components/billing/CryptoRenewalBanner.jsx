// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

// Read the most-recent crypto renewal reminder from audit_log. Mounted in
// the authenticated app shell so it appears at the top of every page when
// a crypto user is within 14 days of expiry. Auto-dismisses (via
// localStorage) once acknowledged for the rest of the day.
const DISMISS_KEY = 'unifolio_crypto_renewal_dismissed_at';

function readDismissedAt() {
  if (typeof window === 'undefined') return 0;
  try { return parseInt(window.localStorage.getItem(DISMISS_KEY) || '0', 10) || 0; } catch { return 0; }
}

function writeDismissedAt(ts) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(DISMISS_KEY, String(ts)); } catch {}
}

export default function CryptoRenewalBanner() {
  const { user, isAuthenticated } = useAuth();
  const [dismissedAt, setDismissedAt] = React.useState(() => readDismissedAt());

  const { data: reminder } = useQuery({
    queryKey: ['cryptoRenewalReminder', user?.id],
    enabled: !!user?.id && isAuthenticated,
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('metadata, created_at')
        .eq('user_id', user.id)
        .eq('event_type', 'billing_crypto_renewal_reminder')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data || null;
    },
    refetchInterval: 60 * 60 * 1000, // hourly
  });

  if (!reminder) return null;
  const reminderTime = new Date(reminder.created_at).getTime();
  // Stale reminders (> 14 days) shouldn't appear. The cron writes a fresh
  // one daily while in-window, so anything older means the period expired
  // (now handled by the auto-downgrade path) or the cron stopped firing.
  if (Date.now() - reminderTime > 14 * 24 * 60 * 60 * 1000) return null;
  // Per-day dismissal — show again 24h after dismissal.
  if (dismissedAt > reminderTime && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return null;

  const meta = reminder.metadata || {};
  const planId = meta.plan_id || 'pro';
  const daysLeft = Number(meta.days_left ?? 14);
  const dismiss = () => {
    const now = Date.now();
    writeDismissedAt(now);
    setDismissedAt(now);
  };

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-xs">
        <p className="text-foreground/90">
          Your crypto-paid <span className="capitalize font-medium">{planId.replace('_', ' ')}</span> period
          ends in <span className="font-mono font-semibold">{daysLeft}</span> day{daysLeft === 1 ? '' : 's'}.
          <Link
            to={`/checkout?plan=${planId}&billing=annual&currency=USD`}
            className="ml-2 text-primary hover:underline font-medium"
          >
            Renew now →
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Dismiss for 24h"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

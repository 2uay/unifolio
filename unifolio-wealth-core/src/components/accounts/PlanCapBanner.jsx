// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { cn } from '@/lib/utils';

// Soft enforcement: never blocks an action, but surfaces the cap state so a
// user at/over their account limit can either upgrade or buy add-on slots.
// The hard cap (if any) is enforced server-side via Stripe entitlements once
// billing is wired; this banner is the UX layer.
export default function PlanCapBanner({ cap }) {
  if (!cap || cap.isUnlimited) return null;

  const { count, totalCap, remaining, atCap, overCap, addOnAllowed, addOnUnitPrice, addOnCurrency, plan } = cap;

  if (count === 0) return null;

  if (!atCap && remaining > 1) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            <span className="text-foreground font-medium">{count} of {totalCap}</span> accounts used on <span className="capitalize">{plan}</span>.
            {remaining > 0 && <> {remaining} {remaining === 1 ? 'slot' : 'slots'} remaining.</>}
          </span>
        </div>
        <Link to="/plans" className="text-primary hover:underline shrink-0">
          See plans
        </Link>
      </div>
    );
  }

  const accent = overCap ? 'border-rose-400/40 bg-rose-400/5' : 'border-amber-400/40 bg-amber-400/5';
  const iconAccent = overCap ? 'text-rose-400' : 'text-amber-400';
  const title = overCap ? 'Over plan limit' : 'At plan limit';
  const summary = overCap
    ? `You're using ${count} accounts on a plan that includes ${totalCap}. New imports may be rejected once server-side enforcement ships.`
    : `You've used all ${totalCap} accounts included with your ${plan} plan. Connecting another account will require an upgrade or add-on.`;

  return (
    <div className={cn('rounded-lg border px-4 py-3 space-y-3', accent)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', iconAccent)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pl-6">
        <Button size="sm" asChild className="text-xs h-8">
          <Link to="/plans">
            <ArrowUpRight className="w-3 h-3 mr-1" />
            Upgrade plan
          </Link>
        </Button>
        {addOnAllowed && addOnUnitPrice > 0 && (
          <Button size="sm" variant="outline" asChild className="text-xs h-8">
            <Link to={`/checkout?plan=${plan}&extra=1`}>
              Add 1 extra account — {formatCurrency(addOnUnitPrice, addOnCurrency, { decimals: 0 })}/mo
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// @ts-nocheck
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Mail, Loader2, Copy, CheckCircle2, AlertTriangle, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import {
  inviteSpouse, leaveHousehold, revokeInvite, transferHouseholdPrimary,
  getCurrentHousehold, getPendingInvites,
} from '@/lib/householdClient';

// /profile → Household section. Three states:
//   1. No household, no pending invites → "Invite spouse" form
//   2. Pending invite(s) sent → show pending list + share link
//   3. Household exists → roster + leave button (or primary controls)
//
// Whole feature degrades gracefully when api/household/* hasn't been
// deployed yet — every action surfaces a clean error toast.
export default function HouseholdSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { data: household, isLoading: householdLoading } = useQuery({
    queryKey: ['household', user?.id],
    queryFn: getCurrentHousehold,
    enabled: !!user?.id,
  });
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['householdInvites', user?.id],
    queryFn: getPendingInvites,
    enabled: !!user?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: (email) => inviteSpouse({ invitedEmail: email }),
    onMutate: () => setErrorMessage(null),
    onSuccess: (result) => {
      setGeneratedUrl(result.inviteUrl);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['householdInvites'] });
      queryClient.invalidateQueries({ queryKey: ['household'] });
    },
    onError: (err) => setErrorMessage(err?.message || 'Could not create invite'),
  });

  const leaveMutation = useMutation({
    mutationFn: leaveHousehold,
    onMutate: () => setErrorMessage(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household'] });
      queryClient.invalidateQueries({ queryKey: ['householdInvites'] });
    },
    onError: (err) => setErrorMessage(err?.message || 'Could not leave household'),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['householdInvites'] }),
  });

  const transferPrimaryMutation = useMutation({
    mutationFn: transferHouseholdPrimary,
    onMutate: () => setErrorMessage(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
    onError: (err) => setErrorMessage(err?.message || 'Could not transfer primary'),
  });

  const handleCopy = () => {
    if (!generatedUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (householdLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <p className="text-sm text-muted-foreground">Loading household…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground">Household (Spousal Linking)</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Link your spouse or common-law partner so Unifolio can flag cross-spousal
            superficial losses before you trade. CRA treats both of you as "affiliated
            persons" — if either spouse buys the same security within 30 days of the
            other selling at a loss, the loss is disallowed.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-400/5 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/85">{errorMessage}</p>
        </div>
      )}

      {household ? (
        <CurrentHousehold
          household={household}
          currentUserId={user?.id}
          onLeave={() => leaveMutation.mutate()}
          isLeaving={leaveMutation.isPending}
          onTransferPrimary={(uid) => transferPrimaryMutation.mutate(uid)}
          isTransferring={transferPrimaryMutation.isPending}
        />
      ) : (
        <InviteForm
          email={inviteEmail}
          onEmail={setInviteEmail}
          onSubmit={() => inviteMutation.mutate(inviteEmail.trim())}
          isSubmitting={inviteMutation.isPending}
          generatedUrl={generatedUrl}
          onCopy={handleCopy}
          copied={copied}
        />
      )}

      {pendingInvites.length > 0 && !household?.members?.find(m => m.role === 'spouse') && (
        <PendingInvitesList
          invites={pendingInvites}
          onRevoke={(id) => revokeMutation.mutate(id)}
          isRevoking={revokeMutation.isPending}
        />
      )}
    </div>
  );
}

function CurrentHousehold({ household, currentUserId, onLeave, isLeaving, onTransferPrimary, isTransferring }) {
  const otherMembers = household.members.filter(m => m.user_id !== currentUserId);
  const isPrimary = household.myRole === 'primary';
  const canDirectLeave = !isPrimary || otherMembers.length === 0;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/85">
          <p className="font-medium">Household active</p>
          <p className="mt-0.5 text-muted-foreground">
            Cross-spousal superficial-loss detection is enabled in the Harvest Center.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Members</p>
        {household.members.map(m => (
          <div key={m.user_id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-foreground/85 truncate">
                {m.user_id === currentUserId ? 'You' : m.user_id.slice(0, 8) + '…'}
              </span>
              <span className="capitalize text-muted-foreground">{m.role}</span>
            </div>
            {isPrimary && m.user_id !== currentUserId && m.role !== 'primary' && (
              <button
                type="button"
                onClick={() => onTransferPrimary?.(m.user_id)}
                disabled={isTransferring}
                className="text-[11px] text-primary hover:underline disabled:opacity-40 shrink-0"
                title="Make this member the household primary"
              >
                {isTransferring ? '…' : 'Make primary'}
              </button>
            )}
          </div>
        ))}
      </div>
      {isPrimary && otherMembers.length > 0 && !canDirectLeave && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          As the primary, you can't leave directly. Use "Make primary" above to transfer
          the role to a household member, then leave from the new spouse role.
        </p>
      )}
      <Button size="sm" variant="outline" onClick={onLeave} disabled={isLeaving || !canDirectLeave} className="text-xs gap-1.5">
        {isLeaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
        Leave household
      </Button>
    </div>
  );
}

function InviteForm({ email, onEmail, onSubmit, isSubmitting, generatedUrl, onCopy, copied }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1.5">
          Spouse's email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="partner@example.com"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={!email.trim() || isSubmitting}
            className="text-xs gap-1.5 whitespace-nowrap"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
            Create invite
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
          We don't send the email for you — you'll get a share link to send through
          your channel of choice. Invites expire in 14 days.
        </p>
      </div>

      {generatedUrl && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-primary">Invite link ready</p>
          <div className="flex gap-2 items-stretch">
            <code className="flex-1 text-[11px] bg-background border border-border rounded px-2 py-1.5 truncate font-mono">
              {generatedUrl}
            </code>
            <Button size="sm" variant="outline" onClick={onCopy} className="text-xs gap-1.5">
              {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Send this to your spouse. They need to sign up (or sign in) with the same
            email you invited, then visit the link.
          </p>
        </div>
      )}
    </div>
  );
}

function PendingInvitesList({ invites, onRevoke, isRevoking }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Pending invites</p>
      <div className="space-y-1.5">
        {invites.map(invite => (
          <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate">{invite.invited_email}</span>
              <span className="text-muted-foreground shrink-0">
                expires {new Date(invite.expires_at).toLocaleDateString()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRevoke(invite.id)}
              disabled={isRevoking}
              className="text-muted-foreground hover:text-foreground shrink-0"
              title="Revoke invite"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

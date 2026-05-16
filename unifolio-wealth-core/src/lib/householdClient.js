// @ts-nocheck
import { supabase } from '@/lib/supabaseClient';

async function authedFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  let parsed = null;
  try { parsed = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(parsed?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return parsed || {};
}

// All four actions are served by the consolidated /api/household/action
// dispatcher (routed via ?action=). The split into four exports here is
// for clarity at the call sites.
export function inviteSpouse({ invitedEmail, displayName } = {}) {
  return authedFetch('/api/household/action?action=invite', { invitedEmail, displayName });
}

export function acceptHouseholdInvite(token) {
  return authedFetch('/api/household/action?action=accept', { token });
}

export function leaveHousehold() {
  return authedFetch('/api/household/action?action=leave', {});
}

export function transferHouseholdPrimary(newPrimaryUserId) {
  return authedFetch('/api/household/action?action=transfer-primary', { newPrimaryUserId });
}

// Direct Supabase reads for "what's the current household state". RLS
// scopes everything to the caller.
export async function getCurrentHousehold() {
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role, joined_at, households(display_name, primary_user_id, created_at)')
    .maybeSingle();
  if (!membership) return null;
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .eq('household_id', membership.household_id);
  return {
    householdId: membership.household_id,
    myRole: membership.role,
    displayName: membership.households?.display_name,
    primaryUserId: membership.households?.primary_user_id,
    createdAt: membership.households?.created_at,
    members: members || [],
  };
}

export async function getPendingInvites() {
  const { data } = await supabase
    .from('household_invites')
    .select('id, invited_email, status, expires_at, created_at, invite_token')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function revokeInvite(inviteId) {
  const { error } = await supabase
    .from('household_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);
  if (error) throw error;
}

// Cross-household holdings via the SECURITY DEFINER function we registered
// in schema.sql. Returns rows for the caller AND any household co-member.
// Used by the harvest engine for cross-spouse superficial-loss detection
// and (eventually) by income-splitting tools.
export async function getHouseholdHoldings() {
  const { data, error } = await supabase.rpc('get_household_holdings');
  if (error) {
    if (/function .* does not exist/i.test(error.message)) return null; // schema not yet migrated
    throw error;
  }
  return data || [];
}

export async function getHouseholdRecentTransactions(sinceDays = 35) {
  const { data, error } = await supabase.rpc('get_household_recent_transactions', { since_days: sinceDays });
  if (error) {
    if (/function .* does not exist/i.test(error.message)) return null;
    throw error;
  }
  return data || [];
}

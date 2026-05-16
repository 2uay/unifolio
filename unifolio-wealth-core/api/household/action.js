import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

// POST /api/household/action?action=invite|accept|leave|transfer-primary
//
// Consolidated dispatcher to keep us under the Vercel Hobby 12-function
// cap. Each action validates its own body + permissions; the entry point
// only does auth.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = String(req.query?.action || '').toLowerCase();
  if (!['invite', 'accept', 'leave', 'transfer-primary'].includes(action)) {
    return res.status(400).json({ error: 'Unknown action — use ?action=invite|accept|leave|transfer-primary' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  let userId, userEmail;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });
    userId = data.user.id;
    userEmail = String(data.user.email || '').toLowerCase();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }

  if (action === 'invite') return handleInvite(req, res, { supabase, userId });
  if (action === 'accept') return handleAccept(req, res, { supabase, userId, userEmail });
  if (action === 'leave') return handleLeave(req, res, { supabase, userId });
  if (action === 'transfer-primary') return handleTransferPrimary(req, res, { supabase, userId });
}

// ─── INVITE ────────────────────────────────────────────────────
async function handleInvite(req, res, { supabase, userId }) {
  const invitedEmail = String(req.body?.invitedEmail || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim() || null;
  if (!invitedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(invitedEmail)) {
    return res.status(400).json({ error: 'invitedEmail is required and must be a valid email' });
  }

  let { data: existingHh, error: hhErr } = await supabase
    .from('households').select('id').eq('primary_user_id', userId).maybeSingle();
  if (hhErr) {
    console.error('[household/action:invite] lookup failed:', hhErr.message);
    return res.status(500).json({ error: 'Could not look up household' });
  }
  let householdId = existingHh?.id;
  if (!householdId) {
    const { data: createdHh, error: createErr } = await supabase
      .from('households').insert({ primary_user_id: userId, display_name: displayName })
      .select('id').single();
    if (createErr) {
      console.error('[household/action:invite] household insert failed:', createErr.message);
      return res.status(500).json({ error: 'Could not create household' });
    }
    householdId = createdHh.id;
    await supabase.from('household_members').insert({
      household_id: householdId, user_id: userId, role: 'primary',
    });
  }

  const { data: openInvite } = await supabase
    .from('household_invites').select('id')
    .eq('household_id', householdId).eq('invited_email', invitedEmail).eq('status', 'pending').maybeSingle();
  if (openInvite) {
    return res.status(409).json({ error: 'A pending invite already exists for this email' });
  }

  const inviteToken = randomBytes(32).toString('hex');
  const { data: invite, error: insertErr } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId, invited_email: invitedEmail, invite_token: inviteToken, invited_by: userId,
    })
    .select('id, invite_token, expires_at').single();
  if (insertErr) {
    console.error('[household/action:invite] insert failed:', insertErr.message);
    return res.status(500).json({ error: 'Could not create invite' });
  }

  const origin = (req.headers.origin || `https://${req.headers.host || 'unifolio.ca'}`).replace(/\/$/, '');
  return res.status(200).json({
    inviteId: invite.id,
    inviteUrl: `${origin}/household/accept?token=${invite.invite_token}`,
    expiresAt: invite.expires_at,
    invitedEmail,
  });
}

// ─── ACCEPT ────────────────────────────────────────────────────
async function handleAccept(req, res, { supabase, userId, userEmail }) {
  const inviteToken = String(req.body?.token || '').trim();
  if (!inviteToken) return res.status(400).json({ error: 'token is required' });

  const { data: invite, error: lookupErr } = await supabase
    .from('household_invites')
    .select('id, household_id, invited_email, status, expires_at, invited_by')
    .eq('invite_token', inviteToken).maybeSingle();
  if (lookupErr) {
    console.error('[household/action:accept] lookup failed:', lookupErr.message);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (!invite) return res.status(404).json({ error: 'Invite not found or already revoked' });
  if (invite.status !== 'pending') return res.status(409).json({ error: `Invite is ${invite.status}` });
  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from('household_invites').update({ status: 'expired' }).eq('id', invite.id);
    return res.status(410).json({ error: 'This invite has expired' });
  }
  if (invite.invited_email !== userEmail) {
    return res.status(403).json({ error: `This invite was sent to ${invite.invited_email}. Sign in with that email to accept.` });
  }
  if (invite.invited_by === userId) {
    return res.status(400).json({ error: 'You cannot accept your own invite' });
  }

  const { data: existing } = await supabase
    .from('household_members').select('household_id').eq('user_id', userId).maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'You\'re already in a household. Leave the current one first to accept a new invite.' });
  }

  const { error: memberErr } = await supabase
    .from('household_members').insert({ household_id: invite.household_id, user_id: userId, role: 'spouse' });
  if (memberErr) {
    console.error('[household/action:accept] member insert failed:', memberErr.message);
    return res.status(500).json({ error: 'Could not join household' });
  }

  await supabase.from('household_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  return res.status(200).json({ householdId: invite.household_id });
}

// ─── LEAVE ─────────────────────────────────────────────────────
async function handleLeave(req, res, { supabase, userId }) {
  const { data: membership } = await supabase
    .from('household_members').select('household_id, role').eq('user_id', userId).maybeSingle();
  if (!membership) return res.status(404).json({ error: 'You are not in a household' });

  if (membership.role === 'primary') {
    const { data: roster } = await supabase
      .from('household_members').select('user_id').eq('household_id', membership.household_id);
    const otherMembers = (roster || []).filter(m => m.user_id !== userId);
    if (otherMembers.length > 0) {
      return res.status(409).json({ error: 'You\'re the household primary. Remove other members first, then leave.' });
    }
    await supabase.from('households').delete().eq('id', membership.household_id);
    return res.status(200).json({ removed: true, deletedHousehold: true });
  }

  const { error: deleteErr } = await supabase
    .from('household_members').delete()
    .eq('household_id', membership.household_id).eq('user_id', userId);
  if (deleteErr) {
    console.error('[household/action:leave] delete failed:', deleteErr.message);
    return res.status(500).json({ error: 'Could not leave household' });
  }
  return res.status(200).json({ removed: true });
}

// ─── TRANSFER PRIMARY ──────────────────────────────────────────
async function handleTransferPrimary(req, res, { supabase, userId }) {
  const newPrimaryUserId = String(req.body?.newPrimaryUserId || '').trim();
  if (!newPrimaryUserId) return res.status(400).json({ error: 'newPrimaryUserId is required' });
  if (userId === newPrimaryUserId) return res.status(400).json({ error: 'You are already the primary' });

  const { data: callerMembership } = await supabase
    .from('household_members').select('household_id, role').eq('user_id', userId).maybeSingle();
  if (!callerMembership) return res.status(404).json({ error: 'You are not in a household' });
  if (callerMembership.role !== 'primary') {
    return res.status(403).json({ error: 'Only the household primary can transfer primary' });
  }

  const { data: targetMembership } = await supabase
    .from('household_members').select('household_id, role')
    .eq('user_id', newPrimaryUserId).eq('household_id', callerMembership.household_id).maybeSingle();
  if (!targetMembership) {
    return res.status(404).json({ error: 'Target user is not a member of your household' });
  }

  const { error: hhError } = await supabase
    .from('households').update({ primary_user_id: newPrimaryUserId })
    .eq('id', callerMembership.household_id).eq('primary_user_id', userId);
  if (hhError) {
    console.error('[household/action:transfer] households update failed:', hhError.message);
    return res.status(500).json({ error: 'Could not transfer primary' });
  }

  const { error: targetRoleError } = await supabase
    .from('household_members').update({ role: 'primary' })
    .eq('household_id', callerMembership.household_id).eq('user_id', newPrimaryUserId);
  if (targetRoleError) {
    console.error('[household/action:transfer] target role update failed:', targetRoleError.message);
    await supabase.from('households').update({ primary_user_id: userId }).eq('id', callerMembership.household_id);
    return res.status(500).json({ error: 'Could not promote target; transfer rolled back' });
  }

  const { error: callerRoleError } = await supabase
    .from('household_members').update({ role: 'spouse' })
    .eq('household_id', callerMembership.household_id).eq('user_id', userId);
  if (callerRoleError) {
    console.warn('[household/action:transfer] caller role demotion failed; household has two primaries until manually fixed');
  }

  return res.status(200).json({ ok: true, newPrimaryUserId });
}

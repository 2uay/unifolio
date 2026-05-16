import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

// POST /api/household/invite
// Body: { invitedEmail, displayName? }
// Auth: Supabase JWT (the inviter)
//
// Creates a household (if the inviter doesn't already have one) and a
// pending invite row. Returns { inviteUrl } the caller can share via
// the channel of their choice (we don't send the email automatically —
// avoids needing a transactional-email provider for the MVP).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  let userId;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });
    userId = data.user.id;
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const invitedEmail = String(req.body?.invitedEmail || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim() || null;
  if (!invitedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(invitedEmail)) {
    return res.status(400).json({ error: 'invitedEmail is required and must be a valid email' });
  }

  // Find or create the household where the inviter is primary.
  let { data: existingHh, error: hhErr } = await supabase
    .from('households')
    .select('id')
    .eq('primary_user_id', userId)
    .maybeSingle();
  if (hhErr) {
    console.error('[household/invite] household lookup failed:', hhErr.message);
    return res.status(500).json({ error: 'Could not look up household' });
  }
  let householdId = existingHh?.id;
  if (!householdId) {
    const { data: createdHh, error: createErr } = await supabase
      .from('households')
      .insert({ primary_user_id: userId, display_name: displayName })
      .select('id')
      .single();
    if (createErr) {
      console.error('[household/invite] household insert failed:', createErr.message);
      return res.status(500).json({ error: 'Could not create household' });
    }
    householdId = createdHh.id;
    // Make the primary user a member too — keeps household_members the single
    // source of truth for "who is in the household" (no need to UNION primary).
    await supabase.from('household_members').insert({
      household_id: householdId, user_id: userId, role: 'primary',
    });
  }

  // Block multiple pending invites to the same email — would create confusion
  // if the invitee gets two links.
  const { data: openInvite } = await supabase
    .from('household_invites')
    .select('id')
    .eq('household_id', householdId)
    .eq('invited_email', invitedEmail)
    .eq('status', 'pending')
    .maybeSingle();
  if (openInvite) {
    return res.status(409).json({ error: 'A pending invite already exists for this email' });
  }

  // 32 bytes hex = 256 bits of entropy. Plenty for an unguessable share-link.
  const inviteToken = randomBytes(32).toString('hex');
  const { data: invite, error: insertErr } = await supabase
    .from('household_invites')
    .insert({
      household_id: householdId,
      invited_email: invitedEmail,
      invite_token: inviteToken,
      invited_by: userId,
    })
    .select('id, invite_token, expires_at')
    .single();
  if (insertErr) {
    console.error('[household/invite] invite insert failed:', insertErr.message);
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

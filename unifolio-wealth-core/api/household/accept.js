import { createClient } from '@supabase/supabase-js';

// POST /api/household/accept
// Body: { token }
// Auth: Supabase JWT (the invitee, signed in with the same email the
// invite was addressed to)
//
// Validates the token, enforces email match + non-expiry, and adds the
// invitee as a household_member with role=spouse.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in to accept the invite' });

  const inviteToken = String(req.body?.token || '').trim();
  if (!inviteToken) return res.status(400).json({ error: 'token is required' });

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

  const { data: invite, error: lookupErr } = await supabase
    .from('household_invites')
    .select('id, household_id, invited_email, status, expires_at, invited_by')
    .eq('invite_token', inviteToken)
    .maybeSingle();
  if (lookupErr) {
    console.error('[household/accept] invite lookup failed:', lookupErr.message);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (!invite) return res.status(404).json({ error: 'Invite not found or already revoked' });
  if (invite.status !== 'pending') {
    return res.status(409).json({ error: `Invite is ${invite.status}` });
  }
  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from('household_invites').update({ status: 'expired' }).eq('id', invite.id);
    return res.status(410).json({ error: 'This invite has expired' });
  }
  if (invite.invited_email !== userEmail) {
    return res.status(403).json({
      error: `This invite was sent to ${invite.invited_email}. Sign in with that email to accept.`,
    });
  }
  if (invite.invited_by === userId) {
    return res.status(400).json({ error: 'You cannot accept your own invite' });
  }

  // Prevent the user from joining two different households simultaneously
  // (CRA affiliated-persons rules assume one spouse — we don't model
  // polyamorous filing units).
  const { data: existing } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    return res.status(409).json({
      error: 'You\'re already in a household. Leave the current one first to accept a new invite.',
    });
  }

  const { error: memberErr } = await supabase
    .from('household_members')
    .insert({ household_id: invite.household_id, user_id: userId, role: 'spouse' });
  if (memberErr) {
    console.error('[household/accept] member insert failed:', memberErr.message);
    return res.status(500).json({ error: 'Could not join household' });
  }

  await supabase
    .from('household_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  return res.status(200).json({ householdId: invite.household_id });
}

import { createClient } from '@supabase/supabase-js';

// POST /api/household/leave
// Auth: Supabase JWT
// Removes the caller from their current household. If the caller is the
// primary user AND the only member, the household is deleted entirely.
// If the caller is the primary with other members, the request is
// rejected (they must transfer primary first — TODO endpoint).
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

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return res.status(404).json({ error: 'You are not in a household' });

  if (membership.role === 'primary') {
    const { data: roster } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', membership.household_id);
    const otherMembers = (roster || []).filter(m => m.user_id !== userId);
    if (otherMembers.length > 0) {
      return res.status(409).json({
        error: 'You\'re the household primary. Remove other members first, then leave.',
      });
    }
    // Solo primary leaving → delete the household entirely (cascades to
    // members + pending invites).
    await supabase.from('households').delete().eq('id', membership.household_id);
    return res.status(200).json({ removed: true, deletedHousehold: true });
  }

  const { error: deleteErr } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', membership.household_id)
    .eq('user_id', userId);
  if (deleteErr) {
    console.error('[household/leave] member delete failed:', deleteErr.message);
    return res.status(500).json({ error: 'Could not leave household' });
  }
  return res.status(200).json({ removed: true });
}

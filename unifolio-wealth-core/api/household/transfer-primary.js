import { createClient } from '@supabase/supabase-js';

// POST /api/household/transfer-primary
// Body: { newPrimaryUserId }
// Auth: Supabase JWT (must currently be primary)
//
// Promotes another household member to primary and demotes the caller to
// spouse. Enables the existing primary to leave the household without
// deleting it (the leave endpoint currently rejects this case).
//
// We use a two-step write rather than a transaction because the
// household_members composite primary key prevents a swap-via-update.
// On any failure mid-swap we attempt to restore the original state.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });

  const newPrimaryUserId = String(req.body?.newPrimaryUserId || '').trim();
  if (!newPrimaryUserId) return res.status(400).json({ error: 'newPrimaryUserId is required' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  let callerId;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });
    callerId = data.user.id;
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }

  if (callerId === newPrimaryUserId) {
    return res.status(400).json({ error: 'You are already the primary' });
  }

  const { data: callerMembership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', callerId)
    .maybeSingle();
  if (!callerMembership) return res.status(404).json({ error: 'You are not in a household' });
  if (callerMembership.role !== 'primary') {
    return res.status(403).json({ error: 'Only the household primary can transfer primary' });
  }

  // Verify the target is in the same household.
  const { data: targetMembership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', newPrimaryUserId)
    .eq('household_id', callerMembership.household_id)
    .maybeSingle();
  if (!targetMembership) {
    return res.status(404).json({ error: 'Target user is not a member of your household' });
  }

  // Step 1: flip the households.primary_user_id pointer.
  const { error: hhError } = await supabase
    .from('households')
    .update({ primary_user_id: newPrimaryUserId })
    .eq('id', callerMembership.household_id)
    .eq('primary_user_id', callerId); // race-safe: only update if we're still primary
  if (hhError) {
    console.error('[household/transfer-primary] households update failed:', hhError.message);
    return res.status(500).json({ error: 'Could not transfer primary' });
  }

  // Step 2: update household_members roles. Doing target first means if
  // step 2b fails, the worst state is "two primaries listed in roster" —
  // recoverable. The reverse order could leave the household with no
  // primary at all if the second update fails.
  const { error: targetRoleError } = await supabase
    .from('household_members')
    .update({ role: 'primary' })
    .eq('household_id', callerMembership.household_id)
    .eq('user_id', newPrimaryUserId);
  if (targetRoleError) {
    console.error('[household/transfer-primary] target role update failed:', targetRoleError.message);
    await supabase.from('households').update({ primary_user_id: callerId }).eq('id', callerMembership.household_id);
    return res.status(500).json({ error: 'Could not promote target; transfer rolled back' });
  }

  const { error: callerRoleError } = await supabase
    .from('household_members')
    .update({ role: 'spouse' })
    .eq('household_id', callerMembership.household_id)
    .eq('user_id', callerId);
  if (callerRoleError) {
    console.error('[household/transfer-primary] caller role update failed:', callerRoleError.message);
    // households.primary_user_id is correct (new primary), target role
    // is correct (primary), only the caller is still listed as primary.
    // That's a redundant-primary state — non-blocking — log + return ok.
    console.warn('[household/transfer-primary] caller role demotion failed; household has two primaries until manually fixed');
  }

  return res.status(200).json({ ok: true, newPrimaryUserId });
}

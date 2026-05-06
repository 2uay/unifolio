import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { preferenceKey, preferenceValue } = await req.json();

    if (!preferenceKey) {
      return Response.json({ error: 'preferenceKey is required' }, { status: 400 });
    }

    // Find existing profile
    const existing = await base44.entities.UserProfile.filter({ user_id: user.id });

    if (existing.length === 0) {
      // Create new profile with the preference
      const newProfile = await base44.entities.UserProfile.create({
        user_id: user.id,
        user_email: user.email,
        full_name: user.full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        [preferenceKey]: preferenceValue
      });
      return Response.json({ success: true, profile: newProfile });
    }

    // Update existing profile
    const result = await base44.entities.UserProfile.update(existing[0].id, {
      [preferenceKey]: preferenceValue,
      updated_at: new Date().toISOString()
    });

    return Response.json({ success: true, profile: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
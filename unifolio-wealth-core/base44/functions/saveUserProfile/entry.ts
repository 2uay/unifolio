import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await req.json();

    // Find or create user profile
    const existing = await base44.entities.UserProfile.filter({ user_id: user.id });

    const profileData = {
      user_id: user.id,
      user_email: user.email,
      full_name: user.full_name,
      updated_at: new Date().toISOString(),
      ...updates
    };

    let result;
    if (existing.length > 0) {
      result = await base44.entities.UserProfile.update(existing[0].id, profileData);
    } else {
      profileData.created_at = new Date().toISOString();
      result = await base44.entities.UserProfile.create(profileData);
    }

    return Response.json({ success: true, profile: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await base44.entities.UserProfile.filter({ user_id: user.id });

    if (existing.length === 0) {
      return Response.json({ success: true, message: 'No profile picture to delete' });
    }

    const updated = await base44.entities.UserProfile.update(existing[0].id, {
      profile_picture_url: null,
      profile_picture_type: null,
      profile_picture_file_name: null,
      profile_picture_updated_at: null,
      updated_at: new Date().toISOString()
    });

    return Response.json({ success: true, profile: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
    const profile = profiles.length > 0 ? profiles[0] : null;

    return Response.json({ success: true, profile });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
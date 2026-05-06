import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all prediction market positions
    const positions = await base44.entities.PredictionMarketPosition.list();
    
    if (!positions || positions.length === 0) {
      return Response.json({ alerts: [], message: 'No positions to check' });
    }

    // Check for >10% changes
    const alerts = [];
    for (const position of positions) {
      const currentPrice = position.current_price || 0;
      const avgPrice = position.average_price || 0;
      
      if (avgPrice === 0) continue;
      
      const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;
      
      if (Math.abs(priceChange) > 10) {
        alerts.push({
          market: position.market_title,
          outcome: position.outcome,
          platform: position.platform,
          changePercent: priceChange.toFixed(2),
          currentPrice: currentPrice.toFixed(4),
          avgPrice: avgPrice.toFixed(4),
          status: position.status,
        });
      }
    }

    // Send email if alerts exist
    if (alerts.length > 0) {
      const subject = `Alert: ${alerts.length} prediction market position(s) changed >10%`;
      const body = `
Hi ${user.full_name || 'User'},

${alerts.length} of your prediction market position(s) have moved more than 10% since entry:

${alerts.map((a, i) => `
${i + 1}. ${a.market} - ${a.outcome}
   Platform: ${a.platform}
   Change: ${a.changePercent}%
   Current Price: ${a.currentPrice}
   Entry Price: ${a.avgPrice}
   Status: ${a.status}
`).join('\n')}

Log in to review your positions and decide if any action is needed.

—Unifolio Alerts
      `.trim();

      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject,
        body,
      });
    }

    return Response.json({
      success: true,
      alertsFound: alerts.length,
      alerts,
      emailSent: alerts.length > 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
);

const TOKEN = env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1503300617471524927';

// ─── Role Definitions ────────────────────────────────────────────────────────

const ROLES = [
  {
    name: 'Founder',
    color: 0xf59e0b,       // gold
    hoist: true,           // show separately in member list
    mentionable: false,
    permissions: [PermissionFlagsBits.Administrator],
    position: 10,
  },
  {
    name: 'Team',
    color: 0x7c3aed,       // purple
    hoist: true,
    mentionable: true,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseApplicationCommands,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.MentionEveryone,
    ],
    position: 9,
  },
  {
    name: 'Pro Member',
    color: 0x06b6d4,       // cyan
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseApplicationCommands,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
    ],
    position: 7,
  },
  {
    name: 'Beta Tester',
    color: 0x3b82f6,       // blue
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseApplicationCommands,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
    ],
    position: 6,
  },
  {
    name: 'Investor',
    color: 0x10b981,       // emerald — for serious/verified investors
    hoist: true,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseApplicationCommands,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
    ],
    position: 5,
  },
  {
    name: 'Community',
    color: 0x9ca3af,       // gray — default verified member
    hoist: false,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseApplicationCommands,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
    ],
    position: 4,
  },
  {
    name: 'Bot',
    color: 0x374151,       // dark gray — for bots
    hoist: false,
    mentionable: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AddReactions,
    ],
    position: 3,
  },
];

// ─── Channel Permission Model ─────────────────────────────────────────────────
//
// @everyone  → can only see #welcome and #rules (read-only)
// Community  → unlocks most channels (read + send)
// Beta Tester → Community + #beta-testers
// Investor    → Community + visible in member list
// Pro Member  → Community + #pro-lounge + #api-feedback
// Team        → everything + manage
// Founder     → Administrator

const CHANNEL_RULES = {
  // Read-only for everyone
  'welcome':             { readOnly: true, publicRead: true },
  'rules':               { readOnly: true, publicRead: true },

  // Team-send only, everyone can read
  'announcements':       { readOnly: true, publicRead: false, communityRead: true },
  'roadmap':             { readOnly: true, publicRead: false, communityRead: true },
  'changelog':           { readOnly: true, publicRead: false, communityRead: true },
  'faq':                 { readOnly: true, publicRead: false, communityRead: true },

  // Community read + send
  'general':             { communityFull: true },
  'portfolios':          { communityFull: true },
  'market-talk':         { communityFull: true },
  'prediction-markets':  { communityFull: true },
  'wins-and-losses':     { communityFull: true },
  'feature-requests':    { communityFull: true },
  'bug-reports':         { communityFull: true },
  'help':                { communityFull: true },
  'import-help':         { communityFull: true },
  'data-sources':        { communityFull: true },

  // Beta Tester only
  'beta-testers':        { betaOnly: true },

  // Pro Member only
  'pro-lounge':          { proOnly: true },
  'api-feedback':        { proOnly: true },
};

// ─── Updated Pinned Messages (unifolio.ca everywhere except Pro pricing) ──────

const UPDATED_MESSAGES = {
  'welcome': {
    embeds: [
      {
        color: 0x7c3aed,
        title: '◈  Welcome to Unifolio',
        description: '**Your personal portfolio command center.**\n\nUnifolio aggregates your investments across every brokerage, account, and asset class — giving you a single, unified view of your financial world. No more tab-switching. No more mental math.',
        fields: [
          {
            name: '⬡  What Unifolio Does',
            value: '```\n• Holdings across all accounts — stacked, sorted, heatmapped\n• Real-time P&L, unrealized + realized gains\n• 14-mode heatmaps (daily move, weight, volatility...)\n• IBKR Flex/CSV import — full trade history\n• Prediction market positions (Polymarket, Kalshi)\n• 48+ themes with live preview\n• Benchmarks: S&P 500, NASDAQ, BTC, Gold + more\n• Floating holdings window, fullscreen mode\n```',
          },
          {
            name: '⬡  Get Started',
            value: '🌐  **[unifolio.ca](https://unifolio.ca)** — launch the app\n📥  Import your IBKR export in Settings → Import Center\n🎨  Pick your theme in Settings → Appearance\n📊  Try Demo Mode to explore without an account\n💎  **[Go Pro](https://unifolio.pro)** — plans & pricing',
          },
          {
            name: '⬡  Server Guide',
            value: '`#announcements` — release notes and updates\n`#roadmap` — where we\'re headed\n`#feature-requests` — shape the product\n`#bug-reports` — help us ship quality\n`#help` — stuck? we\'ve got you',
          },
        ],
        footer: { text: 'unifolio.ca  ·  Built for serious investors' },
        timestamp: new Date().toISOString(),
      },
    ],
  },

  'rules': {
    embeds: [
      {
        color: 0x7c3aed,
        title: '◈  Community Rules',
        description: 'Unifolio is a small, focused community. Keep it that way.',
        fields: [
          { name: '1  ·  Be respectful', value: 'No harassment, personal attacks, or bad-faith arguments. Disagreements about finance or product direction are fine — hostility is not.', inline: false },
          { name: '2  ·  Stay on topic', value: 'Each channel has a purpose. `#market-talk` for macro takes. `#help` for support. `#general` for everything else. Don\'t spam unrelated content.', inline: false },
          { name: '3  ·  No financial advice', value: 'Unifolio is a portfolio tracker, not a trading platform. Nothing said in this server is financial advice. Do your own research.', inline: false },
          { name: '4  ·  No spam or self-promotion', value: 'No referral links, affiliate codes, pump posts, or unsolicited promotions. This includes DMs.', inline: false },
          { name: '5  ·  Bug reports belong in #bug-reports', value: 'If you found something broken, use the pinned template. Venting in `#general` doesn\'t get it fixed faster.', inline: false },
          { name: '6  ·  Constructive only in #feature-requests', value: 'Feature ideas should be clear and actionable. "Make it better" isn\'t a feature request.', inline: false },
          { name: '⚠  Enforcement', value: 'Violations result in a warning, then a timeout, then a permanent ban. No appeals for ban evasion.', inline: false },
        ],
        footer: { text: 'Questions about rules? DM an admin.' },
      },
    ],
  },

  'roadmap': {
    embeds: [
      {
        color: 0x7c3aed,
        title: '◈  Unifolio Roadmap',
        description: 'Where we started, where we are, and where we\'re going. Updated as milestones are hit.',
      },
      {
        color: 0x10b981,
        title: '✦  Phase 1 — Foundation  ·  COMPLETE',
        description: 'Core portfolio infrastructure and the initial product experience.',
        fields: [
          {
            name: 'Shipped',
            value: '```diff\n+ Holdings table with full column customization\n+ 14-mode heatmap system (daily move, weight, vol...)\n+ Stack Assets — aggregate same ticker across accounts\n+ IBKR Flex/CSV importer with full trade history\n+ Supabase backend — persistent portfolio data\n+ Real-time prices via Finnhub API\n+ Real benchmark comparison (S&P, NASDAQ, BTC, Gold)\n+ 48+ themes with live preview\n+ Prediction markets positions tracker\n+ Floating + fullscreen holdings window\n+ Demo mode — full experience without an account\n+ Realized positions view with lot-level detail\n+ Profile, Settings, Auth (Supabase)\n```',
          },
        ],
      },
      {
        color: 0xf59e0b,
        title: '◆  Phase 2 — Connectivity  ·  IN PROGRESS  ◄ WE ARE HERE',
        description: 'Automated data sync so imports are never manual again.',
        fields: [
          {
            name: 'In Progress',
            value: '```diff\n~ Plaid integration — bank + brokerage live sync\n~ Plans page — financial goal tracking\n~ Profile page — public portfolio snapshots\n~ Pro landing page — paid tier infrastructure\n```',
          },
          {
            name: 'Planned',
            value: '```diff\n- Questrade + Wealthsimple direct API sync\n- Automatic nightly portfolio snapshots\n- Multi-currency normalization (CAD/USD/GBP)\n- Options positions (calls/puts with greeks)\n- Crypto wallet connect (Metamask, Ledger)\n```',
          },
        ],
      },
      {
        color: 0x3b82f6,
        title: '◇  Phase 3 — Intelligence  ·  PLANNED',
        description: 'AI-powered insights and proactive portfolio analysis.',
        fields: [
          {
            name: 'Coming',
            value: '```diff\n- AI portfolio analyst — natural language Q&A\n- Concentration risk alerts\n- Sector + geography diversification scoring\n- Tax loss harvesting suggestions\n- Performance attribution (what actually drove returns)\n- Earnings calendar overlaid on holdings\n- Insider transaction alerts for held positions\n```',
          },
        ],
      },
      {
        color: 0x6b7280,
        title: '◇  Phase 4 — Scale  ·  FUTURE',
        description: 'Mobile, social, and team features.',
        fields: [
          {
            name: 'Vision',
            value: '```diff\n- Native iOS + Android app\n- Shared portfolios + team workspaces\n- Advisor dashboard (manage multiple clients)\n- API access for power users\n- White-label for family offices\n```',
          },
        ],
      },
      {
        color: 0x7c3aed,
        title: '◈  Current Focus',
        description: '**We are in Phase 2.** Plaid integration is the primary engineering focus — this unlocks automatic sync and removes the manual import step entirely. Once live, no one should have to upload a CSV again.\n\nHave a priority you\'d like to shift? Vote in `#feature-requests`.',
        footer: { text: 'Last updated: May 2026  ·  unifolio.ca' },
      },
    ],
  },

  'announcements': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Announcements',
      description: 'This channel is where all official Unifolio updates are posted — new features, performance improvements, scheduled maintenance, and breaking changes.\n\n**Subscribe to this channel** (right-click → Notification Settings → All Messages) so you never miss a release.',
      fields: [
        { name: 'Release cadence', value: 'We ship continuously. Major feature drops get an announcement here. Bug fixes and polish are batched into weekly notes.', inline: false },
        { name: 'Downtime', value: 'Any planned maintenance will be posted here at least 1 hour in advance. Unplanned outages are posted as soon as we\'re aware.', inline: false },
      ],
      footer: { text: 'unifolio.ca is deployed on Vercel — 99.9% uptime SLA' },
    }],
  },

  'changelog': {
    embeds: [{
      color: 0x10b981,
      title: '◈  Changelog  ·  Latest Release',
      description: 'Full history of every meaningful change to Unifolio.',
      fields: [
        { name: 'v0.9  ·  May 2026', value: '```diff\n+ Plaid integration (in progress)\n+ Plans page scaffolded\n+ Pro landing page\n+ Profile page\n+ Password reset flow\n```' },
        { name: 'v0.8  ·  May 2026', value: '```diff\n+ IBKR Flex/CSV importer with full realized position reconstruction\n+ Supabase portfolio persistence (holdings, transactions, realized)\n+ Import Center with preview tabs before save\n+ Imported data flows to all pages (Dashboard, Holdings, Accounts...)\n```' },
        { name: 'v0.7  ·  May 2026', value: '```diff\n+ Stack Assets toggle — aggregate same ticker across all accounts\n+ Heatmap hover preview — preview any mode without committing\n+ Holdings extracted into floating + fullscreen panel\n+ Real benchmark data (Yahoo Finance proxy)\n+ Concentration heatmap follows active theme color\n```' },
        { name: 'v0.6  ·  May 2026', value: '```diff\n+ Real-time prices via Finnhub API (15-min cache)\n+ Supabase auth — sign up, login, profile\n+ Full Name editable in Settings\n+ Profile picture upload with Supabase Storage\n+ 48+ themes with live preview + wave background\n+ Demo mode — full experience without account\n```' },
        { name: 'v0.5  ·  April 2026', value: '```diff\n+ 14-mode heatmap system\n+ Realized positions with purchase lot detail\n+ StockChart in holding breakdown (1M/3M/1Y, crosshair)\n+ Prediction markets positions tracker\n+ Watchlist with Explore carousel\n```' },
      ],
      footer: { text: 'Full history in #roadmap  ·  unifolio.ca' },
    }],
  },

  'feature-requests': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Feature Requests',
      description: 'Have an idea that would make Unifolio better? Post it here.\n\n**React 👍 on requests you want to see built.** The most upvoted ideas move up the roadmap.',
      fields: [
        { name: 'How to write a good request', value: '```\n1. What problem does it solve?\n2. How do you currently work around it?\n3. What would the ideal solution look like?\n4. How often would you use it?\n```' },
        { name: 'What gets prioritized', value: 'Requests that align with Phase 2/3 of the roadmap, have multiple upvotes, and have a clear use case. Niche edge cases are logged but lower priority.' },
        { name: 'Already planned?', value: 'Check `#roadmap` first. If your idea is already there, react to the roadmap message instead of creating a duplicate.' },
      ],
      footer: { text: 'We read every request. We don\'t reply to all of them.' },
    }],
  },

  'bug-reports': {
    embeds: [{
      color: 0xef4444,
      title: '◈  Bug Reports',
      description: 'Found something broken? Use the template below. Complete reports get fixed faster.',
      fields: [
        { name: 'Bug Report Template', value: '```\n**What happened:**\n[Describe what went wrong]\n\n**Expected behavior:**\n[What should have happened]\n\n**Steps to reproduce:**\n1. Go to...\n2. Click...\n3. See error\n\n**Environment:**\nBrowser: Chrome / Firefox / Safari\nOS: Mac / Windows / iOS / Android\nAccount type: Demo / Signed in\n\n**Screenshot / error message:**\n[Attach if possible]\n```' },
        { name: 'Priority guide', value: '🔴  **Critical** — data loss, auth broken, nothing loads\n🟠  **High** — feature completely broken\n🟡  **Medium** — feature works but incorrectly\n⚪  **Low** — visual glitch, minor annoyance' },
        { name: 'Before you post', value: '• Hard refresh first (`Cmd+Shift+R`)\n• Try in an incognito window\n• Check if it happens in demo mode too' },
      ],
      footer: { text: 'Critical bugs are patched same-day when possible.' },
    }],
  },

  'beta-testers': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Beta Testers',
      description: 'You\'re in the early access group. This means you see features before anyone else — and your feedback directly shapes what ships.\n\nWe move fast. Expect rough edges. Tell us about them.',
      fields: [
        { name: 'What we need from you', value: '• Try new features the day they\'re announced\n• Report anything that feels off, even if it\'s not broken\n• Tell us what\'s confusing, not just what\'s wrong\n• Share your actual workflow — how do you use the app?', inline: false },
        { name: 'Current beta focus', value: 'Plaid integration — automated brokerage sync. If you want to test it before it goes live, drop a message here.', inline: false },
        { name: 'Access', value: 'Beta features are toggled per-account. If you\'re in this channel, you\'re eligible. DM an admin to enable specific experiments.', inline: false },
      ],
      footer: { text: 'Beta testers get Pro access free during the testing period.' },
    }],
  },

  'general': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  General',
      description: 'The main room. Talk about anything — Unifolio, investing, the market, what you\'re building, whatever.\n\nKeep it chill. Keep it constructive.',
      fields: [
        { name: 'Good topics', value: 'Unifolio UX opinions · portfolio strategy · broker comparisons · what data you wish you had · what you\'d build if you were us', inline: false },
        { name: 'Wrong channel?', value: '`#market-talk` for stock/macro takes\n`#portfolios` for sharing positions\n`#help` if you need support\n`#feature-requests` for product ideas', inline: false },
      ],
    }],
  },

  'portfolios': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Portfolios',
      description: 'Share your setup. Allocation breakdowns, sector bets, position sizing, account structure — whatever you\'re comfortable sharing.\n\nNo judgment. No advice-giving. Just transparency.',
      fields: [
        { name: 'What to share', value: '• Holdings breakdown (% allocation, not necessarily $ amounts)\n• Account structure (TFSA / RRSP / taxable / etc.)\n• Broker setup — what you use and why\n• Before/after a rebalance\n• Screenshots from Unifolio (use privacy mode if needed)', inline: false },
        { name: 'Rules', value: '• No pumping your own positions\n• No asking others to copy you\n• Label speculative positions clearly', inline: false },
      ],
      footer: { text: 'Nothing here is financial advice.' },
    }],
  },

  'market-talk': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Market Talk',
      description: 'Stocks, ETFs, crypto, macro, rates, earnings, geopolitics — if it moves markets, it belongs here.',
      fields: [
        { name: 'Ground rules', value: '• Label opinions as opinions\n• No price targets presented as fact\n• Earnings discussion welcome — insider info is not\n• Crypto is fine. Shitcoin pumping is not.', inline: false },
        { name: 'Useful context to include', value: 'Ticker · timeframe · thesis · what would change your mind', inline: false },
      ],
      footer: { text: 'Nothing here is financial advice.' },
    }],
  },

  'prediction-markets': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Prediction Markets',
      description: 'Polymarket, Kalshi, Manifold, and any other forecasting platform — positions, analysis, and discussion.\n\nUnifolio has a built-in prediction markets tracker. Share your positions, debate probabilities, and track your calibration.',
      fields: [
        { name: 'Useful to share', value: '• Current positions and reasoning\n• Resolution surprises (were the markets right?)\n• Markets you think are mispriced\n• Strategies for sizing positions', inline: false },
        { name: 'Platforms tracked in Unifolio', value: 'Polymarket · Kalshi · Manifold · PredictIt', inline: false },
      ],
      footer: { text: 'Prediction markets ≠ financial advice.' },
    }],
  },

  'wins-and-losses': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Wins & Losses',
      description: 'Brag or vent. Share the P&L. The good ones and the painful ones.\n\nThe only rule: be honest. A loss posted here helps someone else avoid it.',
      fields: [
        { name: 'Format suggestion', value: '```\nTicker: $XXX\nEntry: $00.00  Exit: $00.00\nReturn: +/- XX%\nLesson: [what you learned]\n```', inline: false },
        { name: 'Normalized encouraged', value: 'Sharing % returns rather than $ amounts keeps it useful for everyone regardless of portfolio size.', inline: false },
      ],
      footer: { text: 'Nothing here is financial advice.' },
    }],
  },

  'faq': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Frequently Asked Questions',
      description: 'Read this before posting in `#help`.',
      fields: [
        { name: 'Is Unifolio free?', value: 'Yes — the core product is free at **[unifolio.ca](https://unifolio.ca)**. A Pro tier is coming with advanced features — see **[unifolio.pro](https://unifolio.pro)** for plans. Beta testers get Pro free during testing.', inline: false },
        { name: 'Which brokers are supported?', value: 'IBKR (Flex Query + Activity Statement CSV) is fully supported with complete trade history. Plaid integration (automatic sync for 12,000+ institutions) is in progress.', inline: false },
        { name: 'Is my data safe?', value: 'Holdings are stored in your own Supabase database. We never store raw broker files. API keys are environment-variable only, never logged.', inline: false },
        { name: 'How do I import from IBKR?', value: 'Go to Import Center in the app. Download a Flex Query or Activity Statement from IBKR, upload it, preview your holdings and transactions, then confirm. Full instructions in `#import-help`.', inline: false },
        { name: 'Why are my prices slightly off?', value: 'Unifolio uses Finnhub (free tier, 15-min delay) for price quotes. Real-time prices require a paid data subscription — coming in a future update.', inline: false },
        { name: 'Can I use it without importing?', value: 'Yes. Demo mode has a full sample portfolio pre-loaded. You can also explore all features without connecting a real account.', inline: false },
        { name: 'Where do I report bugs?', value: 'Use the template in `#bug-reports`. Screenshots help.', inline: false },
        { name: 'I have a feature idea', value: 'Post it in `#feature-requests` using the template. React 👍 to existing requests you want.', inline: false },
      ],
      footer: { text: 'Still stuck? Ask in #help.' },
    }],
  },

  'help': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Help',
      description: 'Stuck? Ask here. The community and the Unifolio team both monitor this channel.',
      fields: [
        { name: 'Before you ask', value: '1. Check `#faq` — most common issues are answered there\n2. Try a hard refresh (`Cmd+Shift+R` or `Ctrl+Shift+R`)\n3. Try in an incognito window\n4. Check if it\'s a known issue in `#announcements`' },
        { name: 'When you ask, include', value: '• What you\'re trying to do\n• What\'s happening instead\n• Your browser and OS\n• Whether you\'re in demo mode or signed in' },
        { name: 'Response time', value: 'Community: usually fast. Team: within 24 hours on weekdays.' },
      ],
      footer: { text: 'Bugs go in #bug-reports, not here.' },
    }],
  },

  'import-help': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Import Help',
      description: 'Everything you need to get your portfolio data into Unifolio.',
      fields: [
        { name: 'IBKR — Flex Query (recommended)', value: '```\n1. Log in to IBKR Client Portal\n2. Go to Reports → Flex Queries\n3. Create a new query:\n   - Positions: Current + Closed\n   - Trades: All\n   - Dividends, Fees, Cash: All\n4. Run and download as CSV\n5. Upload in Unifolio → Import Center\n```' },
        { name: 'IBKR — Activity Statement', value: '```\n1. Reports → Activity\n2. Select date range (YTD or All)\n3. Format: CSV\n4. Download and upload to Import Center\n```' },
        { name: 'Other brokers', value: 'Plaid integration (automatic sync) is coming and will support 12,000+ institutions. Until then, manual CSV from your broker\'s export tool may work — try it and report results in this channel.' },
        { name: 'Common issues', value: '**"No positions found"** — make sure Positions section is included in your Flex Query\n**"Parse error"** — try re-exporting with UTF-8 encoding\n**Missing tickers** — Canadian stocks may need `.TO` suffix' },
      ],
      footer: { text: 'Full instructions at unifolio.ca/instructions' },
    }],
  },

  'data-sources': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  Data Sources',
      description: 'Where Unifolio\'s data comes from and what the limitations are.',
      fields: [
        { name: 'Price Data — Finnhub', value: 'Free tier · 60 calls/min · 15-minute delay · Cached in localStorage for 15 min\nCanadian stocks: `.TO` suffix converted to `:TSX` format automatically', inline: false },
        { name: 'Benchmark Data — Yahoo Finance', value: 'Fetched via proxy · Cached in localStorage · Symbols: `^GSPC` (S&P), `^NDX` (NASDAQ), `BTC-USD`, `GC=F` (Gold), `VTI`, `XIC.TO`\nFalls back to synthetic data if API is unavailable', inline: false },
        { name: 'Portfolio Data — Your Import / Supabase', value: 'Holdings, transactions, and realized positions come from your IBKR import, stored in your Supabase project. We never see your raw data.', inline: false },
        { name: 'Known gaps', value: '• Options positions: not yet supported\n• Crypto prices: Finnhub covers major coins only\n• Forex: static rates (live FX coming)\n• Real-time prices: 15-min delay on free tier', inline: false },
        { name: 'Coming', value: 'Plaid will add live brokerage sync. Paid Finnhub tier will unlock real-time prices.', inline: false },
      ],
      footer: { text: 'Questions about a specific data gap? Ask here.' },
    }],
  },

  'pro-lounge': {
    embeds: [{
      color: 0xf59e0b,
      title: '◈  Pro Lounge',
      description: 'This channel is for Pro members and beta testers.\n\nThanks for being here early. You\'re shaping what Unifolio becomes.',
      fields: [
        { name: 'Current Pro benefits', value: '• Early access to all new features\n• Priority support\n• Direct line to the founder in this channel\n• Free during beta', inline: false },
        { name: 'Coming Pro features', value: '• Unlimited imports\n• AI portfolio analyst\n• Real-time price tier\n• Advanced tax reporting\n• API access\n• Team workspaces', inline: false },
        { name: 'Pro plans', value: 'See **[unifolio.pro](https://unifolio.pro)** for pricing and plan details.', inline: false },
        { name: 'What we want from you', value: 'Honest feedback. What\'s missing? What\'s friction? What would make you pay for this without thinking twice?', inline: false },
      ],
      footer: { text: 'Pro pricing announced here first  ·  unifolio.pro' },
    }],
  },

  'api-feedback': {
    embeds: [{
      color: 0x7c3aed,
      title: '◈  API & Integrations Feedback',
      description: 'For power users who care about the data layer — integrations, APIs, data quality, and technical architecture.',
      fields: [
        { name: 'Current integrations', value: '• Finnhub (prices)\n• Yahoo Finance (benchmarks)\n• Supabase (auth + storage)\n• IBKR Flex/CSV (import)\n• Plaid (in progress)', inline: false },
        { name: 'Discuss here', value: '• Data quality issues for specific tickers or asset classes\n• Broker integration requests with priority reasoning\n• API rate limit workarounds\n• CSV format variations across brokers\n• Webhook / automation ideas', inline: false },
        { name: 'API access', value: 'A Unifolio public API is on the Phase 4 roadmap. If you have a use case that needs it sooner, make the case here.', inline: false },
      ],
      footer: { text: 'Technical depth welcome here.' },
    }],
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`Connected to: ${guild.name}\n`);

  // ── Step 1: Create roles ───────────────────────────────────────────────────
  console.log('── Creating roles ──');
  const existingRoles = await guild.roles.fetch();
  const roleMap = {};

  for (const roleDef of ROLES) {
    const existing = existingRoles.find(r => r.name === roleDef.name);
    let role;
    if (existing) {
      role = await existing.edit({
        color: roleDef.color,
        hoist: roleDef.hoist,
        mentionable: roleDef.mentionable,
        permissions: roleDef.permissions.reduce((a, b) => a | b, 0n),
      });
      console.log(`  ~ ${roleDef.name} — updated`);
    } else {
      role = await guild.roles.create({
        name: roleDef.name,
        color: roleDef.color,
        hoist: roleDef.hoist,
        mentionable: roleDef.mentionable,
        permissions: roleDef.permissions.reduce((a, b) => a | b, 0n),
      });
      console.log(`  + ${roleDef.name} — created`);
    }
    roleMap[roleDef.name] = role;
  }

  const everyoneRole = guild.roles.everyone;
  const communityRole = roleMap['Community'];
  const betaRole = roleMap['Beta Tester'];
  const proRole = roleMap['Pro Member'];
  const teamRole = roleMap['Team'];

  // ── Step 2: Set channel permissions ───────────────────────────────────────
  console.log('\n── Setting channel permissions ──');
  const channels = await guild.channels.fetch();

  // Strip @everyone from seeing everything by default
  await everyoneRole.setPermissions(0n);

  for (const [chName, rules] of Object.entries(CHANNEL_RULES)) {
    const channel = channels.find(c => c?.name === chName && c.isTextBased());
    if (!channel) { console.log(`  ✗ #${chName} not found`); continue; }

    const overwrites = [];

    // @everyone — always deny view by default
    overwrites.push({ id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

    if (rules.publicRead) {
      // welcome, rules — everyone can read
      overwrites[0] = { id: everyoneRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages] };
    }

    if (rules.communityRead || rules.communityFull) {
      overwrites.push({
        id: communityRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AddReactions,
          ...(rules.communityFull ? [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] : []),
        ],
        deny: rules.communityRead ? [PermissionFlagsBits.SendMessages] : [],
      });
      // Investor + Beta Tester + Pro Member inherit community access
      for (const r of [roleMap['Investor'], betaRole, proRole]) {
        overwrites.push({
          id: r.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions,
            ...(rules.communityFull ? [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] : []),
          ],
        });
      }
    }

    if (rules.betaOnly) {
      overwrites.push({
        id: betaRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
      });
    }

    if (rules.proOnly) {
      overwrites.push({
        id: proRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
      });
    }

    // Team always gets full access
    overwrites.push({
      id: teamRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    });

    // Bot role always gets send + manage
    overwrites.push({
      id: roleMap['Bot'].id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
      ],
    });

    await channel.permissionOverwrites.set(overwrites);
    console.log(`  ✓ #${chName}`);
  }

  // ── Step 3: Edit pinned messages with updated URLs ─────────────────────────
  console.log('\n── Updating pinned messages ──');
  for (const [chName, content] of Object.entries(UPDATED_MESSAGES)) {
    const channel = channels.find(c => c?.name === chName && c.isTextBased());
    if (!channel) { console.log(`  ✗ #${chName} not found`); continue; }

    try {
      const pins = await channel.messages.fetchPinned();
      const botPin = pins.find(m => m.author.id === client.user.id);
      if (botPin) {
        await botPin.edit(content);
        console.log(`  ✓ #${chName} — updated`);
      } else {
        const msg = await channel.send(content);
        await msg.pin();
        console.log(`  ✓ #${chName} — posted + pinned (new)`);
      }
    } catch (e) {
      console.log(`  ✗ #${chName} — ${e.message}`);
    }
  }

  console.log('\nAll done.');
  client.destroy();
});

client.login(TOKEN);

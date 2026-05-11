import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
);

const TOKEN = env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1503300617471524927';

const LOGO = 'https://unifolio.ca/logo.png';

// For each channel, fetch the bot's pinned message(s) and inject the logo
// as a thumbnail on the FIRST embed (visible, dominant, not overpowering)
const CHANNELS = [
  'welcome', 'rules', 'announcements', 'roadmap',
  'feature-requests', 'bug-reports', 'beta-testers', 'changelog',
  'general', 'portfolios', 'market-talk', 'prediction-markets', 'wins-and-losses',
  'faq', 'help', 'import-help', 'data-sources',
  'pro-lounge', 'api-feedback',
];

// Channels where the logo goes as a full image (bottom) instead of thumbnail
// — roadmap has multiple embeds so we put it on the header embed only
const USE_IMAGE = [];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = await client.guilds.fetch(GUILD_ID);
  const allChannels = await guild.channels.fetch();
  console.log(`Connected to: ${guild.name}\n`);

  for (const chName of CHANNELS) {
    const channel = allChannels.find(c => c?.name?.includes(chName) && c.isTextBased());
    if (!channel) { console.log(`  ✗ ${chName} — not found`); continue; }

    try {
      const pinsResult = await channel.messages.fetchPins();
      const rawItems = pinsResult?.items ?? [];
      // discord.js v15: items are { pinnedTimestamp, message } objects
      const pinsArr = rawItems.map(i => i.message ?? i);
      const botPin = pinsArr.find(m => m?.author?.id === client.user.id);
      if (!botPin) { console.log(`  ✗ ${chName} — no pinned bot message`); continue; }

      // Clone all embeds, inject thumbnail into first one
      const embeds = botPin.embeds.map((e, idx) => {
        const raw = e.toJSON();
        if (idx === 0) {
          raw.thumbnail = { url: LOGO };
        }
        return raw;
      });

      await botPin.edit({ embeds });
      console.log(`  ✓ ${chName}`);
    } catch (err) {
      console.log(`  ✗ ${chName} — ${err.message}`);
    }
  }

  console.log('\nAll embeds updated with logo.');
  client.destroy();
});

client.login(TOKEN);

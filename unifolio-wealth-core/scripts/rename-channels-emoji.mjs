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

// Rainbow gradient top → bottom across all 19 channels
// Red → Orange → Yellow → Yellow-green → Green → Teal → Cyan → Blue → Indigo → Violet
const CHANNEL_RENAMES = [
  // WELCOME category
  { old: 'welcome',             name: '🌸・welcome' },
  { old: 'rules',               name: '🌺・rules' },
  { old: 'announcements',       name: '🔴・announcements' },
  { old: 'roadmap',             name: '🟠・roadmap' },

  // PRODUCT category
  { old: 'feature-requests',    name: '🟡・feature-requests' },
  { old: 'bug-reports',         name: '🟨・bug-reports' },
  { old: 'beta-testers',        name: '🌿・beta-testers' },
  { old: 'changelog',           name: '🍀・changelog' },

  // COMMUNITY category
  { old: 'general',             name: '🌊・general' },
  { old: 'portfolios',          name: '🩵・portfolios' },
  { old: 'market-talk',         name: '🔵・market-talk' },
  { old: 'prediction-markets',  name: '💙・prediction-markets' },
  { old: 'wins-and-losses',     name: '🫐・wins-and-losses' },

  // SUPPORT category
  { old: 'faq',                 name: '💜・faq' },
  { old: 'help',                name: '🪻・help' },
  { old: 'import-help',         name: '🌸・import-help' },
  { old: 'data-sources',        name: '🌷・data-sources' },

  // PRO MEMBERS category
  { old: 'pro-lounge',          name: '✨・pro-lounge' },
  { old: 'api-feedback',        name: '💎・api-feedback' },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = await client.guilds.fetch(GUILD_ID);
  const channels = await guild.channels.fetch();
  console.log(`Connected to: ${guild.name}\n`);

  for (const { old, name } of CHANNEL_RENAMES) {
    const channel = channels.find(c => c?.name === old || c?.name === name);
    if (!channel) { console.log(`  ✗ ${old} — not found`); continue; }
    await channel.setName(name);
    console.log(`  ✓ ${old} → ${name}`);
  }

  console.log('\nDone.');
  client.destroy();
});

client.login(TOKEN);

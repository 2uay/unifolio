import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { readFileSync } from 'fs';

// Read token from .env.local
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
);

const TOKEN = env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1503300617471524927';

const structure = [
  {
    name: 'WELCOME',
    channels: [
      { name: 'welcome', topic: 'What is Unifolio, how to get started, and links to unifolio.pro' },
      { name: 'rules', topic: 'Community guidelines and server rules' },
      { name: 'announcements', topic: 'Release notes, downtime alerts, and major updates', slowmode: 3600 },
      { name: 'roadmap', topic: 'Pinned roadmap — updated each sprint' },
    ],
  },
  {
    name: 'PRODUCT',
    channels: [
      { name: 'feature-requests', topic: 'Submit ideas and react 👍 to upvote' },
      { name: 'bug-reports', topic: 'Report bugs with steps to reproduce' },
      { name: 'beta-testers', topic: 'Early access discussion and pre-release feedback' },
      { name: 'changelog', topic: 'Version-by-version release notes' },
    ],
  },
  {
    name: 'COMMUNITY',
    channels: [
      { name: 'general', topic: 'Anything goes — casual discussion' },
      { name: 'portfolios', topic: 'Share your setup, allocations, and strategy' },
      { name: 'market-talk', topic: 'Stocks, crypto, macro, and economic discussion' },
      { name: 'prediction-markets', topic: 'Polymarket, Kalshi, and forecasting discussion' },
      { name: 'wins-and-losses', topic: 'Brag or vent — normalized P&L chat' },
    ],
  },
  {
    name: 'SUPPORT',
    channels: [
      { name: 'faq', topic: 'Pinned answers to the most common questions' },
      { name: 'help', topic: 'User-to-user and team support' },
      { name: 'import-help', topic: 'IBKR, CSV, and Flex Query import questions' },
      { name: 'data-sources', topic: 'Questions about Finnhub, Yahoo Finance, and data gaps' },
    ],
  },
  {
    name: 'PRO MEMBERS',
    channels: [
      { name: 'pro-lounge', topic: 'Pro tier members only' },
      { name: 'api-feedback', topic: 'Power user discussion about integrations and data APIs' },
    ],
  },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`Connected to server: ${guild.name}\n`);

  for (const category of structure) {
    console.log(`Creating category: ${category.name}`);
    const cat = await guild.channels.create({
      name: category.name,
      type: ChannelType.GuildCategory,
    });

    for (const ch of category.channels) {
      await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        parent: cat.id,
        topic: ch.topic,
        rateLimitPerUser: ch.slowmode ?? 0,
      });
      console.log(`  ✓ #${ch.name}`);
    }
  }

  console.log('\nAll channels created successfully.');
  client.destroy();
});

client.login(TOKEN);

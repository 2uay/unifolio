import { Client, GatewayIntentBits } from 'discord.js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = await client.guilds.fetch('1503300617471524927');
  const channels = await guild.channels.fetch();
  const welcome = channels.find(c => c?.name?.includes('welcome') && c.isTextBased());
  const invite = await welcome.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'Permanent community invite' });
  console.log(invite.url);
  client.destroy();
});

client.login(env.DISCORD_BOT_TOKEN);

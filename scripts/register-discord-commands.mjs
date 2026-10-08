// Registers Vow's global slash commands. Usage: DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs
// Idempotent (PUT overwrites the whole set). Commands work in DMs and servers (user-install + guild).
const S = 3, I = 4;
const opt = (name, description, required = false, type = S) => ({ type, name, description, required });
export const COMMANDS = [
  { name: 'link', description: 'Connect this Discord to your Vow account', options: [opt('code', 'Code from the dashboard', true)] },
  { name: 'login', description: 'Get a one-time sign-in link for the dashboard' },
  { name: 'roles', description: 'Show your roles' },
  { name: 'role', description: 'Set the default role', options: [opt('name', 'Role id', true)] },
  { name: 'status', description: 'Show link status and active roles' },
  { name: 'quiet', description: 'Quiet hours, e.g. 22:00-07:00 (empty = clear)', options: [opt('hours', 'HH:MM-HH:MM')] },
  { name: 'priority', description: 'Delivery order for reminders, e.g. slack telegram (empty = automatic)', options: [opt('order', 'Channels in order of preference')] },
  { name: 'ask', description: 'Ask Vow anything', options: [opt('text', 'Your question', true)] },
  { name: 'help', description: 'What I can do' },
];
if (process.argv[1]?.endsWith('register-discord-commands.mjs')) {
  const { DISCORD_APP_ID: app, DISCORD_BOT_TOKEN: token } = process.env;
  if (!app || !token) { console.error('Set DISCORD_APP_ID and DISCORD_BOT_TOKEN'); process.exit(1); }
  const r = await fetch(`https://discord.com/api/v10/applications/${app}/commands`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bot ${token}` }, body: JSON.stringify(COMMANDS.map(c => ({ ...c, integration_types: [0, 1], contexts: [0, 1, 2] }))) });
  console.log(r.status, (await r.json()).map?.(c => c.name)?.join(', '));
}
void I;

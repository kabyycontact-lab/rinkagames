require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');

const riddle = require('./riddle');
const casino = require('./casino');
const leaderboard = require('./leaderboard');
const { give } = require('./give');
const economy = require('./economy');
const admin = require('./admin');
const commands = [...require('./commands'), ...economy.commands];

const PREFIX = process.env.PREFIX || '+';

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN manquant : copie .env.example en .env et remplis-le.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // à activer dans le portail développeur (Privileged Gateway Intents)
  ],
});

const registry = new Map(commands.map((c) => [c.data.name, c]));
const body = commands.map((c) => c.data.toJSON());

async function registerFor(guild) {
  await guild.commands.set(body).catch((e) => console.error(`[slash] ${guild.name} :`, e.message));
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Connecté en tant que ${c.user.tag}`);
  for (const guild of c.guilds.cache.values()) await registerFor(guild); // visibles tout de suite
  riddle.resumeAll(client);
});

client.on(Events.GuildCreate, registerFor);

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    // 1) tentative de réponse à une devinette
    await riddle.handleMessage(client, message);

    // 2) commandes préfixées
    if (!message.content.startsWith(PREFIX)) return;
    const [cmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const c = cmd?.toLowerCase();
    if (c === 'give') await give(message, args); // admin : ajoute des coins
    else if (c === 'rob') await economy.prefixRob(message, args);
    else if (c === 'donner' || c === 'pay') await economy.prefixDonner(message, args);
    else if (c === 'verif') await admin.verif(message, args); // admin : fiche d'un membre
    else if (c === 'resetcoins') await admin.resetCoins(message, args); // admin : reset des coins
  } catch (e) {
    console.error('[message]', e);
  }
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      await registry.get(i.commandName)?.execute(i);
    } else if (i.isButton()) {
      if (i.customId.startsWith('cas:')) await casino.onButton(i);
      else if (i.customId.startsWith('lb:')) await leaderboard.onButton(i);
    } else if (i.isModalSubmit() && i.customId.startsWith('casm:')) {
      await casino.onModal(i);
    }
  } catch (e) {
    console.error('[interaction]', e);
    const payload = { content: '❌ Une erreur est survenue.', ephemeral: true };
    if (i.replied || i.deferred) await i.followUp(payload).catch(() => {});
    else await i.reply(payload).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);

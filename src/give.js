// +give <pseudo | @membre | id> <nombre>  (administrateurs uniquement, limite 100 000 000)
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('./db');

const GIVE_LIMIT = 100_000_000;
const fmt = (n) => Number(n).toLocaleString('fr-FR');

function parseAmount(raw) {
  const s = String(raw).trim().toLowerCase().replace(/[\s,_]/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return NaN;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1e3;
  if (m[2] === 'm') n *= 1e6;
  return Math.floor(n);
}

async function findMember(message, targetRaw) {
  const mentioned = message.mentions.members?.first();
  if (mentioned) return mentioned;

  const id = targetRaw.match(/^<@!?(\d{17,20})>$/)?.[1] || (/^\d{17,20}$/.test(targetRaw) ? targetRaw : null);
  if (id) return message.guild.members.fetch(id).catch(() => null);

  const q = targetRaw.replace(/^@/, '').toLowerCase();
  if (!q) return null;
  const found = await message.guild.members.search({ query: q, limit: 10 }).catch(() => null);
  if (!found?.size) return null;
  return (
    found.find((m) => m.user.username.toLowerCase() === q || m.displayName.toLowerCase() === q) || found.first()
  );
}

async function give(message, args) {
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return message.reply({ content: '❌ Commande réservée aux administrateurs.', allowedMentions: { repliedUser: false } });
  }
  if (args.length < 2) {
    return message.reply(`Usage : \`+give <pseudo|@membre|id> <nombre>\` (maximum ${fmt(GIVE_LIMIT)})`);
  }

  const amount = parseAmount(args[args.length - 1]);
  const targetRaw = args.slice(0, -1).join(' ');

  if (!Number.isFinite(amount) || amount < 1) {
    return message.reply('❌ Le nombre doit être un entier positif (ex : `5000`, `10k`, `2m`).');
  }
  if (amount > GIVE_LIMIT) {
    return message.reply(`❌ Limite dépassée : maximum **${fmt(GIVE_LIMIT)}** coins par commande.`);
  }

  const member = await findMember(message, targetRaw);
  if (!member) return message.reply('❌ Membre introuvable.');
  if (member.user.bot) return message.reply('❌ Impossible de donner des coins à un bot.');

  const balance = db.addCoins(message.guildId, member.id, amount);
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setDescription(`🪙 **${fmt(amount)}** coins ajoutés à <@${member.id}>.\nNouveau solde : **${fmt(balance)}** 🪙`)
    .setFooter({ text: `Par ${message.author.username}` });
  await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false, parse: [] } });
}

module.exports = { give, GIVE_LIMIT, findMember };

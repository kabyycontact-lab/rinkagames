// Commandes admin : +verif <membre> (fiche complète) et +resetcoins <membre> [montant].
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('./db');
const leaderboard = require('./leaderboard');
const { findMember } = require('./give');
const { parseAmount } = require('./economy');
const { isBlacklisted } = require('./blacklist');

const fmt = (n) => Number(n).toLocaleString('fr-FR');
const noPing = { parse: [], repliedUser: false };
const ts = (ms) => Math.floor(ms / 1000);

const isAdmin = (message) => !!message.member?.permissions.has(PermissionFlagsBits.Administrator);
const deny = (message) =>
  message.reply({ content: '❌ Commande réservée aux administrateurs.', allowedMentions: noPing });

async function verif(message, args) {
  if (!isAdmin(message)) return deny(message);
  if (!args.length) {
    return message.reply({ content: 'Usage : `+verif <@membre|pseudo|id>`', allowedMentions: noPing });
  }
  const member = await findMember(message, args.join(' '));
  if (!member) return message.reply({ content: '❌ Membre introuvable.', allowedMentions: noPing });

  const gid = message.guildId;
  const u = db.peekUser(gid, member.id);
  const bl = isBlacklisted(member, message.guild);

  const embed = new EmbedBuilder()
    .setColor(bl ? 0xed4245 : 0x5865f2)
    .setTitle(`🔍 Vérification · ${member.displayName}`)
    .setDescription(`<@${member.id}> · \`${member.id}\``);
  const avatar = member.displayAvatarURL?.();
  if (avatar) embed.setThumbnail(avatar);

  if (!u) {
    embed.addFields({
      name: 'Données',
      value: `Ce membre n'a encore jamais joué (aucune donnée). Solde de départ : ${fmt(db.START_COINS)} 🪙.`,
    });
  } else {
    const m = u.monthly?.[db.monthKey()] || { points: 0, wins: 0 };
    const rank = (scope) => {
      const r = leaderboard.rankOf(gid, member.id, scope);
      return r ? `#${r}` : '—';
    };
    const now = Date.now();
    embed.addFields(
      { name: '🪙 Coins', value: `**${fmt(u.coins)}** · rang richesse ${rank('coins')}`, inline: false },
      {
        name: `🎯 Devinettes · ce mois (${db.monthKey()})`,
        value: `**${fmt(m.points)} pts** · ${fmt(m.wins)} victoires · rang ${rank('month')}`,
        inline: false,
      },
      {
        name: '🎯 Devinettes · global',
        value: `**${fmt(u.points)} pts** · ${fmt(u.wins)} victoires · rang ${rank('global')}`,
        inline: false,
      },
      { name: 'Meilleure série', value: `${u.bestStreak || 0}`, inline: true },
      {
        name: 'Dernier vol',
        value: u.lastRob ? `<t:${ts(u.lastRob)}:R>` : 'Aucun',
        inline: true,
      },
      {
        name: 'Protection anti-vol',
        value: (u.shieldUntil || 0) > now ? `🛡️ jusqu'à <t:${ts(u.shieldUntil)}:R>` : 'Non',
        inline: true,
      },
    );
  }
  embed.addFields({
    name: 'Casino',
    value: bl ? '🚫 **Blacklisté** (rôle ❌ BL CASINO)' : '✅ Autorisé',
    inline: false,
  });
  await message.reply({ embeds: [embed], allowedMentions: noPing });
}

// +resetcoins <membre> [montant]  → remet à 1000 (solde de départ) par défaut, ou au montant donné (0 accepté)
async function resetCoins(message, args) {
  if (!isAdmin(message)) return deny(message);
  if (!args.length) {
    return message.reply({
      content: `Usage : \`+resetcoins <@membre|pseudo|id> [montant]\` (par défaut : ${fmt(db.START_COINS)} 🪙, le solde de départ)`,
      allowedMentions: noPing,
    });
  }

  let amount = db.START_COINS;
  let targetArgs = args;
  const last = args[args.length - 1];
  if (args.length > 1 && /^\d+(\.\d+)?[km]?$/i.test(last)) {
    amount = parseAmount(last, 0);
    targetArgs = args.slice(0, -1);
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return message.reply({ content: '❌ Montant invalide.', allowedMentions: noPing });
  }

  const member = await findMember(message, targetArgs.join(' '));
  if (!member) return message.reply({ content: '❌ Membre introuvable.', allowedMentions: noPing });
  if (member.user.bot) return message.reply({ content: '❌ Un bot n\'a pas de coins.', allowedMentions: noPing });

  const before = db.getUser(message.guildId, member.id).coins;
  const after = db.setCoins(message.guildId, member.id, amount);
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('🔄 Coins réinitialisés')
    .setDescription(`Les coins de <@${member.id}> ont été remis à **${fmt(after)}** 🪙.`)
    .addFields(
      { name: 'Avant', value: `${fmt(before)} 🪙`, inline: true },
      { name: 'Après', value: `${fmt(after)} 🪙`, inline: true },
    )
    .setFooter({ text: `Par ${message.author.username}` });
  await message.reply({ embeds: [embed], allowedMentions: noPing });
}

module.exports = { verif, resetCoins };

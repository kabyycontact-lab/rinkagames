// Économie (coins) : /rob (vol), /donner (don entre joueurs), /richesse (classement des coins).
// Les devinettes n'y touchent pas : elles ne gèrent que les points.
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('./db');
const leaderboard = require('./leaderboard');
const { findMember } = require('./give');
const { isBlacklisted, BL_MESSAGE, BL_TARGET_MESSAGE } = require('./blacklist');

// Message d'erreur si l'un des deux membres est blacklisté du casino, sinon null
function blacklistError(self, other, guild) {
  if (isBlacklisted(self, guild)) return BL_MESSAGE;
  if (isBlacklisted(other, guild)) return BL_TARGET_MESSAGE;
  return null;
}

const fmt = (n) => Number(n).toLocaleString('fr-FR');
const noPing = { parse: [], repliedUser: false };

const ROB = {
  cooldown: 30 * 60_000, // 30 min entre deux tentatives
  shield: 60 * 60_000, // 1 h de protection pour une victime volée
  chance: 0.4, // 40 % de réussite
  minVictim: 500, // la victime doit avoir au moins 500 coins
  minRobber: 200, // le voleur doit pouvoir payer l'amende
  maxLoot: 1_000_000, // butin maximum
};

function parseAmount(raw, balance) {
  const s = String(raw).trim().toLowerCase().replace(/[\s,_]/g, '');
  if (['all', 'tout', 'max'].includes(s)) return balance;
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return NaN;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1e3;
  if (m[2] === 'm') n *= 1e6;
  return Math.floor(n);
}

const ts = (ms) => Math.floor(ms / 1000);

// ---- logique pure (utilisée par les commandes slash ET préfixées) ----

function doRob(gid, robberId, victimId, now = Date.now()) {
  if (robberId === victimId) return { error: '❌ Tu ne peux pas te voler toi-même.' };

  const robber = db.getUser(gid, robberId);
  const victim = db.getUser(gid, victimId);

  const readyAt = (robber.lastRob || 0) + ROB.cooldown;
  if (now < readyAt) return { error: `⏳ Tu dois te faire discret. Réessaie <t:${ts(readyAt)}:R>.` };
  if (robber.coins < ROB.minRobber) {
    return { error: `❌ Il te faut au moins ${fmt(ROB.minRobber)} 🪙 pour tenter un vol (amende en cas d'échec).` };
  }
  const shieldUntil = victim.shieldUntil || 0;
  if (now < shieldUntil) {
    return { error: `🛡️ <@${victimId}> vient d'être volé et est protégé jusqu'à <t:${ts(shieldUntil)}:R>.` };
  }
  if (victim.coins < ROB.minVictim) {
    return { error: `❌ <@${victimId}> n'a pas assez de coins (minimum ${fmt(ROB.minVictim)} 🪙).` };
  }

  robber.lastRob = now;

  if (Math.random() < ROB.chance) {
    const pct = 0.05 + Math.random() * 0.2; // 5 à 25 % du solde de la victime
    const loot = Math.max(1, Math.min(ROB.maxLoot, Math.floor(victim.coins * pct)));
    db.addCoins(gid, victimId, -loot);
    db.addCoins(gid, robberId, loot);
    victim.shieldUntil = now + ROB.shield;
    db.save();
    return {
      embed: new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🦹 Vol réussi !')
        .setDescription(`<@${robberId}> a dérobé **${fmt(loot)}** 🪙 à <@${victimId}> !`)
        .addFields({ name: 'Ton solde', value: `${fmt(robber.coins)} 🪙`, inline: true })
        .setFooter({ text: `Réussite : ${ROB.chance * 100} % · cooldown : 30 min` }),
    };
  }

  const fine = Math.min(robber.coins, Math.max(50, Math.floor(robber.coins * (0.1 + Math.random() * 0.1))));
  db.addCoins(gid, robberId, -fine);
  db.addCoins(gid, victimId, fine);
  return {
    embed: new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🚔 Vol raté !')
      .setDescription(`<@${robberId}> s'est fait attraper et paie **${fmt(fine)}** 🪙 d'amende à <@${victimId}>.`)
      .addFields({ name: 'Ton solde', value: `${fmt(robber.coins)} 🪙`, inline: true })
      .setFooter({ text: `Réussite : ${ROB.chance * 100} % · cooldown : 30 min` }),
  };
}

function doDonner(gid, fromId, toId, rawAmount) {
  if (fromId === toId) return { error: '❌ Tu ne peux pas te donner des coins à toi-même.' };
  const from = db.getUser(gid, fromId);
  const amount = parseAmount(rawAmount, from.coins);
  if (!Number.isFinite(amount) || amount < 1) {
    return { error: '❌ Montant invalide (ex : `500`, `10k`, `2m`, `all`).' };
  }
  if (amount > from.coins) return { error: `❌ Solde insuffisant : tu as ${fmt(from.coins)} 🪙.` };

  db.addCoins(gid, fromId, -amount);
  const toBalance = db.addCoins(gid, toId, amount);
  return {
    embed: new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🎁 Don effectué')
      .setDescription(`<@${fromId}> a donné **${fmt(amount)}** 🪙 à <@${toId}>.`)
      .addFields(
        { name: 'Ton solde', value: `${fmt(from.coins)} 🪙`, inline: true },
        { name: 'Son solde', value: `${fmt(toBalance)} 🪙`, inline: true },
      ),
  };
}

const wrongChannelMsg = (id) => `🎰 Cette commande se fait dans <#${id}> (le salon du casino).`;

// ---- commandes slash ----

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('rob')
      .setDescription('Tenter de voler des coins à un membre (40 % de réussite)')
      .setDMPermission(false)
      .addUserOption((o) => o.setName('membre').setDescription('Ta victime').setRequired(true)),
    async execute(i) {
      const wrong = db.casinoChannelFor(i.guildId, i.channelId);
      if (wrong) return i.reply({ content: wrongChannelMsg(wrong), ephemeral: true });
      const target = i.options.getUser('membre');
      if (target.bot) return i.reply({ content: '❌ Impossible de voler un bot.', ephemeral: true });
      const bl = blacklistError(i.member, i.options.getMember('membre'), i.guild);
      if (bl) return i.reply({ content: bl, ephemeral: true });

      const res = doRob(i.guildId, i.user.id, target.id);
      if (res.error) return i.reply({ content: res.error, ephemeral: true, allowedMentions: { parse: [] } });
      await i.reply({ embeds: [res.embed], allowedMentions: { parse: [] } });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('donner')
      .setDescription('Donner des coins à un membre')
      .setDMPermission(false)
      .addUserOption((o) => o.setName('membre').setDescription('Bénéficiaire').setRequired(true))
      .addStringOption((o) => o.setName('montant').setDescription('Ex : 500, 10k, 2m, all').setRequired(true)),
    async execute(i) {
      const wrong = db.casinoChannelFor(i.guildId, i.channelId);
      if (wrong) return i.reply({ content: wrongChannelMsg(wrong), ephemeral: true });
      const target = i.options.getUser('membre');
      if (target.bot) return i.reply({ content: '❌ Impossible de donner des coins à un bot.', ephemeral: true });
      const bl = blacklistError(i.member, i.options.getMember('membre'), i.guild);
      if (bl) return i.reply({ content: bl, ephemeral: true });

      const res = doDonner(i.guildId, i.user.id, target.id, i.options.getString('montant'));
      if (res.error) return i.reply({ content: res.error, ephemeral: true });
      await i.reply({ embeds: [res.embed], allowedMentions: { parse: [] } });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('richesse')
      .setDescription('Classement des plus riches (coins)')
      .setDMPermission(false),
    async execute(i) {
      await i.reply(leaderboard.build(i.guildId, 'coins', 0));
    },
  },
];

// ---- commandes préfixées : +rob <cible> / +donner <cible> <montant> ----

async function prefixRob(message, args) {
  const wrong = db.casinoChannelFor(message.guildId, message.channelId);
  if (wrong) return message.reply({ content: wrongChannelMsg(wrong), allowedMentions: noPing });

  const member = await findMember(message, args.join(' '));
  if (!member) return message.reply({ content: '❌ Membre introuvable. Usage : `+rob <pseudo|@membre>`', allowedMentions: noPing });
  if (member.user.bot) return message.reply({ content: '❌ Impossible de voler un bot.', allowedMentions: noPing });
  const bl = blacklistError(message.member, member, message.guild);
  if (bl) return message.reply({ content: bl, allowedMentions: noPing });

  const res = doRob(message.guildId, message.author.id, member.id);
  await message.reply(
    res.error ? { content: res.error, allowedMentions: noPing } : { embeds: [res.embed], allowedMentions: noPing },
  );
}

async function prefixDonner(message, args) {
  const wrong = db.casinoChannelFor(message.guildId, message.channelId);
  if (wrong) return message.reply({ content: wrongChannelMsg(wrong), allowedMentions: noPing });
  if (args.length < 2) {
    return message.reply({ content: 'Usage : `+donner <pseudo|@membre> <montant>`', allowedMentions: noPing });
  }

  const member = await findMember(message, args.slice(0, -1).join(' '));
  if (!member) return message.reply({ content: '❌ Membre introuvable.', allowedMentions: noPing });
  if (member.user.bot) return message.reply({ content: '❌ Impossible de donner des coins à un bot.', allowedMentions: noPing });
  const bl = blacklistError(message.member, member, message.guild);
  if (bl) return message.reply({ content: bl, allowedMentions: noPing });

  const res = doDonner(message.guildId, message.author.id, member.id, args[args.length - 1]);
  await message.reply(
    res.error ? { content: res.error, allowedMentions: noPing } : { embeds: [res.embed], allowedMentions: noPing },
  );
}

module.exports = { commands, prefixRob, prefixDonner, doRob, doDonner, parseAmount, ROB };

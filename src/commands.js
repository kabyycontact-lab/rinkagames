const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const db = require('./db');
const riddle = require('./riddle');
const casino = require('./casino');
const leaderboard = require('./leaderboard');

const fmt = (n) => Number(n).toLocaleString('fr-FR');
const TEXT_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const NEEDED = ['ViewChannel', 'SendMessages', 'EmbedLinks'];

function checkChannelPerms(i, channel) {
  const perms = channel.permissionsFor(i.guild.members.me);
  const missing = NEEDED.filter((p) => !perms?.has(p));
  return missing;
}

const commands = [
  // /rgame setup | stop | status
  {
    data: new SlashCommandBuilder()
      .setName('rgame')
      .setDescription('Jeu de devinettes (culture générale, drapeaux…)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false)
      .addSubcommand((s) =>
        s
          .setName('setup')
          .setDescription('Configurer le salon des devinettes et lancer le jeu')
          .addChannelOption((o) =>
            o.setName('salon').setDescription('Salon des devinettes (par défaut : ici)').addChannelTypes(...TEXT_CHANNELS),
          )
          .addIntegerOption((o) =>
            o.setName('intervalle').setDescription('Minutes entre deux questions (1-60, défaut 5)').setMinValue(1).setMaxValue(60),
          ),
      )
      .addSubcommand((s) => s.setName('stop').setDescription('Arrêter les devinettes'))
      .addSubcommand((s) => s.setName('status').setDescription('Voir la configuration actuelle')),
    async execute(i) {
      const sub = i.options.getSubcommand();
      const g = db.getGuild(i.guildId);

      if (sub === 'setup') {
        const channel = i.options.getChannel('salon') || i.channel;
        const missing = checkChannelPerms(i, channel);
        if (missing.length) {
          return i.reply({
            content: `❌ Il me manque des permissions dans ${channel} : ${missing.join(', ')}.`,
            ephemeral: true,
          });
        }
        g.channelId = channel.id;
        g.intervalMin = i.options.getInteger('intervalle') ?? 5;
        riddle.stop(i.guildId); // remet à zéro un éventuel jeu en cours
        g.channelId = channel.id;
        riddle.start(i.client, i.guildId);
        return i.reply({
          content: `✅ Devinettes lancées dans ${channel}, une question toutes les **${g.intervalMin} min**. La première arrive dans quelques secondes !`,
        });
      }

      if (sub === 'stop') {
        riddle.stop(i.guildId);
        return i.reply({ content: '🛑 Devinettes arrêtées. Relance-les avec `/rgame setup`.' });
      }

      return i.reply({
        content: g.enabled
          ? `🟢 Actif dans <#${g.channelId}> · une question toutes les ${g.intervalMin} min.`
          : '🔴 Les devinettes ne sont pas actives. Utilise `/rgame setup`.',
        ephemeral: true,
      });
    },
  },

  // /rcasino setup
  {
    data: new SlashCommandBuilder()
      .setName('rcasino')
      .setDescription('Casino avec coins virtuels')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false)
      .addSubcommand((s) =>
        s
          .setName('setup')
          .setDescription('Poster le panneau du casino dans un salon')
          .addChannelOption((o) =>
            o.setName('salon').setDescription('Salon du casino (par défaut : ici)').addChannelTypes(...TEXT_CHANNELS),
          ),
      ),
    async execute(i) {
      const channel = i.options.getChannel('salon') || i.channel;
      const missing = checkChannelPerms(i, channel);
      if (missing.length) {
        return i.reply({
          content: `❌ Il me manque des permissions dans ${channel} : ${missing.join(', ')}.`,
          ephemeral: true,
        });
      }
      await channel.send(casino.panel());
      return i.reply({ content: `✅ Panneau du casino posté dans ${channel}.`, ephemeral: true });
    },
  },

  // /classement
  {
    data: new SlashCommandBuilder()
      .setName('classement')
      .setDescription('Classement des joueurs')
      .setDMPermission(false)
      .addStringOption((o) =>
        o
          .setName('type')
          .setDescription('Mensuel (défaut) ou global')
          .addChoices({ name: 'Ce mois-ci', value: 'month' }, { name: 'Global', value: 'global' }),
      ),
    async execute(i) {
      await i.reply(leaderboard.build(i.guildId, i.options.getString('type') || 'month', 0));
    },
  },

  // /points
  {
    data: new SlashCommandBuilder()
      .setName('points')
      .setDescription('Profil : points, victoires, rang et coins')
      .setDMPermission(false)
      .addUserOption((o) => o.setName('membre').setDescription('Membre (par défaut : toi)')),
    async execute(i) {
      const user = i.options.getUser('membre') || i.user;
      const u = db.getUser(i.guildId, user.id);
      const m = u.monthly[db.monthKey()] || { points: 0, wins: 0 };
      const rm = leaderboard.rankOf(i.guildId, user.id, 'month');
      const rg = leaderboard.rankOf(i.guildId, user.id, 'global');
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Profil de ${user.displayName ?? user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: `Ce mois (${db.monthKey()})`, value: `**${fmt(m.points)} pts** · ${fmt(m.wins)} victoires\nRang : ${rm ? `#${rm}` : '—'}`, inline: true },
          { name: 'Global', value: `**${fmt(u.points)} pts** · ${fmt(u.wins)} victoires\nRang : ${rg ? `#${rg}` : '—'}`, inline: true },
          { name: 'Coins', value: `${fmt(u.coins)} 🪙`, inline: true },
          { name: 'Meilleure série', value: `${u.bestStreak || 0}`, inline: true },
        );
      await i.reply({ embeds: [embed] });
    },
  },

  // /coins
  {
    data: new SlashCommandBuilder()
      .setName('coins')
      .setDescription('Voir ton solde de coins')
      .setDMPermission(false)
      .addUserOption((o) => o.setName('membre').setDescription('Membre (par défaut : toi)')),
    async execute(i) {
      const user = i.options.getUser('membre') || i.user;
      const u = db.getUser(i.guildId, user.id);
      await i.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setDescription(`🪙 <@${user.id}> possède **${fmt(u.coins)}** coins.`),
        ],
        allowedMentions: { parse: [] },
      });
    },
  },

  // /daily
  {
    data: new SlashCommandBuilder().setName('daily').setDescription('Récupérer ta récompense quotidienne').setDMPermission(false),
    async execute(i) {
      const u = db.getUser(i.guildId, i.user.id);
      const WAIT = 24 * 3600 * 1000;
      const left = u.lastDaily + WAIT - Date.now();
      if (left > 0) {
        const t = Math.floor((u.lastDaily + WAIT) / 1000);
        return i.reply({ content: `⏳ Reviens <t:${t}:R> pour ta prochaine récompense.`, ephemeral: true });
      }
      const gain = 500 + Math.floor(Math.random() * 1001); // 500 à 1500
      u.lastDaily = Date.now();
      const balance = db.addCoins(i.guildId, i.user.id, gain);
      await i.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`🎁 Tu reçois **${fmt(gain)}** 🪙 ! Solde : **${fmt(balance)}** 🪙`)],
      });
    },
  },
];

module.exports = commands;

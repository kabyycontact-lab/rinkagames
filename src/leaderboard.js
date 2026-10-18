// Classements avec pagination par boutons :
//  - 'month' / 'global' : points des devinettes
//  - 'coins'            : richesse (casino / économie)
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('./db');

const PER_PAGE = 10;
const fmt = (n) => Number(n).toLocaleString('fr-FR');

function entries(gid, scope) {
  if (scope === 'coins') {
    return db
      .allUsers(gid)
      .map(([id, u]) => ({ id, coins: u.coins, points: 0, wins: 0 }))
      .filter((e) => e.coins > 0)
      .sort((a, b) => b.coins - a.coins);
  }
  const key = db.monthKey();
  return db
    .allUsers(gid)
    .map(([id, u]) => {
      const s = scope === 'global' ? { points: u.points, wins: u.wins } : u.monthly?.[key] || { points: 0, wins: 0 };
      return { id, points: s.points, wins: s.wins };
    })
    .filter((e) => e.points > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

function rankOf(gid, uid, scope) {
  const i = entries(gid, scope).findIndex((e) => e.id === uid);
  return i === -1 ? null : i + 1;
}

function build(gid, scope = 'month', page = 0) {
  const coins = scope === 'coins';
  const list = entries(gid, scope);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const slice = list.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const lines = slice.map((e, idx) => {
    const rank = page * PER_PAGE + idx + 1;
    if (coins) {
      const medal = ['🥇', '🥈', '🥉'][rank - 1] || `**${rank}.**`;
      return `${medal} <@${e.id}> · **${fmt(e.coins)} 🪙**`;
    }
    if (rank <= 3) return `👑 **${rank}** · <@${e.id}>\n**${fmt(e.points)} pts** · ${fmt(e.wins)} victoires`;
    return `**${rank}.** <@${e.id}> · **${fmt(e.points)} pts**`;
  });

  const title = coins ? 'RICHESSE · COINS' : scope === 'global' ? 'CLASSEMENT · GLOBAL' : `CLASSEMENT · ${db.monthKey()}`;
  const empty = coins
    ? 'Personne n\'a encore de coins. Utilise `/daily` !'
    : 'Personne n\'a encore de points. Lance une partie avec `/rgame setup` !';
  const embed = new EmbedBuilder()
    .setColor(coins ? 0x2ecc71 : 0xf1c40f)
    .setTitle(title)
    .setDescription(lines.join(coins ? '\n' : '\n\n') || empty)
    .setFooter({
      text: `${fmt(list.length)} joueurs · Page ${page + 1}/${pages} · ${coins ? '/coins pour ton solde' : '/points pour ton profil'}`,
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lb:${scope}:${page - 1}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`lb:${scope}:${page + 1}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
  );
  if (!coins) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`lb:${scope === 'global' ? 'month' : 'global'}:0`)
        .setLabel(scope === 'global' ? 'Voir le mois' : 'Voir le global')
        .setStyle(ButtonStyle.Primary),
    );
  }
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

async function onButton(i) {
  const [, scope, page] = i.customId.split(':');
  await i.update(build(i.guildId, scope, parseInt(page, 10) || 0));
}

module.exports = { build, onButton, rankOf, fmt };

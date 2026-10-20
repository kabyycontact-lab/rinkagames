// Casino : pile ou face, machine à sous, roulette. Tout passe par des boutons + une fenêtre de mise.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const db = require('./db');
const { isBlacklisted, BL_MESSAGE } = require('./blacklist');

const MIN_BET = 10;
const MAX_BET = 5_000_000;
const COOLDOWN_MS = 3_000;
const lastPlay = new Map();

const fmt = (n) => Number(n).toLocaleString('fr-FR');

function panel() {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🎰 RCASINO')
    .setDescription(
      [
        'Mise tes 🪙 coins virtuels et tente ta chance !',
        '',
        '🪙 **Pile ou face** · gain ×2 (48 % de chances)',
        '🎰 **Machine à sous** · jusqu\'à ×100',
        '🎡 **Roulette** · rouge/noir ×2 · vert (0) ×35',
        '',
        `Mise minimum : **${fmt(MIN_BET)}** · maximum : **${fmt(MAX_BET)}**`,
        'Tu peux écrire `all`, `10k` ou `2m` dans la mise.',
        '',
        '**Gagner / partager des coins**',
        '`/daily` récompense quotidienne · `/rob @membre` voler · `/donner @membre montant` donner',
        'Solde : `/coins` · Classement des plus riches : `/richesse`',
      ].join('\n'),
    );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cas:flip:pile').setLabel('Pile').setEmoji('🪙').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cas:flip:face').setLabel('Face').setEmoji('🪙').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cas:slots:x').setLabel('Machine à sous').setEmoji('🎰').setStyle(ButtonStyle.Success),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cas:roul:red').setLabel('Rouge').setEmoji('🔴').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cas:roul:black').setLabel('Noir').setEmoji('⚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cas:roul:green').setLabel('Vert (0)').setEmoji('🟢').setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row1, row2] };
}

async function onButton(i) {
  const [, game, arg] = i.customId.split(':');
  const wrong = db.casinoChannelFor(i.guildId, i.channelId);
  if (wrong) return i.reply({ content: `🎰 Le casino se joue dans <#${wrong}>.`, ephemeral: true });
  if (isBlacklisted(i.member, i.guild)) return i.reply({ content: BL_MESSAGE, ephemeral: true });
  const names = { flip: 'Pile ou face', slots: 'Machine à sous', roul: 'Roulette' };
  const modal = new ModalBuilder()
    .setCustomId(`casm:${game}:${arg}`)
    .setTitle(`${names[game] || 'Casino'}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('bet')
          .setLabel('Ta mise (ex : 500, 10k, 2m, all)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(15),
      ),
    );
  await i.showModal(modal);
}

function parseBet(raw, balance) {
  const s = String(raw).trim().toLowerCase().replace(/[\s,_]/g, '');
  if (['all', 'tout', 'max'].includes(s)) return balance;
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!m) return NaN;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1e3;
  if (m[2] === 'm') n *= 1e6;
  return Math.floor(n);
}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
const COLOR_LABEL = { red: '🔴 rouge', black: '⚫ noir', green: '🟢 vert' };

const SYMBOLS = [
  { e: '🍒', w: 30, x3: 4 },
  { e: '🍋', w: 25, x3: 6 },
  { e: '🍇', w: 20, x3: 8 },
  { e: '🔔', w: 13, x3: 15 },
  { e: '💎', w: 8, x3: 30 },
  { e: '7️⃣', w: 4, x3: 100 },
];
const TOTAL_W = SYMBOLS.reduce((a, s) => a + s.w, 0);
function spin() {
  let r = Math.random() * TOTAL_W;
  for (const s of SYMBOLS) {
    if ((r -= s.w) < 0) return s;
  }
  return SYMBOLS[0];
}

function play(game, arg, bet) {
  if (game === 'flip') {
    const win = Math.random() < 0.48;
    const result = win ? arg : arg === 'pile' ? 'face' : 'pile';
    return { payout: win ? bet * 2 : 0, line: `La pièce tombe sur **${result}** (tu avais choisi **${arg}**).` };
  }
  if (game === 'roul') {
    const n = Math.floor(Math.random() * 37);
    const c = colorOf(n);
    const mult = c === arg ? (arg === 'green' ? 35 : 2) : 0;
    return {
      payout: bet * mult,
      line: `La bille s'arrête sur **${n}** (${COLOR_LABEL[c]}). Tu avais misé sur ${COLOR_LABEL[arg]}.`,
    };
  }
  // slots
  const reels = [spin(), spin(), spin()];
  let mult = 0;
  if (reels[0].e === reels[1].e && reels[1].e === reels[2].e) mult = reels[0].x3;
  else if (reels[0].e === reels[1].e || reels[1].e === reels[2].e || reels[0].e === reels[2].e) mult = 1.3;
  return {
    payout: Math.floor(bet * mult),
    line: `**[ ${reels.map((r) => r.e).join(' | ')} ]**${mult >= 4 ? '\n🎉 Combinaison gagnante !' : ''}`,
  };
}

async function onModal(i) {
  const [, game, arg] = i.customId.split(':');
  const gid = i.guildId;
  const uid = i.user.id;
  if (isBlacklisted(i.member, i.guild)) return i.reply({ content: BL_MESSAGE, ephemeral: true });
  const wrong = db.casinoChannelFor(gid, i.channelId);
  if (wrong) return i.reply({ content: `🎰 Le casino se joue dans <#${wrong}>.`, ephemeral: true });

  const now = Date.now();
  if (now - (lastPlay.get(uid) || 0) < COOLDOWN_MS) {
    return i.reply({ content: '⏳ Doucement, attends quelques secondes entre deux parties.', ephemeral: true });
  }

  const user = db.getUser(gid, uid);
  const bet = parseBet(i.fields.getTextInputValue('bet'), user.coins);
  if (!Number.isFinite(bet) || bet < MIN_BET) {
    return i.reply({ content: `❌ Mise invalide (minimum ${fmt(MIN_BET)} 🪙).`, ephemeral: true });
  }
  if (bet > MAX_BET) {
    return i.reply({ content: `❌ Mise maximum : ${fmt(MAX_BET)} 🪙.`, ephemeral: true });
  }
  if (bet > user.coins) {
    return i.reply({ content: `❌ Solde insuffisant : tu as ${fmt(user.coins)} 🪙.`, ephemeral: true });
  }

  lastPlay.set(uid, now);
  db.addCoins(gid, uid, -bet);
  const { payout, line } = play(game, arg, bet);
  if (payout > 0) db.addCoins(gid, uid, payout);
  const balance = db.getUser(gid, uid).coins;
  const net = payout - bet;

  const embed = new EmbedBuilder()
    .setColor(net > 0 ? 0x57f287 : net === 0 ? 0xfee75c : 0xed4245)
    .setTitle(net > 0 ? '🎉 Gagné !' : net === 0 ? '😐 Mise remboursée' : '💸 Perdu')
    .setDescription(`<@${uid}>\n${line}`)
    .addFields(
      { name: 'Mise', value: `${fmt(bet)} 🪙`, inline: true },
      { name: net >= 0 ? 'Gain net' : 'Perte', value: `${net >= 0 ? '+' : ''}${fmt(net)} 🪙`, inline: true },
      { name: 'Solde', value: `${fmt(balance)} 🪙`, inline: true },
    );
  await i.reply({ embeds: [embed] });
}

module.exports = { panel, onButton, onModal, fmt, MAX_BET, MIN_BET };

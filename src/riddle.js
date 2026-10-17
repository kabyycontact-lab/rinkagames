// Moteur des devinettes : pose une question à intervalle régulier, détecte la bonne réponse,
// calcule le temps de réponse et attribue 1 à 10 points selon la rapidité.
const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const { pickQuestion, matches } = require('./questions');

const LIMIT_MS = 30_000; // temps pour répondre
const FAST_MS = 3_000; // en dessous : 10 points
const COINS_PER_POINT = 50;

const active = new Map(); // guildId -> question en cours
const nextTimers = new Map(); // guildId -> timer de la prochaine question

// 10 pts si <= 3 s, puis dégressif jusqu'à 1 pt à 30 s
function pointsFor(ms) {
  if (ms <= FAST_MS) return 10;
  const ratio = (ms - FAST_MS) / (LIMIT_MS - FAST_MS);
  return Math.max(1, Math.min(10, Math.round(10 - ratio * 9)));
}

const fmtDur = (ms) => `${(ms / 1000).toFixed(2)} s`;
const nextText = (min) => `Prochaine question dans ${min} minute${min > 1 ? 's' : ''}`;

function schedule(client, gid, delayMs) {
  clearTimeout(nextTimers.get(gid));
  nextTimers.set(
    gid,
    setTimeout(() => ask(client, gid).catch(console.error), delayMs),
  );
}

async function ask(client, gid) {
  const g = db.getGuild(gid);
  if (!g.enabled || !g.channelId || active.has(gid)) return;

  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return schedule(client, gid, g.intervalMin * 60_000);

  const q = pickQuestion(g.recent);
  g.recent.push(q.id);
  if (g.recent.length > 60) g.recent.shift();
  db.save();

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎯 RGAME · ${q.category}`)
    .setDescription(`**${q.text}**`)
    .setFooter({ text: 'Écris ta réponse dans le salon · 30 s · plus tu es rapide, plus tu gagnes (1 à 10 pts)' })
    .setTimestamp();
  if (q.image) embed.setImage(q.image);

  let msg;
  try {
    msg = await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('[rgame] envoi impossible :', e.message);
    return schedule(client, gid, g.intervalMin * 60_000);
  }

  const st = {
    question: q,
    channelId: channel.id,
    askedAt: msg.createdTimestamp, // heure Discord de la question
    locked: false,
  };
  st.timeout = setTimeout(() => expire(client, gid, channel, st), LIMIT_MS);
  active.set(gid, st);
}

async function expire(client, gid, channel, st) {
  if (active.get(gid) !== st || st.locked) return;
  st.locked = true;
  active.delete(gid);
  const g = db.getGuild(gid);
  g.streak = { userId: null, count: 0 };
  db.save();

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('RGAME')
    .setDescription(`**TEMPS ÉCOULÉ**\n\nPersonne n'a trouvé. La réponse était : **${st.question.display}**`)
    .setFooter({ text: `RGAME · ${nextText(g.intervalMin)}` });
  await channel.send({ embeds: [embed] }).catch(() => {});
  schedule(client, gid, g.intervalMin * 60_000);
}

async function handleMessage(client, message) {
  if (message.author.bot || !message.guildId) return;
  const st = active.get(message.guildId);
  if (!st || st.locked || message.channelId !== st.channelId) return;
  if (!matches(message.content, st.question.answers)) return;

  st.locked = true;
  clearTimeout(st.timeout);
  active.delete(message.guildId);

  const gid = message.guildId;
  const g = db.getGuild(gid);
  const answeredAt = message.createdTimestamp;
  const ms = Math.max(0, answeredAt - st.askedAt);
  const points = pointsFor(ms);

  // série : victoires consécutives du même joueur
  g.streak =
    g.streak.userId === message.author.id
      ? { userId: message.author.id, count: g.streak.count + 1 }
      : { userId: message.author.id, count: 1 };
  const streak = g.streak.count;

  const bonus = Math.min(500, (streak - 1) * 25);
  const coins = points * COINS_PER_POINT + bonus;

  const u = db.getUser(gid, message.author.id);
  u.bestStreak = Math.max(u.bestStreak || 0, streak);
  db.addWin(gid, message.author.id, points);
  db.addCoins(gid, message.author.id, coins);

  const askedS = Math.floor(st.askedAt / 1000);
  const answeredS = Math.floor(answeredAt / 1000);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('RGAME')
    .setDescription(`**BONNE RÉPONSE**\n\n<@${message.author.id}> a trouvé !`)
    .addFields(
      { name: 'Réponse', value: `${st.question.display} · \`${fmtDur(ms)}\``, inline: false },
      {
        name: 'Chronologie',
        value: `Question posée à <t:${askedS}:T>\nRéponse donnée à <t:${answeredS}:T>`,
        inline: false,
      },
      { name: 'Gains', value: `**+${points} points** · +${coins.toLocaleString('fr-FR')} 🪙`, inline: false },
    )
    .setFooter({ text: `RGAME · ${nextText(g.intervalMin)} · Série×${streak}` });

  await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => {});
  schedule(client, gid, g.intervalMin * 60_000);
}

function start(client, gid, delayMs = 4_000) {
  const g = db.getGuild(gid);
  g.enabled = true;
  db.save();
  schedule(client, gid, delayMs);
}

function stop(gid) {
  const g = db.getGuild(gid);
  g.enabled = false;
  g.streak = { userId: null, count: 0 };
  db.save();
  clearTimeout(nextTimers.get(gid));
  nextTimers.delete(gid);
  const st = active.get(gid);
  if (st) {
    clearTimeout(st.timeout);
    st.locked = true;
    active.delete(gid);
  }
}

function resumeAll(client) {
  for (const gid of db.enabledGuildIds()) schedule(client, gid, 10_000);
}

module.exports = { handleMessage, start, stop, resumeAll, pointsFor, LIMIT_MS };

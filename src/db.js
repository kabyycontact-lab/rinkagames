// Stockage JSON simple (aucune dépendance native à compiler).
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');
fs.mkdirSync(DIR, { recursive: true });

let data = { guilds: {}, users: {} };
try {
  data = { guilds: {}, users: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch {
  /* première exécution */
}

let timer = null;
function flush() {
  clearTimeout(timer);
  timer = null;
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}
function save() {
  if (!timer) timer = setTimeout(flush, 1000);
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flush();
    process.exit(0);
  });
}

const START_COINS = 1000;
const MAX_COINS = 1e13;

// Clé du mois, ex. "2026-10" (fuseau Paris)
function monthKey(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);
}

function getGuild(gid) {
  return (data.guilds[gid] ??= {
    channelId: null,
    enabled: false,
    intervalMin: 5,
    streak: { userId: null, count: 0 },
    recent: [],
  });
}

function getUser(gid, uid) {
  const g = (data.users[gid] ??= {});
  return (g[uid] ??= {
    coins: START_COINS,
    points: 0,
    wins: 0,
    monthly: {},
    lastDaily: 0,
    bestStreak: 0,
  });
}

function addCoins(gid, uid, n) {
  const u = getUser(gid, uid);
  u.coins = Math.max(0, Math.min(MAX_COINS, u.coins + n));
  save();
  return u.coins;
}

function addWin(gid, uid, points) {
  const u = getUser(gid, uid);
  const m = (u.monthly[monthKey()] ??= { points: 0, wins: 0 });
  m.points += points;
  m.wins += 1;
  u.points += points;
  u.wins += 1;
  save();
}

function allUsers(gid) {
  return Object.entries(data.users[gid] || {});
}

function enabledGuildIds() {
  return Object.entries(data.guilds)
    .filter(([, g]) => g.enabled && g.channelId)
    .map(([id]) => id);
}

module.exports = {
  save,
  flush,
  monthKey,
  getGuild,
  getUser,
  addCoins,
  addWin,
  allUsers,
  enabledGuildIds,
  MAX_COINS,
};

// Blacklist du casino : tout membre qui possède le rôle « ❌ BL CASINO » ne peut plus participer
// (jeux, /rob, /donner, /daily). Le rôle est repéré par son nom (emoji et majuscules ignorés).
// Option : CASINO_BL_ROLE_ID dans .env pour forcer un rôle précis par son identifiant.

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ROLE_NAME = 'bl casino';

function isBlacklisted(member, guild) {
  if (!member?.roles) return false;
  const envId = process.env.CASINO_BL_ROLE_ID;
  const isBlRole = (r) => !!r && norm(r.name) === ROLE_NAME;

  // membre « brut » (non mis en cache) : la liste de rôles est un tableau d'identifiants
  if (Array.isArray(member.roles)) {
    return member.roles.some((id) => id === envId || isBlRole(guild?.roles.cache.get(id)));
  }
  const cache = member.roles.cache;
  if (!cache) return false;
  return (envId && cache.has(envId)) || cache.some(isBlRole);
}

const BL_MESSAGE = '🚫 Tu es blacklisté du casino : tu ne peux plus participer (jeux, /rob, /donner, /daily).';
const BL_TARGET_MESSAGE = '🚫 Ce membre est blacklisté du casino : tu ne peux pas interagir avec lui.';

module.exports = { isBlacklisted, BL_MESSAGE, BL_TARGET_MESSAGE };

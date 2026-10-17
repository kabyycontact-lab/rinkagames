// Banque de questions : drapeaux + culture générale (personnalités, géo, histoire, sciences, pop culture, sport).
// Pour en ajouter : complète FLAGS ou TEXT ci-dessous.

const normalize = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripArticle = (s) => s.replace(/^(le |la |les |l |un |une |the )/, '');

function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function matches(input, answers) {
  const n = stripArticle(normalize(input));
  if (!n || n.length > 80) return false;
  for (const raw of answers) {
    const a = stripArticle(normalize(raw));
    if (n === a) return true;
    // petite tolérance de faute de frappe sur les réponses assez longues
    if (a.length >= 6 && lev(n, a) <= 1) return true;
    if (a.length >= 11 && lev(n, a) <= 2) return true;
  }
  return false;
}

// [code ISO, nom affiché, ...alias]
const FLAGS = [
  ['fr', 'France'], ['de', 'Allemagne'], ['it', 'Italie'], ['es', 'Espagne'], ['pt', 'Portugal'],
  ['be', 'Belgique'], ['ch', 'Suisse'], ['nl', 'Pays-Bas', 'hollande'],
  ['gb', 'Royaume-Uni', 'angleterre', 'uk', 'grande bretagne'], ['ie', 'Irlande'],
  ['se', 'Suède'], ['no', 'Norvège'], ['dk', 'Danemark'], ['fi', 'Finlande'], ['pl', 'Pologne'],
  ['gr', 'Grèce'], ['tr', 'Turquie'], ['ru', 'Russie'], ['ua', 'Ukraine'],
  ['us', 'États-Unis', 'usa', 'etats unis', 'amerique'], ['ca', 'Canada'], ['mx', 'Mexique'],
  ['br', 'Brésil'], ['ar', 'Argentine'], ['cl', 'Chili'], ['co', 'Colombie'], ['pe', 'Pérou'],
  ['cu', 'Cuba'], ['jp', 'Japon'], ['cn', 'Chine'], ['kr', 'Corée du Sud', 'coree'],
  ['in', 'Inde'], ['th', 'Thaïlande'], ['vn', 'Vietnam'], ['id', 'Indonésie'],
  ['au', 'Australie'], ['nz', 'Nouvelle-Zélande'], ['za', 'Afrique du Sud'], ['eg', 'Égypte'],
  ['ma', 'Maroc'], ['dz', 'Algérie'], ['tn', 'Tunisie'], ['sn', 'Sénégal'],
  ['ci', "Côte d'Ivoire", 'cote divoire'], ['cm', 'Cameroun'], ['ng', 'Nigeria'], ['ke', 'Kenya'],
  ['et', 'Éthiopie'], ['sa', 'Arabie saoudite'],
  ['ae', 'Émirats arabes unis', 'emirats', 'eau'], ['il', 'Israël'], ['ir', 'Iran'], ['iq', 'Irak'],
  ['lb', 'Liban'], ['pk', 'Pakistan'], ['ph', 'Philippines'], ['at', 'Autriche'],
  ['cz', 'Tchéquie', 'republique tcheque'], ['hu', 'Hongrie'], ['ro', 'Roumanie'],
  ['hr', 'Croatie'], ['rs', 'Serbie'], ['is', 'Islande'], ['lu', 'Luxembourg'],
  ['mg', 'Madagascar'], ['ht', 'Haïti'], ['jm', 'Jamaïque'], ['ve', 'Venezuela'],
  ['uy', 'Uruguay'], ['ec', 'Équateur'], ['np', 'Népal'], ['my', 'Malaisie'],
  ['sg', 'Singapour'], ['bg', 'Bulgarie'], ['sk', 'Slovaquie'], ['si', 'Slovénie'],
  ['ee', 'Estonie'], ['lv', 'Lettonie'], ['lt', 'Lituanie'], ['gh', 'Ghana'], ['ml', 'Mali'],
];

// [catégorie, question, ...réponses acceptées]
const TEXT = [
  // Personnalités
  ['Personnalités', 'Qui a peint la Joconde ?', 'léonard de vinci', 'de vinci', 'vinci', 'leonardo da vinci'],
  ['Personnalités', 'Qui a écrit « Les Misérables » ?', 'victor hugo', 'hugo'],
  ['Personnalités', 'Qui a découvert la pénicilline en 1928 ?', 'alexander fleming', 'fleming'],
  ['Personnalités', 'Quel physicien est célèbre pour la théorie de la relativité ?', 'albert einstein', 'einstein'],
  ['Personnalités', 'Qui fut le premier homme à marcher sur la Lune ?', 'neil armstrong', 'armstrong'],
  ['Personnalités', 'Qui a composé « La Flûte enchantée » ?', 'mozart', 'wolfgang amadeus mozart'],
  ['Personnalités', 'Quel cofondateur de Microsoft s’associe à Paul Allen ?', 'bill gates', 'gates'],
  ['Personnalités', 'Quelle scientifique a reçu deux prix Nobel, en physique et en chimie ?', 'marie curie', 'curie'],
  ['Personnalités', 'Qui fut sacré empereur des Français en 1804 ?', 'napoléon', 'napoleon bonaparte', 'bonaparte', 'napoleon 1er'],
  ['Personnalités', 'Quel peintre a réalisé « La Nuit étoilée » ?', 'vincent van gogh', 'van gogh', 'vangogh'],
  ['Personnalités', 'Qui a écrit « Le Petit Prince » ?', 'antoine de saint-exupéry', 'saint exupery', 'saint-exupery'],
  ['Personnalités', 'Quel navigateur atteint l’Amérique en 1492 ?', 'christophe colomb', 'colomb'],
  ['Personnalités', 'Qui est l’auteur de « Roméo et Juliette » ?', 'william shakespeare', 'shakespeare'],
  ['Personnalités', 'Quel footballeur argentin a remporté la Coupe du monde 2022 ?', 'lionel messi', 'messi'],
  ['Personnalités', 'Quel président sud-africain fut emprisonné 27 ans avant d’être élu en 1994 ?', 'nelson mandela', 'mandela'],
  ['Personnalités', 'Qui a déposé le brevet de l’ampoule à incandescence en 1879 ?', 'thomas edison', 'edison'],
  ['Personnalités', 'Quel savant est associé à la chute d’une pomme et à la gravitation ?', 'isaac newton', 'newton'],
  ['Personnalités', 'Qui a cofondé Apple avec Steve Wozniak ?', 'steve jobs', 'jobs'],
  ['Personnalités', 'Qui a réalisé le film « Pulp Fiction » ?', 'quentin tarantino', 'tarantino'],
  ['Personnalités', 'Quel chanteur belge est connu pour « Alors on danse » ?', 'stromae'],
  ['Personnalités', 'Quelle reine du Royaume-Uni a régné de 1952 à 2022 ?', 'elizabeth ii', 'elisabeth 2', 'elizabeth 2', 'elizabeth', 'elisabeth'],
  // Géographie
  ['Géographie', 'Quelle est la capitale de l’Australie ?', 'canberra'],
  ['Géographie', 'Quel est le plus long fleuve de France ?', 'la loire', 'loire'],
  ['Géographie', 'Quelle est la plus haute montagne du monde ?', 'everest', 'mont everest'],
  ['Géographie', 'Quelle est la capitale du Canada ?', 'ottawa'],
  ['Géographie', 'Quel est le plus grand océan du monde ?', 'pacifique', 'ocean pacifique'],
  ['Géographie', 'Quel est le pays le plus peuplé d’Afrique ?', 'nigeria'],
  ['Géographie', 'Quelle est la capitale du Brésil ?', 'brasilia'],
  ['Géographie', 'Quel est le plus grand désert chaud du monde ?', 'sahara', 'le sahara'],
  ['Géographie', 'Quel fleuve traverse Paris ?', 'seine', 'la seine'],
  ['Géographie', 'Quelle est la capitale de la Turquie ?', 'ankara'],
  ['Géographie', 'Quel est le plus grand pays du monde par sa superficie ?', 'russie', 'la russie'],
  ['Géographie', 'Quelle mer sépare l’Europe de l’Afrique ?', 'méditerranée', 'mer mediterranee'],
  ['Géographie', 'Quelle est la capitale du Japon ?', 'tokyo'],
  ['Géographie', 'Combien de continents compte-t-on dans le modèle le plus courant ?', '7', 'sept'],
  // Histoire
  ['Histoire', 'En quelle année a commencé la Révolution française ?', '1789'],
  ['Histoire', 'En quelle année s’est terminée la Seconde Guerre mondiale ?', '1945'],
  ['Histoire', 'En quelle année est tombé le mur de Berlin ?', '1989'],
  ['Histoire', 'Quelle civilisation a bâti les pyramides de Gizeh ?', 'egyptiens', 'egypte', 'anciens egyptiens', 'egyptienne'],
  ['Histoire', 'En quelle année l’homme a-t-il marché sur la Lune pour la première fois ?', '1969'],
  ['Histoire', 'Quelle reine de France fut guillotinée en 1793 ?', 'marie antoinette', 'marie-antoinette'],
  ['Histoire', 'Quelle ville était la capitale de l’Empire romain ?', 'rome'],
  ['Histoire', 'En quelle année a eu lieu le naufrage du Titanic ?', '1912'],
  // Sciences
  ['Sciences', 'Quel est le symbole chimique de l’or ?', 'au'],
  ['Sciences', 'Quelle planète est la plus proche du Soleil ?', 'mercure'],
  ['Sciences', 'Combien d’os compte le corps d’un adulte ?', '206'],
  ['Sciences', 'Quel est le plus grand organe du corps humain ?', 'peau', 'la peau'],
  ['Sciences', 'Quel gaz est majoritaire dans l’atmosphère terrestre ?', 'azote', 'diazote', 'n2'],
  ['Sciences', 'Quelle est la plus grosse planète du système solaire ?', 'jupiter'],
  ['Sciences', 'Quelle est la formule chimique de l’eau ?', 'h2o'],
  ['Sciences', 'Quelle planète est surnommée la planète rouge ?', 'mars'],
  ['Sciences', 'Combien de planètes compte le système solaire ?', '8', 'huit'],
  ['Sciences', 'Quel est le plus grand mammifère du monde ?', 'baleine bleue', 'la baleine bleue'],
  ['Sciences', 'Quel est le symbole chimique du fer ?', 'fe'],
  // Pop culture
  ['Pop culture', 'Quel plombier moustachu est la mascotte de Nintendo ?', 'mario', 'super mario'],
  ['Pop culture', 'Dans quel jeu vidéo rencontre-t-on des Creepers ?', 'minecraft'],
  ['Pop culture', 'Comment s’appelle l’école de sorciers dans Harry Potter ?', 'poudlard', 'hogwarts'],
  ['Pop culture', 'Quel est le nom de famille de Peter, alias Spider-Man ?', 'parker'],
  ['Pop culture', 'Combien de Pokémon de départ peut-on choisir dans la première génération ?', '3', 'trois'],
  ['Pop culture', 'Quel groupe a chanté « Bohemian Rhapsody » ?', 'queen'],
  ['Pop culture', 'Dans quel film d’animation un poisson-clown cherche-t-il son fils ?', 'le monde de nemo', 'nemo', 'finding nemo'],
  ['Pop culture', 'Dans quelle série trouve-t-on le personnage de Walter White ?', 'breaking bad'],
  // Sport
  ['Sport', 'Combien de joueurs par équipe sur le terrain au football ?', '11', 'onze'],
  ['Sport', 'Quel pays a remporté la Coupe du monde de football 2018 ?', 'france', 'la france'],
  ['Sport', 'Dans quel sport utilise-t-on un volant ?', 'badminton'],
  ['Sport', 'Combien de tournois composent le Grand Chelem de tennis ?', '4', 'quatre'],
  ['Sport', 'Quelle ville a accueilli les Jeux olympiques d’été de 2024 ?', 'paris'],
  ['Sport', 'Quel pays est le berceau du judo ?', 'japon', 'le japon'],
];

const POOL = [
  ...FLAGS.map(([code, name, ...alias]) => ({
    id: `f:${code}`,
    category: 'Drapeaux',
    text: 'À quel pays appartient ce drapeau ?',
    image: `https://flagcdn.com/w320/${code}.png`,
    display: name,
    answers: [name, ...alias],
  })),
  ...TEXT.map(([category, text, ...answers], i) => ({
    id: `t:${i}`,
    category,
    text,
    image: null,
    display: answers[0].charAt(0).toUpperCase() + answers[0].slice(1),
    answers,
  })),
];

// 40 % de drapeaux, 60 % de questions texte ; évite les questions récentes
function pickQuestion(recent = []) {
  const flags = POOL.filter((q) => q.id.startsWith('f:'));
  const texts = POOL.filter((q) => q.id.startsWith('t:'));
  const base = Math.random() < 0.4 ? flags : texts;
  let choices = base.filter((q) => !recent.includes(q.id));
  if (!choices.length) choices = base;
  return choices[Math.floor(Math.random() * choices.length)];
}

module.exports = { pickQuestion, matches, normalize, POOL };

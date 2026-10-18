# RGame Bot — devinettes, casino, points & coins (Node.js)

Bot Discord en **discord.js v14** (aucun Python).

Deux univers **séparés** :

| | 🎯 Devinettes | 🎰 Casino / économie |
|---|---|---|
| Monnaie | **points** + victoires | **coins** 🪙 |
| Salon | `/rgame setup` | `/rcasino setup` |
| Classement | `/classement` (mois / global) | `/richesse` |
| Profil | `/points` | `/coins` |

Les devinettes ne donnent **que des points** ; le casino, le vol et les dons ne touchent **que les coins**.
Les deux ne peuvent pas être installés dans le même salon.

## Installation

```bash
npm install
cp .env.example .env     # puis colle ton token dans DISCORD_TOKEN
npm start
```

Dans le [portail développeur Discord](https://discord.com/developers/applications) → ton bot → **Bot** :
active **Message Content Intent** (obligatoire, sinon le bot ne peut pas lire les réponses).

Invitation : scopes `bot` + `applications.commands`, permissions : voir/envoyer des messages, intégrer des liens, lire l'historique.

## 🎯 Devinettes

| Commande | Qui | Description |
|---|---|---|
| `/rgame setup [salon] [intervalle]` | Gérer le serveur | Lance les devinettes (une question toutes les 5 min par défaut) |
| `/rgame stop` / `/rgame status` | Gérer le serveur | Arrêter / voir l'état |
| `/classement [type]` | Tous | Classement des points : mois ou global, paginé |
| `/points [membre]` | Tous | Points, victoires, rangs, meilleure série |

Le temps de réponse est mesuré entre le message de la question et celui de la réponse (horodatages Discord) :
≤ 3 s → **10 points**, puis dégressif jusqu'à **1 point** à 30 s (fin du temps).

## 🎰 Casino & économie (coins)

Les nouveaux joueurs démarrent à 1000 🪙. Une fois `/rcasino setup` fait, ces commandes ne marchent que dans le salon du casino.

| Commande | Qui | Description |
|---|---|---|
| `/rcasino setup [salon]` | Gérer le serveur | Poste le panneau (pile ou face, machine à sous, roulette) |
| `/daily` | Tous | 500 à 1500 🪙 toutes les 24 h |
| `/coins [membre]` | Tous | Solde + rang de richesse (utilisable partout) |
| `/richesse` | Tous | Classement des plus riches |
| `/rob @membre` · `+rob <pseudo>` | Tous | Voler des coins |
| `/donner @membre montant` · `+donner <pseudo> <montant>` | Tous | Donner des coins (`10k`, `2m`, `all` acceptés) |
| `+give <pseudo\|@membre\|id> <nombre>` | Administrateurs | Ajoute des coins (limite **100 000 000** par commande) |

**Règles du vol (`/rob`)** — modifiables dans `src/economy.js` :
- 40 % de réussite ; en cas de succès : 5 à 25 % du solde de la victime (butin max 1 000 000)
- en cas d'échec : amende de 10 à 20 % de ton solde, versée à la victime
- cooldown de 30 min ; victime protégée 1 h après un vol ; il faut ≥ 200 🪙 pour voler et la victime doit avoir ≥ 500 🪙

**Casino** : pile ou face (×2, 48 %), machine à sous (jusqu'à ×100), roulette (rouge/noir ×2, vert ×35). Mise de 10 à 5 000 000.

## Ajouter des questions

Édite `src/questions.js` : tableau `FLAGS` (drapeaux, via flagcdn.com) et `TEXT` (`[catégorie, question, ...réponses]`).
Les accents, majuscules et petites fautes de frappe sont tolérés.

Les données sont stockées dans `data/db.json`.

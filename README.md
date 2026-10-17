# RGame Bot — devinettes, casino, points & coins (Node.js)

Bot Discord en **discord.js v14** (aucun Python).

## Installation

```bash
npm install
cp .env.example .env     # puis colle ton token dans DISCORD_TOKEN
npm start
```

Dans le [portail développeur Discord](https://discord.com/developers/applications) → ton bot → **Bot** :
active **Message Content Intent** (obligatoire, sinon le bot ne peut pas lire les réponses).

Invitation : scopes `bot` + `applications.commands`, permissions : voir/envoyer des messages, intégrer des liens, lire l'historique.

## Commandes

| Commande | Qui | Description |
|---|---|---|
| `/rgame setup [salon] [intervalle]` | Gérer le serveur | Lance les devinettes (une question toutes les 5 min par défaut) |
| `/rgame stop` / `/rgame status` | Gérer le serveur | Arrêter / voir l'état |
| `/rcasino setup [salon]` | Gérer le serveur | Poste le panneau du casino (boutons) |
| `/classement [type]` | Tous | Classement du mois ou global, paginé |
| `/points [membre]` | Tous | Points, victoires, rangs, coins |
| `/coins [membre]` | Tous | Solde de coins |
| `/daily` | Tous | 500 à 1500 🪙 toutes les 24 h |
| `+give <pseudo\|@membre\|id> <nombre>` | Administrateurs | Ajoute des coins (limite **100 000 000** par commande) |

## Points

Le temps de réponse est mesuré entre le message de la question et celui de la réponse (horodatages Discord).

- ≤ 3 s → **10 points**
- puis dégressif jusqu'à **1 point** à 30 s (fin du temps)
- Chaque victoire rapporte aussi des coins (50 🪙 par point) + bonus de série.

## Casino

Pile ou face (×2, 48 %), machine à sous (jusqu'à ×100), roulette (rouge/noir ×2, vert ×35).
Mise de 10 à 5 000 000 ; `all`, `10k`, `2m` acceptés.

## Ajouter des questions

Édite `src/questions.js` : tableau `FLAGS` (drapeaux, via flagcdn.com) et `TEXT` (`[catégorie, question, ...réponses]`).
Les accents, majuscules et petites fautes de frappe sont tolérés.

Les données sont stockées dans `data/db.json`.

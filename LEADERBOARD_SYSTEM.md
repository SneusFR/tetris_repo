# Système de Leaderboard - Documentation

## Vue d'ensemble

Le système de leaderboard a été amélioré pour offrir une meilleure performance et une expérience utilisateur optimisée. Il utilise maintenant un modèle dédié `LeaderboardEntry` qui stocke une seule entrée par joueur avec son meilleur score.

## Nouveautés

### 1. Modèle LeaderboardEntry

Un nouveau modèle `models/LeaderboardEntry.js` a été créé pour optimiser les requêtes de leaderboard :

- **Une entrée par joueur** : Évite la duplication et améliore les performances
- **Mise à jour automatique** : Se met à jour automatiquement lors de nouveaux records
- **Index optimisés** : Pour des requêtes rapides par score et joueur

### 2. Route `/api/leaderboard/simple`

Nouvelle route optimisée qui retourne le leaderboard avec une entrée par joueur :

```javascript
GET /api/leaderboard/simple?limit=50&page=1
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "player": {
          "id": "...",
          "username": "PlayerName",
          "avatar": "avatar_url",
          "banner": "banner_id",
          "level": 25,
          "country": "FR"
        },
        "bestScore": 150000,
        "level": 15,
        "linesCleared": 120,
        "gameMode": "classic",
        "achievedAt": "2025-01-07T15:30:00.000Z"
      }
    ],
    "pagination": {
      "current": 1,
      "total": 10,
      "count": 50,
      "totalEntries": 500
    },
    "userRank": 42
  }
}
```

### 3. Mise à jour automatique

La route `/api/users/game-result` a été modifiée pour :

- Vérifier automatiquement si un nouveau score est un record personnel
- Mettre à jour ou créer l'entrée dans le leaderboard
- Marquer la partie comme record personnel si applicable

### 4. Script de migration

Un script `scripts/migrate-leaderboard.js` permet de migrer les données existantes :

```bash
# Exécuter la migration
node scripts/migrate-leaderboard.js
```

## Utilisation

### Pour les développeurs

1. **Importer le modèle :**
```javascript
const LeaderboardEntry = require('../models/LeaderboardEntry');
```

2. **Récupérer le leaderboard :**
```javascript
const leaderboard = await LeaderboardEntry.find()
  .populate('player', 'username profile.avatar profile.country')
  .sort({ bestScore: -1 })
  .limit(50);
```

3. **Vérifier le rang d'un joueur :**
```javascript
const userEntry = await LeaderboardEntry.findOne({ player: userId });
if (userEntry) {
  const betterScores = await LeaderboardEntry.countDocuments({
    bestScore: { $gt: userEntry.bestScore }
  });
  const userRank = betterScores + 1;
}
```

### Pour les clients

1. **Récupérer le leaderboard simple :**
```javascript
fetch('/api/leaderboard/simple?limit=50&page=1')
  .then(response => response.json())
  .then(data => {
    console.log('Leaderboard:', data.data.leaderboard);
    console.log('Mon rang:', data.data.userRank);
  });
```

2. **Pagination :**
```javascript
// Page suivante
fetch('/api/leaderboard/simple?limit=50&page=2')
```

## Avantages

### Performance
- **Requêtes plus rapides** : Une seule entrée par joueur
- **Index optimisés** : Tri par score très efficace
- **Moins de données** : Réduction significative du volume de données

### Expérience utilisateur
- **Leaderboard cohérent** : Pas de doublons
- **Rang utilisateur** : Position automatiquement calculée
- **Pagination efficace** : Navigation fluide dans le classement

### Maintenance
- **Mise à jour automatique** : Pas d'intervention manuelle
- **Migration simple** : Script de migration fourni
- **Compatibilité** : Les anciennes routes restent fonctionnelles

## Migration des données existantes

Pour migrer les données existantes vers le nouveau système :

1. **Sauvegarder la base de données** (recommandé)
2. **Exécuter le script de migration :**
```bash
node scripts/migrate-leaderboard.js
```
3. **Vérifier les résultats** dans les logs

Le script :
- Trouve le meilleur score de chaque joueur
- Crée ou met à jour les entrées du leaderboard
- Affiche le progrès et les statistiques
- Gère les erreurs individuelles sans arrêter le processus

## Compatibilité

- **Routes existantes** : Toutes les routes existantes continuent de fonctionner
- **Modèles existants** : Aucune modification des modèles `User` et `Game`
- **API** : Nouvelle route `/simple` sans impact sur les routes existantes

## Monitoring

Pour surveiller les performances du nouveau système :

1. **Vérifier les index :**
```javascript
db.leaderboardentries.getIndexes()
```

2. **Statistiques de performance :**
```javascript
db.leaderboardentries.explain().find().sort({ bestScore: -1 })
```

3. **Nombre d'entrées :**
```javascript
db.leaderboardentries.countDocuments()
```

## Dépannage

### Problèmes courants

1. **Entrées manquantes après migration :**
   - Vérifier les logs de migration
   - Réexécuter le script si nécessaire

2. **Performances lentes :**
   - Vérifier que les index sont créés
   - Utiliser `explain()` pour analyser les requêtes

3. **Rangs incorrects :**
   - Vérifier la logique de calcul du rang
   - S'assurer que les scores sont correctement triés

### Commandes utiles

```bash
# Vérifier les entrées du leaderboard
node -e "
const mongoose = require('mongoose');
const LeaderboardEntry = require('./models/LeaderboardEntry');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const count = await LeaderboardEntry.countDocuments();
  console.log('Entrées dans le leaderboard:', count);
  process.exit(0);
});
"

# Recréer les index
node -e "
const mongoose = require('mongoose');
const LeaderboardEntry = require('./models/LeaderboardEntry');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await LeaderboardEntry.collection.dropIndexes();
  await LeaderboardEntry.ensureIndexes();
  console.log('Index recréés');
  process.exit(0);
});
"

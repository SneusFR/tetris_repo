# Tetris Server API

Une API REST complète pour un jeu Tetris avec gestion des utilisateurs, classements, statistiques et système d'amis.

## 🚀 Fonctionnalités

- **Authentification JWT** - Inscription, connexion, gestion des sessions
- **Profils utilisateurs** - Avatars, bannières, niveaux, titres
- **Système d'amis** - Demandes d'ami, suggestions, gestion des relations
- **Classements** - Global, par pays, entre amis, avec filtres temporels
- **Statistiques détaillées** - Analyses de performance, tendances, comparaisons
- **Upload de fichiers** - Avatars et bannières avec validation
- **Base de données MongoDB** - Persistance avec Mongoose
- **Sécurité** - Rate limiting, validation des données, protection CORS

## 📋 Prérequis

- Node.js (v14 ou supérieur)
- MongoDB (local ou distant)
- npm ou yarn

## 🛠️ Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd tetris-server
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration**
Copier le fichier `.env` et modifier les variables selon votre environnement :
```bash
# Configuration de la base de données
MONGODB_URI=mongodb://localhost:27017/tetris

# Configuration JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Configuration du serveur
PORT=5000
NODE_ENV=development

# Configuration pour l'upload de fichiers
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

4. **Démarrer le serveur**
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## 📚 Documentation API

### Authentification

#### POST /api/auth/register
Inscription d'un nouvel utilisateur
```json
{
  "username": "player123",
  "email": "player@example.com",
  "password": "motdepasse123",
  "country": "FR"
}
```

#### POST /api/auth/login
Connexion utilisateur
```json
{
  "login": "player123", // username ou email
  "password": "motdepasse123"
}
```

#### GET /api/auth/me
Obtenir les informations de l'utilisateur connecté (nécessite authentification)

#### POST /api/auth/refresh
Rafraîchir le token JWT (nécessite authentification)

#### POST /api/auth/change-password
Changer le mot de passe (nécessite authentification)
```json
{
  "currentPassword": "ancien_mot_de_passe",
  "newPassword": "nouveau_mot_de_passe"
}
```

### Gestion des utilisateurs

#### GET /api/users/profile/:username
Obtenir le profil public d'un utilisateur

#### PUT /api/users/profile
Mettre à jour son profil (nécessite authentification)
```json
{
  "country": "FR",
  "title": "Maître Tetris",
  "avatar": "/uploads/avatars/avatar.jpg",
  "banner": "/uploads/banners/banner.jpg"
}
```

#### PUT /api/users/settings
Mettre à jour les paramètres (nécessite authentification)
```json
{
  "theme": "dark",
  "soundEnabled": true,
  "musicEnabled": true,
  "notifications": true,
  "language": "fr",
  "privacy": {
    "showProfile": true,
    "showStats": true,
    "allowFriendRequests": true
  }
}
```

#### GET /api/users/search?q=username
Rechercher des utilisateurs

#### POST /api/users/game-result
Enregistrer le résultat d'une partie (nécessite authentification)
```json
{
  "score": 15000,
  "level": 5,
  "linesCleared": 25,
  "timePlayed": 300,
  "gameMode": "classic",
  "stats": {
    "totalPieces": 150,
    "tSpins": 3,
    "perfectClears": 1,
    "combos": {
      "maxCombo": 4,
      "totalCombos": 8
    },
    "lineClears": {
      "single": 10,
      "double": 5,
      "triple": 2,
      "tetris": 2
    }
  }
}
```

#### GET /api/users/games
Obtenir l'historique des parties (nécessite authentification)

### Classements

#### GET /api/leaderboard/global
Classement global
- Paramètres : `limit`, `page`, `period` (all, daily, weekly, monthly)

#### GET /api/leaderboard/country/:countryCode
Classement par pays

#### GET /api/leaderboard/friends
Classement des amis (nécessite authentification)

#### GET /api/leaderboard/stats
Statistiques générales du leaderboard

### Système d'amis

#### GET /api/friends
Liste des amis (nécessite authentification)
- Paramètres : `status` (accepted, pending, blocked)

#### POST /api/friends/request
Envoyer une demande d'ami (nécessite authentification)
```json
{
  "username": "ami_potentiel"
}
```

#### PUT /api/friends/:friendId/accept
Accepter une demande d'ami (nécessite authentification)

#### PUT /api/friends/:friendId/decline
Refuser une demande d'ami (nécessite authentification)

#### DELETE /api/friends/:friendId
Supprimer un ami (nécessite authentification)

#### PUT /api/friends/:friendId/block
Bloquer un utilisateur (nécessite authentification)

#### GET /api/friends/suggestions
Suggestions d'amis (nécessite authentification)

### Statistiques

#### GET /api/stats/user/:username
Statistiques détaillées d'un utilisateur
- Paramètres : `period` (all, daily, weekly, monthly, yearly)

#### GET /api/stats/global
Statistiques globales du jeu
- Paramètres : `period` (all, daily, weekly, monthly)

#### GET /api/stats/compare/:username1/:username2
Comparer les statistiques de deux utilisateurs

### Upload de fichiers

#### POST /api/upload/avatar
Upload d'un avatar (nécessite authentification)
- Format : multipart/form-data
- Champ : `avatar`
- Types acceptés : JPEG, PNG, GIF, WebP
- Taille max : 5MB

#### POST /api/upload/banner
Upload d'une bannière (nécessite authentification)
- Format : multipart/form-data
- Champ : `banner`
- Types acceptés : JPEG, PNG, GIF, WebP
- Taille max : 5MB

#### DELETE /api/upload/avatar
Supprimer l'avatar actuel (nécessite authentification)

#### DELETE /api/upload/banner
Supprimer la bannière actuelle (nécessite authentification)

#### GET /api/upload/info
Informations sur les limites d'upload

## 🔐 Authentification

L'API utilise JWT (JSON Web Tokens) pour l'authentification. Incluez le token dans l'en-tête Authorization :

```
Authorization: Bearer <votre_token_jwt>
```

## 📊 Structure des données

### Utilisateur
```json
{
  "id": "user_id",
  "username": "player123",
  "profile": {
    "country": "FR",
    "avatar": "/uploads/avatars/avatar.jpg",
    "banner": "/uploads/banners/banner.jpg",
    "level": 15,
    "experience": 25000,
    "title": "Maître Tetris"
  },
  "gameStats": {
    "totalGames": 150,
    "totalWins": 120,
    "totalLosses": 30,
    "bestScore": 50000,
    "totalScore": 1500000,
    "totalLinesCleared": 2500,
    "totalTimePlayed": 18000,
    "averageScore": 10000,
    "winRate": 80
  },
  "ranking": {
    "currentRank": 42,
    "bestRank": 15,
    "rankingPoints": 1850
  }
}
```

### Partie
```json
{
  "id": "game_id",
  "player": "user_id",
  "score": 15000,
  "level": 5,
  "linesCleared": 25,
  "timePlayed": 300,
  "gameMode": "classic",
  "difficulty": "normal",
  "stats": {
    "totalPieces": 150,
    "piecesPerMinute": 30,
    "perfectClears": 1,
    "tSpins": 3,
    "combos": {
      "maxCombo": 4,
      "totalCombos": 8
    },
    "lineClears": {
      "single": 10,
      "double": 5,
      "triple": 2,
      "tetris": 2
    }
  },
  "isPersonalBest": false,
  "createdAt": "2024-01-01T12:00:00Z"
}
```

## 🛡️ Sécurité

- **Rate Limiting** : 100 requêtes par 15 minutes par IP
- **Validation des données** : Validation stricte avec express-validator
- **Hachage des mots de passe** : bcryptjs avec salt de 12 rounds
- **Protection CORS** : Configuration CORS sécurisée
- **Helmet** : En-têtes de sécurité HTTP

## 🚀 Déploiement

### Variables d'environnement de production
```bash
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-super-secure-secret-key
PORT=5000
```

### PM2 (recommandé)
```bash
npm install -g pm2
pm2 start server.js --name tetris-api
pm2 startup
pm2 save
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📝 License

Ce projet est sous licence ISC.

## 🐛 Support

Pour signaler un bug ou demander une fonctionnalité, créez une issue sur GitHub.

---

**Développé avec ❤️ pour la communauté Tetris**

# Système de Bannières - Documentation

## Vue d'ensemble

Le système de bannières permet aux utilisateurs de personnaliser leur profil avec des bannières débloquables basées sur leurs performances et réalisations dans le jeu.

## Modifications apportées

### 1. Schéma User (models/User.js)

- **Modification du champ `profile.banner`** : Stocke maintenant un ID de bannière au lieu d'une URL
  ```javascript
  banner: {
    type: String,
    default: 'default' // ID de la bannière par défaut
  }
  ```

- **Nouveau champ `profile.credits`** : Système de monnaie virtuelle pour acheter des bannières
  ```javascript
  credits: {
    type: Number,
    default: 1000, // Crédits de départ
    min: [0, 'Les crédits ne peuvent pas être négatifs']
  }
  ```

- **Le champ `inventory.unlockedBanners`** reste inchangé et stocke les IDs des bannières débloquées

- **Méthode `updateGameStats` modifiée** : Ajoute des crédits basés sur le score (1 crédit pour 10 points)

### 2. Routes API modifiées/ajoutées

#### Route modifiée : PUT /api/users/profile
- **Nouveau paramètre** : `bannerId` (optionnel)
- **Validation** : Vérifie que l'utilisateur possède la bannière avant de l'équiper
- **Exemple d'utilisation** :
  ```javascript
  PUT /api/users/profile
  {
    "bannerId": "tetris_master"
  }
  ```

#### Nouvelles routes : /api/shop/*

##### GET /api/shop/banners
- **Description** : Récupère la liste de toutes les bannières disponibles
- **Accès** : Privé (authentification requise)
- **Réponse** :
  ```javascript
  {
    "success": true,
    "data": {
      "banners": [
        {
          "id": "default",
          "name": "Bannière par défaut",
          "description": "La bannière de base disponible pour tous",
          "price": 0,
          "rarity": "common",
          "unlockCondition": null,
          "imageUrl": "/images/banners/default.jpg",
          "isOwned": true,
          "isUnlockable": true,
          "canPurchase": false
        }
      ],
      "userStats": {
        "currentBanner": "default",
        "unlockedCount": 1,
        "totalCount": 6
      }
    }
  }
  ```

##### POST /api/shop/purchase-banner
- **Description** : Débloquer une bannière
- **Accès** : Privé
- **Paramètres** :
  ```javascript
  {
    "bannerId": "tetris_master"
  }
  ```
- **Validations** :
  - Bannière existe
  - Utilisateur ne la possède pas déjà
  - Conditions de déblocage remplies

##### GET /api/shop/banners/:bannerId
- **Description** : Détails d'une bannière spécifique avec progrès de déblocage
- **Accès** : Privé

## Bannières disponibles

| ID | Nom | Rareté | Condition de déblocage |
|---|---|---|---|
| `default` | Bannière par défaut | Common | Aucune |
| `line_clearer` | Destructeur de lignes | Common | 1000 lignes effacées |
| `speed_demon` | Démon de vitesse | Uncommon | Niveau 20 |
| `tetris_master` | Maître Tetris | Rare | Score de 100,000 |
| `veteran` | Vétéran | Epic | 500 parties jouées |
| `champion` | Champion | Legendary | Top 10 du classement |

## Système de crédits

### Gain de crédits
- **Parties jouées** : 1 crédit pour 10 points de score
- **Crédits de départ** : 1000 crédits lors de la création du compte

### Coût des bannières
| Bannière | Prix | Rareté |
|---|---|---|
| `default` | 0 crédits | Common |
| `line_clearer` | 500 crédits | Common |
| `speed_demon` | 750 crédits | Uncommon |
| `tetris_master` | 1000 crédits | Rare |
| `veteran` | 1500 crédits | Epic |
| `champion` | 2000 crédits | Legendary |

### Validation d'achat
- Vérification du solde de crédits suffisant
- Déduction automatique lors de l'achat
- Retour du solde restant après achat

## Types de conditions de déblocage

- **score** : Meilleur score personnel
- **lines** : Nombre total de lignes effacées
- **level** : Niveau du joueur
- **games** : Nombre total de parties jouées
- **rank** : Meilleur classement atteint

## Structure des fichiers

```
tetris-server/
├── models/
│   └── User.js (modifié)
├── routes/
│   ├── users.js (modifié)
│   └── shop.js (nouveau)
├── uploads/
│   └── banners/ (nouveau dossier pour les images)
└── server.js (modifié)
```

## Utilisation côté client

### 1. Récupérer les bannières disponibles
```javascript
const response = await fetch('/api/shop/banners', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { data } = await response.json();
```

### 2. Débloquer une bannière
```javascript
const response = await fetch('/api/shop/purchase-banner', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bannerId: 'tetris_master'
  })
});
```

### 3. Équiper une bannière
```javascript
const response = await fetch('/api/users/profile', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bannerId: 'tetris_master'
  })
});
```

## Fonctionnalités futures possibles

- Système de monnaie virtuelle pour l'achat de bannières
- Bannières temporaires ou saisonnières
- Bannières personnalisées uploadées par les utilisateurs
- Système d'échange de bannières entre joueurs
- Bannières animées
- Catégories de bannières (thèmes, événements, etc.)

## Notes techniques

- Les images des bannières sont servies via `/images/banners/`
- Le système vérifie automatiquement les conditions de déblocage
- Les bannières débloquées sont stockées dans `user.inventory.unlockedBanners`
- La bannière équipée est stockée dans `user.profile.banner`
- La bannière 'default' est toujours disponible pour tous les utilisateurs

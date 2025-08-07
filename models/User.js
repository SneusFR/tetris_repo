const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Informations de base
  username: {
    type: String,
    required: [true, 'Le nom d\'utilisateur est requis'],
    unique: true,
    trim: true,
    minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
    maxlength: [20, 'Le nom d\'utilisateur ne peut pas dépasser 20 caractères'],
    match: [/^[a-zA-Z0-9_]+$/, 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores']
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email invalide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères']
  },
  
  // Profil utilisateur
  profile: {
    country: {
      type: String,
      default: 'FR',
      maxlength: [2, 'Le code pays doit faire 2 caractères']
    },
    avatar: {
      type: String,
      default: null // URL vers l'image de profil
    },
    banner: {
      type: String,
      default: 'default' // ID de la bannière par défaut
    },
    level: {
      type: Number,
      default: 1,
      min: [1, 'Le niveau minimum est 1']
    },
    experience: {
      type: Number,
      default: 0,
      min: [0, 'L\'expérience ne peut pas être négative']
    },
    title: {
      type: String,
      default: 'Débutant'
    },
    credits: {
      type: Number,
      default: 1000, // Crédits de départ
      min: [0, 'Les crédits ne peuvent pas être négatifs']
    }
  },

  // Statistiques de jeu
  gameStats: {
    totalGames: {
      type: Number,
      default: 0
    },
    totalWins: {
      type: Number,
      default: 0
    },
    totalLosses: {
      type: Number,
      default: 0
    },
    bestScore: {
      type: Number,
      default: 0
    },
    totalScore: {
      type: Number,
      default: 0
    },
    totalLinesCleared: {
      type: Number,
      default: 0
    },
    totalTimePlayed: {
      type: Number,
      default: 0 // en secondes
    },
    averageScore: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    }
  },

  // Classement
  ranking: {
    currentRank: {
      type: Number,
      default: null
    },
    bestRank: {
      type: Number,
      default: null
    },
    rankingPoints: {
      type: Number,
      default: 1000 // Points ELO-like
    }
  },

  // Paramètres utilisateur
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'neon', 'retro', 'galaxy', 'cyberpunk', 'pastel', 'glassmorphism'],
      default: 'neon'
    },
    visualEffect: {
      type: String,
      enum: ['none', 'rainbow', 'fire', 'ice', 'electric', 'matrix'],
      default: 'none'
    },
    soundEnabled: {
      type: Boolean,
      default: true
    },
    musicEnabled: {
      type: Boolean,
      default: true
    },
    notifications: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      enum: ['fr', 'en', 'es', 'de'],
      default: 'fr'
    },
    privacy: {
      showProfile: {
        type: Boolean,
        default: true
      },
      showStats: {
        type: Boolean,
        default: true
      },
      allowFriendRequests: {
        type: Boolean,
        default: true
      }
    }
  },

  // Amis
  friends: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending'
    }
  }],

  // Inventaire (bannières, avatars débloqués)
  inventory: {
    unlockedAvatars: [{
      type: String
    }],
    unlockedBanners: [{
      type: String
    }],
    unlockedTitles: [{
      type: String
    }],
    unlockedThemes: [{
      type: String
    }],
    unlockedEffects: [{
      type: String
    }]
  },

  // Métadonnées
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour les recherches
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'ranking.rankingPoints': -1 });
userSchema.index({ 'gameStats.bestScore': -1 });

// Middleware pour hasher le mot de passe
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware pour mettre à jour updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour calculer le niveau basé sur l'expérience
userSchema.methods.calculateLevel = function() {
  const baseExp = 1000;
  const level = Math.floor(Math.sqrt(this.profile.experience / baseExp)) + 1;
  this.profile.level = level;
  return level;
};

// Méthode pour ajouter de l'expérience
userSchema.methods.addExperience = function(exp) {
  this.profile.experience += exp;
  this.calculateLevel();
};

// Méthode pour mettre à jour les statistiques
userSchema.methods.updateGameStats = function(gameData) {
  this.gameStats.totalGames += 1;
  this.gameStats.totalScore += gameData.score;
  this.gameStats.totalLinesCleared += gameData.linesCleared;
  this.gameStats.totalTimePlayed += gameData.timePlayed;
  
  if (gameData.score > this.gameStats.bestScore) {
    this.gameStats.bestScore = gameData.score;
  }
  
  if (gameData.won) {
    this.gameStats.totalWins += 1;
  } else {
    this.gameStats.totalLosses += 1;
  }
  
  // Calculer les moyennes
  this.gameStats.averageScore = Math.round(this.gameStats.totalScore / this.gameStats.totalGames);
  this.gameStats.winRate = Math.round((this.gameStats.totalWins / this.gameStats.totalGames) * 100);
  
  // Ajouter des crédits basés sur le score (1 crédit pour 10 points)
  const creditsEarned = Math.floor(gameData.score / 10);
  this.profile.credits = (this.profile.credits || 0) + creditsEarned;
  
  // Ajouter de l'expérience basée sur le score
  const expGained = Math.floor(gameData.score / 100);
  this.addExperience(expGained);
};

// Méthode pour obtenir le profil public
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    profile: this.profile,
    gameStats: this.gameStats,
    ranking: this.ranking,
    settings: this.settings,
    inventory: this.inventory,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

module.exports = mongoose.model('User', userSchema);

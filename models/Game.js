const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  // Joueur
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Données de la partie
  score: {
    type: Number,
    required: true,
    min: [0, 'Le score ne peut pas être négatif']
  },
  
  level: {
    type: Number,
    required: true,
    min: [1, 'Le niveau minimum est 1']
  },
  
  linesCleared: {
    type: Number,
    required: true,
    min: [0, 'Le nombre de lignes ne peut pas être négatif']
  },
  
  timePlayed: {
    type: Number,
    required: true,
    min: [0, 'Le temps de jeu ne peut pas être négatif']
  },
  
  // Détails de la partie
  gameMode: {
    type: String,
    enum: ['classic', 'sprint', 'ultra', 'zen'],
    default: 'classic'
  },
  
  difficulty: {
    type: String,
    enum: ['easy', 'normal', 'hard', 'expert'],
    default: 'normal'
  },
  
  // Statistiques détaillées
  stats: {
    totalPieces: {
      type: Number,
      default: 0
    },
    piecesPerMinute: {
      type: Number,
      default: 0
    },
    perfectClears: {
      type: Number,
      default: 0
    },
    tSpins: {
      type: Number,
      default: 0
    },
    combos: {
      maxCombo: {
        type: Number,
        default: 0
      },
      totalCombos: {
        type: Number,
        default: 0
      }
    },
    lineClears: {
      single: { type: Number, default: 0 },
      double: { type: Number, default: 0 },
      triple: { type: Number, default: 0 },
      tetris: { type: Number, default: 0 }
    }
  },
  
  // État final de la partie
  finalBoard: {
    type: [[Number]], // Représentation de la grille finale
    default: null
  },
  
  // Métadonnées
  isCompleted: {
    type: Boolean,
    default: true
  },
  
  isPersonalBest: {
    type: Boolean,
    default: false
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour les requêtes
gameSchema.index({ player: 1, createdAt: -1 });
gameSchema.index({ score: -1 });
gameSchema.index({ gameMode: 1, score: -1 });

// Méthode pour calculer les points par minute
gameSchema.methods.calculatePPM = function() {
  if (this.timePlayed === 0) return 0;
  const minutes = this.timePlayed / 60;
  return Math.round(this.stats.totalPieces / minutes);
};

// Middleware pour calculer les statistiques avant sauvegarde
gameSchema.pre('save', function(next) {
  // Calculer les pièces par minute
  this.stats.piecesPerMinute = this.calculatePPM();
  next();
});

module.exports = mongoose.model('Game', gameSchema);

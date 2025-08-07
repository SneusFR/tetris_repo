const mongoose = require('mongoose');

const leaderboardEntrySchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Une seule entrée par joueur
  },
  
  bestScore: {
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
  
  gameMode: {
    type: String,
    enum: ['classic', 'sprint', 'ultra', 'zen'],
    required: true
  },
  
  achievedAt: {
    type: Date,
    required: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour le tri par score
leaderboardEntrySchema.index({ bestScore: -1 });
leaderboardEntrySchema.index({ player: 1 });

module.exports = mongoose.model('LeaderboardEntry', leaderboardEntrySchema);

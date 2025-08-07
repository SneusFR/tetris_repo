const mongoose = require('mongoose');
const Game = require('../models/Game');
const LeaderboardEntry = require('../models/LeaderboardEntry');

async function migrateLeaderboard() {
  try {
    console.log('Début de la migration du leaderboard...');

    // Récupérer le meilleur score de chaque joueur
    const bestScores = await Game.aggregate([
      {
        $group: {
          _id: '$player',
          bestScore: { $max: '$score' },
          bestGame: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'games',
          let: { playerId: '$_id', bestScore: '$bestScore' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$player', '$$playerId'] },
                    { $eq: ['$score', '$$bestScore'] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: 'bestGame'
        }
      },
      { $unwind: '$bestGame' }
    ]);

    console.log(`${bestScores.length} joueurs trouvés avec des scores`);

    // Créer les entrées du leaderboard
    let migratedCount = 0;
    for (const entry of bestScores) {
      const game = entry.bestGame;
      
      try {
        await LeaderboardEntry.findOneAndUpdate(
          { player: game.player },
          {
            player: game.player,
            bestScore: game.score,
            level: game.level,
            linesCleared: game.linesCleared,
            gameMode: game.gameMode || 'classic', // Valeur par défaut si non définie
            achievedAt: game.createdAt,
            updatedAt: new Date()
          },
          { upsert: true }
        );
        
        migratedCount++;
        
        if (migratedCount % 100 === 0) {
          console.log(`${migratedCount} entrées migrées...`);
        }
      } catch (error) {
        console.error(`Erreur lors de la migration pour le joueur ${game.player}:`, error.message);
      }
    }

    console.log(`Migration terminée: ${migratedCount} entrées créées/mises à jour`);
    
    // Vérification finale
    const totalEntries = await LeaderboardEntry.countDocuments();
    console.log(`Total d'entrées dans le leaderboard: ${totalEntries}`);
    
    return migratedCount;
  } catch (error) {
    console.error('Erreur lors de la migration:', error);
    throw error;
  }
}

// Fonction pour exécuter la migration si le script est appelé directement
async function runMigration() {
  try {
    // Connexion à MongoDB (utilise les variables d'environnement)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tetris-server';
    await mongoose.connect(mongoUri);
    console.log('Connecté à MongoDB');

    const migratedCount = await migrateLeaderboard();
    
    console.log(`Migration réussie: ${migratedCount} entrées migrées`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration si le script est appelé directement
if (require.main === module) {
  runMigration();
}

module.exports = migrateLeaderboard;

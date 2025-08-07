const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/stats/user/:username
// @desc    Obtenir les statistiques détaillées d'un utilisateur
// @access  Public (avec restrictions de confidentialité)
router.get('/user/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const { period = 'all' } = req.query;

    const user = await User.findOne({ username, isActive: true });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier les paramètres de confidentialité
    if (!user.settings.privacy.showStats && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Statistiques privées'
      });
    }

    // Filtrer par période
    let dateFilter = {};
    if (period !== 'all') {
      const now = new Date();
      switch (period) {
        case 'daily':
          dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 1)) } };
          break;
        case 'weekly':
          dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
          break;
        case 'monthly':
          dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
          break;
        case 'yearly':
          dateFilter = { createdAt: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) } };
          break;
      }
    }

    // Récupérer les statistiques des parties
    const gameStats = await Game.aggregate([
      {
        $match: {
          player: user._id,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          totalScore: { $sum: '$score' },
          bestScore: { $max: '$score' },
          averageScore: { $avg: '$score' },
          totalLinesCleared: { $sum: '$linesCleared' },
          totalTimePlayed: { $sum: '$timePlayed' },
          averageTimePlayed: { $avg: '$timePlayed' },
          
          // Statistiques par mode de jeu
          classicGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'classic'] }, 1, 0] }
          },
          sprintGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'sprint'] }, 1, 0] }
          },
          ultraGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'ultra'] }, 1, 0] }
          },
          zenGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'zen'] }, 1, 0] }
          },

          // Statistiques avancées
          totalPieces: { $sum: '$stats.totalPieces' },
          totalTSpins: { $sum: '$stats.tSpins' },
          totalPerfectClears: { $sum: '$stats.perfectClears' },
          maxCombo: { $max: '$stats.combos.maxCombo' },
          
          // Types de lignes
          singleLines: { $sum: '$stats.lineClears.single' },
          doubleLines: { $sum: '$stats.lineClears.double' },
          tripleLines: { $sum: '$stats.lineClears.triple' },
          tetrisLines: { $sum: '$stats.lineClears.tetris' }
        }
      }
    ]);

    // Récupérer l'évolution des scores (dernières 30 parties)
    const recentGames = await Game.find({
      player: user._id,
      ...dateFilter
    })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('score level linesCleared timePlayed gameMode createdAt stats');

    // Calculer les tendances
    const scoreHistory = recentGames.reverse().map(game => ({
      date: game.createdAt,
      score: game.score,
      level: game.level,
      gameMode: game.gameMode
    }));

    // Statistiques par jour de la semaine
    const dayStats = await Game.aggregate([
      {
        $match: {
          player: user._id,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          games: { $sum: 1 },
          averageScore: { $avg: '$score' },
          totalScore: { $sum: '$score' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Statistiques par heure
    const hourStats = await Game.aggregate([
      {
        $match: {
          player: user._id,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          games: { $sum: 1 },
          averageScore: { $avg: '$score' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Records personnels
    const personalBests = await Game.find({
      player: user._id,
      isPersonalBest: true
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('score level linesCleared timePlayed gameMode createdAt');

    const stats = gameStats[0] || {
      totalGames: 0,
      totalScore: 0,
      bestScore: 0,
      averageScore: 0,
      totalLinesCleared: 0,
      totalTimePlayed: 0,
      averageTimePlayed: 0,
      classicGames: 0,
      sprintGames: 0,
      ultraGames: 0,
      zenGames: 0,
      totalPieces: 0,
      totalTSpins: 0,
      totalPerfectClears: 0,
      maxCombo: 0,
      singleLines: 0,
      doubleLines: 0,
      tripleLines: 0,
      tetrisLines: 0
    };

    // Calculer des métriques supplémentaires
    const efficiency = stats.totalLinesCleared > 0 ? 
      Math.round((stats.tetrisLines * 4 + stats.tripleLines * 3 + stats.doubleLines * 2 + stats.singleLines) / stats.totalLinesCleared * 100) : 0;
    
    const piecesPerMinute = stats.totalTimePlayed > 0 ? 
      Math.round(stats.totalPieces / (stats.totalTimePlayed / 60)) : 0;

    res.json({
      success: true,
      data: {
        user: user.getPublicProfile(),
        period,
        stats: {
          ...stats,
          efficiency,
          piecesPerMinute,
          averageScore: Math.round(stats.averageScore || 0),
          averageTimePlayed: Math.round(stats.averageTimePlayed || 0)
        },
        trends: {
          scoreHistory,
          dayStats: dayStats.map(day => ({
            day: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][day._id - 1],
            games: day.games,
            averageScore: Math.round(day.averageScore),
            totalScore: day.totalScore
          })),
          hourStats
        },
        personalBests,
        recentGames: recentGames.slice(-10) // Les 10 dernières parties
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/stats/global
// @desc    Obtenir les statistiques globales du jeu
// @access  Public
router.get('/global', async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    // Filtrer par période
    let dateFilter = {};
    if (period !== 'all') {
      const now = new Date();
      switch (period) {
        case 'daily':
          dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 1)) } };
          break;
        case 'weekly':
          dateFilter = { createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
          break;
        case 'monthly':
          dateFilter = { createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
          break;
      }
    }

    // Statistiques générales
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalGames = await Game.countDocuments(dateFilter);

    // Statistiques des parties
    const gameStats = await Game.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalScore: { $sum: '$score' },
          averageScore: { $avg: '$score' },
          bestScore: { $max: '$score' },
          totalLinesCleared: { $sum: '$linesCleared' },
          totalTimePlayed: { $sum: '$timePlayed' },
          totalPieces: { $sum: '$stats.totalPieces' },
          
          // Par mode de jeu
          classicGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'classic'] }, 1, 0] }
          },
          sprintGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'sprint'] }, 1, 0] }
          },
          ultraGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'ultra'] }, 1, 0] }
          },
          zenGames: {
            $sum: { $cond: [{ $eq: ['$gameMode', 'zen'] }, 1, 0] }
          }
        }
      }
    ]);

    // Top joueurs par score
    const topPlayers = await Game.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$player',
          bestScore: { $max: '$score' },
          totalGames: { $sum: 1 },
          totalScore: { $sum: '$score' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.isActive': true,
          'user.settings.privacy.showProfile': true
        }
      },
      {
        $project: {
          username: '$user.username',
          country: '$user.profile.country',
          avatar: '$user.profile.avatar',
          bestScore: 1,
          totalGames: 1,
          averageScore: { $round: [{ $divide: ['$totalScore', '$totalGames'] }, 0] }
        }
      },
      { $sort: { bestScore: -1 } },
      { $limit: 10 }
    ]);

    // Statistiques par pays
    const countryStats = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$profile.country',
          players: { $sum: 1 },
          averageLevel: { $avg: '$profile.level' },
          averageRanking: { $avg: '$ranking.rankingPoints' },
          totalScore: { $sum: '$gameStats.totalScore' }
        }
      },
      { $sort: { players: -1 } },
      { $limit: 10 }
    ]);

    // Évolution du nombre de parties par jour (derniers 30 jours)
    const dailyGames = await Game.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          games: { $sum: 1 },
          uniquePlayers: { $addToSet: '$player' }
        }
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          games: 1,
          uniquePlayers: { $size: '$uniquePlayers' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    const stats = gameStats[0] || {
      totalScore: 0,
      averageScore: 0,
      bestScore: 0,
      totalLinesCleared: 0,
      totalTimePlayed: 0,
      totalPieces: 0,
      classicGames: 0,
      sprintGames: 0,
      ultraGames: 0,
      zenGames: 0
    };

    res.json({
      success: true,
      data: {
        period,
        overview: {
          totalUsers,
          totalGames,
          ...stats,
          averageScore: Math.round(stats.averageScore || 0),
          averageTimePlayed: stats.totalTimePlayed > 0 ? Math.round(stats.totalTimePlayed / totalGames) : 0,
          piecesPerMinute: stats.totalTimePlayed > 0 ? Math.round(stats.totalPieces / (stats.totalTimePlayed / 60)) : 0
        },
        topPlayers,
        countryStats,
        trends: {
          dailyGames
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques globales:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/stats/compare/:username1/:username2
// @desc    Comparer les statistiques de deux utilisateurs
// @access  Public (avec restrictions de confidentialité)
router.get('/compare/:username1/:username2', optionalAuth, async (req, res) => {
  try {
    const { username1, username2 } = req.params;

    const users = await User.find({
      username: { $in: [username1, username2] },
      isActive: true
    });

    if (users.length !== 2) {
      return res.status(404).json({
        success: false,
        message: 'Un ou plusieurs utilisateurs non trouvés'
      });
    }

    // Vérifier les paramètres de confidentialité
    for (const user of users) {
      if (!user.settings.privacy.showStats && (!req.user || req.user._id.toString() !== user._id.toString())) {
        return res.status(403).json({
          success: false,
          message: `Les statistiques de ${user.username} sont privées`
        });
      }
    }

    // Récupérer les statistiques pour chaque utilisateur
    const comparison = {};
    
    for (const user of users) {
      const gameStats = await Game.aggregate([
        { $match: { player: user._id } },
        {
          $group: {
            _id: null,
            totalGames: { $sum: 1 },
            bestScore: { $max: '$score' },
            averageScore: { $avg: '$score' },
            totalLinesCleared: { $sum: '$linesCleared' },
            totalTimePlayed: { $sum: '$timePlayed' },
            totalPieces: { $sum: '$stats.totalPieces' },
            totalTSpins: { $sum: '$stats.tSpins' },
            maxCombo: { $max: '$stats.combos.maxCombo' }
          }
        }
      ]);

      const stats = gameStats[0] || {
        totalGames: 0,
        bestScore: 0,
        averageScore: 0,
        totalLinesCleared: 0,
        totalTimePlayed: 0,
        totalPieces: 0,
        totalTSpins: 0,
        maxCombo: 0
      };

      comparison[user.username] = {
        user: user.getPublicProfile(),
        stats: {
          ...stats,
          averageScore: Math.round(stats.averageScore || 0),
          piecesPerMinute: stats.totalTimePlayed > 0 ? Math.round(stats.totalPieces / (stats.totalTimePlayed / 60)) : 0
        }
      };
    }

    res.json({
      success: true,
      data: {
        comparison
      }
    });

  } catch (error) {
    console.error('Erreur lors de la comparaison des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;

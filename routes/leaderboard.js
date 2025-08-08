const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const LeaderboardEntry = require('../models/LeaderboardEntry');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/leaderboard/simple
// @desc    Obtenir le leaderboard avec une entrée par joueur
// @access  Public
router.get('/simple', optionalAuth, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const leaderboard = await LeaderboardEntry.find()
      .populate({
        path: 'player',
        select: 'username profile.avatar profile.banner profile.level profile.country settings.privacy.showProfile',
        match: { 
          isActive: true,
          'settings.privacy.showProfile': true 
        }
      })
      .sort({ bestScore: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Filtrer les entrées où le joueur n'existe plus ou a un profil privé
    const filteredLeaderboard = leaderboard
      .filter(entry => entry.player)
      .map((entry, index) => ({
        rank: skip + index + 1,
        player: {
          id: entry.player._id,
          username: entry.player.username,
          avatar: entry.player.profile.avatar,
          banner: entry.player.profile.banner,
          level: entry.player.profile.level,
          country: entry.player.profile.country
        },
        bestScore: entry.bestScore,
        level: entry.level,
        linesCleared: entry.linesCleared,
        gameMode: entry.gameMode,
        achievedAt: entry.achievedAt
      }));

    const total = await LeaderboardEntry.countDocuments();

    // Position de l'utilisateur connecté
    let userRank = null;
    if (req.user) {
      const userEntry = await LeaderboardEntry.findOne({ player: req.user._id });
      if (userEntry) {
        const betterScores = await LeaderboardEntry.countDocuments({
          bestScore: { $gt: userEntry.bestScore }
        });
        userRank = betterScores + 1;
      }
    }

    res.json({
      success: true,
      data: {
        leaderboard: filteredLeaderboard,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: filteredLeaderboard.length,
          totalEntries: total
        },
        userRank
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du leaderboard simple:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/leaderboard/global
// @desc    Obtenir le classement global
// @access  Public
router.get('/global', optionalAuth, async (req, res) => {
  try {
    const { limit = 50, page = 1, period = 'all' } = req.query;
    const skip = (page - 1) * limit;

    let sortField = 'gameStats.bestScore';
    let matchCondition = {
      isActive: true,
      'settings.privacy.showProfile': true
    };

    // Filtrer par période si nécessaire
    if (period !== 'all') {
      let dateFilter = new Date();
      switch (period) {
        case 'daily':
          dateFilter.setDate(dateFilter.getDate() - 1);
          break;
        case 'weekly':
          dateFilter.setDate(dateFilter.getDate() - 7);
          break;
        case 'monthly':
          dateFilter.setMonth(dateFilter.getMonth() - 1);
          break;
        default:
          break;
      }

      if (period !== 'all') {
        // Pour les périodes spécifiques, on trie par meilleur score récent
        const recentGames = await Game.aggregate([
          {
            $match: {
              createdAt: { $gte: dateFilter }
            }
          },
          {
            $group: {
              _id: '$player',
              bestScore: { $max: '$score' },
              totalGames: { $sum: 1 }
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
          {
            $unwind: '$user'
          },
          {
            $match: {
              'user.isActive': true,
              'user.settings.privacy.showProfile': true
            }
          },
          {
            $sort: { bestScore: -1 }
          },
          {
            $skip: skip
          },
          {
            $limit: parseInt(limit)
          },
          {
            $project: {
              _id: '$user._id',
              username: '$user.username',
              profile: '$user.profile',
              ranking: '$user.ranking',
              gameStats: '$user.gameStats',
              bestScore: 1,
              totalGames: 1,
              createdAt: '$user.createdAt'
            }
          }
        ]);

        const total = await Game.aggregate([
          {
            $match: {
              createdAt: { $gte: dateFilter }
            }
          },
          {
            $group: {
              _id: '$player'
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
          {
            $unwind: '$user'
          },
          {
            $match: {
              'user.isActive': true,
              'user.settings.privacy.showProfile': true
            }
          },
          {
            $count: 'total'
          }
        ]);

        const totalCount = total.length > 0 ? total[0].total : 0;

        return res.json({
          success: true,
          data: {
            leaderboard: recentGames.map((user, index) => ({
              ...user,
              rank: skip + index + 1
            })),
            pagination: {
              current: parseInt(page),
              total: Math.ceil(totalCount / limit),
              count: recentGames.length,
              totalUsers: totalCount
            },
            period
          }
        });
      }
    }

    // Classement global par défaut
    const users = await User.find(matchCondition)
      .select('username profile ranking gameStats createdAt')
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(matchCondition);

    // Ajouter le rang à chaque utilisateur
    const leaderboard = users.map((user, index) => ({
      ...user.toObject(),
      rank: skip + index + 1
    }));

    // Si l'utilisateur est connecté, ajouter sa position
    let userRank = null;
    if (req.user) {
      const userPosition = await User.countDocuments({
        ...matchCondition,
        'gameStats.bestScore': { $gt: req.user.gameStats.bestScore }
      });
      userRank = userPosition + 1;
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: users.length,
          totalUsers: total
        },
        userRank,
        period
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/leaderboard/country/:countryCode
// @desc    Obtenir le classement par pays
// @access  Public
router.get('/country/:countryCode', optionalAuth, async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const matchCondition = {
      isActive: true,
      'settings.privacy.showProfile': true,
      'profile.country': countryCode.toUpperCase()
    };

    const users = await User.find(matchCondition)
      .select('username profile ranking gameStats createdAt')
      .sort({ 'ranking.rankingPoints': -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(matchCondition);

    const leaderboard = users.map((user, index) => ({
      ...user.toObject(),
      rank: skip + index + 1
    }));

    // Position de l'utilisateur connecté dans ce pays
    let userRank = null;
    if (req.user && req.user.profile.country === countryCode.toUpperCase()) {
      const userPosition = await User.countDocuments({
        ...matchCondition,
        'ranking.rankingPoints': { $gt: req.user.ranking.rankingPoints }
      });
      userRank = userPosition + 1;
    }

    res.json({
      success: true,
      data: {
        leaderboard,
        country: countryCode.toUpperCase(),
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: users.length,
          totalUsers: total
        },
        userRank
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du leaderboard par pays:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/leaderboard/friends
// @desc    Obtenir le classement des amis
// @access  Private
router.get('/friends', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Récupérer les IDs des amis acceptés
    const friendIds = req.user.friends
      .filter(friend => friend.status === 'accepted')
      .map(friend => friend.user);

    // Ajouter l'utilisateur lui-même
    friendIds.push(req.user._id);

    const users = await User.find({
      _id: { $in: friendIds },
      isActive: true
    })
    .select('username profile ranking gameStats createdAt')
    .sort({ 'ranking.rankingPoints': -1 })
    .limit(parseInt(limit))
    .skip(skip);

    const total = friendIds.length;

    const leaderboard = users.map((user, index) => ({
      ...user.toObject(),
      rank: skip + index + 1,
      isCurrentUser: user._id.toString() === req.user._id.toString()
    }));

    res.json({
      success: true,
      data: {
        leaderboard,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: users.length,
          totalUsers: total
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du leaderboard des amis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/leaderboard/stats
// @desc    Obtenir les statistiques générales du leaderboard
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalGames = await Game.countDocuments();
    
    const topScores = await Game.find()
      .sort({ score: -1 })
      .limit(10)
      .populate('player', 'username profile.country profile.avatar')
      .select('score level linesCleared timePlayed gameMode createdAt');

    const gameStats = await Game.aggregate([
      {
        $group: {
          _id: null,
          totalScore: { $sum: '$score' },
          totalLines: { $sum: '$linesCleared' },
          totalTime: { $sum: '$timePlayed' },
          avgScore: { $avg: '$score' },
          maxScore: { $max: '$score' }
        }
      }
    ]);

    const countryStats = await User.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$profile.country',
          count: { $sum: 1 },
          avgRanking: { $avg: '$ranking.rankingPoints' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalGames,
        topScores,
        globalStats: gameStats[0] || {
          totalScore: 0,
          totalLines: 0,
          totalTime: 0,
          avgScore: 0,
          maxScore: 0
        },
        countryStats
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

module.exports = router;

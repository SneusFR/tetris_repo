const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Game = require('../models/Game');
const LeaderboardEntry = require('../models/LeaderboardEntry');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile/:username
// @desc    Obtenir le profil public d'un utilisateur
// @access  Public
router.get('/profile/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ username }).select('-password -email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier les paramètres de confidentialité
    if (!user.settings.privacy.showProfile && (!req.user || req.user._id.toString() !== user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Profil privé'
      });
    }

    const profile = user.getPublicProfile();
    
    // Ajouter des statistiques supplémentaires si autorisées
    if (user.settings.privacy.showStats || (req.user && req.user._id.toString() === user._id.toString())) {
      // Récupérer les dernières parties
      const recentGames = await Game.find({ player: user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('score level linesCleared timePlayed gameMode createdAt');

      profile.recentGames = recentGames;
    }

    res.json({
      success: true,
      data: {
        user: profile
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Mettre à jour le profil de l'utilisateur connecté
// @access  Private
router.put('/profile', [
  auth,
  body('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Le code pays doit faire 2 caractères'),
  body('title')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Le titre ne peut pas dépasser 50 caractères'),
  body('bannerId')
    .optional()
    .isString()
    .withMessage('L\'ID de la bannière doit être une chaîne de caractères')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { country, title, avatar, banner, bannerId } = req.body;
    const user = req.user;

    // Mettre à jour les champs du profil
    if (country) user.profile.country = country;
    if (title) user.profile.title = title;
    if (avatar) user.profile.avatar = avatar;
    if (banner) user.profile.banner = banner;

    // Gérer la mise à jour de la bannière par ID
    if (bannerId) {
      // Vérifier que l'utilisateur possède cette bannière (sauf pour 'default')
      if (bannerId !== 'default' && !user.inventory.unlockedBanners.includes(bannerId)) {
        return res.status(400).json({
          success: false,
          message: 'Vous ne possédez pas cette bannière'
        });
      }
      user.profile.banner = bannerId;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/users/settings
// @desc    Mettre à jour les paramètres de l'utilisateur
// @access  Private
router.put('/settings', [
  auth,
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'neon', 'retro', 'galaxy', 'cyberpunk', 'pastel', 'glassmorphism'])
    .withMessage('Thème invalide'),
  body('visualEffect')
    .optional()
    .isIn(['none', 'rainbow', 'fire', 'ice', 'electric', 'matrix'])
    .withMessage('Effet visuel invalide'),
  body('language')
    .optional()
    .isIn(['fr', 'en', 'es', 'de'])
    .withMessage('Langue invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const user = req.user;
    const {
      theme,
      visualEffect,
      soundEnabled,
      musicEnabled,
      notifications,
      language,
      privacy
    } = req.body;

    // Mettre à jour les paramètres
    if (theme) user.settings.theme = theme;
    if (visualEffect !== undefined) user.settings.visualEffect = visualEffect;
    if (typeof soundEnabled === 'boolean') user.settings.soundEnabled = soundEnabled;
    if (typeof musicEnabled === 'boolean') user.settings.musicEnabled = musicEnabled;
    if (typeof notifications === 'boolean') user.settings.notifications = notifications;
    if (language) user.settings.language = language;
    
    if (privacy) {
      if (typeof privacy.showProfile === 'boolean') {
        user.settings.privacy.showProfile = privacy.showProfile;
      }
      if (typeof privacy.showStats === 'boolean') {
        user.settings.privacy.showStats = privacy.showStats;
      }
      if (typeof privacy.allowFriendRequests === 'boolean') {
        user.settings.privacy.allowFriendRequests = privacy.allowFriendRequests;
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Paramètres mis à jour avec succès',
      data: {
        settings: user.settings
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/users/search
// @desc    Rechercher des utilisateurs
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10, page = 1 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'La recherche doit contenir au moins 2 caractères'
      });
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    const skip = (page - 1) * limit;

    const users = await User.find({
      $and: [
        {
          $or: [
            { username: searchRegex },
            { 'profile.title': searchRegex }
          ]
        },
        { isActive: true },
        { 'settings.privacy.showProfile': true }
      ]
    })
    .select('username profile.country profile.avatar profile.level profile.title ranking.currentRank gameStats.bestScore')
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ 'ranking.rankingPoints': -1 });

    const total = await User.countDocuments({
      $and: [
        {
          $or: [
            { username: searchRegex },
            { 'profile.title': searchRegex }
          ]
        },
        { isActive: true },
        { 'settings.privacy.showProfile': true }
      ]
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: users.length,
          totalUsers: total
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/users/game-result
// @desc    Enregistrer le résultat d'une partie
// @access  Private
router.post('/game-result', [
  auth,
  body('score')
    .isInt({ min: 0 })
    .withMessage('Le score doit être un nombre positif'),
  body('level')
    .isInt({ min: 1 })
    .withMessage('Le niveau doit être un nombre positif'),
  body('linesCleared')
    .isInt({ min: 0 })
    .withMessage('Le nombre de lignes doit être un nombre positif'),
  body('timePlayed')
    .isInt({ min: 0 })
    .withMessage('Le temps de jeu doit être un nombre positif'),
  body('gameMode')
    .optional()
    .isIn(['classic', 'sprint', 'ultra', 'zen'])
    .withMessage('Mode de jeu invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const user = req.user;
    const gameData = req.body;

    // Créer l'enregistrement de la partie
    const game = new Game({
      player: user._id,
      ...gameData
    });

    // Vérifier si c'est un record personnel
    if (gameData.score > user.gameStats.bestScore) {
      game.isPersonalBest = true;
    }

    await game.save();

    // Vérifier si c'est un nouveau record personnel pour le leaderboard
    const currentBest = await LeaderboardEntry.findOne({ player: user._id });
    
    if (!currentBest || gameData.score > currentBest.bestScore) {
      // Mettre à jour ou créer l'entrée du leaderboard
      await LeaderboardEntry.findOneAndUpdate(
        { player: user._id },
        {
          player: user._id,
          bestScore: gameData.score,
          level: gameData.level,
          linesCleared: gameData.linesCleared,
          gameMode: gameData.gameMode,
          achievedAt: new Date(),
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      game.isPersonalBest = true;
    }

    // Mettre à jour les statistiques de l'utilisateur
    user.updateGameStats({
      score: gameData.score,
      linesCleared: gameData.linesCleared,
      timePlayed: gameData.timePlayed,
      won: gameData.won || false
    });

    await user.save();

    res.json({
      success: true,
      message: 'Résultat de la partie enregistré',
      data: {
        game,
        newStats: user.gameStats,
        levelUp: user.profile.level > (user.profile.level - Math.floor(gameData.score / 10000)),
        personalBest: game.isPersonalBest
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du résultat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/users/games
// @desc    Obtenir l'historique des parties de l'utilisateur connecté
// @access  Private
router.get('/games', auth, async (req, res) => {
  try {
    const { limit = 20, page = 1, gameMode } = req.query;
    const skip = (page - 1) * limit;

    const filter = { player: req.user._id };
    if (gameMode) {
      filter.gameMode = gameMode;
    }

    const games = await Game.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Game.countDocuments(filter);

    res.json({
      success: true,
      data: {
        games,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: games.length,
          totalGames: total
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des parties:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Supprimer le compte de l'utilisateur
// @access  Private
router.delete('/account', [
  auth,
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis pour supprimer le compte')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { password } = req.body;
    const user = req.user;

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe incorrect'
      });
    }

    // Désactiver le compte au lieu de le supprimer
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    user.username = `deleted_${Date.now()}_${user.username}`;
    
    await user.save();

    res.json({
      success: true,
      message: 'Compte supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du compte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;

const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/debug/my-stats
// @desc    Afficher les statistiques de l'utilisateur pour debug
// @access  Private
router.get('/my-stats', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // Conditions de déblocage des bannières
    const bannerConditions = {
      'neon_grid': { type: 'score', value: 50000, current: user.gameStats.bestScore },
      'particle_storm': { type: 'lines', value: 500, current: user.gameStats.totalLinesCleared },
      'rainbow_wave': { type: 'level', value: 15, current: user.profile.level },
      'matrix_rain': { type: 'games', value: 100, current: user.gameStats.totalGames },
      'fire_storm': { type: 'score', value: 100000, current: user.gameStats.bestScore },
      'cyber_circuit': { type: 'rank', value: 10, current: user.ranking.bestRank || 999999 }
    };

    // Calculer quelles bannières sont débloquables
    const bannerStatus = {};
    for (const [bannerId, condition] of Object.entries(bannerConditions)) {
      let isUnlocked = false;
      let progress = 0;

      switch (condition.type) {
        case 'score':
        case 'lines':
        case 'level':
        case 'games':
          isUnlocked = condition.current >= condition.value;
          progress = Math.min(100, Math.round((condition.current / condition.value) * 100));
          break;
        case 'rank':
          isUnlocked = condition.current <= condition.value;
          progress = condition.current <= condition.value ? 100 : 0;
          break;
      }

      bannerStatus[bannerId] = {
        ...condition,
        isUnlocked,
        progress: `${progress}%`,
        status: isUnlocked ? '✅ Débloquée' : '❌ Verrouillée'
      };
    }

    res.json({
      success: true,
      data: {
        userInfo: {
          username: user.username,
          level: user.profile.level,
          credits: user.profile.credits
        },
        currentStats: {
          bestScore: user.gameStats.bestScore,
          totalLinesCleared: user.gameStats.totalLinesCleared,
          totalGames: user.gameStats.totalGames,
          bestRank: user.ranking.bestRank || 'Aucun rang',
          level: user.profile.level
        },
        bannerStatus,
        unlockedBanners: user.inventory.unlockedBanners
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;

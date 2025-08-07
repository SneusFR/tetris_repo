const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configuration des bannières disponibles (synchronisée avec le front-end)
const AVAILABLE_BANNERS = {
  'default': {
    id: 'default',
    name: 'Défaut',
    description: 'La bannière de base disponible pour tous',
    price: 0,
    rarity: 'common',
    unlockCondition: null,
    type: 'gradient',
    config: {
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }
  },
  'tetris_classic': {
    id: 'tetris_classic',
    name: 'Tetris Classique',
    description: 'Pièces de Tetris qui tombent en animation',
    price: 500,
    rarity: 'common',
    unlockCondition: null,
    type: 'tetris',
    config: {
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      pieces: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
      animation: 'falling'
    }
  },
  'neon_grid': {
    id: 'neon_grid',
    name: 'Grille Néon',
    description: 'Grille néon avec effet de pulsation',
    price: 750,
    rarity: 'uncommon',
    unlockCondition: { type: 'score', value: 50000 },
    type: 'grid',
    config: {
      background: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%)',
      gridColor: '#00ffff',
      glowIntensity: 'high'
    }
  },
  'particle_storm': {
    id: 'particle_storm',
    name: 'Tempête de Particules',
    description: 'Particules animées en mouvement',
    price: 1000,
    rarity: 'rare',
    unlockCondition: { type: 'lines', value: 500 },
    type: 'particles',
    config: {
      background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
      particleColor: '#ff6b6b',
      particleCount: 50,
      animation: 'storm'
    }
  },
  'rainbow_wave': {
    id: 'rainbow_wave',
    name: 'Vague Arc-en-ciel',
    description: 'Vagues colorées en mouvement',
    price: 1200,
    rarity: 'rare',
    unlockCondition: { type: 'level', value: 15 },
    type: 'wave',
    config: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      waveColors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff'],
      animation: 'wave'
    }
  },
  'matrix_rain': {
    id: 'matrix_rain',
    name: 'Pluie Matrix',
    description: 'Effet Matrix avec caractères qui tombent',
    price: 1500,
    rarity: 'epic',
    unlockCondition: { type: 'games', value: 100 },
    type: 'matrix',
    config: {
      background: 'linear-gradient(135deg, #0d1421 0%, #1a252f 100%)',
      textColor: '#00ff41',
      speed: 'medium'
    }
  },
  'fire_storm': {
    id: 'fire_storm',
    name: 'Tempête de Feu',
    description: 'Flammes animées avec effet de feu',
    price: 1800,
    rarity: 'epic',
    unlockCondition: { type: 'score', value: 100000 },
    type: 'fire',
    config: {
      background: 'linear-gradient(135deg, #2c1810 0%, #8b4513 100%)',
      flameColors: ['#ff4500', '#ff6347', '#ffa500', '#ffff00'],
      intensity: 'high'
    }
  },
  'cyber_circuit': {
    id: 'cyber_circuit',
    name: 'Circuit Cyberpunk',
    description: 'Circuits électroniques avec pulsations',
    price: 2000,
    rarity: 'legendary',
    unlockCondition: { type: 'rank', value: 10 },
    type: 'circuit',
    config: {
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
      circuitColor: '#00ffff',
      pulseSpeed: 'fast'
    }
  }
};

// Configuration des thèmes disponibles
const AVAILABLE_THEMES = {
  'neon': { 
    id: 'neon', 
    name: 'Neon', 
    price: 0, 
    colors: ['#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff8800', '#ff0044', '#8800ff'] 
  },
  'retro': { 
    id: 'retro', 
    name: 'Retro', 
    price: 500, 
    colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6ab04c'] 
  },
  'galaxy': { 
    id: 'galaxy', 
    name: 'Galaxy', 
    price: 1000, 
    colors: ['#9b59b6', '#3498db', '#e74c3c', '#f39c12', '#1abc9c', '#34495e', '#e67e22'] 
  },
  'cyberpunk': { 
    id: 'cyberpunk', 
    name: 'Cyberpunk', 
    price: 1500, 
    colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff', '#06ffa5', '#ff4365'] 
  },
  'pastel': { 
    id: 'pastel', 
    name: 'Pastel', 
    price: 750, 
    colors: ['#ffd3e1', '#c9f0ff', '#fff5ba', '#e4c1f9', '#a8e6cf', '#ffd3b6', '#ffaaa5'] 
  },
  'glassmorphism': { 
    id: 'glassmorphism', 
    name: 'Glassmorphism', 
    price: 1200, 
    colors: ['rgba(255, 255, 255, 0.45)', 'rgba(255, 182, 193, 0.5)', 'rgba(173, 216, 230, 0.5)', 'rgba(255, 255, 224, 0.45)', 'rgba(221, 160, 221, 0.5)', 'rgba(152, 251, 152, 0.45)', 'rgba(255, 218, 185, 0.5)'] 
  }
};

// Configuration des effets disponibles
const AVAILABLE_EFFECTS = {
  'none': { id: 'none', name: 'Aucun', price: 0 },
  'rainbow': { id: 'rainbow', name: 'Arc-en-ciel', price: 800 },
  'fire': { id: 'fire', name: 'Feu', price: 1200 },
  'ice': { id: 'ice', name: 'Glace', price: 1200 },
  'electric': { id: 'electric', name: 'Électrique', price: 1500 },
  'matrix': { id: 'matrix', name: 'Matrix', price: 2000 }
};

// @route   GET /api/shop/banners
// @desc    Obtenir la liste des bannières disponibles
// @access  Private
router.get('/banners', auth, async (req, res) => {
  try {
    const user = req.user;
    const banners = [];

    for (const [bannerId, bannerData] of Object.entries(AVAILABLE_BANNERS)) {
      const isOwned = bannerId === 'default' || user.inventory.unlockedBanners.includes(bannerId);
      const isUnlockable = checkUnlockCondition(user, bannerData.unlockCondition);
      
      banners.push({
        ...bannerData,
        isOwned,
        isUnlockable,
        canPurchase: !isOwned && isUnlockable
      });
    }

    // Trier par rareté et prix
    const rarityOrder = { 'common': 1, 'uncommon': 2, 'rare': 3, 'epic': 4, 'legendary': 5 };
    banners.sort((a, b) => {
      if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
        return rarityOrder[a.rarity] - rarityOrder[b.rarity];
      }
      return a.price - b.price;
    });

    res.json({
      success: true,
      data: {
        banners,
        userStats: {
          currentBanner: user.profile.banner,
          unlockedCount: user.inventory.unlockedBanners.length + 1, // +1 pour default
          totalCount: Object.keys(AVAILABLE_BANNERS).length,
          credits: user.profile.credits
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des bannières:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/shop/purchase-banner
// @desc    Acheter une bannière
// @access  Private
router.post('/purchase-banner', [
  auth,
  body('bannerId')
    .notEmpty()
    .withMessage('L\'ID de la bannière est requis')
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

    const { bannerId } = req.body;
    const user = req.user;

    // Vérifier que la bannière existe
    const banner = AVAILABLE_BANNERS[bannerId];
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Bannière non trouvée'
      });
    }

    // Vérifier que l'utilisateur ne possède pas déjà cette bannière
    if (bannerId === 'default' || user.inventory.unlockedBanners.includes(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Vous possédez déjà cette bannière'
      });
    }

    // Vérifier les conditions de déblocage
    if (!checkUnlockCondition(user, banner.unlockCondition)) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne remplissez pas les conditions pour débloquer cette bannière'
      });
    }

    // Vérifier que l'utilisateur a assez de crédits
    if (user.profile.credits < banner.price) {
      return res.status(400).json({
        success: false,
        message: `Crédits insuffisants. Vous avez ${user.profile.credits} crédits, mais cette bannière coûte ${banner.price} crédits.`
      });
    }
    
    // Déduire les crédits et ajouter la bannière à l'inventaire
    user.profile.credits -= banner.price;
    user.inventory.unlockedBanners.push(bannerId);
    await user.save();

    res.json({
      success: true,
      message: 'Bannière achetée avec succès',
      data: {
        banner,
        newUnlockedCount: user.inventory.unlockedBanners.length + 1,
        remainingCredits: user.profile.credits,
        creditsSpent: banner.price
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'achat de la bannière:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/shop/select-banner
// @desc    Sélectionner une bannière possédée
// @access  Private
router.post('/select-banner', [
  auth,
  body('bannerId')
    .notEmpty()
    .withMessage('L\'ID de la bannière est requis')
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

    const { bannerId } = req.body;
    const user = req.user;

    // Vérifier que la bannière existe
    const banner = AVAILABLE_BANNERS[bannerId];
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Bannière non trouvée'
      });
    }

    // Vérifier que l'utilisateur possède cette bannière
    if (bannerId !== 'default' && !user.inventory.unlockedBanners.includes(bannerId)) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne possédez pas cette bannière'
      });
    }

    // Mettre à jour la bannière sélectionnée
    user.profile.banner = bannerId;
    await user.save();

    res.json({
      success: true,
      message: 'Bannière sélectionnée avec succès',
      data: {
        selectedBanner: banner,
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la sélection de la bannière:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/shop/banners/:bannerId
// @desc    Obtenir les détails d'une bannière spécifique
// @access  Private
router.get('/banners/:bannerId', auth, async (req, res) => {
  try {
    const { bannerId } = req.params;
    const user = req.user;

    const banner = AVAILABLE_BANNERS[bannerId];
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Bannière non trouvée'
      });
    }

    const isOwned = bannerId === 'default' || user.inventory.unlockedBanners.includes(bannerId);
    const isUnlockable = checkUnlockCondition(user, banner.unlockCondition);

    res.json({
      success: true,
      data: {
        ...banner,
        isOwned,
        isUnlockable,
        canPurchase: !isOwned && isUnlockable,
        unlockProgress: getUnlockProgress(user, banner.unlockCondition)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la bannière:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// Fonction utilitaire pour vérifier les conditions de déblocage
function checkUnlockCondition(user, condition) {
  if (!condition) return true; // Pas de condition = toujours débloquable

  switch (condition.type) {
    case 'score':
      return user.gameStats.bestScore >= condition.value;
    case 'lines':
      return user.gameStats.totalLinesCleared >= condition.value;
    case 'level':
      return user.profile.level >= condition.value;
    case 'rank':
      return user.ranking.bestRank && user.ranking.bestRank <= condition.value;
    case 'games':
      return user.gameStats.totalGames >= condition.value;
    default:
      return false;
  }
}

// Fonction utilitaire pour obtenir le progrès vers le déblocage
function getUnlockProgress(user, condition) {
  if (!condition) return { current: 1, required: 1, percentage: 100 };

  let current, required;

  switch (condition.type) {
    case 'score':
      current = user.gameStats.bestScore;
      required = condition.value;
      break;
    case 'lines':
      current = user.gameStats.totalLinesCleared;
      required = condition.value;
      break;
    case 'level':
      current = user.profile.level;
      required = condition.value;
      break;
    case 'rank':
      current = user.ranking.bestRank || 999999;
      required = condition.value;
      // Pour le rang, on inverse la logique (plus petit = mieux)
      return {
        current: Math.min(current, required),
        required,
        percentage: current <= required ? 100 : 0
      };
    case 'games':
      current = user.gameStats.totalGames;
      required = condition.value;
      break;
    default:
      return { current: 0, required: 1, percentage: 0 };
  }

  const percentage = Math.min(100, Math.round((current / required) * 100));
  return { current, required, percentage };
}

// @route   GET /api/shop/themes
// @desc    Obtenir la liste des thèmes disponibles
// @access  Private
router.get('/themes', auth, async (req, res) => {
  try {
    const user = req.user;
    const themes = [];

    for (const [themeId, themeData] of Object.entries(AVAILABLE_THEMES)) {
      const isOwned = themeId === 'neon' || user.inventory.unlockedThemes?.includes(themeId);
      
      themes.push({
        ...themeData,
        isOwned: isOwned,
        canPurchase: !isOwned
      });
    }

    res.json({
      success: true,
      data: {
        themes,
        userStats: {
          currentTheme: user.settings.theme,
          credits: user.profile.credits
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des thèmes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/shop/purchase-theme
// @desc    Acheter un thème
// @access  Private
router.post('/purchase-theme', [
  auth,
  body('themeId').notEmpty().withMessage('L\'ID du thème est requis')
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

    const { themeId } = req.body;
    const user = req.user;

    const theme = AVAILABLE_THEMES[themeId];
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: 'Thème non trouvé'
      });
    }

    // Vérifier si déjà possédé
    if (themeId === 'neon' || user.inventory.unlockedThemes?.includes(themeId)) {
      return res.status(400).json({
        success: false,
        message: 'Vous possédez déjà ce thème'
      });
    }

    // Vérifier les crédits
    if (user.profile.credits < theme.price) {
      return res.status(400).json({
        success: false,
        message: `Crédits insuffisants. Vous avez ${user.profile.credits} crédits, mais ce thème coûte ${theme.price} crédits.`
      });
    }

    // Initialiser unlockedThemes si nécessaire
    if (!user.inventory.unlockedThemes) {
      user.inventory.unlockedThemes = [];
    }

    // Effectuer l'achat
    user.profile.credits -= theme.price;
    user.inventory.unlockedThemes.push(themeId);
    await user.save();

    res.json({
      success: true,
      message: 'Thème acheté avec succès',
      data: {
        theme,
        remainingCredits: user.profile.credits,
        creditsSpent: theme.price
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'achat du thème:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/shop/select-theme
// @desc    Sélectionner un thème possédé
// @access  Private
router.post('/select-theme', [
  auth,
  body('themeId').notEmpty().withMessage('L\'ID du thème est requis')
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

    const { themeId } = req.body;
    const user = req.user;

    const theme = AVAILABLE_THEMES[themeId];
    if (!theme) {
      return res.status(404).json({
        success: false,
        message: 'Thème non trouvé'
      });
    }

    // Vérifier que l'utilisateur possède ce thème
    if (themeId !== 'neon' && !user.inventory.unlockedThemes?.includes(themeId)) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne possédez pas ce thème'
      });
    }

    // Mettre à jour le thème sélectionné
    user.settings.theme = themeId;
    await user.save();

    res.json({
      success: true,
      message: 'Thème sélectionné avec succès',
      data: {
        selectedTheme: theme,
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la sélection du thème:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/shop/effects
// @desc    Obtenir la liste des effets disponibles
// @access  Private
router.get('/effects', auth, async (req, res) => {
  try {
    const user = req.user;
    const effects = [];

    for (const [effectId, effectData] of Object.entries(AVAILABLE_EFFECTS)) {
      const isOwned = effectId === 'none' || user.inventory.unlockedEffects?.includes(effectId);
      
      effects.push({
        ...effectData,
        isOwned: isOwned,
        canPurchase: !isOwned
      });
    }

    res.json({
      success: true,
      data: {
        effects,
        userStats: {
          currentEffect: user.settings.visualEffect,
          credits: user.profile.credits
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des effets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/shop/purchase-effect
// @desc    Acheter un effet
// @access  Private
router.post('/purchase-effect', [
  auth,
  body('effectId').notEmpty().withMessage('L\'ID de l\'effet est requis')
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

    const { effectId } = req.body;
    const user = req.user;

    const effect = AVAILABLE_EFFECTS[effectId];
    if (!effect) {
      return res.status(404).json({
        success: false,
        message: 'Effet non trouvé'
      });
    }

    // Vérifier si déjà possédé
    if (effectId === 'none' || user.inventory.unlockedEffects?.includes(effectId)) {
      return res.status(400).json({
        success: false,
        message: 'Vous possédez déjà cet effet'
      });
    }

    // Vérifier les crédits
    if (user.profile.credits < effect.price) {
      return res.status(400).json({
        success: false,
        message: `Crédits insuffisants. Vous avez ${user.profile.credits} crédits, mais cet effet coûte ${effect.price} crédits.`
      });
    }

    // Initialiser unlockedEffects si nécessaire
    if (!user.inventory.unlockedEffects) {
      user.inventory.unlockedEffects = [];
    }

    // Effectuer l'achat
    user.profile.credits -= effect.price;
    user.inventory.unlockedEffects.push(effectId);
    await user.save();

    res.json({
      success: true,
      message: 'Effet acheté avec succès',
      data: {
        effect,
        remainingCredits: user.profile.credits,
        creditsSpent: effect.price
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'achat de l\'effet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/shop/select-effect
// @desc    Sélectionner un effet possédé
// @access  Private
router.post('/select-effect', [
  auth,
  body('effectId').notEmpty().withMessage('L\'ID de l\'effet est requis')
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

    const { effectId } = req.body;
    const user = req.user;

    const effect = AVAILABLE_EFFECTS[effectId];
    if (!effect) {
      return res.status(404).json({
        success: false,
        message: 'Effet non trouvé'
      });
    }

    // Vérifier que l'utilisateur possède cet effet
    if (effectId !== 'none' && !user.inventory.unlockedEffects?.includes(effectId)) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne possédez pas cet effet'
      });
    }

    // Mettre à jour l'effet sélectionné
    user.settings.visualEffect = effectId;
    await user.save();

    res.json({
      success: true,
      message: 'Effet sélectionné avec succès',
      data: {
        selectedEffect: effect,
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la sélection de l\'effet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;

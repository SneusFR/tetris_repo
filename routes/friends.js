const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/friends
// @desc    Obtenir la liste des amis de l'utilisateur connecté
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status = 'accepted' } = req.query;
    
    const user = await User.findById(req.user._id)
      .populate({
        path: 'friends.user',
        select: 'username profile.country profile.avatar profile.level profile.title ranking.currentRank gameStats.bestScore lastLogin',
        match: { isActive: true }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Filtrer par statut
    let friends = user.friends.filter(friend => 
      friend.user && friend.status === status
    );

    // Trier par dernière connexion pour les amis acceptés
    if (status === 'accepted') {
      friends.sort((a, b) => new Date(b.user.lastLogin) - new Date(a.user.lastLogin));
    }

    res.json({
      success: true,
      data: {
        friends: friends.map(friend => ({
          id: friend._id,
          user: friend.user,
          status: friend.status,
          addedAt: friend.addedAt,
          isOnline: friend.user.lastLogin > new Date(Date.now() - 5 * 60 * 1000) // 5 minutes
        })),
        total: friends.length
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des amis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   POST /api/friends/request
// @desc    Envoyer une demande d'ami
// @access  Private
router.post('/request', [
  auth,
  body('username')
    .notEmpty()
    .withMessage('Nom d\'utilisateur requis')
    .isLength({ min: 3, max: 20 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 20 caractères')
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

    const { username } = req.body;
    const currentUser = req.user;

    // Vérifier qu'on n'essaie pas de s'ajouter soi-même
    if (username === currentUser.username) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas vous ajouter vous-même'
      });
    }

    // Trouver l'utilisateur cible
    const targetUser = await User.findOne({ 
      username, 
      isActive: true 
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier les paramètres de confidentialité
    if (!targetUser.settings.privacy.allowFriendRequests) {
      return res.status(403).json({
        success: false,
        message: 'Cet utilisateur n\'accepte pas les demandes d\'ami'
      });
    }

    // Vérifier si une relation existe déjà
    const existingFriend = currentUser.friends.find(
      friend => friend.user.toString() === targetUser._id.toString()
    );

    if (existingFriend) {
      let message = '';
      switch (existingFriend.status) {
        case 'accepted':
          message = 'Vous êtes déjà amis';
          break;
        case 'pending':
          message = 'Demande d\'ami déjà envoyée';
          break;
        case 'blocked':
          message = 'Impossible d\'envoyer une demande d\'ami';
          break;
      }
      return res.status(400).json({
        success: false,
        message
      });
    }

    // Vérifier si l'utilisateur cible a déjà envoyé une demande
    const existingRequest = targetUser.friends.find(
      friend => friend.user.toString() === currentUser._id.toString()
    );

    if (existingRequest && existingRequest.status === 'pending') {
      // Accepter automatiquement la demande existante
      existingRequest.status = 'accepted';
      await targetUser.save();

      // Ajouter la relation réciproque
      currentUser.friends.push({
        user: targetUser._id,
        status: 'accepted'
      });
      await currentUser.save();

      return res.json({
        success: true,
        message: 'Demande d\'ami acceptée automatiquement',
        data: {
          friend: {
            user: targetUser.getPublicProfile(),
            status: 'accepted',
            addedAt: new Date()
          }
        }
      });
    }

    // Ajouter la demande d'ami
    currentUser.friends.push({
      user: targetUser._id,
      status: 'pending'
    });

    // Ajouter la demande reçue chez l'utilisateur cible
    targetUser.friends.push({
      user: currentUser._id,
      status: 'pending'
    });

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.json({
      success: true,
      message: 'Demande d\'ami envoyée',
      data: {
        friend: {
          user: targetUser.getPublicProfile(),
          status: 'pending',
          addedAt: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi de la demande d\'ami:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/friends/:friendId/accept
// @desc    Accepter une demande d'ami
// @access  Private
router.put('/:friendId/accept', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;

    // Trouver la demande d'ami
    const friendRequest = currentUser.friends.id(friendId);
    
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Demande d\'ami non trouvée'
      });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cette demande d\'ami n\'est pas en attente'
      });
    }

    // Accepter la demande
    friendRequest.status = 'accepted';
    await currentUser.save();

    // Mettre à jour le statut chez l'autre utilisateur
    const otherUser = await User.findById(friendRequest.user);
    if (otherUser) {
      const reciprocalRequest = otherUser.friends.find(
        friend => friend.user.toString() === currentUser._id.toString()
      );
      
      if (reciprocalRequest) {
        reciprocalRequest.status = 'accepted';
        await otherUser.save();
      }
    }

    // Récupérer les informations complètes de l'ami
    const populatedUser = await User.findById(friendRequest.user)
      .select('username profile.country profile.avatar profile.level profile.title ranking.currentRank gameStats.bestScore lastLogin');

    res.json({
      success: true,
      message: 'Demande d\'ami acceptée',
      data: {
        friend: {
          id: friendRequest._id,
          user: populatedUser,
          status: 'accepted',
          addedAt: friendRequest.addedAt
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'acceptation de la demande d\'ami:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/friends/:friendId/decline
// @desc    Refuser une demande d'ami
// @access  Private
router.put('/:friendId/decline', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;

    // Trouver et supprimer la demande d'ami
    const friendRequest = currentUser.friends.id(friendId);
    
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Demande d\'ami non trouvée'
      });
    }

    const otherUserId = friendRequest.user;
    
    // Supprimer la demande chez l'utilisateur actuel
    currentUser.friends.pull(friendId);
    await currentUser.save();

    // Supprimer la demande chez l'autre utilisateur
    const otherUser = await User.findById(otherUserId);
    if (otherUser) {
      const reciprocalRequest = otherUser.friends.find(
        friend => friend.user.toString() === currentUser._id.toString()
      );
      
      if (reciprocalRequest) {
        otherUser.friends.pull(reciprocalRequest._id);
        await otherUser.save();
      }
    }

    res.json({
      success: true,
      message: 'Demande d\'ami refusée'
    });

  } catch (error) {
    console.error('Erreur lors du refus de la demande d\'ami:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   DELETE /api/friends/:friendId
// @desc    Supprimer un ami
// @access  Private
router.delete('/:friendId', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;

    // Trouver l'ami à supprimer
    const friend = currentUser.friends.id(friendId);
    
    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'Ami non trouvé'
      });
    }

    const otherUserId = friend.user;
    
    // Supprimer l'ami chez l'utilisateur actuel
    currentUser.friends.pull(friendId);
    await currentUser.save();

    // Supprimer la relation réciproque
    const otherUser = await User.findById(otherUserId);
    if (otherUser) {
      const reciprocalFriend = otherUser.friends.find(
        friend => friend.user.toString() === currentUser._id.toString()
      );
      
      if (reciprocalFriend) {
        otherUser.friends.pull(reciprocalFriend._id);
        await otherUser.save();
      }
    }

    res.json({
      success: true,
      message: 'Ami supprimé'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de l\'ami:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   PUT /api/friends/:friendId/block
// @desc    Bloquer un utilisateur
// @access  Private
router.put('/:friendId/block', auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUser = req.user;

    // Trouver la relation
    const friend = currentUser.friends.id(friendId);
    
    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'Relation non trouvée'
      });
    }

    const otherUserId = friend.user;
    
    // Bloquer l'utilisateur
    friend.status = 'blocked';
    await currentUser.save();

    // Supprimer la relation chez l'autre utilisateur
    const otherUser = await User.findById(otherUserId);
    if (otherUser) {
      const reciprocalFriend = otherUser.friends.find(
        friend => friend.user.toString() === currentUser._id.toString()
      );
      
      if (reciprocalFriend) {
        otherUser.friends.pull(reciprocalFriend._id);
        await otherUser.save();
      }
    }

    res.json({
      success: true,
      message: 'Utilisateur bloqué'
    });

  } catch (error) {
    console.error('Erreur lors du blocage de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/friends/suggestions
// @desc    Obtenir des suggestions d'amis
// @access  Private
router.get('/suggestions', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    const { limit = 10 } = req.query;

    // Récupérer les IDs des utilisateurs déjà en relation
    const existingRelations = currentUser.friends.map(friend => friend.user);
    existingRelations.push(currentUser._id);

    // Trouver des utilisateurs similaires (même pays, niveau proche)
    const suggestions = await User.find({
      _id: { $nin: existingRelations },
      isActive: true,
      'settings.privacy.showProfile': true,
      'settings.privacy.allowFriendRequests': true,
      $or: [
        { 'profile.country': currentUser.profile.country },
        { 
          'profile.level': { 
            $gte: currentUser.profile.level - 5, 
            $lte: currentUser.profile.level + 5 
          }
        }
      ]
    })
    .select('username profile.country profile.avatar profile.level profile.title ranking.currentRank gameStats.bestScore')
    .limit(parseInt(limit))
    .sort({ 'ranking.rankingPoints': -1 });

    res.json({
      success: true,
      data: {
        suggestions,
        total: suggestions.length
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;

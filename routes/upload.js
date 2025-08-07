const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    // Créer les sous-dossiers par type
    const subFolder = file.fieldname === 'avatar' ? 'avatars' : 'banners';
    const fullPath = path.join(uploadPath, subFolder);
    
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${req.user._id}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// Filtrer les types de fichiers acceptés
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls les formats JPEG, PNG, GIF et WebP sont acceptés.'), false);
  }
};

// Configuration multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB par défaut
    files: 1 // Un seul fichier à la fois
  }
});

// @route   POST /api/upload/avatar
// @desc    Upload d'un avatar
// @access  Private
router.post('/avatar', auth, (req, res) => {
  const uploadSingle = upload.single('avatar');
  
  uploadSingle(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Fichier trop volumineux. Taille maximale: 5MB'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Erreur lors de l\'upload: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier fourni'
        });
      }

      // Supprimer l'ancien avatar s'il existe
      if (req.user.profile.avatar) {
        const oldAvatarPath = path.join(process.cwd(), req.user.profile.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }

      // Construire l'URL du fichier
      const fileUrl = `/uploads/avatars/${req.file.filename}`;
      
      // Mettre à jour le profil utilisateur
      req.user.profile.avatar = fileUrl;
      await req.user.save();

      res.json({
        success: true,
        message: 'Avatar uploadé avec succès',
        data: {
          avatarUrl: fileUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      });

    } catch (error) {
      console.error('Erreur lors de l\'upload de l\'avatar:', error);
      
      // Supprimer le fichier en cas d'erreur
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
});

// @route   POST /api/upload/banner
// @desc    Upload d'une bannière
// @access  Private
router.post('/banner', auth, (req, res) => {
  const uploadSingle = upload.single('banner');
  
  uploadSingle(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Fichier trop volumineux. Taille maximale: 5MB'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Erreur lors de l\'upload: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier fourni'
        });
      }

      // Supprimer l'ancienne bannière si elle existe
      if (req.user.profile.banner) {
        const oldBannerPath = path.join(process.cwd(), req.user.profile.banner);
        if (fs.existsSync(oldBannerPath)) {
          fs.unlinkSync(oldBannerPath);
        }
      }

      // Construire l'URL du fichier
      const fileUrl = `/uploads/banners/${req.file.filename}`;
      
      // Mettre à jour le profil utilisateur
      req.user.profile.banner = fileUrl;
      await req.user.save();

      res.json({
        success: true,
        message: 'Bannière uploadée avec succès',
        data: {
          bannerUrl: fileUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      });

    } catch (error) {
      console.error('Erreur lors de l\'upload de la bannière:', error);
      
      // Supprimer le fichier en cas d'erreur
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur'
      });
    }
  });
});

// @route   DELETE /api/upload/avatar
// @desc    Supprimer l'avatar actuel
// @access  Private
router.delete('/avatar', auth, async (req, res) => {
  try {
    if (!req.user.profile.avatar) {
      return res.status(400).json({
        success: false,
        message: 'Aucun avatar à supprimer'
      });
    }

    // Supprimer le fichier
    const avatarPath = path.join(process.cwd(), req.user.profile.avatar);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    // Mettre à jour le profil
    req.user.profile.avatar = null;
    await req.user.save();

    res.json({
      success: true,
      message: 'Avatar supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de l\'avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   DELETE /api/upload/banner
// @desc    Supprimer la bannière actuelle
// @access  Private
router.delete('/banner', auth, async (req, res) => {
  try {
    if (!req.user.profile.banner) {
      return res.status(400).json({
        success: false,
        message: 'Aucune bannière à supprimer'
      });
    }

    // Supprimer le fichier
    const bannerPath = path.join(process.cwd(), req.user.profile.banner);
    if (fs.existsSync(bannerPath)) {
      fs.unlinkSync(bannerPath);
    }

    // Mettre à jour le profil
    req.user.profile.banner = null;
    await req.user.save();

    res.json({
      success: true,
      message: 'Bannière supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de la bannière:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

// @route   GET /api/upload/info
// @desc    Obtenir les informations sur les limites d'upload
// @access  Public
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
      maxFileSizeMB: Math.round((parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024) / (1024 * 1024)),
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    }
  });
});


// Gestion des erreurs globales pour les routes d'upload
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Fichier trop volumineux'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Trop de fichiers'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Champ de fichier inattendu'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: 'Erreur lors de l\'upload'
  });
});

module.exports = router;

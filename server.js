const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware de sécurité
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Désactivé pour éviter les complications avec l'API JSON
}));

// Rate limiting général
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limite chaque IP à 1000 requêtes par windowMs
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  }
});

// Rate limiting spécifiques pour les routes de boutique
const shopLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limite à 30 requêtes par minute pour les routes boutique
  message: {
    error: 'Trop de requêtes vers la boutique, veuillez patienter.'
  }
});

// Application des limiteurs
app.use('/api', generalLimiter);

// Configuration CORS améliorée
const allowed = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,                     // prod: https://tetris-revolution.vercel.app
];

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);   // Postman/curl
    const vercelPreview = /^https:\/\/tetris-revolution.*\.vercel\.app$/.test(origin);
    const ok = allowed.filter(Boolean).includes(origin) || vercelPreview;
    // 👉 NE PAS jeter d'erreur ici
    return callback(null, ok);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// pense aussi au preflight
app.options('*', cors());

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques pour les uploads
app.use('/uploads', express.static('uploads'));
app.use('/images/banners', express.static('uploads/banners'));

// Route de santé (OBLIGATOIRE)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes avec rate limiting spécifique pour la boutique
app.use('/api/shop', shopLimiter, require('./routes/shop'));

// Autres routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/upload', require('./routes/upload'));

// Route de test
app.get('/', (req, res) => {
  res.json({ message: 'Tetris API Server is running!' });
});

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tetris', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connecté à MongoDB'))
.catch(err => console.error('❌ Erreur de connexion MongoDB:', err));

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Erreur interne du serveur' 
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route non trouvée' 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

module.exports = app;

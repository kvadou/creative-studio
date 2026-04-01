import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, validateConfig } from '../lib/config.js';
import passport from './auth/passport.js';
import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import healthRouter from './routes/health.js';
import lessonsRouter from './routes/lessons.js';
import conversationsRouter from './routes/conversations.js';
import projectsRouter from './routes/projects.js';
import generateRouter from './routes/generate.js';
import batchRouter from './routes/batch.js';
import referenceRouter from './routes/reference.js';
import templatesRouter from './routes/templates.js';
import illustrationsRouter from './routes/illustrations.js';
import videoRouter from './routes/video.js';
import audioRouter from './routes/audio.js';
import adminRouter from './routes/admin.js';
import statsRouter from './routes/stats.js';
import mediaIngestionRouter from './routes/media-ingestion.js';
import charactersRouter from './routes/characters.js';
import chunksRouter from './routes/chunks.js';
import activityRouter from './routes/activity.js';
import suggestionsRouter from './routes/suggestions.js';
import searchRouter from './routes/search.js';
import chessNewsRouter from './routes/chess-news.js';
import episodesRouter from './routes/episodes.js';
import marketingRouter from './routes/marketing.js';

// Validate config on startup
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', error);
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors({
  credentials: true,
  origin: [
    'https://studio-stc.herokuapp.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Auth middleware (checks JWT, protects routes)
app.use(authMiddleware);

// Rate limiters for AI-heavy endpoints
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // 10 requests per minute per user
  keyGenerator: (req) => req.user?.email || 'anonymous',
  message: { error: 'Too many requests. Please try again in a minute.' },
  validate: false,
});

const batchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 3,              // 3 batch requests per minute
  keyGenerator: (req) => req.user?.email || 'anonymous',
  message: { error: 'Too many batch requests. Please try again in a minute.' },
  validate: false,
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/chat', aiRateLimit, chatRouter);
app.use('/api/health', healthRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/generate', aiRateLimit, generateRouter);
app.use('/api/generate/batch', batchRateLimit, batchRouter);
app.use('/api/reference', referenceRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/illustrations', illustrationsRouter);
app.use('/api/video', videoRouter);
app.use('/api/episodes', episodesRouter);
app.use('/api/audio', audioRouter);
app.use('/api/admin', adminRouter);
app.use('/api/stats', statsRouter);
app.use('/api/media', mediaIngestionRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/chunks', chunksRouter);
app.use('/api/activity', activityRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/search', searchRouter);
app.use('/api/chess-news', chessNewsRouter);
app.use('/api/marketing', marketingRouter);

// Serve static files in production
if (config.nodeEnv === 'production') {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  app.use(express.static(path.join(__dirname, '../client')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

// Global error handler — must be registered after all routes
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[GlobalErrorHandler]', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

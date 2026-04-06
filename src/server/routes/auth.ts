import { Router } from 'express';
import passport from '../auth/passport.js';
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from '../auth/jwt.js';
import { isAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/passport.js';

const router = Router();

// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', { session: false }));

// Handle OAuth callback
router.get(
  '/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: process.env.NODE_ENV === 'production' ? '/auth/unauthorized' : 'http://localhost:5173/auth/unauthorized',
  }),
  async (req, res) => {
    const user = req.user as AuthUser;

    if (!user) {
      return res.redirect('/auth/unauthorized');
    }

    // Upsert user record for tracking
    try {
      await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, picture: user.picture, lastLoginAt: new Date() },
        create: { email: user.email, name: user.name, picture: user.picture, lastLoginAt: new Date() },
      });
    } catch (err) {
      console.error('[Auth] User upsert error:', err);
      // Non-blocking — don't prevent login
    }

    // Sign JWT and set cookie
    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    // Redirect to app (Vite dev server in development, same origin in production)
    const redirectUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
    res.redirect(redirectUrl);
  }
);

// Demo login — portfolio demo mode, no Google auth required
router.post('/demo-login', (req, res) => {
  const demoUser: AuthUser = {
    id: 'demo-user',
    email: 'demo@acmestudio.com',
    name: 'Demo User',
    picture: undefined,
  };

  const token = signToken(demoUser);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  return res.json({ ok: true, user: demoUser });
});

// Get current user
router.get('/me', (req, res) => {
  // User is attached by auth middleware if valid
  if (req.user) {
    return res.json({
      user: req.user,
      isAdmin: isAdmin(req.user.email),
    });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// Logout
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

export default router;

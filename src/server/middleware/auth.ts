import { Request, Response, NextFunction } from 'express';
import { verifyToken, COOKIE_NAME } from '../auth/jwt.js';
import type { AuthUser } from '../auth/passport.js';

// Extend Express Request to include user (using module augmentation)
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/google',
  '/api/auth/callback',
  '/api/auth/demo-login',
  '/api/health',
  '/auth/signin',
  '/auth/unauthorized',
];

// Check if path matches any public route
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

// Middleware to verify JWT and attach user to request
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow public routes
  if (isPublicRoute(req.path)) {
    return next();
  }

  // Allow static assets
  if (
    req.path.startsWith('/assets/') ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.ico') ||
    req.path.endsWith('.png') ||
    req.path.endsWith('.svg')
  ) {
    return next();
  }

  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    // For API requests, return 401
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // For page requests, redirect to sign in
    return res.redirect('/auth/signin');
  }

  const user = verifyToken(token);

  if (!user) {
    // Invalid token - clear it and redirect
    res.clearCookie(COOKIE_NAME, { path: '/' });
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.redirect('/auth/signin');
  }

  // Attach user to request
  req.user = user;
  next();
}

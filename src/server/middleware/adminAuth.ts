import { Request, Response, NextFunction } from 'express';
import { config } from '../../lib/config.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!config.adminEmails.includes(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

export function isAdmin(email: string): boolean {
  return config.adminEmails.includes(email);
}

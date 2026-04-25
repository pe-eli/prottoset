import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { authConfig } from '../auth/auth.config';

/**
 * Middleware to allow expensive operations (email blasts, WhatsApp blasts, etc.)
 * only for users in the whitelist.
 * 
 * Owners can bypass this check with AUTH_ALLOW_OWNER_EXPENSIVE_OPERATIONS=true
 */
export function requireVerifiedAccount(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!authConfig.requireVerifiedAccountsForExpensiveActions()) {
      next();
      return;
    }

    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    // Owners can always perform expensive operations (if env var allows)
    const allowOwnerBypass = process.env.AUTH_ALLOW_OWNER_EXPENSIVE_OPERATIONS !== 'false';
    if (authUser.role === 'owner' && allowOwnerBypass) {
      next();
      return;
    }

    // Check if user email is in the whitelist configured via environment variable.
    // Format: ALLOWED_USERS_EMAILS=user1@example.com,user2@example.com
    const allowedEmails = (process.env.ALLOWED_USERS_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const isAllowed = allowedEmails.includes(authUser.email.toLowerCase());
    if (isAllowed) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Acesso restrito para esta operação.'
    });
  };
}
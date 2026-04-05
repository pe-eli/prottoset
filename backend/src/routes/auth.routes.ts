import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authService } from '../auth/auth.service';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const ok = await authService.validateCredentials(username, password);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = authService.signSession({ username });
  res.cookie(authService.sessionCookieName, token, authService.getCookieOptions());
  return res.json({ authenticated: true, username });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(authService.sessionCookieName, {
    ...authService.getCookieOptions(),
    maxAge: 0,
  });
  return res.json({ authenticated: false });
});

router.get('/me', requireAuth, (req, res) => {
  const username = (req as typeof req & { authUser?: string }).authUser ?? '';
  return res.json({ authenticated: true, username });
});

export default router;

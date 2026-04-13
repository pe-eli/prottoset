import { Router } from 'express';
import slowDown from 'express-slow-down';
import { consumeRateLimit } from '../security/rate-limit.store';
import { loginSchema, registerSchema, resendVerificationSchema, verifyCodeSchema } from '../auth/schemas';
import { authService } from '../auth/auth.service';
import { hashPassword, verifyPassword } from '../auth/password';
import { hashToken } from '../auth/tokens';
import { usersRepository } from '../auth/users.repository';
import { generateVerificationCode, getVerificationCodeExpiryDate, hashVerificationCode, safeCompareVerificationCode, sendVerificationCode } from '../auth/email-verification';
import { refreshTokensRepository } from '../auth/refresh-tokens.repository';
import { authConfig, REFRESH_COOKIE, OAUTH_STATE_COOKIE } from '../auth/auth.config';
import { generateState, generateCodeVerifier, generateCodeChallenge, buildAuthorizationUrl } from '../auth/pkce';
import { verifyGoogleIdToken, exchangeCodeForTokens } from '../auth/verify';
import { findOrLinkAccount } from '../auth/linkAccount';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createSecurityRateLimit } from '../middleware/rate-limit.middleware';
import { requireCsrfToken, sendCsrfToken } from '../middleware/csrf.middleware';

const router = Router();

const authLimiter = createSecurityRateLimit({
  name: 'auth-common',
  message: 'Muitas tentativas. Tente novamente em alguns minutos.',
  ip: { limit: 10, windowMs: 10 * 60 * 1000 },
});

const registerLimiter = createSecurityRateLimit({
  name: 'auth-register',
  message: 'Muitas tentativas de cadastro. Aguarde alguns minutos.',
  ip: { limit: 5, windowMs: 10 * 60 * 1000 },
});

const loginLimiter = createSecurityRateLimit({
  name: 'auth-login',
  message: 'Muitas tentativas de login. Aguarde alguns minutos.',
  ip: { limit: 10, windowMs: 10 * 60 * 1000 },
});

const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,
  delayMs: (hits) => (hits - 2) * 500,
});

const refreshLimiter = createSecurityRateLimit({
  name: 'auth-refresh',
  message: 'Muitas tentativas de renovação. Tente novamente em alguns minutos.',
  ip: { limit: 20, windowMs: 15 * 60 * 1000 },
  user: { limit: 30, windowMs: 15 * 60 * 1000 },
});

const verifyCodeLimiter = createSecurityRateLimit({
  name: 'auth-verify-code',
  message: 'Muitas tentativas de validação. Tente novamente mais tarde.',
  ip: { limit: 30, windowMs: 10 * 60 * 1000 },
});

const resendCodeLimiter = createSecurityRateLimit({
  name: 'auth-resend-code',
  message: 'Muitas solicitações. Aguarde antes de tentar novamente.',
  ip: { limit: 10, windowMs: 60 * 60 * 1000 },
});

router.get('/csrf', authLimiter, sendCsrfToken);

// ─── POST /register ──────────────────────────────────────────────
router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, password, name } = parsed.data;

  const existing = await usersRepository.getByEmail(email);
  if (!existing) {
    const code = generateVerificationCode();
    const codeHash = await hashVerificationCode(code);
    const expiresAt = getVerificationCodeExpiryDate();
    const passwordHash = await hashPassword(password);
    const createdUser = await usersRepository.create({
      email,
      displayName: name,
      passwordHash,
      googleId: '',
      emailVerified: false,
      verificationCodeHash: codeHash,
      verificationCodeExpiresAt: expiresAt.toISOString(),
      role: 'member',
    });

    try {
      await sendVerificationCode({
        to: createdUser.email,
        displayName: createdUser.displayName,
        code,
      });
    } catch (error) {
      console.error('[Auth] Falha ao enviar código de verificação (registro):', error);
    }
  } else if (!existing.emailVerified) {
    const code = generateVerificationCode();
    const codeHash = await hashVerificationCode(code);
    const expiresAt = getVerificationCodeExpiryDate();
    await usersRepository.setVerificationCode(existing.id, codeHash, expiresAt.toISOString());

    try {
      await sendVerificationCode({
        to: existing.email,
        displayName: existing.displayName,
        code,
      });
    } catch (error) {
      console.error('[Auth] Falha ao reenviar código de verificação (registro existente):', error);
    }
  }

  res.status(202).json({
    message: 'Se os dados forem válidos, você receberá um código de verificação por e-mail.',
    email: email,
  });
}));

// ─── POST /verify-code ───────────────────────────────────────────
router.post('/verify-code', verifyCodeLimiter, asyncHandler(async (req, res) => {
  const parsed = verifyCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, code } = parsed.data;

  const emailRateLimit = await consumeRateLimit(`auth-verify-code:email:${email}`, 10, 10 * 60 * 1000);
  if (!emailRateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil(emailRateLimit.retryAfterMs / 1000));
    res.status(429).json({ error: 'Muitas tentativas de validação. Tente novamente mais tarde.' });
    return;
  }

  const user = await usersRepository.getByEmail(email);

  const codeMatch = await safeCompareVerificationCode(user?.verificationCodeHash ?? null, code);
  const hasValidExpiry = !!user?.verificationCodeExpiresAt && new Date(user.verificationCodeExpiresAt).getTime() > Date.now();
  const canVerify = !!user && !user.emailVerified && codeMatch && hasValidExpiry;

  if (!canVerify) {
    // Generic message to avoid user/account enumeration.
    res.status(400).json({ error: 'Código inválido ou expirado. Solicite um novo código.' });
    return;
  }

  await usersRepository.markEmailVerified(user.id);
  res.json({ message: 'E-mail verificado com sucesso. Você já pode fazer login.' });
}));

// ─── POST /resend-code ───────────────────────────────────
router.post('/resend-code', resendCodeLimiter, asyncHandler(async (req, res) => {
  const parsed = resendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(200).json({ message: 'Se existir uma conta pendente, um novo código será enviado.' });
    return;
  }

  const { email } = parsed.data;
  const emailRateLimit = await consumeRateLimit(`auth-resend-code:email:${email}`, 5, 60 * 60 * 1000);
  if (!emailRateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil(emailRateLimit.retryAfterMs / 1000));
    res.status(429).json({ error: 'Muitas solicitações. Aguarde antes de tentar novamente.' });
    return;
  }

  const user = await usersRepository.getByEmail(email);

  if (user && !user.emailVerified) {
    const code = generateVerificationCode();
    const codeHash = await hashVerificationCode(code);
    const expiresAt = getVerificationCodeExpiryDate();
    await usersRepository.setVerificationCode(user.id, codeHash, expiresAt.toISOString());

    try {
      await sendVerificationCode({
        to: user.email,
        displayName: user.displayName,
        code,
      });
    } catch (error) {
      console.error('[Auth] Falha ao reenviar código de verificação:', error);
    }
  }

  // Generic response avoids user enumeration.
  res.status(200).json({ message: 'Se existir uma conta pendente, um novo código será enviado.' });
}));

// ─── POST /login ─────────────────────────────────────────────────
router.post('/login', loginLimiter, loginSlowDown, asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, password } = parsed.data;
  const user = await usersRepository.getByEmail(email);

  const valid = await verifyPassword(password, user?.passwordHash || '');
  if (!valid || !user) {
    res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({ error: 'Confirme seu e-mail antes de entrar.' });
    return;
  }

  await authService.issueSession(res, user);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
}));

// ─── POST /logout ────────────────────────────────────────────────
router.post('/logout', requireCsrfToken(), asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    const hash = hashToken(raw);
    const token = await refreshTokensRepository.findByHash(hash);
    if (token) {
      await refreshTokensRepository.revokeById(token.id);
    }
  }

  authService.clearSession(res);
  res.json({ authenticated: false });
}));

// ─── POST /refresh ───────────────────────────────────────────────
router.post('/refresh', refreshLimiter, requireCsrfToken(), asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) {
    res.status(401).json({ error: 'Token ausente' });
    return;
  }

  const hash = hashToken(raw);
  let tokenDoc = await refreshTokensRepository.findByHash(hash);

  if (!tokenDoc) {
    const revoked = await refreshTokensRepository.findByHashIncludingRevoked(hash);
    if (revoked) {
      await refreshTokensRepository.revokeFamily(revoked.family);
    }
    authService.clearSession(res);
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  if (new Date(tokenDoc.expiresAt) < new Date()) {
    await refreshTokensRepository.revokeById(tokenDoc.id);
    authService.clearSession(res);
    res.status(401).json({ error: 'Token expirado' });
    return;
  }

  const accessToken = await authService.rotateRefresh(res, {
    id: tokenDoc.id,
    userId: tokenDoc.userId,
    family: tokenDoc.family,
  });

  if (!accessToken) {
    authService.clearSession(res);
    res.status(401).json({ error: 'Usuário não encontrado' });
    return;
  }

  const user = await usersRepository.getById(tokenDoc.userId);
  res.json({
    user: user
      ? {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        emailVerified: user.emailVerified,
      }
      : null,
  });
}));

// ─── GET /me ─────────────────────────────────────────────────────
router.get('/me', asyncHandler(requireAuth), asyncHandler(async (req, res) => {
  const user = await usersRepository.getById(req.authUser!.userId);
  if (!user) {
    res.status(401).json({ error: 'Usuário não encontrado' });
    return;
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
}));

// ─── GET /google ─────────────────────────────────────────────────
router.get('/google', authLimiter, (req, res) => {
  if (!authConfig.googleEnabled()) {
    res.status(404).json({ error: 'Google OAuth não configurado' });
    return;
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  res.cookie(OAUTH_STATE_COOKIE, JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: authConfig.isProduction(),
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10 * 60 * 1000,
  });

  const url = buildAuthorizationUrl(state, codeChallenge);
  res.redirect(url);
});

// ─── GET /google/callback ────────────────────────────────────────
router.get('/google/callback', asyncHandler(async (req, res) => {
  const cookieValue = req.cookies?.[OAUTH_STATE_COOKIE];

  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth' });

  if (!cookieValue) {
    res.status(403).json({ error: 'State ausente' });
    return;
  }

  let stored: { state: string; codeVerifier: string };
  try {
    stored = JSON.parse(cookieValue);
  } catch {
    res.status(403).json({ error: 'State inválido' });
    return;
  }

  const { code, state: returnedState } = req.query as { code?: string; state?: string };

  if (!returnedState || returnedState !== stored.state) {
    res.status(403).json({ error: 'State não corresponde' });
    return;
  }

  if (!code) {
    res.status(400).json({ error: 'Code ausente' });
    return;
  }

  const { idToken } = await exchangeCodeForTokens(code, stored.codeVerifier);
  const profile = await verifyGoogleIdToken(idToken);
  const user = await findOrLinkAccount(profile);

  await authService.issueSession(res, user);
  res.redirect(authConfig.clientUrl());
}));

export default router;

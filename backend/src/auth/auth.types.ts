export interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  googleId: string;
  emailVerified: boolean;
  role: 'owner' | 'member';
  createdAt: string;
  updatedAt: string;
}

export interface RefreshTokenDoc {
  id: string;
  tokenHash: string;
  userId: string;
  family: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  emailVerified: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

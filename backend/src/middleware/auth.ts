import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';
import { getUserProfile } from '../services/supabaseService';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}

/**
 * Required authentication middleware.
 * Returns 401 if no valid token is provided.
 * In dev mode without Supabase configured, returns a mock user.
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // If Supabase is configured, validate the token
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
      return;
    }

    try {
      const response = await axios.get(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: env.SUPABASE_ANON_KEY,
        },
        timeout: 5000,
      });

      const userData = response.data;
      if (!userData?.id) {
        res.status(401).json({ error: 'Invalid token.' });
        return;
      }

      // admin 여부 확인 (user_profiles.is_admin)
      let role = 'user';
      try {
        const profile = await getUserProfile(userData.id);
        if (profile?.is_admin) role = 'admin';
      } catch {
        // 프로필 조회 실패해도 인증은 유지
      }

      req.user = {
        id: userData.id,
        email: userData.email,
        role,
      };

      next();
    } catch (err) {
      logger.error('Token validation failed', (err as Error).message);
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }
  } else {
    // Dev mode: mock user
    logger.debug('Supabase not configured, using mock user for dev');
    req.user = {
      id: 'dev-user-001',
      email: 'dev@localhost',
      role: 'admin',
    };
    next();
  }
}

/**
 * Optional authentication middleware.
 * Attaches user if token is valid, but does NOT fail if missing.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && token) {
    try {
      const response = await axios.get(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: env.SUPABASE_ANON_KEY,
        },
        timeout: 5000,
      });

      const userData = response.data;
      if (userData?.id) {
        // admin 여부 확인
        let role = 'user';
        try {
          const profile = await getUserProfile(userData.id);
          if (profile?.is_admin) role = 'admin';
        } catch {
          // 프로필 조회 실패해도 통과
        }

        req.user = {
          id: userData.id,
          email: userData.email,
          role,
        };
      }
    } catch (err) {
      logger.debug('Optional auth: token validation failed, continuing as anonymous');
    }
  } else if (!env.SUPABASE_URL) {
    // Dev mode fallback
    req.user = {
      id: 'dev-user-001',
      email: 'dev@localhost',
      role: 'admin',
    };
  }

  next();
}

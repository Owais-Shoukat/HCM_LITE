/**
 * Saylani HCM Lite - Authentication & RBAC Middleware
 * Enforces zero-trust token validation, role-based access control,
 * and rate limiting on sensitive authentication and biometric endpoints.
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from './security.ts';
import { db } from './db.ts';
import type { UserRole } from './types.ts';

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}

/**
 * Validates incoming Bearer JWT and injects authenticated user context
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing or malformed token.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyJwt<AuthenticatedUserPayload>(token);

  if (!payload || !payload.id) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  const user = db.findUserById(payload.id);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'User account not found or has been deactivated.' });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    fullName: user.fullName
  };

  next();
}

/**
 * Strict Role-Based Access Control middleware
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access requires ${allowedRoles.join(' or ')} privileges.`
      });
    }

    next();
  };
}

/**
 * Access control for employee-specific records:
 * Permitted if caller is Admin, HR, or the employee themselves.
 */
export function requireSelfOrAdminOrHr(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const targetEmpId = req.params[paramName] || req.body[paramName] || req.query[paramName];
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'hr';
    const isSelf = req.user.employeeId && req.user.employeeId === targetEmpId;

    if (!isPrivileged && !isSelf) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to view or modify another employee's records."
      });
    }

    next();
  };
}

/**
 * Simple in-memory rate limiter for sensitive routes (e.g. login, face verification)
 */
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

export function createRateLimiter(options: { maxRequests: number; windowMs: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'ip'}:${req.originalUrl}`;
    const now = Date.now();
    let bucket = rateLimitStore.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + options.windowMs };
      rateLimitStore.set(key, bucket);
      return next();
    }

    bucket.count++;
    if (bucket.count > options.maxRequests) {
      return res.status(429).json({ error: options.message });
    }

    next();
  };
}

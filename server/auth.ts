import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage, UserRecord } from './storage.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'wickai_default_secret_key_2026';
const TOKEN_EXPIRY = '7d';

export interface AuthenticatedUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: Pick<UserRecord, 'id' | 'username' | 'createdAt'>): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    return decoded;
  } catch (err) {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  // Check cookie if available
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }
  return null;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await storage.findUserById(payload.id);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
        };
        next();
        return;
      }
    }
  }

  // Fallback to guest user for seamless experience
  req.user = {
    id: 'guest_user',
    username: 'Guest User',
    createdAt: new Date().toISOString(),
  };

  next();
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await storage.findUserById(payload.id);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
        };
      }
    }
  }
  next();
}

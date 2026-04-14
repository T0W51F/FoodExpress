import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getUserById } from '../data/store.js';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
  }

  try {
    const payload = jwt.verify(token, config.accessSecret);
    const user = await getUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ detail: 'Invalid authentication token.' });
    }

    if (user.banned === true) {
      return res.status(403).json({ error: 'Account banned', ban_reason: user.ban_reason || '' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ detail: 'Admin access is required.' });
  }

  next();
}

export function requireRestaurantAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'restaurant_admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ detail: 'Restaurant admin access is required.' });
  }

  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ detail: 'Super admin access is required.' });
  }

  next();
}

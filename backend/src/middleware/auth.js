import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { ApiError } from '../utils/helpers.js';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role_name || user.role,
      full_name: user.full_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

export async function protect(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Not authenticated.');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT u.*, r.name AS role_name FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [decoded.id]
    );
    if (rows.length === 0) throw new ApiError(401, 'User no longer active.');
    const user = rows[0];
    if (decoded.role && decoded.role !== user.role_name) {
      // stale token role, refresh by re-signing on next request via protected
    }
    req.user = user;
    req.token = token;
    next();
  } catch (e) {
    next(e.isOperational ? e : new ApiError(401, 'Invalid or expired token.'));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
    if (!roles.includes(req.user.role_name) && req.user.role_name !== 'ADMIN') {
      return next(new ApiError(403, 'You do not have permission to access this resource.'));
    }
    next();
  };
}

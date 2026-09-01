import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { ApiError } from '../utils/helpers.js';
import { SUPER_ROLES } from '../config/permissions.js';
import { getUserPermissionCodes } from '../utils/permissionService.js';

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
       WHERE u.id = $1 AND u.status = 'ACTIVE'`,
      [decoded.id]
    );
    if (rows.length === 0) throw new ApiError(401, 'User is inactive, suspended or not found.');
    const user = rows[0];
    if (decoded.role && decoded.role !== user.role_name) {
      // stale token role, refresh by re-signing on next request via protected
    }
    // Load effective permissions from the DB (source of truth).
    user.permissions = await getUserPermissionCodes(user);
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
    if (!roles.includes(req.user.role_name) && !SUPER_ROLES.includes(req.user.role_name)) {
      return next(new ApiError(403, 'You do not have permission to access this resource.'));
    }
    next();
  };
}

// Require ANY of the given permission codes for the request.
// Uses the DB-derived permission set attached at `protect`.
// SUPER_ADMIN / ADMIN bypass and are always allowed.
export function required(...codes) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Not authenticated.'));
    const role = req.user.role_name;
    if (SUPER_ROLES.includes(role)) return next();
    const allowed = req.user.permissions || [];
    if (!codes.some((c) => allowed.includes(c))) {
      return next(new ApiError(403, 'You do not have permission to access this resource.'));
    }
    next();
  };
}


import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';

export async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) throw new ApiError(400, 'Username and password are required.');

    const { rows } = await pool.query(
      `SELECT u.*, r.name AS role_name, r.description AS role_description
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE (u.username = $1 OR u.email = $1) AND u.is_active = TRUE`,
      [username]
    );
    if (rows.length === 0) throw new ApiError(401, 'Invalid credentials.');

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid credentials.');

    await audit(user.id, 'LOGIN', 'users', user.id, { username: user.username });

    const token = signToken(user);
    delete user.password_hash;
    res.json({ success: true, token, user });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.email, u.phone, u.is_active,
              r.name AS role_name, r.description AS role_description
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) throw new ApiError(404, 'User not found.');
    res.json({ success: true, user: rows[0] });
  } catch (e) {
    next(e);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) throw new ApiError(400, 'Both passwords are required.');
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    const ok = await bcrypt.compare(oldPassword, user.password_hash);
    if (!ok) throw new ApiError(400, 'Current password is incorrect.');
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    await audit(user.id, 'CHANGE_PASSWORD', 'users', user.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

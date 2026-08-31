import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';

export const getRoles = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM roles ORDER BY id');
  res.json({ success: true, data: rows });
});

export const getUsers = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.phone, u.is_active, u.created_at,
            r.name AS role_name, r.description AS role_description
     FROM users u LEFT JOIN roles r ON r.id=u.role_id ORDER BY u.id`);
  res.json({ success: true, data: rows });
});

export const createUser = asyncHandler(async (req, res) => {
  const { full_name, username, email, phone, password, role_id } = req.body;
  if (!full_name || !username || !password) throw new ApiError(400, 'Name, username and password required.');
  const hash = await bcrypt.hash(password, 10);
  const exists = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
  if (exists.rows.length) throw new ApiError(400, 'Username already taken.');
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, username, email, phone, password_hash, role_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [full_name, username, email, phone, hash, role_id || null]);
  delete rows[0].password_hash;
  await audit(req.user?.id, 'CREATE_USER', 'users', rows[0].id, { username });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { full_name, email, phone, role_id, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE users SET full_name=COALESCE($2,full_name), email=COALESCE($3,email),
      phone=COALESCE($4,phone), role_id=COALESCE($5,role_id), is_active=COALESCE($6,is_active)
     WHERE id=$1 RETURNING *`,
    [req.params.id, full_name, email, phone, role_id, is_active]);
  if (rows.length === 0) throw new ApiError(404, 'User not found.');
  delete rows[0].password_hash;
  await audit(req.user?.id, 'UPDATE_USER', 'users', req.params.id);
  res.json({ success: true, data: rows[0] });
});

export const getAuditLogs = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, u.full_name AS user_name FROM audit_logs a
     LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200`);
  res.json({ success: true, data: rows });
});

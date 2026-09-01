import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';

const RESTAURANT_ROLES = ['RESTAURANT_STAFF', 'RESTAURANT_MANAGER'];

async function getRoleName(roleId) {
  const { rows } = await pool.query('SELECT name FROM roles WHERE id=$1', [roleId]);
  return rows.length ? rows[0].name : null;
}

// Validate & persist restaurant assignment.
// - RESTAURANT_STAFF: exactly one assigned restaurant (mandatory).
// - RESTAURANT_MANAGER: one or more assigned restaurants.
async function saveRestaurantAssignment(userId, roleName, restaurantIds, actorId, db = pool) {
  const prev = await db.query(
    `SELECT sr.restaurant_id, r.name FROM staff_restaurants sr
     JOIN restaurants r ON r.id=sr.restaurant_id WHERE sr.staff_id=$1`, [userId]
  );
  const prevNames = prev.rows.map((r) => r.name);

  if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
    if (roleName === 'RESTAURANT_STAFF') {
      throw new ApiError(400, 'A restaurant must be assigned to a Restaurant Staff account.');
    }
    // Everyone else may be cleared.
    if (roleName === 'RESTAURANT_MANAGER') {
      throw new ApiError(400, 'A Restaurant Manager must be assigned to at least one restaurant.');
    }
    await db.query('DELETE FROM staff_restaurants WHERE staff_id=$1', [userId]);
  } else {
    const ids = restaurantIds.filter((x) => Number(x) > 0).map((x) => Number(x));
    if (ids.length === 0) throw new ApiError(400, 'A valid restaurant assignment is required.');
    await db.query('DELETE FROM staff_restaurants WHERE staff_id=$1', [userId]);
    for (const rid of [...new Set(ids)]) {
      await db.query(
        `INSERT INTO staff_restaurants (staff_id, restaurant_id, is_primary) VALUES ($1,$2,$3)`,
        [userId, rid, ids.length === 1]
      );
    }
  }

  const after = await db.query(
    `SELECT sr.restaurant_id, r.name FROM staff_restaurants sr
     JOIN restaurants r ON r.id=sr.restaurant_id WHERE sr.staff_id=$1`, [userId]
  );
  const afterNames = after.rows.map((r) => r.name);
  const oldValue = prevNames.length ? { restaurants: prevNames } : null;
  const newValue = { restaurants: afterNames };
  await audit(actorId, 'UPDATE_STAFF_RESTAURANTS', 'users', userId, { role: roleName }, null, oldValue, newValue);
}

export const getRoles = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.description, r.is_custom,
            COALESCE(json_agg(p.code ORDER BY p.code)
              FILTER (WHERE p.id IS NOT NULL), '[]') AS permissions
     FROM roles r
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     GROUP BY r.id, r.name, r.description, r.is_custom
     ORDER BY r.id`);
  res.json({ success: true, data: rows });
});

export const getPermissions = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, rp.role_id FROM permissions p
     LEFT JOIN role_permissions rp ON rp.permission_id = p.id
     ORDER BY p.code`);
  res.json({ success: true, data: rows });
});

// Create a custom role with an arbitrary permission set.
export const createRole = asyncHandler(async (req, res) => {
  const { name, description, permission_codes } = req.body;
  if (!name || !String(name).trim()) throw new ApiError(400, 'Role name is required.');
  const roleName = String(name).trim().toUpperCase().replace(/\s+/g, '_');
  const exists = await pool.query('SELECT id FROM roles WHERE name=$1', [roleName]);
  if (exists.rows.length) throw new ApiError(400, 'A role with this name already exists.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO roles (name, description, is_custom) VALUES ($1,$2,TRUE) RETURNING id',
      [roleName, description || null]);
    const roleId = rows[0].id;
    const codes = Array.isArray(permission_codes) ? permission_codes : [];
    if (codes.length) {
      const pRows = await client.query('SELECT id, code FROM permissions WHERE code = ANY($1)', [codes]);
      for (const p of pRows.rows) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [roleId, p.id]);
      }
    }
    await audit(req.user?.id, 'CREATE_ROLE', 'roles', roleId, { name: roleName, permissions: codes });
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { id: roleId, name: roleName, is_custom: true } });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
});

// Replace a custom role's permission set (built-in roles are not editable).
export const updateRolePermissions = asyncHandler(async (req, res) => {
  const roleId = parseInt(req.params.id, 10);
  const { permission_codes } = req.body;
  const role = await pool.query('SELECT id, name, is_custom FROM roles WHERE id=$1', [roleId]);
  if (role.rows.length === 0) throw new ApiError(404, 'Role not found.');
  const r = role.rows[0];
  if (!r.is_custom) throw new ApiError(403, 'Built-in roles cannot be modified. Create a custom role instead.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
    const codes = Array.isArray(permission_codes) ? permission_codes : [];
    if (codes.length) {
      const pRows = await client.query('SELECT id FROM permissions WHERE code = ANY($1)', [codes]);
      for (const p of pRows.rows) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [roleId, p.id]);
      }
    }
    await audit(req.user?.id, 'UPDATE_ROLE_PERMISSIONS', 'roles', roleId, { name: r.name, permissions: codes });
    await client.query('COMMIT');
    res.json({ success: true, data: { id: roleId, name: r.name, permissions: codes } });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
});

export const getUsers = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.phone, u.is_active, u.status, u.department, u.created_at, u.last_login,
            r.name AS role_name, r.description AS role_description,
            COALESCE(json_agg(json_build_object('restaurant_id', sr.restaurant_id, 'name', rr.name)
                  ORDER BY sr.restaurant_id) FILTER (WHERE sr.restaurant_id IS NOT NULL), '[]') AS assigned_restaurants
     FROM users u
     LEFT JOIN roles r ON r.id=u.role_id
     LEFT JOIN staff_restaurants sr ON sr.staff_id=u.id
     LEFT JOIN restaurants rr ON rr.id=sr.restaurant_id
     GROUP BY u.id, u.full_name, u.username, u.email, u.phone, u.is_active, u.status, u.department, u.created_at, u.last_login, r.name, r.description
     ORDER BY u.id`);
  res.json({ success: true, data: rows });
});

export const createUser = asyncHandler(async (req, res) => {
  const { full_name, username, email, phone, password, role_id, restaurant_ids, status, department } = req.body;
  if (!full_name || !username || !password) throw new ApiError(400, 'Name, username and password required.');
  const hash = await bcrypt.hash(password, 10);
  const exists = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
  if (exists.rows.length) throw new ApiError(400, 'Username already taken.');
  const roleName = await getRoleName(role_id);
  const initialStatus = ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status) ? status : 'ACTIVE';

  const client = await pool.connect();
  let userId;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO users (full_name, username, email, phone, password_hash, role_id, status, department)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [full_name, username, email, phone, hash, role_id || null, initialStatus, department || null]);
    userId = rows[0].id;
    if (RESTAURANT_ROLES.includes(roleName)) {
      await saveRestaurantAssignment(userId, roleName, restaurant_ids, req.user?.id, client);
    }
    await client.query('COMMIT');
    const user = rows[0];
    delete user.password_hash;
    await audit(req.user?.id, 'CREATE_USER', 'users', userId, { username, status: initialStatus, role: roleName });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection may have aborted */ }
    throw err;
  } finally {
    client.release();
  }
});

export const updateUser = asyncHandler(async (req, res) => {
  const { full_name, email, phone, role_id, is_active, status, department, restaurant_ids } = req.body;
  const targetId = parseInt(req.params.id, 10);
  const existing = await pool.query(
    'SELECT u.id, u.role_id, u.status, u.department, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=$1',
    [targetId]
  );
  if (existing.rows.length === 0) throw new ApiError(404, 'User not found.');
  const prev = existing.rows[0];
  const prevRoleName = prev.role_name;

  // Guard: a user must not be able to deactivate or suspend their own account.
  if (targetId === req.user?.id) {
    if (status && ['INACTIVE', 'SUSPENDED'].includes(status)) {
      throw new ApiError(400, 'You cannot deactivate or suspend your own account.');
    }
  }

  const newStatus = status !== undefined ? (['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status) ? status : prev.status) : prev.status;
  const resolvedIsActive = (newStatus === 'ACTIVE') ? true : (is_active !== undefined ? is_active : newStatus === 'ACTIVE');

  const { rows } = await pool.query(
    `UPDATE users SET
        full_name=COALESCE($2,full_name),
        email=COALESCE($3,email),
        phone=COALESCE($4,phone),
        role_id=COALESCE($5,role_id),
        is_active=$6,
        status=$7,
        department=COALESCE($8,department)
     WHERE id=$1 RETURNING *`,
    [targetId, full_name, email, phone, role_id, resolvedIsActive, newStatus, department]);
  delete rows[0].password_hash;

  const newRoleName = role_id ? (await getRoleName(role_id)) : prevRoleName;

  // If assignment was provided, save it. Otherwise enforce current-role constraining.
  if (restaurant_ids !== undefined) {
    await saveRestaurantAssignment(targetId, newRoleName, restaurant_ids, req.user?.id);
  } else if (newRoleName === 'RESTAURANT_STAFF') {
    const has = await pool.query('SELECT 1 FROM staff_restaurants WHERE staff_id=$1', [targetId]);
    if (has.rows.length === 0) {
      throw new ApiError(400, 'A restaurant must be assigned to a Restaurant Staff account.');
    }
  }

  const oldValue = { status: prev.status, role: prevRoleName, department: prev.department };
  const newValue = { status: newStatus, role: newRoleName, department: department ?? prev.department };
  await audit(req.user?.id, 'UPDATE_USER', 'users', targetId, { username: rows[0].username }, null, oldValue, newValue);
  res.json({ success: true, data: rows[0] });
});

export const getAuditLogs = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT a.*, u.full_name AS user_name FROM audit_logs a
     LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200`);
  res.json({ success: true, data: rows });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 4) {
    throw new ApiError(400, 'A new password of at least 4 characters is required.');
  }
  const hash = await bcrypt.hash(String(newPassword), 10);
  const { rows } = await pool.query(
    'UPDATE users SET password_hash=$2 WHERE id=$1 RETURNING id, full_name, username',
    [req.params.id, hash]);
  if (rows.length === 0) throw new ApiError(404, 'User not found.');
  await audit(req.user?.id, 'RESET_PASSWORD', 'users', req.params.id, { username: rows[0].username });
  res.json({ success: true, data: rows[0] });
});

import pool from '../config/db.js';
import { SUPER_ROLES, ALL_PERMISSIONS } from '../config/permissions.js';

// Effective permission codes for a user, sourced from the database role_permissions.
// SUPER_ADMIN / ADMIN always receive the full catalog.
export async function getUserPermissionCodes(user) {
  const roleName = user.role_name;
  if (SUPER_ROLES.includes(roleName)) return [...ALL_PERMISSIONS];
  if (!roleName) return [];
  const { rows } = await pool.query(
    `SELECT p.code FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN roles r ON r.id = rp.role_id
     WHERE r.name = $1`,
    [roleName]
  );
  return rows.map((r) => r.code);
}

// Ensure every defined permission exists in the permissions table.
export async function syncPermissionCatalog() {
  for (const code of ALL_PERMISSIONS) {
    await pool.query(
      `INSERT INTO permissions (code) VALUES ($1)
       ON CONFLICT (code) DO NOTHING`,
      [code]
    );
  }
}

// Enforce role_permissions for all built-in roles (idempotent).
// Managed roles (managed_by_admin = TRUE) are left untouched so staff edits stick.
export async function syncRolePermissions(rolePermissionsMap, managedRoles = new Set()) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      is_custom BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    )`);
  await pool.query(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE`);

  for (const roleName of Object.keys(rolePermissionsMap)) {
    if (managedRoles.has(roleName)) continue;
    const { rows } = await pool.query('SELECT id FROM roles WHERE name=$1', [roleName]);
    if (rows.length === 0) continue;
    const roleId = rows[0].id;
    await pool.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
    for (const code of rolePermissionsMap[roleName]) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code=$2
         ON CONFLICT DO NOTHING`,
        [roleId, code]
      );
    }
  }
}

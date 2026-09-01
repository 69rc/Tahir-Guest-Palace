import pool from '../config/db.js';
import { ApiError } from './helpers.js';
import { SUPER_ROLES } from '../config/permissions.js';

// Roles that may access ALL restaurants without per-outlet assignment.
export const UNRESTRICTED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER'];

/**
 * Load the authenticated user's assigned restaurant ids.
 * Returns { role_name, restaurantIds }.
 */
export async function getAssignedRestaurantIds(user) {
  if (UNRESTRICTED_ROLES.includes(user.role_name)) return { role_name: user.role_name, restaurantIds: null };
  const { rows } = await pool.query(
    `SELECT restaurant_id FROM staff_restaurants WHERE staff_id=$1`, [user.id]
  );
  return {
    role_name: user.role_name,
    restaurantIds: rows.map((r) => Number(r.restaurant_id)),
  };
}

/**
 * Assert the authenticated user may operate on the given restaurant.
 * Throws 403 when the user is not allowed to access that outlet.
 */
export async function assertRestaurantAccess(user, restaurantId) {
  const rid = Number(restaurantId);
  if (!rid) throw new ApiError(400, 'A valid restaurant id is required.');
  if (UNRESTRICTED_ROLES.includes(user.role_name)) return;
  if (user.role_name !== 'RESTAURANT_STAFF' && user.role_name !== 'RESTAURANT_MANAGER') {
    throw new ApiError(403, 'You do not have access to any restaurant outlet.');
  }
  const { rows } = await pool.query(
    `SELECT 1 FROM staff_restaurants WHERE staff_id=$1 AND restaurant_id=$2`,
    [user.id, rid]
  );
  if (rows.length === 0) {
    throw new ApiError(403, 'You do not have permission to access this restaurant.');
  }
}

/**
 * Resolve the restaurant context for a request:
 * - Unrestricted roles / restaurant managers: use the requested restaurantId (validated).
 * - RESTAURANT_STAFF: always derive the single assigned restaurant (ignore client-supplied value).
 */
export async function resolveRestaurantContext(user, requestedRestaurantId) {
  if (UNRESTRICTED_ROLES.includes(user.role_name)) {
    return Number(requestedRestaurantId);
  }
  if (user.role_name === 'RESTAURANT_MANAGER') {
    await assertRestaurantAccess(user, requestedRestaurantId);
    return Number(requestedRestaurantId);
  }
  if (user.role_name === 'RESTAURANT_STAFF') {
    const { rows } = await pool.query(
      `SELECT restaurant_id FROM staff_restaurants WHERE staff_id=$1
       ORDER BY is_primary DESC, restaurant_id LIMIT 1`,
      [user.id]
    );
    if (rows.length === 0) {
      throw new ApiError(403, 'Restaurant staff must be assigned to a restaurant.');
    }
    return Number(rows[0].restaurant_id);
  }
  throw new ApiError(403, 'You do not have access to any restaurant outlet.');
}

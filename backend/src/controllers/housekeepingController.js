import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';

export const getHousekeeping = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT h.*, rm.room_number, rt.name AS room_type, u.full_name AS assigned_name
     FROM housekeeping_tasks h
     LEFT JOIN rooms rm ON rm.id=h.room_id
     LEFT JOIN room_types rt ON rt.id=rm.room_type_id
     LEFT JOIN users u ON u.id=h.assigned_to
     ORDER BY h.created_at DESC LIMIT 100`);
  res.json({ success: true, data: rows });
});

export const getHousekeepingStatus = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT rm.id AS room_id, rm.room_number, rm.status AS room_status,
            COALESCE(h.status, rm.status) AS hk_status
     FROM rooms rm LEFT JOIN housekeeping_tasks h ON h.room_id=rm.id
     WHERE h.id = (SELECT MAX(h2.id) FROM housekeeping_tasks h2 WHERE h2.room_id=rm.id)
        OR h.id IS NULL
     ORDER BY substring(rm.room_number from '^[0-9]+')::int NULLS LAST, rm.room_number`);
  res.json({ success: true, data: rows });
});

export const updateHousekeeping = asyncHandler(async (req, res) => {
  const { room_id, status, assigned_to, note } = req.body;
  if (!room_id || !status) throw new ApiError(400, 'Room and status required.');
  const statuses = ['CLEAN', 'DIRTY', 'CLEANING', 'INSPECTED', 'MAINTENANCE'];
  if (!statuses.includes(status)) throw new ApiError(400, 'Invalid status.');
  const completed = (status === 'CLEAN' || status === 'INSPECTED') ? new Date() : null;

  const { rows } = await pool.query(
    `INSERT INTO housekeeping_tasks (room_id, status, assigned_to, note, completed_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [room_id, status, assigned_to || null, note || null, completed]
  );

  // Reflect on room status
  let roomStatus = status === 'CLEAN' || status === 'INSPECTED' ? 'AVAILABLE' : status;
  if (status === 'INSPECTED') roomStatus = 'AVAILABLE';
  await pool.query(`UPDATE rooms SET status=$2 WHERE id=$1 AND status <> 'OCCUPIED' AND status <> 'RESERVED'`, [room_id, roomStatus]);

  await audit(req.user?.id, 'HOUSEKEEPING', 'housekeeping_tasks', rows[0].id, { status });
  res.status(201).json({ success: true, data: rows[0] });
});

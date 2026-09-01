import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit } from '../utils/common.js';

const HK_TASK_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'INSPECTED'];
const HK_ROOM_STATUSES = ['DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'MAINTENANCE', 'OUT_OF_ORDER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const getHousekeeping = asyncHandler(async (req, res) => {
  const { status, priority, assigned_to, page = 1, limit = 100 } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (status) { where.push(`h.task_status = $${idx++}`); params.push(status); }
  if (priority) { where.push(`h.priority = $${idx++}`); params.push(priority); }
  if (assigned_to) { where.push(`h.assigned_to = $${idx++}`); params.push(assigned_to); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT h.*, rm.room_number, rm.status AS room_status, rt.name AS room_type,
            u.full_name AS assigned_name, ru.full_name AS reported_name, iu.full_name AS inspector_name
     FROM housekeeping_tasks h
     LEFT JOIN rooms rm ON rm.id = h.room_id
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id
     LEFT JOIN users u ON u.id = h.assigned_to
     LEFT JOIN users ru ON ru.id = h.reported_by
     LEFT JOIN users iu ON iu.id = h.inspected_by
     ${whereClause}
     ORDER BY CASE h.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
              h.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM housekeeping_tasks h ${whereClause}`, params.slice(0, -2)
  );

  res.json({ success: true, data: rows, total: Number(count), page: Number(page), limit: Number(limit) });
});

export const getHousekeepingStatus = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT rm.id AS room_id, rm.room_number, rm.status AS room_status, rm.floor,
            COALESCE(rt.name, '') AS room_type,
            h.task_status AS hk_status, h.priority, h.due_time, h.id AS task_id,
            u.full_name AS assigned_name
     FROM rooms rm
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id
     LEFT JOIN LATERAL (
       SELECT h2.task_status, h2.priority, h2.due_time, h2.id, h2.assigned_to
       FROM housekeeping_tasks h2
       WHERE h2.room_id = rm.id
       ORDER BY h2.id DESC
       LIMIT 1
     ) h ON TRUE
     LEFT JOIN users u ON u.id = h.assigned_to
     ORDER BY substring(rm.room_number from '^[0-9]+')::int NULLS LAST, rm.room_number`);
  res.json({ success: true, data: rows });
});

export const getHousekeepingDashboard = asyncHandler(async (_req, res) => {
  const stats = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE task_status = 'PENDING') AS pending,
       COUNT(*) FILTER (WHERE task_status = 'ASSIGNED') AS assigned,
       COUNT(*) FILTER (WHERE task_status = 'IN_PROGRESS') AS in_progress,
       COUNT(*) FILTER (WHERE task_status = 'COMPLETED') AS completed,
       COUNT(*) FILTER (WHERE task_status = 'INSPECTED') AS inspected,
       COUNT(*) FILTER (WHERE task_status IN ('PENDING','ASSIGNED') AND due_time < now()) AS overdue
     FROM housekeeping_tasks`
  );

  const roomStatus = await pool.query(
    `SELECT status, COUNT(*) AS count FROM rooms GROUP BY status ORDER BY status`
  );

  const staffWorkload = await pool.query(
    `SELECT u.id, u.full_name,
       COUNT(*) FILTER (WHERE h.task_status IN ('ASSIGNED','IN_PROGRESS')) AS active,
       COUNT(*) FILTER (WHERE h.task_status = 'COMPLETED') AS completed_today,
       COUNT(*) AS total
     FROM users u
     LEFT JOIN housekeeping_tasks h ON h.assigned_to = u.id
     WHERE u.role_id IN (SELECT id FROM roles WHERE name IN ('HOUSEKEEPING','HOUSEKEEPING_STAFF','HOUSEKEEPING_SUPERVISOR'))
       AND COALESCE(u.status, 'ACTIVE') = 'ACTIVE'
     GROUP BY u.id, u.full_name ORDER BY active DESC`
  );

  const needsCleaning = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (h.room_id) h.*, rm.room_number, rt.name AS room_type, u.full_name AS assigned_name
       FROM housekeeping_tasks h
       JOIN rooms rm ON rm.id = h.room_id
       LEFT JOIN room_types rt ON rt.id = rm.room_type_id
       LEFT JOIN users u ON u.id = h.assigned_to
       WHERE h.task_status IN ('PENDING','ASSIGNED','IN_PROGRESS')
       ORDER BY h.room_id,
                CASE h.task_status WHEN 'IN_PROGRESS' THEN 1 WHEN 'ASSIGNED' THEN 2 WHEN 'PENDING' THEN 3 ELSE 4 END,
                h.id DESC
     ) t
     ORDER BY CASE t.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
              CASE t.task_status WHEN 'PENDING' THEN 1 WHEN 'ASSIGNED' THEN 2 WHEN 'IN_PROGRESS' THEN 3 ELSE 4 END,
              t.created_at
     LIMIT 40`
  );

  const readyToInspect = await pool.query(
    `SELECT DISTINCT ON (h.room_id) h.*, rm.room_number, rt.name AS room_type, u.full_name AS assigned_name
     FROM housekeeping_tasks h
     JOIN rooms rm ON rm.id = h.room_id
     LEFT JOIN room_types rt ON rt.id = rm.room_type_id
     LEFT JOIN users u ON u.id = h.assigned_to
     WHERE h.task_status = 'COMPLETED'
     ORDER BY h.room_id, h.id DESC`
  );

  const overdueTasks = await pool.query(
    `SELECT h.*, rm.room_number, u.full_name AS assigned_name
     FROM housekeeping_tasks h
     LEFT JOIN rooms rm ON rm.id = h.room_id
     LEFT JOIN users u ON u.id = h.assigned_to
     WHERE h.task_status IN ('PENDING','ASSIGNED','IN_PROGRESS')
       AND h.due_time < now()
     ORDER BY h.due_time ASC`
  );

  res.json({
    success: true,
    data: {
      stats: stats.rows[0],
      roomStatus: roomStatus.rows,
      staffWorkload: staffWorkload.rows,
      needsCleaning: needsCleaning.rows,
      readyToInspect: readyToInspect.rows,
      overdueTasks: overdueTasks.rows,
    }
  });
});

export const createHousekeepingTask = asyncHandler(async (req, res) => {
  const { room_id, status, priority, assigned_to, note, due_time } = req.body;
  if (!room_id) throw new ApiError(400, 'Room is required.');
  if (!status || !HK_ROOM_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${HK_ROOM_STATUSES.join(', ')}`);
  }

  const taskPriority = (priority && PRIORITIES.includes(priority)) ? priority : 'MEDIUM';
  const taskStatus = assigned_to ? 'ASSIGNED' : 'PENDING';

  await pool.query(
    `UPDATE housekeeping_tasks SET task_status='INSPECTED', status='INSPECTED', completed_at=COALESCE(completed_at, now())
     WHERE room_id=$1 AND task_status IN ('PENDING','ASSIGNED','COMPLETED')`,
    [room_id]
  );

  const { rows } = await pool.query(
    `INSERT INTO housekeeping_tasks (room_id, status, task_status, priority, assigned_to, reported_by, note, due_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [room_id, status, taskStatus, taskPriority, assigned_to || null, req.user?.id, note || null, due_time || null]
  );

  if (status === 'DIRTY') {
    await pool.query(
      `UPDATE rooms SET status='CLEANING' WHERE id=$1 AND status NOT IN ('OCCUPIED','RESERVED','MAINTENANCE')`,
      [room_id]
    );
  } else if (['MAINTENANCE', 'OUT_OF_ORDER'].includes(status)) {
    await pool.query(
      `UPDATE rooms SET status=$2 WHERE id=$1 AND status NOT IN ('OCCUPIED','RESERVED')`,
      [room_id, status]
    );
  }

  await audit(req.user?.id, 'HOUSEKEEPING_CREATE', 'housekeeping_tasks', rows[0].id, { room_id, status, priority: taskPriority });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateHousekeepingTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, task_status, assigned_to, priority, note, due_time, inspection_notes } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM housekeeping_tasks WHERE id=$1', [id]);
  if (!existing.length) throw new ApiError(404, 'Housekeeping task not found.');

  const task = existing[0];
  const newTaskStatus = task_status || task.task_status;
  const newPriority = priority || task.priority;
  const newAssignedTo = assigned_to !== undefined ? (assigned_to || null) : task.assigned_to;
  const newNote = note !== undefined ? note : task.note;
  const newDueTime = due_time !== undefined ? due_time : task.due_time;
  const newStatus = status || task.status;
  const newInspNotes = inspection_notes !== undefined ? inspection_notes : task.inspection_notes;

  let startedAt = task.started_at;
  let completedAt = task.completed_at;
  let inspectedBy = task.inspected_by;

  if (newTaskStatus === 'IN_PROGRESS' && !startedAt) startedAt = new Date();
  if (newTaskStatus === 'COMPLETED' && !completedAt) completedAt = new Date();
  if (newTaskStatus === 'INSPECTED') inspectedBy = req.user?.id;

  const { rows } = await pool.query(
    `UPDATE housekeeping_tasks SET
       status=$2, task_status=$3, priority=$4, assigned_to=$5,
       note=$6, due_time=$7, started_at=$8, completed_at=$9,
       inspection_notes=$10, inspected_by=$11
     WHERE id=$1 RETURNING *`,
    [id, newStatus, newTaskStatus, newPriority, newAssignedTo,
     newNote, newDueTime, startedAt, completedAt, newInspNotes, inspectedBy]
  );

  if (['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(newTaskStatus) || newStatus === 'DIRTY') {
    await pool.query(
      `UPDATE rooms SET status='CLEANING' WHERE id=$1 AND status NOT IN ('OCCUPIED','RESERVED','MAINTENANCE')`,
      [task.room_id]
    );
  }
  if (newTaskStatus === 'INSPECTED' || newStatus === 'INSPECTED') {
    await pool.query(
      `UPDATE rooms SET status='AVAILABLE' WHERE id=$1 AND status NOT IN ('OCCUPIED','RESERVED','MAINTENANCE')`,
      [task.room_id]
    );
  }
  if (['MAINTENANCE', 'OUT_OF_ORDER'].includes(newStatus)) {
    await pool.query(
      `UPDATE rooms SET status=$2 WHERE id=$1 AND status NOT IN ('OCCUPIED','RESERVED')`,
      [task.room_id, newStatus]
    );
  }

  await audit(req.user?.id, 'HOUSEKEEPING_UPDATE', 'housekeeping_tasks', id, {
    task_status: task.task_status, new_task_status: newTaskStatus, priority: task.priority, new_priority: newPriority
  });
  res.json({ success: true, data: rows[0] });
});

export const deleteHousekeepingTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('DELETE FROM housekeeping_tasks WHERE id=$1 RETURNING *', [id]);
  if (!rows.length) throw new ApiError(404, 'Task not found.');
  await audit(req.user?.id, 'HOUSEKEEPING_DELETE', 'housekeeping_tasks', id, { room_id: rows[0].room_id });
  res.json({ success: true, data: rows[0] });
});

export const getStaffWorkload = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name,
       COUNT(*) FILTER (WHERE h.task_status = 'PENDING') AS pending,
       COUNT(*) FILTER (WHERE h.task_status = 'ASSIGNED') AS assigned,
       COUNT(*) FILTER (WHERE h.task_status = 'IN_PROGRESS') AS in_progress,
       COUNT(*) FILTER (WHERE h.task_status = 'COMPLETED') AS completed,
       COUNT(*) FILTER (WHERE h.task_status = 'INSPECTED') AS inspected,
       COUNT(*) AS total
     FROM users u
     LEFT JOIN housekeeping_tasks h ON h.assigned_to = u.id
     WHERE u.role_id IN (SELECT id FROM roles WHERE name IN ('HOUSEKEEPING','HOUSEKEEPING_STAFF','HOUSEKEEPING_SUPERVISOR'))
       AND COALESCE(u.status, 'ACTIVE') = 'ACTIVE'
     GROUP BY u.id, u.full_name ORDER BY u.full_name`
  );
  res.json({ success: true, data: rows });
});

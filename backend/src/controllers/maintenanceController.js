import pool from '../config/db.js';
import { asyncHandler, ApiError } from '../utils/helpers.js';
import { audit, genNumber } from '../utils/common.js';

const TICKET_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const FACILITIES = ['ROOM', 'RESTAURANT', 'CONFERENCE_HALL', 'POOL', 'FITNESS_CENTER', 'SPA', 'BARBERSHOP', 'KITCHEN', 'GENERAL'];

export const getMaintenanceTickets = asyncHandler(async (req, res) => {
  const { status, priority, facility, assigned_to, page = 1, limit = 100 } = req.query;
  let where = [];
  let params = [];
  let idx = 1;

  if (status) { where.push(`t.status = $${idx++}`); params.push(status); }
  if (priority) { where.push(`t.priority = $${idx++}`); params.push(priority); }
  if (facility) { where.push(`t.facility = $${idx++}`); params.push(facility); }
  if (assigned_to) { where.push(`t.assigned_to = $${idx++}`); params.push(assigned_to); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT t.*, rm.room_number, ru.full_name AS reporter_name,
            au.full_name AS assigned_name, mp.part_count, mp.issued_parts
     FROM maintenance_tickets t
     LEFT JOIN rooms rm ON rm.id = t.room_id
     LEFT JOIN users ru ON ru.id = t.reported_by
     LEFT JOIN users au ON au.id = t.assigned_to
     LEFT JOIN (SELECT ticket_id,
                  COUNT(*) AS part_count,
                  COUNT(*) FILTER (WHERE issued) AS issued_parts
                FROM maintenance_parts GROUP BY ticket_id) mp ON mp.ticket_id = t.id
     ${whereClause}
     ORDER BY CASE t.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
              t.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM maintenance_tickets t ${whereClause}`, params
  );

  res.json({ success: true, data: rows, total: Number(count), page: Number(page), limit: Number(limit) });
});

export const getMaintenanceTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT t.*, rm.room_number, ru.full_name AS reporter_name,
            au.full_name AS assigned_name
     FROM maintenance_tickets t
     LEFT JOIN rooms rm ON rm.id = t.room_id
     LEFT JOIN users ru ON ru.id = t.reported_by
     LEFT JOIN users au ON au.id = t.assigned_to
     WHERE t.id=$1`, [id]
  );
  if (!rows.length) throw new ApiError(404, 'Maintenance ticket not found.');

  const { rows: parts } = await pool.query(
    `SELECT mp.*, ii.name AS inventory_name, ii.unit AS inventory_unit
     FROM maintenance_parts mp
     LEFT JOIN inventory_items ii ON ii.id = mp.inventory_item_id
     WHERE mp.ticket_id=$1 ORDER BY mp.created_at`, [id]
  );

  res.json({ success: true, data: { ...rows[0], parts } });
});

export const createMaintenanceTicket = asyncHandler(async (req, res) => {
  const { location, room_id, facility, problem_category, description, priority, estimated_cost } = req.body;
  if (!location || !problem_category || !description) {
    throw new ApiError(400, 'Location, problem category, and description are required.');
  }
  const ticketPriority = priority && PRIORITIES.includes(priority) ? priority : 'MEDIUM';
  const ticketNo = genNumber('MT');

  const { rows } = await pool.query(
    `INSERT INTO maintenance_tickets (ticket_no, location, room_id, facility, problem_category, description, reported_by, priority, estimated_cost)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [ticketNo, location, room_id || null, facility || 'GENERAL', problem_category, description, req.user?.id, ticketPriority, estimated_cost || 0]
  );

  // If room has critical issue, mark OUT_OF_ORDER
  if (room_id && ticketPriority === 'CRITICAL') {
    await pool.query(`UPDATE rooms SET status='OUT_OF_ORDER' WHERE id=$1 AND status NOT IN ('OCCUPIED','RESERVED')`, [room_id]);
  }

  await audit(req.user?.id, 'MAINTENANCE_CREATE', 'maintenance_tickets', rows[0].id, { ticket_no: ticketNo, priority: ticketPriority });
  res.status(201).json({ success: true, data: rows[0] });
});

export const updateMaintenanceTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to, priority, resolution_notes, actual_cost, started_at, resolved_at } = req.body;

  const { rows: existing } = await pool.query('SELECT * FROM maintenance_tickets WHERE id=$1', [id]);
  if (!existing.length) throw new ApiError(404, 'Ticket not found.');
  const ticket = existing[0];

  const newStatus = status || ticket.status;
  const newPriority = priority || ticket.priority;
  const newAssignedTo = assigned_to !== undefined ? (assigned_to || null) : ticket.assigned_to;
  const newResNotes = resolution_notes !== undefined ? resolution_notes : ticket.resolution_notes;
  const newActualCost = actual_cost !== undefined ? actual_cost : ticket.actual_cost;
  const newStartedAt = started_at || (newStatus === 'IN_PROGRESS' && !ticket.started_at ? new Date() : ticket.started_at);
  const newResolvedAt = resolved_at || (newStatus === 'RESOLVED' && !ticket.resolved_at ? new Date() : ticket.resolved_at);

  const { rows } = await pool.query(
    `UPDATE maintenance_tickets SET
       status=$2, assigned_to=$3, priority=$4, resolution_notes=$5, actual_cost=$6,
       started_at=$7, resolved_at=$8
     WHERE id=$1 RETURNING *`,
    [id, newStatus, newAssignedTo, newPriority, newResNotes, newActualCost, newStartedAt, newResolvedAt]
  );

  // Handle room status integration
  if (ticket.room_id) {
    if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
      await pool.query(`UPDATE rooms SET status='CLEAN' WHERE id=$1 AND status='OUT_OF_ORDER'`, [ticket.room_id]);
    }
    if (newPriority === 'CRITICAL' && newStatus !== 'RESOLVED' && newStatus !== 'CLOSED') {
      await pool.query(`UPDATE rooms SET status='OUT_OF_ORDER' WHERE id=$1 AND status NOT IN ('OCCUPIED','RESERVED')`, [ticket.room_id]);
    }
  }

  await audit(req.user?.id, 'MAINTENANCE_UPDATE', 'maintenance_tickets', id, {
    status: ticket.status, new_status: newStatus, priority: ticket.priority, new_priority: newPriority
  });
  res.json({ success: true, data: rows[0] });
});

export const deleteMaintenanceTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('DELETE FROM maintenance_tickets WHERE id=$1 RETURNING *', [id]);
  if (!rows.length) throw new ApiError(404, 'Ticket not found.');
  await audit(req.user?.id, 'MAINTENANCE_DELETE', 'maintenance_tickets', id, { ticket_no: rows[0].ticket_no });
  res.json({ success: true, data: rows[0] });
});

// Parts management
export const addMaintenancePart = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { inventory_item_id, item_name, quantity } = req.body;
  if (!item_name) throw new ApiError(400, 'Item name is required.');

  const { rows } = await pool.query(
    `INSERT INTO maintenance_parts (ticket_id, inventory_item_id, item_name, quantity)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, inventory_item_id || null, item_name, quantity || 1]
  );

  // Set ticket to WAITING_PARTS if currently OPEN/ASSIGNED
  await pool.query(
    `UPDATE maintenance_tickets SET status='WAITING_PARTS'
     WHERE id=$1 AND status IN ('OPEN','ASSIGNED')`, [id]
  );

  await audit(req.user?.id, 'MAINTENANCE_PART_ADD', 'maintenance_parts', rows[0].id, { ticket_id: id, item_name, quantity });
  res.status(201).json({ success: true, data: rows[0] });
});

export const issueMaintenancePart = asyncHandler(async (req, res) => {
  const { id, partId } = req.params;

  const { rows: part } = await pool.query(
    'SELECT * FROM maintenance_parts WHERE id=$1 AND ticket_id=$2', [partId, id]
  );
  if (!part.length) throw new ApiError(404, 'Part not found.');
  if (part[0].issued) throw new ApiError(400, 'Part already issued.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deduct from inventory if linked
    if (part[0].inventory_item_id) {
      const { rows: item } = await client.query(
        'SELECT quantity FROM inventory_items WHERE id=$1 FOR UPDATE', [part[0].inventory_item_id]
      );
      if (!item.length || item[0].quantity < part[0].quantity) {
        throw new ApiError(400, 'Insufficient stock for this part.');
      }
      await client.query(
        'UPDATE inventory_items SET quantity = quantity - $2 WHERE id=$1',
        [part[0].inventory_item_id, part[0].quantity]
      );
      await client.query(
        `INSERT INTO inventory_transactions (item_id, type, quantity, ref_type, ref_id, note, created_by)
         VALUES ($1,'ISSUE',$2,'MAINTENANCE',$3,$4,$5)`,
        [part[0].inventory_item_id, part[0].quantity, id, `Maintenance ticket #${id} - ${part[0].item_name}`, req.user?.id]
      );
    }

    await client.query(
      'UPDATE maintenance_parts SET issued=true, issued_at=now() WHERE id=$1', [partId]
    );

    // Update ticket status to IN_PROGRESS
    await client.query(
      `UPDATE maintenance_tickets SET status='IN_PROGRESS', started_at=COALESCE(started_at, now())
       WHERE id=$1 AND status IN ('OPEN','ASSIGNED','WAITING_PARTS')`, [id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await audit(req.user?.id, 'MAINTENANCE_PART_ISSUE', 'maintenance_parts', partId, { ticket_id: id });
  res.json({ success: true, message: 'Part issued and inventory updated.' });
});

export const getMaintenanceDashboard = asyncHandler(async (_req, res) => {
  const stats = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'OPEN') AS open,
       COUNT(*) FILTER (WHERE status = 'ASSIGNED') AS assigned,
       COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
       COUNT(*) FILTER (WHERE status = 'WAITING_PARTS') AS waiting_parts,
       COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved,
       COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed,
       COUNT(*) FILTER (WHERE priority = 'CRITICAL' AND status NOT IN ('RESOLVED','CLOSED')) AS critical,
       COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '7 days') AS this_week
     FROM maintenance_tickets`
  );

  const byFacility = await pool.query(
    `SELECT facility, COUNT(*) AS count,
       COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','CLOSED')) AS open_count
     FROM maintenance_tickets GROUP BY facility ORDER BY open_count DESC`
  );

  const byPriority = await pool.query(
    `SELECT priority, COUNT(*) AS count
     FROM maintenance_tickets WHERE status NOT IN ('RESOLVED','CLOSED')
     GROUP BY priority ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END`
  );

  const outOfOrderRooms = await pool.query(
    `SELECT rm.id, rm.room_number, rm.status, t.ticket_no, t.problem_category, t.priority
     FROM rooms rm
     JOIN maintenance_tickets t ON t.room_id = rm.id
     WHERE rm.status = 'OUT_OF_ORDER' AND t.status NOT IN ('RESOLVED','CLOSED')
     ORDER BY t.priority`
  );

  res.json({
    success: true,
    data: {
      stats: stats.rows[0],
      byFacility: byFacility.rows,
      byPriority: byPriority.rows,
      outOfOrderRooms: outOfOrderRooms.rows,
    }
  });
});

import 'dotenv/config';
import { pool } from './db.js';
import { syncPermissionCatalog } from '../utils/permissionService.js';

const schema = `

-- TAHIR GUEST PALACE — Core database schema
-- PostgreSQL

-- ============ AUTH / STAFF ============
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(80) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE,
  phone VARCHAR(50),
  password_hash TEXT NOT NULL,
  role_id INT REFERENCES roles(id),
  is_active BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
-- Migrate existing is_active values into status once (ACTIVE if true, INACTIVE if false).
UPDATE users SET status = CASE WHEN is_active = TRUE THEN 'ACTIVE' ELSE 'INACTIVE' END WHERE status IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80),
  entity_id INT,
  details JSONB,
  ip VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============ GUESTS ============
CREATE TABLE IF NOT EXISTS guests (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(150),
  address TEXT,
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  nationality VARCHAR(80) DEFAULT 'Nigerian',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ ROOMS ============
CREATE TABLE IF NOT EXISTS room_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  capacity INT DEFAULT 2,
  description TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  room_number VARCHAR(20) UNIQUE NOT NULL,
  room_type_id INT REFERENCES room_types(id),
  floor INT DEFAULT 1,
  price_per_night NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'AVAILABLE',
  description TEXT,
  image TEXT
);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- ============ RESERVATIONS ============
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  reservation_no VARCHAR(30) UNIQUE NOT NULL,
  guest_id INT REFERENCES guests(id),
  room_id INT REFERENCES rooms(id),
  room_type_id INT REFERENCES room_types(id),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INT DEFAULT 1,
  children INT DEFAULT 0,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  deposit NUMERIC(12,2) DEFAULT 0,
  payment_method VARCHAR(40),
  special_requests TEXT,
  status VARCHAR(20) DEFAULT 'CONFIRMED',
  source VARCHAR(40) DEFAULT 'front_desk',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);

-- ============ CHECK IN / OUT ============
CREATE TABLE IF NOT EXISTS check_ins (
  id SERIAL PRIMARY KEY,
  reservation_id INT REFERENCES reservations(id),
  guest_id INT REFERENCES guests(id),
  room_id INT REFERENCES rooms(id),
  checkin_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by INT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS check_outs (
  id SERIAL PRIMARY KEY,
  reservation_id INT REFERENCES reservations(id),
  guest_id INT REFERENCES guests(id),
  room_id INT REFERENCES rooms(id),
  checkout_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_by INT REFERENCES users(id)
);

-- ============ RESTAURANT ============
CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  tax_rate NUMERIC(6,2) DEFAULT 0,
  service_charge NUMERIC(6,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'NGN',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Many-to-many staff-to-restaurant assignment.
-- Supports RESTAURANT_STAFF (exactly one primary restaurant) and
-- RESTAURANT_MANAGER (one-or-more restaurants).
CREATE TABLE IF NOT EXISTS staff_restaurants (
  staff_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (staff_id, restaurant_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_restaurants_restaurant ON staff_restaurants(restaurant_id);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number VARCHAR(20) NOT NULL,
  capacity INT DEFAULT 4,
  status VARCHAR(20) DEFAULT 'AVAILABLE'
);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON restaurant_tables(restaurant_id);

CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id INT REFERENCES menu_categories(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  cost NUMERIC(12,2) DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  image TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(30) UNIQUE NOT NULL,
  restaurant_id INT REFERENCES restaurants(id),
  table_id INT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  guest_id INT REFERENCES guests(id),
  room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'OPEN',
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  service_charge NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  payment_method VARCHAR(40),
  is_charged_to_room BOOLEAN DEFAULT FALSE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INT REFERENCES menu_items(id),
  item_name VARCHAR(150),
  quantity INT DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0
);

-- ============ INVENTORY ============
CREATE TABLE IF NOT EXISTS inventory_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  category_id INT REFERENCES inventory_categories(id),
  unit VARCHAR(30) DEFAULT 'pcs',
  cost_price NUMERIC(12,2) DEFAULT 0,
  selling_price NUMERIC(12,2) DEFAULT 0,
  quantity NUMERIC(12,2) DEFAULT 0,
  min_quantity NUMERIC(12,2) DEFAULT 0,
  supplier_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_restaurant ON inventory_items(restaurant_id);

-- Recipe linking menu items to inventory items (for stock reduction on sale)
CREATE TABLE IF NOT EXISTS menu_recipes (
  id SERIAL PRIMARY KEY,
  menu_item_id INT REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  ref_type VARCHAR(50),
  ref_id INT,
  note TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_trans_item ON inventory_transactions(item_id);

-- ============ SUPPLIERS / PURCHASES ============
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(150),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  purchase_no VARCHAR(30) UNIQUE NOT NULL,
  supplier_id INT REFERENCES suppliers(id),
  restaurant_id INT REFERENCES restaurants(id) ON DELETE SET NULL,
  total NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'UNPAID',
  note TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INT REFERENCES purchases(id) ON DELETE CASCADE,
  item_id INT REFERENCES inventory_items(id),
  item_name VARCHAR(150),
  quantity NUMERIC(12,2) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0
);

-- ============ FINANCE ============
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_no VARCHAR(30) UNIQUE NOT NULL,
  guest_id INT REFERENCES guests(id),
  reservation_id INT REFERENCES reservations(id),
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  invoice_type VARCHAR(20) DEFAULT 'HOTEL',
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  paid NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'UNPAID',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_guest ON invoices(guest_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(200),
  quantity NUMERIC(12,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_no VARCHAR(30) UNIQUE NOT NULL,
  guest_id INT REFERENCES guests(id),
  reservation_id INT REFERENCES reservations(id),
  invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(40) NOT NULL,
  category VARCHAR(30) DEFAULT 'ROOM',
  note TEXT,
  received_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_guest ON payments(guest_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  restaurant_id INT REFERENCES restaurants(id) ON DELETE SET NULL,
  paid_to VARCHAR(150),
  method VARCHAR(40),
  incurred_by INT REFERENCES users(id),
  incurred_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_incurred ON expenses(incurred_at);

-- ============ HOUSEKEEPING ============
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id SERIAL PRIMARY KEY,
  room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'CLEAN',
  assigned_to INT REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hk_room ON housekeeping_tasks(room_id);

-- ============ STAFF ASSIGNMENT ============
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(50);

-- ============ AMENITIES & SERVICES ============
-- Top-level facilities (Swimming Pool, Fitness Center, Spa, Barbershop, Frosty Pops, Conference...)
CREATE TABLE IF NOT EXISTS amenities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60),
  description TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  location VARCHAR(150),
  operating_hours VARCHAR(120),
  price NUMERIC(12,2) DEFAULT 0,
  pricing_type VARCHAR(30) DEFAULT 'FREE',
  capacity INT,
  image TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amenities_status ON amenities(status);

-- Configurable services offered by an amenity (spa services, barber services, poolside services)
CREATE TABLE IF NOT EXISTS amenity_services (
  id SERIAL PRIMARY KEY,
  amenity_id INT REFERENCES amenities(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  pricing_type VARCHAR(30) DEFAULT 'FIXED',
  duration_min INT DEFAULT 30,
  capacity INT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  image TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amenity_services_amenity ON amenity_services(amenity_id);

-- Reusable bookable service appointments (spa, barbershop, pool cabanas, fitness sessions...)
CREATE TABLE IF NOT EXISTS service_appointments (
  id SERIAL PRIMARY KEY,
  appointment_no VARCHAR(30) UNIQUE NOT NULL,
  amenity_id INT REFERENCES amenities(id) ON DELETE CASCADE,
  service_id INT REFERENCES amenity_services(id) ON DELETE SET NULL,
  guest_id INT REFERENCES guests(id) ON DELETE SET NULL,
  staff_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  price NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'BOOKED',
  payment_status VARCHAR(20) DEFAULT 'UNPAID',
  is_charged_to_room BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_appt_amenity ON service_appointments(amenity_id);
CREATE INDEX IF NOT EXISTS idx_service_appt_guest ON service_appointments(guest_id);
CREATE INDEX IF NOT EXISTS idx_service_appt_time ON service_appointments(start_time, end_time);

-- Inventory consumed for service appointments (spa consumables, barber supplies, cabana drinks)
CREATE TABLE IF NOT EXISTS service_transactions (
  id SERIAL PRIMARY KEY,
  appointment_id INT REFERENCES service_appointments(id) ON DELETE CASCADE,
  item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_txn_appt ON service_transactions(appointment_id);

-- ============ CONFERENCE & EVENTS ============
CREATE TABLE IF NOT EXISTS conference_halls (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  capacity INT DEFAULT 0,
  location VARCHAR(150),
  description TEXT,
  rate NUMERIC(12,2) DEFAULT 0,
  rate_type VARCHAR(20) DEFAULT 'DAILY',
  facilities JSONB,
  status VARCHAR(20) DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_halls_status ON conference_halls(status);

-- Configurable event services (catering, projector, sound, seating, decoration...)
CREATE TABLE IF NOT EXISTS event_services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  unit VARCHAR(40) DEFAULT 'pkg',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_bookings (
  id SERIAL PRIMARY KEY,
  booking_no VARCHAR(30) UNIQUE NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  organization VARCHAR(150),
  phone VARCHAR(50),
  email VARCHAR(150),
  hall_id INT REFERENCES conference_halls(id),
  event_type VARCHAR(40),
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  attendees INT DEFAULT 0,
  rate NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  deposit NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'UNPAID',
  restaurant_id INT REFERENCES restaurants(id) ON DELETE SET NULL,
  invoiced_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'INQUIRY',
  notes TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_bookings_date ON event_bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_event_bookings_hall ON event_bookings(hall_id);

-- Attached services for an event (catering, equipment...) with session price
CREATE TABLE IF NOT EXISTS event_booking_services (
  id SERIAL PRIMARY KEY,
  booking_id INT REFERENCES event_bookings(id) ON DELETE CASCADE,
  service_id INT REFERENCES event_services(id) ON DELETE SET NULL,
  service_name VARCHAR(150),
  quantity NUMERIC(12,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_event_bs_booking ON event_booking_services(booking_id);

-- Event bookings may link to a folio-style invoice for payments/revenue
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS invoice_id INT;

-- ============ PAYMENT EXTENSIONS ============
ALTER TABLE payments ADD COLUMN IF NOT EXISTS service_appointment_id INT REFERENCES service_appointments(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS event_booking_id INT REFERENCES event_bookings(id) ON DELETE SET NULL;

-- ============ FROSTY POPS / GELATERIA ============
-- Reuses the existing restaurants / menu_items / orders tables. An outlet_type
-- column flags the 4th outlet so management can report it separately.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS outlet_type VARCHAR(30) DEFAULT 'RESTAURANT';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS can_charge_room BOOLEAN DEFAULT TRUE;

-- ============ HOUSEKEEPING ENHANCEMENTS ============
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM';
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS task_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS due_time TIMESTAMPTZ;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS inspected_by INT REFERENCES users(id);
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS inspection_notes TEXT;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS reported_by INT REFERENCES users(id);
UPDATE rooms SET status = 'CLEANING' WHERE status IN ('DIRTY', 'CLEAN');

-- ============ GUEST CRM EXTENSIONS ============
ALTER TABLE guests ADD COLUMN IF NOT EXISTS vip_status VARCHAR(20) DEFAULT 'NORMAL';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS guest_type VARCHAR(30) DEFAULT 'INDIVIDUAL';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS country VARCHAR(80) DEFAULT 'Nigeria';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE TABLE IF NOT EXISTS guest_preferences (
  id SERIAL PRIMARY KEY,
  guest_id INT REFERENCES guests(id) ON DELETE CASCADE,
  room_preference TEXT,
  bed_preference VARCHAR(50),
  smoking_preference VARCHAR(30),
  food_preferences TEXT,
  special_requests TEXT,
  other_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_prefs ON guest_preferences(guest_id);

-- ============ MAINTENANCE ============
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id SERIAL PRIMARY KEY,
  ticket_no VARCHAR(30) UNIQUE NOT NULL,
  location VARCHAR(150) NOT NULL,
  room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
  facility VARCHAR(80),
  problem_category VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  reported_by INT REFERENCES users(id),
  assigned_to INT REFERENCES users(id),
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  status VARCHAR(20) DEFAULT 'OPEN',
  started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  estimated_cost NUMERIC(12,2) DEFAULT 0,
  actual_cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_maint_room ON maintenance_tickets(room_id);

CREATE TABLE IF NOT EXISTS maintenance_parts (
  id SERIAL PRIMARY KEY,
  ticket_id INT REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  inventory_item_id INT REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name VARCHAR(150),
  quantity NUMERIC(12,2) DEFAULT 1,
  issued BOOLEAN DEFAULT FALSE,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maint_parts_ticket ON maintenance_parts(ticket_id);

-- ============ CASHIER SHIFTS ============
CREATE TABLE IF NOT EXISTS cashier_shifts (
  id SERIAL PRIMARY KEY,
  shift_no VARCHAR(30) UNIQUE NOT NULL,
  staff_user_id INT REFERENCES users(id),
  opening_cash NUMERIC(12,2) DEFAULT 0,
  closing_cash NUMERIC(12,2),
  expected_cash NUMERIC(12,2),
  difference NUMERIC(12,2),
  cash_total NUMERIC(12,2) DEFAULT 0,
  pos_total NUMERIC(12,2) DEFAULT 0,
  transfer_total NUMERIC(12,2) DEFAULT 0,
  card_total NUMERIC(12,2) DEFAULT 0,
  refund_total NUMERIC(12,2) DEFAULT 0,
  total_transactions INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON cashier_shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_staff ON cashier_shifts(staff_user_id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS shift_id INT REFERENCES cashier_shifts(id) ON DELETE SET NULL;

-- ============ PURCHASE REQUESTS ============
CREATE TABLE IF NOT EXISTS purchase_requests (
  id SERIAL PRIMARY KEY,
  request_no VARCHAR(30) UNIQUE NOT NULL,
  requested_by INT REFERENCES users(id),
  department VARCHAR(50),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'PENDING',
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  purchase_id INT REFERENCES purchases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_preq_status ON purchase_requests(status);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES purchase_requests(id) ON DELETE CASCADE,
  inventory_item_id INT REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name VARCHAR(150),
  quantity NUMERIC(12,2) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_preq_items ON purchase_request_items(request_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  category VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ============ RESERVATION EXTENSIONS ============
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- ============ AUDIT LOG EXTENSIONS ============
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB;

-- ============ ADDITIONAL INDEXES ============
CREATE INDEX IF NOT EXISTS idx_payments_category ON payments(category);
CREATE INDEX IF NOT EXISTS idx_payments_shift ON payments(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest ON orders(guest_id);
CREATE INDEX IF NOT EXISTS idx_service_appt_status ON service_appointments(status);
CREATE INDEX IF NOT EXISTS idx_maint_parts_item ON maintenance_parts(inventory_item_id);

-- ============ PROCUREMENT WORKFLOW EXTENSIONS ============
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS expected_delivery TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS received_date TIMESTAMPTZ;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS quantity_received NUMERIC(12,2) DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS damaged_quantity NUMERIC(12,2) DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS accepted_quantity NUMERIC(12,2) DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS received_date TIMESTAMPTZ;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS notes TEXT;
`;

export async function initDb() {
  await pool.query(schema);
  await syncPermissionCatalog();
  console.log('Database schema is ready.');
}

if (process.argv[1] && process.argv[1].endsWith('initDb.js')) {
  initDb()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

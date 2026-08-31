import 'dotenv/config';
import { pool } from './db.js';

const schema = `

-- TAHIR GUEST PALACE — Core database schema
-- PostgreSQL

-- ============ AUTH / STAFF ============
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INT REFERENCES menu_items(id),
  item_name VARCHAR(150),
  quantity INT DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) DEFAULT 0
);

-- Recipe linking menu items to inventory items (for stock reduction on sale)
CREATE TABLE IF NOT EXISTS menu_recipes (
  id SERIAL PRIMARY KEY,
  menu_item_id INT REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC(12,2) DEFAULT 1
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
`;

export async function initDb() {
  await pool.query(schema);
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

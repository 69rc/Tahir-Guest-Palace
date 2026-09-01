import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

const NIGERIAN_FIRST = ['Ahmed', 'Fatima', 'Musa', 'Aisha', 'Ibrahim', 'Aminu', 'Hauwa', 'Sani', 'Zainab', 'Abdullahi', 'Maryam', 'Bello', 'Rabiu', 'Khadija', 'Yusuf', 'Sadiya', 'Nana', 'Umar', 'Halima', 'Bashir', 'Rashida', 'Kabiru', 'Aminat', 'Salim', 'Hadiza'];
const NIGERIAN_LAST = ['Musa', 'Suleiman', 'Abubakar', 'Ibrahim', 'Yahaya', 'Danladi', 'Lawal', 'Garba', 'Adamu', 'Mohammed', 'Isah', 'Bala', 'Sani', 'Yakubu', 'Okafor', 'Eze', 'Balogun', 'Ogunleye', 'Okonkwo', 'Nwachukwu'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const dateStr = (d) => d.toISOString().slice(0, 10);
const ts = (d) => d.toISOString();

async function clean() {
  const tables = [
    'invoice_items', 'payments', 'invoices', 'expenses',
    'purchase_items', 'purchases', 'inventory_transactions', 'inventory_items', 'inventory_categories', 'suppliers',
    'order_items', 'orders', 'menu_items', 'menu_categories', 'restaurant_tables', 'restaurants',
    'housekeeping_tasks', 'check_outs', 'check_ins', 'reservations', 'rooms', 'room_types', 'guests',
    'event_booking_services', 'event_bookings', 'event_services', 'conference_halls',
    'service_transactions', 'service_appointments', 'amenity_services', 'amenities',
    'staff_restaurants', 'audit_logs', 'users', 'role_permissions', 'permissions', 'roles',
  ];
  for (const t of tables) {
    await pool.query(`TRUNCATE ${t} RESTART IDENTITY CASCADE`);
  }
}

async function seed() {
  await clean();

  let genCounter = 0;
  function gen(prefix) {
    genCounter++;
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${prefix}-${stamp}-${String(genCounter).padStart(5, '0')}`;
  }

  // ============ ROLES ============
  const roles = [
    ['SUPER_ADMIN', 'Unrestricted system access'],
    ['ADMIN', 'Full system access (legacy, treated as super admin)'],
    ['GENERAL_MANAGER', 'Oversees all hotel operations'],
    ['MANAGER', 'Department manager'],
    ['RECEPTIONIST', 'Front desk and reservations'],
    ['RESTAURANT_MANAGER', 'Manages restaurant operations'],
    ['RESTAURANT_STAFF', 'Restaurant POS and orders'],
    ['ACCOUNTANT', 'Finance and reporting'],
    ['CASHIER', 'Cashier shift, payments and receipts'],
    ['STOREKEEPER', 'Inventory and purchases'],
    ['HOUSEKEEPING', 'Housekeeping staff (legacy)'],
    ['HOUSEKEEPING_SUPERVISOR', 'Supervises housekeeping tasks and inspections'],
    ['HOUSEKEEPING_STAFF', 'Assigned housekeeping tasks'],
    ['MAINTENANCE_SUPERVISOR', 'Supervises maintenance tickets and technicians'],
    ['MAINTENANCE_STAFF', 'Maintenance and facility staff'],
    ['SPA_STAFF', 'Spa services operations'],
    ['BARBERSHOP_STAFF', 'Barbershop services operations'],
    ['EVENT_MANAGER', 'Conference and events operations'],
  ];
  const roleId = {};
  for (const [name, desc] of roles) {
    const r = await pool.query('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING id', [name, desc]);
    roleId[name] = r.rows[0].id;
  }

  // ============ PERMISSIONS & ROLE → PERMISSION ============
  // Seed the DB permissions + role_permissions from the canonical definition.
  // This makes the database the source of truth (supports custom roles + backend enforcement).
  const { ALL_PERMISSIONS, ROLE_PERMISSIONS } = await import('../config/permissions.js');
  const permId = {};
  for (const code of ALL_PERMISSIONS) {
    const p = await pool.query('INSERT INTO permissions (code) VALUES ($1) ON CONFLICT (code) DO NOTHING RETURNING id', [code]);
    if (p.rows.length) permId[code] = p.rows[0].id;
  }
  // Fetch id for any permission codes already present.
  const permRows = await pool.query('SELECT id, code FROM permissions');
  for (const pr of permRows.rows) permId[pr.code] = pr.id;
  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const rid = roleId[roleName];
    if (!rid) continue;
    for (const code of ROLE_PERMISSIONS[roleName]) {
      await pool.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [rid, permId[code]]
      );
    }
  }

  // ============ USERS ============
  // Demo users — DEVELOPMENT ONLY. Passwords are dev placeholders (admin123).
  const adminHash = await bcrypt.hash('admin123', 10);
  const users = [
    ['System Admin', 'admin', 'admin@tahir.local', '08000000000', roleId.SUPER_ADMIN],
    ['Super Admin', 'superadmin', 'superadmin@tahir.local', '08000000001', roleId.SUPER_ADMIN],
    ['GM Hassan', 'gm', 'manager@tahir.local', '08000000002', roleId.GENERAL_MANAGER],
    ['Receptionist Amina', 'reception', 'reception@tahir.local', '08000000003', roleId.RECEPTIONIST],
    ['Manager Kabir', 'manager', 'manager.desk@tahir.local', '08000000004', roleId.MANAGER],
    ['Restaurant Manager Dan', 'restman', 'restaurant@tahir.local', '08000000005', roleId.RESTAURANT_MANAGER],
    ['POS Staff Kabir', 'pos', 'restaurant.staff@tahir.local', '08000000006', roleId.RESTAURANT_STAFF],
    ['Accountant Zainab', 'account', 'accountant@tahir.local', '08000000007', roleId.ACCOUNTANT],
    ['Storekeeper Bello', 'store', 'storekeeper@tahir.local', '08000000008', roleId.STOREKEEPER],
    ['Housekeeping Halima', 'hskeeper', 'housekeeping@tahir.local', '08000000009', roleId.HOUSEKEEPING],
    ['Maintenance Usman', 'maint', 'maintenance@tahir.local', '08000000010', roleId.MAINTENANCE_STAFF],
    ['Spa Staff Fatima', 'spa', 'spa@tahir.local', '08000000011', roleId.SPA_STAFF],
    ['Barber Aminu', 'barber', 'barbershop@tahir.local', '08000000012', roleId.BARBERSHOP_STAFF],
    ['Event Manager Ngozi', 'events', 'events@tahir.local', '08000000013', roleId.EVENT_MANAGER],
    ['Cashier Sani', 'cash', 'cashier@tahir.local', '08000000014', roleId.CASHIER],
    ['Housekeeping Sup Aisha', 'hksup', 'hksupervisor@tahir.local', '08000000015', roleId.HOUSEKEEPING_SUPERVISOR],
    ['Housekeeping Staff Hauwa', 'hkstaff', 'hkstaff@tahir.local', '08000000016', roleId.HOUSEKEEPING_STAFF],
    ['Maintenance Sup Yusuf', 'mantsup', 'maintsupervisor@tahir.local', '08000000017', roleId.MAINTENANCE_SUPERVISOR],
  ];
  const userId = {};
  const userKey = {
    [roleId.SUPER_ADMIN]: 'superadmin',
    [roleId.ADMIN]: 'admin',
    [roleId.GENERAL_MANAGER]: 'gm',
    [roleId.MANAGER]: 'manager',
    [roleId.RECEPTIONIST]: 'reception',
    [roleId.RESTAURANT_MANAGER]: 'restman',
    [roleId.RESTAURANT_STAFF]: 'pos',
    [roleId.ACCOUNTANT]: 'account',
    [roleId.STOREKEEPER]: 'store',
    [roleId.HOUSEKEEPING]: 'hskeeper',
    [roleId.MAINTENANCE_STAFF]: 'maint',
    [roleId.SPA_STAFF]: 'spa',
    [roleId.BARBERSHOP_STAFF]: 'barber',
    [roleId.EVENT_MANAGER]: 'events',
    [roleId.CASHIER]: 'cash',
    [roleId.HOUSEKEEPING_SUPERVISOR]: 'hksup',
    [roleId.HOUSEKEEPING_STAFF]: 'hkstaff',
    [roleId.MAINTENANCE_SUPERVISOR]: 'mantsup',
  };
  for (const [n, u, e, ph, rid] of users) {
    const deptMap = { [roleId.SUPER_ADMIN]: 'ADMIN', [roleId.ADMIN]: 'ADMIN', [roleId.GENERAL_MANAGER]: 'HOTEL', [roleId.MANAGER]: 'HOTEL', [roleId.RECEPTIONIST]: 'HOTEL', [roleId.RESTAURANT_MANAGER]: 'RESTAURANT', [roleId.RESTAURANT_STAFF]: 'RESTAURANT', [roleId.ACCOUNTANT]: 'ADMIN', [roleId.CASHIER]: 'FINANCE', [roleId.STOREKEEPER]: 'STORE', [roleId.HOUSEKEEPING]: 'HOUSEKEEPING', [roleId.HOUSEKEEPING_SUPERVISOR]: 'HOUSEKEEPING', [roleId.HOUSEKEEPING_STAFF]: 'HOUSEKEEPING', [roleId.MAINTENANCE_SUPERVISOR]: 'MAINTENANCE', [roleId.MAINTENANCE_STAFF]: 'MAINTENANCE', [roleId.SPA_STAFF]: 'SPA', [roleId.BARBERSHOP_STAFF]: 'BARBERSHOP', [roleId.EVENT_MANAGER]: 'EVENTS' };
    const r = await pool.query(
      'INSERT INTO users (full_name, username, email, phone, password_hash, role_id, department, last_login) VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id',
      [n, u, e, ph, adminHash, rid, deptMap[rid] || null]);
    userId[userKey[rid] || u] = r.rows[0].id;
  }

  // ============ ROOM TYPES ============
  const roomTypes = [
    ['Single', 45000, 1, 'A cozy and elegant space ideal for solo travelers, equipped with modern amenities, plush bedding, and a serene view.'],
    ['Deluxe', 75000, 2, 'Spacious deluxe room with city views, luxury bedding and modern amenities.'],
    ['Executive', 95000, 2, 'Executive room with lounge access and premium amenities.'],
    ['Double', 155000, 2, 'Perfect for couples or friends, featuring ample space, a relaxing ambiance, and luxurious furnishings.'],
    ['Suite', 250000, 4, 'Presidential suite with separate living area, executive workspace and full amenities.'],
    ['Duplex', 245000, 4, 'Two levels of indulgence with a duplex-style suite featuring a private living room, premium bath, and breathtaking interior.'],
  ];
  const typeId = {};
  for (const [name, price, cap, desc] of roomTypes) {
    const r = await pool.query('INSERT INTO room_types (name, base_price, capacity, description) VALUES ($1,$2,$3,$4) RETURNING id', [name, price, cap, desc]);
    typeId[name] = r.rows[0].id;
  }

  // ============ ROOMS (34, unique numbers incl. Room 204 for demo) ============
  const roomDefs = [];
  // Deterministic spread across floors with unique numbers
  const plan = [
    // Single (floor 1 & 2)
    ['Single', '101'], ['Single', '102'], ['Single', '103'], ['Single', '105'],
    ['Single', '106'], ['Single', '107'], ['Single', '108'], ['Single', '109'],
    ['Single', '110'], ['Single', '111'], ['Single', '112'], ['Single', '112A'],
    ['Single', '113'], ['Single', '114'], ['Single', '115'],
    // Executive (floor 2)
    ['Executive', '201'], ['Executive', '202'], ['Executive', '203'], ['Executive', '205'],
    ['Executive', '206'], ['Executive', '207'], ['Executive', '208'], ['Executive', '209'],
    // Deluxe (floor 2 & 3)
    ['Deluxe', '301'], ['Deluxe', '302'], ['Deluxe', '303'],
    ['Deluxe', '304'], ['Deluxe', '305'],
    ['Double', '204'],
    // Suite & Duplex (floor 4 & 5)
    ['Suite', '402'], ['Suite', '403'], ['Duplex', '404'], ['Suite', '502'],
  ];
  for (const [type, num] of plan) roomDefs.push({ type, num, floor: Number(num[0]) });
  const roomId = {};
  for (const rd of roomDefs) {
    let price = roomTypes.find((t) => t[0] === rd.type)[1];
    if (rd.num === '204') price = 60000; // demo room
    const r = await pool.query(
      'INSERT INTO rooms (room_number, room_type_id, floor, price_per_night, status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [rd.num, typeId[rd.type], rd.floor, price + randInt(-5000, 30000), 'AVAILABLE']);
    roomId[rd.num] = r.rows[0].id;
  }

  // ============ GUESTS (24) ============
  const guestId = {};
  const guestNames = [];
  for (let i = 0; i < 24; i++) {
    const fn = rand(NIGERIAN_FIRST);
    const ln = rand(NIGERIAN_LAST);
    const name = `${fn} ${ln}`;
    const phone = `080${String(randInt(10000000, 99999999))}`;
    const g = await pool.query(
      'INSERT INTO guests (full_name, phone, email, address, id_type, id_number, nationality) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [name, phone, `${fn.toLowerCase()}.${ln.toLowerCase()}@mail.com`, `${randInt(1,99)} Aminu Kano Crescent`, 'NIN', String(randInt(10000000000, 99999999999)), 'Nigerian']);
    guestId[name] = g.rows[0].id;
    guestNames.push(name);
  }

  // ============ RESTAURANTS ============
  const res1 = await pool.query(`INSERT INTO restaurants (name, description, tax_rate, service_charge) VALUES ('Calido Rooftop & Grill House','Rooftop dining specializing in local, continental and international cuisine, with buffet breakfast daily 6:30–11:30 AM',7.5,10) RETURNING id`);
  const res2 = await pool.query(`INSERT INTO restaurants (name, description, tax_rate, service_charge) VALUES ('Tahir Garden Café & Lounge','Outdoor café & lounge with coffee, light meals and bar, serving a blend of local and international favourites',5,8) RETURNING id`);
  const r1 = res1.rows[0].id, r2 = res2.rows[0].id;

  // Additional food & beverage outlets (for the 4-outlet management view)
  const res3 = await pool.query(`INSERT INTO restaurants (name, description, tax_rate, service_charge, outlet_type, can_charge_room) VALUES ('Tahir Poolside Grill','Poolside dining & drinks at Tahir Facilities swimming pool',5,8,'POOLSIDE',TRUE) RETURNING id`);
  const res4 = await pool.query(`INSERT INTO restaurants (name, description, tax_rate, service_charge, outlet_type, can_charge_room) VALUES ('Frosty Pops & Gelateria','Ice cream parlour & gelateria - handcrafted gelato, sundaes, milkshakes and frozen treats',5,8,'GELATERIA',TRUE) RETURNING id`);
  const r3 = res3.rows[0].id, r4 = res4.rows[0].id;

  // Poolside + Frosty Pops menus
  const cp = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r3, 'Poolside Drinks']);
  const cp2 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r3, 'Poolside Snacks']);
  const cp3 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r3, 'Grilled Items']);
  const poolItems = [
    ['Fresh Coconut Water', 1500, cp.rows[0].id], ['Beach Smoothie', 2500, cp.rows[0].id],
    ['Margarita', 6000, cp.rows[0].id], ['Poolside Fries', 2000, cp2.rows[0].id],
    ['Fruit Platter', 3500, cp2.rows[0].id], ['BBQ Skewers', 5000, cp3.rows[0].id],
    ['Grilled Fish', 8000, cp3.rows[0].id], ['Chicken Shawarma', 4500, cp2.rows[0].id],
    ['Chapman', 3000, cp.rows[0].id], ['Ice Cold Zobo', 1500, cp.rows[0].id],
  ];
  for (const [name, price, cid] of poolItems) {
    await pool.query('INSERT INTO menu_items (restaurant_id, category_id, name, price, cost) VALUES ($1,$2,$3,$4,$5)', [r3, cid, name, price, Math.round(price * 0.45)]);
  }
  const cg = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r4, 'Frozen Treats']);
  const cg2 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r4, 'Milkshakes']);
  const cg3 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r4, 'Waffles & Crepes']);
  const gelatoItems = [
    ['Vanilla Gelato (2 scoops)', 2500, cg.rows[0].id], ['Chocolate Gelato (2 scoops)', 2500, cg.rows[0].id],
    ['Mango Sorbet', 3000, cg.rows[0].id], ['Strawberry Sundae', 4500, cg.rows[0].id],
    ['Pistachio Gelato (2 scoops)', 3000, cg.rows[0].id], ['Cookies & Cream', 3000, cg.rows[0].id],
    ['Chocolate Milkshake', 2500, cg2.rows[0].id], ['Strawberry Milkshake', 2500, cg2.rows[0].id],
    ['Vanilla Milkshake', 2500, cg2.rows[0].id], ['Mango Smoothie Bowl', 3500, cg2.rows[0].id],
    ['Belgian Waffle', 3500, cg3.rows[0].id], ['Nutella Crepe', 4000, cg3.rows[0].id],
  ];
  for (const [name, price, cid] of gelatoItems) {
    await pool.query('INSERT INTO menu_items (restaurant_id, category_id, name, price, cost) VALUES ($1,$2,$3,$4,$5)', [r4, cid, name, price, Math.round(price * 0.45)]);
  }

  // Tables
  const tables = [];
  for (const [rid, prefix, count] of [[r1, 'T', 8], [r2, 'C', 6], [r3, 'P', 6], [r4, 'F', 4]]) {
    for (let i = 1; i <= count; i++) {
      const tn = i <= 4 ? `${prefix}${i}` : (i === count - 1 ? `VIP ${prefix}${i}` : `${prefix}${i}`);
      const t = await pool.query('INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status) VALUES ($1,$2,$3,$4) RETURNING id', [rid, tn, i % 2 === 0 ? 4 : 2, 'AVAILABLE']);
      tables.push(t.rows[0].id);
    }
  }

  // Menu categories & items
  const menuDefs = [
    { cat: 'Main Courses', items: [['Jollof Rice', 3500], ['Fried Rice', 3500], ['Rice & Stew', 4000], ['Pounded Yam & Egusi', 6000], ['Grilled Chicken', 7000], ['Suya Platter', 8000], ['Beef Steak', 9000], ['Thick Pasta Alfredo', 7500]] },
    { cat: 'Specials', items: [['Palace Special Rice', 5500], ['Peppered Snail', 12000], ['Grilled Whole Fish', 18000], ['Nkwobi', 9000], ['Pepper Soup Whole Catfish', 11000]] },
    { cat: 'Appetizers', items: [['Chicken Wings (6)', 5500], ['Spring Rolls', 3500], ['Samosa (3)', 3000], ['Chin Chin', 2500]] },
    { cat: 'Drinks', items: [['Soft Drink', 1500], ['Bottled Water', 500], ['Fresh Orange Juice', 2500], ['Mango Smoothie', 3000], ['Chapman', 3000]] },
    { cat: 'Desserts', items: [['Chocolate Cake', 4500], ['Fruit Salad', 3500], ['Ice Cream (2 scoops)', 2000]] },
  ];
  const r1Items = {};
  for (const { cat, items } of menuDefs) {
    const c = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r1, cat]);
    const cid = c.rows[0].id;
    for (const [name, price] of items) {
      const m = await pool.query('INSERT INTO menu_items (restaurant_id, category_id, name, price, cost) VALUES ($1,$2,$3,$4,$5) RETURNING id', [r1, cid, name, price, Math.round(price * 0.5)]);
      r1Items[name] = m.rows[0].id;
    }
  }
  // Garden cafe menu (subset, coffee)
  const c2 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r2, 'Beverages']);
  const c22 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r2, 'Light Meals']);
  const cafeItems = [
    ['Espresso', 2000, c2.rows[0].id], ['Cappuccino', 2500, c2.rows[0].id], ['African Tea', 1500, c2.rows[0].id],
    ['Chicken Sandwich', 5000, c22.rows[0].id], ['Club Sandwich', 6500, c22.rows[0].id], ['Croissant', 3000, c22.rows[0].id],
  ];
  for (const [name, price, cid] of cafeItems) {
    await pool.query('INSERT INTO menu_items (restaurant_id, category_id, name, price, cost) VALUES ($1,$2,$3,$4,$5)', [r2, cid, name, price, Math.round(price * 0.5)]);
  }

  // ============ SUPPLIERS ============
  const suppliers = [
    ['Kano Fresh Produce Ltd', 'Alhaji Sule', '08050000001', 'fresh@mail.com', 'Sabon Gari Market, Kano'],
    ['Northern Beverages Co', 'Mr John', '08050000002', 'beverages@mail.com', 'Sharada Industrial Estate'],
    ['Chestnut Foods Distribution', 'Mrs Grace', '08050000003', 'chestnut@mail.com', 'Kano Trade Fair Complex'],
    ['LightHouse Cleaning Supplies', 'Mr Peter', '08050000004', 'cleaning@mail.com', 'Bompai, Kano'],
  ];
  const supplierId = {};
  for (const [name, cp, ph, em, ad] of suppliers) {
    const s = await pool.query('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING id', [name, cp, ph, em, ad]);
    supplierId[name] = s.rows[0].id;
  }

  // ============ INVENTORY ============
  const invCats = ['Food', 'Beverages', 'Cleaning', 'Toiletries', 'Housekeeping'];
  const invCatId = {};
  for (const c of invCats) {
    const r = await pool.query('INSERT INTO inventory_categories (name) VALUES ($1) RETURNING id', [c]);
    invCatId[c] = r.rows[0].id;
  }
  const foodItems = [
    ['Rice (50kg)', 'pcs', 38000, 45000, 2100, 300, supplierId['Chestnut Foods Distribution'], 'Food'],
    ['Chicken (kg)', 'kg', 2800, 4500, 152, 60, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Cooking Oil (5L)', 'pcs', 9500, 12500, 85, 30, supplierId['Chestnut Foods Distribution'], 'Food'],
    ['Tomatoes (crate)', 'crate', 22000, 30000, 42, 15, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Onions (bag)', 'bag', 18000, 25000, 30, 12, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Spices (assorted)', 'pcs', 4000, 6500, 60, 20, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Flour (25kg)', 'pcs', 15500, 20000, 45, 15, supplierId['Chestnut Foods Distribution'], 'Food'],
    ['Pepper (kg)', 'kg', 2500, 4000, 55, 20, supplierId['Kano Fresh Produce Ltd'], 'Food'],
  ];
  const bevItems = [
    ['Soft Drinks (crate)', 'crate', 4200, 6000, 220, 50, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Bottled Water (pack)', 'pack', 2600, 4000, 300, 60, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Milk (tin)', 'pcs', 1500, 2500, 90, 30, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Coffee Beans (kg)', 'kg', 6800, 12000, 20, 8, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Tea Leaves (kg)', 'kg', 3000, 5500, 25, 10, supplierId['Northern Beverages Co'], 'Beverages'],
  ];
  const cleanItems = [
    ['Detergent (5L)', 'pcs', 8500, 12000, 40, 12, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
    ['Disinfectant (5L)', 'pcs', 6500, 9500, 32, 10, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
    ['Cleaning Cloths (pack)', 'pack', 2500, 4000, 80, 25, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
    ['Gloves (pack)', 'pack', 3000, 5000, 55, 20, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
  ];
  const toiletItems = [
    ['Toilet Rolls (pack)', 'pack', 2400, 3800, 150, 40, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
    ['Soap (pcs)', 'pcs', 600, 1200, 300, 80, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
    ['Shampoo (bottle)', 'pcs', 1800, 3500, 120, 40, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
    ['Tissue Boxes', 'pcs', 1200, 2500, 90, 30, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
  ];
  const hkItems = [
    ['Bed Sheets (set)', 'pcs', 15000, 22000, 95, 30, supplierId['LightHouse Cleaning Supplies'], 'Housekeeping'],
    ['Towels (set)', 'pcs', 8000, 12500, 140, 40, supplierId['LightHouse Cleaning Supplies'], 'Housekeeping'],
    ['Pillows', 'pcs', 6000, 10000, 60, 20, supplierId['LightHouse Cleaning Supplies'], 'Housekeeping'],
  ];

  const invItemIds = {};
  const allInv = [...foodItems, ...bevItems, ...cleanItems, ...toiletItems, ...hkItems];
  const roster = [null, r1, r1, r2, null, null, null, null];
  let invIdx = 0;
  for (const [name, unit, cost, sell, qty, min, sup, cat] of allInv) {
    const rest = rand([null, r1, r2, null, r1, null, null, r2]);
    const r = await pool.query(
      'INSERT INTO inventory_items (name, restaurant_id, category_id, unit, cost_price, selling_price, quantity, min_quantity, supplier_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [name, rest, invCatId[cat], unit, cost, sell, qty, min, sup]);
    invItemIds[name] = r.rows[0].id;
    // give some items low stock for alerts
    if (invIdx % 5 === 0) {
      await pool.query('UPDATE inventory_items SET quantity=$2 WHERE id=$1', [r.rows[0].id, Math.max(0, min - randInt(1, 5))]);
    }
    invIdx++;
  }

  // ============ MENU RECIPES (menu item -> inventory item) ============
  const recipeMap = {
    'Jollof Rice': [['Rice (50kg)', 0.02], ['Cooking Oil (5L)', 0.05]],
    'Fried Rice': [['Rice (50kg)', 0.02], ['Chicken (kg)', 0.15]],
    'Rice & Stew': [['Rice (50kg)', 0.025], ['Tomatoes (crate)', 0.02]],
    'Grilled Chicken': [['Chicken (kg)', 0.4]],
    'Pounded Yam & Egusi': [['Flour (25kg)', 0.05], ['Cooking Oil (5L)', 0.05]],
    'Suya Platter': [['Chicken (kg)', 0.3], ['Spices (assorted)', 0.1]],
    'Soft Drink': [['Soft Drinks (crate)', 0.04]],
    'Bottled Water': [['Bottled Water (pack)', 0.04]],
    'Fresh Orange Juice': [['Milk (tin)', 0.02]],
    'Chocolate Cake': [['Flour (25kg)', 0.03]],
  };
  for (const menuName of Object.keys(recipeMap)) {
    const mi = r1Items[menuName];
    if (!mi) continue;
    for (const [invName, qty] of recipeMap[menuName]) {
      const ii = invItemIds[invName];
      if (!ii) continue;
      await pool.query(
        'INSERT INTO menu_recipes (menu_item_id, inventory_item_id, quantity) VALUES ($1,$2,$3)',
        [mi, ii, qty]);
    }
  }

  // ============ RESERVATIONS & STAYS ============
  const statusPool = ['CHECKED_OUT', 'CONFIRMED', 'CONFIRMED', 'CHECKED_OUT'];
  const roomNumbers = Object.keys(roomId);
  const allStatuses = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED', 'MAINTENANCE'];
  const resvNo = [];
  const stayReservations = [];
  const randomRoomNumbers = roomNumbers.filter((n) => n !== '204'); // keep 204 free for Ahmed demo

  for (let i = 0; i < 40; i++) {
    const guest = rand(guestNames);
    const gid = guestId[guest];
    const rn = rand(randomRoomNumbers);
    const rid = roomId[rn];
    const nights = randInt(1, 4);
    const checkIn = daysAgo(randInt(0, 60));
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
    const rate = randInt(40000, 200000);
    const disc = randInt(0, 1) ? 0 : randInt(5000, 20000);
    const total = nights * rate - disc;
    const status = statusPool[randInt(0, statusPool.length - 1)];

    const r = await pool.query(
      `INSERT INTO reservations (reservation_no, guest_id, room_id, check_in_date, check_out_date, adults, children, rate, discount, deposit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [gen('RES'), gid, rid, dateStr(checkIn), dateStr(checkOut), randInt(1, 2), randInt(0, 2), rate, disc, randInt(0, 1) ? randInt(10000, 50000) : 0, status]);
    resvNo.push(r.rows[0]);
    if (status === 'CHECKED_OUT') stayReservations.push(r.rows[0]);
    if (status === 'CONFIRMED') {
      await pool.query("UPDATE rooms SET status='RESERVED' WHERE id=$1 AND status='AVAILABLE'", [rid]);
    }
  }

  // Check-ins for checked_out & occupied (make some rooms occupied with current stays)
  for (const r of stayReservations) {
    const ci = new Date(r.check_in_date);
    ci.setHours(10, 0, 0, 0);
    await pool.query('INSERT INTO check_ins (reservation_id, guest_id, room_id, checkin_time, checked_in_by) VALUES ($1,$2,$3,$4,$5)', [r.id, r.guest_id, r.room_id, ts(ci), userId.reception]);
    const co = new Date(r.check_out_date);
    co.setHours(12, 0, 0, 0);
    await pool.query('INSERT INTO check_outs (reservation_id, guest_id, room_id, checkout_time, checked_out_by) VALUES ($1,$2,$3,$4,$5)', [r.id, r.guest_id, r.room_id, ts(co), userId.reception]);
    await pool.query("UPDATE reservations SET status='CHECKED_OUT' WHERE id=$1", [r.id]);
  }

  // Create some currently checked-in guests (active stays)
  const activeStays = [];
  for (let i = 0; i < 10; i++) {
    const guest = rand(guestNames);
    const gid = guestId[guest];
    // find an AVAILABLE room currently (excluding demo room 204)
    const avail = await pool.query("SELECT id, room_number FROM rooms WHERE status='AVAILABLE' AND room_number<>'204' ORDER BY random() LIMIT 1");
    if (avail.rows.length === 0) break;
    const rid = avail.rows[0].id;
    const nights = randInt(2, 5);
    const ci = daysAgo(randInt(0, 3));
    const co = new Date(ci);
    co.setDate(co.getDate() + nights);
    const rate = randInt(50000, 200000);
    const r = await pool.query(
      `INSERT INTO reservations (reservation_no, guest_id, room_id, check_in_date, check_out_date, adults, children, rate, discount, deposit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0,'CHECKED_IN') RETURNING *`,
      [gen('RES'), gid, rid, dateStr(ci), dateStr(co), 1, 0, rate]);
    const R = r.rows[0];
    const ci2 = new Date(ci); ci2.setHours(11, 0, 0, 0);
    await pool.query('INSERT INTO check_ins (reservation_id, guest_id, room_id, checkin_time, checked_in_by) VALUES ($1,$2,$3,$4,$5)', [R.id, gid, rid, ts(ci2), userId.reception]);
    await pool.query("UPDATE rooms SET status='OCCUPIED' WHERE id=$1", [rid]);
    activeStays.push({ reservation: R, gid, rid, rate, nights });
  }

  // ============ FOLIOS, ROOM CHARGES, PAYMENTS ============
  // For every reservation, build a folio invoice with room charge + partial/full payments
  for (const r of resvNo) {
    const nights = Math.round((new Date(r.check_out_date) - new Date(r.check_in_date)) / 86400000);
    const roomCharge = nights * Number(r.rate) - Number(r.discount);
    const inv = await pool.query(
      `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, total, paid, balance, status)
       VALUES ($1,$2,$3,'HOTEL',$4,$4,0,$4,'UNPAID') RETURNING *`,
      [gen('INV'), r.guest_id, r.id, roomCharge]);
    await pool.query(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$4)`,
      [inv.rows[0].id, `Room ${nights} nights × ₦${Number(r.rate).toLocaleString()}`, nights, roomCharge]);

    const paid = Math.random() < 0.8 ? Math.round(roomCharge * (Math.random() * 0.5 + 0.5)) : Math.round(roomCharge * 0.2);
    if (r.deposit > 0) {
      await pool.query(
        `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, created_at, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,'ROOM','Deposit',now() - interval '3 days',$7)`,
        [gen('PAY'), r.guest_id, r.id, inv.rows[0].id, r.deposit, 'CASH', userId.reception]);
    }
    const finalPaid = Math.min(paid, roomCharge);
    await pool.query(
      `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, created_at, received_by)
       VALUES ($1,$2,$3,$4,$5,$6,'ROOM','Room payment',$7,$8)`,
      [gen('PAY'), r.guest_id, r.id, inv.rows[0].id, finalPaid, rand(['CASH', 'POS', 'TRANSFER', 'CARD']), ts(daysAgo(randInt(1, 30))), userId.reception]);
    const balance = roomCharge - finalPaid;
    await pool.query(
      `UPDATE invoices SET paid=$2, balance=$3, status=CASE WHEN $3::numeric<=0 THEN 'PAID' ELSE 'PARTIAL' END WHERE id=$1`,
      [inv.rows[0].id, finalPaid, balance]);
  }

  // ============ RESTAURANT ORDERS (historical + active) ============
  const itemNames = Object.keys(r1Items);
  for (let i = 0; i < 60; i++) {
    const rest = Math.random() < 0.7 ? r1 : r2;
    const t = await pool.query('SELECT * FROM restaurant_tables WHERE restaurant_id=$1 ORDER BY random() LIMIT 1', [rest]);
    const tid = t.rows[0].id;
    const nItems = randInt(1, 4);
    let subtotal = 0;
    const lines = [];
    for (let j = 0; j < nItems; j++) {
      const mi = await pool.query('SELECT * FROM menu_items WHERE restaurant_id=$1 ORDER BY random() LIMIT 1', [rest]);
      const qty = randInt(1, 3);
      subtotal += Number(mi.rows[0].price) * qty;
      lines.push({ mi: mi.rows[0], qty });
    }
    const restRow = await pool.query('SELECT * FROM restaurants WHERE id=$1', [rest]);
    const tax = subtotal * Number(restRow.rows[0].tax_rate) / 100;
    const total = subtotal + tax;
    // mostly paid/closed orders; a few open
    const isOpen = Math.random() < 0.15;
    const status = isOpen ? 'OPEN' : 'PAID';
    const created = ts(daysAgo(randInt(0, 30)));
    const o = await pool.query(
      `INSERT INTO orders (order_no, restaurant_id, table_id, status, subtotal, tax, total, payment_method, is_charged_to_room, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [gen('ORD'), rest, tid, status, subtotal, tax, total, isOpen ? null : rand(['CASH', 'POS', 'TRANSFER', 'CARD']), false, created, userId.pos]);
    for (const l of lines) {
      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [o.rows[0].id, l.mi.id, l.mi.name, l.qty, l.mi.price, l.mi.price * l.qty]);
    }
    if (status === 'PAID') {
      const inv = await pool.query(
        `INSERT INTO invoices (invoice_no, guest_id, order_id, invoice_type, subtotal, tax, total, paid, balance, status)
         VALUES ($1,null,$2,'RESTAURANT',$3,$4,$5,$5,0,'PAID') RETURNING *`,
        [gen('INV'), o.rows[0].id, subtotal, tax, total]);
      await pool.query(
        `INSERT INTO payments (payment_no, order_id, invoice_id, amount, method, category, note, created_at, received_by)
         VALUES ($1,$2,$3,$4,$5,'RESTAURANT','Restaurant sale',$6,$7)`,
        [gen('PAY'), o.rows[0].id, inv.rows[0].id, total, rand(['CASH', 'POS', 'TRANSFER', 'CARD']), created, userId.pos]);
      await pool.query("UPDATE restaurant_tables SET status='AVAILABLE' WHERE id=$1", [tid]);
    } else {
      await pool.query("UPDATE restaurant_tables SET status='OCCUPIED' WHERE id=$1", [tid]);
    }
  }

  // ============ POOLSIDE & FROSTY POPS ORDERS ============
  for (const [rest, prefix] of [[r3, 'P'], [r4, 'F']]) {
    for (let i = 0; i < 12; i++) {
      const t = await pool.query('SELECT * FROM restaurant_tables WHERE restaurant_id=$1 ORDER BY random() LIMIT 1', [rest]);
      const tid = t.rows[0].id;
      const nItems = randInt(1, 3);
      let subtotal = 0;
      const lines = [];
      for (let j = 0; j < nItems; j++) {
        const mi = await pool.query('SELECT * FROM menu_items WHERE restaurant_id=$1 ORDER BY random() LIMIT 1', [rest]);
        const qty = randInt(1, 2);
        subtotal += Number(mi.rows[0].price) * qty;
        lines.push({ mi: mi.rows[0], qty });
      }
      const restRow = await pool.query('SELECT * FROM restaurants WHERE id=$1', [rest]);
      const tax = subtotal * Number(restRow.rows[0].tax_rate) / 100;
      const total = subtotal + tax;
      const isOpen = Math.random() < 0.1;
      const status = isOpen ? 'OPEN' : 'PAID';
      const created = ts(daysAgo(randInt(0, 14)));
      const o = await pool.query(
        `INSERT INTO orders (order_no, restaurant_id, table_id, status, subtotal, tax, total, payment_method, is_charged_to_room, created_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [gen('ORD'), rest, tid, status, subtotal, tax, total, isOpen ? null : rand(['CASH', 'POS']), false, created, userId.pos]);
      for (const l of lines) {
        await pool.query(
          `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [o.rows[0].id, l.mi.id, l.mi.name, l.qty, l.mi.price, l.mi.price * l.qty]);
      }
      if (status === 'PAID') {
        const inv = await pool.query(
          `INSERT INTO invoices (invoice_no, guest_id, order_id, invoice_type, subtotal, tax, total, paid, balance, status)
           VALUES ($1,null,$2,'RESTAURANT',$3,$4,$5,$5,0,'PAID') RETURNING *`,
          [gen('INV'), o.rows[0].id, subtotal, tax, total]);
        await pool.query(
          `INSERT INTO payments (payment_no, order_id, invoice_id, amount, method, category, note, created_at, received_by)
           VALUES ($1,$2,$3,$4,$5,'RESTAURANT','Outlet sale',$6,$7)`,
          [gen('PAY'), o.rows[0].id, inv.rows[0].id, total, rand(['CASH', 'POS']), created, userId.pos]);
        await pool.query("UPDATE restaurant_tables SET status='AVAILABLE' WHERE id=$1", [tid]);
      } else {
        await pool.query("UPDATE restaurant_tables SET status='OCCUPIED' WHERE id=$1", [tid]);
      }
    }
  }

  // ============ CHARGE-TO-ROOM EXAMPLE: Ahmed Musa (Room 204) ============
  // Explicitly create Ahmed Musa so the demo scenario is guaranteed.
  // (Room 204 was excluded from the random reservation loop above.)
  const ahmedGuest = await pool.query(
    `SELECT id FROM guests WHERE full_name='Ahmed Musa' LIMIT 1`);
  let ahmedId;
  if (ahmedGuest.rows.length) {
    ahmedId = ahmedGuest.rows[0].id;
  } else {
    const ag = await pool.query(
      `INSERT INTO guests (full_name, phone, email, address, id_type, id_number, nationality)
       VALUES ('Ahmed Musa','08123456789','ahmed.musa@mail.com','12 Sultan Road, Kano','NIN','99988877766','Nigerian')
       RETURNING id`);
    ahmedId = ag.rows[0].id;
  }
  const ahmedRoom = roomId['204'];
  const ciA = daysAgo(2), coA = new Date(ciA); coA.setDate(coA.getDate() + 3);
  const rateA = 60000;
  const aRes = await pool.query(
    `INSERT INTO reservations (reservation_no, guest_id, room_id, check_in_date, check_out_date, adults, children, rate, discount, deposit, status, special_requests)
     VALUES ($1,$2,$3,$4,$5,2,1,$6,10000,100000,'CHECKED_IN','Business trip — express check-in requested') RETURNING *`,
    [gen('RES'), ahmedId, ahmedRoom, dateStr(ciA), dateStr(coA), rateA]);
  const ciA2 = new Date(ciA); ciA2.setHours(12, 0, 0, 0);
  await pool.query('INSERT INTO check_ins (reservation_id, guest_id, room_id, checkin_time, checked_in_by) VALUES ($1,$2,$3,$4,$5)', [aRes.rows[0].id, ahmedId, ahmedRoom, ts(ciA2), userId.reception]);
  await pool.query("UPDATE rooms SET status='OCCUPIED' WHERE id=$1", [ahmedRoom]);

  const aInv = await pool.query(
    `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, total, paid, balance, status)
     VALUES ($1,$2,$3,'HOTEL',180000,180000,100000,80000,'PARTIAL') RETURNING *`,
    [gen('INV'), ahmedId, aRes.rows[0].id]);
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,'Room 3 nights × ₦60,000',3,60000,180000)`,
    [aInv.rows[0].id]);
  await pool.query(
    `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, received_by)
     VALUES ($1,$2,$3,$4,100000,'TRANSFER','ROOM','Deposit - Bank transfer',$5)`,
    [gen('PAY'), ahmedId, aRes.rows[0].id, aInv.rows[0].id, userId.reception]);
  // Restaurant charge on folio (prior day's meal charged to the room)
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,'Room service — Jollof Rice × 2, Grilled Chicken × 2, Soft Drink × 3',1,15000,15000)`,
    [aInv.rows[0].id]);
  await pool.query(`UPDATE invoices SET subtotal=subtotal+15000, total=total+15000, balance=total-paid WHERE id=$1`, [aInv.rows[0].id]);
  // Frosty Pops charge on folio (gelato & milkshake for the family)
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,'Frosty Pops — Vanilla Gelato × 2, Chocolate Milkshake × 2',1,10000,10000)`,
    [aInv.rows[0].id]);
  await pool.query(`UPDATE invoices SET subtotal=subtotal+10000, total=total+10000, balance=total-paid WHERE id=$1`, [aInv.rows[0].id]);

  // ============ AMENITIES & SERVICES ============
  const amenityDefs = [
    ['Tahir Facilities Swimming Pool', 'POOL', 'Outdoor swimming pool with cabanas and poolside service', 'ACTIVE',
     'Ground floor - east wing', '6:00 AM - 10:00 PM', 5000, 'PAID', 24],
    ['Tahir Fitness Center', 'FITNESS', 'Modern gym with cardio, free weights and personal training', 'ACTIVE',
     'Ground floor - fitness wing', '5:00 AM - 10:00 PM', 3000, 'PAID', 30],
    ['Tahir Serenity Spa', 'SPA', 'Full-service wellness spa - massages, facials and body treatments', 'ACTIVE',
     'First floor - wellness wing', '9:00 AM - 9:00 PM', 20000, 'PAID', 12],
    ['Tahir Barbershop', 'BARBERSHOP', 'Classic barbershop - cuts, shaves and grooming', 'ACTIVE',
     'Ground floor - near lobby', '8:00 AM - 8:00 PM', 5000, 'PAID', 8],
  ];
  const amenityId = {};
  for (const [name, cat, desc, status, loc, hours, price, ptype, cap] of amenityDefs) {
    const r = await pool.query(
      `INSERT INTO amenities (name, category, description, status, location, operating_hours, price, pricing_type, capacity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [name, cat, desc, status, loc, hours, price, ptype, cap]);
    amenityId[cat] = r.rows[0].id;
  }

  // Services per amenity
  const svcDefs = [
    [amenityId.POOL, 'Lounge Chair & Towel', 5000, 120, 4],
    [amenityId.POOL, 'Private Cabana (4hr)', 15000, 240, 4],
    [amenityId.POOL, 'Private Cabana (Full Day)', 25000, 480, 4],
    [amenityId.FITNESS, 'Day Pass', 3000, 240, 30],
    [amenityId.FITNESS, 'Personal Training Session', 8000, 60, 1],
    [amenityId.SPA, 'Swedish Massage (60min)', 20000, 60, 1],
    [amenityId.SPA, 'Deep Tissue Massage (60min)', 25000, 60, 1],
    [amenityId.SPA, 'Aromatherapy Massage (90min)', 30000, 90, 1],
    [amenityId.SPA, 'Facial Treatment', 18000, 45, 1],
    [amenityId.BARBERSHOP, 'Haircut', 5000, 30, 4],
    [amenityId.BARBERSHOP, 'Haircut & Beard Trim', 7000, 45, 4],
    [amenityId.BARBERSHOP, 'Royal Shave', 8000, 30, 2],
  ];
  const serviceId = {};
  for (const [aid, name, price, dur, cap] of svcDefs) {
    const r = await pool.query(
      `INSERT INTO amenity_services (amenity_id, name, price, pricing_type, duration_min, capacity, status)
       VALUES ($1,$2,$3,'FIXED',$4,$5,'ACTIVE') RETURNING id`, [aid, name, price, dur, cap]);
    serviceId[name] = r.rows[0].id;
  }

  // SPA charge-to-room example for Ahmed Musa on Room 204 folio (demo flow)
  const spaNow = new Date(); spaNow.setDate(spaNow.getDate() - 1); spaNow.setHours(15, 0, 0, 0);
  const spaEnd = new Date(spaNow); spaEnd.setHours(16, 0, 0, 0);
  const spaAppt = await pool.query(
    `INSERT INTO service_appointments (appointment_no, amenity_id, service_id, guest_id, staff_user_id, customer_name, start_time, end_time, price, status, is_charged_to_room, payment_status)
     VALUES ($1,$2,$3,$4,$5,'Ahmed Musa',$6,$7,20000,'COMPLETED',TRUE,'CHARGED') RETURNING id`,
    [gen('SAP'), amenityId.SPA, serviceId['Swedish Massage (60min)'], ahmedId, userId.reception, ts(spaNow), ts(spaEnd)]);
  // Add SPA charge line to Ahmed's existing folio + EVENT/SPA revenue representation on folio
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,'SPA — Tahir Serenity Spa - Swedish Massage (60min) appointment',1,20000,20000)`,
    [aInv.rows[0].id]);
  await pool.query(`UPDATE invoices SET subtotal=subtotal+20000, total=total+20000, balance=balance+20000 WHERE id=$1`, [aInv.rows[0].id]);
  await pool.query(
    `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, service_appointment_id, amount, method, category, note, received_by)
     VALUES ($1,$2,$3,$4,$5,20000,'POS','SPA','Spa massage charged to room folio',$6)`,
    [gen('PAY'), ahmedId, aRes.rows[0].id, aInv.rows[0].id, spaAppt.rows[0].id, userId.reception]);

  // Barbershop + pool (cabana) appointments for random walk-in guests
  const walkInGuests = await pool.query("SELECT id FROM guests WHERE full_name<>'Ahmed Musa' LIMIT 2");
  for (let i = 0; i < walkInGuests.rows.length; i++) {
    const g = walkInGuests.rows[i].id;
    const day = new Date(); day.setDate(day.getDate() - (i + 1)); day.setHours(11, 0 + i * 2, 0, 0);
    const end = new Date(day); end.setHours(day.getHours() + 1);
    if (i === 0) {
      await pool.query(
        `INSERT INTO service_appointments (appointment_no, amenity_id, service_id, guest_id, staff_user_id, customer_name, start_time, end_time, price, status, payment_status)
         VALUES ($1,$2,$3,$4,$5,'Walk-in',$6,$7,5000,'COMPLETED','PAID') RETURNING id`,
        [gen('SAP'), amenityId.BARBERSHOP, serviceId['Haircut'], g, userId.reception, ts(day), ts(end)]);
    } else {
      await pool.query(
        `INSERT INTO service_appointments (appointment_no, amenity_id, service_id, guest_id, staff_user_id, customer_name, start_time, end_time, price, status, payment_status)
         VALUES ($1,$2,$3,$4,$5,'Walk-in',$6,$7,15000,'COMPLETED','PAID') RETURNING id`,
        [gen('SAP'), amenityId.POOL, serviceId['Private Cabana (4hr)'], g, userId.reception, ts(day), ts(end)]);
    }
  }

  // ============ CONFERENCE & EVENTS ============
  const hallDefs = ['Conference Hall 1', 'Conference Hall 2', 'Conference Hall 3', 'Conference Hall 4', 'Conference Hall 5', 'Conference Hall 6', 'Conference Hall 7', 'Conference Hall 8'];
  const hallId = {};
  for (const name of hallDefs) {
    const r = await pool.query(
      `INSERT INTO conference_halls (name, capacity, location, description, rate, rate_type, status)
       VALUES ($1,$2,'Conference Centre', $3,$4,'DAILY','AVAILABLE') RETURNING id`,
      [name, 120, `${name} - full AV, seating, AC`, randInt(150000, 350000)]);
    hallId[name] = r.rows[0].id;
  }

  const evSvcDefs = [
    ['Standard Catering (per head)', 'Buffet catering service', 8500, 'head'],
    ['Premium Catering (per head)', 'Premium buffet with live stations', 12000, 'head'],
    ['Projector & Screen', 'Full HD projector with screen', 30000, 'session'],
    ['Sound System', 'PA system with microphones', 40000, 'session'],
    ['Stage Setup', 'Stage, podium and backdrop', 25000, 'event'],
    ['Table & Chair Rental', 'Per table of 10', 8000, 'table'],
  ];
  const evSvcId = {};
  for (const [name, desc, price, unit] of evSvcDefs) {
    const r = await pool.query(`INSERT INTO event_services (name, description, price, unit) VALUES ($1,$2,$3,$4) RETURNING id`, [name, desc, price, unit]);
    evSvcId[name] = r.rows[0].id;
  }

  // Conference Hall 3 - Eze & Sons corporate conference with catering (demo flow)
  const evDate = new Date(); evDate.setDate(evDate.getDate() + 7);
  const evStart = '09:00', evEnd = '17:00';
  const attendees = 80;
  const hall3 = hallId['Conference Hall 3'];
  const hallRow = await pool.query(`SELECT * FROM conference_halls WHERE id=$1`, [hall3]);
  const hallRate = Number(hallRow.rows[0].rate);
  const catering = 8500 * attendees;
  const cateringLine = catering;
  const evTotal = hallRate + cateringLine;
  const evDeposit = 100000;
  const evb = await pool.query(
    `INSERT INTO event_bookings (booking_no, customer_name, organization, phone, email, hall_id, event_type, event_date, start_time, end_time, attendees, rate, discount, deposit, balance, payment_status, restaurant_id, invoiced_amount, status, notes, created_by)
     VALUES ($1,'Mr. Chinedu Eze','Eze & Sons Ltd','08070000001','events@ezesons.com',$2,'Conference',$3,$4,$5,$6,$7,0,$8,$9,'PARTIAL',$10,$11,'CONFIRMED','Corporate strategy conference with full-day catering',$12) RETURNING *`,
    [gen('EVT'), hall3, dateStr(evDate), evStart, evEnd, attendees, hallRate, evDeposit, evTotal - evDeposit, r2, evTotal, userId.gm]);
  const evBookingId = evb.rows[0].id;
  // Event services lines
  const lines = [
    ['Standard Catering (per head)', attendees, 8500, catering],
    ['Projector & Screen', 1, 30000, 30000],
    ['Sound System', 1, 40000, 40000],
  ];
  for (const [sname, qty, up, line] of lines) {
    await pool.query(
      `INSERT INTO event_booking_services (booking_id, service_id, service_name, quantity, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [evBookingId, evSvcId[sname], sname, qty, up, line]);
  }
  const evInv = await pool.query(
    `INSERT INTO invoices (invoice_no, invoice_type, subtotal, total, paid, balance, status)
     VALUES ($1,'EVENT',$2,$2,$3,$4,'PARTIAL') RETURNING *`,
    [gen('INV'), evTotal, evDeposit, evTotal - evDeposit]);
  await pool.query(`UPDATE event_bookings SET invoice_id=$1 WHERE id=$2`, [evInv.rows[0].id, evBookingId]);
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,'Conference Hall 3 (Eze & Sons) - venue, catering & AV',1,$2,$2)`,
    [evInv.rows[0].id, evTotal]);
  await pool.query(
    `INSERT INTO payments (payment_no, event_booking_id, invoice_id, amount, method, category, note, received_by)
     VALUES ($1,$2,$3,$4,'TRANSFER','EVENT','Event deposit - bank transfer',$5)`,
    [gen('PAY'), evBookingId, evInv.rows[0].id, evDeposit, userId.account]);

  // ============ EXPENSES ============
  const expCats = ['Food supplies', 'Electricity', 'Water', 'Maintenance', 'Salaries', 'Cleaning', 'Other'];
  for (let i = 0; i < 30; i++) {
    const cat = rand(expCats);
    await pool.query(
      `INSERT INTO expenses (category, description, amount, restaurant_id, paid_to, method, incurred_by, incurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [cat, `${cat} expense ${i + 1}`, randInt(20000, 500000), Math.random() < 0.3 ? (Math.random() < 0.5 ? r1 : r2) : null,
       rand(['GTB', 'First Bank', 'UBA', 'Zenith', 'Cash']), rand(['CASH', 'TRANSFER', 'POS']), userId.account, ts(daysAgo(randInt(0, 30)))]);
  }

  // ============ PURCHASES ============
  for (let i = 0; i < 8; i++) {
    const sup = rand(suppliers);
    const pid = supplierId[sup];
    const invItems = await pool.query('SELECT * FROM inventory_items ORDER BY random() LIMIT 3');
    let total = 0;
    const purchase = await pool.query(
      `INSERT INTO purchases (purchase_no, supplier_id, total, payment_status, created_by)
       VALUES ($1,$2,0,$3,$4) RETURNING *`,
      [gen('PUR'), pid, rand(['PAID', 'UNPAID', 'PARTIAL']), userId.store]);
    for (const it of invItems.rows) {
      const qty = randInt(10, 100);
      const line = qty * Number(it.cost_price);
      total += line;
      await pool.query(
        `INSERT INTO purchase_items (purchase_id, item_id, item_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [purchase.rows[0].id, it.id, it.name, qty, it.cost_price, line]);
      await pool.query(`UPDATE inventory_items SET quantity=quantity+$2 WHERE id=$1`, [it.id, qty]);
      await pool.query(`INSERT INTO inventory_transactions (item_id, type, quantity, ref_type, ref_id, note) VALUES ($1,'PURCHASE',$2,'purchases',$3,'Purchase receipt')`, [it.id, qty, purchase.rows[0].id]);
    }
    await pool.query(`UPDATE purchases SET total=$2 WHERE id=$1`, [purchase.rows[0].id, total]);
  }

  // ============ HOUSEKEEPING ============
  const roomsWithStatus = await pool.query('SELECT id, room_number, status FROM rooms');
  for (const rm of roomsWithStatus.rows) {
    const hkStatus = rm.status === 'CLEANING' ? 'CLEANING' : (rm.status === 'OCCUPIED' ? 'DIRTY' : 'CLEAN');
    const taskStatus = (hkStatus === 'CLEAN' || hkStatus === 'INSPECTED') ? 'COMPLETED' : (hkStatus === 'CLEANING' ? 'IN_PROGRESS' : 'PENDING');
    const completed = (hkStatus === 'CLEAN' || hkStatus === 'INSPECTED') ? new Date() : null;
    await pool.query(
      `INSERT INTO housekeeping_tasks (room_id, status, task_status, priority, assigned_to, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [rm.id, hkStatus, taskStatus, rand(['LOW', 'MEDIUM', 'HIGH']), userId.hskeeper, completed]);
  }

  // ============ MAINTENANCE TICKETS (demo) ============
  const maintDefs = [
    ['Air conditioning not cooling', 'ROOM', 'AC_REPAIR', 'HIGH', 'OPEN', 'Room 208'],
    ['Leaking toilet', 'ROOM', 'PLUMBING', 'MEDIUM', 'IN_PROGRESS', 'Room 304'],
    ['Pool pump failure', 'POOL', 'EQUIPMENT', 'CRITICAL', 'OPEN', 'Pool area'],
    ['Broken window in hall', 'CONFERENCE_HALL', 'FACILITY', 'MEDIUM', 'WAITING_PARTS', 'Conference Hall 3'],
    ['Kitchen refrigerator noise', 'KITCHEN', 'EQUIPMENT', 'LOW', 'ASSIGNED', 'Main kitchen'],
  ];
  const maintTicket = {};
  for (const [desc, facility, cat, priority, status, loc] of maintDefs) {
    const roomMatch = await pool.query('SELECT id FROM rooms WHERE room_number=$1', [loc.split(/[ ]/).pop()]);
    const roomRow = (status === 'OPEN' && priority === 'CRITICAL') ? null : null;
    const roomId = (cat === 'ROOM' || cat === 'CONFERENCE_HALL') ? (await pool.query('SELECT id FROM rooms WHERE room_number=$1 LIMIT 1', [loc.split(/Room |Hall /).pop() || null])).rows[0]?.id : null;
    const t = await pool.query(
      `INSERT INTO maintenance_tickets (ticket_no, location, room_id, facility, problem_category, description, reported_by, assigned_to, priority, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [gen('MT'), loc, roomId, facility, cat, desc, userId.reception, priority === 'LOW' || priority === 'MEDIUM' ? userId.maint : null, priority, status]);
    maintTicket[t.rows[0].ticket_no] = t.rows[0].id;
  }

  // ============ CASHIER SHIFTS (demo) ============
  for (let i = 0; i < 3; i++) {
    const opening = randInt(50000, 150000);
    const closed = await pool.query(
      `INSERT INTO cashier_shifts (shift_no, staff_user_id, opening_cash, total_transactions, status, opened_at, closed_at, notes)
       VALUES ($1,$2,$3,$4,'CLOSED',now()-($5||' days')::interval,now()-($5||' days')::interval + interval '9 hours','Demo closed shift') RETURNING *`,
      [gen('SHIFT'), userId.account, opening, randInt(5, 30), i + 1]);
  }

  // ============ GUEST PREFERENCES (demo for Ahmed Musa / guests) ============
  const someGuest = await pool.query('SELECT id, full_name FROM guests LIMIT 5');
  for (const g of someGuest.rows) {
    await pool.query(
      `INSERT INTO guest_preferences (guest_id, room_preference, bed_preference, smoking_preference, food_preferences, special_requests)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [g.id, 'High floor with a view', 'King', 'Non-smoking', 'Vegetarian options', 'Late checkout if possible']);
  }

  // ============ RESTAURANT STAFF ASSIGNMENTS & TEST ACCOUNTS ============
  // One staff account per outlet (dev credentials: restaurant1..restaurant4 / admin123).
  const restStaffDefs = [
    ['Restaurant 1 Staff', 'restaurant1', 'restaurant1@test.local', '08000001001', r1],
    ['Restaurant 2 Staff', 'restaurant2', 'restaurant2@test.local', '08000001002', r2],
    ['Restaurant 3 Staff', 'restaurant3', 'restaurant3@test.local', '08000001003', r3],
    ['Restaurant 4 Staff', 'restaurant4', 'restaurant4@test.local', '08000001004', r4],
  ];
  for (const [name, uname, email, phone, rid] of restStaffDefs) {
    const u = await pool.query(
      `INSERT INTO users (full_name, username, email, phone, password_hash, role_id, department)
       VALUES ($1,$2,$3,$4,$5,$6,'RESTAURANT') RETURNING id`,
      [name, uname, email, phone, adminHash, roleId.RESTAURANT_STAFF]);
    await pool.query(
      `INSERT INTO staff_restaurants (staff_id, restaurant_id, is_primary) VALUES ($1,$2,TRUE)`,
      [u.rows[0].id, rid]);
  }
  // Assign the existing demo POS staff user (pos) to Restaurant 2.
  if (userId.pos) {
    await pool.query(`INSERT INTO staff_restaurants (staff_id, restaurant_id, is_primary) VALUES ($1,$2,TRUE) ON CONFLICT DO NOTHING`, [userId.pos, r2]);
  }
  // Assign the existing demo Restaurant Manager (restman) to Restaurants 1 & 2.
  if (userId.restman) {
    await pool.query(`INSERT INTO staff_restaurants (staff_id, restaurant_id, is_primary) VALUES ($1,$2,TRUE) ON CONFLICT DO NOTHING`, [userId.restman, r1]);
    await pool.query(`INSERT INTO staff_restaurants (staff_id, restaurant_id, is_primary) VALUES ($1,$2,FALSE) ON CONFLICT DO NOTHING`, [userId.restman, r2]);
  }

  console.log('✅ Seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
